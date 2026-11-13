import { CHANGE_SYSTEM, ChangeSchema, EXTRACT_SYSTEM, FoundSchema, toFound } from "@/domains/case/assistantSchemas";
import { classifyChange, extractStory, type ChangeId } from "@/domains/case/model/assistant";
import { getAiProvider } from "@/shared/lib/ai/index";
import { actorFrom } from "@/domains/account/auth";
import { getProfileStore } from "@/domains/account/profileStore";
import { HttpError, privateJson, readJson, requireSameOrigin } from "@/shared/lib/http";

// One endpoint for the assistant's language tasks. The model comes from AI_PROVIDER (shared/lib/ai):
// Qwen through a local Ollama, or Claude. With none configured, or if the model fails or declines,
// it answers with the scripted heuristics in domains/case/model/assistant.ts. Either way the response shape is the same.

type Body = { task: "extract"; text: string } | { task: "change"; text: string };

export async function POST(request: Request) {
  let body: Body;
  try {
    requireSameOrigin(request);
    if (process.env.NODE_ENV === "production") {
      const actor = await actorFrom(request.headers);
      if (!actor || !(await getProfileStore().eligibility(actor)).active) return privateJson({ error: "real_data_unavailable" }, 403);
    }
    body = (await readJson(request, 5000)) as Body;
  } catch (error) {
    return privateJson({ error: error instanceof HttpError ? error.code : "invalid_request" }, error instanceof HttpError ? error.status : 400);
  }
  const text = typeof body.text === "string" ? body.text.slice(0, 4000) : "";
  if (!text.trim()) return privateJson({ error: "missing_text" }, 400);

  const ai = getAiProvider();

  if (body.task === "extract") {
    const found = await ai?.structured({ system: EXTRACT_SYSTEM, text, schema: FoundSchema });
    return privateJson(ai && found ? { source: ai.name, found: toFound(found) } : { source: "scripted", found: extractStory(text) });
  }
  if (body.task === "change") {
    const change = await ai?.structured({ system: CHANGE_SYSTEM, text, schema: ChangeSchema });
    return privateJson({ source: ai && change ? ai.name : "scripted", id: (change?.id ?? classifyChange(text)) as ChangeId });
  }
  return privateJson({ error: "invalid_task" }, 400);
}
