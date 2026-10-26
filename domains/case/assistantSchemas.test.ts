import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { describe, expect, it } from "vitest";
import * as z from "zod/v4";
import { ChangeSchema, FoundSchema, toFound } from "@/domains/case/assistantSchemas";

const answer = {
  rel: { v: "Father", q: "My father" },
  self: null,
  name: { v: "Yousef", q: "Yousef" },
  age: { v: "68", q: "68" },
  dx: { v: "Colon", q: "colon cancer" },
  stage: { v: "3", q: "stage 3" },
  origin: { v: "Jordan", city: "Irbid", label: "Irbid, Jordan", q: "Irbid, Jordan" },
  langs: { v: ["Arabic"], q: "speaks Arabic" },
  time: { v: "month", q: "within a month" },
  budget: { v: "25-50", q: "$40,000" },
  pay: { v: "self", q: "we can pay" },
  mgr: { v: "Omar", rel: "son", q: "I'm his son, Omar" },
  dest: null,
};

describe("FoundSchema", () => {
  it("converts to a JSON schema that still lists the allowed values", () => {
    const json = JSON.stringify(z.toJSONSchema(FoundSchema));
    expect(json).toContain('"prostate"');
    expect(json).toContain('"unsure"');
  });

  it("accepts values in any letter case", () => {
    const found = FoundSchema.parse(answer);
    expect(found.dx?.v).toBe("colon");
    expect(found.origin?.v).toBe("jordan");
    expect(found.langs?.v).toEqual(["arabic"]);
    expect(found.rel?.v).toBe("father");
  });

  it("drops only the field with a value outside the list, keeping the rest", () => {
    const found = FoundSchema.parse({ ...answer, dx: { v: "pancreatic", q: "pancreatic cancer" } });
    expect(found.dx).toBeNull();
    expect(found.age?.v).toBe("68");
  });

  it("survives Claude's real parse path, which does not enforce enums server-side", () => {
    const format = zodOutputFormat(FoundSchema);
    const found = format.parse(JSON.stringify({ ...answer, stage: { v: "IV", q: "stage IV" }, budget: { v: "lots", q: "lots" } }));
    expect(found.stage).toBeNull();
    expect(found.budget).toBeNull();
    expect(found.name?.v).toBe("Yousef");
  });

  it("treats a missing field as null", () => {
    const { mgr: _, ...withoutMgr } = answer;
    expect(FoundSchema.parse(withoutMgr).mgr).toBeNull();
  });
});

describe("toFound", () => {
  it("drops nulls and a false 'self'", () => {
    const found = toFound(FoundSchema.parse({ ...answer, self: { v: false, q: "my father" } }));
    expect(found).not.toHaveProperty("self");
    expect(found).not.toHaveProperty("dest");
    expect(found.age?.v).toBe("68");
  });

  it("keeps a true 'self'", () => {
    expect(toFound(FoundSchema.parse({ ...answer, self: { v: true, q: "I have" } })).self?.v).toBe(true);
  });
});

describe("ChangeSchema", () => {
  it("accepts any letter case and rejects unknown kinds", () => {
    expect(ChangeSchema.parse({ id: "Cheaper" }).id).toBe("cheaper");
    expect(() => ChangeSchema.parse({ id: "teleport" })).toThrow();
  });
});
