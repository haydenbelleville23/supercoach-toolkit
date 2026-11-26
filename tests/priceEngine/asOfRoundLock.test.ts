import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("DEBUG_AS_OF_ROUND", "10");
});

import { GET as liveScoresRoute } from "@/app/api/live-scores/route";
import { CURRENT_COMPLETED_ROUND, DEBUG_AS_OF_ROUND } from "@/data/season";
import { getFixtures, getRawFixtureFile } from "@/lib/fixtures";
import { getScaledRoundContexts } from "@/lib/projector/getScaledRoundContexts";
import { projectNextRoundPrice } from "@/lib/projector/projectNextRoundPrice";
import { playerRepository } from "@/lib/repository/PlayerRepository";

import type { Player } from "@/types/player";

const AS_OF = 10;

// The real data, read straight from disk (never through the app's modules).
const allPlayers = JSON.parse(
  readFileSync(path.resolve("data/2026/players-normalised.json"), "utf8"),
) as Player[];

const priceAt = (player: Player, round: number) =>
  player.history.find((h) => h.round === round)?.price ?? null;

const existedAtLock = allPlayers.filter((p) => priceAt(p, AS_OF) !== null);
const addedLater = allPlayers.filter((p) => priceAt(p, AS_OF) === null);
const realRound10Total = existedAtLock.reduce(
  (total, p) => total + (priceAt(p, AS_OF) as number),
  0,
);

describe("DEBUG_AS_OF_ROUND=10", () => {
  it("treats Round 10 as the last completed round", () => {
    expect(DEBUG_AS_OF_ROUND).toBe(10);
    expect(CURRENT_COMPLETED_ROUND).toBe(10);
  });

  it("has no players who were added after Round 10", () => {
    expect(addedLater.length).toBeGreaterThan(0); // the R11 draftees

    for (const player of addedLater) {
      expect(playerRepository.getById(player.id)).toBeUndefined();
    }

    expect(playerRepository.getAll()).toHaveLength(existedAtLock.length);
  });

  it("exposes no score, price, price change or game from Round 11 on", () => {
    for (const player of playerRepository.getAll()) {
      const real = allPlayers.find((p) => p.id === player.id)!;

      expect(player.history.every((h) => h.round <= AS_OF)).toBe(true);
      expect(player.price).toBe(priceAt(real, AS_OF));

      const scoresToRound10 = real.history.filter(
        (h) => h.round <= AS_OF && h.games > 0,
      );
      expect(player.games).toBe(scoresToRound10.length);
      expect(player.recentScores).toEqual(
        scoresToRound10.map((h) => h.score),
      );

      // No ownership data is carried (no public source yet).
      expect(player.ownership).toBeNull();
    }
  });

  it("removes results, not the schedule, from later fixtures", () => {
    for (const round of getRawFixtureFile().rounds) {
      for (const game of round.response) {
        if (round.round > AS_OF) {
          expect(game.team1_score).toBeNull();
          expect(game.team2_score).toBeNull();
        }
      }
    }

    expect(getFixtures().some((f) => f.round === AS_OF + 1 && f.kickoff)).toBe(
      true,
    );
  });

  it("estimates later rounds from Round 10's data and total", () => {
    const contexts = getScaledRoundContexts();

    expect(Math.min(...contexts.keys())).toBe(AS_OF + 1);

    const next = contexts.get(AS_OF + 1)!;
    expect(next.anchorTotal).toBe(realRound10Total);
    expect(next.realScoresUsed).toBe(0);

    for (const player of addedLater) {
      expect(next.contributions.has(player.id)).toBe(false);
    }

    const player = playerRepository
      .getAll()
      .find((p) => p.games >= 3 && p.breakeven !== 0)!;
    const projection = projectNextRoundPrice(player, 100)!;

    expect(projection.round).toBe(AS_OF + 1);
    expect(projection.oldPrice).toBe(player.price);
  });

  it("ignores the live-score feed", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await liveScoresRoute();

    expect(response.status).toBe(503);
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
