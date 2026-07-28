"use client";

/**
 * TAB HỌC LIỆU (giáo viên) — gắn tài liệu vào từng BÀI.
 *
 * Hai cột: trái là TOÀN BỘ bài của môn (gom theo chương, tìm nhanh, thấy ngay
 * bài nào còn trống); phải là kho báu của bài đang chọn.
 *
 * Ba mức: mức 1 mở trước, em xem xong mới mở mức 2, rồi mức 3 — mỗi lượt vào
 * chỉ thêm một mức, nên kho báu là lý do quay lại bài cũ.
 *
 * Nhiều định dạng cho cùng một nội dung thì TICK cái nào muốn học sinh thấy;
 * tick nhiều thì hiện SONG SONG (em nào hợp nghe thì nghe, hợp nhìn thì nhìn).
 */

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, FileUp, Gift, Link2, Loader2, Plus, Search, Trash2 } from "lucide-react";
import {
  teacherNodes, teacherNodeResources, teacherResourceSave, teacherResourceToggle,
  teacherResourceRemove, uploadHocLieu, TRAN_TEP_MB,
  type ResourceFormat, type TeacherNode, type TeacherResourceItem,
} from "../lib/api";

const FORMAT_LABEL: Record<ResourceFormat, string> = {
  text: "Bài đọc", infographic: "Tranh tóm tắt", video: "Phim ngắn", animation: "Hoạt hình",
  mindmap: "Sơ đồ tư duy", podcast: "Nghe kể", worked_example: "Bài giải mẫu",
  interactive: "Tương tác", slide: "Bài giảng", worksheet: "Phiếu bài tập",
  flashcard: "Thẻ ghi nhớ", quiz: "Câu đố nhanh",
};
const FORMATS = Object.keys(FORMAT_LABEL) as ResourceFormat[];

export default function HocLieuTab() {
  const [nodes, setNodes] = useState<TeacherNode[]>([]);
  const [phamVi, setPhamVi] = useState("");
  const [tim, setTim] = useState("");
  const [chon, setChon] = useState<TeacherNode | null>(null);
  const [items, setItems] = useState<TeacherResourceItem[]>([]);
  const [dangTai, setDangTai] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);

  // form thêm học liệu
  const [tieuDe, setTieuDe] = useState("");
  const [format, setFormat] = useState<ResourceFormat>("slide");
  const [tier, setTier] = useState(1);
  const [link, setLink] = useState("");
  const [tep, setTep] = useState<File | null>(null);
  const [goiY, setGoiY] = useState("");
  const [dangLuu, setDangLuu] = useState(false);

  useEffect(() => {
    teacherNodes()
      .then((r) => { setNodes(r.nodes ?? []); setPhamVi(r.phamVi ?? ""); })
      .catch((e) => setLoi(e instanceof Error ? e.message : String(e)));
  }, []);

  async function moBai(n: TeacherNode) {
    setChon(n);
    setItems([]);
    setDangTai(true);
    setLoi(null);
    try {
      const r = await teacherNodeResources(n.key);
      setItems(r.items ?? []);
    } catch (e) {
      setLoi(e instanceof Error ? e.message : String(e));
    } finally {
      setDangTai(false);
    }
  }

  async function themHocLieu() {
    if (!chon || dangLuu) return;
    if (!link.trim() && !tep) { setLoi("Chọn một tệp hoặc dán một đường link."); return; }
    setDangLuu(true);
    setLoi(null);
    try {
      const uri = tep ? await uploadHocLieu(tep, chon.key) : link.trim();
      await teacherResourceSave({
        nodeKey: chon.key, tieuDe: tieuDe.trim() || undefined,
        format, tier, uri, goiY: goiY.trim() || undefined, hienThi: true,
      });
      setTieuDe(""); setLink(""); setTep(null); setGoiY("");
      await moBai(chon);
      // Đếm lại ở cột trái để bài vừa thêm không còn hiện "chưa có học liệu".
      setNodes((ns) => ns.map((n) => n.key === chon.key
        ? { ...n, soHocLieu: n.soHocLieu + 1, soHien: n.soHien + 1 } : n));
    } catch (e) {
      setLoi(e instanceof Error ? e.message : String(e));
    } finally {
      setDangLuu(false);
    }
  }

  async function bat(it: TeacherResourceItem) {
    setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, hien_thi: !x.hien_thi } : x)));
    try { await teacherResourceToggle(it.id, !it.hien_thi); }
    catch (e) {
      setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, hien_thi: it.hien_thi } : x)));
      setLoi(e instanceof Error ? e.message : String(e));
    }
  }

  async function go(it: TeacherResourceItem) {
    if (!confirm("Gỡ học liệu này khỏi bài? Tệp trong kho cũng bị xoá.")) return;
    try {
      await teacherResourceRemove(it.id);
      setItems((xs) => xs.filter((x) => x.id !== it.id));
      if (chon) {
        setNodes((ns) => ns.map((n) => n.key === chon.key
          ? { ...n, soHocLieu: Math.max(0, n.soHocLieu - 1), soHien: Math.max(0, n.soHien - (it.hien_thi ? 1 : 0)) } : n));
      }
    } catch (e) { setLoi(e instanceof Error ? e.message : String(e)); }
  }

  const loc = useMemo(() => {
    const q = tim.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter((n) => n.label.toLowerCase().includes(q) || n.chapter.toLowerCase().includes(q));
  }, [nodes, tim]);

  // Gom theo chương để cô nhìn ra cấu trúc chương trình thay vì một danh sách dài.
  const theoChuong = useMemo(() => {
    const m = new Map<string, TeacherNode[]>();
    for (const n of loc) {
      const k = n.chapter || "Khác";
      (m.get(k) ?? m.set(k, []).get(k)!).push(n);
    }
    return [...m.entries()];
  }, [loc]);

  const theoMuc = (m: number) => items.filter((x) => (x.tier ?? 1) === m);

  return (
    <div className="hl">
      {loi && <div className="banner err">{loi}</div>}
      <div className="hl-grid">
        {/* ── Cột trái: toàn bộ bài của môn ─────────────────────────────── */}
        <aside className="hl-nodes">
          <label className="hl-search">
            <Search aria-hidden strokeWidth={2} />
            <input
              value={tim}
              onChange={(e) => setTim(e.target.value)}
              placeholder={`Tìm trong ${nodes.length} bài…`}
              aria-label="Tìm bài"
            />
          </label>
          {phamVi && <p className="muted hl-scope">{phamVi}</p>}
          <div className="hl-list">
            {theoChuong.map(([chuong, ds]) => (
              <section key={chuong}>
                <h4 className="hl-chapter">{chuong}</h4>
                {ds.map((n) => (
                  <button
                    key={n.key}
                    className="hl-node"
                    aria-current={chon?.key === n.key || undefined}
                    onClick={() => moBai(n)}
                  >
                    <span className="hl-node-name">{n.label}</span>
                    <span className="hl-node-meta">
                      {n.soHocLieu > 0 ? (
                        <b className="hl-has">
                          <Gift aria-hidden strokeWidth={2.25} />
                          {n.soHien}/{n.soHocLieu}
                        </b>
                      ) : (
                        <i className="muted">chưa có</i>
                      )}
                      <small className="muted">{n.soCau} câu</small>
                    </span>
                  </button>
                ))}
              </section>
            ))}
          </div>
        </aside>

        {/* ── Cột phải: kho báu của bài đang chọn ────────────────────────── */}
        <div className="hl-detail">
          {!chon ? (
            <div className="hl-empty">
              <Gift aria-hidden strokeWidth={1.5} />
              <p>Chọn một bài bên trái để thêm học liệu cho bài đó.</p>
            </div>
          ) : (
            <>
              <header className="hl-detail-head">
                <b className="h3">{chon.label}</b>
                <span className="muted">{chon.chapter}</span>
              </header>

              {dangTai && <p className="muted">Đang mở…</p>}

              {[1, 2, 3].map((m) => (
                <section key={m} className="hl-tier">
                  <h4>
                    Mức {m}
                    <small className="muted">
                      {m === 1 ? " — em thấy ngay lần đầu" : m === 2 ? " — mở sau khi xem xong mức 1" : " — mở sau khi xem xong mức 2"}
                    </small>
                  </h4>
                  {theoMuc(m).length === 0 ? (
                    <p className="muted hl-tier-empty">Chưa có gì ở mức này.</p>
                  ) : (
                    <ul className="hl-items">
                      {theoMuc(m).map((it) => (
                        <li key={it.id} className="hl-item" data-off={!it.hien_thi || undefined}>
                          <span className="hl-item-main">
                            <b>{it.tieu_de || FORMAT_LABEL[it.format] || it.format}</b>
                            <small className="muted">
                              {FORMAT_LABEL[it.format] ?? it.format} ·{" "}
                              {/^https?:\/\//i.test(it.uri) ? "link ngoài" : (it.uri.split("/").pop() ?? "tệp")}
                            </small>
                          </span>
                          <button
                            className="hl-eye"
                            onClick={() => bat(it)}
                            aria-pressed={it.hien_thi}
                            title={it.hien_thi ? "Đang hiện cho học sinh — bấm để ẩn" : "Đang ẩn — bấm để hiện"}
                          >
                            {it.hien_thi ? <Eye aria-hidden strokeWidth={2.25} /> : <EyeOff aria-hidden strokeWidth={2.25} />}
                          </button>
                          <button className="hl-del" onClick={() => go(it)} aria-label="Gỡ học liệu">
                            <Trash2 aria-hidden strokeWidth={2.25} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}

              {/* ── Thêm mới ─────────────────────────────────────────────── */}
              <section className="hl-add">
                <h4>Thêm học liệu</h4>
                <div className="hl-row">
                  <label className="hl-field">
                    <span>Tên hiện cho học sinh</span>
                    <input value={tieuDe} onChange={(e) => setTieuDe(e.target.value)} placeholder="Ví dụ: Nghe kể về mệnh đề" />
                  </label>
                  <label className="hl-field hl-field-sm">
                    <span>Mức</span>
                    <select value={tier} onChange={(e) => setTier(Number(e.target.value))}>
                      <option value={1}>Mức 1</option>
                      <option value={2}>Mức 2</option>
                      <option value={3}>Mức 3</option>
                    </select>
                  </label>
                  <label className="hl-field hl-field-sm">
                    <span>Kiểu</span>
                    <select value={format} onChange={(e) => setFormat(e.target.value as ResourceFormat)}>
                      {FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
                    </select>
                  </label>
                </div>
                <div className="hl-row">
                  <label className="hl-field">
                    <span><Link2 aria-hidden strokeWidth={2} /> Dán link (YouTube, Drive, Google Slides…)</span>
                    <input
                      value={link}
                      onChange={(e) => { setLink(e.target.value); if (e.target.value) setTep(null); }}
                      placeholder="https://…"
                      disabled={!!tep}
                    />
                  </label>
                  <label className="hl-upload">
                    <input
                      className="sr-only"
                      type="file"
                      onChange={(e) => { setTep(e.target.files?.[0] ?? null); setLink(""); }}
                    />
                    <FileUp aria-hidden strokeWidth={2} />
                    {tep ? `${tep.name} (${Math.round(tep.size / 1024)} KB)` : "hoặc tải tệp lên"}
                  </label>
                </div>
                <label className="hl-field">
                  <span>Một dòng gợi ý (hiện dưới khung xem)</span>
                  <input value={goiY} onChange={(e) => setGoiY(e.target.value)} placeholder="Nghe 3 phút trước khi làm bài." />
                </label>
                <button className="btn btn-check" disabled={dangLuu} onClick={themHocLieu}>
                  {dangLuu ? <Loader2 aria-hidden className="spin" strokeWidth={2.5} /> : <Plus aria-hidden strokeWidth={2.5} />}
                  {dangLuu ? "Đang lưu…" : "Thêm vào bài"}
                </button>
                <p className="muted hl-hint">
                  <b>Video</b> nên đưa lên YouTube (chọn &laquo;không công khai&raquo;) hoặc Drive rồi dán link — tệp tải thẳng
                  lên kho tối đa {TRAN_TEP_MB} MB, video thường vượt xa mức đó. <b>Slide PowerPoint</b> nên xuất PDF (xem
                  được ngay trên điện thoại); .pptx thì học sinh phải tải về mới mở. <b>Podcast</b> phải là tệp .mp3 mới nghe tại chỗ.
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
