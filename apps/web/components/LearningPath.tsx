"use client";

import { useEffect, useRef, useState } from "react";
import { Award, BookOpen, Check, ChevronDown, Flag, Lock, Play, RotateCcw } from "lucide-react";
import Lion, { type LionMood } from "./Lion";
import PawNode from "./PawNode";

/**
 * Trạng thái một điểm kiến thức trên lộ trình.
 * `stale` = em đã học, nhưng giáo viên đã sửa NGHĨA của nội dung sau đó.
 * Dấu "đã học" không bao giờ bị xoá — chỉ chuyển vàng để mời ôn lại.
 */
export type NodeState = "mastered" | "stale" | "current" | "available" | "locked";

export type PathNode = {
  key: string;
  label: string;
  state: NodeState;
  /** Với node bị khoá: các điểm tiên quyết còn thiếu (khớp `blockedBy` của learning-path). */
  blockedBy?: string[];
  /** Tên chương/Unit — có thì lộ trình gom thành CHẶNG (điểm dừng khi cuộn). */
  chapter?: string;
};

const HINT: Record<NodeState, string> = {
  mastered: "Đã thành thạo",
  stale: "Đã học — nội dung vừa được cập nhật, ôn lại nhé",
  current: "Bắt đầu ở đây",
  available: "Chưa học",
  locked: "Chưa mở",
};

/* Icon theo trạng thái (hi-fi 3a) — node `available` KHÔNG dùng icon mà hiện
   SỐ thứ tự của nó trong lộ trình, nên không nằm trong map này. */
const ICON: Record<Exclude<NodeState, "available">, typeof Check> = {
  mastered: Check,
  stale: RotateCcw, // lời mời ôn lại — không phải cảnh báo
  current: Play,
  locked: Lock,
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
}: {
  unit: string;
  subtitle: string;
  nodes: PathNode[];
  /** Lời sư tử nói ở đầu lộ trình. Bỏ trống thì không có bong bóng. */
  greeting?: string;
  /** Cảm xúc của sư tử — `greet` vẫy chào; `miss` khi chuỗi ngày nguội. */
  heroMood?: LionMood;
  busy?: boolean;
  /** Môn XEM TRƯỚC (chưa có ngân hàng câu hỏi): node đầu ghi "XEM TRƯỚC"
   *  thay "BẮT ĐẦU"; bấm không mở buổi học (TutorApp.start tự chặn). */
  preview?: boolean;
  onStart: (node: PathNode) => void;
}) {
  // Chặng đã xong / còn khoá đang được mở xem trước (bấm thẻ chặng).
  const [openLegs, setOpenLegs] = useState<Set<string>>(new Set());

  // Native: mở màn Học là THẤY NGAY dấu chân BẮT ĐẦU — path tự cuộn tới node
  // current (nhảy tức thời, không animation → tự thỏa reduced-motion).
  const pathRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const ul = pathRef.current;
    if (!ul) return;
    const cur = ul.querySelector<HTMLElement>('.node[data-state="current"]');
    const li = cur?.closest("li");
    if (!li) return;
    const top = li.offsetTop - Math.max(0, (ul.clientHeight - li.offsetHeight) * 0.35);
    if (top > 0) ul.scrollTop = top;
  }, [nodes]);

  const done = nodes.filter((n) => n.state === "mastered").length;
  const pct = nodes.length > 0 ? Math.round((done / nodes.length) * 100) : 0;
  // Banner hi-fi: eyebrow = môn/chương (unit), title serif = tên chương.
  // subtitle của app là "Tên chương · mô tả" — tách phần đầu lên title.
  const [chapterTitle, ...restParts] = subtitle.split(" · ");
  const chapterDesc = restParts.join(" · ");
  const hasLocked = nodes.some((n) => n.state === "locked");

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
    return (
      <li
        key={n.key}
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
          disabled={locked || busy}
          aria-label={`${n.label}. ${hint}`}
          title={`${n.label} — ${hint}`}
          onClick={() => onStart(n)}
        >
          {n.state === "current" && (
            <span className="node-flag" data-preview={preview || undefined} aria-hidden>
              {preview ? "XEM TRƯỚC" : "BẮT ĐẦU"}
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
        {n.state === "current" && <span className="node-label">{shortLabel(n.label)}</span>}
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
              <i style={{ "--p": `${pct}%` } as React.CSSProperties} />
            </div>
            <b className="num">{pct}%</b>
          </div>
        )}
      </header>

      {/* Sư tử giờ đứng cạnh node hiện tại — lời chào thành thẻ gọn, không lion */}
      {greeting && <p className="scene-greeting">{greeting}</p>}

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
                        onClick={() =>
                          setOpenLegs((s) => {
                            const next = new Set(s);
                            if (next.has(key)) next.delete(key);
                            else next.add(key);
                            return next;
                          })
                        }
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
    </section>
  );
}
