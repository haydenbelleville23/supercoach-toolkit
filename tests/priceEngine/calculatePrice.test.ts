import { describe, expect, it } from "vitest";

import { calculatePrice } from "@/lib/priceEngine/calculatePrice";

describe("calculatePrice", () => {
  it("calculates projected price correctly", () => {
    const result = calculatePrice({
      currentPrice: 500000,
      previousScores: [110, 95],
      projectedScore: 105,
      magicNumber: 5040,
    });

    expect(result.threeRoundAverage).toBe(103.33333333333333);

    expect(result.projectedPrice).toBeGreaterThan(500000);

    expect(result.priceChange).toBe(
      result.projectedPrice - 500000,
    );
  });
});