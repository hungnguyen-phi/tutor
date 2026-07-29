import { describe, it, expect } from "vitest";
import { evaluateEffortGate } from "./effort-gate.js";
import type { EffortGateRule } from "@tutor/shared";

const rule: EffortGateRule = {
  so_lan_thu_toi_thieu: 2,
  yeu_cau: "đã diễn đạt được lý lẽ hoặc có dấu hiệu bí",
  cam: "Không cho nhảy thẳng xuống bottom_out.",
};

describe("effort gate — inviolable hard minimum", () => {
  it("blocks help before the minimum attempts, regardless of thinking quality", () => {
    const d = evaluateEffortGate({
      attempts: 1,
      thinkingQuality: 1, // even a perfect soft signal must not bypass the hard gate
      currentRung: 0,
      totalRungs: 4,
      rule,
    });
    expect(d.action).toBe("require_attempt");
  });

  it("never bottoms out before the attempt minimum (the `cam` rule)", () => {
    const d = evaluateEffortGate({
      attempts: 0,
      thinkingQuality: 1,
      currentRung: 3,
      totalRungs: 4,
      rule,
    });
    expect(d.action).not.toBe("bottom_out");
  });

  it("requires real thinking even after enough attempts", () => {
    const d = evaluateEffortGate({
      attempts: 2,
      thinkingQuality: 0.1,
      currentRung: 0,
      totalRungs: 4,
      rule,
    });
    expect(d.action).toBe("require_thinking");
  });

  it("advances a rung once both gates pass", () => {
    const d = evaluateEffortGate({
      attempts: 2,
      thinkingQuality: 0.9,
      currentRung: 0,
      totalRungs: 4,
      rule,
    });
    expect(d.action).toBe("advance_rung");
  });

  // Bậc CUỐI vẫn phải được trao trước khi mở đáy — đây chính là bậc "giàn giáo
  // mạnh", chỗ chia nhỏ quy trình ngay trước khi hé hướng giải. Luật cũ
  // (`currentRung + 1 >= totalRungs`) nhảy cóc mất nó.
  it("still serves the LAST rung before bottoming out", () => {
    const d = evaluateEffortGate({
      attempts: 3,
      thinkingQuality: 0.9,
      currentRung: 3, // đã trao 3 bậc → bậc thứ 4 vẫn còn
      totalRungs: 4,
      rule,
    });
    expect(d.action).toBe("advance_rung");
  });

  it("bottoms out only after every rung has been given", () => {
    const d = evaluateEffortGate({
      attempts: 3,
      thinkingQuality: 0.9,
      currentRung: 4, // đã trao đủ 4 bậc
      totalRungs: 4,
      rule,
    });
    expect(d.action).toBe("bottom_out");
  });
});
