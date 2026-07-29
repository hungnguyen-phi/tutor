import { describe, it, expect } from "vitest";
import { checkAnswer } from "./cas.js";

const ok = (s: string, c: string, p?: Record<string, number>) =>
  checkAnswer(s, c, p).correct;

describe("CAS — coordinate tuples (vertex)", () => {
  it("(2; -1) ≡ (2,-1) ≡ (2.0, -1)", () => {
    expect(ok("(2; -1)", "(2,-1)")).toBe(true);
    expect(ok("(2.0, -1)", "(2; -1)")).toBe(true);
  });
  it("rejects the sign-error misconception (-2; 15)", () => {
    expect(ok("(-2; 15)", "(2; -1)")).toBe(false);
  });
});

describe("CAS — numeric & fractions", () => {
  it("1/2 ≡ 0.5", () => expect(ok("1/2", "0.5")).toBe(true));
  it("-1 ≡ -1.0", () => expect(ok("-1.0", "-1")).toBe(true));
  it("căn/roots: sqrt(4) ≡ 2", () => expect(ok("sqrt(4)", "2")).toBe(true));
  it("rejects 3 ≠ -1 (min value misconception)", () => expect(ok("3", "-1")).toBe(false));
});

describe("CAS — symbolic equivalence", () => {
  it("(x-1)(x-3) ≡ x^2-4x+3", () => expect(ok("(x-1)(x-3)", "x^2-4x+3")).toBe(true));
  it("phân thức: 1/x + 1 ≡ (x+1)/x", () => expect(ok("1/x + 1", "(x+1)/x")).toBe(true));
  it("rejects x^2-4x+3 ≠ x^2+4x+3", () => expect(ok("x^2+4x+3", "x^2-4x+3")).toBe(false));
});

describe("CAS — parametrized (vertex x = -b/2)", () => {
  it("matches with substituted params b=6 → -3", () => {
    expect(ok("-3", "-{b}/2", { b: 6 })).toBe(true);
    expect(ok("-{b}/2", "-{b}/2", { b: 6 })).toBe(true);
  });
  it("rejects sign-error b/2 form", () => {
    expect(ok("{b}/2", "-{b}/2", { b: 6 })).toBe(false);
  });
});

describe("CAS — multiple roots (order independent)", () => {
  it("x=1; x=3 ≡ {3, 1}", () => expect(ok("x=1; x=3", "{3, 1}")).toBe(true));
  it("rejects missing a root", () => expect(ok("x=1", "{3, 1}")).toBe(false));
});

describe("CAS — text fallback (non-quantitative)", () => {
  it("parabol ≡ Parabol (case/diacritics-insensitive)", () => {
    expect(ok("Parabol", "parabol")).toBe(true);
  });
  it("rejects đường thẳng ≠ parabol", () => expect(ok("đường thẳng", "parabol")).toBe(false));
});

// ── Số kiểu VIỆT (lỗi 16, 29/07) — giữ đồng bộ với tools/grading-matrix.mjs ──
describe("số thập phân kiểu Việt", () => {
  it("chấp nhận dấu phẩy thập phân", () => {
    expect(ok("0,2", "0.2")).toBe(true);
    expect(ok("-0,2", "-0.2")).toBe(true);
    expect(ok("1.234,5", "1234.5")).toBe(true);
    expect(ok("sqrt(0,25)", "0.5")).toBe(true);
  });
  it("KHÔNG biến toạ độ/tập thành số", () => {
    expect(ok("1,2", "(1,2)")).toBe(false);
    expect(ok("1.3", "{1,3}")).toBe(false);
  });
  it("không lật kết quả đúng thành sai", () => {
    expect(ok("(1,2)", "(1,2)")).toBe(true);
    expect(ok("0,2", "0.3")).toBe(false);
  });
});

// ── Ký tự SÁCH IN vs BÀN PHÍM (rà 29/07: 1.199 câu có x₀, 592 có √, 584 có ≥) ──
// Học sinh KHÔNG gõ được các ký tự này; không quy đổi là chấm sai người hiểu bài.
describe("ký tự sách in → bàn phím", () => {
  it("dấu trừ U+2212 ≡ hyphen bàn phím", () => {
    expect(ok("-f(x)", "−f(x)")).toBe(true);
    expect(ok("-b/(2a)", "−b/(2a)")).toBe(true);
  });
  it("chỉ số dưới x₀ ≡ x0", () => {
    expect(ok("f(x0)", "f(x₀)")).toBe(true);
    expect(ok("2h-x0", "2h−x₀")).toBe(true);
  });
  it("chỉ số trên A² ≡ A^2", () => {
    expect(ok("a^2 + b^2", "a² + b²")).toBe(true);
  });
  it("≠ ≥ ≤ ≡ != >= <=", () => {
    expect(ok("!=", "≠")).toBe(true);
    expect(ok(">=", "≥")).toBe(true);
    expect(ok("<=", "≤")).toBe(true);
  });
  it("KHÔNG biến đáp án sai thành đúng", () => {
    expect(ok("x0", "x₁")).toBe(false);
    expect(ok(">=", "≤")).toBe(false);
    expect(ok("f(x)", "−f(x)")).toBe(false);
  });
});

// Căn √ có BIẾN — chỉ nhánh mathjs mới chấm được (bộ tính số bỏ qua vì có chữ).
describe("căn √ sách in", () => {
  it("√ với biến ≡ sqrt()", () => {
    expect(ok("2*sqrt(x)", "2√x")).toBe(true);
    expect(ok("sqrt(x+1)", "√(x+1)")).toBe(true);
    expect(ok("sqrt(x)/2", "√x/2")).toBe(true);
  });
  it("√ với số", () => {
    expect(ok("2*sqrt(3)", "2√3")).toBe(true);
  });
  it("KHÔNG nhận căn khác", () => {
    expect(ok("2*sqrt(x)", "3√x")).toBe(false);
    expect(ok("sqrt(x)", "√y")).toBe(false);
  });
});
