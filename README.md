# bon-voyage
RegenVen 2.0 Startup Prototype

An AI-guided care-travel journey: a family describes the situation in their own words, and an assistant turns it into a case, then walks them through records, a second opinion, hospital options, a plan and travel prep, with a named coordinator one tap away.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. "Log in → Try a sample case" jumps straight into a filled-in case.

Local development uses Webpack because the installed Turbopack development runtime still produces repeated reloads in the guided journey. `npm run launch` uses the same supported command. Use `npm run dev:turbo` only to investigate that issue; production builds are unchanged.

## The journey

| Route | Step |
| --- | --- |
| `/` | Public home page with the sample-journey globe |
| `/explore` | Public cancer-care search; clinic listings stay hidden until verified |
| `/destinations`, `/treatments` | Worldwide country/territory directory and treatment catalogue |
| `/explore/trip` | Trip planner route; unavailable while no clinic offers are verified |
| `/account/profile`, `/account/security`, `/account/data` | Encrypted profile, passkeys and sessions, planning-data export and data requests |
| `/dev/studio` | Developer-only route and state gallery in local or protected preview environments |
| `/start` | **Your story**: free-text (or "speak") intake. The assistant picks out details live, asks only what's missing, then shows an editable brief |
| `/case/records` | Add files; the assistant reads, sorts and translates them and offers to handle what's missing |
| `/case/second-opinion` | Optional specialist panel review |
| `/case/options` | Hospitals ranked by your priorities, with "why it fits" and the trade-off |
| `/case/flights` | Sample round-trip fares, explained picks, valid-date calendar, bounded widening and selection |
| `/case/booking` | Fresh-price review, sample/test flight booking, holds, reconciliation and manual cancellation requests |
| `/case/stays` | Accessible nearby stays, full rates, quotes, sample/test bookings and property fees |
| `/case/plan` | Trip, who handles each task, AI-drafted changes ("my brother wants to come too"), approve and simulated deposit |
| `/case/dashboard` | Ready to travel: decisions, documents, itinerary and updates |

Signed-in cases autosave to PostgreSQL with encrypted clinical payloads and audited, ownership-scoped writes. The browser keeps an account-scoped working copy; sample cases stay on this device. Development sign-in writes the latest one-time link to the private, gitignored `.bon-voyage/sign-in-link.txt` file; links do not enter ordinary server logs. Hospitals, fares, visa rules and payments remain illustrative. Real health intake is off by default. See [the legal-readiness working draft](docs/legal-readiness-draft.md) and [the roadmap](docs/implementation-roadmap.md).

Developer QA studio access requires `DEV_STUDIO_ENABLED=true`, a signed-in developer role, and a local or protected preview environment. A verified existing coordinator or developer can grant that role through `node --env-file=.env.local tooling/grantDeveloper.mjs <operator-user-id> <verified-target-email>`. The command refuses self-grants and produces an audited role change. The first operator must be provisioned through a separately reviewed owner procedure; there is no browser role-creation flow. The studio is 404 in production.

## Organization

See [CLAUDE.md](CLAUDE.md) for the domain map, dependency rules and working agreements.

- `app/`: thin Next.js routes, metadata and site-wide CSS.
- `domains/`: account, case, marketing, providers, records, pricing and travel capabilities.
- `shared/`: UI and infrastructure used across domains.
- `docs/`: design specifications and implementation plans.
- `public/`: static assets.
- `tooling/`: launcher and database/test configuration.
- `.vscode/`: editor settings that hide generated files and dependency folders.

Package manifests, Next/TypeScript configuration, environment files and project instructions stay at root for standard tool discovery. TypeScript cache lives under `.next/cache/`.

Use `npm run launch` for the full local stack, `npm run launch:status` to inspect it, and `npm run launch:stop` to stop it. Database and test npm commands load their configs from `tooling/`.

The nested `bon-voyage/` directory is a legacy clone and is not part of the active app.

## Assistant

Scripted behavior lives in `domains/case/model/assistant.ts`. The API route delegates to `domains/case/assistantHandler.ts`, using the provider port in `shared/lib/ai`.

AI is opt-in: set `AI_PROVIDER` explicitly to `ollama` or `claude`, along with the corresponding settings listed in `.env.example`. With no provider configured, or when a model fails, the assistant uses scripted answers. The browser client is `domains/case/assistantClient.ts`.

## Validation

```bash
python3 tooling/testDatabase.py
python3 tooling/testDatabase.py --command node tooling/smokeCase.mjs
python3 tooling/testDatabase.py --command node tooling/smokeAccount.mjs
npm run build
```

For the guided mobile intake, save-recovery, plan and generated-price-alert browser checks:

```bash
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs python3 tooling/testDatabase.py --command node tooling/smokeCase.mjs --ui --webpack
```

The disposable runner invokes `npm test` with ephemeral database settings and never loads the development database credentials. Public Explore now shows cancer care topics and all countries, with fictional clinic listings hidden until independent verification. The guided origin selector includes every country and territory. The earlier public Explore and guided-journey browser matrices passed on the documented local Webpack path; [journey acceptance](docs/journey-acceptance-qa.md) records the development reload limitation. The local implementation reaches phase 10 with mocks and test adapters; phase 9/live booking remains blocked. See [the handoff](docs/implementation-handoff.md) for exact completion status and [production readiness](docs/production-readiness.md) for manual gates.
