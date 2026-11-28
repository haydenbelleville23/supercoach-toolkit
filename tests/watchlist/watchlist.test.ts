import { describe, expect, it } from "vitest";

import { parseTeamExport, teamExportFile } from "@/lib/planner/useMyTeam";
import { createEmptyTeam } from "@/lib/planner/teamFile";
import {
  WATCHLIST_MAX,
  cleanEntries,
  emptyWatchlist,
  parseWatchlist,
  toggleWatchlist,
  watchlistKey,
} from "@/lib/watchlist/watchlist";

const NOW = new Date("2026-05-01T10:00:00Z");

describe("watchlist storage", () => {
  it("uses a season-scoped key", () => {
    expect(watchlistKey(2026)).toBe("footynomics.watchlist.2026");
    expect(watchlistKey(2027)).not.toBe(watchlistKey(2026));
  });

  it("toggles a player on (with the date added) and off", () => {
    const on = toggleWatchlist(emptyWatchlist(2026), 10, NOW);
    expect(on).toEqual({
      ok: true,
      added: true,
      file: { version: 1, season: 2026, players: [{ id: 10, addedAt: NOW.toISOString() }] },
    });

    const off = toggleWatchlist(on.ok ? on.file : emptyWatchlist(2026), 10, NOW);
    expect(off.ok && off.file.players).toEqual([]);
    expect(off.ok && off.added).toBe(false);
  });

  it("refuses a 61st player, but still allows removing", () => {
    const full = {
      ...emptyWatchlist(2026),
      players: Array.from({ length: WATCHLIST_MAX }, (_, i) => ({ id: i + 1, addedAt: NOW.toISOString() })),
    };
    expect(toggleWatchlist(full, 999, NOW)).toEqual({ ok: false, reason: "full" });
    const removed = toggleWatchlist(full, 1, NOW);
    expect(removed.ok && removed.file.players).toHaveLength(WATCHLIST_MAX - 1);
  });

  it("drops duplicates, invalid ids and (when given) ids not in the data", () => {
    const entries = cleanEntries(
      [{ id: 1, addedAt: "2026-01-01T00:00:00Z" }, { id: 1 }, { id: -5 }, { id: "x" }, 2, 3],
      new Set([1, 2]),
    );
    expect(entries.map((e) => e.id)).toEqual([1, 2]);
    expect(entries[0].addedAt).toBe("2026-01-01T00:00:00Z");
  });

  it("ignores unknown ids when toggling, so they are cleaned up on save", () => {
    const file = { ...emptyWatchlist(2026), players: [{ id: 404, addedAt: NOW.toISOString() }] };
    const result = toggleWatchlist(file, 7, NOW, new Set([7]));
    expect(result.ok && result.file.players.map((e) => e.id)).toEqual([7]);
  });

  it("migrates a bare id list, and reads only this season's version-1 list", () => {
    expect(parseWatchlist([5, 6, 5], 2026).players.map((e) => e.id)).toEqual([5, 6]);
    expect(parseWatchlist({ version: 1, season: 2026, players: [{ id: 5, addedAt: NOW.toISOString() }] }, 2026).players).toHaveLength(1);
    expect(parseWatchlist({ version: 1, season: 2025, players: [{ id: 5 }] }, 2026).players).toEqual([]);
    expect(parseWatchlist({ version: 2, season: 2026, players: [{ id: 5 }] }, 2026).players).toEqual([]);
    expect(parseWatchlist("junk", 2026)).toEqual(emptyWatchlist(2026));
  });
});

describe("watchlist in the My Team export", () => {
  const team = createEmptyTeam(2026, 10);

  it("round-trips: the team without the watchlist, and the watchlist", () => {
    const watchlist = [
      { id: 12, addedAt: "2026-04-01T00:00:00.000Z" },
      { id: 34, addedAt: "2026-04-02T00:00:00.000Z" },
    ];
    const file = JSON.parse(JSON.stringify(teamExportFile(team, watchlist)));
    const imported = parseTeamExport(file);
    if (typeof imported === "string") throw new Error(imported);

    expect(imported.watchlist).toEqual(watchlist);
    expect("watchlist" in imported.team).toBe(false);
    expect(imported.team.version).toBe(1);
    expect(imported.team.season).toBe(2026);
  });

  it("still imports an older export without a watchlist", () => {
    const imported = parseTeamExport(JSON.parse(JSON.stringify(team)));
    if (typeof imported === "string") throw new Error(imported);
    expect(imported.watchlist).toBeNull();
    expect(imported.team.players).toEqual([]);
  });

  it("rejects a file that isn't a team file", () => {
    expect(typeof parseTeamExport({ watchlist: [1] })).toBe("string");
  });
});
