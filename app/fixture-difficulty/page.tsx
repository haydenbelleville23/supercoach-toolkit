import type { Metadata } from "next";

import FixtureDifficultyTool from "@/components/fixtureDifficulty/FixtureDifficultyTool";
import Header from "@/components/layout/Header";
import PageHeader from "@/components/layout/PageHeader";
import { MIN_GAMES, MIN_SEASON_AVG } from "@/lib/fixtureDifficulty/config";
import { getFixtureDifficultyData } from "@/lib/fixtureDifficulty/pageData";

export const metadata: Metadata = {
  title: "Fixture Difficulty",
  description:
    "AFL SuperCoach fixture difficulty: how each team's opponents score by position, round by round, and points for and against.",
};

export default function FixtureDifficultyPage() {
  const data = getFixtureDifficultyData();

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Header />

      <section className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6">
        <PageHeader
          title="Fixture Difficulty"
          description="Which opponents are easier or harder for each position, and who each team plays next."
        />

        <div className="mt-6">
          <FixtureDifficultyTool data={data} />
        </div>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm leading-6 text-slate-300">
          <h2 className="font-semibold text-white">How this is calculated</h2>
          <p className="mt-1">
            From 2026 games up to Round {data.asOfRound} only. For players averaging over {MIN_SEASON_AVG} with
            at least {MIN_GAMES} games, each game&apos;s score is compared with his season average; a team&apos;s
            value for a position is the mean of those differences in games against it. Dual-position players
            count in both positions. Green means an easier opponent (players score above their average), red a
            harder one. Early in the season the samples are small, so treat the numbers with care. Scores from
            SuperCoach&apos;s public site.
          </p>
        </section>
      </section>
    </main>
  );
}
