import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { loadKeyRing, open, seal } from "@/shared/lib/db/crypto";

const k1 = randomBytes(32).toString("base64");
const k2 = randomBytes(32).toString("base64");

describe("health data encryption", () => {
  const ring = loadKeyRing({ DATA_KEY: k1 });

  it("round-trips text, including Arabic", () => {
    const sealed = seal("Stage 3 colon cancer · سرطان القولون", "case-1", ring);
    expect(open(sealed, "case-1", ring)).toBe("Stage 3 colon cancer · سرطان القولون");
  });

  it("never reuses an IV and never stores plaintext", () => {
    const a = seal("same", "case-1", ring);
    const b = seal("same", "case-1", ring);
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.ciphertext.toString("utf8")).not.toContain("same");
  });

  it("fails if the ciphertext is moved to another case", () => {
    const sealed = seal("secret", "case-1", ring);
    expect(() => open(sealed, "case-2", ring)).toThrow();
  });

  it("fails if the ciphertext was altered", () => {
    const sealed = seal("secret", "case-1", ring);
    sealed.ciphertext[0] ^= 1;
    expect(() => open(sealed, "case-1", ring)).toThrow();
  });

  it("rejects a truncated authentication tag", () => {
    const sealed = seal("secret", "case-1", ring);
    expect(() => open({ ...sealed, authTag: sealed.authTag.subarray(0, 4) }, "case-1", ring)).toThrow("Invalid authentication tag");
  });

  it("reads data sealed with an older key after rotation", () => {
    const old = seal("secret", "case-1", loadKeyRing({ DATA_KEY: k1 }));
    const rotated = loadKeyRing({ DATA_KEY: k2, DATA_KEY_VERSION: "2", DATA_KEYS_OLD: `1:${k1}` });
    expect(open(old, "case-1", rotated)).toBe("secret");
    expect(seal("new", "case-1", rotated).keyVersion).toBe(2);
  });

  it("refuses a key of the wrong length", () => {
    expect(() => loadKeyRing({ DATA_KEY: randomBytes(16).toString("base64") })).toThrow("32 bytes");
    expect(() => loadKeyRing({})).toThrow("DATA_KEY is not set");
  });
});
