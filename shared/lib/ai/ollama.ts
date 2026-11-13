import * as z from "zod/v4";
import type { AiProvider } from "@/shared/lib/ai/provider";

export interface OllamaOptions {
  baseUrl: string;
  model: string;
  fetch?: typeof fetch;
}

/** Qwen (or any model) served by a local Ollama, through its native chat API with a JSON-schema format. */
export function createOllamaProvider({ baseUrl, model, fetch: doFetch = fetch }: OllamaOptions): AiProvider {
  const url = `${baseUrl.replace(/\/+$/, "")}/api/chat`;
  return {
    name: "ollama",
    model,
    async structured({ system, text, schema, timeoutMs = 60_000 }) {
      try {
        // `format` only constrains decoding; the model never sees it. Repeat the schema in the prompt so the
        // field descriptions (what each key means, value formats) reach the model, as they do for Claude.
        const jsonSchema = z.toJSONSchema(schema);
        const res = await doFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({
            model,
            stream: false,
            think: false,
            format: jsonSchema,
            // Ollama's default context is 4k on most Macs; the schema prompt plus a long (often Arabic) story
            // can exceed it and be silently cut. Cap the answer so a looping model can't run on.
            options: { temperature: 0, num_ctx: 8192, num_predict: 1024 },
            messages: [
              { role: "system", content: withSchema(system, jsonSchema) },
              { role: "user", content: text },
            ],
          }),
        });
        if (!res.ok) {
          console.warn(`Ollama returned ${res.status}`);
          return null;
        }
        const data = (await res.json()) as { message?: { content?: string } };
        const parsed = schema.safeParse(JSON.parse(unfence(data.message?.content ?? "")));
        if (!parsed.success) {
          console.warn("Ollama answer did not match the schema");
          return null;
        }
        return parsed.data;
      } catch (error) {
        // Name only: messages can echo the request, and the request holds the patient's story.
        console.warn("Ollama call failed:", error instanceof Error ? error.name : "unknown error");
        return null;
      }
    },
  };
}

export function withSchema(system: string, jsonSchema: unknown) {
  return `${system}\n\nAnswer only with JSON matching this JSON Schema. Field descriptions explain each key:\n${JSON.stringify(jsonSchema)}`;
}

/** Older Ollama releases can ignore `format` and wrap the answer in a ```json fence. */
function unfence(content: string) {
  return content.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/, "$1");
}
