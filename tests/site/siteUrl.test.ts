import { afterEach, describe, expect, it, vi } from "vitest";

async function loadSite(url: string | undefined) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", url);
  return import("@/lib/site");
}

describe("NEXT_PUBLIC_SITE_URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to the Vercel deployment", async () => {
    const site = await loadSite(undefined);
    expect(site.SITE_URL.origin).toBe("https://supercoach-toolkit.vercel.app");
  });

  it("builds every absolute URL from the setting", async () => {
    const site = await loadSite("https://footynomics.example");
    expect(site.absoluteUrl("/which-ruck?r=x")).toBe(
      "https://footynomics.example/which-ruck?r=x",
    );
    expect(site.absoluteUrl(site.BRAND.socialShare)).toBe(
      "https://footynomics.example/brand/footynomics-social-share-1200x630.png",
    );
  });

  it("falls back to the default for an invalid value", async () => {
    const site = await loadSite("not a url");
    expect(site.SITE_URL.origin).toBe("https://supercoach-toolkit.vercel.app");
  });
});
