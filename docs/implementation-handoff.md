# Implementation handoff: through Phase 10 local flows

## Public Explore addition — 2026-11-05

The public medical-travel extension adds a worldwide country directory, broad treatment taxonomy, clearly fictional care offers, case-independent sample travel search and an independent trip planner. Browsing is public; account sign-in is required only to save a trip or record a sample care request. These plans remain separate from the oncology-specific case model.

Persistence uses the additive `0006_care_plans` migration and `domains/providers/server.ts`. Both saved plan payloads and immutable request snapshots are encrypted with per-record associated data; audited writes redact encryption material. Requests deduplicate by owner/plan/revision and owner/attempt. No-op saves preserve the revision. Account pages load saved care trips separately from the guided case list, and login allows a narrow return to `/explore/trip`.

Focused verification: disposable PostgreSQL run for provider search, care-route handlers, encrypted care persistence and safe login returns passed **4 suites / 20 tests**. This covers owner isolation, stale revisions, no-op saves, concurrent duplicate requests, snapshot preservation, encryption/audit redaction, invalid selections, cross-site mutation rejection and safe storage failures. Full integration/build/browser verification is recorded separately after all public UI components land.

All public offers, flights, stays and care requests remain explicitly sample-only. No clinic was contacted, no appointment or travel was reserved, and no payment was collected. Existing live-release and verified-provider gates remain unchanged. The migration was generated locally; it was not applied to the development database by this work.

Updated 2026-11-03. Active branch: `test-branch`. The canonical requirements remain in [implementation-roadmap.md](implementation-roadmap.md). No commit, push, deployment, live booking, real payment or external email was performed. The old `bon-voyage/` clone is untouched.

## What was built

| Phase | Implemented |
|---|---|
| 3 | Real magic-link form/account session; owned encrypted persistence; strict case/traveller validation; revision conflicts; debounced serialized saves; account-scoped working copies; server reload/delete; optimistic Proxy. Arbitrary passport fields cannot enter the case payload. |
| 4 | Sample Flights screen, hospital/origin airports, clinical date windows, child/infant-aware party searches, three explained picks, valid-day calendar, rejected reasons, capped widening, saved searches/fares and selected-flight plan totals/dates. |
| 5 | Exact `@duffel/api@4.31.0` dependency; SDK-only search adapter; airport-local offset conversion; native currency and planning FX; expiry-bounded cache; fresh repricing; safe typed errors; sample/test/live labels; common provider contract tests. |
| 6 | Audited booking/coordinator-task tables, unique claims and active-booking protection, request HMAC without document storage, fresh quote/itinerary/party checks and repriced plan updates, holds/instant orders, separate payment claims, one bounded fast-503 retry, durable checking/reconciliation, signed/deduplicated webhooks, monotonic states, manual cancellation requests, assistance tasks and booking UI/panels. |
| 7 | Audited watches/alerts/digest ledger, atomic shared quota with interactive reserve and provider-header updates, leased/idempotent worker, clinical suitability and context checks, observed-price drop baselines, in-app panels, previous-completed-UTC-day digest, local job CLI and daily cron configuration. |
| 8 | Production Resend magic-link sender, HMAC-keyed database auth throttling, audit verification/external-anchor delivery and failure email, Vercel pool attachment, protected jobs, readiness probe and restore/rotation/recovery runbook. Infrastructure is not provisioned. |
| 9 | Production/live configuration checker, explicit hard block on live booking, and the owner/external release checklist. This phase is not complete. |
| 10 | Mock and Duffel-test Stays ports; required accessibility and distance filtering; separate result/rate/quote IDs; full-rate retrieval, local quote expiry and fresh quote before booking with property identity and mobility revalidation; owner-scoped search/quote records; durable booking/reconciliation; Stays creation webhook; accommodation assistance requests/tasks; property fees/currency/null preservation; Stay screen, journey step and plan selection. |

Hospital care/prices/visa rules, record processing and deposit screens remain prototype material. These travel additions do not establish a verified medical-provider network or production health-data consent/sharing.

## Verification evidence

- Final full run: **29 suites / 171 tests passed; 1 opt-in real-Duffel contract test skipped** in a newly created disposable PostgreSQL cluster. All ordinary tests use local mocks, injected HTTP responses or synthetic fixtures.
- Passed actual Next.js HTTP smoke: development magic-link sign-in and sign-out, private case save/reload, stale revision rejection, sample-cookie/API separation, one-search/capped-widen flow, snapshots/encryption/audit, duplicate-safe sample flight booking, watch creation, accessible-stay search → full rates → quote → sample booking, and unauthenticated cron rejection.
- Database lifecycle coverage includes concurrent booking and payment claims, definite failed-payment recovery, ambiguous booking recovery without resubmission, cross-owner rejection, document non-persistence, webhook dedupe, watch overlap/slot idempotency, quota reserve, auth-limit concurrency and verified audit anchoring.
- Final TypeScript, production build, Drizzle migration metadata and whitespace checks pass. The complete actual Next.js HTTP smoke also passes after the final changes.
- Migrations `0002`–`0005` are applied to the local development database. Audit chain verifies. Read-only probes pass for the restricted app role, PostgreSQL 18, transaction-local settings/advisory-lock pattern and setting cleanup. This does not prove Neon pooler compatibility.
- Production configuration check correctly remains nonzero: HTTPS deployment, Resend sender/key, anchor destination/credential/alert recipient and Duffel test credentials are absent. `--live` also intentionally reports live booking disabled.
- Native Chrome browser review now verifies guest-case adoption after magic-link sign-in, sign-out, restoration in a new Guest session, direct return to `/case/records`, two-tab revision conflict and explicit server reload, explained flight picks, selected plan costs/dates, an adult/infant sample hold, existing watch display, accessible-stay search/full quote and property fees. Desktop and 400-pixel Stays/hold layouts were inspected. The connector remains unavailable; native Chrome with the review harness’s `--webpack` option was usable. See the continuation checkpoint below for limits.
- SDK contract fixtures are synthetic and explicitly labelled. The real Duffel contract is skipped unless a test token and `RUN_DUFFEL_CONTRACT=1` are explicitly supplied. No provider quota was spent by ordinary tests.

Safe reproduction:

```sh
python3 tooling/testDatabase.py
python3 tooling/testDatabase.py --command node tooling/smokeCase.mjs
npm run build
npx drizzle-kit check --config tooling/drizzle.config.ts
npm run production:check
```

For isolated UI review:

```sh
python3 tooling/testDatabase.py --command node tooling/smokeCase.mjs --browser --webpack
```

This creates fake data on a temporary port and retains development sign-in links internally without printing them. Use fake addresses only. `--webpack` selects the supported local development path; the underlying Turbopack reload cause is not established. Stop with Ctrl+C to remove the server/database. Use a separate private browser context; do not clear existing development browser data. Add `--ui` with an installed `PLAYWRIGHT_MODULE` to run the repeatable guided mobile/price-alert acceptance matrix.

## What remains, in execution order

1. **Local browser acceptance now passes with warmed development Webpack.** The 2026-11-10 continuation verified the generated price-drop alert, complete new mobile intake-to-dashboard journey, save-unavailable recovery, flight-search retry, handset widths and coordinator keyboard behavior; see `docs/journey-acceptance-qa.md`. `npm run dev` and the launcher now explicitly use Webpack as a reversible local fallback. The separate `npm run dev:turbo` diagnostic still reloads the watched Flights page and did not complete; its underlying cause remains unresolved. Production-browser performance, real-provider price/schedule changes, held-payment recovery and unknown/foreign-currency property fees still require the checks below. Alternate-airport and clinical planning assumptions need owner review.
2. **Phase 5 real-account verification.** Supply a read-write `duffel_test_` token, request the required carriers, then run `RUN_DUFFEL_CONTRACT=1 npm test -- domains/travel/providerContract.test.ts`. Record sanitized real search/offer/error fixtures and replay them in ordinary tests. Verify the organisation's actual billing currency, rate-limit headers, IATA/city codes and carrier/hold behavior. No test token was available here.
3. **Phase 6 real test orders.** Set `DUFFEL_BOOKING_ENABLED=true` only with the test token. Verify instant and held orders, current-price payment, changed-price/schedule reconfirmation, infant/document requirements and externally delivered signed webhooks. Exercise pending/failed/ambiguous payment recovery against the provider. A definitely unprocessed failure can release a local payment claim; an ambiguous payment remains protected until the order proves paid/cancelled or an operator reconciles it. Review the coordinator's support/cancellation process; a recorded manual request is not an automatic cancellation/refund.
4. **Phase 7 email/capacity.** Provision Resend and a verified sender, verify real delivery without health details, and rehearse a pending digest retry within its idempotency window. Confirm provider quota headers and background capacity; test hosted lease overlap. Current cron is daily at 06:00 UTC. Change watches to every six hours only on Pro after capacity review. `npm run price-watch` requires the local app running and uses the protected job. Mock fares can be lowered with `MOCK_FLIGHT_PRICE_FACTOR` after restarting the local server; repeat schedule slots remain intentionally deduplicated.
5. **Phase 8 infrastructure and drills.** Provision Neon/Vercel Pro/Resend and an independently immutable audit gateway. Configure cron auth and alert delivery. Run the read-only pooled database probe against the actual preview, write/retrieve external anchors, rehearse restoration against an external audit head, and perform a key-rotation drill. No hosted resource or external immutable anchor exists from this work. Use [production-readiness.md](production-readiness.md).
6. **Phase 9 live release — not done.** Obtain legal/consent/data-retention decisions, evaluate the current Claude configuration on fake stories against Qwen/scripted behavior and latency, obtain Duffel live access/billing, verify/configure actual provider/content/extras/FX fees, and review live UI/release gates. The current code rejects live booking even with live search opted in. The existing fixed FX table is a planning estimate; it is not a settlement quote. Implement the reviewed live-booking release gate only after the above evidence exists. A controlled real booking needs direct owner participation and a specific spending limit; none was attempted.
7. **Phase 10 real Stays verification.** Request Stays access, then enable `DUFFEL_STAYS_ENABLED=true` with the test token. Capture/replay real search, complete-rate, quote, booking and webhook fixtures; verify accessibility/special-request mapping, null and foreign-currency property fees, expiry/price changes, and interrupted 200/202/5xx/timeout reconciliation. The installed SDK confirms `accessibility_mobility` and `accommodation_special_requests`; actual property suitability still needs confirmation. No unsupported quote-ID list filter is used. Stays over 99 nights route to a coordinator. The current Stay screen supports adult guests; child-guest UI is a follow-up if required.

## Files to start from

- Flight search/adapters: `domains/travel/{duffelProvider,providerCache,providerError,server}.ts`, `domains/pricing/findOptions.ts`.
- Booking: `domains/travel/{booking,bookingStore,bookingSchema,bookingStatus,orderProvider,duffelTransport,bookingHandler,webhook}.ts` and `components/{BookingPage,BookingPanel}.tsx`.
- Watches/limits/digests: `domains/pricing/{watchStore,watchJob,watchHandlers,rateLimiter,emailDigest,db}.ts` and `components/PriceWatchPanel.tsx`.
- Stays: `domains/travel/{staysProvider,mockStaysProvider,duffelStaysProvider,stays,staysHandler}.ts`, `components/StaysPage.tsx`.
- Operations: `shared/lib/db/{anchor,jobLease,requestLimit,client}.ts`, `shared/lib/{email,jobAuth,http}.ts`, `tooling/verifyProduction.mjs`, `vercel.json`.
- Database migrations: `shared/lib/db/migrations/0002_case_persistence.sql` through `0005_stays.sql`, with their journal/snapshots. Domain schemas are in account/case/travel/pricing `db.ts` files.
- Regression entrypoints: `domains/travel/operations.test.ts`, provider/booking/webhook/Stays tests, `domains/case/state/sync.test.ts`, and `tooling/smokeCase.mjs`.

## Maintenance notes

- Documents/iCloud creates numbered copies of generated `.next/types` files. TypeScript now excludes only generated copies with spaces; original generated types remain included. Moving the checkout is a separate user decision.
- `npm audit` reports four moderate findings in the Drizzle/esbuild development-tool chain. The automatic suggestion is a Drizzle downgrade; no forced upgrade/downgrade was applied. Production dependency changes need a separate compatible review.
- Keep all work uncommitted until requested, preserve existing user changes, and leave `bon-voyage/` untouched. Never run the destructive database suites against configured databases; use the disposable runner.

## Final validation checkpoint

- `python3 tooling/testDatabase.py`: **29 files passed; 171 tests passed; 1 explicitly opt-in real-Duffel test skipped**.
- `npm run build`: passed, including booking, Stays, watch, webhook and audit-anchor routes.
- `python3 tooling/testDatabase.py --command node tooling/smokeCase.mjs`: passed the full authenticated sample flight/watch/Stays flow and sign-out; temporary server/database stopped and removed.
- `npx tsc --noEmit`, `npx drizzle-kit check --config tooling/drizzle.config.ts`, and `git diff --check`: passed.
- Local migration/audit/read-only probe: migrations through `0005` applied, chain clean, restricted app role/PG18/transaction settings verified. Local PostgreSQL returned to stopped state.
- `npm run production:check`: expected nonzero readiness result for absent HTTPS/provider/email/anchor setup. `ANTHROPIC_API_KEY`, `DUFFEL_ACCESS_TOKEN`, `RESEND_API_KEY`, `RESEND_FROM`, `AUDIT_ANCHOR_URL` and `AUDIT_ANCHOR_TOKEN` remain absent; no values were logged.
- The remaining browser matrix, real test-provider traffic/fixtures, hosted operations and phase 9 release remain unfinished as listed above. There are no running test services and no commit/push/deployment from this work.


## Continuation browser checkpoint — 2026-11-03

All browser input was synthetic and all orders used the mock provider in disposable databases. No actual payment, email or provider quota was used.

- A guest completed intake as Fake Browser Patient. Signing in adopted the case and showed it as saved. Sign-out removed the private view. Closing all Guest windows, opening a fresh Guest session and signing in with `/case/records` as callback restored the same case from the server.
- Two tabs loaded the same revision. A synthetic record edit in one tab made the other tab’s save conflict. The visible banner required an explicit reload confirmation; reload restored the server’s seven filed records.
- Flight search displayed three explained picks, local-time itineraries, sample labels, the calendar and rejected-trip disclosure. Selecting a fare updated plan dates and the total. The existing watch displayed its baseline and lowest observed price.
- An adult and infant were entered through the booking UI with carrying adult `1`. A sample hold succeeded at `$415`, showing the reference, local payment deadline and unpaid-hold disclosure. No hold payment was submitted. The booking page now highlights Flights in journey progress.
- Stays displayed required mobility access, an accessible result, a full quote with `$2,185` room total and `$69` due at the property, and the existing confirmed sample booking. Desktop and 400-pixel layouts were inspected.
- Regression reproduced and fixed: editing the guest count after retrieving a stay quote previously kept old results and its two-guest booking form. Search-input edits now clear results, quote, consent, guest fields and the selected stay. Case/travel-context changes remount the form; older search/quote responses cannot restore discarded results. The browser replay confirmed the stale form and selection disappear.
- A booking refresh after stopping the disposable server displayed an error. Network failures now use a connection/retry explanation instead of the raw browser `Failed to fetch` message.
- The browser harness accepts `--webpack` and forwards subsequent development magic links during review. Default Turbopack repeatedly reloaded the account page in this environment; Webpack was stable. No global bundler/configuration change was made.

Validation remains 29 suites / 171 passing tests with one opt-in real-Duffel test skipped. Production build, TypeScript, migration metadata and whitespace checks pass; the HTTP preflight passes with the updated browser harness. Production readiness remains nonzero for missing HTTPS, email, audit-anchor and Duffel configuration. Disposable browser/server/database resources are closed at delivery.


## UI redesign continuation

The user requested a brighter blend of Miljøfyrtårn and Hormn, then selected Matter typography from Miljøfyrtårn, asked to retain/redesign the world image, add visible animations, and finish the whole site/process. The implementation now uses Matter Regular/Medium/Semibold, ivory/white surfaces, navy text and the original teal/mint/sand palette across marketing, account, intake, records, options, flight/stay/booking, plan and dashboard UI. The original geographic canvas is preserved and recoloured rather than replaced with a static mock. Home autoplays sample journeys with a pause control, animated route/plane and entry motion. PageMotion supplies viewport reveals across the journey and respects reduced motion.

Marketing now includes `/about`, `/how-it-works`, `/contact` and `/privacy`, shared responsive navigation/footer and a brand favicon. These pages are honest about prototype support, clinical decisions and illustrative provider content; no invented staffed contact inbox, team biographies or provider verification claims were added. The current public-release gates for real operations remain unchanged. Matter font files match the explicitly requested reference; a separate redistribution licence has not been established by this local work and must be resolved before public release.

Final redesign verification (2026-11-04): user approved isolated headless Chrome. Public pages and all signed-in journey routes were checked at 1440/390 widths with no document overflow or runtime exceptions; Matter rendered throughout. Verified globe autoplay, destination cycling, pause and reduced motion; viewport reveals; mobile menu/FAQ/sample controls; sample flight search/selection, stay quote and plan ownership controls. Fixed the dark-on-dark plan globe route label. Final build, TypeScript and whitespace checks pass; regression suite remains 171 passed / one opt-in real-provider skipped. Evidence and scope boundaries: `docs/design-qa.md`, `docs/ui-review/`. The former disposable preview at http://127.0.0.1:64269/ was stopped for the public Explore continuation; it is not a current preview address.

## Public medical travel search continuation — 2026-11-10

The separate `/explore` entry now offers treatment-first search, practical filters, neutral catalogue order, explicit price/destination sorting, pagination and a three-offer comparison. Public destination/treatment directories and offer detail pages link into the independent care trip planner; the guided `/start` and oncology cases remain separate. The responsive experience includes a native mobile filter drawer and compact planner subtotal/review shortcut.

- `providers` owns 249 countries and territories, 15 specialties, 27 procedures/consultations, 28 fictional offers in 11 destinations, and independent encrypted plans and sample requests. Geographic identifiers are pinned to `datasets/country-codes` commit `a6129fd4a004685c51432ddc04e3543ff750bef7`, retrieved 2026-11-05; the exact source and PDDL provenance are recorded in `domains/providers/countries.ts`.
- Case-independent `/api/explore/flights` and `/api/explore/stays` always use sample providers, including when real-provider credentials exist. Explicit searches require a selected offer and valid dates; selections are revalidated against the offer, dates, travellers and quote expiry. No real flight, stay, medical appointment or payment is created.
- `/api/explore/plans` and `/api/explore/requests` authenticate the account and enforce ownership/revisions. Additive migration `0006_care_plans` introduces sealed plan/request payloads and redacted audit triggers; requests freeze the selected offer/travel snapshot and deduplicate repeated submissions. The configured development database has not been migrated by this continuation; validation uses disposable clusters.
- Anonymous choices survive magic-link sign-in; explicit resume prefers the newly selected anonymous draft over older account choices. Failed owned-plan loads and account changes clear old private state and cannot persist it into another account's storage. Query-only travel preference changes reset the planner context. Connection failures provide a retry explanation while retaining working choices.
- `NEXT_PUBLIC_SITE_URL` supplies the canonical public origin. Local/malformed origins disable indexing; sample offers, empty destination pages, filter combinations and private plans remain `noindex`. Sitemaps exclude fictional inventory and private routes.

Source review fixes were checked with 10 focused tests across catalogue relations, planner request recovery and metadata policy; TypeScript and whitespace checks passed. The 2026-11-10 isolated HTTP/browser acceptance pass succeeded: guest discovery/comparison, flight/stay selection and invalidation, same/new-tab magic-link restoration, explicit save/request/account display, aborted-save recovery, anonymous-resume precedence and live account-switch isolation were verified. Desktop 1440px and mobile 390px routes had no document overflow or runtime errors; mobile filters, compact subtotal, keyboard entry, reduced motion and basic guided-journey regression passed. Evidence and precise limits: `docs/public-search-qa.md` and `docs/ui-review/explore-check.json`.

Final validation: `python3 tooling/testDatabase.py` passed **36 test files / 199 tests**, with one explicitly opt-in real-provider test skipped. The temporary PostgreSQL cluster was stopped and removed after the suite. Production build, TypeScript, Drizzle migration metadata and whitespace checks passed after the feature changes. The earlier 171-test checkpoint describes the pre-Explore journey work. During the final regression run, the existing audit-redaction test falsely matched the four-digit birth year inside unrelated timestamp microseconds. Its assertion now checks the full DOB and explicitly requires both surname and DOB fields to be redacted; no application or database behavior changed.

The public Explore review used `http://127.0.0.1:55189/explore` (smoke runner session `99337`); that preview was stopped for the subsequent guided-journey acceptance runs. Review databases remain temporary and separate from the configured development database. Existing real-provider, email, hosting, immutable-audit, clinical/legal and font-licensing release gates remain open. No commit, push, deployment or real-provider traffic occurred.

## Guided local browser continuation — 2026-11-10

The warmed Webpack browser matrix now passes the previous local acceptance gaps: an actual scheduled sample-price drop appears in the mobile watch panel and is deduplicated on job replay; a new 390px guest completes story intake, brief, magic-link adoption, hospital selection, flight choice, plan ownership/review and simulated approval to the dashboard. Case-save failure, cancelled reload and keyboard retry preserve the working choices; aborted flight search recovers with readable messaging. Intake editing, Options, Flights, Plan and Dashboard have no horizontal document overflow at 320/390/768 widths. The coordinator dialog receives focus and restores it on Escape. Evidence and limits: `docs/journey-acceptance-qa.md`, with the final completed run in `docs/ui-review/journey-continuation-webpack-check.json` (`2026-11-11T00:56:10Z`, still 10 November in California).

Source corrections scope price-watch requests/state to their case and selected search/fare and cancel superseded list responses; guard delayed mutations, including a watch-create waiting for save while the selected fare changes; show readable flight connection/save errors while retaining validation messages; bound companion form rendering for temporarily invalid numbers; and use a native coordinator modal for focus containment and return. The full disposable regression suite passes **36 files / 199 tests**, with one opt-in real-provider test skipped; the final production build, TypeScript, migration metadata and whitespace checks pass after the selected-fare watch guard. The smoke harness now waits for the successful save PUT before checking persisted data, rather than treating a hidden Retry button as proof of commit.

Default Turbopack development still did not complete the matrix: the actual protected job created its expected alert, but repeated reloads prevented a stable watched Flights panel. Its cause is unresolved. The installed Webpack HMR code also has a separate source-supported reload mechanism: it broadcasts new-client `SYNC` events to existing clients, while the browser reloads on a later differing sync hash; see the precise runtime references in the acceptance report. The successful harness warms the intake/assistant route and closes the completed alert context before the new-intake context. No dependency or framework code was patched.

The supported local run path is now explicitly `npm run dev` → `next dev --webpack`, also used by the launcher. `npm run dev:turbo` retains the failing development path for controlled diagnosis. This is a reversible development-only fallback; `npm run build` is unchanged. Production-browser performance, full assistive-technology certification, real-provider fixtures, hosting and live-release decisions remain separate from the completed local matrix.

The current disposable review preview is `http://127.0.0.1:59447/explore`; `/explore` and `/login` returned HTTP 200 after the final build. It runs the supported Webpack command with a fresh temporary database. Its detached cleanup-owning runner is PID `9538`, with private metadata at `/private/tmp/bon-voyage-review.json` and log at `/private/tmp/bon-voyage-review.log`. Stop that runner to clean its child services and disposable database. This preview is local only and may no longer be running in a later session; check HTTP before reusing it.

## Cancer-only and verified public discovery — 2026-11-11

The owner narrowed Bon Voyage to cancer care and chose to hide fictional clinic listings. Public `/explore`, `/treatments` and the homepage now present seven cancer care topics: second opinion, pathology review, medical oncology, radiation oncology, cancer surgery, cancer genetics and supportive care. Topic names and general descriptions are anchored to the US National Cancer Institute's [cancer treatment overview](https://www.cancer.gov/about-cancer/treatment/types) and [finding cancer care guide](https://www.cancer.gov/about-cancer/managing-care/finding-cancer-care). They are navigation labels, not clinical advice or evidence of eligibility.

The 249-country directory remains discoverable. Public search, comparisons, offer details, travel APIs and new saved plan/request writes now require a verified cancer offer; none is configured, so every destination honestly shows “No listings yet.” Old fictional offer URLs return 404, and earlier private demo plans remain labelled as archived without a path back into the planner. There are no clinic prices, credentials or appointment claims on public pages. The former broad fictional fixtures remain only to support historical isolated demo and regression code; they are not public inventory. Real clinic identity, credentials, price scope and availability require independent verification before a listing can be introduced. Public travel remains sample-only even after a verified care listing is introduced.

The guided oncology intake now offers all 249 countries and territories in its home-country selector, asks for an actual city, and validates the selected identifier on save. Existing seven sample origins retain their previous IDs to preserve saved cases. Other origins use a clearly labelled placeholder route; entry rules, route time and local costs are presented as requiring confirmation. Country coverage, invalid-code rejection and the public fictional-offer gates have focused tests. Final disposable regression passed 37 files / 199 tests, with one opt-in real-provider test skipped; production build, TypeScript and whitespace checks passed. Native VS Code review showed the cancer-only homepage and Explore empty state, and selected Afghanistan plus Kabul through guided intake. The local preview at `http://127.0.0.1:59447/explore` returned 200 after the build; an old fictional offer URL returned 404, a cancer topic page returned 200 and the sitemap was empty. This work did not establish real providers, live bookings, staffing or production readiness.

## Verified catalogue boundary continuation — 2026-11-11

Historical fictional care offers now live in `domains/providers/archivedSampleOffers.ts`, outside the browser-safe public catalogue. `PUBLIC_OFFERS` has no entries and only admits cancer listings with a current source record for provider identity, credentials and the care offer. Its source links and review dates will appear on future offer detail pages. The private archived-plan store can still read old samples, while public pages, planner routes and new writes use the verified-only catalogue. A saved plan for an older or different offer cannot change the public planner's displayed provider. The manual review procedure and its limits are in `docs/provider-verification.md`.

Validation after this boundary change: disposable PostgreSQL regression passed 37 files / 200 tests, with one opt-in real-provider test skipped. Production build, TypeScript and whitespace checks passed. The production client static assets contain neither the historical Miraflores Dental Studio nor Lotus Specialist Review fixture names. This is a source and local-build boundary; future real listings still need external source review and operational approval.
