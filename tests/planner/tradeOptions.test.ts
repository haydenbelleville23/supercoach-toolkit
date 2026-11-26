import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("DEBUG_AS_OF_ROUND", "10");
});

import { createAddPlayerReason } from "@/lib/planner/addPlayerReason";
import { toMatchPlayer } from "@/lib/planner/evaluatePlan";
import { addPlaceholder } from "@/lib/planner/placeholders";
import { createPlan } from "@/lib/planner/teamFile";
import { tradeInExclusions, tradeOutCandidates } from "@/lib/planner/tradeOptions";

import { plannerSetup } from "./plannerHelpers";

const { players, buildSquad, makeTeam, run } = plannerSetup();

describe("trade row options", () => {
  const squad = buildSquad();
  const ids = squad.map((p) => p.id);
  const [a, b] = squad.filter((p) => p.positions[0] === "MID");
  const outsider = players.find((p) => p.positions[0] === "MID" && !ids.includes(p.id))!;

  it("player out: the squad going into the round, minus other rows' picks", () => {
    const trades = [
      { outId: a.id, inId: null },
      { outId: null, inId: null },
    ];
    expect(tradeOutCandidates(ids, trades, 1)).not.toContain(a.id);
    expect(tradeOutCandidates(ids, trades, 1)).toHaveLength(ids.length - 1);
    // The row's own pick stays in its list.
    expect(tradeOutCandidates(ids, trades, 0)).toContain(a.id);
  });

  it("player out follows earlier rounds' trades, placeholders included", () => {
    const base = makeTeam(squad);
    const { team, id: rookieId } = addPlaceholder(base, "MID");
    const plan = {
      ...createPlan("Options"),
      rounds: {
        11: { boost: false, trades: [{ outId: a.id, inId: outsider.id }] },
        12: { boost: false, trades: [{ outId: b.id, inId: rookieId }] },
      },
    };

    const { rounds } = run(team, plan, 13);
    // Squad going into Round 12 = Round 11's squad after its trades.
    const into12 = rounds[0].squad;
    expect(tradeOutCandidates(into12, [], 0)).toContain(outsider.id);
    expect(tradeOutCandidates(into12, [], 0)).not.toContain(a.id);

    const into13 = rounds[1].squad;
    expect(tradeOutCandidates(into13, [], 0)).toContain(rookieId);
    expect(tradeOutCandidates(into13, [], 0)).not.toContain(b.id);
  });

  it("player in leaves out the squad and other rows' picks", () => {
    const trades = [
      { outId: a.id, inId: outsider.id },
      { outId: null, inId: null },
    ];
    const excluded = tradeInExclusions(ids, trades, 1);
    expect(excluded.has(a.id)).toBe(true);
    expect(excluded.has(outsider.id)).toBe(true);
    expect(tradeInExclusions(ids, trades, 0).has(outsider.id)).toBe(false);
  });
});

describe("My Team add reasons", () => {
  const defs = players.filter((p) => p.positions.length === 1 && p.positions[0] === "DEF");
  const mids = players.filter((p) => p.positions.length === 1 && p.positions[0] === "MID");

  it("says why a player can't be added", () => {
    // 8 DEF fill the DEF slots (6 field + 2 bench); a 9th takes the flex;
    // a 10th has nowhere to go.
    const squad = defs.slice(0, 9).map((p) => toMatchPlayer(p));
    const reason = createAddPlayerReason(squad);

    expect(reason(toMatchPlayer(defs[0]))).toBe("In squad");
    expect(reason(toMatchPlayer(defs[9]))).toBe("No DEF slot");
    expect(reason(toMatchPlayer(mids[0]))).toBeNull();
  });

  it("says the squad is full at 31", () => {
    const squad = buildSquad().map((p) => toMatchPlayer(p));
    const extra = players.find((p) => !squad.some((s) => s.id === p.id))!;
    expect(createAddPlayerReason(squad)(toMatchPlayer(extra))).toBe("Squad full");
  });
});
