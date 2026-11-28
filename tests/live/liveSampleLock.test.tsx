// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("DEBUG_AS_OF_ROUND", "10");
});

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/live",
}));

// What next.config's alias gives the page under the lock.
vi.mock("@/lib/liveMatch/liveSample", async () => {
  const { readFileSync } = await import("node:fs");
  const { normaliseDfsLiveFeed } = await import("@/lib/liveMatch/dfsAustralia");
  return { liveSampleFeed: normaliseDfsLiveFeed(JSON.parse(readFileSync("data/2026/live-sample.fixture.json", "utf8"))) };
});

import LivePage from "@/app/live/page";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Live page under DEBUG_AS_OF_ROUND with the sample feed", () => {
  it("shows the sample, labelled, and never requests the feed", async () => {
    render(<LivePage />);
    expect(await screen.findByRole("note")).toHaveTextContent("Sample live data (invented, for testing as of Round 10)");
    // The live sample game (HAW v ADE) is shown first, with its tags.
    const table = screen.getByRole("table");
    expect(table).toHaveAccessibleName("Live scores for HAW");
    const tags = within(table).getAllByRole("button").map((b) => b.textContent?.trim());
    expect(tags).toContain("?");
    const bench = within(table).getAllByRole("button", { name: "On the interchange bench" })[0];
    fireEvent.click(bench);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Sample live data (invented)");
    expect(fetch).not.toHaveBeenCalled();
  });
});
