import { describe, expect, it } from "vitest";

import {
  diffSnapshots,
  importAvailabilityList,
  listRoundFor,
  summariseByStatus,
  type ImportResult,
} from "@/lib/availability/importList";
import { matchPlayer, resolveTeam } from "@/lib/availability/matchPlayers";
import { parseAvailabilityTable, parseSelected } from "@/lib/availability/parseTable";
import { validateAvailability } from "@/lib/availability/validate";

const player = (id: number, name: string, team: string, teamName = team, positions = ["MID"]) => ({
  id,
  name,
  team,
  teamName,
  positions,
});

const players = [
  player(1, "Luke Davies-Uniacke", "NTH", "North Melbourne"),
  player(2, "Zak O'Brien", "WCE", "West Coast Eagles"),
  player(3, "Zoë Unique", "MEL", "Melbourne"),
  player(4, "Max King", "STK", "St Kilda", ["FWD"]),
  player(5, "Max King", "SYD", "Sydney", ["MID"]),
  player(6, "Jordan Dawson", "ADE", "Adelaide"),
];

const run = (text: string, superCoach = []) =>
  importAvailabilityList({
    text,
    players,
    asOf: "2026-05-19",
    round: 11,
    season: 2026,
    source: "Test list",
    superCoach,
  }) as ImportResult;

describe("resolveTeam", () => {
  it("reads codes, names and nicknames", () => {
    expect(resolveTeam("ADE")).toBe("ADE");
    expect(resolveTeam("Crows")).toBe("ADE");
    expect(resolveTeam("adelaide crows")).toBe("ADE");
    expect(resolveTeam("Greater Western Sydney")).toBe("GWS");
    expect(resolveTeam("North Melbourne")).toBe("NTH");
    expect(resolveTeam("Nowhere FC")).toBeNull();
  });
});

describe("matchPlayer", () => {
  it("ignores case, accents, hyphens and apostrophes", () => {
    expect(matchPlayer(players, "luke davies uniacke", "NTH")).toMatchObject({ kind: "matched", player: { id: 1 } });
    expect(matchPlayer(players, "Luke DaviesUniacke", "Kangaroos")).toMatchObject({ kind: "matched", player: { id: 1 } });
    expect(matchPlayer(players, "ZAK OBRIEN", "West Coast")).toMatchObject({ kind: "matched", player: { id: 2 } });
    expect(matchPlayer(players, "Zoe Unique", "Demons")).toMatchObject({ kind: "matched", player: { id: 3 } });
  });

  it("uses the team to tell apart two players with the same name", () => {
    expect(matchPlayer(players, "Max King", "STK")).toMatchObject({ kind: "matched", player: { id: 4 } });
    expect(matchPlayer(players, "Max King", "Swans")).toMatchObject({ kind: "matched", player: { id: 5 } });
  });

  it("reports ambiguity without a team, with both candidates", () => {
    const result = matchPlayer(players, "Max King", "");
    expect(result.kind).toBe("ambiguous");
    expect(result.kind === "ambiguous" && result.candidates.map((p) => p.id)).toEqual([4, 5]);
  });

  it("reports a wrong team or unknown name as unmatched, with suggestions", () => {
    const wrongTeam = matchPlayer(players, "Jordan Dawson", "COL");
    expect(wrongTeam.kind).toBe("unmatched");
    expect(wrongTeam.kind === "unmatched" && wrongTeam.suggestions.map((p) => p.id)).toContain(6);

    const typo = matchPlayer(players, "Jordan Dawsonn", "ADE");
    expect(typo.kind).toBe("unmatched");

    expect(matchPlayer(players, "Jordan Dawson", "Nowhere FC")).toMatchObject({
      kind: "unmatched",
      reason: 'team "Nowhere FC" not recognised',
    });
  });
});

describe("parseAvailabilityTable", () => {
  it("reads CSV with quotes, comments and columns in any order", () => {
    const parsed = parseAvailabilityTable(
      '# comment\nTeam,Player,Estimated Return,Injury\nADE,"Dawson, Jordan",Test,"Ribs, sore"\n',
    );
    expect(parsed.ok && parsed.rows[0]).toMatchObject({ player: "Dawson, Jordan", team: "ADE", injury: "Ribs, sore", return: "Test" });
  });

  it("reads tab- and pipe-separated pasted tables", () => {
    const tab = parseAvailabilityTable("Player\tTeam\tInjury\tEstimated return\nJordan Dawson\tADE\tRibs\tTest");
    expect(tab.ok && tab.delimiter).toBe("\t");
    const pipe = parseAvailabilityTable("player | team | injury | return\nJordan Dawson | ADE | Ribs | Test");
    expect(pipe.ok && pipe.rows[0].return).toBe("Test");
  });

  it("names missing columns", () => {
    const parsed = parseAvailabilityTable("player,team\nJordan Dawson,ADE");
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.errors[0]).toContain("injury, return");
  });

  it("reads selected as yes/no/blank", () => {
    expect(parseSelected("Yes")).toBe(true);
    expect(parseSelected("n")).toBe(false);
    expect(parseSelected("")).toBeNull();
    expect(parseSelected("maybe")).toBeUndefined();
  });
});

describe("importAvailabilityList", () => {
  const list = [
    "player,team,injury,estimated return,selected,status",
    "Jordan Dawson,Crows,Ribs,Test,yes,",
    "Luke Davies Uniacke,NTH,Hamstring,1-2 weeks,,",
    "Max King,STK,Suspension,2 matches,,",
    "Max King,,Knee,Season,,",
    "Nobody Atall,ADE,Knee,TBC,,",
    "Zoe Unique,MEL,Back,TBC,maybe,",
    "Jordan Dawson,ADE,Ribs,Test,,",
  ].join("\n");

  it("builds entries with status, weeks, return round and selection", () => {
    const result = run(list);
    expect(result.snapshot.players[6]).toMatchObject({ status: "test", returnRound: 12, selected: true, source: "Test list" });
    expect(result.snapshot.players[1]).toMatchObject({ status: "short-term", returnWeeks: 2, returnRound: 13 });
    expect(result.snapshot.players[4]).toMatchObject({ status: "suspended", returnWeeks: 2, returnRound: 13 });
    expect(validateAvailability(result.snapshot).ok).toBe(true);
  });

  it("reports ambiguous, unmatched, invalid and duplicate rows and leaves them out", () => {
    const kinds = run(list).problems.map((p) => `${p.line}:${p.kind}`);
    expect(kinds).toEqual(["5:ambiguous", "6:unmatched", "7:invalid", "8:duplicate"]);
    expect(Object.keys(run(list).snapshot.players).sort()).toEqual(["1", "4", "6"]);
  });

  it("falls back to SuperCoach fields for players with no row, unknown values as unknown", () => {
    const result = run("player,team,injury,estimated return\nJordan Dawson,ADE,Ribs,Test", [
      { id: 6, injury_suspension_status: "injured", injury_suspension_status_text: "Ribs", played_status: null },
      { id: 3, injury_suspension_status: "mystery-value", injury_suspension_status_text: "Hamstring", played_status: { status: "pre", display: "Not played" } },
      { id: 2, injury_suspension_status: null, injury_suspension_status_text: null, played_status: null },
    ] as never);

    // The list row wins for Dawson; Unique comes from SuperCoach as unknown.
    expect(result.snapshot.players[6].status).toBe("test");
    expect(result.snapshot.players[3]).toMatchObject({ status: "unknown", injury: "Hamstring", source: "SuperCoach public player data" });
    expect(result.snapshot.players[2]).toBeUndefined();
    expect(result.fromSuperCoach).toBe(1);
    expect(result.superCoachValues.injury_suspension_status).toEqual({ injured: 1, "mystery-value": 1, null: 1 });
    expect(result.superCoachValues.played_status['{"status":"pre","display":"Not played"}']).toBe(1);
  });

  it("summarises by status and diffs against the previous file", () => {
    const first = run("player,team,injury,estimated return\nJordan Dawson,ADE,Ribs,Test\nZak OBrien,WCE,Knee,Season").snapshot;
    const second = run("player,team,injury,estimated return\nJordan Dawson,ADE,,\nLuke Davies-Uniacke,NTH,Calf,1 week").snapshot;

    expect(summariseByStatus(first)).toMatchObject({ test: 1, "long-term": 1, available: 0 });
    expect(diffSnapshots(first, second)).toEqual({
      added: ["1"],
      removed: ["2"],
      changed: [{ id: "6", from: "test, Test", to: "available" }],
    });
  });
});

describe("listRoundFor", () => {
  const fixtures = [
    { round: 10, kickoff: "2026-05-14T19:30:00+10:00" },
    { round: 10, kickoff: "2026-05-17T15:20:00+10:00" },
    { round: 11, kickoff: "2026-05-21T19:30:00+10:00" },
  ];

  it("is the next round with a game on or after the date", () => {
    expect(listRoundFor("2026-05-19", fixtures)).toBe(11);
    expect(listRoundFor("2026-05-15", fixtures)).toBe(10);
    expect(listRoundFor("2026-06-30", fixtures)).toBe(12);
  });
});

describe("validateAvailability", () => {
  it("accepts the no-data stub as no data", () => {
    expect(validateAvailability({ none: true })).toEqual({ ok: true, snapshot: null });
  });

  it("lists every problem in a bad file", () => {
    const result = validateAvailability({
      season: 2026,
      asOf: "19/05/2026",
      round: 11,
      source: "x",
      players: { abc: { status: "injured", injury: 3, returnText: null, returnWeeks: "2", returnRound: null, selected: "yes", asOf: "2026-05-19", source: "x" } },
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.length).toBeGreaterThanOrEqual(6);
  });
});
