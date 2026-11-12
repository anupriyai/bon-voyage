import { describe, expect, it } from "vitest";
import { allowance, parseRateHeaders } from "./rateLimiter";
import { authorizedJob } from "@/shared/lib/jobAuth";
describe("shared provider quota and job auth", () => {
  it("keeps four interactive requests in reserve", () => { expect(allowance(4, "background")).toBe(false); expect(allowance(4, "interactive")).toBe(true); expect(allowance(0, "interactive")).toBe(false); });
  it("parses HTTP-date reset headers rather than treating them as epoch seconds", () => { expect(parseRateHeaders(new Headers({ "ratelimit-limit": "10", "ratelimit-remaining": "4", "ratelimit-reset": "Tue, 03 Nov 2026 20:00:00 GMT" }))?.resetAt.toISOString()).toBe("2026-11-03T20:00:00.000Z"); expect(parseRateHeaders(new Headers())).toBeNull(); });
  it("fails closed for missing, wrong or absent cron secrets", () => { const req = new Request("https://example.test", { headers: { authorization: "Bearer abc" } }); expect(authorizedJob(req, "abc")).toBe(true); expect(authorizedJob(req, "abcd")).toBe(false); expect(authorizedJob(req, "")).toBe(false); });
});
