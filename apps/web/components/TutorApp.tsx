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
  Zap,
  X,
  CheckCircle2,
  Timer,
  LifeBuoy,
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
import ReviewView from "./ReviewView";
import QuestsView from "./QuestsView";
import ProfileView from "./ProfileView";
import SettingsView from "./SettingsView";
import { ScoreboardBody } from "./Scoreboard";
import * as G from "../lib/gamify";
import * as Prefs from "../lib/prefs";
import { usePresence, PRESENCE_ENABLED } from "../lib/presence";
import {
  diagnose,
  answer,
  writing,
  speaking,
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
} from "../lib/api";

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

type Verdict = "ok" | "retry" | null;
type Subject = "Toan" | "Van" | "Anh";

// Mỗi môn: nhãn dài (banner) + ngắn (pill/thẻ) + slug file lộ trình tĩnh +
// `live` = đã có ngân hàng câu hỏi trong DB nên LUYỆN được ngay. Môn chưa
// `live` vẫn hiện LỘ TRÌNH thật (giáo trình từ Studio) để xem trước — phần
// luyện tập mở khi bộ câu hỏi được nạp (xem [[supabase-mcp-deploy]]).
const SUBJECTS: SubjectInfo<Subject>[] = [
  { key: "Toan", short: "Toán", unit: "Toán 10", subtitle: "Hàm số bậc hai · dẫn dắt Socratic, chấm bằng CAS", slug: "toan", live: true, Icon: Sigma },
  { key: "Van", short: "Ngữ văn", unit: "Ngữ văn 10", subtitle: "Thần thoại, truyện kể, thơ · đọc hiểu & viết", slug: "van", live: false, Icon: BookText },
  { key: "Anh", short: "Tiếng Anh", unit: "Tiếng Anh 10", subtitle: "Present simple · trắc nghiệm, viết & nói", slug: "anh", live: true, Icon: Languages },
];

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
        const VALID = new Set<PathNode["state"]>(["mastered", "stale", "current", "available", "locked"]);
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
    setVerdict(null);
    setAttempts(0);
  }

  async function start() {
    if (busy) return; // double-tap: tap 2 tới trước khi disabled kịp commit
    // Môn XEM TRƯỚC (chưa live): lộ trình hiện đầy đủ nhưng chưa có ngân hàng
    // câu hỏi → KHÔNG gọi diagnose (tránh buổi học rỗng). Lời sư tử đã báo.
    if (!active.live) return;
    setError(null);
    setBusy(true);
    try {
      const d = await diagnose(subject);
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
  });

  // Reset trạng thái câu KHI CHUYỂN sang câu tiêm/leo — GIỮ lại msgs (hành trình
  // vá nền là câu chuyện liền mạch), chỉ làm mới ô trả lời + kết quả + đếm lần.
  function softResetForNewQuestion() {
    setVerdict(null);
    setPicked(null);
    setText("");
    setAttempts(0);
  }

  function applyTurn(res: TurnResult, attemptNo: number, wasInjected: boolean) {
    if (res.message) setMsgs((m) => [...m, { role: "tutor", text: res.message! }]);

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
    if (res.message) {
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
    setText("");
    setMsgs((m) => [...m, { role: "student", text: ans }]);
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

  async function submitWriting() {
    if (!ses || !q || busy || !text.trim()) return;
    const t = text.trim();
    setMsgs((m) => [...m, { role: "student", text: t }]);
    setText("");
    setBusy(true);
    setLoading(true);
    try {
      const res = await writing(ses.sessionId, q.id, t);
      setMsgs((m) => [...m, { role: "feedback", text: res.feedback ?? "" }]);
      setVerdict("ok");
      grant(G.XP.correct);
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
      setMsgs((m) => [...m, { role: "feedback", text: res.feedback ?? "" }]);
      setVerdict("ok");
      grant(G.XP.correct);
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

          <div className="finish-cta">
            <button className="btn btn-gold btn-block" onClick={backToPath}>
              TIẾP TỤC
            </button>
            {wrongCount > 0 && (
              <a className="finish-review" href="/review">
                Xem lại câu sai ({wrongCount})
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
            {view === "scoreboard" && <ScoreboardBody />}
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
                  <span className="board-xp num">{progress.xp}</span>
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
  const canCheck = q?.kind === "objective" && (q.options ? picked != null : text.trim().length > 0);
  const check = () => {
    if (!q || q.kind !== "objective") return;
    const ans = q.options ? picked : text.trim();
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

      {/* Bài đặc biệt — học liệu Xưởng đưa vào, dẫn đầu node. Rỗng thì tự ẩn. */}
      <LessonView resources={resources} />

      {q && (
        <>
          <p className="eyebrow lesson-kind">{kindEyebrow(q)}</p>
          <div className="qcard">
            {/* Đề có công thức → cả dòng serif italic 26 theo hi-fi; câu chữ
                thường (tiếng Anh, đọc hiểu) giữ sans 15/1.5. */}
            {mathy(q.prompt) ? (
              <div className="qcard-expr math">{renderRich(q.prompt)}</div>
            ) : (
              <div className="qcard-text">{renderRich(q.prompt)}</div>
            )}
          </div>
        </>
      )}

      <div className="thread" aria-live="polite">
        {msgs.map((m, i) =>
          m.role === "student" ? (
            <div key={i} className="bubble student">
              <div className="who">BẠN</div>
              {renderRich(m.text)}
            </div>
          ) : m.role === "tutor" ? (
            <div key={i} className="bubble">
              <div className="who">TUTOR</div>
              {renderRich(m.text)}
            </div>
          ) : m.role === "gate" ? (
            /* Cổng nỗ lực: sư tử xoay lưng dỗi — "mình hỏi, bạn nghĩ".
               Không phải hình phạt: là nhân vật hoá đúng luật chơi của app. */
            <div key={i} className="hint-says">
              <Lion mood="rebel" size={92} decorative />
              <div className="hint-bubble">{renderRich(m.text)}</div>
            </div>
          ) : m.role === "hint" ? (
            /* Gợi ý Socratic: đầu sư tử ngẫm nghĩ 52px + bong bóng trắng
               đuôi lệch (16/16/16/4) — anatomy hi-fi. */
            <div key={i} className="hint-says">
              <Lion mood="thinking" size={52} />
              <div className="hint-bubble">{renderRich(m.text)}</div>
            </div>
          ) : (
            <div key={i} className="feedback">
              {renderRich(m.text)}
            </div>
          ),
        )}
        {loading && (
          /* Chờ guide agent: sư tử chống cằm ngẫm nghĩ, bong bóng ba chấm
             là fx có sẵn của mood `think` (lion-motion). */
          <div style={{ padding: "6px 0 14px" }}>
            <Lion mood="think" size={64} decorative />
          </div>
        )}
      </div>

      {/* Lưới đáp án luôn hiển thị (hi-fi): chọn xong tile giữ trạng thái
          selected dưới ribbon; khoá tương tác khi đang nộp / đã có kết quả. */}
      {q && q.kind === "objective" && q.options && (
        <div className="ans-grid">
          {q.options.map((opt) => (
            <button
              key={opt}
              className="ans-tile num"
              aria-pressed={picked === opt}
              disabled={busy || verdict != null}
              onClick={() => setPicked(opt)}
            >
              {prettyMath(opt)}
            </button>
          ))}
        </div>
      )}

      {q && q.kind === "objective" && !q.options && verdict !== "ok" && (
        <input
          type="text"
          placeholder="Nhập đáp án của bạn…"
          value={text}
          disabled={busy || verdict === "retry"}
          autoFocus
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && canCheck && !busy && check()}
          /* Bàn phím KHÔNG sửa hộ đáp án ("2x" không được thành chữ khác) */
          inputMode="text"
          enterKeyHint="go"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      )}

      {q && q.kind === "writing" && verdict !== "ok" && (
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

      {q && q.kind === "speaking" && verdict !== "ok" && <SpeakBox disabled={busy} onTranscript={submitSpeaking} />}


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

      {verdict === "retry" && (
        <div className="lfoot" data-verdict="retry" role="status">
          <div className="lfoot-inner">
            <div className="lfoot-row">
              <RefreshCw aria-hidden strokeWidth={2.5} />
              <b className="lfoot-title">Chưa đúng — thử lại nhé</b>
              {attempts >= 2 && <span className="xp-chip num">+{G.XP.persistence} XP nỗ lực</span>}
            </div>
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

// Bộ làm đẹp toán inline (tránh phụ thuộc KaTeX nặng).
const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻", "+": "⁺", n: "ⁿ", x: "ˣ", i: "ⁱ" };
const SUB: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉" };
const toMap = (s: string, m: Record<string, string>) => [...s].map((c) => m[c] ?? c).join("");

function prettyMath(s: string): string {
  return (
    (s ?? "")
      .replace(/\$/g, "")
      // LLM hay bọc công thức bằng \( \) \[ \] — client không render LaTeX,
      // gỡ delimiter để chữ đọc sạch (nội dung bên trong đã xử lý bên dưới).
      .replace(/\\[()[\]]/g, "")
      .replace(/\\left|\\right/g, "")
      .replace(/\\text\s*\{([^{}]*)\}/g, "$1")
      .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, "($1)/($2)")
      .replace(/\\sqrt\s*\{([^{}]+)\}/g, "√($1)")
      .replace(/\\cdot/g, "·")
      .replace(/\\times/g, "×")
      .replace(/\\leq?\b/g, "≤")
      .replace(/\\geq?\b/g, "≥")
      .replace(/\\ne(?:q)?\b/g, "≠")
      .replace(/\\pm/g, "±")
      .replace(/\\,/g, " ")
      .replace(/\^\{([^{}]+)\}/g, (_, p) => toMap(p, SUP))
      .replace(/\^(-?\w)/g, (_, p) => toMap(p, SUP))
      .replace(/_\{([^{}]+)\}/g, (_, p) => toMap(p, SUB))
      .replace(/_(\w)/g, (_, p) => toMap(p, SUB))
      // Ghi chú soạn bài lọt vào nội dung (VD "(khuôn tham số: b, c nguyên)")
      // là metadata của người soạn — học sinh không bao giờ cần thấy.
      .replace(/\s*\(khu[ôo]n tham s[ốo][^)]*\)/gi, "")
  );
}

/** Chữ giàu tối giản cho lời Tutor: **đậm** → <b>, còn lại qua prettyMath.
 *  KHÔNG phải markdown đầy đủ — chỉ đúng thứ LLM hay dùng, tránh hiện dấu sao thô. */
function renderRich(s: string): React.ReactNode {
  const parts = prettyMath(s ?? "").split(/\*\*([^*]+)\*\*/g);
  if (parts.length === 1) return parts[0];
  return parts.map((p, i) => (i % 2 === 1 ? <b key={i}>{p}</b> : p));
}

/** Eyebrow trên thẻ câu hỏi — lệnh làm bài theo dạng câu (hi-fi 3b). */
function kindEyebrow(q: DiagnoseQuestion): string {
  if (q.kind === "writing") return "Viết câu trả lời";
  if (q.kind === "speaking") return "Luyện nói tiếng Anh";
  if (q.options) return "Chọn đáp án đúng";
  return "Nhập đáp án của bạn";
}

/** Đề có "chất toán" (công thức, biến, so sánh) → hiển thị serif italic. */
const mathy = (s: string) => /[=^_\\$±≤≥√²³]/.test(s ?? "");

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
