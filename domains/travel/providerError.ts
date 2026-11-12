import { HttpError } from "@/shared/lib/http";
export type ProviderCode = "rate_limited" | "offer_gone" | "price_changed" | "insufficient_balance" | "provider_unavailable" | "provider_not_configured" | "live_mode_disabled";
export class ProviderError extends HttpError {
  constructor(code: ProviderCode, status = 503) { super(status, code); }
}
export function safeProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  const e = error as { status?: number; meta?: { status?: number }; errors?: { code?: string }[] };
  const status = e?.status ?? e?.meta?.status;
  const codes = e?.errors?.map((e) => e.code) ?? [];
  if (status === 429) return new ProviderError("rate_limited", 429);
  if (status === 404 || codes.some((c) => c === "offer_no_longer_available" || c === "not_found")) return new ProviderError("offer_gone", 410);
  if (codes.includes("insufficient_balance")) return new ProviderError("insufficient_balance", 409);
  if (codes.includes("price_changed")) return new ProviderError("price_changed", 409);
  return new ProviderError("provider_unavailable");
}
