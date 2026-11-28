// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("DEBUG_AS_OF_ROUND", "10");
});

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
}));

import CashCowsPage from "@/app/cash-cows/page";
import PriceGrid from "@/components/planner/PriceGrid";
import { createPlanProjector } from "@/components/planner/plannerData";
import ProjectionModeControl from "@/components/projector/ProjectionModeControl";
import ProjectorToolFromUrl from "@/components/projector/ProjectorTool";
import { CURRENT_COMPLETED_ROUND } from "@/data/season";
import { calculateCashCowRow, calculateCashCowRows } from "@/lib/cashcows";
import { matchupLabel } from "@/lib/cashcows/matchupLabel";
import { buildPlayerRows } from "@/lib/projector/buildPlayerRows";
import { calculateScaledProjectionRows } from "@/lib/projector/calculateScaledProjectionRows";
import { parseProjectionMode, PROJECTION_MODES } from "@/lib/projector/projectionModes";
import { playerRepository } from "@/lib/repository/PlayerRepository";
import { TEAMS } from "@/lib/teams";

const MATCHUP_KEY = "footynomics.matchup-adjustment.v1";

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// Regular players with a projection and at least one adjusted future round.
const players = playerRepository
  .getAll()
  .filter((p) => p.games >= 5 && Number.isFinite(p.price))
  .filter((p) => {
    const row = calculateCashCowRow(p, "projected", {}, undefined, { matchup: true });
    return row?.projectedRounds.some((r) => (r.matchupAdjustment ?? 0) !== 0);
  })
  .slice(0, 3);

describe("Cash Cows Projected mode uses the Projector's method", () => {
  it("finds three players to compare", () => {
    expect(players).toHaveLength(3);
  });

  it("gives the same round scores (and prices) as the Projector for three players", () => {
    for (const player of players) {
      const projector = calculateScaledProjectionRows(
        buildPlayerRows(player, "projected", {}, { matchup: true }),
        player,
      ).filter((row) => row.round > CURRENT_COMPLETED_ROUND && row.score !== null);
      const cashCows = calculateCashCowRow(player, "projected", {}, undefined, { matchup: true })!;

      for (const round of cashCows.projectedRounds) {
        const same = projector.find((row) => row.round === round.round)!;
        expect(round.score).toBe(same.score);
        expect(round.price).toBe(same.price);
        expect(round.matchupAdjustment ?? null).toBe(same.matchupAdjustment ?? null);
      }
    }
  });

  it("with the switch off, gives the previous (unadjusted) numbers", () => {
    for (const player of players) {
      const off = calculateCashCowRow(player, "projected", {}, undefined, { matchup: false })!;
      const previous = calculateScaledProjectionRows(buildPlayerRows(player, "projected"), player);
      for (const round of off.projectedRounds) {
        expect(round.score).toBe(previous.find((row) => row.round === round.round)!.score);
        expect(round.matchupAdjustment ?? null).toBeNull();
      }
      // Default (no option) is the same as off.
      expect(calculateCashCowRow(player, "projected")!.toppedOutGain).toBe(off.toppedOutGain);
    }
  });

  it("leaves Season Avg, 3RA and 5RA unadjusted", () => {
    for (const player of players) {
      for (const mode of ["season-average", "three-round-average", "five-round-average"] as const) {
        const on = calculateCashCowRow(player, mode, {}, undefined, { matchup: true })!;
        const off = calculateCashCowRow(player, mode, {}, undefined, { matchup: false })!;
        expect(on.projectedRounds.map((r) => r.score)).toEqual(off.projectedRounds.map((r) => r.score));
      }
    }
  });

  it("lets a typed score win over the adjustment", () => {
    const player = players[0];
    const round = calculateCashCowRow(player, "projected", {}, undefined, { matchup: true })!.projectedRounds.find(
      (r) => r.matchupAdjustment,
    )!;
    const edited = calculateCashCowRow(player, "projected", { [player.id]: { [round.round]: 123 } }, undefined, {
      matchup: true,
    })!;
    const after = edited.projectedRounds.find((r) => r.round === round.round)!;
    expect(after.score).toBe(123);
    expect(after.matchupAdjustment).toBeNull();
  });

  it("formats the adjustment as the opponent and a signed number", () => {
    expect(matchupLabel({ opponent: "RIC", homeAway: "A", matchupAdjustment: 6.7 })).toBe("@RIC +6.7");
    expect(matchupLabel({ opponent: "RIC", homeAway: "H", matchupAdjustment: -2 })).toBe("v RIC -2.0");
    expect(matchupLabel({ opponent: "RIC", homeAway: "H", matchupAdjustment: null })).toBeNull();
  });

  it("sorts by Peak gain using the adjusted values, and shows the adjustment in the round cells", () => {
    render(<CashCowsPage />);
    const expected = calculateCashCowRows(playerRepository.getAll(), "projected", {}, undefined, { matchup: true })
      .sort((a, b) => b.toppedOutGain - a.toppedOutGain || 0)
      .slice(0, 5)
      .map((row) => row.toppedOutGain);
    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader").map((h) => h.textContent ?? "");
    const peak = headers.findIndex((t) => t.startsWith("Peak gain"));
    const shown = within(table)
      .getAllByRole("row")
      .slice(1, 6)
      .map((row) => Number(row.querySelectorAll("td")[peak].textContent!.replace(/[^0-9-]/g, "")));
    expect(shown).toEqual(expected);

    // The opponent and adjustment, under the score from sm up and in the cell tooltip.
    const label = table.querySelector("td div[title^='Matchup adjustment:']");
    expect(label).not.toBeNull();
    expect(label!.getAttribute("title")).toMatch(/Matchup adjustment: (@|v )[A-Z]{3} [+±-]\d+\.\d/);
    expect(label!.querySelector(".hidden.sm\\:block")).not.toBeNull();
  });

  it("shares the remembered Matchup adjustment switch (on by default)", () => {
    render(<CashCowsPage />);
    const toggle = screen.getByRole("switch", { name: /Matchup adjustment/ });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle);
    expect(window.localStorage.getItem(MATCHUP_KEY)).toBe("off");
    expect(screen.getByRole("table").querySelector("td div[title^='Matchup adjustment:']")).toBeNull();
  });
});

describe("Projector without Custom", () => {
  it("offers Projected, Season Avg, 3RA and 5RA only", () => {
    render(<ProjectionModeControl value="projected" onChange={vi.fn()} />);
    expect(within(screen.getByRole("radiogroup")).getAllByRole("radio").map((r) => r.textContent)).toEqual([
      "Projected",
      "Season Avg",
      "3RA",
      "5RA",
    ]);
    expect(screen.queryByText("Custom")).toBeNull();
    expect(PROJECTION_MODES).not.toContain("custom");
  });

  it("maps a saved or linked \"custom\" (or anything unknown) to Projected", () => {
    expect(parseProjectionMode("custom")).toBe("projected");
    expect(parseProjectionMode("nonsense")).toBe("projected");
    expect(parseProjectionMode(undefined)).toBe("projected");
    expect(parseProjectionMode("five-round-average")).toBe("five-round-average");
  });

  it("keeps the mode when a score is edited, marks it, and a mode change refills every round", () => {
    render(<ProjectorToolFromUrl />);
    fireEvent.click(screen.getByRole("radio", { name: "3RA" }));
    const input = screen.getAllByRole("textbox", { name: /^Round \d+ score$/ })[0];
    const round = input.getAttribute("aria-label")!.match(/\d+/)![0];

    fireEvent.change(input, { target: { value: "123" } });
    // Still 3RA: no Custom mode to jump to.
    expect(screen.getByRole("radio", { name: "3RA" })).toHaveAttribute("aria-checked", "true");
    const edited = screen.getByRole("textbox", { name: `Round ${round} score (edited)` });
    expect(edited).toHaveValue("123");
    expect(edited.className).toContain("border-emerald-500");

    // The matchup switch keeps edits.
    fireEvent.click(screen.getAllByRole("switch", { name: /Matchup adjustment/ })[0]);
    expect(screen.getByRole("textbox", { name: `Round ${round} score (edited)` })).toHaveValue("123");

    // Picking a mode refills every future round, as before.
    fireEvent.click(screen.getByRole("radio", { name: "Projected" }));
    expect(screen.queryByRole("textbox", { name: /\(edited\)/ })).toBeNull();
    expect(screen.getByRole("textbox", { name: `Round ${round} score` })).not.toHaveValue("123");
  });

  it("has no Custom left in the code or docs", () => {
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        return statSync(full).isDirectory() ? files(full) : /\.(tsx?|md)$/.test(name) ? [full] : [];
      });
    // projectionModes.ts names it once, where an old "custom" is mapped to Projected.
    const offenders = [...files("app"), ...files("components"), ...files("lib"), ...files("docs")]
      .filter((file) => !file.endsWith(path.join("projector", "projectionModes.ts")))
      .filter((file) => /["']custom["']|>Custom<|"Custom"/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("No text club chips beside player names", () => {
  const CODES = new Set(Object.keys(TEAMS));
  const codeChips = (root: HTMLElement) =>
    [...root.querySelectorAll("span")].filter(
      (el) => el.children.length === 0 && CODES.has(el.textContent?.trim() ?? "") && el.getAttribute("role") !== "img",
    );

  it("planner Scores tab: logos, not club codes", () => {
    const team = playerRepository.getAll().filter((p) => p.games >= 5).slice(0, 4);
    const projector = createPlanProjector(null, null, true);
    const { container } = render(
      <PriceGrid
        players={team}
        projector={projector}
        lastRound={CURRENT_COMPLETED_ROUND + 3}
        overrides={{}}
        onOverride={vi.fn()}
        onReset={vi.fn()}
        matchupOn
        onMatchupChange={vi.fn()}
      />,
    );
    expect(codeChips(container)).toEqual([]);
    for (const player of team) {
      expect(container.querySelector(`img[title="${player.team}"]`)).not.toBeNull();
    }
  });

  it("Cash Cows and the Projector: logos, not club codes", () => {
    const { container } = render(<CashCowsPage />);
    expect(codeChips(screen.getByRole("table"))).toEqual([]);
    expect(container.querySelector("tbody img[title]")).not.toBeNull();
    cleanup();

    render(<ProjectorToolFromUrl />);
    // The selected player in the search box: logo before the name, no chip.
    const box = screen.getByRole("combobox", { name: /Search player/ }).parentElement!;
    expect(codeChips(box)).toEqual([]);
    expect(box.querySelector("img[title]")).not.toBeNull();
  });
});
