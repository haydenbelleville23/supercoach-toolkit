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

// Real 2026 Round 24 pairings, so each has a results-style game id
// (2026-24-stk-gcs, 2026-24-col-brl, 2026-24-car-fre).
const feed: DfsLiveFeed = {
  updatedAt: "2026-09-26 07:40:11",
  status: "ok",
  fixtures: [
    fixture(101, "STK", "GCS", "CONCLUDED", 100),
    fixture(102, "COL", "BRL", "LIVE", 60),
    fixture(103, "CAR", "FRE", "SCHEDULED", 0),
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

const fetchCalls = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length;

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
  it("accepts results-style game ids only (season-round-home-away)", () => {
    expect(parseGameParam("2026-10-brl-gee")).toBe("2026-10-brl-gee");
    expect(parseGameParam("2026-10-BRL-GEE")).toBe("2026-10-brl-gee");
    for (const bad of [null, "", "451", "abc", "2026-10-brl", "2026-10-brl-gee-x", "../2026-10-brl-gee", "2026-100-brl-gee"]) {
      expect(parseGameParam(bad)).toBeNull();
    }
  });

  it("uses the requested match only when the feed has it", () => {
    const fixtures = [
      { id: 1, slug: "2026-24-stk-gcs" },
      { id: 2, slug: "2026-24-col-brl" },
    ];
    const idOf = (f: { slug: string }) => f.slug;
    expect(resolveSelectedFixtureId(fixtures, "2026-24-col-brl", idOf, 1)).toBe(2);
    expect(resolveSelectedFixtureId(fixtures, "2026-23-col-brl", idOf, 1)).toBe(1);
    expect(resolveSelectedFixtureId(fixtures, null, idOf, 1)).toBe(1);
    expect(resolveSelectedFixtureId([], "2026-24-col-brl", idOf, null)).toBeNull();
  });

  it("sets ?game and keeps other parameters; null removes it", () => {
    expect(withGameParam("", "2026-10-brl-gee")).toBe("?game=2026-10-brl-gee");
    expect(withGameParam("view=results&game=2026-9-ade-car", "2026-10-brl-gee")).toBe("?view=results&game=2026-10-brl-gee");
    expect(withGameParam("?round=10", "2026-10-brl-gee")).toBe("?round=10&game=2026-10-brl-gee");
    expect(withGameParam("round=10&game=2026-9-ade-car", null)).toBe("?round=10");
    expect(withGameParam("game=2026-9-ade-car", null)).toBe("");
  });
});

describe("Live page selected match in the address", () => {
  it("defaults to the live match when there's no ?game", async () => {
    render(<LivePage />);
    await waitFor(() => expect(shownMatch()).toBe("COL v BRL"));
  });

  it("opens the match named in ?game (same ids as the results pages) once the feed has loaded", async () => {
    nav.search = "game=2026-24-car-fre";
    render(<LivePage />);
    await waitFor(() => expect(shownMatch()).toBe("CAR v FRE"));
  });

  it("falls back silently for a game not in the feed, a malformed id or the old numeric form", async () => {
    for (const search of ["game=2026-24-ade-wce", "game=2026-23-col-brl", "game=abc", "game=103"]) {
      nav.search = search;
      render(<LivePage />);
      await waitFor(() => expect(shownMatch()).toBe("COL v BRL"));
      expect(screen.queryByRole("alert")).toBeNull();
      cleanup();
    }
  });

  it("puts a picked match in the address with replace, without scrolling, and keeps the Live | Results toggle", async () => {
    nav.search = "round=5";
    render(<LivePage />);
    await waitFor(() => expect(shownMatch()).toBe("COL v BRL"));
    const requests = fetchCalls();

    const stkGcs = screen.getAllByRole("button").find((b) => /STK/.test(b.textContent ?? "") && /GCS/.test(b.textContent ?? ""))!;
    fireEvent.click(stkGcs);
    expect(nav.replace).toHaveBeenCalledWith("/live?round=5&game=2026-24-stk-gcs", { scroll: false });
    // No extra feed request for a selection.
    expect(fetchCalls()).toBe(requests);

    expect(screen.getByRole("link", { name: "Results" })).toHaveAttribute("href", "/live/results");
    expect(screen.getByRole("link", { name: "Live" })).toHaveAttribute("aria-current", "page");
  });

  it("copies the link to the selected match, and says so", async () => {
    nav.search = "game=2026-24-car-fre";
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<LivePage />);
    await waitFor(() => expect(shownMatch()).toBe("CAR v FRE"));

    fireEvent.click(screen.getByRole("button", { name: /Copy link/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Copied/ })).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/live?game=2026-24-car-fre`);
  });

  it("shows the link to copy by hand when the browser can't copy", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });
    document.execCommand = vi.fn(() => false);
    render(<LivePage />);
    await waitFor(() => expect(shownMatch()).toBe("COL v BRL"));

    fireEvent.click(screen.getByRole("button", { name: /Copy link/ }));
    await waitFor(() =>
      expect(screen.getByLabelText("Copy this link:")).toHaveValue(`${window.location.origin}/live?game=2026-24-col-brl`),
    );
  });
});
