import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { trimFixturesToRound, trimPlayersToRound } from "@/lib/asOf/trimToRound";
import { difficultyBand, formatSigned, teamNetBand } from "@/lib/fixtureDifficulty/colour";
import { POSITION_COLOUR_THRESHOLD, TEAM_NET_COLOUR_THRESHOLD } from "@/lib/fixtureDifficulty/config";
import { buildFixtureRows, opponentFor, type FixtureGame } from "@/lib/fixtureDifficulty/fixtureDifficulty";
import { matchupAdjustment } from "@/lib/fixtureDifficulty/matchup";
import { computePositionDifficulty } from "@/lib/fixtureDifficulty/positionDifficulty";
import { computeTeamDifficulty, gameTotals } from "@/lib/fixtureDifficulty/teamDifficulty";
import type { Player } from "@/types/player";

type Game = { round: number; score: number; opponent: string };

function player(id: number, team: string, positions: string[], games: Game[]): Player {
  return {
    id,
    championDataId: null,
    name: `Player ${id}`,
    team,
    teamName: team,
    positions,
    price: 500_000,
    games: games.length,
    average: 0,
    average3: 0,
    average5: 0,
    recentScores: [],
    history: games.map((g) => ({
      round: g.round,
      score: g.score,
      price: 500_000,
      priceChange: 0,
      games: 1,
      opponent: g.opponent,
      homeAway: "H" as const,
    })),
    breakeven: 0,
    ownership: null,
    previousGames: 20,
    previousAverage: 90,
    active: true,
    availability: null,
  };
}

/** Five games averaging 100: 90 v AAA, 110 v BBB, 100, 100, 100 v CCC. */
const fiveGames = (extra: Partial<Record<number, Game>> = {}): Game[] =>
  [
    { round: 1, score: 90, opponent: "AAA" },
    { round: 2, score: 110, opponent: "BBB" },
    { round: 3, score: 100, opponent: "CCC" },
    { round: 4, score: 100, opponent: "CCC" },
    { round: 5, score: 100, opponent: "CCC" },
  ].map((g) => extra[g.round] ?? g);

describe("position difficulty", () => {
  it("is the mean residual (score minus season average) by opponent and position, with n", () => {
    const table = computePositionDifficulty([player(1, "XXX", ["MID"], fiveGames())], 5);
    expect(table.get("AAA")?.MID).toEqual({ value: -10, n: 1 });
    expect(table.get("BBB")?.MID).toEqual({ value: 10, n: 1 });
    expect(table.get("CCC")?.MID).toEqual({ value: 0, n: 3 });
    expect(table.get("AAA")?.DEF).toBeUndefined();
  });

  it("only counts players averaging over 80 with at least 5 games", () => {
    const exactly80 = fiveGames({ 1: { round: 1, score: 70, opponent: "AAA" }, 2: { round: 2, score: 90, opponent: "BBB" } })
      .map((g) => (g.round >= 3 ? { ...g, score: 80 } : g));
    const fourGames = fiveGames().slice(0, 4);

    expect(computePositionDifficulty([player(1, "XXX", ["MID"], exactly80)], 5).size).toBe(0);
    expect(computePositionDifficulty([player(2, "XXX", ["MID"], fourGames)], 5).size).toBe(0);
    expect(computePositionDifficulty([player(3, "XXX", ["MID"], fiveGames())], 5).size).toBe(3);
  });

  it("counts a dual-position player in both tables", () => {
    const table = computePositionDifficulty([player(1, "XXX", ["MID", "FWD"], fiveGames())], 5);
    expect(table.get("AAA")?.MID).toEqual({ value: -10, n: 1 });
    expect(table.get("AAA")?.FWD).toEqual({ value: -10, n: 1 });
  });

  it("shrinks each cell by n / (n + k) when k > 0", () => {
    const table = computePositionDifficulty([player(1, "XXX", ["MID"], fiveGames())], 5, { shrinkK: 4 });
    expect(table.get("BBB")?.MID?.value).toBeCloseTo(10 * (1 / 5));
    expect(table.get("AAA")?.MID?.n).toBe(1);
  });

  it("ignores rounds after the as-of round (average and games)", () => {
    const games = [...fiveGames(), { round: 6, score: 200, opponent: "AAA" }];
    const table = computePositionDifficulty([player(1, "XXX", ["MID"], games)], 5);
    expect(table.get("AAA")?.MID).toEqual({ value: -10, n: 1 });
  });

  it("on real data, as of Round 10 never uses a later round (same result from trimmed data)", () => {
    const players = JSON.parse(readFileSync(path.resolve("data/2026/players-normalised.json"), "utf8")) as Player[];
    const fixtures = JSON.parse(readFileSync(path.resolve("data/2026/fixtures-raw.json"), "utf8"));
    const fromFull = computePositionDifficulty(players, 10);
    const fromTrimmed = computePositionDifficulty(trimPlayersToRound(players, trimFixturesToRound(fixtures, 10), 10), 10);
    expect([...fromFull]).toEqual([...fromTrimmed]);
    expect([...computePositionDifficulty(players, 24)]).not.toEqual([...fromFull]);
  });
});

describe("team difficulty", () => {
  const players = [
    player(1, "AAA", ["MID"], [{ round: 1, score: 100, opponent: "BBB" }, { round: 2, score: 80, opponent: "CCC" }]),
    player(2, "AAA", ["DEF"], [{ round: 1, score: 50, opponent: "BBB" }, { round: 2, score: 70, opponent: "CCC" }]),
    player(3, "BBB", ["MID"], [{ round: 1, score: 120, opponent: "AAA" }]),
    player(4, "CCC", ["MID"], [{ round: 2, score: 60, opponent: "AAA" }]),
  ];

  it("averages points for and against per game; Net is Against minus For", () => {
    const aaa = computeTeamDifficulty(players, 2).find((t) => t.team === "AAA")!;
    expect(aaa).toEqual({ team: "AAA", games: 2, pointsFor: 150, pointsAgainst: 90, net: -60 });
    const bbb = computeTeamDifficulty(players, 2).find((t) => t.team === "BBB")!;
    expect(bbb.net).toBe(150 - 120); // conceded 150, scored 120: soft
  });

  it("stops at the as-of round", () => {
    expect(computeTeamDifficulty(players, 1).find((t) => t.team === "AAA")!.games).toBe(1);
  });

  it("reproduces SuperCoach's Round 24 St Kilda v Gold Coast totals", () => {
    const real = JSON.parse(readFileSync(path.resolve("data/2026/players-normalised.json"), "utf8")) as Player[];
    expect(gameTotals(real, 24, "STK")).toBe(1575);
    expect(gameTotals(real, 24, "GCS")).toBe(1724);
  });
});

describe("fixture rows", () => {
  const fixtures: FixtureGame[] = [
    { round: 1, homeTeam: "AAA", awayTeam: "BBB" },
    { round: 2, homeTeam: "CCC", awayTeam: "AAA" },
    // Round 3: AAA has a bye.
    { round: 3, homeTeam: "BBB", awayTeam: "CCC" },
    ...[4, 5, 6, 7, 8].map((round) => ({ round, homeTeam: "AAA", awayTeam: round % 2 ? "BBB" : "CCC" })),
  ];
  const difficulty = new Map([
    ["BBB", { MID: { value: 4, n: 12 } }],
    ["CCC", { MID: { value: -2, n: 9 } }],
  ]);
  const rows = (asOfRound: number) =>
    buildFixtureRows({ fixtures, difficulty, position: "MID", asOfRound, fromRound: 1, lastRound: 8, teams: ["AAA"] });

  it("gives the opponent, home/away and value, and marks byes", () => {
    expect(opponentFor(fixtures, "AAA", 2)).toEqual({ opponent: "CCC", homeAway: "A" });
    const cells = rows(0)[0].cells;
    expect(cells[0]).toMatchObject({ round: 1, opponent: "BBB", homeAway: "H", bye: false, value: 4, n: 12 });
    expect(cells[1]).toMatchObject({ round: 2, opponent: "CCC", homeAway: "A", value: -2 });
    expect(cells[2]).toMatchObject({ round: 3, opponent: null, bye: true, value: null });
  });

  it("Rest and Next5 use future rounds only; Next5 skips byes", () => {
    // As of Round 1: future = R2 (-2), R4 (-2), R5 (4), R6 (-2), R7 (4), R8 (-2); R3 is a bye.
    const row = rows(1)[0];
    expect(row.next5).toBeCloseTo((-2 - 2 + 4 - 2 + 4) / 5);
    expect(row.rest).toBeCloseTo((-2 - 2 + 4 - 2 + 4 - 2) / 6);
  });

  it("uses fewer than five when fewer remain, and none in the offseason", () => {
    expect(rows(6)[0].next5).toBeCloseTo((4 - 2) / 2);
    expect(rows(8)[0].next5).toBeNull();
    expect(rows(8)[0].rest).toBeNull();
  });
});

describe("colour bands", () => {
  it("has three states with the position threshold (exactly ±3 is neutral)", () => {
    expect(POSITION_COLOUR_THRESHOLD).toBe(3);
    expect(difficultyBand(3)).toBe("neutral");
    expect(difficultyBand(3.01)).toBe("easy");
    expect(difficultyBand(-3)).toBe("neutral");
    expect(difficultyBand(-3.01)).toBe("hard");
    expect(difficultyBand(null)).toBe("neutral");
  });

  it("uses a separate threshold for Team Net", () => {
    expect(TEAM_NET_COLOUR_THRESHOLD).toBe(50);
    expect(teamNetBand(40)).toBe("neutral");
    expect(teamNetBand(51)).toBe("easy");
    expect(teamNetBand(-51)).toBe("hard");
    expect(difficultyBand(40)).toBe("easy"); // the position threshold would call 40 easy
  });

  it("formats signed values with a true minus sign", () => {
    expect(formatSigned(2.34)).toBe("+2.3");
    expect(formatSigned(-1)).toBe("−1.0");
    expect(formatSigned(0.01)).toBe("0.0");
    expect(formatSigned(null)).toBe("-");
  });
});

describe("matchup adjustment", () => {
  const fixtures: FixtureGame[] = [{ round: 11, homeTeam: "AAA", awayTeam: "WCE" }];
  const difficulty = new Map([["WCE", { MID: { value: 4, n: 20 }, FWD: { value: 1, n: 15 } }]]);

  it("uses the opponent's cell for his position, the mean for two positions, and 0 without data", () => {
    expect(matchupAdjustment({ team: "AAA", positions: ["MID"] }, 11, fixtures, difficulty)).toEqual({ opponent: "WCE", homeAway: "H", value: 4 });
    expect(matchupAdjustment({ team: "AAA", positions: ["MID", "FWD"] }, 11, fixtures, difficulty)?.value).toBe(2.5);
    expect(matchupAdjustment({ team: "AAA", positions: ["RUC"] }, 11, fixtures, difficulty)?.value).toBe(0);
    expect(matchupAdjustment({ team: "AAA", positions: ["MID"] }, 12, fixtures, difficulty)).toBeNull();
  });
});
