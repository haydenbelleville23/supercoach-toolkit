/**
 * Balance report for the "Which ruck are you?" quiz.
 *
 *   node scripts/quiz-balance.ts
 *
 * Runs the real scoring on every possible combination of answers (every
 * option of every question, both Q7 options included) and prints how often
 * each outcome wins, plus the most points each outcome can score. Outcomes
 * winning under 2% or over 15% of combinations are flagged.
 *
 * The "unforced" columns count only combinations where no option with
 * forceOutcomeId was picked, so the forced Q7 answer doesn't hide how the
 * weights themselves are balanced. Read-only: changes nothing.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import * as nodeModule from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { QuizAnswers } from "../lib/quiz/types";

const QUIZ_FILE = path.resolve("data/quiz/ruck-quiz.json");
const LOW_SHARE = 0.02;
const HIGH_SHARE = 0.15;

// lib/ uses extensionless relative imports, which Node does not resolve.
type ResolveHook = (
  specifier: string,
  context: { parentURL?: string },
  nextResolve: (
    specifier: string,
    context: { parentURL?: string },
  ) => unknown,
) => unknown;

const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: { resolve: ResolveHook }) => void;
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    const isLocal = specifier.startsWith(".") || specifier.startsWith("file:");

    if (isLocal && !path.extname(specifier) && context.parentURL) {
      const filePath = fileURLToPath(new URL(specifier, context.parentURL));

      if (existsSync(`${filePath}.ts`)) {
        return nextResolve(pathToFileURL(`${filePath}.ts`).href, context);
      }
    }

    return nextResolve(specifier, context);
  },
});

const { parseQuiz } = await import("../lib/quiz/parseQuiz");
const { scoreQuiz } = await import("../lib/quiz/scoreQuiz");

function percent(count: number, total: number): string {
  return total === 0 ? "-" : `${((count / total) * 100).toFixed(2)}%`;
}

async function main() {
  const quiz = parseQuiz(JSON.parse(await readFile(QUIZ_FILE, "utf8")));
  const { questions, outcomes } = quiz;

  const wins = new Map(outcomes.map((o) => [o.id, 0]));
  const unforcedWins = new Map(outcomes.map((o) => [o.id, 0]));
  let total = 0;
  let unforcedTotal = 0;

  // Odometer over option indexes, one digit per question.
  const digits = questions.map(() => 0);

  for (;;) {
    const answers: QuizAnswers = {};

    questions.forEach((q, i) => {
      answers[q.id] = q.options[digits[i]].id;
    });

    const result = scoreQuiz(quiz, answers);
    const anyForce = questions.some(
      (q, i) => q.options[digits[i]].forceOutcomeId !== undefined,
    );

    total += 1;
    wins.set(result.winner.id, wins.get(result.winner.id)! + 1);

    if (!anyForce) {
      unforcedTotal += 1;
      unforcedWins.set(
        result.winner.id,
        unforcedWins.get(result.winner.id)! + 1,
      );
    }

    let i = digits.length - 1;

    while (i >= 0 && digits[i] === questions[i].options.length - 1) {
      digits[i] = 0;
      i -= 1;
    }

    if (i < 0) {
      break;
    }

    digits[i] += 1;
  }

  const maxScore = (outcomeId: string) =>
    questions.reduce(
      (sum, q) =>
        sum + Math.max(0, ...q.options.map((o) => o.weights[outcomeId] ?? 0)),
      0,
    );

  console.log(`${quiz.meta.title} (v${quiz.meta.version})`);
  console.log(
    `${total} combinations, ${unforcedTotal} with no forced answer. ` +
      `Flags: under ${LOW_SHARE * 100}% or over ${HIGH_SHARE * 100}% of all combinations.`,
  );
  console.log("");

  const rows = outcomes.map((o) => {
    const count = wins.get(o.id)!;
    const share = count / total;
    const flag =
      share < LOW_SHARE ? "LOW" : share > HIGH_SHARE ? "HIGH" : "";

    return {
      outcome: `${o.name} (${o.id})`,
      tier: o.tier,
      wins: count,
      share: percent(count, total),
      unforcedWins: unforcedWins.get(o.id)!,
      unforcedShare: percent(unforcedWins.get(o.id)!, unforcedTotal),
      maxScore: maxScore(o.id),
      flag,
    };
  });

  rows.sort((a, b) => b.wins - a.wins);
  console.table(rows);

  const flagged = rows.filter((row) => row.flag !== "");

  console.log("");
  console.log(
    flagged.length === 0
      ? "No outcomes flagged."
      : `Flagged: ${flagged.map((row) => `${row.outcome} ${row.flag}`).join(", ")}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
