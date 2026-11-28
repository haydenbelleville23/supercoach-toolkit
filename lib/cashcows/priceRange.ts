/**
 * Cash Cows' price range filter: on the player's current price (after the
 * as-of round). Null means no bound on that side.
 */
export interface PriceRange {
  min: number | null;
  max: number | null;
}

export const NO_PRICE_RANGE: PriceRange = { min: null, max: null };

/** The slider moves in $10,000 steps; typed values round to $100. */
export const PRICE_SLIDER_STEP = 10_000;
export const PRICE_ROUNDING = 100;

export const PRICE_PRESETS: readonly { id: string; label: string; range: PriceRange }[] = [
  { id: "rookies", label: "Rookies under $300k", range: { min: null, max: 299_900 } },
  { id: "mid", label: "Mid $300k to $500k", range: { min: 300_000, max: 500_000 } },
  { id: "premiums", label: "Premiums over $500k", range: { min: 500_100, max: null } },
];

/**
 * A typed price: "350000", "350,000", "$350k", "350k", "1.2m" (any case,
 * spaces ignored). Rounded to the nearest $100. Null when empty or not a
 * price.
 */
export function parsePriceInput(text: string): number | null {
  const cleaned = text.trim().toLowerCase().replace(/[\s,$]/g, "");
  const match = /^(\d+(?:\.\d+)?|\.\d+)([km]?)$/.exec(cleaned);
  if (!match) return null;

  const multiplier = match[2] === "k" ? 1_000 : match[2] === "m" ? 1_000_000 : 1;
  const value = Number(match[1]) * multiplier;
  if (!Number.isFinite(value)) return null;

  return Math.round(value / PRICE_ROUNDING) * PRICE_ROUNDING;
}

/** Min never above Max: a Min past the Max is pulled down to it (and the reverse). */
export function normalisePriceRange(range: PriceRange, changed: "min" | "max" = "min"): PriceRange {
  const { min, max } = range;
  if (min === null || max === null || min <= max) return range;
  return changed === "min" ? { min: max, max } : { min, max: min };
}

export function matchesPriceRange(price: number, range: PriceRange): boolean {
  return (range.min === null || price >= range.min) && (range.max === null || price <= range.max);
}

export function isPriceRangeActive(range: PriceRange): boolean {
  return range.min !== null || range.max !== null;
}

/** The slider's ends: the pool's lowest and highest price, out to whole steps. */
export function priceSliderBounds(prices: readonly number[]): { low: number; high: number } {
  const finite = prices.filter((price) => Number.isFinite(price));
  if (finite.length === 0) return { low: 0, high: 2_000_000 };
  return {
    low: Math.floor(Math.min(...finite) / PRICE_SLIDER_STEP) * PRICE_SLIDER_STEP,
    high: Math.ceil(Math.max(...finite) / PRICE_SLIDER_STEP) * PRICE_SLIDER_STEP,
  };
}

/** "$350k", "$1.25m", "$299.9k". */
export function formatPriceShort(price: number): string {
  if (price >= 1_000_000) return `$${Number((price / 1_000_000).toFixed(3))}m`;
  return `$${Number((price / 1_000).toFixed(1))}k`;
}

export function presetFor(range: PriceRange) {
  return PRICE_PRESETS.find((preset) => preset.range.min === range.min && preset.range.max === range.max) ?? null;
}

/** The toolbar chip's text, e.g. "Mid $300k to $500k" or "$350k to $500k". */
export function priceRangeLabel(range: PriceRange): string {
  const preset = presetFor(range);
  if (preset) return preset.label;
  if (range.min !== null && range.max !== null) return `${formatPriceShort(range.min)} to ${formatPriceShort(range.max)}`;
  if (range.min !== null) return `From ${formatPriceShort(range.min)}`;
  if (range.max !== null) return `Up to ${formatPriceShort(range.max)}`;
  return "Any price";
}
