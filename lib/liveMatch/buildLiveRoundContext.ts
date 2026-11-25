import {
  applyScoresToContext,
  type ScoreUpdate,
} from "@/lib/priceEngine/applyScoresToContext";
import type { ScaledRoundContext } from "@/lib/priceEngine/estimateScaledRoundContexts";
import type { Player } from "@/types/player";

import type { DfsLiveFeed } from "./dfsAustralia";
import { getFixtureState } from "./fixtureStatus";
import type { LiveScoreOverrides } from "./types";

/**
 * Updates the round's k estimate with real scores as games finish.
 *
 * Only applies when every game in the feed is a scheduled game of `round`
 * (the feed has no round number, so a finals or stale feed is ignored).
 * Players in finished games use their final score (or an entered score);
 * players on those teams missing from the feed did not play. Entered scores
 * for players whose game is not finished are used too. Everyone else keeps
 * their season-average projection.
 */
export function buildLiveRoundContext({
  baseContext,
  round,
  feed,
  players,
  manualScores,
  isScheduledGame,
}: {
  baseContext: ScaledRoundContext;
  round: number;
  feed: DfsLiveFeed;
  players: Player[];
  manualScores: LiveScoreOverrides;
  isScheduledGame: (homeTeam: string, awayTeam: string, round: number) => boolean;
}): {
  context: ScaledRoundContext;
  liveScoresUsed: number;
  /** False when the feed's games are not this round's (finals, stale feed). */
  feedIsThisRound: boolean;
} {
  const feedIsThisRound =
    feed.fixtures.length > 0 &&
    feed.fixtures.every((fixture) =>
      isScheduledGame(fixture.homeTeam, fixture.awayTeam, round),
    );

  if (!feedIsThisRound) {
    return { context: baseContext, liveScoresUsed: 0, feedIsThisRound };
  }

  const finishedFixtureIds = new Set(
    feed.fixtures
      .filter((fixture) => getFixtureState(fixture) === "finished")
      .map((fixture) => fixture.id),
  );

  const finishedTeams = new Set(
    feed.fixtures
      .filter((fixture) => finishedFixtureIds.has(fixture.id))
      .flatMap((fixture) => [fixture.homeTeam, fixture.awayTeam]),
  );

  const finalScores = new Map<string, number>();

  for (const livePlayer of feed.players) {
    if (finishedFixtureIds.has(livePlayer.fixtureId)) {
      finalScores.set(livePlayer.championDataId, livePlayer.superCoachPoints);
    }
  }

  const updates: ScoreUpdate[] = [];

  for (const player of players) {
    if (!baseContext.contributions.has(player.id)) {
      continue;
    }

    const manual = manualScores[player.id];
    const finished = finishedTeams.has(player.team);

    let score: number | null | undefined;

    if (manual !== undefined) {
      score = manual;
    } else if (finished) {
      score =
        player.championDataId === null
          ? null
          : (finalScores.get(player.championDataId) ?? null);
    }

    if (score === undefined) {
      continue;
    }

    updates.push({
      playerId: player.id,
      oldPrice: player.price,
      previousScores: player.history
        .filter((h) => h.round < round && h.games > 0)
        .map((h) => h.score as number),
      score,
    });
  }

  return {
    context: applyScoresToContext(baseContext, updates),
    liveScoresUsed: updates.filter((u) => u.score !== null).length,
    feedIsThisRound,
  };
}
