import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  AVAILABILITY_FIXTURE_FILE,
  AVAILABILITY_FILE,
  NO_AVAILABILITY_FILE,
  availabilitySource,
} from "@/lib/availability/alias";
import { availabilitySnapshot } from "@/lib/availability/snapshot";
import { AVAILABILITY_STATUSES } from "@/lib/availability/types";
import { validateAvailability } from "@/lib/availability/validate";

const ROOT = path.resolve(".");
const FIXTURE_MARKER = "INVENTED SAMPLE";

function filesUnder(dir: string, extensions: string[]): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return filesUnder(full, extensions);
    return extensions.some((ext) => name.endsWith(ext)) ? [full] : [];
  });
}

describe("availability sample (debug fixture) isolation", () => {
  it("is only chosen when the debug lock is on", () => {
    for (const fileExists of [true, false]) {
      for (const fixtureExists of [true, false]) {
        const source = availabilitySource({ asOfRound: null, fileExists, fixtureExists });
        expect(source).not.toBe(AVAILABILITY_FIXTURE_FILE);
        expect(source).toBe(fileExists ? AVAILABILITY_FILE : NO_AVAILABILITY_FILE);
      }
    }

    expect(availabilitySource({ asOfRound: 10, fileExists: true, fixtureExists: true })).toBe(AVAILABILITY_FIXTURE_FILE);
    // The lock ignores the real file even when there's no fixture.
    expect(availabilitySource({ asOfRound: 10, fileExists: true, fixtureExists: false })).toBe(NO_AVAILABILITY_FILE);
  });

  it("is named by no app code except the alias module", () => {
    const sources = [
      ...filesUnder(path.join(ROOT, "app"), [".ts", ".tsx"]),
      ...filesUnder(path.join(ROOT, "components"), [".ts", ".tsx"]),
      ...filesUnder(path.join(ROOT, "lib"), [".ts", ".tsx"]),
      path.join(ROOT, "next.config.ts"),
    ];
    const naming = sources.filter((file) => readFileSync(file, "utf8").includes("availability.fixture"));
    expect(naming.map((file) => path.relative(ROOT, file).replace(/\\/g, "/"))).toEqual([
      "lib/availability/alias.ts",
    ]);
  });

  it("isn't loaded in tests (the app import resolves to no data)", () => {
    expect(availabilitySnapshot).toBeNull();
  });

  it("is a small, valid, clearly invented sample covering every status", () => {
    const raw = JSON.parse(readFileSync(path.join(ROOT, AVAILABILITY_FIXTURE_FILE), "utf8"));
    const result = validateAvailability(raw);
    expect(result.ok).toBe(true);

    const snapshot = result.ok ? result.snapshot! : null;
    expect(snapshot?.sample).toBe(true);
    expect(snapshot?.source).toContain(FIXTURE_MARKER);

    const entries = Object.values(snapshot?.players ?? {});
    expect(entries.length).toBeGreaterThanOrEqual(10);
    expect(entries.length).toBeLessThanOrEqual(20);
    expect(new Set(entries.map((e) => e.status))).toEqual(new Set(AVAILABILITY_STATUSES));
    expect(entries.some((e) => e.returnRound !== null)).toBe(true);
    expect(entries.every((e) => e.source.includes(FIXTURE_MARKER))).toBe(true);
  });

  // Runs when .next holds a production (unlocked) build: its output must
  // not contain the sample.
  const manifest = path.join(ROOT, ".next/required-server-files.json");
  const productionBuild =
    existsSync(manifest) && JSON.parse(readFileSync(manifest, "utf8")).config?.env?.DEBUG_AS_OF_ROUND === "";

  it.skipIf(!productionBuild)("isn't in a production build's output", () => {
    const built = [
      ...filesUnder(path.join(ROOT, ".next/server"), [".js", ".json", ".html", ".rsc"]),
      ...filesUnder(path.join(ROOT, ".next/static"), [".js"]),
    ];
    expect(built.length).toBeGreaterThan(0);
    const containing = built.filter((file) => readFileSync(file, "utf8").includes(FIXTURE_MARKER));
    expect(containing).toEqual([]);
  });
});
