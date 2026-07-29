// Mô phỏng ĐÚNG công thức cổng nỗ lực sau vá (chat-turn ~dòng 745) để kiểm:
// (a) học sinh im lặng KHÔNG kẹt vĩnh viễn, (b) thang Socratic CÓ được dùng,
// (c) bấm mò KHÔNG mở được đáy.
const minAttempts = 2, totalRungs = 4, threshold = 0.5;
function gate({ attempts, thinkingQuality, currentRung }) {
  if (attempts < minAttempts) return "require_attempt";
  if (thinkingQuality < threshold) return "require_thinking";
  if (currentRung >= totalRungs) return "bottom_out";
  return "advance_rung";
}
function run(label, signalOf) {
  const rows = [];
  let prevThinking = 0; const hist = [];
  for (let attemptNo = 1; attemptNo <= 9; attemptNo++) {
    const thinkSignal = signalOf(attemptNo);
    const stuckLong = attemptNo >= minAttempts + 4;
    const tq = Math.min(1, Math.max(thinkSignal, prevThinking, stuckLong ? 0.5 : 0));
    const exhausted = attemptNo >= minAttempts + totalRungs + 2;
    const rungTurns = hist.slice(Math.max(0, minAttempts - 1));
    const engaged = rungTurns.filter((v) => v >= threshold).length;
    const currentRung = exhausted ? totalRungs : engaged;
    const g = gate({ attempts: attemptNo, thinkingQuality: tq, currentRung });
    rows.push(`${attemptNo}:${g}${g === "advance_rung" ? `(bậc ${currentRung + 1})` : ""}`);
    prevThinking = Math.max(prevThinking, thinkSignal);
    hist.push(thinkSignal);
  }
  console.log(label.padEnd(34), rows.join("  "));
}
run("IM LẶNG (bấm mò, không gõ gì)", () => 0.03);
run("KỂ CÁCH NGHĨ mỗi lượt", () => 0.6);
run("KỂ 1 lần ở lượt 2 rồi thôi", (n) => (n === 2 ? 0.6 : 0.03));
