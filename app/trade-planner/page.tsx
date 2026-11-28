import Header from "@/components/layout/Header";
import PageHeader from "@/components/layout/PageHeader";
import TradePlannerTool from "@/components/planner/TradePlannerTool";
import InfoPopover from "@/components/ui/InfoPopover";

export const metadata = { title: "Trade Planner" };

export default function TradePlannerPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Header />

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <PageHeader
          title="Trade Planner"
          description="Plan trades round by round. Cash and trades carry forward, and prices are projected for each round."
          titleAside={
            <InfoPopover label="How the Trade Planner works" touchTarget>
              Each round starts from the squad, cash and trades left after the round before. Prices
              are projected from each player&apos;s scores and the league&apos;s price total, and
              trades use the price going into the round. You can type your own trade prices and
              scores. Problems are flagged on each round without blocking you.
            </InfoPopover>
          }
        />

        <TradePlannerTool />
      </section>
    </main>
  );
}
