import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { BASE_MAGIC_NUMBER_2026 } from "@/lib/priceEngine/baseMagicNumber";
import {
  calculateScaledBreakEven,
  calculateScaledPlayerPrice,
} from "@/lib/priceEngine/calculateScaledPlayerPrice";
import {
  estimateScaledRoundContexts,
  type ScaledRoundContext,
} from "@/lib/priceEngine/estimateScaledRoundContexts";
import { normaliseSuperCoachPlayer } from "@/lib/supercoach/normalisePlayer";

import type { Player } from "@/types/player";
import type { SuperCoachPlayer } from "@/types/supercoach";

let players: Player[] = [];
let teamHasGame: (team: string, round: number) => boolean;

beforeAll(() => {
  const raw = JSON.parse(
    readFileSync(path.resolve("data/2026/players-complete.json"), "utf8"),
  ) as SuperCoachPlayer[];

  players = raw.map((player) => normaliseSuperCoachPlayer(player));

  const fixtures = JSON.parse(
    readFileSync(path.resolve("data/2026/fixtures-raw.json"), "utf8"),
  ) as {
    rounds: {
      round: number;
      response: { team1: { abbrev: string }; team2: { abbrev: string } }[];
    }[];
  };

  const games = new Set(
    fixtures.rounds.flatMap((round) =>
      round.response.flatMap((game) => [
        `${round.round}:${game.team1.abbrev}`,
        `${round.round}:${game.team2.abbrev}`,
      ]),
    ),
  );

  teamHasGame = (team, round) => games.has(`${round}:${team}`);
}, 60_000);

function contextFor(firstRound: number, lastRound = firstRound) {
  return estimateScaledRoundContexts({
    players,
    firstRound,
    lastRound,
    baseMagicNumber: BASE_MAGIC_NUMBER_2026,
    teamHasGame,
  });
}

function playerRound(player: Player, round: number) {
  const previous = player.history.find((h) => h.round === round - 1);
  const current = player.history.find((h) => h.round === round);

  return {
    oldPrice: previous?.price ?? null,
    publishedPrice: current?.price ?? null,
    score: current && current.games > 0 ? current.score : null,
    previousScores: player.history
      .filter((h) => h.round < round && h.games > 0)
      .map((h) => h.score as number),
  };
}

describe("scaled projector on a completed round", () => {
  it.each([5, 12, 17])(
    "reproduces Round %i published prices from all real scores",
    (round) => {
      const context = contextFor(round).get(round) as ScaledRoundContext;

      let compared = 0;
      let totalError = 0;
      let maxError = 0;

      for (const player of players) {
        const data = playerRound(player, round);

        if (data.oldPrice === null || data.publishedPrice === null) {
          continue;
        }

        const result = calculateScaledPlayerPrice({
          context,
          playerId: player.id,
          oldPrice: data.oldPrice,
          previousScores: data.previousScores,
          score: data.score,
        });

        const error = Math.abs(result.price - data.publishedPrice);

        compared += 1;
        totalError += error;
        maxError = Math.max(maxError, error);
      }

      expect(compared).toBeGreaterThan(700);
      expect(maxError).toBeLessThanOrEqual(100);
      expect(totalError / compared).toBeLessThan(50);
    },
  );

  it("matches the backtest's Round 12 k", () => {
    const context = contextFor(12).get(12) as ScaledRoundContext;

    expect(context.k).toBeCloseTo(0.972694, 5);
  });
});

describe("scaled breakevens", () => {
  function checkRoundTrip(context: ScaledRoundContext, round: number) {
    let checked = 0;

    for (const player of players.slice(0, 400)) {
      const data = playerRound(player, round);
      const oldPrice =
        data.oldPrice ?? context.contributions.get(player.id)?.oldPrice;

      if (oldPrice == null || data.previousScores.length < 2) {
        continue;
      }

      const input = {
        context,
        playerId: player.id,
        oldPrice,
        previousScores: data.previousScores,
      };

      const breakEven = calculateScaledBreakEven(input) as number;
      const atBreakEven = calculateScaledPlayerPrice({
        ...input,
        score: breakEven,
      }).price;
      const belowBreakEven = calculateScaledPlayerPrice({
        ...input,
        score: breakEven - 1,
      }).price;

      // Price holds at the breakeven and falls one point below it.
      expect(atBreakEven).toBeGreaterThanOrEqual(oldPrice);
      expect(belowBreakEven).toBeLessThan(oldPrice);
      // One point moves price by about $440, plus $100 rounding.
      expect(atBreakEven - oldPrice).toBeLessThan(600);

      checked += 1;
    }

    expect(checked).toBeGreaterThan(100);
  }

  it("round-trips on a completed round", () => {
    checkRoundTrip(contextFor(12).get(12) as ScaledRoundContext, 12);
  });

  it("round-trips on an estimated future round", () => {
    checkRoundTrip(contextFor(19, 20).get(19) as ScaledRoundContext, 19);
  });

  it("returns null with fewer than two previous scores", () => {
    const context = contextFor(19).get(19) as ScaledRoundContext;

    expect(
      calculateScaledBreakEven({
        context,
        playerId: -1,
        oldPrice: 200_000,
        previousScores: [80],
      }),
    ).toBeNull();
  });
});

describe("future round estimate", () => {
  it("gives a k in the 2026 range and prices rise with the scenario score", () => {
    const contexts = contextFor(19, 24);

    for (const context of contexts.values()) {
      expect(context.k).toBeGreaterThan(0.95);
      expect(context.k).toBeLessThan(1.01);
    }

    const context = contexts.get(19) as ScaledRoundContext;
    const player = players.find(
      (p) => playerRound(p, 19).previousScores.length >= 5,
    ) as Player;
    const data = playerRound(player, 19);

    const prices = [50, 100, 120].map(
      (score) =>
        calculateScaledPlayerPrice({
          context,
          playerId: player.id,
          oldPrice: data.oldPrice as number,
          previousScores: data.previousScores,
          score,
        }).price,
    );

    expect(prices[0]).toBeLessThan(prices[1]);
    expect(prices[1]).toBeLessThan(prices[2]);
  });
});
