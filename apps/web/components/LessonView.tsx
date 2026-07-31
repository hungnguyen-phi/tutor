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

import { useEffect, useRef, useState } from "react";
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
  Maximize2,
  Minimize2,
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

/** Cách render suy TỪ ĐUÔI FILE trước (chắc hơn field format).
 *  `file` = thứ trình duyệt KHÔNG mở được tại chỗ (docx, pptx, xlsx, zip…):
 *  nhét vào iframe chỉ ra khung trắng, nên bày thẻ TẢI VỀ tử tế thay vì im lặng. */
type Kind = "pdf" | "audio" | "video" | "image" | "file" | "frame";
function renderKind(uri: string): Kind {
  const clean = (uri.split(/[?#]/)[0] ?? uri).toLowerCase();
  if (clean.endsWith(".pdf")) return "pdf";
  if (/\.(mp3|wav|m4a|ogg|aac)$/.test(clean)) return "audio";
  if (/\.(mp4|webm|mov|m4v)$/.test(clean)) return "video";
  if (/\.(png|jpe?g|webp|gif|svg|avif)$/.test(clean)) return "image";
  if (/\.(docx?|pptx?|xlsx?|csv|zip|rar|txt|rtf|odt|odp|ods)$/.test(clean)) return "file";
  return "frame";
}

/** Link ngoài dán từ thanh địa chỉ KHÔNG nhúng được: YouTube chặn /watch trong
 *  iframe, Drive/Docs/Slides chặn /view và /edit. Đổi sang dạng nhúng chính chủ
 *  — nếu không thì cô dán link vào là học sinh nhận một khung trắng. */
function embedUrl(uri: string): string {
  const yt = /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/i.exec(uri);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const drive = /drive\.google\.com\/file\/d\/([\w-]+)/i.exec(uri);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
  const gdoc = /docs\.google\.com\/(document|presentation|spreadsheets)\/d\/([\w-]+)/i.exec(uri);
  if (gdoc) return `https://docs.google.com/${gdoc[1]}/d/${gdoc[2]}/preview`;
  const vimeo = /vimeo\.com\/(\d+)/i.exec(uri);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return uri;
}

/** Quyền cho khung nhúng. Khác tên miền → cấp thêm allow-same-origin để nội dung
 *  dùng được localStorage/fetch của CHÍNH kho nó (quiz tự chấm, flashcard nhớ
 *  tiến độ). Cùng tên miền với app → không cấp, kẻo thoát sandbox. */
function sandboxFor(uri: string): string {
  const CO_BAN = "allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox";
  try {
    const u = new URL(uri, typeof location !== "undefined" ? location.href : "https://x");
    const cungNha = typeof location !== "undefined" && u.host === location.host;
    return cungNha ? CO_BAN : `${CO_BAN} allow-same-origin`;
  } catch {
    return CO_BAN;
  }
}

function Viewer({ r, label }: { r: NodeResource; label: string }) {
  const uri = r.uri!;
  const kind = renderKind(uri);
  const tai_ve = kind === "pdf" || kind === "file";
  // Toàn màn hình cho khung xem — PDF/slide đọc trên khung nhúng vẫn chật so với
  // một trang A4; nút này là lối thoát tại chỗ, không phải rời app sang tab khác.
  const stageRef = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFull = () => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => {/* trình duyệt chặn — bỏ qua */});
  };

  // TỆP .html TRONG KHO: bỏ thẳng vào src thì học sinh nhìn thấy MÃ NGUỒN —
  // kho trả tệp về dưới dạng chữ (text/plain) chứ không phải trang web, cố ý
  // để không ai biến kho thành nơi chạy web lạ. Cách đi được: tự tải nội dung
  // rồi dựng vào khung bằng srcDoc. Tải hỏng (link ngoài chặn CORS) → giữ src
  // như cũ, không làm hỏng đường đang chạy được.
  const laHtml = /\.html?($|[?#])/i.test(uri);
  const [noiDung, setNoiDung] = useState<string | null>(null);
  useEffect(() => {
    if (kind !== "frame" || !laHtml) return;
    let alive = true;
    fetch(uri)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(String(res.status)))))
      .then((t) => { if (alive) setNoiDung(t); })
      .catch(() => { if (alive) setNoiDung(null); });
    return () => { alive = false; };
  }, [uri, kind, laHtml]);
  return (
    <div className="lsv-stage" ref={stageRef} data-full={full || undefined}>
      <div className="lsv-stage-bar">
        <span className="lsv-stage-title">{label}</span>
        {/* Toàn màn hình đứng TRƯỚC "mở tab mới": đọc tại chỗ là lựa chọn đúng
            hơn cho học sinh (không lạc khỏi bài), tab mới chỉ là đường lui. */}
        {kind !== "audio" && (
          <button type="button" className="lsv-stage-act" onClick={toggleFull}>
            {full ? <Minimize2 aria-hidden strokeWidth={2} /> : <Maximize2 aria-hidden strokeWidth={2} />}
            {full ? "Thu nhỏ" : "Toàn màn hình"}
          </button>
        )}
        {tai_ve && (
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
      ) : kind === "video" ? (
        <video className="lsv-frame" controls preload="none" src={uri} />
      ) : kind === "image" ? (
        // Sơ đồ tư duy / infographic hay là ẢNH: bày thẳng, bấm được để phóng to
        // ở tab mới. Trước đây rơi vào iframe nên xem méo và không phóng được.
        <a className="lsv-img-wrap" href={uri} target="_blank" rel="noopener noreferrer">
          {/* KHÔNG dùng loading="lazy": hộp ảnh chưa có chiều cao nên trình duyệt
              hoãn tải, mà hoãn tải thì hộp mãi cao 0 — đo trên máy thật thấy ảnh
              đứng im vĩnh viễn. Ảnh chỉ dựng sau khi em bấm chọn mục nên vốn đã
              hoãn đủ rồi. */}
          <img className="lsv-img" src={uri} alt={label} />
        </a>
      ) : kind === "file" ? (
        <a className="lsv-file" href={uri} download target="_blank" rel="noopener noreferrer">
          <Download aria-hidden strokeWidth={1.75} />
          <span>
            <b>Tải {label.toLowerCase()} về máy</b>
            <small>{(uri.split(/[?#]/)[0] ?? "").split("/").pop()}</small>
          </span>
        </a>
      ) : kind === "pdf" ? (
        /* #view=FitH = vừa CHIỀU NGANG: hết cuộn ngang trong khung nhúng — thanh
           trượt ngang chính là thứ người thử kêu "xem không hết" (lỗi 1).
           <iframe> thay <embed>: nhận được tham số #view trên nhiều trình duyệt
           hơn, và nằm trong luồng fullscreen của thẻ cha. */
        <iframe
          className="lsv-frame"
          src={`${uri}${uri.includes("#") ? "&" : "#"}view=FitH&toolbar=1`}
          title={label}
        />
      ) : (
        // HTML tự chứa (quiz, flashcard, mindmap tương tác, slide dạng web) —
        // chạy trong hộp cách ly. `allow-same-origin` chỉ cấp khi nội dung nằm ở
        // TÊN MIỀN KHÁC (kho học liệu, YouTube, Drive): ở đó nó chỉ mở lại chính
        // origin của kho, không chạm được vào app — đổi lại quiz dùng localStorage
        // mới chạy được (thiếu quyền này là quiz tự chấm điểm sập ngay dòng đầu).
        // Cùng origin với app thì TUYỆT ĐỐI không cấp: đó là đường thoát sandbox.
        <iframe
          className="lsv-frame"
          /* srcDoc chạy trong CHÍNH origin của app → TUYỆT ĐỐI không cấp
             allow-same-origin (đó là đường thoát sandbox). Nội dung tải từ kho
             là do thầy cô đăng, nhưng luật vẫn là luật. */
          sandbox={noiDung != null ? "allow-scripts allow-popups allow-forms" : sandboxFor(embedUrl(uri))}
          {...(noiDung != null ? { srcDoc: noiDung } : { src: embedUrl(uri) })}
          title={label}
        />
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
  // Cả rổ cùng một mức → nhãn mức không phân biệt được gì, chỉ lặp lại trên mọi
  // thẻ. Kho báu một mức là ca thường gặp nhất.
  const nhieuMuc = new Set(usable.map((r) => r.tier ?? 1)).size > 1;
  // -1 = chưa mở gì (không nạp iframe cho tới khi học sinh chọn) → đặt ở đầu
  // node vẫn nhẹ, không cản đường tới câu hỏi đầu tiên.
  // Chỉ có MỘT mục thì mở luôn — bắt bấm thêm một nhát để xem đúng một thứ là
  // vô nghĩa (màn kho báu hiện ra một khung trống với dòng "chọn một mục ở trên").
  const [active, setActive] = useState(usable.length === 1 ? 0 : -1);
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
        <Viewer r={cur} label={curLabel} />
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
