import Header from "@/components/layout/Header";
import PageHeader from "@/components/layout/PageHeader";
import MyTeamTool from "@/components/planner/MyTeamTool";

export const metadata = { title: "My Team" };

export default function MyTeamPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Header />

      <section className="mx-auto max-w-4xl px-6 py-12">
        <PageHeader
          title="My Team"
          description="Build your 31-player squad and set your cash, trades and boosts. Saved in this browser only; export it to keep a copy."
        />

        <MyTeamTool />
      </section>
    </main>
  );
}
