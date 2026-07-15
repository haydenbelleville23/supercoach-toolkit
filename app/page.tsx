import Link from "next/link";

const tools = [
  {
    title: "Price Projector",
    description:
      "Enter projected scores and estimate how a player's price could change.",
    href: "/projector",
    status: "Available soon",
  },
  {
    title: "Cash Cow Finder",
    description:
      "Identify players with the strongest projected price growth.",
    href: "#",
    status: "Coming soon",
  },
  {
    title: "Break-even Tracker",
    description:
      "Search player break-evens and compare their upcoming price outlook.",
    href: "#",
    status: "Coming soon",
  },
  {
    title: "Trade Planner",
    description:
      "Compare potential trades and their effect on scoring and team value.",
    href: "#",
    status: "Coming soon",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xl font-bold">SuperCoach Toolkit</p>
            <p className="text-sm text-slate-400">AFL SuperCoach analytics</p>
          </div>

          <nav className="hidden gap-6 text-sm text-slate-300 sm:flex">
            <Link className="hover:text-white" href="/">
              Home
            </Link>
            <Link className="hover:text-white" href="/projector">
              Price Projector
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-emerald-400">
            SuperCoach analysis made simple
          </p>

          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Make smarter AFL SuperCoach decisions.
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-300">
            Project player prices, identify cash generation opportunities and
            compare trades using clear, easy-to-understand tools.
          </p>

          <Link
            href="/projector"
            className="mt-8 inline-block rounded-lg bg-emerald-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            Open Price Projector
          </Link>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          {tools.map((tool) => (
            <article
              key={tool.title}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-semibold">{tool.title}</h2>

                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                  {tool.status}
                </span>
              </div>

              <p className="mt-4 leading-7 text-slate-400">
                {tool.description}
              </p>

              {tool.href !== "#" && (
                <Link
                  href={tool.href}
                  className="mt-6 inline-block font-semibold text-emerald-400 hover:text-emerald-300"
                >
                  Open tool →
                </Link>
              )}
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-800">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-slate-500">
          SuperCoach Toolkit is an independent AFL SuperCoach analysis project.
        </div>
      </footer>
    </main>
  );
}