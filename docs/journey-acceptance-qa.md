# Guided journey acceptance verification

Verified on 10 November 2026 with synthetic patients/accounts, sample travel providers and a disposable PostgreSQL cluster. The configured development database was not changed. No real clinic, airline, payment or email service was contacted.

## Reproduce

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs python3 tooling/testDatabase.py --command node tooling/smokeCase.mjs --ui --webpack
```

The harness uses installed Chrome in a separate headless browser context. It restarts its own Next.js child on the same temporary port/database with a lower sample-flight price factor to exercise a real watch recheck. The runner cleans up its temporary services on exit. `--browser` can deliberately leave the successful temporary app/database available until that runner is stopped. No authentication links or credentials are printed by the normal acceptance run.

## Verified behavior

- **Generated price-drop alert:** a watch was created through the authenticated API against the initial search. After restarting the local sample provider at half its former price factor, the protected scheduled-job route generated one lower-fare alert. Replaying the job did not duplicate it. The signed-in 390px flight screen displayed the actual alert amount returned by that job; no alert row was manually inserted.
- **Full new mobile journey:** a fresh guest entered a synthetic story at 390px, completed the remaining questions, reviewed the brief and created a case. A magic link adopted that case into its own account. The visitor selected a hospital, searched patient-and-companion flights, chose a fare and reached the plan. A newly created case did not inherit the earlier case's price alert.
- **Saving unavailable:** aborting case-save requests preserved the edited treatment duration and displayed the working-copy warning. Cancelling the reload confirmation retained those choices. After restoring the connection, keyboard navigation to Retry saving persisted the same duration to the owned case.
- **Flight search recovery:** an aborted flight-search request produced a readable connection/retry message rather than a raw browser exception. A subsequent successful search restored selectable fares.
- **Plan completion:** the visitor changed task ownership, drafted a proposed change and dismissed it, explicitly reviewed the plan, completed simulated approval and reached the dashboard. No real deposit, booking or coordinator message was sent.
- **Responsive and keyboard smoke:** intake editing, Options, Flights, Plan and Dashboard had no horizontal document overflow at 320, 390 and 768 pixels. The coordinator dialog received focus when opened; Escape closed it and restored focus to its trigger. No browser runtime exceptions occurred in the reduced-motion acceptance context.
- **Existing HTTP contracts:** the same run exercised development magic-link authentication, ownership-scoped save/reload, stale-revision rejection, sample flight search/widening, encrypted clinical payloads, the audit hash chain, duplicate-safe mock flight booking, watch creation, mock stay quote/booking, protected job routes and sign-out.

The final completed Webpack run is recorded in [ui-review/journey-continuation-webpack-check.json](ui-review/journey-continuation-webpack-check.json), checked at `2026-11-11T00:56:10Z` (10 November in California). Bundler-specific evidence filenames prevent a diagnostic run from overwriting that successful result. The earlier unqualified `journey-continuation-check.json` records the first successful Webpack pass.

## Changes supported by review and acceptance

- Price-watch state is scoped to its case and selected search/fare; superseded list requests are cancelled and delayed mutations cannot update an unmounted panel. In particular, changing the selected fare while Watch this fare awaits a case save invalidates that pending create before it can post the old selection. Mutation buttons remain disabled while an update is pending.
- Flight search preserves readable validation/provider errors, gives a connection/retry explanation for transport or parsing failures, and rejects stale-context errors. Invalid traveller input cannot allocate an unbounded number of companion controls before form validation.
- The coordinator panel uses a native modal dialog for focus containment, Escape and focus return, with the existing visual styling and restored background scrolling after close.

## Development reload investigation

Cold development runs occasionally reloaded the intake document while a route compiled, losing its in-progress React state without an application runtime exception. The diagnostic stream showed repeated HMR `sync` messages rather than an explicit `reloadPage` message.

The installed Webpack development implementation contains a relevant path: `node_modules/next/dist/server/dev/hot-middleware.js:166` broadcasts a new connection's `SYNC` message through all clients (`:224–228`). In `node_modules/next/dist/client/dev/hot-reloader/app/web-socket.js:90–97`, a later differing `SYNC` hash calls `window.location.reload()`; that variable is not updated by ordinary `BUILT` messages. A new development client after lazy compilation can therefore cause an existing client's full reload. This source evidence explains a mechanism consistent with the observed Webpack diagnostics; it does not prove every historical reload had the same cause.

The acceptance harness warms `/start` and the scripted assistant endpoint before the new-intake browser context and closes the completed alert-review context first. The successful acceptance result above covers warmed Webpack development. Local `npm run dev` now explicitly selects `next dev --webpack`, so the normal launcher uses this verified path; `npm run dev:turbo` retains `next dev --turbopack` for diagnosis. Both flags were confirmed in the installed CLI help and Next.js CLI guide. Production build configuration, dependencies and `node_modules` are unchanged.

The separate default-Turbopack run did **not** pass: its protected HTTP job generated the expected alert, but the initial watched Flights page repeatedly reloaded and did not retain the visible alert panel before the browser timeout. That happened despite the same route warmup. Its cause remains unresolved. Turbopack's installed server path sends a constant empty `SYNC` hash to the connecting client (`node_modules/next/dist/server/dev/hot-reloader-turbopack.js:1351–1398`), so the Webpack hash-broadcast explanation must not be applied to that failure. Development acceptance remains qualified to the successful Webpack path.

The final smoke assertion waits for the successful case-save PUT response before reading the saved duration. A disappearing Retry saving button only means saving has started; it does not prove the write committed. The earlier harness failure at that point was corrected without changing application save behavior.

## Regression status

The full disposable regression suite passes **36 test files / 199 tests**, with one explicitly opt-in real-provider test skipped. The final production build passed after the selected-fare watch guard; TypeScript, migration metadata and whitespace checks also pass. The read-only readiness check still reports missing external provider, email, HTTPS and immutable-anchor setup; this local acceptance result does not satisfy those release gates.

## Visual evidence

- [Generated price-drop alert](ui-review/journey-continuation-price-drop.png)
- [Mobile intake brief](ui-review/journey-continuation-mobile-brief.png)
- [Mobile flight choices](ui-review/journey-continuation-mobile-flights.png)
- [320px journey](ui-review/journey-continuation-320.png)
- [390px journey](ui-review/journey-continuation-390.png)
- [768px journey](ui-review/journey-continuation-768.png)

## Limits

This is synthetic local acceptance, not verified clinical suitability, real provider pricing, actual email delivery, production-browser performance or full assistive-technology certification. Cold development HMR stability is not claimed. Real-provider, hosted operations and public-release gates in the implementation handoff remain separate work.
