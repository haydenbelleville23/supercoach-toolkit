import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ALL_TEAMS,
  parseCsv,
  toRawFixtureFile,
  validateFixtureCsv,
} from "@/lib/season/fixtureImport";
import { generateSampleGames, sampleGamesCsv, SAMPLE_BYES } from "@/lib/season/sampleFixtures";

const OPTS = { season: 2027, firstRound: 0, finalRound: 24 };
const HEADER = "round,home,away,venue,kickoff,notes";
const csv = (...lines: string[]) => [HEADER, ...lines].join("\n");

describe("fixture CSV validation", () => {
  it("accepts codes and known names, and derives byes", () => {
    const report = validateFixtureCsv(
      csv("1,Magpies,CAR,MCG,2027-03-11T19:30:00+11:00,", "1,GWS Giants,Swans,ENGIE Stadium,2027-03-12T19:40:00+11:00,opener"),
      OPTS,
    );
    expect(report.errors).toEqual([]);
    expect(report.games.map((g) => [g.home, g.away])).toEqual([
      ["COL", "CAR"],
      ["GWS", "SYD"],
    ]);
    expect(report.games[1].notes).toBe("opener");
    expect(report.rounds).toEqual([1]);
    expect(report.gamesPerRound).toEqual({ 1: 2 });
    expect(report.byesByRound[1]).toEqual(ALL_TEAMS.filter((t) => !["COL", "CAR", "GWS", "SYD"].includes(t)));
    expect(report.byesPerTeam.COL).toBe(0);
    expect(report.byesPerTeam.ADE).toBe(1);
  });

  it.each([
    ["an unknown team", "1,XYZ,CAR,MCG,2027-03-11T19:30:00+11:00,", /unknown team "XYZ"/],
    ["a team playing itself", "1,CAR,Blues,MCG,2027-03-11T19:30:00+11:00,", /CAR can't play itself/],
    ["a bad date", "1,COL,CAR,MCG,2027-02-30T19:30:00+11:00,", /isn't a valid ISO date-time/],
    ["a kickoff with no offset", "1,COL,CAR,MCG,2027-03-11T19:30:00,", /has no time zone offset/],
    ["a kickoff in another year", "1,COL,CAR,MCG,2026-03-11T19:30:00+11:00,", /isn't in 2027/],
    ["a round out of range", "25,COL,CAR,MCG,2027-03-11T19:30:00+11:00,", /round "25"/],
    ["a non-numeric round", "R1,COL,CAR,MCG,2027-03-11T19:30:00+11:00,", /round "R1"/],
  ])("rejects %s", (_name, line, message) => {
    const report = validateFixtureCsv(csv(line), OPTS);
    expect(report.errors.join("\n")).toMatch(message);
    expect(report.games).toEqual([]);
  });

  it("rejects a duplicate game and a team with two games in one round", () => {
    const duplicate = validateFixtureCsv(
      csv("1,COL,CAR,MCG,2027-03-11T19:30:00+11:00,", "1,CAR,COL,Marvel,2027-03-12T19:30:00+11:00,"),
      OPTS,
    );
    expect(duplicate.errors.join("\n")).toMatch(/duplicate game, CAR v COL in Round 1 \(also line 2\)/);

    const twice = validateFixtureCsv(
      csv("1,COL,CAR,MCG,2027-03-11T19:30:00+11:00,", "1,COL,ESS,MCG,2027-03-13T19:30:00+11:00,"),
      OPTS,
    );
    expect(twice.errors.join("\n")).toMatch(/COL has two games in Round 1/);
  });

  it("rejects missing columns and an empty file", () => {
    expect(validateFixtureCsv("round,home,away\n1,COL,CAR", OPTS).errors[0]).toMatch(/Missing columns: venue, kickoff/);
    expect(validateFixtureCsv(HEADER, OPTS).errors).toEqual(["The file has no games."]);
  });

  it("warns (doesn't fail) on uneven game counts, missing rounds and missing venues", () => {
    const report = validateFixtureCsv(csv("1,COL,CAR,,2027-03-11T19:30:00+11:00,"), OPTS);
    expect(report.errors).toEqual([]);
    const warnings = report.warnings.join("\n");
    expect(warnings).toMatch(/no venue/);
    expect(warnings).toMatch(/different numbers of games/);
    expect(warnings).toMatch(/No games in rounds 0, 2, 3/);
  });

  it("parses quoted fields, CRLF and a BOM", () => {
    expect(parseCsv('a,"b, c","d ""e"""\r\n1,2,3\r\n')).toEqual([
      ["a", "b, c", 'd "e"'],
      ["1", "2", "3"],
    ]);
    const report = validateFixtureCsv(`﻿${HEADER}\r\n1,COL,CAR,"MCG, Melbourne",2027-03-11T19:30:00+11:00,\r\n`, OPTS);
    expect(report.games[0].venue).toBe("MCG, Melbourne");
  });
});

describe("the written file", () => {
  it("has the downloaded file's shape, so the loaders read it unchanged", () => {
    const report = validateFixtureCsv(csv("1,COL,CAR,MCG,2027-03-11T19:30:00+11:00,"), OPTS);
    const file = toRawFixtureFile(report.games, { season: 2027, generatedAt: "2027-01-01T00:00:00Z", source: "test" });
    const real = JSON.parse(readFileSync(path.resolve("data/2026/fixtures-raw.json"), "utf8"));
    const realGame = real.rounds[1].response[0];
    const game = file.rounds[0].response[0] as typeof realGame;

    expect(Object.keys(file)).toEqual(expect.arrayContaining(Object.keys(real)));
    for (const key of ["id", "season", "kickoff", "location", "round", "match_status", "status"]) {
      expect(typeof game[key]).toBe(typeof realGame[key]);
    }
    expect(game.team1).toEqual({ id: 4, abbrev: "COL", name: "Collingwood" });
    expect(Object.keys(game.team1)).toEqual(Object.keys(realGame.team1));
    expect(game).toMatchObject({ season: "2027", round: 1, location: "MCG", team1_score: null, match_status: "Scheduled" });
  });

  it("round-trips: written, then read back the way lib/fixtures.ts reads it", () => {
    const lines = ["1,COL,CAR,MCG,2027-03-11T19:30:00+11:00,", "2,CAR,ESS,Marvel Stadium,2027-03-18T19:30:00+11:00,"];
    const file = JSON.parse(JSON.stringify(toRawFixtureFile(validateFixtureCsv(csv(...lines), OPTS).games, {
      season: 2027,
      generatedAt: "x",
      source: "test",
    })));
    const read = file.rounds.flatMap((r: { response: { id: number; round: number; kickoff: string; team1: { abbrev: string }; team2: { abbrev: string }; location: string }[] }) =>
      r.response.map((f) => ({ id: f.id, round: f.round, kickoff: f.kickoff, homeTeam: f.team1.abbrev, awayTeam: f.team2.abbrev, location: f.location })),
    );
    expect(read).toEqual([
      { id: 2027001, round: 1, kickoff: "2027-03-11T19:30:00+11:00", homeTeam: "COL", awayTeam: "CAR", location: "MCG" },
      { id: 2027002, round: 2, kickoff: "2027-03-18T19:30:00+11:00", homeTeam: "CAR", awayTeam: "ESS", location: "Marvel Stadium" },
    ]);
  });
});

describe("the invented 2027 sample", () => {
  const games = generateSampleGames(2027);
  const report = validateFixtureCsv(sampleGamesCsv(games), OPTS);

  it("passes the importer's checks: every team 23 games and 2 byes, like 2026", () => {
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.rounds).toEqual(Array.from({ length: 25 }, (_, i) => i));
    expect(new Set(Object.values(report.gamesPerTeam))).toEqual(new Set([23]));
    expect(new Set(Object.values(report.byesPerTeam))).toEqual(new Set([2]));
    for (const [round, byes] of Object.entries(SAMPLE_BYES)) {
      expect(report.byesByRound[Number(round)]).toHaveLength(byes);
    }
  });

  it("matches the committed sample file, which is clearly marked", () => {
    const file = JSON.parse(readFileSync(path.resolve("data/2027/fixtures.sample.json"), "utf8"));
    expect(file.sample).toBe(true);
    expect(file.note).toContain("INVENTED SAMPLE");
    expect(file.rounds.flatMap((r: { response: unknown[] }) => r.response)).toHaveLength(games.length);
  });
});
