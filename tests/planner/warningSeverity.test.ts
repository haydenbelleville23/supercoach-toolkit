import { describe, expect, it } from "vitest";

import { groupWarnings, warningSeverity } from "@/lib/planner/warningSeverity";

describe("warning severity (display only)", () => {
  it("marks invalid squads, trade limits, cash, missing players and positions as errors", () => {
    for (const message of [
      "The squad has 30 players; it needs 31.",
      "3 trades planned; this round allows 2.",
      "The season trade pool is used up (-1 left).",
      "A boost is used but none are left.",
      "Cash in bank is below zero ($-12,000).",
      "Trade 1 is missing a player in.",
      "Trade 2: Max Gawn is traded out but isn't in the squad.",
      "Trade 1: Nick Daicos is traded in but is already in the squad.",
      "Trade 2: Nick Daicos is traded in twice.",
      "9 players can only play DEF (none are dual-position), but there are only 9 slots for them (6 on-field + 2 bench + 1 flex).",
      "These players can't be placed with the current pins: A B. Set their placement to Auto or move another player.",
    ]) {
      expect(warningSeverity(message), message).toBe("error");
    }
  });

  it("marks the bye shortfall and injured players as warnings, and anything else as info", () => {
    expect(warningSeverity("Only 17 of your players are playing in Round 12 (18 needed in bye rounds)")).toBe("warning");
    expect(warningSeverity("2 injured or suspended players not counted as playing (A, B).")).toBe("warning");
    expect(warningSeverity("1 injured or suspended player not counted as playing (A).")).toBe("warning");
    expect(warningSeverity("Byes: Only 5 playing DEF-eligible players for 6 on-field DEF spots.")).toBe("info");
    expect(warningSeverity("Trade 1: no price for X this round.")).toBe("info");
  });

  it("groups by severity, errors first, leaving out empty groups", () => {
    const groups = groupWarnings([
      "2 injured or suspended players not counted as playing (A, B).",
      "Trade 1 is missing a player in.",
      "Cash in bank is below zero ($-1).",
    ]);
    expect(groups.map((g) => [g.severity, g.messages.length])).toEqual([
      ["error", 2],
      ["warning", 1],
    ]);
  });
});
