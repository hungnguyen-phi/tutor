"use client";

/**
 * Trình xem học liệu đi kèm một điểm kiến thức (pipeline KG v2.2).
 *
 * Nguyên tắc:
 * - Mỗi tài liệu là một <details> gập sẵn — không tranh chỗ với dòng chảy
 *   Socratic của buổi học; nội dung nặng (iframe/PDF) chỉ dựng khi học sinh mở.
 * - iframe dùng sandbox="allow-scripts", KHÔNG có allow-same-origin: học liệu
 *   là HTML tự chứa kèm JS, chạy cô lập hoàn toàn. Đáp án quiz nằm phía client
 *   theo thiết kế — quiz là tự luyện, KHÔNG tính vào mastery (mastery chỉ đến
 *   từ bảng `questions` qua chat-turn).
 * - Danh sách rỗng hoặc thiếu uri → không render gì cả: pipeline chưa live thì
 *   mục "Tài liệu" đơn giản là không tồn tại, không có khung trống.
 */

import { useState } from "react";
import {
  BookOpen,
  ChevronDown,
  Clapperboard,
  Download,
  FileText,
  Film,
  Headphones,
  Image as ImageIcon,
  Layers,
  ListChecks,
  MousePointerClick,
  PenLine,
  Presentation,
  Share2,
} from "lucide-react";
import type { NodeResource, ResourceFormat } from "../lib/api";

const FORMAT_VI: Record<ResourceFormat, string> = {
  text: "Bài đọc",
  infographic: "Infographic",
  video: "Video",
  animation: "Hoạt hình",
  mindmap: "Sơ đồ tư duy",
  podcast: "Podcast",
  worked_example: "Ví dụ mẫu",
  interactive: "Tương tác",
  slide: "Slide",
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

/** HTML tự chứa (có JS) → nhúng qua iframe sandbox. */
const IFRAME_FORMATS: ReadonlySet<ResourceFormat> = new Set([
  "slide",
  "flashcard",
  "quiz",
  "mindmap",
  "interactive",
]);

function ResourceBody({ r, label }: { r: NodeResource; label: string }) {
  const uri = r.uri!; // đã lọc ở ResourceViewer
  if (IFRAME_FORMATS.has(r.format)) {
    return <iframe className="res-frame" sandbox="allow-scripts" src={uri} title={label} />;
  }
  switch (r.format) {
    case "podcast":
      return <audio className="res-audio" controls preload="none" src={uri} />;
    case "text":
    case "worksheet":
      // PDF: đọc tại chỗ + link tải cho trình duyệt không hỗ trợ embed.
      return (
        <>
          <embed className="res-embed" src={uri} type="application/pdf" />
          <a className="btn btn-ghost" href={uri} download target="_blank" rel="noopener noreferrer">
            <Download aria-hidden strokeWidth={2} />
            Tải {label.toLowerCase()}
          </a>
        </>
      );
    case "video":
      // Chưa có hạ tầng streaming — đưa link tải, xem bằng trình phát của máy.
      return (
        <a className="btn btn-ghost" href={uri} download target="_blank" rel="noopener noreferrer">
          <Download aria-hidden strokeWidth={2} />
          Tải video về xem
        </a>
      );
    default:
      // infographic / worked_example / animation (và format lạ): iframe dự phòng.
      return <iframe className="res-frame" sandbox="allow-scripts" src={uri} title={label} />;
  }
}

function ResourceCard({ r }: { r: NodeResource }) {
  // Chỉ dựng nội dung sau lần mở đầu tiên — vào bài không nạp cả loạt iframe/PDF.
  // Mở rồi thì giữ nguyên DOM để audio/quiz không mất trạng thái khi gập lại.
  const [opened, setOpened] = useState(false);
  const label = FORMAT_VI[r.format] ?? r.format;
  const Icon = ICON[r.format] ?? FileText;
  return (
    <details
      className="res-card"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) setOpened(true);
      }}
    >
      <summary>
        <Icon aria-hidden strokeWidth={2} />
        <span className="res-kind">{label}</span>
        {r.tier != null && <span className="chip">Bậc {r.tier}</span>}
        <ChevronDown className="res-caret" aria-hidden strokeWidth={2} />
      </summary>
      <div className="res-body">
        {r.ly_do_chon_format && <p className="muted res-why">{r.ly_do_chon_format}</p>}
        {opened && <ResourceBody r={r} label={label} />}
      </div>
    </details>
  );
}

export default function ResourceViewer({ resources }: { resources: NodeResource[] }) {
  const usable = (resources ?? []).filter(
    (r) => r && typeof r.uri === "string" && r.uri.length > 0,
  );
  if (usable.length === 0) return null;

  return (
    <section className="res-section" aria-label="Tài liệu học tập">
      <h2 className="res-title">
        <BookOpen aria-hidden strokeWidth={2} />
        Tài liệu
      </h2>
      <div className="res-list">
        {usable.map((r) => (
          <ResourceCard key={r.id} r={r} />
        ))}
      </div>
    </section>
  );
}
