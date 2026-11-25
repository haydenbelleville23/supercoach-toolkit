const MONEY_FORMAT = new Intl.NumberFormat("en-AU", {
  maximumFractionDigits: 0,
});

/** Price as "$412,300". */
export function formatMoney(value: number): string {
  return `$${MONEY_FORMAT.format(value)}`;
}

/**
 * Price change as "+$12,300" or "−$12,300" (true minus sign).
 * Zero and null show as "-".
 */
export function formatChange(value: number | null): string {
  if (value === null || value === 0) {
    return "-";
  }

  const sign = value > 0 ? "+" : "−";

  return `${sign}${formatMoney(Math.abs(value))}`;
}
