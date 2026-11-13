# AI Port (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The assistant runs on Qwen through a local Ollama, or on Claude, chosen by `AI_PROVIDER`, with today's scripted fallback unchanged.

**Architecture:** A small `AiProvider` interface in `shared/lib/ai/`. It has two adapters: Ollama, using native `/api/chat` with a JSON-schema `format`, and Claude, which is today's `askClaude` code moved as-is. `getAiProvider()` reads env and returns one adapter or `null`. `app/api/assistant/route.ts` asks the provider and falls back to `domains/case/model/assistant.ts` heuristics on `null`. The response shape stays the same, except that `source` can now be `"ollama"`.

**Tech Stack:** Next.js 16 route handler, zod v4 (`z.toJSONSchema`), `@anthropic-ai/sdk`, Ollama HTTP API, Vitest 5 (new dev dependency).

Spec: [booking-pricing-ai-design.md](booking-pricing-ai-design.md) §1.

**Repo rules that apply:**
- `shared/` imports nothing from the project.
- No commits unless the user asks. The plan's commit steps are replaced by "show diff".
- Never log story text.

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `package.json` | modify | add `vitest` dev dependency, `test` script |
| `shared/lib/ai/provider.ts` | create | `AiProvider` interface and request type |
| `shared/lib/ai/ollama.ts` | create | Ollama adapter |
| `shared/lib/ai/ollama.test.ts` | create | adapter tests with a fake `fetch` |
| `shared/lib/ai/claude.ts` | create | Claude adapter (moved from route) |
| `shared/lib/ai/claude.test.ts` | create | adapter tests with a fake client |
| `shared/lib/ai/index.ts` | create | `getAiProvider(env)` + re-exports |
| `shared/lib/ai/index.test.ts` | create | env selection tests |
| `app/api/assistant/route.ts` | modify | use the provider, drop `askClaude` |
| `domains/case/assistantClient.ts` | modify | `AiSource` gains `"ollama"` |
| `domains/case/components/Intake.tsx:1012` | modify | label "Read by Qwen (on this computer)" |
| `.env.example` | create | document the variables (tracked; `.env*.local` stays ignored) |

---

### Task 1: Vitest

**Files:** Modify `package.json`

- [ ] **Step 1:** Run `npm install -D vitest@5`
- [ ] **Step 2:** Add `"test": "vitest run"` to `scripts`.
- [ ] **Step 3:** Run `npm test --`. Expected: "No test files found", exit code 1. This confirms Vitest is installed.

### Task 2: Provider interface

**Files:** Create `shared/lib/ai/provider.ts`

- [ ] **Step 1:** Write:

```ts
import type * as z from "zod/v4";

export type AiProviderName = "ollama" | "claude";

export interface StructuredRequest<T extends z.ZodType> {
  system: string;
  text: string;
  schema: T;
  timeoutMs?: number;
}

/** A language model that answers in a fixed shape. Every failure resolves to null so callers can fall back. */
export interface AiProvider {
  readonly name: AiProviderName;
  readonly model: string;
  structured<T extends z.ZodType>(request: StructuredRequest<T>): Promise<z.infer<T> | null>;
}
```

### Task 3: Ollama adapter (TDD)

**Files:** Create `shared/lib/ai/ollama.test.ts`, `shared/lib/ai/ollama.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from "vitest";
import * as z from "zod/v4";
import { createOllamaProvider } from "./ollama";

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
    expect(sent).toMatchObject({ model: "qwen3:8b", stream: false, think: false, options: { temperature: 0 } });
    expect(sent.format).toEqual(z.toJSONSchema(schema));
    expect(sent.messages).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "make it cheaper" },
    ]);
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
    const fetch = vi.fn(async () => { throw new TypeError("fetch failed"); });
    const ai = createOllamaProvider({ baseUrl: "http://x", model: "m", fetch });
    expect(await ai.structured({ system: "", text: "t", schema })).toBeNull();
  });
});
```

- [ ] **Step 2:** Run `npm test -- shared/lib/ai/ollama.test.ts`. Expected: FAIL, cannot resolve `./ollama`.

- [ ] **Step 3: Implement**

```ts
import * as z from "zod/v4";
import type { AiProvider } from "./provider";

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
        const res = await doFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({
            model,
            stream: false,
            think: false,
            format: z.toJSONSchema(schema),
            options: { temperature: 0 },
            messages: [
              { role: "system", content: system },
              { role: "user", content: text },
            ],
          }),
        });
        if (!res.ok) {
          console.warn(`Ollama returned ${res.status}`);
          return null;
        }
        const data = (await res.json()) as { message?: { content?: string } };
        const parsed = schema.safeParse(JSON.parse(data.message?.content ?? ""));
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
```

- [ ] **Step 4:** Run `npm test -- shared/lib/ai/ollama.test.ts`. Expected: 6 passed.

### Task 4: Claude adapter (TDD)

**Files:** Create `shared/lib/ai/claude.test.ts`, `shared/lib/ai/claude.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from "vitest";
import * as z from "zod/v4";
import { createClaudeProvider, type ClaudeClient } from "./claude";

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
    const client = { messages: { parse: vi.fn(async () => { throw new Error("boom"); }) } } as unknown as ClaudeClient;
    const ai = createClaudeProvider({ model: "m", client });
    expect(await ai.structured({ system: "s", text: "t", schema })).toBeNull();
  });
});
```

- [ ] **Step 2:** Run `npm test -- shared/lib/ai/claude.test.ts`. Expected: FAIL, cannot resolve `./claude`.

- [ ] **Step 3: Implement** (the body is today's `askClaude` from `app/api/assistant/route.ts:76-97`)

```ts
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { AiProvider } from "./provider";

export type ClaudeClient = Pick<Anthropic, "messages">;

export interface ClaudeOptions {
  model: string;
  client?: ClaudeClient;
}

/** Claude through the Messages API with structured output. Needs ANTHROPIC_API_KEY unless a client is passed. */
export function createClaudeProvider({ model, client = new Anthropic() }: ClaudeOptions): AiProvider {
  return {
    name: "claude",
    model,
    async structured({ system, text, schema, timeoutMs = 20_000 }) {
      try {
        const response = await client.messages.parse(
          {
            model,
            max_tokens: 2000,
            system,
            output_config: { effort: "low", format: zodOutputFormat(schema) },
            messages: [{ role: "user", content: text }],
          },
          { timeout: timeoutMs },
        );
        if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return null;
        return response.parsed_output ?? null;
      } catch (error) {
        if (error instanceof Anthropic.APIError) console.warn(`Claude call failed: ${error.status}`);
        else console.warn("Claude call failed:", error instanceof Error ? error.name : "unknown error");
        return null;
      }
    },
  };
}
```

- [ ] **Step 4:** Run `npm test -- shared/lib/ai/claude.test.ts`. Expected: 3 passed. If `tsc` rejects the generic return type of `parsed_output`, cast it to `z.infer<typeof schema>` at the return. Keep the runtime behaviour as written.

### Task 5: Provider selection (TDD)

**Files:** Create `shared/lib/ai/index.test.ts`, `shared/lib/ai/index.ts`

**Rules:**
- `AI_PROVIDER=ollama` returns Ollama, using `OLLAMA_BASE_URL` (default `http://localhost:11434`) and `OLLAMA_MODEL` (default `qwen3:8b`).
- `AI_PROVIDER=claude` returns Claude only when `ANTHROPIC_API_KEY` is set; otherwise `null`.
- `AI_PROVIDER` unset or empty returns `null` (scripted), even when `ANTHROPIC_API_KEY` is set. The phase-1 review changed this to opt-in for privacy; the code and tests follow this rule.
- Any other value logs a warning and returns `null`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { getAiProvider } from "./index";

describe("getAiProvider", () => {
  it("is null with nothing configured", () => {
    expect(getAiProvider({})).toBeNull();
  });
  it("picks ollama with defaults", () => {
    const ai = getAiProvider({ AI_PROVIDER: "ollama" });
    expect(ai?.name).toBe("ollama");
    expect(ai?.model).toBe("qwen3:8b");
  });
  it("honours OLLAMA_MODEL", () => {
    expect(getAiProvider({ AI_PROVIDER: "ollama", OLLAMA_MODEL: "qwen3:14b" })?.model).toBe("qwen3:14b");
  });
  it("needs a key for claude", () => {
    expect(getAiProvider({ AI_PROVIDER: "claude" })).toBeNull();
    expect(getAiProvider({ AI_PROVIDER: "claude", ANTHROPIC_API_KEY: "k" })?.name).toBe("claude");
  });
  it("keeps today's behaviour: a key alone means claude", () => {
    expect(getAiProvider({ ANTHROPIC_API_KEY: "k" })?.name).toBe("claude");
  });
  it("is null for an unknown provider", () => {
    expect(getAiProvider({ AI_PROVIDER: "gpt" })).toBeNull();
  });
});
```

- [ ] **Step 2:** Run `npm test -- shared/lib/ai/index.test.ts`. Expected: FAIL, cannot resolve `./index`.

- [ ] **Step 3: Implement**

```ts
import { createClaudeProvider } from "./claude";
import { createOllamaProvider } from "./ollama";
import type { AiProvider } from "./provider";

export type { AiProvider, AiProviderName, StructuredRequest } from "./provider";

type Env = Record<string, string | undefined>;

/** The configured model, or null to use the scripted assistant. Reads AI_PROVIDER, OLLAMA_*, ANTHROPIC_API_KEY. */
export function getAiProvider(env: Env = process.env): AiProvider | null {
  const choice = env.AI_PROVIDER?.trim().toLowerCase() || (env.ANTHROPIC_API_KEY ? "claude" : "");
  switch (choice) {
    case "":
      return null;
    case "ollama":
      return createOllamaProvider({
        baseUrl: env.OLLAMA_BASE_URL || "http://localhost:11434",
        model: env.OLLAMA_MODEL || "qwen3:8b",
      });
    case "claude":
      if (!env.ANTHROPIC_API_KEY) return null;
      return createClaudeProvider({ model: env.CLAUDE_MODEL || "claude-opus-5-5" });
    default:
      console.warn(`Unknown AI_PROVIDER "${choice}"; using the scripted assistant`);
      return null;
  }
}
```

The Claude test that passes a key builds a real `Anthropic` client. Construction doesn't touch the network, so it's safe.

- [ ] **Step 4:** Run `npm test --`. Expected: all 15 tests pass.

### Task 6: Route uses the port

**Files:** Modify `app/api/assistant/route.ts`

- [ ] **Step 1:** Remove the `Anthropic`/`zodOutputFormat` imports, `MODEL` and `askClaude`. Add `import { getAiProvider } from "@/shared/lib/ai";`. Replace the header comment and the two task branches:

```ts
// One endpoint for the assistant's language tasks. The model comes from AI_PROVIDER (shared/lib/ai):
// Qwen through a local Ollama, or Claude. With none configured, or if the model fails or declines,
// it answers with the scripted heuristics in domains/case/model/assistant.ts. Either way the response shape is the same.
```

```ts
  const ai = getAiProvider();

  if (body.task === "extract") {
    const found = await ai?.structured({ system: EXTRACT_SYSTEM, text, schema: FoundSchema });
    return Response.json(
      ai && found ? { source: ai.name, found: dropNulls(found) as Found } : { source: "scripted", found: extractStory(text) },
    );
  }
  if (body.task === "change") {
    const change = await ai?.structured({ system: CHANGE_SYSTEM, text, schema: ChangeSchema });
    return Response.json({ source: ai && change ? ai.name : "scripted", id: (change?.id ?? classifyChange(text)) as ChangeId });
  }
```

- [ ] **Step 2:** Run `npx tsc --noEmit`. Expected: no errors.

### Task 7: Client source label

**Files:** Modify `domains/case/assistantClient.ts:3`, `domains/case/components/Intake.tsx:1012`

- [ ] **Step 1:** In `domains/case/assistantClient.ts`, change it to `export type AiSource = "claude" | "ollama" | "scripted";`
- [ ] **Step 2:** In `Intake.tsx`, change the label expression to:

```tsx
{ai && <> Read by {ai.source === "claude" ? "Claude" : ai.source === "ollama" ? "Qwen, running on this computer" : "the on-device demo assistant"}.</>}
```

### Task 8: Env documentation

**Files:** Create `.env.example`

- [ ] **Step 1:** Write:

```
# Copy to .env.local (gitignored) and fill in.

# Assistant model: ollama | claude | leave empty for the scripted demo assistant.
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:8b
ANTHROPIC_API_KEY=
CLAUDE_MODEL=claude-opus-5-5
```

### Task 9: Verify

- [ ] **Step 1:** Run `npm test --`. Expected: 15 passed.
- [ ] **Step 2:** Run `npm run build`. Expected: build succeeds.
- [ ] **Step 3:** Run the scripted path with no `.env.local`:
  - `curl -s localhost:3000/api/assistant -H 'content-type: application/json' -d '{"task":"change","text":"my wife is coming too"}'`
  - Expected: `{"source":"scripted","id":"companion"}`
- [ ] **Step 4 (after the user installs Ollama and pulls the model):**
  - Set `AI_PROVIDER=ollama` in `.env.local` and restart the dev server.
  - Repeat the curl. Expected: `"source":"ollama"`.
  - Then send the extract task with the `SAMPLE_STORY` from `domains/case/model/assistant.ts`. Expected: `found.age.v === "68"` and `found.origin.v === "jordan"`.
- [ ] **Step 5:** Show the user `git diff --stat`. Don't commit unless asked.

---

## Later phases

Each later phase gets its own plan file in `docs/` before it starts, written after the live fact check of the spec's unverified items:

2. Database, audit and auth
3. Duffel search
4. Pricing
5. Booking
6. Price watch
7. Stays
