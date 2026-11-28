// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("DEBUG_AS_OF_ROUND", "10");
});

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/live",
}));

import LivePage from "@/app/live/page";
import { normaliseDfsLiveFeed } from "@/lib/liveMatch/dfsAustralia";
import { liveSampleFeed } from "@/lib/liveMatch/liveSample";
import { mapLiveStatus } from "@/lib/liveMatch/liveStatus";
import {
  LIVE_SAMPLE_FIXTURE_FILE,
  NO_LIVE_SAMPLE_FILE,
  liveSampleSource,
} from "@/lib/liveMatch/sampleAlias";
import { getFixtureState } from "@/lib/liveMatch";

const ROOT = path.resolve(".");
const MARKER = "INVENTED SAMPLE";

function filesUnder(dir: string, extensions: string[]): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return filesUnder(full, extensions);
    return extensions.some((ext) => name.endsWith(ext)) ? [full] : [];
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("live sample feed (debug fixture) isolation", () => {
  it("is only chosen when the debug lock is on", () => {
    for (const fixtureExists of [true, false]) {
      expect(liveSampleSource({ asOfRound: null, fixtureExists })).toBe(NO_LIVE_SAMPLE_FILE);
    }
    expect(liveSampleSource({ asOfRound: 10, fixtureExists: true })).toBe(LIVE_SAMPLE_FIXTURE_FILE);
    expect(liveSampleSource({ asOfRound: 10, fixtureExists: false })).toBe(NO_LIVE_SAMPLE_FILE);
  });

  it("is named by no app code except the alias module", () => {
    const sources = [
      ...filesUnder(path.join(ROOT, "app"), [".ts", ".tsx"]),
      ...filesUnder(path.join(ROOT, "components"), [".ts", ".tsx"]),
      ...filesUnder(path.join(ROOT, "lib"), [".ts", ".tsx"]),
      path.join(ROOT, "next.config.ts"),
    ];
    const naming = sources.filter((file) => readFileSync(file, "utf8").includes("live-sample.fixture"));
    expect(naming.map((file) => path.relative(ROOT, file).replace(/\\/g, "/"))).toEqual([
      "lib/liveMatch/sampleAlias.ts",
    ]);
  });

  it("isn't loaded in tests, even under the lock (the import resolves to no data)", async () => {
    expect(liveSampleFeed).toBeNull();
    // So the lock falls back to its usual message, without a request.
    vi.stubGlobal("fetch", vi.fn());
    render(<LivePage />);
    expect(await screen.findByText(/Live scores are off while viewing as of/)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("is clearly invented and covers each case", () => {
    const raw = JSON.parse(readFileSync(path.join(ROOT, LIVE_SAMPLE_FIXTURE_FILE), "utf8"));
    expect(raw._sample).toContain(MARKER);

    const feed = normaliseDfsLiveFeed(raw);
    const states = feed.fixtures.map(getFixtureState);
    expect(states).toEqual(expect.arrayContaining(["live", "finished", "upcoming"]));

    const statuses = feed.players.map((p) => mapLiveStatus(p));
    const kinds = new Set(statuses.map((s) => s?.status ?? "none"));
    expect(kinds).toEqual(new Set(["onGround", "bench", "unknown", "none"]));
    // Bench with a reason (blood rule, injured, ruled out), and without.
    const reasons = statuses.filter((s) => s?.status === "bench").map((s) => s!.reason);
    expect(reasons).toContain(null);
    expect(reasons.some((r) => /blood/i.test(r ?? ""))).toBe(true);
    expect(reasons.some((r) => /injur/i.test(r ?? ""))).toBe(true);
    expect(reasons.some((r) => /ruled out/i.test(r ?? ""))).toBe(true);
    // Missing fields.
    expect(feed.players.some((p) => !p.onBenchKnown)).toBe(true);
    expect(feed.players.some((p) => !p.timeOnGroundKnown && p.onBenchKnown)).toBe(true);
    // Real player ids, so rows match the Round 10 data.
    const known = new Set(
      (JSON.parse(readFileSync(path.join(ROOT, "data/2026/players-normalised.json"), "utf8")) as { championDataId: string | null }[]).map(
        (p) => p.championDataId,
      ),
    );
    expect(feed.players.every((p) => known.has(p.championDataId))).toBe(true);
  });

  // Runs when .next holds a production (unlocked) build: its output must
  // not contain the sample.
  const manifest = path.join(ROOT, ".next/required-server-files.json");
  const productionBuild =
    existsSync(manifest) && JSON.parse(readFileSync(manifest, "utf8")).config?.env?.DEBUG_AS_OF_ROUND === "";

  it.skipIf(!productionBuild)("isn't in a production build's output", () => {
    const built = [
      ...filesUnder(path.join(ROOT, ".next/server"), [".js", ".json", ".html", ".rsc"]),
      ...filesUnder(path.join(ROOT, ".next/static"), [".js"]),
    ];
    expect(built.length).toBeGreaterThan(0);
    const containing = built.filter((file) => {
      const text = readFileSync(file, "utf8");
      return text.includes(MARKER) && text.includes("SAMPLE-1");
    });
    expect(containing).toEqual([]);
  });
});
