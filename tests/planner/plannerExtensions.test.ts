import { describe, expect, it, vi } from "vitest";

// Needs rounds still to come, so it runs as of Round 18.
vi.hoisted(() => {
  vi.stubEnv("DEBUG_AS_OF_ROUND", "18");
});

import { getAddTradeState } from "@/lib/planner/evaluatePlan";
import { addPlaceholder } from "@/lib/planner/placeholders";
import { createPlan } from "@/lib/planner/teamFile";
import type { TradePlan } from "@/lib/planner/types";
import { getRoundTradeLimit, ROOKIE_PLACEHOLDER } from "@/lib/rules/squadRules";

import { plannerSetup } from "./plannerHelpers";

const { fixtures, players, buildSquad, makeTeam, run } = plannerSetup();

const squad = buildSquad();
const inSquad = new Set(squad.map((p) => p.id));
const mids = squad.filter((p) => p.positions[0] === "MID");
const cheap = (position: string, skip = 0) =>
  players
    .filter((p) => p.positions.length === 1 && p.positions[0] === position && !inSquad.has(p.id))
    .sort((a, b) => a.price - b.price)[skip];

const trades = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ outId: mids[i].id, inId: cheap("MID", i).id }));

const planWith = (rounds: TradePlan["rounds"]): TradePlan => ({ ...createPlan("Test"), rounds });

describe("Rookie (TBC) placeholders", () => {
  // Swap the third ruck for a placeholder ruck.
  const thirdRuck = squad.filter((p) => p.positions[0] === "RUC")[2];
  const base = makeTeam(squad.filter((p) => p.id !== thirdRuck.id));
  const { team: withRookie, id: rookieId } = addPlaceholder(base, "RUC");
  const team = { ...withRookie, players: [...withRookie.players, { id: rookieId, pin: null }] };

  it("gets a unique negative id", () => {
    const second = addPlaceholder(team, "DEF");
    expect(rookieId).toBeLessThan(0);
    expect(second.id).toBeLessThan(rookieId);
  });

  it("counts in position matching and squad value", () => {
    const [r19] = run(team, createPlan("Empty")).rounds;

    expect(r19.squad).toContain(rookieId);
    expect(r19.assignment.get(rookieId)?.position).toBe("RUC");
    expect(r19.warnings.filter((w) => !w.startsWith("Byes"))).toEqual([]);

    const realValue = squad
      .filter((p) => p.id !== thirdRuck.id)
      .reduce((t, p) => t + p.price, 0);
    expect(r19.squadValue).toBe(realValue + ROOKIE_PLACEHOLDER.price);
  });

  it("returns $99,100 when traded out, and carries forward", () => {
    const ruckIn = cheap("RUC");
    const { rounds, projector } = run(
      team,
      planWith({ 19: { boost: false, trades: [{ outId: rookieId, inId: ruckIn.id }] } }),
    );

    expect(rounds[0].trades[0].outPrice).toBe(ROOKIE_PLACEHOLDER.price);
    expect(rounds[0].cashAfter).toBe(500_000 + ROOKIE_PLACEHOLDER.price - ruckIn.price);
    expect(rounds[1].cashBefore).toBe(rounds[0].cashAfter);
    expect(rounds[1].squad).not.toContain(rookieId);

    // No score projection: same price every round.
    const path = projector.getPath(rookieId);
    expect(path.every((r) => r.priceBefore === ROOKIE_PLACEHOLDER.price && r.score === null)).toBe(true);
  });
});

describe("trade caps", () => {
  it("are 2, 3 with a boost, 3 in a bye round, 4 with both", () => {
    expect(getRoundTradeLimit(19, false, fixtures)).toBe(2);
    expect(getRoundTradeLimit(19, true, fixtures)).toBe(3);
    expect(getRoundTradeLimit(12, false, fixtures)).toBe(3);
    expect(getRoundTradeLimit(12, true, fixtures)).toBe(4);
  });
});

describe("add-trade disabled states", () => {
  const team = makeTeam(squad);

  it("is enabled below the limit", () => {
    const [r19] = run(team, planWith({ 19: { boost: false, trades: trades(1) } })).rounds;
    expect(getAddTradeState(r19)).toEqual({ disabled: false, reason: null });
  });

  it("suggests a boost at the limit when one is available", () => {
    const [r19] = run(team, planWith({ 19: { boost: false, trades: trades(2) } })).rounds;
    expect(getAddTradeState(r19)).toEqual({
      disabled: true,
      reason: "Round limit (2) reached: use a boost for one more",
    });
  });

  it("is disabled at the boosted limit", () => {
    const [r19] = run(team, planWith({ 19: { boost: true, trades: trades(3) } })).rounds;
    expect(getAddTradeState(r19).reason).toBe("Round limit (3) reached");
  });

  it("says so when no boosts are left", () => {
    const [r19] = run(
      makeTeam(squad, { boostsRemaining: 0 }),
      planWith({ 19: { boost: false, trades: trades(2) } }),
    ).rounds;
    expect(getAddTradeState(r19).reason).toBe("Round limit (2) reached and no boosts left");
  });

  it("is disabled when the season pool is empty", () => {
    const [r19] = run(
      makeTeam(squad, { tradesRemaining: 1 }),
      planWith({ 19: { boost: false, trades: trades(1) } }),
    ).rounds;
    expect(getAddTradeState(r19)).toEqual({
      disabled: true,
      reason: "No trades left in the season pool",
    });
  });

  it("counts empty trade rows so they can't get round the limit", () => {
    const [r19] = run(
      team,
      planWith({ 19: { boost: false, trades: [...trades(1), { outId: null, inId: null }] } }),
    ).rounds;

    expect(r19.tradesUsed).toBe(1);
    expect(getAddTradeState(r19).disabled).toBe(true);
  });
});

describe("cascading when a boost is removed", () => {
  const team = makeTeam(squad);
  const later = [{ outId: mids[5].id, inId: cheap("MID", 5).id }];

  it("keeps the trades, warns on the round, and updates later rounds", () => {
    const boosted = run(
      team,
      planWith({
        19: { boost: true, trades: trades(3) },
        20: { boost: false, trades: later },
      }),
    ).rounds;

    expect(boosted[0].warnings.some((w) => w.includes("trades planned"))).toBe(false);
    expect(boosted[1].boostsLeftBefore).toBe(4);
    expect(boosted[1].tradesLeftBefore).toBe(17);

    const unboosted = run(
      team,
      planWith({
        19: { boost: false, trades: trades(3) },
        20: { boost: false, trades: later },
      }),
    ).rounds;

    expect(unboosted[0].tradesUsed).toBe(3); // not deleted
    expect(unboosted[0].warnings).toContain("3 trades planned; this round allows 2.");
    expect(unboosted[1].boostsLeftBefore).toBe(5);
    expect(unboosted[1].tradesLeftBefore).toBe(17);
    expect(unboosted[1].cashBefore).toBe(unboosted[0].cashAfter);
  });

  it("warns later rounds when earlier trades empty the pool", () => {
    const rounds = run(
      makeTeam(squad, { tradesRemaining: 3 }),
      planWith({
        19: { boost: true, trades: trades(3) },
        20: { boost: false, trades: later },
      }),
    ).rounds;

    expect(rounds[0].tradesLeftAfter).toBe(0);
    expect(rounds[1].warnings.join(" ")).toContain("season trade pool is used up");
  });
});

describe("rounds shown", () => {
  it("evaluates only up to the plan's last shown round", () => {
    const { rounds } = run(makeTeam(squad), createPlan("Three"), 21);
    expect(rounds.map((r) => r.round)).toEqual([19, 20, 21]);
  });
});

describe("stable slot assignment", () => {
  it("keeps players in the same slot between rounds when nothing changes", () => {
    const { rounds } = run(makeTeam(squad), createPlan("Stable"), 22);

    for (let i = 1; i < rounds.length; i++) {
      for (const [id, slot] of rounds[i].assignment) {
        const before = rounds[i - 1].assignment.get(id);
        if (before?.area === slot.area) {
          expect(slot.id).toBe(before.id);
        }
      }
    }
  });
});
