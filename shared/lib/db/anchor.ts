import { sql } from "drizzle-orm";
import { getDb, type Db } from "./client";
import { claimJob } from "./jobLease";
import { authorizedJob } from "@/shared/lib/jobAuth";
import { privateJson } from "@/shared/lib/http";
import { sendEmail } from "@/shared/lib/email";
export interface AuditAnchor { at: string; checked: string; headHash: string | null; slot: string }
export async function verifyAndAnchor(db: Db, write: (anchor: AuditAnchor) => Promise<void>, slot = new Date().toISOString().slice(0, 10)) {
  const lease = await claimJob(db, "audit-anchor", slot, 50000);
  if (!lease) return { skipped: true };
  let completed = false;
  try {
    const result = await db.execute(sql`select checked, first_bad_id, head_hash from audit.verify()`);
    const row = result.rows[0] as { checked: string; first_bad_id: string | null; head_hash: string | null };
    if (row.first_bad_id) throw new Error("audit_verification_failed");
    await write({ at: new Date().toISOString(), checked: row.checked, headHash: row.head_hash, slot });
    completed = true; return { skipped: false, anchored: true };
  } finally { await lease.release(completed); }
}
export async function anchorHandler(request: Request) {
  if (!authorizedJob(request)) return privateJson({ error: "unauthorized" }, 401);
  const destination = process.env.AUDIT_ANCHOR_URL; const token = process.env.AUDIT_ANCHOR_TOKEN;
  if (!destination || !token || !destination.startsWith("https://")) return privateJson({ error: "anchor_not_configured" }, 503);
  try {
    return privateJson(await verifyAndAnchor(getDb(), async (anchor) => {
      const response = await fetch(destination, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": `audit-anchor/${anchor.slot}` }, body: JSON.stringify(anchor), signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error("anchor_delivery_failed");
    }));
  } catch {
    if (process.env.AUDIT_ALERT_EMAIL) {
      try { await sendEmail({ to: process.env.AUDIT_ALERT_EMAIL, subject: "Bon Voyage audit verification needs attention", text: "The scheduled audit verification or external anchor delivery failed. Follow the production runbook before processing further patient changes.", key: `audit-alert/${new Date().toISOString().slice(0, 10)}` }); } catch {}
    }
    return privateJson({ error: "audit_anchor_failed" }, 503);
  }
}
