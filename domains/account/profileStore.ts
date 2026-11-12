// Server-only account profile, consent and rights records.
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb, loadKeyRing, open, seal, withActor, type Actor, type Db, type KeyRing } from "@/shared/lib/db";
import { accountProfile, consentReceipt, dataRightsRequest, jurisdictionRelease, user } from "./db";
import { DataRequestInput, SaveProfileInput, type ProfileData, type ProfileView } from "./profile";

export class ProfileError extends Error { constructor(public code: string, public status: number) { super(code); } }
const context = (id: string) => `account-profile/${id}`;
const requireUser = (actor: Actor) => { if (actor.type !== "user" || !actor.id) throw new ProfileError("unauthorized", 401); return actor.id; };

export function createProfileStore(db: Db, ring: KeyRing) {
  async function load(actor: Actor): Promise<ProfileView> {
    const id = requireUser(actor);
    const [owner] = await db.select({ email: user.email, emailVerified: user.emailVerified }).from(user).where(eq(user.id, id));
    if (!owner) throw new ProfileError("not_found", 404);
    const [row] = await db.select().from(accountProfile).where(eq(accountProfile.userId, id));
    return { email: owner.email, emailVerified: owner.emailVerified, revision: row?.revision ?? 0,
      profile: row ? JSON.parse(open(row, context(id), ring)) as ProfileData : null };
  }
  async function save(actor: Actor, value: unknown): Promise<ProfileView> {
    const id = requireUser(actor); const input = SaveProfileInput.parse(value);
    if (!Intl.supportedValuesOf("timeZone").includes(input.profile.timeZone) && input.profile.timeZone !== "UTC") throw new ProfileError("invalid_time_zone", 400);
    await withActor(db, actor, async (tx) => {
      const [row] = await tx.select().from(accountProfile).where(eq(accountProfile.userId, id)).for("update");
      if ((row?.revision ?? 0) !== input.revision) throw new ProfileError("conflict", 409);
      const encrypted = seal(JSON.stringify(input.profile), context(id), ring);
      if (row) await tx.update(accountProfile).set({ ...encrypted, revision: row.revision + 1, updatedAt: new Date() }).where(eq(accountProfile.userId, id));
      else await tx.insert(accountProfile).values({ userId: id, ...encrypted });
    });
    return load(actor);
  }
  async function eligibility(actor: Actor) {
    const view = await load(actor);
    if (process.env.REAL_PATIENT_DATA_ENABLED !== "true" || !view.profile?.adultConfirmed || !view.emailVerified) return { active: false, reason: "review_pending" as const };
    const [release] = await db.select().from(jurisdictionRelease).where(and(eq(jurisdictionRelease.countryCode, view.profile.residenceCountry), eq(jurisdictionRelease.enabled, true), gt(jurisdictionRelease.expiresAt, new Date())));
    if (!release) return { active: false, reason: "region_unavailable" as const };
    const [consent] = await db.select().from(consentReceipt).where(and(eq(consentReceipt.userId, actor.id), eq(consentReceipt.countryCode, view.profile.residenceCountry), eq(consentReceipt.purpose, "health_intake"), eq(consentReceipt.documentVersion, release.policyVersion), isNull(consentReceipt.withdrawnAt))).orderBy(desc(consentReceipt.acceptedAt)).limit(1);
    return consent ? { active: true, policyVersion: release.policyVersion } as const : { active: false, reason: "consent_required" as const, policyVersion: release.policyVersion };
  }
  async function acceptHealthConsent(actor: Actor, documentVersion: string) {
    const id = requireUser(actor); const view = await load(actor);
    if (!view.emailVerified || !view.profile?.adultConfirmed || process.env.REAL_PATIENT_DATA_ENABLED !== "true") throw new ProfileError("review_pending", 403);
    const [release] = await db.select().from(jurisdictionRelease).where(and(eq(jurisdictionRelease.countryCode, view.profile.residenceCountry), eq(jurisdictionRelease.enabled, true), gt(jurisdictionRelease.expiresAt, new Date())));
    if (!release || release.policyVersion !== documentVersion) throw new ProfileError("region_unavailable", 403);
    const [receipt] = await withActor(db, actor, (tx) => tx.insert(consentReceipt).values({ id: randomUUID(), userId: id, countryCode: view.profile!.residenceCountry, purpose: "health_intake", documentVersion }).returning());
    return { id: receipt.id, acceptedAt: receipt.acceptedAt.toISOString(), documentVersion };
  }
  async function withdrawHealthConsent(actor: Actor) {
    const id = requireUser(actor);
    await withActor(db, actor, (tx) => tx.update(consentReceipt).set({ withdrawnAt: new Date() }).where(and(eq(consentReceipt.userId, id), eq(consentReceipt.purpose, "health_intake"), isNull(consentReceipt.withdrawnAt))));
  }
  async function requestData(actor: Actor, value: unknown) {
    const id = requireUser(actor); const { kind } = DataRequestInput.parse(value);
    const [row] = await withActor(db, actor, async (tx) => {
      const [pending] = await tx.select().from(dataRightsRequest).where(and(eq(dataRightsRequest.userId, id), eq(dataRightsRequest.kind, kind), eq(dataRightsRequest.status, "pending"), gt(dataRightsRequest.createdAt, new Date(Date.now() - 24 * 60 * 60_000)))).orderBy(desc(dataRightsRequest.createdAt)).limit(1);
      if (pending) return [pending];
      return tx.insert(dataRightsRequest).values({ userId: id, kind }).returning();
    });
    return { id: row.id, kind: row.kind, status: row.status, createdAt: row.createdAt.toISOString() };
  }
  async function listDataRequests(actor: Actor) {
    const id = requireUser(actor);
    return (await db.select().from(dataRightsRequest).where(eq(dataRightsRequest.userId, id)).orderBy(desc(dataRightsRequest.createdAt))).map((row) => ({ id: row.id, kind: row.kind, status: row.status, createdAt: row.createdAt.toISOString() }));
  }
  return { load, save, eligibility, acceptHealthConsent, withdrawHealthConsent, requestData, listDataRequests };
}
export const getProfileStore = () => createProfileStore(getDb(), loadKeyRing());
