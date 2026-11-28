// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// npm run dev:2027 with the sample fixtures, as next.config.ts sets it up:
// DEBUG_SEASON=2027, the fixtures import pointing at the sample, and the
// players data still 2026's (there is no 2027 players file).
vi.hoisted(() => {
  vi.stubEnv("DEBUG_SEASON", "2027");
});

vi.mock("@/data/2026/fixtures-raw.json", async () => {
  const { readFileSync } = await import("node:fs");
  return { default: JSON.parse(readFileSync("data/2027/fixtures.sample.json", "utf8")) };
});

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
}));

import Home from "@/app/page";
import CashCowsPage from "@/app/cash-cows/page";
import LivePage from "@/app/live/page";
import ResultsPage from "@/app/live/results/page";
import MyTeamPage from "@/app/my-team/page";
import ProjectorPage from "@/app/projector/page";
import TradePlannerPage from "@/app/trade-planner/page";
import FixtureDifficultyTool from "@/components/fixtureDifficulty/FixtureDifficultyTool";
import MyTeamTile from "@/components/home/MyTeamTile";
import {
  CURRENT_COMPLETED_ROUND,
  IS_PRESEASON,
  PLAYERS_DATA_SEASON,
  SEASON_PHASE,
  SEASON_YEAR,
} from "@/data/season";
import { FIXTURES_ARE_SAMPLE, FIXTURES_SEASON } from "@/lib/fixtures";
import { getFixtureDifficultyData } from "@/lib/fixtureDifficulty/pageData";
import { seasonsWithGames } from "@/lib/games/read";

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DEBUG_SEASON=2027 with the sample fixtures", () => {
  it("is the 2027 preseason (2026's players don't complete 2027 rounds)", () => {
    expect(SEASON_YEAR).toBe(2027);
    expect(FIXTURES_SEASON).toBe(2027);
    expect(FIXTURES_ARE_SAMPLE).toBe(true);
    expect(PLAYERS_DATA_SEASON).toBe(2026);
    expect(CURRENT_COMPLETED_ROUND).toBe(-1);
    expect(SEASON_PHASE).toBe("preseason");
    expect(IS_PRESEASON).toBe(true);
  });
});

describe("Fixture Difficulty in preseason", () => {
  const data = getFixtureDifficultyData();

  it("uses 2026's final data on the 2027 fixtures, every round from Round 0", () => {
    expect(data).toMatchObject({ season: 2027, preseason: true, basis: { kind: "previous", season: 2026 }, sampleFixtures: true });
    expect(data.asOfRound).toBe(-1);
    expect(data.hasFutureRounds).toBe(true);
    const valued = data.positions.reduce((n, row) => n + Object.keys(row.cells).length, 0);
    expect(valued).toBeGreaterThan(0);

    // Every team has a row covering Rounds 0 to 24, with byes, values, Rest and Next 5.
    const rows = data.fixtures.MID;
    expect(rows).toHaveLength(18);
    for (const row of rows) {
      expect(row.cells.map((c) => c.round)).toEqual(Array.from({ length: 25 }, (_, i) => i));
      expect(row.cells.filter((c) => c.bye)).toHaveLength(2);
      expect(row.rest).not.toBeNull();
      expect(row.next5).not.toBeNull();
    }
    expect(rows.flatMap((r) => r.cells).some((c) => !c.bye && c.value !== null)).toBe(true);
  });

  it("labels the basis and the sample, and shows every round with none marked completed", () => {
    render(<FixtureDifficultyTool data={data} />);
    expect(screen.getByText("Based on 2026 results; updates as 2027 scores arrive.")).toBeInTheDocument();
    expect(screen.getByText("Sample fixtures (invented, for testing)")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Show earlier rounds/ })).toBeNull();
    const headers = within(screen.getByRole("table")).getAllByRole("columnheader")
      .map((h) => (h.textContent ?? "").replace(/[↕▲▼]/g, "").trim());
    expect(headers).toEqual(expect.arrayContaining(["Rest", "Next 5", "R0", "R1", "R24"]));
    expect(headers.some((h) => h.includes("✓"))).toBe(false);
  });
});

describe("preseason pages", () => {
  const expectNotice = (tool: string) => {
    const notice = screen.getByRole("status", { name: `${tool} opens when AFL SuperCoach launches` });
    expect(within(notice).getByRole("link", { name: "See Fixture Difficulty" })).toHaveAttribute(
      "href",
      "/fixture-difficulty",
    );
    expect(notice).toHaveTextContent("2027 players and prices aren't out yet");
  };

  it.each([
    ["Price Projector", ProjectorPage],
    ["Cash Cows", CashCowsPage],
    ["Trade Planner", TradePlannerPage],
    ["My Team", MyTeamPage],
    ["Live Scores", LivePage],
  ] as const)("%s shows the shared preseason notice, with no prices", (tool, Page) => {
    render(<Page />);
    expectNotice(tool);
    expect(screen.queryByRole("table")).toBeNull();
    expect(document.body.textContent).not.toMatch(/\$\d{3},\d{3}/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("the home page has the preseason banner and keeps the tiles", () => {
    render(<Home />);
    expect(screen.getByText(/2027 fixtures are in\. Prices and players open when AFL SuperCoach launches\./)).toBeInTheDocument();
    for (const tile of ["My Team", "Projector", "Cash Cows", "Trade Planner", "Fixture Difficulty", "Live Scores"]) {
      expect(screen.getAllByRole("heading", { name: tile }).length).toBeGreaterThan(0);
    }
  });

  it("the Results archive opens on 2026 (the last season with games) and keeps the season switcher", async () => {
    expect(seasonsWithGames()[0]).toBe(2026);
    render(await ResultsPage({ searchParams: Promise.resolve({}) }));
    expect(document.body.textContent).toMatch(/2026/);
    expect(document.body.textContent).toMatch(/Round 24/);
  });

  it("2027 starts with no saved team: the 2026 team is kept, not migrated", () => {
    window.localStorage.setItem(
      "footynomics.my-team.v1",
      JSON.stringify({
        version: 1,
        season: 2026,
        asOfRound: 24,
        players: [{ id: 1, pin: null }],
        cashInBank: 0,
        tradesRemaining: 0,
        boostsRemaining: 0,
        plans: [],
        activePlanId: null,
        updatedAt: "2026-09-01T00:00:00Z",
      }),
    );
    render(<MyTeamTile />);
    expect(screen.getByText("Add your team")).toBeInTheDocument();
    expect(window.localStorage.getItem("footynomics.my-team.v1")).toContain('"season":2026');
    expect(window.localStorage.getItem("footynomics.my-team.v1.2027")).toBeNull();
  });
});
