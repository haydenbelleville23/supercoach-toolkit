import { describe, expect, it } from "vitest";

import {
  checkOnFieldPlaying,
  checkSquadPositions,
  type MatchPlayer,
} from "@/lib/planner/positionMatching";
import type { Position } from "@/lib/rules/squadRules";

let nextId = 1;

function players(count: number, eligible: Position[]): MatchPlayer[] {
  return Array.from({ length: count }, () => {
    const id = nextId++;
    return { id, name: `P${id}`, eligible, pin: null };
  });
}

/** 8 DEF, 11 MID, 3 RUC, 8 FWD + 1 extra MID for the flex = 31. */
function standardSquad(): MatchPlayer[] {
  return [
    ...players(8, ["DEF"]),
    ...players(12, ["MID"]),
    ...players(3, ["RUC"]),
    ...players(8, ["FWD"]),
  ];
}

describe("checkSquadPositions", () => {
  it("places a standard 31-player squad", () => {
    const result = checkSquadPositions(standardSquad());

    expect(result.valid).toBe(true);
    expect(result.assignment.size).toBe(31);
    expect(
      [...result.assignment.values()].filter((s) => s.area === "field"),
    ).toHaveLength(23);
  });

  it("uses the flex for a fourth ruck", () => {
    const squad = [
      ...players(8, ["DEF"]),
      ...players(11, ["MID"]),
      ...players(4, ["RUC"]),
      ...players(8, ["FWD"]),
    ];

    expect(checkSquadPositions(squad).valid).toBe(true);
  });

  it("rejects five single-position rucks and says why", () => {
    const squad = [
      ...players(8, ["DEF"]),
      ...players(10, ["MID"]),
      ...players(5, ["RUC"]),
      ...players(8, ["FWD"]),
    ];

    const result = checkSquadPositions(squad);

    expect(result.valid).toBe(false);
    expect(result.problems.join(" ")).toContain(
      "5 players can only play RUC (none are dual-position), but there are only 4 slots",
    );
  });

  it("lets a dual-position RUC/FWD player fill a forward slot", () => {
    const squad = [
      ...players(8, ["DEF"]),
      ...players(11, ["MID"]),
      ...players(4, ["RUC"]),
      ...players(7, ["FWD"]),
      ...players(1, ["RUC", "FWD"]),
    ];

    const result = checkSquadPositions(squad);
    const dual = squad[squad.length - 1];

    expect(result.valid).toBe(true);
    expect(result.assignment.get(dual.id)?.position).toBe("FWD");
  });

  it("rejects too many players across two positions even with dual positions", () => {
    // 8 DEF + 3 RUC + 1 flex = 12 slots for 13 DEF/RUC players.
    const squad = [
      ...players(13, ["DEF", "RUC"]),
      ...players(10, ["MID"]),
      ...players(8, ["FWD"]),
    ];

    const result = checkSquadPositions(squad);

    expect(result.valid).toBe(false);
    expect(result.problems.join(" ")).toContain(
      "13 players can only play DEF or RUC, but there are only 12 slots",
    );
  });

  it("explains a pin that cannot be honoured", () => {
    const squad = standardSquad().map((p) =>
      p.eligible[0] === "DEF"
        ? { ...p, pin: { area: "field" as const, position: "DEF" as const } }
        : p,
    );

    const result = checkSquadPositions(squad);

    expect(result.valid).toBe(false);
    expect(result.problems.join(" ")).toContain("can't be placed with the current pins");
  });

  it("flags a squad that is not 31", () => {
    const result = checkSquadPositions(standardSquad().slice(0, 30));

    expect(result.problems[0]).toBe("The squad has 30 players; it needs 31.");
  });
});

describe("checkOnFieldPlaying", () => {
  it("flags when playing players cannot fill on-field rucks", () => {
    const playing = [
      ...players(6, ["DEF"]),
      ...players(9, ["MID"]),
      ...players(1, ["RUC"]),
      ...players(6, ["FWD"]),
    ];

    const result = checkOnFieldPlaying(playing);

    expect(result.filled).toBeLessThan(23);
    expect(result.problems.join(" ")).toContain(
      "Only 1 playing RUC-eligible players for 2 on-field RUC spots.",
    );
  });
});
