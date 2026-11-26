"use client";

import Image from "next/image";
import { useState } from "react";

import type { QuizOutcome } from "@/lib/quiz/types";
import { ruckCardSrc } from "@/lib/quiz/ruckQuiz";

type RuckCardProps = {
  outcome: QuizOutcome;
};

/** The outcome's card image, or a styled stand-in card if it fails to load. */
export default function RuckCard({ outcome }: RuckCardProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={`${outcome.name}, ${outcome.archetype}, ${outcome.club}`}
        className="flex aspect-[896/1200] w-full flex-col items-center justify-center rounded-2xl border border-violet-500/40 bg-gradient-to-b from-violet-500/20 via-slate-900 to-slate-950 p-6 text-center"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">
          {outcome.club}
        </p>
        <p className="mt-4 text-3xl font-extrabold tracking-tight text-white">
          {outcome.name}
        </p>
        <p className="mt-3 text-lg font-semibold text-violet-200">
          {outcome.archetype}
        </p>
      </div>
    );
  }

  return (
    <Image
      src={ruckCardSrc(outcome.id)}
      alt={`${outcome.name} card: ${outcome.archetype}, ${outcome.club}`}
      width={896}
      height={1200}
      sizes="(min-width: 640px) 28rem, calc(100vw - 2rem)"
      loading="eager"
      onError={() => setFailed(true)}
      className="h-auto w-full rounded-2xl border border-slate-800 shadow-xl shadow-violet-900/30"
    />
  );
}
