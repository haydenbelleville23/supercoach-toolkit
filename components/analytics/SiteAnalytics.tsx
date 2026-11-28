"use client";

import { Analytics } from "@vercel/analytics/next";

import { analyticsBeforeSend } from "@/lib/analytics";

/**
 * Vercel Web Analytics, page views only. The root layout renders this only
 * when shouldTrackAnalytics() allows it; the internal pages are dropped
 * here before anything is sent.
 */
export default function SiteAnalytics() {
  return <Analytics beforeSend={analyticsBeforeSend} />;
}
