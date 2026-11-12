export interface EmailMessage { to: string; subject: string; text: string; key: string }
export async function sendEmail(message: EmailMessage, fetcher: typeof fetch = fetch) {
  const apiKey = process.env.RESEND_API_KEY; const from = process.env.RESEND_FROM;
  if (!apiKey || !from) throw new Error("email_not_configured");
  const response = await fetcher("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": message.key }, body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }), signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("email_unavailable");
  const result = await response.json() as { id?: string };
  if (!result.id) throw new Error("email_unavailable"); return result.id;
}
export function digestMessage(count: number, appUrl: string) {
  return { subject: "Your Bon Voyage price updates", text: `You have ${count} new price ${count === 1 ? "update" : "updates"}. Sign in to review: ${new URL("/account", appUrl).toString()}` };
}
