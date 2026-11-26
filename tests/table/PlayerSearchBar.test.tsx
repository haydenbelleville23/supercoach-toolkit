// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PlayerSearchBar from "@/components/projector/PlayerSearchBar";
import type { Player } from "@/types/player";

const player = (id: number, name: string, team: string, positions: string[]): Player => ({
  id,
  championDataId: null,
  name,
  team,
  teamName: team,
  positions,
  price: 500_000,
  games: 5,
  average: 90,
  average3: 90,
  average5: 90,
  recentScores: [],
  history: [],
  breakeven: 80,
  ownership: null,
  previousGames: 20,
  active: true,
  availability: null,
});

const players = [
  player(1, "Max Gawn", "MEL", ["RUC"]),
  player(2, "Brodie Grundy", "SYD", ["RUC"]),
  player(3, "Jordan De Goey", "COL", ["MID", "FWD"]),
];

afterEach(cleanup);

describe("PlayerSearchBar", () => {
  it("shows the selected player's short name and team while closed", () => {
    render(<PlayerSearchBar players={players} selectedPlayer={players[2]} onChange={vi.fn()} />);

    const input = screen.getByRole("combobox");
    expect(input).toHaveAccessibleName("Search player (selected: Jordan De Goey, COL)");
    expect(screen.getByText("J. De Goey").className).toContain("sm:hidden");
    expect(screen.getByText("COL")).toBeInTheDocument();
  });

  it("moves through matches with the arrow keys and picks with Enter", () => {
    const onChange = vi.fn();
    render(<PlayerSearchBar players={players} selectedPlayer={players[0]} onChange={onChange} />);

    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "ruc" } });

    // Gawn and Grundy match "ruc".
    expect(screen.getAllByRole("option")).toHaveLength(2);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", "player-option-2");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("picks the first match with Enter when nothing is highlighted", () => {
    const onChange = vi.fn();
    render(<PlayerSearchBar players={players} selectedPlayer={players[0]} onChange={onChange} />);

    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "goey" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("keeps the options out of the Tab order", () => {
    render(<PlayerSearchBar players={players} selectedPlayer={players[0]} onChange={vi.fn()} />);

    fireEvent.focus(screen.getByRole("combobox"));
    for (const option of screen.getAllByRole("option")) {
      expect(option).toHaveAttribute("tabindex", "-1");
    }
  });
});
