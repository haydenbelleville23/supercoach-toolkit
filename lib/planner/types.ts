import type { SlotArea, SlotPosition } from "./positionMatching";

/** A player in the saved squad, optionally pinned to a slot group. */
export interface SquadEntry {
  id: number;
  pin: { area: SlotArea; position: SlotPosition } | null;
}

/** One trade: a player out and a player in (either may be unpicked yet). */
export interface PlannedTrade {
  outId: number | null;
  inId: number | null;
}

export interface PlanRound {
  trades: PlannedTrade[];
  boost: boolean;
}

export interface TradePlan {
  id: string;
  name: string;
  /** Keyed by round number. Rounds with no entry have no trades. */
  rounds: Record<number, PlanRound>;
  /** Custom projected scores: playerId -> round -> score. */
  scoreOverrides: Record<number, Record<number, number>>;
}

export interface MyTeam {
  version: 1;
  season: number;
  /** The completed round the squad and starting numbers belong to. */
  asOfRound: number;
  players: SquadEntry[];
  cashInBank: number;
  /** Season trade pool remaining at the starting point. */
  tradesRemaining: number;
  boostsRemaining: number;
  plans: TradePlan[];
  activePlanId: string | null;
  updatedAt: string;
}

export const MAX_PLANS = 3;
