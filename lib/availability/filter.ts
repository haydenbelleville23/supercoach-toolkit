import { getAvailability, isLikelyPlaying, type AvailabilityPlayer } from "./selectors";
import type { AvailabilitySnapshot } from "./types";

export type AvailabilityFilter = "all" | "available" | "selected";

/**
 * Cash Cows status filter for a round:
 * - all: everyone.
 * - available: leaves out long-term injured and suspended (everyone when
 *   no list is loaded).
 * - selected: only players named for the round (selected === true).
 */
export function matchesAvailabilityFilter(
  player: AvailabilityPlayer,
  filter: AvailabilityFilter,
  round: number,
  snapshot: AvailabilitySnapshot | null,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "available":
      return isLikelyPlaying(player, round, snapshot);
    case "selected":
      return getAvailability(player, round, snapshot)?.selected === true;
  }
}
