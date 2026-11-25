import { notFound } from "next/navigation";

/**
 * Internal research pages (/magic-number, /engine, /debug) are hidden on the
 * production deployment and stay available locally and on Vercel previews.
 * Set SHOW_INTERNAL_PAGES=true to show them in production anyway.
 */
export function hideInternalPageInProduction(): void {
  if (
    process.env.VERCEL_ENV === "production" &&
    process.env.SHOW_INTERNAL_PAGES !== "true"
  ) {
    notFound();
  }
}
