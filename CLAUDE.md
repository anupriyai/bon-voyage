@AGENTS.md

# Bon Voyage (RegenVen)

This file is the single source of project context and structure rules. Read it before creating, moving, or renaming anything.

## Mission

Empower patients in underserved regions with clear, trusted international cancer care planning: specialist discovery, medical record sharing, travel arrangements, and transparent pricing.

## Stakeholders

- **Patients and caregivers**: want affordable, high-quality care abroad and clear guidance.
- **International hospitals and specialists**: want more international patients and smooth care coordination.
- **Local doctors and clinics**: recommend trusted options and help with follow-up care.
- **Insurers and payment partners**: enable cross-border coverage verification and secure payments.

## Strategic bets (what the product must prove)

1. **Trust and quality**: patients seek care abroad when backed by reliable local referrals and verified credentials.
2. **Full-service value**: patients prefer one platform for flights, lodging, medical records, and hospital care over a directory listing.
3. **Hospital capacity and data sharing**: partner hospitals want international patients and can exchange records.
4. **Pricing transparency**: clear out-of-pocket estimates and low intermediary margins drive adoption.

Features should map to one of these bets. If a change doesn't, question it.

## Current roadmap

- User interviews across patients, local doctors, and caregivers.
- Platform workflows for booking travel alongside hospital appointments.
- Guidelines for medical record sharing and cross-border payments.

## Stack and commands

Next.js 16 (App Router), React, TypeScript, zod 4. Next.js here has breaking changes, so follow AGENTS.md and read `node_modules/next/dist/docs/` before writing framework code (e.g. `middleware.ts` is now `proxy.ts`).
Postgres 18 (Postgres.app locally, Neon later) via Drizzle; Better Auth for sign-in; Ollama (Qwen) or Claude for the assistant; Duffel for flights (mock until a token is set).

- `npm run launch`: starts the app, Postgres and Ollama, opens the browser, and shows a live panel (memory/CPU, keys to stop each). `q`, Ctrl+C or closing the terminal stops everything. Also `npm run launch:status` / `npm run launch:stop`. Stop services when not in use: the user's Mac is 16 GB.
- `npm run dev`: dev server only (port 3000), explicitly using Webpack. The launcher uses this same command. `npm run dev:turbo` retains the default-Turbopack diagnostic path; its repeated development reloads are unresolved, so it is not the supported local workflow yet. Production build remains unchanged.
- `npm test`: Vitest (database tests use `TEST_DATABASE_*` from `.env.local` and skip without them).
- `npm run price-watch`: trigger the protected watch job on the running local app. `npm run production:check`: read-only configuration checklist; use `-- --database` for the optional database probe. A nonzero readiness result is expected until external setup is complete.
- `npm run build`: production build. Run it, and `npm test`, before declaring work done.
- `python3 tooling/testDatabase.py`: full tests in a disposable private PostgreSQL cluster. `python3 tooling/testDatabase.py --command node tooling/smokeCase.mjs`: actual Next.js auth/case/search HTTP smoke using fake data. Add `--ui --webpack` with `PLAYWRIGHT_MODULE` pointing to installed Playwright for the guided mobile/price-alert browser matrix. Both stop and remove their test services; prefer these over configured-database tests.
- `npm run db:generate` / `npm run db:migrate`: Drizzle migrations (run as the owner role). `npm run audit:verify`: check the audit hash chain.

Design and decisions: `docs/booking-pricing-ai-design.md`.

## Architecture: domain-driven

Organize code by **business domain**, not by technical layer. Each domain owns its UI, logic, and types. `app/` stays a thin routing layer that composes domains.

Domains (from the strategic bets). Create a domain folder only when its first real code arrives:

| Domain | Owns |
|---|---|
| `case` | Patient case flow: intake, options, plan, second opinion, dashboard |
| `records` | Medical record sharing and consent |
| `providers` | Public destinations, treatment and clinic catalogue, sample care plans and enquiries; future verified hospitals, credentials and referrals |
| `pricing` | Out-of-pocket estimates, margins, cross-border payments |
| `travel` | Flights, lodging, booking alongside appointments |
| `account` | Login, profile, caregiver and doctor roles |
| `marketing` | Landing page (hero, how it works, principles, CTA) |

Use the same words as the table in code and folder names (ubiquitous language). Don't invent synonyms like `client` for `patient`.

### Layout

```
app/                 Routing only. page.tsx/layout.tsx import from domains. No business logic.
domains/<domain>/    Everything for one domain. Create subfolders only when needed:
  components/          UI used by this domain
  model/               Types, rules, calculations (pure TS, no React)
  data/                Static or sample data for this domain
shared/              Used by 2+ domains: ui/ (buttons, icons), lib/ (format helpers)
public/              Static assets
docs/                Specs and implementation plans only
tooling/             Launcher and database/test tool configuration
.vscode/             Shared editor settings
```

Current state:
- `case` owns intake, case state, the scripted assistant, demo case catalogue, option/plan calculations, second opinion, dashboard, and journey navigation. UI is in `components/`, pure logic in `model/`, sample data in `data/`, and browser state in `state/`.
- `account` owns authentication, roles, magic-link login/account screens and hashed-key database auth throttling; `records` owns the record-upload screen; `marketing` owns Home, About, How It Works, Help/Contact and privacy-information pages, with shared navigation/footer in `SiteChrome.tsx`.
- `providers` owns the public cancer care taxonomy and search, worldwide country directory, archived fictional fixtures, independent care trip planner and encrypted saved plans/requests. Public discovery and new plans/requests accept only verified cancer listings; there are currently none. These plans do not extend the guided oncology case schema. Public catalogue exports stay browser-safe; `domains/providers/server.ts` owns authenticated persistence handlers. Sample care requests freeze their selected offer/travel snapshot and never contact a clinic or reserve travel.
- `pricing` owns case-to-flight search orchestration, date windows, ranking, planning FX, persisted watches/alerts, provider quota limits and completed-day email digests. UI is in `components/`; server infrastructure has a separate `server.ts` entry.
- `travel` owns Flights/Booking/Stays screens, airport/fare/provider ports, cached Duffel search, durable booking/payment claims, transport/reconciliation, signed webhooks, coordinator tasks, search/quote snapshots and Stays accessibility/rate/quote flows. `duffelProvider.ts` is the only SDK import; monetary writes use `duffelTransport.ts`. The encrypted case holds validated flight/stay planning selections, not booking documents.
- `shared/ui` contains reusable assistant presentation, icons, globe and currency menu. `shared/lib` contains formatting, currency context, the AI provider port and database infrastructure.
- `domains/case/index.ts` is the browser-safe public surface used by other domains. Server handlers, auth and database modules must not be re-exported through it.
- Saved cases use ownership-scoped API routes, encrypted payloads and revisions. Browser autosave is serialized and debounced; account-scoped local storage is a working copy. Conflicts require an explicit remote reload. The persisted case schema is strict: add validated fields there before extending state; arbitrary passport/document fields are rejected. Sample cases stay local and do not create authenticated sessions.
- Public entry points are explicit: browser case API `domains/case/index.ts`; server case API `domains/case/server/index.ts`; browser account API `domains/account/client.ts`; server account API `domains/account/index.ts`; account database-schema API `domains/account/schema/index.ts` (schema imports without authentication initialization); browser travel API `domains/travel/index.ts`; server travel API `domains/travel/server.ts`; browser pricing API `domains/pricing/index.ts`; server pricing limits API `domains/pricing/server.ts`; browser provider catalogue/plan types `domains/providers/index.ts`; server care persistence `domains/providers/server.ts`.
- Root `proxy.ts` performs optimistic case navigation checks only. The demo cookie permits local sample navigation; every API still authenticates the real session.
- `app/` contains route composition, metadata and global styling (`app/bv.css`); the assistant endpoint delegates to the case domain.
- The demo catalogue and calculations remain together in `case` to preserve their existing behavior. Extract provider, pricing or record rules incrementally when those business capabilities change.
- `bon-voyage/` is an untracked old clone, excluded from TypeScript and tests. Don't edit it.
- Root files are limited to package manifests, Next/TypeScript config and Proxy, Vercel cron configuration, environment files, Git rules and project instructions. Next.js regenerates `next-env.d.ts` here; editor settings hide it and generated folders. TypeScript stores incremental cache in `.next/cache/tsconfig.tsbuildinfo`. Generated `.next/types` copies containing spaces (created by iCloud conflict resolution) are excluded from type checking; canonical generated files remain included.
- `tooling/launch.py` resolves the project root from its location. Run Vitest and Drizzle through npm scripts, which select their configs under `tooling/`.

### Conventions

- **Writes go through `withActor`** (`shared/lib/db`). Audited tables have triggers that refuse un-attributed writes and log every change to the hash-chained `audit.log`. A new table holding personal or health data needs an audit trigger in a migration, with its sensitive columns listed for redaction. No network calls inside `withActor`.
- **Health details are encrypted** with `seal`/`open` (`shared/lib/db/crypto.ts`), using the case id as context. Never store them in plain text or put them in logs.
- **AI is opt-in:** `AI_PROVIDER` must be set explicitly; with it unset the scripted assistant answers. Every model answer goes through a lenient zod schema and can fall back to scripted.
- **Flight searches are scarce** (Duffel allows about 10 a minute for everyone). Default to one round-trip search; anything more must be opt-in and budgeted.
- **Provider modes are explicit:** no flight token uses labelled samples; test tokens use the Duffel adapter. `DUFFEL_BOOKING_ENABLED` and `DUFFEL_STAYS_ENABLED` opt into test operations. Live booking remains blocked in code pending phase 9. Never automatically retry ambiguous writes; only a fast, documented 503 can retry once within the route time budget. Passport numbers are passed directly to Duffel, never persisted or logged.
- **Public Explore is cancer-only and verified-listings-only:** fictional clinic fixtures remain for isolated historical tests but are hidden from public search, details, travel endpoints and new plan/request writes. Until real clinics and prices are independently checked, every country shows no verified listings and the public trip planner has no eligible offer. If verified inventory is added, case-independent flight/stay services still use labelled mocks regardless of provider tokens. Account-owned `care_plans` and `care_requests` hold sealed payloads with audit-redacted encryption fields. Temporary anonymous planning contains no medical free text or personal/payment/document details. A listing never establishes treatment suitability, appointment dates, recovery duration or fitness to fly. The guided origin selector includes all 249 countries and territories; unfamiliar origins use an explicitly labelled placeholder travel route and entry requirements remain to confirm.
- **Jobs and notifications:** authenticated cron routes use constant-time secret comparison, database leases and schedule-slot dedupe. Network calls are outside transactions. Digests cover the previous completed UTC day, contain only a count and account link, and reuse their frozen payload/idempotency key. External audit storage must be administered separately and be immutable.
- **Money comparisons stay in one currency**, and include fees and ground transfers.

### Dependency rules

- `app/` may import from any domain and `shared/`.
- A domain may import from `shared/` and from another domain's **public surface only** (the explicit browser/server entry points listed above, or its `index.ts`). Never reach into another domain's internals.
- `shared/` imports from nothing in the project.
- `model/` never imports React.

## Anti-sprawl rules

1. **Create folders only when needed.** Don't pre-create empty domain folders or placeholder files. A folder appears when its first file does. Subfolders (`components/`, `model/`, `data/`) appear only once a domain has enough files to need them. Until then keep files flat in the domain.
2. **Never add a new top-level folder** without asking the user. Allowed: `app/`, `domains/`, `shared/`, `public/`, `docs/`, `tooling/`, and `.vscode/`. The root-file organization request authorizes `tooling/` and `.vscode/`; keep launcher and database/test configs in `tooling/`.
3. **Check before creating.** Search for an existing file that does the job and extend it.
4. **Placement test:** which domain owns this? Put it there. Used by two or more domains? Move it to `shared/`. Unsure? Ask.
5. **Naming.** Components `PascalCase.tsx`, other files `camelCase.ts`, route folders `kebab-case`, domain folders lowercase singular or plural as in the table. No `final`, `new`, `v2`, `copy`, or `old` in names.
6. **No dead files.** Delete unused code. Git keeps history.
7. **No stray docs.** Project knowledge goes in this file. Specs and plans go in `docs/`, never scattered `NOTES.md` or `TODO.md`.
8. **Styles.** Reuse existing CSS. Add a new file only for a genuinely new area. The app uses a continuous light ivory surface, navy text, teal actions and mint/sand accents, with Matter typography from the selected Miljøfyrtårn reference. Fonts live in `public/fonts/`. `shared/ui/PageMotion.tsx` handles viewport reveals and honours reduced motion; the existing geographic canvas globe remains interactive. Preserve contrast in selected, warning and disabled states. Font redistribution approval is a separate public-release gate.
9. **Update this file** when you add a domain, folder, or convention.

## CLAUDE.md files

Only this root `CLAUDE.md` exists. Do not create nested `CLAUDE.md` files in subfolders. claude-mem's per-folder context files are disabled and gitignored (`*/**/CLAUDE.md`), and claude-mem data lives in `~/.claude-mem/`, outside the repo and local-only.

## Working agreements

- Keep changes minimal and match surrounding code style.
- Don't commit or push unless asked.
- Don't add secrets. Real values go in `.env.local` (gitignored); `.env.example` lists the variables with no values.
- Patient health data is sensitive: use clearly fake sample data, and never log or hardcode real patient information.
