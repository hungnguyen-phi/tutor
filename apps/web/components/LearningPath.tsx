"use client";

import { useEffect, useRef, useState } from "react";
import { Award, BookOpen, Check, ChevronDown, Flag, Gift, LocateFixed, Lock, Paperclip, Play, RotateCcw, Undo2 } from "lucide-react";
import Lion, { type LionMood } from "./Lion";
import PawNode from "./PawNode";
import { MathText } from "../lib/mathrender";
import { useCountUp, useGrow } from "../lib/anim";

/**
 * Trạng thái một điểm kiến thức trên lộ trình.
 * `stale` = em đã học, nhưng giáo viên đã sửa NGHĨA của nội dung sau đó.
 * Dấu "đã học" không bao giờ bị xoá — chỉ chuyển vàng để mời ôn lại.
 * `redo` = em đã NỘP bài tự luận nhưng bị chấm CHƯA ĐẠT → bàn chân đỏ, mời làm
 * lại. Trạng thái này ĐÈ lên mọi trạng thái khác và không bị khoá.
 * (Từ 01/08 người chấm là AI, ngay lúc nộp — trước đó là giáo viên, và dấu đỏ
 * phải chờ tới khi có người rảnh xem. Các thẻ "Thầy cô nhắn" bên dưới vẫn giữ
 * vì lời nhắn cũ của giáo viên còn nằm trong dữ liệu.)
 */
export type NodeState = "mastered" | "stale" | "current" | "available" | "locked" | "redo";

export type PathNode = {
  key: string;
  label: string;
  state: NodeState;
  /** Với node bị khoá: các điểm tiên quyết còn thiếu (khớp `blockedBy` của learning-path). */
  blockedBy?: string[];
  /** Tên chương/Unit — có thì lộ trình gom thành CHẶNG (điểm dừng khi cuộn). */
  chapter?: string;
  /** Tiến trình dang dở 0..1 = số câu đã làm / số câu của bài (chưa mastered). */
  progress?: number;
  doneCount?: number;
  totalCount?: number;
  /** Số bài nộp đang chờ giáo viên chấm. */
  pending?: number;
  /** Bài bị TRẢ VỀ: đúng câu cần làm lại + lời nhắn của thầy cô. */
  redo?: Array<{
    questionId: string;
    note: string | null;
    /** Tệp chữa bài thầy cô gửi kèm — link ký sẵn, hạn 1 giờ (Đ2). */
    noteFileUrl?: string | null;
    noteFileName?: string | null;
  }>;
  /** Bài ĐÃ ĐẠT mà thầy cô còn nhắn thêm / gửi bài chữa. */
  praise?: Array<{
    questionId: string;
    note: string | null;
    noteFileUrl?: string | null;
    noteFileName?: string | null;
  }>;
  /** Kho báu học liệu đứng CẠNH bài — mức nào có, em đã đi tới mức mấy. */
  khoBau?: { mucCoSan: number[]; mucDaQua: number };
};

const HINT: Record<NodeState, string> = {
  mastered: "Đã thành thạo",
  stale: "Đã học — nội dung vừa được cập nhật, ôn lại nhé",
  current: "Bắt đầu ở đây",
  available: "Chưa học",
  locked: "Chưa mở",
  redo: "Bài nộp chưa đạt — sửa rồi nộp lại",
};

/* Icon theo trạng thái (hi-fi 3a) — node `available` KHÔNG dùng icon mà hiện
   SỐ thứ tự của nó trong lộ trình, nên không nằm trong map này. */
const ICON: Record<Exclude<NodeState, "available">, typeof Check> = {
  mastered: Check,
  stale: RotateCcw, // lời mời ôn lại — không phải cảnh báo
  current: Play,
  locked: Lock,
  redo: Undo2,
};

/** Nhãn NGẮN hiện dưới node hiện tại: lấy phần trước dấu hai chấm / gạch ngang,
 *  bỏ phần công thức dài phía sau (vd "Cấu trúc hiện tại đơn: S + V(s/es)…" →
 *  "Cấu trúc hiện tại đơn"). aria-label/title vẫn giữ TÊN ĐẦY ĐỦ. */
function shortLabel(s: string): string {
  const head = s.split(/\s*[:–—]\s*/)[0]!.trim();
  return head.length >= 4 ? head : s.trim();
}

/**
 * DÁNG ĐI CỦA SƯ TỬ — sinh vị trí/khoảng/góc từng dấu chân theo chỉ số bước
 * (0-based). Tất định theo index (không random → không nháy giữa render, khớp
 * SSR). QUY LUẬT (chủ dự án chốt bằng dãy trái/phải): coi **4 dấu = 1 CỤM**.
 * Cụm A = **Trái–Phải–Phải–Trái**; cụm KẾ = cụm B = **đảo trái↔phải** = Phải–
 * Trái–Trái–Phải; rồi A,B,A,B… (chu kỳ 8). Mỗi cụm là một chỗ PHÌNH về một bên:
 * hai dấu NGOÀI (beat 0,3) thu về gần trục, hai dấu GIỮA (beat 1,2) vươn HẲN ra
 * — cụm kế phình sang bên kia → dáng uốn lượn mạnh, không "khúc giữa hiền".
 *
 *  · Ngang (--paw-dx): dấu vươn xa = ±96, dấu thu về = ∓? (đối bên, ±26) theo
 *    dãy T/P; cụm lẻ đảo dấu toàn bộ (mirror).
 *  · Dọc (--paw-dy): cộng vào gap 44 nền — hai dấu GIỮA (cùng bên) CHỤM lại
 *    thành một "cặp" (bàn trước+sau con thú); còn lại giãn thường.
 *  · Xoay (--paw-rot): sóng sin chu kỳ 8 → ngón chân đảo hướng MƯỢT theo tiếp
 *    tuyến trackway, ≈0 ở đỉnh phình, cực đại ở chỗ bắt chéo qua trục.
 */
function frac(n: number): number {
  const x = Math.sin(n * 127.1 + 31.7) * 43758.5453;
  return x - Math.floor(x); // 0..1 tất định
}
// Template MỘT CỤM (cụm A), 4 beat theo dãy T–P–P–T. TPLx = x có DẤU: beat0 Trái
// gần trục (−26), beat1+2 Phải vươn xa (+88,+96 — cặp giữa), beat3 Trái về gần
// trục (−26). TPLy: khoảng dọc TỚI dấu trước (cộng vào gap 44); cặp giữa CHỤM.
const TPLx = [-26, 88, 96, -26];
const TPLy = [6, 8, -22, 8];
/** Trục ngang một dấu chân (trước nhiễu). Cụm chẵn = A (dãy T–P–P–T); cụm lẻ =
 *  B = đảo dấu (P–T–T–P). Biên đỉnh ±96 vẫn trong khung mobile hẹp (disc 70 →
 *  mép ±131 < nửa khung ~144 trên màn 320). */
function pawX(seq: number): number {
  const c = Math.floor(seq / 4);
  const b = ((seq % 4) + 4) % 4;
  const mir = c & 1 ? -1 : 1;
  return TPLx[b]! * mir;
}

/** Một dấu chân: vị trí ngang, co/giãn dọc, góc xoay — theo quy luật cụm-mirror. */
function gaitStep(seq: number): { dx: number; dy: number; rot: number } {
  const b = ((seq % 4) + 4) % 4;
  let dx = Math.max(-98, Math.min(98, pawX(seq) + (frac(seq * 3.1) * 4 - 2)));
  const dy = TPLy[b]! + (frac(seq * 5.7) * 6 - 3);
  // Sin chu kỳ 8, lệch pha −1.5 → rot≈0 ở tâm cụm, cực đại ±16° ở ranh giới cặp;
  // liên tục qua ranh giới cụm (không giật như lấy hiệu sai phân cục bộ).
  const rot = 16 * Math.sin(((seq - 1.5) * Math.PI) / 4) + (frac(seq * 9.3) * 5 - 2.5);

  return { dx: Math.round(dx * 10) / 10, dy: Math.round(dy), rot: Math.round(rot * 10) / 10 };
}

/**
 * Lộ trình = một CẢNH "sân trường buổi sáng" (hi-fi 3a/3c): trời gradient,
 * mặt trời ló mép phải, mây trôi, hai đồi cỏ tràn đáy. Banner chương nổi
 * trắng ở đầu cảnh; node zigzag chạy trên cảnh; sư tử đứng CẠNH node hiện
 * tại, chân chạm mound cỏ; cổng chương đóng đáy khi còn node khoá.
 * Canvas phẳng --canvas-flat ở ngoài cảnh giữ nguyên.
 */
export default function LearningPath({
  unit,
  subtitle,
  nodes,
  greeting,
  heroMood = "greet",
  busy = false,
  preview = false,
  onStart,
  onOpenKhoBau,
  onRedo,
}: {
  unit: string;
  subtitle: string;
  nodes: PathNode[];
  /** Lời sư tử nói ở đầu lộ trình. Bỏ trống thì không có bong bóng. */
  greeting?: string;
  /** Cảm xúc của sư tử ở đầu lộ trình. Mặc định `greet` (vẫy chào) và nên giữ
   *  nguyên: KHÔNG dùng mood buồn/dỗi kể cả khi em nghỉ lâu — xem ghi chú ở
   *  đầu `Lion.tsx`. */
  heroMood?: LionMood;
  busy?: boolean;
  /** Môn XEM TRƯỚC (chưa có ngân hàng câu hỏi): node đầu ghi "XEM TRƯỚC"
   *  thay "BẮT ĐẦU"; bấm không mở buổi học (TutorApp.start tự chặn). */
  preview?: boolean;
  onStart: (node: PathNode) => void;
  /** Bấm dấu chân KHO BÁU cạnh một bài. Bỏ trống thì không vẽ kho báu. */
  onOpenKhoBau?: (node: PathNode) => void;
  /** Bấm thẻ "cần làm lại" → mở ĐÚNG câu bị trả của bài đó (lỗi 2). */
  onRedo?: (node: PathNode, questionId?: string) => void;
}) {
  // Chặng đã xong / còn khoá đang được mở xem trước (bấm thẻ chặng).
  const [openLegs, setOpenLegs] = useState<Set<string>>(new Set());
  // Bong bóng "mở khi xong bài X" khi bấm node khoá (audit 04/09) — một cái tại
  // một thời điểm, tự tắt; bấm node khác thì thay.
  const [khoaNhac, setKhoaNhac] = useState<{ key: string; text: string } | null>(null);
  const khoaNhacTimer = useRef<number | undefined>(undefined);
  const masteredTotal = nodes.filter((n) => n.state === "mastered").length;

  // Native: mở màn Học là THẤY NGAY dấu chân BẮT ĐẦU — path tự cuộn tới node
  // current (nhảy tức thời, không animation → tự thỏa reduced-motion).
  const pathRef = useRef<HTMLUListElement>(null);

  /** Ô <li> chứa dấu chân đang học — dùng cho cả cuộn tự động lẫn nút quay về. */
  const timONode = () =>
    pathRef.current?.querySelector<HTMLElement>('.node[data-state="current"]')?.closest("li") ?? null;
  /** Vị trí cuộn đặt dấu chân hiện tại ở khoảng 1/3 trên của khung. */
  const viTriCuon = (ul: HTMLElement, li: HTMLElement) =>
    Math.max(0, li.offsetTop - Math.max(0, (ul.clientHeight - li.offsetHeight) * 0.35));

  useEffect(() => {
    const ul = pathRef.current;
    const li = timONode();
    if (!ul || !li) return;
    const top = viTriCuon(ul, li);
    if (top > 0) ul.scrollTop = top;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  // ── NÚT "VỀ HIỆN TẠI" ────────────────────────────────────────────────────
  // Lộ trình dài 204 dấu chân và em CUỘN ĐƯỢC thoải mái để xem trước các chương
  // — đó là chủ ý (PRODUCT: "lộ trình phải nhìn thấy được"). Nhưng cuộn đi xa
  // rồi thì đường về chỗ đang học là cuộn tay ngược lại, có khi cả chục màn.
  // Nút chỉ hiện KHI CẦN: dấu chân hiện tại trôi khỏi khung. Đứng yên tại chỗ
  // thì không có gì thêm trên màn.
  const [lacChoDangHoc, datLacChoDangHoc] = useState(false);
  useEffect(() => {
    const ul = pathRef.current;
    const li = timONode();
    if (!ul || !li || typeof IntersectionObserver === "undefined") {
      datLacChoDangHoc(false);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => datLacChoDangHoc(!(e?.isIntersecting ?? true)),
      // root = chính vùng cuộn, KHÔNG phải viewport: `.path` mới là thứ cuộn.
      { root: ul, threshold: 0.4 },
    );
    io.observe(li);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  const veHienTai = () => {
    const ul = pathRef.current;
    const li = timONode();
    if (!ul || !li) return;
    // Cuộn mượt là chỉ dẫn KHÔNG GIAN ở đây: em thấy mình đi ngược lại bao xa,
    // nên không lạc. Giảm chuyển động thì nhảy thẳng.
    const nhe = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    ul.scrollTo({ top: viTriCuon(ul, li), behavior: nhe ? "auto" : "smooth" });
  };

  const done = nodes.filter((n) => n.state === "mastered").length;
  const pct = nodes.length > 0 ? Math.round((done / nodes.length) * 100) : 0;
  // % chương CHẠY tới mức + số đếm dần (chủ dự án 30/07: "hard cứng" thì em
  // không thấy mình vừa nhích được gì). Giảm chuyển động → nhả thẳng số cuối.
  const pctGrown = useGrow(pct, { delay: 260 });
  const pctShown = useCountUp(pct, { duration: 1000, delay: 260 });
  // Banner hi-fi: eyebrow = môn/chương (unit), title serif = tên chương.
  // subtitle của app là "Tên chương · mô tả" — tách phần đầu lên title.
  const [chapterTitle, ...restParts] = subtitle.split(" · ");
  const chapterDesc = restParts.join(" · ");
  const hasLocked = nodes.some((n) => n.state === "locked");
  const redoNodes = nodes.filter((n) => n.state === "redo");
  // Bài ĐÃ ĐẠT mà thầy cô còn nhắn thêm — khen hay chữa nốt chỗ chưa gọn. Không
  // hiện ở đây thì lời nhắn của cô chỉ tới được em khi bài BỊ TRẢ, nghĩa là em
  // chỉ nghe thầy cô lúc làm sai.
  const praiseNodes = nodes.filter((n) => (n.praise?.length ?? 0) > 0);

  // ── CHẶNG theo chương (điểm dừng — chủ dự án: "lướt trong vô vọng…
  // phải có điểm dừng"). Node mang `chapter` → gom thành chặng: chặng đang
  // học mở đủ dấu chân, chặng đã xong/còn khoá gập thành thẻ (bấm để xem
  // trước). Lộ trình không có chapter (server chưa trả) → dải phẳng như cũ.
  type Leg = { name: string; nodes: PathNode[] };
  const legs: Leg[] = [];
  for (const n of nodes) {
    const name = n.chapter?.trim() ?? "";
    const last = legs[legs.length - 1];
    if (!last || last.name !== name) legs.push({ name, nodes: [] });
    legs[legs.length - 1]!.nodes.push(n);
  }
  const hasLegs = legs.length > 1 && legs.some((l) => l.name !== "");

  // ── VƯỢT ẢI: mỗi CHƯƠNG một "thế giới" nền riêng. Cảnh mang thế giới của
  // chương ĐANG học; đi hết chương → mở cảnh mới.
  // 9 THẾ GIỚI = 9 tranh savanna (đội Studio vẽ), theo cung sáng→tối qua các
  // chương: sáng nắng → ngày → chiều → hoàng hôn → mưa → đêm trăng. Tranh có
  // tiền cảnh đậm nên dấu chân VÀNG vẫn bật (khác gradient phẳng "tối om" cũ).
  const WORLDS = 9;
  const currentLegIdx = legs.findIndex((l) => l.nodes.some((n) => n.state === "current"));
  const sceneWorld = ((currentLegIdx >= 0 ? currentLegIdx : 0) % WORLDS + WORLDS) % WORLDS;

  // Không bao giờ lộ id thô cho học sinh: blockedBy (key) → tên bài thật
  const labelByKey = new Map(nodes.map((n) => [n.key, n.label]));

  /** Một dấu chân. `pos` = vị trí 1-based của <li> TRONG ul (tính cả thẻ
   *  chặng) — phải khớp nth-child(8n+k) của nhịp zigzag trong CSS. */
  const pawItem = (n: PathNode, numInLeg: number, pos: number, seq: number) => {
    const locked = n.state === "locked";
    const blockedNames = locked
      ? (n.blockedBy ?? []).map((k) => labelByKey.get(k)).filter((s): s is string => !!s)
      : [];
    const hint =
      blockedNames.length > 0
        ? `${HINT[n.state]} — cần học trước: ${blockedNames.join(", ")}`
        : HINT[n.state];
    // Dáng đi 4 chân tất định theo bước (xem gaitStep): lệch ngang, khoảng cách
    // dọc và GÓC dấu chân đều do mô hình quyết — không còn zigzag lặp máy móc.
    const g = gaitStep(seq);
    // Node HIỆN TẠI có cờ "BẮT ĐẦU" phía trên + sư tử 118px đứng cạnh: kéo về
    // GẦN GIỮA (đỡ chạm mép, chừa chỗ cho sư tử) và cho gap trên rộng an toàn để
    // cờ không đè node phía trên. Các dấu khác giữ nguyên dáng đi tự nhiên.
    if (n.state === "current") {
      // Biên độ đường đi lớn → kéo mạnh về giữa (±28px) để sư tử 118px + cờ đứng
      // cạnh không bị chèn ra mép; gap trên rộng an toàn cho cờ.
      g.dx = Math.max(-28, Math.min(28, Math.round(g.dx * 0.35 * 10) / 10));
      g.dy = 14;
    }
    // Sư tử mascot đứng bên nào: theo dấu chân đang lệch trái hay phải.
    const shiftedLeft = g.dx < 0;
    const Icon = n.state === "available" ? null : ICON[n.state];
    // Thẻ bài đang học gom SẴN tiến trình (xem .node-card).
    const isCurrent = n.state === "current";
    const showProg = isCurrent && (n.progress ?? 0) > 0;
    // Máy đọc: thẻ trên đầu node là aria-hidden (chữ trang trí trùng nhãn nút),
    // nên số dang dở phải nhập vào aria-label của chính cái nút.
    const extra = [
      showProg ? `đã làm ${n.doneCount ?? 0} trên ${n.totalCount ?? 0} câu` : null,
    ].filter(Boolean);
    return (
      <li
        key={n.key}
        /* Sư tử đứng bên nào — CSS xê dịch mound/nhãn theo. Thẻ bài thì luôn
           căn giữa NGAY TRÊN dấu chân (nằm trên đầu sư tử, không tranh chỗ). */
        data-lion={isCurrent ? (shiftedLeft ? "r" : "l") : undefined}
        style={
          {
            position: "relative",
            "--paw-dx": `${g.dx}px`,
            "--paw-dy": `${g.dy}px`,
            "--paw-rot": `${g.rot}deg`,
          } as React.CSSProperties
        }
      >
        <button
          className="node"
          data-state={n.state}
          /* Node KHOÁ vẫn nhận bấm (audit 04/09: "bấm không có phản hồi gì, lý do
             chỉ nằm trong aria-label") — bấm thì hiện bong bóng nói cần học xong
             bài nào, KHÔNG mở bài. `aria-disabled` giữ ngữ nghĩa cho máy đọc. */
          disabled={busy}
          aria-disabled={locked || undefined}
          aria-label={`${n.label}. ${[hint, ...extra].join(". ")}`}
          title={`${n.label} — ${hint}`}
          onClick={() => {
            if (!locked) { onStart(n); return; }
            setKhoaNhac({ key: n.key, text: blockedNames.length ? `Mở khi xong: ${blockedNames.join(", ")}` : "Bài này mở khi xong bài phía trước" });
            window.clearTimeout(khoaNhacTimer.current);
            khoaNhacTimer.current = window.setTimeout(() => setKhoaNhac(null), 2800);
          }}
        >
          {/* MỘT THẺ cho bài đang học, đứng NGAY TRÊN dấu chân: nhãn "BẮT ĐẦU" +
              tên bài + tiến trình + chờ chấm. Trước 30/07 đây là BỐN món rời
              (cờ trên đầu, nhãn tên né sang cạnh 64px, chip 8/8, chip chờ chấm)
              — chủ dự án đọc ra thành "lệch, không biết cái nào ra cái nào".
              Căn giữa tuyệt đối theo node nên không còn lệch; nằm phía TRÊN nên
              không tranh chỗ với sư tử đứng cạnh. */}
          {isCurrent && (
            <span className="node-card" data-preview={preview || undefined} aria-hidden>
              {/* Nhãn theo TRẠNG THÁI THẬT (audit 04/09: "BẮT ĐẦU · 7/7 câu" — đã
                  làm hết mà vẫn 'bắt đầu', không hiểu vì sao chưa xong). Đã chạm
                  hết câu nhưng node chưa xanh = còn thiếu câu KHÓ (mastery cần
                  đúng ≥1 câu DOK cao nhất) — nói thẳng điều đó. */}
              <span className="node-card-kicker">
                {preview
                  ? "XEM TRƯỚC"
                  : (n.doneCount ?? 0) === 0
                    ? "BẮT ĐẦU"
                    : (n.doneCount ?? 0) >= (n.totalCount ?? 0)
                      ? "LÀM LẠI"
                      : "TIẾP TỤC"}
              </span>
              <span className="node-card-name">{shortLabel(n.label)}</span>
              {showProg && (
                <span className="node-card-meta">
                  <span className="node-card-prog num">
                    {(n.doneCount ?? 0) >= (n.totalCount ?? 0)
                      ? "chưa đạt câu khó"
                      : `${n.doneCount ?? 0}/${n.totalCount ?? 0} câu`}
                  </span>
                </span>
              )}
            </span>
          )}
          {/* Node = DẤU CHÂN SƯ TỬ artwork chính chủ (LẬT ngón xuống qua CSS)
              trên đĩa ellipse "dày dặn". MỌI trạng thái dùng bản TRƠN + overlay
              riêng (icon/số) KHÔNG lật — nên mastered nhận dấu ✓ đè lên đệm
              (không dùng bản tích-baked vì lật dọc sẽ làm ✓ ngược). */}
          <PawNode width={n.state === "current" ? 86 : 70} />
          <span className="node-face" aria-hidden>
            {Icon ? (
              <Icon strokeWidth={2.75} />
            ) : (
              /* Node chưa học: SỐ thứ tự trong chặng (hi-fi) */
              <span className="node-num num">{numInLeg}</span>
            )}
          </span>
        </button>
        {khoaNhac?.key === n.key && (
          <span className="node-toast" role="status">{khoaNhac.text}</span>
        )}
        {/* KHO BÁU: học liệu đứng CẠNH bài, không nằm trong bài. KHOÁ THEO BÀI —
            bài chưa mở thì kho báu cũng chưa mở, đúng lối đi tuần tự của lộ
            trình; mở trước thì em nhảy cóc bằng đường học liệu. Ngả về phía đối
            diện hướng dấu chân đang lệch để không chồng lên nhãn/sư tử. */}
        {n.khoBau && onOpenKhoBau && (
          <button
            type="button"
            className="node-treasure"
            data-side={shiftedLeft ? "r" : "l"}
            data-locked={locked || undefined}
            data-done={(!locked && n.khoBau.mucDaQua >= Math.max(...n.khoBau.mucCoSan)) || undefined}
            disabled={locked || busy}
            onClick={(e) => { e.stopPropagation(); onOpenKhoBau(n); }}
            aria-label={
              locked
                ? `Kho báu của bài ${n.label} — chưa mở, cần học xong bài trước`
                : `Kho báu học liệu của bài ${n.label} — đã mở ${n.khoBau.mucDaQua}/${n.khoBau.mucCoSan.length} mức`
            }
            title={
              locked
                ? "Học xong bài phía trước là mở được kho báu này"
                : `Học liệu · mức ${Math.min(n.khoBau.mucDaQua + 1, n.khoBau.mucCoSan.length)}/${n.khoBau.mucCoSan.length}`
            }
          >
            {locked ? <Lock aria-hidden strokeWidth={2.5} /> : <Gift aria-hidden strokeWidth={2.25} />}
            <span className="num">
              {Math.min(n.khoBau.mucDaQua, n.khoBau.mucCoSan.length)}/{n.khoBau.mucCoSan.length}
            </span>
          </button>
        )}
        {n.state === "current" && (
          <span className={"path-lion" + (shiftedLeft ? " path-lion-r" : "")} aria-hidden>
            <Lion mood={heroMood} variant="full" size={118} decorative eager />
          </span>
        )}
      </li>
    );
  };

  if (nodes.length === 0) {
    return (
      <>
        <header style={{ marginBottom: 16 }}>
          <h1 className="h2">{unit}</h1>
          <p className="muted">{subtitle}</p>
        </header>
        <div className="empty">
          <Lion mood="sleepy" size={112} />
          <div>
            <p className="h3">Chưa có bài học nào</p>
            <p className="muted">
              Thầy cô đang soạn nội dung cho môn này. Khi xong, lộ trình sẽ hiện ra ở đây.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <section className="scene" data-world={sceneWorld}>
      {/* Phông cảnh: mặt trời + mây + đồi — thuần trang trí; đổi theo thế giới chương */}
      <div className="scene-sky" aria-hidden>
        <i className="scene-hill scene-hill-back" />
        <i className="scene-hill scene-hill-front" />
        <i className="scene-sun" />
        <i className="scene-cloud sc-1" />
        <i className="scene-cloud sc-2" />
        <i className="scene-cloud sc-3" />
      </div>

      {/* Banner chương — thẻ trắng nổi trên trời (hi-fi 3a/3c) */}
      <header className="scene-banner">
        <div className="scene-banner-top">
          <span className="eyebrow">{unit}</span>
          <BookOpen aria-hidden strokeWidth={2.25} />
        </div>
        <h1 className="scene-title card-title">{chapterTitle || unit}</h1>
        {chapterDesc && <p className="scene-desc">{chapterDesc}</p>}
        {nodes.length > 1 && (
          <div className="unit-prog">
            <div
              className="meter"
              role="progressbar"
              aria-valuenow={done}
              aria-valuemin={0}
              aria-valuemax={nodes.length}
              aria-label={`Đã thành thạo ${done} trên ${nodes.length} điểm kiến thức`}
            >
              <i style={{ "--p": `${pctGrown}%` } as React.CSSProperties} />
            </div>
            <b className="num" aria-hidden>
              {pctShown}%
            </b>
          </div>
        )}
      </header>

      {/* Bài nộp bị trả về: báo NGAY trên đầu lộ trình, kèm tên bài — học sinh
          nộp hôm trước, hôm sau vào mới biết kết quả nên phải nói rõ ràng. */}
      {redoNodes.length > 0 && (
        /* GẬP LẠI (30/07): trước đây thẻ này banh ra nguyên khối nền đỏ + 4 nút
           đỏ to — chủ dự án đọc thành "app bị lỗi". Giờ là MỘT DÒNG thẻ trắng,
           chấm đỏ nhỏ dẫn mắt, bấm mới mở danh sách. Vẫn nói đủ số bài nên
           không có gì bị chôn; `open` khi chỉ có 1 bài (mở ra cũng chỉ 1 nút). */
        <details
          className="redo-notice"
          data-tone="redo"
          open={redoNodes.reduce((n, x) => n + Math.max(1, x.redo?.length ?? 1), 0) === 1}
        >
          <summary>
            <span className="notice-dot" aria-hidden>
              <Undo2 strokeWidth={2.5} />
            </span>
            {/* Đếm theo CÂU, khớp đúng số nút bên dưới — đếm theo bài thì hiện
                "1 bài cần làm lại" mà dưới lại có hai nút. */}
            <span className="notice-text">
              <b>{redoNodes.reduce((n, x) => n + Math.max(1, x.redo?.length ?? 1), 0)} bài</b> nộp chưa đạt —
              sửa rồi nộp lại
            </span>
            <ChevronDown className="notice-chev" aria-hidden strokeWidth={2.5} />
          </summary>
          <div className="redo-body">
            {/* Mỗi bài một NÚT: bấm là vào ĐÚNG câu bị trả, kèm LỜI NHẮN của
                thầy cô hiện ngay tại đây. Trước đây đây là <div> chết: em biết
                "có 1 bài cần làm lại" mà không biết bài nào, sai gì, và phải
                học lại cả bài từ đầu (lỗi 2 — ba lớp). */}
            {/* MỘT NÚT CHO MỖI CÂU bị trả, kèm ĐÚNG lời nhắn của câu đó. Gộp
                theo bài thì lời nhắn của câu này lại nằm cạnh nút mở câu kia,
                và các câu còn lại không có lối vào. */}
            <div className="redo-list">
              {redoNodes.flatMap((n) => {
                const items = n.redo?.length
                  ? n.redo
                  : [{ questionId: undefined, note: null, noteFileUrl: null, noteFileName: null }];
                return items.map((r, i) => (
                  <div key={`${n.key}:${r.questionId ?? i}`} className="redo-item">
                    <button
                      type="button"
                      className="redo-go"
                      disabled={busy}
                      onClick={() => (onRedo ? onRedo(n, r.questionId) : onStart(n))}
                    >
                      <Undo2 aria-hidden strokeWidth={2.5} />
                      Làm lại: {n.label}
                      {items.length > 1 ? ` (câu ${i + 1}/${items.length})` : ""}
                    </button>
                    {r.note && (
                      /* Lời nhắn của cô môn Toán gần như chắc chắn có công thức
                         ("thiếu bước tính $\Delta$") — render KaTeX y như mọi
                         chỗ khác trong app, đừng bắt học sinh đọc LaTeX thô. */
                      <p className="redo-note">
                        <b>Thầy cô nhắn:</b> <MathText>{r.note}</MathText>
                      </p>
                    )}
                    {/* Đ2 — bài cô chữa tay. Bài hình học thì một tờ giấy đã
                        chữa nói được nhiều hơn cả đoạn nhắn. Link ký hạn 1 giờ:
                        mở ngay thì được, gửi cho bạn khác thì hết hạn. */}
                    {r.noteFileUrl && (
                      <a
                        className="redo-file"
                        href={r.noteFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={r.noteFileName ?? undefined}
                      >
                        <Paperclip aria-hidden strokeWidth={2.25} />
                        Xem bài thầy cô chữa
                      </a>
                    )}
                  </div>
                ));
              })}
            </div>
          </div>
        </details>
      )}

      {/* Bài ĐÃ ĐẠT mà thầy cô còn nhắn thêm. Cùng khuôn thẻ gập với "cần làm
          lại" nhưng tông xanh — đây là tin vui, không phải bài bị trả. */}
      {praiseNodes.length > 0 && (
        <details className="redo-notice" data-tone="praise">
          <summary>
            <span className="notice-dot" aria-hidden>
              <Award strokeWidth={2.5} />
            </span>
            <span className="notice-text">
              Thầy cô nhận xét <b>{praiseNodes.reduce((n, x) => n + (x.praise?.length ?? 0), 0)} bài</b> em đã đạt
            </span>
            <ChevronDown className="notice-chev" aria-hidden strokeWidth={2.5} />
          </summary>
          <div className="redo-body">
            <div className="redo-list">
              {praiseNodes.flatMap((n) =>
                (n.praise ?? []).map((r, i) => (
                  <div key={`${n.key}:${r.questionId ?? i}`} className="redo-item">
                    <span className="praise-node">{n.label}</span>
                    {r.note && (
                      <p className="redo-note">
                        <b>Thầy cô nhắn:</b> <MathText>{r.note}</MathText>
                      </p>
                    )}
                    {r.noteFileUrl && (
                      <a
                        className="redo-file"
                        href={r.noteFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={r.noteFileName ?? undefined}
                      >
                        <Paperclip aria-hidden strokeWidth={2.25} />
                        Xem bài thầy cô chữa
                      </a>
                    )}
                  </div>
                )),
              )}
            </div>
          </div>
        </details>
      )}

      {/* Sư tử giờ đứng cạnh node hiện tại — lời chào thành thẻ gọn, không lion.
          `key` theo nội dung: câu chào đổi (mỗi lần mở app một câu — lib/nudges)
          thì thẻ remount và chạy lại animation hiện vào, không đổi chữ âm thầm. */}
      {greeting && (
        <p className="scene-greeting" key={greeting}>
          {greeting}
        </p>
      )}

      <ul className="path" ref={pathRef}>
        {!hasLegs
          ? nodes.map((n, i) => pawItem(n, i + 1, i + 1, i))
          : (() => {
              const items: React.ReactNode[] = [];
              let pos = 0; // vị trí <li> 1-based trong ul (định vị cũ)
              let seq = 0; // CHỈ SỐ BƯỚC CHÂN liên tục (chỉ đếm dấu chân, KHÔNG
              //             đếm header chặng) → dáng đi nối liền qua các chương.
              legs.forEach((leg, li) => {
                const doneIn = leg.nodes.filter((x) => x.state === "mastered").length;
                const state =
                  doneIn === leg.nodes.length
                    ? "done"
                    : leg.nodes.every((x) => x.state === "locked")
                      ? "locked"
                      : "active";
                const key = `${li}:${leg.name}`;
                const open = state === "active" || openLegs.has(key);
                pos++;
                items.push(
                  <li className="path-leg" data-world={li % WORLDS} key={`leg-${key}`}>
                    {state === "active" ? (
                      /* Chặng đang học: mốc mở đầu, dấu chân bày đủ bên dưới */
                      <div className="leg-head">
                        <Flag aria-hidden strokeWidth={2.25} />
                        <span className="leg-body">
                          <span className="leg-kicker">
                            Chặng {li + 1}/{legs.length}
                          </span>
                          <b className="leg-name">{leg.name || unit}</b>
                        </span>
                        <span className="leg-count num">
                          {doneIn}/{leg.nodes.length} bài
                        </span>
                      </div>
                    ) : (
                      /* Chặng gập: điểm dừng khi cuộn — bấm để xem trước/thu lại */
                      <button
                        type="button"
                        className="leg-card"
                        data-state={state}
                        aria-expanded={open}
                        onClick={(e) => {
                          const btn = e.currentTarget;
                          const dangMo = openLegs.has(key);
                          setOpenLegs((s) => {
                            const next = new Set(s);
                            if (next.has(key)) next.delete(key);
                            else next.add(key);
                            return next;
                          });
                          // MỞ ra thì kéo thẻ chặng lên đầu khung để dấu chân vừa đổ
                          // ra nằm TRONG tầm mắt (audit 04/09: nội dung mở dưới fold,
                          // chevron chỉ lật → tưởng nút chết).
                          if (!dangMo) window.setTimeout(() => btn.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
                        }}
                      >
                        <span className="leg-ico" aria-hidden>
                          {state === "done" ? <Check strokeWidth={2.5} /> : <Lock strokeWidth={2} />}
                        </span>
                        <span className="leg-body">
                          <span className="leg-kicker">
                            Chặng {li + 1}/{legs.length}
                            {state === "done" ? " · đã hoàn thành" : " · mở khi xong chặng trước"}
                          </span>
                          <b className="leg-name">{leg.name || unit}</b>
                        </span>
                        <span className="leg-count num">
                          {state === "done" ? `${doneIn}/${leg.nodes.length}` : `${leg.nodes.length} bài`}
                        </span>
                        <ChevronDown aria-hidden strokeWidth={2.25} className="leg-chev" />
                      </button>
                    )}
                  </li>,
                );
                if (open) {
                  leg.nodes.forEach((n, ni) => {
                    pos++;
                    items.push(pawItem(n, ni + 1, pos, seq));
                    seq++;
                  });
                }
              });
              return items;
            })()}
      </ul>

      {/* ĐÍCH cuối lộ trình (audit 04/09: "sau Chặng 9 kết thúc bằng thẻ khoá,
          không cột mốc/lời đích") — một mốc duy nhất, số thật: bài đã xanh / tổng. */}
      {hasLegs && (
        <div className="path-finish" data-done={masteredTotal === nodes.length || undefined}>
          <Flag aria-hidden strokeWidth={2.25} />
          <span className="path-finish-body">
            <b>Đích {unit}</b>
            <span className="num">{masteredTotal}/{nodes.length} bài đã thành thạo</span>
          </span>
        </div>
      )}

      {/* Cổng chương cuối dải phẳng — khi CÓ chặng, thẻ chặng khoá đã là
          điểm dừng nên không cần cổng lặp lại (không bịa số câu) */}
      {hasLocked && !hasLegs && (
        <div className="gate">
          <Award aria-hidden strokeWidth={2} />
          <div className="gate-body">
            <b>Cổng chương</b>
            <span>Mở khi hoàn thành các điểm phía trên</span>
          </div>
          <Lock aria-hidden strokeWidth={2} className="gate-lock" />
        </div>
      )}

      {/* Đường về chỗ đang học — chỉ hiện khi dấu chân hiện tại đã trôi khỏi
          khung. Nằm góc dưới-phải, trên thanh nav đáy ở điện thoại. */}
      {lacChoDangHoc && (
        <button type="button" className="path-back" onClick={veHienTai}>
          <LocateFixed aria-hidden strokeWidth={2.25} />
          Về hiện tại
        </button>
      )}
    </section>
  );
}
