import type {
  Quiz,
  QuizMeta,
  QuizOption,
  QuizOutcome,
  QuizQuestion,
} from "./types";

/** Thrown when the quiz JSON is malformed or refers to unknown outcomes. */
export class QuizDataError extends Error {
  constructor(message: string) {
    super(`Invalid quiz data: ${message}`);
    this.name = "QuizDataError";
  }
}

type UnknownRecord = Record<string, unknown>;

function fail(message: string): never {
  throw new QuizDataError(message);
}

function asRecord(value: unknown, where: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${where} must be an object`);
  }

  return value as UnknownRecord;
}

function asArray(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) {
    fail(`${where} must be an array`);
  }

  return value;
}

function asString(value: unknown, where: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`${where} must be a non-empty string`);
  }

  return value;
}

function asNumber(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${where} must be a number`);
  }

  return value;
}

function parseMeta(value: unknown): QuizMeta {
  const meta = asRecord(value, "meta");
  const tierPriorityOrder = asArray(
    meta.tierPriorityOrder,
    "meta.tierPriorityOrder",
  ).map((tier, i) => asNumber(tier, `meta.tierPriorityOrder[${i}]`));

  if (new Set(tierPriorityOrder).size !== tierPriorityOrder.length) {
    fail("meta.tierPriorityOrder has a repeated tier");
  }

  return {
    title: asString(meta.title, "meta.title"),
    version: asString(meta.version, "meta.version"),
    totalQuestions: asNumber(meta.totalQuestions, "meta.totalQuestions"),
    tierPriorityOrder,
  };
}

function parseOutcome(
  value: unknown,
  index: number,
  tiers: Set<number>,
): QuizOutcome {
  const where = `outcomes[${index}]`;
  const outcome = asRecord(value, where);

  if (outcome.tier === undefined) {
    fail(`${where} has no tier`);
  }

  const tier = asNumber(outcome.tier, `${where}.tier`);

  if (!tiers.has(tier)) {
    fail(`${where}.tier ${tier} is not in meta.tierPriorityOrder`);
  }

  return {
    id: asString(outcome.id, `${where}.id`),
    name: asString(outcome.name, `${where}.name`),
    archetype: asString(outcome.archetype, `${where}.archetype`),
    tier,
    club: asString(outcome.club, `${where}.club`),
    description: asString(outcome.description, `${where}.description`),
  };
}

function parseOption(
  value: unknown,
  where: string,
  outcomeIds: Set<string>,
): QuizOption {
  const option = asRecord(value, where);
  const rawWeights = asRecord(option.weights ?? {}, `${where}.weights`);
  const weights: Record<string, number> = {};

  for (const [outcomeId, weight] of Object.entries(rawWeights)) {
    if (!outcomeIds.has(outcomeId)) {
      fail(`${where}.weights has unknown outcome id "${outcomeId}"`);
    }

    weights[outcomeId] = asNumber(weight, `${where}.weights.${outcomeId}`);
  }

  const parsed: QuizOption = {
    id: asString(option.id, `${where}.id`),
    text: asString(option.text, `${where}.text`),
    weights,
  };

  if (option.forceOutcomeId !== undefined) {
    const forceOutcomeId = asString(
      option.forceOutcomeId,
      `${where}.forceOutcomeId`,
    );

    if (!outcomeIds.has(forceOutcomeId)) {
      fail(`${where}.forceOutcomeId "${forceOutcomeId}" is not an outcome id`);
    }

    parsed.forceOutcomeId = forceOutcomeId;
  }

  return parsed;
}

function parseQuestion(
  value: unknown,
  index: number,
  outcomeIds: Set<string>,
): QuizQuestion {
  const where = `questions[${index}]`;
  const question = asRecord(value, where);
  const options = asArray(question.options, `${where}.options`).map(
    (option, i) => parseOption(option, `${where}.options[${i}]`, outcomeIds),
  );

  if (options.length === 0) {
    fail(`${where} has no options`);
  }

  if (new Set(options.map((o) => o.id)).size !== options.length) {
    fail(`${where} has a repeated option id`);
  }

  return {
    id: asString(question.id, `${where}.id`),
    number: asNumber(question.number, `${where}.number`),
    prompt: asString(question.prompt, `${where}.prompt`),
    options,
  };
}

/**
 * Checks raw quiz JSON and returns it typed. Every weight key and every
 * forceOutcomeId must be a real outcome id, and every outcome needs a tier
 * listed in meta.tierPriorityOrder. Throws QuizDataError otherwise.
 */
export function parseQuiz(raw: unknown): Quiz {
  const root = asRecord(raw, "quiz");
  const meta = parseMeta(root.meta);
  const tiers = new Set(meta.tierPriorityOrder);

  const outcomes = asArray(root.outcomes, "outcomes").map((outcome, i) =>
    parseOutcome(outcome, i, tiers),
  );

  if (outcomes.length === 0) {
    fail("outcomes is empty");
  }

  const outcomeIds = new Set(outcomes.map((o) => o.id));

  if (outcomeIds.size !== outcomes.length) {
    fail("outcomes has a repeated id");
  }

  const questions = asArray(root.questions, "questions").map((question, i) =>
    parseQuestion(question, i, outcomeIds),
  );

  if (questions.length === 0) {
    fail("questions is empty");
  }

  if (new Set(questions.map((q) => q.id)).size !== questions.length) {
    fail("questions has a repeated id");
  }

  return { meta, outcomes, questions };
}
