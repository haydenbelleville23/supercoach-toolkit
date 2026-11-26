import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { getRawFixtureFile } from "@/lib/fixtures";
import { getPlayers } from "@/lib/players";
import { normaliseSuperCoachPlayer } from "@/lib/supercoach/normalisePlayer";
import {
  latestPricedRound,
  withScaledBreakevens,
} from "@/lib/supercoach/publicPlayerState";

import type { SuperCoachPlayer } from "@/types/supercoach";

const NORMALISED_FILE = path.resolve("data/2026/players-normalised.json");

/** Subscriber-only SuperCoach fields, and the Player fields built from them. */
const REMOVED_FIELDS = [
  "be1", "be2", "be3",
  "pp1", "pp2", "pp3",
  "ppc1", "ppc2", "ppc3",
  "ppts", "ppts1", "ppts2", "ppts3",
  "pmin", "pmax", "prange",
  "bp1", "pavg3", "own", "ccow",
  "projectedBreakEvens", "projectedScore", "projectedScores",
  "projectedPrices", "projectedPriceChanges", "upcomingFixtures",
];

describe("players-normalised.json", () => {
  it("matches a fresh normalisation of players-complete.json", () => {
    const raw = JSON.parse(
      readFileSync(path.resolve("data/2026/players-complete.json"), "utf8"),
    ) as SuperCoachPlayer[];

    const normalised = raw.map((player) => normaliseSuperCoachPlayer(player));
    const round = Math.max(...normalised.map((p) => latestPricedRound(p) ?? -1));
    const expected = withScaledBreakevens(normalised, getRawFixtureFile(), round)
      .sort((a, b) => a.name.localeCompare(b.name));

    // If this fails, run: node scripts/build-players-normalised.ts
    expect(JSON.parse(JSON.stringify(getPlayers()))).toEqual(
      JSON.parse(JSON.stringify(expected)),
    );
  }, 60_000);

  it("contains none of the removed subscriber field names", () => {
    const text = readFileSync(NORMALISED_FILE, "utf8");

    for (const field of REMOVED_FIELDS) {
      expect(text, field).not.toContain(`"${field}"`);
    }
  });

  it("is built from a players-complete.json with no subscriber fields", () => {
    const text = readFileSync(path.resolve("data/2026/players-complete.json"), "utf8");

    for (const field of REMOVED_FIELDS) {
      expect(text, field).not.toContain(`"${field}"`);
    }
  }, 60_000);

  it("has no ownership data (no public source yet)", () => {
    expect(getPlayers().every((player) => player.ownership === null)).toBe(true);
  });

  it("gives every player their latest published price from history", () => {
    for (const player of getPlayers()) {
      const priced = player.history.filter((row) => row.price != null);
      expect(player.price, player.name).toBe(priced[priced.length - 1].price);
    }
  });
});
