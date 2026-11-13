import Anthropic from "@anthropic-ai/sdk";
import { createClaudeProvider } from "@/shared/lib/ai/claude";
import { createOllamaProvider } from "@/shared/lib/ai/ollama";
import type { AiProvider } from "@/shared/lib/ai/provider";

export type { AiProvider, AiProviderName, StructuredRequest } from "@/shared/lib/ai/provider";

type Env = Record<string, string | undefined>;

/**
 * The configured model, or null to use the scripted assistant. Reads AI_PROVIDER, OLLAMA_*, ANTHROPIC_API_KEY.
 * Opt-in only: an API key alone never sends patient stories to a third party.
 */
export function getAiProvider(env: Env = process.env): AiProvider | null {
  const choice = env.AI_PROVIDER?.trim().toLowerCase() ?? "";
  switch (choice) {
    case "":
      return null;
    case "ollama":
      return createOllamaProvider({
        baseUrl: env.OLLAMA_BASE_URL || "http://localhost:11434",
        model: env.OLLAMA_MODEL || "qwen3.5:4b",
      });
    case "claude":
      if (!env.ANTHROPIC_API_KEY) return null;
      return createClaudeProvider({
        model: env.CLAUDE_MODEL || "claude-opus-5-5",
        client: new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }),
      });
    default:
      console.warn(`Unknown AI_PROVIDER "${choice}"; using the scripted assistant`);
      return null;
  }
}
