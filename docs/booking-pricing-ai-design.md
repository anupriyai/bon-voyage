# Real booking, price optimisation, AI port and auditable database

Status: phases 1, 2 and the pricing model built · 2026-10-25 · branch `test-branch`
Facts below were checked against live sources on 2026-10-25 (Duffel, Neon, Vercel, Ollama, Anthropic, Next 16 docs); anything still unconfirmed is listed at the end.

## Goal

Turn the prototype's sample travel data into a real experience:

1. **AI port.** The assistant runs on Qwen through a local Ollama today and on the Claude API later. One environment variable switches between them.
2. **Real flights.** Search and book through Duffel, inside the existing Search and Plan screens.
3. **Price optimisation.** Find the cheapest *suitable* trip around a patient's appointment, and watch fares for drops.
4. **Auditable database.** Every change to a case, search, watch or booking records who made it and when, and tampering can be detected.

Strategic bets served: full-service value (2) and pricing transparency (4). The audit trail supports trust (1).

## Decisions

| Area | Decision | Rejected alternatives |
|---|---|---|
| Runtime | Develop locally on the Mac (Postgres.app 18, Ollama; `python3 tooling/launch.py` starts and stops them). Production later on Vercel Pro + Neon (Postgres 18), with `AI_PROVIDER=claude` there, because a cloud host cannot reach a local Ollama | Railway/Render; self-hosted VPS |
| Database | Postgres 18, `pg` Pool + `drizzle-orm/node-postgres` everywhere (never `neon-http`: no transactions) | SQLite/libSQL; immudb |
| Data access | drizzle-orm 0.45.4 + drizzle-kit 0.31.11 (migrations in `shared/lib/db/migrations`) | Prisma, Kysely |
| Audit | Postgres triggers, a read-only app role, a hash chain, anchoring | App-only audit writes; event sourcing |
| Auth | Better Auth 1.7.12, email magic link (hashed tokens), Drizzle adapter | Auth.js, Clerk, Supabase Auth |
| Flights | Duffel behind a `FlightProvider` interface; `MockProvider` without a token | Amadeus, SerpApi |
| Lodging | Apply for Duffel Stays; sample stays until access is granted | — |
| Pricing | Pure TypeScript in `domains/pricing/model` | — |
| Price-watch scheduler | One protected GET route; Vercel Cron (Pro) in production, manual locally | GitHub Actions, Inngest, QStash |
| Alerts | In-app first, then a daily email digest (Resend), then WhatsApp | — |
| AI adapter | Hand-written `AiProvider`; Ollama native `/api/chat`; Claude `messages.parse` | Vercel AI SDK; OpenAI SDK |

## Folder layout (built so far)

```
app/api/assistant/route.ts         thin: provider or scripted fallback
app/api/auth/[...all]/route.ts     Better Auth handler
domains/
  account/   db.ts (auth tables, roles), auth.ts (Better Auth, actorFrom), index.ts
  case/      db.ts (cases, case_clinical, travelers), assistantSchemas.ts (what the AI must answer)
  pricing/   model/{dateWindow,routeOptions,ranking,priceWatch}.ts, search.ts, index.ts
  travel/    fare.ts, flightProvider.ts, mockProvider.ts, alternates.ts, index.ts
shared/
  lib/ai/    provider.ts, ollama.ts, claude.ts, index.ts (getAiProvider)
  lib/db/    client.ts (withActor), crypto.ts, verifyAudit.mts, migrations/
tooling/   drizzle.config.ts, vitest.config.mts, launch.py
```

Still to come: `domains/travel/duffelProvider.ts`, `app/api/travel/{search,book}`, `app/api/price-watch/run`, the travel and pricing tables.

## 1. AI port (`shared/lib/ai`) — built

- `AiProvider.structured({system, text, schema})` returns a zod-validated answer or `null`; the route then uses the scripted answer. `source` reports `"ollama"`, `"claude"` or `"scripted"`.
- **Opt-in:** an unset `AI_PROVIDER` means scripted, even with `ANTHROPIC_API_KEY` present.
- **Ollama:** `POST /api/chat`, `stream:false`, `think:false` (without it qwen3.5 thinks and takes ~72 s), `format` = the JSON schema, the same schema repeated in the system prompt (the model never sees `format`), `options: {temperature: 0, num_ctx: 8192, num_predict: 1024}` (the default 4k context can silently cut a long Arabic story). Needs Ollama ≥ 0.31.2. Default model `qwen3.5:4b` (installed, 3.3 GB); `qwen3.5:9b` (6.6 GB) extracts better on this 16 GB Mac.
- **Claude:** `messages.parse` with `zodOutputFormat`, `max_tokens: 8000` (Opus 5.5 thinking counts toward it), no sampling parameters.
- **Lenient schemas** (`domains/case/assistantSchemas.ts`): the SDK strips `enum`/`const` before sending, so Claude can return a value outside the list; each field is lower-cased and, if still invalid, becomes `null` on its own instead of failing the whole answer. `self` is a boolean.
- **Measured:** qwen3.5:4b extracts the sample story fully (11/11 fields) in ~23 s cold, classifies a change in ~7 s.
- **Privacy:** Ollama keeps stories local. With Claude they go to Anthropic: check data-retention terms first. Logs record only error names, never story text.

## 2. Auditable database (`shared/lib/db`) — built

### Roles

- `bv_owner` owns the schema and runs migrations (needs CREATE on the database and on schema `public`; on Neon grant both as `neondb_owner`, and use the **direct** host for `DATABASE_OWNER_URL`).
- `bv_app` is what the app connects as (pooled host on Neon): read/write on app tables, **read-only** on `audit.log`, `lock_timeout 5s`, `statement_timeout 15s`.
- Role creation and passwords are set up by hand (locally, done), never in migrations.

### Tables built

| Table | Audited | Notes |
|---|---|---|
| `user` | yes; `email`, `name`, `image` redacted | Better Auth; `role` ∈ patient, caregiver, coordinator, doctor (default patient) |
| `session`, `account`, `verification` | no | Better Auth internals |
| `cases` | yes | owner, status, origin, hospital, appointment, treatment/recovery days |
| `case_clinical` | yes; all sealed columns redacted | AES-256-GCM ciphertext, iv, tag, key version |
| `travelers` | yes; names and birth date redacted | `needs` (e.g. wheelchair) |

Later phases add `searches`, `fare_snapshots`, `price_watches`, `price_alerts`, `bookings` and a rate-limit row. Ids from Better Auth are `text`.

### How the audit works

1. **`withActor(db, actor, fn)`** is the only way the app writes. Its first statement takes the audit lock (`pg_advisory_xact_lock(4242001)`) *before* any row lock, so audited writes cannot deadlock on it, then sets `app.actor_id`, `app.actor_type` and `app.request_id` with `set_config(…, true)`. No network calls inside `fn`.
2. **`audit.capture()`** (trigger, `SECURITY DEFINER`, pinned `search_path` and `timezone`) records the changed columns' old and new values; sensitive columns (trigger arguments) as `{"redacted": true}` only, so the log holds no recoverable personal data and erasure deletes source rows without breaking the chain. Unchanged updates are not logged.
3. **No actor → error.** The actor is read with `nullif(…, '')`, because a pooled connection that ran `withActor` before reads `''`, not NULL. One exception: Better Auth may create a *patient* account or change sign-in fields (`email_verified`, `name`, `image`, `email`, `updated_at`) without an actor; those are attributed to the user themself (`actor_type = 'auth'`). A role change or deletion without an actor is refused.
4. **Hash chain.** `hash = sha256(JSON array of prev_hash, UTC time, actor, request, action, table, row, changed)`, computed by one SQL function, `audit.row_digest()`, used by both the trigger and the verifier. Audited writes must run in READ COMMITTED (the trigger refuses others: a stale snapshot would fork the chain).
5. **Append-only.** `bv_app` has only SELECT on `audit.log`. Triggers block UPDATE, DELETE and TRUNCATE even for the owner.
6. **Verification and anchoring.** `npm run audit:verify` walks the chain and prints the head hash. The owner role *can* disable the guards and rewrite history, so tamper evidence holds only back to the last head hash recorded outside the database. **Anchoring is mandatory in production** (a scheduled job writing the head to an external append-only store); not built yet.

Tests (`shared/lib/db/audit.test.ts`, 15, against the real test database) cover all of the above, including concurrent writes, opposite-order updates, an edited row and a deleted row.

### Health-data encryption (`crypto.ts`)

AES-256-GCM, random 12-byte IV, 16-byte tag (shorter tags refused), associated data `${caseId}|${keyVersion}` so a ciphertext moved to another case fails. `DATA_KEY` must decode to 32 bytes; old keys stay readable via `DATA_KEYS_OLD` for rotation.

### Auth

- Magic links are stored hashed. In development the link prints to the server console; in production sending throws until Resend is configured. **Resend is needed from the first production sign-in**, not only for alerts (free tier: 100 emails/day, verified sending domain required).
- Next 16 renamed `middleware.ts` to `proxy.ts` (Node runtime only). Its docs advise against using it for authorization, so each route checks the session itself (`actorFrom(headers)`).
- Verified end to end locally: link issued, verified, session created, account creation audited as `auth` with the email redacted.

## 3. Flights through Duffel (`domains/travel`) — mock built, Duffel adapter next

- **Rate limit:** live search is about **10 requests per 60 s per organisation**, shared by every user and the price-watch job. This drives the search design in §4. One app-wide limiter keeps its state in a Postgres row, updated from the `ratelimit-*` response headers, with a reserve for interactive searches. Ask Duffel for a higher quota before launch.
- **Search:** one offer request with two slices (round trip), `max_connections: 1`, `supplier_timeout: 10000`, then list offers sorted by total. Map `holdable = !requires_instant_payment`, and carry `conditions.refund_before_departure`, `change_before_departure` and `void_window_ends_at` onto `Fare`.
- **Cache:** TTL `min(15 min, earliest offer expires_at)` (offers live about 30 min); never book from cache without a fresh GET.
- **Booking writes** (orders, payments, Stays) go through a thin `fetch` wrapper, not the SDK: 130 s timeout (order creation can take 120 s), `x-client-correlation-id`, route `maxDuration = 150`. **Never auto-retry** except on 503; on 500, 202 or timeout, reconcile via `GET /air/orders?offer_id=` and the `order.created` webhook, and show "checking your booking".
- **Holds:** only when `requires_instant_payment` is false; no payments or services on a hold; pay before `payment_required_by` with the order's current total. The SDK types say `pay_later`, the wire value is `hold`.
- **Wheelchair and assistance:** Duffel has no field for it. Store `travelers.needs`; after booking create a manual task to request assistance from the airline (usually 48 h before departure) with the booking reference.
- **Cancelling and changing:** through Duffel, Royal Jordanian, Saudia, EgyptAir, MEA and Turkish list no refund capability; only Emirates, Etihad and Qatar do. Show refund/change conditions on every fare, prefer refundable or changeable fares, use the void window, and prefer a hold (or late ticketing) until the hospital date is confirmed. Add an operator path for manual cancellation through Duffel support.
- **Passengers:** order creation needs title, gender, email and phone; names in Latin script as on the passport, combined length ≤ 40; children searched by age; under-2s need a carrying adult; at most 9 per order. Validate with zod.
- **Fees** (part of the trip's comparable cost): $3 per order, 1% Managed Content, $2 per paid extra, 2% FX; fares come in the organisation's billing currency (mostly GBP).
- **Going live:** billing card plus a balance top-up; Managed Content tickets from UK/US/FR/AU/IE points of sale only; get legal advice on seller-of-travel rules and on selling those fares to residents of Jordan, Saudi Arabia, UAE, Lebanon and Egypt.

## 4. Price optimisation (`domains/pricing`) — model built

### Search within the rate limit (`search.ts`, `model/routeOptions.ts`)

1. **Default:** one round-trip request at the target dates (`targetDates`: the latest departure in the window, the first day after recovery), booked as **one order**.
2. **"Widen search" (opt-in, budgeted):** `planWiden` lists extra round trips, most promising first: dates closer to the target first, and an alternate airport counts like 1.5 days away. It stops at a request budget; a background job runs it so it yields to interactive searches.
3. **Fallback only:** two one-way searches combined into "two separate tickets" (`splitFallback`): double fees, two bookings, and no protection if one flight is cancelled. Typically about 20% dearer on international routes.
4. **Alternate airports** come from a hand-picked list (`domains/travel/alternates.ts`, at most two per airport: IST↔SAW, DXB→SHJ/DWC, CAI→SPX), not a radius: a radius picks Tel Aviv for Amman, Damascus for Beirut and Iranian-administered airports near Dubai. **The list is a product decision to review.**
5. **Comparable total** = fare for all travellers + booking fees + estimated ground transfers at every airport used (home side and hospital side, both directions).

### Date window (`dateWindow.ts`)

- Outbound **departure** dates run from `flexDays + maxTransitDays` before the latest landing day (appointment − `arrivalBufferDays`) up to it, so overnight and long-haul flights that land the next day are searched; ranking then checks each trip really lands in time.
- Return dates start the first day after treatment and recovery, up to `flexDays` later, never earlier.
- Invalid dates (e.g. 30 February) are rejected rather than rolled over.

### Ranking (`ranking.ts`)

**Hard rules** (rejected with a reason): lands after the buffer day; more than `maxStops` per direction; a layover over `maxLayoverHours`; a connection under `minConnectionMinutes`; priced in another currency than the ranking currency.

**Score, in dollars** (lower is better):
```
score = (fare + fees + ground) × usdPerUnit
      + hourPenalty × travel hours (door to door)
      + stopPenalty × stops
      + redEyePenalty × legs in the air between midnight and 5am (departure local time)
```

| Profile | maxStops | maxLayover | minConnection | hourPenalty | stopPenalty | redEyePenalty |
|---|---|---|---|---|---|---|
| standard | 1 | 6 h | 60 min | $15 | $60 | $40 |
| fragile (stage 3–4, or wheelchair) | 1 | 4 h | 90 min | $35 | $150 | $120 |

Starting values; tune after user interviews.

**Picks**, each with a plain-language reason ("$150 more than the cheapest, but non-stop", "Same price as the cheapest, but non-stop"):
- *Cheapest:* lowest comparable total.
- *Easiest:* fewest stops, then shortest travel.
- *Best balance:* lowest score.

The price calendar (`priceCalendar(validTrips, currency)`) shows the cheapest valid comparable total per departure day, one currency only. The UI never predicts fares or says "buy now".

### Price watch (`priceWatch.ts`, route to come)

- A drop is ≥ 5% **or** ≥ $30 (in the watch's currency) below the **baseline**: the first price seen, then the price of each alert sent. The lowest price seen is kept separately for display, so a slow decline still alerts once it adds up. Compared in whole cents.
- Compare like with like: round trip against round trip, separate tickets against separate tickets.
- **Route:** `GET`, `Authorization: Bearer CRON_SECRET` compared in constant time (401 if unset), `maxDuration` 300 s; idempotent per schedule slot; a lease row so overlapping runs don't double-process; watches in batches by `last_checked_at`; actor `system`.
- **Capacity:** each re-check is 1–3 requests (the watched round trip, ±1 day only when the price moved), spent only when the shared rate limit has headroom. That is about 70 watches a day on Vercel Pro every 6 h; Vercel Hobby (daily, non-commercial) only suits testing.
- **Schedule:** `0 6 * * *` UTC is 09:00 in Amman and Riyadh, 08:00 in Beirut and Cairo (winter), 10:00 in Dubai.
- Alerts: in-app, then one daily email digest per caregiver with no health details.

## Error handling summary

| Failure | Behaviour |
|---|---|
| No AI provider, or it fails | Scripted answer; `source: "scripted"` |
| One AI field invalid | That field is null; the rest are kept |
| No Duffel token | MockProvider; the UI labels fares as samples |
| Offer expired or repriced | Show the new price or re-search; never book silently at a different price |
| Duffel 429 on a search | Wait until `ratelimit-reset`; the limiter keeps a reserve for patients |
| Duffel 500/202/timeout on a booking | Never retry; reconcile and show "checking your booking" |
| Database down | Writes fail closed; read-only pages still render sample data |
| Write with no actor | The trigger refuses it; a bug to fix |

## Testing (111 tests, `npm test`)

- Pricing model: date windows (boundaries, impossible dates, transit days), hard rules with real time-zone offsets, fragile-only limits, overnight legs, scores, currencies, explanations, fees, ground at both ends, widen planning, drops and baselines, the calendar.
- Search: request counts per strategy, failure counting, concurrency cap, end to end with the mock and ranking.
- AI port: request shape, schema in prompt, fences, HTTP and connection failures, opt-in selection, lenient schemas through Claude's real parse path.
- Database (real Postgres, skipped without `TEST_DATABASE_*`): every audit rule above, plus encryption.
- `npm run build` must pass before a phase is called done.

## Build order

The phase-by-phase instructions, with what each phase needs from you, are in [implementation-roadmap.md](implementation-roadmap.md). The table below is the original outline.

| Phase | Delivers | Status / needs |
|---|---|---|
| 1 | AI port | Done; Qwen verified live |
| 2 | Postgres 18, Drizzle, audit, encryption, Better Auth | Done; sign-in verified live. Anchoring job still to build |
| 3 | Duffel adapter, search route wired into Search | Needs a Duffel **read-write test** token |
| 4 | Pricing | Model done; needs phase 3 for real fares, plus the alternates list review |
| 5 | Booking: reprice, hold or instant, reconcile, assistance task | After 3 |
| 6 | Price watch, rate-limit row, in-app alerts, email digest | Resend account |
| 7 | Duffel Stays | Stays access approved |

## Environment

See `.env.example`. Local values live in `.env.local` (gitignored), already filled in for the local database, keys and secrets.

## Your setup checklist (remaining)

1. **Duffel:** sign up at https://app.duffel.com, create a **read-write test** token (`duffel_test_…`) and put it in `.env.local` as `DUFFEL_ACCESS_TOKEN`. Request Stays access, and on the Airlines page request access to RJ, SV, MS, ME, TK, EK, FZ, EY.
2. **Email help@duffel.com** about: a higher live search quota; hold availability on the Travelport carriers; whether UK/US point-of-sale fares are acceptable for residents of the target countries; USD billing; the 1% vs 0.5% fee; whether `IST`/`DXB` city codes include SAW/DWC.
3. **Product decisions:** the alternate-airport list; default date flexibility (±1 day recommended to save requests); refundable fares preferred.
4. **Optional:** `ollama pull qwen3.5:9b` (6.6 GB) and set `OLLAMA_MODEL=qwen3.5:9b` for better extraction.
5. **Later:** Resend (verified domain) before production sign-in; Neon (PG 18) with the roles and grants above; Vercel **Pro**; Anthropic API key; legal review (seller-of-travel, health data).

## Still unverified

- Neon: whether SQL-created roles log in through the pooler, and whether `set_config(…, true)` and the advisory transaction lock behave through it (likely). Test on a Neon branch before production.
- Duffel: the test-mode rate limit; the live 10/60 s figure (from a help-centre extract); whether listing offers counts against it; hold availability on Travelport carriers; Stays approval; 1% vs 0.5% fee; city-code resolution; an assistance field (none found).
- qwen3.5:9b quality and latency on this Mac; Opus 5.5 latency within the 20 s timeout.
- One-way vs round-trip price gaps on Middle East–Europe routes (test mode can't show real fares).
- Health data: designed to HIPAA/GDPR-style standards but not certified; get legal review before real patient data.
