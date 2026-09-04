"use client";

import { Check, Sparkles, type LucideIcon } from "lucide-react";
import Sheet from "./Sheet";

/**
 * Thẻ mô tả một môn cho bảng chọn. `live` = đã có ngân hàng câu hỏi trong DB
 * (luyện được ngay); môn chưa `live` vẫn xem trước được LỘ TRÌNH thật, phần
 * luyện tập mở sau khi nạp câu hỏi. Generic theo key để TutorApp giữ union môn.
 */
export type SubjectInfo<K extends string = string> = {
  key: K;
  /** Nhãn ngắn cho pill/thẻ (vd "Ngữ văn"). */
  short: string;
  /** Nhãn dài cho banner (vd "Ngữ văn 10"). */
  unit: string;
  subtitle: string;
  /** slug file lộ trình tĩnh public/kg/path-<slug>.json */
  slug: string;
  live: boolean;
  Icon: LucideIcon;
};

/**
 * Bảng CHỌN MÔN thật (thay nút đảo Toán↔Anh cũ). Bottom sheet trên mobile,
 * dialog giữa màn ≥900px (Sheet lo phần đó). Mỗi môn là một thẻ: icon trong
 * đĩa màu, tên + mô tả, dấu ✓ nếu đang học, nhãn "Sắp mở" nếu chưa live.
 */
export default function SubjectPicker<K extends string>({
  open,
  onClose,
  current,
  subjects,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  current: K;
  subjects: SubjectInfo<K>[];
  onPick: (key: K) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Chọn môn học">
      <ul className="subj-list" role="list">
        {subjects.map((s) => {
          const active = s.key === current;
          return (
            <li key={s.key}>
              <button
                type="button"
                className="subj-card"
                data-active={active || undefined}
                data-preview={!s.live || undefined}
                aria-current={active || undefined}
                data-autofocus={active || undefined}
                onClick={() => onPick(s.key)}
              >
                <span className="subj-icon" aria-hidden>
                  <s.Icon strokeWidth={2.25} />
                </span>
                <span className="subj-text">
                  <span className="subj-name">
                    {s.unit}
                    {!s.live && (
                      <span className="subj-soon">
                        <Sparkles aria-hidden strokeWidth={2.25} />
                        Sắp mở
                      </span>
                    )}
                  </span>
                  <span className="subj-sub">{s.subtitle}</span>
                </span>
                {active && (
                  <span className="subj-check" aria-hidden>
                    <Check strokeWidth={3} />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="subj-foot">
        Môn “Sắp mở” đã có lộ trình đầy đủ để xem trước — phần luyện tập sẽ bật khi bộ câu hỏi được nạp.
      </p>
      {/* Nút đóng tường minh (audit 04/09: chỉ có Esc/bấm ngoài — trên điện
          thoại không có Esc, bấm ngoài thì không ai đoán được). */}
      <button type="button" className="btn btn-quiet btn-block subj-close" onClick={onClose}>
        Đóng
      </button>
    </Sheet>
  );
}
