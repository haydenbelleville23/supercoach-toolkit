import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

// Make sure the lock is off even if the shell running the tests has it set.
vi.hoisted(() => {
  vi.stubEnv("DEBUG_AS_OF_ROUND", "");
});

import { CURRENT_COMPLETED_ROUND, DEBUG_AS_OF_ROUND } from "@/data/season";
import { getFixtures, getRawFixtureFile } from "@/lib/fixtures";
import { getPlayers } from "@/lib/players";
import { getLatestCompletedRound } from "@/lib/season/seasonStatus";

const readJson = (file: string) =>
  JSON.parse(readFileSync(path.resolve(file), "utf8"));

describe("DEBUG_AS_OF_ROUND unset", () => {
  it("is off", () => {
    expect(DEBUG_AS_OF_ROUND).toBeNull();
  });

  it("serves the player and fixture data exactly as stored", () => {
    expect(getPlayers()).toEqual(
      readJson("data/2026/players-normalised.json"),
    );
    expect(getRawFixtureFile()).toEqual(readJson("data/2026/fixtures-raw.json"));
  });

  it("derives the completed round from the data as before", () => {
    expect(CURRENT_COMPLETED_ROUND).toBe(
      getLatestCompletedRound(getPlayers(), getFixtures()),
    );
  });
});
