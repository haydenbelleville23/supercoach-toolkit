import { describe, expect, it, vi } from "vitest";

// Round 12 is a bye round, so this runs as of Round 10.
vi.hoisted(() => {
  vi.stubEnv("DEBUG_AS_OF_ROUND", "10");
});

import { getAvailability, isLikelyPlaying } from "@/lib/availability/selectors";
import type { AvailabilitySnapshot } from "@/lib/availability/types";
import { buildFieldLayout } from "@/lib/planner/fieldLayout";
import { createPlan } from "@/lib/planner/teamFile";
import { BEST_SCORES_IN_BYE_ROUND, getByeTeams } from "@/lib/rules/squadRules";

import { plannerSetup } from "./plannerHelpers";

const { fixtures, buildSquad, makeTeam, run } = plannerSetup();

describe("planner playing counts with availability", () => {
  const squad = buildSquad();
  const team = makeTeam(squad);
  const plan = createPlan("Availability");
  const byeTeams = getByeTeams(12, fixtures);
  const withGame = squad.filter((p) => !byeTeams.includes(p.team));

  // Enough long-term injured players with a game to drop below 18 in the
  // Round 12 bye; one is back by Round 12 (short absence).
  const injuredCount = withGame.length - (BEST_SCORES_IN_BYE_ROUND - 1);
  const injured = withGame.slice(0, injuredCount);
  const snapshot: AvailabilitySnapshot = {
    season: 2026,
    asOf: "2026-05-19",
    round: 11,
    source: "Test list",
    players: Object.fromEntries(
      injured.map((p) => [
        p.id,
        {
          status: "long-term",
          injury: "Knee",
          returnText: "Season",
          returnWeeks: null,
          returnRound: null,
          selected: null,
          asOf: "2026-05-19",
          source: "Test list",
        },
      ]),
    ),
  };
  const isOut = (playerId: number, round: number) => !isLikelyPlaying({ id: playerId }, round, snapshot);

  it("setting off: counts and the bye warning ignore injuries", () => {
    const [, r12] = run(team, plan, 12).rounds;
    expect(r12.playing).toBe(withGame.length);
    expect(r12.unavailablePlayerIds).toEqual([]);
    expect(withGame.length).toBeGreaterThanOrEqual(BEST_SCORES_IN_BYE_ROUND);
    expect(r12.warnings.some((w) => w.startsWith("Only "))).toBe(false);
  });

  it("setting on: injured players aren't counted, the warning fires and says why", () => {
    const { rounds, playersById } = run(team, plan, 12, isOut);
    const r12 = rounds[1];

    expect(r12.playing).toBe(BEST_SCORES_IN_BYE_ROUND - 1);
    expect(r12.unavailablePlayerIds.sort()).toEqual(injured.map((p) => p.id).sort());
    expect(r12.warnings).toContain(
      `Only ${BEST_SCORES_IN_BYE_ROUND - 1} of your players are playing in Round 12 (${BEST_SCORES_IN_BYE_ROUND} needed in bye rounds)`,
    );
    expect(r12.warnings.some((w) => w.startsWith(`${injuredCount} injured or suspended players not counted as playing`))).toBe(true);
    // On bye is still only about byes.
    expect(r12.onBye).toBe(squad.length - withGame.length);

    // Field cards: injured players are marked and not in "Total playing".
    const layout = buildFieldLayout(r12, playersById);
    const spots = layout.lines.flatMap((l) => l.spots).filter((s) => s.player);
    const marked = spots.filter((s) => s.unavailable).map((s) => s.player!.id);
    expect(marked.sort()).toEqual(injured.map((p) => p.id).sort());
    const fieldSpots = layout.lines.filter((l) => l.area === "field").flatMap((l) => l.spots);
    expect(layout.playingOnField).toBe(fieldSpots.filter((s) => s.player && !s.onBye && !s.unavailable).length);
  });

  it("short-term, test and unknown players still count as playing", () => {
    const shortTerm: AvailabilitySnapshot = {
      ...snapshot,
      players: { [injured[0].id]: { ...snapshot.players[injured[0].id], status: "short-term", returnText: "1-2 weeks", returnWeeks: 2, returnRound: 13 } },
    };
    expect(isLikelyPlaying({ id: injured[0].id }, 12, shortTerm)).toBe(true);
    expect(getAvailability({ id: injured[0].id }, 12, shortTerm)?.status).toBe("short-term");
    const [, r12] = runWithIsOut((id, round) => !isLikelyPlaying({ id }, round, shortTerm));
    expect(r12.unavailablePlayerIds).toEqual([]);
  });

  function runWithIsOut(out: (playerId: number, round: number) => boolean) {
    return run(team, plan, 12, out).rounds;
  }
});
