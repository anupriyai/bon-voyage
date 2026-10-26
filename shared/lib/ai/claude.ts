import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { AiProvider } from "@/shared/lib/ai/provider";

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
            max_tokens: 8000, // Opus 5.5's thinking counts toward this, even at low effort
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
