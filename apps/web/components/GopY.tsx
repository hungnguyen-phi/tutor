"use client";

/**
 * GÓP Ý TRONG APP (05/09). Chủ dự án thử 4 kiểu phiếu Excel/Word đều "nhìn không
 * hiểu, khó dùng" — vì bắt học sinh rời app, nhớ lại bài nào câu nào, rồi dò ô
 * để điền. Ở đây ngược lại: em bấm ngay chỗ đang bực, app tự ghi bài / câu / lời
 * sư tử, em chỉ gõ một câu cảm nhận. Lưu thẳng bảng `student_feedback` (RLS: em
 * chỉ ghi được cho chính mình; giáo viên/admin đọc).
 */

import { useEffect, useState } from "react";
import { MessageSquareText, Send } from "lucide-react";
import Sheet from "./Sheet";
import Lion from "./Lion";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

export type GopYCtx = {
  page: string;
  subject?: string;
  nodeKey?: string | null;
  questionId?: string | null;
  /** Câu sư tử vừa nói — khi bấm từ bong bóng chat. */
  tutorText?: string | null;
};

const TAGS: { key: string; label: string }[] = [
  { key: "kho_hieu", label: "Khó hiểu" },
  { key: "khong_thich", label: "Không thích" },
  { key: "sai", label: "Sai rồi" },
  { key: "cham", label: "Chậm / lỗi" },
  { key: "hay", label: "Thấy hay" },
];

export function GopYSheet({ ctx, onClose }: { ctx: GopYCtx | null; onClose: () => void }) {
  const { session, profile } = useAuth();
  const [tag, setTag] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Mở lại là phiếu mới — không giữ chữ của lần trước.
  useEffect(() => {
    if (ctx) { setTag(null); setText(""); setDone(false); setErr(null); }
  }, [ctx]);

  async function gui() {
    const uid = session?.user.id;
    const loi = text.trim();
    if (!uid || !ctx || !loi || busy) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from("student_feedback").insert({
      tenant_id: profile?.tenant_id ?? null,
      student_id: uid,
      page: ctx.page,
      subject: ctx.subject ?? null,
      node_key: ctx.nodeKey ?? null,
      question_id: ctx.questionId ?? null,
      tutor_text: ctx.tutorText ?? null,
      tag,
      student_text: loi,
      device: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 160) : null,
    });
    setBusy(false);
    if (error) { setErr("Chưa gửi được, bạn thử lại nhé."); return; }
    setDone(true);
    window.setTimeout(onClose, 1400);
  }

  return (
    <Sheet open={!!ctx} onClose={onClose} title={done ? "Đã nhận!" : "Bạn thấy sao?"}>
      {done ? (
        <div className="tb-pop">
          <Lion mood="happy" size={96} decorative />
          <p className="tb-loi">Cảm ơn bạn. Người làm app sẽ đọc từng chữ.</p>
        </div>
      ) : (
        <div className="gy">
          {ctx?.tutorText && (
            <blockquote className="gy-quote">
              <span className="gy-quote-who">Sư tử vừa nói</span>
              {ctx.tutorText}
            </blockquote>
          )}
          <div className="gy-chips" role="group" aria-label="Kiểu góp ý">
            {TAGS.map((t) => (
              <button
                key={t.key}
                type="button"
                aria-pressed={tag === t.key}
                onClick={() => setTag(tag === t.key ? null : t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <textarea
            className="gy-text"
            rows={4}
            maxLength={1000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Kể thật: bạn thấy sao, vì sao, muốn nó thế nào…"
            data-autofocus
            autoCapitalize="sentences"
          />
          {err && <p className="st-msg err" role="status">{err}</p>}
          <button className="btn btn-gold btn-block" disabled={busy || !text.trim()} onClick={gui} data-loading={busy || undefined}>
            <Send aria-hidden strokeWidth={2.25} />
            Gửi góp ý
          </button>
        </div>
      )}
    </Sheet>
  );
}

/** Nút nổi "Góp ý" — đứng góc dưới phải mọi màn. */
export function GopYFab({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="gy-fab" onClick={onOpen} aria-label="Góp ý về app">
      <MessageSquareText aria-hidden strokeWidth={2.25} />
      <span>Góp ý</span>
    </button>
  );
}
