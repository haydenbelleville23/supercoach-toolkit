import type { DfsLivePlayer } from "./dfsAustralia";

/**
 * A player's in-game status from the live feed (not weekly availability).
 *
 * The DFS feed only has `onBench` (1 = bench) and a free-text
 * `benchReason` whose values haven't been seen yet. So, for now:
 *
 * - onBench key missing: no status (no tag), never "on ground".
 * - onBench 1: "bench". A non-empty reason goes in the tooltip as text,
 *   never as the label. BENCH_REASON_STATUS can map a reason to a more
 *   specific status once real values are seen; it starts empty, so
 *   "bloodRule", "injured" and "ruledOut" are unused for now.
 * - onBench present and not 1, with no reason: "onGround".
 * - onBench not 1 but a reason given: "unknown" (logged once in
 *   development), since the two fields disagree.
 */
export type LiveStatus =
  | "onGround"
  | "bench"
  | "bloodRule"
  | "injured"
  | "ruledOut"
  | "unknown";

export type LiveStatusInfo = {
  status: LiveStatus;
  /** The feed's benchReason, trimmed, plain text, at most 40 characters. */
  reason: string | null;
};

export const MAX_REASON_LENGTH = 40;

/**
 * benchReason text (lower case) → status. Empty on purpose until real
 * values are seen in a snapshot (npm run live:snapshot).
 */
export const BENCH_REASON_STATUS: Readonly<Record<string, LiveStatus>> = {};

/** Trimmed, single-line, control characters removed, at most 40 characters. */
export function cleanBenchReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return cleaned.length > MAX_REASON_LENGTH
    ? `${cleaned.slice(0, MAX_REASON_LENGTH - 1).trimEnd()}…`
    : cleaned;
}

const loggedUnknown = new Set<string>();

function logUnknownOnce(detail: string) {
  if (process.env.NODE_ENV !== "development" || loggedUnknown.has(detail)) return;
  loggedUnknown.add(detail);
  console.warn(`[live status] Unrecognised live-feed value: ${detail}`);
}

/** For tests: forget which values were logged. */
export function resetLiveStatusLog() {
  loggedUnknown.clear();
}

export function mapLiveStatus(
  player: Pick<DfsLivePlayer, "onBench" | "onBenchKnown" | "benchReason">,
): LiveStatusInfo | null {
  if (!player.onBenchKnown) return null;

  const reason = cleanBenchReason(player.benchReason);

  if (player.onBench) {
    const mapped = reason ? BENCH_REASON_STATUS[reason.toLowerCase()] : undefined;
    return { status: mapped ?? "bench", reason };
  }

  if (reason) {
    logUnknownOnce(`benchReason "${reason}" while not on the bench`);
    return { status: "unknown", reason };
  }

  return { status: "onGround", reason: null };
}

/**
 * What the page shows. At full time BENCH is hidden (the last bench flag
 * says nothing once the game is over); other statuses stay. That's an
 * assumption, to be checked against the real feed in March.
 */
export function displayLiveStatus(
  info: LiveStatusInfo | null,
  finished: boolean,
): LiveStatusInfo | null {
  if (finished && info?.status === "bench") return null;
  return info;
}

export type LiveStatusFilter = "onGround" | "bench" | "off" | "all";

export const LIVE_STATUS_FILTERS: readonly { id: LiveStatusFilter; label: string }[] = [
  { id: "onGround", label: "On ground" },
  { id: "bench", label: "On bench" },
  { id: "off", label: "Off" },
  { id: "all", label: "All" },
];

const OFF: ReadonlySet<LiveStatus> = new Set(["bloodRule", "injured", "ruledOut"]);

/**
 * Whether a player belongs under a filter. No status counts as on the
 * ground (a missing field means no tag); "unknown" is only under All.
 */
export function matchesLiveFilter(
  info: LiveStatusInfo | null,
  filter: LiveStatusFilter,
): boolean {
  if (filter === "all") return true;
  const status = info?.status ?? "onGround";
  if (filter === "onGround") return status === "onGround";
  if (filter === "bench") return status === "bench";
  return OFF.has(status);
}

export function countByLiveFilter(
  infos: readonly (LiveStatusInfo | null)[],
): Record<LiveStatusFilter, number> {
  const counts: Record<LiveStatusFilter, number> = { onGround: 0, bench: 0, off: 0, all: 0 };
  for (const info of infos) {
    for (const { id } of LIVE_STATUS_FILTERS) {
      if (matchesLiveFilter(info, id)) counts[id] += 1;
    }
  }
  return counts;
}

/** Shown only when a player has something other than on ground or no status. */
export function hasLiveStatusDetail(infos: readonly (LiveStatusInfo | null)[]): boolean {
  return infos.some((info) => info !== null && info.status !== "onGround");
}

/** Dimmed rows: on the bench or off. Not "unknown" or no status. */
export function isOffGround(info: LiveStatusInfo | null): boolean {
  return info !== null && (info.status === "bench" || OFF.has(info.status));
}
