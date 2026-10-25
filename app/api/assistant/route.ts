import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";
import { classifyChange, extractStory, type ChangeId, type Found } from "@/lib/assistant";

// One endpoint for the assistant's language tasks. With ANTHROPIC_API_KEY set it asks Claude;
// without it (the default demo), or if Claude fails or declines, it answers with the scripted
// heuristics in lib/assistant.ts. Either way the response shape is the same.

const MODEL = "claude-opus-5-5";

const hit = <T extends z.ZodType>(v: T) =>
  z.object({ v, q: z.string().describe("The exact words from the story this came from") }).nullable();

const FoundSchema = z.object({
  rel: hit(z.string().describe("The patient relative to the writer, lower case, e.g. father")),
  self: hit(z.literal(true).describe("Present only when the writer is the patient")),
  name: hit(z.string().describe("Patient's name as written")),
  age: hit(z.string().describe("Patient's age in years, digits only")),
  dx: hit(z.enum(["colon", "breast", "prostate", "lung", "other"])),
  stage: hit(z.enum(["1", "2", "3", "4", "unsure"])),
  origin: z
    .object({
      v: z.enum(["jordan", "saudi", "uae", "lebanon", "egypt", "uk", "nz", "other"]),
      city: z.string().describe("Home city, or the capital if only a country is named"),
      label: z.string().describe("e.g. 'Irbid, Jordan'"),
      q: z.string(),
    })
    .nullable(),
  langs: hit(z.array(z.enum(["arabic", "english", "french", "turkish", "german"]))),
  time: hit(z.enum(["asap", "month", "quarter", "flexible"])),
  budget: hit(z.enum(["u25", "25-50", "50-100", "o100", "unsure"]).describe("Medical budget band in US dollars")),
  pay: hit(z.enum(["self", "partial", "program", "unsure"])),
  mgr: z
    .object({
      v: z.string().describe("Writer's first name, or empty"),
      rel: z.string().describe("Writer relative to the patient, lower case, e.g. son"),
      q: z.string(),
    })
    .nullable(),
  dest: hit(z.array(z.enum(["amman", "cairo", "istanbul", "dubai", "berlin"]))),
});

const ChangeSchema = z.object({ id: z.enum(["companion", "cheaper", "moved"]) });

const EXTRACT_SYSTEM = `You read a family's description of a cancer care situation and pull out the details a care coordinator needs. Fill a field only when the story states it; leave it null otherwise and never guess. Each "q" is the shortest exact phrase from the story that supports the value. You are not giving medical advice.`;

const CHANGE_SYSTEM = `A family describes a change to their treatment-travel plan. Classify it: "companion" (someone else is coming along), "cheaper" (lower travel or stay costs), or "moved" (an appointment or date changed).`;

type Body = { task: "extract"; text: string } | { task: "change"; text: string };

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Expected JSON" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.slice(0, 4000) : "";
  if (!text.trim()) return Response.json({ error: "Missing text" }, { status: 400 });

  if (body.task === "extract") {
    const ai = await askClaude(EXTRACT_SYSTEM, text, FoundSchema);
    return Response.json(
      ai ? { source: "claude", found: dropNulls(ai) as Found } : { source: "scripted", found: extractStory(text) },
    );
  }
  if (body.task === "change") {
    const ai = await askClaude(CHANGE_SYSTEM, text, ChangeSchema);
    return Response.json({ source: ai ? "claude" : "scripted", id: (ai?.id ?? classifyChange(text)) as ChangeId });
  }
  return Response.json({ error: "Unknown task" }, { status: 400 });
}

/** Returns Claude's parsed answer, or null when there is no key, the call fails, or Claude declines. */
async function askClaude<T extends z.ZodType>(system: string, text: string, schema: T): Promise<z.infer<T> | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const client = new Anthropic();
    const response = await client.messages.parse(
      {
        model: MODEL,
        max_tokens: 2000,
        system,
        output_config: { effort: "low", format: zodOutputFormat(schema) },
        messages: [{ role: "user", content: text }],
      },
      { timeout: 20_000 },
    );
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return null;
    return response.parsed_output ?? null;
  } catch (error) {
    if (error instanceof Anthropic.APIError) console.warn(`Assistant fell back to scripted: ${error.status} ${error.message}`);
    else console.warn("Assistant fell back to scripted:", error);
    return null;
  }
}

function dropNulls(o: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null));
}
