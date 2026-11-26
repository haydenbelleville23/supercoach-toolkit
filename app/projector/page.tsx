import { Suspense } from "react";

import Header from "@/components/layout/Header";
import PageHeader from "@/components/layout/PageHeader";
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

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <PageHeader
          title="Price Projector"
          description="Enter projected scores for the remaining rounds or select from one of the projection options."
        />

        {/* Reads ?player=ID, so it renders on the client below this boundary. */}
        <Suspense fallback={<ProjectorToolFallback />}>
          <ProjectorToolFromUrl />
        </Suspense>

        <p className="mt-5 text-xs leading-5 text-slate-400">
          Future prices are estimates based on the
          scores entered above, until confirmed by
          actual weekly price movements.
        </p>
      </section>
    </main>
  );
}
