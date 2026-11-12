import { describe, expect, it } from "vitest";
import { careEstimate } from "./careEstimate";

describe("public care estimate", () => {
  it("adds care, transfers and selected party travel in USD", () => {
    const result = careEstimate({ careUsd: 3900, transferUsd: 120, flightSelected: true, flightUsd: 780, staySelected: true, stayUsd: 1045, propertyFeesUsd: 33 });
    expect(result.knownTotalUsd).toBe(5878); expect(result.currency).toBe("USD"); expect(result.complete).toBe(true);
  });
  it("excludes unselected travel without presenting it as free", () => {
    const result = careEstimate({ careUsd: 3900, transferUsd: 120, flightSelected: false, flightUsd: 780, staySelected: false, stayUsd: 1045 });
    expect(result.knownTotalUsd).toBe(4020); expect(result.items.map((item) => item.key)).toEqual(["care", "transfers"]);
  });
  it("keeps unknown fees distinct from zero and omits them from known subtotal", () => {
    const result = careEstimate({ careUsd: null, transferUsd: null, flightSelected: false, staySelected: true, stayUsd: 700, propertyFeesUsd: null });
    expect(result.knownTotalUsd).toBe(700); expect(result.complete).toBe(false); expect(result.unknownComponents).toEqual(["Treatment", "Transfers", "Due at accommodation"]);
    const free = careEstimate({ careUsd: 100, transferUsd: 0, flightSelected: false, staySelected: true, stayUsd: 700, propertyFeesUsd: 0 });
    expect(free.complete).toBe(true); expect(free.knownTotalUsd).toBe(800);
  });
});
