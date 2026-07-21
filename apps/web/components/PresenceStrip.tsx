"use client";

import { Users } from "lucide-react";
import type { Peer } from "../lib/presence";

/**
 * Dải "Đang học cùng" — chồng avatar bạn cùng khối đang online + đếm số. Rỗng
 * (không ai online / chưa opt-in) → không hiện gì. Avatar chỉ chữ cái đầu + tông
 * màu (không ảnh thật, không PII). Đông quá thì gom "+N".
 */
export default function PresenceStrip({ peers }: { peers: Peer[] }) {
  if (peers.length === 0) return null;
  const shown = peers.slice(0, 5);
  const extra = peers.length - shown.length;
  return (
    <div className="presence-strip" aria-live="polite">
      <span className="presence-avatars" aria-hidden>
        {shown.map((p) => (
          <span key={p.id} className="presence-av" data-tone={p.tone} title={p.name}>
            {(p.name || "?").charAt(0).toUpperCase()}
          </span>
        ))}
        {extra > 0 && <span className="presence-av presence-more">+{extra}</span>}
      </span>
      <span className="presence-label">
        <Users aria-hidden strokeWidth={2.25} />
        {peers.length} bạn đang học cùng
      </span>
    </div>
  );
}
