import { getPlayers } from "@/lib/players";

export default function DebugPage() {
  const player = getPlayers().find(
    (p) => p.name === "Josh Worrell",
  );

  return (
    <main className="p-8 text-white bg-slate-950 min-h-screen">
      <pre>
        {JSON.stringify(player, null, 2)}
      </pre>
    </main>
  );
}