/**
 * An INVENTED sample fixture for testing a new season locally (DEBUG_SEASON
 * only; see lib/season/dataSource.ts). Rounds 0 to 24 like 2026: an
 * Opening Round (10 teams), byes in Rounds 2 to 4 and 12 to 16, two byes per
 * team. Pairings come from a round-robin, so they mean nothing. Pure and
 * deterministic: the same output every run.
 */

import { ALL_TEAMS, type ImportedGame } from "./fixtureImport";

export const SAMPLE_MARKER = "INVENTED SAMPLE";

/** Byes per round, as in 2026 (36 in all: two per team). */
export const SAMPLE_BYES: Readonly<Record<number, number>> = {
  0: 8, 2: 4, 3: 4, 4: 2, 12: 4, 13: 2, 14: 4, 15: 4, 16: 4,
};

const HOME_GROUND: Readonly<Record<string, string>> = {
  ADE: "Adelaide Oval", BRL: "Gabba", CAR: "Marvel Stadium", COL: "MCG", ESS: "Marvel Stadium",
  FRE: "Optus Stadium", GCS: "People First Stadium", GEE: "GMHBA Stadium", GWS: "ENGIE Stadium",
  HAW: "MCG", MEL: "MCG", NTH: "Marvel Stadium", PTA: "Adelaide Oval", RIC: "MCG",
  STK: "Marvel Stadium", SYD: "SCG", WBD: "Marvel Stadium", WCE: "Optus Stadium",
};

/** Day after the round's Thursday, and local time, for each game slot. */
const SLOTS: readonly [number, string][] = [
  [0, "19:30"], [1, "19:40"], [2, "13:45"], [2, "16:35"], [2, "19:35"],
  [3, "13:10"], [3, "15:20"], [3, "17:40"], [3, "19:20"],
];

/** Melbourne time: +11:00 (daylight saving) until 4 April 2027, then +10:00. */
function kickoffFor(season: number, round: number, slot: number): string {
  const [dayOffset, time] = SLOTS[slot];
  // Round 0 starts on the first Thursday of March.
  const firstThursday = new Date(Date.UTC(season, 2, 1));
  while (firstThursday.getUTCDay() !== 4) firstThursday.setUTCDate(firstThursday.getUTCDate() + 1);
  const date = new Date(firstThursday);
  date.setUTCDate(date.getUTCDate() + round * 7 + dayOffset);
  const ymd = date.toISOString().slice(0, 10);
  const dstEnd = new Date(Date.UTC(season, 3, 1));
  while (dstEnd.getUTCDay() !== 0) dstEnd.setUTCDate(dstEnd.getUTCDate() + 1);
  const offset = date < dstEnd ? "+11:00" : "+10:00";
  return `${ymd}T${time}:00${offset}`;
}

/** The circle-method round robin: 17 rounds of 9 games for 18 teams. */
function roundRobin(teams: readonly string[]): [string, string][][] {
  const fixed = teams[0];
  const rotating = teams.slice(1);
  const rounds: [string, string][][] = [];

  for (let r = 0; r < teams.length - 1; r += 1) {
    const order = [fixed, ...rotating.slice(r), ...rotating.slice(0, r)];
    const games: [string, string][] = [];
    for (let i = 0; i < teams.length / 2; i += 1) {
      const a = order[i];
      const b = order[order.length - 1 - i];
      games.push(i % 2 === r % 2 ? [a, b] : [b, a]);
    }
    rounds.push(games);
  }
  return rounds;
}

/**
 * Byes first (each team twice, handed out in team order across the bye
 * rounds), then each round's round-robin pairs; teams whose opponent is on
 * a bye are paired with each other. Deterministic.
 */
export function generateSampleGames(season: number): Pick<ImportedGame, "round" | "home" | "away" | "venue" | "kickoff">[] {
  const robin = roundRobin(ALL_TEAMS);
  const byeQueue = [...ALL_TEAMS, ...ALL_TEAMS];
  const games: Pick<ImportedGame, "round" | "home" | "away" | "venue" | "kickoff">[] = [];

  for (let round = 0; round <= 24; round += 1) {
    const onBye = new Set(byeQueue.splice(0, SAMPLE_BYES[round] ?? 0));
    const base = robin[round % robin.length].map(([a, b]): [string, string] =>
      round >= robin.length ? [b, a] : [a, b],
    );

    const pairs = base.filter(([a, b]) => !onBye.has(a) && !onBye.has(b));
    const leftOver = base.flatMap(([a, b]) => [a, b]).filter((team) => !onBye.has(team) && !pairs.some((p) => p.includes(team)));
    for (let i = 0; i < leftOver.length; i += 2) pairs.push([leftOver[i], leftOver[i + 1]]);

    pairs.forEach(([home, away], slot) => {
      games.push({ round, home, away, venue: HOME_GROUND[home], kickoff: kickoffFor(season, round, slot) });
    });
  }

  return games;
}

/** The sample as CSV (round, home, away, venue, kickoff, notes), for checking with the importer. */
export function sampleGamesCsv(games: ReturnType<typeof generateSampleGames>): string {
  return [
    "round,home,away,venue,kickoff,notes",
    ...games.map((g) => `${g.round},${g.home},${g.away},${g.venue},${g.kickoff},${SAMPLE_MARKER}`),
  ].join("\n");
}
