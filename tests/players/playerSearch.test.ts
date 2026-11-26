import { describe, expect, it } from "vitest";

import { matchRank, normaliseSearchText, searchPlayers } from "@/lib/players/playerSearch";
import type { Player } from "@/types/player";

const player = (id: number, name: string, team: string, teamName: string, positions = ["MID"]): Player => ({
  id,
  championDataId: null,
  name,
  team,
  teamName,
  positions,
  price: 300_000,
  games: 5,
  average: 80,
  average3: 80,
  average5: 80,
  recentScores: [],
  history: [],
  breakeven: 70,
  ownership: null,
  previousGames: 20,
  previousAverage: 80,
  active: true,
  availability: null,
});

const players = [
  player(1, "Luke Davies-Uniacke", "NTH", "North Melbourne"),
  player(2, "Zak O'Brien", "WCE", "West Coast Eagles", ["DEF"]),
  player(3, "Zoë Unique", "MEL", "Melbourne"),
  player(4, "Max Gawn", "MEL", "Melbourne", ["RUC"]),
  player(5, "Uni Maxwell", "COL", "Collingwood"),
  player(6, "Jordan De Goey", "COL", "Collingwood", ["MID", "FWD"]),
];

const names = (query: string) => searchPlayers(players, query).map((p) => p.name);

describe("normaliseSearchText", () => {
  it("drops accents, apostrophes and case; hyphens become spaces", () => {
    expect(normaliseSearchText("Zoë")).toBe("zoe");
    expect(normaliseSearchText("O'Brien")).toBe("obrien");
    expect(normaliseSearchText("Davies-Uniacke")).toBe("davies uniacke");
  });
});

describe("searchPlayers", () => {
  it("ignores accents, case and punctuation", () => {
    expect(names("zoe")).toEqual(["Zoë Unique"]);
    expect(names("OBRIEN")).toEqual(["Zak O'Brien"]);
    expect(names("o'brien")).toEqual(["Zak O'Brien"]);
    expect(names("davies uniacke")).toEqual(["Luke Davies-Uniacke"]);
    expect(names("daviesuniacke")).toEqual(["Luke Davies-Uniacke"]);
    expect(names("davies-uni")).toEqual(["Luke Davies-Uniacke"]);
  });

  it("needs 3+ letters to match inside a name; shorter words must start one", () => {
    const withHugh = [...players, player(7, "Hugh Davies", "FRE", "Fremantle", ["DEF"])];
    const find = (query: string) => searchPlayers(withHugh, query).map((p) => p.name);

    // "u" doesn't start any of Hugh Davies's name words.
    expect(find("davies-u")).toEqual(["Luke Davies-Uniacke"]);
    // Both surnames start "davies": a tie, so input order.
    expect(find("davies")).toEqual(["Luke Davies-Uniacke", "Hugh Davies"]);
    expect(find("niack")).toEqual(["Luke Davies-Uniacke"]);
  });

  it("matches first name, surname and full name", () => {
    expect(names("luke")).toEqual(["Luke Davies-Uniacke"]);
    expect(names("gawn")).toEqual(["Max Gawn"]);
    expect(names("max gawn")).toEqual(["Max Gawn"]);
    expect(names("de goey")).toEqual(["Jordan De Goey"]);
  });

  it("matches team code and team name, alone or with a name", () => {
    // The exact code first, then a word of another team's name (North Melbourne).
    expect(names("mel")).toEqual(["Zoë Unique", "Max Gawn", "Luke Davies-Uniacke"]);
    expect(names("melbourne")).toEqual(["Luke Davies-Uniacke", "Zoë Unique", "Max Gawn"]);
    expect(names("collingwood")).toEqual(["Uni Maxwell", "Jordan De Goey"]);
    expect(names("col jordan")).toEqual(["Jordan De Goey"]);
  });

  it("ranks surname-prefix matches first, then first-name matches", () => {
    // "uni": Unique and (Davies-)Uniacke are surnames; Uni is a first name.
    expect(names("uni")).toEqual(["Zoë Unique", "Uni Maxwell", "Luke Davies-Uniacke"]);
    expect(matchRank(players[2], "uni")).toBe(0);
    expect(matchRank(players[4], "uni")).toBe(1);
    // "max": Maxwell (surname) before Max (first name).
    expect(names("max")).toEqual(["Uni Maxwell", "Max Gawn"]);
  });

  it("keeps the input order for equal ranks (stable)", () => {
    const reversed = [...players].reverse();
    expect(searchPlayers(reversed, "col").map((p) => p.id)).toEqual([6, 5]);
    expect(searchPlayers(players, "col").map((p) => p.id)).toEqual([5, 6]);
    expect(searchPlayers(players, "")).toEqual(players);
  });

  it("matches an exact position code only", () => {
    expect(names("ruc")).toEqual(["Max Gawn"]);
    expect(names("de")).toEqual(["Jordan De Goey"]);
    expect(names("def")).toEqual(["Zak O'Brien"]);
  });
});
