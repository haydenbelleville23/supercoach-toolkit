import { Suspense } from "react";

import DataFreshness from "@/components/layout/DataFreshness";
import Header from "@/components/layout/Header";
import ProjectorToolFromUrl from "@/components/projector/ProjectorTool";

function ProjectorToolFallback() {
  return (
    <section
      aria-busy="true"
      className="mt-10 h-72 animate-pulse rounded-2xl border border-slate-800 bg-slate-900"
    >
      <span className="sr-only">Loading player</span>
    </section>
  );
}

export default function ProjectorPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Header />

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            2026 season
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Price Projector
          </h1>

          <p className="mt-4 text-slate-300">
            Enter projected scores for the remaining rounds or select from one of the projection options.
          </p>

          <DataFreshness />
        </div>

        {/* Reads ?player=ID, so it renders on the client below this boundary. */}
        <Suspense fallback={<ProjectorToolFallback />}>
          <ProjectorToolFromUrl />
        </Suspense>

        <p className="mt-5 text-xs leading-5 text-slate-500">
          Future prices are estimates based on the
          scores entered above, until confirmed by
          actual weekly price movements.
        </p>
      </section>
    </main>
  );
}
