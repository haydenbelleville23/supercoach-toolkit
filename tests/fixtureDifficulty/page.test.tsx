// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import FixtureDifficultyTool from "@/components/fixtureDifficulty/FixtureDifficultyTool";
import type { FixtureRow } from "@/lib/fixtureDifficulty/fixtureDifficulty";
import type { FixtureDifficultyData } from "@/lib/fixtureDifficulty/pageData";

const row = (team: string, rest: number | null, next5: number | null, opponent = "WCE"): FixtureRow => ({
  team,
  rest,
  next5,
  cells: [0, 1, 2, 3].map((round) =>
    round === 2
      ? { round, opponent: null, homeAway: null, bye: true, value: null, n: 0 }
      : { round, opponent, homeAway: round % 2 ? "A" : "H", bye: false, value: 2.3, n: 12 },
  ),
});

function data(over: Partial<FixtureDifficultyData> = {}): FixtureDifficultyData {
  const rows = [row("ADE", 1, 4), row("BRL", 5, -2), row("CAR", -3, 9)];
  return {
    season: 2026,
    preseason: false,
    basis: { kind: "current", season: 2026 },
    sampleFixtures: false,
    noFixtures: false,
    asOfRound: 1,
    lastRound: 3,
    hasFutureRounds: true,
    teams: ["ADE", "BRL", "CAR"],
    fixtures: { DEF: rows, MID: rows, RUC: rows, FWD: rows },
    positions: [
      { team: "ADE", cells: { MID: { value: 4.2, n: 25 }, RUC: { value: -6, n: 4 } } },
      { team: "BRL", cells: { MID: { value: -1, n: 18 } } },
      { team: "CAR", cells: {} },
    ],
    teamTotals: [
      { team: "ADE", games: 10, pointsFor: 1700, pointsAgainst: 1600, net: -100 },
      { team: "BRL", games: 10, pointsFor: 1600, pointsAgainst: 1700, net: 100 },
      { team: "CAR", games: 10, pointsFor: 1650, pointsAgainst: 1670, net: 20 },
    ],
    ...over,
  };
}

const firstColumn = () =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(r).getAllByRole("cell")[0].textContent);

afterEach(cleanup);

describe("Fixture Difficulty page", () => {
  it("opens on Fixtures, sorted by Next 5 (highest first), from the next round", () => {
    render(<FixtureDifficultyTool data={data()} />);
    expect(screen.getByRole("tab", { name: "Fixtures" })).toHaveAttribute("aria-selected", "true");
    expect(firstColumn()).toEqual(["CARCarlton", "ADEAdelaide Crows", "BRLBrisbane Lions"]);

    const headers = within(screen.getByRole("table")).getAllByRole("columnheader").map((h) => h.textContent?.replace(/[↕▲▼]/g, "").trim());
    expect(headers).toEqual(["Team", "Rest", "Next 5", "R2", "R3"]);
  });

  it("shows the opponent with @ for away, the signed value, and BYE", () => {
    render(<FixtureDifficultyTool data={data()} />);
    const first = within(screen.getByRole("table")).getAllByRole("row")[1];
    const cells = within(first).getAllByRole("cell").map((c) => c.textContent);
    expect(cells[3]).toBe("BYE");
    expect(cells[4]).toBe("@WCE+2.3");
  });

  it("sorts by Rest and team name", () => {
    render(<FixtureDifficultyTool data={data()} />);
    fireEvent.click(screen.getByRole("button", { name: /Rest/ }));
    expect(firstColumn()[0]).toContain("BRL");
    fireEvent.click(screen.getByRole("button", { name: /^Team/ }));
    expect(firstColumn()[0]).toContain("ADE");
  });

  it("shows earlier rounds (marked completed) when asked", () => {
    render(<FixtureDifficultyTool data={data()} />);
    fireEvent.click(screen.getByLabelText("Show earlier rounds"));
    const headers = within(screen.getByRole("table")).getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers.some((h) => h?.includes("R0 ✓"))).toBe(true);
  });

  it("shows the whole season, labelled completed, in the offseason", () => {
    render(<FixtureDifficultyTool data={data({ asOfRound: 3, hasFutureRounds: false })} />);
    expect(screen.getByText(/The season is complete/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Show earlier rounds")).toBeNull();
    const headers = within(screen.getByRole("table")).getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers.filter((h) => h?.includes("✓"))).toHaveLength(4);
  });

  it("Positions: value and n, low samples marked, sortable by column", () => {
    render(<FixtureDifficultyTool data={data()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Positions" }));
    expect(screen.getByText("n=4 · low")).toBeInTheDocument();
    expect(screen.getByText("n=25")).toBeInTheDocument();
    // Default MID highest first; CAR has no MID cell, so it sorts last.
    expect(firstColumn()).toEqual(["ADEAdelaide Crows", "BRLBrisbane Lions", "CARCarlton"]);
    fireEvent.click(screen.getByRole("button", { name: /^RUC/ }));
    expect(firstColumn()[0]).toContain("ADE");
  });

  it("Teams: For, Against, Net sorted highest first and coloured by the Net threshold", () => {
    render(<FixtureDifficultyTool data={data()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Teams" }));
    expect(firstColumn()[0]).toContain("BRL");
    const net = (team: string) =>
      within(screen.getByRole("table"))
        .getAllByRole("row")
        .find((r) => r.textContent?.includes(team))!
        .querySelector(".fd-cell")!;
    expect(net("BRL")).toHaveAttribute("data-band", "easy");
    expect(net("ADE")).toHaveAttribute("data-band", "hard");
    expect(net("CAR")).toHaveAttribute("data-band", "neutral");
    expect(net("CAR")).toHaveTextContent("+20.0");
  });

  it("says so when there aren't enough games yet", () => {
    render(<FixtureDifficultyTool data={data({ positions: [{ team: "ADE", cells: {} }] })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Not enough games yet");
  });

  it("has a legend with signed numbers", () => {
    render(<FixtureDifficultyTool data={data()} />);
    expect(screen.getByText(/Harder opponent/)).toBeInTheDocument();
    expect(screen.getByText("−4.0")).toHaveAttribute("data-band", "hard");
  });
});
