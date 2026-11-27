import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

// Rounds after 10 must be invisible everywhere.
vi.hoisted(() => {
  vi.stubEnv("DEBUG_AS_OF_ROUND", "10");
});

import GamePage, { generateStaticParams } from "@/app/live/games/[gameId]/page";
import ResultsPage from "@/app/live/results/page";
import { byeTeams } from "@/lib/games/format";
import { findGame, readRoundGames, seasonsWithGames, visibleRoundsFor } from "@/lib/games/read";

const roundFile = (round: number) =>
  JSON.parse(readFileSync(path.resolve(`data/2026/games/round-${String(round).padStart(2, "0")}.json`), "utf8"));

const round11Id: string = roundFile(11).games[0].id;
const round10Id: string = roundFile(10).games[0].id;

/** notFound() throws an error whose digest marks a 404. */
async function expectNotFound(promise: Promise<unknown>) {
  await expect(promise).rejects.toMatchObject({ digest: expect.stringContaining("404") });
}

describe("results archive under DEBUG_AS_OF_ROUND=10", () => {
  it("shows rounds 0-10 only", () => {
    expect(visibleRoundsFor(2026)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(seasonsWithGames()).toEqual([2026]);
  });

  it("can't read a later round or game", () => {
    expect(readRoundGames(2026, 11)).toBeNull();
    expect(findGame(round11Id)).toBeNull();
    expect(findGame(round10Id)?.round).toBe(10);
  });

  it("builds game pages for visible rounds only", () => {
    const ids = generateStaticParams().map((p) => p.gameId);
    expect(ids).toContain(round10Id);
    expect(ids).not.toContain(round11Id);
    expect(ids.every((id) => Number(id.split("-")[1]) <= 10)).toBe(true);
  });

  it("returns not found for a direct URL to a hidden round or unknown game", async () => {
    await expectNotFound(GamePage({ params: Promise.resolve({ gameId: round11Id }) }));
    await expectNotFound(GamePage({ params: Promise.resolve({ gameId: "2026-5-xxx-yyy" }) }));
    await expectNotFound(GamePage({ params: Promise.resolve({ gameId: "not-a-game" }) }));
    await expectNotFound(ResultsPage({ searchParams: Promise.resolve({ round: "11" }) }));
    await expectNotFound(ResultsPage({ searchParams: Promise.resolve({ round: "99" }) }));
    await expectNotFound(ResultsPage({ searchParams: Promise.resolve({ round: "abc" }) }));
    await expectNotFound(ResultsPage({ searchParams: Promise.resolve({ season: "2031" }) }));
  });

  it("renders a visible round and game", async () => {
    await expect(ResultsPage({ searchParams: Promise.resolve({ round: "10" }) })).resolves.toBeTruthy();
    await expect(GamePage({ params: Promise.resolve({ gameId: round10Id }) })).resolves.toBeTruthy();
  });
});

describe("byes", () => {
  it("lists the clubs with no game in a bye round", () => {
    const games = roundFile(12).games;
    expect(games).toHaveLength(7);
    expect(byeTeams(games)).toHaveLength(4);
    expect(byeTeams(roundFile(10).games)).toEqual([]);
  });
});
