# bon-voyage
RegenVen 2.0 Startup Prototype

An AI-guided care-travel journey: a family describes the situation in their own words, and an assistant turns it into a case, then walks them through records, a second opinion, hospital options, a plan and travel prep, with a named coordinator one tap away.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. "Log in → Try a sample case" jumps straight into a filled-in case.

## The journey

| Route | Step |
| --- | --- |
| `/` | Public home page with the sample-journey globe |
| `/start` | **Your story**: free-text (or "speak") intake. The assistant picks out details live, asks only what's missing, then shows an editable brief |
| `/case/records` | Add files; the assistant reads, sorts and translates them and offers to handle what's missing |
| `/case/second-opinion` | Optional specialist panel review |
| `/case/options` | Hospitals ranked by your priorities, with "why it fits" and the trade-off |
| `/case/plan` | Trip, who handles each task, AI-drafted changes ("my brother wants to come too"), approve and simulated deposit |
| `/case/dashboard` | Ready to travel: decisions, documents, itinerary and updates |

Everything is saved in the browser (`localStorage`). Providers, prices and visa rules are sample data.

## Organization

See [CLAUDE.md](CLAUDE.md) for the domain map, dependency rules and working agreements.

- `app/`: thin Next.js routes, metadata and site-wide CSS.
- `domains/`: account, case, marketing, records, pricing and travel capabilities.
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
npm test
npm run build
```

Database tests skip unless the test database settings are configured.
