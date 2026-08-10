"use client";

/**
 * HỌC LIỆU — TỪ ĐIỂN ĐỊNH DẠNG + KHUNG XEM, dùng chung cho hai nơi bày học liệu.
 *
 * Hai nơi đó cần hai BỐ CỤC khác hẳn nhau nhưng phải hiểu định dạng y hệt nhau:
 *   · `LessonView`  — cột phụ hẹp bên cạnh bài đang làm (danh sách dọc, khung nhỏ)
 *   · `KhoBauView`  — màn riêng chiếm trọn màn hình (rãnh trái + sân khấu lớn)
 * Chép đôi bộ nhận-định-dạng ra hai chỗ là hai thước đo sẽ trôi xa nhau — đúng bài
 * học đã trả giá ở `grade-open.ts`. Nên nó nằm ở đây, một bản.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HỢP ĐỒNG HIỂN THỊ — mỗi định dạng render ra CÁI GÌ (đây là phần "làm rõ ra")
 *
 *  Cách nhận suy TỪ ĐUÔI TỆP trước, KHÔNG tin trường `format`: thầy cô chọn
 *  `format` theo Ý ĐỒ SƯ PHẠM ("sơ đồ tư duy"), còn trình duyệt chỉ quan tâm
 *  thứ nằm ở đầu dây ("cái này là ảnh png"). Một "sơ đồ tư duy" có thể là ảnh,
 *  là PDF, hay là trang web tương tác — ba đường render khác nhau hoàn toàn.
 *
 *  | kind    | nhận ra bằng            | bày ra sao                                        |
 *  |---------|-------------------------|---------------------------------------------------|
 *  | `html`  | đuôi .html/.htm         | TẢI NỘI DUNG rồi nhúng THẲNG qua srcDoc, kín sân   |
 *  |         |                         | khấu, sandbox KHÔNG allow-same-origin              |
 *  | `embed` | mọi thứ còn lại         | iframe qua `embedUrl()` (YouTube/Drive/Docs/Vimeo  |
 *  |         |                         | đổi sang dạng nhúng chính chủ), kín sân khấu       |
 *  | `pdf`   | .pdf                    | iframe `#view=FitH` (vừa chiều ngang, hết cuộn     |
 *  |         |                         | ngang), kín sân khấu + nút Tải về                  |
 *  | `image` | .png .jpg .webp .gif    | <img> `contain` giữa nền tối, bấm = phóng to       |
 *  |         | .svg .avif              |                                                    |
 *  | `video` | .mp4 .webm .mov .m4v    | <video controls> kín sân khấu, nền đen             |
 *  | `audio` | .mp3 .wav .m4a .ogg     | KHÔNG iframe — bàn nghe riêng: đĩa sóng âm + tên   |
 *  |         | .aac                    | bài + thanh phát rộng. Không có nút toàn màn hình. |
 *  | `file`  | .docx .pptx .xlsx .csv  | KHÔNG nhúng (trình duyệt mở ra khung trắng) —      |
 *  |         | .zip .rar .txt .rtf .od*| thẻ tải về nói thẳng vì sao phải tải               |
 *
 *  Rỗng / thiếu `uri` → không render gì. Pipeline chưa có học liệu thì màn hình
 *  đơn giản không có mục đó, không phải một khung trống.
 */

import { useEffect, useRef, useState } from "react";
import {
  Clapperboard,
  Download,
  ExternalLink,
  FileText,
  Film,
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
} from "lucide-react";
import type { NodeResource, ResourceFormat } from "../lib/api";

/* ── TÊN GỌI + ICON theo Ý ĐỒ SƯ PHẠM (trường `format`) ───────────────────── */

export const KID_LABEL: Record<ResourceFormat, string> = {
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

export const ICON: Record<ResourceFormat, typeof FileText> = {
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

/* ── NHÓM ĐỊNH DẠNG — gom theo VIỆC EM LÀM VỚI NÓ ─────────────────────────────
 * Không gom theo tên kỹ thuật ("video/audio/document"): học sinh lớp 10 không
 * nghĩ bằng từ đó. Em nghĩ "giờ mình xem cái gì" / "giờ mình làm thử". Năm nhóm,
 * xếp đúng thứ tự sư phạm: nạp vào trước (xem · nghe · nhìn · đọc), làm sau.
 *
 * Màu lấy từ họ màu có sẵn của app (DESIGN.md §Icon) — không đẻ màu mới. Gold
 * chỉ được làm NỀN chip với chữ navy, không bao giờ làm màu chữ trên nền sáng. */

export type NhomId = "xem" | "nghe" | "nhin" | "doc" | "lam";

export interface NhomDinhDang {
  id: NhomId;
  nhan: string;
  /** Một câu cho em biết nhóm này để làm gì — hiện dưới tên nhóm ở rãnh trái. */
  moTa: string;
  formats: ResourceFormat[];
}

export const NHOM_DINH_DANG: NhomDinhDang[] = [
  { id: "xem", nhan: "Xem", moTa: "Phim và hoạt hình", formats: ["video", "animation"] },
  { id: "nghe", nhan: "Nghe", moTa: "Nghe kể, vừa nghe vừa làm việc khác được", formats: ["podcast"] },
  { id: "nhin", nhan: "Nhìn", moTa: "Sơ đồ, infographic — nắm cả bài trong một hình", formats: ["infographic", "mindmap"] },
  { id: "doc", nhan: "Đọc", moTa: "Bài đọc, bài giảng, ví dụ mẫu", formats: ["text", "slide", "worked_example"] },
  { id: "lam", nhan: "Làm thử", moTa: "Tự luyện, thẻ ghi nhớ, phiếu bài tập", formats: ["interactive", "quiz", "flashcard", "worksheet"] },
];

const NHOM_CUA: Partial<Record<ResourceFormat, NhomId>> = Object.fromEntries(
  NHOM_DINH_DANG.flatMap((n) => n.formats.map((f) => [f, n.id])),
) as Partial<Record<ResourceFormat, NhomId>>;

/** Định dạng lạ (Studio thêm kiểu mới mà app chưa biết) rơi về "Đọc" — thà xếp
 *  nhầm nhóm còn hơn biến mất khỏi màn hình. */
export const nhomCua = (f: ResourceFormat): NhomId => NHOM_CUA[f] ?? "doc";

/** Gom rổ học liệu thành các nhóm KHÔNG RỖNG, giữ đúng thứ tự sư phạm ở trên. */
export function gomTheoNhom(rs: NodeResource[]): { nhom: NhomDinhDang; muc: NodeResource[] }[] {
  return NHOM_DINH_DANG
    .map((nhom) => ({ nhom, muc: rs.filter((r) => nhomCua(r.format) === nhom.id) }))
    .filter((g) => g.muc.length > 0);
}

/* ── NHẬN CÁCH RENDER TỪ ĐUÔI TỆP ─────────────────────────────────────────── */

export type Kind = "html" | "embed" | "pdf" | "audio" | "video" | "image" | "file";

export function renderKind(uri: string): Kind {
  const clean = (uri.split(/[?#]/)[0] ?? uri).toLowerCase();
  if (clean.endsWith(".pdf")) return "pdf";
  if (/\.html?$/.test(clean)) return "html";
  if (/\.(mp3|wav|m4a|ogg|aac)$/.test(clean)) return "audio";
  if (/\.(mp4|webm|mov|m4v)$/.test(clean)) return "video";
  if (/\.(png|jpe?g|webp|gif|svg|avif)$/.test(clean)) return "image";
  if (/\.(docx?|pptx?|xlsx?|csv|zip|rar|txt|rtf|odt|odp|ods)$/.test(clean)) return "file";
  return "embed";
}

/** Link ngoài dán từ thanh địa chỉ KHÔNG nhúng được: YouTube chặn /watch trong
 *  iframe, Drive/Docs/Slides chặn /view và /edit. Đổi sang dạng nhúng chính chủ
 *  — nếu không thì cô dán link vào là học sinh nhận một khung trắng. */
export function embedUrl(uri: string): string {
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
export function sandboxFor(uri: string): string {
  const CO_BAN = "allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox";
  try {
    const u = new URL(uri, typeof location !== "undefined" ? location.href : "https://x");
    const cungNha = typeof location !== "undefined" && u.host === location.host;
    return cungNha ? CO_BAN : `${CO_BAN} allow-same-origin`;
  } catch {
    return CO_BAN;
  }
}

/** Một mẩu chữ nói THẬT em sắp mở cái gì: "PDF", "YouTube", "Tệp Word"… Đứng
 *  cạnh tên học liệu ở rãnh trái để em biết trước — mở ra mới thấy phải tải về
 *  thì đã mất một nhịp. */
export function moTaNguon(uri: string): string {
  const kind = renderKind(uri);
  if (/youtube\.com|youtu\.be/i.test(uri)) return "YouTube";
  if (/vimeo\.com/i.test(uri)) return "Vimeo";
  if (/docs\.google\.com\/presentation/i.test(uri)) return "Google Slides";
  if (/docs\.google\.com\/document/i.test(uri)) return "Google Docs";
  if (/drive\.google\.com|docs\.google\.com/i.test(uri)) return "Google Drive";
  const duoi = ((uri.split(/[?#]/)[0] ?? "").split(".").pop() ?? "").toLowerCase();
  if (kind === "file") {
    if (/^docx?$/.test(duoi)) return "Tệp Word — tải về";
    if (/^pptx?$/.test(duoi)) return "Tệp PowerPoint — tải về";
    if (/^xlsx?$/.test(duoi)) return "Tệp Excel — tải về";
    return `Tệp .${duoi} — tải về`;
  }
  if (kind === "pdf") return "PDF";
  if (kind === "audio") return "Nghe";
  if (kind === "video") return "Phim";
  if (kind === "image") return "Hình";
  if (kind === "html") return "Trang tương tác";
  return "Link ngoài";
}

/* ── SÂN KHẤU ─────────────────────────────────────────────────────────────── */

/**
 * Khung xem một học liệu. `bienThe`:
 *   · `"cot"`  — cột phụ hẹp cạnh bài học (khung thấp, thanh công cụ gọn)
 *   · `"san"`  — màn Kho báu (kín chiều cao còn lại, nội dung là nhân vật chính)
 */
export function HocLieuStage({
  r,
  label,
  bienThe = "cot",
}: {
  r: NodeResource;
  label: string;
  bienThe?: "cot" | "san";
}) {
  const uri = r.uri!;
  const kind = renderKind(uri);
  const taiVe = kind === "pdf" || kind === "file";

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
  const [noiDung, setNoiDung] = useState<string | null>(null);
  useEffect(() => {
    if (kind !== "html") return;
    let alive = true;
    fetch(uri)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(String(res.status)))))
      .then((t) => { if (alive) setNoiDung(t); })
      .catch(() => { if (alive) setNoiDung(null); });
    return () => { alive = false; };
  }, [uri, kind]);

  const tenTep = (uri.split(/[?#]/)[0] ?? "").split("/").pop() ?? "";

  return (
    <div className="lsv-stage" ref={stageRef} data-full={full || undefined} data-bien-the={bienThe} data-kind={kind}>
      <div className="lsv-stage-bar">
        <span className="lsv-stage-title">{label}</span>
        {/* Toàn màn hình đứng TRƯỚC "mở tab mới": đọc tại chỗ là lựa chọn đúng
            hơn cho học sinh (không lạc khỏi bài), tab mới chỉ là đường lui.
            Nghe thì không có gì để phóng to — ẩn hẳn nút thay vì cho một nút
            bấm vào không thấy gì đổi. */}
        {kind !== "audio" && kind !== "file" && (
          <button type="button" className="lsv-stage-act" onClick={toggleFull}>
            {full ? <Minimize2 aria-hidden strokeWidth={2} /> : <Maximize2 aria-hidden strokeWidth={2} />}
            {full ? "Thu nhỏ" : "Toàn màn hình"}
          </button>
        )}
        {taiVe && (
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
        /* NGHE không phải là XEM: không nhét vào khung hình rồi để trống 500px.
           Một bàn nghe đúng tầm — dấu tai nghe lớn, tên bài, thanh phát rộng. */
        <div className="lsv-audio-wrap">
          <span className="lsv-audio-disc" aria-hidden>
            <Headphones strokeWidth={1.5} />
          </span>
          <b className="lsv-audio-title">{r.tieuDe || label}</b>
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
          <img className="lsv-img" src={uri} alt={r.tieuDe || label} />
        </a>
      ) : kind === "file" ? (
        /* Trình duyệt KHÔNG mở được .docx/.pptx tại chỗ — nhét vào iframe chỉ ra
           khung trắng. Nói thẳng vì sao phải tải, đừng để em tưởng app hỏng. */
        <div className="lsv-file-wrap">
          <a className="lsv-file" href={uri} download target="_blank" rel="noopener noreferrer">
            <Download aria-hidden strokeWidth={1.75} />
            <span>
              <b>Tải {label.toLowerCase()} về máy</b>
              <small>{tenTep}</small>
            </span>
          </a>
          <p className="lsv-file-why muted">
            Loại tệp này trình duyệt không mở sẵn được — tải về rồi mở bằng Word hoặc
            PowerPoint trên máy nhé.
          </p>
        </div>
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
