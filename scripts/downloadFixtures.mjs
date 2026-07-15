import {
  mkdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const SEASON = 2026;
const FIRST_ROUND = 0;
const FINAL_ROUND = 24;

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

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    if (attempt >= MAX_RETRIES) {
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
  console.log("Downloading 2026 SuperCoach fixtures");
  console.log("------------------------------------");

  await mkdir(OUTPUT_DIRECTORY, {
    recursive: true,
  });

  const rounds = [];
  const failures = [];

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

      rounds.push({
        round,
        response,
      });
    } catch (error) {
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
  console.log(`Output:       ${OUTPUT_FILE}`);

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("");
  console.error("Fixture downloader failed:");
  console.error(error);

  process.exitCode = 1;
});