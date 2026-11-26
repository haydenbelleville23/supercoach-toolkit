import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// AFL Fantasy is a different game from AFL SuperCoach. Nothing the site
// shows (pages, components, metadata, quiz data, README) may mention it.
const USER_FACING = ["app", "components", "lib", "data/quiz", "README.md"];
const TEXT_FILE = /\.(tsx?|jsx?|json|md|css|webmanifest)$/;

function files(target: string): string[] {
  if (statSync(target).isFile()) {
    return [target];
  }

  return readdirSync(target).flatMap((name) => files(path.join(target, name)));
}

describe("site wording", () => {
  it('never says "AFL Fantasy" in user-facing source', () => {
    const offenders = USER_FACING.flatMap((target) => files(path.resolve(target)))
      .filter((file) => TEXT_FILE.test(file))
      .filter((file) => /AFL\s+fantasy/i.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });
});
