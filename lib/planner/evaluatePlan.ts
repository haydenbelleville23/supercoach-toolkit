import {
  getByeTeams,
  getEligiblePositions,
  getRoundTradeLimit,
  SQUAD_RULES,
} from "@/lib/rules/squadRules";
import type { Player } from "@/types/player";

import {
  checkOnFieldPlaying,
  checkSquadPositions,
  type MatchPlayer,
  type Slot,
} from "./positionMatching";
import type { PlannerFixture, PriceProjector } from "./pricePaths";
import type { MyTeam, PlannedTrade, TradePlan } from "./types";

export interface TradeLine extends PlannedTrade {
  outPrice: number | null;
  inPrice: number | null;
}

export interface RoundSummary {
  round: number;
  boost: boolean;
  trades: TradeLine[];
  tradesUsed: number;
  tradeLimit: number;
  cashBefore: number;
  outTotal: number;
  inTotal: number;
  cashAfter: number;
  tradesLeftBefore: number;
  tradesLeftAfter: number;
  boostsLeftBefore: number;
  boostsLeftAfter: number;
  /** Squad after this round's trades. */
  squad: number[];
  /** Squad value at this round's prices, after trades. */
  squadValue: number;
  warnings: string[];
  byeTeams: string[];
  onBye: number;
  playing: number;
  onFieldPlaying: number;
  onFieldNeeded: number;
  /** Slot for each squad player after trades (stable between rounds). */
  assignment: Map<number, Slot>;
  /** Players traded in / out this round. */
  tradedIn: number[];
  tradedOut: number[];
  /** Squad players whose team has a bye this round. */
  byePlayerIds: number[];
}

/**
 * Whether another trade can be added to a round, and if not, why.
 * Trades already planned are never removed; this only gates new ones.
 */
export function getAddTradeState(summary: RoundSummary): {
  disabled: boolean;
  reason: string | null;
} {
  // Rows on screen (including ones with no players picked yet).
  const rows = Math.max(summary.trades.length, summary.tradesUsed);

  if (summary.tradesLeftBefore - rows <= 0) {
    return { disabled: true, reason: "No trades left in the season pool" };
  }

  if (rows >= summary.tradeLimit) {
    if (!summary.boost && summary.boostsLeftBefore > 0) {
      return {
        disabled: true,
        reason: `Round limit (${summary.tradeLimit}) reached: use a boost for one more`,
      };
    }

    return {
      disabled: true,
      reason: summary.boost || summary.boostsLeftBefore > 0
        ? `Round limit (${summary.tradeLimit}) reached`
        : `Round limit (${summary.tradeLimit}) reached and no boosts left`,
    };
  }

  return { disabled: false, reason: null };
}

export function toMatchPlayer(
  player: Player,
  pin: MatchPlayer["pin"] = null,
  /** Price used to field the most expensive players (default: current). */
  price: number = player.price,
): MatchPlayer {
  return {
    id: player.id,
    name: player.name,
    eligible: getEligiblePositions(player.positions),
    pin,
    price,
  };
}

/**
 * Walks a plan round by round, carrying cash, the season trade pool,
 * boosts and the squad forward:
 *
 *   cash after   = cash before + sum(out prices) - sum(in prices)
 *   trades left  = trades left before - trades made this round
 *   boosts left  = boosts left before - (1 if boosted)
 *
 * Every trade (including the extra one a boost allows) uses one from the
 * pool. Trades use prices before the round's games (after round - 1).
 * Problems are reported as warnings and never block.
 */
export function evaluatePlan({
  team,
  plan,
  playersById,
  projector,
  fixtures,
  lastRound = projector.lastRound,
}: {
  team: MyTeam;
  plan: TradePlan | null;
  playersById: Map<number, Player>;
  projector: PriceProjector;
  fixtures: PlannerFixture[];
  /** Last round to evaluate (the plan's shown rounds). */
  lastRound?: number;
}): RoundSummary[] {
  const summaries: RoundSummary[] = [];
  const pins = new Map(team.players.map((p) => [p.id, p.pin]));

  let squad = team.players.map((p) => p.id);
  let cash = team.cashInBank;
  let tradesLeft = team.tradesRemaining;
  let boostsLeft = team.boostsRemaining;
  let previousSlots = new Map<number, string>();

  const name = (id: number) => playersById.get(id)?.name ?? `Player ${id}`;

  for (
    let round = projector.firstRound;
    round <= Math.min(lastRound, projector.lastRound);
    round++
  ) {
    const planRound = plan?.rounds[round];
    const boost = planRound?.boost ?? false;

    const warnings: string[] = [];
    const before = new Set(squad);

    // One line per trade row (rows with no players picked yet included,
    // so lines stay aligned with the rows on screen).
    const trades: TradeLine[] = (planRound?.trades ?? []).map((t) => ({
      ...t,
      outPrice: t.outId === null ? null : projector.getPriceBefore(t.outId, round),
      inPrice: t.inId === null ? null : projector.getPriceBefore(t.inId, round),
    }));
    const filled = trades.filter((t) => t.outId !== null || t.inId !== null);

    const outTotal = trades.reduce((sum, t) => sum + (t.outPrice ?? 0), 0);
    const inTotal = trades.reduce((sum, t) => sum + (t.inPrice ?? 0), 0);
    const tradeLimit = getRoundTradeLimit(round, boost, fixtures);
    const tradesUsed = filled.length;

    const cashBefore = cash;
    const tradesLeftBefore = tradesLeft;
    const boostsLeftBefore = boostsLeft;

    cash = cash + outTotal - inTotal;
    tradesLeft -= tradesUsed;
    boostsLeft -= boost ? 1 : 0;

    // Squad changes and trade checks.
    const outs = new Set<number>();
    const ins = new Set<number>();

    trades.forEach((t, index) => {
      const label = `Trade ${index + 1}`;

      if (t.outId === null && t.inId === null) {
        return; // empty row, not a trade yet
      }

      if (t.outId === null || t.inId === null) {
        warnings.push(`${label} is missing a player ${t.outId === null ? "out" : "in"}.`);
      }

      if (t.outId !== null) {
        if (!before.has(t.outId)) {
          warnings.push(`${label}: ${name(t.outId)} is traded out but isn't in the squad.`);
        } else if (outs.has(t.outId)) {
          warnings.push(`${label}: ${name(t.outId)} is traded out twice.`);
        }
        outs.add(t.outId);
      }

      if (t.inId !== null) {
        if (before.has(t.inId) && !outs.has(t.inId)) {
          warnings.push(`${label}: ${name(t.inId)} is traded in but is already in the squad.`);
        } else if (ins.has(t.inId)) {
          warnings.push(`${label}: ${name(t.inId)} is traded in twice.`);
        }
        ins.add(t.inId);
      }

      if (t.inId !== null && t.inPrice === null) {
        warnings.push(`${label}: no price for ${name(t.inId)} this round.`);
      }
    });

    squad = [...squad.filter((id) => !outs.has(id)), ...[...ins].filter((id) => !before.has(id) || outs.has(id))];
    squad = [...new Set(squad)];

    if (tradesUsed > tradeLimit) {
      warnings.push(`${tradesUsed} trades planned; this round allows ${tradeLimit}.`);
    }
    if (tradesLeft < 0) {
      warnings.push(`The season trade pool is used up (${tradesLeft} left).`);
    }
    if (boost && boostsLeftBefore <= 0) {
      warnings.push("A boost is used but none are left.");
    }
    if (cash < 0) {
      warnings.push(`Cash in bank is below zero ($${Math.round(cash).toLocaleString("en-AU")}).`);
    }

    const squadPlayers = squad
      .map((id) => playersById.get(id))
      .filter((p): p is Player => p !== undefined);

    // Fielded by this round's prices, most expensive on the field.
    const match = checkSquadPositions(
      squadPlayers.map((p) =>
        toMatchPlayer(
          p,
          ins.has(p.id) ? null : pins.get(p.id) ?? null,
          projector.getPriceBefore(p.id, round) ?? p.price,
        ),
      ),
      previousSlots,
    );
    previousSlots = new Map(
      [...match.assignment].map(([id, slot]) => [id, slot.id]),
    );

    if (squad.length !== SQUAD_RULES.squadSize) {
      warnings.push(`The squad has ${squad.length} players; it needs ${SQUAD_RULES.squadSize}.`);
    }
    warnings.push(
      ...match.problems.filter((problem) => !problem.startsWith("The squad has")),
    );

    // Bye view.
    const byeTeams = getByeTeams(round, fixtures);
    const playingPlayers = squadPlayers.filter((p) => !byeTeams.includes(p.team));
    const onFieldPlaying = squadPlayers.filter(
      (p) => !byeTeams.includes(p.team) && match.assignment.get(p.id)?.area === "field",
    ).length;
    const fieldCheck = checkOnFieldPlaying(playingPlayers.map((p) => toMatchPlayer(p)));

    warnings.push(...fieldCheck.problems.map((p) => `Byes: ${p}`));

    summaries.push({
      round,
      boost,
      trades,
      tradesUsed,
      tradeLimit,
      cashBefore,
      outTotal,
      inTotal,
      cashAfter: cash,
      tradesLeftBefore,
      tradesLeftAfter: tradesLeft,
      boostsLeftBefore,
      boostsLeftAfter: boostsLeft,
      squad,
      squadValue: squad.reduce(
        (sum, id) => sum + (projector.getPriceBefore(id, round) ?? 0),
        0,
      ),
      warnings,
      byeTeams,
      onBye: squadPlayers.length - playingPlayers.length,
      playing: playingPlayers.length,
      onFieldPlaying,
      onFieldNeeded: fieldCheck.needed,
      assignment: match.assignment,
      tradedIn: [...ins].filter((id) => squad.includes(id)),
      tradedOut: [...outs].filter((id) => before.has(id)),
      byePlayerIds: squadPlayers
        .filter((p) => byeTeams.includes(p.team))
        .map((p) => p.id),
    });
  }

  return summaries;
}
