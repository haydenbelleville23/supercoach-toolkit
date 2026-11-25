import type { Position } from "@/lib/rules/squadRules";

import type { SlotArea, SlotPosition } from "./positionMatching";

/** A player in the saved squad, optionally pinned to a slot group. */
export interface SquadEntry {
  id: number;
  pin: { area: SlotArea; position: SlotPosition } | null;
}

/**
 * A "Rookie (TBC)" placeholder. Ids are negative so they never clash with
 * real player ids. No team means it plays every round (no bye).
 */
export interface RookiePlaceholder {
  id: number;
  position: Position;
  team: string | null;
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
  /** How many rounds the plan shows, from the next round (default 3). */
  roundCount?: number;
  /** Rounds whose card is collapsed (their data is kept). */
  collapsedRounds?: number[];
  /** Rounds whose field diagram is open. */
  openFields?: number[];
}

export interface MyTeam {
  version: 1;
  season: number;
  /** The completed round the squad and starting numbers belong to. */
  asOfRound: number;
  players: SquadEntry[];
  /** Rookie placeholders used in the squad or in plans. */
  placeholders?: RookiePlaceholder[];
  cashInBank: number;
  /** Season trade pool remaining at the starting point. */
  tradesRemaining: number;
  boostsRemaining: number;
  plans: TradePlan[];
  activePlanId: string | null;
  /** Trade Planner view (saved so it reopens the same way). */
  plannerView?: "plan" | "scores";
  updatedAt: string;
}

export const MAX_PLANS = 3;
