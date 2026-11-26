/**
 * Site identity in one place. The public URL comes from ONE setting,
 * NEXT_PUBLIC_SITE_URL, so metadataBase and every absolute link (Open
 * Graph, Twitter, share links) agree.
 */

export const SITE_NAME = "Footynomics";

export const SITE_DESCRIPTION =
  "Price projections, cash cows and trade planning for AFL SuperCoach.";

const DEFAULT_SITE_URL = "https://supercoach-toolkit.vercel.app";

function readSiteUrl(): URL {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  try {
    return new URL(value || DEFAULT_SITE_URL);
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
}

export const SITE_URL: URL = readSiteUrl();

/** An absolute URL on this site, e.g. absoluteUrl("/which-ruck"). */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

/** Brand images in public/brand/. */
export const BRAND = {
  logoWideDark: "/brand/footynomics-logo-wide-dark.png",
  logoWideDarkSize: { width: 1600, height: 528 },
  iconSquare512: "/brand/footynomics-icon-square-512x512.png",
  iconSquare1024: "/brand/footynomics-icon-square-1024x1024.png",
  socialShare: "/brand/footynomics-social-share-1200x630.png",
  socialShareSize: { width: 1200, height: 630 },
} as const;
