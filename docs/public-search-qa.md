# Public Explore acceptance verification

Verified on 10 November 2026 using synthetic accounts, fictional clinic offers, mock flights/stays and a disposable PostgreSQL database. No real clinic, airline, payment or email service was contacted, and the configured development database was not migrated or modified.

## Reproduce

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs python3 tooling/testDatabase.py --command node tooling/smokeExplore.mjs --ui
```

The optional `--browser` flag leaves the successful temporary app/database available for manual review. Stop that runner with Ctrl+C to remove both. The harness uses development Webpack, installed Chrome in headless mode and an isolated browser context; it never uses the user's browser profile. The ordinary HTTP checks do not require Playwright.

The final manual-review preview is `http://127.0.0.1:55189/explore`. It is temporary rather than a deployment. The successful run's machine-readable evidence is [ui-review/explore-check.json](ui-review/explore-check.json).

## Verified behavior

- **Public discovery:** all 249 countries/territories are represented; the treatment synonym `tooth implant` returns the three dental implant offers; filters combine specialty, budget and accessibility; selected filters survive reload. Comparison caps at three even when a fourth ID is supplied in the URL. Pagination and browser back navigation work. Unsupported destinations show an honest empty state.
- **Trip planning:** a signed-out visitor selects a sample return flight and nearby stay; both appear in the planner and its known subtotal. Changing travellers removes both selections and results. The same selection flow works at 390 pixels. Unknown charges remain separated from the subtotal by the source estimate model; the UI labels unselected travel and sample pricing.
- **Authentication and saving:** choices and the displayed subtotal survive a magic link opened in a new tab. Same-tab magic-link restoration was also tested. Authentication alone neither saves a trip nor submits a request. Explicit save persists the chosen draft; repeated submission records only one sample care request, and the account screen shows its trip and request.
- **Recovery:** an aborted save request displays a connection/retry explanation, preserves the edited party size and succeeds when retried after the connection is restored.
- **Draft isolation:** explicit anonymous resume wins over an older same-offer account draft. Switching the live session to another account while the previous saved trip remains mounted clears its choices, disables save and leaves the old-account, new-account and anonymous caches uncontaminated. This uses the actual session visibility-refresh mechanism, without remounting the page before the ownership failure.
- **Mobile controls:** the native filter drawer opens, accepts filters, closes with Escape, restores keyboard focus to its trigger and submits its single set of controls. The compact subtotal remains fixed on mobile, matches the full summary and links to the review heading.
- **Routes and accessibility smoke:** Explore, destination/treatment directories, an unsupported country, offer details and the planner were inspected at 1440 and 390 pixels. No horizontal document overflow or browser runtime errors occurred. Matter loads, keyboard entry reaches an interactive element and the pages render with reduced motion enabled.
- **Existing journey:** the separate `/start` intake still renders its story field. A fresh guest can enter a sample case and view Options, Flights and Plan without being redirected to login; these routes have no document overflow at the tested desktop width.
- **HTTP ownership and data protection:** public travel works without authentication, while plan writes require it. A second account receives 404 for the first account's saved plan and an empty owned list. Identical saves keep their revision; repeated requests with distinct attempt IDs return the same request. Raw plan/request rows contain no plaintext treatment or departure selection, audit changes redact the encrypted fields and the audit hash chain verifies cleanly.
- **Indexing preparation:** sample search and empty destinations emit `noindex, follow`; canonical metadata is present; sample offer IDs are absent from the sitemap. Production indexing and real search-engine discovery are not claimed by this local test.

## Visual evidence

- [Desktop Explore](ui-review/explore-1440.png)
- [Mobile Explore](ui-review/explore-390.png)
- [Desktop trip planner](ui-review/explore-planner-desktop.png)
- [Mobile trip planner](ui-review/explore-planner-mobile.png)
- [Saved trips and sample requests](ui-review/explore-account-desktop.png)

## Limits

This acceptance pass covers the sample public flow and a basic existing-journey regression, not real provider inventory, clinical suitability, real quote changes, production-browser performance, external email delivery or live booking. Full keyboard/screen-reader accessibility certification and the older outstanding journey/provider/hosting acceptance matrix remain separate work. Existing real-provider and public-release gates are unchanged.
