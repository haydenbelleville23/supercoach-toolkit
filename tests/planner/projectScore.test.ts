import { describe, expect, it, vi } from "vitest";

// Needs debutants who haven't played yet, so it runs as of Round 10.
vi.hoisted(() => {
  vi.stubEnv("DEBUG_AS_OF_ROUND", "10");
});

import { placeholderToPlayer } from "@/lib/planner/placeholders";
import { PRE_DEBUT_ROOKIE_SCORE, projectScore } from "@/lib/planner/projectScore";
import type { Player } from "@/types/player";

import { plannerSetup } from "./plannerHelpers";

const { players, makeTeam, run } = plannerSetup();

const synthetic = (previousGames: number, scores: number[]): Player => ({
  id: 999_001,
  championDataId: null,
  name: "Test Player",
  team: "MEL",
  teamName: "Melbourne",
  positions: ["MID"],
  price: 200_000,
  games: scores.length,
  average: 0,
  average3: 0,
  average5: 0,
  recentScores: scores,
  history: scores.map((score, i) => ({
    round: i + 1,
    score,
    price: 200_000,
    priceChange: 0,
    games: 1,
    opponent: null,
    homeAway: null,
  })),
  breakeven: 0,
  ownership: null,
  previousGames,
  active: true,
  availability: null,
});

describe("projectScore", () => {
  it("gives a debutant yet to play the fixed pre-debut score", () => {
    expect(PRE_DEBUT_ROOKIE_SCORE).toBe(50);
    expect(projectScore(synthetic(0, []), 11, 10)).toBe(50);
  });

  it("gives no projection to a non-debutant with no games yet", () => {
    expect(projectScore(synthetic(18, []), 11, 10)).toBeNull();
  });

  it("uses the season average once he has played", () => {
    expect(projectScore(synthetic(0, [30, 70]), 11, 10)).toBe(50);
    expect(projectScore(synthetic(0, [90, 110]), 11, 10)).toBe(100);
    expect(projectScore(synthetic(22, [80, 100, 120]), 11, 10)).toBe(100);
  });

  it("only counts games up to the completed round", () => {
    // Games in rounds 1-3; completed round 1 means only the first counts.
    expect(projectScore(synthetic(0, [40, 80, 120]), 5, 1)).toBe(40);
    // Completed round 0: no games yet, so the debutant rule applies.
    expect(projectScore(synthetic(0, [40, 80, 120]), 5, 0)).toBe(50);
  });

  it("leaves Rookie (TBC) placeholders unprojected", () => {
    const placeholder = placeholderToPlayer({ id: -1, position: "MID", team: null });
    expect(placeholder.previousGames).toBe(0);
    expect(projectScore(placeholder, 11, 10)).toBeNull();
  });
});

describe("planner price path for a debutant yet to play", () => {
  // A real 2026 debutant with no games by Round 10 whose team plays 11-13.
  const debutant = players.find(
    (p) => p.previousGames === 0 && p.history.every((h) => h.games === 0),
  )!;

  it("projects 50 a round and moves his price after three projected games", () => {
    expect(debutant).toBeDefined();
    const { projector } = run(makeTeam([debutant]), { id: "p", name: "P", rounds: {}, scoreOverrides: {} }, 24);
    const path = projector.getPath(debutant.id);
    const played = path.filter((r) => !r.onBye);

    expect(played.slice(0, 3).every((r) => r.score === PRE_DEBUT_ROOKIE_SCORE)).toBe(true);
    // No price change until his third game (two earlier scores needed).
    expect(played[0].priceAfter).toBe(debutant.price);
    expect(played[1].priceAfter).toBe(debutant.price);
    expect(played[2].priceAfter).not.toBe(debutant.price);
  });
});
