/**
 * Saves ONE raw response from the DFS Australia live feed (the URL
 * /api/live-scores uses), exactly as received, to
 * scripts/output/live-snapshots/ (gitignored), and prints every key and
 * every onBench, benchReason and status value in it.
 *
 *   npm run live:snapshot
 *
 * One request per run. Refuses to run within 30 seconds of the last one.
 * No loops, no retries, no scheduling; not part of update:weekly. Run it
 * by hand during a live game to see what the feed really sends.
 */

import { existsSync } from "node:fs";
import * as nodeModule from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = process.cwd();

type ResolveHook = (
  specifier: string,
  context: { parentURL?: string },
  nextResolve: (specifier: string, context: { parentURL?: string }) => unknown,
) => unknown;

const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: { resolve: ResolveHook }) => void;
};

// lib/ uses "@/..." and extensionless imports, which Node doesn't resolve.
registerHooks({
  resolve(specifier, context, nextResolve) {
    let target = specifier;
    if (target.startsWith("@/")) {
      target = pathToFileURL(path.join(ROOT, target.slice(2))).href;
    }
    const isLocal = target.startsWith(".") || target.startsWith("file:");
    if (isLocal && !path.extname(target) && context.parentURL) {
      const filePath = fileURLToPath(new URL(target, context.parentURL));
      for (const extension of [".ts", ".tsx"]) {
        if (existsSync(filePath + extension)) {
          return nextResolve(pathToFileURL(filePath + extension).href, context);
        }
      }
    }
    return nextResolve(target, context);
  },
});

const { formatSummary, saveLiveSnapshot } = await import("../lib/liveMatch/liveSnapshot");

const result = await saveLiveSnapshot();

if (!result.ok) {
  if (result.reason === "rate-limited") {
    console.error(`Not requested: the last snapshot was under 30 seconds ago. Wait ${result.waitSeconds}s and run it again.`);
  } else if (result.reason === "http-error") {
    console.error(`The feed answered HTTP ${result.httpStatus}. The body was saved to ${result.file}. Not retrying.`);
  } else {
    console.error(`The request failed: ${result.message}. Not retrying.`);
  }
  process.exit(1);
}

console.log(`Saved the raw response (HTTP ${result.httpStatus}) to ${result.file}`);
if (result.parseError) {
  console.log(`It isn't valid JSON (${result.parseError}), so there's no key summary.`);
} else if (result.summary) {
  console.log(formatSummary(result.summary));
}
