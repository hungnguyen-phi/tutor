"use client";

/**
 * CHỤP ẢNH BÀI LÀM BẰNG CAMERA — dùng chung cho ô nộp bài trong BÀI HỌC và
 * trong KHO BÁU.
 *
 * Vì sao (Đ1, người thử 3 đề xuất 29/07): nhiều em học bằng máy của trường,
 * không có điện thoại để chụp rồi gửi qua. Ô "chọn tệp" kèm `capture` chỉ lo
 * được phần điện thoại; máy tính phải mở webcam qua getUserMedia.
 *
 * Trước đây khối này nằm riêng trong NopBaiBox nên ô nộp bài GIỮA BÀI HỌC —
 * đường nộp chính, em dùng nhiều nhất — lại KHÔNG có. Tách ra đây để hai chỗ
 * dùng đúng một mã, sửa một lần ăn cả hai.
 */

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";

export default function CameraShot({
  disabled,
  onCapture,
  onError,
  label = "Chụp bằng webcam",
}: {
  disabled?: boolean;
  onCapture: (file: File) => void;
  onError?: (msg: string | null) => void;
  label?: string;
}) {
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
    onError?.(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        // facingMode "environment" = camera SAU trên điện thoại (chụp giấy);
        // máy tính chỉ có một camera nên trình duyệt tự bỏ qua.
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
      onError?.(
        "Không mở được camera — bạn kiểm tra quyền camera của trình duyệt, hoặc chọn ảnh có sẵn nhé.",
      );
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
        onCapture(new File([b], `bai-lam-${Date.now()}.jpg`, { type: "image/jpeg" }));
        stopCam();
      },
      "image/jpeg",
      0.9,
    );
  }

  if (camOn) {
    return (
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
    );
  }

  return (
    <button type="button" className="btn btn-ghost nb-cam-btn" disabled={disabled} onClick={openCam}>
      <Camera aria-hidden strokeWidth={2.25} />
      {label}
    </button>
  );
}
