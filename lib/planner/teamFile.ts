import { TRADE_RULES } from "@/lib/rules/squadRules";

import {
  MAX_PLANS,
  type MyTeam,
  type RookiePlaceholder,
  type TradePlan,
} from "./types";

export function createEmptyTeam(season: number, asOfRound: number): MyTeam {
  return {
    version: 1,
    season,
    asOfRound,
    players: [],
    cashInBank: 0,
    tradesRemaining: 0,
    boostsRemaining: TRADE_RULES.boostsPerSeason,
    plans: [],
    activePlanId: null,
    updatedAt: new Date().toISOString(),
  };
}

export function createPlan(name: string): TradePlan {
  return {
    id: `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    rounds: {},
    scoreOverrides: {},
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * Checks a parsed team file (from localStorage or an imported JSON file).
 * Returns the team, or a plain-language reason it was rejected.
 */
export function parseTeamFile(value: unknown): MyTeam | string {
  if (!isRecord(value) || value.version !== 1) {
    return "This isn't a Footynomics team file (version 1).";
  }

  const players = value.players;

  if (
    !Array.isArray(players) ||
    !players.every((p) => isRecord(p) && isNumber(p.id))
  ) {
    return "The team file's player list is missing or malformed.";
  }

  for (const field of ["season", "asOfRound", "cashInBank", "tradesRemaining", "boostsRemaining"]) {
    if (!isNumber(value[field])) {
      return `The team file's "${field}" is missing or not a number.`;
    }
  }

  const plans = Array.isArray(value.plans) ? value.plans : [];

  if (
    plans.length > MAX_PLANS ||
    !plans.every(
      (plan) =>
        isRecord(plan) &&
        typeof plan.id === "string" &&
        typeof plan.name === "string" &&
        isRecord(plan.rounds) &&
        isRecord(plan.scoreOverrides),
    )
  ) {
    return `The team file's plans are malformed (at most ${MAX_PLANS}).`;
  }

  return {
    ...(value as unknown as MyTeam),
    players: players.map((p) => ({
      id: (p as { id: number }).id,
      pin: isRecord((p as { pin?: unknown }).pin)
        ? ((p as { pin: MyTeam["players"][number]["pin"] }).pin)
        : null,
    })),
    plans: plans as TradePlan[],
    activePlanId:
      typeof value.activePlanId === "string" ? value.activePlanId : null,
    placeholders: Array.isArray(value.placeholders)
      ? (value.placeholders as unknown[]).filter(
          (p): p is RookiePlaceholder =>
            isRecord(p) &&
            isNumber(p.id) &&
            p.id < 0 &&
            typeof p.position === "string" &&
            (p.team === null || typeof p.team === "string"),
        )
      : [],
    plannerView: value.plannerView === "scores" ? "scores" : "plan",
  };
}
