import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DFS_LIVE_URL } from "@/lib/liveMatch/dfsLiveUrl";
import {
  LAST_REQUEST_FILE,
  checkSnapshotRateLimit,
  saveLiveSnapshot,
  summariseRawFeed,
} from "@/lib/liveMatch/liveSnapshot";

// Odd spacing and key order on purpose: the file must match byte for byte.
const RAW = `{"timeStamp":["2026-05-22 21:05"], "status":["ok"],
  "fixtures":[{"id":1,"status":"LIVE","homeTeam":"COL"},{"id":2,"status":"CONCLUDED","extra":true}],
  "playerStats":[
    {"playerId":"CD_I1","onBench":1,"benchReason":"Blood rule"},
    {"playerId":"CD_I2","onBench":0,"benchReason":""},
    {"playerId":"CD_I3","onBench":"1","status":"sub"},
    {"playerId":"CD_I4"}
  ]}`;

let dir: string;
let clock: number;
const now = () => new Date(clock);

beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "live-snapshot-"));
  clock = Date.parse("2026-05-22T11:00:00Z");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const okFetch = () => vi.fn(async () => new Response(RAW, { status: 200 }));

describe("live snapshot rate limit", () => {
  it("allows a first request, refuses within 30 seconds, allows at 30", () => {
    const t = new Date("2026-05-22T11:00:30Z");
    expect(checkSnapshotRateLimit(null, t)).toEqual({ ok: true });
    expect(checkSnapshotRateLimit("2026-05-22T11:00:01Z", t)).toEqual({ ok: false, waitSeconds: 1 });
    expect(checkSnapshotRateLimit("2026-05-22T11:00:00Z", t)).toEqual({ ok: true });
    // A time in the future (clock change) waits the full 30 seconds.
    expect(checkSnapshotRateLimit("2026-05-22T11:05:00Z", t)).toEqual({ ok: false, waitSeconds: 30 });
  });

  it("makes one request per run and refuses a second run within 30 seconds without requesting", async () => {
    const fetchImpl = okFetch();
    const first = await saveLiveSnapshot({ fetchImpl, now, dir });
    expect(first.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(DFS_LIVE_URL, expect.anything());

    clock += 29_000;
    const second = await saveLiveSnapshot({ fetchImpl, now, dir });
    expect(second).toEqual({ ok: false, reason: "rate-limited", waitSeconds: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    clock += 1_000;
    expect((await saveLiveSnapshot({ fetchImpl, now, dir })).ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("counts a failed request toward the limit, and doesn't retry", async () => {
    const failing = vi.fn(async () => {
      throw new Error("offline");
    });
    expect(await saveLiveSnapshot({ fetchImpl: failing, now, dir })).toEqual({
      ok: false,
      reason: "network-error",
      message: "offline",
    });
    expect(failing).toHaveBeenCalledTimes(1);
    expect(existsSync(path.join(dir, LAST_REQUEST_FILE))).toBe(true);

    clock += 5_000;
    const fetchImpl = okFetch();
    expect((await saveLiveSnapshot({ fetchImpl, now, dir })).ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("live snapshot output", () => {
  it("saves the raw body exactly as received", async () => {
    const result = await saveLiveSnapshot({ fetchImpl: okFetch(), now, dir });
    if (!result.ok) throw new Error("expected ok");
    expect(path.basename(result.file)).toBe("live-2026-05-22T11-00-00-000Z.json");
    expect(readFileSync(result.file, "utf8")).toBe(RAW);
  });

  it("summarises every key and every onBench, benchReason and status value", () => {
    expect(summariseRawFeed(JSON.parse(RAW))).toEqual({
      topLevelKeys: ["fixtures", "playerStats", "status", "timeStamp"],
      fixtureKeys: ["extra", "homeTeam", "id", "status"],
      playerKeys: ["benchReason", "onBench", "playerId", "status"],
      fixtureCount: 2,
      playerCount: 4,
      onBenchValues: ['"1"', "(missing)", "0", "1"],
      benchReasonValues: ['""', '"Blood rule"', "(missing)"],
      statusValues: {
        topLevel: ['"ok"'],
        fixture: ['"CONCLUDED"', '"LIVE"'],
        player: ['"sub"', "(missing)"],
      },
    });
  });

  it("keeps the body of an HTTP error and a non-JSON body", async () => {
    const error = await saveLiveSnapshot({
      fetchImpl: vi.fn(async () => new Response("Forbidden", { status: 403 })),
      now,
      dir,
    });
    expect(error).toMatchObject({ ok: false, reason: "http-error", httpStatus: 403 });
    expect(readdirSync(dir).filter((f) => f.endsWith(".txt"))).toHaveLength(1);

    clock += 30_000;
    const html = await saveLiveSnapshot({ fetchImpl: vi.fn(async () => new Response("<html>", { status: 200 })), now, dir });
    expect(html).toMatchObject({ ok: true, summary: null });
  });

  it("is a manual tool: no loops or timers, not in the weekly update, output gitignored", () => {
    const script = readFileSync(path.resolve("scripts/save-live-snapshot.ts"), "utf8");
    const lib = readFileSync(path.resolve("lib/liveMatch/liveSnapshot.ts"), "utf8");
    for (const source of [script, lib]) {
      expect(source).not.toMatch(/setInterval|setTimeout|while\s*\(|for\s*\(;;\)/);
    }
    expect(readFileSync(path.resolve("scripts/update-weekly.mjs"), "utf8")).not.toMatch(/live:snapshot|save-live-snapshot/);
    expect(readFileSync(path.resolve(".gitignore"), "utf8")).toMatch(/^\/scripts\/output\/$/m);
  });
});
