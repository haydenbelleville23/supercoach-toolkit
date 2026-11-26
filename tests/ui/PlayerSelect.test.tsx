// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PlayerSelect from "@/components/ui/PlayerSelect";
import type { Player } from "@/types/player";

const player = (id: number, name: string, team: string, positions = ["MID"]): Player => ({
  id,
  championDataId: null,
  name,
  team,
  teamName: team === "MEL" ? "Melbourne" : team === "COL" ? "Collingwood" : team,
  positions,
  price: id * 100_000,
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

const players = [
  player(1, "Max Gawn", "MEL", ["RUC"]),
  player(2, "Christian Petracca", "MEL"),
  player(3, "Nick Daicos", "COL"),
  player(4, "Josh Daicos", "COL"),
];

afterEach(cleanup);

function open(query = "") {
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  if (query) fireEvent.change(input, { target: { value: query } });
  return input;
}

const optionNames = () =>
  screen.getAllByRole("option").map((o) => o.querySelector(".font-semibold")?.textContent);

describe("PlayerSelect", () => {
  it("shows the team logo, bold name, team and positions, and the price", () => {
    render(
      <PlayerSelect label="Pick" players={players} value={null} onSelect={vi.fn()} priceFor={(p) => p.price} />,
    );
    open("gawn");

    const option = screen.getByRole("option");
    expect(option).toHaveTextContent("Max Gawn");
    expect(option).toHaveTextContent("Melbourne • RUC");
    expect(option).toHaveTextContent("$100,000");
    expect(option.querySelector("img")?.getAttribute("src")).toContain("mel.png");
  });

  it("leaves out excluded players", () => {
    render(
      <PlayerSelect label="Pick" players={players} value={null} onSelect={vi.fn()} excludeIds={new Set([3])} />,
    );
    open("daicos");
    expect(optionNames()).toEqual(["Josh Daicos"]);
  });

  it("shows disabled rows with their reason, and they can't be picked", () => {
    const onSelect = vi.fn();
    render(
      <PlayerSelect
        label="Pick"
        players={players}
        value={null}
        onSelect={onSelect}
        disabledReasons={new Map([[3, "No MID slot"]])}
      />,
    );
    open("daicos");

    const [nick, josh] = screen.getAllByRole("option");
    expect(nick).toHaveTextContent("No MID slot");
    expect(nick).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(nick);
    expect(onSelect).not.toHaveBeenCalled();

    // Enter skips the disabled first row.
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(players[3]);
    expect(josh).toBeDefined();
  });

  it("skips disabled rows with the arrow keys", () => {
    render(
      <PlayerSelect
        label="Pick"
        players={players}
        value={null}
        onSelect={vi.fn()}
        disabledReasons={(p) => (p.id === 2 ? "In squad" : null)}
        idPrefix="t"
      />,
    );
    const input = open("mel");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", "t-option-1");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    // Petracca (2) is disabled, so it wraps back to Gawn.
    expect(input).toHaveAttribute("aria-activedescendant", "t-option-1");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveAttribute("aria-activedescendant", "t-option-1");
  });

  it("pins extra options at the top and filters them with the search", () => {
    const onRookie = vi.fn();
    render(
      <PlayerSelect
        label="Pick"
        players={players}
        value={null}
        onSelect={vi.fn()}
        pinnedOptions={["DEF", "MID"].map((pos) => ({
          key: pos,
          label: `New Rookie (TBC) ${pos}`,
          price: 99_100,
          onSelect: () => onRookie(pos),
        }))}
      />,
    );
    open();
    expect(optionNames().slice(0, 3)).toEqual([
      "New Rookie (TBC) DEF",
      "New Rookie (TBC) MID",
      "Max Gawn",
    ]);
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("$99,100");

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "rookie mid" } });
    expect(optionNames()).toEqual(["New Rookie (TBC) MID"]);
    fireEvent.click(screen.getByRole("option"));
    expect(onRookie).toHaveBeenCalledWith("MID");

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "daicos" } });
    expect(optionNames()).toEqual(["Nick Daicos", "Josh Daicos"]);
  });

  it("closes on Escape and on a tap outside", () => {
    render(
      <>
        <button type="button">elsewhere</button>
        <PlayerSelect label="Pick" players={players} value={null} onSelect={vi.fn()} />
      </>,
    );
    const input = open();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();

    open();
    fireEvent.pointerDown(screen.getByText("elsewhere"));
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes after a pick by default", () => {
    const onSelect = vi.fn();
    render(<PlayerSelect label="Pick" players={players} value={null} onSelect={onSelect} />);
    open("gawn");
    fireEvent.click(screen.getByRole("option"));
    expect(onSelect).toHaveBeenCalledWith(players[0]);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("stays open with the search cleared for rapid entry", () => {
    const onSelect = vi.fn();
    render(
      <PlayerSelect label="Pick" players={players} value={null} onSelect={onSelect} keepOpenAfterSelect />,
    );
    const input = open("gawn");
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith(players[0]);
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(screen.getAllByRole("option")).toHaveLength(4);
  });

  it("limits rendered rows and says how many more match", () => {
    const many = Array.from({ length: 120 }, (_, i) => player(100 + i, `Player ${i}`, "MEL"));
    render(<PlayerSelect label="Pick" players={many} value={null} onSelect={vi.fn()} maxResults={30} />);
    open("mel");
    expect(screen.getAllByRole("option")).toHaveLength(30);
    expect(screen.getByText("90 more. Keep typing to narrow the list.")).toBeInTheDocument();
  });

  it("shows the selected player and a clear button", () => {
    const onClear = vi.fn();
    render(
      <PlayerSelect label="Player out" players={players} value={players[2]} onSelect={vi.fn()} onClear={onClear} />,
    );
    expect(screen.getByRole("combobox")).toHaveAccessibleName("Player out (selected: Nick Daicos, COL)");
    expect(screen.getByText("N. Daicos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear player out" }));
    expect(onClear).toHaveBeenCalled();
  });
});
