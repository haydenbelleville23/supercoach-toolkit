import { describe, expect, it, vi } from "vitest";

// Needs rounds still to come, so it runs as of Round 18 (plans start at 19).
vi.hoisted(() => {
  vi.stubEnv("DEBUG_AS_OF_ROUND", "18");
});

import { evaluatePlan } from "@/lib/planner/evaluatePlan";
import { addPlaceholder } from "@/lib/planner/placeholders";
import { createPlan, duplicatePlan, parseTeamFile } from "@/lib/planner/teamFile";
import {
  countPriceOverrides,
  parsePriceInput,
  resetPriceOverrides,
  setTradePriceOverride,
  updateTrade,
} from "@/lib/planner/tradePrices";
import type { MyTeam, PlannedTrade, TradePlan } from "@/lib/planner/types";
import { ROOKIE_PLACEHOLDER } from "@/lib/rules/squadRules";

import { plannerSetup } from "./plannerHelpers";

const { fixtures, players, buildSquad, makeTeam, run } = plannerSetup();

const squad = buildSquad();
const inSquad = new Set(squad.map((p) => p.id));
const mids = squad.filter((p) => p.positions[0] === "MID");
const cheap = (position: string, skip = 0) =>
  players
    .filter((p) => p.positions.length === 1 && p.positions[0] === position && !inSquad.has(p.id))
    .sort((a, b) => a.price - b.price)[skip];

const planWith = (rounds: TradePlan["rounds"]): TradePlan => ({ ...createPlan("Test"), rounds });
const round = (...trades: PlannedTrade[]) => ({ boost: false, trades });

const team = makeTeam(squad); // $500,000 in the bank

describe("real players: trade price overrides", () => {
  const out19 = mids[0];
  const in19 = cheap("MID", 0);
  const out20 = mids[1];
  const in20 = cheap("MID", 1);

  const base = run(team, planWith({
    19: round({ outId: out19.id, inId: in19.id }),
    20: round({ outId: out20.id, inId: in20.id }),
  }), 21);

  const price = (id: number, r: number) => base.projector.getPriceBefore(id, r)!;

  it("uses the engine's price before the round by default", () => {
    const [r19, r20] = base.rounds;
    expect(r19.trades[0].outPrice).toBe(price(out19.id, 19));
    expect(r19.trades[0].inPrice).toBe(price(in19.id, 19));
    expect(r19.cashAfter).toBe(500_000 + price(out19.id, 19) - price(in19.id, 19));
    expect(r20.cashBefore).toBe(r19.cashAfter);
  });

  it("carries cash forward with an out override, an in override, and both", () => {
    const { rounds } = run(team, planWith({
      19: round({ outId: out19.id, inId: in19.id, outPriceOverride: 400_000 }),
      20: round({ outId: out20.id, inId: in20.id, outPriceOverride: 500_000, inPriceOverride: 150_000 }),
    }), 21);

    const [r19, r20, r21] = rounds;

    expect(r19.trades[0].outPrice).toBe(400_000);
    expect(r19.trades[0].outDefault).toBe(price(out19.id, 19));
    expect(r19.cashAfter).toBe(500_000 + 400_000 - price(in19.id, 19));

    expect(r20.cashBefore).toBe(r19.cashAfter);
    expect(r20.cashAfter).toBe(r19.cashAfter + 500_000 - 150_000);
    expect(r21.cashBefore).toBe(r20.cashAfter);

    // In override alone.
    const inOnly = run(team, planWith({
      19: round({ outId: out19.id, inId: in19.id, inPriceOverride: 250_000 }),
    }), 20).rounds;
    expect(inOnly[0].cashAfter).toBe(500_000 + price(out19.id, 19) - 250_000);
    expect(inOnly[1].cashBefore).toBe(inOnly[0].cashAfter);
  });

  it("never changes the engine's prices or later squad value", () => {
    const overridden = run(team, planWith({
      19: round({ outId: out19.id, inId: in19.id, inPriceOverride: 250_000 }),
      20: round({ outId: out20.id, inId: in20.id }),
    }), 21);

    for (const r of [19, 20, 21]) {
      for (const id of [out19.id, in19.id, out20.id, in20.id]) {
        expect(overridden.projector.getPriceBefore(id, r)).toBe(price(id, r));
      }
    }

    // Bought at the override in Round 19; valued by the engine after that.
    expect(overridden.rounds[0].squadValue).toBe(
      base.rounds[0].squadValue - price(in19.id, 19) + 250_000,
    );
    expect(overridden.rounds[1].squadValue).toBe(base.rounds[1].squadValue);
    expect(overridden.rounds[2].squadValue).toBe(base.rounds[2].squadValue);
  });

  it("warns when an override takes cash below zero", () => {
    const [r19] = run(team, planWith({
      19: round({ outId: out19.id, inId: in19.id, outPriceOverride: 99_100, inPriceOverride: 1_500_000 }),
    }), 19).rounds;

    expect(r19.cashAfter).toBeLessThan(0);
    expect(r19.warnings.some((w) => w.startsWith("Cash in bank is below zero"))).toBe(true);
  });
});

describe("placeholder rookies: typed prices", () => {
  const ruckOut = squad.filter((p) => p.positions[0] === "RUC")[2];
  const ruckIn = cheap("RUC");
  const one = addPlaceholder(team, "RUC");
  const two = addPlaceholder(one.team, "MID");
  const withRookies: MyTeam = two.team;
  const rookieA = one.id;
  const rookieB = two.id;
  const price = (id: number, r: number) =>
    run(withRookies, planWith({}), 21).projector.getPriceBefore(id, r)!;

  it("bought at 119,000 and sold at 300,000 moves cash and squad value correctly", () => {
    const { rounds } = run(withRookies, planWith({
      19: round({ outId: ruckOut.id, inId: rookieA, inPriceOverride: 119_000 }),
      21: round({ outId: rookieA, inId: ruckIn.id, outPriceOverride: 300_000 }),
    }), 21);

    const [r19, r20, r21] = rounds;

    expect(r19.cashAfter).toBe(500_000 + price(ruckOut.id, 19) - 119_000);
    // He carries his buying price in the squad until he's traded out.
    expect(r20.squadValue).toBe(
      r20.squad.reduce((sum, id) => sum + (id === rookieA ? 119_000 : price(id, 20)), 0),
    );
    expect(r21.trades[0].outPrice).toBe(300_000);
    expect(r21.cashAfter).toBe(r20.cashAfter + 300_000 - price(ruckIn.id, 21));
  });

  it("sells at his buying price when no out price is typed, and is bought at $99,100 by default", () => {
    const typedIn = run(withRookies, planWith({
      19: round({ outId: ruckOut.id, inId: rookieA, inPriceOverride: 119_000 }),
      20: round({ outId: rookieA, inId: ruckIn.id }),
    }), 20).rounds;

    expect(typedIn[1].trades[0].outPrice).toBe(119_000);
    expect(typedIn[1].trades[0].outDefault).toBe(119_000);

    const noTyping = run(withRookies, planWith({
      19: round({ outId: ruckOut.id, inId: rookieA }),
      20: round({ outId: rookieA, inId: ruckIn.id }),
    }), 20).rounds;

    expect(noTyping[0].trades[0].inPrice).toBe(ROOKIE_PLACEHOLDER.price);
    expect(noTyping[1].trades[0].outPrice).toBe(ROOKIE_PLACEHOLDER.price);
    // No typed prices: buying and selling him leaves cash unchanged overall.
    expect(noTyping[1].cashAfter).toBe(
      500_000 + price(ruckOut.id, 19) - price(ruckIn.id, 20),
    );
  });

  it("resetting either price returns it to its default", () => {
    const trade: PlannedTrade = { outId: rookieA, inId: ruckIn.id, outPriceOverride: 300_000 };
    expect(setTradePriceOverride(trade, "out", null)).toEqual({ outId: rookieA, inId: ruckIn.id });

    const bought: PlannedTrade = { outId: ruckOut.id, inId: rookieA, inPriceOverride: 119_000 };
    const reset = setTradePriceOverride(bought, "in", null);
    const [r19] = run(withRookies, planWith({ 19: round(reset) }), 19).rounds;
    expect(r19.trades[0].inPrice).toBe(ROOKIE_PLACEHOLDER.price);
  });

  it("carries cash correctly across three rounds with two placeholders", () => {
    const in21 = cheap("MID", 3);
    const { rounds } = run(withRookies, planWith({
      19: round(
        { outId: ruckOut.id, inId: rookieA, inPriceOverride: 119_000 },
        { outId: mids[11].id, inId: rookieB },
      ),
      20: round({ outId: rookieA, inId: ruckIn.id }),
      21: round({ outId: rookieB, inId: in21.id, outPriceOverride: 250_000 }),
    }), 21);

    const [r19, r20, r21] = rounds;

    expect(r19.cashAfter).toBe(
      500_000 + price(ruckOut.id, 19) - 119_000 + price(mids[11].id, 19) - ROOKIE_PLACEHOLDER.price,
    );
    expect(r20.cashAfter).toBe(r19.cashAfter + 119_000 - price(ruckIn.id, 20));
    expect(r21.cashAfter).toBe(r20.cashAfter + 250_000 - price(in21.id, 21));
  });
});

describe("parsing typed prices", () => {
  it.each([
    ["350000", 350_000],
    ["350,000", 350_000],
    ["$350,000", 350_000],
    ["$350k", 350_000],
    ["350k", 350_000],
    [" 350 K ", 350_000],
    ["1.2m", 1_200_000],
    ["350,049", 350_000],
    ["350,050", 350_100],
    ["99,050", 99_100],
    ["1,500,000", 1_500_000],
  ])("accepts %s as %i", (text, expected) => {
    expect(parsePriceInput(text)).toEqual({ ok: true, price: expected });
  });

  it.each(["", "abc", "35o000", "$", "k", "-350000", "350,000.5.1"])("rejects %j", (text) => {
    const result = parsePriceInput(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/like 350,000/);
  });

  it.each(["99,000", "50k", "1,500,100", "2m"])("rejects %s as out of range", (text) => {
    const result = parsePriceInput(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Enter a price from $99,100 to $1,500,000.");
  });
});

describe("storage, duplication and comparison", () => {
  const trade = { outId: mids[0].id, inId: cheap("MID").id };
  const overridden = planWith({
    19: round({ ...trade, outPriceOverride: 400_000, inPriceOverride: 150_000 }),
  });
  const saved: MyTeam = { ...team, plans: [overridden, planWith({ 19: round(trade) })] };

  it("loads old plans saved before overrides existed", () => {
    const old = JSON.parse(JSON.stringify({ ...team, plans: [planWith({ 19: round(trade) })] }));
    const loaded = parseTeamFile(old) as MyTeam;

    expect(loaded.plans[0].rounds[19].trades).toEqual([trade]);
    expect(run(loaded, loaded.plans[0], 19).rounds[0].trades[0].outPriceOverride).toBeUndefined();
  });

  it("round-trips overrides through export and import, dropping invalid ones", () => {
    const loaded = parseTeamFile(JSON.parse(JSON.stringify(saved))) as MyTeam;
    expect(loaded.plans[0].rounds[19].trades[0]).toEqual({
      ...trade,
      outPriceOverride: 400_000,
      inPriceOverride: 150_000,
    });

    const bad = JSON.parse(JSON.stringify(saved));
    bad.plans[0].rounds[19].trades[0].outPriceOverride = 5;
    bad.plans[0].rounds[19].trades[0].inPriceOverride = "150000";
    const cleaned = parseTeamFile(bad) as MyTeam;
    expect(cleaned.plans[0].rounds[19].trades[0]).toEqual(trade);
  });

  it("copies overrides when a plan is duplicated", () => {
    const copy = duplicatePlan(overridden, "Copy");
    expect(copy.id).not.toBe(overridden.id);
    expect(copy.rounds[19].trades[0].outPriceOverride).toBe(400_000);
    expect(countPriceOverrides(copy)).toBe(2);
    // Independent copies.
    copy.rounds[19].trades[0].outPriceOverride = 450_000;
    expect(overridden.rounds[19].trades[0].outPriceOverride).toBe(400_000);
  });

  it("evaluates each plan with its own overrides (plan comparison)", () => {
    const evaluate = (plan: TradePlan) => {
      const { projector, playersById } = run(saved, plan, 19);
      return evaluatePlan({ team: saved, plan, playersById, projector, fixtures, lastRound: 19 });
    };

    const [a] = evaluate(saved.plans[0]);
    const [b] = evaluate(saved.plans[1]);

    expect(a.cashAfter).toBe(500_000 + 400_000 - 150_000);
    expect(b.cashAfter).toBe(500_000 + b.trades[0].outDefault! - b.trades[0].inDefault!);
    expect(a.cashAfter).not.toBe(b.cashAfter);
  });

  it("resets every override in a plan", () => {
    expect(countPriceOverrides(resetPriceOverrides(overridden))).toBe(0);
    expect(resetPriceOverrides(overridden).rounds[19].trades[0]).toEqual(trade);
  });
});

describe("changing or removing a trade", () => {
  const trade: PlannedTrade = { outId: 1, inId: 2, outPriceOverride: 400_000, inPriceOverride: 150_000 };

  it("drops the row's overrides when either player changes", () => {
    expect(updateTrade(trade, { outId: 3 })).toEqual({ outId: 3, inId: 2 });
    expect(updateTrade(trade, { inId: 4 })).toEqual({ outId: 1, inId: 4 });
    expect(updateTrade(trade, { inId: null })).toEqual({ outId: 1, inId: null });
  });

  it("keeps them when the same player is chosen again", () => {
    expect(updateTrade(trade, { outId: 1 })).toEqual(trade);
  });

  it("removes them with the trade, without shifting them to another row", () => {
    const plan = planWith({
      19: round(trade, { outId: 5, inId: 6 }),
    });
    const removed = { ...plan.rounds[19], trades: plan.rounds[19].trades.filter((_, i) => i !== 0) };

    expect(removed.trades).toEqual([{ outId: 5, inId: 6 }]);
    expect(countPriceOverrides({ ...plan, rounds: { 19: removed } })).toBe(0);
  });
});
