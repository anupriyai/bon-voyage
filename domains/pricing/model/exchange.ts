// Fixed planning estimates, not a live FX quote. Used only for USD ranking penalties and plan estimates.
export const USD_PER_UNIT: Record<string, number> = { USD: 1, GBP: 1.27, EUR: 1.087, AED: 1 / 3.6725, SAR: 1 / 3.75, JOD: 1 / 0.709, EGP: 1 / 48.5, TRY: 1 / 41.5 };
export function planningUsdRate(currency: string): number {
  const rate = USD_PER_UNIT[currency];
  if (!rate) throw new Error("No planning conversion is configured for this currency.");
  return rate;
}
