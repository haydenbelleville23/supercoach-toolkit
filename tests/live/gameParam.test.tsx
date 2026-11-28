// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseGameParam, resolveSelectedFixtureId, withGameParam } from "@/lib/liveMatch/gameParam";
import type { DfsLiveFeed, DfsLiveFixture } from "@/lib/liveMatch";

// --- next/navigation, with a controllable address ---------------------------
const nav = vi.hoisted(() => ({ search: "", replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/live",
}));

import LivePage from "@/app/live/page";

const fixture = (id: number, homeTeam: string, awayTeam: string, status: string, progress: number): DfsLiveFixture => ({
  id,
  providerId: String(id),
  status,
  homeTeam,
  awayTeam,
  homeScore: 50,
  awayScore: 40,
  venue: "MCG",
  progress,
  timeRemaining: "",
});

const feed: DfsLiveFeed = {
  updatedAt: "2026-09-26 07:40:11",
  status: "ok",
  fixtures: [
    fixture(101, "COL", "CAR", "CONCLUDED", 100),
    fixture(102, "FRE", "BRL", "LIVE", 60),
    fixture(103, "SYD", "GEE", "SCHEDULED", 0),
  ],
  players: [],
};

const TEAM_CODES = new Set(feed.fixtures.flatMap((f) => [f.homeTeam, f.awayTeam]));

/** The match shown in the scoreboard: its two team codes. */
const shownMatch = () => {
  const board = screen.getByRole("button", { name: /Copy link/ }).closest("section")!;
  return [...board.querySelectorAll("p, span, div")]
    .map((el) => el.textContent?.trim())
    .filter((t): t is string => !!t && TEAM_CODES.has(t))
    .filter((t, i, all) => all.indexOf(t) === i)
    .slice(0, 2)
    .join(" v ");
};

beforeEach(() => {
  nav.search = "";
  nav.replace.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(feed), { status: 200, headers: { "Content-Type": "application/json" } })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("?game helpers", () => {
  it("accepts positive whole-number ids only", () => {
    expect(parseGameParam("451")).toBe(451);
    for (const bad of [null, "", "0", "-3", "4.5", "abc", "12abc", "1".repeat(12), " 5"]) {
      expect(parseGameParam(bad)).toBeNull();
    }
  });

  it("uses the requested match only when the feed has it", () => {
    const fixtures = [{ id: 1 }, { id: 2 }];
    expect(resolveSelectedFixtureId(fixtures, 2, 1)).toBe(2);
    expect(resolveSelectedFixtureId(fixtures, 9, 1)).toBe(1);
    expect(resolveSelectedFixtureId(fixtures, null, 1)).toBe(1);
    expect(resolveSelectedFixtureId([], 2, null)).toBeNull();
  });

  it("sets ?game and keeps other parameters", () => {
    expect(withGameParam("", 5)).toBe("?game=5");
    expect(withGameParam("view=results&game=2", 5)).toBe("?view=results&game=5");
    expect(withGameParam("?round=10", 7)).toBe("?round=10&game=7");
  });
});

describe("Live page selected match in the address", () => {
  it("defaults to the live match when there's no ?game", async () => {
    render(<LivePage />);
    await waitFor(() => expect(shownMatch()).toBe("FRE v BRL"));
  });

  it("opens the match named in ?game once the feed has loaded", async () => {
    nav.search = "game=103";
    render(<LivePage />);
    await waitFor(() => expect(shownMatch()).toBe("SYD v GEE"));
  });

  it("falls back silently for an unknown or malformed id", async () => {
    for (const search of ["game=999", "game=abc", "game=-1"]) {
      nav.search = search;
      render(<LivePage />);
      await waitFor(() => expect(shownMatch()).toBe("FRE v BRL"));
      expect(screen.queryByRole("alert")).toBeNull();
      cleanup();
    }
  });

  it("puts a picked match in the address with replace, without scrolling, and keeps the Live | Results toggle", async () => {
    nav.search = "round=5";
    render(<LivePage />);
    await waitFor(() => expect(shownMatch()).toBe("FRE v BRL"));
    const requests = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: /COL[\s\S]*CAR/ }));
    expect(nav.replace).toHaveBeenCalledWith("/live?round=5&game=101", { scroll: false });
    // No extra feed request for a selection.
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(requests);

    expect(screen.getByRole("link", { name: "Results" })).toHaveAttribute("href", "/live/results");
    expect(screen.getByRole("link", { name: "Live" })).toHaveAttribute("aria-current", "page");
  });

  it("copies the link to the selected match, and says so", async () => {
    nav.search = "game=103";
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<LivePage />);
    await waitFor(() => expect(shownMatch()).toBe("SYD v GEE"));

    fireEvent.click(screen.getByRole("button", { name: /Copy link/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Copied/ })).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/live?game=103`);
  });

  it("shows the link to copy by hand when the browser can't copy", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });
    document.execCommand = vi.fn(() => false);
    render(<LivePage />);
    await waitFor(() => expect(shownMatch()).toBe("FRE v BRL"));

    fireEvent.click(screen.getByRole("button", { name: /Copy link/ }));
    await waitFor(() => expect(screen.getByLabelText("Copy this link:")).toHaveValue(`${window.location.origin}/live?game=102`));
  });
});
