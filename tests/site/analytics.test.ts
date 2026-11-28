import { describe, expect, it } from "vitest";

import { analyticsBeforeSend, shouldTrackAnalytics } from "@/lib/analytics";
import { INTERNAL_PAGE_PATHS, isInternalPath } from "@/lib/internalPages";

describe("shouldTrackAnalytics", () => {
  it("is true only on the production deployment without the debug lock", () => {
    expect(shouldTrackAnalytics({ VERCEL_ENV: "production" })).toBe(true);
    expect(shouldTrackAnalytics({ VERCEL_ENV: "production", DEBUG_AS_OF_ROUND: "" })).toBe(true);
  });

  it("is false for previews, development, local builds and the debug lock", () => {
    expect(shouldTrackAnalytics({ VERCEL_ENV: "preview" })).toBe(false);
    expect(shouldTrackAnalytics({ VERCEL_ENV: "development" })).toBe(false);
    expect(shouldTrackAnalytics({})).toBe(false);
    expect(shouldTrackAnalytics({ VERCEL_ENV: "production", DEBUG_AS_OF_ROUND: "10" })).toBe(false);
    expect(shouldTrackAnalytics({ VERCEL_ENV: "preview", DEBUG_AS_OF_ROUND: "10" })).toBe(false);
  });
});

describe("internal pages are never counted", () => {
  it("drops /magic-number, /engine and /debug (and below), keeps everything else", () => {
    expect(INTERNAL_PAGE_PATHS).toEqual(["/magic-number", "/engine", "/debug"]);
    for (const url of [
      "https://example.com/magic-number",
      "https://example.com/engine?player=10",
      "https://example.com/debug/anything",
      "/debug",
    ]) {
      expect(analyticsBeforeSend({ type: "pageview", url })).toBeNull();
    }

    for (const url of ["https://example.com/", "https://example.com/live?game=451", "https://example.com/debugging", "/engineering"]) {
      const event = { type: "pageview", url };
      expect(analyticsBeforeSend(event)).toBe(event);
    }
    expect(isInternalPath("not a url %%")).toBe(false);
  });
});
