/** A player's availability, as imported from a weekly list. */
export type AvailabilityStatus =
  | "available"
  | "test"
  | "short-term"
  | "long-term"
  | "suspended"
  | "unknown";

export const AVAILABILITY_STATUSES: readonly AvailabilityStatus[] = [
  "available",
  "test",
  "short-term",
  "long-term",
  "suspended",
  "unknown",
];

export interface PlayerAvailability {
  status: AvailabilityStatus;
  /** Injury or reason as published ("Hamstring", "Suspension"), if any. */
  injury: string | null;
  /** Estimated return as published ("1-2 weeks", "Season", "TBC"). */
  returnText: string | null;
  /** Weeks out (the upper end of a range), or null if not a number. */
  returnWeeks: number | null;
  /** First round he's expected back, or null if not known. */
  returnRound: number | null;
  /** Named in the team for the snapshot's round; null = not known. */
  selected: boolean | null;
  /** Date of the source (YYYY-MM-DD). */
  asOf: string;
  /** Where it came from (shown in the badge's details). */
  source: string;
}

/** data/{season}/availability.json, written only by the import script. */
export interface AvailabilitySnapshot {
  season: number;
  /** Date of the source (YYYY-MM-DD). */
  asOf: string;
  /** The upcoming round at `asOf`: the round the list applies to. */
  round: number;
  /** Source of the list (for credit). */
  source: string;
  /** True only for the invented debug sample. */
  sample?: boolean;
  /** By player id. A player not listed is available (not on the list). */
  players: Record<string, PlayerAvailability>;
}
