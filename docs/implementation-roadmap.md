# Implementation roadmap: remaining phases

Status: 2026-10-26 · branch `test-branch`
Companion to [booking-pricing-ai-design.md](booking-pricing-ai-design.md), which holds the design decisions and verified facts. This file says what to build next, in order, how to know each step is done, and what you must do yourself.

## Where things stand

| Done | Notes |
|---|---|
| Phase 1: AI port | Qwen (Ollama) or Claude, opt-in, scripted fallback |
| Phase 2: database, audit, encryption, sign-in | Postgres 18; `withActor`; hash-chained audit log; AES-GCM; Better Auth magic links |
| Pricing model | Date window, ranking, price watch rules, widen planner, one-round-trip search, mock flights |
| Launcher and tooling | `npm run launch` / `launch:status` / `launch:stop` |

Not built yet: the screens still keep a case in the browser only (nothing is saved to Postgres), there is no flight search screen, no real flights, no booking, no price watch job, no email, and the audit anchoring job is missing.

## How every phase works

1. Write the failing test first, run it, then write the code (`npm test`).
2. Keep to the domain rules in `CLAUDE.md`: domain code in `domains/<name>`, routes thin, writes through `withActor`, no network calls inside `withActor`.
3. Done means: `npm test` and `npm run build` pass, the feature works in the browser with the mock provider, and `docs/booking-pricing-ai-design.md` and `CLAUDE.md` are updated.
4. Start services with `npm run launch`; stop them with `q` in the panel or `npm run launch:stop`.
5. Nothing is committed unless you ask.

## Order at a glance

| # | Phase | Needs from you | Size |
|---|---|---|---|
| 3 | Save cases in the database and sign-in screens | nothing | M |
| 4 | Flight search screen on the mock provider | nothing | M |
| 5 | Duffel search (real fares) | Duffel read-write **test** token | M |
| 6 | Booking | nothing beyond phase 5 | L |
| 7 | Price watch, rate limiter, alerts | Resend account for email | L |
| 8 | Audit anchoring and production hardening | Neon, Vercel Pro, Resend domain | M |
| 9 | Go live with Claude and real money | Anthropic key, Duffel live access, legal advice | M |
| 10 | Stays (lodging) | Duffel Stays access | M |

Phases 3 and 4 need nothing from you, so they can start immediately. Phase 10 can run in parallel with 7 once access is granted.

---

## Phase 3: Save cases in the database, sign-in screens

**Why:** today a patient's case lives in the browser, so nothing is audited and nothing survives a cleared cache. This is the base the booking and price-watch phases write to.

**Build**
1. `domains/case/db.ts`: add `searches` (case, parameters as JSON, created by) and `fare_snapshots` (search, provider, offer id, slices, total, currency, fetched at, expires at; insert only). Add an audit trigger to `searches` in a new migration (`npm run db:generate -- --custom --name=searches_audit`). Do not audit `fare_snapshots` (high volume, no personal data).
2. `domains/case/model/` + a server module `domains/case/store.ts`: `saveCase`, `loadCase`, `saveClinical` (uses `seal`/`open` with the case id as context), `addTraveler`. All writes use `withActor`. Server-only: never re-export through `domains/case/index.ts` (browser-safe surface).
3. API routes (thin): `app/api/case/route.ts` (GET own case, PUT update). Every route resolves `actorFrom(request.headers)` and returns 401 when signed out; a user may only read and write their own case.
4. Wire the existing intake flow so that after sign-in the case autosaves (debounced) and reloads on any device. Keep the browser state as the working copy and the database as the source of truth.
5. Sign-in screens: make `/login` request a magic link (`authClient.signIn.magicLink`), and show the account screen with the signed-in user. In development the link prints in the server console.
6. `proxy.ts` in the project root: only an optimistic redirect for signed-out visitors to `/case/*` (check the session cookie). Real authorization stays in each route (Next 16 docs say Proxy is not an authorization layer).

**Tests:** a user cannot read or write another user's case; clinical details are never stored in plain text (read the raw column); autosave writes appear in `audit.log` attributed to the user, with names redacted; `npm run audit:verify` stays clean.

**Done when:** you can sign in, fill in the intake, close the browser, sign in again, and see the same case; the audit log shows each save; the clinical text is unreadable in `psql`.

**You:** nothing.

---

## Phase 4: Flight search screen on the mock provider

**Why:** the design canvas has a Search screen and the app has none. Building it on the mock proves the whole pricing flow before spending Duffel quota.

**Build**
1. `domains/travel/` + `domains/pricing/`: a server function `findOptions(case)` in `domains/pricing/` that reads the case (origin, hospital, appointment, treatment and recovery days, travellers, stage and wheelchair need), builds the date window, calls `searchTrips`, ranks with `profileFor(...)`, and returns the three picks, the rejected trips with reasons, and the price calendar. A provider factory picks the mock when `DUFFEL_ACCESS_TOKEN` is unset.
2. Airport mapping: a table from the origin cities and hospitals in `domains/case/data` to IATA codes (AMM, RUH, JED, DXB, BEY, CAI, IST, BER…). Alternate airports come from `domains/travel/alternates.ts`.
3. Route: `app/api/travel/search/route.ts` (POST, signed in, rate-limited per user). It saves a `searches` row and the returned fares to `fare_snapshots`.
4. Screen: `app/case/flights/page.tsx` composing a `domains/travel/components` view with three cards (*Cheapest*, *Easiest*, *Best balance*, each with its plain-language reason), a price calendar, a "Widen search" button (uses `planWiden` with a small request budget and shows how many extra searches it ran), refund/change conditions on each fare, and a clear "sample fares" label while the mock is active.
5. Add the screen to the journey bar between Options and Plan, and show the chosen flight total in the Plan cost lines (replacing the sample "Flights and local transport" number, keeping the local-transport part).

**Tests:** rejected trips show their reason; the calendar never shows an invalid day; widen never exceeds its budget; the screen is labelled as samples with the mock.

**Done when:** from a saved case you can search, see three explained picks and the calendar, widen once, and choose a fare that flows into the plan total.

**You:** review the alternate-airport list (`domains/travel/alternates.ts`) and the default flexibility (±1 day recommended to save requests).

---

## Phase 5: Duffel search (real fares)

**Build**
1. Install `@duffel/api@4.31.0`. Create `domains/travel/duffelProvider.ts`, the only file that imports it (it needs the Node runtime). Implement `searchReturn` as one offer request with two slices, `max_connections: 1`, `supplier_timeout: 10000`, then list offers sorted by total. Map to `Fare`: holdable = not `requires_instant_payment`, carry refund/change conditions, the void window, the operating carrier and `expires_at`.
2. `searchOneWay` (fallback only) and `reprice` (`offers.get`; "offer no longer available" returns `null`).
3. Currency: fares arrive in the organisation's billing currency. Rank in that currency; add a fixed USD rate table only for the dollar penalties, clearly labelled.
4. Cache searches by route, dates, passengers, cabin and connections, with TTL `min(15 minutes, earliest offer expiry)`. Never book from the cache.
5. Typed errors for the UI: rate limit, offer gone, price changed, insufficient balance. Never show a raw Duffel message.
6. Run the shared contract tests against the mock always, and against Duffel when the token starts with `duffel_test_`.

**Tests:** fixtures recorded from test mode (no live calls in CI); the Duffel test airline returns offers; expired offer handling.

**Done when:** with the token set, the Flights screen shows real test-mode offers instead of the mock and says so.

**You**
1. Create a **read-write test** token at https://app.duffel.com (Developers) and add `DUFFEL_ACCESS_TOKEN=duffel_test_...` to `.env.local`.
2. In the dashboard, request access to RJ, SV, MS, ME, TK, EK, FZ and EY.
3. Email help@duffel.com: higher live search quota; hold availability on the Travelport carriers; whether `IST` and `DXB` city codes include SAW and DWC; USD billing; the 1% vs 0.5% fee.
4. Run one search and note the `ratelimit-limit` header, then tell me the number so the spec can be corrected.

---

## Phase 6: Booking

**Build**
1. `bookings` table (case, provider, order id, type instant or hold, status, total, currency, pay-by, booked by, attempt id) with an audit trigger. `booking_attempts` is not needed: the attempt id lives on `bookings`.
2. `domains/travel/booking.ts` and `app/api/travel/book/route.ts` (`maxDuration = 150`). Flow: validate travellers with zod (Latin-script names as on the passport, combined length at most 40, title, gender, email, phone; children by age; under-2s with a carrying adult; at most 9), `reprice` the chosen offer, show the new price if it changed and require a fresh confirmation, create the order, store the booking.
3. Writes (order, payment) go through a thin `fetch` wrapper, not the SDK: 130-second timeout, an `x-client-correlation-id` equal to the attempt id, never auto-retry except on a 503.
4. On a 500, 202 or timeout: mark the booking `checking`, reconcile with `GET /air/orders?offer_id=` and the `order.created` webhook, and show "checking your booking". Add `app/api/webhooks/duffel/route.ts`: verify `X-Duffel-Signature` (HMAC-SHA256 over `t.rawBody`, constant-time compare), dedupe on the event's idempotency key, handle schedule changes by flagging the booking.
5. Holds: allowed only when the offer is holdable. Show the pay-by deadline, re-GET the order before paying, pay with the order's current total.
6. After booking, create a task for the coordinator: request wheelchair or other assistance from the airline (usually 48 hours before departure) with the booking reference. Show it on the dashboard.
7. Cancellation: show refund and change conditions before booking, prefer refundable fares, surface the void window as a free-cancel period, and give coordinators a "manual cancellation through Duffel support" action that records the request.
8. Passport and document numbers go straight to Duffel in the order request and are never stored.

**Tests:** price change forces reconfirmation; a timeout never double-books (simulate with the mock); webhook signature failure is rejected; the audit log shows who booked.

**Done when:** in test mode you can book an instant order and a hold, see them on the dashboard, and an interrupted booking resolves to the correct state.

**You:** top up the test balance if needed; confirm which airlines you want to prefer.

---

## Phase 7: Price watch, rate limiter, alerts

**Build**
1. Tables: `price_watches` (search, baseline, lowest, thresholds, active, last checked), `price_alerts`, `job_lock` (lease row), and `rate_limit` (one row per token hash). Audit the watches and alerts.
2. Rate limiter in `domains/pricing/`: one app-wide limiter whose state lives in the `rate_limit` row, updated from the `ratelimit-*` response headers, with a reserve kept for patients' interactive searches. The cron job may only spend what is above the reserve.
3. `app/api/price-watch/run/route.ts`: a `GET`, `Authorization: Bearer CRON_SECRET` compared in constant time, 401 if the secret is unset, `maxDuration = 300`. Claim the lease row, process watches in batches ordered by `last_checked_at`, stop with margin before the time limit, idempotent per schedule slot. Each re-check is 1 to 3 requests: the watched round trip, plus one day either side only when the price moved. Actor is `system`.
4. Use `checkWatch` for baseline and drop logic; compare round trips with round trips only.
5. `vercel.json` cron: `0 6 * * *` UTC for testing, `0 */6 * * *` on Pro.
6. Alerts: an in-app alert list on the dashboard first. Then one daily email digest per caregiver through Resend with no health details. WhatsApp (Twilio) is a later add-on.
7. Local testing: `npm run price-watch` runs the route's logic once against the mock, with prices that move.

**Tests:** overlapping runs do not double-process; the reserve is respected; a slow decline alerts once it adds up; the digest contains no health data.

**Done when:** a saved search produces an in-app alert when the mock price drops enough, and the job is safe to run twice at once.

**You:** create a Resend account and verify your sending domain (https://resend.com); put `RESEND_API_KEY` in `.env.local`. Free tier is 100 emails a day, shared with sign-in emails; consider the $20 plan before launch.

---

## Phase 8: Audit anchoring and production hardening

**Build**
1. Anchoring job: a scheduled run that calls `audit.verify()`, writes the head hash and time to an external append-only store (for example an object-lock bucket, or a repository file committed by CI), and alerts when verification fails. Without it, someone with the owner role could rewrite history; this is required before real patient data.
2. Real email for sign-in through Resend (the app currently refuses to send in production).
3. Neon (PostgreSQL 18): create the project, then as `neondb_owner` create `bv_owner` and `bv_app`, grant CREATE on the database and on schema `public` to `bv_owner`, and set `lock_timeout` and `statement_timeout` on `bv_app`. `DATABASE_OWNER_URL` is the direct host, `DATABASE_URL` the pooled (`-pooler`) host. On a Neon branch, verify that `bv_app` can log in through the pooler and that `set_config(..., true)` and the advisory lock work through it (the spec lists this as unverified). Use the `pg` pool everywhere, never the Neon HTTP driver.
4. Vercel **Pro** with Fluid compute; install `@vercel/functions` and call `attachDatabasePool`. Set all env vars in Production; crons run on the production deployment only.
5. Backups and restore test; key rotation drill (`DATA_KEY_VERSION`, `DATA_KEYS_OLD`); a runbook for a failed audit verification.
6. Logging check: nothing in logs contains story text, names, emails or tokens.
7. Rate limiting and abuse protection on the auth and search routes.

**Done when:** the app runs on Vercel and Neon from a preview deployment, `audit:verify` passes there, an anchor is written daily, and a restore from backup is rehearsed.

**You:** Neon account, Vercel Pro, domain and DNS for Resend, and an external place for anchors.

---

## Phase 9: Go live with Claude and real money

**Build and do**
1. Claude: set `AI_PROVIDER=claude` and `ANTHROPIC_API_KEY` in production only. Measure latency (target under 20 seconds for extraction) and quality against the Qwen results on the same sample stories; consider Haiku 5.5 only after that evaluation. Before using real stories, read Anthropic's data-retention terms and decide what the consent screen says.
2. Duffel live: add a billing card, top up the balance by bank transfer, request carrier access that live mode needs, swap the test token for the live one, and run one real booking with a small fare you control.
3. Legal: get advice on seller-of-travel rules, on selling UK/US point-of-sale fares to residents of Jordan, Saudi Arabia, the UAE, Lebanon and Egypt, and on health-data handling (the system follows HIPAA and GDPR style practices but is not certified). Do this before any real patient uses it.
4. Cancellation and change process documented for coordinators, including what the family is told.
5. Add the real fees to the cost model (`$3` per order, `1%`, `$2` per extra, `2%` FX).

**Done when:** a real, small booking completes end to end and legal has signed off on the flows.

**You:** everything in this phase, mostly decisions and accounts.

---

## Phase 10: Stays (lodging)

**Build**
1. `domains/travel/staysProvider.ts` behind a `StayProvider` interface with a mock first. Search by location and radius (kilometres, 1 to 100), filter on the mobility accessibility amenity, and pass accessibility needs as special requests.
2. Bookings can return 200 or 202: same no-retry and reconcile rules as flights (`stays.booking.created` webhook). Show the amount due at the accommodation separately. Maximum 99 nights per booking: split longer stays or route them to a coordinator.
3. Rank stays like flights: hard rules (accessibility, distance to the hospital), then a score. Add the stay to the plan total and the journey.

**You:** request Stays access in the Duffel dashboard now; approval time is unknown.

---

## Later, outside this plan

These map to the strategic bets and are not scheduled: medical record sharing and consent (`records`), the hospital and specialist directory with credentials (`providers`), insurer and cross-border payment guidance (`pricing`), WhatsApp alerts, Arabic and other languages in the UI. Each needs its own design pass first.

## Risks to keep watching

- **Duffel quota** is about 10 searches a minute for everyone; a launch needs a higher limit.
- **Offers expire** in about 30 minutes; never book from a stale search.
- **Treatment dates change:** prefer refundable or holdable fares and expose the cancellation path early.
- **Neon pooling** behaviour for `set_config` and advisory locks is unverified until tested.
- **Small local models** miss details (qwen3.5:4b missed "Beirut" once); `qwen3.5:9b` is better on this Mac.
- **iCloud** syncs the Documents folder and creates "file 2" duplicates; moving the project out of Documents avoids it.
- **Health data** needs legal review before real use.

## Your checklist, in order

1. Now: nothing blocks phases 3 and 4.
2. Before phase 5: Duffel read-write test token, carrier access requests, the email to Duffel.
3. Before phase 7: Resend account and a verified domain.
4. Before phase 8: Neon, Vercel Pro, an external place for audit anchors.
5. Before phase 9: Anthropic key, Duffel billing, legal advice.
6. Before phase 10: Stays access request (send it early).
