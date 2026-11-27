import type { Player } from "../../types/player";
import { trimFixturesToRound, trimPlayersToRound } from "../asOf/trimToRound";

type RawFixtureFile = Parameters<typeof trimFixturesToRound>[0];

/**
 * Breakevens as the site showed them straight after each round: the
 * players and fixtures trimmed to that round (exactly what
 * DEBUG_AS_OF_ROUND does), then the scaled engine's breakeven for the
 * next round. No later data is used, so nothing leaks under the lock.
 *
 * after(r) = each player's breakeven for round r + 1, by id; null when he
 * has fewer than two scores (his price can't change yet) or no price.
 * A round's "BE" is after(r - 1); its "Next BE" is after(r).
 */
export function createBreakevenLookup(players: Player[], fixtures: RawFixtureFile) {
  const cache = new Map<number, Map<number, number | null>>();

  function after(round: number): Map<number, number | null> {
    const cached = cache.get(round);
    if (cached) return cached;

    const result = new Map<number, number | null>();
    if (round >= 0) {
      const trimmed = trimPlayersToRound(players, trimFixturesToRound(fixtures, round), round);
      for (const player of trimmed) {
        const scores = player.history.filter((h) => h.games > 0 && h.round <= round).length;
        result.set(player.id, scores >= 2 ? player.breakeven : null);
      }
    }

    cache.set(round, result);
    return result;
  }

  return {
    /** Breakeven going into the round. */
    before: (round: number, playerId: number) => after(round - 1).get(playerId) ?? null,
    /** Breakeven for the following round, after this one. */
    next: (round: number, playerId: number) => after(round).get(playerId) ?? null,
  };
}
