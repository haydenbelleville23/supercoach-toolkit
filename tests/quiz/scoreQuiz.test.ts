import { describe, expect, it } from "vitest";

import { parseQuiz } from "@/lib/quiz/parseQuiz";
import { ruckQuiz } from "@/lib/quiz/ruckQuiz";
import { findOutcome, scoreQuiz } from "@/lib/quiz/scoreQuiz";
import type { QuizAnswers } from "@/lib/quiz/types";

function outcome(id: string, tier: number) {
  return {
    id,
    name: id.toUpperCase(),
    archetype: `The ${id}`,
    tier,
    club: "Club",
    description: "Description.",
  };
}

// "low" (tier 3) is listed before "high" (tier 1) so tier, not JSON order,
// has to decide their tie.
const smallQuiz = parseQuiz({
  meta: {
    title: "Test",
    version: "1",
    totalQuestions: 2,
    tierPriorityOrder: [1, 2, 3],
  },
  outcomes: [outcome("low", 3), outcome("high", 1), outcome("mid", 2)],
  questions: [
    {
      id: "q1",
      number: 1,
      prompt: "One?",
      options: [
        { id: "A", text: "a", weights: { low: 3, mid: 1 } },
        { id: "B", text: "b", weights: { low: 2, high: 2 } },
      ],
    },
    {
      id: "q2",
      number: 2,
      prompt: "Two?",
      options: [
        { id: "A", text: "a", weights: { mid: 1 } },
        { id: "B", text: "b", weights: { high: 1, low: 1 } },
      ],
    },
  ],
});

/** Every question answered with the same letter where it exists, else B. */
function sameLetter(letter: string): QuizAnswers {
  return Object.fromEntries(
    ruckQuiz.questions.map((q) => [
      q.id,
      q.options.some((o) => o.id === letter) ? letter : "B",
    ]),
  );
}

describe("scoreQuiz", () => {
  it("picks a clear single winner", () => {
    const result = scoreQuiz(smallQuiz, { q1: "A", q2: "A" });

    expect(result.scores).toEqual({ low: 3, high: 0, mid: 2 });
    expect(result.winner.id).toBe("low");
    expect(result.forced).toBe(false);
  });

  it("breaks a tie by tier before JSON order", () => {
    // low 3, high 3: tied, and "high" is tier 1.
    const result = scoreQuiz(smallQuiz, { q1: "B", q2: "B" });

    expect(result.scores.low).toBe(3);
    expect(result.scores.high).toBe(3);
    expect(result.winner.id).toBe("high");
    expect(result.runnerUp?.id).toBe("low");
  });

  it("gives the runner-up as the second best", () => {
    const result = scoreQuiz(smallQuiz, { q1: "A", q2: "A" });

    expect(result.runnerUp?.id).toBe("mid");
  });

  it("gives Cox over the Heathen on the all-D path", () => {
    const result = scoreQuiz(ruckQuiz, sameLetter("D"));

    // Q1-Q6 answered D, Q7 answered B (it has no D, and no force).
    expect(result.scores.cox).toBe(10);
    expect(result.scores.heathen).toBe(10);
    expect(result.winner.id).toBe("cox");
    expect(result.runnerUp?.id).toBe("heathen");
  });

  it("returns the Heathen for Q7's forced option even when others score more", () => {
    const answers = { ...sameLetter("A"), q7: "A" };
    const result = scoreQuiz(ruckQuiz, answers);
    const unforced = scoreQuiz(ruckQuiz, { ...answers, q7: "B" });

    expect(result.scores.heathen).toBe(0);
    expect(unforced.winner.id).not.toBe("heathen");
    expect(result.winner.id).toBe("heathen");
    expect(result.forced).toBe(true);
    // The runner-up ignores the forced result and is the normal leader.
    expect(result.runnerUp?.id).toBe(unforced.winner.id);
  });

  it("rejects answers that are not in the quiz", () => {
    expect(() => scoreQuiz(ruckQuiz, { q1: "Z" })).toThrow();
    expect(() => scoreQuiz(ruckQuiz, { q99: "A" })).toThrow();
  });
});

describe("findOutcome (result id from the URL)", () => {
  it("finds a real outcome id", () => {
    expect(findOutcome(ruckQuiz, "gawn")?.name).toBe("Max Gawn");
    expect(findOutcome(ruckQuiz, ["gawn", "cox"])?.id).toBe("gawn");
  });

  it("returns null for bad ids without crashing", () => {
    for (const bad of [
      "not-a-ruck",
      "",
      "GAWN",
      "__proto__",
      "toString",
      undefined,
      null,
      42,
      [],
    ]) {
      expect(findOutcome(ruckQuiz, bad)).toBeNull();
    }
  });
});
