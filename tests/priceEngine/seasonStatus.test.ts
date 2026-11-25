import { describe, expect, it, vi } from "vitest";

// Runs "as of Round 18" (the DEBUG_AS_OF_ROUND lock) so the expected
// rounds do not change as new data is downloaded.
vi.hoisted(() => {
  vi.stubEnv("DEBUG_AS_OF_ROUND", "18");
});

import { CURRENT_COMPLETED_ROUND } from "@/data/season";
import { getFixtures } from "@/lib/fixtures";
import { getPlayers } from "@/lib/players";
import {
  getLatestCompletedRound,
} from "@/lib/season/seasonStatus";

import type { Player } from "@/types/player";

const players = getPlayers();
const fixtures = getFixtures();

describe("getLatestCompletedRound", () => {
  it("derives Round 18 from the data as of Round 18", () => {
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
