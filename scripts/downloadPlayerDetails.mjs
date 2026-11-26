import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { readKnownPlayerIds } from "./buildPlayersDataset.mjs";

const SEASON = 2026;

const OUTPUT_DIRECTORY = path.resolve(
  `data/${SEASON}/player-details`,
);
const FAILURE_FILE = path.resolve(
  `data/${SEASON}/player-detail-failures.json`,
);

const REQUEST_DELAY_MS = 250;
const MAX_RETRIES = 4;

// --refresh re-downloads players that already have a saved file. Without
// it, existing files are skipped (the original behaviour), which keeps old
// data after a new round.
const REFRESH = process.argv.includes("--refresh");

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getPlayerUrl(playerId) {
  const embed = [
    "notes",
    "odds",
    "player_stats",
    "player_match_stats",
    "positions",
    "trades",
  ].join(",");

  return (
    `https://www.supercoach.com.au/${SEASON}` +
    `/api/afl/classic/v1/players/${playerId}` +
    `?embed=${encodeURIComponent(embed)}`
  );
}

async function downloadPlayer(player, attempt = 1) {
  const url = getPlayerUrl(player.id);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 SuperCoach-Toolkit-Data-Importer/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();

    if (!data || typeof data !== "object") {
      throw new Error("The response was not a valid player object.");
    }

    return data;
  } catch (error) {
    if (attempt >= MAX_RETRIES) {
      throw error;
    }

    const retryDelay = REQUEST_DELAY_MS * 2 ** attempt;

    console.warn(
      `  Retry ${attempt}/${MAX_RETRIES - 1} for player ` +
        `${player.id} in ${retryDelay}ms: ${error.message}`,
    );

    await sleep(retryDelay);

    return downloadPlayer(player, attempt + 1);
  }
}

/**
 * The players to download: the ids already saved in player-details/.
 * There is no public source for discovering NEW players yet, so ids are
 * never guessed or enumerated.
 */
async function loadPlayers() {
  const ids = await readKnownPlayerIds(OUTPUT_DIRECTORY);

  if (ids.length === 0) {
    throw new Error(
      `No player files in ${OUTPUT_DIRECTORY}. The player list is seeded ` +
        "from that folder, and there is no public source for discovering " +
        "players yet.",
    );
  }

  const players = [];

  for (const id of ids) {
    try {
      const saved = JSON.parse(
        await readFile(path.join(OUTPUT_DIRECTORY, `${id}.json`), "utf8"),
      );
      players.push({ id, first_name: saved.first_name, last_name: saved.last_name });
    } catch {
      players.push({ id });
    }
  }

  return players;
}

async function main() {
  console.log("SuperCoach player-detail downloader");
  console.log("-----------------------------------");

  const players = await loadPlayers();

  console.log(`Found ${players.length} players.`);
  console.log(
    REFRESH
      ? "Mode: --refresh (re-downloading every player)."
      : "Mode: skip players that are already saved (use --refresh to re-download).",
  );

  await mkdir(OUTPUT_DIRECTORY, {
    recursive: true,
  });

  const failures = [];

  let downloaded = 0;
  let skipped = 0;

  for (let index = 0; index < players.length; index += 1) {
    const player = players[index];

    const playerName = [
      player.first_name,
      player.last_name,
    ]
      .filter(Boolean)
      .join(" ");

    const outputFile = path.join(
      OUTPUT_DIRECTORY,
      `${player.id}.json`,
    );

    const progress = `[${index + 1}/${players.length}]`;

    if (!REFRESH && (await fileExists(outputFile))) {
      skipped += 1;

      console.log(
        `${progress} Skipping ${playerName || player.id} — already saved.`,
      );

      continue;
    }

    console.log(
      `${progress} Downloading ${playerName || player.id}...`,
    );

    try {
      const detail = await downloadPlayer(player);

      await writeFile(
        outputFile,
        `${JSON.stringify(detail, null, 2)}\n`,
        "utf8",
      );

      downloaded += 1;
    } catch (error) {
      console.error(
        `  Failed player ${player.id}: ${error.message}`,
      );

      failures.push({
        id: player.id,
        name: playerName,
        error: error.message,
      });
    }

    await sleep(REQUEST_DELAY_MS);
  }

  await writeFile(
    FAILURE_FILE,
    `${JSON.stringify(failures, null, 2)}\n`,
    "utf8",
  );

  console.log("");
  console.log("Download complete.");
  console.log(`Downloaded: ${downloaded}`);
  console.log(`Skipped:    ${skipped}`);
  console.log(`Failed:     ${failures.length}`);
  console.log(`Output:     ${OUTPUT_DIRECTORY}`);

  if (failures.length > 0) {
    console.log(`Failures:   ${FAILURE_FILE}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("");
  console.error("Downloader failed:");
  console.error(error);

  process.exitCode = 1;
});