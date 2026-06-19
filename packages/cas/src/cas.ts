/**
 * CAS answer-equivalence for the Toán pilot (PRD §9.3, Q11).
 * The LLM NEVER decides quantitative correctness — this does, by comparing the
 * student's answer to the stored answer for EQUIVALENCE (not string match):
 *   - coordinate tuples:  "(2; -1)" ≡ "(2,-1)"
 *   - numeric:            "0.5" ≡ "1/2", "-1" ≡ "-1.0"
 *   - symbolic:           "(x-1)(x-3)" ≡ "x^2-4x+3", "1/(x)+1" ≡ "(x+1)/x"
 *     (probabilistic identity test over random sample points)
 *   - roots/sets:         "x=1; x=3" ≡ "{3,1}" (order-independent)
 *
 * Pure & dependency-light (mathjs only) so it runs in both Node (tests) and Deno
 * (Edge Function). No Node/Deno-specific APIs.
 */
import { create, all, type MathJsInstance, type MathNode } from "mathjs";

const math: MathJsInstance = create({ ...all });
const mathFns = math as unknown as Record<string, unknown>;

const TOL = 1e-6;
const SAMPLES = 12;

export interface CasResult {
  correct: boolean;
  method: "tuple" | "set" | "numeric" | "symbolic" | "text" | "error";
  detail?: string;
}

/** Substitute {b},{c}-style placeholders for parametrized questions. */
export function applyParams(expr: string, params?: Record<string, number | string>): string {
  if (!params) return expr;
  return expr.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

export function checkAnswer(
  student: string,
  correct: string,
  params?: Record<string, number | string>,
): CasResult {
  const a = applyParams((student ?? "").trim(), params);
  const b = applyParams((correct ?? "").trim(), params);
  if (!a) return { correct: false, method: "text", detail: "empty" };

  // 1) Coordinate tuple / point.
  const ta = splitTuple(a);
  const tb = splitTuple(b);
  if (ta && tb) {
    if (ta.length !== tb.length) return { correct: false, method: "tuple" };
    const ok = ta.every((x, i) => exprEqual(x, tb[i]!).correct);
    return { correct: ok, method: "tuple" };
  }

  // 2) Set / multiple roots (order-independent): "x=1; x=3", "{1,3}".
  const sa = splitSet(a);
  const sb = splitSet(b);
  if (sa && sb && (sa.length > 1 || sb.length > 1)) {
    const ok =
      sa.length === sb.length &&
      sa.every((x) => sb.some((y) => exprEqual(x, y).correct)) &&
      sb.every((y) => sa.some((x) => exprEqual(x, y).correct));
    return { correct: ok, method: "set" };
  }

  // 3) Numeric / symbolic equivalence.
  const e = exprEqual(a, b);
  if (e.method !== "error") return e;

  // 4) Text fallback (e.g. "parabol").
  return { correct: normText(a) === normText(b), method: "text" };
}

/** Equivalence of two scalar expressions (numeric or symbolic). */
export function exprEqual(a: string, b: string): CasResult {
  const na = stripRel(a);
  const nb = stripRel(b);
  let nodeA, nodeB;
  try {
    nodeA = math.parse(na);
    nodeB = math.parse(nb);
  } catch {
    return { correct: false, method: "error", detail: "parse" };
  }
  const vars = new Set<string>();
  collectSymbols(nodeA, vars);
  collectSymbols(nodeB, vars);

  try {
    if (vars.size === 0) {
      const va = Number(math.evaluate(na));
      const vb = Number(math.evaluate(nb));
      if (!isFinite(va) || !isFinite(vb)) return { correct: false, method: "numeric" };
      return { correct: Math.abs(va - vb) <= TOL * (1 + Math.abs(vb)), method: "numeric" };
    }
    // Probabilistic identity test over random points (deterministic seed sequence).
    const fa = nodeA.compile();
    const fb = nodeB.compile();
    const symbols = [...vars];
    let matched = 0;
    let evaluated = 0;
    for (let s = 0; s < SAMPLES; s++) {
      const scope: Record<string, number> = {};
      for (const sym of symbols) scope[sym] = sampleAt(s, sym);
      let ya: number, yb: number;
      try {
        ya = Number(fa.evaluate(scope));
        yb = Number(fb.evaluate(scope));
      } catch {
        continue; // skip points outside the domain (e.g. division by zero)
      }
      if (!isFinite(ya) || !isFinite(yb)) continue;
      evaluated++;
      if (Math.abs(ya - yb) <= TOL * (1 + Math.abs(yb))) matched++;
    }
    if (evaluated === 0) return { correct: false, method: "symbolic", detail: "no-valid-points" };
    return { correct: matched === evaluated, method: "symbolic" };
  } catch {
    return { correct: false, method: "error", detail: "eval" };
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Deterministic pseudo-random sample in a safe range, varied per symbol/iter. */
function sampleAt(iter: number, sym: string): number {
  const seed = (iter * 2654435761 + hash(sym)) >>> 0;
  // map to roughly [-3.3, 3.4], avoiding 0 to dodge common domain holes
  const r = ((seed % 1000) / 1000) * 6.7 - 3.3;
  return Math.abs(r) < 0.2 ? r + 0.7 : r;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Remove a leading "x =", "y=" etc. so "x=1" compares as "1". */
function stripRel(s: string): string {
  const m = s.match(/^\s*[A-Za-z]\w*\s*=\s*(.+)$/);
  return (m ? m[1]! : s).replace(/;$/, "").trim();
}

function splitTuple(s: string): string[] | null {
  const m = s.match(/^\(\s*(.+)\s*\)$/);
  if (!m) return null;
  const parts = splitTop(m[1]!, [",", ";"]);
  return parts.length >= 2 ? parts : null;
}

function splitSet(s: string): string[] | null {
  let inner = s.trim();
  const braced = inner.match(/^\{\s*(.+)\s*\}$/);
  if (braced) inner = braced[1]!;
  const parts = splitTop(inner, [";", ",", "∨"]).map((p) => stripRel(p)).filter(Boolean);
  return parts.length ? parts : null;
}

/** Split on top-level separators only (ignores separators inside parens). */
function splitTop(s: string, seps: string[]): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    if (depth === 0 && seps.includes(ch)) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function collectSymbols(node: MathNode, into: Set<string>): void {
  node.forEach(function walk(child) {
    if (child.type === "SymbolNode") {
      const name = (child as unknown as { name: string }).name;
      // Exclude constants and any name that resolves to a mathjs function
      // (e.g. sqrt, sin, log appear as SymbolNodes during traversal).
      const isConst = ["e", "pi", "PI", "i", "Inf", "NaN", "true", "false"].includes(name);
      const isFn = typeof mathFns[name] === "function";
      if (!isConst && !isFn) into.add(name);
    }
    child.forEach(walk);
  });
}

function normText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
