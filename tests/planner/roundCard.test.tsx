// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("DEBUG_AS_OF_ROUND", "10");
});

import RoundCard, { type RoundCardProps } from "@/components/planner/RoundCard";
import { createPlanProjector, plannerFixtures, teamPlayersById } from "@/components/planner/plannerData";
import { evaluatePlan } from "@/lib/planner/evaluatePlan";
import { createPlan } from "@/lib/planner/teamFile";
import type { TradePlan } from "@/lib/planner/types";

import { plannerSetup } from "./plannerHelpers";

const { makeTeam } = plannerSetup();

// The squad and plan used for the before/after page measurements.
const SQUAD = [210, 701, 392, 290, 639, 652, 300, 352, 528, 667, 342, 693, 365, 10, 664, 719, 202, 77, 487, 424, 663, 519, 233, 254, 312, 334, 702, 337, 414, 439, 404];
const team = makeTeam(SQUAD.map((id) => ({ id })), { tradesRemaining: 30 });

function setup(rounds: TradePlan["rounds"], roundIndex = 0, extra: Partial<RoundCardProps> = {}) {
  const plan = { ...createPlan("Test"), rounds };
  // Built as the page builds it (matchup adjustment on, its default).
  const projector = createPlanProjector(plan, team, true);
  const playersById = teamPlayersById(team);
  const summaries = evaluatePlan({ team, plan, playersById, projector, fixtures: plannerFixtures, lastRound: 13 });
  const summary = summaries[roundIndex];
  const onChange = vi.fn();
  const props: RoundCardProps = {
    summary,
    planRound: rounds[summary.round] ?? { boost: false, trades: [] },
    squadBefore: roundIndex === 0 ? SQUAD : summaries[roundIndex - 1].squad,
    playersById,
    allPlayers: [...playersById.values()],
    priceAt: (id, round) => projector.getPriceBefore(id, round),
    placeholders: [],
    collapsed: false,
    fieldOpen: false,
    onChange,
    onToggleCollapsed: vi.fn(),
    onToggleField: vi.fn(),
    onNewRookie: vi.fn(),
    onPlaceholderTeam: vi.fn(),
    ...extra,
  };
  render(<RoundCard {...props} />);
  return { onChange, summary };
}

const worked: TradePlan["rounds"] = {
  11: { boost: false, trades: [{ outId: 300, inId: 430 }] },
  12: { boost: false, trades: [{ outId: 352, inId: 25 }] },
};

const stat = (label: string) => {
  const term = screen.getAllByText(label, { selector: "dt" })[0];
  return term.nextElementSibling?.textContent;
};

afterEach(cleanup);

describe("RoundCard summary strip", () => {
  it("shows the same cash, trades and boosts as before for the worked example, without squad or team value", () => {
    setup(worked, 0);
    expect(stat("Trades")).toBe("1/2");
    expect(stat("Out")).toBe("$511,500");
    expect(stat("In")).toBe("$475,700");
    expect(stat("Cash")).toBe("$535,800was $500,000");
    expect(stat("Left")).toBe("29");
    expect(stat("Boosts")).toBe("5");
    expect(screen.queryByText(/Squad value/i)).toBeNull();
    expect(screen.queryByText(/Team value/i)).toBeNull();
    cleanup();

    setup(worked, 1);
    expect(stat("Trades")).toBe("1/3");
    expect(stat("Out")).toBe("$512,100");
    expect(stat("In")).toBe("$502,900");
    expect(stat("Cash")).toBe("$545,000was $535,800");
    expect(stat("Left")).toBe("28");
  });

  it("puts the playing counts in one chip, with bye detail in its popover", () => {
    setup(worked, 1);
    expect(screen.getByText(/Playing \d+\/31 · field \d+\/23/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Round 12 byes and playing" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent(/On bye: .* of your squad (is|are) on bye\./);
  });
});

describe("RoundCard warnings badge", () => {
  const broken: TradePlan["rounds"] = { 11: { boost: false, trades: [{ outId: 300, inId: null }] } };

  it("shows errors without opening anything: error colour, header tint, count", () => {
    setup(broken, 0);
    const badge = screen.getByRole("button", { name: /Round 11 problems: 2 errors/ });
    expect(badge).toHaveTextContent("2");
    expect(badge.className).toContain("bg-red-500/20");
    expect(badge.closest("section")!.className).toContain("border-red-500/40");
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("keeps the exact messages available to screen readers, and groups them in the popover", () => {
    setup(broken, 0);
    const srOnly = document.querySelector(".sr-only")!;
    expect(srOnly).toHaveTextContent("Trade 1 is missing a player in.");
    expect(srOnly).toHaveTextContent("The squad has 30 players; it needs 31.");

    fireEvent.click(screen.getByRole("button", { name: /Round 11 problems/ }));
    const tip = screen.getByRole("tooltip");
    expect(within(tip).getByText("Errors")).toBeInTheDocument();
    expect(within(tip).getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows no badge when there are no problems", () => {
    setup(worked, 0);
    expect(screen.queryByRole("button", { name: /problems/ })).toBeNull();
  });
});

describe("RoundCard controls", () => {
  it("labels Boost with a rocket, a plain aria-label and an info popover", () => {
    setup(worked, 0);
    expect(screen.getByRole("checkbox", { name: "Boost: plus one trade this round" })).toBeInTheDocument();
    expect(screen.getByText("Boost 🚀")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "About boosts" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("+1 trade this round (uses one of your boosts).");
  });

  it("shows each trade price beside the name, and tapping it still opens the override editor", () => {
    const { onChange } = setup(worked, 0);
    expect(screen.queryByText(/^Out \$/)).toBeNull();
    expect(screen.queryByText(/^In \$/)).toBeNull();

    const outPrice = screen.getByRole("button", { name: /Round 11 trade 1: price out: \$511,500/ });
    fireEvent.click(outPrice);
    const editor = screen.getByRole("textbox", { name: "Round 11 trade 1: price out" });
    fireEvent.change(editor, { target: { value: "520000" } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(onChange).toHaveBeenCalledWith({
      boost: false,
      trades: [{ outId: 300, inId: 430, outPriceOverride: 520000 }],
    });
    expect(screen.getByRole("button", { name: /Round 11 trade 1: price in: \$475,700/ })).toBeInTheDocument();
  });
});
