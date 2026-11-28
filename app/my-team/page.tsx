import Header from "@/components/layout/Header";
import PageHeader from "@/components/layout/PageHeader";
import MyTeamTabs from "@/components/planner/MyTeamTabs";

export const metadata = { title: "My Team" };

export default function MyTeamPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Header />

      <section className="mx-auto max-w-4xl px-6 py-12">
        <PageHeader
          title="My Team"
          description="Build your 31-player squad, set your cash, trades and boosts, and keep a watchlist. Saved in this browser only; export it to keep a copy."
        />

        <MyTeamTabs />
      </section>
    </main>
  );
}
