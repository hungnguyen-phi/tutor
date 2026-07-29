"use client";

/**
 * CỬA CẮM BỘ CÂU HỎI (Đợt 2) — giáo viên thả gói va.kg-questions/2.2 (đầu ra
 * `convert:questions`, bọc envelope), app kiểm bằng CHÍNH Zod QuestionSet của
 * @tutor/shared (một nguồn chân lý), xem trước THẬT: phủ bao nhiêu node, tỉ lệ
 * câu tự chấm, node nào chưa đủ chuẩn ngân hàng — rồi gửi nạp. Mọi câu vào hàng
 * chờ duyệt: chỉ 'active' (giáo viên bấm Duyệt) mới phục vụ học sinh.
 *
 * Khác StudioIntake (nạp KHUNG node/edge): đây nạp NỘI DUNG câu hỏi vào một
 * phiên bản KG đã có — "ghép quân vào bàn cờ 204 node Toán 10".
 */

import { useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Inbox,
  ListChecks,
  Send,
  UploadCloud,
} from "lucide-react";
import { QuestionSet, FORM_SPEC, checkNodeBank, type Question } from "@tutor/shared";
import { importQuestions } from "../lib/api";

const SUBJECT_LABEL: Record<string, string> = {
  Toan: "Toán", Anh: "Tiếng Anh", Hoa: "Hoá học", Van: "Ngữ văn",
};

type Analysis = {
  fileName: string;
  bundle: unknown;
  subject: string;
  versionLabel: string;
  total: number;
  autoRatio: number;
  nodeCount: number;
  thinNodes: { node: string; reason: string }[];
  formCounts: Record<string, number>;
};

type Verdict =
  | { kind: "idle" }
  | { kind: "invalid"; fileName: string; issues: string[] }
  | { kind: "valid"; a: Analysis };

export default function QuestionIntake() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [verdict, setVerdict] = useState<Verdict>({ kind: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleFile(f: File | undefined | null) {
    setSendMsg(null);
    if (!f) return;
    let raw: unknown;
    try {
      raw = JSON.parse(await f.text());
    } catch {
      setVerdict({ kind: "invalid", fileName: f.name, issues: ["File không phải JSON hợp lệ."] });
      return;
    }
    const parsed = QuestionSet.safeParse(raw);
    if (!parsed.success) {
      setVerdict({
        kind: "invalid",
        fileName: f.name,
        issues: parsed.error.issues.slice(0, 8).map((i) => `${i.path.join(".") || "(gốc)"} — ${i.message}`),
      });
      return;
    }
    const b = parsed.data;

    // Thống kê THẬT: gom theo node, chạy checkNodeBank cho từng node → node nào
    // chưa đạt ≥70% tự chấm (nút chi phí LLM) thì cảnh báo, không giấu.
    const byNode = new Map<string, Question[]>();
    for (const q of b.questions) byNode.set(q.node_id, [...(byNode.get(q.node_id) ?? []), q]);
    const thinNodes = [...byNode.entries()]
      .map(([node, qs]) => ({ node, ...checkNodeBank(qs) }))
      .filter((r) => !r.ok)
      .map((r) => ({ node: r.node, reason: r.reason ?? "chưa đạt chuẩn" }));

    const formCounts: Record<string, number> = {};
    let auto = 0;
    for (const q of b.questions) {
      formCounts[q.dang_cau_hoi] = (formCounts[q.dang_cau_hoi] ?? 0) + 1;
      if (FORM_SPEC[q.dang_cau_hoi].nhom_cham === "auto") auto++;
    }

    setVerdict({
      kind: "valid",
      a: {
        fileName: f.name,
        bundle: b,
        subject: SUBJECT_LABEL[b.subject] ?? b.subject,
        versionLabel: b.version_label,
        total: b.questions.length,
        autoRatio: b.questions.length ? auto / b.questions.length : 0,
        nodeCount: byNode.size,
        thinNodes,
        formCounts,
      },
    });
  }

  async function send(a: Analysis) {
    setSending(true);
    setSendMsg(null);
    try {
      const r = await importQuestions(a.bundle);
      setSendMsg({
        ok: true,
        text:
          r.message ??
          `Đã nạp ${r.accepted ?? a.total} câu vào hàng chờ duyệt cho "${r.version ?? a.versionLabel}".`,
      });
    } catch (e) {
      setSendMsg({
        ok: false,
        text:
          "Chưa nạp được: " +
          (e instanceof Error ? e.message : String(e)) +
          ". Kiểm nhãn phiên bản có khớp bàn cờ đã publish không.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="tdb-card sti">
      <div className="tdb-card-head">
        <span className="tdb-card-title">Cắm bộ câu hỏi vào bàn cờ</span>
        {verdict.kind === "valid" && (
          <span className="pill g">
            <Check aria-hidden strokeWidth={2.5} style={{ width: 13, height: 13 }} /> hợp lệ
          </span>
        )}
        {verdict.kind === "invalid" && <span className="pill a">bị chặn</span>}
      </div>
      <p className="muted">
        Nhận gói câu hỏi <b>.json</b> khuôn <code>va.kg-questions/2.2</code> (đầu ra{" "}
        <code>convert:questions</code>). Câu được ghép vào phiên bản KG khớp <b>nhãn</b> — bàn cờ
        node đầy dần. Kiểm bằng đúng schema hệ thống; lệch là chặn tại cửa.
      </p>

      <label
        className="sti-drop"
        data-over={dragOver || undefined}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); void handleFile(e.dataTransfer.files?.[0]); }}
      >
        <UploadCloud aria-hidden strokeWidth={1.75} />
        <b>Thả bộ câu hỏi vào đây hoặc bấm để chọn</b>
        <span className="muted">questions-*.json · một file mỗi lần</span>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }}
        />
      </label>

      {verdict.kind === "invalid" && (
        <div className="sti-issues" role="alert">
          <div className="sti-issues-head">
            <AlertTriangle aria-hidden strokeWidth={2} />
            <b>{verdict.fileName} không đạt chuẩn — sửa rồi xuất lại:</b>
          </div>
          <ul>{verdict.issues.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}

      {verdict.kind === "valid" && (
        <div className="sti-result">
          <div className="sti-facts">
            <div className="sti-fact">
              <span>Môn · Nhãn phiên bản</span>
              <b>{verdict.a.subject} — {verdict.a.versionLabel}</b>
            </div>
            <div className="sti-fact">
              <span>Số câu · phủ node</span>
              <b className="num">
                {verdict.a.total}
                <small> câu · {verdict.a.nodeCount} node</small>
              </b>
            </div>
            <div className="sti-fact">
              <span>Tự chấm (nhóm A)</span>
              <b className="num">
                {Math.round(verdict.a.autoRatio * 100)}%
                <small> (cần ≥70%/node)</small>
              </b>
            </div>
            <div className="sti-fact">
              <span>Dạng câu</span>
              <b className="num" style={{ fontSize: "0.9rem" }}>
                {Object.entries(verdict.a.formCounts).map(([k, v]) => `${k} ${v}`).join(" · ")}
              </b>
            </div>
          </div>

          {verdict.a.thinNodes.length > 0 && (
            <div className="sti-issues" role="status">
              <div className="sti-issues-head">
                <ListChecks aria-hidden strokeWidth={2} />
                <b>{verdict.a.thinNodes.length} node chưa đạt chuẩn ngân hàng (vẫn nạp được, nên bổ sung):</b>
              </div>
              <ul>
                {verdict.a.thinNodes.slice(0, 6).map((t) => (
                  <li key={t.node}>{t.node} — {t.reason}</li>
                ))}
                {verdict.a.thinNodes.length > 6 && <li>… và {verdict.a.thinNodes.length - 6} node nữa</li>}
              </ul>
            </div>
          )}

          <div className="sti-actions">
            <button
              className="btn"
              disabled={sending}
              data-loading={sending || undefined}
              onClick={() => void send(verdict.a)}
            >
              <Send aria-hidden strokeWidth={2} />
              Gửi nạp vào hàng chờ duyệt
            </button>
          </div>

          {sendMsg && (
            <div className={sendMsg.ok ? "banner ok" : "banner err"} role="status">
              {sendMsg.ok ? <Check aria-hidden strokeWidth={2.5} /> : <AlertTriangle aria-hidden strokeWidth={2} />}
              <span>{sendMsg.text}</span>
            </div>
          )}

          <div className="tdb-note">
            <Inbox aria-hidden strokeWidth={2} />
            <span>
              Câu nạp vào nằm ở <b>hàng chờ duyệt</b> — sang tab này bấm <b>Duyệt</b> từng câu (hoặc
              quét thống kê) thì học sinh mới thấy. Không có đường tắt.
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
