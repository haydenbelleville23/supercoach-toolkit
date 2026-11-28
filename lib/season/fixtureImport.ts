/**
 * Fixture import from a CSV (scripts/import-fixtures.ts): parse, validate
 * and report, then write data/{season}/fixtures-raw.json in the same shape
 * the downloaded file has, so every page reads it unchanged.
 *
 * Columns: round, home, away, venue, kickoff (ISO 8601 with an explicit
 * offset, e.g. 2027-03-11T19:30:00+11:00), and optionally notes. Team
 * names may be our three-letter codes or any name the availability
 * importer recognises ("Crows", "GWS Giants"). Pure functions only.
 */

import { resolveTeam } from "@/lib/availability/matchPlayers";
import { TEAMS } from "@/lib/teams";

/** SuperCoach's numeric team ids, as in the downloaded fixture files. */
export const SUPERCOACH_TEAM_IDS: Readonly<Record<string, number>> = {
  ADE: 1, BRL: 2, CAR: 3, COL: 4, ESS: 5, FRE: 6, GEE: 7, HAW: 8, NTH: 9,
  MEL: 10, PTA: 11, RIC: 12, STK: 13, SYD: 14, WBD: 15, WCE: 16, GCS: 17, GWS: 18,
};

/** Team names as the downloaded fixture files write them. */
const SUPERCOACH_TEAM_NAMES: Readonly<Record<string, string>> = {
  ADE: "Adelaide", BRL: "Brisbane", CAR: "Carlton", COL: "Collingwood", ESS: "Essendon",
  FRE: "Fremantle", GEE: "Geelong", GCS: "Gold Coast", GWS: "GWS Giants", HAW: "Hawthorn",
  MEL: "Melbourne", NTH: "North Melbourne", PTA: "Port Adelaide", RIC: "Richmond",
  STK: "St Kilda", SYD: "Sydney", WBD: "Western Bulldogs", WCE: "West Coast",
};

export const ALL_TEAMS = Object.keys(SUPERCOACH_TEAM_IDS).sort();

export interface ImportedGame {
  /** CSV line number (1 = header), for messages. */
  line: number;
  round: number;
  home: string;
  away: string;
  venue: string;
  kickoff: string;
  notes: string;
}

export interface FixtureImportReport {
  errors: string[];
  warnings: string[];
  games: ImportedGame[];
  rounds: number[];
  gamesPerRound: Record<number, number>;
  gamesPerTeam: Record<string, number>;
  /** Teams with no game in a round that has games: round -> teams. */
  byesByRound: Record<number, string[]>;
  /** Byes per team across the season. */
  byesPerTeam: Record<string, number>;
}

/** A small CSV parser: commas, double-quoted fields with "" escapes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Blank lines are skipped.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const REQUIRED = ["round", "home", "away", "venue", "kickoff"] as const;
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:[+-]\d{2}:\d{2}|Z)$/;
const ISO_NO_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

/**
 * A real calendar date and time (Date.parse quietly rolls 30 February over
 * into March, so the parts are checked themselves).
 */
function isRealDateTime(iso: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(iso);
  if (!match) return false;
  const [year, month, day, hour, minute, second = "0"] = match.slice(1).map(Number) as unknown as number[];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    hour <= 23 &&
    minute <= 59 &&
    Number(second) <= 59
  );
}

/**
 * Validates every row and reports; never guesses. Errors (always fatal):
 * missing columns, bad rounds, unknown teams, a team playing itself, the
 * same game twice, a team with two games in one round, bad dates, missing
 * offsets, kickoffs outside the season. Warnings (fatal unless
 * --allow-warnings): teams with different game counts, rounds missing
 * from the expected range, a game without a venue.
 */
export function validateFixtureCsv(
  text: string,
  { season, firstRound, finalRound }: { season: number; firstRound: number; finalRound: number },
): FixtureImportReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const games: ImportedGame[] = [];

  const rows = parseCsv(text.replace(/^﻿/, ""));
  const header = (rows[0] ?? []).map((cell) => cell.trim().toLowerCase());
  const missing = REQUIRED.filter((column) => !header.includes(column));

  if (rows.length === 0 || missing.length > 0) {
    errors.push(`Missing column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}. Expected: ${REQUIRED.join(", ")}, notes (optional).`);
    return finish();
  }

  const col = (name: string) => header.indexOf(name);
  const seenGames = new Map<string, number>();
  const teamRound = new Map<string, number>();

  rows.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const cell = (name: string) => (col(name) === -1 ? "" : (cells[col(name)] ?? "").trim());

    const roundText = cell("round");
    const round = Number(roundText);
    let ok = true;

    if (!/^\d+$/.test(roundText) || round < firstRound || round > finalRound) {
      errors.push(`Line ${line}: round "${roundText}" isn't a round from ${firstRound} to ${finalRound}.`);
      ok = false;
    }

    const home = resolveTeam(cell("home"));
    const away = resolveTeam(cell("away"));
    if (!home) {
      errors.push(`Line ${line}: unknown team "${cell("home")}" (home).`);
      ok = false;
    }
    if (!away) {
      errors.push(`Line ${line}: unknown team "${cell("away")}" (away).`);
      ok = false;
    }
    if (home && away && home === away) {
      errors.push(`Line ${line}: ${home} can't play itself.`);
      ok = false;
    }

    const kickoff = cell("kickoff");
    if (ISO_NO_OFFSET.test(kickoff)) {
      errors.push(`Line ${line}: kickoff "${kickoff}" has no time zone offset (add e.g. +11:00).`);
      ok = false;
    } else if (!ISO_WITH_OFFSET.test(kickoff) || Number.isNaN(Date.parse(kickoff)) || !isRealDateTime(kickoff)) {
      errors.push(`Line ${line}: kickoff "${kickoff}" isn't a valid ISO date-time with an offset.`);
      ok = false;
    } else if (!kickoff.startsWith(String(season))) {
      errors.push(`Line ${line}: kickoff "${kickoff}" isn't in ${season}.`);
      ok = false;
    }

    const venue = cell("venue");
    if (!venue) warnings.push(`Line ${line}: no venue.`);

    if (!ok || !home || !away) return;

    const pair = `${round}:${[home, away].sort().join("-")}`;
    if (seenGames.has(pair)) {
      errors.push(`Line ${line}: duplicate game, ${home} v ${away} in Round ${round} (also line ${seenGames.get(pair)}).`);
      return;
    }
    seenGames.set(pair, line);

    for (const team of [home, away]) {
      const key = `${round}:${team}`;
      if (teamRound.has(key)) {
        errors.push(`Line ${line}: ${team} has two games in Round ${round} (also line ${teamRound.get(key)}).`);
        ok = false;
      } else {
        teamRound.set(key, line);
      }
    }
    if (!ok) return;

    games.push({ line, round, home, away, venue, kickoff, notes: cell("notes") });
  });

  return finish();

  function finish(): FixtureImportReport {
    const rounds = [...new Set(games.map((game) => game.round))].sort((a, b) => a - b);
    const gamesPerRound: Record<number, number> = {};
    const gamesPerTeam: Record<string, number> = Object.fromEntries(ALL_TEAMS.map((team) => [team, 0]));
    const byesByRound: Record<number, string[]> = {};
    const byesPerTeam: Record<string, number> = Object.fromEntries(ALL_TEAMS.map((team) => [team, 0]));

    for (const game of games) {
      gamesPerRound[game.round] = (gamesPerRound[game.round] ?? 0) + 1;
      gamesPerTeam[game.home] += 1;
      gamesPerTeam[game.away] += 1;
    }

    for (const round of rounds) {
      const playing = new Set(games.filter((g) => g.round === round).flatMap((g) => [g.home, g.away]));
      byesByRound[round] = ALL_TEAMS.filter((team) => !playing.has(team));
      for (const team of byesByRound[round]) byesPerTeam[team] += 1;
    }

    if (games.length > 0) {
      const counts = new Set(Object.values(gamesPerTeam));
      if (counts.size > 1) {
        const detail = ALL_TEAMS.map((team) => `${team} ${gamesPerTeam[team]}`).join(", ");
        warnings.push(`Teams have different numbers of games: ${detail}.`);
      }
      const missingRounds: number[] = [];
      for (let round = firstRound; round <= finalRound; round += 1) {
        if (!rounds.includes(round)) missingRounds.push(round);
      }
      if (missingRounds.length > 0) warnings.push(`No games in round${missingRounds.length === 1 ? "" : "s"} ${missingRounds.join(", ")}.`);
    } else if (errors.length === 0) {
      errors.push("The file has no games.");
    }

    return { errors, warnings, games, rounds, gamesPerRound, gamesPerTeam, byesByRound, byesPerTeam };
  }
}

/** Plain-text report of a validation, for the script's output. */
export function formatImportReport(report: FixtureImportReport): string {
  const lines: string[] = [];
  lines.push(`Games: ${report.games.length}. Rounds: ${report.rounds.length ? report.rounds.join(", ") : "none"}.`);
  lines.push(`Games per round: ${report.rounds.map((r) => `R${r} ${report.gamesPerRound[r]}`).join(", ") || "none"}.`);
  lines.push(`Games per team: ${ALL_TEAMS.map((t) => `${t} ${report.gamesPerTeam[t]}`).join(", ")}.`);
  lines.push("Byes (no game that round):");
  for (const round of report.rounds) {
    const byes = report.byesByRound[round];
    if (byes.length > 0) lines.push(`  R${round}: ${byes.join(", ")}`);
  }
  lines.push(`Byes per team: ${ALL_TEAMS.map((t) => `${t} ${report.byesPerTeam[t]}`).join(", ")}.`);
  for (const warning of report.warnings) lines.push(`WARNING: ${warning}`);
  for (const error of report.errors) lines.push(`ERROR: ${error}`);
  return lines.join("\n");
}

/** A team as the downloaded fixture files write it. */
function rawTeam(code: string) {
  return { id: SUPERCOACH_TEAM_IDS[code], abbrev: code, name: SUPERCOACH_TEAM_NAMES[code] ?? TEAMS[code]?.name ?? code };
}

export interface RawFixtureFileOut {
  season: number;
  downloadedAt: string;
  source: string;
  sample?: boolean;
  note?: string;
  rounds: { round: number; response: Record<string, unknown>[] }[];
}

/**
 * The fixture file in the downloaded shape: { season, downloadedAt, rounds:
 * [{ round, response: [game] }] }, each game with the fields the loaders
 * read (id, season, kickoff, team1/team2 {id, abbrev, name}, location,
 * round) and no result yet. Game ids are season * 1000 + order (they
 * only need to be unique).
 */
export function toRawFixtureFile(
  games: readonly Pick<ImportedGame, "round" | "home" | "away" | "venue" | "kickoff">[],
  { season, generatedAt, source }: { season: number; generatedAt: string; source: string },
): RawFixtureFileOut {
  const ordered = [...games].sort((a, b) => a.round - b.round || a.kickoff.localeCompare(b.kickoff) || a.home.localeCompare(b.home));
  const rounds = [...new Set(ordered.map((game) => game.round))];

  return {
    season,
    downloadedAt: generatedAt,
    source,
    rounds: rounds.map((round) => ({
      round,
      response: ordered
        .filter((game) => game.round === round)
        .map((game) => ({
          id: season * 1000 + ordered.indexOf(game) + 1,
          season: String(season),
          kickoff: game.kickoff,
          team1: rawTeam(game.home),
          team2: rawTeam(game.away),
          location: game.venue,
          round,
          team1_score: null,
          team2_score: null,
          match_status: "Scheduled",
          status: "pre",
        })),
    })),
  };
}
