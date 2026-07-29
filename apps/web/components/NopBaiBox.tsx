"use client";

/**
 * NỘP BÀI ĐÃ LÀM NGOÀI — dùng trong KHO BÁU, ngay dưới phiếu bài tập.
 *
 * Vì sao có (lỗi 1, người thử báo 28/07): em tải phiếu về, làm ra giấy, rồi
 * "không có phần upload lên, hoặc chụp hình lên" — bài làm chết ở đó. Khối này
 * dùng lại nguyên đường `submitWork` + `uploadWork` sẵn có nên bài chảy đúng vào
 * hàng đợi chấm của giáo viên, KHÔNG đổi schema: bản nộp vẫn gắn vào một câu
 * [NOPBAI] có thật của bài (server `resources` trả `nopBaiQuestionId`).
 *
 * Kèm Đ1 (người thử 3 đề xuất): CHỤP BẰNG CAMERA LAPTOP — nhiều em học bằng máy
 * của trường, không có điện thoại. `capture="environment"` lo phần điện thoại;
 * nút "Chụp bằng webcam" lo phần laptop qua getUserMedia.
 */

import { useEffect, useRef, useState } from "react";
import { Camera, Check, Paperclip, Send, X } from "lucide-react";
import { diagnose, submitWork, uploadWork, type Subject } from "../lib/api";
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

  // ── Webcam (Đ1) ──────────────────────────────────────────────────────────
  const [camOn, setCamOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCam = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  };
  // Tắt camera khi rời màn — đèn webcam còn sáng sau khi đóng là mất tin cậy.
  useEffect(() => () => stopCam(), []);

  async function openCam() {
    setErr(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = s;
      setCamOn(true);
      // videoRef chỉ tồn tại sau khi camOn → gán ở lượt render kế.
      queueMicrotask(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setErr("Không mở được camera — bạn kiểm tra quyền camera của trình duyệt, hoặc chọn ảnh có sẵn nhé.");
    }
  }

  function snap() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    c.toBlob(
      (b) => {
        if (!b) return;
        setFile(new File([b], `bai-lam-${Date.now()}.jpg`, { type: "image/jpeg" }));
        stopCam();
      },
      "image/jpeg",
      0.9,
    );
  }

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
      setDone(true);
      setMsg(res.feedback ?? "Đã nhận bài của bạn! Thầy cô sẽ chấm và báo lại.");
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
            <b>Đã nộp bài cho thầy cô!</b>
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
          <b>Làm xong phiếu rồi? Nộp cho thầy cô</b>
          <span className="muted">
            Gõ bài làm, hoặc chụp ảnh bài trên giấy. Thầy cô chấm xong sẽ báo lại trên lộ trình.
          </span>
        </div>
      </header>

      <textarea
        className="ans-input"
        rows={2}
        placeholder="Gõ bài làm của bạn ở đây (nếu bài viết tay thì chụp ảnh bên dưới)…"
        value={text}
        disabled={busy}
        onChange={(e) => {
          setText(e.target.value);
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
        }}
        autoCapitalize="sentences"
        autoCorrect="off"
        spellCheck={false}
      />

      {camOn && (
        <div className="nb-cam">
          {/* muted + playsInline: iOS/Safari chặn autoplay video có tiếng. */}
          <video ref={videoRef} className="nb-cam-view" muted playsInline />
          <div className="nb-cam-row">
            <button type="button" className="btn btn-check" onClick={snap}>
              <Camera aria-hidden strokeWidth={2.25} />
              Chụp
            </button>
            <button type="button" className="btn btn-ghost" onClick={stopCam}>
              Huỷ
            </button>
          </div>
        </div>
      )}

      <div className="nb-row">
        <label className="submit-attach">
          <input
            className="sr-only"
            type="file"
            accept="image/*,.pdf,.doc,.docx,.txt"
            capture="environment"
            disabled={busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setErr(null);
            }}
          />
          <Paperclip aria-hidden strokeWidth={2.25} />
          <span>{file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : "Chọn ảnh / tệp bài làm"}</span>
        </label>
        {!camOn && !file && (
          <button type="button" className="btn btn-ghost nb-cam-btn" disabled={busy} onClick={openCam}>
            <Camera aria-hidden strokeWidth={2.25} />
            Chụp bằng webcam
          </button>
        )}
        {file && (
          <button type="button" className="submit-unattach" onClick={() => setFile(null)} aria-label="Gỡ tệp">
            <X aria-hidden strokeWidth={2.5} />
          </button>
        )}
      </div>

      {msg && <p className="nb-msg">{msg}</p>}
      {err && <p className="nb-err">{err}</p>}

      <button
        className="btn btn-check nb-send"
        disabled={busy || (!text.trim() && !file)}
        data-loading={busy || undefined}
        onClick={send}
      >
        <Check aria-hidden strokeWidth={2.5} />
        NỘP BÀI CHO THẦY CÔ
      </button>
    </section>
  );
}
