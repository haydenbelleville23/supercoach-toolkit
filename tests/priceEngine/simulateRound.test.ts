import { describe, expect, it } from "vitest";

import { simulateRound } from "@/lib/priceEngine/simulateRound";

describe("simulateRound", () => {
  it("advances the player state", () => {
    const result = simulateRound(
      {
        currentRound: 18,
        price: 500000,
        scores: [95, 110],
      },
      105,
    );

    expect(result.state.currentRound).toBe(19);

    expect(result.state.scores).toEqual([
      95,
      110,
      105,
    ]);

    expect(result.price).toBeGreaterThan(0);
  });
});