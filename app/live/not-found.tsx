import Link from "next/link";

import Header from "@/components/layout/Header";

/** Unknown game ids, hidden or out-of-range rounds. */
export default function LiveNotFound() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Header />
      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold">Not found</h1>
        <p className="mt-3 text-slate-300">
          That game or round isn&apos;t in the results. It may not have been played yet.
        </p>
        <p className="mt-6 flex justify-center gap-4 text-sm font-semibold">
          <Link href="/live/results" className="text-violet-300 hover:text-violet-200">
            Latest results
          </Link>
          <Link href="/live" className="text-violet-300 hover:text-violet-200">
            Live scores
          </Link>
        </p>
      </section>
    </main>
  );
}
