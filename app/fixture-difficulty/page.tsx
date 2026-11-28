import type { Metadata } from "next";

import FixtureDifficultyTool from "@/components/fixtureDifficulty/FixtureDifficultyTool";
import Header from "@/components/layout/Header";
import PageHeader from "@/components/layout/PageHeader";
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
      </section>
    </main>
  );
}
