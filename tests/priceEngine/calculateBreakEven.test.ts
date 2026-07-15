import { describe, expect, it } from "vitest";

import { calculateBreakEven } from "@/lib/priceEngine/calculateBreakEven";

describe("calculateBreakEven", () => {
  it("returns a number", () => {
    const be = calculateBreakEven({
      currentPrice: 500000,
      previousScores: [110, 95],
      magicNumber: 5040,
    });

    expect(typeof be).toBe("number");
  });

  it("rounds up", () => {
    const be = calculateBreakEven({
      currentPrice: 487900,
      previousScores: [98, 110],
      magicNumber: 5040,
    });

    expect(Number.isInteger(be)).toBe(true);
  });
});