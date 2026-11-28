import Header from "@/components/layout/Header";
import PageHeader from "@/components/layout/PageHeader";
import MyTeamTabs from "@/components/planner/MyTeamTabs";
import PreseasonPage from "@/components/season/PreseasonNotice";
import { IS_PRESEASON } from "@/data/season";


export const metadata = { title: "My Team" };

export default function MyTeamPage() {
  if (IS_PRESEASON) {
    return (
      <PreseasonPage
        title="My Team"
        description="Build your 31-player squad, set your cash, trades and boosts, and keep a watchlist."
      />
    );
  }

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
