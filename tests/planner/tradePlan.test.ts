import { describe, expect, it, vi } from "vitest";

// A worked example needs rounds still to come, so it runs as of Round 18.
vi.hoisted(() => {
  vi.stubEnv("DEBUG_AS_OF_ROUND", "18");
});

import { CURRENT_COMPLETED_ROUND, FINAL_ROUND } from "@/data/season";
import { getFixtures } from "@/lib/fixtures";
import { evaluatePlan } from "@/lib/planner/evaluatePlan";
import { createPriceProjector } from "@/lib/planner/pricePaths";
import { createEmptyTeam, createPlan } from "@/lib/planner/teamFile";
import type { MyTeam, TradePlan } from "@/lib/planner/types";
import { getScaledRoundContexts } from "@/lib/projector/getScaledRoundContexts";
import { getRoundTradeLimit } from "@/lib/rules/squadRules";
import { playerRepository } from "@/lib/repository/PlayerRepository";

import type { Player } from "@/types/player";

const fixtures = getFixtures();
const players = playerRepository.getAll();
const playersById = new Map(players.map((p) => [p.id, p]));

/** A valid squad: the most expensive single-position players. */
function buildSquad(): Player[] {
  const pick = (position: string, count: number, exclude: Set<number>) =>
    players
      .filter((p) => p.positions.length === 1 && p.positions[0] === position && !exclude.has(p.id))
      .sort((a, b) => b.price - a.price)
      .slice(0, count);

  const used = new Set<number>();
  const squad: Player[] = [];

  for (const [position, count] of [["DEF", 8], ["MID", 12], ["RUC", 3], ["FWD", 8]] as const) {
    for (const player of pick(position, count, used)) {
      used.add(player.id);
      squad.push(player);
    }
  }

  return squad;
}

const squad = buildSquad();
const inSquad = new Set(squad.map((p) => p.id));
const cheapMid = (skip: number) =>
  players
    .filter((p) => p.positions[0] === "MID" && p.positions.length === 1 && !inSquad.has(p.id))
    .sort((a, b) => a.price - b.price)[skip];

function team(): MyTeam {
  return {
    ...createEmptyTeam(2026, CURRENT_COMPLETED_ROUND),
    players: squad.map((p) => ({ id: p.id, pin: null })),
    cashInBank: 500_000,
    tradesRemaining: 20,
    boostsRemaining: 5,
  };
}

function run(plan: TradePlan) {
  const projector = createPriceProjector({
    players,
    contexts: getScaledRoundContexts(),
    fixtures,
    completedRound: CURRENT_COMPLETED_ROUND,
    lastRound: FINAL_ROUND,
    scoreOverrides: plan.scoreOverrides,
  });

  return {
    projector,
    rounds: evaluatePlan({ team: team(), plan, playersById, projector, fixtures }),
  };
}

// Sell two premium mids, buy two cheap mids.
const outA = squad.find((p) => p.positions[0] === "MID")!;
const outB = squad.filter((p) => p.positions[0] === "MID")[1];
const inA = cheapMid(0);
const inB = cheapMid(1);

describe("trade plan as of Round 18", () => {
  it("starts with a valid squad", () => {
    const { rounds } = run(createPlan("Empty"));

    expect(squad).toHaveLength(31);
    expect(rounds[0].round).toBe(19);
    expect(rounds[0].warnings.filter((w) => !w.startsWith("Byes"))).toEqual([]);
  });

  it("carries cash and trades forward (worked example)", () => {
    const plan: TradePlan = {
      ...createPlan("Worked example"),
      rounds: {
        19: { boost: false, trades: [{ outId: outA.id, inId: inA.id }] },
        20: { boost: false, trades: [{ outId: outB.id, inId: inB.id }] },
      },
    };

    const { rounds, projector } = run(plan);
    const [r19, r20, r21] = rounds;

    // Round 19 trades at the published Round 18 prices.
    expect(r19.trades[0].outPrice).toBe(outA.price);
    expect(r19.trades[0].inPrice).toBe(inA.price);
    expect(r19.cashBefore).toBe(500_000);
    expect(r19.cashAfter).toBe(500_000 + outA.price - inA.price);
    expect(r19.tradesLeftAfter).toBe(19);

    // Round 20 starts where Round 19 ended and uses post-Round-19 prices.
    expect(r20.cashBefore).toBe(r19.cashAfter);
    expect(r20.trades[0].outPrice).toBe(projector.getPath(outB.id)[0].priceAfter);
    expect(r20.cashAfter).toBe(
      r19.cashAfter + r20.outTotal - r20.inTotal,
    );
    expect(r20.tradesLeftAfter).toBe(18);
    expect(r21.cashBefore).toBe(r20.cashAfter);
    expect(r21.tradesLeftBefore).toBe(18);

    // Squad changed, still 31, and still valid.
    expect(r20.squad).toContain(inA.id);
    expect(r20.squad).not.toContain(outA.id);
    expect(r20.squad).toHaveLength(31);
  });

  it("prices a Round R trade at the post-Round-(R-1) price", () => {
    const { projector } = run(createPlan("Timing"));
    const path = projector.getPath(inA.id);

    expect(projector.getPriceBefore(inA.id, 19)).toBe(inA.price);
    expect(projector.getPriceBefore(inA.id, 20)).toBe(path[0].priceAfter);
    expect(projector.getPriceBefore(inA.id, 23)).toBe(path[3].priceAfter);
  });

  it("a limit-2 round plus a boost allows 3 trades: pool -3, boosts -1", () => {
    expect(getRoundTradeLimit(19, false, fixtures)).toBe(2);

    const three = [
      { outId: outA.id, inId: inA.id },
      { outId: outB.id, inId: inB.id },
      { outId: squad.filter((p) => p.positions[0] === "MID")[2].id, inId: cheapMid(2).id },
    ];

    const boosted = run({
      ...createPlan("Boost"),
      rounds: { 19: { boost: true, trades: three } },
    }).rounds[0];

    expect(boosted.tradeLimit).toBe(3);
    expect(boosted.tradesUsed).toBe(3);
    expect(boosted.tradesLeftAfter).toBe(20 - 3);
    expect(boosted.boostsLeftAfter).toBe(5 - 1);
    expect(boosted.warnings.some((w) => w.includes("trades planned"))).toBe(false);

    const unboosted = run({
      ...createPlan("No boost"),
      rounds: { 19: { boost: false, trades: three } },
    }).rounds[0];

    expect(unboosted.tradeLimit).toBe(2);
    expect(unboosted.warnings).toContain("3 trades planned; this round allows 2.");
  });

  it("never forces trades: fewer than the limit is fine", () => {
    const round = run({
      ...createPlan("One"),
      rounds: { 19: { boost: true, trades: [{ outId: outA.id, inId: inA.id }] } },
    }).rounds[0];

    expect(round.tradesUsed).toBe(1);
    expect(round.warnings.some((w) => w.includes("trades planned"))).toBe(false);
  });

  it("gives bye rounds 3 trades (4 with a boost)", () => {
    expect(getRoundTradeLimit(12, false, fixtures)).toBe(3);
    expect(getRoundTradeLimit(12, true, fixtures)).toBe(4);
  });

  it("warns about invalid trades without blocking", () => {
    const round = run({
      ...createPlan("Bad"),
      rounds: {
        19: {
          boost: false,
          trades: [
            { outId: inA.id, inId: outA.id }, // out not in squad, in already in squad
          ],
        },
      },
    }).rounds[0];

    expect(round.warnings.join(" ")).toContain("is traded out but isn't in the squad");
    expect(round.warnings.join(" ")).toContain("is traded in but is already in the squad");
  });

  it("feeds a score override into that player's price", () => {
    const base = run(createPlan("Base")).projector;
    const overridden = run({
      ...createPlan("Override"),
      scoreOverrides: { [outA.id]: { 19: 200 } },
    }).projector;

    expect(overridden.getPath(outA.id)[0].overridden).toBe(true);
    expect(overridden.getPriceBefore(outA.id, 20)).toBeGreaterThan(
      base.getPriceBefore(outA.id, 20)!,
    );
  });
});
