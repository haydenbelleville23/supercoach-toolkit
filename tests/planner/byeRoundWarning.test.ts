import { describe, expect, it, vi } from "vitest";

// Round 12 is a bye round, so this runs as of Round 10 (plans start at 11).
vi.hoisted(() => {
  vi.stubEnv("DEBUG_AS_OF_ROUND", "10");
});

import { addPlaceholder } from "@/lib/planner/placeholders";
import { createPlan } from "@/lib/planner/teamFile";
import type { MyTeam, PlannedTrade, TradePlan } from "@/lib/planner/types";
import { BEST_SCORES_IN_BYE_ROUND, getByeTeams, SQUAD_RULES } from "@/lib/rules/squadRules";

import { plannerSetup } from "./plannerHelpers";

const { fixtures, players, makeTeam, run } = plannerSetup();

const BYE_ROUND = 12;
const byeTeams = getByeTeams(BYE_ROUND, fixtures);
const onBye = players.filter((p) => byeTeams.includes(p.team));
const withGame = players.filter((p) => !byeTeams.includes(p.team));

/** A 31-player squad with this many players who have a game in Round 12. */
function squadPlaying(playing: number, size = SQUAD_RULES.squadSize) {
  return [...withGame.slice(0, playing), ...onBye.slice(0, size - playing)];
}

const planWith = (rounds: TradePlan["rounds"]): TradePlan => ({ ...createPlan("Byes"), rounds });
const round = (...trades: PlannedTrade[]) => ({ boost: false, trades });

const byeWarnings = (warnings: string[]) =>
  warnings.filter((w) => w.includes("needed in bye rounds"));

function roundSummary(team: MyTeam, plan: TradePlan, target = BYE_ROUND) {
  return run(team, plan, target).rounds.find((r) => r.round === target)!;
}

describe("bye-round warning", () => {
  it("is a bye round with teams on bye", () => {
    expect(byeTeams.length).toBeGreaterThan(0);
    expect(BEST_SCORES_IN_BYE_ROUND).toBe(18);
  });

  it("warns with 17 playing, and not with 18 or 25", () => {
    const seventeen = roundSummary(makeTeam(squadPlaying(17)), planWith({}));
    expect(seventeen.playing).toBe(17);
    expect(byeWarnings(seventeen.warnings)).toEqual([
      "Only 17 of your players are playing in Round 12 (18 needed in bye rounds)",
    ]);

    for (const playing of [18, 25]) {
      const summary = roundSummary(makeTeam(squadPlaying(playing)), planWith({}));
      expect(summary.playing).toBe(playing);
      expect(byeWarnings(summary.warnings)).toEqual([]);
    }
  });

  it("gives no position, on-field or bench warnings for byes", () => {
    const summary = roundSummary(makeTeam(squadPlaying(17)), planWith({}));
    expect(summary.warnings.some((w) => w.startsWith("Byes:"))).toBe(false);
    // The counts are still reported.
    expect(summary.onBye).toBe(SQUAD_RULES.squadSize - 17);
    expect(summary.byeTeams).toEqual(byeTeams);
  });

  it("clears when a trade brings the count to 18, and returns when one drops it to 17", () => {
    const seventeen = squadPlaying(17);
    const byeOut = seventeen.find((p) => byeTeams.includes(p.team))!;
    const gameIn = withGame[40];

    const up = roundSummary(
      makeTeam(seventeen),
      planWith({ [BYE_ROUND]: round({ outId: byeOut.id, inId: gameIn.id }) }),
    );
    expect(up.playing).toBe(18);
    expect(byeWarnings(up.warnings)).toEqual([]);

    const eighteen = squadPlaying(18);
    const gameOut = eighteen.find((p) => !byeTeams.includes(p.team))!;
    const byeIn = onBye[40];

    const down = roundSummary(
      makeTeam(eighteen),
      planWith({ [BYE_ROUND]: round({ outId: gameOut.id, inId: byeIn.id }) }),
    );
    expect(down.playing).toBe(17);
    expect(byeWarnings(down.warnings)).toHaveLength(1);
  });

  it("counts a placeholder with no team as playing, but not one whose team is on bye", () => {
    const base = makeTeam(squadPlaying(17, SQUAD_RULES.squadSize - 1));

    const noTeam = addPlaceholder(base, "MID");
    const withNoTeam = { ...noTeam.team, players: [...base.players, { id: noTeam.id, pin: null }] };
    const counted = roundSummary(withNoTeam, planWith({}));
    expect(counted.playing).toBe(18);
    expect(byeWarnings(counted.warnings)).toEqual([]);

    const byeTeam = addPlaceholder(base, "MID", byeTeams[0]);
    const withByeTeam = { ...byeTeam.team, players: [...base.players, { id: byeTeam.id, pin: null }] };
    const notCounted = roundSummary(withByeTeam, planWith({}));
    expect(notCounted.playing).toBe(17);
    expect(byeWarnings(notCounted.warnings)).toHaveLength(1);
  });

  it("never warns in a non-bye round", () => {
    const team = makeTeam(squadPlaying(5));
    const rounds = run(team, planWith({}), 15).rounds.filter((r) => r.byeTeams.length === 0);

    expect(rounds.length).toBeGreaterThan(0);
    for (const summary of rounds) {
      expect(byeWarnings(summary.warnings)).toEqual([]);
    }
  });

  it("updates when trades in an earlier round change the squad", () => {
    const seventeen = squadPlaying(17);
    const byeOut = seventeen.find((p) => byeTeams.includes(p.team))!;
    const gameIn = withGame[41];

    const before = roundSummary(makeTeam(seventeen), planWith({}));
    expect(byeWarnings(before.warnings)).toHaveLength(1);

    // A Round 11 trade (before the bye) lifts Round 12 to 18 playing.
    const after = roundSummary(
      makeTeam(seventeen),
      planWith({ 11: round({ outId: byeOut.id, inId: gameIn.id }) }),
    );
    expect(after.playing).toBe(18);
    expect(byeWarnings(after.warnings)).toEqual([]);
  });
});
