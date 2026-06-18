/**
 * PDPL: anonymize content BEFORE it leaves for any LLM provider (PRD §7, Q-anon).
 * Best-effort PII scrub for Vietnamese student data. Returns the scrubbed text
 * plus a token map so the caller can re-hydrate names in the UI if needed.
 *
 * This is a guardrail, not a guarantee — combine with consent + minimization.
 */

export interface AnonymizeResult {
  text: string;
  /** placeholder -> original, so the app can restore names locally (never to LLM). */
  map: Record<string, string>;
}

const PATTERNS: Array<{ re: RegExp; tag: string }> = [
  { re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, tag: "EMAIL" },
  // VN phone numbers (0xxxxxxxxx / +84...)
  { re: /(?:\+?84|0)(?:\d[\s.-]?){8,10}\d/g, tag: "PHONE" },
  // ID-like long digit runs (CCCD 9-12 digits)
  { re: /\b\d{9,12}\b/g, tag: "ID" },
];

/**
 * Scrub emails/phones/ids and any explicitly-supplied known names (student/guardian).
 * Names are passed in by the caller because we cannot reliably detect VN names by regex.
 */
export function anonymize(input: string, knownNames: string[] = []): AnonymizeResult {
  const map: Record<string, string> = {};
  let text = input;
  let counter = 0;

  // Replace known names first (longest first to avoid partial overlaps).
  for (const name of [...knownNames].filter(Boolean).sort((a, b) => b.length - a.length)) {
    const ph = `[NAME_${counter++}]`;
    const re = new RegExp(escapeRegExp(name), "g");
    if (re.test(text)) {
      text = text.replace(re, ph);
      map[ph] = name;
    }
  }

  for (const { re, tag } of PATTERNS) {
    text = text.replace(re, (m) => {
      const ph = `[${tag}_${counter++}]`;
      map[ph] = m;
      return ph;
    });
  }

  return { text, map };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
