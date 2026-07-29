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
