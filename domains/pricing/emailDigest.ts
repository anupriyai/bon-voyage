import { and, eq, gte, lt, sql } from "drizzle-orm";
import { getDb, withActor, type Db } from "@/shared/lib/db";
import { user } from "@/domains/account/schema";
import { digestMessage, sendEmail } from "@/shared/lib/email";
import { emailDigests, priceAlerts } from "./db";
export async function sendDailyDigests(db: Db = getDb(), send = sendEmail, day = new Date(Date.now() - 86400000).toISOString().slice(0, 10)) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM || !process.env.BETTER_AUTH_URL) return { skipped: true, sent: 0 };
  const actor = { type: "system" as const, id: "price-digest" }; let sent = 0;
  const start = new Date(day + "T00:00:00Z"); const end = new Date(start.getTime() + 86400000);
  const owners = await db.select({ ownerId: priceAlerts.ownerId, email: user.email, count: sql<number>`count(*)::int` }).from(priceAlerts).innerJoin(user, eq(user.id, priceAlerts.ownerId)).where(and(gte(priceAlerts.createdAt, start), lt(priceAlerts.createdAt, end))).groupBy(priceAlerts.ownerId, user.email);
  for (const owner of owners) {
    const digest = await withActor(db, actor, async (tx) => {
      await tx.insert(emailDigests).values({ ownerId: owner.ownerId, day, status: "pending", payload: { to: owner.email, count: owner.count, appUrl: process.env.BETTER_AUTH_URL! } }).onConflictDoNothing();
      const [row] = await tx.select().from(emailDigests).where(and(eq(emailDigests.ownerId, owner.ownerId), eq(emailDigests.day, day))).for("update");
      return row;
    });
    // The immutable first payload and stable key make overlapping retries safe within Resend's 24h window.
    if (digest.status === "sent") continue;
    if (Date.now() - digest.createdAt.getTime() > 23 * 3600000) continue; // Manual reconciliation after expiry, never a blind resend.
    try {
      const id = await send({ to: digest.payload.to, ...digestMessage(digest.payload.count, digest.payload.appUrl), key: `price-digest/${digest.id}/${day}` });
      await withActor(db, actor, (tx) => tx.update(emailDigests).set({ status: "sent", providerId: id }).where(eq(emailDigests.id, digest.id))); sent++;
    } catch { /* The pending ledger remains for a safe same-key retry. */ }
  }
  return { skipped: false, sent };
}
