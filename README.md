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

## The assistant: scripted now, Claude when you're ready

All assistant behaviour lives in `lib/assistant.ts` and runs locally, so the demo needs no API key and never fails on stage.

`app/api/assistant/route.ts` is the switch. When `ANTHROPIC_API_KEY` is set, two tasks go to Claude (`claude-opus-5-5`, structured JSON output):

- **extract**: read the intake story into case details, each with the words it came from
- **change**: classify a plan-change request

Without a key, or if Claude errors or declines, the route answers with the scripted version in the same shape. To try it:

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm run dev
```

The intake's side panel says whether the story was "Read by Claude" or by the on-device demo assistant.

Good next candidates for Claude are the option explanations (`explainOption`) and coordinator replies, both currently scripted.
