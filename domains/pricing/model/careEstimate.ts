export interface CareEstimateInput { careUsd: number | null; transferUsd: number | null; flightUsd?: number | null; stayUsd?: number | null; propertyFeesUsd?: number | null; flightSelected: boolean; staySelected: boolean }
export function careEstimate(input: CareEstimateInput) {
  const items = [
    { key: "care", label: "Treatment", amountUsd: input.careUsd },
    { key: "transfers", label: "Transfers", amountUsd: input.transferUsd },
    ...(input.flightSelected ? [{ key: "flights", label: "Return flights · whole party", amountUsd: input.flightUsd ?? null }] : []),
    ...(input.staySelected ? [{ key: "stay", label: "Accommodation · whole stay", amountUsd: input.stayUsd ?? null }, { key: "propertyFees", label: "Due at accommodation", amountUsd: input.propertyFeesUsd ?? null }] : []),
  ];
  const knownTotalUsd = Math.round(items.reduce((sum, item) => sum + (item.amountUsd ?? 0), 0) * 100) / 100;
  const unknownComponents = items.filter((item) => item.amountUsd === null).map((item) => item.label);
  return { currency: "USD" as const, items, knownTotalUsd, unknownComponents, complete: unknownComponents.length === 0 };
}
