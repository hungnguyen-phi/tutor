// paramgen — MÁY SINH THAM SỐ cho câu khuôn (Đợt 2, Q12: duyệt KHUÔN một lần,
// học sinh có vô hạn biến thể). CAS (cas.ts) đã biết chấm theo params —
// checkAnswer(student, dap_an, params) thay {b},{c}… vào đáp án rồi so tương
// đương. Việc còn lại là SINH giá trị cụ thể + THAY vào đề để hiển thị.
//
// TẤT ĐỊNH THEO SEED: giá trị suy từ hash(session_id + question_id), nên nơi
// HIỂN THỊ (diagnose / engine tiêm) và nơi CHẤM (chat-turn answer) sinh RA CÙNG
// một bộ số mà KHÔNG cần lưu instance — không thêm bảng, không ghi ở đường nóng.

export interface ParamDef {
  name: string;
  min: number;
  max: number;
  /** true: loại giá trị 0 (mẫu số, hệ số bậc cao… không được 0). */
  nonzero?: boolean;
}
export interface ParamSpec {
  params: ParamDef[];
}

/** FNV-1a 32-bit — hash chuỗi seed thành số nguyên không dấu, ổn định mọi runtime. */
function fnv1a(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Bộ sinh số giả ngẫu nhiên tất định (mulberry32) từ một seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFrom(...parts: string[]): number {
  return fnv1a(parts.join("|"));
}

/**
 * Sinh bộ giá trị tham số TẤT ĐỊNH từ spec + seed. Mỗi tham số lấy một số
 * nguyên trong [min,max]; `nonzero` thì tránh 0 (đẩy sang min hoặc +1).
 * Cùng (spec, seed) → cùng kết quả, mọi lúc mọi nơi.
 */
export function genParams(spec: ParamSpec | null | undefined, seed: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (!spec?.params?.length) return out;
  const rand = mulberry32(seed);
  for (const p of spec.params) {
    const lo = Math.min(p.min, p.max);
    const hi = Math.max(p.min, p.max);
    const span = hi - lo + 1;
    let v = lo + Math.floor(rand() * span);
    if (p.nonzero && v === 0) v = hi > 0 ? (v + 1 <= hi ? v + 1 : lo) : lo;
    out[p.name] = v;
  }
  return out;
}

/** Thay {name} trong text bằng giá trị params (không có thì giữ nguyên). */
export function fillTemplate(text: string, params: Record<string, number | string>): string {
  if (!text) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

/** Đọc spec tham số từ hàng questions (cột jsonb `tham_so`). Lỗi hình dạng → null. */
export function readSpec(raw: unknown): ParamSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const params = (raw as { params?: unknown }).params;
  if (!Array.isArray(params) || params.length === 0) return null;
  const clean: ParamDef[] = [];
  for (const p of params) {
    if (!p || typeof p !== "object") continue;
    const name = (p as ParamDef).name;
    const min = Number((p as ParamDef).min);
    const max = Number((p as ParamDef).max);
    if (typeof name !== "string" || !name || !Number.isFinite(min) || !Number.isFinite(max)) continue;
    clean.push({ name, min, max, nonzero: (p as ParamDef).nonzero === true });
  }
  return clean.length ? { params: clean } : null;
}
