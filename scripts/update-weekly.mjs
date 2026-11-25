/**
 * Weekly data update. Run manually after a round's prices are published:
 *
 *   npm run update:weekly             # download, rebuild, print changes
 *   npm run update:weekly -- --dry-run  # show the steps and current data only
 *
 * Steps, stopping at the first failure:
 *   1. Re-download every player's detail file (downloadPlayerDetails --refresh)
 *   2. Rebuild players-complete.json and players-normalised.json
 *   3. Re-download fixtures
 *
 * Before running, capture a fresh data/players-cf.json by hand (it needs
 * your SuperCoach session and is never downloaded by these scripts).
 * Nothing is committed or deployed: review the changes, then commit.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const SEASON = 2026;
const DRY_RUN = process.argv.includes("--dry-run");

const PLAYERS_CF_FILE = path.resolve("data/players-cf.json");
const NORMALISED_FILE = path.resolve(
  `data/${SEASON}/players-normalised.json`,
);
const FIXTURES_FILE = path.resolve(`data/${SEASON}/fixtures-raw.json`);

const STEPS = [
  {
    label: "Download player details (--refresh)",
    args: ["scripts/downloadPlayerDetails.mjs", "--refresh"],
  },
  {
    label: "Build players-complete.json",
    args: ["scripts/buildPlayersDataset.mjs"],
  },
  {
    label: "Build players-normalised.json",
    args: ["scripts/build-players-normalised.ts"],
  },
  {
    label: "Download fixtures",
    args: ["scripts/downloadFixtures.mjs"],
  },
];

// seasonStatus.ts only has type imports, so Node can load it directly.
const { getLatestCompletedRound } = await import(
  "../lib/season/seasonStatus.ts"
);

function readJson(file) {
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
}

/** Small summary of the data the site uses, for a before/after diff. */
function snapshot() {
  const players = readJson(NORMALISED_FILE) ?? [];
  const fixtureFile = readJson(FIXTURES_FILE);

  const fixtures = (fixtureFile?.rounds ?? []).flatMap((round) =>
    round.response.map((game) => ({
      round: round.round,
      homeTeam: game.team1.abbrev,
      awayTeam: game.team2.abbrev,
      kickoff: game.kickoff ?? null,
    })),
  );

  return {
    players: players.length,
    completedRound: getLatestCompletedRound(players, fixtures),
    totalPrice: players.reduce((total, p) => total + (p.price ?? 0), 0),
    prices: new Map(players.map((p) => [p.id, p.price])),
    names: new Map(players.map((p) => [p.id, p.name])),
    kickoffs: new Map(
      fixtures.map((f) => [`${f.round}:${f.homeTeam}-${f.awayTeam}`, f.kickoff]),
    ),
    fixturesDownloadedAt: fixtureFile?.downloadedAt ?? "never",
  };
}

function money(value) {
  return `$${Math.round(value).toLocaleString("en-AU")}`;
}

function printSnapshot(label, data) {
  console.log(`${label}:`);
  console.log(`  Players:                ${data.players}`);
  console.log(`  Latest completed round: ${data.completedRound ?? "none"}`);
  console.log(`  Total of all prices:    ${money(data.totalPrice)}`);
  console.log(`  Fixtures downloaded:    ${data.fixturesDownloadedAt}`);
}

function printChanges(before, after) {
  console.log("");
  console.log("What changed");
  console.log("------------");

  printSnapshot("Before", before);
  printSnapshot("After", after);

  const added = [...after.prices.keys()].filter((id) => !before.prices.has(id));
  const removed = [...before.prices.keys()].filter((id) => !after.prices.has(id));
  const priceChanges = [...after.prices].filter(
    ([id, price]) => before.prices.has(id) && before.prices.get(id) !== price,
  );

  const kickoffChanges = [...after.kickoffs].filter(
    ([key, kickoff]) =>
      before.kickoffs.has(key) && before.kickoffs.get(key) !== kickoff,
  );
  const newGames = [...after.kickoffs.keys()].filter(
    (key) => !before.kickoffs.has(key),
  );

  console.log("");
  console.log(`Players added:          ${added.length}`);
  for (const id of added.slice(0, 20)) {
    console.log(`  + ${after.names.get(id)} (${money(after.prices.get(id))})`);
  }

  console.log(`Players removed:        ${removed.length}`);
  for (const id of removed.slice(0, 20)) {
    console.log(`  - ${before.names.get(id)}`);
  }

  console.log(`Prices changed:         ${priceChanges.length}`);
  console.log(`Kickoff times changed:  ${kickoffChanges.length}`);
  for (const [key, kickoff] of kickoffChanges.slice(0, 20)) {
    console.log(`  ${key}: ${before.kickoffs.get(key)} -> ${kickoff}`);
  }
  console.log(`Games added:            ${newGames.length}`);

  if (after.completedRound === before.completedRound) {
    console.log("");
    console.log(
      "Note: the latest completed round did not change. If a round has " +
        "just finished, its prices may not be published yet.",
    );
  }

  console.log("");
  console.log("Nothing has been committed. Review with `git status`, then commit.");
}

function checkPlayersCf() {
  if (!existsSync(PLAYERS_CF_FILE)) {
    console.error(
      "data/players-cf.json is missing. Capture it by hand first " +
        "(see docs/api-research.md).",
    );
    process.exit(1);
  }

  const ageDays =
    (Date.now() - statSync(PLAYERS_CF_FILE).mtimeMs) / (24 * 60 * 60 * 1000);

  console.log(
    `data/players-cf.json last updated ${ageDays.toFixed(1)} days ago.`,
  );

  if (ageDays > 7) {
    console.warn(
      "Warning: players-cf.json is over a week old. New players and " +
        "current prices come from it, so capture a fresh copy first.",
    );
  }
}

function main() {
  console.log(`SuperCoach ${SEASON} weekly update${DRY_RUN ? " (dry run)" : ""}`);
  console.log("----------------------------------");

  checkPlayersCf();

  const before = snapshot();

  if (DRY_RUN) {
    console.log("");
    console.log("Would run, stopping at the first failure:");
    STEPS.forEach((step, index) =>
      console.log(`  ${index + 1}. ${step.label}: node ${step.args.join(" ")}`),
    );
    console.log("");
    printSnapshot("Current data", before);
    return;
  }

  for (const [index, step] of STEPS.entries()) {
    console.log("");
    console.log(`== Step ${index + 1}/${STEPS.length}: ${step.label}`);

    const result = spawnSync(process.execPath, step.args, {
      stdio: "inherit",
    });

    if (result.status !== 0) {
      console.error("");
      console.error(
        `Stopped: "${step.label}" failed (exit ${result.status ?? result.signal}). ` +
          "Later steps were not run.",
      );
      process.exit(result.status || 1);
    }
  }

  printChanges(before, snapshot());
}

main();
