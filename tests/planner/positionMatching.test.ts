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

describe("auto-fielding by price", () => {
  const priced = (count: number, eligible: Position[], prices: number[]) =>
    players(count, eligible).map((p, i) => ({ ...p, price: prices[i] }));

  it("puts the most expensive players on the field and the cheapest on the bench", () => {
    const defs = priced(8, ["DEF"], [500, 480, 460, 440, 420, 400, 200, 150]);
    const squad = [
      ...defs,
      ...priced(12, ["MID"], [900, 850, 800, 750, 700, 650, 600, 550, 520, 300, 250, 120]),
      ...priced(3, ["RUC"], [700, 650, 180]),
      ...priced(8, ["FWD"], [600, 560, 520, 480, 440, 400, 220, 130]),
    ];

    const result = checkSquadPositions(squad);
    const area = (id: number) => result.assignment.get(id)?.area;

    expect(result.valid).toBe(true);

    // Top 6 defenders on field, 2 cheapest on the bench.
    defs.slice(0, 6).forEach((p) => expect(area(p.id)).toBe("field"));
    defs.slice(6).forEach((p) => expect(area(p.id)).toBe("bench"));

    // 9 most expensive mids play (8 MID + the flex); the 3 cheapest are benched.
    const mids = squad.filter((p) => p.eligible[0] === "MID");
    mids.slice(0, 9).forEach((p) => expect(area(p.id)).toBe("field"));
    mids.slice(9).forEach((p) => expect(area(p.id)).toBe("bench"));
    expect(
      mids.filter((p) => result.assignment.get(p.id)?.position === "FLEX"),
    ).toHaveLength(1);
  });

  it("gives the most valuable legal field when a dual-position player is involved", () => {
    // 8 single forwards fill exactly the 8 FWD slots (6 field + 2 bench), so
    // the two cheapest forwards (540, 100) must sit on the bench. The
    // expensive MID/FWD plays MID and the flex goes to the best spare mid.
    const fwds = priced(8, ["FWD"], [600, 590, 580, 570, 560, 550, 540, 100]);
    const dual = priced(1, ["MID", "FWD"], [800]);
    const squad = [
      ...priced(8, ["DEF"], [500, 490, 480, 470, 460, 450, 110, 105]),
      ...priced(11, ["MID"], [700, 690, 680, 670, 660, 650, 640, 115, 112, 111, 109]),
      ...priced(3, ["RUC"], [650, 640, 120]),
      ...fwds,
      ...dual,
    ];

    const result = checkSquadPositions(squad);
    const area = (id: number) => result.assignment.get(id)?.area;

    expect(result.valid).toBe(true);
    expect(area(dual[0].id)).toBe("field");
    fwds.slice(0, 6).forEach((p) => expect(area(p.id)).toBe("field"));
    fwds.slice(6).forEach((p) => expect(area(p.id)).toBe("bench"));

    const fieldPrice = [...result.assignment]
      .filter(([, slot]) => slot.area === "field")
      .reduce((t, [id]) => t + (squad.find((p) => p.id === id)!.price ?? 0), 0);

    expect(fieldPrice).toBe(
      (500 + 490 + 480 + 470 + 460 + 450) + // DEF
        (800 + 700 + 690 + 680 + 670 + 660 + 650 + 640) + // MID incl. dual
        (650 + 640) + // RUC
        (600 + 590 + 580 + 570 + 560 + 550) + // FWD
        115, // FLEX: best spare mid
    );
  });

  it("can't be improved by any legal field/bench swap (random squads)", () => {
    // For random prices, every swap of a field player for a bench player
    // that would raise the field's value must be illegal.
    for (let trial = 0; trial < 20; trial++) {
      const squad = [
        ...priced(8, ["DEF"], Array.from({ length: 8 }, () => Math.round(Math.random() * 900))),
        ...priced(11, ["MID"], Array.from({ length: 11 }, () => Math.round(Math.random() * 900))),
        ...priced(3, ["RUC"], Array.from({ length: 3 }, () => Math.round(Math.random() * 900))),
        ...priced(7, ["FWD"], Array.from({ length: 7 }, () => Math.round(Math.random() * 900))),
        ...priced(1, ["MID", "FWD"], [Math.round(Math.random() * 900)]),
        ...priced(1, ["DEF", "MID"], [Math.round(Math.random() * 900)]),
      ];

      const result = checkSquadPositions(squad);
      expect(result.valid).toBe(true);

      const fieldIds = new Set(
        [...result.assignment].filter(([, s]) => s.area === "field").map(([id]) => id),
      );
      const value = (ids: Set<number>) =>
        squad.filter((p) => ids.has(p.id)).reduce((t, p) => t + (p.price ?? 0), 0);

      for (const out of fieldIds) {
        for (const bench of squad.filter((p) => !fieldIds.has(p.id))) {
          const swapped = new Set(fieldIds);
          swapped.delete(out);
          swapped.add(bench.id);

          if (value(swapped) <= value(fieldIds)) {
            continue;
          }

          // A better swap must be illegal. Give the swapped group top
          // priority: if it could legally all take the field, it would.
          const swappedCheck = checkSquadPositions(
            squad.map((p) => ({
              ...p,
              price: swapped.has(p.id) ? 1_000_000 + (p.price ?? 0) : p.price,
            })),
          );
          const swappedField = new Set(
            [...swappedCheck.assignment]
              .filter(([, s]) => s.area === "field")
              .map(([id]) => id),
          );

          expect([...swapped].every((id) => swappedField.has(id))).toBe(false);
        }
      }
    }
  });

  it("keeps pins and still prices the rest", () => {
    const squad = [
      ...priced(8, ["DEF"], [500, 480, 460, 440, 420, 400, 200, 150]),
      ...priced(12, ["MID"], [900, 850, 800, 750, 700, 650, 600, 550, 520, 300, 250, 120]),
      ...priced(3, ["RUC"], [700, 650, 180]),
      ...priced(8, ["FWD"], [600, 560, 520, 480, 440, 400, 220, 130]),
    ];

    // Pin the most expensive defender to the bench.
    squad[0] = { ...squad[0], pin: { area: "bench", position: "DEF" } };

    const result = checkSquadPositions(squad);

    expect(result.valid).toBe(true);
    expect(result.assignment.get(squad[0].id)?.area).toBe("bench");
    // The 7th defender (price 200) now plays.
    expect(result.assignment.get(squad[6].id)?.area).toBe("field");
  });

  it("fills the field first while the squad is being built", () => {
    const partial = priced(5, ["MID"], [500, 400, 300, 200, 100]);
    const result = checkSquadPositions(partial);

    partial.forEach((p) => expect(result.assignment.get(p.id)?.area).toBe("field"));
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
