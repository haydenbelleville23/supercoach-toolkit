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
    render(<FieldDiagram layout={layout} priceFor={(id) => (id === 1 ? 350_000 : null)} />);

    const ridley = screen.getByText("J. Ridley").closest("li")!;
    expect(ridley).toHaveTextContent("$350,000");
    expect(ridley.querySelector("img")?.getAttribute("src")).toContain("ess.png");
    expect(screen.getByText("J. Lloyd").closest("li")).toHaveTextContent("-");
  });

  it("marks IN and BYE with tags, not just colour", () => {
    render(<FieldDiagram layout={layout} priceFor={() => 1} />);

    expect(screen.getByText("J. Ridley").closest("li")).toHaveTextContent("IN");
    const lloyd = screen.getByText("J. Lloyd").closest("li")!;
    expect(lloyd).toHaveTextContent("BYE");
    expect(lloyd.className).toContain("opacity-60");
  });

  it("shows line names, empty slots, the bench, counts and the out list", () => {
    render(<FieldDiagram layout={layout} priceFor={() => 1} />);

    expect(screen.getByText("Defenders")).toBeInTheDocument();
    expect(screen.getByText("Empty")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Bench" })).toHaveTextContent("S. Docherty");
    expect(screen.getByText(/Total playing/).parentElement).toHaveTextContent("Total playing 1/23 · Squad playing 2/31");
    expect(screen.getByText("Tom Stewart").parentElement).toHaveTextContent("Out:");
  });
});
