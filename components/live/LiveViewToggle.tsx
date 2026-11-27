import Link from "next/link";

/** "Live | Results" at the top of the Live Scores area. */
export default function LiveViewToggle({ active }: { active: "live" | "results" }) {
  const item = (view: "live" | "results", href: string, label: string) => (
    <Link
      href={href}
      aria-current={active === view ? "page" : undefined}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
        active === view ? "bg-violet-500 text-white" : "text-slate-300 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav aria-label="Live Scores view" className="mt-4 inline-flex rounded-xl border border-slate-800 bg-slate-900 p-1">
      {item("live", "/live", "Live")}
      {item("results", "/live/results", "Results")}
    </nav>
  );
}
