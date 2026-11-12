import { afterEach, describe, expect, it, vi } from "vitest";
import { digestMessage, sendEmail } from "./email";
afterEach(() => vi.unstubAllEnvs());
describe("production email boundaries", () => {
  it("fails before network I/O without a configured sender", async () => { vi.stubEnv("RESEND_API_KEY", ""); const fetcher = vi.fn(); await expect(sendEmail({ to: "fake@example.com", subject: "Test", text: "Test", key: "test" }, fetcher)).rejects.toThrow("email_not_configured"); expect(fetcher).not.toHaveBeenCalled(); });
  it("sends a stable idempotency key and a digest with no case or patient detail", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-only"); vi.stubEnv("RESEND_FROM", "test@example.com");
    const fetcher = vi.fn(async () => Response.json({ id: "email_test" }));
    const content = digestMessage(2, "https://example.com");
    await sendEmail({ to: "fake@example.com", key: "digest/test", ...content }, fetcher);
    expect(fetcher).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ headers: expect.objectContaining({ "Idempotency-Key": "digest/test" }) }));
    expect(content.text).toBe("You have 2 new price updates. Sign in to review: https://example.com/account");
  });
});
