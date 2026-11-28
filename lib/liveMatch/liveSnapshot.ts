/**
 * Manual live-feed snapshot (npm run live:snapshot): ONE request to the
 * DFS feed, the response body saved exactly as received (before the
 * normaliser), and a summary of every key and status value seen, so the
 * bench and status mapping can be based on real data.
 *
 * At most one request per 30 seconds: the time of the last request is
 * kept in a file next to the snapshots and written before the request,
 * so a failed request still counts. No loops, no retries, no scheduling,
 * and never part of the weekly update.
 *
 * Node only (fs); the app never imports this.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { DFS_LIVE_URL } from "./dfsLiveUrl";

export const SNAPSHOT_DIR = "scripts/output/live-snapshots";
export const SNAPSHOT_MIN_GAP_MS = 30_000;
export const LAST_REQUEST_FILE = ".last-request";

export type RateLimitCheck =
  | { ok: true }
  | { ok: false; waitSeconds: number };

/** Allowed only when the last request was 30 seconds or more ago. */
export function checkSnapshotRateLimit(
  lastRequestIso: string | null,
  now: Date,
): RateLimitCheck {
  if (!lastRequestIso) return { ok: true };
  const last = Date.parse(lastRequestIso.trim());
  if (!Number.isFinite(last)) return { ok: true };
  const elapsed = now.getTime() - last;
  // A last time in the future (clock change) also waits.
  if (elapsed >= SNAPSHOT_MIN_GAP_MS) return { ok: true };
  return {
    ok: false,
    waitSeconds: Math.ceil((SNAPSHOT_MIN_GAP_MS - Math.max(elapsed, 0)) / 1000),
  };
}

export type RawFeedSummary = {
  topLevelKeys: string[];
  fixtureKeys: string[];
  playerKeys: string[];
  fixtureCount: number;
  playerCount: number;
  /** Every distinct value, as JSON text (so 1, "1" and null stay apart). */
  onBenchValues: string[];
  benchReasonValues: string[];
  /** Top-level, per-game and per-player status values. */
  statusValues: { topLevel: string[]; fixture: string[]; player: string[] };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function keysOf(items: Record<string, unknown>[]): string[] {
  return [...new Set(items.flatMap((item) => Object.keys(item)))].sort();
}

function distinct(values: unknown[]): string[] {
  return [...new Set(values.map((value) => (value === undefined ? "(missing)" : JSON.stringify(value))))].sort();
}

/** Keys and values in a raw feed. Anything not shaped as expected is empty. */
export function summariseRawFeed(raw: unknown): RawFeedSummary {
  const top = isRecord(raw) ? raw : {};
  const fixtures = records(top.fixtures);
  const players = records(top.playerStats);
  const topStatus = top.status;

  return {
    topLevelKeys: Object.keys(top).sort(),
    fixtureKeys: keysOf(fixtures),
    playerKeys: keysOf(players),
    fixtureCount: fixtures.length,
    playerCount: players.length,
    onBenchValues: distinct(players.map((player) => player.onBench)),
    benchReasonValues: distinct(players.map((player) => player.benchReason)),
    statusValues: {
      topLevel: distinct(Array.isArray(topStatus) ? topStatus : topStatus === undefined ? [] : [topStatus]),
      fixture: distinct(fixtures.map((fixture) => fixture.status)),
      player: players.some((player) => "status" in player)
        ? distinct(players.map((player) => player.status))
        : [],
    },
  };
}

export function formatSummary(summary: RawFeedSummary): string {
  const list = (values: string[]) => (values.length ? values.join(", ") : "(none)");
  return [
    `Games: ${summary.fixtureCount}, player records: ${summary.playerCount}`,
    `Top-level keys: ${list(summary.topLevelKeys)}`,
    `Per-game keys: ${list(summary.fixtureKeys)}`,
    `Per-player keys: ${list(summary.playerKeys)}`,
    `onBench values: ${list(summary.onBenchValues)}`,
    `benchReason values: ${list(summary.benchReasonValues)}`,
    `status values (top level): ${list(summary.statusValues.topLevel)}`,
    `status values (per game): ${list(summary.statusValues.fixture)}`,
    `status values (per player): ${list(summary.statusValues.player)}`,
  ].join("\n");
}

export type SnapshotResult =
  | { ok: true; file: string; httpStatus: number; summary: RawFeedSummary | null; parseError: string | null }
  | { ok: false; reason: "rate-limited"; waitSeconds: number }
  | { ok: false; reason: "http-error"; httpStatus: number; file: string }
  | { ok: false; reason: "network-error"; message: string };

/** 2026-05-22T11-05-00-123Z: safe in file names. */
function stamp(now: Date): string {
  return now.toISOString().replace(/[:.]/g, "-");
}

/**
 * One request, at most. Writes <dir>/live-<timestamp>.json (the body as
 * received; .txt when it isn't JSON) and updates the last-request file.
 */
export async function saveLiveSnapshot({
  fetchImpl = fetch,
  now = () => new Date(),
  dir = SNAPSHOT_DIR,
  url = DFS_LIVE_URL,
}: {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  dir?: string;
  url?: string;
} = {}): Promise<SnapshotResult> {
  const lastFile = path.join(dir, LAST_REQUEST_FILE);
  const last = existsSync(lastFile) ? readFileSync(lastFile, "utf8") : null;
  const startedAt = now();
  const limit = checkSnapshotRateLimit(last, startedAt);
  if (!limit.ok) return { ok: false, reason: "rate-limited", waitSeconds: limit.waitSeconds };

  mkdirSync(dir, { recursive: true });
  // Before the request, so a failure still counts toward the limit.
  writeFileSync(lastFile, `${startedAt.toISOString()}\n`);

  let response: Response;
  let body: string;
  try {
    response = await fetchImpl(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    body = await response.text();
  } catch (error) {
    return { ok: false, reason: "network-error", message: error instanceof Error ? error.message : String(error) };
  }

  let parsed: unknown = undefined;
  let parseError: string | null = null;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }

  const file = path.join(dir, `live-${stamp(startedAt)}${parseError ? ".txt" : ".json"}`);
  // Exactly as received: the text body, unchanged.
  writeFileSync(file, body);

  if (!response.ok) return { ok: false, reason: "http-error", httpStatus: response.status, file };

  return {
    ok: true,
    file,
    httpStatus: response.status,
    summary: parseError ? null : summariseRawFeed(parsed),
    parseError,
  };
}
