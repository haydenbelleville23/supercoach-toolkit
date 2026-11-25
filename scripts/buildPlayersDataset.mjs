import {
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const SEASON = 2026;

const BASE_PLAYERS_FILE = path.resolve(
  "data/players-cf.json",
);

const PLAYER_DETAILS_DIRECTORY = path.resolve(
  `data/${SEASON}/player-details`,
);

const OUTPUT_FILE = path.resolve(
  `data/${SEASON}/players-complete.json`,
);

const REPORT_FILE = path.resolve(
  `data/${SEASON}/players-complete-report.json`,
);

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

function mergePlayer(basePlayer, detailPlayer) {
  if (!detailPlayer) {
    return basePlayer;
  }

  return {
    ...basePlayer,
    ...detailPlayer,

    team:
      basePlayer.team ??
      detailPlayer.team,

    positions:
      basePlayer.positions ??
      detailPlayer.positions ??
      [],

    // players-cf contains the current aggregate/projection record.
    // The detail endpoint contains multiple historical round records.
    player_stats:
        basePlayer.player_stats ??
        detailPlayer.player_stats ??
        [],

    player_stat_history:
        detailPlayer.player_stats ?? [],

    player_match_stats:
      detailPlayer.player_match_stats ??
      basePlayer.player_match_stats ??
      [],

    trades:
      detailPlayer.trades ??
      basePlayer.trades ??
      [],

    notes:
      detailPlayer.notes ??
      basePlayer.notes ??
      [],

    odds:
      detailPlayer.odds ??
      basePlayer.odds ??
      [],
  };
}

async function main() {
  console.log("Building complete SuperCoach player dataset");
  console.log("-------------------------------------------");

  const basePlayers = await readJson(
    BASE_PLAYERS_FILE,
  );

  if (!Array.isArray(basePlayers)) {
    throw new Error(
      "data/players-cf.json must contain a top-level array.",
    );
  }

  await mkdir(
    path.dirname(OUTPUT_FILE),
    { recursive: true },
  );

  let detailFileNames = [];

  try {
    detailFileNames = await readdir(
      PLAYER_DETAILS_DIRECTORY,
    );
  } catch {
    throw new Error(
      `Could not find ${PLAYER_DETAILS_DIRECTORY}. ` +
        "Run npm run download:players first.",
    );
  }

  const availableDetailIds = new Set(
    detailFileNames
      .filter((fileName) =>
        fileName.endsWith(".json"),
      )
      .map((fileName) =>
        Number(fileName.replace(".json", "")),
      )
      .filter(Number.isFinite),
  );

  const completePlayers = [];
  const missingDetails = [];
  const invalidDetails = [];

  for (const basePlayer of basePlayers) {
    if (
      !basePlayer ||
      !Number.isInteger(basePlayer.id)
    ) {
      continue;
    }

    if (!availableDetailIds.has(basePlayer.id)) {
      missingDetails.push({
        id: basePlayer.id,
        name: [
          basePlayer.first_name,
          basePlayer.last_name,
        ]
          .filter(Boolean)
          .join(" "),
      });

      completePlayers.push(basePlayer);
      continue;
    }

    const detailFile = path.join(
      PLAYER_DETAILS_DIRECTORY,
      `${basePlayer.id}.json`,
    );

    try {
      const detailPlayer =
        await readJson(detailFile);

      completePlayers.push(
        mergePlayer(
          basePlayer,
          detailPlayer,
        ),
      );
    } catch (error) {
      invalidDetails.push({
        id: basePlayer.id,
        error: error.message,
      });

      completePlayers.push(basePlayer);
    }
  }

  const playersWithMatchHistory =
    completePlayers.filter(
      (player) =>
        Array.isArray(
          player.player_match_stats,
        ) &&
        player.player_match_stats.length > 0,
    ).length;

  console.log("");
  console.log(
    `Base players:               ${basePlayers.length}`,
  );
  console.log(
    `Detail files found:         ${availableDetailIds.size}`,
  );
  console.log(
    `Complete players:           ${completePlayers.length}`,
  );
  console.log(
    `Players with match history: ${playersWithMatchHistory}`,
  );
  console.log(
    `Missing details:            ${missingDetails.length}`,
  );
  console.log(
    `Invalid details:            ${invalidDetails.length}`,
  );

  // A partial dataset would silently mix old and new rounds, so stop
  // without touching the existing output files.
  if (
    missingDetails.length > 0 ||
    invalidDetails.length > 0
  ) {
    console.error("");
    console.error(
      "Dataset NOT written: some players are missing or invalid.",
    );

    for (const item of [
      ...missingDetails,
      ...invalidDetails,
    ].slice(0, 20)) {
      console.error(
        `  ${item.id}${item.name ? ` ${item.name}` : ""}${
          item.error ? `: ${item.error}` : ""
        }`,
      );
    }

    console.error(
      "Run `npm run download:players -- --refresh` and try again.",
    );

    process.exitCode = 1;
    return;
  }

  await writeFile(
    OUTPUT_FILE,
    `${JSON.stringify(
      completePlayers,
      null,
      2,
    )}\n`,
    "utf8",
  );

  const report = {
    season: SEASON,
    generatedAt: new Date().toISOString(),
    basePlayers: basePlayers.length,
    completePlayers: completePlayers.length,
    detailFilesFound: availableDetailIds.size,
    playersWithMatchHistory,
    missingDetails,
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


main().catch((error) => {
  console.error("");
  console.error("Dataset build failed:");
  console.error(error);

  process.exitCode = 1;
});