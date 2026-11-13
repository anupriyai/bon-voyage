import { afterEach, describe, expect, it, vi } from "vitest";
import { canIndexPublicContent, publicMetadata, siteOrigin } from "./siteMetadata";

afterEach(() => vi.unstubAllEnvs());
describe("public catalogue indexing", () => {
  it("keeps malformed, credentialed and local origins out of indexing", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const origin of ["https://", "https://localhost", "https://127.0.0.1", "https://[::1]", "https://user:password@example.com"]) {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", origin); expect(canIndexPublicContent()).toBe(false);
    }
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://"); expect(siteOrigin()).toBe("http://localhost:3000");
  });
  it("requires both a configured production origin and substantive content", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://care.example.com");
    expect(canIndexPublicContent()).toBe(true);
    expect(publicMetadata("Sample", "Sample care", "/explore").robots).toEqual({ index: false, follow: true });
    expect(publicMetadata("Directory", "Browse", "/destinations", true).robots).toEqual({ index: true, follow: true });
    vi.stubEnv("NODE_ENV", "development"); expect(canIndexPublicContent()).toBe(false);
  });
});
