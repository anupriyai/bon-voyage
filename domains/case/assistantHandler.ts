import { CHANGE_SYSTEM, ChangeSchema, EXTRACT_SYSTEM, FoundSchema, toFound } from "@/domains/case/assistantSchemas";
import { classifyChange, extractStory, type ChangeId } from "@/domains/case/model/assistant";
import { getAiProvider } from "@/shared/lib/ai/index";

// One endpoint for the assistant's language tasks. The model comes from AI_PROVIDER (shared/lib/ai):
// Qwen through a local Ollama, or Claude. With none configured, or if the model fails or declines,
// it answers with the scripted heuristics in domains/case/model/assistant.ts. Either way the response shape is the same.

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

  const ai = getAiProvider();

  if (body.task === "extract") {
    const found = await ai?.structured({ system: EXTRACT_SYSTEM, text, schema: FoundSchema });
    return Response.json(ai && found ? { source: ai.name, found: toFound(found) } : { source: "scripted", found: extractStory(text) });
  }
  if (body.task === "change") {
    const change = await ai?.structured({ system: CHANGE_SYSTEM, text, schema: ChangeSchema });
    return Response.json({ source: ai && change ? ai.name : "scripted", id: (change?.id ?? classifyChange(text)) as ChangeId });
  }
  return Response.json({ error: "Unknown task" }, { status: 400 });
}
