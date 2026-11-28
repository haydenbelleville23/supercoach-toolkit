import { describe, expect, it, vi } from "vitest";

// These tests need a round still to come, so they run "as of Round 18"
// (the DEBUG_AS_OF_ROUND lock) whatever the latest data is.
vi.hoisted(() => {
  vi.stubEnv("DEBUG_AS_OF_ROUND", "18");
});

import { CURRENT_COMPLETED_ROUND } from "@/data/season";
import { getFixtures } from "@/lib/fixtures";
import { calculateLivePlayerProjection } from "@/lib/liveMatch/calculateLivePlayerProjection";
import { buildPlayerRows } from "@/lib/projector/buildPlayerRows";
import { calculateScaledProjectionRows } from "@/lib/projector/calculateScaledProjectionRows";
import { projectNextRoundPrice } from "@/lib/projector/projectNextRoundPrice";
import { getPlayers } from "@/lib/players";

describe("projectNextRoundPrice", () => {
  const nextRound = CURRENT_COMPLETED_ROUND + 1;

  const player = getPlayers().find(
    (p) =>
      p.history.filter((h) => h.games > 0).length >= 5 &&
      getFixtures().some(
        (f) =>
          f.round === nextRound &&
          (f.homeTeam === p.team || f.awayTeam === p.team),
      ),
  )!;

  it.each([50, 100, 120])(
    "matches the Price Projector for a score of %i",
    (score) => {
      const rows = buildPlayerRows(player, "projected").map((row) =>
        row.round === nextRound ? { ...row, score, played: true } : row,
      );

      const projectorRow = calculateScaledProjectionRows(rows, player).find(
        (row) => row.round === nextRound,
      )!;

      const projection = projectNextRoundPrice(player, score)!;

      expect(projection.price).toBe(projectorRow.price);
      expect(projection.breakEven).toBe(projectorRow.breakEven);
    },
  );

  it("feeds Live Scores the same projected price", () => {
    const live = calculateLivePlayerProjection(player, 100)!;

    expect(live.projectedPrice).toBe(
      projectNextRoundPrice(player, 100)!.price,
    );
  });
});
