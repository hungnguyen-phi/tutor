"use client";

/**
 * NỘP BÀI ĐÃ LÀM NGOÀI — dùng trong KHO BÁU, ngay dưới phiếu bài tập.
 *
 * Vì sao có (lỗi 1, người thử báo 28/07): em tải phiếu về, làm ra giấy, rồi
 * "không có phần upload lên, hoặc chụp hình lên" — bài làm chết ở đó. Khối này
 * dùng lại nguyên đường `submitWork` + `uploadWork` sẵn có, KHÔNG đổi schema:
 * bản nộp vẫn gắn vào một câu [NOPBAI] có thật của bài (server `resources` trả
 * `nopBaiQuestionId`).
 *
 * 01/08 — AI CHẤM HẾT, không còn hàng đợi giáo viên. Nộp xong biết kết quả
 * ngay; chưa đạt thì được nói rõ thiếu ý nào và nộp lại bao nhiêu lần cũng được.
 *
 * Kèm Đ1 (người thử 3 đề xuất): CHỤP BẰNG CAMERA LAPTOP — nhiều em học bằng máy
 * của trường, không có điện thoại. `capture="environment"` lo phần điện thoại;
 * nút "Chụp bằng webcam" lo phần laptop qua getUserMedia.
 */

import { useState } from "react";
import { Check, Paperclip, Send, X } from "lucide-react";
import { diagnose, submitWork, uploadWork, type Subject } from "../lib/api";
import BaiLamEditor from "./BaiLamEditor";
import CameraShot from "./CameraShot";
import Lion from "./Lion";

export default function NopBaiBox({
  subject,
  nodeKey,
  questionId,
}: {
  subject: Subject;
  nodeKey: string;
  questionId: string;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  /** Kết quả chấm: true đạt · false chưa đạt · null chưa chấm được. */
  const [dat, setDat] = useState<boolean | null>(null);

  async function send() {
    if (busy || (!text.trim() && !file)) return;
    // Chặn TẠI CHỖ trước khi chạm server: mở phiên học rồi mới biết bài không
    // hợp lệ là đẻ một `learning_sessions` rác + ăn một lượt rate-limit của
    // diagnose, mỗi lần em gõ hụt.
    if (!file && text.trim().split(/\s+/).filter(Boolean).length < 3) {
      setMsg("Bài nộp cần lời giải của bạn — viết thêm vài câu, hoặc chụp ảnh bài trên giấy nhé.");
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      // Kho báu KHÔNG có sẵn phiên học → mở một phiên đúng bài này rồi nộp vào
      // đó, để bản nộp gắn đúng session/node như bài nộp trong luồng học.
      const ses = await diagnose(subject, nodeKey, questionId);
      const path = file ? await uploadWork(file) : undefined;
      const res = await submitWork(ses.sessionId, questionId, {
        ...(text.trim() ? { text: text.trim() } : {}),
        ...(path ? { filePath: path, mime: file!.type, size: file!.size } : {}),
      });
      if (res.submitted === false) {
        setMsg(res.feedback ?? "Bài chưa đủ để nộp — bạn viết rõ hơn rồi gửi lại nhé.");
        return;
      }
      setMsg(res.feedback ?? null);
      // CHƯA đạt hoặc CHƯA chấm được thì KHÔNG chuyển sang màn "xong": giữ
      // nguyên bài em vừa viết để sửa rồi nộp lại — đóng màn lại là mất bài.
      if (res.dat !== true) {
        setDat(res.dat ?? null);
        return;
      }
      setDat(true);
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <section className="nb-box" data-done role="status">
        <div className="nb-done">
          <Lion mood="cheer" size={48} decorative />
          <div>
            <b>Bài đạt rồi — đã ghi vào lộ trình!</b>
            <p className="muted">{msg}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="nb-box">
      <header className="nb-head">
        <Send aria-hidden strokeWidth={2.25} />
        <div>
          <b>Làm xong phiếu rồi? Nộp bài</b>
          <span className="muted">
            Gõ bài làm (có ô chèn công thức), hoặc chụp ảnh bài trên giấy. Nộp xong biết kết quả ngay.
          </span>
        </div>
      </header>

      <BaiLamEditor
        value={text}
        onChange={setText}
        disabled={busy}
        rows={2}
        maxHeight={260}
        placeholder="Gõ bài làm của bạn ở đây (bài viết tay thì chụp ảnh bên dưới)…"
      />

      <div className="nb-row">
        <label className="submit-attach">
          <input
            className="sr-only"
            type="file"
            /* .pdf và .doc cũ CỐ Ý bỏ khỏi danh sách: server đọc không ra hai
               định dạng đó, nhận vào rồi mới báo hỏng là bắt em tải công cốc. */
            accept="image/*,.docx,.txt"
            capture="environment"
            disabled={busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setErr(null);
            }}
          />
          <Paperclip aria-hidden strokeWidth={2.25} />
          <span>{file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : "Chọn ảnh bài viết tay / tệp Word"}</span>
        </label>
        {!file && <CameraShot disabled={busy} onCapture={setFile} onError={setErr} />}
        {file && (
          <button type="button" className="submit-unattach" onClick={() => setFile(null)} aria-label="Gỡ tệp">
            <X aria-hidden strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* `data-dat` cho CSS tô đúng giọng: chưa đạt là lời hướng dẫn (không phải
          báo lỗi đỏ lòm), chưa chấm được là lời trấn an. */}
      {msg && <p className="nb-msg" data-dat={dat === false ? "chua" : dat === null ? "cho" : undefined}>{msg}</p>}
      {err && <p className="nb-err">{err}</p>}

      <button
        className="btn btn-check nb-send"
        disabled={busy || (!text.trim() && !file)}
        data-loading={busy || undefined}
        onClick={send}
      >
        <Check aria-hidden strokeWidth={2.5} />
        {dat === false ? "NỘP LẠI" : "NỘP BÀI"}
      </button>
    </section>
  );
}
