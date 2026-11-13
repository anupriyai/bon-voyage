import { describe, expect, it } from "vitest";
import { addDays, dateWindow } from "@/domains/pricing/model/dateWindow";

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });

  it("rejects days that do not exist instead of rolling them over", () => {
    expect(() => addDays("2026-02-30", 0)).toThrow();
    expect(() => addDays("2026-04-31", 0)).toThrow();
    expect(() => addDays("2026-13-01", 0)).toThrow();
  });
});

describe("dateWindow", () => {
  it("departs early enough to land by the buffer, and returns after treatment and recovery", () => {
    const w = dateWindow({ appointment: "2026-11-10", treatmentDays: 5, recoveryDays: 3 });
    // Land by the 8th (buffer 2). Departure dates: the 8th itself, two flex days, and one more day
    // for overnight or long-haul flights that land the next day.
    expect(w.outbound).toEqual(["2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
    // Return no earlier than 10 + 5 + 3 = 18th, up to the 20th.
    expect(w.return).toEqual(["2026-11-18", "2026-11-19", "2026-11-20"]);
  });

  it("never offers a return before recovery ends", () => {
    const w = dateWindow({ appointment: "2026-11-10", treatmentDays: 5, recoveryDays: 3, flexDays: 4 });
    expect(w.return[0]).toBe("2026-11-18");
  });

  it("still searches the day before when there is no flexibility, so overnight flights can qualify", () => {
    const w = dateWindow({ appointment: "2027-01-01", arrivalBufferDays: 3, treatmentDays: 1, recoveryDays: 0, flexDays: 0 });
    expect(w.outbound).toEqual(["2026-12-28", "2026-12-29"]);
    expect(w.return).toEqual(["2027-01-02"]);
  });

  it("lets very long journeys search further back", () => {
    const w = dateWindow({ appointment: "2026-11-10", treatmentDays: 1, recoveryDays: 0, flexDays: 0, maxTransitDays: 2 });
    expect(w.outbound).toEqual(["2026-11-06", "2026-11-07", "2026-11-08"]);
  });

  it("rejects a malformed appointment date", () => {
    expect(() => dateWindow({ appointment: "10/11/2026", treatmentDays: 1, recoveryDays: 0 })).toThrow();
  });
});
