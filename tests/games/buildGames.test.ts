import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import {
  buildRoundGames,
  gameIdFor,
  parseGameId,
  roundFileName,
  type RawFixtureRound,
  type RawPlayerDetail,
} from "@/lib/games/buildGames";
import { isRoundVisible, visibleRounds } from "@/lib/games/visibility";
import { validateRoundFile } from "@/lib/games/validate";
import { writeGamesFiles } from "@/lib/games/writeGames";

const ROOT = path.resolve(".");
const fixtures = JSON.parse(readFileSync(path.join(ROOT, "data/2026/fixtures-raw.json"), "utf8")) as {
  rounds: RawFixtureRound[];
};
const detail = (id: number) =>
  JSON.parse(readFileSync(path.join(ROOT, `data/2026/player-details/${id}.json`), "utf8")) as RawPlayerDetail;

const round5 = fixtures.rounds.find((r) => r.round === 5)!;
const round8 = fixtures.rounds.find((r) => r.round === 8)!;

describe("buildRoundGames on real data", () => {
  const { file, problems } = buildRoundGames({ season: 2026, round: round5, players: [detail(10)] });
  const game = file.games.find((g) => g.fixtureId === 451)!;

  it("matches the fixture's score and margin", () => {
    expect(game.id).toBe("2026-5-ade-car");
    expect(game.home).toEqual({ team: "ADE", teamName: "Adelaide", goals: 17, behinds: 12, total: 114 });
    expect(game.away).toEqual({ team: "CAR", teamName: "Carlton", goals: 12, behinds: 14, total: 86 });
    expect(game.margin).toBe(28);
    expect(game.winner).toBe("ADE");
    expect(game.venue).toBe("Adelaide Oval");
    expect(game.kickoff).toBe("2026-04-09T19:40:00+10:00");
    expect(game.quarters).toBeNull();
    expect(problems).toEqual([]);
  });

  it("matches a known player's stats in the per-player data", () => {
    expect(game.players.home).toHaveLength(1);
    expect(game.players.home[0]).toEqual({
      id: 10,
      name: "Jordan Dawson",
      team: "ADE",
      positions: ["MID"],
      score: 80,
      minutes: 105,
      tog: 79,
      kicks: 18,
      handballs: 8,
      disposals: 26,
      marks: 1,
      tackles: 3,
      hitouts: 0,
      goals: 1,
      behinds: 0,
      price: 553100,
      priceChange: -26900,
      priceBefore: 580000,
      // No engine passed here: breakevens are null.
      breakeven: null,
      nextBreakeven: null,
    });
    expect(game.players.away).toEqual([]);
  });

  it("records a draw with no winner", () => {
    const draw = buildRoundGames({ season: 2026, round: round8, players: [] }).file.games.find(
      (g) => g.home.total === g.away.total,
    )!;
    expect(draw.id).toBe("2026-8-col-haw");
    expect(draw.margin).toBe(0);
    expect(draw.winner).toBeNull();
  });
});

describe("buildRoundGames linking", () => {
  const base = (over: Partial<RawPlayerDetail>): RawPlayerDetail => ({
    id: 900_001,
    first_name: "Test",
    last_name: "Player",
    team: { abbrev: "ADE" },
    positions: [{ position: "DEF" }],
    player_match_stats: [],
    player_stats: [],
    ...over,
  });

  it("reports and skips players who can't be linked, never guessing", () => {
    const players = [
      base({ id: 1, player_match_stats: [{ fixture_id: 99999, round: 5, points: 50 }] }),
      base({ id: 2, team: { abbrev: "GEE" }, player_match_stats: [{ fixture_id: 451, round: 5, points: 50 }] }),
      base({ id: 3, player_stats: [{ round: 5, games: 1, price: 100_000, price_change: 0 }] }),
    ];
    const { file, problems } = buildRoundGames({ season: 2026, round: round5, players });

    expect(problems).toHaveLength(3);
    expect(problems[0]).toContain("fixture 99999, which isn't in this round");
    expect(problems[1]).toContain("(GEE) isn't in ADE v CAR");
    expect(problems[2]).toContain("played but has no match stats");
    expect(file.games.flatMap((g) => [...g.players.home, ...g.players.away])).toEqual([]);
  });

  it("keeps missing stats as null (no disposals without both parts) and 0% TOG as missing", () => {
    const players = [
      base({ player_match_stats: [{ fixture_id: 451, round: 5, points: 61, kicks: 9, togp: 0 }] }),
    ];
    const p = buildRoundGames({ season: 2026, round: round5, players }).file.games.find((g) => g.fixtureId === 451)!
      .players.home[0];

    expect(p).toMatchObject({ score: 61, kicks: 9, handballs: null, disposals: null, tog: null, price: null, minutes: null });
  });

  it("makes stable ids and reads them back", () => {
    expect(gameIdFor(2026, 5, "ADE", "CAR")).toBe("2026-5-ade-car");
    expect(parseGameId("2026-12-gws-haw")).toEqual({ season: 2026, round: 12 });
    expect(parseGameId("2026-5-ade")).toBeNull();
    expect(parseGameId("../etc/passwd")).toBeNull();
    expect(roundFileName(5)).toBe("round-05.json");
  });
});

describe("writeGamesFiles", () => {
  const out = mkdtempSync(path.join(os.tmpdir(), "games-"));
  afterAll(() => rmSync(out, { recursive: true, force: true }));
  const run = (refresh = false) => writeGamesFiles({ season: 2026, dataDir: path.join(ROOT, "data"), outDir: out, refresh });

  it("writes every completed round, validated, with an index", () => {
    const first = run();
    expect(first.written).toEqual(first.completedRounds);
    expect(first.problems).toEqual([]);
    expect(readdirSync(out)).toContain("index.json");

    const r12 = JSON.parse(readFileSync(path.join(out, "round-12.json"), "utf8"));
    expect(validateRoundFile(r12, { season: 2026, round: 12 }).ok).toBe(true);
    expect(r12.games).toHaveLength(7);
  }, 60_000);

  it("adds price-before and breakevens as the site showed them at the time", () => {
    const round = (r: number) =>
      (JSON.parse(readFileSync(path.join(out, roundFileName(r)), "utf8")).games as {
        players: { home: Record<string, number | null>[]; away: Record<string, number | null>[] };
      }[]).flatMap((g) => [...g.players.home, ...g.players.away]);

    // Dawson, Round 5: needed 143, scored 80, $580,000 -> $553,100.
    expect(round(5).find((p) => p.id === 10)).toMatchObject({
      score: 80,
      breakeven: 143,
      priceBefore: 580_000,
      price: 553_100,
      priceChange: -26_900,
      nextBreakeven: 147,
    });

    // A round's BE is the previous round's Next BE.
    const next9 = new Map(round(9).map((p) => [p.id, p.nextBreakeven]));
    const both = round(10).filter((p) => next9.has(p.id as number));
    expect(both.length).toBeGreaterThan(300);
    expect(both.every((p) => p.breakeven === next9.get(p.id as number))).toBe(true);

    // Round 24's Next BE is the breakeven the site shows now (null where
    // his price can't change yet; the site shows 0 there).
    const site = new Map(
      (JSON.parse(readFileSync(path.join(ROOT, "data/2026/players-normalised.json"), "utf8")) as { id: number; breakeven: number }[]).map(
        (p) => [p.id, p.breakeven],
      ),
    );
    expect(round(24).every((p) => p.nextBreakeven === null || p.nextBreakeven === site.get(p.id as number))).toBe(true);

    // No breakeven before two scores.
    expect(round(1).every((p) => p.breakeven === null)).toBe(true);
  });

  it("changes nothing when re-run, and --refresh rebuilds without rewriting identical files", () => {
    const before = statSync(path.join(out, "round-05.json")).mtimeMs;
    const again = run();
    expect(again.written).toEqual([]);
    expect(again.kept).toEqual(again.completedRounds);

    const refreshed = run(true);
    expect(refreshed.written).toEqual([]);
    expect(refreshed.unchanged).toEqual(refreshed.completedRounds);
    expect(statSync(path.join(out, "round-05.json")).mtimeMs).toBe(before);
  }, 60_000);

  it("keeps an edited earlier round unless --refresh, which rebuilds it", () => {
    const file = path.join(out, "round-03.json");
    const original = readFileSync(file, "utf8");
    const edited = JSON.parse(original);
    edited.games[0].venue = "Edited Oval";
    writeFileSync(file, JSON.stringify(edited));

    run();
    expect(JSON.parse(readFileSync(file, "utf8")).games[0].venue).toBe("Edited Oval");

    expect(run(true).written).toEqual([3]);
    expect(readFileSync(file, "utf8")).toBe(original);
  }, 60_000);

  it("fails with a clear message when data is missing", () => {
    const empty = mkdtempSync(path.join(os.tmpdir(), "nodata-"));
    try {
      expect(() => writeGamesFiles({ season: 2026, dataDir: empty })).toThrow(/Missing .*fixtures-raw\.json/);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe("round visibility (DEBUG_AS_OF_ROUND)", () => {
  const locked = { currentSeason: 2026, lastVisibleRound: 10 };

  it("hides rounds after the locked round, and future seasons", () => {
    expect(isRoundVisible(2026, 10, locked)).toBe(true);
    expect(isRoundVisible(2026, 11, locked)).toBe(false);
    expect(isRoundVisible(2025, 24, locked)).toBe(true);
    expect(isRoundVisible(2027, 0, locked)).toBe(false);
    expect(visibleRounds(2026, [12, 0, 10, 11, 5], locked)).toEqual([0, 5, 10]);
  });
});
