// gate-trace — in BẢNG TRẠNG THÁI cổng nỗ lực cho vài kiểu học sinh.
//
// Mô phỏng đúng công thức đang chạy trong chat-turn để trả lời ba câu hỏi mà
// đọc code không thấy ngay:
//   (a) học sinh im lặng có bị KẸT vĩnh viễn không?
//   (b) 4 bậc thang Socratic có thực sự được dùng không, đúng thứ tự không?
//   (c) bấm mò / gõ cụt có mua được đáy (đáp án) không?
//
// Chạy: node tools/gate-trace.mjs   (từ thư mục gốc repo)

const minAttempts = 2;
const totalRungs = 4;
const threshold = 0.5;

function gate({ attempts, thinkingQuality, currentRung }) {
  if (attempts < minAttempts) return "require_attempt";
  if (thinkingQuality < threshold) return "require_thinking";
  // Khớp evaluateEffortGate: currentRung = SỐ BẬC ĐÃ TRAO → đáy chỉ mở khi hết thang.
  if (currentRung >= totalRungs) return "bottom_out";
  return "advance_rung";
}

/** Đếm bậc đã trao = số lượt SAU trần tối thiểu mà em thực sự trình bày. */
function rungsGiven(hist) {
  return hist.slice(Math.max(0, minAttempts - 1)).filter((v) => v >= threshold).length;
}

function run(label, signalOf, { shuffle = false } = {}) {
  const rows = [];
  let prevThinking = 0;
  const hist = [];
  for (let attemptNo = 1; attemptNo <= 9; attemptNo++) {
    const thinkSignal = signalOf(attemptNo);
    const stuckLong = attemptNo >= minAttempts + 4;
    const tq = Math.min(1, Math.max(thinkSignal, prevThinking, stuckLong ? 0.5 : 0));
    const exhausted = attemptNo >= minAttempts + totalRungs + 2;
    // `shuffle` mô phỏng ca Postgres trả hàng KHÔNG theo attempt_no (heap bị
    // CLUSTER / dump-restore) — để thấy vì sao truy vấn BẮT BUỘC phải .order().
    const view = shuffle ? [...hist].reverse() : hist;
    const currentRung = exhausted ? totalRungs : rungsGiven(view);
    const g = gate({ attempts: attemptNo, thinkingQuality: tq, currentRung });
    rows.push(`${attemptNo}:${g}${g === "advance_rung" ? `(bậc ${currentRung + 1})` : ""}`);
    prevThinking = Math.max(prevThinking, thinkSignal);
    hist.push(thinkSignal);
  }
  console.log(label.padEnd(36), rows.join("  "));
}

console.log("── NHÁNH CHẤM (trả lời câu hỏi) ──");
run("IM LẶNG (bấm mò, không gõ gì)", () => 0.03);
run("KỂ CÁCH NGHĨ mỗi lượt", () => 0.6);
run("KỂ 1 lần ở lượt 2 rồi thôi", (n) => (n === 2 ? 0.6 : 0.03));
// Nhánh "kể" hạ trần còn 0.3 khi lời dưới 5 từ có nghĩa → phải KHÔNG qua cổng.
run("GÕ CỤT ('1 vì') mỗi lượt", () => 0.3);

console.log("\n── Nếu THIẾU .order('attempt_no') ở truy vấn attempts ──");
// PHẢI dùng tín hiệu KHÔNG ĐỀU: với tín hiệu hằng thì đảo mảng là phép đồng
// nhất, ca thử hoá ra chẳng chứng minh được gì. Kể đúng MỘT lần ở lượt 2 là
// ca lộ rõ nhất — đảo thứ tự thì lượt "có kể" rơi ra ngoài lát cắt.
run("KỂ 1 lần ở lượt 2 — thứ tự ĐÚNG", (n) => (n === 2 ? 0.6 : 0.03));
run("KỂ 1 lần ở lượt 2 — hàng bị XÁO", (n) => (n === 2 ? 0.6 : 0.03), { shuffle: true });
console.log("   ↑ hai dòng này LỆCH nhau ⇒ đó là lý do truy vấn bắt buộc .order()");

console.log(`
Đọc bảng:
 · require_attempt  = chưa đủ số lần thử tối thiểu.
 · require_thinking = đã thử đủ nhưng chưa trình bày suy nghĩ → mời em kể.
 · advance_rung(n)  = trao bậc n của thang Socratic.
 · bottom_out       = mở hướng giải (chỉ sau khi đi HẾT thang, hoặc lượt 8+).

Điều kiện ĐẠT:
 · "IM LẶNG" phải tới được bottom_out (không kẹt) nhưng KHÔNG sớm hơn lượt 8.
 · "KỂ CÁCH NGHĨ mỗi lượt" phải đi đủ bậc 1 → 2 → 3 → 4 rồi mới bottom_out.
 · "GÕ CỤT" không được nhanh hơn "IM LẶNG" — gõ bừa không mua được đáp án.`);
