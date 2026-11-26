/**
 * Builds data/history/matchups-{SEASON}.json (committed) from a past
 * season's downloads in data/history/{SEASON}/ (gitignored). No network.
 *
 *   npm run build:history                # season 2025
 *   npm run build:history -- 2024
 *
 * The compact file holds the season's player list (id, name, team,
 * feed_id) and, keyed by feed_id, each downloaded player's team, positions
 * and one row per round played: [round, opponent, venue, score, minutes,
 * games]. No per-match stats. See docs/history-download.md.
 *
 * --history-dir <dir> reads and writes under another folder (for tests).
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { buildMatchupsFile } from "./history/matchupsFile.mjs";

const args = process.argv.slice(2);
const SEASON = Number(args.find((a) => /^\d{4}$/.test(a)) ?? 2025);
const dirFlag = args.indexOf("--history-dir");
const HISTORY_DIR = path.resolve(dirFlag === -1 ? "data/history" : args[dirFlag + 1]);

const SEASON_DIR = path.join(HISTORY_DIR, String(SEASON));
const LIST_FILE = path.join(SEASON_DIR, "players-list.json");
const PLAYERS_DIR = path.join(SEASON_DIR, "players");
const OUTPUT_FILE = path.join(HISTORY_DIR, `matchups-${SEASON}.json`);

if (!existsSync(LIST_FILE) || !existsSync(PLAYERS_DIR)) {
  console.error(
    `No downloads for ${SEASON} in ${SEASON_DIR}. Run \`npm run download:history -- ${SEASON}\` first.`,
  );
  process.exit(1);
}

const list = JSON.parse(readFileSync(LIST_FILE, "utf8"));
const records = readdirSync(PLAYERS_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(path.join(PLAYERS_DIR, f), "utf8")));

const file = buildMatchupsFile({
  season: SEASON,
  list,
  records,
  source: `Public /${SEASON}/api/afl/classic/v1/players list and per-player records (no auth).`,
});

const output = JSON.stringify(file);
await writeFile(OUTPUT_FILE, `${output}\n`, "utf8");

const players = Object.keys(file.byFeedId).length;
const rounds = Object.values(file.byFeedId).reduce((t, p) => t + p.rounds.length, 0);
console.log(`Built ${path.relative(process.cwd(), OUTPUT_FILE)}: ${file.players.length} listed, ${players} with rounds, ${rounds} rounds played, ${(output.length / 1024).toFixed(0)} KB.`);
