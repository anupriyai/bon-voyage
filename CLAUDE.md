@AGENTS.md

# Bon Voyage (RegenVen)

This file is the single source of project context and structure rules. Read it before creating, moving, or renaming anything.

## Mission

Empower patients in underserved regions with seamless, trusted, transparent end-to-end international medical travel: specialist discovery, medical record sharing, travel arrangements, and transparent pricing.

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
- `npm run dev`: dev server only (port 3000).
- `npm test`: Vitest (database tests use `TEST_DATABASE_*` from `.env.local` and skip without them).
- `npm run build`: production build. Run it, and `npm test`, before declaring work done.
- `npm run db:generate` / `npm run db:migrate`: Drizzle migrations (run as the owner role). `npm run audit:verify`: check the audit hash chain.

Design and decisions: `docs/booking-pricing-ai-design.md`.

## Architecture: domain-driven

Organize code by **business domain**, not by technical layer. Each domain owns its UI, logic, and types. `app/` stays a thin routing layer that composes domains.

Domains (from the strategic bets). Create a domain folder only when its first real code arrives:

| Domain | Owns |
|---|---|
| `case` | Patient case flow: intake, options, plan, second opinion, dashboard |
| `records` | Medical record sharing and consent |
| `providers` | Hospitals, specialists, credentials, local referrals |
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
- `account` owns authentication, roles, login and account screens; `records` owns the record-upload screen; `marketing` owns the landing page.
- `pricing` owns flight search, date windows, ranking and price watch; `travel` owns fare types, flight providers and alternate airports.
- `shared/ui` contains reusable assistant presentation, icons, globe and currency menu. `shared/lib` contains formatting, currency context, the AI provider port and database infrastructure.
- `domains/case/index.ts` is the browser-safe public surface used by other domains. Server handlers, auth and database modules must not be re-exported through it.
- `app/` contains route composition, metadata and global styling (`app/bv.css`); the assistant endpoint delegates to the case domain.
- The demo catalogue and calculations remain together in `case` to preserve their existing behavior. Extract provider, pricing or record rules incrementally when those business capabilities change.
- `bon-voyage/` is an untracked old clone, excluded from TypeScript and tests. Don't edit it.
- Root files are limited to package manifests, Next/TypeScript config, environment files, Git rules and project instructions. Next.js regenerates `next-env.d.ts` here; editor settings hide it and generated folders. TypeScript stores incremental cache in `.next/cache/tsconfig.tsbuildinfo`.
- `tooling/launch.py` resolves the project root from its location. Run Vitest and Drizzle through npm scripts, which select their configs under `tooling/`.

### Conventions

- **Writes go through `withActor`** (`shared/lib/db`). Audited tables have triggers that refuse un-attributed writes and log every change to the hash-chained `audit.log`. A new table holding personal or health data needs an audit trigger in a migration, with its sensitive columns listed for redaction. No network calls inside `withActor`.
- **Health details are encrypted** with `seal`/`open` (`shared/lib/db/crypto.ts`), using the case id as context. Never store them in plain text or put them in logs.
- **AI is opt-in:** `AI_PROVIDER` must be set explicitly; with it unset the scripted assistant answers. Every model answer goes through a lenient zod schema and can fall back to scripted.
- **Flight searches are scarce** (Duffel allows about 10 a minute for everyone). Default to one round-trip search; anything more must be opt-in and budgeted.
- **Money comparisons stay in one currency**, and include fees and ground transfers.

### Dependency rules

- `app/` may import from any domain and `shared/`.
- A domain may import from `shared/` and from another domain's **public surface only** (its `index.ts`). Never reach into another domain's internals.
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
8. **Styles.** Reuse existing CSS. Add a new file only for a genuinely new area.
9. **Update this file** when you add a domain, folder, or convention.

## CLAUDE.md files

Only this root `CLAUDE.md` exists. Do not create nested `CLAUDE.md` files in subfolders. claude-mem's per-folder context files are disabled and gitignored (`*/**/CLAUDE.md`), and claude-mem data lives in `~/.claude-mem/`, outside the repo and local-only.

## Working agreements

- Keep changes minimal and match surrounding code style.
- Don't commit or push unless asked.
- Don't add secrets. Real values go in `.env.local` (gitignored); `.env.example` lists the variables with no values.
- Patient health data is sensitive: use clearly fake sample data, and never log or hardcode real patient information.
