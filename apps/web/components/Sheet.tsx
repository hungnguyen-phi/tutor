"use client";

/**
 * Bottom sheet thuần React + CSS — thay window.confirm/alert trên mobile.
 * · Trượt lên từ đáy, backdrop mờ, tay cầm kéo-để-đóng, Esc, chạm backdrop.
 * · Focus trap đơn giản (Tab quay vòng trong panel), trả focus khi đóng.
 * · Kéo ghi thẳng style.transform qua ref — không setState mỗi frame, 60fps.
 * · Exit animation thật: open=false → chạy sheet-down rồi mới unmount.
 * · ≥900px tự thành dialog giữa màn (CSS) — component mới, desktop không đổi.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const DISMISS_PX = 90; // kéo quá ngần này thì nhả tay = đóng

export default function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Tiêu đề sheet — cũng là aria-label của dialog */
  title?: string;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(false); // còn trong DOM
  const [closing, setClosing] = useState(false); // đang chạy animation đóng
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ y0: 0, dy: 0, on: false });

  useEffect(() => {
    if (open) {
      setShown(true);
      setClosing(false);
    } else {
      // callback để không cần `shown` trong deps
      setShown((s) => {
        if (s) setClosing(true);
        return s;
      });
    }
  }, [open]);

  // DỰ PHÒNG: tab nền/renderer bị throttle thì CSS animation đứng im →
  // animationend không bao giờ bắn. Timer bảo đảm sheet LUÔN unmount được
  // (animationend tới trước 220ms thì dọn sớm hơn, timer tự huỷ).
  useEffect(() => {
    if (!closing) return;
    const t = window.setTimeout(() => {
      setShown(false);
      setClosing(false);
    }, 400);
    return () => window.clearTimeout(t);
  }, [closing]);

  // Esc + focus trap + trả focus về nút đã mở sheet
  useEffect(() => {
    if (!shown || closing) return;
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const auto = panel?.querySelector<HTMLElement>("[data-autofocus]");
    (auto ?? panel)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const els = panel.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (els.length === 0) {
        e.preventDefault();
        return;
      }
      const first = els[0]!;
      const last = els[els.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      prev?.focus();
    };
  }, [shown, closing, onClose]);

  // ── Kéo tay cầm: transform-only, không re-render mỗi frame ──
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    drag.current = { y0: e.clientY, dy: 0, on: true };
    e.currentTarget.setPointerCapture(e.pointerId);
    panelRef.current?.setAttribute("data-dragging", "true");
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current.on) return;
    const dy = Math.max(0, e.clientY - drag.current.y0);
    drag.current.dy = dy;
    if (panelRef.current) panelRef.current.style.transform = `translateY(${dy}px)`;
  }, []);
  const onPointerUp = useCallback(() => {
    if (!drag.current.on) return;
    const { dy } = drag.current;
    drag.current.on = false;
    const panel = panelRef.current;
    panel?.removeAttribute("data-dragging");
    if (panel) panel.style.transform = ""; // transition CSS kéo panel về chỗ
    if (dy > DISMISS_PX) onClose();
  }, [onClose]);

  if (!shown) return null;

  return (
    <div className="sheet-root" data-closing={closing || undefined}>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        className="sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onAnimationEnd={(e) => {
          // chỉ bắt animation của CHÍNH panel (sheet-down), bỏ qua của con
          if (closing && e.target === e.currentTarget) {
            setShown(false);
            setClosing(false);
          }
        }}
      >
        <div
          className="sheet-grip"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-hidden
        >
          <i />
        </div>
        {title && <h2 className="sheet-title">{title}</h2>}
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
