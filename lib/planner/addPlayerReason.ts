import { buildSlots, matchPlayersToSlots, type MatchPlayer } from "./positionMatching";

import { SQUAD_RULES } from "@/lib/rules/squadRules";

/**
 * Why a player can't be added to a squad, or null if he can. Used by My
 * Team's add-players search to show the reason on the row.
 *
 * "In squad", "Squad full", or "No DEF slot" (or "No MID/FWD slot" for a
 * dual-position player) when adding him would leave someone without a
 * valid slot, using the same maximum matching as the squad check.
 *
 * Returns a function so the matching runs only for rows on screen, and
 * caches each answer while the squad is unchanged.
 */
export function createAddPlayerReason(
  squad: readonly MatchPlayer[],
): (candidate: MatchPlayer) => string | null {
  const ids = new Set(squad.map((p) => p.id));
  const slots = buildSlots();
  const placedNow = matchPlayersToSlots([...squad], slots).size;
  const cache = new Map<number, string | null>();

  return (candidate) => {
    if (ids.has(candidate.id)) {
      return "In squad";
    }

    if (squad.length >= SQUAD_RULES.squadSize) {
      return "Squad full";
    }

    const cached = cache.get(candidate.id);
    if (cached !== undefined) {
      return cached;
    }

    const placedWith = matchPlayersToSlots([...squad, candidate], slots).size;
    const reason =
      placedWith > placedNow
        ? null
        : `No ${candidate.eligible.length > 0 ? candidate.eligible.join("/") : "position"} slot`;

    cache.set(candidate.id, reason);
    return reason;
  };
}
