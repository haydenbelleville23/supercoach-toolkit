/**
 * MANUAL ONE-OFF: downloads a past season's public player history for the
 * matchup research. Not part of the weekly update. See docs/history-download.md.
 *
 *   npm run download:history                 # season 2025
 *   npm run download:history -- 2024
 *   npm run download:history -- 2025 --dry-run   # counts and first URLs, no requests
 *   npm run download:history -- 2025 --refresh    # re-download saved players
 *
 * Steps:
 *   1. GET the public /{SEASON}/api/afl/classic/v1/players list
 *      (saved to data/history/{SEASON}/players-list.json).
 *   2. Link to current players by feed_id (Champion Data id).
 *   3. For linked players only, GET /{SEASON}/api/afl/classic/v1/players/{id}
 *      with embed=player_stats,player_match_stats,positions, saved to
 *      data/history/{SEASON}/players/{id}.json (gitignored).
 *
 * Public only: no subscriber key or auth parameters; the same User-Agent
 * as the other downloaders; one request at a time, at least 250ms apart;
 * up to 4 attempts with backoff on network errors and 5xx. The whole run
 * STOPS on 401, 403 or 429 and reports how far it got. Resumable: players
 * already saved are skipped unless --refresh.
 *
 * Then run `npm run build:history -- {SEASON}` for the compact file.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { normaliseFeedId } from "./history/matchupsFile.mjs";

const CURRENT_SEASON = 2026;
const REQUEST_DELAY_MS = 250;
const MAX_ATTEMPTS = 4;
const USER_AGENT = "Mozilla/5.0 SuperCoach-Toolkit-Data-Importer/1.0";
const EMBED = ["player_stats", "player_match_stats", "positions"].join(",");

const args = process.argv.slice(2);
const SEASON = Number(args.find((a) => /^\d{4}$/.test(a)) ?? 2025);
const DRY_RUN = args.includes("--dry-run");
const REFRESH = args.includes("--refresh");

if (!Number.isInteger(SEASON) || SEASON < 2010 || SEASON >= CURRENT_SEASON) {
  console.error(`Season must be a past season before ${CURRENT_SEASON} (got ${SEASON}).`);
  process.exit(2);
}

const BASE = `https://www.supercoach.com.au/${SEASON}/api/afl/classic/v1`;
const listUrl = `${BASE}/players`;
const playerUrl = (id) => `${BASE}/players/${id}?embed=${encodeURIComponent(EMBED)}`;

const SEASON_DIR = path.resolve(`data/history/${SEASON}`);
const LIST_FILE = path.join(SEASON_DIR, "players-list.json");
const PLAYERS_DIR = path.join(SEASON_DIR, "players");
const CURRENT_DIR = path.resolve(`data/${CURRENT_SEASON}/player-details`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class StopRun extends Error {}

let requests = 0;

/** One polite GET with retries; throws StopRun on 401/403/429. */
async function getJson(url) {
  for (let attempt = 1; ; attempt++) {
    let status = null;

    try {
      requests += 1;
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      });
      status = response.status;

      if (status === 401 || status === 403 || status === 429) {
        throw new StopRun(`HTTP ${status} from ${url.replace(/\?.*$/, "")}`);
      }

      if (status === 404) {
        return { notFound: true };
      }

      if (!response.ok) {
        throw new Error(`HTTP ${status}`);
      }

      return { data: await response.json() };
    } catch (error) {
      if (error instanceof StopRun) {
        throw error;
      }

      if (attempt >= MAX_ATTEMPTS) {
        throw error;
      }

      const wait = REQUEST_DELAY_MS * 2 ** attempt;
      console.warn(`  Retry ${attempt}/${MAX_ATTEMPTS - 1} in ${wait}ms: ${error.message}`);
      await sleep(wait);
    } finally {
      await sleep(REQUEST_DELAY_MS);
    }
  }
}

/** feed_ids of the players we hold for the current season. */
function currentFeedIds() {
  if (!existsSync(CURRENT_DIR)) {
    throw new Error(`${CURRENT_DIR} is missing: current-season player files are needed to link players.`);
  }

  const ids = new Set();

  for (const file of readdirSync(CURRENT_DIR).filter((f) => f.endsWith(".json"))) {
    const record = JSON.parse(readFileSync(path.join(CURRENT_DIR, file), "utf8"));
    const feedId = normaliseFeedId(record.feed_id);
    if (feedId) ids.add(feedId);
  }

  return ids;
}

function linkedPlayers(list, feedIds) {
  return list.filter((p) => feedIds.has(normaliseFeedId(p.feed_id)));
}

async function main() {
  console.log(`History download for ${SEASON}${DRY_RUN ? " (dry run: no requests)" : ""}`);
  console.log("------------------------------------------");

  const feedIds = currentFeedIds();
  console.log(`Current-season players with a feed_id: ${feedIds.size}`);

  if (DRY_RUN) {
    if (existsSync(LIST_FILE)) {
      const list = JSON.parse(readFileSync(LIST_FILE, "utf8"));
      const linked = linkedPlayers(list, feedIds);
      const saved = linked.filter((p) => existsSync(path.join(PLAYERS_DIR, `${p.id}.json`))).length;
      const toFetch = REFRESH ? linked.length : linked.length - saved;
      console.log(`${SEASON} list (saved): ${list.length} players; linked by feed_id: ${linked.length}; already saved: ${saved}.`);
      console.log(`Would make ${toFetch} player requests (list already saved).`);
      console.log("First URLs:");
      linked.slice(0, 3).forEach((p) => console.log(`  ${playerUrl(p.id)}`));
    } else {
      console.log("The season list isn't saved yet, so linked counts are unknown.");
      console.log(`Would make 1 list request, then one per linked player (about 700 for 2025).`);
      console.log("First URLs:");
      console.log(`  ${listUrl}`);
      console.log(`  ${playerUrl("{id}")} (for each linked player)`);
    }
    return;
  }

  await mkdir(PLAYERS_DIR, { recursive: true });

  // 1. The season's player list.
  let list;
  if (existsSync(LIST_FILE) && !REFRESH) {
    list = JSON.parse(readFileSync(LIST_FILE, "utf8"));
    console.log(`Using the saved ${SEASON} list (${list.length} players).`);
  } else {
    const result = await getJson(listUrl);
    if (!result.data || !Array.isArray(result.data)) {
      throw new Error("The players list was not an array.");
    }
    list = result.data;
    await writeFile(LIST_FILE, `${JSON.stringify(list, null, 2)}\n`, "utf8");
    console.log(`Saved the ${SEASON} list: ${list.length} players.`);
  }

  // 2. Link by feed_id.
  const linked = linkedPlayers(list, feedIds);
  console.log(`Linked to current players by feed_id: ${linked.length}`);

  // 3. Linked players only.
  let downloaded = 0;
  let skipped = 0;
  const failures = [];

  for (const [index, player] of linked.entries()) {
    const file = path.join(PLAYERS_DIR, `${player.id}.json`);
    const progress = `[${index + 1}/${linked.length}]`;

    if (!REFRESH && existsSync(file)) {
      skipped += 1;
      continue;
    }

    try {
      const result = await getJson(playerUrl(player.id));

      if (result.notFound) {
        failures.push({ id: player.id, error: "404" });
        console.warn(`${progress} ${player.id}: not found`);
        continue;
      }

      await writeFile(file, `${JSON.stringify(result.data, null, 2)}\n`, "utf8");
      downloaded += 1;

      if (downloaded % 50 === 0) {
        console.log(`${progress} ${downloaded} downloaded so far`);
      }
    } catch (error) {
      if (error instanceof StopRun) {
        console.error("");
        console.error(`STOPPED: ${error.message}`);
        console.error(`Progress: ${downloaded} downloaded this run, ${skipped} already saved, ${linked.length - index} not reached (stopped at player ${player.id}).`);
        console.error("Nothing was worked around. Re-run later; saved players are skipped.");
        process.exitCode = 1;
        return;
      }

      failures.push({ id: player.id, error: error.message });
      console.warn(`${progress} ${player.id}: ${error.message}`);
    }
  }

  await writeFile(
    path.join(SEASON_DIR, "download-failures.json"),
    `${JSON.stringify(failures, null, 2)}\n`,
    "utf8",
  );

  console.log("");
  console.log(`Done. Requests: ${requests}. Downloaded: ${downloaded}. Already saved: ${skipped}. Failed: ${failures.length}.`);
  console.log(`Next: npm run build:history -- ${SEASON}`);

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
