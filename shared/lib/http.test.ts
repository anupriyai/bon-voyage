import { describe, expect, it } from "vitest";
import { requireSameOrigin } from "./http";
describe("cookie-authenticated same-origin writes", () => {
  it("uses the external Host when Next normalizes a loopback request URL", () => {
    expect(() => requireSameOrigin(new Request("http://localhost:3000/api/case", { headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" } }))).not.toThrow();
  });
  it("rejects foreign, null and malformed origins, even with a forged forwarded host", () => {
    for (const origin of ["https://other.test", "null", "not-a-url"]) {
      expect(() => requireSameOrigin(new Request("https://example.test/api/case", { headers: { host: "example.test", origin, "x-forwarded-host": "other.test" } }))).toThrow("cross_site_request");
    }
    expect(() => requireSameOrigin(new Request("https://example.test/api/case", { headers: { "sec-fetch-site": "cross-site" } }))).toThrow("cross_site_request");
  });
});
