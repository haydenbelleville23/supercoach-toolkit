import { FINAL_ROUND, IS_PRESEASON, SEASON_YEAR } from "@/data/season";
import { FIXTURES_ARE_SAMPLE, getFixtures } from "@/lib/fixtures";
import { getSeasonTeams } from "@/lib/rules/squadRules";

import { POSITION_GROUPS, type PositionGroup } from "./config";
import {
  currentPositionDifficulty,
  currentTeamDifficulty,
  DIFFICULTY_AS_OF_ROUND,
  DIFFICULTY_BASIS,
  type DifficultyBasis,
} from "./current";
import { buildFixtureRows, type FixtureRow } from "./fixtureDifficulty";
import type { DifficultyCell } from "./positionDifficulty";
import type { TeamDifficulty } from "./teamDifficulty";

export interface FixtureDifficultyData {
  season: number;
  preseason: boolean;
  /** Where the values come from (last season's data in a preseason). */
  basis: DifficultyBasis;
  /** The fixtures are the invented sample (DEBUG_SEASON only). */
  sampleFixtures: boolean;
  /** No fixtures for the season yet. */
  noFixtures: boolean;
  asOfRound: number;
  lastRound: number;
  /** Rounds with a fixture still to come. */
  hasFutureRounds: boolean;
  teams: string[];
  /** Position -> one row per team, every round of the season. */
  fixtures: Record<PositionGroup, FixtureRow[]>;
  /** Opponent team -> position -> cell. */
  positions: { team: string; cells: Partial<Record<PositionGroup, DifficultyCell>> }[];
  teamTotals: TeamDifficulty[];
}

/** Everything the page shows, from the as-of data (small: about 2,000 cells). */
export function getFixtureDifficultyData(): FixtureDifficultyData {
  const fixtures = getFixtures();
  const teams = [...getSeasonTeams(fixtures)].sort();
  const difficulty = currentPositionDifficulty();

  return {
    season: SEASON_YEAR,
    preseason: IS_PRESEASON,
    basis: DIFFICULTY_BASIS,
    sampleFixtures: FIXTURES_ARE_SAMPLE,
    noFixtures: fixtures.length === 0,
    asOfRound: DIFFICULTY_AS_OF_ROUND,
    lastRound: FINAL_ROUND,
    hasFutureRounds: fixtures.some((f) => f.round > DIFFICULTY_AS_OF_ROUND),
    teams,
    fixtures: Object.fromEntries(
      POSITION_GROUPS.map((position) => [
        position,
        buildFixtureRows({
          fixtures,
          difficulty,
          position,
          asOfRound: DIFFICULTY_AS_OF_ROUND,
          fromRound: 0,
          lastRound: FINAL_ROUND,
          teams,
        }),
      ]),
    ) as Record<PositionGroup, FixtureRow[]>,
    positions: teams.map((team) => ({ team, cells: difficulty.get(team) ?? {} })),
    teamTotals: currentTeamDifficulty(),
  };
}
