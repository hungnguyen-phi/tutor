"use client";

/**
 * THANH ÔN LẠI — dải icon tròn cạnh câu hỏi (chủ dự án 09/2026), audio/video/
 * ảnh của node đang làm. Bấm icon = mở popup xem/nghe ngay tại chỗ, không rời
 * màn làm bài; xem hết CẢ thanh (lần đầu) thì server tự cộng một khoản XP nhỏ.
 * Không ép — không có thì làm bài luôn, không sao cả (`data==null` ẩn hẳn).
 *
 * CỐ Ý không tái lập cột 3 "học liệu" đã bị gỡ 10/08 (chủ dự án: "rối, nhiều
 * món rời") — đây CHỈ MỘT dải icon tròn, không nhãn dài, không mô tả, và chỉ 3
 * định dạng (RAIL_FORMATS ở resources/index.ts), không phải cả rổ Kho báu.
 */

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { nodeRail, markResourceViewed, type RailResource, type Subject } from "../lib/api";
import { HocLieuStage, KID_LABEL, ICON } from "./HocLieu";

export default function RailOnLuyen({
  subject,
  nodeKey,
  onXp,
}: {
  subject: Subject;
  nodeKey: string;
  /** Server vừa cộng XP (xem hết thanh, lần đầu) — cha tự quyết định hiện thế nào. */
  onXp?: (gained: number) => void;
}) {
  const [data, setData] = useState<RailResource[] | null>(null);
  const [mo, setMo] = useState<RailResource | null>(null);
  const [toastXp, setToastXp] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setMo(null);
    nodeRail(subject, nodeKey)
      .then((r) => { if (alive) setData(r.resources); })
      .catch(() => { if (alive) setData([]); });
    return () => { alive = false; };
  }, [subject, nodeKey]);

  // Đóng popup bằng phím Esc — thói quen chuẩn cho mọi hộp thoại nổi.
  useEffect(() => {
    if (!mo) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMo(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mo]);

  if (!data || data.length === 0) return null;

  const moChon = (r: RailResource) => {
    setMo(r);
    if (r.daXem) return;
    // Optimistic: tô "đã xem" ngay, không đợi round-trip — bấm mở TỨC LÀ xem,
    // không cần xác nhận server mới đổi màu, kẻo cảm giác nút "không ăn".
    setData((cur) => cur?.map((x) => (x.id === r.id ? { ...x, daXem: true } : x)) ?? cur);
    markResourceViewed(subject, nodeKey, r.id)
      .then((res) => {
        if (res.xp && res.xp.gained > 0) {
          onXp?.(res.xp.gained);
          setToastXp(res.xp.gained);
          setTimeout(() => setToastXp(null), 3200);
        }
      })
      .catch(() => {/* ghi lượt xem hỏng thì thôi — không chặn việc học sinh đang xem */});
  };

  return (
    <>
      <nav className="rol-rail" aria-label="Ôn lại trước khi làm bài">
        {data.map((r) => {
          const Icon = ICON[r.format] ?? Loader2;
          const nhan = r.tieuDe || KID_LABEL[r.format] || r.format;
          return (
            <button
              key={r.id}
              type="button"
              className="rol-btn"
              data-xem={r.daXem || undefined}
              onClick={() => moChon(r)}
              title={nhan}
              aria-label={r.daXem ? `${nhan} — đã xem` : nhan}
            >
              <Icon aria-hidden strokeWidth={2} />
            </button>
          );
        })}
      </nav>

      {toastXp != null && (
        <div className="rol-toast" role="status">
          🎉 Ôn hết rồi! +{toastXp} XP
        </div>
      )}

      {mo && (
        <div className="rol-popup" role="dialog" aria-modal="true" aria-label={mo.tieuDe || KID_LABEL[mo.format] || mo.format}>
          <button type="button" className="rol-popup-backdrop" aria-label="Đóng" onClick={() => setMo(null)} />
          <div className="rol-popup-card">
            <button type="button" className="rol-popup-x" onClick={() => setMo(null)} aria-label="Đóng">
              <X aria-hidden strokeWidth={2.5} />
            </button>
            {mo.uri ? (
              <HocLieuStage
                r={{ id: mo.id, uri: mo.uri, tieuDe: mo.tieuDe ?? undefined, format: mo.format, ly_do_chon_format: mo.lyDoChonFormat ?? undefined }}
                label={KID_LABEL[mo.format] ?? mo.format}
                bienThe="san"
              />
            ) : (
              <p className="muted rol-popup-loi">Không mở được học liệu này lúc này — thử lại sau nhé.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
