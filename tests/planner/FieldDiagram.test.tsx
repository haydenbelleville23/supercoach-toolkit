// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import FieldDiagram from "@/components/planner/FieldDiagram";
import type { FieldLayout, FieldSpot } from "@/lib/planner/fieldLayout";
import type { Player } from "@/types/player";

const player = (id: number, name: string, team: string, positions = ["DEF"]): Player => ({
  id,
  championDataId: null,
  name,
  team,
  teamName: team,
  positions,
  price: 400_000 + id,
  games: 5,
  average: 80,
  average3: 80,
  average5: 80,
  recentScores: [],
  history: [],
  breakeven: 70,
  ownership: null,
  previousGames: 20,
  previousAverage: 80,
  active: true,
  availability: null,
});

const spot = (id: number, p: Player | null, extra: Partial<FieldSpot> = {}): FieldSpot => ({
  slotId: `s${id}`,
  player: p,
  onBye: false,
  unavailable: false,
  tradedIn: false,
  placeholder: false,
  ...extra,
});

afterEach(cleanup);

describe("FieldDiagram", () => {
  const layout: FieldLayout = {
    lines: [
      {
        area: "field",
        position: "DEF",
        spots: [
          spot(1, player(1, "Jordan Ridley", "ESS"), { tradedIn: true }),
          spot(2, player(2, "Jake Lloyd", "SYD"), { onBye: true }),
          spot(3, null),
        ],
      },
      { area: "bench", position: "DEF", spots: [spot(4, player(4, "Sam Docherty", "CAR"))] },
    ],
    tradedOut: [player(9, "Tom Stewart", "GEE")],
    playingOnField: 1,
    onFieldSlots: 23,
    playingTotal: 2,
    squadSize: 31,
  };

  it("renders cards with short name, team logo and that round's price", () => {
    render(<FieldDiagram round={11} layout={layout} priceFor={(id) => (id === 1 ? 350_000 : null)} />);

    const ridley = screen.getByText("J. Ridley").closest("li")!;
    expect(ridley).toHaveTextContent("$350,000");
    expect(ridley.querySelector("img")?.getAttribute("src")).toContain("ess.png");
    expect(screen.getByText("J. Lloyd").closest("li")).toHaveTextContent("-");
  });

  it("marks IN and BYE with tags, not just colour", () => {
    render(<FieldDiagram round={11} layout={layout} priceFor={() => 1} />);

    expect(screen.getByText("J. Ridley").closest("li")).toHaveTextContent("IN");
    const lloyd = screen.getByText("J. Lloyd").closest("li")!;
    expect(lloyd).toHaveTextContent("BYE");
    expect(lloyd.className).toContain("opacity-60");
  });

  it("shows line names, empty slots, the bench, counts and the out list", () => {
    render(<FieldDiagram round={11} layout={layout} priceFor={() => 1} />);

    expect(screen.getByText("Defenders")).toBeInTheDocument();
    expect(screen.getByText("Empty")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Bench" })).toHaveTextContent("S. Docherty");
    expect(screen.getByText(/Total playing/).parentElement).toHaveTextContent("Total playing 1/23 · Squad playing 2/31");
    expect(screen.getByText("Tom Stewart").parentElement).toHaveTextContent("Out:");
  });
});

describe("FieldDiagram cards", () => {
  const names = [
    "Luke Davies-Uniacke",
    "Jason Horne-Francis",
    "Sam Ralphsmith",
    "Jordan Ridley",
    "Jake Lloyd",
    "Nick Daicos",
  ];
  const sixDefenders: FieldLayout = {
    lines: [{ area: "field", position: "DEF", spots: names.map((n, i) => spot(20 + i, player(20 + i, n, "NTH"))) }],
    tradedOut: [],
    playingOnField: 6,
    onFieldSlots: 23,
    playingTotal: 6,
    squadSize: 31,
  };

  it("puts at most three cards in a row, so six defenders make two rows", () => {
    render(<FieldDiagram round={11} layout={sixDefenders} priceFor={() => 300_000} />);
    const list = screen.getByText("Defenders").nextElementSibling!;
    expect(list.tagName).toBe("UL");
    expect(list.className).toContain("grid-cols-3");
    expect(list.className).toContain("sm:grid-cols-[repeat(3,9rem)]");
    expect(list.children).toHaveLength(6);
  });

  it("never truncates long names, and gives the full name to screen readers", () => {
    render(<FieldDiagram round={11} layout={sixDefenders} priceFor={() => 300_000} />);
    for (const short of ["L. Davies-Uniacke", "J. Horne-Francis", "S. Ralphsmith"]) {
      const shown = screen.getByText(short);
      expect(shown.className).not.toMatch(/truncate|line-clamp|text-ellipsis/);
      expect(shown.closest("li")!.className).not.toMatch(/truncate|overflow-hidden/);
    }
    for (const full of ["Luke Davies-Uniacke", "Jason Horne-Francis", "Sam Ralphsmith"]) {
      expect(screen.getByText(new RegExp(`^${full}, NTH`))).toHaveClass("sr-only");
    }
  });

  it("puts the price on the left and the markers on the right of line 2", () => {
    const tradedIn: FieldLayout = {
      ...sixDefenders,
      lines: [{ area: "field", position: "DEF", spots: [spot(1, player(1, "Jordan Ridley", "ESS"), { tradedIn: true })] }],
    };
    render(<FieldDiagram round={11} layout={tradedIn} priceFor={(id) => (id === 1 ? 350_000 : 1)} />);
    const ridley = screen.getByText("J. Ridley").closest("li")!;
    const line2 = screen.getByText("$350,000").parentElement!;
    expect(line2.closest("li")).toBe(ridley);
    expect(line2.lastElementChild).toHaveTextContent("IN");
  });
});
