import { describe, expect, it, vi } from "vitest";
import * as z from "zod/v4";
import { createOllamaProvider, withSchema } from "@/shared/lib/ai/ollama";

const schema = z.object({ id: z.enum(["companion", "cheaper", "moved"]) });

function fakeFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe("ollama provider", () => {
  it("sends the schema as format, disables thinking and streaming", async () => {
    const fetch = fakeFetch({ message: { content: '{"id":"cheaper"}' } });
    const ai = createOllamaProvider({ baseUrl: "http://localhost:11434/", model: "qwen3:8b", fetch });
    await ai.structured({ system: "sys", text: "make it cheaper", schema });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:11434/api/chat");
    const sent = JSON.parse(String(init.body));
    expect(sent).toMatchObject({ model: "qwen3:8b", stream: false, think: false, options: { temperature: 0, num_ctx: 8192, num_predict: 1024 } });
    expect(sent.format).toEqual(z.toJSONSchema(schema));
    expect(sent.messages).toEqual([
      { role: "system", content: withSchema("sys", z.toJSONSchema(schema)) },
      { role: "user", content: "make it cheaper" },
    ]);
  });

  it("shows the model the field descriptions", () => {
    const described = z.object({ age: z.string().describe("Age in years, digits only") });
    expect(withSchema("sys", z.toJSONSchema(described))).toContain("digits only");
  });

  it("accepts an answer wrapped in a json fence", async () => {
    const ai = createOllamaProvider({ baseUrl: "http://x", model: "m", fetch: fakeFetch({ message: { content: '```json\n{"id":"moved"}\n```' } }) });
    expect(await ai.structured({ system: "", text: "t", schema })).toEqual({ id: "moved" });
  });

  it("returns the parsed answer", async () => {
    const ai = createOllamaProvider({ baseUrl: "http://x", model: "m", fetch: fakeFetch({ message: { content: '{"id":"moved"}' } }) });
    expect(await ai.structured({ system: "", text: "t", schema })).toEqual({ id: "moved" });
  });

  it("returns null when the answer is not JSON", async () => {
    const ai = createOllamaProvider({ baseUrl: "http://x", model: "m", fetch: fakeFetch({ message: { content: "sure! cheaper" } }) });
    expect(await ai.structured({ system: "", text: "t", schema })).toBeNull();
  });

  it("returns null when the answer breaks the schema", async () => {
    const ai = createOllamaProvider({ baseUrl: "http://x", model: "m", fetch: fakeFetch({ message: { content: '{"id":"teleport"}' } }) });
    expect(await ai.structured({ system: "", text: "t", schema })).toBeNull();
  });

  it("returns null on an HTTP error", async () => {
    const ai = createOllamaProvider({ baseUrl: "http://x", model: "m", fetch: fakeFetch({ error: "model not found" }, 404) });
    expect(await ai.structured({ system: "", text: "t", schema })).toBeNull();
  });

  it("returns null when Ollama is not running", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const ai = createOllamaProvider({ baseUrl: "http://x", model: "m", fetch });
    expect(await ai.structured({ system: "", text: "t", schema })).toBeNull();
  });
});
