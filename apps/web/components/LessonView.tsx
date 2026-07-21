"use client";

/**
 * "BÀI ĐẶC BIỆT" — học liệu do Xưởng Học liệu AI (app sản xuất) tạo ra, đưa vào
 * buổi học của học sinh như một bài học dẫn đầu: slide, podcast, bài đọc, phiếu
 * bài tập, flashcard, quiz, mindmap…
 *
 * Khác ResourceViewer (accordion phụ ở cuối bài): đây là trải nghiệm NỔI BẬT ở
 * ĐẦU node — một "playlist" học liệu + khung xem lớn. Chọn một mục để mở.
 *
 * Nguyên tắc giữ nguyên:
 * - Học liệu là TỰ HỌC — KHÔNG ghi mastery (mastery chỉ từ hỏi đáp qua chat-turn).
 * - Nội dung nặng (iframe/PDF) chỉ dựng khi học sinh mở mục đó.
 * - HTML tự chứa chạy trong iframe sandbox="allow-scripts" (KHÔNG allow-same-origin)
 *   → cô lập hoàn toàn, đúng khuôn Xưởng xuất ra.
 * - Rỗng / thiếu uri → không render gì: pipeline chưa có học liệu thì "Bài học"
 *   đơn giản không tồn tại, không khung trống.
 */

import { useState } from "react";
import {
  BookOpen,
  Clapperboard,
  Download,
  ExternalLink,
  FileText,
  Film,
  GraduationCap,
  Headphones,
  Image as ImageIcon,
  Layers,
  ListChecks,
  MousePointerClick,
  PenLine,
  Presentation,
  Share2,
  Sparkles,
} from "lucide-react";
import type { NodeResource, ResourceFormat } from "../lib/api";

const KID_LABEL: Record<ResourceFormat, string> = {
  text: "Bài đọc",
  infographic: "Infographic",
  video: "Phim ngắn",
  animation: "Hoạt hình",
  mindmap: "Sơ đồ tư duy",
  podcast: "Nghe kể",
  worked_example: "Ví dụ mẫu",
  interactive: "Tương tác",
  slide: "Bài giảng",
  worksheet: "Phiếu bài tập",
  flashcard: "Thẻ ghi nhớ",
  quiz: "Tự luyện",
};

const ICON: Record<ResourceFormat, typeof FileText> = {
  text: FileText,
  infographic: ImageIcon,
  video: Film,
  animation: Clapperboard,
  mindmap: Share2,
  podcast: Headphones,
  worked_example: PenLine,
  interactive: MousePointerClick,
  slide: Presentation,
  worksheet: FileText,
  flashcard: Layers,
  quiz: ListChecks,
};

/** Cách render suy TỪ ĐUÔI FILE trước (chắc hơn field format): pdf/âm thanh/khác. */
type Kind = "pdf" | "audio" | "frame";
function renderKind(uri: string): Kind {
  const clean = (uri.split(/[?#]/)[0] ?? uri).toLowerCase();
  if (clean.endsWith(".pdf")) return "pdf";
  if (/\.(mp3|wav|m4a|ogg|aac)$/.test(clean)) return "audio";
  return "frame";
}

function Viewer({ r, label }: { r: NodeResource; label: string }) {
  const uri = r.uri!;
  const kind = renderKind(uri);
  return (
    <div className="lsv-stage">
      <div className="lsv-stage-bar">
        <span className="lsv-stage-title">{label}</span>
        {kind === "pdf" && (
          <a className="lsv-stage-act" href={uri} download target="_blank" rel="noopener noreferrer">
            <Download aria-hidden strokeWidth={2} />
            Tải về
          </a>
        )}
        <a className="lsv-stage-act" href={uri} target="_blank" rel="noopener noreferrer">
          <ExternalLink aria-hidden strokeWidth={2} />
          Mở tab mới
        </a>
      </div>
      {kind === "audio" ? (
        <div className="lsv-audio-wrap">
          <Headphones aria-hidden strokeWidth={1.75} />
          <audio className="lsv-audio" controls preload="none" src={uri} />
        </div>
      ) : kind === "pdf" ? (
        <embed className="lsv-frame" src={uri} type="application/pdf" />
      ) : (
        // HTML tự chứa (slide/flashcard/quiz/mindmap/phiếu…) — cô lập hoàn toàn.
        <iframe className="lsv-frame" sandbox="allow-scripts allow-popups" src={uri} title={label} />
      )}
      {r.ly_do_chon_format && <p className="lsv-why muted">{r.ly_do_chon_format}</p>}
    </div>
  );
}

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
  // -1 = chưa mở gì (không nạp iframe cho tới khi học sinh chọn) → đặt ở đầu
  // node vẫn nhẹ, không cản đường tới câu hỏi đầu tiên.
  const [active, setActive] = useState(-1);
  if (usable.length === 0) return null;

  const cur = active >= 0 ? usable[Math.min(active, usable.length - 1)] : null;
  const curLabel = cur ? (KID_LABEL[cur.format] ?? cur.format) : "";

  return (
    <section className="lsv" aria-label="Bài học đặc biệt">
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
                <b>{label}</b>
                {r.tier != null && <small>Bậc {r.tier}</small>}
              </span>
            </button>
          );
        })}
      </div>

      {cur ? (
        <Viewer r={cur} label={curLabel} />
      ) : (
        <button className="lsv-empty" onClick={() => setActive(0)}>
          <BookOpen aria-hidden strokeWidth={1.75} />
          Chọn một mục ở trên để mở học liệu
        </button>
      )}

      <p className="lsv-foot">
        <Sparkles aria-hidden strokeWidth={2} />
        Học liệu do Xưởng Học liệu AI của trường biên soạn — đã được giáo viên duyệt.
      </p>
    </section>
  );
}
