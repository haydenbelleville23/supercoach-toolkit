// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("DEBUG_AS_OF_ROUND", "10");
});

import TradePlannerTool from "@/components/planner/TradePlannerTool";

const KEY = "footynomics.my-team.v1";
const SQUAD = [210, 701, 392, 290, 639, 652, 300, 352, 528, 667, 342, 693, 365, 10, 664, 719, 202, 77, 487, 424, 663, 519, 233, 254, 312, 334, 702, 337, 414, 439, 404];

function saveTeam(planCount: number) {
  const plans = Array.from({ length: planCount }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Plan ${i + 1}`,
    rounds: {},
    scoreOverrides: {},
  }));
  window.localStorage.setItem(
    KEY,
    JSON.stringify({
      version: 1,
      season: 2026,
      asOfRound: 10,
      players: SQUAD.map((id) => ({ id, pin: null })),
      cashInBank: 500000,
      tradesRemaining: 30,
      boostsRemaining: 5,
      plans,
      activePlanId: "p1",
      updatedAt: "2026-11-01T00:00:00Z",
    }),
  );
}

const savedPlans = () => JSON.parse(window.localStorage.getItem(KEY)!).plans.map((p: { name: string }) => p.name);

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Trade Planner plan bar", () => {
  it("moves Duplicate, Rename, Reset price overrides and Delete into the ⋯ menu", () => {
    saveTeam(2);
    render(<TradePlannerTool />);
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Actions for Plan 1" }));
    expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual([
      "Duplicate",
      "Rename",
      "Reset price overridesNo typed trade prices in this plan",
      "Delete",
    ]);
  });

  it("asks before deleting, and only deletes on yes", () => {
    saveTeam(2);
    render(<TradePlannerTool />);
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);

    fireEvent.click(screen.getByRole("button", { name: "Actions for Plan 1" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(confirm).toHaveBeenCalledWith('Delete "Plan 1"?');
    expect(savedPlans()).toEqual(["Plan 1", "Plan 2"]);

    fireEvent.click(screen.getByRole("button", { name: "Actions for Plan 1" }));
    act(() => {
      fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    });
    expect(savedPlans()).toEqual(["Plan 2"]);
  });

  it("explains why + New plan and Duplicate are disabled at three plans", () => {
    saveTeam(3);
    render(<TradePlannerTool />);
    expect(screen.getByRole("button", { name: "+ New plan" })).toBeDisabled();
    expect(screen.getByText("3 plans is the most")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Actions for Plan 1" }));
    expect(screen.getByRole("menuitem", { name: /Duplicate/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps the plans note and the injured note in popovers", () => {
    saveTeam(1);
    render(<TradePlannerTool />);
    expect(screen.queryByText(/saved in this browser with your team/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "About plans" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Up to 3 plans, saved in this browser with your team.");

    expect(screen.getByRole("checkbox", { name: "Injured and suspended players don't count as playing" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "About the injured setting" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent(/everyone counts as playing|Prices and projections are unaffected/);
  });
});
