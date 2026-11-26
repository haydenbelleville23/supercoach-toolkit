import { availabilitySnapshot } from "./snapshot";
import {
  getAvailability,
  hasSelectionData,
  isLikelyPlaying,
  type AvailabilityPlayer,
  type RoundAvailability,
} from "./selectors";

export { availabilitySnapshot };
export type { RoundAvailability };

/** The loaded list's availability for a player in a round (null = nothing known). */
export function availabilityFor(player: AvailabilityPlayer, round: number): RoundAvailability | null {
  return getAvailability(player, round, availabilitySnapshot);
}

/** isLikelyPlaying against the loaded list. */
export function likelyPlaying(player: AvailabilityPlayer, round: number): boolean {
  return isLikelyPlaying(player, round, availabilitySnapshot);
}

/** Whether the loaded list says who is selected. */
export const selectionDataLoaded = hasSelectionData(availabilitySnapshot);
