import type { Metadata } from "next";
import Link from "next/link";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: `What ${SITE_NAME} records about visits, and where your AFL SuperCoach team and plans are kept.`,
};

/**
 * Plain-words privacy notes. The analytics details follow Vercel's Web
 * Analytics privacy documentation (vercel.com/docs/analytics/privacy-policy);
 * keep them in step with it.
 */
export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Header />

      <article className="mx-auto max-w-3xl space-y-8 px-6 py-12 text-slate-300">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-white">Privacy</h1>
          <p className="mt-3">
            {SITE_NAME} has no accounts and doesn&apos;t ask for your name or email.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">Your team and plans stay on your device</h2>
          <p>
            Your squad, cash, trades, plans, score overrides and settings (such as the matchup
            adjustment switch) are saved in this browser on your device. They aren&apos;t sent to
            us. Clearing this site&apos;s data in your browser removes them, so use{" "}
            <Link href="/my-team" className="text-violet-300 underline hover:text-violet-200">
              My Team
            </Link>
            &apos;s export to keep a copy.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">Visit counts (Vercel Web Analytics)</h2>
          <p>
            To see which pages are used, the live site counts page views with Vercel Web Analytics.
            It counts page views only, nothing you type or choose. It isn&apos;t used on test
            versions of the site, and the internal research pages aren&apos;t counted.
          </p>
          <p>According to Vercel&apos;s documentation, each page view records:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>the time, the page address and the page&apos;s route</li>
            <li>the page you came from (the referrer) and filtered query parameters</li>
            <li>an approximate location</li>
            <li>your device type (mobile, desktop or tablet), operating system and browser, with their versions</li>
          </ul>
          <p>
            Vercel says visitors are identified by a hash made from the incoming request, which is
            discarded after 24 hours, that page views aren&apos;t tied to an individual or an IP
            address, and that it doesn&apos;t use third-party cookies. For the full details, see{" "}
            <a
              href="https://vercel.com/docs/analytics/privacy-policy"
              className="text-violet-300 underline hover:text-violet-200"
              rel="noopener noreferrer"
            >
              Vercel&apos;s Web Analytics privacy page
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">Data the site loads</h2>
          <p>
            Prices and scores come from SuperCoach&apos;s public site, and live scores from DFS
            Australia. Loading them doesn&apos;t send anything about you to those sites; your browser
            only talks to {SITE_NAME}.
          </p>
        </section>
      </article>

      <Footer />
    </main>
  );
}
