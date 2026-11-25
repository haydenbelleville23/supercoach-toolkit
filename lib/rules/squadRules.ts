/**
 * Squad and trade rules for My Team and the Trade Planner. Change the
 * numbers here; everything else reads from this file.
 */

export type Position = "DEF" | "MID" | "RUC" | "FWD";

export const POSITIONS: Position[] = ["DEF", "MID", "RUC", "FWD"];

export const SQUAD_RULES = {
  squadSize: 31,

  /** On-field slots (23), including one FLEX that takes any position. */
  onField: { DEF: 6, MID: 8, RUC: 2, FWD: 6 } as Record<Position, number>,
  onFieldFlex: 1,

  /** Bench slots (8). The bench has no flex. */
  bench: { DEF: 2, MID: 3, RUC: 1, FWD: 2 } as Record<Position, number>,
};

export const TRADE_RULES = {
  /** Trades allowed in a normal round. */
  tradesPerRound: 2,
  /** Trades allowed in a bye round (see isByeRound). */
  tradesPerByeRound: 3,
  /** Boosts per season. */
  boostsPerSeason: 5,
  /** Extra trades a boost adds to the round it is used in. */
  tradesPerBoost: 1,
  /** At most this many boosts in one round (assumption). */
  maxBoostsPerRound: 1,
};

/** Placeholder rookie ("Rookie (TBC)") for players not yet known. */
export const ROOKIE_PLACEHOLDER = {
  /** Bought and sold at this fixed price; no score projection. */
  price: 99_100,
};

/** Rounds shown when a plan is first created. */
export const PLAN_START_ROUNDS = 3;

export interface RuleFixture {
  round: number;
  homeTeam: string;
  awayTeam: string;
}

/** Every team that appears in the season's fixtures. */
export function getSeasonTeams(fixtures: RuleFixture[]): Set<string> {
  return new Set(fixtures.flatMap((f) => [f.homeTeam, f.awayTeam]));
}

/** Teams with no fixture in the round. */
export function getByeTeams(
  round: number,
  fixtures: RuleFixture[],
): string[] {
  const playing = new Set(
    fixtures
      .filter((f) => f.round === round)
      .flatMap((f) => [f.homeTeam, f.awayTeam]),
  );

  return [...getSeasonTeams(fixtures)]
    .filter((team) => !playing.has(team))
    .sort();
}

/** A bye round is any round in which at least one team has no fixture. */
export function isByeRound(round: number, fixtures: RuleFixture[]): boolean {
  return getByeTeams(round, fixtures).length > 0;
}

/**
 * A round's trade limit: 2, or 3 in a bye round, plus 1 if a boost is used.
 * Trading fewer than the limit is always allowed.
 */
export function getRoundTradeLimit(
  round: number,
  boosted: boolean,
  fixtures: RuleFixture[],
): number {
  const base = isByeRound(round, fixtures)
    ? TRADE_RULES.tradesPerByeRound
    : TRADE_RULES.tradesPerRound;

  return base + (boosted ? TRADE_RULES.tradesPerBoost : 0);
}

/**
 * A player's eligible positions from the data's position list (e.g.
 * ["MID", "FWD"] for a dual-position player). Unknown values are ignored.
 */
export function getEligiblePositions(positions: string[]): Position[] {
  return POSITIONS.filter((position) => positions.includes(position));
}
