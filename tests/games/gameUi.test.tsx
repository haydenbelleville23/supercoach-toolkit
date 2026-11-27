// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import GameCard from "@/components/live/GameCard";
import GameTables from "@/components/live/GameTables";
import GameTeamTable from "@/components/live/GameTeamTable";
import { formatKickoff } from "@/lib/games/format";
import { hasTogData, teamTotals } from "@/lib/games/stats";
import type { Game, GamePlayer } from "@/lib/games/types";

const player = (id: number, name: string, score: number, over: Partial<GamePlayer> = {}): GamePlayer => ({
  id,
  name,
  team: "COL",
  positions: ["MID"],
  score,
  minutes: 100,
  tog: null,
  kicks: 10,
  handballs: 8,
  disposals: 18,
  marks: 4,
  tackles: 3,
  hitouts: 0,
  goals: 1,
  behinds: 0,
  price: 500_000,
  priceChange: 10_000,
  priceBefore: 490_000,
  breakeven: 85,
  nextBreakeven: 80,
  ...over,
});

const draw: Game = {
  id: "2026-8-col-haw",
  season: 2026,
  round: 8,
  fixtureId: 1,
  venue: "MCG",
  kickoff: "2026-05-01T19:40:00+10:00",
  home: { team: "COL", teamName: "Collingwood", goals: 14, behinds: 9, total: 93 },
  away: { team: "HAW", teamName: "Hawthorn", goals: 13, behinds: 15, total: 93 },
  margin: 0,
  winner: null,
  quarters: null,
  players: { home: [], away: [] },
};

afterEach(cleanup);

describe("GameCard", () => {
  it("shows goals.behinds and totals, a draw, venue and Melbourne time", () => {
    render(<GameCard game={draw} />);
    const card = screen.getByRole("link");

    expect(card).toHaveAttribute("href", "/live/games/2026-8-col-haw");
    expect(card).toHaveTextContent("14.9");
    expect(card).toHaveTextContent("13.15");
    expect(card).toHaveTextContent("Draw");
    expect(card).toHaveTextContent("MCG");
    expect(card).toHaveTextContent("Fri 1 May, 7:40 pm");
  });

  it("emphasises the winner", () => {
    render(<GameCard game={{ ...draw, away: { ...draw.away, behinds: 14, total: 92 }, margin: 1, winner: "COL" }} />);
    expect(screen.getByText("Collingwood").className).toContain("font-bold");
    expect(screen.getByText("Hawthorn").className).not.toContain("font-bold");
    expect(screen.getByRole("link")).toHaveTextContent("COL by 1");
  });
});

describe("formatKickoff", () => {
  it("applies each kickoff's offset and shows Melbourne time (AEST and AEDT)", () => {
    // Perth game at 4:10 pm local (+08:00) is 6:10 pm in Melbourne.
    expect(formatKickoff("2026-06-13T16:10:00+08:00")).toBe("Sat 13 Jun, 6:10 pm");
    // March, daylight saving in Melbourne (+11:00).
    expect(formatKickoff("2026-03-05T19:30:00+11:00")).toBe("Thu 5 Mar, 7:30 pm");
  });
});

describe("GameTeamTable", () => {
  const players = [
    player(1, "Nick Daicos", 120),
    player(2, "Josh Daicos", 140),
    player(3, "Scott Pendlebury", 90, { handballs: null, disposals: null, priceChange: -5_000 }),
  ];

  it("sorts by SC, highest first, and links each player to the Projector", () => {
    render(<GameTeamTable teamName="Collingwood" team="COL" players={players} showTog={false} />);
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    const names = rows.slice(1, 4).map((r) => within(r).getAllByRole("cell")[0].textContent);
    expect(names[0]).toContain("Daicos");
    expect(rows[1]).toHaveTextContent("140");
    expect(rows[3]).toHaveTextContent("90");
    expect(within(rows[1]).getByRole("link")).toHaveAttribute("href", "/projector?player=2");
  });

  it("can re-sort by another column", () => {
    render(<GameTeamTable teamName="Collingwood" team="COL" players={players} showTog={false} />);
    fireEvent.click(screen.getByRole("button", { name: /Player/ }));
    const first = within(screen.getByRole("table")).getAllByRole("row")[1];
    expect(first).toHaveTextContent("J. Daicos");
  });

  it("hides TOG% when no player has it, and shows it when one does", () => {
    const { unmount } = render(<GameTeamTable teamName="Collingwood" team="COL" players={players} showTog={false} />);
    expect(screen.queryByText("TOG%")).toBeNull();
    unmount();

    render(<GameTeamTable teamName="Collingwood" team="COL" players={players} showTog />);
    expect(screen.getByText("TOG%")).toBeInTheDocument();
    expect(hasTogData(players)).toBe(false);
    expect(hasTogData([player(4, "A B", 1, { tog: 80 })])).toBe(true);
  });

  it("shows a missing stat as - and adds a team totals row without SC", () => {
    render(<GameTeamTable teamName="Collingwood" team="COL" players={players} showTog={false} />);
    const pendles = within(screen.getByRole("table")).getAllByRole("row")[3];
    const cells = within(pendles).getAllByRole("cell").map((c) => c.textContent);
    // Player, SC, D, K, HB ...
    expect(cells[2]).toBe("-");
    expect(cells[4]).toBe("-");
    expect(cells[cells.length - 1]).toBe("−$5,000");

    const totalsRow = screen.getByText("Team totals").closest("tr")!;
    const totals = within(totalsRow).getAllByRole("cell").map((c) => c.textContent);
    expect(totals[1]).toBe(""); // no SC total
    expect(totals[2]).toBe("36"); // disposals: 18 + 18 (+ missing)
    expect(teamTotals(players)).toEqual({ disposals: 36, kicks: 30, handballs: 16, marks: 12, tackles: 9, hitouts: 0, goals: 3 });
  });
});

describe("GameTables Stats | Price toggle", () => {
  const game: Game = {
    ...draw,
    players: {
      home: [
        player(1, "Nick Daicos", 120, { tog: 85, breakeven: 100, priceBefore: 600_000, price: 612_300, priceChange: 12_300, nextBreakeven: 95 }),
        player(2, "Josh Daicos", 70, { tog: 80, breakeven: 110, priceBefore: 550_000, price: 530_000, priceChange: -20_000, nextBreakeven: 130 }),
        player(3, "Rookie Kid", 40, { tog: 60, breakeven: null, priceBefore: 150_000, price: 150_000, priceChange: 0, nextBreakeven: null }),
      ],
      away: [player(4, "James Sicily", 90, { team: "HAW", tog: 82 })],
    },
  };

  const headers = () =>
    within(screen.getAllByRole("table")[0])
      .getAllByRole("columnheader")
      .map((h) => h.textContent?.replace(/[↕▲▼]/g, "").trim());

  it("starts on Stats and switches both tables to the Price columns", () => {
    render(<GameTables game={game} showTog />);
    expect(screen.getByRole("button", { name: "Stats" })).toHaveAttribute("aria-pressed", "true");
    expect(headers()).toEqual(["Player", "SC", "D", "K", "HB", "M", "T", "MIN", "TOG%", "HO", "G", "± Price"]);

    fireEvent.click(screen.getByRole("button", { name: "Price" }));
    expect(headers()).toEqual(["Player", "SC", "TOG%", "BE", "Price", "New price", "Δ Round", "Next BE"]);
    expect(screen.getAllByRole("table")).toHaveLength(2);
    expect(within(screen.getAllByRole("table")[1]).getAllByRole("columnheader")).toHaveLength(8);
  });

  it("shows prices and breakevens, with BE coloured by whether he beat it", () => {
    render(<GameTables game={game} showTog />);
    fireEvent.click(screen.getByRole("button", { name: "Price" }));
    const rows = within(screen.getAllByRole("table")[0]).getAllByRole("row");

    const nick = within(rows[1]).getAllByRole("cell").map((c) => c.textContent);
    expect(nick).toEqual([expect.stringContaining("Daicos"), "120", "85", "100", "$600,000", "$612,300", "+$12,300", "95"]);
    expect(within(rows[1]).getAllByRole("cell")[3].className).toContain("text-emerald-400");

    const josh = within(rows[2]).getAllByRole("cell");
    expect(josh[3].className).toContain("text-red-400");
    expect(josh[6].textContent).toBe("−$20,000");

    // No breakeven yet: "-"; and no totals row in Price view.
    const kid = within(rows[3]).getAllByRole("cell").map((c) => c.textContent);
    expect(kid[3]).toBe("-");
    expect(kid[7]).toBe("-");
    expect(screen.queryByText("Team totals")).toBeNull();
  });

  it("drops TOG% from Price view when the game has none", () => {
    render(<GameTables game={game} showTog={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Price" }));
    expect(headers()).not.toContain("TOG%");
  });
});
