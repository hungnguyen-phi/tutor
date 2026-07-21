"use client";

/**
 * NHẬP LIỆU TỪ APP SẢN XUẤT (Studio) — chỗ giáo viên/chủ biên "bỏ tài nguyên
 * đầu vào" (yêu cầu chủ dự án): thả file bundle .json khuôn va.kg-bundle/2.2,
 * app kiểm định bằng CHÍNH Zod schema của importer (@tutor/shared — một nguồn
 * chân lý, lệch là chặn tại cửa đúng tinh thần INTEGRATION-STUDIO.md), xem
 * trước thống kê thật, rồi:
 *   · Gửi nạp trực tuyến (edge function `import-kg` — GĐ1; chưa deploy thì
 *     báo thật, không giả vờ đã nạp), hoặc
 *   · Chép lệnh CLI cho đội vận hành (đường đi đang dùng hôm nay).
 * Mọi thứ hiển thị đều tính từ file thật — không bịa. Nội dung nạp vào luôn
 * nằm ở hàng chờ duyệt: chỉ "active" mới phục vụ học sinh.
 */

import { useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ClipboardCopy,
  FileUp,
  Inbox,
  Send,
  UploadCloud,
} from "lucide-react";
import { KgBundle } from "@tutor/shared";
import { importKg } from "../lib/api";

const SUBJECT_LABEL: Record<string, string> = {
  Toan: "Toán",
  Anh: "Tiếng Anh",
  Hoa: "Hoá học",
  Van: "Ngữ văn",
};

type Analysis = {
  fileName: string;
  bundle: unknown;
  subject: string;
  grade: string | number; // schema cho phép cả "10" lẫn 10
  versionLabel: string;
  nguon?: string;
  nodeCount: number;
  typeCounts: Record<string, number>;
  edgeCounts: Record<string, number>;
  chapters: { name: string; count: number }[];
};

type Verdict =
  | { kind: "idle" }
  | { kind: "invalid"; fileName: string; issues: string[] }
  | { kind: "valid"; a: Analysis };

export default function StudioIntake() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [verdict, setVerdict] = useState<Verdict>({ kind: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleFile(f: File | undefined | null) {
    setSendMsg(null);
    setCopied(false);
    if (!f) return;
    let raw: unknown;
    try {
      raw = JSON.parse(await f.text());
    } catch {
      setVerdict({ kind: "invalid", fileName: f.name, issues: ["File không phải JSON hợp lệ."] });
      return;
    }
    // MỘT nguồn chân lý: đúng schema mà importer server dùng
    const parsed = KgBundle.safeParse(raw);
    if (!parsed.success) {
      setVerdict({
        kind: "invalid",
        fileName: f.name,
        issues: parsed.error.issues
          .slice(0, 8)
          .map((i) => `${i.path.join(".") || "(gốc)"} — ${i.message}`),
      });
      return;
    }
    const b = parsed.data;
    const typeCounts: Record<string, number> = {};
    const chapterOrder: string[] = [];
    const chapterCount = new Map<string, number>();
    for (const n of b.nodes) {
      typeCounts[n.type] = (typeCounts[n.type] ?? 0) + 1;
      if (!chapterCount.has(n.chapter)) chapterOrder.push(n.chapter);
      chapterCount.set(n.chapter, (chapterCount.get(n.chapter) ?? 0) + 1);
    }
    const edgeCounts: Record<string, number> = {};
    for (const e of b.edges) edgeCounts[e.relation] = (edgeCounts[e.relation] ?? 0) + 1;
    setVerdict({
      kind: "valid",
      a: {
        fileName: f.name,
        bundle: b,
        subject: SUBJECT_LABEL[b.subject] ?? b.subject,
        grade: b.grade,
        versionLabel: b.version_label,
        nguon: b.nguon,
        nodeCount: b.nodes.length,
        typeCounts,
        edgeCounts,
        chapters: chapterOrder.map((name) => ({ name, count: chapterCount.get(name)! })),
      },
    });
  }

  async function send(a: Analysis) {
    setSending(true);
    setSendMsg(null);
    try {
      const r = await importKg(a.bundle);
      setSendMsg({
        ok: true,
        text:
          `Đã nạp vào hàng chờ duyệt: ${r.nodes ?? a.nodeCount} node` +
          (r.version ? ` · phiên bản ${r.version}` : "") +
          ". Nội dung chỉ phục vụ học sinh sau khi được duyệt.",
      });
    } catch (e) {
      // Nói thật: cổng trực tuyến chưa mở (GĐ1) / lỗi mạng — CLI vẫn là đường đi
      setSendMsg({
        ok: false,
        text:
          "Cổng nạp trực tuyến chưa sẵn sàng (" +
          (e instanceof Error ? e.message : String(e)) +
          "). Dùng lệnh bên dưới cho đội vận hành — kết quả y hệt.",
      });
    } finally {
      setSending(false);
    }
  }

  const cliCmd = (fileName: string) =>
    `pnpm --filter @tutor/db import:kg -- bundles/${fileName}`;

  async function copyCmd(fileName: string) {
    try {
      await navigator.clipboard.writeText(cliCmd(fileName));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard bị chặn — chuỗi lệnh vẫn hiển thị để chép tay */
    }
  }

  return (
    <section className="tdb-card sti">
      <div className="tdb-card-head">
        <span className="tdb-card-title">Nhập liệu từ App sản xuất (Studio)</span>
        {verdict.kind === "valid" && (
          <span className="pill g">
            <Check aria-hidden strokeWidth={2.5} style={{ width: 13, height: 13 }} /> hợp lệ
          </span>
        )}
        {verdict.kind === "invalid" && <span className="pill a">bị chặn</span>}
      </div>
      <p className="muted">
        Nhận gói khung tri thức <b>.json</b> khuôn <code>va.kg-bundle/2.2</code> xuất từ Studio.
        File được kiểm bằng đúng schema của hệ thống — lệch là chặn tại cửa, không đi sâu vào hệ.
      </p>

      {/* Thả file / bấm chọn — vùng chạm lớn, kéo-thả thật */}
      <label
        className="sti-drop"
        data-over={dragOver || undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFile(e.dataTransfer.files?.[0]);
        }}
      >
        <UploadCloud aria-hidden strokeWidth={1.75} />
        <b>Thả file bundle vào đây hoặc bấm để chọn</b>
        <span className="muted">kg-bundle-*.json · một file mỗi lần</span>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = ""; // chọn lại cùng file vẫn nhận
          }}
        />
      </label>

      {/* Kết quả kiểm định */}
      {verdict.kind === "invalid" && (
        <div className="sti-issues" role="alert">
          <div className="sti-issues-head">
            <AlertTriangle aria-hidden strokeWidth={2} />
            <b>{verdict.fileName} không đạt chuẩn — sửa ở Studio rồi xuất lại:</b>
          </div>
          <ul>
            {verdict.issues.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {verdict.kind === "valid" && (
        <div className="sti-result">
          {/* Thống kê THẬT từ file */}
          <div className="sti-facts">
            <div className="sti-fact">
              <span>Môn · Khối</span>
              <b>
                {verdict.a.subject} {verdict.a.grade}
              </b>
            </div>
            <div className="sti-fact">
              <span>Nhãn phiên bản</span>
              <b>{verdict.a.versionLabel}</b>
            </div>
            <div className="sti-fact">
              <span>Điểm kiến thức</span>
              <b className="num">
                {verdict.a.nodeCount}
                <small>
                  {" "}
                  ({Object.entries(verdict.a.typeCounts)
                    .map(([k, v]) => `${k} ${v}`)
                    .join(" · ")})
                </small>
              </b>
            </div>
            <div className="sti-fact">
              <span>Cạnh tiên quyết</span>
              <b className="num">
                {Object.values(verdict.a.edgeCounts).reduce((s, v) => s + v, 0)}
                {Object.keys(verdict.a.edgeCounts).length > 0 && (
                  <small>
                    {" "}
                    ({Object.entries(verdict.a.edgeCounts)
                      .map(([k, v]) => `${k.replace("prerequisite_hard", "cứng").replace("related_soft", "mềm").replace("misconception", "QNS")} ${v}`)
                      .join(" · ")})
                  </small>
                )}
              </b>
            </div>
          </div>

          <div className="sti-chapters">
            <span className="tdb-card-title" style={{ fontSize: "0.8125rem" }}>
              {verdict.a.chapters.length} chương
            </span>
            <ul>
              {verdict.a.chapters.map((c) => (
                <li key={c.name}>
                  <span>{c.name}</span>
                  <b className="num">{c.count}</b>
                </li>
              ))}
            </ul>
          </div>

          {/* Hành động: nạp trực tuyến (thử thật) + đường CLI luôn sẵn */}
          <div className="sti-actions">
            <button
              className="btn"
              disabled={sending}
              data-loading={sending || undefined}
              onClick={() => void send(verdict.a)}
            >
              <Send aria-hidden strokeWidth={2} />
              Gửi nạp vào hệ thống
            </button>
            <button className="btn btn-ghost" onClick={() => void copyCmd(verdict.a.fileName)}>
              <ClipboardCopy aria-hidden strokeWidth={2} />
              {copied ? "Đã chép lệnh!" : "Chép lệnh cho vận hành"}
            </button>
          </div>

          {sendMsg && (
            <div className={sendMsg.ok ? "banner ok" : "banner err"} role="status">
              {sendMsg.ok ? (
                <Check aria-hidden strokeWidth={2.5} />
              ) : (
                <AlertTriangle aria-hidden strokeWidth={2} />
              )}
              <span>{sendMsg.text}</span>
            </div>
          )}

          <div className="sti-cli">
            <FileUp aria-hidden strokeWidth={2} />
            <div>
              <span className="muted">
                Đường vận hành (đặt file vào <code>packages/db/bundles/</code> rồi chạy):
              </span>
              <code>{cliCmd(verdict.a.fileName)}</code>
            </div>
          </div>

          <div className="tdb-note">
            <Inbox aria-hidden strokeWidth={2} />
            <span>
              Nội dung nạp vào nằm ở <b>hàng chờ duyệt</b> — chỉ mục đã duyệt (active) mới phục vụ
              học sinh. Không có đường tắt.
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
