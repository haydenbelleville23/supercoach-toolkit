import type { Game, GamePlayer, GamesIndex, GameTeamScore, RoundGamesFile } from "./types";

type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isNullableNum = (v: unknown) => v === null || isNum(v);

const NULLABLE_PLAYER_NUMBERS: (keyof GamePlayer)[] = [
  "minutes", "tog", "kicks", "handballs", "disposals", "marks", "tackles",
  "hitouts", "goals", "behinds", "price", "priceChange",
];

function checkScore(raw: unknown, where: string, errors: string[]): raw is GameTeamScore {
  if (!isObject(raw)) {
    errors.push(`${where}: missing.`);
    return false;
  }
  if (typeof raw.team !== "string" || !/^[A-Z]{3}$/.test(raw.team)) errors.push(`${where}.team must be a club code.`);
  if (typeof raw.teamName !== "string") errors.push(`${where}.teamName must be text.`);
  for (const key of ["goals", "behinds", "total"] as const) {
    if (!isInt(raw[key]) || (raw[key] as number) < 0) errors.push(`${where}.${key} must be a whole number.`);
  }
  if (isInt(raw.goals) && isInt(raw.behinds) && isInt(raw.total) && raw.goals * 6 + raw.behinds !== raw.total) {
    errors.push(`${where}: ${raw.goals}.${raw.behinds} isn't ${raw.total}.`);
  }
  return true;
}

function checkPlayer(raw: unknown, where: string, errors: string[]) {
  if (!isObject(raw)) {
    errors.push(`${where}: not an object.`);
    return;
  }
  if (!isInt(raw.id)) errors.push(`${where}.id must be a whole number.`);
  if (typeof raw.name !== "string") errors.push(`${where}.name must be text.`);
  if (typeof raw.team !== "string") errors.push(`${where}.team must be text.`);
  if (!Array.isArray(raw.positions)) errors.push(`${where}.positions must be a list.`);
  if (!isNum(raw.score)) errors.push(`${where}.score must be a number.`);
  for (const key of NULLABLE_PLAYER_NUMBERS) {
    if (!isNullableNum(raw[key])) errors.push(`${where}.${key} must be a number or null.`);
  }
}

function checkGame(raw: unknown, where: string, round: number, errors: string[]) {
  if (!isObject(raw)) {
    errors.push(`${where}: not an object.`);
    return;
  }
  if (typeof raw.id !== "string" || !/^\d{4}-\d+-[a-z]{3}-[a-z]{3}$/.test(raw.id)) errors.push(`${where}.id is malformed.`);
  if (raw.round !== round) errors.push(`${where}.round must be ${round}.`);
  if (!isInt(raw.fixtureId)) errors.push(`${where}.fixtureId must be a whole number.`);
  if (typeof raw.venue !== "string") errors.push(`${where}.venue must be text.`);
  if (typeof raw.kickoff !== "string" || Number.isNaN(Date.parse(raw.kickoff))) errors.push(`${where}.kickoff must be a date.`);
  const homeOk = checkScore(raw.home, `${where}.home`, errors);
  const awayOk = checkScore(raw.away, `${where}.away`, errors);
  if (homeOk && awayOk && isObject(raw.home) && isObject(raw.away)) {
    const margin = (raw.home.total as number) - (raw.away.total as number);
    if (raw.margin !== margin) errors.push(`${where}.margin must be ${margin}.`);
    const winner = margin === 0 ? null : margin > 0 ? raw.home.team : raw.away.team;
    if (raw.winner !== winner) errors.push(`${where}.winner must be ${winner}.`);
  }
  if (raw.quarters !== null) errors.push(`${where}.quarters must be null.`);
  if (!isObject(raw.players) || !Array.isArray(raw.players.home) || !Array.isArray(raw.players.away)) {
    errors.push(`${where}.players must have home and away lists.`);
  } else {
    (raw.players.home as unknown[]).forEach((p, i) => checkPlayer(p, `${where}.players.home[${i}]`, errors));
    (raw.players.away as unknown[]).forEach((p, i) => checkPlayer(p, `${where}.players.away[${i}]`, errors));
  }
}

/** Checks a round file; lists every problem. */
export function validateRoundFile(raw: unknown, expected?: { season: number; round: number }): Result<RoundGamesFile> {
  const errors: string[] = [];
  if (!isObject(raw)) return { ok: false, errors: ["Not an object."] };
  if (!isInt(raw.season)) errors.push("season must be a year.");
  if (!isInt(raw.round)) errors.push("round must be a whole number.");
  if (expected && raw.season !== expected.season) errors.push(`season must be ${expected.season}.`);
  if (expected && raw.round !== expected.round) errors.push(`round must be ${expected.round}.`);
  if (!Array.isArray(raw.games)) {
    errors.push("games must be a list.");
  } else {
    (raw.games as unknown[]).forEach((g, i) => checkGame(g, `games[${i}]`, raw.round as number, errors));
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: raw as unknown as RoundGamesFile };
}

/** Checks the index file. */
export function validateGamesIndex(raw: unknown): Result<GamesIndex> {
  const errors: string[] = [];
  if (!isObject(raw)) return { ok: false, errors: ["Not an object."] };
  if (!isInt(raw.season)) errors.push("season must be a year.");
  if (!Array.isArray(raw.rounds) || !(raw.rounds as unknown[]).every(isInt)) errors.push("rounds must be whole numbers.");
  if (!isObject(raw.gameCounts)) errors.push("gameCounts must be an object.");
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: raw as unknown as GamesIndex };
}

export type { Game };
