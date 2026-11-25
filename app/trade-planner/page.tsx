import Header from "@/components/layout/Header";
import PageHeader from "@/components/layout/PageHeader";
import TradePlannerTool from "@/components/planner/TradePlannerTool";

export const metadata = { title: "Trade Planner" };

export default function TradePlannerPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Header />

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <PageHeader
          title="Trade Planner"
          description="Plan trades round by round. Cash and trades carry forward, prices come from the scaled price model, and problems are flagged without blocking you."
        />

        <TradePlannerTool />
      </section>
    </main>
  );
}
