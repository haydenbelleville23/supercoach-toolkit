import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { getPlayers } from "@/lib/players";
import { normaliseSuperCoachPlayer } from "@/lib/supercoach/normalisePlayer";

import type { SuperCoachPlayer } from "@/types/supercoach";

describe("players-normalised.json", () => {
  it("matches a fresh normalisation of players-complete.json", () => {
    const raw = JSON.parse(
      readFileSync(path.resolve("data/2026/players-complete.json"), "utf8"),
    ) as SuperCoachPlayer[];

    const expected = raw
      .map((player) => normaliseSuperCoachPlayer(player))
      .sort((a, b) => a.name.localeCompare(b.name));

    // If this fails, run: node scripts/build-players-normalised.ts
    expect(JSON.parse(JSON.stringify(getPlayers()))).toEqual(
      JSON.parse(JSON.stringify(expected)),
    );
  }, 60_000);
});
