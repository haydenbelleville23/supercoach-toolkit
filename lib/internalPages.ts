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
