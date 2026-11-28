/**
 * Runs `next dev` with the DEBUG_AS_OF_ROUND lock set or explicitly
 * cleared. Works the same on Windows PowerShell, macOS and Linux (no
 * cross-env needed).
 *
 *   npm run dev:r10    # node scripts/dev.mjs --round 10
 *   npm run dev:live   # node scripts/dev.mjs --live
 *
 * Anything after "--" goes to next dev, e.g. npm run dev:r10 -- -p 3001.
 *
 * Next.js never overrides a variable that is already set (even to ""),
 * so --live beats a DEBUG_AS_OF_ROUND in .env.development.local, and
 * --round beats one set in your shell.
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";

const args = process.argv.slice(2);
const separator = args.indexOf("--");
const own = separator === -1 ? args : args.slice(0, separator);
const passThrough = separator === -1 ? [] : args.slice(separator + 1);

const roundIndex = own.indexOf("--round");
const live = own.includes("--live");

if (live === (roundIndex !== -1)) {
  console.error("Usage: node scripts/dev.mjs --round <1-24> | --live [-- next dev options]");
  process.exit(1);
}

const round = live ? "" : own[roundIndex + 1];
if (!live && !/^(?:[1-9]|1\d|2[0-4])$/.test(round ?? "")) {
  console.error(`--round must be a round from 1 to 24 (got "${round}").`);
  process.exit(1);
}

console.log(live ? "Dev server: live data (DEBUG_AS_OF_ROUND cleared)." : `Dev server: viewing as of Round ${round}.`);

const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, "dev", ...passThrough], {
  stdio: "inherit",
  env: { ...process.env, DEBUG_AS_OF_ROUND: round },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
