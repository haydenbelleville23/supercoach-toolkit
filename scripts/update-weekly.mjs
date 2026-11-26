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
 * Public data only. The player list is the set of players already saved
 * in data/2026/player-details/: there is no public source for discovering
 * NEW players yet (for example mid-season draftees), so ids are never
 * guessed or enumerated, and the update stops if that folder is empty.
 *
 * After rebuilding, every player's current price is checked against their
 * latest published price in the downloaded history; any mismatch fails the
 * update (non-zero exit) so stale prices are never reported as a success.
 *
 * Nothing is committed or deployed: review the changes, then commit.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { readKnownPlayerIds } from "./buildPlayersDataset.mjs";

const SEASON = 2026;
const DRY_RUN = process.argv.includes("--dry-run");

const PLAYER_DETAILS_DIRECTORY = path.resolve(
  `data/${SEASON}/player-details`,
);
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

/**
 * The player list comes from the detail files already saved. Stops with an
 * explanation if there are none, rather than guessing ids.
 */
async function checkKnownPlayers() {
  const ids = await readKnownPlayerIds(PLAYER_DETAILS_DIRECTORY);

  if (ids.length === 0) {
    console.error(
      `Stopped: no player files in ${PLAYER_DETAILS_DIRECTORY}.
` +
        "The player list is seeded from that folder, and there is no " +
        "public source for discovering players yet, so this update will " +
        "not guess or enumerate player ids.",
    );
    process.exit(1);
  }

  console.log(`Known players: ${ids.length} (from data/${SEASON}/player-details/).`);
  console.log(
    "New players: there is no public source for discovering new players " +
      "yet. Only the known players above are refreshed; anyone added to " +
      "SuperCoach since (for example a mid-season draftee) will be missing.",
  );

  return ids;
}

/**
 * Fails (non-zero exit) if any player's latest published price in their
 * downloaded history is newer than, or different from, the current price
 * in the built dataset.
 */
function checkPricesCurrent(ids) {
  const players = readJson(NORMALISED_FILE) ?? [];
  const byId = new Map(players.map((player) => [player.id, player]));
  const stale = [];

  for (const id of ids) {
    const detail = readJson(path.join(PLAYER_DETAILS_DIRECTORY, `${id}.json`));
    const priced = (detail?.player_stats ?? []).filter((row) => row.price != null);

    if (priced.length === 0) {
      continue;
    }

    const latest = priced.reduce((a, b) => (b.round > a.round ? b : a));
    const player = byId.get(id);
    const builtRounds = (player?.history ?? [])
      .filter((row) => row.price != null)
      .map((row) => row.round);
    const builtRound = builtRounds.length === 0 ? null : Math.max(...builtRounds);

    if (
      !player ||
      builtRound === null ||
      latest.round > builtRound ||
      player.price !== Number(latest.price)
    ) {
      stale.push({
        id,
        name: player?.name ?? `${detail.first_name} ${detail.last_name}`,
        historyRound: latest.round,
        historyPrice: Number(latest.price),
        builtRound,
        builtPrice: player?.price ?? null,
      });
    }
  }

  if (stale.length > 0) {
    console.error("");
    console.error(
      `FAILED: ${stale.length} players have a newer or different price in ` +
        "their history than in the built dataset. The data is stale.",
    );

    for (const item of stale.slice(0, 20)) {
      console.error(
        `  ${item.name} (${item.id}): history R${item.historyRound} ` +
          `${money(item.historyPrice)}, dataset ` +
          (item.builtPrice === null
            ? "missing"
            : `R${item.builtRound} ${money(item.builtPrice)}`),
      );
    }

    console.error("Rebuild with `npm run build:players` and run this again.");
    process.exit(1);
  }

  console.log(`Prices check: all ${ids.length} current prices match their latest history price.`);
}

async function main() {
  console.log(`SuperCoach ${SEASON} weekly update${DRY_RUN ? " (dry run)" : ""}`);
  console.log("----------------------------------");

  const ids = await checkKnownPlayers();

  const before = snapshot();

  if (DRY_RUN) {
    console.log("");
    console.log("Would run, stopping at the first failure:");
    STEPS.forEach((step, index) =>
      console.log(`  ${index + 1}. ${step.label}: node ${step.args.join(" ")}`),
    );
    console.log("");
    printSnapshot("Current data", before);
    console.log("");
    checkPricesCurrent(ids);
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

  console.log("");
  checkPricesCurrent(ids);
}

await main();
