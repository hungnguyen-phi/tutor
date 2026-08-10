"use client";

/**
 * HỌC LIỆU TRONG BÀI — cột phụ hẹp đứng cạnh câu hỏi đang làm.
 *
 * Khác `KhoBauView` (màn riêng, chiếm trọn màn hình): ở đây học sinh ĐANG làm
 * bài, học liệu là thứ liếc sang chứ không phải thứ đang ngồi xem. Nên nó giữ
 * hình dạng cũ — một danh sách gọn + khung xem vừa phải — và cố ý KHÔNG đổi
 * theo màn Kho báu.
 *
 * Bộ nhận định dạng và khung xem dùng chung ở `HocLieu.tsx` (xem hợp đồng hiển
 * thị từng định dạng ở đầu tệp đó). Hai bố cục, một cách hiểu định dạng.
 *
 * Nguyên tắc giữ nguyên:
 * - Học liệu là TỰ HỌC — KHÔNG ghi mastery (mastery chỉ từ hỏi đáp qua chat-turn).
 * - Nội dung nặng (iframe/PDF) chỉ dựng khi học sinh mở mục đó.
 * - Rỗng / thiếu uri → không render gì: pipeline chưa có học liệu thì "Bài học"
 *   đơn giản không tồn tại, không khung trống.
 */

import { useState } from "react";
import { BookOpen, FileText, GraduationCap, Sparkles } from "lucide-react";
import type { NodeResource } from "../lib/api";
import { HocLieuStage, ICON, KID_LABEL } from "./HocLieu";

export default function LessonView({
  resources,
  subtitle,
}: {
  resources: NodeResource[];
  subtitle?: string;
}) {
  const usable = (resources ?? []).filter(
    (r) => r && typeof r.uri === "string" && r.uri.length > 0,
  );
  // Cả rổ cùng một mức → nhãn mức không phân biệt được gì, chỉ lặp lại trên mọi
  // thẻ. Kho báu một mức là ca thường gặp nhất.
  const nhieuMuc = new Set(usable.map((r) => r.tier ?? 1)).size > 1;
  // -1 = chưa mở gì (không nạp iframe cho tới khi học sinh chọn) → đặt ở đầu
  // node vẫn nhẹ, không cản đường tới câu hỏi đầu tiên.
  // Chỉ có MỘT mục thì mở luôn — bắt bấm thêm một nhát để xem đúng một thứ là
  // vô nghĩa (màn hiện ra một khung trống với dòng "chọn một mục ở trên").
  const [active, setActive] = useState(usable.length === 1 ? 0 : -1);
  if (usable.length === 0) return null;

  const cur = active >= 0 ? usable[Math.min(active, usable.length - 1)] : null;
  const curLabel = cur ? (KID_LABEL[cur.format] ?? cur.format) : "";

  return (
    <section className="lsv" aria-label="Học liệu của bài">
      <header className="lsv-head">
        <span className="lsv-badge">
          <GraduationCap aria-hidden strokeWidth={2} />
          Bài học
        </span>
        <div className="lsv-head-text">
          <b>Học liệu cho bài này</b>
          <span>{subtitle ?? "Xem trước rồi cùng luyện — phần này không tính điểm, cứ thoải mái khám phá."}</span>
        </div>
      </header>

      <div className="lsv-picker" role="tablist" aria-label="Chọn học liệu">
        {usable.map((r, i) => {
          const Icon = ICON[r.format] ?? FileText;
          const label = KID_LABEL[r.format] ?? r.format;
          return (
            <button
              key={r.id}
              role="tab"
              aria-selected={i === active}
              className="lsv-tile"
              onClick={() => setActive(i)}
            >
              <span className="lsv-tile-icon">
                <Icon aria-hidden strokeWidth={2} />
              </span>
              <span className="lsv-tile-label">
                <b>{r.tieuDe || label}</b>
                {/* "Bậc 1" là từ của người soạn chương trình, không phải của học
                    sinh lớp 10 — và khi cả rổ cùng một mức thì nó chỉ là tiếng ồn
                    lặp lại trên mọi thẻ (lỗi #1). Chỉ hiện khi thật sự có nhiều
                    mức để phân biệt, và gọi đúng tên: "Mức n". */}
                {nhieuMuc && r.tier != null && <small>Mức {r.tier}</small>}
              </span>
            </button>
          );
        })}
      </div>

      {cur ? (
        <HocLieuStage r={cur} label={curLabel} bienThe="cot" />
      ) : (
        <button className="lsv-empty" onClick={() => setActive(0)}>
          <BookOpen aria-hidden strokeWidth={1.75} />
          Chọn một mục ở trên để mở học liệu
        </button>
      )}

      <p className="lsv-foot">
        <Sparkles aria-hidden strokeWidth={2} />
        Học liệu do thầy cô của trường chọn cho đúng bài này.
      </p>
    </section>
  );
}
