// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("DEBUG_AS_OF_ROUND", "10");
});

import CashCowsPage from "@/app/cash-cows/page";
import PriceRangeControl from "@/components/cashcows/PriceRangeControl";
import { CURRENT_COMPLETED_ROUND } from "@/data/season";
import {
  NO_PRICE_RANGE,
  PRICE_PRESETS,
  matchesPriceRange,
  normalisePriceRange,
  parsePriceInput,
  priceRangeLabel,
  priceSliderBounds,
  type PriceRange,
} from "@/lib/cashcows/priceRange";

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("price range parsing", () => {
  it("accepts 350000, 350,000, $350k and 350k (and m), rounded to $100", () => {
    for (const text of ["350000", "350,000", "$350k", "350k", " $350K ", "0.35m"]) {
      expect(parsePriceInput(text)).toBe(350_000);
    }
    expect(parsePriceInput("350,049")).toBe(350_000);
    expect(parsePriceInput("350,050")).toBe(350_100);
    expect(parsePriceInput("1.234m")).toBe(1_234_000);
    for (const bad of ["", "abc", "35o000", "-5", "1k2"]) {
      expect(parsePriceInput(bad)).toBeNull();
    }
  });

  it("never lets Min exceed Max", () => {
    expect(normalisePriceRange({ min: 600_000, max: 500_000 }, "min")).toEqual({ min: 500_000, max: 500_000 });
    expect(normalisePriceRange({ min: 600_000, max: 500_000 }, "max")).toEqual({ min: 600_000, max: 600_000 });
    expect(normalisePriceRange({ min: 100_000, max: null })).toEqual({ min: 100_000, max: null });
  });

  it("has the three presets and filters inclusively", () => {
    expect(PRICE_PRESETS.map((p) => p.label)).toEqual([
      "Rookies under $300k",
      "Mid $300k to $500k",
      "Premiums over $500k",
    ]);
    const [rookies, mid, premiums] = PRICE_PRESETS.map((p) => p.range);
    expect(matchesPriceRange(299_900, rookies)).toBe(true);
    expect(matchesPriceRange(300_000, rookies)).toBe(false);
    expect(matchesPriceRange(300_000, mid) && matchesPriceRange(500_000, mid)).toBe(true);
    expect(matchesPriceRange(500_000, premiums)).toBe(false);
    expect(matchesPriceRange(500_100, premiums)).toBe(true);
    expect(priceRangeLabel({ min: 350_000, max: 450_000 })).toBe("$350k to $450k");
    expect(priceRangeLabel({ min: 350_000, max: null })).toBe("From $350k");
  });

  it("spans the slider from the pool's lowest to highest price, in $10k steps", () => {
    expect(priceSliderBounds([123_400, 987_600, 500_000])).toEqual({ low: 120_000, high: 990_000 });
  });
});

describe("PriceRangeControl", () => {
  function Harness({ initial = NO_PRICE_RANGE }: { initial?: PriceRange }) {
    const [range, setRange] = useState(initial);
    return (
      <>
        <PriceRangeControl value={range} onChange={setRange} bounds={{ low: 100_000, high: 1_000_000 }} />
        <output data-testid="range">{JSON.stringify(range)}</output>
      </>
    );
  }
  const range = () => JSON.parse(screen.getByTestId("range").textContent!);
  const open = () => fireEvent.click(screen.getByRole("button", { name: /^Price filter/ }));

  it("keeps the presets, boxes and slider in sync", () => {
    render(<Harness />);
    open();
    const dialog = screen.getByRole("dialog", { name: "Price range" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Mid $300k to $500k" }));
    expect(range()).toEqual({ min: 300_000, max: 500_000 });
    expect(within(dialog).getByRole("textbox", { name: "Min" })).toHaveValue("$300,000");
    expect(within(dialog).getByRole("textbox", { name: "Max" })).toHaveValue("$500,000");
    expect(within(dialog).getByRole("slider", { name: "Minimum price" })).toHaveValue("300000");
    expect(within(dialog).getByRole("slider", { name: "Maximum price" })).toHaveValue("500000");
    expect(within(dialog).getByRole("button", { name: "Mid $300k to $500k" })).toHaveAttribute("aria-pressed", "true");

    // Typing updates the slider (and drops the preset highlight).
    const min = within(dialog).getByRole("textbox", { name: "Min" });
    fireEvent.change(min, { target: { value: "$350k" } });
    fireEvent.blur(min);
    expect(range()).toEqual({ min: 350_000, max: 500_000 });
    expect(within(dialog).getByRole("slider", { name: "Minimum price" })).toHaveValue("350000");
    expect(within(dialog).getByRole("button", { name: "Mid $300k to $500k" })).toHaveAttribute("aria-pressed", "false");

    // The slider updates the boxes, in $10k steps.
    fireEvent.change(within(dialog).getByRole("slider", { name: "Maximum price" }), { target: { value: "420000" } });
    expect(range()).toEqual({ min: 350_000, max: 420_000 });
    expect(within(dialog).getByRole("textbox", { name: "Max" })).toHaveValue("$420,000");
    expect(within(dialog).getByRole("slider", { name: "Maximum price" })).toHaveAttribute("step", "10000");
  });

  it("pulls a Min above the Max down to the Max, and rejects nonsense", () => {
    render(<Harness initial={{ min: null, max: 400_000 }} />);
    open();
    const min = screen.getByRole("textbox", { name: "Min" });
    fireEvent.change(min, { target: { value: "450,000" } });
    fireEvent.keyDown(min, { key: "Enter" });
    expect(range()).toEqual({ min: 400_000, max: 400_000 });

    fireEvent.change(min, { target: { value: "lots" } });
    fireEvent.blur(min);
    expect(screen.getByRole("alert")).toHaveTextContent("350k");
    expect(range()).toEqual({ min: 400_000, max: 400_000 });
  });

  it("closes on Escape and returns focus to the button (keyboard)", () => {
    render(<Harness />);
    open();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: /^Price filter/ })).toHaveFocus();
  });
});

describe("Cash Cows toolbar", () => {
  const count = () => Number(screen.getByText(/^\d+ players?$/).textContent!.split(" ")[0]);
  const roundHeaders = () =>
    within(screen.getByRole("table"))
      .getAllByRole("columnheader")
      .filter((h) => /^R\d+$/.test(h.textContent?.trim() ?? ""));

  it("has the short count line, filter chips and Clear all", () => {
    render(<CashCowsPage />);
    const all = count();
    expect(all).toBeGreaterThan(50);
    expect(screen.queryByRole("list", { name: "Active filters" })).toBeNull();

    fireEvent.change(screen.getByRole("combobox", { name: "Position" }), { target: { value: "RUC" } });
    fireEvent.click(screen.getByRole("button", { name: /^Price filter/ }));
    fireEvent.click(screen.getByRole("button", { name: "Rookies under $300k" }));
    const chips = screen.getByRole("list", { name: "Active filters" });
    expect(within(chips).getByRole("button", { name: "Remove filter: RUC" })).toBeInTheDocument();
    expect(within(chips).getByRole("button", { name: "Remove filter: Rookies under $300k" })).toBeInTheDocument();
    expect(count()).toBeLessThan(all);

    // Every shown player is a rookie-priced RUC (current price).
    fireEvent.click(within(chips).getByRole("button", { name: "Remove filter: RUC" }));
    expect(screen.queryByRole("button", { name: "Remove filter: RUC" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(count()).toBe(all);
    expect(screen.queryByRole("list", { name: "Active filters" })).toBeNull();
  });

  it("filters on the current price", () => {
    render(<CashCowsPage />);
    fireEvent.click(screen.getByRole("button", { name: /^Price filter/ }));
    fireEvent.click(screen.getByRole("button", { name: "Premiums over $500k" }));
    const priceCol = within(screen.getByRole("table"))
      .getAllByRole("columnheader")
      .findIndex((h) => h.textContent?.startsWith("Price"));
    const prices = within(screen.getByRole("table"))
      .getAllByRole("row")
      .slice(1)
      .map((row) => Number(row.querySelectorAll("td")[priceCol]?.textContent?.replace(/[^0-9]/g, "")))
      .filter(Number.isFinite);
    expect(prices.length).toBeGreaterThan(0);
    expect(prices.every((price) => price > 500_000)).toBe(true);
  });

  it("shows the next 6 rounds by default on desktop, and Next 3 or All on request", () => {
    render(<CashCowsPage />);
    expect(roundHeaders().map((h) => h.textContent)).toEqual(
      Array.from({ length: 6 }, (_, i) => `R${CURRENT_COMPLETED_ROUND + 1 + i}`),
    );
    const choice = screen.getByRole("combobox", { name: "Rounds shown" });
    fireEvent.change(choice, { target: { value: "3" } });
    expect(roundHeaders()).toHaveLength(3);
    fireEvent.change(choice, { target: { value: "all" } });
    expect(roundHeaders().length).toBeGreaterThan(6);
  });

  it("has a phone Filters button with an active count, and the price guide in a popover", () => {
    render(<CashCowsPage />);
    const filters = screen.getByRole("button", { name: /^Filters/ });
    expect(filters).toHaveAttribute("aria-expanded", "false");
    fireEvent.change(screen.getByRole("combobox", { name: "Club" }), { target: { value: "COL" } });
    expect(filters).toHaveTextContent("Filters1");
    fireEvent.click(filters);
    expect(filters).toHaveAttribute("aria-expanded", "true");

    expect(screen.queryByText("$10k–$19.9k")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Price Rise Guide" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("$10k–$19.9k");
  });
});
