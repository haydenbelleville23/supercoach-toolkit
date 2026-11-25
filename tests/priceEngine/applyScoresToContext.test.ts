import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { applyScoresToContext } from "@/lib/priceEngine/applyScoresToContext";
import { BASE_MAGIC_NUMBER_2026 } from "@/lib/priceEngine/baseMagicNumber";
import { estimateScaledRoundContexts } from "@/lib/priceEngine/estimateScaledRoundContexts";
import { getPlayers } from "@/lib/players";

import type { Player } from "@/types/player";

const fixtures = JSON.parse(
  readFileSync(path.resolve("data/2026/fixtures-raw.json"), "utf8"),
) as {
  rounds: {
    round: number;
    response: { team1: { abbrev: string }; team2: { abbrev: string } }[];
  }[];
};

const games = new Set(
  fixtures.rounds.flatMap((round) =>
    round.response.flatMap((game) => [
      `${round.round}:${game.team1.abbrev}`,
      `${round.round}:${game.team2.abbrev}`,
    ]),
  ),
);

const teamHasGame = (team: string, round: number) =>
  games.has(`${round}:${team}`);

/** Players as they looked before `round` was played. */
function hideRoundsFrom(players: Player[], round: number): Player[] {
  return players.map((player) => ({
    ...player,
    history: player.history.map((row) =>
      row.round >= round ? { ...row, score: null, games: 0 } : row,
    ),
  }));
}

describe("applyScoresToContext", () => {
  const ROUND = 12;
  const players = getPlayers();

  it("turns a pre-round estimate into the real round's k once all scores are in", () => {
    const before = estimateScaledRoundContexts({
      players: hideRoundsFrom(players, ROUND),
      firstRound: ROUND,
      lastRound: ROUND,
      baseMagicNumber: BASE_MAGIC_NUMBER_2026,
      teamHasGame,
    }).get(ROUND)!;

    const actual = estimateScaledRoundContexts({
      players,
      firstRound: ROUND,
      lastRound: ROUND,
      baseMagicNumber: BASE_MAGIC_NUMBER_2026,
      teamHasGame,
    }).get(ROUND)!;

    const updates = players
      .filter((player) => before.contributions.has(player.id))
      .map((player) => {
        const row = player.history.find((h) => h.round === ROUND);

        return {
          playerId: player.id,
          oldPrice: before.contributions.get(player.id)!.oldPrice,
          previousScores: player.history
            .filter((h) => h.round < ROUND && h.games > 0)
            .map((h) => h.score as number),
          score: row && row.games > 0 ? row.score : null,
        };
      });

    const after = applyScoresToContext(before, updates);

    expect(Math.abs(before.k - actual.k)).toBeGreaterThan(1e-5);
    expect(after.k).toBeCloseTo(actual.k, 9);
  });

  it("returns the same context when there are no updates", () => {
    const context = estimateScaledRoundContexts({
      players,
      firstRound: 19,
      lastRound: 19,
      baseMagicNumber: BASE_MAGIC_NUMBER_2026,
      teamHasGame,
    }).get(19)!;

    expect(applyScoresToContext(context, [])).toBe(context);
  });
});
