import { STALE_AFTER_DAYS, SUPERCOACH_SOURCE } from "./config";
import type { AvailabilitySnapshot, PlayerAvailability } from "./types";

/** What applies to a player in one round. */
export interface RoundAvailability extends PlayerAvailability {
  /** The round this answer is for. */
  round: number;
  /** True for the invented debug sample. */
  sample: boolean;
}

/** The minimum a selector needs from a player. */
export interface AvailabilityPlayer {
  id: number;
  /** SuperCoach's own status text (fallback when the list has no row). */
  availability?: string | null;
}

/**
 * The availability that applies to a player in a round, or null when
 * nothing is known (no list loaded and no SuperCoach status).
 *
 * - On the list with a return round: available from that round on.
 * - Long-term with no return round: out for every round from the list on.
 * - Not on a loaded list: available ("not on the injury list").
 * - "selected" only applies to the list's own round.
 * - No list but SuperCoach has status text: "unknown" with that text.
 */
export function getAvailability(
  player: AvailabilityPlayer,
  round: number,
  snapshot: AvailabilitySnapshot | null,
): RoundAvailability | null {
  const sample = snapshot?.sample === true;

  if (snapshot) {
    const entry = snapshot.players[String(player.id)];
    const base: RoundAvailability = entry
      ? { ...entry, round, sample }
      : {
          status: "available",
          injury: null,
          returnText: null,
          returnWeeks: null,
          returnRound: null,
          selected: null,
          asOf: snapshot.asOf,
          source: snapshot.source,
          round,
          sample,
        };

    const selected = round === snapshot.round ? base.selected : null;

    if (base.returnRound !== null && round >= base.returnRound) {
      return { ...base, status: "available", selected };
    }

    return { ...base, selected };
  }

  if (player.availability) {
    return {
      status: "unknown",
      injury: player.availability,
      returnText: null,
      returnWeeks: null,
      returnRound: null,
      selected: null,
      asOf: "",
      source: SUPERCOACH_SOURCE,
      round,
      sample: false,
    };
  }

  return null;
}

/**
 * Whether to count a player as playing in a round: false for long-term
 * and suspended (until their return round), true otherwise, including
 * test, short-term, unknown and when nothing is known.
 */
export function isLikelyPlaying(
  player: AvailabilityPlayer,
  round: number,
  snapshot: AvailabilitySnapshot | null,
): boolean {
  const status = getAvailability(player, round, snapshot)?.status;
  return status !== "long-term" && status !== "suspended";
}

/**
 * Older than STALE_AFTER_DAYS days at `today`. Entries with no date
 * (SuperCoach fallback) and the debug sample are never stale.
 */
export function isStale(
  availability: Pick<RoundAvailability, "asOf"> & { sample?: boolean },
  today: Date,
): boolean {
  if (availability.sample || !availability.asOf) return false;

  const asOf = Date.parse(`${availability.asOf}T00:00:00Z`);
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return (now - asOf) / 86_400_000 > STALE_AFTER_DAYS;
}

/** True when the loaded list has any selection data ("selected" set). */
export function hasSelectionData(snapshot: AvailabilitySnapshot | null): boolean {
  return !!snapshot && Object.values(snapshot.players).some((p) => p.selected !== null);
}
