"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/**
 * Công tắc TÍNH NĂNG "Học cùng nhau". TẠM TẮT: realtime websocket không đi qua
 * proxy Next dev (`/__sb`) một cách ổn định, nên tạm gỡ khỏi giao diện cho tới
 * khi đường realtime được xử lý riêng. Bật lại = đổi thành `true` (một chỗ duy
 * nhất — hook không kết nối, PresenceStrip và công tắc trong Cài đặt tự hiện lại).
 */
export const PRESENCE_ENABLED = false;

/** Một bạn học đang online cùng cohort (đã lọc bỏ chính mình). */
export type Peer = { id: string; name: string; tone: string; leg: number };

type Self = { id: string; name: string; tone: string };

/**
 * "HỌC CÙNG NHAU" — presence realtime theo COHORT (tenant + khối + môn). Chỉ CHẠY
 * khi opt-in (`enabled`). Kênh RIÊNG TƯ (private:true): RLS trên realtime.messages
 * chỉ cho tham gia đúng cohort của mình (không xem chéo khối/trường).
 *
 * Payload THÔ (privacy): chỉ tên gọi + tông màu avatar + CHỈ SỐ CHẶNG (chương),
 * KHÔNG bao giờ lộ node chính xác "đang kẹt câu nào". Đổi chặng mới track lại
 * (throttle theo sự kiện, không theo scroll); tab nền thì untrack (không "ma"
 * online, đỡ hao pin/băng thông).
 *
 * Mở rộng: kênh nhỏ theo cohort (Presence tốn ~O(N²)/kênh) — pilot cohort ít
 * người nên ổn; quy mô lớn cần định danh LỚP (roster) để bó nhỏ hơn.
 */
export function usePresence(opts: {
  enabled: boolean;
  tenantId?: string | null;
  grade?: string | null;
  subject: string;
  self: Self;
  leg: number;
}): Peer[] {
  const { enabled, tenantId, grade, subject, self, leg } = opts;
  const [peers, setPeers] = useState<Peer[]>([]);
  const chanRef = useRef<RealtimeChannel | null>(null);
  // Payload track mới nhất qua ref → effect cập nhật không phải re-subscribe.
  const meRef = useRef({ name: self.name, tone: self.tone, leg });
  meRef.current = { name: self.name, tone: self.tone, leg };

  const ready =
    PRESENCE_ENABLED && enabled && !!tenantId && !!grade && !!self.id && !!subject;
  // Tên topic KHÔNG chứa user_id/PII — chỉ cohort. RLS gác theo tenant+khối.
  const topic = ready ? `presence:${tenantId}:${grade}:${subject}` : null;

  // Subscribe/teardown khi cohort (topic) hoặc chính mình đổi.
  useEffect(() => {
    if (!topic) {
      setPeers([]);
      chanRef.current = null;
      return;
    }
    let alive = true;
    let chan: RealtimeChannel | null = null;

    (async () => {
      // Kênh private cần token mới nhất (autoRefresh đổi token → phải setAuth lại).
      const { data } = await supabase.auth.getSession();
      const tok = data.session?.access_token;
      if (!tok || !alive) return;
      supabase.realtime.setAuth(tok);

      chan = supabase.channel(topic, {
        config: { private: true, presence: { key: self.id } },
      });
      chanRef.current = chan;

      const sync = () => {
        if (!alive || !chan) return;
        const state = chan.presenceState<{ name: string; tone: string; leg: number }>();
        const list: Peer[] = [];
        for (const [id, metas] of Object.entries(state)) {
          if (id === self.id) continue;
          const m = metas[metas.length - 1];
          if (m) list.push({ id, name: String(m.name ?? ""), tone: String(m.tone ?? "gold"), leg: Number(m.leg ?? 0) });
        }
        setPeers(list);
      };

      chan
        .on("presence", { event: "sync" }, sync)
        .on("presence", { event: "join" }, sync)
        .on("presence", { event: "leave" }, sync)
        .subscribe((status) => {
          if (status === "SUBSCRIBED" && chan) {
            void chan.track(meRef.current);
          }
        });
    })();

    return () => {
      alive = false;
      if (chan) void supabase.removeChannel(chan);
      chanRef.current = null;
    };
  }, [topic, self.id]);

  // Đổi CHẶNG (hoặc tên/tông) → track lại trên kênh hiện có, không re-subscribe.
  useEffect(() => {
    const chan = chanRef.current;
    if (chan) void chan.track({ name: self.name, tone: self.tone, leg });
  }, [leg, self.name, self.tone]);

  // Tab nền → untrack (biến mất khỏi danh sách online); quay lại → track lại.
  useEffect(() => {
    const onVis = () => {
      const chan = chanRef.current;
      if (!chan) return;
      if (document.hidden) void chan.untrack();
      else void chan.track(meRef.current);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return peers;
}
