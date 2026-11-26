import { classifyReturn, returnRoundFor } from "./classify";
import { SUPERCOACH_SOURCE, SUPERCOACH_STATUS_MAP } from "./config";
import { matchPlayer, type MatchablePlayer } from "./matchPlayers";
import { parseAvailabilityTable, parseSelected } from "./parseTable";
import {
  AVAILABILITY_STATUSES,
  type AvailabilitySnapshot,
  type AvailabilityStatus,
  type PlayerAvailability,
} from "./types";

/** SuperCoach's own fields for one player (from the per-player files). */
export interface SuperCoachStatus {
  id: number;
  injury_suspension_status: string | null;
  injury_suspension_status_text: string | null;
  played_status: { status?: string; display?: string } | string | null;
}

export interface ImportProblem {
  line: number;
  player: string;
  team: string;
  kind: "unmatched" | "ambiguous" | "invalid" | "duplicate";
  reason: string;
  suggestions: string[];
}

export interface ImportResult {
  snapshot: AvailabilitySnapshot;
  problems: ImportProblem[];
  /** Every distinct SuperCoach value seen, with counts, by field. */
  superCoachValues: Record<string, Record<string, number>>;
  /** Players given a status from SuperCoach's fields (no list row). */
  fromSuperCoach: number;
  delimiter: string;
}

/**
 * The upcoming round at a date: the first round with a game on or after
 * it (Melbourne dates). After the last game: the round after the last.
 */
export function listRoundFor(
  asOf: string,
  fixtures: { round: number; kickoff: string }[],
): number {
  const melbourneDate = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne" }).format(new Date(iso));

  const upcoming = fixtures
    .filter((f) => melbourneDate(f.kickoff) >= asOf)
    .map((f) => f.round);

  return upcoming.length > 0
    ? Math.min(...upcoming)
    : Math.max(...fixtures.map((f) => f.round)) + 1;
}

const describe = (p: MatchablePlayer) => `${p.name} (${p.team}, ${p.positions.join("/")})`;

/**
 * Builds a snapshot from the weekly list text. Rows that can't be matched
 * (or are ambiguous, invalid or duplicated) are returned as problems and
 * left out. Players with no row fall back to SuperCoach's own fields:
 * known values are mapped (config), anything else is "unknown".
 */
export function importAvailabilityList({
  text,
  players,
  asOf,
  round,
  season,
  source,
  superCoach = [],
}: {
  text: string;
  players: readonly MatchablePlayer[];
  asOf: string;
  round: number;
  season: number;
  source: string;
  superCoach?: readonly SuperCoachStatus[];
}): ImportResult | { errors: string[] } {
  const parsed = parseAvailabilityTable(text);
  if (!parsed.ok) return { errors: parsed.errors };

  const problems: ImportProblem[] = [];
  const entries: Record<string, PlayerAvailability> = {};
  const lineFor = new Map<number, number>();

  for (const row of parsed.rows) {
    const base = { line: row.line, player: row.player, team: row.team };

    if (!row.player) {
      problems.push({ ...base, kind: "invalid", reason: "no player name", suggestions: [] });
      continue;
    }

    const selected = parseSelected(row.selected);
    if (selected === undefined) {
      problems.push({ ...base, kind: "invalid", reason: `selected "${row.selected}" isn't yes, no or blank`, suggestions: [] });
      continue;
    }

    if (row.status && !(AVAILABILITY_STATUSES as readonly string[]).includes(row.status.toLowerCase())) {
      problems.push({ ...base, kind: "invalid", reason: `status "${row.status}" isn't one of ${AVAILABILITY_STATUSES.join(", ")}`, suggestions: [] });
      continue;
    }

    const match = matchPlayer(players, row.player, row.team);
    if (match.kind === "unmatched") {
      problems.push({ ...base, kind: "unmatched", reason: match.reason, suggestions: match.suggestions.map(describe) });
      continue;
    }
    if (match.kind === "ambiguous") {
      problems.push({ ...base, kind: "ambiguous", reason: match.reason, suggestions: match.candidates.map(describe) });
      continue;
    }

    const id = match.player.id;
    if (lineFor.has(id)) {
      problems.push({ ...base, kind: "duplicate", reason: `${match.player.name} is also on line ${lineFor.get(id)}`, suggestions: [] });
      continue;
    }
    lineFor.set(id, row.line);

    const injury = row.injury || null;
    const returnText = row.return || null;
    const { status, returnWeeks } = classifyReturn({ injury, returnText, override: row.status || null });

    entries[String(id)] = {
      status,
      injury,
      returnText,
      returnWeeks,
      returnRound: returnRoundFor(status, returnWeeks, round),
      selected,
      asOf,
      source,
    };
  }

  // SuperCoach fallback, and a log of every value seen.
  const superCoachValues: Record<string, Record<string, number>> = {
    injury_suspension_status: {},
    injury_suspension_status_text: {},
    played_status: {},
  };
  const count = (field: string, value: unknown) => {
    const key = value === null || value === undefined ? "null" : typeof value === "string" ? value : JSON.stringify(value);
    superCoachValues[field][key] = (superCoachValues[field][key] ?? 0) + 1;
  };

  let fromSuperCoach = 0;
  const known = new Set(players.map((p) => p.id));

  for (const sc of superCoach) {
    count("injury_suspension_status", sc.injury_suspension_status);
    count("injury_suspension_status_text", sc.injury_suspension_status_text);
    count("played_status", sc.played_status);

    const raw = sc.injury_suspension_status ?? sc.injury_suspension_status_text;
    if (!raw || entries[String(sc.id)] || !known.has(sc.id)) continue;

    const status: AvailabilityStatus =
      SUPERCOACH_STATUS_MAP[(sc.injury_suspension_status ?? "").toLowerCase()] ?? "unknown";

    entries[String(sc.id)] = {
      status,
      injury: sc.injury_suspension_status_text ?? sc.injury_suspension_status,
      returnText: null,
      returnWeeks: null,
      returnRound: null,
      selected: null,
      asOf,
      source: SUPERCOACH_SOURCE,
    };
    fromSuperCoach++;
  }

  return {
    snapshot: { season, asOf, round, source, players: entries },
    problems,
    superCoachValues,
    fromSuperCoach,
    delimiter: parsed.delimiter,
  };
}

/** Players by status. */
export function summariseByStatus(snapshot: AvailabilitySnapshot): Record<AvailabilityStatus, number> {
  const summary = Object.fromEntries(AVAILABILITY_STATUSES.map((s) => [s, 0])) as Record<AvailabilityStatus, number>;
  for (const entry of Object.values(snapshot.players)) summary[entry.status]++;
  return summary;
}

export interface SnapshotDiff {
  added: string[];
  removed: string[];
  changed: { id: string; from: string; to: string }[];
}

/** What changed since the previous file, by player id. */
export function diffSnapshots(previous: AvailabilitySnapshot | null, next: AvailabilitySnapshot): SnapshotDiff {
  const before = previous?.players ?? {};
  const label = (e: PlayerAvailability) =>
    [e.status, e.returnText, e.selected === null ? null : e.selected ? "selected" : "not selected"]
      .filter(Boolean)
      .join(", ");

  return {
    added: Object.keys(next.players).filter((id) => !(id in before)),
    removed: Object.keys(before).filter((id) => !(id in next.players)),
    changed: Object.keys(next.players)
      .filter((id) => id in before && label(before[id]) !== label(next.players[id]))
      .map((id) => ({ id, from: label(before[id]), to: label(next.players[id]) })),
  };
}
