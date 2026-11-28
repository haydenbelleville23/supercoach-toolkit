import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BENCH_REASON_STATUS,
  MAX_REASON_LENGTH,
  cleanBenchReason,
  countByLiveFilter,
  displayLiveStatus,
  hasLiveStatusDetail,
  isOffGround,
  mapLiveStatus,
  matchesLiveFilter,
  resetLiveStatusLog,
  type LiveStatusInfo,
} from "@/lib/liveMatch/liveStatus";

const player = (onBenchKnown: boolean, onBench: boolean, benchReason: string | null = null) => ({
  onBenchKnown,
  onBench,
  benchReason,
});

describe("mapLiveStatus", () => {
  beforeEach(() => resetLiveStatusLog());
  afterEach(() => vi.restoreAllMocks());

  it("gives no status when the feed had no onBench key, whatever the placeholders say", () => {
    expect(mapLiveStatus(player(false, false))).toBeNull();
    expect(mapLiveStatus(player(false, true, "Blood rule"))).toBeNull();
  });

  it("is on ground only when onBench is known and not 1, with no reason", () => {
    expect(mapLiveStatus(player(true, false))).toEqual({ status: "onGround", reason: null });
    expect(mapLiveStatus(player(true, false, "   "))).toEqual({ status: "onGround", reason: null });
  });

  it("is bench when onBench is 1; the reason is kept as text, never the label", () => {
    expect(mapLiveStatus(player(true, true))).toEqual({ status: "bench", reason: null });
    // No reason text is mapped yet: blood rule, injured and ruled out stay BENCH.
    for (const reason of ["Blood rule", "Injured", "Ruled out", "bloodRule"]) {
      expect(mapLiveStatus(player(true, true, reason))).toEqual({ status: "bench", reason });
    }
    expect(Object.keys(BENCH_REASON_STATUS)).toEqual([]);
  });

  it("is unknown when not on the bench but a reason is given, logged once in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(mapLiveStatus(player(true, false, "Sub"))).toEqual({ status: "unknown", reason: "Sub" });
    mapLiveStatus(player(true, false, "Sub"));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("Sub");
    mapLiveStatus(player(true, false, "Other"));
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("doesn't log outside development", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mapLiveStatus(player(true, false, "Sub"));
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("cleanBenchReason", () => {
  it("trims, joins lines, drops control characters and caps at 40 characters", () => {
    expect(cleanBenchReason("  Blood rule \n")).toBe("Blood rule");
    expect(cleanBenchReason("a\u0000b\tc")).toBe("a b c");
    const long = cleanBenchReason("x".repeat(80))!;
    expect(long.length).toBe(MAX_REASON_LENGTH);
    expect(long.endsWith("…")).toBe(true);
    expect(cleanBenchReason("x".repeat(40))).toBe("x".repeat(40));
    expect(cleanBenchReason("")).toBeNull();
    expect(cleanBenchReason(null)).toBeNull();
    expect(cleanBenchReason(3)).toBeNull();
  });

  it("keeps markup as plain text (React escapes it)", () => {
    expect(cleanBenchReason("<b>hi</b>")).toBe("<b>hi</b>");
  });
});

describe("full time", () => {
  const bench: LiveStatusInfo = { status: "bench", reason: "Blood rule" };
  const unknown: LiveStatusInfo = { status: "unknown", reason: "x" };
  const injured: LiveStatusInfo = { status: "injured", reason: null };

  it("hides BENCH at full time and keeps the other statuses", () => {
    expect(displayLiveStatus(bench, true)).toBeNull();
    expect(displayLiveStatus(bench, false)).toBe(bench);
    expect(displayLiveStatus(unknown, true)).toBe(unknown);
    expect(displayLiveStatus(injured, true)).toBe(injured);
    expect(displayLiveStatus(null, true)).toBeNull();
  });
});

describe("filter groups", () => {
  const s = (status: LiveStatusInfo["status"]): LiveStatusInfo => ({ status, reason: null });
  const infos = [null, s("onGround"), s("bench"), s("bloodRule"), s("injured"), s("ruledOut"), s("unknown")];

  it("puts no status under On ground, unknown only under All", () => {
    expect(infos.filter((i) => matchesLiveFilter(i, "onGround"))).toEqual([null, s("onGround")]);
    expect(infos.filter((i) => matchesLiveFilter(i, "bench"))).toEqual([s("bench")]);
    expect(infos.filter((i) => matchesLiveFilter(i, "off"))).toEqual([s("bloodRule"), s("injured"), s("ruledOut")]);
    expect(infos.filter((i) => matchesLiveFilter(i, "all"))).toEqual(infos);
  });

  it("counts each group", () => {
    expect(countByLiveFilter(infos)).toEqual({ onGround: 2, bench: 1, off: 3, all: 7 });
    expect(countByLiveFilter([])).toEqual({ onGround: 0, bench: 0, off: 0, all: 0 });
  });

  it("shows the filter only when someone has a status other than on ground", () => {
    expect(hasLiveStatusDetail([null, s("onGround")])).toBe(false);
    expect(hasLiveStatusDetail([])).toBe(false);
    expect(hasLiveStatusDetail([null, s("bench")])).toBe(true);
    expect(hasLiveStatusDetail([s("unknown")])).toBe(true);
  });

  it("dims bench and off rows only", () => {
    expect(infos.map(isOffGround)).toEqual([false, false, true, true, true, true, false]);
  });
});
