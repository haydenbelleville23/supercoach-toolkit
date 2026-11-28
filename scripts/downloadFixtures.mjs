/**
 * Downloads a season's fixtures from SuperCoach's public fixture endpoint
 * (no login or subscriber data) to data/{season}/fixtures-raw.json.
 *
 *   npm run download:fixtures                          # the active season
 *   npm run download:fixtures -- --season 2027
 *   npm run download:fixtures -- --season 2027 --dry-run  # print URLs only, no requests
 *
 * One request per round with a polite delay. Stops at once on HTTP 401,
 * 403 or 429 (nothing is written); other failures are retried a few times.
 * A round the endpoint returns no games for is reported clearly. See
 * docs/new-season.md.
 */

import {
  mkdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { SEASON_YEAR } from "../lib/season/seasonYear.ts";

function argValue(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const seasonArg = argValue("season");
const SEASON = seasonArg === undefined ? SEASON_YEAR : Number(seasonArg);
const DRY_RUN = process.argv.includes("--dry-run");

if (!Number.isInteger(SEASON) || SEASON < 2020 || SEASON > 2100) {
  console.error(`--season must be a season year such as 2027 (got "${seasonArg}").`);
  process.exit(1);
}

const FIRST_ROUND = 0;
const FINAL_ROUND = 24;

/** These mean "not allowed" or "slow down": never retried or worked around. */
const STOP_STATUSES = new Set([401, 403, 429]);

class StopError extends Error {}

const OUTPUT_DIRECTORY = path.resolve(
  `data/${SEASON}`,
);

const OUTPUT_FILE = path.join(
  OUTPUT_DIRECTORY,
  "fixtures-raw.json",
);

const FAILURE_FILE = path.join(
  OUTPUT_DIRECTORY,
  "fixture-download-failures.json",
);

const REQUEST_DELAY_MS = 250;
const MAX_RETRIES = 4;

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function getFixtureUrl(round) {
  return (
    `https://www.supercoach.com.au/${SEASON}` +
    `/api/afl/classic/v1/real_fixture` +
    `?round=${round}&page=1&page_size=9998`
  );
}

async function downloadRound(round, attempt = 1) {
  const url = getFixtureUrl(round);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 SuperCoach-Toolkit-Fixture-Importer/1.0",
      },
    });

    if (STOP_STATUSES.has(response.status)) {
      throw new StopError(
        `HTTP ${response.status} ${response.statusText} for round ${round}`,
      );
    }

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof StopError || attempt >= MAX_RETRIES) {
      throw error;
    }

    const retryDelay =
      REQUEST_DELAY_MS * 2 ** attempt;

    console.warn(
      `Retrying round ${round} in ${retryDelay}ms: ${error.message}`,
    );

    await sleep(retryDelay);

    return downloadRound(round, attempt + 1);
  }
}

async function main() {
  const roundNumbers = [];
  for (let round = FIRST_ROUND; round <= FINAL_ROUND; round += 1) roundNumbers.push(round);

  if (DRY_RUN) {
    console.log(`Dry run: ${roundNumbers.length} requests for the ${SEASON} fixtures (none made).`);
    for (const round of roundNumbers) console.log(getFixtureUrl(round));
    console.log(`Would write: ${OUTPUT_FILE}`);
    return;
  }

  console.log(`Downloading ${SEASON} SuperCoach fixtures`);
  console.log("------------------------------------");

  const rounds = [];
  const failures = [];
  const emptyRounds = [];

  for (
    let round = FIRST_ROUND;
    round <= FINAL_ROUND;
    round += 1
  ) {
    console.log(
      `[${round}/${FINAL_ROUND}] Downloading round ${round}...`,
    );

    try {
      const response = await downloadRound(round);

      if (!Array.isArray(response) || response.length === 0) {
        console.warn(`Round ${round}: the endpoint returned no games.`);
        emptyRounds.push(round);
      }

      rounds.push({
        round,
        response: Array.isArray(response) ? response : [],
      });
    } catch (error) {
      if (error instanceof StopError) {
        console.error("");
        console.error(`Stopped: ${error.message}. Nothing was written. Don't retry or work around this.`);
        process.exitCode = 1;
        return;
      }

      console.error(
        `Failed to download round ${round}: ${error.message}`,
      );

      failures.push({
        round,
        error: error.message,
      });
    }

    await sleep(REQUEST_DELAY_MS);
  }

  if (rounds.every((entry) => entry.response.length === 0)) {
    console.error("");
    console.error(`No games were returned for any ${SEASON} round: nothing written (the fixture may not be released yet).`);
    process.exitCode = 1;
    return;
  }

  await mkdir(OUTPUT_DIRECTORY, {
    recursive: true,
  });

  await writeFile(
    OUTPUT_FILE,
    `${JSON.stringify(
      {
        season: SEASON,
        downloadedAt: new Date().toISOString(),
        rounds,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  await writeFile(
    FAILURE_FILE,
    `${JSON.stringify(failures, null, 2)}\n`,
    "utf8",
  );

  console.log("");
  console.log("Fixture download complete.");
  console.log(`Rounds saved: ${rounds.length}`);
  console.log(`Failures:     ${failures.length}`);
  console.log(`Empty rounds: ${emptyRounds.length ? emptyRounds.join(", ") : "none"}`);
  console.log(`Output:       ${OUTPUT_FILE}`);

  if (failures.length > 0 || emptyRounds.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("");
  console.error("Fixture downloader failed:");
  console.error(error);

  process.exitCode = 1;
});