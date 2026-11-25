import { describe, expect, it } from "vitest";

import { CURRENT_COMPLETED_ROUND } from "@/data/season";
import { getFixtures } from "@/lib/fixtures";
import { getPlayers } from "@/lib/players";
import {
  getLatestCompletedRound,
  isOffseason,
  type SeasonFixture,
} from "@/lib/season/seasonStatus";

import type { Player } from "@/types/player";

const players = getPlayers();
const fixtures = getFixtures();

describe("getLatestCompletedRound", () => {
  it("derives Round 18 from the 2026 data", () => {
    expect(getLatestCompletedRound(players, fixtures)).toBe(18);
    expect(CURRENT_COMPLETED_ROUND).toBe(18);
  });

  it("does not count a round where one game has no scores yet", () => {
    const round18Game = fixtures.find((f) => f.round === 18)!;

    const withoutHomeTeam: Player[] = players.map((player) =>
      player.team === round18Game.homeTeam
        ? {
            ...player,
            history: player.history.map((row) =>
              row.round === 18 ? { ...row, games: 0, score: null } : row,
            ),
          }
        : player,
    );

    expect(getLatestCompletedRound(withoutHomeTeam, fixtures)).toBe(17);
  });

  it("returns null before any round is complete", () => {
    expect(getLatestCompletedRound([], fixtures)).toBeNull();
  });
});

describe("isOffseason", () => {
  const game = (round: number, kickoff: string): SeasonFixture => ({
    round,
    homeTeam: "AAA",
    awayTeam: "BBB",
    kickoff,
  });

  it("is in season while a remaining round kicks off in the future", () => {
    const now = new Date("2026-07-15T00:00:00+10:00");
    expect(isOffseason(fixtures, 18, now)).toBe(false);
  });

  it("is offseason once the remaining rounds are more than a week past", () => {
    const now = new Date("2026-11-25T00:00:00+11:00");
    expect(isOffseason(fixtures, 18, now)).toBe(true);
  });

  it("is offseason when no rounds remain after the completed one", () => {
    expect(isOffseason([game(24, "2026-08-30T15:00:00+10:00")], 24)).toBe(true);
  });

  it("keeps the final round open for a week after its last kickoff", () => {
    const fixturesLeft = [game(24, "2026-08-30T15:00:00+10:00")];

    expect(
      isOffseason(fixturesLeft, 23, new Date("2026-09-02T12:00:00+10:00")),
    ).toBe(false);
    expect(
      isOffseason(fixturesLeft, 23, new Date("2026-09-08T12:00:00+10:00")),
    ).toBe(true);
  });
});
