// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { readdirSync } from "node:fs";
import path from "node:path";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PlayerCell from "@/components/ui/PlayerCell";
import PlayerSelect from "@/components/ui/PlayerSelect";
import TeamLogo from "@/components/ui/TeamLogo";
import { TEAMS } from "@/lib/teams";
import type { Player } from "@/types/player";

afterEach(cleanup);

const player = (id: number, name: string, team: string, teamName: string): Player => ({
  id,
  championDataId: null,
  name,
  team,
  teamName,
  positions: ["MID"],
  price: 500_000,
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

describe("TeamLogo", () => {
  it("uses the full club name as alt text and the club code as the title", () => {
    render(<TeamLogo team="COL" />);
    const img = screen.getByRole("img", { name: "Collingwood" });
    expect(img).toHaveAttribute("title", "COL");
    expect(img).toHaveAttribute("width", "20");
  });

  it("falls back to the text club chip when the image fails to load", () => {
    render(<TeamLogo team="GWS" />);
    fireEvent.error(screen.getByRole("img"));
    const chip = screen.getByRole("img", { name: "GWS Giants" });
    expect(chip.tagName).toBe("SPAN");
    expect(chip).toHaveTextContent("GWS");
  });

  it("shows an empty circle for a player with no club", () => {
    render(<TeamLogo team="" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByTestId("team-logo-none")).toBeInTheDocument();
  });

  it("has a logo file for every club", () => {
    const files = new Set(readdirSync(path.resolve("public/teams")));
    for (const team of Object.values(TEAMS)) {
      expect(files.has(path.basename(team.logo))).toBe(true);
    }
  });
});

describe("TeamLogo in the shared player components", () => {
  it("comes before the name in PlayerCell", () => {
    render(<PlayerCell name="Nick Daicos" team="COL" positions={["MID"]} href="/projector?player=1" />);
    const logo = screen.getByRole("img", { name: "Collingwood" });
    const link = screen.getByRole("link", { name: "Nick Daicos" });
    expect(logo.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("is on PlayerSelect result rows (24px), which keep their Team • POS line", () => {
    const players = [player(1, "Nick Daicos", "COL", "Collingwood")];
    render(<PlayerSelect label="Add players" players={players} value={null} onSelect={vi.fn()} />);
    fireEvent.focus(screen.getByRole("combobox"));
    const option = screen.getByRole("option");
    const logo = option.querySelector("img")!;
    expect(logo).toHaveAttribute("alt", "Collingwood");
    expect(logo).toHaveAttribute("width", "24");
    expect(within(option).getByText("Collingwood • MID")).toBeInTheDocument();
  });
});
