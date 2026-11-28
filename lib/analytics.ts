import { isInternalPath } from "@/lib/internalPages";

/**
 * Whether to load Vercel Web Analytics: only on the production deployment
 * (VERCEL_ENV === "production"), and never while DEBUG_AS_OF_ROUND is set.
 * Preview deployments, local development and debug builds send nothing.
 */
export function shouldTrackAnalytics(env: {
  VERCEL_ENV?: string;
  DEBUG_AS_OF_ROUND?: string;
}): boolean {
  return env.VERCEL_ENV === "production" && !(env.DEBUG_AS_OF_ROUND ?? "").trim();
}

/** Page views only; the internal pages are dropped before anything is sent. */
export function analyticsBeforeSend<T extends { url: string }>(event: T): T | null {
  return isInternalPath(event.url) ? null : event;
}
