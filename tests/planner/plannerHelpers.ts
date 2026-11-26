import { CURRENT_COMPLETED_ROUND, FINAL_ROUND } from "@/data/season";
import { getFixtures } from "@/lib/fixtures";
import { evaluatePlan } from "@/lib/planner/evaluatePlan";
import { placeholderToPlayer, withPlaceholders } from "@/lib/planner/placeholders";
import { createPriceProjector } from "@/lib/planner/pricePaths";
import { createEmptyTeam } from "@/lib/planner/teamFile";
import type { MyTeam, TradePlan } from "@/lib/planner/types";
import { getScaledRoundContexts } from "@/lib/projector/getScaledRoundContexts";
import { playerRepository } from "@/lib/repository/PlayerRepository";

import type { Player } from "@/types/player";

/** Shared setup for planner tests (call after the DEBUG_AS_OF_ROUND stub). */
export function plannerSetup() {
  const fixtures = getFixtures();
  const players = playerRepository.getAll();
  const realById = new Map(players.map((p) => [p.id, p]));

  /** The most expensive single-position players: 8 DEF, 12 MID, 3 RUC, 8 FWD. */
  function buildSquad(counts = { DEF: 8, MID: 12, RUC: 3, FWD: 8 }): Player[] {
    const squad: Player[] = [];

    for (const [position, count] of Object.entries(counts)) {
      squad.push(
        ...players
          .filter((p) => p.positions.length === 1 && p.positions[0] === position)
          .sort((a, b) => b.price - a.price)
          .slice(0, count),
      );
    }

    return squad;
  }

  function makeTeam(squad: { id: number }[], extra: Partial<MyTeam> = {}): MyTeam {
    return {
      ...createEmptyTeam(2026, CURRENT_COMPLETED_ROUND),
      players: squad.map((p) => ({ id: p.id, pin: null })),
      cashInBank: 500_000,
      tradesRemaining: 20,
      boostsRemaining: 5,
      ...extra,
    };
  }

  function run(
    team: MyTeam,
    plan: TradePlan,
    lastRound = FINAL_ROUND,
    isOut?: (playerId: number, round: number) => boolean,
  ) {
    const projector = createPriceProjector({
      players,
      contexts: getScaledRoundContexts(),
      fixtures,
      completedRound: CURRENT_COMPLETED_ROUND,
      lastRound: FINAL_ROUND,
      scoreOverrides: plan.scoreOverrides,
      placeholders: new Map(
        (team.placeholders ?? []).map((p) => [p.id, placeholderToPlayer(p)]),
      ),
    });

    const playersById = withPlaceholders(realById, team);

    return {
      projector,
      playersById,
      rounds: evaluatePlan({ team, plan, playersById, projector, fixtures, lastRound, isOut }),
    };
  }

  return { fixtures, players, realById, buildSquad, makeTeam, run };
}
