import { describe, expect, it, vi } from "vitest";
import * as z from "zod/v4";
import { createClaudeProvider, type ClaudeClient } from "@/shared/lib/ai/claude";

const schema = z.object({ id: z.string() });

function fakeClient(result: unknown): ClaudeClient {
  return { messages: { parse: vi.fn(async () => result) } } as unknown as ClaudeClient;
}

describe("claude provider", () => {
  it("returns parsed_output", async () => {
    const ai = createClaudeProvider({ model: "claude-opus-5-5", client: fakeClient({ stop_reason: "end_turn", parsed_output: { id: "moved" } }) });
    expect(await ai.structured({ system: "s", text: "t", schema })).toEqual({ id: "moved" });
  });

  it("returns null on refusal", async () => {
    const ai = createClaudeProvider({ model: "m", client: fakeClient({ stop_reason: "refusal", parsed_output: null }) });
    expect(await ai.structured({ system: "s", text: "t", schema })).toBeNull();
  });

  it("returns null when the call throws", async () => {
    const client = {
      messages: {
        parse: vi.fn(async () => {
          throw new Error("boom");
        }),
      },
    } as unknown as ClaudeClient;
    const ai = createClaudeProvider({ model: "m", client });
    expect(await ai.structured({ system: "s", text: "t", schema })).toBeNull();
  });
});
