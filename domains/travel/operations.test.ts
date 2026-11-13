// Only the disposable runner may execute this destructive integration setup.
import { fileURLToPath } from "node:url";
import { createHmac, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, loadKeyRing, withActor } from "@/shared/lib/db";
import { createCaseStore } from "@/domains/case/server";
import { initialState } from "@/domains/case";
import { findOptions } from "@/domains/pricing";
import { createSearchStore } from "./searchStore";
import { createMockProvider } from "./mockProvider";
import { createBookingStore } from "./bookingStore";
import { createOrderProvider } from "./orderProvider";
import { bookFlight, payHold, reconcileBooking } from "./booking";
import { createWatchStore } from "@/domains/pricing/watchStore";
import { runWatchJob } from "@/domains/pricing/watchJob";
import { createRateLimiter } from "@/domains/pricing/server";
import { verifyAndAnchor } from "@/shared/lib/db/anchor";
import { createStaysService } from "./stays";
import { createMockStaysProvider } from "./mockStaysProvider";
import { consumeRequestLimit } from "@/shared/lib/db/requestLimit";
import { duffelWebhook } from "./webhook";
const actor = { id: "ops-owner", type: "user" as const }; const other = { id: "ops-other", type: "user" as const };
const isolated = process.env.BON_VOYAGE_ISOLATED_TESTS === "1" && !!process.env.TEST_DATABASE_OWNER_URL;
describe.skipIf(!isolated)("travel operations (isolated database)", () => {
  let owner: ReturnType<typeof createDb>; let app: ReturnType<typeof createDb>;
  beforeAll(async () => {
    owner = createDb(process.env.TEST_DATABASE_OWNER_URL!, 2);
    await owner.db.execute(sql`drop schema if exists audit cascade; drop schema if exists drizzle cascade; drop schema public cascade; create schema public; grant usage on schema public to bv_app`);
    await migrate(owner.db, { migrationsFolder: fileURLToPath(new URL("../../shared/lib/db/migrations", import.meta.url)) });
    app = createDb(process.env.TEST_DATABASE_URL!, 5);
    await withActor(app.db, { type: "system", id: "ops-setup" }, (tx) => tx.execute(sql`insert into "user" (id, name, email) values ('ops-owner', 'Fake operator', 'ops@example.com'), ('ops-other', 'Fake other', 'other@example.com')`));
  });
  afterAll(async () => { await app?.pool.end(); await owner?.pool.end(); vi.unstubAllEnvs(); });
  async function setup() {
    const state = initialState(randomUUID()); const now = new Date(); const appointment = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    state.intake = { ...state.intake, age: "50", origin: "jordan", patientName: "FAKE OPS PATIENT", email: "ops@example.com" }; state.chosenId = "istanbul"; state.chosenAt = now.toISOString();
    state.travelSchedule = { appointment, treatmentDays: 7, recoveryDays: 14, passengers: 1, wheelchair: true, flexDays: 1 };
    const own = await createCaseStore(app.db, loadKeyRing()).saveCase(actor, { state, revision: null });
    const provider = createMockProvider(); const options = await findOptions(state, state.travelSchedule, provider); const fare = options.ranking.picks.cheapest!.trip.fares[0];
    const searchStore = createSearchStore(app.db); const q = { from: "AMM", to: "IST", out: fare.slices[0].segments[0].departAt.slice(0, 10), back: fare.slices[1].segments[0].departAt.slice(0, 10), passengers: [{ type: "adult" }] };
    // Integration setup bypasses the per-user search quota; service reserves are independently tested.
    const searchId = await withActor(app.db, actor, async (tx) => { const result = await tx.execute(sql`insert into searches (case_id, parameters, created_by) values (${state.id}, ${JSON.stringify({ ...q, requests: 1 })}::jsonb, ${actor.id}) returning id`); return result.rows[0].id as string; });
    await searchStore.snapshots(actor, state.id, searchId, [fare]);
    const store = createBookingStore(app.db); const orders = createOrderProvider();
    const deps = { provider: { ...provider, reprice: async () => ({ ...fare, holdable: true }) }, store, orders, hashSecret: "test-only-hmac" };
    const input = { caseId: state.id, searchId, offerId: fare.id, attemptId: randomUUID(), expectedAmount: fare.totalAmount, currency: fare.currency, type: "instant" as const, acceptedConditions: true as const, assistance: true, travelers: [{ givenName: "FAKE", familyName: "PATIENT", bornOn: "1980-01-01", title: "mr" as const, gender: "m" as const, email: "ops@example.com", phone: "+12025550123", document: { number: "FAKEPASSPORT123", issuingCountry: "US", expiresOn: "2035-01-01" } }] };
    return { state: own.state, fare, deps, input };
  }
  it("claims a booking once under simultaneous clicks and never stores document numbers", async () => {
    const { deps, input } = await setup(); const create = vi.spyOn(deps.orders, "create");
    const [a, b] = await Promise.all([bookFlight(actor, input, deps), bookFlight(actor, input, deps)]);
    expect(a.id).toBe(b.id); expect(create).toHaveBeenCalledTimes(1); expect((await deps.store.owned(actor, a.id)).status).toBe("confirmed");
    await expect(deps.store.owned(other, a.id)).rejects.toMatchObject({ status: 404 });
    await expect(bookFlight(actor, { ...input, attemptId: randomUUID() }, deps)).rejects.toMatchObject({ code: "booking_exists" });
    const raw = JSON.stringify((await app.db.execute(sql`select * from bookings`)).rows); const log = JSON.stringify((await app.db.execute(sql`select changed from audit.log`)).rows);
    expect(raw).not.toContain("FAKEPASSPORT123"); expect(log).not.toContain("FAKEPASSPORT123"); expect(raw).not.toContain("PATIENT");
    await deps.store.update(actor, a.id, { status: "held", paidAt: null }); expect((await deps.store.owned(actor, a.id)).paidAt).not.toBeNull();
  });
  it("pays a hold once and keeps manual cancellation requests across a refresh", async () => {
    const { deps, input } = await setup(); const booking = await bookFlight(actor, { ...input, type: "hold" }, deps); expect(booking.status).toBe("held");
    const pay = vi.spyOn(deps.orders, "pay"); const paymentId = randomUUID();
    await Promise.all([payHold(actor, booking, Number(booking.total), booking.currency, paymentId, deps), payHold(actor, booking, Number(booking.total), booking.currency, paymentId, deps)]);
    expect(pay).toHaveBeenCalledTimes(1); const paid = await deps.store.owned(actor, booking.id); expect(paid.status).toBe("confirmed");
    const requested = await deps.store.update(actor, paid.id, { status: "cancel_requested" }, "manual_cancellation");
    expect((await reconcileBooking(actor, requested, deps)).status).toBe("cancel_requested");
  });
  it("allows a fresh hold payment after a definite not-processed failure", async () => {
    const { deps, input } = await setup(); const booking = await bookFlight(actor, { ...input, type: "hold" }, deps);
    const pay = vi.spyOn(deps.orders, "pay").mockResolvedValueOnce({ outcome: "failed" });
    const failed = await payHold(actor, booking, Number(booking.total), booking.currency, randomUUID(), deps);
    expect(failed.status).toBe("held"); expect(failed.paymentAttemptId).toBeNull();
    expect((await payHold(actor, failed, Number(booking.total), booking.currency, randomUUID(), deps)).status).toBe("confirmed"); expect(pay).toHaveBeenCalledTimes(2);
  });
  it("does not resubmit an ambiguous order and reconciles the same durable attempt", async () => {
    const { deps, input } = await setup(); const create = vi.spyOn(deps.orders, "create").mockResolvedValue({ outcome: "checking" });
    const first = await bookFlight(actor, input, deps); const retry = await bookFlight(actor, input, deps);
    expect(first.status).toBe("checking"); expect(retry.id).toBe(first.id); expect(create).toHaveBeenCalledTimes(1);
    deps.orders.reconcile = async () => ({ id: "mock_late_order", live_mode: false, total_amount: first.total, total_currency: first.currency, metadata: { attempt_id: first.attemptId }, payment_status: { awaiting_payment: false, paid_at: new Date().toISOString() } });
    expect((await reconcileBooking(actor, first, deps)).status).toBe("confirmed");
  });
  it("deduplicates authenticated webhooks transactionally and rejects changed signatures", async () => {
    const { deps, input } = await setup(); const claim = await deps.store.claim(actor, { caseId: input.caseId, attemptId: input.attemptId, provider: "duffel", offerId: input.offerId, bookingType: "instant", status: "checking", total: "100.00", currency: "USD", bookedBy: actor.id, requestHash: "fake-hash" });
    vi.stubEnv("DUFFEL_WEBHOOK_SECRET", "webhook-test-secret"); vi.stubEnv("DUFFEL_ACCESS_TOKEN", "duffel_test_fake");
    const event = { id: "event-1", type: "order.created", idempotency_key: "order-created-1", live_mode: false, data: { object: { id: "ord_test", total_amount: "100.00", total_currency: "USD", live_mode: false, metadata: { attempt_id: input.attemptId }, payment_status: { awaiting_payment: false, paid_at: new Date().toISOString() } } } };
    const raw = JSON.stringify(event); const t = String(Math.floor(Date.now() / 1000)); const sig = createHmac("sha256", "webhook-test-secret").update(t + "." + raw).digest("hex");
    const request = () => new Request("https://example.test/api/webhooks/duffel", { method: "POST", headers: { "x-duffel-signature": `t=${t},v1=${sig}` }, body: raw });
    expect((await duffelWebhook(request())).status).toBe(200); expect((await (await duffelWebhook(request())).json()).duplicate).toBe(true);
    expect((await deps.store.owned(actor, claim.booking.id)).status).toBe("confirmed"); vi.unstubAllEnvs();
  });
  it("overlapping watch runs create one alert and repeat schedule slots are skipped", async () => {
    const { state, input } = await setup(); const watches = createWatchStore(app.db);
    await watches.create(actor, state.id, input.searchId, input.offerId);
    const slot = "test-slot-" + randomUUID(); const provider = createMockProvider({ priceFactor: 0.4 });
    const results = await Promise.all([runWatchJob({ db: app.db, provider, slot }), runWatchJob({ db: app.db, provider, slot })]);
    expect(results.filter((r) => r.skipped)).toHaveLength(1); const alerts = (await watches.list(actor, state.id)).alerts; expect(alerts).toHaveLength(1);
    expect((await runWatchJob({ db: app.db, provider, slot })).skipped).toBe(true); await expect(watches.list(other, state.id)).rejects.toMatchObject({ status: 404 });
  });
  it("coordinates quota across processes and reserves interactive headroom", async () => {
    const background = createRateLimiter(app.db, "fake-shared-token", "background");
    const attempts = await Promise.allSettled(Array.from({ length: 10 }, () => background.consume())); expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(6);
    const interactive = createRateLimiter(app.db, "fake-shared-token", "interactive"); await Promise.all(Array.from({ length: 4 }, () => interactive.consume())); await expect(interactive.consume()).rejects.toMatchObject({ status: 429 });
  });
  it("books a quoted accessible stay once, protects owners and preserves extra property fees", async () => {
    const { state } = await setup();
    const provider = createMockStaysProvider(); const service = createStaysService(app.db, provider);
    const search = await service.search(actor, { caseId: state.id, checkIn: state.travelSchedule!.appointment, checkOut: new Date(Date.parse(state.travelSchedule!.appointment) + 7 * 86400000).toISOString().slice(0, 10), rooms: 1, guests: 1, radiusKm: 5 });
    expect(search.results).toHaveLength(1);
    await expect(service.quote(other, state.id, search.searchId, search.results[0].resultId)).rejects.toMatchObject({ status: 404 });
    const quote = await service.quote(actor, state.id, search.searchId, search.results[0].resultId);
    const originalQuote = provider.getQuote.bind(provider);
    provider.getQuote = async (id) => ({ ...await originalQuote(id), mobility: null });
    const invalid = { caseId: state.id, localQuoteId: quote.localQuoteId, attemptId: randomUUID(), expectedAmount: quote.amount, currency: quote.currency, expectedDue: quote.dueAtAccommodation, dueCurrency: quote.dueCurrency, acceptedConditions: true, email: "ops@example.com", phone: "+12025550123", guests: [{ givenName: "Fake", familyName: "Guest" }] };
    await expect(service.book(actor, invalid)).rejects.toMatchObject({ code: "stay_suitability_changed" });
    provider.getQuote = originalQuote;
    const input = { caseId: state.id, localQuoteId: quote.localQuoteId, attemptId: randomUUID(), expectedAmount: quote.amount, currency: quote.currency, expectedDue: quote.dueAtAccommodation, dueCurrency: quote.dueCurrency, acceptedConditions: true, email: "ops@example.com", phone: "+12025550123", guests: [{ givenName: "Fake", familyName: "Guest" }] };
    const book = vi.spyOn(provider, "book"); const [a, b] = await Promise.all([service.book(actor, input), service.book(actor, input)]);
    expect(a.id).toBe(b.id); expect(book).toHaveBeenCalledTimes(1); expect((await service.list(actor, state.id))[0].status).toBe("confirmed");
    expect(a.details.dueAtAccommodation).toBe(quote.dueAtAccommodation);
    await expect(service.book(actor, { ...input, attemptId: randomUUID(), expectedAmount: quote.amount + 1 })).rejects.toMatchObject({ status: 409 });
  });
  it("enforces auth request limits atomically without storing raw IPs", async () => {
    const attempts = await Promise.all(Array.from({ length: 8 }, () => consumeRequestLimit(app.db, "fake-auth-hmac", { window: 60, max: 3 })));
    expect(attempts.filter((r) => r.allowed)).toHaveLength(3);
    expect(attempts.filter((r) => !r.allowed).every((r) => Number(r.retryAfter) > 0)).toBe(true);
  });
  it("anchors only a verified audit head and deduplicates schedule slots", async () => {
    const write = vi.fn(async () => {}); const slot = "anchor-" + randomUUID();
    await verifyAndAnchor(app.db, write, slot); await verifyAndAnchor(app.db, write, slot); expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ checked: expect.any(String), headHash: expect.any(String) }));
    expect((await app.db.execute(sql`select * from audit.verify()`)).rows[0]).toMatchObject({ first_bad_id: null });
  });
});
