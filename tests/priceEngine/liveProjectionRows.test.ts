import { describe, expect, it, vi } from "vitest";

// These tests need a round still to come, so they run "as of Round 18"
// (the DEBUG_AS_OF_ROUND lock) whatever the latest data is.
vi.hoisted(() => {
  vi.stubEnv("DEBUG_AS_OF_ROUND", "18");
});

import { CURRENT_COMPLETED_ROUND } from "@/data/season";
import { calculateCashCowRow } from "@/lib/cashcows/calculateCashCowRows";
import { getFixtures } from "@/lib/fixtures";
import { buildLiveRoundContext } from "@/lib/liveMatch/buildLiveRoundContext";
import type { DfsLiveFeed } from "@/lib/liveMatch/dfsAustralia";
import { getPlayers } from "@/lib/players";
import type { ScaledRoundContext } from "@/lib/priceEngine/estimateScaledRoundContexts";
import { buildPlayerRows } from "@/lib/projector/buildPlayerRows";
import { calculateScaledProjectionRows } from "@/lib/projector/calculateScaledProjectionRows";
import { getScaledRoundContexts } from "@/lib/projector/getScaledRoundContexts";

const ROUND = CURRENT_COMPLETED_ROUND + 1;
const players = getPlayers();
const baseContexts = getScaledRoundContexts();
const game = getFixtures().find((f) => f.round === ROUND)!;

/** A finished game where everyone in the last lineup scored `points`. */
function finishedGameFeed(points: number): DfsLiveFeed {
  return {
    updatedAt: null,
    status: "LIVE",
    fixtures: [
      {
        id: 1,
        providerId: "",
        status: "POSTGAME",
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homeScore: 90,
        awayScore: 80,
        venue: "",
        progress: 100,
        timeRemaining: "",
      },
    ],
    players: players
      .filter(
        (p) =>
          (p.team === game.homeTeam || p.team === game.awayTeam) &&
          p.championDataId !== null &&
          p.history.some(
            (h) => h.round === CURRENT_COMPLETED_ROUND && h.games > 0,
          ),
      )
      .map((p) => ({
        championDataId: p.championDataId as string,
        fixtureId: 1,
        playerName: p.name,
        team: p.team,
        homeAway: p.team === game.homeTeam ? "home" : "away",
        superCoachPoints: points,
        dreamTeamPoints: 0,
        quarterScores: { q1: 0, q2: 0, q3: 0, q4: 0 },
        timeOnGroundPercentage: 80,
        timeOnGroundKnown: true,
        position: "",
        jumperNumber: 1,
        benchReason: null,
        onBench: false,
        onBenchKnown: true,
      })),
  };
}

function liveContexts(points: number) {
  const result = buildLiveRoundContext({
    baseContext: baseContexts.get(ROUND)!,
    round: ROUND,
    feed: finishedGameFeed(points),
    players,
    manualScores: {},
    isScheduledGame: (home, away, round) =>
      getFixtures().some(
        (f) => f.round === round && f.homeTeam === home && f.awayTeam === away,
      ),
  });

  expect(result.feedIsThisRound).toBe(true);

  return new Map(baseContexts).set(ROUND, result.context);
}

// A player from another game, so only k (not their own score) changes.
const player = players.find(
  (p) =>
    p.team !== game.homeTeam &&
    p.team !== game.awayTeam &&
    p.history.filter((h) => h.games > 0).length >= 5,
)!;

function nextRoundPrice(contexts?: Map<number, ScaledRoundContext>) {
  const rows = buildPlayerRows(player, "projected").map((row) =>
    row.round === ROUND ? { ...row, score: 100, played: true } : row,
  );

  return calculateScaledProjectionRows(rows, player, contexts).find(
    (row) => row.round === ROUND,
  )!.price as number;
}

describe("live k in projection rows", () => {
  it("lowers other players' prices when a finished game scores high", () => {
    const base = nextRoundPrice();
    const high = nextRoundPrice(liveContexts(160));

    expect(liveContexts(160).get(ROUND)!.k).toBeLessThan(
      baseContexts.get(ROUND)!.k,
    );
    expect(high).toBeLessThan(base);
  });

  it("raises them when a finished game scores low", () => {
    expect(nextRoundPrice(liveContexts(20))).toBeGreaterThan(nextRoundPrice());
  });

  it("feeds the same live k into Cash Cows", () => {
    const base = calculateCashCowRow(player, "projected")!;
    const live = calculateCashCowRow(player, "projected", {}, liveContexts(160))!;

    expect(live.rise1).not.toBe(base.rise1);
  });
});
