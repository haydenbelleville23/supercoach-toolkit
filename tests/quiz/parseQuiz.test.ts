import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseQuiz, QuizDataError } from "@/lib/quiz/parseQuiz";

function loadRaw() {
  return JSON.parse(
    readFileSync(path.resolve("data/quiz/ruck-quiz.json"), "utf8"),
  );
}

describe("parseQuiz", () => {
  it("accepts the real quiz data", () => {
    const quiz = parseQuiz(loadRaw());

    expect(quiz.outcomes).toHaveLength(12);
    expect(quiz.questions).toHaveLength(7);
  });

  it("rejects an unknown weight key", () => {
    const raw = loadRaw();
    raw.questions[0].options[0].weights.notARuck = 2;

    expect(() => parseQuiz(raw)).toThrow(QuizDataError);
    expect(() => parseQuiz(raw)).toThrow(/unknown outcome id "notARuck"/);
  });

  it("rejects an outcome without a tier", () => {
    const raw = loadRaw();
    delete raw.outcomes[0].tier;

    expect(() => parseQuiz(raw)).toThrow(/has no tier/);
  });

  it("rejects a forceOutcomeId that is not an outcome", () => {
    const raw = loadRaw();
    raw.questions[6].options[0].forceOutcomeId = "nobody";

    expect(() => parseQuiz(raw)).toThrow(/forceOutcomeId "nobody"/);
  });
});
