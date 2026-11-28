import { CalendarRange } from "lucide-react";
import Link from "next/link";

import Header from "@/components/layout/Header";
import PageHeader from "@/components/layout/PageHeader";
import { SEASON_YEAR } from "@/data/season";

/**
 * Shown in place of a tool that needs this season's players and prices
 * (Projector, Cash Cows, Trade Planner, My Team, Live Scores) while the
 * season is in preseason, instead of last season's prices or an error.
 */
export function PreseasonNotice({ tool, season = SEASON_YEAR }: { tool: string; season?: number }) {
  return (
    <section
      role="status"
      aria-label={`${tool} opens when AFL SuperCoach launches`}
      className="mt-6 max-w-2xl rounded-2xl border border-sky-500/40 bg-sky-500/10 p-5 sm:p-6"
    >
      <h2 className="text-lg font-semibold text-white">{tool} opens when AFL SuperCoach launches</h2>
      <p className="mt-2 text-sm leading-6 text-slate-200">
        {season} players and prices aren&apos;t out yet, so there&apos;s nothing to show here until AFL SuperCoach
        launches. The {season} fixtures are in: see which opponents are easier for each position.
      </p>
      <Link
        href="/fixture-difficulty"
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-green px-4 text-sm font-semibold text-brand-navy transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        <CalendarRange aria-hidden="true" className="h-4 w-4" />
        See Fixture Difficulty
      </Link>
    </section>
  );
}

/** A whole tool page in preseason: the site header, the page title and the notice. */
export default function PreseasonPage({ title, description }: { title: string; description: string }) {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Header />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <PageHeader title={title} description={description} showFreshness={false} />
        <PreseasonNotice tool={title} />
      </section>
    </main>
  );
}
