import { describe, expect, it } from "vitest";

import { normaliseDfsLiveFeed } from "@/lib/liveMatch/dfsAustralia";

const base = {
  playerId: "CD_I1",
  playerName: "Test Player",
  id: 1,
  teamAbbr: "COL",
  homeAway: "home",
  superCoachPoints: 50,
  dreamTeamPoints: 40,
  q1: 10,
  q2: 20,
  q3: 20,
  q4: 0,
  position: "MID",
  playerJumperNumber: 7,
};

const feed = (players: Record<string, unknown>[]) =>
  normaliseDfsLiveFeed({
    timeStamp: ["2026-01-01"],
    status: ["ok"],
    fixtures: [{ id: 1, status: "LIVE", homeTeam: "COL", awayTeam: "BRL" }],
    playerStats: players,
  });

describe("normaliseDfsLiveFeed: onBenchKnown and timeOnGroundKnown", () => {
  it("are true only when the raw keys were present", () => {
    const [present, missing] = feed([
      { ...base, playerId: "CD_I1", onBench: 0, benchReason: "", timeOnGroundPercentage: 0 },
      { ...base, playerId: "CD_I2" },
    ]).players;

    expect(present.onBenchKnown).toBe(true);
    expect(present.timeOnGroundKnown).toBe(true);
    expect(missing.onBenchKnown).toBe(false);
    expect(missing.timeOnGroundKnown).toBe(false);
  });

  it("count a present key even when its value is null", () => {
    const [player] = feed([{ ...base, onBench: null, timeOnGroundPercentage: null }]).players;
    expect(player.onBenchKnown).toBe(true);
    expect(player.timeOnGroundKnown).toBe(true);
  });

  it("leave the existing fields' behaviour unchanged", () => {
    const [bench, missing, other] = feed([
      { ...base, playerId: "CD_I1", onBench: 1, benchReason: "Blood rule", timeOnGroundPercentage: 64 },
      { ...base, playerId: "CD_I2" },
      { ...base, playerId: "CD_I3", onBench: 2 },
    ]).players;

    expect(bench).toMatchObject({ onBench: true, benchReason: "Blood rule", timeOnGroundPercentage: 64 });
    // Missing keys still become false / null / 0 placeholders.
    expect(missing).toMatchObject({ onBench: false, benchReason: null, timeOnGroundPercentage: 0 });
    expect(other.onBench).toBe(false);
  });

  it("forwards no other raw keys", () => {
    const [player] = feed([{ ...base, onBench: 0, timeOnGroundPercentage: 70, status: "x", secret: 1, emergency: true }]).players;
    expect(Object.keys(player).sort()).toEqual(
      [
        "benchReason",
        "championDataId",
        "dreamTeamPoints",
        "fixtureId",
        "homeAway",
        "jumperNumber",
        "onBench",
        "onBenchKnown",
        "playerName",
        "position",
        "quarterScores",
        "superCoachPoints",
        "team",
        "timeOnGroundKnown",
        "timeOnGroundPercentage",
      ].sort(),
    );
  });
});
