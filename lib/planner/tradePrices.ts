import { ROOKIE_PLACEHOLDER } from "@/lib/rules/squadRules";

import type { PlannedTrade, TradePlan } from "./types";

/** Typed trade prices must be in this range (after rounding to $100). */
export const TRADE_PRICE_LIMITS = {
  min: ROOKIE_PLACEHOLDER.price, // $99,100
  max: 1_500_000,
};

export type PriceInputResult =
  | { ok: true; price: number }
  | { ok: false; error: string };

const money = (value: number) => `$${value.toLocaleString("en-AU")}`;

/**
 * Parses a typed trade price: "350000", "350,000", "$350,000", "350k",
 * "$350k", "1.2m". Rounds to the nearest $100, then checks the range.
 */
export function parsePriceInput(text: string): PriceInputResult {
  const cleaned = text.trim().toLowerCase().replace(/[\s$,]/g, "");
  const match = /^(\d+(?:\.\d+)?|\.\d+)([km]?)$/.exec(cleaned);

  if (!match) {
    return { ok: false, error: "Enter a price like 350,000 or 350k." };
  }

  const multiplier = match[2] === "k" ? 1_000 : match[2] === "m" ? 1_000_000 : 1;
  const price = Math.round((Number(match[1]) * multiplier) / 100) * 100;

  if (price < TRADE_PRICE_LIMITS.min || price > TRADE_PRICE_LIMITS.max) {
    return {
      ok: false,
      error: `Enter a price from ${money(TRADE_PRICE_LIMITS.min)} to ${money(TRADE_PRICE_LIMITS.max)}.`,
    };
  }

  return { ok: true, price };
}

const isValidOverride = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= TRADE_PRICE_LIMITS.min &&
  value <= TRADE_PRICE_LIMITS.max;

/** A trade without its price overrides. */
export function withoutPriceOverrides(trade: PlannedTrade): PlannedTrade {
  return { outId: trade.outId, inId: trade.inId };
}

/**
 * Applies a change to a trade row. Changing either player drops the row's
 * price overrides (both sides), so a price never sticks to a different
 * player.
 */
export function updateTrade(
  trade: PlannedTrade,
  change: Partial<PlannedTrade>,
): PlannedTrade {
  const next = { ...trade, ...change };

  const playerChanged =
    ("outId" in change && change.outId !== trade.outId) ||
    ("inId" in change && change.inId !== trade.inId);

  return playerChanged ? withoutPriceOverrides(next) : next;
}

/** Sets (or, with null, clears) one side's price override. */
export function setTradePriceOverride(
  trade: PlannedTrade,
  side: "out" | "in",
  price: number | null,
): PlannedTrade {
  const key = side === "out" ? "outPriceOverride" : "inPriceOverride";
  const next = { ...trade };

  if (price === null) {
    delete next[key];
  } else {
    next[key] = price;
  }

  return next;
}

/** How many price overrides a plan has. */
export function countPriceOverrides(plan: TradePlan): number {
  return Object.values(plan.rounds).reduce(
    (total, round) =>
      total +
      round.trades.reduce(
        (sum, t) =>
          sum +
          (t.outPriceOverride !== undefined ? 1 : 0) +
          (t.inPriceOverride !== undefined ? 1 : 0),
        0,
      ),
    0,
  );
}

/** The plan with every price override removed. */
export function resetPriceOverrides(plan: TradePlan): TradePlan {
  return {
    ...plan,
    rounds: Object.fromEntries(
      Object.entries(plan.rounds).map(([round, planRound]) => [
        round,
        { ...planRound, trades: planRound.trades.map(withoutPriceOverrides) },
      ]),
    ),
  };
}

/**
 * Cleans a trade read from storage or an imported file: keeps the player
 * ids and any valid price overrides. Plans saved before overrides existed
 * have none, so they load unchanged.
 */
export function sanitiseTrade(value: unknown): PlannedTrade {
  const raw = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const id = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

  const trade: PlannedTrade = { outId: id(raw.outId), inId: id(raw.inId) };

  if (trade.outId !== null && isValidOverride(raw.outPriceOverride)) {
    trade.outPriceOverride = raw.outPriceOverride;
  }

  if (trade.inId !== null && isValidOverride(raw.inPriceOverride)) {
    trade.inPriceOverride = raw.inPriceOverride;
  }

  return trade;
}
