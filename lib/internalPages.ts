import { notFound } from "next/navigation";

/** Vercel deployments where internal pages are hidden by default. */
const HIDDEN_ON = new Set(["production", "preview"]);

/**
 * Internal research pages (/magic-number, /engine, /debug) are hidden on
 * Vercel production AND preview deployments, and stay available locally
 * (VERCEL_ENV unset or "development"). Set SHOW_INTERNAL_PAGES=true to
 * show them on a deployment anyway.
 */
export function hideInternalPageInProduction(): void {
  if (
    HIDDEN_ON.has(process.env.VERCEL_ENV ?? "") &&
    process.env.SHOW_INTERNAL_PAGES !== "true"
  ) {
    notFound();
  }
}

/** The internal research pages (never counted by analytics). */
export const INTERNAL_PAGE_PATHS = ["/magic-number", "/engine", "/debug"] as const;

/** Whether a path (or full URL) is one of the internal pages or below one. */
export function isInternalPath(pathOrUrl: string): boolean {
  let path: string;
  try {
    path = new URL(pathOrUrl, "https://footynomics.local").pathname;
  } catch {
    return false;
  }
  return INTERNAL_PAGE_PATHS.some((page) => path === page || path.startsWith(`${page}/`));
}
