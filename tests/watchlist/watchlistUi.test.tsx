// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("DEBUG_AS_OF_ROUND", "10");
});

import CashCowsPage from "@/app/cash-cows/page";
import MyTeamTabs from "@/components/planner/MyTeamTabs";
import RoundCard, { type RoundCardProps } from "@/components/planner/RoundCard";
import { createPlanProjector, plannerFixtures, teamPlayersById } from "@/components/planner/plannerData";
import { evaluatePlan } from "@/lib/planner/evaluatePlan";
import { createPlan } from "@/lib/planner/teamFile";
import type { TradePlan } from "@/lib/planner/types";
import { playerRepository } from "@/lib/repository/PlayerRepository";
import { WATCHLIST_MAX } from "@/lib/watchlist/watchlist";

import { plannerSetup } from "../planner/plannerHelpers";

const KEY = "footynomics.watchlist.2026";
const TEAM_KEY = "footynomics.my-team.v1";
const SQUAD = [210, 701, 392, 290, 639, 652, 300, 352, 528, 667, 342, 693, 365, 10, 664, 719, 202, 77, 487, 424, 663, 519, 233, 254, 312, 334, 702, 337, 414, 439, 404];

const byId = (id: number) => playerRepository.getById(id)!;
const stored = () => (JSON.parse(window.localStorage.getItem(KEY) ?? "null")?.players ?? []).map((e: { id: number }) => e.id);
const storeWatchlist = (ids: number[]) =>
  window.localStorage.setItem(
    KEY,
    JSON.stringify({ version: 1, season: 2026, players: ids.map((id) => ({ id, addedAt: "2026-05-01T00:00:00.000Z" })) }),
  );

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const filterButton = (name: RegExp) =>
  within(screen.getByRole("group", { name: "Players to show" })).getByRole("button", { name });

describe("Cash Cows watchlist", () => {
  it("stars a player (saved under this season's key) and the 3-way filter counts it", () => {
    render(<CashCowsPage />);
    expect(filterButton(/^All players$/)).toHaveAttribute("aria-pressed", "true");
    expect(filterButton(/^My team \(0\)$/)).toBeDisabled();
    expect(filterButton(/^Watchlist \(0\)$/)).toBeEnabled();

    const star = screen.getAllByRole("button", { name: /^Add .+ to watchlist$/ })[0];
    const name = star.getAttribute("aria-label")!.replace(/^Add | to watchlist$/g, "");
    fireEvent.click(star);

    expect(screen.getByRole("button", { name: `Remove ${name} from watchlist` })).toHaveAttribute("aria-pressed", "true");
    expect(stored()).toHaveLength(1);
    expect(filterButton(/^Watchlist \(1\)$/)).toBeInTheDocument();

    fireEvent.click(filterButton(/^Watchlist/));
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("link").map((a) => a.getAttribute("aria-label"))).toEqual([name]);

    // Removing from the filtered list.
    fireEvent.click(screen.getByRole("button", { name: `Remove ${name} from watchlist` }));
    expect(stored()).toEqual([]);
    expect(screen.getByText("Tap the star on a player to add them.")).toBeInTheDocument();
  });

  it("keeps the star after a reload (persistence)", () => {
    const { unmount } = render(<CashCowsPage />);
    const star = screen.getAllByRole("button", { name: /to watchlist$/ })[0];
    const label = star.getAttribute("aria-label")!;
    fireEvent.click(star);
    unmount();

    render(<CashCowsPage />);
    const name = label.replace(/^Add | to watchlist$/g, "");
    expect(screen.getByRole("button", { name: `Remove ${name} from watchlist` })).toHaveAttribute("aria-pressed", "true");
  });

  it("explains a full watchlist instead of adding a 61st player", () => {
    const ids = playerRepository.getAll().slice(-WATCHLIST_MAX).map((p) => p.id);
    storeWatchlist(ids);
    render(<CashCowsPage />);
    const star = screen.getAllByRole("button", { name: /^Add .+ to watchlist$/ })[0];
    expect(star).toHaveAttribute("title", `Watchlist full (${WATCHLIST_MAX} players)`);
    fireEvent.click(star);
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent(/watchlist is full/i);
    expect(stored()).toHaveLength(WATCHLIST_MAX);
  });

  it("ignores ids that are no longer in the data", () => {
    storeWatchlist([999_999, SQUAD[0]]);
    render(<CashCowsPage />);
    expect(filterButton(/^Watchlist \(1\)$/)).toBeInTheDocument();
  });

  it("counts My team and keeps the highlight under All players", () => {
    window.localStorage.setItem(
      TEAM_KEY,
      JSON.stringify({
        version: 1,
        season: 2026,
        asOfRound: 10,
        players: SQUAD.map((id) => ({ id, pin: null })),
        cashInBank: 0,
        tradesRemaining: 30,
        boostsRemaining: 5,
        plans: [],
        activePlanId: null,
        updatedAt: "2026-05-01T00:00:00Z",
      }),
    );
    render(<CashCowsPage />);
    expect(filterButton(/^My team \(31\)$/)).toBeEnabled();
    // Premiums first, so squad players are in the first 50 rows.
    fireEvent.change(screen.getByRole("combobox", { name: /sort/i }), { target: { value: "price-high" } });
    expect(document.querySelector("tr[data-highlighted]")).not.toBeNull();
    fireEvent.click(filterButton(/^My team/));
    const names = within(screen.getByRole("table")).getAllByRole("link").map((a) => a.getAttribute("aria-label"));
    const squadNames = new Set(SQUAD.map((id) => byId(id).name));
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((n) => squadNames.has(n!))).toBe(true);
  });
});

describe("Cash Cows column names", () => {
  it("uses PEAK GAIN, PEAK RD and PROJ, on one line, each with a tooltip", () => {
    render(<CashCowsPage />);
    const headers = screen.getAllByRole("columnheader");
    const text = headers.map((h) => h.textContent ?? "");
    for (const name of ["Peak gain", "Peak Rd", "Proj", "Price", "BE", "+1R", "+3R", "+5R"]) {
      expect(text.some((t) => t.startsWith(name))).toBe(true);
    }
    expect(text.join(" ")).not.toMatch(/topped|proj avg/i);
    expect(headers.every((h) => h.className.includes("whitespace-nowrap"))).toBe(true);

    // Tap opens the explanation; so does keyboard focus.
    fireEvent.click(screen.getByRole("button", { name: "About Peak gain" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("until the price stops rising");
    fireEvent.keyDown(document, { key: "Escape" });

    const peakRd = screen.getByRole("button", { name: "About Peak Rd" });
    act(() => peakRd.focus());
    fireEvent.focus(peakRd);
    expect(screen.getByRole("tooltip")).toHaveTextContent("the price stops rising");
  });

  it("names the sort option Peak gain, and it sorts by peak gain", () => {
    render(<CashCowsPage />);
    const select = screen.getByRole("combobox", { name: /sort/i }) as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent?.trim())).toContain("Peak gain");
    fireEvent.change(select, { target: { value: "price-high" } });
    fireEvent.change(select, { target: { value: "peak-gain" } });
    const header = screen.getAllByRole("columnheader").find((h) => h.textContent?.startsWith("Peak gain"))!;
    expect(header).toHaveAttribute("aria-sort", "descending");
  });

  it("has no old column names left in user-facing code or docs", () => {
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        return statSync(full).isDirectory() ? files(full) : /\.(tsx?|md)$/.test(name) ? [full] : [];
      });
    const sources = [...files("app"), ...files("components"), ...files("docs"), "README.md"];
    const offenders = sources.filter((file) => /topped out|proj avg/i.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("My Team Watchlist tab", () => {
  it("shows the empty state, then the watched players with their numbers", () => {
    render(<MyTeamTabs />);
    fireEvent.click(screen.getByRole("tab", { name: /Watchlist/ }));
    expect(screen.getByRole("tab", { name: /Watchlist/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Tap the star on a player to add them.")).toBeInTheDocument();
    cleanup();

    storeWatchlist([SQUAD[0], SQUAD[1]]);
    render(<MyTeamTabs />);
    fireEvent.click(screen.getByRole("tab", { name: /Watchlist/ }));
    const table = screen.getByRole("table");
    const names = within(table).getAllByRole("link").map((a) => a.getAttribute("aria-label"));
    expect(names.sort()).toEqual([byId(SQUAD[0]).name, byId(SQUAD[1]).name].sort());
    for (const header of ["Price", "BE", "+1R", "+3R", "Peak gain", "Peak Rd"]) {
      expect(within(table).getAllByRole("columnheader").some((h) => h.textContent?.startsWith(header))).toBe(true);
    }

    fireEvent.click(within(table).getByRole("button", { name: `Remove ${byId(SQUAD[0]).name} from watchlist` }));
    expect(stored()).toEqual([SQUAD[1]]);
  });

  it("adds a player from the Add player box", () => {
    render(<MyTeamTabs />);
    fireEvent.click(screen.getByRole("tab", { name: /Watchlist/ }));
    const input = screen.getByRole("combobox", { name: "Add player to watchlist" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: byId(SQUAD[2]).name } });
    fireEvent.click(screen.getAllByRole("option")[0]);
    expect(stored()).toEqual([SQUAD[2]]);
  });

  it("switches tabs with the arrow keys", () => {
    render(<MyTeamTabs />);
    const squad = screen.getByRole("tab", { name: "Squad" });
    fireEvent.keyDown(squad, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Watchlist/ })).toHaveAttribute("aria-selected", "true");
  });
});

describe("Trade Planner player-in pins", () => {
  const { makeTeam } = plannerSetup();
  const team = makeTeam(SQUAD.map((id) => ({ id })), { tradesRemaining: 30 });

  function renderTrade() {
    const rounds: TradePlan["rounds"] = { 11: { boost: false, trades: [{ outId: 300, inId: null }] } };
    const plan = { ...createPlan("Test"), rounds };
    const projector = createPlanProjector(plan, team, true);
    const playersById = teamPlayersById(team);
    const summary = evaluatePlan({ team, plan, playersById, projector, fixtures: plannerFixtures, lastRound: 13 })[0];
    const props: RoundCardProps = {
      summary,
      planRound: rounds[11],
      squadBefore: SQUAD,
      playersById,
      allPlayers: [...playersById.values()],
      priceAt: (id, round) => projector.getPriceBefore(id, round),
      placeholders: [],
      collapsed: false,
      fieldOpen: false,
      onChange: vi.fn(),
      onToggleCollapsed: vi.fn(),
      onToggleField: vi.fn(),
      onNewRookie: vi.fn(),
      onPlaceholderTeam: vi.fn(),
    };
    render(<RoundCard {...props} />);
  }

  it("lists Rookie (TBC) options, then the watchlist (minus squad players), then everyone", () => {
    const outside = playerRepository.getAll().filter((p) => !SQUAD.includes(p.id)).slice(0, 2);
    // A squad player on the watchlist is left out of the pinned group.
    storeWatchlist([outside[1].id, SQUAD[3], outside[0].id]);
    renderTrade();

    const input = screen.getByRole("combobox", { name: /player in/ });
    fireEvent.focus(input);
    const list = screen.getByRole("listbox");
    const items = [...list.children].map((el) =>
      el.getAttribute("role") === "presentation" && !el.querySelector("[role=option]")
        ? `# ${el.textContent}`
        : (el.querySelector("[role=option] .font-semibold, .font-semibold")?.textContent ?? el.textContent),
    );

    const heading = items.indexOf("# Watchlist");
    expect(heading).toBeGreaterThan(0);
    expect(items.slice(0, heading).every((t) => /Rookie \(TBC\)/.test(t ?? ""))).toBe(true);
    expect(items.slice(heading + 1, heading + 3)).toEqual([outside[1].name, outside[0].name]);
    expect(items).not.toContain(byId(SQUAD[3]).name);
    // Watchlisted players aren't repeated in the full list.
    expect(items.filter((t) => t === outside[0].name)).toHaveLength(1);
  });
});
