"use client";

// UI tương tác cho các dạng objective Studio đã đẩy: sap_xep (xếp thứ tự),
// noi_cot (nối cột) — kéo–thả trên desktop + chạm trên mobile — và checklist
// ("Đúng/Sai chùm ý"), cùng một canonical answer để server chấm CẤU TRÚC.
// Bộ phân tích PHÒNG THỦ: đề không tách được mục thì server trả null →
// TutorApp rơi về nút chọn / ô nhập thường (không vỡ gì).

import { useEffect, useMemo, useRef, useState } from "react";
import { MathText } from "../lib/mathrender";

// Cấu trúc do SERVER bóc sẵn (parseInteractive) — client chỉ hiển thị + thu answer.
export interface OrderParsed {
  mode: "label" | "word";
  intro: string;
  items: Array<{ key: string; text: string }>;
}
export interface MatchParsed {
  intro: string;
  left: Array<{ key: string; text: string }>;
  right: Array<{ key: string; text: string }>;
}
export interface ChecklistParsed {
  intro: string;
  items: Array<{ key: string; text: string }>;
}

// ── sap_xep: danh sách xếp lại được ──────────────────────────────────────────
export function OrderQuestion({
  parsed, disabled, onChange,
}: { parsed: OrderParsed; disabled: boolean; onChange: (canonical: string | null) => void }) {
  const [order, setOrder] = useState<string[]>(parsed.items.map((i) => i.key));
  const dragFrom = useRef<number | null>(null);
  const byKey = useMemo(() => new Map(parsed.items.map((i) => [i.key, i.text])), [parsed]);

  // WORD → ghép các TỪ theo thứ tự (server so chữ); LABEL → ghép nhãn "c - a - b".
  useEffect(() => {
    const canonical = parsed.mode === "word"
      ? order.map((k) => byKey.get(k) ?? k).join(" ")
      : order.join(" - ");
    onChange(canonical);
  }, [order, parsed.mode, byKey, onChange]);

  const move = (from: number, to: number) => {
    if (disabled || to < 0 || to >= order.length || from === to) return;
    setOrder((o) => { const a = [...o]; const [x] = a.splice(from, 1); a.splice(to, 0, x!); return a; });
  };

  return (
    <div className="iq">
      {parsed.intro && <p className="iq-intro"><MathText>{parsed.intro}</MathText></p>}
      <ol className="iq-order">
        {order.map((k, idx) => (
          <li
            key={k}
            className="iq-card"
            draggable={!disabled}
            aria-disabled={disabled || undefined}
            onDragStart={() => (dragFrom.current = idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (dragFrom.current != null) move(dragFrom.current, idx); dragFrom.current = null; }}
          >
            <span className="iq-rank num">{idx + 1}</span>
            <span className="iq-grip" aria-hidden>⋮⋮</span>
            <span className="iq-text"><MathText>{byKey.get(k) ?? k}</MathText></span>
            <span className="iq-moves">
              <button type="button" className="iq-move" disabled={disabled || idx === 0} onClick={() => move(idx, idx - 1)} aria-label="Đưa lên">▲</button>
              <button type="button" className="iq-move" disabled={disabled || idx === order.length - 1} onClick={() => move(idx, idx + 1)} aria-label="Đưa xuống">▼</button>
            </span>
          </li>
        ))}
      </ol>
      <p className="iq-help">Kéo–thả hoặc dùng ▲▼ để xếp đúng thứ tự.</p>
    </div>
  );
}

// ── noi_cot: gán chữ cột phải vào từng dòng cột trái ─────────────────────────
export function MatchQuestion({
  parsed, disabled, onChange,
}: { parsed: MatchParsed; disabled: boolean; onChange: (canonical: string | null) => void }) {
  const [assign, setAssign] = useState<Record<string, string | null>>(
    () => Object.fromEntries(parsed.left.map((l) => [l.key, null])),
  );
  const [sel, setSel] = useState<string | null>(null); // chip phải đang chọn (chạm)
  const dragKey = useRef<string | null>(null);

  useEffect(() => {
    const done = parsed.left.every((l) => assign[l.key]);
    onChange(done ? parsed.left.map((l) => `${l.key}-${assign[l.key]}`).join(", ") : null);
  }, [assign, parsed, onChange]);

  const used = new Set(Object.values(assign).filter(Boolean) as string[]);
  const place = (leftKey: string, rightKey: string) => {
    if (disabled) return;
    setAssign((a) => {
      const next = { ...a };
      // 1 chữ chỉ dùng 1 lần: gỡ khỏi ô cũ nếu đang ở nơi khác
      for (const k of Object.keys(next)) if (next[k] === rightKey) next[k] = null;
      next[leftKey] = rightKey;
      return next;
    });
    setSel(null);
  };
  const clear = (leftKey: string) => { if (!disabled) setAssign((a) => ({ ...a, [leftKey]: null })); };

  return (
    <div className="iq">
      {parsed.intro && <p className="iq-intro"><MathText>{parsed.intro}</MathText></p>}
      <ul className="iq-match">
        {parsed.left.map((l) => (
          <li key={l.key} className="iq-row">
            <span className="iq-lnum num">{l.key}</span>
            <span className="iq-ltext"><MathText>{l.text}</MathText></span>
            <button
              type="button"
              className={"iq-slot" + (assign[l.key] ? " filled" : "") + (sel ? " armed" : "")}
              disabled={disabled}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (dragKey.current) place(l.key, dragKey.current); dragKey.current = null; }}
              onClick={() => { if (assign[l.key]) clear(l.key); else if (sel) place(l.key, sel); }}
              aria-label={assign[l.key] ? `Đã nối ${assign[l.key]} — chạm để gỡ` : "Ô nối — chọn một mục bên dưới rồi chạm"}
            >
              {assign[l.key] ?? "—"}
            </button>
          </li>
        ))}
      </ul>
      <div className="iq-chips">
        {parsed.right.map((r) => (
          <button
            key={r.key}
            type="button"
            className={"iq-chip" + (used.has(r.key) ? " used" : "") + (sel === r.key ? " sel" : "")}
            draggable={!disabled && !used.has(r.key)}
            disabled={disabled}
            onDragStart={() => (dragKey.current = r.key)}
            onClick={() => setSel((s) => (s === r.key ? null : r.key))}
          >
            <b className="num">{r.key}</b> <MathText>{r.text}</MathText>
          </button>
        ))}
      </div>
      <p className="iq-help">Chạm một mục rồi chạm ô ở dòng cần nối — hoặc kéo–thả. Chạm ô đã nối để gỡ.</p>
    </div>
  );
}

// ── checklist: "Đúng/Sai chùm ý" — mỗi ý con một dòng + cặp nút Đúng/Sai ─────
// Trước đây các câu này bị gửi xuống dưới dạng mcq 4 nút, mỗi nút là NGUYÊN chuỗi
// gộp "a) Đ · b) S · c) Đ · d) Đ" → dày đặc, không đọc nổi. Giờ tách từng ý.
export function ChecklistQuestion({
  parsed, disabled, onChange,
}: { parsed: ChecklistParsed; disabled: boolean; onChange: (canonical: string | null) => void }) {
  const [marks, setMarks] = useState<Record<string, boolean | null>>(
    () => Object.fromEntries(parsed.items.map((i) => [i.key, null])),
  );

  // CHỈ gửi khi đã tick ĐỦ mọi ý — thiếu một ý mà nộp là bị chấm sai oan
  // (server so khớp đủ số nhãn). Chưa đủ → null → nút Kiểm tra vẫn khoá.
  useEffect(() => {
    const done = parsed.items.every((i) => marks[i.key] != null);
    onChange(
      done
        ? parsed.items.map((i) => `${i.key}:${marks[i.key] ? "dung" : "sai"}`).join(",")
        : null,
    );
  }, [marks, parsed, onChange]);

  return (
    <div className="iq">
      {parsed.intro && <p className="iq-intro"><MathText>{parsed.intro}</MathText></p>}
      <ul className="iq-check">
        {parsed.items.map((it) => (
          <li key={it.key} className="iq-crow">
            <span className="iq-ckey num">{it.key}</span>
            <span className="iq-ctext"><MathText>{it.text}</MathText></span>
            <span className="iq-cbtns">
              {([["Đúng", true], ["Sai", false]] as Array<[string, boolean]>).map(([label, val]) => (
                <button
                  key={label}
                  type="button"
                  className={"iq-cbtn" + (marks[it.key] === val ? " on" : "")}
                  aria-pressed={marks[it.key] === val}
                  aria-label={`Ý ${it.key}: ${label}`}
                  disabled={disabled}
                  onClick={() => setMarks((m) => ({ ...m, [it.key]: val }))}
                >
                  {label}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="iq-help">
        Chọn <b>Đúng</b> hay <b>Sai</b> cho <b>từng ý</b> — đủ cả {parsed.items.length} ý rồi bấm Kiểm tra.
      </p>
    </div>
  );
}
