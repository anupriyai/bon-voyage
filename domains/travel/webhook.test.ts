import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyDuffelSignature } from "./webhook";
describe("Duffel webhook authenticity", () => {
  it("uses the literal secret and exact bytes, rejects stale or changed bodies", () => {
    const body = new TextEncoder().encode('{"id":"fake"}');
    const now = 1800000000000; const t = String(now / 1000);
    const secret = "literal-secret==";
    const signature = createHmac("sha256", secret).update(t + ".").update(body).digest("hex");
    expect(verifyDuffelSignature(body, `t=${t},v1=${signature}`, secret, now)).toBe(true);
    expect(verifyDuffelSignature(new TextEncoder().encode("changed"), `t=${t},v1=${signature}`, secret, now)).toBe(false);
    expect(verifyDuffelSignature(body, `t=${t},v1=${signature}`, secret, now + 301000)).toBe(false);
    expect(verifyDuffelSignature(body, `t=${t},v1=bad`, secret, now)).toBe(false);
  });
});
