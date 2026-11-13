// Money-changing writes use fetch once, with a durable local claim and no automatic retry.
import { z } from "zod/v4";
import { ProviderError, safeProviderError } from "./providerError";
export interface WriteResult { outcome: "created" | "checking" | "failed"; data?: unknown; code?: string }
export function createDuffelTransport(token: string, fetcher: typeof fetch = fetch, limiter?: { consume(): Promise<void>; observe(headers: Headers): Promise<void> }) {
  async function request(path: string, method = "GET", data?: unknown, attemptId?: string): Promise<{ status: number; data: unknown }> {
    const response = await fetcher(`https://api.duffel.com${path}`, { method, headers: { Authorization: `Bearer ${token}`, "Duffel-Version": "v2", Accept: "application/json", "Content-Type": "application/json", ...(attemptId ? { "x-client-correlation-id": attemptId } : {}) }, ...(data ? { body: JSON.stringify({ data }) } : {}), signal: AbortSignal.timeout(method === "GET" ? 20000 : 130000) });
    await limiter?.observe(response.headers);
    let body: unknown;
    try { body = await response.json(); } catch { body = null; }
    if (!response.ok && method === "GET") throw safeProviderError({ status: response.status });
    return { status: response.status, data: body };
  }
  return {
    async read(path: string) { await limiter?.consume(); return (await request(path)).data; },
    async write(path: string, data: unknown, attemptId: string): Promise<WriteResult> {
      try { await limiter?.consume(); } catch { return { outcome: "failed", code: "rate_limited" }; }
      try {
        const started = Date.now();
        let result = await request(path, "POST", data, attemptId);
        // Duffel documents 503 as not processed. Retry once, with the same claim/correlation,
        // only while a second 130s request still fits the route's 150s execution budget.
        if (result.status === 503 && Date.now() - started < 5000) {
          try { await limiter?.consume(); } catch { return { outcome: "failed", code: "rate_limited" }; }
          result = await request(path, "POST", data, attemptId);
        }
        if (result.status === 503) return { outcome: "failed", code: "provider_unavailable" };
        const body = result.data as { data?: { id?: string }; errors?: { code?: string }[] } | null;
        if (result.status === 201 && typeof body?.data?.id === "string") return { outcome: "created", data: body.data };
        if (result.status === 200 || result.status === 202 || result.status >= 500) return { outcome: "checking" };
        const safe = safeProviderError({ status: result.status, errors: body?.errors });
        return { outcome: "failed", code: safe.code };
      } catch { return { outcome: "checking" }; }
    },
  };
}
const time = z.iso.datetime({ offset: true }).nullable().optional();
export const OrderReceiptSchema = z.object({ id: z.string(), total_amount: z.string(), total_currency: z.string().regex(/^[A-Z]{3}$/), booking_reference: z.string().optional(), live_mode: z.boolean(), metadata: z.record(z.string(), z.string()).default({}), payment_status: z.object({ awaiting_payment: z.boolean(), paid_at: time, payment_required_by: time }), price_guarantee_expires_at: time, void_window_ends_at: time, cancellation: z.unknown().optional() });
export type OrderReceipt = z.infer<typeof OrderReceiptSchema>;
export function receiptStatus(order: OrderReceipt, now = Date.now()) {
  if (order.cancellation) return "cancelled";
  if (order.payment_status.paid_at) return "confirmed";
  const deadline = order.payment_status.payment_required_by;
  if (deadline && Date.parse(deadline) <= now) return "expired";
  if (order.payment_status.awaiting_payment && deadline) return "held";
  return "checking";
}
