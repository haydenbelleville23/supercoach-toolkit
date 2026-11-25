import { ROOKIE_PLACEHOLDER, type Position } from "@/lib/rules/squadRules";
import type { Player } from "@/types/player";

import type { MyTeam, RookiePlaceholder } from "./types";

export const isPlaceholderId = (id: number) => id < 0;

/** Display name, e.g. "Rookie (TBC) MID #2". */
export function placeholderName(placeholder: RookiePlaceholder): string {
  return `Rookie (TBC) ${placeholder.position} #${-placeholder.id}`;
}

/**
 * A placeholder as a Player, so position matching, cash and squad value
 * treat it like anyone else: fixed price, one position, no history. An
 * empty team never matches a bye, so it plays every round.
 */
export function placeholderToPlayer(placeholder: RookiePlaceholder): Player {
  const name = placeholderName(placeholder);

  return {
    id: placeholder.id,
    championDataId: null,
    name,
    team: placeholder.team ?? "",
    teamName: placeholder.team ?? "No team",
    positions: [placeholder.position],
    price: ROOKIE_PLACEHOLDER.price,
    games: 0,
    average: 0,
    average3: 0,
    average5: 0,
    recentScores: [],
    history: [],
    breakeven: 0,
    projectedBreakEvens: [],
    projectedScore: 0,
    projectedScores: [],
    projectedPrices: [],
    projectedPriceChanges: [],
    ownership: 0,
    active: true,
    availability: null,
    upcomingFixtures: [],
  };
}

/** Real players plus the team's placeholders, by id. */
export function withPlaceholders(
  playersById: Map<number, Player>,
  team: MyTeam | null,
): Map<number, Player> {
  const merged = new Map(playersById);

  for (const placeholder of team?.placeholders ?? []) {
    merged.set(placeholder.id, placeholderToPlayer(placeholder));
  }

  return merged;
}

/** Adds a new placeholder to the team; returns the team and its id. */
export function addPlaceholder(
  team: MyTeam,
  position: Position,
  teamCode: string | null = null,
): { team: MyTeam; id: number } {
  const existing = team.placeholders ?? [];
  const id = Math.min(0, ...existing.map((p) => p.id)) - 1;

  return {
    id,
    team: {
      ...team,
      placeholders: [...existing, { id, position, team: teamCode }],
    },
  };
}
