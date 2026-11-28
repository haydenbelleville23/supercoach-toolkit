import { describe, expect, it, vi } from "vitest";

// Needs a bye still to come, so it runs as of Round 10.
vi.hoisted(() => {
  vi.stubEnv("DEBUG_AS_OF_ROUND", "10");
});

import { getTeamFixture } from "@/lib/fixtures";
import { getPlayers } from "@/lib/players";
import { buildPlayerRows } from "@/lib/projector/buildPlayerRows";
import { calculateScaledProjectionRows } from "@/lib/projector/calculateScaledProjectionRows";

describe("Projector bye rounds", () => {
  // A regular whose team has a bye after Round 12 (two projected games
  // first, so his price can move in the rounds either side).
  const player = getPlayers().find(
    (p) =>
      p.games >= 5 &&
      [13, 14, 15, 16].some((round) => !getTeamFixture(p.team, round)),
  )!;
  const byeRound = [13, 14, 15, 16].find((round) => !getTeamFixture(player.team, round))!;

  it("gives no score and holds the price in a bye", () => {
    for (const mode of ["projected", "season-average", "three-round-average", "five-round-average"] as const) {
      const rows = calculateScaledProjectionRows(buildPlayerRows(player, mode), player);
      const bye = rows.find((r) => r.round === byeRound)!;
      const before = rows.find((r) => r.round === byeRound - 1)!;
      const after = rows.find((r) => r.round === byeRound + 1)!;

      expect(bye.played).toBe(false);
      expect(bye.score).toBeNull();
      expect(bye.price).toBe(before.price);
      expect(bye.priceChange).toBeNull();
      expect(bye.breakEven).toBeNull();
      // He plays again the next round and his price moves.
      expect(after.played).toBe(true);
      expect(after.priceChange).not.toBeNull();
    }
  });

  it("keeps the bye unplayed even when a score is typed for it", () => {
    const rebuilt = buildPlayerRows(player, "projected", { [byeRound]: 90 });
    expect(rebuilt.find((r) => r.round === byeRound)!.score).toBeNull();
    expect(rebuilt.find((r) => r.round === byeRound)!.played).toBe(false);
  });
});
