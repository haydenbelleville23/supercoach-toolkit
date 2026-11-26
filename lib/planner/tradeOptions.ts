import type { PlannedTrade } from "./types";

/**
 * Who a trade row's player-out list offers: the squad going into the
 * round (after earlier rounds' trades), minus players already picked as
 * out in the round's other rows. Rookie (TBC) placeholders in the squad
 * are included.
 */
export function tradeOutCandidates(
  squadBefore: readonly number[],
  trades: readonly PlannedTrade[],
  index: number,
): number[] {
  const takenElsewhere = new Set(
    trades.flatMap((t, i) => (i !== index && t.outId !== null ? [t.outId] : [])),
  );
  return squadBefore.filter((id) => !takenElsewhere.has(id));
}

/**
 * Who a trade row's player-in list leaves out: anyone in the squad going
 * into the round, and anyone already picked as in on the round's other
 * rows.
 */
export function tradeInExclusions(
  squadBefore: readonly number[],
  trades: readonly PlannedTrade[],
  index: number,
): Set<number> {
  const excluded = new Set(squadBefore);
  trades.forEach((t, i) => {
    if (i !== index && t.inId !== null) excluded.add(t.inId);
  });
  return excluded;
}
