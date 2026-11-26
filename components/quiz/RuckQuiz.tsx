"use client";

import { useEffect, useRef, useState } from "react";

import RuckCard from "@/components/quiz/RuckCard";
import { ruckQuiz } from "@/lib/quiz/ruckQuiz";
import { findOutcome, scoreQuiz } from "@/lib/quiz/scoreQuiz";
import type { QuizAnswers, QuizOutcome } from "@/lib/quiz/types";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

const PAGE_PATH = "/which-ruck";

type Screen =
  | { kind: "start" }
  | { kind: "question"; index: number }
  | { kind: "result"; winner: QuizOutcome; runnerUp: QuizOutcome | null };

type RuckQuizProps = {
  initialResultId: string | null;
  initialRunnerUpId: string | null;
};

const buttonBase =
  "rounded-lg px-5 py-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 motion-safe:transition";
const primaryButton = `${buttonBase} bg-violet-500 text-slate-950 hover:bg-violet-400`;
const secondaryButton = `${buttonBase} border border-slate-700 bg-slate-900 text-white hover:border-violet-500 hover:bg-violet-500/10`;

function resultPath(winner: QuizOutcome, runnerUp: QuizOutcome | null): string {
  const params = new URLSearchParams({ r: winner.id });

  if (runnerUp) {
    params.set("ru", runnerUp.id);
  }

  return `${PAGE_PATH}?${params.toString()}`;
}

/** Keeps the address bar in step with the screen, without a navigation. */
function setAddress(path: string) {
  window.history.replaceState(null, "", path);
}

export default function RuckQuiz({
  initialResultId,
  initialRunnerUpId,
}: RuckQuizProps) {
  const questions = ruckQuiz.questions;

  const [screen, setScreen] = useState<Screen>(() => {
    const winner = findOutcome(ruckQuiz, initialResultId);

    return winner
      ? {
          kind: "result",
          winner,
          runnerUp: findOutcome(ruckQuiz, initialRunnerUpId),
        }
      : { kind: "start" };
  });
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [fallbackLink, setFallbackLink] = useState<string | null>(null);

  // Move focus to each new screen's heading so keyboard and screen reader
  // users land on the new question (skipped on first render).
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const screenKey =
    screen.kind === "question" ? `q${screen.index}` : screen.kind;

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    headingRef.current?.focus();
  }, [screenKey]);

  // The address changes without a navigation, so keep the tab title in step.
  const resultTitle =
    screen.kind === "result"
      ? `I'm ${screen.winner.name}: ${screen.winner.archetype}`
      : "Which ruck are you?";

  useEffect(() => {
    document.title = `${resultTitle} | ${SITE_NAME}`;
  }, [resultTitle]);

  // An invalid ?r= falls back to the start screen; tidy the address too.
  useEffect(() => {
    if (initialResultId === null && window.location.search.includes("r=")) {
      setAddress(PAGE_PATH);
    }
  }, [initialResultId]);

  function start() {
    setAnswers({});
    setShareStatus(null);
    setFallbackLink(null);
    setAddress(PAGE_PATH);
    setScreen({ kind: "question", index: 0 });
  }

  function choose(questionIndex: number, optionId: string) {
    const question = questions[questionIndex];
    const next = { ...answers, [question.id]: optionId };

    setAnswers(next);

    if (questionIndex < questions.length - 1) {
      setScreen({ kind: "question", index: questionIndex + 1 });
      return;
    }

    const { winner, runnerUp } = scoreQuiz(ruckQuiz, next);

    setAddress(resultPath(winner, runnerUp));
    setScreen({ kind: "result", winner, runnerUp });
  }

  function back(questionIndex: number) {
    setScreen(
      questionIndex === 0
        ? { kind: "start" }
        : { kind: "question", index: questionIndex - 1 },
    );
  }

  async function share(winner: QuizOutcome, runnerUp: QuizOutcome | null) {
    const url = absoluteUrl(resultPath(winner, runnerUp));
    const text = `I'm ${winner.name}, ${winner.archetype}. Which ruck are you?`;

    setFallbackLink(null);

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Which ruck are you?", text, url });
        setShareStatus(null);
        return;
      } catch (error) {
        // Closing the share sheet is not an error worth reporting.
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareStatus("Link copied to your clipboard.");
    } catch {
      setShareStatus("Copy this link to share your result:");
      setFallbackLink(url);
    }
  }

  if (screen.kind === "start") {
    return (
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
          Just for fun
        </p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-3 text-4xl font-extrabold tracking-tight focus:outline-none sm:text-5xl"
        >
          Which ruck are you?
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-300">
          {questions.length} quick questions to find the AFL ruck who matches
          your style.
        </p>
        <button type="button" onClick={start} className={`mt-8 ${primaryButton}`}>
          Start the quiz
        </button>
        <p className="mt-6 text-xs text-slate-500">
          Nothing is saved or sent anywhere. Your answers stay on this device.
        </p>
      </div>
    );
  }

  if (screen.kind === "question") {
    const { index } = screen;
    const question = questions[index];
    const selected = answers[question.id];
    const progress = ((index + 1) / questions.length) * 100;

    return (
      <div>
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => back(index)}
            className="rounded-lg px-2 py-1 text-sm font-semibold text-violet-300 hover:text-violet-200 focus-visible:outline-2 focus-visible:outline-violet-400"
            aria-label={
              index === 0 ? "Back to the start" : "Back to the previous question"
            }
          >
            ← Back
          </button>
          <p className="text-sm font-semibold tabular-nums text-slate-400">
            <span className="sr-only">Question </span>
            {index + 1} / {questions.length}
          </p>
        </div>

        <div
          role="progressbar"
          aria-label="Quiz progress"
          aria-valuemin={1}
          aria-valuemax={questions.length}
          aria-valuenow={index + 1}
          aria-valuetext={`Question ${index + 1} of ${questions.length}`}
          className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"
        >
          <div
            className="h-full rounded-full bg-violet-500 motion-safe:transition-[width] motion-safe:duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-8 text-2xl font-bold tracking-tight focus:outline-none sm:text-3xl"
        >
          {question.prompt}
        </h1>

        <ul className="mt-6 space-y-3">
          {question.options.map((option) => {
            const isSelected = option.id === selected;

            return (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => choose(index, option.id)}
                  aria-pressed={isSelected}
                  className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 motion-safe:transition ${
                    isSelected
                      ? "border-violet-500 bg-violet-500/15"
                      : "border-slate-800 bg-slate-900 hover:border-violet-500 hover:bg-violet-500/5"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      isSelected
                        ? "bg-violet-500 text-slate-950"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {option.id}
                  </span>
                  <span className="pt-0.5 text-slate-100">{option.text}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {selected && (
          <p className="mt-4 text-sm text-slate-400">
            Your earlier answer is highlighted. Pick it again or choose another
            to carry on.
          </p>
        )}
      </div>
    );
  }

  const { winner, runnerUp } = screen;

  return (
    <div>
      <p className="text-center text-sm font-semibold uppercase tracking-widest text-violet-400">
        Your ruck is
      </p>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 text-center text-4xl font-extrabold tracking-tight focus:outline-none sm:text-5xl"
      >
        {winner.name}
      </h1>
      <p className="mt-2 text-center text-xl font-semibold text-violet-200">
        {winner.archetype}
      </p>
      <p className="mt-1 text-center text-sm text-slate-400">{winner.club}</p>

      <div className="mx-auto mt-6 max-w-md">
        <RuckCard key={winner.id} outcome={winner} />
      </div>

      <p className="mt-6 leading-7 text-slate-300">{winner.description}</p>

      {runnerUp && (
        <p className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
          <span className="font-semibold text-white">Runner-up:</span>{" "}
          {runnerUp.name}, {runnerUp.archetype}
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" onClick={start} className={primaryButton}>
          Play again
        </button>
        <button
          type="button"
          onClick={() => share(winner, runnerUp)}
          className={secondaryButton}
        >
          Share result
        </button>
      </div>

      <div aria-live="polite" className="mt-4 text-sm text-slate-300">
        {shareStatus && <p>{shareStatus}</p>}
        {fallbackLink && (
          <input
            readOnly
            value={fallbackLink}
            aria-label="Link to your result"
            onFocus={(event) => event.currentTarget.select()}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
          />
        )}
      </div>
    </div>
  );
}
