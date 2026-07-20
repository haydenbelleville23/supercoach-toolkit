import Link from "next/link";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import ToolCard from "@/components/ui/ToolCard";
import { dashboardTools } from "@/data/dashboardTools";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-white">
      <Header />

      <section className="mx-auto max-w-7xl px-6 py-14 lg:py-6">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-violet-400">
            Fantasy AFL tools
          </p>

          <h1 className="max-w-4xl text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
            Rule your fantasy season.
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-8 text-slate-300">
            Price projections, cash cows, live scores and trade planning in one place.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/projector"
              className="rounded-lg bg-violet-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-violet-500"
            >
              📈 Price Projector
            </Link>

            <Link
              href="/cash-cows"
              className="rounded-lg border border-slate-700 bg-slate-900 px-5 py-3 font-semibold transition hover:border-violet-500 hover:bg-violet-500/10"
            >
              🐄 Cash Cows
            </Link>

            <Link
              href="/live"
              className="rounded-lg border border-slate-700 bg-slate-900 px-5 py-3 font-semibold transition hover:border-violet-500 hover:bg-violet-500/10"
            >
              🏉 Live Scores
            </Link>

              <Link
              href="#"
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-5 py-3 font-semibold text-amber-300 cursor-default"
            >
              🔄 Trade Planner (Coming Soon)
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-8 md:grid-cols-2">
          {dashboardTools.map((tool) => (
            <ToolCard key={tool.title} {...tool} />
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}