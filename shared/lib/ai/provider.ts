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
