import Link from "next/link";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import ToolCard from "@/components/ui/ToolCard";
import { dashboardTools } from "@/data/dashboardTools";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Header />

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-emerald-400">
            SuperCoach analysis made simple
          </p>

          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Make smarter AFL SuperCoach decisions.
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-300">
            Project player prices, identify cash generation opportunities and
            follow live SuperCoach scoring using clear, easy-to-understand
            tools.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/projector"
              className="rounded-lg bg-emerald-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              📈 Price Projector
            </Link>

            <Link
              href="/cash-cows"
              className="rounded-lg border border-slate-700 bg-slate-900 px-5 py-3 font-semibold transition hover:border-emerald-500 hover:bg-slate-800"
            >
              🐄 Cash Cows
            </Link>

            <Link
              href="/live"
              className="rounded-lg border border-slate-700 bg-slate-900 px-5 py-3 font-semibold transition hover:border-emerald-500 hover:bg-slate-800"
            >
              🏉 Live Scores
            </Link>
          </div>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          {dashboardTools.map((tool) => (
            <ToolCard key={tool.title} {...tool} />
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}