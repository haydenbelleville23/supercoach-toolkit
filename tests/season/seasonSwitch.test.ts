import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ACTIVE_SEASON,
  CURRENT_COMPLETED_ROUND,
  DEBUG_SEASON,
  IS_PRESEASON,
  PLAYERS_DATA_SEASON,
  SEASON_PHASE,
  SEASON_YEAR,
} from "@/data/season";
import { calculateCashCowRows } from "@/lib/cashcows";
import { FIXTURES_ARE_SAMPLE, FIXTURES_SEASON, getFixtures } from "@/lib/fixtures";
import { getFixtureDifficultyData } from "@/lib/fixtureDifficulty/pageData";
import { myTeamKey } from "@/lib/planner/useMyTeam";
import { playerRepository } from "@/lib/repository/PlayerRepository";
import {
  NO_FIXTURES_FILE,
  fixturesSource,
  playersSeason,
  sampleFixturesFile,
} from "@/lib/season/dataSource";
import { deriveSeasonPhase } from "@/lib/season/phase";
import { parseDebugSeason } from "@/lib/season/seasonYear";

const ROOT = path.resolve(".");

describe("season phase", () => {
  it("is preseason before any round, inseason during, complete after the last fixtured round", () => {
    expect(deriveSeasonPhase({ completedRound: -1, firstRound: 0, lastFixtureRound: 24 })).toBe("preseason");
    expect(deriveSeasonPhase({ completedRound: -1, firstRound: 0, lastFixtureRound: null })).toBe("preseason");
    expect(deriveSeasonPhase({ completedRound: 0, firstRound: 0, lastFixtureRound: 24 })).toBe("inseason");
    expect(deriveSeasonPhase({ completedRound: 10, firstRound: 0, lastFixtureRound: 24 })).toBe("inseason");
    expect(deriveSeasonPhase({ completedRound: 24, firstRound: 0, lastFixtureRound: 24 })).toBe("complete");
  });
});

describe("DEBUG_SEASON", () => {
  it("is off when unset or empty, a season year when set, and refuses typos", () => {
    expect(parseDebugSeason(undefined)).toBeNull();
    expect(parseDebugSeason("  ")).toBeNull();
    expect(parseDebugSeason("2027")).toBe(2027);
    for (const bad of ["27", "2027a", "1999", "next"]) {
      expect(() => parseDebugSeason(bad)).toThrow(/DEBUG_SEASON/);
    }
  });

  it("is never set in a committed file", () => {
    const committed = [".env.example", "vercel.json", "next.config.ts", "package.json"]
      .map((file) => path.join(ROOT, file))
      .filter(existsSync)
      .map((file) => readFileSync(file, "utf8"));
    for (const text of committed) expect(text).not.toMatch(/DEBUG_SEASON\s*[=:]\s*["']?\d/);
  });
});

describe("with ACTIVE_SEASON unchanged (production today)", () => {
  it("shows 2026, complete, exactly as before", () => {
    expect(ACTIVE_SEASON).toBe(2026);
    expect(DEBUG_SEASON).toBeNull();
    expect(SEASON_YEAR).toBe(2026);
    expect(PLAYERS_DATA_SEASON).toBe(2026);
    expect(FIXTURES_SEASON).toBe(2026);
    expect(FIXTURES_ARE_SAMPLE).toBe(false);
    expect(CURRENT_COMPLETED_ROUND).toBe(24);
    expect(SEASON_PHASE).toBe("complete");
    expect(IS_PRESEASON).toBe(false);
  });

  it("gives the same page data as before (snapshot of the key numbers)", () => {
    const fixtures = getFixtures();
    const data = getFixtureDifficultyData();
    expect({
      fixtures: fixtures.length,
      rounds: new Set(fixtures.map((f) => f.round)).size,
      players: playerRepository.getAll().length,
      cashCows: calculateCashCowRows(playerRepository.getAll(), "projected").length,
      difficulty: {
        season: data.season,
        preseason: data.preseason,
        basis: data.basis,
        sample: data.sampleFixtures,
        asOfRound: data.asOfRound,
        hasFutureRounds: data.hasFutureRounds,
        teams: data.teams.length,
        valuedCells: data.positions.reduce((n, row) => n + Object.keys(row.cells).length, 0),
      },
    }).toMatchInlineSnapshot(`
      {
        "cashCows": 0,
        "difficulty": {
          "asOfRound": 24,
          "basis": {
            "kind": "current",
            "season": 2026,
          },
          "hasFutureRounds": false,
          "preseason": false,
          "sample": false,
          "season": 2026,
          "teams": 18,
          "valuedCells": 72,
        },
        "fixtures": 207,
        "players": 812,
        "rounds": 25,
      }
    `);
  });

  it("adds no season aliases in next.config (the 2026 files are read directly)", async () => {
    const config = (await import("../../next.config")).default;
    const aliases = Object.keys(config.turbopack?.resolveAlias ?? {});
    expect(aliases).not.toContain("@/data/2026/fixtures-raw.json");
    expect(aliases).not.toContain("@/data/2026/players-normalised.json");
    expect(config.env).toMatchObject({ DEBUG_SEASON: "", PLAYERS_DATA_SEASON: "2026" });
  });

  it("keeps 2026's saved team under its old key; other seasons get their own", () => {
    expect(myTeamKey(2026)).toBe("footynomics.my-team.v1");
    expect(myTeamKey(2027)).toBe("footynomics.my-team.v1.2027");
  });
});

describe("sample fixtures never load in production", () => {
  const exists = (present: string[]) => (file: string) => present.includes(file);

  it("are only chosen with DEBUG_SEASON for that season and no real fixtures", () => {
    const sample = sampleFixturesFile(2027);
    const real = "data/2027/fixtures-raw.json";

    // Production: no DEBUG_SEASON, so never the sample.
    expect(fixturesSource({ season: 2027, debugSeason: null, exists: exists([sample]) })).toBe(NO_FIXTURES_FILE);
    expect(fixturesSource({ season: 2027, debugSeason: null, exists: exists([sample, real]) })).toBe(real);
    // Locally: the sample only when there are no real fixtures.
    expect(fixturesSource({ season: 2027, debugSeason: 2027, exists: exists([sample]) })).toBe(sample);
    expect(fixturesSource({ season: 2027, debugSeason: 2027, exists: exists([sample, real]) })).toBe(real);
    expect(fixturesSource({ season: 2027, debugSeason: 2028, exists: exists([sample]) })).toBe(NO_FIXTURES_FILE);
  });

  it("use last season's players until the new season's file exists", () => {
    expect(playersSeason({ season: 2027, exists: (f) => f === "data/2026/players-normalised.json" })).toBe(2026);
    expect(playersSeason({ season: 2027, exists: () => true })).toBe(2027);
    expect(playersSeason({ season: 2027, exists: () => false })).toBeNull();
  });

  it("are named by no app code except the data-source module", () => {
    const files = (dir: string): string[] =>
      existsSync(dir)
        ? readdirSync(dir).flatMap((name) => {
            const full = path.join(dir, name);
            return statSync(full).isDirectory() ? files(full) : /\.tsx?$/.test(name) ? [full] : [];
          })
        : [];
    const naming = [...files("app"), ...files("components"), ...files("lib"), path.join(ROOT, "next.config.ts")].filter(
      (file) => readFileSync(file, "utf8").includes("fixtures.sample"),
    );
    expect(naming.map((file) => path.relative(ROOT, file).replace(/\\/g, "/"))).toEqual(["lib/season/dataSource.ts"]);
  });

  const manifest = path.join(ROOT, ".next/required-server-files.json");
  const productionBuild =
    existsSync(manifest) && JSON.parse(readFileSync(manifest, "utf8")).config?.env?.DEBUG_SEASON === "";

  it.skipIf(!productionBuild)("aren't in a production build's output", () => {
    const files = (dir: string): string[] =>
      existsSync(dir)
        ? readdirSync(dir).flatMap((name) => {
            const full = path.join(dir, name);
            return statSync(full).isDirectory() ? files(full) : /\.(js|json|html|rsc)$/.test(name) ? [full] : [];
          })
        : [];
    const built = [...files(path.join(ROOT, ".next/server")), ...files(path.join(ROOT, ".next/static"))];
    expect(built.length).toBeGreaterThan(0);
    expect(built.filter((file) => readFileSync(file, "utf8").includes("generated sample"))).toEqual([]);
  });
});

describe("download script", () => {
  it("--dry-run lists every round's URL for the season and makes no request", () => {
    const out = execFileSync(process.execPath, ["--no-warnings", "scripts/downloadFixtures.mjs", "--season", "2027", "--dry-run"], {
      encoding: "utf8",
    });
    expect(out).toMatch(/Dry run: 25 requests for the 2027 fixtures \(none made\)/);
    expect(out.match(/https:\/\/www\.supercoach\.com\.au\/2027\/api\/afl\/classic\/v1\/real_fixture\?round=\d+/g)).toHaveLength(25);
  });

  it("stops (never retries) on 401, 403 and 429", () => {
    const script = readFileSync(path.join(ROOT, "scripts/downloadFixtures.mjs"), "utf8");
    expect(script).toMatch(/new Set\(\[401, 403, 429\]\)/);
    expect(script).toMatch(/error instanceof StopError \|\| attempt >= MAX_RETRIES/);
  });
});
