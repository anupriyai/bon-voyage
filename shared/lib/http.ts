export class HttpError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

/** Browsers send Origin for mutations. Cookie-authenticated APIs refuse cross-site requests. */
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const target = new URL(request.url);
  // Next may normalize loopback URLs to localhost. Host preserves the browser's actual authority.
  // Do not trust forwarded-host: callers can supply it unless a deployment explicitly strips it.
  const host = request.headers.get("host");
  const expected = host ? `${target.protocol}//${host}` : target.origin;
  if ((origin && origin !== expected) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new HttpError(403, "cross_site_request");
  }
}

/** Bound the actual streamed body, not only the untrusted Content-Length header. */
export async function readJson(request: Request, maxBytes = 256_000): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new HttpError(415, "expected_json");
  if (Number(request.headers.get("content-length")) > maxBytes) throw new HttpError(413, "body_too_large");
  if (!request.body) throw new HttpError(400, "invalid_request");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maxBytes) { await reader.cancel(); throw new HttpError(413, "body_too_large"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "invalid_request");
  } finally { reader.releaseLock(); }
}

export function privateJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" } });
}
