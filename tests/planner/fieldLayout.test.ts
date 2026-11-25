import { describe, expect, it } from "vitest";
import { vi } from "vitest";

// Round 12 is a bye round, so this runs as of Round 10.
vi.hoisted(() => {
  vi.stubEnv("DEBUG_AS_OF_ROUND", "10");
});

import { buildFieldLayout } from "@/lib/planner/fieldLayout";
import { addPlaceholder } from "@/lib/planner/placeholders";
import { createPlan } from "@/lib/planner/teamFile";
import { getByeTeams } from "@/lib/rules/squadRules";

import { plannerSetup } from "./plannerHelpers";

const { fixtures, buildSquad, makeTeam, run } = plannerSetup();

describe("field diagram", () => {
  const squad = buildSquad();
  const outPlayer = squad.find((p) => p.positions[0] === "MID")!;

  // Rookie MID with no team (never on bye) replaces a mid in Round 11.
  const base = makeTeam(squad);
  const { team, id: rookieId } = addPlaceholder(base, "MID");

  const plan = {
    ...createPlan("Field"),
    rounds: { 11: { boost: false, trades: [{ outId: outPlayer.id, inId: rookieId }] } },
  };

  const { rounds, playersById } = run(team, plan, 12);
  const [r11, r12] = rounds;

  it("lays out 23 on-field and 8 bench spots by line", () => {
    const layout = buildFieldLayout(r11, playersById);
    const field = layout.lines.filter((l) => l.area === "field");
    const bench = layout.lines.filter((l) => l.area === "bench");

    expect(field.map((l) => `${l.position}${l.spots.length}`)).toEqual([
      "DEF6", "MID8", "RUC2", "FWD6", "FLEX1",
    ]);
    expect(bench.map((l) => `${l.position}${l.spots.length}`)).toEqual([
      "DEF2", "MID3", "RUC1", "FWD2",
    ]);
  });

  it("marks the traded-in rookie and lists who went out", () => {
    const layout = buildFieldLayout(r11, playersById);
    const spot = layout.lines.flatMap((l) => l.spots).find((s) => s.player?.id === rookieId)!;

    expect(spot.tradedIn).toBe(true);
    expect(spot.placeholder).toBe(true);
    expect(layout.tradedOut.map((p) => p.id)).toEqual([outPlayer.id]);
  });

  it("marks players on bye in a bye round and counts who is playing", () => {
    const byeTeams = getByeTeams(12, fixtures);
    const layout = buildFieldLayout(r12, playersById);
    const spots = layout.lines.flatMap((l) => l.spots).filter((s) => s.player);

    expect(byeTeams.length).toBeGreaterThan(0);

    for (const spot of spots) {
      expect(spot.onBye).toBe(byeTeams.includes(spot.player!.team));
    }

    // The rookie has no team, so it is never on bye.
    expect(spots.find((s) => s.player!.id === rookieId)!.onBye).toBe(false);

    expect(spots.filter((s) => s.onBye)).toHaveLength(r12.onBye);
    expect(layout.playingTotal).toBe(31 - r12.onBye);
    expect(layout.playingOnField).toBe(
      layout.lines
        .filter((l) => l.area === "field")
        .flatMap((l) => l.spots)
        .filter((s) => s.player && !s.onBye).length,
    );
  });
});
