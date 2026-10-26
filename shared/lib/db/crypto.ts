// Encryption for health data at rest: AES-256-GCM, a fresh 12-byte IV per value, and the owning record bound in
// as associated data so a ciphertext copied onto another case fails to decrypt. Keys are versioned for rotation.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface Sealed {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyVersion: number;
}

export interface KeyRing {
  current: number;
  keys: Record<number, Buffer>;
}

const TAG_BYTES = 16;

function decodeKey(b64: string, name: string): Buffer {
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error(`${name} must be 32 bytes, base64 encoded (openssl rand -base64 32)`);
  return key;
}

/**
 * DATA_KEY (version DATA_KEY_VERSION, default 1) encrypts; older keys stay readable through
 * DATA_KEYS_OLD="1:base64,2:base64".
 */
export function loadKeyRing(env: Record<string, string | undefined> = process.env): KeyRing {
  if (!env.DATA_KEY) throw new Error("DATA_KEY is not set");
  const current = Number(env.DATA_KEY_VERSION ?? 1);
  const keys: Record<number, Buffer> = { [current]: decodeKey(env.DATA_KEY, "DATA_KEY") };
  for (const entry of (env.DATA_KEYS_OLD ?? "").split(",").filter(Boolean)) {
    const [version, b64] = entry.split(":");
    keys[Number(version)] = decodeKey(b64, `DATA_KEYS_OLD version ${version}`);
  }
  return { current, keys };
}

const aad = (context: string, keyVersion: number) => Buffer.from(`${context}|${keyVersion}`, "utf8");

/** `context` names the owning record, e.g. the case id. */
export function seal(plaintext: string, context: string, ring: KeyRing): Sealed {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ring.keys[ring.current], iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(aad(context, ring.current));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag(), keyVersion: ring.current };
}

export function open({ ciphertext, iv, authTag, keyVersion }: Sealed, context: string, ring: KeyRing): string {
  const key = ring.keys[keyVersion];
  if (!key) throw new Error(`No key for version ${keyVersion}`);
  // Node still accepts truncated tags; refuse them.
  if (authTag.length !== TAG_BYTES) throw new Error("Invalid authentication tag");
  const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(aad(context, keyVersion));
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
