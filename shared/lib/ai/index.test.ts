import { describe, expect, it } from "vitest";
import { getAiProvider } from "@/shared/lib/ai/index";

describe("getAiProvider", () => {
  it("is null with nothing configured", () => {
    expect(getAiProvider({})).toBeNull();
  });
  it("picks ollama with defaults", () => {
    const ai = getAiProvider({ AI_PROVIDER: "ollama" });
    expect(ai?.name).toBe("ollama");
    expect(ai?.model).toBe("qwen3.5:4b");
  });
  it("honours OLLAMA_MODEL", () => {
    expect(getAiProvider({ AI_PROVIDER: "ollama", OLLAMA_MODEL: "qwen3.5:9b" })?.model).toBe("qwen3.5:9b");
  });
  it("needs a key for claude", () => {
    expect(getAiProvider({ AI_PROVIDER: "claude" })).toBeNull();
    expect(getAiProvider({ AI_PROVIDER: "claude", ANTHROPIC_API_KEY: "k" })?.name).toBe("claude");
  });
  it("never picks claude from a key alone", () => {
    expect(getAiProvider({ ANTHROPIC_API_KEY: "k" })).toBeNull();
    expect(getAiProvider({ AI_PROVIDER: "", ANTHROPIC_API_KEY: "k" })).toBeNull();
  });
  it("is null for an unknown provider", () => {
    expect(getAiProvider({ AI_PROVIDER: "gpt" })).toBeNull();
  });
});
