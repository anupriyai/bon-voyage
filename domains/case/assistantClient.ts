import { classifyChange, extractStory, type ChangeId, type Found } from "@/domains/case/model/assistant";

export type AiSource = "claude" | "ollama" | "scripted";

/** Ask the server-side assistant to read a story. Falls back to the local heuristics if the request fails. */
export async function aiExtract(text: string): Promise<{ source: AiSource; found: Found }> {
  try {
    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "extract", text }),
    });
    if (res.ok) return (await res.json()) as { source: AiSource; found: Found };
  } catch {
    // Offline or the route is missing (static export): stay local.
  }
  return { source: "scripted", found: extractStory(text) };
}

export async function aiClassifyChange(text: string): Promise<ChangeId> {
  try {
    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "change", text }),
    });
    if (res.ok) return ((await res.json()) as { id: ChangeId }).id;
  } catch {
    // Fall through.
  }
  return classifyChange(text);
}
