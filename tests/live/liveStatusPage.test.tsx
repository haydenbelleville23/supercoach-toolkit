// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { normaliseDfsLiveFeed, type RawDfsPlayer } from "@/lib/liveMatch/dfsAustralia";
import type { DfsLiveFeed } from "@/lib/liveMatch";
import { playerRepository } from "@/lib/repository/PlayerRepository";

const nav = vi.hoisted(() => ({ search: "", replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/live",
}));

// The season data is complete, so there's no next round to project and the
// table would be empty: show Round 24 as the live round.
vi.mock("@/data/season", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/data/season")>()),
  CURRENT_COMPLETED_ROUND: 23,
}));

// Even if the sample were loaded, it must never be used without the debug lock.
vi.mock("@/lib/liveMatch/liveSample", async () => {
  const { readFileSync } = await import("node:fs");
  const { normaliseDfsLiveFeed: normalise } = await import("@/lib/liveMatch/dfsAustralia");
  return { liveSampleFeed: normalise(JSON.parse(readFileSync("data/2026/live-sample.fixture.json", "utf8"))) };
});

import LivePage from "@/app/live/page";

/** The first n players of a team that the feed can match. */
function teamPlayers(team: string, n: number) {
  return playerRepository
    .getAll()
    .filter((p) => p.team === team && p.championDataId && Number.isFinite(p.price) && p.games >= 15)
    .sort((a, b) => b.price - a.price)
    .slice(0, n);
}

const [ander, mccreery, frampton, hill, maynard] = teamPlayers("COL", 5);
const [murphy] = teamPlayers("BRL", 1);
const [dodson, tauru] = teamPlayers("STK", 2);
const [davies] = teamPlayers("GCS", 1);
const carlton = teamPlayers("CAR", 2);
const fremantle = teamPlayers("FRE", 2);

function raw(p: { championDataId: string | null; name: string; team: string }, fixture: number, homeAway: string, extra: Partial<RawDfsPlayer> = {}): RawDfsPlayer {
  return {
    playerId: p.championDataId!,
    playerName: p.name,
    id: fixture,
    teamAbbr: p.team,
    homeAway,
    superCoachPoints: 50,
    dreamTeamPoints: 40,
    playerJumperNumber: 1,
    ...extra,
  };
}

// Real 2026 Round 24 pairings (see gameParam.test.tsx).
const liveFeed: DfsLiveFeed = normaliseDfsLiveFeed({
  timeStamp: ["2026-09-26 07:40:11"],
  status: ["ok"],
  fixtures: [
    { id: 101, status: "CONCLUDED", homeTeam: "STK", awayTeam: "GCS", homeScore: 80, awayScore: 70, progress: 100 },
    { id: 102, status: "LIVE", homeTeam: "COL", awayTeam: "BRL", homeScore: 50, awayScore: 40, progress: 60 },
    { id: 103, status: "SCHEDULED", homeTeam: "CAR", awayTeam: "FRE", progress: 0 },
  ],
  playerStats: [
    raw(ander, 102, "home", { onBench: 0, benchReason: "", timeOnGroundPercentage: 80, superCoachPoints: 90 }),
    raw(mccreery, 102, "home", { onBench: 1, benchReason: "  Blood rule ", timeOnGroundPercentage: 60, superCoachPoints: 80 }),
    raw(frampton, 102, "home", { onBench: 1, timeOnGroundPercentage: 55, superCoachPoints: 70 }),
    // No onBench key: no tag, counts as on ground.
    raw(hill, 102, "home", { timeOnGroundPercentage: 75, superCoachPoints: 60 }),
    // Reason without the bench flag: "?", and no TOG key.
    raw(maynard, 102, "home", { onBench: 0, benchReason: "Mystery", superCoachPoints: 50 }),
    raw(murphy, 102, "away", { onBench: 0, timeOnGroundPercentage: 70 }),
    raw(dodson, 101, "home", { onBench: 1, timeOnGroundPercentage: 70, superCoachPoints: 90 }),
    raw(tauru, 101, "home", { onBench: 0, benchReason: "Late change", timeOnGroundPercentage: 70, superCoachPoints: 80 }),
    raw(davies, 101, "away", { onBench: 0, timeOnGroundPercentage: 70 }),
    ...carlton.map((p) => raw(p, 103, "home", { superCoachPoints: 0 })),
    ...fremantle.map((p) => raw(p, 103, "away", { superCoachPoints: 0 })),
  ],
});

let served: unknown = liveFeed;

beforeEach(() => {
  nav.search = "";
  served = liveFeed;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(served), { status: 200, headers: { "Content-Type": "application/json" } })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const table = () => screen.getByRole("table");
const rowOf = (name: string) => within(table()).getByRole("link", { name }).closest("tr")!;
// Status tags only (not the watchlist star).
const tagsIn = (row: HTMLElement) =>
  within(row)
    .queryAllByRole("button")
    .filter((b) => !b.hasAttribute("aria-pressed"))
    .map((b) => b.textContent?.trim());
const filterButton = (label: RegExp) =>
  within(screen.getByRole("group", { name: "Filter by in-game status" })).getByRole("button", { name: label });
const shownNames = () =>
  within(table())
    .getAllByRole("link")
    .map((a) => a.getAttribute("aria-label"));

async function openGame(home: string, away: string) {
  await screen.findByRole("table");
  const card = screen
    .getAllByRole("button")
    .find((b) => b.textContent?.includes(home) && b.textContent?.includes(away) && !b.closest("table"))!;
  fireEvent.click(card);
}

describe("Live page in-game status", () => {
  it("tags bench and unclear players beside the name, with the reason as text in the details", async () => {
    render(<LivePage />);
    await screen.findByRole("table");

    expect(tagsIn(rowOf(mccreery.name))).toEqual(["BENCH"]);
    expect(tagsIn(rowOf(frampton.name))).toEqual(["BENCH"]);
    expect(tagsIn(rowOf(maynard.name))).toEqual(["?"]);
    expect(tagsIn(rowOf(ander.name))).toEqual([]);
    expect(tagsIn(rowOf(hill.name))).toEqual([]);

    const tag = within(rowOf(mccreery.name)).getByRole("button", { name: /^BENCH:/ });
    expect(tag.getAttribute("aria-label")).toContain("Feed reason: Blood rule");
    expect(tag.getAttribute("aria-label")).not.toMatch(/^BLOOD/);
    // An icon as well as the text.
    expect(tag.querySelector("svg")).not.toBeNull();
    // Not the shared square availability badge style.
    expect(tag.className).toContain("rounded-full");
  });

  it("dims bench rows only (not unclear or untagged players)", async () => {
    render(<LivePage />);
    await screen.findByRole("table");
    const muted = (name: string) => rowOf(name).hasAttribute("data-muted");
    expect(muted(mccreery.name)).toBe(true);
    expect(muted(frampton.name)).toBe(true);
    expect(muted(maynard.name)).toBe(false);
    expect(muted(hill.name)).toBe(false);
    expect(muted(ander.name)).toBe(false);
  });

  it("shows TOG, with - where the feed didn't give it", async () => {
    render(<LivePage />);
    await screen.findByRole("table");
    const headers = within(table()).getAllByRole("columnheader").map((h) => h.textContent?.trim());
    const tog = headers.indexOf("TOG");
    expect(tog).toBeGreaterThan(0);
    const togCell = (name: string) => rowOf(name).querySelectorAll("td")[tog].textContent;
    expect(togCell(ander.name)).toBe("80%");
    expect(togCell(maynard.name)).toBe("-");
  });

  it("filters by status with counts; no status counts as on ground, ? only under All", async () => {
    render(<LivePage />);
    await screen.findByRole("table");

    expect(filterButton(/^On ground/)).toHaveTextContent("On ground2");
    expect(filterButton(/^On bench/)).toHaveTextContent("On bench2");
    expect(filterButton(/^Off/)).toHaveTextContent("Off0");
    expect(filterButton(/^Off/)).toBeDisabled();
    expect(filterButton(/^All/)).toHaveTextContent("All5");
    expect(filterButton(/^All/)).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(filterButton(/^On bench/));
    expect(shownNames()).toEqual([mccreery.name, frampton.name]);

    fireEvent.click(filterButton(/^On ground/));
    expect(shownNames()).toEqual([ander.name, hill.name]);

    fireEvent.click(filterButton(/^All/));
    expect(shownNames()).toHaveLength(5);
  });

  it("hides BENCH at full time, keeps ?, and says it's an assumption", async () => {
    render(<LivePage />);
    await openGame("STK", "GCS");
    await waitFor(() => expect(within(table()).getByRole("link", { name: dodson.name })).toBeInTheDocument());

    expect(tagsIn(rowOf(dodson.name))).toEqual([]);
    expect(rowOf(dodson.name)).not.toHaveAttribute("data-muted");
    expect(tagsIn(rowOf(tauru.name))).toEqual(["?"]);
    // A new game starts on All.
    expect(filterButton(/^All/)).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "About in-game status" }));
    expect(await screen.findByText(/hidden at full time/)).toHaveTextContent(/checked against the real feed in March/);
  });

  it("hides the TOG column and the filter when no one in the game has them", async () => {
    render(<LivePage />);
    await openGame("CAR", "FRE");
    await waitFor(() => expect(within(table()).getByRole("link", { name: carlton[0].name })).toBeInTheDocument());
    expect(within(table()).queryByRole("columnheader", { name: "TOG" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Filter by in-game status" })).toBeNull();
    expect(tagsIn(rowOf(carlton[0].name))).toEqual([]);
  });

  it("shows the dormant feed message, with no filter", async () => {
    served = normaliseDfsLiveFeed({ timeStamp: ["2026-11-28"], status: ["DORMANT"], fixtures: [{ id: 404 }], playerStats: [] });
    render(<LivePage />);
    expect(await screen.findByText(/No games are in the live feed/)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Filter by in-game status" })).toBeNull();
  });

  it("has no watchlist stars", async () => {
    render(<LivePage />);
    await screen.findByRole("table");
    expect(screen.queryByRole("button", { name: /watchlist/i })).toBeNull();
  });

  it("never uses the sample without the debug lock: fetches the real feed, no sample label", async () => {
    render(<LivePage />);
    await screen.findByRole("table");
    expect(fetch).toHaveBeenCalledWith("/api/live-scores", expect.anything());
    expect(screen.queryByText(/Sample live data/)).toBeNull();
    expect(screen.queryByText("HAW")).toBeNull();
  });
});
