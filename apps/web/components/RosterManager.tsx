"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CloudOff, GraduationCap, Info, Loader2, Plus, Upload, UserPlus, Users } from "lucide-react";
import { adminRoster, type ImportResult, type RosterClass, type RosterOverview } from "../lib/api";

/**
 * Quản trị Roster (Pha 3) — admin tạo lớp, thêm/nạp học sinh thật, phân công
 * GVCN/coach/buddy, nối phụ huynh. Mọi ghi qua edge `admin-roster` (service role,
 * chốt tenant, chỉ admin, allowlist vai, audit). Đồng bộ hệ thống trường: scaffold.
 * Đây là NƠI bảng "Lớp" ở /scoreboard có dữ liệu thật.
 */

/** Ô nhập có nhãn gắn đúng (htmlFor/id) — a11y. */
function TextField({ id, label, value, onChange, placeholder, email }: {
  id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; email?: boolean;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={email ? "email" : "text"} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} autoCapitalize={email ? "none" : undefined} />
    </div>
  );
}
function SelectField({ id, label, value, onChange, children }: {
  id: string; label: string; value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>
    </div>
  );
}

/** Parser CSV nhỏ (hỗ trợ dấu ngoặc kép + phẩy trong ô + BOM). Trả object theo header. */
function parseCsv(input: string): Record<string, string>[] {
  const text = input.replace(/^﻿/, ""); // bỏ BOM của Excel
  const rows: string[][] = [];
  let cur: string[] = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { cur.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      cur.push(field); field = "";
      if (cur.some((x) => x.trim() !== "")) rows.push(cur);
      cur = [];
    } else field += c;
  }
  if (field !== "" || cur.length) { cur.push(field); if (cur.some((x) => x.trim() !== "")) rows.push(cur); }
  if (rows.length < 2) return [];
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => (o[h] = (r[i] ?? "").trim()));
    return o;
  });
}

/** Chuẩn hoá cột (chấp nhận tên cột tiếng Việt có/không dấu) → khuôn edge fn. */
const mapRow = (o: Record<string, string>) => ({
  email: o.email || o["e-mail"] || "",
  fullName: o.hoten || o["họ tên"] || o["ho ten"] || o["họ và tên"] || o.fullname || o.name || "",
  grade: o.khoi || o["khối"] || o.grade || "",
  class: o.lop || o["lớp"] || o.class || o.classname || "",
  role: o.vaitro || o["vai trò"] || o.role || "",
});

const CSV_TEMPLATE = "email,hoTen,khoi,lop\nhs.an@vietanh.edu.vn,Nguyễn Văn An,10,10A1\nhs.binh@vietanh.edu.vn,Trần Thị Bình,10,10A1";

export default function RosterManager() {
  const [ov, setOv] = useState<RosterOverview | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);

  const load = useCallback(() => {
    adminRoster<RosterOverview>("overview")
      .then((d) => { setOv(d); setLoadErr(null); })
      .catch((e) => setLoadErr(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(() => { load(); }, [load]);

  /** Chạy một hành động: khoá nút, báo kết quả, nạp lại overview. `kind` cho phép
   *  báo trung tính (vd sync "chưa cắm" không phải thành công). */
  async function run(key: string, fn: () => Promise<{ text: string; kind?: "ok" | "info" }>) {
    setBusy(key); setMsg(null);
    try {
      const r = await fn();
      setMsg({ kind: r.kind ?? "ok", text: r.text });
      load();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }

  const [cls, setCls] = useState({ grade: "", name: "", schoolYear: "", homeroomTeacherEmail: "" });
  const [stu, setStu] = useState({ email: "", fullName: "", grade: "", classId: "" });
  const [csv, setCsv] = useState("");
  const [impYear, setImpYear] = useState("");
  const [imp, setImp] = useState<ImportResult | null>(null);
  const [hr, setHr] = useState({ classId: "", teacherEmail: "" });
  const [mentor, setMentor] = useState({ studentEmail: "", mentorEmail: "", kind: "homeroom_coach" });
  const [parent, setParent] = useState({ parentEmail: "", studentEmail: "", parentName: "" });

  const classOptions: RosterClass[] = ov?.classes ?? [];
  // Parse CSV MỘT lần theo nội dung (không re-parse mỗi lần gõ/render).
  const importRows = useMemo(() => (csv.trim() ? parseCsv(csv).map(mapRow).filter((r) => r.email) : []), [csv]);

  return (
    <div className="stack">
      <div className="kpis">
        <div className="kpi"><b className="num">{ov?.totals.students ?? "–"}</b><span>Học sinh</span></div>
        <div className="kpi"><b className="num">{ov?.classes.length ?? "–"}</b><span>Lớp</span></div>
        <div className="kpi" data-warn={(ov && ov.totals.unassigned > 0) || undefined}>
          <b className="num">{ov?.totals.unassigned ?? "–"}</b><span>Chưa xếp lớp</span>
        </div>
      </div>

      {msg && (
        <div className={`banner ${msg.kind === "err" ? "err" : "info"}`}>
          {msg.kind === "ok" ? <Check aria-hidden strokeWidth={2} /> : msg.kind === "err" ? <AlertTriangle aria-hidden strokeWidth={2} /> : <Info aria-hidden strokeWidth={2} />}
          <span>{msg.text}</span>
        </div>
      )}
      {loadErr && (
        <div className="banner err">
          <AlertTriangle aria-hidden strokeWidth={2} />
          <span>Không tải được roster: {loadErr}</span>
        </div>
      )}

      <section className="panel">
        <h2 className="h3"><Users aria-hidden strokeWidth={2} /> Lớp học</h2>
        {classOptions.length === 0 ? (
          <p className="muted">Chưa có lớp nào. Tạo lớp bên dưới hoặc nạp danh sách để tự tạo lớp.</p>
        ) : (
          <table className="tbl">
            <thead><tr><th>Khối</th><th>Lớp</th><th>GVCN</th><th>Sĩ số</th></tr></thead>
            <tbody>
              {classOptions.map((c) => (
                <tr key={c.id}>
                  <td>{c.grade}</td>
                  <td><b>{c.name}</b>{c.schoolYear ? <span className="muted"> · {c.schoolYear}</span> : null}</td>
                  <td>{c.homeroom ?? <span className="muted">chưa gán</span>}</td>
                  <td>{c.students}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2 className="h3"><Plus aria-hidden strokeWidth={2} /> Tạo lớp</h2>
        <div className="form-row">
          <TextField id="cls-grade" label="Khối" value={cls.grade} onChange={(v) => setCls({ ...cls, grade: v })} placeholder="10" />
          <TextField id="cls-name" label="Tên lớp" value={cls.name} onChange={(v) => setCls({ ...cls, name: v })} placeholder="10A1" />
          <TextField id="cls-year" label="Năm học" value={cls.schoolYear} onChange={(v) => setCls({ ...cls, schoolYear: v })} placeholder="2026-2027" />
          <TextField id="cls-hr" label="Email GVCN (tuỳ chọn)" value={cls.homeroomTeacherEmail} onChange={(v) => setCls({ ...cls, homeroomTeacherEmail: v })} placeholder="gv@vietanh.edu.vn" email />
        </div>
        <button className="btn" disabled={busy === "createClass" || !cls.grade || !cls.name}
          onClick={() => run("createClass", async () => {
            await adminRoster("createClass", cls);
            const n = cls.name;
            setCls({ grade: "", name: "", schoolYear: "", homeroomTeacherEmail: "" });
            return { text: `Đã tạo lớp ${n}.` };
          })}>
          {busy === "createClass" ? <Loader2 className="spin" aria-hidden /> : <Plus aria-hidden strokeWidth={2} />} Tạo lớp
        </button>
      </section>

      <section className="panel">
        <h2 className="h3"><UserPlus aria-hidden strokeWidth={2} /> Thêm học sinh</h2>
        <div className="form-row">
          <TextField id="stu-email" label="Email" value={stu.email} onChange={(v) => setStu({ ...stu, email: v })} placeholder="hs@vietanh.edu.vn" email />
          <TextField id="stu-name" label="Họ tên" value={stu.fullName} onChange={(v) => setStu({ ...stu, fullName: v })} placeholder="Nguyễn Văn An" />
          <TextField id="stu-grade" label="Khối" value={stu.grade} onChange={(v) => setStu({ ...stu, grade: v })} placeholder="10" />
          <SelectField id="stu-class" label="Lớp" value={stu.classId} onChange={(v) => setStu({ ...stu, classId: v })}>
            <option value="">— chưa xếp —</option>
            {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectField>
        </div>
        <button className="btn" disabled={busy === "upsertStudent" || !stu.email}
          onClick={() => run("upsertStudent", async () => {
            await adminRoster("upsertStudent", stu);
            const em = stu.email;
            setStu({ email: "", fullName: "", grade: "", classId: "" });
            return { text: `Đã thêm/cập nhật ${em}.` };
          })}>
          {busy === "upsertStudent" ? <Loader2 className="spin" aria-hidden /> : <UserPlus aria-hidden strokeWidth={2} />} Lưu học sinh
        </button>
      </section>

      <section className="panel">
        <h2 className="h3"><Upload aria-hidden strokeWidth={2} /> Nạp danh sách (CSV)</h2>
        <p className="muted">
          Cột: <code>email, hoTen, khoi, lop</code> (thêm <code>vaiTro</code> nếu tạo GV/PH). Lớp mới sẽ tự tạo.
          Xuất Excel → "CSV UTF-8" rồi dán vào đây hoặc chọn tệp.
        </p>
        <div className="form-row">
          <TextField id="imp-year" label="Năm học cho lớp mới (tuỳ chọn)" value={impYear} onChange={setImpYear} placeholder="2026-2027" />
        </div>
        <div className="row">
          <label className="btn btn-white" style={{ cursor: "pointer" }}>
            <Upload aria-hidden strokeWidth={2} /> Chọn tệp CSV
            <input type="file" accept=".csv,text/csv" hidden onChange={(e) => {
              const f = e.target.files?.[0];
              e.currentTarget.value = ""; // reset để chọn lại cùng tệp vẫn kích hoạt
              if (!f) return;
              f.text().then((txt) => {
                setCsv(txt);
                if (txt.includes("�")) setMsg({ kind: "info", text: "Tệp có ký tự lỗi mã hoá — hãy xuất lại từ Excel dạng 'CSV UTF-8' để tên tiếng Việt không bị hỏng." });
              });
            }} />
          </label>
          <button className="btn btn-quiet" type="button" onClick={() => setCsv(CSV_TEMPLATE)}>Dán mẫu</button>
        </div>
        <textarea rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="email,hoTen,khoi,lop&#10;..." style={{ fontFamily: "monospace", marginTop: 8 }} aria-label="Nội dung CSV" />
        <button className="btn" disabled={busy === "import" || importRows.length === 0}
          onClick={() => run("import", async () => {
            const res = await adminRoster<ImportResult>("import", { rows: importRows, schoolYear: impYear || undefined });
            setImp(res);
            return { text: `Nạp xong: ${res.created} mới, ${res.updated} cập nhật${res.errorCount ? `, ${res.errorCount} lỗi` : ""}.`, kind: res.errorCount ? "info" as const : "ok" as const };
          })}>
          {busy === "import" ? <Loader2 className="spin" aria-hidden /> : <Upload aria-hidden strokeWidth={2} />} Nạp {importRows.length > 0 ? `${importRows.length} dòng` : ""}
        </button>
        {csv.trim() && importRows.length === 0 && <p className="muted">Chưa đọc được dòng hợp lệ nào (cần cột <code>email</code> + dòng tiêu đề).</p>}
        {imp && (
          <div className="import-result">
            {imp.credentials.length > 0 && (
              <>
                <p><b>Mật khẩu tạm cho {imp.credentials.length} tài khoản mới</b> (phát cho học sinh, sẽ đổi khi đăng nhập / dùng SSO). Chỉ hiện lần này:</p>
                <table className="tbl"><thead><tr><th>Email</th><th>Mật khẩu tạm</th></tr></thead>
                  <tbody>{imp.credentials.map((c) => <tr key={c.email}><td>{c.email}</td><td><code>{c.password}</code></td></tr>)}</tbody>
                </table>
              </>
            )}
            {imp.errors.length > 0 && (
              <>
                <p className="err-title"><AlertTriangle aria-hidden strokeWidth={2} /> {imp.errorCount} dòng lỗi:</p>
                <ul className="muted">{imp.errors.map((e, i) => <li key={i}>{e.email}: {e.error}</li>)}</ul>
              </>
            )}
          </div>
        )}
      </section>

      <section className="panel">
        <h2 className="h3"><GraduationCap aria-hidden strokeWidth={2} /> Phân công</h2>

        <h3 className="h4">GVCN cho lớp</h3>
        <div className="form-row">
          <SelectField id="hr-class" label="Lớp" value={hr.classId} onChange={(v) => setHr({ ...hr, classId: v })}>
            <option value="">— chọn lớp —</option>
            {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectField>
          <TextField id="hr-email" label="Email GVCN" value={hr.teacherEmail} onChange={(v) => setHr({ ...hr, teacherEmail: v })} placeholder="gv@vietanh.edu.vn" email />
        </div>
        <button className="btn btn-sm" disabled={busy === "assignHomeroom" || !hr.classId || !hr.teacherEmail}
          onClick={() => run("assignHomeroom", async () => { const r = await adminRoster<{ linked: number }>("assignHomeroom", hr); return { text: `Đã gán GVCN (nối ${r.linked} học sinh).` }; })}>
          Gán GVCN
        </button>

        <h3 className="h4" style={{ marginTop: 16 }}>Coach / Buddy cho học sinh</h3>
        <div className="form-row">
          <TextField id="mt-stu" label="Email học sinh" value={mentor.studentEmail} onChange={(v) => setMentor({ ...mentor, studentEmail: v })} placeholder="hs@vietanh.edu.vn" email />
          <TextField id="mt-mentor" label="Email người đồng hành" value={mentor.mentorEmail} onChange={(v) => setMentor({ ...mentor, mentorEmail: v })} placeholder="gv@vietanh.edu.vn" email />
          <SelectField id="mt-kind" label="Vai trò" value={mentor.kind} onChange={(v) => setMentor({ ...mentor, kind: v })}>
            <option value="homeroom_coach">Coach (GVCN 4DX)</option>
            <option value="buddy">Buddy</option>
          </SelectField>
        </div>
        <button className="btn btn-sm" disabled={busy === "assignMentor" || !mentor.studentEmail || !mentor.mentorEmail}
          onClick={() => run("assignMentor", async () => { await adminRoster("assignMentor", mentor); return { text: "Đã phân công người đồng hành." }; })}>
          Phân công
        </button>

        <h3 className="h4" style={{ marginTop: 16 }}>Liên kết phụ huynh</h3>
        <div className="form-row">
          <TextField id="pa-email" label="Email phụ huynh" value={parent.parentEmail} onChange={(v) => setParent({ ...parent, parentEmail: v })} placeholder="ph@example.com" email />
          <TextField id="pa-name" label="Tên phụ huynh" value={parent.parentName} onChange={(v) => setParent({ ...parent, parentName: v })} placeholder="Nguyễn Văn B" />
          <TextField id="pa-stu" label="Email học sinh (con)" value={parent.studentEmail} onChange={(v) => setParent({ ...parent, studentEmail: v })} placeholder="hs@vietanh.edu.vn" email />
        </div>
        <button className="btn btn-sm" disabled={busy === "linkParent" || !parent.parentEmail || !parent.studentEmail}
          onClick={() => run("linkParent", async () => { await adminRoster("linkParent", parent); return { text: "Đã liên kết phụ huynh (đăng nhập bằng magic-link)." }; })}>
          Liên kết
        </button>
      </section>

      <section className="panel">
        <h2 className="h3"><CloudOff aria-hidden strokeWidth={2} /> Đồng bộ hệ thống trường</h2>
        <p className="muted">Kéo lớp/học sinh từ SIS hoặc Google Classroom. Khung đã dựng, <b>chưa cắm nguồn</b>.</p>
        <button className="btn btn-quiet btn-sm" disabled={busy === "sync"}
          onClick={() => run("sync", async () => { const r = await adminRoster<{ note: string }>("sync"); return { text: r.note, kind: "info" as const }; })}>
          {busy === "sync" ? <Loader2 className="spin" aria-hidden /> : <CloudOff aria-hidden strokeWidth={2} />} Kiểm tra kết nối
        </button>
      </section>
    </div>
  );
}
