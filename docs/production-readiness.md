# Production readiness and remaining manual gates

Updated 2026-11-03. The local implementation supports sample flows and test adapters. Phase 9 live booking remains blocked in code (`live_booking_requires_release`); no live booking or real-money payment was made.

## Preview infrastructure (phase 8)

1. Create a Neon PostgreSQL 18 branch with separate `bv_owner` and restricted `bv_app` roles. Use the direct owner URL only for migration; use the pooled app URL for runtime. Follow `booking-pricing-ai-design.md` for grants and timeouts. Apply migrations through `npm run db:migrate`; verify with `npm run audit:verify`.
2. Configure Vercel Pro, project environment and preview protection. The shared `pg.Pool` attaches to Fluid compute via `attachDatabasePool`. Verify transaction-local settings and advisory locks on the actual Neon pooler using `node --env-file=.env.local tooling/verifyProduction.mjs --database` with the preview's environment. This probe only reads data and uses a short read-only/session-setting transaction; it does not mutate application tables.
3. Configure `RESEND_API_KEY`, verified `RESEND_FROM`, HTTPS `BETTER_AUTH_URL`, and an audit-alert recipient. Production magic links use Resend and never print tokens. Preview sign-in, sender-domain delivery and email quotas remain unverified until real setup. Development keeps the console-link flow.
4. Configure `CRON_SECRET`, then Vercel cron authorization. `vercel.json` currently schedules watches at 06:00 UTC and anchoring at 05:00 UTC daily. On Pro, change the watch schedule to `0 */6 * * *` after capacity testing. Re-running one six-hour watch slot is idempotent; each job has a database lease.
5. Configure `AUDIT_ANCHOR_URL` and `AUDIT_ANCHOR_TOKEN` for an HTTPS append-only gateway you control. Its contract is authenticated `POST` of `{ at, checked, headHash, slot }`, with a stable `Idempotency-Key: audit-anchor/<UTC day>`. The gateway must preserve immutable, independently administered entries (for example an object-lock bucket), return success only after durable storage, and deduplicate retries. The application cannot prove that the destination is immutable. No gateway or external anchor has been provisioned here.
6. Configure `AUDIT_ALERT_EMAIL` and rehearse a failed audit/anchor alert with fake data. The email contains no case names, diagnoses, travel routes or tokens.

## Restore and rotation drills (not yet performed against hosting)

- Back up both the database and every required encryption-key version separately. Keep the key backup outside the database backup. Never include key values in tickets or logs.
- Restore into a private disposable branch, configure the matching keys, run migrations and `audit:verify`, then load a fake case through the authenticated API. Compare the restored audit head against the last independently stored external anchor. A valid internal hash chain alone cannot detect a complete owner rewrite.
- Generate a fresh `DATA_KEY`; increase `DATA_KEY_VERSION`; retain previous version keys in `DATA_KEYS_OLD`. Confirm new writes use the new version and old fake cases still decrypt. Re-encryption of existing clinical rows is a separate operator migration; no bulk rotation has been run here.
- Revoke leaked credentials and rotate auth, cron, provider and email secrets independently. Existing sessions and one-time links may need invalidation. Never paste secrets into a handoff.
- If verification fails, pause production patient writes, preserve the affected database and logs, compare to the external anchor and last good backup, and have an operator investigate before restoring service. Do not automatically repair or delete the audit trail.

## Live release (phase 9 — owner/external work)

- Confirm legal advice and patient consent for health-data handling, data retention, seller-of-travel requirements and supported points of sale. This repository does not certify compliance.
- Evaluate the currently configured Claude model against Qwen/scripted answers on fake stories; measure quality, fallback rate and latency. Verify current model availability and retention terms before changing production model settings. No new live Anthropic evaluation has been performed.
- Obtain Duffel live carrier access, billing and balance funding. Confirm the organisation's actual rate headers and current contracted fees (per-order, content, extras and FX); the old roadmap figures are estimates until verified.
- Establish the cancellation/change coordinator process and assistance confirmation process, including holds that expire and ambiguous payments that require provider reconciliation.
- Review and implement the explicit live-booking release gate and live-mode UI copy after the above evidence is recorded. Search can be opted into separately through `DUFFEL_LIVE_ENABLED`; booking remains blocked even when that flag is true.
- A controlled real booking requires the owner's direct participation and an explicit spending limit. None has been attempted.

`node --env-file=.env.local tooling/verifyProduction.mjs` prints boolean configuration checks only. Add `--database` for the non-destructive database probe; add `--live` to show the still-blocked live gate. A passing configuration check is not proof that the manual steps above are complete.

## Stays access (phase 10)

Request Duffel Stays access. `DUFFEL_STAYS_ENABLED=true` enables the test adapter only with a `duffel_test_` token. SDK 4.31.0 confirms the `accessibility_mobility` amenity and `accommodation_special_requests` booking field. Unknown accessibility fails a required mobility filter. Property confirmation is still necessary; an amenity flag is not a clinical suitability assessment.

The route performs search → retrieve full rates → quote → fresh quote before booking. Quote/search expiry is capped locally. A 200-without-resource, 202, 5xx or timeout never permits a second booking submission; the local attempt stays in checking and is reconciled by known booking ID, paginated verified metadata or a signed `stays.booking.created` webhook. No unsupported quote-ID list filter is used. Amounts due at the accommodation retain their own currency; unknown fees remain null and visible. Maximum stay is 99 nights per booking; the UI routes longer stays to a coordinator.
