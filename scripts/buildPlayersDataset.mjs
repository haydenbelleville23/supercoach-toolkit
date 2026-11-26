/**
 * Builds data/2026/players-complete.json from the public per-player detail
 * files in data/2026/player-details/ (one file per player id, downloaded by
 * scripts/downloadPlayerDetails.mjs).
 *
 * The player list is the set of ids already in that folder. Each player's
 * round-by-round records (the detail file's player_stats) are stored as
 * player_stat_history, which the normaliser reads. Subscriber-only
 * SuperCoach fields are stripped defensively, although the public
 * endpoint does not return them.
 */

import {
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const SEASON = 2026;

const PLAYER_DETAILS_DIRECTORY = path.resolve(
  `data/${SEASON}/player-details`,
);

const OUTPUT_FILE = path.resolve(
  `data/${SEASON}/players-complete.json`,
);

const REPORT_FILE = path.resolve(
  `data/${SEASON}/players-complete-report.json`,
);

/** Subscriber-only fields that must never be stored. */
const SUBSCRIBER_FIELDS = [
  "be1", "be2", "be3",
  "pp1", "pp2", "pp3",
  "ppc1", "ppc2", "ppc3", "ppcs",
  "ppts", "ppts1", "ppts2", "ppts3",
  "pmin", "pmax", "prange",
  "bp1", "bp2", "bp3",
  "pavg3", "own", "ccow",
];

async function readJson(filePath) {
  const contents = await readFile(filePath, "utf8");

  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new Error(
      `Could not parse ${filePath}: ${error.message}`,
    );
  }
}

function stripSubscriberFields(record) {
  const clean = { ...record };

  for (const field of SUBSCRIBER_FIELDS) {
    delete clean[field];
  }

  return clean;
}

/** Ids of the players already downloaded (e.g. 123.json -> 123). */
export async function readKnownPlayerIds(directory = PLAYER_DETAILS_DIRECTORY) {
  let fileNames;

  try {
    fileNames = await readdir(directory);
  } catch {
    return [];
  }

  return fileNames
    .filter((fileName) => /^\d+\.json$/.test(fileName))
    .map((fileName) => Number(fileName.replace(".json", "")))
    .filter((id) => Number.isInteger(id) && id > 0)
    .sort((a, b) => a - b);
}

function toCompletePlayer(detail) {
  const { player_stats: statHistory, ...rest } = stripSubscriberFields(detail);

  return {
    ...rest,
    positions: rest.positions ?? [],
    player_stat_history: (statHistory ?? []).map(stripSubscriberFields),
    player_match_stats: rest.player_match_stats ?? [],
    trades: rest.trades ?? [],
    notes: rest.notes ?? [],
    odds: rest.odds ?? [],
  };
}

async function main() {
  console.log("Building complete SuperCoach player dataset");
  console.log("-------------------------------------------");

  const ids = await readKnownPlayerIds();

  if (ids.length === 0) {
    throw new Error(
      `No player detail files in ${PLAYER_DETAILS_DIRECTORY}. ` +
        "The player list is seeded from that folder, and there is no " +
        "public source for discovering players yet.",
    );
  }

  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });

  const completePlayers = [];
  const invalidDetails = [];

  for (const id of ids) {
    const detailFile = path.join(PLAYER_DETAILS_DIRECTORY, `${id}.json`);

    try {
      const detail = await readJson(detailFile);

      if (!detail || detail.id !== id) {
        throw new Error("The file does not hold this player's record.");
      }

      completePlayers.push(toCompletePlayer(detail));
    } catch (error) {
      invalidDetails.push({ id, error: error.message });
    }
  }

  const playersWithMatchHistory = completePlayers.filter(
    (player) => player.player_match_stats.length > 0,
  ).length;

  console.log("");
  console.log(`Detail files found:         ${ids.length}`);
  console.log(`Complete players:           ${completePlayers.length}`);
  console.log(`Players with match history: ${playersWithMatchHistory}`);
  console.log(`Invalid details:            ${invalidDetails.length}`);

  // A partial dataset would silently drop players, so stop without
  // touching the existing output files.
  if (invalidDetails.length > 0) {
    console.error("");
    console.error("Dataset NOT written: some player files are invalid.");

    for (const item of invalidDetails.slice(0, 20)) {
      console.error(`  ${item.id}: ${item.error}`);
    }

    console.error(
      "Run `npm run download:players -- --refresh` and try again.",
    );

    process.exitCode = 1;
    return;
  }

  await writeFile(
    OUTPUT_FILE,
    `${JSON.stringify(completePlayers, null, 2)}\n`,
    "utf8",
  );

  const report = {
    season: SEASON,
    generatedAt: new Date().toISOString(),
    detailFilesFound: ids.length,
    completePlayers: completePlayers.length,
    playersWithMatchHistory,
    invalidDetails,
  };

  await writeFile(
    REPORT_FILE,
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );

  console.log("");
  console.log("Dataset complete.");
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log(`Report: ${REPORT_FILE}`);
}

// Only build when run directly (update-weekly imports readKnownPlayerIds).
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main().catch((error) => {
    console.error("");
    console.error("Dataset build failed:");
    console.error(error);

    process.exitCode = 1;
  });
}
