import { describe, expect, it, vi } from "vitest";

// These tests need a round still to come, so they run "as of Round 18"
// (the DEBUG_AS_OF_ROUND lock) whatever the latest data is.
vi.hoisted(() => {
  vi.stubEnv("DEBUG_AS_OF_ROUND", "18");
});

import { CURRENT_COMPLETED_ROUND } from "@/data/season";
import { getFixtures } from "@/lib/fixtures";
import { buildLiveRoundContext } from "@/lib/liveMatch/buildLiveRoundContext";
import type { DfsLiveFeed, DfsLiveFixture } from "@/lib/liveMatch/dfsAustralia";
import { getFixtureState } from "@/lib/liveMatch/fixtureStatus";
import { getPlayers } from "@/lib/players";
import { getScaledRoundContexts } from "@/lib/projector/getScaledRoundContexts";

const ROUND = CURRENT_COMPLETED_ROUND + 1;
const players = getPlayers();
const baseContext = getScaledRoundContexts().get(ROUND)!;

const isScheduledGame = (home: string, away: string, round: number) =>
  getFixtures().some(
    (f) => f.round === round && f.homeTeam === home && f.awayTeam === away,
  );

function fixture(
  homeTeam: string,
  awayTeam: string,
  status: string,
  progress: number,
): DfsLiveFixture {
  return {
    id: 1,
    providerId: "",
    status,
    homeTeam,
    awayTeam,
    homeScore: 80,
    awayScore: 70,
    venue: "",
    progress,
    timeRemaining: "",
  };
}

function feedFor(game: DfsLiveFixture, points: number): DfsLiveFeed {
  return {
    updatedAt: null,
    status: "LIVE",
    fixtures: [game],
    players: players
      .filter(
        (p) =>
          (p.team === game.homeTeam || p.team === game.awayTeam) &&
          p.championDataId !== null &&
          p.history.some((h) => h.round === CURRENT_COMPLETED_ROUND && h.games > 0),
      )
      .map((p) => ({
        championDataId: p.championDataId as string,
        fixtureId: game.id,
        playerName: p.name,
        team: p.team,
        homeAway: p.team === game.homeTeam ? "home" : "away",
        superCoachPoints: points,
        dreamTeamPoints: 0,
        quarterScores: { q1: 0, q2: 0, q3: 0, q4: 0 },
        timeOnGroundPercentage: 80,
        position: "",
        jumperNumber: 1,
        benchReason: null,
        onBench: false,
      })),
  };
}

const roundGame = getFixtures().find((f) => f.round === ROUND)!;

describe("getFixtureState", () => {
  it("treats POSTGAME and full progress as finished", () => {
    expect(getFixtureState(fixture("A", "B", "POSTGAME", 100))).toBe("finished");
    expect(getFixtureState(fixture("A", "B", "CONCLUDED", 100))).toBe("finished");
    expect(getFixtureState(fixture("A", "B", "LIVE", 40))).toBe("live");
    expect(getFixtureState(fixture("A", "B", "SCHEDULED", 0))).toBe("upcoming");
  });
});

describe("buildLiveRoundContext", () => {
  it("ignores a feed whose games are not in this round", () => {
    const game = fixture("FRE", "BRL", "POSTGAME", 100);
    expect(isScheduledGame("FRE", "BRL", ROUND)).toBe(false);

    const result = buildLiveRoundContext({
      baseContext,
      round: ROUND,
      feed: feedFor(game, 150),
      players,
      manualScores: {},
      isScheduledGame,
    });

    expect(result.context).toBe(baseContext);
    expect(result.liveScoresUsed).toBe(0);
  });

  it("lowers k when a finished game's players outscore their averages", () => {
    const game = fixture(roundGame.homeTeam, roundGame.awayTeam, "POSTGAME", 100);

    const result = buildLiveRoundContext({
      baseContext,
      round: ROUND,
      feed: feedFor(game, 150),
      players,
      manualScores: {},
      isScheduledGame,
    });

    expect(result.liveScoresUsed).toBeGreaterThan(20);
    expect(result.context.k).toBeLessThan(baseContext.k);
  });

  it("leaves k alone while that game is still live", () => {
    const game = fixture(roundGame.homeTeam, roundGame.awayTeam, "LIVE", 50);

    const result = buildLiveRoundContext({
      baseContext,
      round: ROUND,
      feed: feedFor(game, 150),
      players,
      manualScores: {},
      isScheduledGame,
    });

    expect(result.liveScoresUsed).toBe(0);
    expect(result.context.k).toBe(baseContext.k);
  });
});
