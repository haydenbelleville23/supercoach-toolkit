import { describe, expect, it } from "vitest";

import accuracyIndex from "@/data/2026/accuracy/index.json";
import { BASE_MAGIC_NUMBER_2026 } from "@/lib/priceEngine/baseMagicNumber";
import { evaluateScaledRound } from "@/lib/priceEngine/evaluateScaledRound";
import { getPlayers } from "@/lib/players";

const players = getPlayers();

describe("2026 accuracy log", () => {
  it("covers Rounds 2-18 with no alerts", () => {
    expect(accuracyIndex.rounds.map((r) => r.round)).toEqual(
      Array.from({ length: 17 }, (_, i) => i + 2),
    );

    for (const round of accuracyIndex.rounds) {
      expect(round.warnings).toEqual([]);
      expect(round.avgAbsError).toBeLessThan(50);
      expect(round.baseMN).toBe(BASE_MAGIC_NUMBER_2026);
    }
  });

  it("matches the scaled engine (and so the backtest) for every round", () => {
    for (const logged of accuracyIndex.rounds) {
      const evaluation = evaluateScaledRound(
        players,
        logged.round,
        BASE_MAGIC_NUMBER_2026,
      )!;

      expect(logged.playersCompared).toBe(evaluation.playersCompared);
      expect(logged.avgAbsError).toBeCloseTo(evaluation.averagePriceError, 1);
      expect(logged.maxAbsError).toBe(evaluation.maxPriceError);
      expect(logged.k).toBeCloseTo(evaluation.k, 6);
    }
  });
});
