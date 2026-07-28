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
} from "lucide-react";
import { useAuth, signOut } from "../lib/auth";
import RedirectToLogin from "./RedirectToLogin";
import Splash from "./Splash";
import AppShell, { type NavKey } from "./AppShell";
import Hud from "./Hud";
import SubjectPicker, { type SubjectInfo } from "./SubjectPicker";
import PresenceStrip from "./PresenceStrip";
import LearningPath, { type PathNode } from "./LearningPath";
import Lion from "./Lion";
import LessonView from "./LessonView";
import KhoBauView from "./KhoBauView";
import ReviewView from "./ReviewView";
import QuestsView from "./QuestsView";
import ProfileView from "./ProfileView";
import SettingsView from "./SettingsView";
import { ScoreboardBody } from "./Scoreboard";
import * as G from "../lib/gamify";
import * as Prefs from "../lib/prefs";
import { usePresence, PRESENCE_ENABLED } from "../lib/presence";
import { MathText } from "../lib/mathrender";
import "katex/dist/katex.min.css";
import {
  diagnose,
  answer,
  writing,
  speaking,
  uploadWork,
  submitWork,
  endSession,
  learningPath,
  nodeResources,
  getScoreboard,
  ApiError,
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

type Msg =
  | { role: "student"; text: string }
  | { role: "tutor"; text: string }
  /* Cổng nỗ lực: em đòi đáp án / phải thử đủ trước khi được gợi ý — sư tử dỗi */
  | { role: "gate"; text: string }
  | { role: "hint"; text: string }
  | { role: "feedback"; text: string };

// "submitted": đã NỘP BÀI làm ngoài — chưa chấm, nhưng được đi tiếp ngay.
type Verdict = "ok" | "retry" | "done" | "submitted" | null;
type Subject = "Toan" | "Van" | "Anh" | "GDKTPL";

// Mỗi môn: nhãn dài (banner) + ngắn (pill/thẻ) + slug file lộ trình tĩnh +
// `live` = đã có ngân hàng câu hỏi trong DB nên LUYỆN được ngay. Môn chưa
// `live` vẫn hiện LỘ TRÌNH thật (giáo trình từ Studio) để xem trước — phần
// luyện tập mở khi bộ câu hỏi được nạp (xem [[supabase-mcp-deploy]]).
const SUBJECTS: SubjectInfo<Subject>[] = [
  { key: "Toan", short: "Toán", unit: "Toán 10", subtitle: "Hàm số bậc hai · dẫn dắt Socratic, chấm bằng CAS", slug: "toan", live: true, Icon: Sigma },
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
  // Đáp án canonical của dạng tương tác (sap_xep/noi_cot): null = chưa hoàn tất.
  const [interactiveAns, setInteractiveAns] = useState<string | null>(null);
  // Đợt B: bảng điểm rubric (viết/nói) — formative.
  const [rubricResult, setRubricResult] = useState<RubricResult | null>(null);
  const [workFile, setWorkFile] = useState<File | null>(null); // tệp bài làm chờ nộp
  const [aiPassed, setAiPassed] = useState(false); // AI sơ khảo ĐẠT bài gõ của câu hiện tại
  const [stepAns, setStepAns] = useState<Record<number, string>>({}); // Có/Không từng bước của đề nhiều bước
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [attempts, setAttempts] = useState(0);
  const [earned, setEarned] = useState(0);
  const [finished, setFinished] = useState<EndResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [progress, setProgress] = useState<G.Progress>(G.load);
  const [bump, setBump] = useState(false);
  const [mastered, setMastered] = useState<string[]>([]);

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
      else if (h === "") setView("learn");
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);
  const switchView = useCallback((k: NavKey | "settings") => {
    setView(k);
    history.replaceState(null, "", k === "learn" ? window.location.pathname : `#${k}`);
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
  // Học liệu của node đang học (resources). Rỗng = không hiện mục "Tài liệu".
  const [resources, setResources] = useState<NodeResource[]>([]);

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
  // G14 "nhắc nghỉ": buổi học chủ động ~40'. Sau NGƯỠNG (25') gợi ý nghỉ mắt MỘT
  // lần — không ép, không phạt (học bền vững). Băng-rôn dịu, học sinh tự tắt.
  const [breakNudge, setBreakNudge] = useState(false);
  useEffect(() => {
    if (!ses || finished) return;
    const BREAK_AT_MS = 25 * 60 * 1000;
    const id = setInterval(() => {
      if (startedAtRef.current && Date.now() - startedAtRef.current >= BREAK_AT_MS) {
        setBreakNudge(true);
        clearInterval(id);
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [ses, finished]);
  // Câu đã từng trả lời sai trong buổi → đếm "chính xác x/y" + link ôn lại.
  const wrongRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setProgress(G.load());
    setMastered(G.loadMastered());
    // Tuỳ chọn Cài đặt (sáng/tối, cỡ chữ…) — bootstrap ở layout đã áp trước
    // khi vẽ; gọi lại đề phòng script bị chặn (CSP/ẩn danh).
    Prefs.applyToHtml();
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
  const uid = session?.user?.id;

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

  // ── Học liệu cho node đang học ────────────────────────────────────────
  // Endpoint `resources` có thể chưa live: lỗi hay rỗng thì mục "Tài liệu"
  // không hiện, buổi học vẫn chạy bình thường.
  const currentNodeKey = ses ? (q?.nodeKey ?? ses.node ?? null) : null;
  useEffect(() => {
    setResources([]);
    if (!currentNodeKey) return;
    let alive = true;
    nodeResources(subject, currentNodeKey)
      .then((r) => {
        if (alive) setResources(Array.isArray(r?.resources) ? r.resources : []);
      })
      .catch(() => {
        /* im lặng — pipeline học liệu chưa sẵn sàng */
      });
    return () => {
      alive = false;
    };
  }, [subject, currentNodeKey]);

  function resetQuestion() {
    setMsgs([]);
    setText("");
    setPicked(null);
    setInteractiveAns(null);
    setRubricResult(null);
    setWorkFile(null);
    setAiPassed(false);
    setStepAns({});
    setVerdict(null);
    setAttempts(0);
  }

  /** `node`: bài học sinh vừa bấm trên lộ trình. PHẢI gửi lên server — thiếu nó
   *  thì diagnose rơi về chế độ chẩn đoán và trả 20 câu đầu của CẢ MÔN (rải trên
   *  19 bài khác nhau), tức bấm bài nào cũng ra cùng một rổ. */
  async function start(node?: PathNode) {
    if (busy) return; // double-tap: tap 2 tới trước khi disabled kịp commit
    // Môn XEM TRƯỚC (chưa live): lộ trình hiện đầy đủ nhưng chưa có ngân hàng
    // câu hỏi → KHÔNG gọi diagnose (tránh buổi học rỗng). Lời sư tử đã báo.
    if (!active.live) return;
    setError(null);
    setBusy(true);
    try {
      const d = await diagnose(subject, node?.key);
      // Bài chưa có câu hỏi (đang cắm nội dung) → KHÔNG vào buổi rỗng/kẹt; giữ học
      // sinh ở lộ trình + báo nhẹ nhàng.
      if (!d.questions || d.questions.length === 0) {
        setError("Bài này chưa có câu hỏi — nhà trường đang bổ sung nội dung. Bạn chọn bài khác nhé!");
        setBusy(false);
        return;
      }
      setSes(d);
      setQi(0);
      setEarned(0);
      setInjectedStack([]);
      setRemediateLabel(null);
      advancePlanRef.current = null;
      detourRepsRef.current = 0;
      resetQuestion();
      // Mốc đo thật cho màn hoàn thành: thời gian buổi + những câu từng sai.
      startedAtRef.current = Date.now();
      setElapsedSec(null);
      setBreakNudge(false);
      wrongRef.current = new Set();

      const { next, streakGrew } = G.recordStudyDay(G.load());
      G.save(next);
      setProgress(next);
      if (streakGrew) {
        setBump(true);
        window.setTimeout(() => setBump(false), 700);
      }
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
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
    setText("");
    setInteractiveAns(null);
    setRubricResult(null);
    setWorkFile(null);
    setAiPassed(false);
    setStepAns({});
    setAttempts(0);
  }

  function applyTurn(res: TurnResult, attemptNo: number, wasInjected: boolean) {
    // Dạng trả lời bằng thao tác → im lặng, không dựng bong bóng đối thoại.
    const quiet = isWidgetAnswer(q);
    if (res.message && !quiet) setMsgs((m) => [...m, { role: "tutor", text: res.message! }]);

    // XP SERVER-AUTHORITATIVE: engine trả res.xp (student_xp) → số server thắng,
    // cache máy chỉ chép lại. gained=0 nghĩa là nguồn XP này đã ăn trước đó
    // (chống farm ở DB) — không cộng ảo phía máy. Thiếu res.xp (function cũ)
    // mới rơi về grant() như trước.
    const serverXp = res.xp;
    if (serverXp) {
      if (serverXp.gained > 0) setEarned((e) => e + serverXp.gained);
      setProgress(G.syncFromServer(serverXp));
    }

    if (res.correct) {
      setVerdict("ok");
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
      const res = await answer(ses.sessionId, q.id, ans, wasInjected);
      applyTurn(res, attemptNo, wasInjected);
      // Ghi nhớ câu từng sai — nguồn số liệu "chính xác x/y" và "xem lại câu sai".
      if (!res.correct) wrongRef.current.add(q.id);
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }

  /** Nộp bài tự luận dài. Bài GÕ là đường chính — AI chấm NGAY theo Ý (đúng thì
   *  mastery + XP liền, không phải đợi thầy cô rảnh mới qua bài); ảnh/tệp là
   *  kèm thêm hoặc thay thế khi bài phải VẼ (hình, bảng biến thiên). */
  async function submitWorkFile() {
    if (!ses || !q || busy || (!text.trim() && !workFile)) return;
    setBusy(true);
    setLoading(true);
    try {
      const path = workFile ? await uploadWork(workFile) : undefined;
      // KHÔNG gửi attemptNo: server tự đếm từ bảng attempts. Đếm ở client thì
      // rớt mạng giữa chừng cũng cộng, mà vào lại bài hôm sau là về 0.
      const res = await submitWork(ses.sessionId, q.id, {
        ...(text.trim() ? { text: text.trim() } : {}),
        ...(path ? { filePath: path, mime: workFile!.type, size: workFile!.size } : {}),
      });
      setAttempts((n) => n + 1);
      if (res.xp) {
        if (res.xp.gained > 0) setEarned((e) => e + res.xp!.gained);
        setProgress(G.syncFromServer(res.xp));
      }
      if (res.correct === false) {
        // AI thấy thiếu ý → như một lần TRẢ LỜI SAI: giữ nguyên bài gõ cho em
        // sửa tiếp, kèm gợi ý thiếu gì (không phải đáp án).
        wrongRef.current.add(q.id);
        if (res.feedback) setMsgs((m) => [...m, { role: "hint", text: res.feedback! }]);
        setVerdict("retry");
        return;
      }
      if (res.correct === true) setAiPassed(true);
      const okFb = res.correct === true ? res.feedback : undefined;
      if (okFb) setMsgs((m) => [...m, { role: "tutor", text: okFb }]);
      setVerdict("submitted");
    } catch (e) {
      setError(errText(e));
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
      setError(errText(e));
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
      setError(errText(e));
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
      setPathVersion((v) => v + 1); // mastery vừa đổi — nạp lại lộ trình server
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  function backToPath() {
    setSes(null);
    setFinished(null);
    setInjectedStack([]);
    setRemediateLabel(null);
    advancePlanRef.current = null;
    detourRepsRef.current = 0;
    resetQuestion();
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

    // Tab khác Học: cùng AppShell, view đổi tại chỗ — "ấn cái là đến".
    // Cài đặt không có tab riêng — rail giữ đèn ở "Tôi" (cửa vào của nó).
    if (view !== "learn") {
      return (
        <AppShell current={view === "settings" ? "profile" : view} onNavigate={switchView}>
          {/* key={view}: remount khi đổi tab → animation view-in (mobile) chạy
              lại — chuyển tab có nhịp native thay vì nhảy hình 0ms */}
          <div key={view} className="view-in" data-dir={viewDir}>
            {view === "review" && <ReviewView onGoLearn={() => switchView("learn")} />}
            {view === "scoreboard" && <ScoreboardBody onGoLearn={() => switchView("learn")} />}
            {view === "quests" && (
              /* Tên chương thật từ learning-path (version_label) → title WIG.
                 Hạn WIG server chưa trả — QuestsView tự hiển thị dòng thay thế. */
              <QuestsView
                onGoLearn={() => switchView("learn")}
                wigTitle={pathLabel ? `Thành thạo chương ${pathLabel}` : undefined}
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

            {error && (
              <div className="banner err" style={{ marginBottom: 16 }}>
                <AlertTriangle aria-hidden strokeWidth={2} />
                <span>{error}</span>
              </div>
            )}

            <LearningPath
              unit={bannerUnit}
              subtitle={bannerSubtitle}
              nodes={nodes}
              preview={!active.live}
              heroMood={G.isCold(progress) ? "miss" : "greet"}
              greeting={
                !active.live
                  ? `Đây là lộ trình ${active.unit} — bạn xem trước toàn bộ các bài nhé. Phần luyện tập với mình sắp mở!`
                  : doneCount === 0
                    ? `Chào ${firstName ?? "bạn"}! Hôm nay mình với bạn bắt đầu điểm kiến thức đầu tiên nhé. Mình sẽ không đưa đáp án — mình hỏi, bạn nghĩ.`
                    : G.isCold(progress)
                      ? "Lâu rồi mình không gặp bạn! Học một bài ngắn thôi cũng đủ nhóm lại chuỗi ngày."
                      : `Bạn đã thành thạo ${doneCount} điểm kiến thức rồi. Mình với bạn tiếp tục nhé!`
              }
              busy={busy}
              onStart={start}
              onOpenKhoBau={(n) => setKhoBau({ key: n.key, label: n.label })}
            />

            {/* Đồng bộ lộ trình chạy NGẦM — không báo chữ (tránh nhấp nháy/giật);
                path tĩnh hiện ngay, path server tới thì cảnh tự đổi mượt. */}
          </div>

          {/* Cột phải ≥1200px (hi-fi 3c) — 900–1200 và mobile: ẩn hẳn */}
          <aside className="learn-aside" aria-label="Bảng tin học tập">
            {/* Bảng tuần mini: HẠNG là số server-authoritative (board.effort.rank
                — server chấm theo nỗ lực thật), một hàng "của bạn" nền gold;
                danh sách đầy đủ nằm ở /scoreboard. XP kề bên (progress.xp) hiện
                CÒN là cache máy (lib/gamify) — chỉ để so cảm giác, chưa phải số
                so kè; đổi sang XP server khi có endpoint (xem TODO ở gamify.ts). */}
            {board && board.effort.rank != null && (
              <section className="aside-card">
                <div className="aside-head">
                  <b>Bảng tuần</b>
                  {/* Chuyển view tại chỗ — không rời trang */}
                  <button type="button" className="aside-link" onClick={() => switchView("scoreboard")}>
                    xem tất cả
                  </button>
                </div>
                <div className="board-row" data-me="true">
                  <span className="board-rank num">{board.effort.rank}</span>
                  <span className="board-ava" aria-hidden>
                    {(firstName ?? "E").charAt(0).toUpperCase()}
                  </span>
                  <span className="board-name">{firstName ?? "Em"} (bạn)</span>
                  {/* Tổng XP server-authoritative (student_xp) — cache máy chỉ là dự phòng. */}
                  <span className="board-xp num">{board.xp?.total ?? progress.xp}</span>
                </div>
              </section>
            )}

            <section className="aside-card">
              <div className="aside-head">
                <b>Nhiệm vụ</b>
              </div>
              <div className="aside-quest">
                <div className="aside-quest-head">
                  <span>Học hôm nay</span>
                  <b className="num">{studied ? 1 : 0}/1</b>
                </div>
                <div
                  className="meter"
                  role="progressbar"
                  aria-valuenow={studied ? 1 : 0}
                  aria-valuemin={0}
                  aria-valuemax={1}
                  aria-label="Học hôm nay"
                >
                  <i data-fill="navy" style={{ "--p": studied ? "100%" : "0%" } as React.CSSProperties} />
                </div>
              </div>
              {nextLeague && (
                <div className="aside-quest">
                  <div className="aside-quest-head">
                    <span>Thăng hạng {nextLeague.name}</span>
                    <b className="num">
                      {progress.xp}/{nextLeague.min} XP
                    </b>
                  </div>
                  <div
                    className="meter"
                    role="progressbar"
                    aria-valuenow={progress.xp}
                    aria-valuemin={0}
                    aria-valuemax={nextLeague.min}
                    aria-label={`Thăng hạng ${nextLeague.name}`}
                  >
                    <i style={{ "--p": `${Math.round(league.progress * 100)}%` } as React.CSSProperties} />
                  </div>
                </div>
              )}
            </section>

            <section className="aside-tip">
              <Lion mood="point" size={56} decorative />
              <p>Mỗi ngày một bài ngắn — đều đặn thắng dốc sức. Hôm nay học một bài để giữ chuỗi nhé!</p>
            </section>
          </aside>
        </div>
      </AppShell>
    );
  }

  // ── Bài học (hi-fi 3b) ────────────────────────────────────────────────
  // Flow mới cho trắc nghiệm: chạm đáp án chỉ CHỌN, nút KIỂM TRA ở footer
  // mới nộp. Viết/nói giữ flow cũ (nộp trong khối riêng của chúng).
  const total = ses.questions.length;
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
    !!stepParsed &&
    stepParsed.steps.every((s, i) => s.yesNo || i === stepParsed.steps.length - 1);
  // Hiện tới bước (Có/Không) đầu tiên CHƯA trả lời; xong hết thì mở cả phần còn lại.
  let stepReveal = stepParsed ? stepParsed.steps.length : 0;
  if (stepParsed && stepInteractive) {
    const firstOpen = yesNoIdx.find((i) => !stepAns[i]);
    stepReveal = firstOpen == null ? stepParsed.steps.length : firstOpen + 1;
  }
  const stepsDone = !stepInteractive || yesNoIdx.every((i) => !!stepAns[i]);
  // Bước cuối không phải Có/Không → cần em gõ kết luận.
  const stepNeedsText = !!stepParsed && !stepParsed.steps[stepParsed.steps.length - 1]!.yesNo;
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
        : stepParsed && stepInteractive
          ? stepsDone && (!stepNeedsText || text.trim().length > 0)
          : text.trim().length > 0);
  const check = () => {
    if (!q || q.kind !== "objective") return;
    let ans = interactiveShown ? interactiveAns : isTrueFalse || q.options ? picked : text.trim();
    if (!interactiveShown && stepParsed && stepInteractive) {
      const lastIdx = stepParsed.steps.length - 1;
      ans = stepParsed.steps
        .map((st, i) => {
          if (st.yesNo) return `${st.label}: ${stepAns[i]}`;
          if (i === lastIdx && text.trim()) return `${st.label}: ${text.trim()}`;
          return null; // bước hướng dẫn xen giữa (hiếm) — không có gì để gửi
        })
        .filter(Boolean)
        .join("; ");
    }
    if (ans) void submitObjective(ans);
  };

  return (
    <AppShell current="learn" focus>
      <div className="lesson-top">
        <button className="lesson-x" onClick={backToPath} aria-label="Thoát buổi học">
          <X aria-hidden strokeWidth={2.5} />
        </button>
        <div
          className="meter lesson-meter"
          role="progressbar"
          aria-valuenow={qi + 1}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label={`Câu ${qi + 1} trên ${total}`}
        >
          <i style={{ "--p": `${((qi + 1) / total) * 100}%` } as React.CSSProperties} />
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

      {/* G14 "nhắc nghỉ": gợi ý nghỉ mắt sau 25' — dịu, tự tắt, không chặn học. */}
      {breakNudge && (
        <div className="mend-banner break-banner" role="status">
          <Timer aria-hidden strokeWidth={2.25} />
          <span>
            Em học chăm quá — <b>nghỉ mắt 1–2 phút</b> rồi quay lại nhé, não nhớ tốt hơn khi được nghỉ.
          </span>
          <button className="break-x" onClick={() => setBreakNudge(false)} aria-label="Đã hiểu, tiếp tục">
            <X aria-hidden strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Bài đặc biệt — học liệu Xưởng đưa vào, dẫn đầu node. Rỗng thì tự ẩn. */}
      <LessonView resources={resources} />

      {q && (
        <>
          <p className="eyebrow lesson-kind">{kindEyebrow(q)}</p>
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
                <div className="qcard-stem"><MathText block cap>{letterMCQ.stem}</MathText></div>
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
                <div className="qcard-expr"><MathText block cap>{q.prompt}</MathText></div>
              ) : (
                <div className="qcard-text"><MathText block cap>{q.prompt}</MathText></div>
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

      <div className="thread" aria-live="polite">
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
            </div>
          ) : m.role === "gate" ? (
            /* Cổng nỗ lực: sư tử xoay lưng dỗi — "mình hỏi, bạn nghĩ".
               Không phải hình phạt: là nhân vật hoá đúng luật chơi của app. */
            <div key={i} className="hint-says">
              <Lion mood="rebel" size={92} decorative />
              <div className="hint-bubble"><MathText>{m.text}</MathText></div>
            </div>
          ) : m.role === "hint" ? (
            /* Gợi ý Socratic: đầu sư tử ngẫm nghĩ 52px + bong bóng trắng
               đuôi lệch (16/16/16/4) — anatomy hi-fi. */
            <div key={i} className="hint-says">
              <Lion mood="thinking" size={52} />
              <div className="hint-bubble"><MathText>{m.text}</MathText></div>
            </div>
          ) : (
            <div key={i} className="feedback">
              <MathText>{m.text}</MathText>
            </div>
          ),
        )}
        {loading && (
          /* Chờ chấm/gợi ý: sư tử chống cằm ngẫm nghĩ. Câu do AI chấm (viết/nói/
             tự luận/gõ đáp án mở) mất vài giây thật → nói thẳng "Đang suy nghĩ…"
             thay vì im lặng như treo máy. Câu CAS chấm tức thì hiếm khi kịp thấy. */
          <div className="think-wrap">
            <Lion mood="think" size={64} decorative />
            {(q?.kind === "writing" || q?.kind === "speaking" || q?.kind === "nop_bai" ||
              (q?.kind === "objective" && !q.options && !interactiveShown && !isTrueFalse)) && (
              <span className="think-label">Đang suy nghĩ<i className="think-dots" aria-hidden /></span>
            )}
          </div>
        )}
      </div>

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
      {q && q.kind === "objective" && !q.options && !isTrueFalse && !interactiveShown && verdict !== "ok" &&
        (!stepParsed || !stepInteractive || (stepsDone && stepNeedsText)) && (
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
          disabled={busy || verdict === "retry"}
          autoFocus
          onChange={(e) => {
            setText(e.target.value);
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

      {/* NỘP BÀI — câu tự luận dài. GÕ là đường chính (AI chấm ngay, thầy cô
          xem lại sau); ảnh/tệp cho phần phải VẼ hoặc em thích viết tay. Hiện cả
          khi verdict='retry' để em sửa bài theo góp ý rồi nộp lại. */}
      {q && q.kind === "nop_bai" && verdict !== "ok" && verdict !== "submitted" && (
        <div className="submit-box">
          <textarea
            key={q.id}
            className="ans-input work-input"
            rows={3}
            placeholder="Viết bài làm của em ở đây — giải thích như đang nói với bạn…"
            value={text}
            disabled={busy}
            onChange={(e) => {
              setText(e.target.value);
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
            }}
            autoCapitalize="sentences"
            autoCorrect="off"
            spellCheck={false}
          />
          <div className="submit-row">
            <label className="submit-attach">
              <input
                className="sr-only"
                type="file"
                accept="image/*,.pdf,.doc,.docx,.txt"
                disabled={busy}
                onChange={(e) => {
                  setWorkFile(e.target.files?.[0] ?? null);
                  setError(null);
                }}
              />
              <Paperclip aria-hidden strokeWidth={2.25} />
              <span>
                {workFile
                  ? `${workFile.name} (${Math.round(workFile.size / 1024)} KB)`
                  : "Đính kèm ảnh bài làm (nếu có hình vẽ)"}
              </span>
            </label>
            {workFile && (
              <button type="button" className="submit-unattach" onClick={() => setWorkFile(null)} aria-label="Gỡ tệp">
                <X aria-hidden strokeWidth={2.5} />
              </button>
            )}
          </div>
          <p className="muted submit-note">
            Em gõ bài làm là hay nhất — trợ lý đọc được ngay. Bài có hình vẽ thì chụp ảnh đính kèm.
            Thầy cô luôn xem lại sau.
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
                  <i style={{ "--v": `${(sc.diem / 3) * 100}%` } as React.CSSProperties} />
                </div>
                {sc.nhan_xet && <p className="rc-note">{sc.nhan_xet}</p>}
              </li>
            ))}
          </ul>
          {rubricResult.nhan_xet_chung && <p className="rc-overall">{rubricResult.nhan_xet_chung}</p>}
          {rubricResult.cau_hoi_sua && <p className="rc-coach">👉 {rubricResult.cau_hoi_sua}</p>}
          <p className="rc-foot">Góp ý để bạn tự tiến bộ — không phải điểm chính thức.</p>
        </div>
      )}


      {error && (
        <div className="banner err" style={{ marginTop: 16 }}>
          <AlertTriangle aria-hidden strokeWidth={2} />
          <span>{error}</span>
        </div>
      )}

      {/* Đệm cho footer cố định — nội dung cuối không bao giờ bị che. */}
      <div className="lesson-pad" aria-hidden />

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
              <div className="lfoot-says">
                <Lion mood="thinking" size={48} decorative />
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

      {/* Đã nộp. AI chấm ĐẠT bài gõ → nói thẳng là ổn (mastery đã tính); chỉ
          nộp tệp → nói thật là còn chờ thầy cô, kẻo em tưởng đã "qua bài". */}
      {verdict === "submitted" && (
        <div className="lfoot" data-verdict={aiPassed ? "ok" : "done"} role="status">
          <div className="lfoot-inner">
            <div className="lfoot-says">
              <Lion mood="cheer" size={48} decorative />
              {aiPassed ? (
                <>
                  <b className="lfoot-title">Bài viết ổn rồi — được tính điểm luôn!</b>
                  <span className="muted">Thầy cô sẽ xem lại bài của em sau.</span>
                </>
              ) : (
                <>
                  <b className="lfoot-title">Đã nộp bài — thầy cô sẽ chấm sau</b>
                  <span className="muted">Chưa tính là làm chủ bài này; chấm xong em sẽ thấy kết quả ở lộ trình.</span>
                </>
              )}
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
            <div className="lfoot-row">
              <CheckCircle2 aria-hidden strokeWidth={2.25} />
              <b className="lfoot-title">Chính xác!</b>
              <span className="xp-chip num">+{G.XP.correct} XP</span>
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
              <b className="lfoot-title">Đã gửi — xem nhận xét ở trên</b>
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
            {/* Dạng thao tác không có bong bóng đối thoại → sư tử đứng ngay đây,
                trên câu nhắc. Lời nhắc CỐ Ý không chỉ ra ý nào sai (không cho
                đáp án), chỉ đẩy học sinh soát lại. */}
            {isWidgetAnswer(q) ? (
              <div className="lfoot-says">
                <Lion mood="thinking" size={48} decorative />
                <b className="lfoot-title">Chưa đúng rồi — soát lại từng ý xem sao nhé!</b>
                {attempts >= 2 && <span className="xp-chip num">+{G.XP.persistence} XP nỗ lực</span>}
              </div>
            ) : (
              <div className="lfoot-row">
                <RefreshCw aria-hidden strokeWidth={2.5} />
                <b className="lfoot-title">Chưa đúng — thử lại nhé</b>
                {attempts >= 2 && <span className="xp-chip num">+{G.XP.persistence} XP nỗ lực</span>}
              </div>
            )}
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
    </AppShell>
  );
}

// Render toán chuyển hẳn sang KaTeX qua <MathText> (lib/mathrender) — chuẩn cho
// học sinh, thay bộ "làm đẹp" inline cũ. Đây chỉ còn cờ nhận biết đề có chất toán
// để chọn kiểu chữ serif.

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
