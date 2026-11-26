import {
  ArrowRightLeft,
  PiggyBank,
  Radio,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import MyTeamTile from "@/components/home/MyTeamTile";
import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import { ruckQuiz } from "@/lib/quiz/ruckQuiz";
import { BRAND, SITE_NAME } from "@/lib/site";

type Tile = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const TOOLS: Tile[] = [
  {
    title: "Projector",
    description: "See what any player's price does for any score, round by round.",
    href: "/projector",
    icon: TrendingUp,
  },
  {
    title: "Cash Cows",
    description: "Find the best cash generators, with your own players highlighted.",
    href: "/cash-cows",
    icon: PiggyBank,
  },
  {
    title: "Trade Planner",
    description: "Plan trades for the rounds ahead, starting from your squad.",
    href: "/trade-planner",
    icon: ArrowRightLeft,
  },
  {
    title: "Live Scores",
    description: "Live scores with projected end-of-round prices and breakevens.",
    href: "/live",
    icon: Radio,
  },
];

const tileClass =
  "group flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900 p-6 motion-safe:transition hover:border-brand-green/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

function ToolTile({ title, description, href, icon: Icon }: Tile) {
  return (
    <Link href={href} className={tileClass}>
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-brand-green">
        <Icon aria-hidden="true" className="h-6 w-6" />
      </span>

      <h2 className="mt-5 text-xl font-bold text-white">{title}</h2>

      <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>

      <span className="mt-auto inline-flex items-center gap-1 pt-5 font-semibold text-slate-200 group-hover:text-brand-green">
        Open
        <span aria-hidden="true" className="motion-safe:transition group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </Link>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-white">
      <Header />

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <Image
            src={BRAND.iconSquare512}
            alt=""
            width={96}
            height={96}
            sizes="(min-width: 640px) 96px, 72px"
            priority
            className="h-[72px] w-[72px] rounded-2xl shadow-lg shadow-black/40 sm:h-24 sm:w-24"
          />

          <div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              {SITE_NAME}
            </h1>
            <p className="mt-3 max-w-2xl text-lg leading-7 text-slate-300">
              Price projections, cash cows and trade planning for AFL fantasy.
            </p>
          </div>
        </div>

        <div className="mt-8 max-w-3xl rounded-2xl border border-slate-800 bg-brand-navy/60 p-5 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-green">
            How it works
          </h2>
          <p className="mt-3 leading-7 text-slate-300">
            <span className="font-semibold text-white">Start with your team.</span>{" "}
            Add your squad once and {SITE_NAME}{" "}tailors everything to you: Cash
            Cows highlights your players, and the Trade Planner starts from your
            squad. The Projector shows what any player&apos;s price does for any
            score. No account needed. Your team stays on this device.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MyTeamTile />

          {TOOLS.map((tool) => (
            <ToolTile key={tool.href} {...tool} />
          ))}

          <Link
            href="/which-ruck"
            className="group flex h-full flex-col rounded-2xl border border-dashed border-slate-700 bg-transparent p-6 motion-safe:transition hover:border-brand-orange/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-orange/15 text-brand-orange">
                <Sparkles aria-hidden="true" className="h-6 w-6" />
              </span>
              <span className="rounded-full border border-slate-700 px-2.5 py-0.5 text-xs font-semibold text-slate-400">
                For fun
              </span>
            </div>

            <h2 className="mt-5 text-xl font-bold text-slate-200">
              Which Ruck Are You?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              {ruckQuiz.questions.length} quick questions to find the AFL ruck who matches your style.
            </p>

            <span className="mt-auto inline-flex items-center gap-1 pt-5 font-semibold text-slate-300 group-hover:text-brand-orange">
              Take the quiz
              <span aria-hidden="true" className="motion-safe:transition group-hover:translate-x-0.5">
                →
              </span>
            </span>
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
