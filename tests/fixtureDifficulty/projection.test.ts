import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("DEBUG_AS_OF_ROUND", "10");
});

import { currentMatchup, currentMatchupValue, DIFFICULTY_AS_OF_ROUND } from "@/lib/fixtureDifficulty/current";
import {
  DEFAULT_PROJECTION_METHOD,
  isPreDebutRookie,
  PRE_DEBUT_ROOKIE_SCORE,
  PROJECTION_METHODS,
  projectScore,
} from "@/lib/planner/projectScore";
import { createPlan } from "@/lib/planner/teamFile";
import { getProjectedScore } from "@/lib/projector/getProjectedScore";

import { plannerSetup } from "../planner/plannerHelpers";

const { players, makeTeam, run } = plannerSetup();

const average = (p: (typeof players)[number]) => {
  const scores = p.history.filter((h) => h.round <= 10 && h.games > 0).map((h) => h.score as number);
  return scores.reduce((t, s) => t + s, 0) / scores.length;
};

// A regular MID with a game in Round 11 and an adjustment that isn't 0.
const regular = players.find(
  (p) => p.positions.length === 1 && p.positions[0] === "MID" && p.games >= 8 && Math.abs(currentMatchupValue(p, 11) ?? 0) > 0.5,
)!;

describe("projection methods", () => {
  it("names the three methods and defaults to the matchup one", () => {
    expect(PROJECTION_METHODS).toEqual(["seasonAverage", "seasonAverageRookie50", "seasonAverageRookie50Matchup"]);
    expect(DEFAULT_PROJECTION_METHOD).toBe("seasonAverageRookie50Matchup");
    expect(DIFFICULTY_AS_OF_ROUND).toBe(10);
  });

  it("adds the opponent's position difficulty to the season average", () => {
    const adjustment = currentMatchup(regular, 11)!.value;
    expect(projectScore(regular, 11, 10, { method: "seasonAverageRookie50Matchup", matchup: currentMatchupValue })).toBeCloseTo(
      average(regular) + adjustment,
    );
    // Without the matchup method: exactly the previous projection.
    expect(projectScore(regular, 11, 10, { method: "seasonAverageRookie50" })).toBeCloseTo(average(regular));
    expect(projectScore(regular, 11, 10)).toBeCloseTo(average(regular));
  });

  it("gives a dual-position player the mean of his positions' adjustments", () => {
    const dual = players.find((p) => p.positions.length === 2 && p.games >= 5 && currentMatchup(p, 11))!;
    const single = (position: string) => currentMatchup({ team: dual.team, positions: [position] }, 11)!.value;
    expect(currentMatchup(dual, 11)!.value).toBeCloseTo((single(dual.positions[0]) + single(dual.positions[1])) / 2);
  });

  it("keeps a debutant yet to play at 50 with no adjustment", () => {
    const debutant = players.find((p) => isPreDebutRookie(p, 10) && currentMatchup(p, 11))!;
    expect(projectScore(debutant, 11, 10, { method: "seasonAverageRookie50Matchup", matchup: () => 99 })).toBe(PRE_DEBUT_ROOKIE_SCORE);
    expect(projectScore(debutant, 11, 10, { method: "seasonAverage" })).toBeNull();
  });

  it("Projector: Projected adds it when the switch is on; Season Avg stays plain", () => {
    const args = { player: regular, round: 11, completedRound: 10 } as const;
    expect(getProjectedScore({ ...args, mode: "projected", matchup: true })).toBe(Math.round(average(regular) + currentMatchup(regular, 11)!.value));
    expect(getProjectedScore({ ...args, mode: "projected", matchup: false })).toBe(Math.round(average(regular)));
    expect(getProjectedScore({ ...args, mode: "season-average", matchup: true })).toBe(Math.round(regular.average));
  });
});

describe("planner price paths", () => {
  const team = makeTeam([regular]);

  it("use the adjusted score with the switch on, and exactly the previous paths with it off", async () => {
    const { createPlanProjector } = await import("@/components/planner/plannerData");
    const plan = { ...createPlan("p"), scoreOverrides: {} };

    // The test helper builds the projector with no method: the previous behaviour.
    const previous = run(team, plan, 24).projector.getPath(regular.id);
    const off = createPlanProjector(plan, team, false).getPath(regular.id);
    const on = createPlanProjector(plan, team, true).getPath(regular.id);

    expect(off).toEqual(previous);
    expect(on.find((r) => r.round === 11)!.score).toBeCloseTo(average(regular) + currentMatchup(regular, 11)!.value);
    // Prices follow the adjusted scores, so they differ from the previous path.
    expect(on.map((r) => r.priceAfter)).not.toEqual(previous.map((r) => r.priceAfter));
  });

  it("let a score override win over the adjusted projection", async () => {
    const { createPriceProjector } = await import("@/lib/planner/pricePaths");
    const { getScaledRoundContexts } = await import("@/lib/projector/getScaledRoundContexts");
    const { getFixtures } = await import("@/lib/fixtures");
    const projector = createPriceProjector({
      players,
      contexts: getScaledRoundContexts(),
      fixtures: getFixtures(),
      completedRound: 10,
      lastRound: 15,
      scoreOverrides: { [regular.id]: { 11: 150 } },
      projection: { method: "seasonAverageRookie50Matchup", matchup: currentMatchupValue },
    });
    const path = projector.getPath(regular.id);
    expect(path.find((r) => r.round === 11)!.score).toBe(150);
    const r12 = path.find((r) => r.round === 12 && !r.onBye);
    if (r12) expect(r12.score).toBeCloseTo(average(regular) + (currentMatchupValue(regular, 12) ?? 0));
  });
});
