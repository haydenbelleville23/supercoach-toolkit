import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("DEBUG_AS_OF_ROUND", "10");
});

import { CURRENT_COMPLETED_ROUND, FINAL_ROUND } from "@/data/season";
import { getFixtures } from "@/lib/fixtures";
import { createPriceProjector } from "@/lib/planner/pricePaths";
import { PRE_DEBUT_ROOKIE_SCORE, projectScore } from "@/lib/planner/projectScore";
import { getScaledRoundContexts } from "@/lib/projector/getScaledRoundContexts";
import { playerRepository } from "@/lib/repository/PlayerRepository";

import type { Player } from "@/types/player";

const realPlayers = JSON.parse(
  readFileSync(path.resolve("data/2026/players-normalised.json"), "utf8"),
) as Player[];

describe("Trade Planner under DEBUG_AS_OF_ROUND=10", () => {
  const players = playerRepository.getAll();
  const projector = createPriceProjector({
    players,
    contexts: getScaledRoundContexts(),
    fixtures: getFixtures(),
    completedRound: CURRENT_COMPLETED_ROUND,
    lastRound: FINAL_ROUND,
  });

  it("plans from Round 11 using only Rounds 0-10", () => {
    expect(projector.firstRound).toBe(11);

    for (const player of players.slice(0, 200)) {
      const real = realPlayers.find((p) => p.id === player.id)!;
      const realToRound10 = real.history.filter((h) => h.round <= 10 && h.games > 0);

      // Round 11 trades use the real Round 10 price.
      expect(projector.getPriceBefore(player.id, 11)).toBe(
        real.history.find((h) => h.round === 10)!.price,
      );

      // Projected scores use Rounds 0-10 only.
      // (No games yet: last season's average, or 50 for a debutant.)
      const expected =
        realToRound10.length === 0
          ? player.previousGames === 0
            ? PRE_DEBUT_ROOKIE_SCORE
            : player.previousAverage
          : realToRound10.reduce((t, h) => t + (h.score as number), 0) /
            realToRound10.length;
      expect(projectScore(player, 15, CURRENT_COMPLETED_ROUND)).toBe(expected);
    }
  });

  it("cannot see players added after Round 10", () => {
    const draftee = realPlayers.find(
      (p) => p.history.find((h) => h.round === 10)?.price == null,
    )!;

    expect(projector.getPath(draftee.id)).toEqual([]);
    expect(projector.getPriceBefore(draftee.id, 11)).toBeNull();
  });
});
