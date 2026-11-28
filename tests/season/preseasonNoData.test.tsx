// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// A 2027 preseason where last season's players data can't be found.
vi.hoisted(() => {
  vi.stubEnv("DEBUG_SEASON", "2027");
  vi.stubEnv("PLAYERS_DATA_SEASON", "2024");
});

vi.mock("@/data/2026/fixtures-raw.json", async () => {
  const { readFileSync } = await import("node:fs");
  return { default: JSON.parse(readFileSync("data/2027/fixtures.sample.json", "utf8")) };
});

import FixtureDifficultyTool from "@/components/fixtureDifficulty/FixtureDifficultyTool";
import { getFixtureDifficultyData } from "@/lib/fixtureDifficulty/pageData";

afterEach(cleanup);

describe("Fixture Difficulty in preseason without last season's data", () => {
  it("shows the fixtures without values, and says so", () => {
    const data = getFixtureDifficultyData();
    expect(data.basis).toEqual({ kind: "none", season: 2026 });
    expect(data.positions.every((row) => Object.keys(row.cells).length === 0)).toBe(true);
    expect(data.fixtures.MID.flatMap((r) => r.cells).every((c) => c.value === null)).toBe(true);
    expect(data.fixtures.MID[0].cells.some((c) => c.opponent)).toBe(true);

    render(<FixtureDifficultyTool data={data} />);
    expect(
      screen.getByText("No 2026 results were found, so the 2027 fixtures are shown without difficulty values."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Not enough games yet/)).toBeNull();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});
