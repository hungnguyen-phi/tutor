"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Mic,
  Square,
  ArrowRight,
  AlertTriangle,
  Sigma,
  Languages,
  BookText,
  Scale,
  Zap,
  X,
  CheckCircle2,
  Timer,
  LifeBuoy,
  Paperclip,
  Info,
  Lightbulb,
} from "lucide-react";
import { useAuth, signOut } from "../lib/auth";
import { supabase } from "../lib/supabase";
import RedirectToLogin from "./RedirectToLogin";
import Splash from "./Splash";
import AppShell, { type NavKey } from "./AppShell";
import Hud from "./Hud";
import SubjectPicker, { type SubjectInfo } from "./SubjectPicker";
import Sheet from "./Sheet";
import { GopYSheet, GopYFab, type GopYCtx } from "./GopY";
import PresenceStrip from "./PresenceStrip";
import LearningPath, { type PathNode } from "./LearningPath";
import CameraShot from "./CameraShot";
import Lion from "./Lion";
import KhoBauView from "./KhoBauView";
import RailOnLuyen from "./RailOnLuyen";
import ReviewView from "./ReviewView";
import QuestsView from "./QuestsView";
import ProfileView from "./ProfileView";
import SettingsView from "./SettingsView";
import { ScoreboardBody } from "./Scoreboard";
import * as G from "../lib/gamify";
import * as Prefs from "../lib/prefs";
import { usePresence, PRESENCE_ENABLED } from "../lib/presence";
import LearnAside from "./LearnAside";
import BaiLamEditor from "./BaiLamEditor";
import { useRotation, pickGreeting } from "../lib/nudges";
import {
  PHIEN_DO_ENABLED,
  docPhienDo,
  luuPhienDo,
  xoaPhienDo,
  dongGoi,
  cauDangLam,
  type PhienDo,
} from "../lib/phien-do";
import { MathText } from "../lib/mathrender";
import "katex/dist/katex.min.css";
import {
  giveAssent,
  diagnose,
  diagnoseWrong,
  answer,
  answerReflect,
  writing,
  speaking,
  uploadWork,
  submitWork,
  endSession,
  learningPath,
  nodeResources,
  getScoreboard,
  warmUpFunctions,
  ApiError,
  SESSION_EXPIRED,
  type Scoreboard,
  type DiagnoseResult,
  type DiagnoseQuestion,
  type TurnResult,
  type EndResult,
  type NodeResource,
  type RubricResult,
} from "../lib/api";
import { OrderQuestion, MatchQuestion, ChecklistQuestion, BlanksQuestion } from "./Interactive";
import { SpeakerButton } from "./SpeakerButton";

/**
 * Lời hiển thị cho lỗi gọi API. Rate-limit (429) → câu dịu kèm số giây chờ nếu
 * server trả `retryAfter`; còn lại giữ nguyên message như trước.
 */
function errText(e: unknown): string {
  if (e instanceof ApiError && e.code === "rate_limited") {
    return e.retryAfter
      ? `Em thao tác hơi nhanh — chờ ${e.retryAfter}s rồi thử lại nhé.`
      : "Em thao tác hơi nhanh, chờ chút nhé.";
  }
  return e instanceof Error ? e.message : String(e);
}

/** Hết phiên đăng nhập — lỗi này phải xử RIÊNG: mọi lệnh gọi server đều hỏng
 *  nên vá từng chỗ là vô ích, phải mời đăng nhập lại một lần cho cả màn. */
const isExpired = (e: unknown) => e instanceof ApiError && e.code === SESSION_EXPIRED;

/**
 * BÀI ĐANG GÕ DỞ — giữ lại qua mọi lần văng (lỗi #26).
 *
 * Màn "phiên đã hết hạn" vẫn viết "bài đang dở vẫn còn nguyên". Đó là NÓI DỐI:
 * bấm đăng nhập lại là `signOut()` + chuyển trang, mọi thứ em vừa gõ bay sạch.
 * Người thử 1 đợt 2: *"việc bị văng ra khỏi app sẽ làm hs nản và dễ từ bỏ."*
 * Mất bài đúng lúc bị văng là cú thứ hai, và nó mới là cú làm em bỏ cuộc.
 *
 * localStorage chứ không phải state: nó phải sống qua cả lần tải lại trang.
 * Bọc try/catch vì chế độ riêng tư của trình duyệt chặn localStorage — mất chỗ
 * lưu nháp thì tiếc, chứ không được phép làm hỏng buổi học.
 */
// LỖI NGHIÊM TRỌNG vá 04/09 (10 agent đóng vai học sinh phát hiện, 2 agent ĐỘC
// LẬP cùng thấy chữ lạ chèn vào ô bài làm của mình): khoá cũ chỉ theo MÃ CÂU,
// không theo HỌC SINH — máy dùng chung (phòng máy trường, hay chỉ đơn giản hai
// tài khoản cùng một trình duyệt) thì học sinh SAU mở đúng câu học sinh TRƯỚC
// đang gõ dở sẽ thấy NGUYÊN VĂN bài nháp của người kia tự điền vào, có thể vô
// tình nộp luôn — vừa lộ bài làm người khác, vừa làm sai lệch bằng chứng chấm.
const KHOA_NHAP = (studentId: string, qid: string) => `tutor:nhap:${studentId}:${qid}`;
const docNhap = (studentId: string, qid: string): string => {
  try { return localStorage.getItem(KHOA_NHAP(studentId, qid)) ?? ""; } catch { return ""; }
};
const luuNhap = (studentId: string, qid: string, v: string): void => {
  try {
    if (v.trim()) localStorage.setItem(KHOA_NHAP(studentId, qid), v);
    else localStorage.removeItem(KHOA_NHAP(studentId, qid));
  } catch { /* riêng tư chặn — bỏ qua */ }
};
const xoaNhap = (studentId: string, qid: string): void => {
  try { localStorage.removeItem(KHOA_NHAP(studentId, qid)); } catch { /* như trên */ }
};

type Msg =
  | { role: "student"; text: string }
  | { role: "tutor"; text: string }
  /* Cổng nỗ lực: em đòi đáp án / phải thử đủ trước khi được gợi ý — sư tử dỗi */
  | { role: "gate"; text: string }
  | { role: "hint"; text: string }
  | { role: "feedback"; text: string };

/** Vai hợp lệ của một lời — cửa lọc khi dựng lại hội thoại từ gói ở máy
 *  (localStorage là thứ sửa được, và bản app cũ cũng ghi vào cùng khoá). */
const VAI_LOI: string[] = ["student", "tutor", "gate", "hint", "feedback"];

// "submitted": đã NỘP BÀI làm ngoài — chưa chấm, nhưng được đi tiếp ngay.
type Verdict = "ok" | "retry" | "done" | "submitted" | null;
type Subject = "Toan" | "Van" | "Anh" | "GDKTPL";

// Mỗi môn: nhãn dài (banner) + ngắn (pill/thẻ) + slug file lộ trình tĩnh +
// `live` = đã có ngân hàng câu hỏi trong DB nên LUYỆN được ngay. Môn chưa
// `live` vẫn hiện LỘ TRÌNH thật (giáo trình từ Studio) để xem trước — phần
// luyện tập mở khi bộ câu hỏi được nạp (xem [[supabase-mcp-deploy]]).
const SUBJECTS: SubjectInfo<Subject>[] = [
  // Phụ đề nói bằng tiếng của học sinh (audit 04/09: "dẫn dắt Socratic, chấm bằng
  // CAS" là thuật ngữ kỹ thuật; "Hàm số bậc hai" lệch chương đang học).
  { key: "Toan", short: "Toán", unit: "Toán 10", subtitle: "Hỏi để bạn tự tìm ra — không đưa sẵn đáp án", slug: "toan", live: true, Icon: Sigma },
  { key: "Van", short: "Ngữ văn", unit: "Ngữ văn 10", subtitle: "Thần thoại, truyện kể, thơ · đọc hiểu & viết", slug: "van", live: false, Icon: BookText },
  { key: "Anh", short: "Tiếng Anh", unit: "Tiếng Anh 10", subtitle: "Present simple · trắc nghiệm, viết & nói", slug: "anh", live: true, Icon: Languages },
  { key: "GDKTPL", short: "KT & Pháp luật", unit: "Kinh tế & Pháp luật 10", subtitle: "Hoạt động kinh tế & pháp luật · trắc nghiệm tự chấm", slug: "gdktpl", live: true, Icon: Scale },
];

/** Chiêm nghiệm cuối buổi (G14) — 3 lựa chọn chạm, mỗi lựa chọn trả lời bằng
 *  câu growth-mindset. Tự chứa trạng thái, KHÔNG gọi API / KHÔNG chấm điểm:
 *  giá trị nằm ở HÀNH ĐỘNG tự nhìn lại, không phải ở dữ liệu thu về. */
function SessionReflection() {
  const [picked, setPicked] = useState<string | null>(null);
  const opts = [
    { k: "clear", label: "Em hiểu rõ hơn rồi", msg: "Tuyệt! Tự nhận ra mình tiến bộ là bước quan trọng nhất." },
    { k: "hard", label: "Vẫn còn hơi khó", msg: "Không sao — thấy khó nghĩa là não em đang lớn lên. Mai mình luyện tiếp nhé!" },
    { k: "more", label: "Em muốn thử thêm", msg: "Tinh thần đó đáng quý! Cứ giữ đà tò mò này." },
  ];
  const hit = opts.find((o) => o.k === picked);
  return (
    <div className="reflect-card">
      <p className="reflect-q">Hôm nay em thấy buổi học thế nào?</p>
      <div className="reflect-chips">
        {opts.map((o) => (
          <button
            key={o.k}
            type="button"
            className="reflect-chip"
            aria-pressed={picked === o.k}
            onClick={() => setPicked(o.k)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hit && <p className="reflect-msg" role="status">{hit.msg}</p>}
    </div>
  );
}

export default function TutorApp() {
  const { session, profile } = useAuth();
  const [subject, setSubject] = useState<Subject>("Toan");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [presenceOn, setPresenceOn] = useState(false); // opt-in "học cùng nhau"
  const [ses, setSes] = useState<DiagnoseResult | null>(null);
  const [qi, setQi] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  /** ĐÁP ÁN EM VỪA NỘP — để màn "thử lại" ghi lại được em đã trả lời gì thay vì
   *  chìa ra một ô nhập chết (lỗi #25). Chốt ở lúc nộp chứ không đọc lại từ
   *  `text`/`picked`: câu nhiều bước ghép đáp án từ ba nguồn, đọc lại là dựng
   *  sai chuỗi em thật sự đã gửi. */
  const [daTraLoi, setDaTraLoi] = useState<string | null>(null);
  // Đáp án canonical của dạng tương tác (sap_xep/noi_cot): null = chưa hoàn tất.
  const [interactiveAns, setInteractiveAns] = useState<string | null>(null);
  // Đợt B: bảng điểm rubric (viết/nói) — formative.
  const [rubricResult, setRubricResult] = useState<RubricResult | null>(null);
  const [workFile, setWorkFile] = useState<File | null>(null); // tệp bài làm chờ nộp
  const [stepAns, setStepAns] = useState<Record<number, string>>({});
  // Bài làm CHỮ của từng bước (bước không phải Có/Không) — lỗi #11: trước đây
  // chỉ có MỘT ô gõ cho cả câu, đặt tận dưới khung đối thoại.
  const [stepText, setStepText] = useState<Record<number, string>>({}); // Có/Không từng bước của đề nhiều bước
  const [verdict, setVerdict] = useState<Verdict>(null);
  /** XP server vừa cộng ở lượt gần nhất — chip "+N XP" phải nói số THẬT, vì từ
   *  29/07 XP "đúng" chỉ phát ở lần thử đầu (bịt rò đoán mò). */
  const [lastGain, setLastGain] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [earned, setEarned] = useState(0);
  const [finished, setFinished] = useState<EndResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // CẦN ĐỒNG THUẬN (05/09): server trả 403 consent_required khi mở bài. Trước
  // đây rơi vào `error` → banner đỏ đầu trang với câu kỹ thuật "(consent)". Nay
  // là pop-up riêng có nút "Em đồng ý" gọi thẳng consent/assent rồi mở lại bài.
  const [canDongY, setCanDongY] = useState<null | { node?: PathNode; questionId?: string; wrongMode?: boolean; sauDongY?: boolean }>(null);
  // GÓP Ý TRONG APP (05/09): ctx ≠ null là đang mở phiếu; app tự điền bài/câu/lời sư tử.
  const [gopY, setGopY] = useState<GopYCtx | null>(null);
  // Hết phiên: banner riêng, đứng trên mọi thứ, có nút đăng nhập lại.
  const [expired, setExpired] = useState(false);
  /** Đang thử nối lại phiên (lỗi #26) — nút phải khoá, kẻo bấm dồn ba lần. */
  const [dangNoiLai, datDangNoiLai] = useState(false);
  /** BUỔI HỌC DỞ tìm thấy ở máy (xem lib/phien-do) — nuôi POP-UP "Học tiếp"
   *  khi mở lộ trình. null = không có gì để nối lại. */
  const [phienDo, setPhienDo] = useState<PhienDo | null>(null);
  /** Pop-up mời nối lại đang mở? Tách khỏi `phienDo` vì "Để sau" chỉ đóng lời
   *  mời, KHÔNG xoá gói — em đổi ý thì buổi dở vẫn còn đó. */
  const [moiNoiLai, setMoiNoiLai] = useState(false);
  /** Sheet xác nhận khi bấm X thoát bài (chủ dự án 04/09: CHỦ ĐỘNG thoát là bỏ
   *  buổi, phải làm lại; chỉ rớt mạng/lỗi mới được nối lại). */
  const [hoiThoat, setHoiThoat] = useState(false);
  /** Buổi này là BỘ ÔN SAI (mở từ tab Ôn tập) — thoát thì về đúng tab đó. */
  const cheDoOnSaiRef = useRef(false);
  /** Dòng nhắc dưới nút KIỂM TRA (nộp chưa đủ ý / vì sao nút còn mờ). */
  const [footNote, setFootNote] = useState<string | null>(null);
  /** `luuLuc` của gói đã bấm "Để sau" — cùng gói thì đừng mời lại mỗi lần em
   *  quay về lộ trình (mời dai là nài nỉ). Gói MỚI (học thêm rồi lại dở) thì
   *  `luuLuc` đổi → mời lại là đúng. */
  const boQuaLucRef = useRef<number | null>(null);
  useEffect(() => {
    if (phienDo && phienDo.luuLuc !== boQuaLucRef.current) setMoiNoiLai(true);
  }, [phienDo]);
  const boQuaNoiLai = useCallback(() => {
    boQuaLucRef.current = phienDo?.luuLuc ?? null;
    setMoiNoiLai(false);
  }, [phienDo]);

  /** Khung tin nhắn — để LĂN XUỐNG ĐÁY khi có lời mới. Từ 13/08 khung chat có
   *  chiều cao cố định và tự cuộn BÊN TRONG (xem `.lsn-chat .thread`), nên lời
   *  mới rơi xuống dưới mép khung: trước đây cả trang cuộn theo nên còn thấy,
   *  giờ không cuộn trang nữa thì phải tự lăn khung này. Chỉ đụng `scrollTop`
   *  của CHÍNH khung — không dùng `scrollIntoView` (nó kéo cả trang đi). */
  const threadRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [msgs, loading]);

  const [progress, setProgress] = useState<G.Progress>(G.load);
  const [bump, setBump] = useState(false);
  const [mastered, setMastered] = useState<string[]>([]);
  // ĐỔI GIÓ: bộ đếm xoay vòng câu chào + câu nhắc, đọc-và-tăng ĐÚNG MỘT LẦN mỗi
  // lần mở app. PHẢI qua hook (không phải `useState(nextRotation)`): bộ đếm nằm
  // ở localStorage nên đọc trong lần render đầu là lệch hydrate — xem lib/nudges.
  const rot = useRotation();

  // ── Engine áp cứng: câu TIÊM động (vá nền / leo ngược) ────────────────
  // Khi engine phát hiện học sinh kẹt, nó KHÔNG để loanh quẩn ở câu khó mà
  // kéo về nguyên tử nền còn hổng: câu nền đó được "tiêm" đè lên câu chính.
  // Stack cho phép vá lồng nhau (nền của nền). Trả lời đúng câu tiêm → engine
  // bảo `continue` (câu nền kế tiếp) hoặc `climb` (vá xong, leo về câu chính).
  const [injectedStack, setInjectedStack] = useState<DiagnoseQuestion[]>([]);
  const [remediateLabel, setRemediateLabel] = useState<string | null>(null);
  // Kế hoạch cho nút TIẾP TỤC sau khi trả lời ĐÚNG (đọc lúc bấm, không render).
  const advancePlanRef = useRef<
    { kind: "inject"; q: DiagnoseQuestion; label: string | null } | { kind: "popMain" } | null
  >(null);
  // Chống lặp vô hạn khi nền không thể mastered (thiếu câu DOK cao): quá số lần
  // vá liên tiếp thì thôi, quay về câu chính để không giam học sinh trong nền.
  const detourRepsRef = useRef(0);

  // ── MỘT TRANG (quyết định chủ dự án): 5 khu sống chung trong /learn ────
  // Bấm tab là đổi view TẠI CHỖ — không tải lại trang, không mất trạng thái.
  // #hash chỉ để deep-link/giữ chỗ khi reload, đổi bằng replaceState (không
  // đẩy history — nút Back của trình duyệt vẫn thoát app như mong đợi).
  // "settings" không có trên nav — vào từ bánh răng ở Hồ sơ (hi-fi 4d).
  const [view, setView] = useState<NavKey | "settings">("learn");
  // Kho báu học liệu đang mở (bấm dấu chân đặc biệt cạnh một bài).
  const [khoBau, setKhoBau] = useState<{ key: string; label: string } | null>(null);
  useEffect(() => {
    // Đọc hash lúc mount (deep-link) VÀ nghe hashchange (điều hướng chỉ-đổi-hash
    // không reload trang — assign/link #review từ nơi khác vẫn phải ăn).
    const apply = () => {
      const h = window.location.hash.slice(1);
      if (h === "review" || h === "scoreboard" || h === "quests" || h === "profile" || h === "settings")
        setView(h);
      // "learn" nhận luôn: tab Học vốn không mang hash, nhưng người ta VẪN gõ
      // /learn/#learn (chủ dự án gõ đúng dạng đó khi gửi link). Không nhận thì
      // URL đổi mà màn hình đứng im — đọc ra như app hỏng.
      else if (h === "" || h === "learn") setView("learn");
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);
  // pushState chứ KHÔNG replaceState (audit 04/09, 2 agent cùng bắt): đổi tab
  // mà history không dài ra thì Back của trình duyệt VĂNG KHỎI APP — học sinh
  // bấm Back theo phản xạ là mất chỗ. Đẩy một mục thì Back = về tab trước
  // (hashchange → `apply` ở trên đổi view), đúng kỳ vọng "Back là lùi một bước".
  // Bấm lại tab đang mở thì không đẩy gì (kẻo Back phải bấm hai lần).
  const switchView = useCallback((k: NavKey | "settings") => {
    setView((cur) => {
      if (cur !== k) history.pushState(null, "", k === "learn" ? window.location.pathname : `#${k}`);
      return k;
    });
  }, []);

  // Hướng chuyển tab (trái/phải theo thứ tự nav) — nuôi animation slide-fwd/back
  const VIEW_ORDER = ["learn", "review", "scoreboard", "quests", "profile", "settings"] as const;
  const prevViewRef = useRef<string>(view);
  const viewDir =
    VIEW_ORDER.indexOf(view as (typeof VIEW_ORDER)[number]) >=
    VIEW_ORDER.indexOf(prevViewRef.current as (typeof VIEW_ORDER)[number])
      ? "fwd"
      : "back";
  useEffect(() => {
    prevViewRef.current = view;
  }, [view]);

  // VUỐT NGANG đổi tab (native gesture) — chỉ ngoài bài học; bỏ qua cử chỉ
  // bắt đầu trên vùng tự cuộn ngang (dải stats, bảng…). passive: không chặn
  // cuộn dọc, zero jank.
  const sesActive = ses != null;
  useEffect(() => {
    if (sesActive) return;
    let x0 = 0;
    let y0 = 0;
    let t0 = 0;
    let eligible = false;
    const inHScroll = (el: EventTarget | null): boolean => {
      for (let n = el instanceof Element ? el : null; n && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (n.scrollWidth > n.clientWidth + 4 && /(auto|scroll)/.test(cs.overflowX)) return true;
      }
      return false;
    };
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]!;
      x0 = t.clientX;
      y0 = t.clientY;
      t0 = Date.now();
      // Sheet đang mở / slider: cử chỉ thuộc về chúng, không đổi tab ngầm
      eligible =
        !inHScroll(e.target) &&
        !(e.target instanceof Element && e.target.closest(".sheet-root, input[type=range]"));
    };
    const onEnd = (e: TouchEvent) => {
      if (!eligible) return;
      const t = e.changedTouches[0]!;
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      // Chỉ nhận vuốt ngang ƯU THẾ RÕ (dx ≥ 1.8×dy) — cuộn chéo không nhảy tab
      if (
        Date.now() - t0 > 600 ||
        Math.abs(dx) < 70 ||
        Math.abs(dy) > 32 ||
        Math.abs(dx) < Math.abs(dy) * 1.8
      )
        return;
      const order: (NavKey | "settings")[] = ["learn", "review", "scoreboard", "quests", "profile"];
      const cur = view === "settings" ? "profile" : view;
      const i = order.indexOf(cur);
      const ni = dx < 0 ? i + 1 : i - 1;
      if (ni >= 0 && ni < order.length) switchView(order[ni]!);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [sesActive, view, switchView]);

  // Lộ trình do server dựng (learning-path). null = chưa có / lỗi → fallback
  // dựng từ localStorage, nhìn y hệt như trước khi có endpoint.
  const [serverPath, setServerPath] = useState<PathNode[] | null>(null);
  // Lộ trình TĨNH từ bundle KG (public/kg/path-*.json — sinh bởi
  // `pnpm --filter @tutor/db export:path`): fallback khi learning-path chưa
  // deploy. Là giáo trình THẬT đúng thứ tự chương; node chưa tới lượt hiện
  // "locked" (không bấm được) — trung thực, không nút chết. serverPath thắng.
  const [staticPath, setStaticPath] = useState<
    { key: string; label: string; chapter: string }[] | null
  >(null);
  // Lần MỞ APP đầu tiên: giữ màn intro (Splash) tới khi lộ trình server tới
  // (hoặc hết giờ chờ) rồi mới lộ path — che luôn cú tráo static→server, không
  // còn nhấp nháy. Chỉ chặn lần đầu; các lần đồng bộ sau (pathVersion) im lặng.
  const [firstReady, setFirstReady] = useState(false);
  const [pathVersion, setPathVersion] = useState(0); // tăng sau mỗi buổi học để nạp lại

  // ── Dữ liệu phụ cho hi-fi ─────────────────────────────────────────────
  // Nhãn phiên bản KG (tên chương thật) cho banner chương; null → tên môn.
  const [pathLabel, setPathLabel] = useState<string | null>(null);
  // Bảng tuần mini ở cột phải desktop. Lỗi / chưa đăng nhập / function chưa
  // deploy → giữ null → thẻ tự ẨN, không hiện lỗi.
  const [board, setBoard] = useState<Scoreboard | null>(null);
  // Thời gian buổi học đo ở MÁY (Date.now) — CHỈ để khoe "Phút" ở màn hoàn
  // thành, thuần thẩm mỹ. KHÔNG dùng cho bất cứ thứ gì được xếp hạng/khen
  // thưởng: số liệu học tập THẬT (thời lượng, số câu, độ chính xác) do server
  // suy từ `attempts.created_at`. Đồng hồ máy có thể lệch/bị tạm dừng — không
  // đáng tin để so kè.
  const startedAtRef = useRef<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState<number | null>(null);
  // Nhắc-nghỉ 25' (G14 cũ) ĐÃ BỎ (chủ dự án 19/08): "em chăm quá, nghỉ đi" treo
  // giữa lúc đang học là gây nhiễu. Thay bằng đồng hồ VẮNG MẶT — đo im lặng
  // tuyệt đối chứ không đo giờ học, nên em cày lâu bao nhiêu cũng không bị nhắc:
  //  · 30' không một cú bấm/gõ/cuộn nào → hỏi "Bạn còn ở đó không?"
  //  · 120' → coi như đã rời máy: tự thoát về lộ trình. Điểm KHÔNG mất —
  //    XP/attempts do server ghi sống từng lượt (chat-turn), thoát kiểu này đi
  //    đúng đường "thoát giữa chừng" (backToPath) như em tự bấm X.
  // Mốc theo TƯƠNG TÁC nên câu khó đang ngồi nghĩ-và-nháp vẫn an toàn: còn
  // người là còn chạm máy; 2 tiếng không chạm gì thì không phải đang làm bài.
  const lastActRef = useRef<number>(Date.now());
  const [idleAsk, setIdleAsk] = useState(false);
  useEffect(() => {
    if (!ses || finished) return;
    lastActRef.current = Date.now();
    const touch = () => {
      lastActRef.current = Date.now();
      setIdleAsk(false);
    };
    const evs = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
    evs.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const ASK_AT_MS = 30 * 60 * 1000;
    const OUT_AT_MS = 120 * 60 * 1000;
    const id = setInterval(() => {
      const idle = Date.now() - lastActRef.current;
      if (idle >= OUT_AT_MS) {
        setIdleAsk(false);
        backToPath();
      } else if (idle >= ASK_AT_MS) {
        setIdleAsk(true);
      }
    }, 60_000);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(id);
    };
  }, [ses, finished]);
  // Câu đã từng trả lời sai trong buổi → đếm "chính xác x/y" + link ôn lại.
  const wrongRef = useRef<Set<string>>(new Set());

  // ── BUỔI HỌC DỞ — giữ ở máy để văng rồi còn nhặt lại (nợ 14/08) ──────────
  // Trước bản vá này, cả buổi học chỉ sống trong state React: hết phiên, tải
  // lại trang, hay iOS thu hồi tab là em rơi về lộ trình và làm lại từ câu 1.
  // Em gõ chữ thì `luuNhap` còn giữ được bài; em làm TRẮC NGHIỆM thì chẳng giữ
  // được gì — mà đó là phần lớn ngân hàng câu hỏi. Chi tiết ở lib/phien-do.
  const uid = session?.user?.id;
  /** Gói đã dựng nhưng CHƯA kịp ghi (đang trong nhịp hoãn) — giữ ở ref để xả
   *  được lúc rời trang. */
  const goiChoGhiRef = useRef<PhienDo | null>(null);
  useEffect(() => {
    if (!PHIEN_DO_ENABLED || !uid) return;
    // KHÔNG ghi đè khi không có buổi / buổi đã đóng. Việc XOÁ do đúng đường kết
    // thúc buổi lo (`next`), không phải effect này: ses null một nhịp giữa hai
    // lần commit mà gói bay mất thì hỏng đúng lúc cần nó nhất.
    if (!ses || finished) return;
    const goi = dongGoi({
      subject,
      ses,
      qi,
      earned,
      sai: [...wrongRef.current],
      tiem: injectedStack,
      nhanTiem: remediateLabel,
      loi: msgs,
      batDauLuc: startedAtRef.current,
      now: Date.now(),
    });
    goiChoGhiRef.current = goi;
    // HOÃN 400ms. Lời sư tử phát theo TỪNG MẨU CHỮ, mỗi mẩu là một `setMsgs`:
    // ghi thẳng ở đây là hàng trăm lượt `localStorage.setItem` (lệnh ĐỒNG BỘ,
    // chặn luồng chính) trong đúng lúc chữ đang chạy trên màn hình em. Hoãn thì
    // cả tràng chỉ tốn MỘT lần ghi, mà cửa sổ mất mát chỉ là 400ms cuối.
    const t = window.setTimeout(() => {
      luuPhienDo(uid, goi);
      goiChoGhiRef.current = null;
    }, 400);
    return () => window.clearTimeout(t);
    // `wrongRef` là ref nên không tự kích hoạt effect — nhưng mỗi lần trả lời
    // sai đều kèm một lời mới vào `msgs`, nên nó vẫn được ghi cùng nhịp.
  }, [uid, ses, qi, earned, msgs, injectedStack, remediateLabel, finished, subject]);

  /** Ghi NGAY phần đang treo. Gọi trước mọi lúc sắp mất quyền chạy, và trước
   *  khi ĐỌC lại gói (đọc mà chưa xả thì thấy bản cũ hơn 400ms — hoặc không
   *  thấy gì, nếu buổi vừa mở chưa kịp ghi lần đầu). */
  const xaGoiChoGhi = useCallback(() => {
    const g = goiChoGhiRef.current;
    if (!g || !uid) return;
    goiChoGhiRef.current = null;
    luuPhienDo(uid, g);
  }, [uid]);

  // XẢ NỐT trước khi mất quyền chạy. `visibilitychange`→hidden là tín hiệu duy
  // nhất còn đáng tin trên iOS (nó giết tab nền không báo trước, `beforeunload`
  // thường không bao giờ nổ) — mà tab bị giết giữa buổi chính là ca ta đang cứu.
  useEffect(() => {
    const khiAn = () => {
      if (document.visibilityState === "hidden") xaGoiChoGhi();
    };
    document.addEventListener("visibilitychange", khiAn);
    window.addEventListener("pagehide", xaGoiChoGhi);
    return () => {
      document.removeEventListener("visibilitychange", khiAn);
      window.removeEventListener("pagehide", xaGoiChoGhi);
      xaGoiChoGhi();
    };
  }, [xaGoiChoGhi]);

  // Mở app: có buổi dở còn hạn → lộ trình mời "Học tiếp". CỐ Ý không tự nhảy
  // vào bài: mở app lên mà bị ném thẳng vào một câu hỏi là mất phương hướng,
  // nhất là khi em vừa bị văng và chưa hiểu chuyện gì xảy ra. Để em bấm.
  useEffect(() => {
    setPhienDo(PHIEN_DO_ENABLED && uid ? docPhienDo(uid) : null);
  }, [uid]);

  useEffect(() => {
    setProgress(G.load());
    setMastered(G.loadMastered());
    // Tuỳ chọn Cài đặt (cỡ chữ, giảm chuyển động) — bootstrap ở layout đã áp
    // trước khi vẽ; gọi lại đề phòng script bị chặn (CSP/ẩn danh).
    Prefs.applyToHtml();
    // Hâm nóng các function sẽ dùng NGAY sau đây (lỗi 12): học sinh đang xem
    // lộ trình thì chat-turn/resources/end-session còn ngủ — cú gọi đầu mất
    // ~1,7s dựng isolate, rơi đúng vào lần trả lời đầu tiên của em.
    warmUpFunctions(["chat-turn", "resources", "end-session"]);
  }, []);

  // Chốt chặn intro: LẦN ĐẦU và MỖI LẦN ĐỔI MÔN, nếu learning-path treo/mạng
  // chậm thì vẫn gỡ intro sau 1.4s (hiện path TĨNH) — không kẹt màn chờ. Đổi
  // môn: onPick đã setFirstReady(false) → intro che nhịp nạp fallback→tĩnh→
  // server (world nền + banner) tới khi lộ trình môn mới settle, hết giật.
  useEffect(() => {
    const t = setTimeout(() => setFirstReady(true), 1400);
    return () => clearTimeout(t);
  }, [subject]);

  // ── Lộ trình từ server (KG v2.2) ──────────────────────────────────────
  // Function `learning-path` có thể CHƯA deploy. Mọi lỗi — mạng, 404, dữ liệu
  // sai dạng — đều rơi về null, không hiện lỗi: app phải chạy như cũ.
  // (`uid` khai báo ở khối "buổi học dở" phía trên — PHẢI đứng trước mọi effect
  //  dùng nó trong mảng deps, kẻo chạm vùng chết TDZ ngay lúc render.)

  // ── HỌC CÙNG NHAU (presence) ──────────────────────────────────────────────
  // Đọc lại opt-in mỗi lần đổi view (bật/tắt ở Cài đặt xong quay lại thấy ngay).
  useEffect(() => {
    setPresenceOn(Prefs.getPresenceOptIn());
  }, [view]);
  // Chỉ track/hiển thị khi Ở MÀN HỌC (không trong bài, không tab khác) + đã opt-in.
  const peers = usePresence({
    enabled: presenceOn && view === "learn" && !ses,
    tenantId: profile?.tenant_id,
    grade: profile?.grade,
    subject,
    self: {
      id: uid ?? "",
      name: Prefs.displayNameOf(profile?.full_name)?.split(/\s+/).pop() ?? "Bạn",
      tone: Prefs.getAvatar().tone,
    },
    leg: 0,
  });

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    setServerPath(null); // đổi môn thì không giữ lộ trình của môn cũ
    setPathLabel(null);
    learningPath(subject)
      .then((r) => {
        if (!alive) return;
        if (!r || !Array.isArray(r.nodes)) throw new Error("learning-path: sai dạng");
        // Tên chương thật cho banner — không bao giờ hiện id thô cho học sinh.
        if (typeof r.version_label === "string" && r.version_label.trim()) {
          setPathLabel(r.version_label.trim());
        }
        // "redo" PHẢI nằm trong danh sách hợp lệ — thiếu nó thì node bị giáo
        // viên trả về BIẾN MẤT khỏi lộ trình thay vì hiện bàn chân đỏ.
        const VALID = new Set<PathNode["state"]>(["mastered", "stale", "current", "available", "locked", "redo"]);
        const nodes: PathNode[] = r.nodes
          .filter((n) => n && typeof n.key === "string" && VALID.has(n.state))
          .map((n) => ({
            key: n.key,
            // Dùng label server, không bao giờ hiện key thô cho học sinh.
            label: typeof n.label === "string" && n.label ? n.label : n.key,
            state: n.state,
            blockedBy: Array.isArray(n.blockedBy)
              ? n.blockedBy.filter((b): b is string => typeof b === "string")
              : undefined,
            // Chương → LearningPath gom thành CHẶNG (điểm dừng khi cuộn).
            chapter: typeof n.chapter === "string" ? n.chapter : undefined,
            // Tiến trình dang dở (0..1) + số bài chờ thầy cô chấm — để lộ trình
            // NÓI được "em đã đi 75% bài này" thay vì đứng im như chưa học.
            progress: typeof n.progress === "number" ? n.progress : undefined,
            // doneCount/totalCount là thứ HIỆN RA trên bàn chân ("3/8"). Thiếu
            // hai dòng này thì huy hiệu luôn đọc là 0/0 dù server trả đúng số.
            doneCount: typeof n.doneCount === "number" ? n.doneCount : undefined,
            totalCount: typeof n.totalCount === "number" ? n.totalCount : undefined,
            pending: typeof n.pending === "number" && n.pending > 0 ? n.pending : undefined,
            // Câu bị trả + lời nhắn giáo viên — nguồn của thẻ đỏ BẤM ĐƯỢC.
            redo: Array.isArray(n.redo)
              ? n.redo.filter((r) => r && typeof r.questionId === "string")
              : undefined,
            // Kho báu học liệu cạnh bài — chỉ nhận khi server nói rõ có mức nào.
            khoBau:
              n.khoBau && Array.isArray(n.khoBau.mucCoSan) && n.khoBau.mucCoSan.length > 0
                ? { mucCoSan: n.khoBau.mucCoSan, mucDaQua: Number(n.khoBau.mucDaQua) || 0 }
                : undefined,
          }));
        // Có node nhưng không node nào hợp lệ → coi như hỏng, về fallback.
        if (nodes.length === 0 && r.nodes.length > 0) throw new Error("learning-path: node không hợp lệ");
        // Server trả RỖNG (vd môn chưa nạp vào DB như Ngữ văn) → giữ null để
        // `serverPath ?? staticPath` rơi về lộ trình TĨNH, không che mất giáo trình.
        setServerPath(nodes.length > 0 ? nodes : null);
      })
      .catch(() => {
        if (alive) setServerPath(null);
      })
      .finally(() => {
        if (alive) setFirstReady(true); // lộ trình đã tới → gỡ màn intro
      });
    return () => {
      alive = false;
    };
  }, [subject, uid, pathVersion]);

  // Nạp lộ trình tĩnh theo môn — file nằm trong public/, lỗi thì im lặng
  // (fallback cũ 1 node vẫn chạy, không được phép làm màn Học kém đi).
  useEffect(() => {
    let alive = true;
    setStaticPath(null);
    const slug = SUBJECTS.find((s) => s.key === subject)?.slug ?? "toan";
    fetch(`/kg/path-${slug}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && Array.isArray(d.nodes) && d.nodes.length > 0) setStaticPath(d.nodes);
      })
      .catch(() => {
        /* thiếu file tĩnh — chấp nhận */
      });
    return () => {
      alive = false;
    };
  }, [subject]);

  // ── Bảng tuần mini (cột phải desktop) ─────────────────────────────────
  // Dùng lại endpoint của Scoreboard.tsx. Mọi lỗi đều im lặng: cột phải là
  // phần "thêm nếm", không được phép làm màn Học kém đi.
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    getScoreboard()
      .then((d) => {
        if (!alive) return;
        setBoard(d);
        // XP server có sẵn trong scoreboard → đồng bộ cache máy ngay khi mở app
        // (đổi máy vẫn thấy đúng số, không chờ tới lượt trả lời đầu tiên).
        if (d.xp) setProgress(G.syncFromServer(d.xp));
      })
      .catch(() => {
        /* chưa deploy / không phải học sinh → ẩn thẻ */
      });
    return () => {
      alive = false;
    };
  }, [uid]);

  const grant = useCallback((amount: number) => {
    setEarned((e) => e + amount);
    setProgress((p) => {
      const next = G.addXp(p, amount);
      G.save(next);
      return next;
    });
  }, []);

  // Câu ĐANG hỏi = câu tiêm (nếu đang vá nền) đè lên câu chính của luồng.
  const injectedQ = injectedStack.length > 0 ? injectedStack[injectedStack.length - 1]! : null;
  const q: DiagnoseQuestion | undefined = injectedQ ?? ses?.questions[qi];
  const active = SUBJECTS.find((s) => s.key === subject)!;

  // NẠP LẠI BÀI GÕ DỞ của câu này (lỗi #26). Chạy khi mở câu; nếu không có nháp
  // thì KHÔNG đụng vào `text` — các đường reset đã lo phần làm sạch, ghi đè ở
  // đây sẽ xoá mất phần em vừa gõ ngay trong cùng một câu.
  const idCauDaNap = useRef<string | null>(null);
  useEffect(() => {
    const id = q?.id;
    if (!id || idCauDaNap.current === id) return;
    idCauDaNap.current = id;
    const uid = session?.user.id;
    if (!uid) return;
    const nhap = docNhap(uid, id);
    if (nhap) setText(nhap);
  }, [q?.id, session?.user.id]);

  // Node đang học — còn dùng để chọn BẦU TRỜI cho sân khấu bài (worldOfLesson).
  const currentNodeKey = ses ? (q?.nodeKey ?? ses.node ?? null) : null;
  // Học liệu KHÔNG còn nạp ở màn làm bài (chủ dự án chốt 10/08): nó sống ở Kho
  // báu. Cú gọi `nodeResources` mỗi lần đổi câu đã gỡ theo — giữ lại là một
  // lượt đi-về mạng mỗi câu để lấy thứ không còn chỗ nào hiển thị.

  function resetQuestion() {
    setMsgs([]);
    setText("");
    setPicked(null);
    setDaTraLoi(null);
    setInteractiveAns(null);
    setRubricResult(null);
    setWorkFile(null);
    setStepAns({});
    setStepText({});
    setVerdict(null);
    setAttempts(0);
    setFootNote(null);
  }

  /** `node`: bài học sinh vừa bấm trên lộ trình. PHẢI gửi lên server — thiếu nó
   *  thì diagnose rơi về chế độ chẩn đoán và trả 20 câu đầu của CẢ MÔN (rải trên
   *  19 bài khác nhau), tức bấm bài nào cũng ra cùng một rổ. */
  async function start(node?: PathNode, questionId?: string, wrongMode?: boolean) {
    if (busy) return; // double-tap: tap 2 tới trước khi disabled kịp commit
    // Môn XEM TRƯỚC (chưa live): lộ trình hiện đầy đủ nhưng chưa có ngân hàng
    // câu hỏi → KHÔNG gọi diagnose (tránh buổi học rỗng). Lời sư tử đã báo.
    if (!active.live) return;
    setError(null);
    setBusy(true);
    try {
      // BỘ ÔN SAI (chốt 03/09): gom câu từng sai của CẢ MÔN, không phải một node.
      const d = wrongMode ? await diagnoseWrong(subject) : await diagnose(subject, node?.key, questionId);
      // Bài chưa có câu hỏi (đang cắm nội dung) → KHÔNG vào buổi rỗng/kẹt; giữ học
      // sinh ở lộ trình + báo nhẹ nhàng.
      if (!d.questions || d.questions.length === 0) {
        setError(
          wrongMode
            ? "Chưa có câu nào cần ôn — bạn đang làm tốt lắm, cứ tiếp tục nhé!"
            : "Bài này chưa có câu hỏi — nhà trường đang bổ sung nội dung. Bạn chọn bài khác nhé!",
        );
        setBusy(false);
        return;
      }
      setSes(d);
      setCanDongY(null); // vào được bài = đồng thuận đã đủ, pop-up hết lý do tồn tại
      cheDoOnSaiRef.current = !!wrongMode;
      setQi(0);
      setEarned(0);
      setInjectedStack([]);
      setRemediateLabel(null);
      advancePlanRef.current = null;
      detourRepsRef.current = 0;
      resetQuestion();
      // Buổi mới thay chỗ buổi dở cũ: thẻ "Học tiếp" phải tắt NGAY, và effect
      // lưu ở trên sẽ ghi đè gói bằng buổi này. Em bấm một bài khác thay vì
      // nhận lời mời — đó cũng là một cách trả lời, tôn trọng nó.
      setPhienDo(null);
      // Mốc đo thật cho màn hoàn thành: thời gian buổi + những câu từng sai.
      startedAtRef.current = Date.now();
      setElapsedSec(null);
      lastActRef.current = Date.now();
      setIdleAsk(false);
      wrongRef.current = new Set();

      const { next, streakGrew } = G.recordStudyDay(G.load());
      G.save(next);
      setProgress(next);
      if (streakGrew) {
        setBump(true);
        window.setTimeout(() => setBump(false), 700);
      }
    } catch (e) {
      if (isExpired(e)) setExpired(true);
      else if (e instanceof ApiError && e.code === "consent_required") {
        // Giữ lại đúng bài đang mở để sau khi đồng ý thì vào thẳng, không bắt bấm lại.
        setCanDongY((c) => ({ node, questionId, wrongMode, sauDongY: c?.sauDongY }));
      } else setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  /** "Em đồng ý" trong pop-up đồng thuận → ghi assent rồi mở lại đúng bài. */
  async function dongYRoiHoc() {
    const c = canDongY;
    if (!c || busy) return;
    setBusy(true);
    try {
      await giveAssent();
    } catch (e) {
      setBusy(false);
      if (isExpired(e)) setExpired(true); else setError(errText(e));
      return;
    }
    setBusy(false);
    // Đánh dấu đã ưng thuận: nếu server VẪN chặn (còn chờ bố/mẹ) thì pop-up
    // đổi lời — không lặp lại nút "Em đồng ý" vô nghĩa.
    setCanDongY({ ...c, sauDongY: true });
    // start() thành công thì tự đóng pop-up (setCanDongY(null) sau setSes);
    // còn bị chặn thì catch ở start() giữ pop-up với sauDongY=true → đổi lời.
    await start(c.node, c.questionId, c.wrongMode);
  }

  /**
   * NỐI LẠI BUỔI DỞ — dựng lại buổi học từ gói ở máy, KHÔNG gọi `diagnose`.
   *
   * Không gọi diagnose là chủ ý: mở buổi mới sẽ bỏ hoang hàng `learning_sessions`
   * cũ (không bao giờ được đóng, mastery của nó không bao giờ được tính lại) và
   * cắt buổi của em làm đôi trong dữ liệu. Giữ nguyên `sessionId` thì mọi bằng
   * chứng vẫn thuộc một buổi, và câu em thấy y hệt câu em đang làm dở.
   *
   * Làm lại đúng câu vừa làm không đẻ ra bằng chứng/XP thứ hai — server chốt
   * bằng UNIQUE(session_id, question_id) và đếm số lần thử từ bảng `attempts`,
   * không tin `attempts` của client (nên đặt lại về 0 ở đây là vô hại).
   */
  function hocTiep() {
    const p = phienDo;
    if (!p || busy) return;
    setMoiNoiLai(false);
    setError(null);
    setFinished(null);
    if (p.subject !== subject && SUBJECTS.some((s) => s.key === p.subject)) {
      setSubject(p.subject as Subject);
    }
    setSes(p.ses);
    setQi(p.qi);
    setEarned(p.earned);
    setInjectedStack(p.tiem);
    setRemediateLabel(p.nhanTiem);
    advancePlanRef.current = null;
    detourRepsRef.current = 0;
    // Reset MỀM: làm sạch ô trả lời + kết quả, nhưng GIỮ mạch hội thoại — bản
    // đồ để em nhớ mình đang nói tới đâu với sư tử. (`resetQuestion` xoá msgs.)
    softResetForNewQuestion();
    setMsgs(p.loi.filter((m): m is Msg => VAI_LOI.includes(m.role)));
    wrongRef.current = new Set(p.sai);
    // Đồng hồ buổi học LÙI LẠI đúng phần đã học, không tính quãng em offline:
    // nối lại sau một đêm mà màn hoàn thành khoe "9 tiếng 12 phút" thì con số
    // đó thành trò cười.
    startedAtRef.current = Date.now() - p.daHocMs;
    setElapsedSec(null);
    lastActRef.current = Date.now();
    setIdleAsk(false);
    setPhienDo(null);
    const { next: tienDo, streakGrew } = G.recordStudyDay(G.load());
    G.save(tienDo);
    setProgress(tienDo);
    if (streakGrew) {
      setBump(true);
      window.setTimeout(() => setBump(false), 700);
    }
  }

  // Engine trả EngineQuestion (tier có thể null) → DiagnoseQuestion cho UI.
  const adaptEngineQ = (eq: NonNullable<TurnResult["remediate"]>["question"]): DiagnoseQuestion => ({
    id: eq.id,
    nodeKey: eq.nodeKey,
    tier: eq.tier ?? 1,
    dok: eq.dok,
    doKho: eq.doKho,
    kind: "objective",
    prompt: eq.prompt,
    options: eq.options,
    dangCauHoi: eq.dangCauHoi ?? null,
    interactive: eq.interactive,
  });

  // Reset trạng thái câu KHI CHUYỂN sang câu tiêm/leo — GIỮ lại msgs (hành trình
  // vá nền là câu chuyện liền mạch), chỉ làm mới ô trả lời + kết quả + đếm lần.
  function softResetForNewQuestion() {
    setVerdict(null);
    setPicked(null);
    setDaTraLoi(null);
    setText("");
    setInteractiveAns(null);
    setRubricResult(null);
    setWorkFile(null);
    setStepAns({});
    setStepText({});
    setAttempts(0);
  }

  function applyTurn(
    res: TurnResult,
    attemptNo: number,
    wasInjected: boolean,
    /** Lời sư tử đã được PHÁT DẦN ra màn hình rồi — đừng dựng thêm bong bóng. */
    messageShown = false,
  ) {
    // Dạng trả lời bằng thao tác → im lặng, không dựng bong bóng đối thoại.
    const quiet = isWidgetAnswer(q);

    // CỔNG Ý ĐỊNH (29/07): lượt KHÔNG được chấm (xin gợi ý / bài rác) — hiện lời
    // dẫn của sư tử như một gợi ý, TUYỆT ĐỐI không hiện trạng thái "sai", không
    // đổi verdict, không tính lần thử (attempts đã hoàn lại ở nơi gọi).
    if (res.graded === false) {
      if (res.message && !messageShown) setMsgs((m) => [...m, { role: "hint", text: res.message! }]);
      // Lời nhắc đứng NGAY dưới nút vừa bấm (audit 04/09: thanh dưới im lìm,
      // phản hồi chỉ nằm trong khung chat bên phải).
      setFootNote(res.message ?? "Câu này cần bạn viết lập luận đầy đủ hơn — bổ sung rồi bấm Kiểm tra lại nhé.");
      return;
    }

    if (res.message && !quiet && !messageShown) {
      setMsgs((m) => [...m, { role: "tutor", text: res.message! }]);
    }

    // XP SERVER-AUTHORITATIVE: engine trả res.xp (student_xp) → số server thắng,
    // cache máy chỉ chép lại. gained=0 nghĩa là nguồn XP này đã ăn trước đó
    // (chống farm ở DB) — không cộng ảo phía máy. Thiếu res.xp (function cũ)
    // mới rơi về grant() như trước.
    const serverXp = res.xp;
    if (serverXp) {
      if (serverXp.gained > 0) setEarned((e) => e + serverXp.gained);
      setLastGain(serverXp.gained);
      setProgress(G.syncFromServer(serverXp));
    } else {
      // Function cũ chưa trả xp → ước lượng theo luật hiện hành để chip không câm.
      setLastGain(res.correct && attemptNo === 1 ? G.XP.correct : attemptNo >= 2 ? G.XP.persistence : 0);
    }

    if (res.correct) {
      setVerdict("ok");
      if (q && session?.user.id) xoaNhap(session.user.id, q.id); // xong câu → không còn nháp để giữ (lỗi #26)
      // Đúng ở lần thứ nhất hay lần thứ tư đều cộng như nhau — không phạt số lần thử.
      if (!serverXp) grant(G.XP.correct);
      // Quyết định nút TIẾP TỤC sẽ đưa đi đâu. CHỈ xử lý climb/continue KHI đang
      // vá nền (câu tiêm) — luồng chính luôn đi next() dù engine có kèm climb hay
      // không (phòng thủ với mọi phiên bản engine, tránh kẹt lại câu chính).
      if (wasInjected && res.climb) {
        // Vá xong nền → về luồng chính (câu đang kẹt) để thử lại với nền vững.
        advancePlanRef.current = { kind: "popMain" };
      } else if (wasInjected && res.continue && detourRepsRef.current < 5) {
        // Nền chưa vững → câu nền kế tiếp (đếm để không vá vô tận).
        detourRepsRef.current += 1;
        advancePlanRef.current = { kind: "inject", q: adaptEngineQ(res.continue.question), label: remediateLabel };
      } else if (wasInjected) {
        // Đúng câu tiêm nhưng engine không cho vá tiếp / đã chạm trần → về luồng chính.
        advancePlanRef.current = { kind: "popMain" };
      } else {
        advancePlanRef.current = null; // luồng chính bình thường → next()
      }
      return;
    }

    // Sai + engine lan truyền ngược → TIÊM câu nền, chuyển sang câu mới (không "thử lại").
    if (res.gate === "remediate" && res.remediate) {
      detourRepsRef.current = 0;
      setRemediateLabel(res.remediate.label);
      setInjectedStack((s) => [...s, adaptEngineQ(res.remediate!.question)]);
      softResetForNewQuestion();
      return;
    }

    setVerdict("retry");
    // Thưởng cho việc thử lại: từ lần thứ hai trở đi, mỗi lần thử được cộng XP nỗ lực.
    if (!serverXp && attemptNo >= 2) grant(G.XP.persistence);
    // res.message đã đẩy vào thread ở trên; đổi nhãn vai để bong bóng đúng kiểu.
    if (res.message && !quiet) {
      setMsgs((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: res.gate === "require_attempt" ? "gate" : "hint",
          text: res.message!,
        };
        return copy;
      });
    }
  }

  // Nút TIẾP TỤC sau khi ĐÚNG: theo kế hoạch engine (vá tiếp / leo về / tiếp bài).
  function advance() {
    const plan = advancePlanRef.current;
    advancePlanRef.current = null;
    if (plan?.kind === "inject") {
      setRemediateLabel(plan.label ?? null);
      // Thay câu tiêm hiện tại bằng câu nền kế tiếp (đang đứng trên một câu tiêm).
      setInjectedStack((s) => [...s.slice(0, -1), plan.q]);
      softResetForNewQuestion();
      return;
    }
    if (plan?.kind === "popMain") {
      // Về luồng chính: bỏ hết câu tiêm, xoá băng-rôn vá nền, thử lại câu đang dở.
      detourRepsRef.current = 0;
      setInjectedStack([]);
      setRemediateLabel(null);
      softResetForNewQuestion();
      return;
    }
    void next();
  }

  async function submitObjective(ans: string) {
    if (!ses || !q || busy || verdict === "ok" || !ans) return;
    const attemptNo = attempts + 1;
    setAttempts(attemptNo);
    setPicked(ans);
    // Đề nhiều bước: phần KẾT LUẬN em gõ phải còn nguyên khi thử lại (các nút
    // Có/Không cũng giữ nguyên) — xoá đi là bắt em gõ lại cả đoạn từ đầu.
    if (!stepParsed) setText("");
    // Widget đã hiện rõ lựa chọn → không nhại lại chuỗi máy thành bong bóng.
    if (!isWidgetAnswer(q)) setMsgs((m) => [...m, { role: "student", text: ans }]);
    setBusy(true);
    setLoading(true);
    try {
      const wasInjected = injectedStack.length > 0;
      // PHÁT CHỮ DẦN — chỉ nhánh "mời em nói rõ thêm" mới có chữ để phát; mọi
      // kết cục khác server trả JSON ngay và hàm gọi đọc thẳng phong bì đó.
      // Dạng trả lời bằng THAO TÁC (kéo thả, nối cột) vốn không dựng bong bóng
      // đối thoại, nên cũng không mở dòng phát — không thì chữ đáng lẽ ẩn lại
      // hiện ra, ngược hẳn thiết kế hiện thời.
      const quiet = isWidgetAnswer(q);
      let streamed = false;
      let streamRole: "tutor" | "hint" = "tutor";
      const res = await answer(ses.sessionId, q.id, ans, wasInjected, quiet ? undefined : {
        // Phong bì tới TRƯỚC mẩu chữ đầu: lượt "không được chấm" hiện dạng GỢI Ý
        // (không đỏ, không tính sai), lượt được chấm hiện dạng lời sư tử.
        onMeta: (m) => { streamRole = m.graded === false ? "hint" : "tutor"; },
        onDelta: (chunk) => {
          setMsgs((m) => {
            if (!streamed) return [...m, { role: streamRole, text: chunk }];
            const last = m[m.length - 1];
            if (!last || last.role !== streamRole) return [...m, { role: streamRole, text: chunk }];
            return [...m.slice(0, -1), { ...last, text: last.text + chunk }];
          });
          streamed = true;
          setLoading(false); // chữ đã chạy = sư tử đang nói, tắt vòng quay chờ
        },
      });
      // Lượt không được chấm (cổng ý định) → hoàn lại bộ đếm lần thử của UI.
      if (res.graded === false) setAttempts((n) => Math.max(0, n - 1));
      // Đã bơm chữ ra rồi thì ĐÈ bằng câu chốt của server (bản thật) và bảo
      // applyTurn đừng dựng thêm một bong bóng thứ hai y hệt.
      if (streamed) {
        setMsgs((m) => {
          const last = m[m.length - 1];
          if (last && last.role === streamRole && res.message) {
            return [...m.slice(0, -1), { ...last, text: res.message }];
          }
          return m;
        });
      }
      applyTurn(res, attemptNo, wasInjected, streamed);
      // Ghi nhớ câu từng sai — nguồn số liệu "chính xác x/y" và "xem lại câu sai".
      if (!res.correct && res.graded !== false) wrongRef.current.add(q.id);
    } catch (e) {
      { if (isExpired(e)) setExpired(true); else setError(errText(e)); }
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }

  /** Nộp bài tự luận dài. Từ 01/08 AI chấm HẲN: đạt là mastery + XP ghi ngay,
   *  chưa đạt thì nói thiếu ý gì rồi mời nộp lại. Bài gõ của em hiện thành bong
   *  bóng trong khung đối thoại (lỗi 15 — trước đây lời em gửi biến mất, chỉ
   *  thấy sư tử nói một mình). */
  async function submitWorkFile() {
    if (!ses || !q || busy || (!text.trim() && !workFile)) return;
    setBusy(true);
    setLoading(true);
    try {
      const path = workFile ? await uploadWork(workFile) : undefined;
      // Bong bóng của EM đứng trước phản hồi — đối thoại phải có hai phía.
      const shown = text.trim() || (workFile ? `[Đã đính kèm: ${workFile.name}]` : "");
      if (shown) setMsgs((m) => [...m, { role: "student", text: shown }]);
      // KHÔNG gửi attemptNo: server tự đếm từ bảng attempts. Đếm ở client thì
      // rớt mạng giữa chừng cũng cộng, mà vào lại bài hôm sau là về 0.
      const res = await submitWork(ses.sessionId, q.id, {
        ...(text.trim() ? { text: text.trim() } : {}),
        ...(path ? { filePath: path, mime: workFile!.type, size: workFile!.size } : {}),
      });
      if (res.submitted === false) {
        // Cổng ý định chặn (bài rác / lời xin gợi ý) — bài chưa được nhận,
        // giữ nguyên ô nhập, KHÔNG đổi trạng thái.
        if (res.feedback) setMsgs((m) => [...m, { role: "hint", text: res.feedback! }]);
        return;
      }
      setAttempts((n) => n + 1);
      if (res.dat === false) {
        // Chưa đạt → giữ nguyên bài gõ cho em bổ sung rồi NỘP LẠI.
        wrongRef.current.add(q.id);
        if (res.feedback) setMsgs((m) => [...m, { role: "hint", text: res.feedback! }]);
        setVerdict("retry");
        return;
      }
      // `dat == null` = server GIỮ bài nhưng chưa chấm được (LLM hỏng / hết
      // ngân sách token). KHÔNG được vẽ ra như đã xong: giữ ô nhập, mời thử
      // lại. Đây là chỗ dễ nói dối nhất trong cả màn này.
      if (res.dat == null) {
        if (res.feedback) setMsgs((m) => [...m, { role: "hint", text: res.feedback! }]);
        return;
      }
      // XP server-authoritative, cùng đường với nhánh trắc nghiệm: số của server
      // thắng, máy chỉ chép lại. Trước 01/08 nhánh này không có XP nào để chép
      // vì bài nộp không được tính điểm.
      if (res.xp) {
        if (res.xp.gained > 0) setEarned((e) => e + res.xp!.gained);
        setLastGain(res.xp.gained);
        setProgress(G.syncFromServer(res.xp));
      }
      if (res.feedback) setMsgs((m) => [...m, { role: "tutor", text: res.feedback! }]);
      if (session?.user.id) xoaNhap(session.user.id, q.id);
      setVerdict("submitted");
    } catch (e) {
      { if (isExpired(e)) setExpired(true); else setError(errText(e)); }
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }

  // ── B0/B1 (29/07): lượt "KỂ CÁCH EM NGHĨ" + nút Xin gợi ý ───────────────
  // Kênh nói chuyện TÁCH KHỎI ô đáp án: gửi suy nghĩ → server không chấm, chỉ
  // dẫn dắt (thang Socratic) và ghi nhớ chất lượng suy nghĩ cho cổng nỗ lực.
  const [reflectText, setReflectText] = useState("");
  async function sendReflect(raw?: string) {
    const msg = (raw ?? reflectText).trim();
    // Đúng rồi thì chat ĐÃ KHOÁ (ô nhập không render nữa) — chốt thêm ở đây
    // phòng lượt gửi lọt qua đúng khoảnh khắc verdict vừa đổi (Enter đang bay).
    if (!ses || !q || busy || !msg || verdict === "ok") return;
    // ── CẦU CHAT→CHẤM (lỗi 20, 30/07) ────────────────────────────────────────
    // Chủ dự án đóng vai học sinh: nói "chốt C" hẳn hoi mà không có gì xảy ra —
    // muốn chốt thật phải thoát thoại → THỬ LẠI → bấm ô C → KIỂM TRA. Vì ô trò
    // chuyện chỉ biết một đường: đem MỌI THỨ đi tán gẫu, kể cả khi nội dung LÀ
    // đáp án. Giờ: câu gõ vào thực chất chỉ là đáp án ("C", "chốt C", "đúng"…)
    // → chọn ô tương ứng và nộp thẳng cho máy chấm tất định. AI vẫn không chấm
    // — đúng luật kiến trúc 29/07. Đây là ảnh gương của cổng ý định A1 (lời xin
    // giúp gõ vào ô ĐÁP ÁN không đem chấm). Lời KỂ có lập luận ("mình nghĩ C vì
    // 9 chia hết 3") vẫn đi đường đối thoại — cầu chỉ bắt câu-chỉ-có-đáp-án.
    if (verdict === "retry") {
      const ans = chatAnswerOf(msg, q);
      if (ans != null) {
        setReflectText("");
        setVerdict(null);
        void submitObjective(ans);
        return;
      }
    }
    setMsgs((m) => [...m, { role: "student", text: msg }]);
    setReflectText("");
    setBusy(true);
    setLoading(true);
    try {
      // PHÁT CHỮ DẦN — dựng sẵn một bong bóng RỖNG rồi bơm chữ vào nó. Trước đây
      // em nhìn màn trống suốt quãng mô hình viết cả câu; giờ chữ chạy ra ngay
      // từ tiếng đầu tiên. Không tốn thêm một đồng nào — vẫn ngần ấy token.
      let opened = false;
      // ĐÁP ÁN EM ĐANG CHỌN đi kèm mọi lượt nói (13/08). Trước đây lượt này chỉ
      // mang mỗi chuỗi em gõ, nên khi em bấm 💡 sau lúc đã chọn/đã nộp một
      // phương án thì server KHÔNG hề biết em chọn gì — sư tử đáp một câu rập
      // khuôn "chọn một đáp án trước nhé", đúng như thể em chưa chạm vào gì.
      // Trường này CHỈ là ngữ cảnh: server không chấm nó, không ghi lần thử,
      // không đụng vào cổng nỗ lực (xem nhánh reflect ở chat-turn).
      const res = await answerReflect(ses.sessionId, q.id, msg, luaChonHienTai(), (chunk) => {
        setMsgs((m) => {
          if (!opened) {
            opened = true;
            return [...m, { role: "hint" as const, text: chunk }];
          }
          const last = m[m.length - 1];
          if (!last || last.role !== "hint") return [...m, { role: "hint" as const, text: chunk }];
          return [...m.slice(0, -1), { ...last, text: last.text + chunk }];
        });
        // Mẩu chữ đầu tiên đã tới = sư tử đang nói rồi → tắt vòng quay chờ.
        setLoading(false);
      });
      // Câu CHỐT của server là bản thật (đã hoàn nguyên tên, đã lùi về câu tất
      // định nếu mô hình câm) — đè lên phần đã bơm để không lệch một chữ nào.
      if (res.message) {
        setMsgs((m) => {
          const last = m[m.length - 1];
          if (opened && last && last.role === "hint") {
            return [...m.slice(0, -1), { ...last, text: res.message! }];
          }
          return [...m, { role: "hint" as const, text: res.message! }];
        });
      }
    } catch (e) {
      { if (isExpired(e)) setExpired(true); else setError(errText(e)); }
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }

  async function submitWriting() {
    if (!ses || !q || busy || !text.trim()) return;
    const t = text.trim();
    setMsgs((m) => [...m, { role: "student", text: t }]);
    setText("");
    setBusy(true);
    setLoading(true);
    try {
      const res = await writing(ses.sessionId, q.id, t);
      // Đợt B: có bảng điểm rubric → hiện scorecard; không thì hiện nhận xét text.
      if (res.rubric) setRubricResult(res.rubric);
      else setMsgs((m) => [...m, { role: "feedback", text: res.feedback ?? "" }]);
      // Viết là FORMATIVE: server chấm rubric để bạn tự tiến bộ, KHÔNG phải điểm
      // chính thức, KHÔNG XP, KHÔNG đụng mastery (mastery chỉ tính câu khách quan).
      setVerdict("done");
    } catch (e) {
      { if (isExpired(e)) setExpired(true); else setError(errText(e)); }
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }

  async function submitSpeaking(transcript: string) {
    if (!ses || !q || busy || !transcript.trim()) return;
    setMsgs((m) => [...m, { role: "student", text: `“${transcript}”` }]);
    setBusy(true);
    setLoading(true);
    try {
      const res = await speaking(ses.sessionId, q.id, transcript);
      if (res.rubric) setRubricResult(res.rubric);
      else setMsgs((m) => [...m, { role: "feedback", text: res.feedback ?? "" }]);
      // Nói là FORMATIVE: chấm rubric để tự tiến bộ, KHÔNG XP (xem submitWriting).
      setVerdict("done");
    } catch (e) {
      { if (isExpired(e)) setExpired(true); else setError(errText(e)); }
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }

  async function next() {
    if (!ses) return;
    if (qi + 1 < ses.questions.length) {
      setQi(qi + 1);
      resetQuestion();
      return;
    }
    setBusy(true);
    try {
      const r = await endSession(ses.sessionId);
      const newly = r.nodes.filter((n) => n.mastered).map((n) => n.node);
      // Server trả xp (+20 buổi học, node_mastered đã cộng sống trong chat-turn)
      // → số server thắng; function cũ chưa trả thì cộng máy như trước.
      const rxp = r.xp; // gán biến để TS giữ narrowing trong closure setEarned
      if (rxp) {
        if (rxp.gained > 0) setEarned((e) => e + rxp.gained);
        setProgress(G.syncFromServer(rxp));
      } else {
        grant(G.XP.lessonDone + newly.length * G.XP.nodeMastered);
      }

      const all = [...new Set([...G.loadMastered(), ...newly])];
      setMastered(all);
      G.saveMastered(all);
      // Chốt thời gian buổi học thật (giây) — hiển thị mm:ss ở màn hoàn thành.
      setElapsedSec(
        startedAtRef.current ? Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)) : null,
      );
      setFinished(r);
      // Buổi đã ĐÓNG trên server → gói nối lại phải biến mất. Còn để lại là
      // lần sau mở app em được mời "học tiếp" một buổi đã học xong: bấm vào chỉ
      // gặp lại câu cuối và một màn hoàn thành thứ hai.
      // PHẢI dọn cả gói đang chờ ghi: em bấm "Tiếp tục" trong vòng 400ms sau
      // câu cuối thì nhịp hoãn vẫn còn treo một bản — không dọn thì lúc rời
      // trang nó ghi lại, làm buổi vừa xong SỐNG DẬY.
      goiChoGhiRef.current = null;
      if (uid) xoaPhienDo(uid);
      setPhienDo(null);
      setPathVersion((v) => v + 1); // mastery vừa đổi — nạp lại lộ trình server
    } catch (e) {
      { if (isExpired(e)) setExpired(true); else setError(errText(e)); }
    } finally {
      setBusy(false);
    }
  }

  /** Bấm "Thoát" trong sheet xác nhận: CHỦ ĐỘNG bỏ buổi → xoá gói nối lại (không
   *  mời "Học tiếp" nữa), về lộ trình — hoặc về tab Ôn tập nếu đang ở bộ ôn sai. */
  function thoatHan() {
    setHoiThoat(false);
    goiChoGhiRef.current = null; // đừng để lượt ghi treo 400ms hồi sinh gói vừa xoá
    if (uid) xoaPhienDo(uid);
    const veOnTap = cheDoOnSaiRef.current;
    cheDoOnSaiRef.current = false;
    backToPath();
    if (veOnTap) switchView("review");
  }

  function backToPath() {
    // THOÁT GIỮA CHỪNG cũng là một buổi dở: thẻ "Học tiếp" hiện lại ngay để em
    // quay vào đúng chỗ, thay vì phải nhớ mình đang làm bài nào tới câu mấy.
    // (Sau khi HỌC XONG thì `next` đã xoá gói — đọc lại chỉ ra null.)
    xaGoiChoGhi(); // mở bài rồi bấm X trong 400ms: chưa xả thì đọc ra rỗng
    setPhienDo(PHIEN_DO_ENABLED && uid ? docPhienDo(uid) : null);
    setSes(null);
    setFinished(null);
    setInjectedStack([]);
    setRemediateLabel(null);
    advancePlanRef.current = null;
    detourRepsRef.current = 0;
    resetQuestion();
    // NẠP LẠI LỘ TRÌNH KHI THOÁT GIỮA CHỪNG (vá 13/08). Trước đây `pathVersion`
    // chỉ tăng lúc học HẾT buổi, nên em làm đúng vài câu rồi bấm X là màn lộ
    // trình giữ nguyên số cũ: thẻ bài vẫn "2/8 câu", thẻ Bảng tuần vẫn XP cũ,
    // trong khi HUD trên cùng đã nhảy — hai con số XP khác nhau trên cùng một
    // màn hình. Đo tận tay trên production: tải lại trang là 2/8 → 3/8 và
    // 905 → 925, tức server ghi đúng từ đầu, chỉ giao diện không hỏi lại.
    // Đây là gốc của cảm giác "làm xong mà chẳng có gì đổi".
    setPathVersion((v) => v + 1);
  }

  // ── Cổng đăng nhập ────────────────────────────────────────────────────
  // Phiên đang tải → màn INTRO có brand (thay skeleton giật), cùng nền trời nên
  // vào/ra không chớp trắng, trông như chuyển cảnh cố ý.
  if (session === undefined) return <Splash text="Đang mở lộ trình…" />;
  if (session === null) return <RedirectToLogin />;
  if (profile && profile.role !== "student") {
    return (
      <AppShell current="learn">
        <div className="panel" style={{ textAlign: "center" }}>
          <h1 className="h2">Xin chào {profile.full_name}</h1>
          <p className="sub" style={{ margin: "8px auto 18px" }}>
            Tài khoản này không phải học sinh — phần Tutor dành cho học sinh.
          </p>
          <div className="row" style={{ justifyContent: "center" }}>
            <a className="btn" href="/teacher">
              Mở bảng điều khiển giáo viên
              <ArrowRight aria-hidden strokeWidth={2} />
            </a>
            <button className="btn btn-ghost" onClick={() => signOut()}>
              Đăng xuất
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  // Lần mở app đầu VÀ mỗi lần ĐỔI MÔN: giữ intro tới khi lộ trình môn hiện tại
  // settle (hoặc hết 1.4s) — cảnh + banner lộ MỘT LẦN đã đúng trạng thái, không
  // tráo fallback→tĩnh→server (world nền sáng→tối, banner nhảy) trước mắt học sinh.
  // HẾT PHIÊN — chặn TRƯỚC khi vẽ bất cứ gì. Đây là lỗi 20: trước đây mọi lệnh
  // gọi server trả 401 mà giao diện vẫn vẽ tiếp một màn không có dữ liệu, học
  // sinh nhìn thấy trang trống và không hiểu vì sao.
  if (expired) {
    return (
      <AppShell current="learn" onNavigate={switchView}>
        <div className="ws-panel expired-panel" role="alert">
          <Lion mood="thinking" size={72} decorative />
          <h2 className="ws-panel-title">Phiên đăng nhập đã hết hạn</h2>
          {/* Câu này TRƯỚC ĐÂY LÀ NÓI DỐI: không có gì được lưu, bấm nút là
              signOut + chuyển trang và bài em vừa gõ bay sạch. Rồi nó đúng một
              nửa: `luuNhap` giữ chữ em GÕ, nhưng em làm trắc nghiệm thì mất cả
              buổi. Nay cả buổi được đóng gói (xem lib/phien-do) nên hứa được
              nguyên câu — và vẫn chỉ hứa đúng phần giữ được. */}
          <p className="muted">
            Bạn mở app lâu rồi nên hệ thống tự đăng xuất cho an toàn. Điểm và XP của những câu
            đã làm đều được lưu rồi — đăng nhập lại là học tiếp bình thường.
          </p>
          <button
            className="btn btn-gold"
            data-loading={dangNoiLai || undefined}
            disabled={dangNoiLai}
            onClick={() => {
              // THỬ NỐI LẠI TRƯỚC KHI ĐUỔI RA. Phần lớn ca "văng" là access
              // token chết trong khi refresh token vẫn sống (máy vừa ngủ dậy,
              // mở hai tab, token xoay vòng). Đá thẳng em về màn đăng nhập là
              // bắt gõ lại mật khẩu cho một phiên chưa hề chết.
              datDangNoiLai(true);
              void supabase.auth.refreshSession()
                .then(({ data }) => {
                  if (data.session) { setExpired(false); return; }
                  return signOut().finally(() => { window.location.href = "/login/"; });
                })
                .catch(() => signOut().finally(() => { window.location.href = "/login/"; }))
                .finally(() => datDangNoiLai(false));
            }}
          >
            {dangNoiLai ? "Đang nối lại…" : "Học tiếp"}
          </button>
        </div>
      </AppShell>
    );
  }

  if (!firstReady) return <Splash text={`Đang mở ${active.short}…`} />;

  // ── Hoàn thành buổi học (hi-fi 4a) ────────────────────────────────────
  if (finished) {
    const masteredNow = finished.nodes.filter((n) => n.mastered).length;
    const totalQ = ses?.questions.length ?? 0;
    const wrongCount = wrongRef.current.size;
    // Tên node cho học sinh đọc (mock: "Thành thạo · Đồ thị parabol") — label
    // thật từ lộ trình server; không có thì đành key (fallback localStorage).
    const labelOf = (key: string) => serverPath?.find((n) => n.key === key)?.label ?? key;
    // mm:ss từ thời gian buổi học THẬT; không đo được thì ẩn thẻ phút.
    const mmss =
      elapsedSec != null
        ? `${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, "0")}`
        : null;
    return (
      <AppShell current="learn" focus>
        <div className="finish">
          {/* Quầng nắng 3 vòng đồng tâm sau sư tử. Thành thạo điểm mới → trophy
              bùng 1 lần (one-shot, remount theo sessionId); chỉ xong → cheer. */}
          <div className="finish-halo">
            {masteredNow > 0 ? (
              <Lion key={ses?.sessionId ?? "trophy"} mood="trophy" size={158} eager />
            ) : (
              <Lion mood="cheer" size={158} eager />
            )}
          </div>
          <h1 className="h1 finish-title">Hoàn thành bài học!</h1>
          <p className="finish-sub">
            {active.unit} · {finished.nodes.length} điểm kiến thức
          </p>

          <div className="finish-stats">
            <div className="finish-stat" data-tone="gold">
              <Zap aria-hidden strokeWidth={2} />
              <b className="num">+{earned}</b>
              <span>XP</span>
            </div>
            {totalQ > 0 && (
              <div className="finish-stat" data-tone="ok">
                <CheckCircle2 aria-hidden strokeWidth={2} />
                <b className="num">
                  {Math.max(0, totalQ - wrongCount)}/{totalQ}
                </b>
                <span>Chính xác</span>
              </div>
            )}
            {mmss && (
              <div className="finish-stat" data-tone="sky">
                <Timer aria-hidden strokeWidth={2} />
                <b className="num">{mmss}</b>
                <span>Phút</span>
              </div>
            )}
          </div>

          {/* Điểm thành thạo từng node — score thật từ end-session. Không có
              điểm "trước buổi" trong dữ liệu nên không vẽ vạch mốc cũ. */}
          {finished.nodes.map((n, i) => {
            const pct = Math.round(n.score * 100);
            return (
              <div
                key={n.node}
                className="mastery-card"
                style={{ animationDelay: `${180 + i * 60}ms` }}
              >
                <div className="mastery-head">
                  <span>Thành thạo · {labelOf(n.node)}</span>
                  <b className="num">{pct}%</b>
                </div>
                <div
                  className="meter"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Thành thạo ${n.node}: ${pct}%`}
                >
                  <i style={{ "--p": `${pct}%` } as React.CSSProperties} />
                </div>
              </div>
            );
          })}

          {/* G14 "chiêm nghiệm": metacognition nhẹ cuối buổi — thưởng nỗ lực,
              KHÔNG chấm điểm; growth mindset (khó = não đang lớn). */}
          <SessionReflection />

          <div className="finish-cta">
            <button className="btn btn-gold btn-block" onClick={backToPath}>
              TIẾP TỤC
            </button>
            {wrongCount > 0 && (
              <a className="finish-review" href="/review">
                Ôn tập các điểm cần củng cố
              </a>
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  // ── Lộ trình (hi-fi 3a + cột phải 3c) ─────────────────────────────────
  if (!ses) {
    // Bấm "Bắt đầu" → đang tải diagnose (~1s): chuyển cảnh path→bài học bằng
    // MÀN INTRO (thay dòng chữ đội layout cũ), cùng nền trời nên liền mạch.
    if (busy) return <Splash text="Đang mở bài học…" />;
    // Ưu tiên lộ trình server (label thật, đủ 5 trạng thái, blockedBy).
    // Chưa có server → lộ trình TĨNH từ bundle (giáo trình thật, node đầu
    // chưa thành thạo = current, phần sau locked). Thiếu cả file tĩnh →
    // fallback tối thiểu từ localStorage như trước khi có endpoint.
    const masteredSet = new Set(mastered);
    let hasCurrent = false;
    const nodes: PathNode[] =
      serverPath ??
      staticPath?.map((n) => {
        if (masteredSet.has(n.key) || masteredSet.has(n.label)) {
          return { key: n.key, label: n.label, chapter: n.chapter, state: "mastered" as const };
        }
        if (!hasCurrent) {
          hasCurrent = true;
          return { key: n.key, label: n.label, chapter: n.chapter, state: "current" as const };
        }
        return { key: n.key, label: n.label, chapter: n.chapter, state: "locked" as const };
      }) ?? [
        ...mastered.map((k) => ({ key: k, label: k, state: "mastered" as const })),
        { key: "next", label: "Bài học hôm nay", state: "current" as const },
      ];
    const doneCount = nodes.filter((n) => n.state === "mastered").length;
    const total = nodes.length;
    // Banner chương sống TRONG cảnh (LearningPath render). Ở đây chỉ nuôi dữ
    // liệu thật cho nó: eyebrow "MÔN · BÀI x/y" qua `unit`, tên chương =
    // version_label của KG (nếu có) thế phần đầu của subtitle.
    const bannerUnit =
      total > 0 ? `${active.unit} · Bài ${Math.min(doneCount + 1, total)}/${total}` : active.unit;
    const [defaultTitle, ...descParts] = active.subtitle.split(" · ");
    // Tên chương ưu tiên: server (version_label) → chương của node hiện tại
    // trong lộ trình tĩnh → tiêu đề mặc định của môn. Không hiện id thô.
    const curKey = nodes.find((n) => n.state === "current")?.key;
    const staticChapter = serverPath
      ? null
      : (staticPath?.find((n) => n.key === curKey)?.chapter ?? null);
    const bannerSubtitle = [pathLabel ?? staticChapter ?? defaultTitle, ...descParts].join(" · ");
    // Cột phải: chỉ số THẬT — mục tiêu hôm nay + đường thăng hạng XP.
    const league = G.leagueOf(progress.xp);
    const nextLeague = league.next != null ? G.LEAGUES.find((l) => l.min === league.next) : null;
    const studied = G.studiedToday(progress);
    // Tên hiển thị: override cục bộ (Cài đặt) thắng tên server
    const firstName = Prefs.displayNameOf(profile?.full_name)?.split(/\s+/).pop();

    // ── Lời mời nối lại buổi dở ─────────────────────────────────────────────
    // Phải nói ĐÚNG chỗ em đang đứng, nếu không thẻ chỉ là một nút mơ hồ. Tên
    // bài chỉ tra được khi buổi dở CÙNG MÔN với lộ trình đang mở (serverPath là
    // của môn hiện tại); khác môn thì nêu tên môn — vẫn đủ để em nhận ra.
    const monPhienDo = phienDo ? SUBJECTS.find((s) => s.key === phienDo.subject) : null;
    const tenBaiPhienDo =
      phienDo && phienDo.subject === subject
        ? (serverPath?.find(
            (n) => n.key === (cauDangLam(phienDo)?.nodeKey ?? phienDo.ses.node),
          )?.label ?? null)
        : null;
    const moTaPhienDo = phienDo
      ? [
          tenBaiPhienDo ?? monPhienDo?.unit ?? null,
          `câu ${phienDo.qi + 1}/${phienDo.ses.questions.length}`,
          phienDo.earned > 0 ? `+${phienDo.earned} XP đã kiếm` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "";

    // Tab khác Học: cùng AppShell, view đổi tại chỗ — "ấn cái là đến".
    // Cài đặt không có tab riêng — rail giữ đèn ở "Tôi" (cửa vào của nó).
    if (view !== "learn") {
      return (
        <AppShell current={view === "settings" ? "profile" : view} onNavigate={switchView}>
          {/* key={view}: remount khi đổi tab → animation view-in (mobile) chạy
              lại — chuyển tab có nhịp native thay vì nhảy hình 0ms */}
          <div key={view} className="view-in" data-dir={viewDir}>
            {view === "review" && (
              <ReviewView
                subject={subject}
                onGoLearn={() => switchView("learn")}
                /* Ôn một bài = mở buổi học đúng node đó, ngay tại chỗ. */
                onReview={(nodeKey, label) => {
                  switchView("learn");
                  void start({ key: nodeKey, label, state: "available" });
                }}
                /* Bộ ôn sai tổng hợp — không gắn với một node cụ thể. */
                onReviewWrong={() => {
                  switchView("learn");
                  void start(undefined, undefined, true);
                }}
              />
            )}
            {view === "scoreboard" && <ScoreboardBody onGoLearn={() => switchView("learn")} />}
            {view === "quests" && (
              /* Tên chương thật từ learning-path (version_label) → title WIG.
                 Hạn WIG server chưa trả — QuestsView tự hiển thị dòng thay thế. */
              <QuestsView
                onGoLearn={() => switchView("learn")}
                /* Tên CHƯƠNG đang học (audit 04/09: "chương Toán 10" không phải
                   tên chương) — lấy từ node hiện tại; thiếu thì để QuestsView
                   dùng câu mặc định thay vì bịa. */
                wigTitle={(() => {
                  const chuong = nodes.find((n) => n.state === "current")?.chapter;
                  // "Chương I. Mệnh đề" đã có chữ Chương → không lặp "chương Chương" (04/09)
                  if (!chuong) return undefined;
                  return /^chương\b/i.test(chuong.trim()) ? `Thành thạo ${chuong.trim()}` : `Thành thạo chương ${chuong}`;
                })()}
              />
            )}
            {view === "profile" && (
              <ProfileView
                onGoBoard={() => switchView("scoreboard")}
                onOpenSettings={() => switchView("settings")}
              />
            )}
            {view === "settings" && <SettingsView onBack={() => switchView("profile")} />}
          </div>
          <GopYFab onOpen={() => setGopY({ page: view, subject })} />
          <GopYSheet ctx={gopY} onClose={() => setGopY(null)} />
        </AppShell>
      );
    }

    // KHO BÁU mở đè lên lộ trình (không phải một mục ở thanh dưới): nó thuộc về
    // đúng bài đó, xem xong bấm "Về lộ trình" là quay lại đúng chỗ cũ.
    if (khoBau) {
      return (
        <AppShell current="learn" onNavigate={switchView}>
          <div className="learn-layout view-in" data-dir={viewDir}>
            <div className="learn-main">
              <KhoBauView
                subject={subject}
                nodeKey={khoBau.key}
                nodeLabel={khoBau.label}
                onBack={() => {
                  setKhoBau(null);
                  setPathVersion((v) => v + 1); // mức vừa mở phải hiện ngay trên dấu chân
                }}
              />
            </div>
          </div>
        </AppShell>
      );
    }

    return (
      <AppShell current="learn" onNavigate={switchView}>
        <div className="learn-layout view-in" data-dir={viewDir}>
          <div className="learn-main">
            {/* Pill chọn môn trong HUD — bấm MỞ BẢNG chọn môn (không đảo mù) */}
            <Hud
              progress={progress}
              bump={bump}
              /* `earned` = XP của buổi vừa xong; backToPath KHÔNG xoá nó (chỉ
                 start() mới reset về 0), nên lúc em quay về lộ trình HUD còn số
                 để loé chip "+N". */
              justEarned={earned}
              subject={{
                label: active.short,
                onClick: () => setPickerOpen(true),
              }}
            />

            <SubjectPicker
              open={pickerOpen}
              onClose={() => setPickerOpen(false)}
              current={subject}
              subjects={SUBJECTS}
              onPick={(k) => {
                if (k !== subject) setFirstReady(false); // intro chuyển cảnh sang môn mới
                setSubject(k);
                setPickerOpen(false);
              }}
            />

            {/* Học cùng nhau: dải bạn cùng khối đang online (rỗng thì tự ẩn).
                Tạm gỡ qua cờ PRESENCE_ENABLED (lib/presence). */}
            {PRESENCE_ENABLED && <PresenceStrip peers={peers} />}

            {/* MỌI THÔNG BÁO = POP-UP (chủ dự án 05/09): không còn banner đỏ đầu
                trang — sư tử nói, một nút "Đã hiểu". */}
            <Sheet open={!!error} onClose={() => setError(null)} title="Sư tử nhắn bạn">
              <div className="tb-pop">
                <Lion mood="think" size={96} decorative />
                <p className="tb-loi">{error}</p>
                <button className="btn btn-block" data-autofocus onClick={() => setError(null)}>
                  Đã hiểu
                </button>
              </div>
            </Sheet>

            {/* CẦN ĐỒNG THUẬN — pop-up có nút làm được việc, không phải câu kỹ thuật */}
            <Sheet open={!!canDongY} onClose={() => setCanDongY(null)} title="Trước khi học">
              <div className="tb-pop">
                <Lion mood={canDongY?.sauDongY ? "reminder" : "greet"} size={110} decorative />
                {canDongY?.sauDongY ? (
                  <>
                    <p className="tb-loi">
                      Cảm ơn bạn đã đồng ý! Còn một bước: <b>bố/mẹ cũng cần đồng ý</b> cho bạn dùng
                      AI Tutor (đồng thuận kép). Bạn nhắn thầy cô hoặc bố mẹ giúp nhé — xong là vào
                      học được ngay.
                    </p>
                    <button className="btn btn-block" data-autofocus onClick={() => setCanDongY(null)}>
                      Đã hiểu
                    </button>
                  </>
                ) : (
                  <>
                    <p className="tb-loi">
                      AI Tutor sẽ ghi lại bài làm và câu trả lời của bạn để dạy đúng chỗ bạn cần.
                      Bạn đồng ý để mình bắt đầu chứ?
                    </p>
                    <button className="btn btn-gold btn-block" data-autofocus disabled={busy} onClick={dongYRoiHoc}>
                      Em đồng ý dùng AI Tutor
                    </button>
                    <button type="button" className="btn btn-quiet tiep-do-desau" onClick={() => setCanDongY(null)}>
                      Để sau
                    </button>
                  </>
                )}
              </div>
            </Sheet>

            <GopYFab onOpen={() => setGopY({ page: "learn", subject })} />
            <GopYSheet ctx={gopY} onClose={() => setGopY(null)} />

            {/* BUỔI HỌC DỞ — POP-UP mời quay lại đúng chỗ đã dừng (đổi từ thẻ
                trong flow 18/08: lộ trình desktop toàn lớp nổi absolute nên thẻ
                đè/bị đè lung tung). "Để sau" chỉ đóng lời mời — gói còn nguyên,
                và bấm bài bất kỳ trên lộ trình là gói tự bị thay (xem `start`). */}
            <Sheet
              open={!!phienDo && moiNoiLai}
              onClose={boQuaNoiLai}
              title="Buổi học đang chờ bạn!"
            >
              <div className="tiep-do-pop">
                {/* Sư tử CHẠY — "mình đi tiếp thôi", không phải cảnh báo */}
                <Lion mood="run" size={126} decorative />
                <span className="tiep-do-chip">{moTaPhienDo}</span>
                <p className="tiep-do-loi">
                  Quay lại là vào đúng câu đang làm — XP đã kiếm vẫn còn nguyên.
                </p>
                <button
                  className="btn btn-gold btn-block"
                  data-autofocus
                  onClick={hocTiep}
                  disabled={busy}
                >
                  Học tiếp thôi!
                </button>
                <button type="button" className="btn btn-quiet tiep-do-desau" onClick={boQuaNoiLai}>
                  Để sau
                </button>
              </div>
            </Sheet>

            <LearningPath
              unit={bannerUnit}
              subtitle={bannerSubtitle}
              nodes={nodes}
              preview={!active.live}
              /* LUÔN "greet" — KHÔNG buồn (chủ dự án chốt 10/08: "buồn là không
                 được"). Trước đây em nghỉ mấy hôm quay lại thì sư tử để mặt
                 `miss`: sprite head-sad + trái tim TAN VỠ. Đó là dỗi, là bắt em
                 thấy có lỗi vì đã vắng — trái thẳng với bối cảnh sư phạm bất
                 biến (không bao giờ trừng phạt, sai/vắng là dữ liệu chứ không
                 phải thất bại). Vắng lâu thì mừng em quay lại, không trách.
                 Lời chào vẫn đổi theo bối cảnh qua pickGreeting("cold"). */
              heroMood="greet"
              /* ĐỔI GIÓ (30/07): mỗi lần mở app một câu khác trong cùng BỐI CẢNH
                 (lần đầu / nguội / đang đi đều) — kho câu ở lib/nudges.ts. Bối
                 cảnh vẫn phải đúng: câu "lần đầu" bắt buộc nêu luật "mình hỏi,
                 bạn nghĩ", câu "nguội" không được mắng em nghỉ mấy hôm. */
              greeting={
                !active.live
                  ? `Đây là lộ trình ${active.unit} — bạn xem trước toàn bộ các bài nhé. Phần luyện tập với mình sắp mở!`
                  : pickGreeting(
                      doneCount === 0 ? "first" : G.isCold(progress) ? "cold" : "back",
                      rot,
                      { ten: firstName, n: doneCount },
                    )
              }
              busy={busy}
              onStart={start}
              onOpenKhoBau={(n) => setKhoBau({ key: n.key, label: n.label })}
              /* Làm lại: mở đúng bài + đưa CÂU bị trả lên đầu phiên. */
              onRedo={(n, qid) => void start(n, qid)}
            />

            {/* Đồng bộ lộ trình chạy NGẦM — không báo chữ (tránh nhấp nháy/giật);
                path tĩnh hiện ngay, path server tới thì cảnh tự đổi mượt. */}
          </div>

          {/* Cột phải ≥1200px (hi-fi 3c) — 900–1200 và mobile: ẩn hẳn */}
          <LearnAside
            board={board}
            progress={progress}
            leagueProgress={league.progress}
            nextLeague={nextLeague ?? null}
            studied={studied}
            firstName={firstName}
            rot={rot}
            onSeeAll={() => switchView("scoreboard")}
          />
        </div>
      </AppShell>
    );
  }

  // ── Bài học (hi-fi 3b) ────────────────────────────────────────────────
  // Flow mới cho trắc nghiệm: chạm đáp án chỉ CHỌN, nút KIỂM TRA ở footer
  // mới nộp. Viết/nói giữ flow cũ (nộp trong khối riêng của chúng).
  const total = ses.questions.length;
  // THẾ GIỚI của bài đang làm — quyết sắc trời cho sân khấu. Cùng cách chia chặng
  // với lộ trình, nên vào bài KHÔNG bị nhảy sang một bầu trời khác.
  const lessonWorld = worldOfLesson(serverPath ?? staticPath ?? null, currentNodeKey);
  // Đang vá nền (câu tiêm) thì KHÔNG bao giờ là "hết bài" — còn phải leo về.
  const last = qi + 1 >= total && injectedStack.length === 0;
  // Dạng tương tác: server đã bóc cấu trúc (interactive). Không có → rơi về ô nhập
  // thường (server vẫn chấm cấu trúc chuỗi gõ tay).
  const orderParsed = q?.interactive?.order ?? null;
  const matchParsed = q?.interactive?.match ?? null;
  // "Đúng/Sai chùm ý": server phát hiện theo HÌNH DẠNG dap_an (dữ liệu gắn nhãn
  // dang_cau_hoi="mcq"), nên KHÔNG suy ra được từ dangCauHoi ở client.
  const checklistParsed = q?.interactive?.checklist ?? null;
  // Điền khuyết nhiều ô: mỗi chỗ trống một ô nhập, server chấm từng phần.
  const blanksParsed = q?.interactive?.blanks ?? null;
  const isTrueFalse = q?.dangCauHoi === "dung_sai";
  const interactiveShown = !!(orderParsed || matchParsed || checklistParsed || blanksParsed);
  // MCQ có đáp án là CHỮ CÁI (text nằm trong đề) → tách đề riêng + text phương án ra nút.
  const letterMCQ =
    q && q.kind === "objective" && q.options && q.options.length > 0 &&
    q.options.every((o) => /^[A-DĐ]$/.test(o.trim()))
      ? parseLetterMCQ(q.prompt, q.options)
      : null;
  // Đề NHIỀU BƯỚC ("Bước 1: … (Có/Không) Bước 2: …"): tách thành thẻ từng bước.
  // Bước (Có/Không) → nút chọn, hiện DẦN từng bước (trả lời bước này mới mở bước
  // sau); bước kết luận → ô gõ như cũ. Chỉ áp cho câu GÕ ĐÁP ÁN — câu có lưới
  // phương án giữ nguyên. Đáp án gửi đi được RÁP LẠI đúng khuôn "Bước 1: Có; …"
  // nên server chấm y như học sinh tự gõ cả chuỗi.
  const stepParsed =
    q && q.kind === "objective" && !q.options && !interactiveShown && !isTrueFalse
      ? parseSteps(q.prompt)
      : null;
  const yesNoIdx = stepParsed ? stepParsed.steps.flatMap((s, i) => (s.yesNo ? [i] : [])) : [];
  // Chỉ chuyển sang nút bấm khi MỌI bước đều là Có/Không, trừ đúng bước cuối
  // (bước kết luận em gõ). Có bước tính toán xen GIỮA thì trả về ô gõ tự do:
  // bước xen giữa không có nút nào để trả lời, mà đáp án ráp lại cũng thiếu
  // hẳn bước đó — em không có cách nào làm đúng dù hiểu bài.
  const stepInteractive =
    yesNoIdx.length > 0 &&
    // LỖI #11 — MỌI câu nhiều bước đều phải có chỗ trả lời, không chỉ câu toàn
    // "(Có/Không)". Khuôn cũ đòi mọi bước là yesNo (trừ bước cuối); đo ngân hàng
    // sống: đúng MỘT câu viết theo khuôn đó, còn 45 câu nhiều bước khác rơi vào
    // nhánh "vẽ ba thẻ bước mà không thẻ nào có ô trả lời" — người thử 2 gọi là
    // "hiện ra 3 ý nhưng không rõ yêu cầu". Nay chỉ cần CÓ bước nào đó trả lời
    // được: bước (Có/Không) → hai nút, bước còn lại → ô gõ ngay trong thẻ.
    !!stepParsed;
  // Hiện tới bước (Có/Không) đầu tiên CHƯA trả lời; xong hết thì mở cả phần còn lại.
  let stepReveal = stepParsed ? stepParsed.steps.length : 0;
  if (stepParsed && yesNoIdx.length > 0) {
    // Chỉ mở dần khi có bước Có/Không (nhịp suy luận). Câu toàn bước gõ thì hiện
    // hết ngay — bắt em mở từng ô mà không có gì để bấm là đường cụt.
    const firstOpen = yesNoIdx.find((i) => !stepAns[i]);
    stepReveal = firstOpen == null ? stepParsed.steps.length : firstOpen + 1;
  }
  // "Xong" = trả lời hết bước Có/Không VÀ gõ đủ các bước cần chữ.
  const stepsDone =
    !stepParsed ||
    (yesNoIdx.every((i) => !!stepAns[i]) &&
      stepParsed.steps.every((s, i) => s.yesNo || (stepText[i] ?? "").trim().length > 0));
  // Lời trích trong đề ('bạn ấy nói…') → thẻ riêng. Chỉ môn Toán: đề tiếng Anh
  // đầy nháy đơn hợp lệ (don't, it's) nên tách kiểu này là vỡ.
  const quoteParsed =
    q && subject === "Toan" && !letterMCQ && !stepParsed && !interactiveShown
      ? splitQuote(q.prompt)
      : null;

  const canCheck =
    q?.kind === "objective" &&
    (interactiveShown
      ? interactiveAns != null
      : isTrueFalse || q.options
        ? picked != null
        : stepParsed
          ? stepsDone
          : text.trim().length > 0);
  // Vì sao KIỂM TRA còn mờ — một câu, đúng dạng câu đang làm (audit 04/09).
  const lyDoKhoa: string | null =
    !q || q.kind !== "objective" || canCheck
      ? null
      : interactiveShown
        ? checklistParsed
          ? `Chọn Đúng hay Sai cho đủ ${checklistParsed.items.length} ý rồi bấm Kiểm tra`
          : orderParsed
            ? "Xếp đủ các mục rồi bấm Kiểm tra"
            : matchParsed
              ? "Nối đủ các cặp rồi bấm Kiểm tra"
              : "Điền đủ các ô trống rồi bấm Kiểm tra"
        : isTrueFalse || q.options
          ? "Chọn một đáp án rồi bấm Kiểm tra"
          : stepParsed
            ? `Còn ${stepParsed.steps.filter((s, i) => (s.yesNo ? !stepAns[i] : !(stepText[i] ?? "").trim())).length} bước chưa trả lời`
            : "Nhập câu trả lời rồi bấm Kiểm tra";
  /** Đáp án em ĐANG chọn/gõ, ráp đúng như lúc bấm KIỂM TRA. Tách ra khỏi
   *  `check` (13/08) vì lượt XIN GỢI Ý cũng cần đọc chính chuỗi này: trước đây
   *  nút 💡 gửi đi một câu mồi cố định, không kèm gì về lựa chọn của em, nên sư
   *  tử đáp như thể em chưa chọn gì. */
  const soanDapAnHienTai = (): string | null => {
    if (!q || q.kind !== "objective") return null;
    let ans = interactiveShown ? interactiveAns : isTrueFalse || q.options ? picked : text.trim();
    if (!interactiveShown && stepParsed && stepInteractive) {
      const lastIdx = stepParsed.steps.length - 1;
      ans = stepParsed.steps
        .map((st, i) => {
          if (st.yesNo) return stepAns[i] ? `${st.label}: ${stepAns[i]}` : null;
          // Bước gõ: lấy bài làm CỦA CHÍNH bước đó (lỗi #11). Ô `text` chung chỉ
          // còn là đường lui cho bước cuối, giữ cho câu cũ không vỡ.
          const rieng = (stepText[i] ?? "").trim();
          if (rieng) return `${st.label}: ${rieng}`;
          if (i === lastIdx && text.trim()) return `${st.label}: ${text.trim()}`;
          return null; // bước hướng dẫn xen giữa (hiếm) — không có gì để gửi
        })
        .filter(Boolean)
        .join("; ");
    }
    return ans ? String(ans) : null;
  };

  /** Lựa chọn hiện tại dưới HAI dạng, vì server cần cả hai và chúng khác nhau:
   *   · `raw`  — đúng chuỗi mà nút KIỂM TRA gửi đi (MCQ chữ cái là "B"). Server
   *     đem đối chiếu với `distractors[].phuong_an` để biết em đang dính BẪY
   *     nào; sai một ký tự là không khớp bẫy nào cả.
   *   · `nhan` — dạng đọc được cho sư tử ("B. Số 9 là số nguyên tố"). Một chữ
   *     "B" trơ trọi thì mô hình không bám vào đâu để hỏi cho trúng.
   *  Chưa chọn gì ở câu hiện tại → lấy đáp án em vừa nộp (màn "thử lại"). */
  const luaChonHienTai = (): { raw: string; nhan: string } => {
    const raw = soanDapAnHienTai() ?? daTraLoi;
    if (!raw) return { raw: "", nhan: "" };
    const hit = letterMCQ?.opts.find((o) => o.letter === raw);
    return { raw, nhan: hit ? `${hit.letter}. ${hit.text}` : raw };
  };

  const check = () => {
    setFootNote(null);
    const ans = soanDapAnHienTai();
    if (!ans) return;
    setDaTraLoi(ans);
    void submitObjective(ans);
  };

  return (
    <AppShell current="learn" focus>
      {/* VỎ THẾ GIỚI (display:contents — không đổi layout): mang data-world để
          token 9 cảnh chảy xuống, và .viewport:has() treo TRANH savanna của
          chương làm nền cả màn — đúng tranh em vừa thấy trên lộ trình. */}
      <div className="qworld" data-world={lessonWorld}>

      {/* KHÍ QUYỂN trên tranh (fixed — đứng yên khi cuộn = parallax miễn phí):
          quầng nắng màu mặt trời của thế giới + 6 đom đóm. Mặt trời/mây/đồi đã
          nằm TRONG tranh, không vẽ CSS đè lên nữa. aria-hidden: máy đọc bỏ qua. */}
      <div className="qstage" aria-hidden>
        <i className="qstage-glow" />
        <span className="qstage-motes">
          <i /><i /><i /><i /><i /><i />
        </span>
      </div>

      {/* XÁC NHẬN THOÁT (chủ dự án 04/09): bấm X là hỏi — chủ động thoát thì bỏ
          buổi, làm lại từ đầu; XP đã cộng vẫn giữ. Rớt mạng/đóng tab không qua
          đây, gói nối lại vẫn còn → "Học tiếp" như cũ. */}
      <Sheet open={hoiThoat} onClose={() => setHoiThoat(false)} title="Thoát bài này?">
        <p>
          Thoát giữa chừng là bài này <b>làm lại từ đầu</b> lần sau. XP bạn đã kiếm vẫn giữ nguyên.
        </p>
        <div className="sheet-actions">
          <button className="btn btn-ghost" data-autofocus onClick={() => setHoiThoat(false)}>
            Ở lại làm tiếp
          </button>
          <button className="btn" onClick={thoatHan}>
            Thoát
          </button>
        </div>
      </Sheet>

      <div className="lesson-top">
        <button className="lesson-x" onClick={() => setHoiThoat(true)} aria-label="Thoát buổi học">
          <X aria-hidden strokeWidth={2.5} />
        </button>
        {cheDoOnSaiRef.current && <span className="lesson-mode">Ôn lại câu sai</span>}
        {/* ĐƯỜNG DẤU CHÂN trên dải cỏ: mỗi câu một dấu chân — đã qua in VÀNG
            (đúng ngôn ngữ mastered của lộ trình), hiện tại là dấu SÁNG có sư tử
            tí hon đứng làm quân cờ, cuối đường là cờ đích. Tiến trình = chuyến
            đi, không phải phần trăm. aria giữ progressbar; sư tử decorative. */}
        <div
          className="qtrail"
          data-long={total > 14 || undefined}
          role="progressbar"
          aria-valuenow={qi + 1}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label={`Câu ${qi + 1} trên ${total}`}
        >
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className="qtrail-paw" data-s={i < qi ? "done" : i === qi ? "now" : "next"}>
              {i === qi && <Lion mood="idle" size={26} decorative />}
            </span>
          ))}
          <span className="qtrail-flag" />
        </div>
        <span className="lesson-count num">
          {qi + 1}/{total}
        </span>
      </div>

      {/* Đang vá nền: engine đã kéo học sinh về nguyên tử nền còn hổng. Băng-rôn
          hổ phách (không đỏ — không phải phạt) nói rõ vì sao câu bỗng dễ đi. */}
      {remediateLabel && (
        <div className="mend-banner" role="status">
          <LifeBuoy aria-hidden strokeWidth={2.25} />
          <span>
            Mình cùng vá nền: <b>{remediateLabel}</b> — nền chắc rồi mình quay lại bài khó nhé.
          </span>
        </div>
      )}

      {/* Đồng hồ vắng mặt: 30' không tương tác → hỏi một câu. Mọi cú bấm/gõ
          đều tự tắt băng-rôn (listener toàn cục), nút X chỉ là đường tắt rõ ràng. */}
      {idleAsk && (
        <div className="mend-banner break-banner" role="status">
          <Timer aria-hidden strokeWidth={2.25} />
          <span>
            Bạn còn ở đó không? Bấm hoặc gõ gì đó để mình biết bạn vẫn đang học nhé.
          </span>
          <button className="break-x" onClick={() => setIdleAsk(false)} aria-label="Mình vẫn ở đây">
            <X aria-hidden strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* CANH GIỮA, một dải icon MẢNH bên trái (09/2026) — KHÔNG phải cột học
          liệu đầy đủ đã gỡ 10/08 (chủ dự án: "rối, nhiều món rời"). Rail chỉ
          3 icon tròn audio/video/ảnh (RailOnLuyen.tsx), không nhãn dài, không
          mô tả — bấm mới mở popup, không choán chỗ khi không cần. Node không
          có học liệu loại này thì rail tự ẩn (trả về null), `.lsn-grid` không
          đổi layout gì cả. */}
      <div className="lsn-grid">
        {q && <RailOnLuyen subject={subject} nodeKey={q.nodeKey} onXp={grant} />}
        <div className="lsn-main">
      {q && (
        <>
          <p className="eyebrow lesson-kind">{kindEyebrow(q)}</p>
          {/* LỖI #29 — KHUÔN câu trả lời. Người thử 1: "trả lời đúng 80% câu hỏi
              nhưng vẫn bị sư tử giữ lại". Gốc phổ biến nhất: đề có hai chỗ
              trống mà em chỉ điền một, vì không chỗ nào nói ra điều đó.
              Chỉ hiện khi CÒN phải trả lời — đọc lại lúc đã xong là thừa. */}
          {q.goiYDinhDang && verdict == null && !interactiveShown && (
            <p className="dang-tl">
              <Info aria-hidden strokeWidth={2.25} />
              {q.goiYDinhDang}
            </p>
          )}
          {/* Dạng tương tác tự dựng đề (câu dẫn + các mục) → ẩn qcard mặc định. */}
          {!interactiveShown && stepParsed ? (
            /* ── Đề NHIỀU BƯỚC: câu dẫn + thẻ từng bước. Bước (Có/Không) hiện
                DẦN — trả lời bước này mới mở bước sau — để em đi đúng nhịp suy
                luận thay vì đọc một câu văn dài nghẹt thở. ── */
            <>
              {stepParsed.intro && (
                <div className="qcard">
                  <div className="qcard-text"><MathText block cap>{stepParsed.intro}</MathText></div>
                </div>
              )}
              <ol className="steps">
                {stepParsed.steps.slice(0, stepReveal).map((st, i) => (
                  <li
                    key={i}
                    className="step-card"
                    data-answered={(st.yesNo && !!stepAns[i]) || undefined}
                  >
                    <span className="step-num num" aria-hidden>{i + 1}</span>
                    <div className="step-body">
                      <div className="step-text"><MathText cap>{st.text}</MathText></div>
                      {st.yesNo && (
                        <div className="step-yn" role="group" aria-label={`${st.label}: chọn Có hoặc Không`}>
                          {["Có", "Không"].map((v) => (
                            <button
                              key={v}
                              type="button"
                              className="step-pill"
                              aria-pressed={stepAns[i] === v}
                              disabled={busy || verdict != null}
                              onClick={() => setStepAns((a) => ({ ...a, [i]: v }))}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      )}
                      {/* LỖI 17 — ô KẾT LUẬN nằm NGAY TRONG bước cuối, không còn
                          rơi xuống đáy trang. Trước đây làm sai một lần là phải
                          cuộn lên đầu sửa Có/Không rồi cuộn xuống cuối gõ lại
                          kết luận (người thử 3 báo 29/07). Giờ cả chuỗi suy luận
                          nằm gọn một chỗ. */}
                      {/* LỖI #11 — MỖI bước không-phải-Có/Không có Ô RIÊNG của
                          nó, không chỉ bước cuối. 45/46 câu nhiều bước trong
                          ngân hàng không viết theo khuôn "(Có/Không)" nên trước
                          đây chúng hiện ba thẻ bước mà KHÔNG thẻ nào trả lời
                          được, còn ô gõ duy nhất thì nằm tận dưới khung đối
                          thoại — đúng thứ người thử 2 gọi là "hiện ra 3 ý nhưng
                          không rõ yêu cầu". */}
                      {!st.yesNo && (
                        <textarea
                          className="ans-input step-input"
                          rows={1}
                          placeholder={
                            i === stepParsed.steps.length - 1
                              ? "Kết luận của em…"
                              : `Trả lời ${st.label.toLowerCase()}…`
                          }
                          value={stepText[i] ?? ""}
                          disabled={busy || verdict === "retry"}
                          onChange={(e) => {
                            const v = e.target.value;
                            setStepText((m) => ({ ...m, [i]: v }));
                            const el = e.currentTarget;
                            el.style.height = "auto";
                            el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter" || e.shiftKey) return;
                            e.preventDefault();
                            if (canCheck && !busy) check();
                          }}
                          inputMode="text"
                          enterKeyHint="go"
                          autoComplete="off"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              {stepInteractive && stepReveal < stepParsed.steps.length && (
                <p className="step-more muted">Chọn Có hoặc Không để mở bước tiếp theo…</p>
              )}
            </>
          ) : !interactiveShown ? (
            <div className="qcard">
              {/* Đề có công thức → cỡ chữ lớn hơn; câu chữ thường (tiếng Anh,
                  đọc hiểu) giữ sans 15/1.5. Chữ nghiêng serif của hi-fi cũ đã
                  BỎ: KaTeX lo phần công thức, còn câu tiếng Việt in nghiêng
                  suốt dòng thì rất khó đọc. */}
              {letterMCQ ? (
                <div className="qcard-stem"><MathText block cap>{xuongDongTungY(letterMCQ.stem)}</MathText></div>
              ) : quoteParsed ? (
                /* Đề có LỜI TRÍCH ('bạn ấy nói/viết…') → lời trích đứng thẻ
                   riêng, đề bao quanh — em phân biệt được ĐÂU là lời cần soi
                   lỗi, đâu là yêu cầu của đề. */
                <>
                  {quoteParsed.pre && (
                    <div className="qcard-text"><MathText block cap>{quoteParsed.pre}</MathText></div>
                  )}
                  <blockquote className="qquote">
                    <MathText block>{quoteParsed.quote}</MathText>
                  </blockquote>
                  {quoteParsed.post && (
                    <div className="qcard-text qq-post"><MathText block cap>{quoteParsed.post}</MathText></div>
                  )}
                </>
              ) : mathy(q.prompt) ? (
                /* Đề trắc nghiệm có kèm "Giải thích ngắn." (soạn cho bản giấy)
                   nhưng màn chỉ có 4 nút chọn — bỏ câu đó kẻo em tìm ô viết
                   không thấy (audit 04/09). Áp cho cả nhánh chữ thường bên dưới. */
                <div className="qcard-expr">
                  <MathText block cap>
                    {q.options ? q.prompt.replace(/\s*Giải thích ngắn\.?/gi, "") : q.prompt}
                  </MathText>
                </div>
              ) : (
                <div className="qcard-text">
                  <MathText block cap>
                    {xuongDongTungY(q.options ? q.prompt.replace(/\s*Giải thích ngắn\.?/gi, "") : q.prompt)}
                  </MathText>
                </div>
              )}
            </div>
          ) : null}
          {orderParsed && (
            <OrderQuestion key={q.id} parsed={orderParsed} disabled={busy || verdict != null} onChange={setInteractiveAns} />
          )}
          {matchParsed && (
            <MatchQuestion key={q.id} parsed={matchParsed} disabled={busy || verdict != null} onChange={setInteractiveAns} />
          )}
          {checklistParsed && (
            <ChecklistQuestion key={q.id} parsed={checklistParsed} disabled={busy || verdict != null} onChange={setInteractiveAns} />
          )}
          {blanksParsed && (
            <BlanksQuestion key={q.id} parsed={blanksParsed} disabled={busy || verdict != null} onChange={setInteractiveAns} />
          )}
          {/* Đợt C: dạng nghe — đọc to transcript bằng Web Speech (chưa có audio_uri). */}
          {q.dangCauHoi === "nghe" && <SpeakerButton text={q.prompt} />}
        </>
      )}

      {/* Lưới đáp án luôn hiển thị (hi-fi): chọn xong tile giữ trạng thái
          selected dưới ribbon; khoá tương tác khi đang nộp / đã có kết quả. */}
      {/* Chốt an toàn: dạng tương tác đã tự dựng đề + ô trả lời → KHÔNG bao giờ
          kèm lưới đáp án (server cũng đã ngừng gửi options cho checklist). */}
      {q && q.kind === "objective" && q.options && !interactiveShown && (
        letterMCQ ? (
          /* Đáp án là chữ cái + text trong đề → nút = nhãn A/B/C/D + text, mỗi dòng,
             giá trị chọn là CHỮ CÁI (khớp dap_an). */
          <div className="ans-grid lettered">
            {letterMCQ.opts.map((o) => (
              <button
                key={o.letter}
                className="ans-tile lettered"
                aria-pressed={picked === o.letter}
                aria-label={`${o.letter}. ${o.text.replace(/\$/g, "")}`}
                data-wrong={(verdict === "retry" && picked === o.letter) || undefined}
                disabled={busy || verdict != null}
                onClick={() => setPicked(o.letter)}
              >
                <span className="ans-letter">{o.letter}.</span>
                <span className="ans-otext"><MathText cap>{o.text}</MathText></span>
              </button>
            ))}
          </div>
        ) : (
          <div className={`ans-grid${stackOptions(q.options) ? " stack" : ""}`}>
            {q.options.map((opt) => (
              <button
                key={opt}
                className="ans-tile num"
                aria-pressed={picked === opt}
                aria-label={opt.replace(/\$/g, "")}
                data-wrong={(verdict === "retry" && picked === opt) || undefined}
                disabled={busy || verdict != null}
                onClick={() => setPicked(opt)}
              >
                <MathText cap>{opt}</MathText>
              </button>
            ))}
          </div>
        )
      )}

      {/* dung_sai: hai nút Đúng / Sai thay vì gõ tay. */}
      {q && isTrueFalse && verdict !== "ok" && (
        <div className="ans-grid tf">
          {["Đúng", "Sai"].map((v) => (
            <button
              key={v}
              className="ans-tile"
              aria-pressed={picked === v}
              disabled={busy || verdict != null}
              onClick={() => setPicked(v)}
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {/* Đề nhiều bước tương tác: ô gõ CHỈ mở khi đã trả lời hết các bước
          Có/Không (và bước cuối là bước cần viết kết luận). */}
      {/* Ô nhập ĐỘC LẬP — chỉ cho câu KHÔNG phải nhiều-bước-tương-tác. Câu nhiều
          bước đã có ô kết luận nằm trong bước cuối (lỗi 17). */}
      {q && q.kind === "objective" && !q.options && !isTrueFalse && !interactiveShown && verdict !== "ok" &&
        (!stepParsed || !stepInteractive) && (
        verdict === "retry" ? (
          /* LỖI #25 — HAI KHUNG NHẬP, người thử 1 đợt 2 tự chấm "chặn hẳn":
             "có hai khung chat để điền đáp án… học sinh sẽ điền vào khung nào?"
             Trước đây lúc thử lại ô này VẪN VẼ RA, chỉ `disabled` — mà app
             không hề có kiểu :disabled cho ô nhập, nên nó trông y hệt một ô
             đang sống, lại nằm cạnh ô "kể cách em nghĩ" dùng CHUNG bộ CSS.
             Hai ô giống hệt nhau, ô ghi "đáp án" thì gõ không được.
             Nay lúc thử lại nó KHÔNG còn là ô nhập nữa mà là một BẢN GHI những
             gì em đã trả lời — trên màn chỉ còn đúng MỘT chỗ gõ được. */
          <div className="ans-daghi" role="status">
            <span className="ans-daghi-nhan">Em đã trả lời</span>
            <span className="ans-daghi-noi"><MathText>{daTraLoi ?? text}</MathText></span>
          </div>
        ) : (
        /* Ô TỰ CAO DẦN, không phải ô một dòng: cùng một dạng "nhập đáp án" có câu
           chỉ điền một cụm từ, có câu đòi giải thích cả đoạn (đáp án mẫu dài trên
           200 chữ). Ô một dòng làm học sinh gõ đoạn dài mà không thấy mình viết
           gì. Bắt đầu bằng ĐÚNG một dòng nên câu ngắn trông y như cũ.
           Enter = nộp (giữ thói quen cũ); Shift+Enter = xuống dòng. */
        <textarea
          key={q.id} /* câu mới → dựng lại ô, xoá chiều cao đã nới của câu trước */
          className="ans-input"
          rows={1}
          placeholder={stepParsed && stepInteractive ? "Kết luận của em…" : "Nhập đáp án của bạn…"}
          value={text}
          disabled={busy}
          /* KHÔNG autoFocus ở câu NHIỀU BƯỚC: ô này nằm dưới 3 ô bước, focus vào
             là trình duyệt cuộn thẻ xuống đáy, che mất ĐỀ BÀI ngay lúc câu vừa
             hiện (audit 04/09, tái hiện 2 lần). Câu gõ đáp án đơn thì giữ. */
          autoFocus={!stepParsed}
          onChange={(e) => {
            setText(e.target.value);
            if (session?.user.id) luuNhap(session.user.id, q.id, e.target.value); // sống qua cả lần văng/tải lại trang
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.shiftKey) return;
            e.preventDefault(); // không chèn xuống dòng rồi mới nộp
            if (canCheck && !busy) check();
          }}
          /* Bàn phím KHÔNG sửa hộ đáp án ("2x" không được thành chữ khác) */
          inputMode="text"
          enterKeyHint="go"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        )
      )}

      {q && q.kind === "writing" && verdict == null && (
        <div>
          <textarea
            rows={4}
            placeholder="Viết bài của bạn ở đây (3–4 câu)…"
            value={text}
            disabled={busy}
            onChange={(e) => setText(e.target.value)}
            /* Bài viết là của HỌC SINH — máy không sửa chính tả hộ */
            autoCapitalize="sentences"
            autoCorrect="off"
            spellCheck={false}
          />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" disabled={busy || !text.trim()} data-loading={busy || undefined} onClick={submitWriting}>
              Nộp bài viết
            </button>
            <span className="muted">Góp ý để bạn tự sửa — không phải điểm chính thức.</span>
          </div>
        </div>
      )}

      {/* NỘP BÀI — câu tự luận dài. Từ 01/08 AI chấm hẳn, nên cả ba đường vào
          đều dẫn tới cùng một kết quả ngay tại chỗ: gõ (có ô công thức), tệp
          Word, hoặc ảnh bài viết tay. Hiện cả khi verdict='retry' để em sửa bài
          theo góp ý rồi nộp lại. */}
      {q && q.kind === "nop_bai" && verdict !== "ok" && verdict !== "submitted" && (
        <div className="submit-box">
          <BaiLamEditor
            key={q.id} /* câu mới → ô mới, xoá chiều cao đã nới của câu trước */
            value={text}
            onChange={(v) => { setText(v); if (session?.user.id) luuNhap(session.user.id, q.id, v); }}
            disabled={busy}
          />
          <div className="submit-row">
            <label className="submit-attach" data-locked>
              <input
                className="sr-only"
                type="file"
                /* .pdf và .doc cũ CỐ Ý không còn trong danh sách: server đọc
                   không ra hai định dạng đó, nhận vào rồi báo hỏng ở bước sau
                   thì em mất công tải lên một lượt mới biết. */
                accept="image/*,.docx,.txt"
                /* Điện thoại: mở thẳng camera sau thay vì thư viện ảnh. */
                capture="environment"
                /* KHOA (14/08, chu du an): server chua doc duoc anh/tep nen
                   nhan vao la hua suong. Khoa han thay vi de bam roi bao hong
                   o buoc sau. KHONG kem ghi chu giai thich - chu du an chot vay. */
                disabled
                onChange={(e) => {
                  setWorkFile(e.target.files?.[0] ?? null);
                  setError(null);
                }}
              />
              <Paperclip aria-hidden strokeWidth={2.25} />
              <span>
                {workFile
                  ? `${workFile.name} (${Math.round(workFile.size / 1024)} KB)`
                  : "Nộp ảnh bài viết tay hoặc tệp Word"}
              </span>
            </label>
            {workFile && (
              <button type="button" className="submit-unattach" onClick={() => setWorkFile(null)} aria-label="Gỡ tệp">
                <X aria-hidden strokeWidth={2.5} />
              </button>
            )}
          </div>
          <p className="muted submit-note">
            Nộp xong là biết kết quả ngay. Chưa đạt thì mình nói rõ còn thiếu ý nào — sửa rồi nộp
            lại bao nhiêu lần cũng được.
          </p>
        </div>
      )}

      {q && q.kind === "speaking" && verdict == null && <SpeakBox disabled={busy} onTranscript={submitSpeaking} />}

      {/* Đợt B: bảng điểm rubric theo kỹ năng — formative, không phải điểm chính thức. */}
      {rubricResult && (
        <div className="rubric-card" role="status">
          <div className="rc-head">
            <b>Điểm {rubricResult.ten}</b>
            <span className="rc-total num">{rubricResult.tong}/{rubricResult.toi_da}</span>
            <span className="rc-band">{rubricResult.muc}</span>
          </div>
          <ul className="rc-list">
            {rubricResult.scores.map((sc) => (
              <li key={sc.tieu_chi} className="rc-row">
                <div className="rc-crit">
                  <span className="rc-name">{sc.tieu_chi}</span>
                  <span className="rc-score num">{sc.diem}/3</span>
                </div>
                <div className="rc-bar" aria-hidden>
                  {/* KHÔNG đơn vị: CSS chạy scaleX(var(--v)) thay vì animate width. */}
                  <i style={{ "--v": sc.diem / 3 } as React.CSSProperties} />
                </div>
                {sc.nhan_xet && <p className="rc-note">{sc.nhan_xet}</p>}
              </li>
            ))}
          </ul>
          {rubricResult.nhan_xet_chung && <p className="rc-overall">{rubricResult.nhan_xet_chung}</p>}
          {rubricResult.cau_hoi_sua && (
            <p className="rc-coach">
              <ArrowRight aria-hidden strokeWidth={2.5} />
              <span>{rubricResult.cau_hoi_sua}</span>
            </p>
          )}
          <p className="rc-foot">Góp ý để bạn tự tiến bộ — không phải điểm chính thức.</p>
        </div>
      )}


      {/* Góp ý chung về bài (nút nổi) — góp ý riêng từng câu sư tử nằm ở bong bóng */}
      <GopYFab onOpen={() => setGopY({ page: "lesson", subject, nodeKey: q?.nodeKey ?? ses?.node ?? null, questionId: q?.id ?? null })} />
      <GopYSheet ctx={gopY} onClose={() => setGopY(null)} />

      {/* Thông báo trong bài = cùng pop-up như ngoài lộ trình (05/09) */}
      <Sheet open={!!error} onClose={() => setError(null)} title="Sư tử nhắn bạn">
        <div className="tb-pop">
          <Lion mood="think" size={96} decorative />
          <p className="tb-loi">{error}</p>
          <button className="btn btn-block" data-autofocus onClick={() => setError(null)}>
            Đã hiểu
          </button>
        </div>
      </Sheet>

        </div>

        {/* CỘT CHAT — 1/3 bên phải trên màn rộng (chủ dự án 11/08).
            Trước đây khung đối thoại nằm LỌT GIỮA dòng chảy của đề bài, còn ô
            nhập thì CHỈ tồn tại ở footer trạng thái "trả lời sai". Hậu quả đúng
            như báo: bấm "Bí quá? Xin sư tử gợi ý" thì sư tử đáp, mà em KHÔNG có
            chỗ nào để nói lại — đối thoại một chiều cho tới khi em trả lời sai
            một lần. Nay chat là một CỘT RIÊNG, ô nhập sống ở MỌI trạng thái. */}
        <aside className="lsn-chat">
          <header className="chat-head">
            <span className="chat-head-ava" aria-hidden>
              <Lion mood="idle" size={30} decorative />
            </span>
            <div>
              <b>Nói chuyện với sư tử</b>
              <span>
                {verdict === "ok"
                  ? "Xong câu này rồi — hẹn bạn ở câu sau nhé"
                  : attempts === 0
                  ? "Mở sau khi bạn thử một lần"
                  : "Chỗ này không chấm đáp án, cứ kể cách bạn nghĩ"}
              </span>
            </div>
          </header>

        <div className="thread" ref={threadRef} aria-live="polite">
          {msgs.map((m, i) =>
            m.role === "student" ? (
              <div key={i} className="bubble student">
                <div className="who">BẠN</div>
                <MathText>{m.text}</MathText>
              </div>
            ) : m.role === "tutor" ? (
              <div key={i} className="bubble">
                <div className="who">TUTOR</div>
                <MathText>{m.text}</MathText>
                {/* Góp ý ĐÚNG câu này — app kèm luôn lời sư tử, em chỉ gõ cảm nhận */}
                <button
                  type="button"
                  className="gy-bubble"
                  aria-label="Góp ý về câu này của sư tử"
                  title="Góp ý về câu này"
                  onClick={() => setGopY({ page: "lesson", subject, nodeKey: q?.nodeKey ?? ses?.node ?? null, questionId: q?.id ?? null, tutorText: m.text })}
                >
                  Góp ý
                </button>
              </div>
            ) : m.role === "gate" || m.role === "hint" ? (
              /* MASCOT ĐÃ RA KHỎI KHUNG CHAT (chủ dự án 13/08): trước đây mỗi
                 lời sư tử kéo theo một con sư tử 52–92px đứng cạnh, ăn gần nửa
                 bề ngang một cột hẹp và đẩy khung dài ra. Nhận diện nhân vật đã
                 nằm ở icon tròn trên đầu khung rồi — trong luồng chỉ cần bong
                 bóng. Cổng nỗ lực (`gate`) vẫn khác màu để đọc ra được là luật
                 chơi chứ không phải gợi ý. */
              <div key={i} className="hint-bubble" data-gate={m.role === "gate" || undefined}>
                <MathText>{m.text}</MathText>
              </div>
            ) : (
              <div key={i} className="feedback">
                <MathText>{m.text}</MathText>
              </div>
            ),
          )}
          {loading && (
            /* Chờ chấm/gợi ý. Sư tử 64px đã gỡ (13/08) — trong khung chat hẹp nó
               là thứ to nhất màn hình chỉ để nói "đợi tí". Còn lại ba chấm gõ
               phím, đúng ngôn ngữ của một khung tin nhắn. */
            <div className="think-wrap">
              <span className="think-label">Đang nghĩ<i className="think-dots" aria-hidden /></span>
            </div>
          )}
        </div>

          {/* CỔNG NỖ LỰC Ở NGAY TRÊN MẶT (chủ dự án chốt 11/08): chưa thử lần
              nào thì KHOÁ hẳn ô chat, thay bằng lời mời chọn đáp án.
              Trước đây ô vẫn gõ được, chỉ có server từ chối gợi ý — em gõ xong,
              chờ, rồi nhận một câu "thử trước đã". Ba nhịp để nói một điều mà
              nhìn là biết. Khoá ở đây KHÔNG thay thế cổng server (nó vẫn là
              chốt thật, client sửa được); đây là nói thật trạng thái, đúng
              nguyên tắc "mở ra là học được" — đừng mời gọi rồi từ chối. */}
          {verdict === "ok" ? (
            /* ĐÚNG RỒI THÌ KHOÁ CHAT (chủ dự án chốt 19/08, lỗi #32): sư tử đã
               khen một câu trong luồng — nói thêm là máy cổng-nỗ-lực bên server
               tưởng em đang kẹt và quay ra tra hỏi chính đáp án đúng. Câu đã
               xong thì không còn gì để gỡ; chỉ chờ nút TIẾP TỤC. */
            <div className="chat-locked">
              <p>
                Câu này xong rồi! Bấm <b>TIẾP TỤC</b> để qua câu mới nhé.
              </p>
            </div>
          ) : attempts === 0 ? (
            <div className="chat-locked">
              {/* Lời mời theo ĐÚNG dạng câu (audit 04/09: câu tự luận vẫn bị nhắc
                  "chọn một đáp án"). */}
              <p>
                Bạn đọc đề và{" "}
                <b>
                  {interactiveShown
                    ? "trả lời từng ý"
                    : isTrueFalse || q?.options
                      ? "chọn một đáp án"
                      : "viết câu trả lời của mình"}
                </b>{" "}
                trước nhé. Thử xong mình mở chỗ này ra, rồi cùng gỡ.
              </p>
            </div>
          ) : (
          <div className="chat-compose">
            <input
              className="reflect-input"
              type="text"
              value={reflectText}
              disabled={busy}
              placeholder="Kể cách bạn nghĩ cho sư tử nghe…"
              onChange={(e) => setReflectText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && reflectText.trim() && !busy) void sendReflect();
              }}
              autoComplete="off"
              autoCapitalize="sentences"
            />
            <button
              type="button"
              className="btn btn-ghost reflect-send"
              disabled={busy || !reflectText.trim()}
              onClick={() => void sendReflect()}
            >
              Gửi
            </button>
            <button
              type="button"
              className="btn btn-ghost reflect-hint"
              disabled={busy}
              title="Xin sư tử một câu gợi mở — kể cách nghĩ trước thì gợi ý mới sâu dần"
              /* Chuỗi mồi CỐ Ý không chứa từ lập luận ("bước", "vì", "suy ra"):
                 server chấm chất lượng suy nghĩ theo nội dung, nên một chuỗi sẵn
                 mà nghe như đang lập luận sẽ mở cổng nỗ lực bằng một cú bấm.
                 Server cũng đã tự chặn (isHelpRequest → 0 điểm). */
              onClick={() => void sendReflect(reflectText.trim() || "Mình chưa biết làm, gợi ý giúp mình với")}
            >
              <Lightbulb aria-hidden strokeWidth={2.25} />
              Xin gợi ý
            </button>
          </div>
          )}
        </aside>

        {/* Đệm cho footer cố định — nội dung cuối không bao giờ bị che.
            ĐỨNG SAU CỘT CHAT (13/08). Trước đây nó nằm cuối cột bài học, tức là
            TRƯỚC khung chat trong dòng chảy màn hẹp — nên băng-rôn "Chưa đúng —
            thử lại nhé" đè thẳng lên ô nhập cùng hai nút Gửi / Xin gợi ý, cuộn
            hết trang cũng không moi ra được. Ở màn rộng khung bài học đã đứng
            yên và tự chừa chỗ cho băng-rôn, nên đệm này ẩn đi (xem globals.css). */}
        <div className="lesson-pad" aria-hidden />
      </div>

      {/* Footer 2 trạng thái (hi-fi): trắng + KIỂM TRA khi đang làm;
          ribbon ok-tint / warn-tint khi có kết quả. Sai = hổ phách, KHÔNG đỏ. */}
      {q && verdict == null && q.kind === "objective" && (
        <div className="lfoot">
          <div className="lfoot-inner">
            <button
              className="btn btn-block btn-check"
              disabled={busy || !canCheck}
              data-loading={busy || undefined}
              onClick={check}
            >
              KIỂM TRA
            </button>
            {/* Nút mờ thì NÓI VÌ SAO (audit 04/09: câu nhiều bước phải điền đủ 4
                ô mới sáng, bấm không phản hồi, không dòng nào giải thích). Sau
                khi nộp mà chưa đủ ý, lời nhắc cũng đứng NGAY ĐÂY thay vì chỉ
                nằm trong khung chat cách xa nút vừa bấm. */}
            {/* LUÔN render (kể cả rỗng) để thanh KIỂM TRA không đổi chiều cao khi
                dòng gợi ý xuất hiện/biến mất — audit lượt 2 đo được nút nhảy 40px. */}
            <p className="lfoot-note" aria-live="polite">{footNote ?? lyDoKhoa ?? ""}</p>
            {/* Nút "Bí quá? Xin sư tử gợi ý" ĐÃ CHUYỂN sang cột chat (11/08):
                ở đó nó đứng cạnh ô nhập, nên xin gợi ý xong là NÓI LẠI ĐƯỢC
                ngay. Để lại đây thì em bấm được một nhát rồi cụt đường. */}
          </div>
        </div>
      )}

      {/* Nộp bài: sáng khi có bài GÕ hoặc có tệp đính kèm. Hiện CẢ khi AI bảo
          còn thiếu ý (verdict='retry') — bài gõ vẫn nguyên trong ô, em bổ sung
          rồi nộp lại ngay. Thiếu nhánh này là em kẹt: ô nhập còn đó mà không
          còn nút nào để nộp. */}
      {q && q.kind === "nop_bai" && (verdict == null || verdict === "retry") && (
        <div className="lfoot">
          <div className="lfoot-inner">
            {verdict === "retry" && (
              /* Sư tử "suy nghĩ" (head-think) ĐÃ VỨT HẲN (chủ dự án 13/08) —
                 khối cũ cao 216px, hơn một phần tư màn hình chỉ để nói một câu
                 nhắc. Một dòng icon + chữ là đủ, và khớp luôn với băng-rôn
                 "Chưa đúng — thử lại nhé" ngay bên dưới. */
              <div className="lfoot-row">
                <RefreshCw aria-hidden strokeWidth={2.5} />
                <b className="lfoot-title">Bổ sung thêm ý rồi nộp lại nhé!</b>
              </div>
            )}
            <button
              className="btn btn-block btn-check"
              disabled={busy || (!text.trim() && !workFile)}
              data-loading={busy || undefined}
              onClick={submitWorkFile}
            >
              {verdict === "retry" ? "NỘP LẠI" : "NỘP BÀI"}
            </button>
          </div>
        </div>
      )}

      {/* ĐÃ NỘP VÀ ĐẠT. Từ 01/08 `verdict='submitted'` CHỈ đặt khi bài đạt —
          chưa đạt thì rơi về 'retry' (còn ô nhập để sửa), còn chưa chấm được
          thì không đổi trạng thái. Nên ở đây không còn nhánh "chờ thầy cô" nào:
          nói thẳng là xong, và cho cái reo đúng lúc em xứng đáng nghe. */}
      {verdict === "submitted" && (
        <div className="lfoot" data-verdict="ok" role="status">
          <div className="lfoot-inner">
            <div className="lfoot-says">
              <Lion mood="cheer" size={48} decorative />
              <b className="lfoot-title">Bài đạt rồi!</b>
              {lastGain > 0 && <span className="xp-chip num">+{lastGain} XP</span>}
              <span className="muted">Mình đã ghi bài này vào lộ trình của em.</span>
            </div>
            <button className="btn btn-block" data-loading={busy || undefined} onClick={advance}>
              {last ? "HOÀN THÀNH" : "HỌC TIẾP"}
            </button>
          </div>
        </div>
      )}

      {verdict === "ok" && (
        <div className="lfoot" data-verdict="ok" role="status">
          <div className="lfoot-inner">
            {/* LỖI 10 — "đúng thì cộng XP mà không reo": trước đây màn đúng chỉ
                có một dòng chữ + dấu tích. Sư tử reo là phần thưởng tinh thần
                chính của app, không thể vắng đúng lúc em làm được. */}
            <div className="lfoot-says">
              <Lion mood="cheer" size={56} decorative />
              <b className="lfoot-title">Chính xác!</b>
              {/* XP nói THẬT: server chỉ cộng +10 ở lần thử đầu (bịt rò đoán mò),
                  nên chip phải theo số server vừa trả, không phải hằng số. */}
              {lastGain > 0 && <span className="xp-chip num">+{lastGain} XP</span>}
            </div>
            <button className="btn btn-gold btn-block" data-loading={busy || undefined} onClick={advance}>
              {last ? "HOÀN THÀNH" : "TIẾP TỤC"}
            </button>
          </div>
        </div>
      )}

      {/* FORMATIVE (viết/nói): đã gửi, chỉ có nhận xét — KHÔNG "Chính xác!", KHÔNG XP */}
      {verdict === "done" && (
        <div className="lfoot" data-verdict="done" role="status">
          <div className="lfoot-inner">
            <div className="lfoot-row">
              <CheckCircle2 aria-hidden strokeWidth={2.25} />
              <b className="lfoot-title">Đã gửi, xem nhận xét ở trên</b>
            </div>
            <button className="btn btn-block" data-loading={busy || undefined} onClick={advance}>
              {last ? "HOÀN THÀNH" : "TIẾP TỤC"}
            </button>
          </div>
        </div>
      )}

      {verdict === "retry" && q?.kind !== "nop_bai" && (
        <div className="lfoot" data-verdict="retry" role="status">
          <div className="lfoot-inner">
            {/* Dạng thao tác không có bong bóng đối thoại → sư tử có mặt ngay
                đây, nhưng là AVATAR TRÒN trên cùng dòng chữ (13/08) chứ không
                còn đứng riêng một khối cao 216px. Lời nhắc CỐ Ý không chỉ ra ý
                nào sai (không cho đáp án), chỉ đẩy học sinh soát lại. */}
            {/* "Lần thử N" (audit 04/09: không biết đang ở lượt mấy, XP nỗ lực chỉ
                hiện từ lượt 2 trông như lúc có lúc không). */}
            {isWidgetAnswer(q) ? (
              <div className="lfoot-row">
                <RefreshCw aria-hidden strokeWidth={2.5} />
                <b className="lfoot-title">Chưa đúng rồi, soát lại từng ý xem sao nhé!</b>
                <span className="lfoot-try num">Lần thử {attempts}</span>
                {attempts >= 2 && <span className="xp-chip num">+{G.XP.persistence} XP nỗ lực</span>}
              </div>
            ) : (
              <div className="lfoot-row">
                <RefreshCw aria-hidden strokeWidth={2.5} />
                <b className="lfoot-title">Chưa đúng, thử lại nhé</b>
                <span className="lfoot-try num">Lần thử {attempts}</span>
                {attempts >= 2 && <span className="xp-chip num">+{G.XP.persistence} XP nỗ lực</span>}
              </div>
            )}
            {/* Ô "kể cách nghĩ" ĐÃ CHUYỂN sang cột chat (11/08) — xem ghi chú ở
                đó. Trước đây nó chỉ sống trong đúng trạng thái NÀY, nên trước
                khi trả lời sai lần đầu thì em không có chỗ nào gõ.
                Cầu chat→chấm (gõ "chốt C" là nộp thẳng) vẫn giữ nguyên trong
                `sendReflect`, và vẫn chỉ bật ở verdict="retry". */}
            <button
              className="btn btn-block"
              onClick={() => {
                setVerdict(null);
                setPicked(null);
              }}
            >
              THỬ LẠI
            </button>
          </div>
        </div>
      )}
      </div>
    </AppShell>
  );
}

// Render toán chuyển hẳn sang KaTeX qua <MathText> (lib/mathrender) — chuẩn cho
// học sinh, thay bộ "làm đẹp" inline cũ. Đây chỉ còn cờ nhận biết đề có chất toán
// để chọn kiểu chữ serif.

/**
 * ĐỀ LIỆT KÊ "(1)… (2)… (3)…" → MỖI Ý MỘT DÒNG (14/08).
 *
 * Chủ dự án: "nó không chịu để format ra cho đẹp nhỉ, mỗi câu 1 dòng không đẹp
 * hơn à?". Đề kiểu "Trong các câu sau, có bao nhiêu câu KHÔNG phải mệnh đề?
 * (1) 2+2=5 (2) Mấy giờ rồi? (3) Số π là số vô tỉ…" nằm nguyên một khối chữ,
 * em phải tự dò xem ý nào tới ý nào — mà đây đúng là loại câu đòi soi từng ý.
 *
 * Chỉ đụng CÁCH HIỂN THỊ, KHÔNG sửa dữ liệu: chèn dấu xuống dòng trước mỗi
 * nhãn "(k)". Đòi có TỪ HAI nhãn trở lên và chúng phải chạy đúng thứ tự 1,2,3…
 * — để một câu lỡ có "(2)" giữa dòng (chú thích, số mũ) không bị bẻ oan.
 */
function xuongDongTungY(de: string): string {
  const nhan = [...de.matchAll(/\((\d{1,2})\)/g)];
  if (nhan.length < 2) return de;
  if (nhan.some((m, i) => Number(m[1]) !== i + 1)) return de;
  // Ngắt trước MỌI nhãn, kể cả "(1)" — nó thường dính đuôi câu dẫn ("…mệnh đề?
  // (1) 2+2=5"). Chỉ bỏ qua nhãn nằm ngay đầu chuỗi, kẻo đẻ ra một dòng trống.
  return nhan.filter((m) => de.slice(0, m.index!).trim() !== "").reduceRight(
    (t, m) => t.slice(0, m.index!).replace(/\s+$/, "") + "\n" + t.slice(m.index!),
    de,
  );
}

/** Eyebrow trên thẻ câu hỏi — lệnh làm bài theo dạng câu (hi-fi 3b). */
function kindEyebrow(q: DiagnoseQuestion): string {
  if (q.kind === "nop_bai") return "Bài tự luận — gõ bài làm hoặc nộp ảnh";
  if (q.kind === "writing") return "Viết câu trả lời";
  if (q.kind === "speaking") return "Luyện nói tiếng Anh";
  if (q.dangCauHoi === "dung_sai") return "Đúng hay Sai?";
  if (q.dangCauHoi === "sap_xep") return "Sắp xếp đúng thứ tự";
  if (q.dangCauHoi === "noi_cot") return "Nối cột cho đúng";
  // Checklist nhận diện ở SERVER (dữ liệu gắn nhãn "mcq") → xét interactive, và
  // phải xét TRƯỚC q.options kẻo rơi nhầm vào nhãn "Chọn đáp án đúng".
  if (q.interactive?.checklist) return "Đúng hay Sai cho từng ý?";
  if (q.options) return "Chọn đáp án đúng";
  // Đề có chỗ trống "___" → nói rõ đang ĐIỀN, không phải trả lời tự do.
  if (/_{2,}/.test(q.prompt ?? "")) return "Điền vào chỗ trống";
  return "Nhập đáp án của bạn";
}

/**
 * THẾ GIỚI (0–8) của bài đang làm — sắc trời cho sân khấu bài tập.
 *
 * Dùng ĐÚNG cách chia chặng của LearningPath: node liền nhau cùng `chapter` là
 * một chặng, chỉ số chặng % 9 = thế giới. Nhờ vậy em vừa đứng ở đồng cỏ trên lộ
 * trình thì mở bài ra cũng là ánh đồng cỏ — vào bài không "teleport" sang một
 * bầu trời khác. Không có lộ trình / không tìm thấy node → thế giới 0 (thảo
 * nguyên, nhà của sư tử), không bao giờ trả undefined.
 */
function worldOfLesson(
  path: { key: string; chapter?: string }[] | null,
  nodeKey: string | null,
): number {
  if (!path?.length || !nodeKey) return 0;
  const at = path.findIndex((n) => n.key === nodeKey);
  if (at < 0) return 0;
  let leg = 0;
  for (let i = 1; i <= at; i++) {
    const now = path[i]?.chapter?.trim() ?? "";
    const prev = path[i - 1]?.chapter?.trim() ?? "";
    if (now !== prev) leg++;
  }
  return leg % 9;
}

/**
 * CẦU CHAT→CHẤM (lỗi 20) — nhận diện ĐÁP ÁN CUỐI gõ vào ô trò chuyện.
 *
 * Trả về chuỗi đáp án ĐÚNG KHUÔN máy chấm: chữ cái cho câu A/B/C/D, nguyên văn
 * phương án cho câu thường, "Đúng"/"Sai" cho dung_sai. Trả null = đây là lời
 * KỂ, đi đường đối thoại như cũ.
 *
 * Luật bắt CHẶT có chủ đích: cả câu phải thực chất chỉ là đáp án, cho phép vài
 * từ đệm ("chốt", "chọn", "mình", "đáp án", "câu", "là"). Câu có lập luận kèm
 * theo KHÔNG bắt — em đang kể cách nghĩ, sư tử phải được nghe. Thà bỏ sót (em
 * bấm ô như cũ) còn hơn bắt nhầm lời kể thành lượt nộp.
 */
function chatAnswerOf(msg: string, q: DiagnoseQuestion): string | null {
  if (q.kind !== "objective") return null;
  const norm = (x: string) =>
    x.toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[.!,;:"'“”]/g, " ").replace(/\s+/g, " ").trim();
  const m = norm(msg);
  if (!m) return null;
  // Đúng/Sai: "đúng", "chốt sai", "mình chọn đúng"…
  if (q.dangCauHoi === "dung_sai") {
    const t = m.replace(/\b(minh|chot|chon|dap|an|cau|la)\b/g, " ").replace(/\s+/g, " ").trim();
    if (t === "dung") return "Đúng";
    if (t === "sai") return "Sai";
    return null;
  }
  if (!q.options?.length) return null;
  // Nguyên văn một phương án ("(2; 1)") — so sau chuẩn hoá.
  const hit = q.options.find((o) => norm(o) === m);
  if (hit) return hit;
  // Một CHỮ CÁI, cho phép từ đệm: "c" / "chốt C" / "mình chọn câu c"…
  const toks = m.split(" ").filter(
    (t) => !["minh", "chot", "chon", "dap", "an", "cau", "la", "phuong"].includes(t),
  );
  if (toks.length !== 1 || !/^[a-d]$/.test(toks[0]!)) return null;
  const letter = toks[0]!.toUpperCase();
  // Câu chữ-cái (options là ["A","B","C","D"]) → nộp chính chữ cái đó (khớp
  // dap_an server). Câu thường → chữ cái đọc theo THỨ TỰ ô (A = ô đầu).
  const lettered = q.options.every((o) => /^[A-DĐ]$/.test(o.trim()));
  if (lettered) return q.options.find((o) => o.trim().toUpperCase() === letter) ?? null;
  return q.options[letter.charCodeAt(0) - 65] ?? null;
}

/** Đề có "chất toán" (công thức, biến, so sánh) → cỡ chữ đề lớn hơn. */
const mathy = (s: string) => /[=^_\\$±≤≥√²³]/.test(s ?? "");

/**
 * Câu trả lời bằng THAO TÁC — chọn Đúng/Sai từng ý, kéo–thả xếp thứ tự, nối cột,
 * điền ô. Dạng này KHÔNG mở đối thoại, vì hai lẽ:
 *  · Lựa chọn của học sinh đã hiện rõ ngay trên widget → lặp lại chuỗi máy
 *    ("a:dung,b:dung,c:dung,d:dung") thành bong bóng chat vừa thừa vừa khó đọc.
 *  · Màn hình dạng này KHÔNG có ô gõ chữ → hỏi "em đã nghĩ thế nào?" là hỏi vào
 *    chỗ học sinh không có cách nào trả lời. Sai thì cho thử lại, thế thôi.
 */
const isWidgetAnswer = (x: DiagnoseQuestion | null | undefined) =>
  !!(x?.interactive?.order || x?.interactive?.match || x?.interactive?.checklist || x?.interactive?.blanks);

/** Một bước trong đề nhiều bước. `yesNo` = bước chọn Có/Không (có "(Có/Không)"). */
interface StepItem { label: string; text: string; yesNo: boolean }

/** Tách đề "Bước 1: … Bước 2: …" (hoặc "B1: … B2: …") thành thẻ từng bước.
 *  Nhét cả chuỗi suy luận vào MỘT câu văn là đề khó đọc nhất app (phản hồi
 *  27/07) — bày từng bước mới dạy được cách NGHĨ tuần tự. Đòi dãy số tăng dần
 *  bắt đầu từ 1 để không vồ nhầm "B2" là tên điểm hình học giữa câu. */
function parseSteps(prompt: string): { intro: string; steps: StepItem[] } | null {
  const text = prompt ?? "";
  const re = /(?:Bước|B)\s?(\d)\s*:\s*/g;
  const marks: { num: number; start: number; textStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (marks.length === 0 && Number(m[1]) !== 1) continue; // dãy phải mở bằng 1
    if (marks.length > 0 && Number(m[1]) !== marks[marks.length - 1]!.num + 1) continue;
    marks.push({ num: Number(m[1]), start: m.index, textStart: re.lastIndex });
  }
  if (marks.length < 2) return null;
  const steps: StepItem[] = marks.map((mk, i) => {
    const raw = text.slice(mk.textStart, marks[i + 1]?.start).trim();
    return {
      label: `Bước ${mk.num}`,
      // "(Có/Không)" là chỉ dẫn trả lời — nút bấm thay nó, khỏi hiện chữ thừa.
      text: raw.replace(/\(\s*Có\s*\/\s*Không\s*\)/gi, "").replace(/\s{2,}/g, " ").trim(),
      yesNo: /\(\s*Có\s*\/\s*Không\s*\)/i.test(raw),
    };
  });
  if (steps.some((s) => !s.text)) return null;
  return { intro: text.slice(0, marks[0]!.start).trim(), steps };
}

/** Tách LỜI TRÍCH ('câu bạn ấy nói/viết') ra khỏi đề — hiện thành thẻ riêng cho
 *  dễ đọc.
 *
 *  Bản đầu chỉ đòi "đoạn nháy đơn ≥20 ký tự" và vồ nhầm hàng loạt: đề Toán 10
 *  dùng nháy đơn cho ĐỘ PHÚT (25°30'), cho ĐIỂM PHẨY (A', B'), và cho từ nhấn
 *  mạnh ('lớn', 'có số') — hai dấu nháy bất kỳ cách nhau ≥20 ký tự là đề bị xé
 *  đôi, phần GIỮA (thật ra là thân đề) thành "lời trích" vô nghĩa.
 *
 *  Bản này đòi đủ bốn dấu hiệu của một câu được trích thật:
 *    · đề có ĐÚNG một cặp nháy (số dấu nháy = 2) — nhiều hơn là ký hiệu toán;
 *    · dấu mở không dính chữ/số phía trước (chặn A', 30°15', don't);
 *    · nội dung trích có khoảng trắng và KHÔNG mở đầu bằng chữ thường hay dấu
 *      câu (dấu hiệu cắt trúng giữa câu). Mở bằng ∀, ∃, số… thì vẫn nhận —
 *      58/410 lời trích của ngân hàng là mệnh đề toán mở đầu bằng ký hiệu;
 *    · phần đề còn lại (trước hoặc sau) không rỗng — trích mà nuốt cả đề thì
 *      chẳng còn gì để tách. */
function splitQuote(prompt: string): { pre: string; quote: string; post: string } | null {
  const p = prompt ?? "";
  if ((p.match(/'/g) ?? []).length !== 2) return null;
  const m = /(^|[\s(:—-])'([^']{20,500})'/.exec(p);
  if (!m) return null;
  const quote = m[2]!.trim();
  if (!/\s/.test(quote) || /^[\p{Ll}.,;:)]/u.test(quote)) return null;
  const at = m.index + m[1]!.length;
  const pre = p.slice(0, at).trim();
  const post = p.slice(at + m[2]!.length + 2).trim().replace(/^[.,;]\s*/, "");
  if (!pre && !post) return null;
  return { pre, quote, post };
}

/** Đáp án dài (một câu, một mệnh đề) thì xếp 1 cột cho dễ đọc; đáp án ngắn
 *  ("Elip", "12 cm") xếp 2 cột cân đối — 4 phương án thành ô vuông 2×2, không
 *  còn cảnh 3 ô một hàng rồi 1 ô lạc lõng hàng dưới. */
const stackOptions = (opts: string[]) =>
  opts.length < 2 || opts.some((o) => (o ?? "").trim().length > 26);

/** Đề MCQ kiểu "STEM: A. … B. … C. … D. …" với đáp án là CHỮ CÁI (dap_an/distractors
 *  = "A".."D", text phương án nằm TRONG đề). Tách đề + text từng phương án theo nhãn.
 *
 *  Bản trước đòi nhãn phải đứng ngay sau "." hoặc ":" (lookbehind) để khỏi bắt nhầm
 *  chữ "B." giữa câu. Giả định đó SAI với nội dung thật: phương án hay kết thúc bằng
 *  số hoặc ký hiệu — "A. < 50 B. ≤ 50", "A. {3} B. {−3; 3}", "…ℤ ⊂ ℚ ⊂ ℝ B. …" — nên
 *  59/79 câu không tách được và học sinh chỉ thấy 4 nút trơ "A B C D".
 *
 *  Cách mới: ta ĐÃ BIẾT cần tìm nhãn nào (chính là các phương án), nên đi tìm đúng
 *  DÃY nhãn đó theo THỨ TỰ TĂNG DẦN, mỗi nhãn tìm từ sau nhãn trước. Một chữ "B."
 *  lạc giữa câu không dựng nổi dãy A→B→C→D nên vẫn bị loại.
 *
 *  Nhưng "đứng sau khoảng trắng" thôi thì vẫn vớ nhầm khi chữ cái ĐÓ nằm cuối
 *  phương án trước:
 *      "A. Mọi phần tử của A đều thuộc B.  B. Mọi phần tử của B đều thuộc A."
 *                                     ↑ bắt vào đây → A cụt, B lặp nhãn
 *      "A. n(A∪B) = n(A) + n(B)  B. …"  → bắt vào chữ B TRONG n(B)
 *  Nên đi HAI VÒNG: vòng CHẶT đòi nhãn đứng ngay sau dấu kết câu (. : ; ? !) —
 *  đúng với đề viết chuẩn; vòng chặt hụt mới nới ra như cũ, vì đề thật hay kết
 *  thúc phương án bằng số/ký hiệu ("A. < 50 B. ≤ 50") nên chẳng có dấu chấm nào.
 *  Cả hai vòng: dấu "(" chỉ MỞ NHÃN khi nó đứng đầu / sau khoảng trắng — "n(B)"
 *  là gọi hàm, không phải nhãn "(B)".
 *
 *  Đo trên toàn bộ ngân hàng sống: 79/79 tách được, 0 câu tách sai (trước có 2).
 *  Trả null nếu không phải dạng này. */
const LETTER_ORDER = ["A", "B", "C", "D", "Đ"];
// Cái đứng TRƯỚC nhãn: đầu chuỗi | sau dấu kết câu | ngoặc mở "tự do".
const MARK_STRICT = String.raw`(^|(?<=[.:;?!])\s+|(?<![^\s])[(\[])`;
const MARK_LOOSE = String.raw`(^|\s+|(?<![^\s])[(\[])`;

function markChain(
  text: string,
  want: string[],
  pre: string,
): { stem: string; opts: { letter: string; text: string }[] } | null {
  const marks: { letter: string; start: number; textStart: number }[] = [];
  let from = 0;
  for (const L of want) {
    const re = new RegExp(`${pre}(${L})[.)]\\s+`, "g");
    re.lastIndex = from;
    const m = re.exec(text);
    if (!m) return null; // thiếu một nhãn → không phải dạng chữ-cái, rơi về lưới thường
    marks.push({ letter: L, start: m.index + (m[1] ?? "").length, textStart: re.lastIndex });
    from = re.lastIndex;
  }
  const stem = text.slice(0, marks[0]!.start).trim();
  if (!stem) return null; // không còn đề → nhiều khả năng bắt nhầm
  const opts = marks.map((mk, i) => ({
    letter: mk.letter,
    text: text.slice(mk.textStart, marks[i + 1]?.start).trim(),
  }));
  if (opts.some((o) => !o.text)) return null;
  return { stem, opts };
}

function parseLetterMCQ(
  noiDung: string,
  letters: string[],
): { stem: string; opts: { letter: string; text: string }[] } | null {
  const text = noiDung ?? "";
  const want = [...new Set(letters.map((l) => l.trim().toUpperCase()))]
    .filter((l) => LETTER_ORDER.includes(l))
    .sort((a, b) => LETTER_ORDER.indexOf(a) - LETTER_ORDER.indexOf(b));
  if (want.length < 2) return null;
  return markChain(text, want, MARK_STRICT) ?? markChain(text, want, MARK_LOOSE);
}

interface SR {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: (e: { error: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

const ERR_VI: Record<string, string> = {
  "not-allowed": "Trình duyệt chặn micro. Bấm vào biểu tượng micro trên thanh địa chỉ để Cho phép, rồi thử lại.",
  "service-not-allowed": "Trình duyệt chặn micro. Hãy cho phép quyền micro và thử lại.",
  "no-speech": "Chưa nghe thấy giọng nói. Bạn nói to và rõ hơn rồi thử lại nhé.",
  "audio-capture": "Không tìm thấy micro. Kiểm tra micro của máy.",
  network: "Lỗi mạng khi nhận dạng giọng nói. Bạn có thể gõ phần trả lời bên dưới.",
};

const SPEAK_DURATION = 30;
const PRE_COUNT = 5;
const WARN_AT = 5;

type Phase = "idle" | "pre" | "rec" | "review";

function SpeakBox({ disabled, onTranscript }: { disabled: boolean; onTranscript: (t: string) => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [pre, setPre] = useState(PRE_COUNT);
  const [remaining, setRemaining] = useState(SPEAK_DURATION);
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState("");
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState("");

  const recRef = useRef<SR | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function getSR(): (new () => SR) | undefined {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition;
  }

  function cleanup() {
    if (tickRef.current) clearInterval(tickRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioRef.current?.close().catch(() => {});
    recRef.current = null;
    streamRef.current = null;
    audioRef.current = null;
    setLevel(0);
  }

  useEffect(() => cleanup, []);

  function startPre() {
    if (!getSR()) {
      setNote("Trình duyệt này chưa hỗ trợ ghi âm giọng nói (hãy dùng Chrome trên máy tính). Bạn có thể gõ phần trả lời bên dưới.");
      return;
    }
    setNote("");
    setHeard("");
    setPre(PRE_COUNT);
    setPhase("pre");
    let n = PRE_COUNT;
    tickRef.current = setInterval(() => {
      n -= 1;
      setPre(n);
      if (n <= 0) {
        if (tickRef.current) clearInterval(tickRef.current);
        beginRec();
      }
    }, 1000);
  }

  async function beginRec() {
    setPhase("rec");
    setRemaining(SPEAK_DURATION);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AC = (window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext) as typeof AudioContext;
      const ctx = new AC();
      audioRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      const loop = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const x = (buf[i]! - 128) / 128;
          sum += x * x;
        }
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 3.2));
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      /* thanh mức là tuỳ chọn — nhận dạng vẫn chạy */
    }

    const Ctor = getSR()!;
    try {
      const rec = new Ctor();
      rec.lang = "en-US";
      rec.interimResults = true;
      rec.continuous = true;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        let t = "";
        for (let i = 0; i < e.results.length; i++) t += e.results[i]![0]!.transcript;
        setHeard(t.trim());
      };
      rec.onerror = (e) => {
        setNote(ERR_VI[e.error] ?? `Lỗi ghi âm: ${e.error}. Bạn có thể gõ phần trả lời bên dưới.`);
      };
      recRef.current = rec;
      rec.start();
    } catch {
      setNote("Không khởi động được micro. Bạn có thể gõ phần trả lời bên dưới.");
    }

    let r = SPEAK_DURATION;
    tickRef.current = setInterval(() => {
      r -= 1;
      setRemaining(r);
      if (r <= 0) stopRec();
    }, 1000);
  }

  function stopRec() {
    cleanup();
    setPhase("review");
  }

  const toSend = (heard || typed).trim();

  return (
    <div>
      {phase === "idle" && (
        <div className="row">
          <button className="btn" disabled={disabled} onClick={startPre}>
            <Mic aria-hidden strokeWidth={2} />
            Bắt đầu nói (30 giây)
          </button>
          <span className="muted">Có 5 giây chuẩn bị trước khi bắt đầu.</span>
        </div>
      )}

      {phase === "pre" && (
        <div className="speak-stage">
          <p className="muted">Chuẩn bị… hãy nghĩ về câu trả lời</p>
          <div className="countdown-big num" key={pre} aria-live="assertive">
            {pre > 0 ? pre : "Nói đi!"}
          </div>
        </div>
      )}

      {phase === "rec" && (
        <div className="speak-stage">
          <div className="mic-orb" style={{ transform: `scale(${1 + Math.min(level * 0.5, 0.45)})` }}>
            <Mic aria-hidden strokeWidth={2} />
            <span className="ring" style={{ opacity: 0.25 + level * 0.7, transform: `scale(${1 + level * 0.5})` }} />
          </div>
          <div className="mic-level" aria-hidden>
            <i style={{ transform: `scaleX(${level})` }} />
          </div>
          <div className={"timer-pill" + (remaining <= WARN_AT ? " warn" : "")} aria-live="off">
            {remaining <= WARN_AT ? `Sắp hết — còn ${remaining}s` : `Còn ${remaining}s`}
          </div>
          <p className="live-transcript">{heard ? `“${heard}”` : "Đang nghe… bạn cứ nói tiếng Anh"}</p>
          {note && (
            <div className="banner warn">
              <AlertTriangle aria-hidden strokeWidth={2} />
              <span>{note}</span>
            </div>
          )}
          <button className="btn btn-ghost" onClick={stopRec}>
            <Square aria-hidden strokeWidth={2} />
            Dừng sớm
          </button>
        </div>
      )}

      {phase === "review" && (
        <div className="speak-stage">
          <p className="muted">Phần nói của bạn:</p>
          <p className="live-transcript">
            {heard ? `“${heard}”` : "(không bắt được giọng — bạn gõ lại bên dưới nhé)"}
          </p>
          {note && (
            <div className="banner warn">
              <AlertTriangle aria-hidden strokeWidth={2} />
              <span>{note}</span>
            </div>
          )}
          <div className="row" style={{ justifyContent: "center" }}>
            <button className="btn btn-ghost" disabled={disabled} onClick={startPre}>
              <RefreshCw aria-hidden strokeWidth={2} />
              Nói lại
            </button>
            <button className="btn" disabled={disabled || !toSend} onClick={() => onTranscript(toSend)}>
              Gửi phần nói
            </button>
          </div>
        </div>
      )}

      <p className="muted" style={{ margin: "16px 0 6px" }}>
        Hoặc gõ lại nội dung bạn muốn nói (dự phòng nếu micro không chạy):
      </p>
      <textarea
        rows={2}
        placeholder="Type what you would say in English…"
        value={typed}
        disabled={disabled}
        onChange={(e) => setTyped(e.target.value)}
        autoCapitalize="sentences"
        autoCorrect="off"
        spellCheck={false}
      />
      {phase !== "rec" && phase !== "pre" && (
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" disabled={disabled || !toSend} onClick={() => onTranscript(toSend)}>
            Gửi phần nói
          </button>
          <span className="muted">Pilot chấm độ trôi chảy và mạch lạc; chấm phát âm chi tiết bổ sung sau.</span>
        </div>
      )}
    </div>
  );
}
