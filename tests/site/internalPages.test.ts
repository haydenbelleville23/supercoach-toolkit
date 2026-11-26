import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import { hideInternalPageInProduction } from "@/lib/internalPages";

const hidden = (vercelEnv: string | undefined, show?: string) => {
  vi.stubEnv("VERCEL_ENV", vercelEnv);
  vi.stubEnv("SHOW_INTERNAL_PAGES", show);

  try {
    hideInternalPageInProduction();
    return false;
  } catch {
    return true;
  }
};

describe("internal page gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("hides the pages on Vercel production and preview", () => {
    expect(hidden("production")).toBe(true);
    expect(hidden("preview")).toBe(true);
  });

  it("shows them locally and in development", () => {
    expect(hidden(undefined)).toBe(false);
    expect(hidden("development")).toBe(false);
  });

  it("shows them on a deployment only with SHOW_INTERNAL_PAGES=true", () => {
    expect(hidden("production", "true")).toBe(false);
    expect(hidden("preview", "true")).toBe(false);
    expect(hidden("preview", "1")).toBe(true);
  });
});
