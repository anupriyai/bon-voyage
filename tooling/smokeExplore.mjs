// Run through tooling/testDatabase.py. Only disposable, fake-data accounts and sample APIs are used.
// Optional UI checks: PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs ... --ui
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { Pool } from "pg";

assert.equal(process.env.BON_VOYAGE_ISOLATED_TESTS, "1", "Requires the disposable database runner");
const reservation = createServer();
await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(port)], { env: { ...process.env, BETTER_AUTH_URL: base }, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => { output = (output + chunk).slice(-150000); });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
let cookie = "";
let browser;
const checks = [];
function readLink() { try { return readFileSync(process.env.DEV_MAGIC_LINK_CAPTURE_FILE, "utf8").trim(); } catch { return ""; } }
async function api(path, method = "GET", body, authCookie = cookie) {
  return fetch(base + path, { method, headers: { ...(authCookie ? { cookie: authCookie } : {}), origin: base, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), redirect: "manual" });
}
async function json(path, method = "GET", body, authCookie = cookie) {
  const response = await api(path, method, body, authCookie);
  assert.equal(response.status, 200, `${method} ${path}: ${await response.clone().text()}`);
  return response.json();
}
async function signIn(email, callbackURL = "/account") {
  output = "";
  await json("/api/auth/sign-in/magic-link", "POST", { email, callbackURL }, "");
  let link;
  for (let i = 0; i < 60; i++) { link = readLink(); if (link) break; await sleep(100); }
  assert.ok(link, "Development magic link was not emitted");
  const response = await fetch(link, { redirect: "manual" });
  assert.equal(response.status, 302);
  return response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
}
async function pageHtml(path) {
  const response = await api(path, "GET", undefined, "");
  assert.equal(response.status, 200, path);
  return (await response.text()).replace(/<!--[\s\S]*?-->/g, "");
}
try {
  for (let i = 0; i < 180; i++) {
    try { if ((await api("/api/auth/get-session")).ok) break; } catch {}
    if (child.exitCode !== null || i === 179) throw new Error("Disposable development server did not become ready");
    await sleep(250);
  }
  console.log(`Disposable Explore preview starting: ${base}/explore`);
  const explore = await pageHtml("/explore");
  assert.ok(/249 countries/.test(explore), "Worldwide directory count");
  assert.ok(/name="robots" content="noindex, follow"/.test(explore), "Sample search must be noindex");
  assert.ok(/rel="canonical"/.test(explore), "Canonical metadata");
  const dental = await pageHtml("/explore?q=tooth%20implant");
  assert.ok(/3 care options/.test(dental), "Treatment synonym search");
  const empty = await pageHtml("/destinations/afghanistan");
  assert.ok(/No listed care options match this search/.test(empty), "Unsupported destination must show an honest empty state");
  assert.ok(/noindex, follow/.test(empty), "Empty country must be noindex");
  const detail = await pageHtml("/explore/offers/lima-dental-implants");
  assert.ok(/href="\/explore\/trip\?offer=lima-dental-implants/.test(detail), "Offer planning action");
  const sitemap = await pageHtml("/sitemap.xml");
  assert.ok(!sitemap.includes("lima-dental-implants"));
  assert.equal((await api("/api/explore/plans")).status, 401);
  const draft = { offerId: "lima-dental-implants", from: "JFK", out: day(30), back: day(42), travellers: 1, flightId: null, stayQuoteId: null };
  const { fares } = await json("/api/explore/flights", "POST", { offerId: draft.offerId, from: draft.from, out: draft.out, back: draft.back, travellers: 1 }, "");
  const { stays } = await json("/api/explore/stays", "POST", { offerId: draft.offerId, out: draft.out, back: draft.back, travellers: 1 }, "");
  assert.ok(fares.length && stays.length);
  assert.equal((await api("/api/explore/flights", "POST", { offerId: draft.offerId, from: "JFK", out: "2027-02-30", back: day(42), travellers: 1 }, "")).status, 400);
  assert.equal((await api("/api/explore/plans", "PUT", { draft }, "")).status, 401);
  draft.flightId = fares[0].id; draft.stayQuoteId = stays[0].quote.quoteId;
  cookie = await signIn("explore-http-owner@example.com");
  const { plan } = await json("/api/explore/plans", "PUT", { draft });
  assert.deepEqual((await json(`/api/explore/plans?id=${plan.id}`)).plan.draft, draft);
  const repeated = (await json("/api/explore/plans", "PUT", { id: plan.id, revision: plan.revision, draft })).plan;
  assert.equal(repeated.revision, plan.revision);
  const input = { planId: plan.id, revision: plan.revision, attemptId: randomUUID() };
  const first = (await json("/api/explore/requests", "POST", input)).request;
  const second = (await json("/api/explore/requests", "POST", { ...input, attemptId: randomUUID() })).request;
  assert.equal(first.id, second.id);
  assert.match(first.message, /No clinic was contacted/);
  const strangerCookie = await signIn("explore-http-stranger@example.com");
  assert.equal((await api(`/api/explore/plans?id=${plan.id}`, "GET", undefined, strangerCookie)).status, 404);
  assert.equal((await json("/api/explore/plans", "GET", undefined, strangerCookie)).plans.length, 0);
  const raw = JSON.stringify((await pool.query("select * from care_plans union all select id, owner_id, plan_revision, ciphertext, iv, auth_tag, key_version, created_at, created_at from care_requests")).rows);
  assert.ok(!raw.includes(draft.offerId) && !raw.includes("JFK"));
  const audit = JSON.stringify((await pool.query("select changed from audit.log where table_name in ('care_plans','care_requests')")).rows);
  assert.ok(!audit.includes(draft.offerId) && audit.includes("redacted"));
  assert.equal((await pool.query("select * from audit.verify()")).rows[0].first_bad_id, null);
  checks.push("HTTP: public routes and sample travel; authenticated encrypted save/reload; owner isolation; duplicate-safe requests; redacted valid audit chain; sample SEO exclusions");

  if (process.argv.includes("--ui")) {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1024 } });
    const page = await context.newPage();
    const errors = [];
    context.on("page", (p) => p.on("pageerror", (error) => errors.push(error.message)));
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base + "/explore");
    await page.getByRole("heading", { name: /Find your care/ }).waitFor();
    await page.locator('input[name="q"]').fill("tooth implant");
    await page.getByRole("button", { name: "Search care", exact: true }).click();
    await page.getByRole("heading", { name: "3 care options", exact: true }).waitFor();
    for (let i = 0; i < 3; i++) {
      await page.getByRole("link", { name: /Add .* to comparison/ }).first().click();
      await page.waitForFunction((count) => document.querySelectorAll(".explore-compare-grid article").length === count, i + 1);
    }
    assert.equal(await page.locator(".explore-compare-grid article").count(), 3);
    await page.goto(base + "/explore?compare=lima-dental-implants,guadalajara-dental-implants,istanbul-dental-implants,bangkok-screening");
    assert.equal(await page.locator(".explore-compare-grid article").count(), 3);
    await page.goto(base + "/explore?country=AF");
    await page.getByRole("heading", { name: "No listed care options match this search." }).waitFor();
    await page.goto(base + "/explore?specialty=dental&max=3500&accessible=1&sort=price");
    assert.equal(await page.locator(".explore-offer").count(), 2);
    await page.reload();
    assert.equal(await page.locator('select[name="specialty"]').inputValue(), "dental");
    await page.goto(base + "/explore");
    await page.getByRole("link", { name: "Next →", exact: true }).click();
    await page.waitForURL(/page=2/);
    assert.match(page.url(), /page=2/);
    await page.goBack();
    await page.waitForURL((url) => !url.searchParams.has("page"));
    assert.ok(!page.url().includes("page=2"));
    await mkdir("docs/ui-review", { recursive: true });
    await page.screenshot({ path: "docs/ui-review/explore-desktop.png", fullPage: true });
    const tripQuery = new URLSearchParams({ offer: draft.offerId, from: "JFK", out: day(30), back: day(42), travellers: "1" });
    await page.goto(`${base}/explore/trip?${tripQuery}`);
    await page.getByRole("button", { name: "Compare sample flights", exact: true }).waitFor();
    await page.getByRole("button", { name: "Compare sample flights", exact: true }).click();
    await page.locator(".planner-results").first().getByRole("button", { name: "Add to plan", exact: true }).first().click();
    await page.getByRole("button", { name: "Compare sample stays", exact: true }).click();
    await page.locator(".planner-stay-results").getByRole("button", { name: "Add to plan", exact: true }).first().click();
    assert.equal(await page.locator(".planner-selection").count(), 2);
    await page.getByRole("combobox", { name: /^Travellers/ }).selectOption("2");
    assert.equal(await page.locator(".planner-selection").count(), 0);
    await page.getByRole("combobox", { name: /^Travellers/ }).selectOption("1");
    await page.getByRole("button", { name: "Compare sample flights", exact: true }).click();
    await page.locator(".planner-results").first().getByRole("button", { name: "Add to plan", exact: true }).first().click();
    await page.getByRole("button", { name: "Compare sample stays", exact: true }).click();
    await page.locator(".planner-stay-results").getByRole("button", { name: "Add to plan", exact: true }).first().click();
    const before = await page.locator(".planner-total strong").innerText();
    await page.screenshot({ path: "docs/ui-review/explore-planner-desktop.png", fullPage: true });
    await page.getByRole("link", { name: "Sign in to save plan", exact: true }).click();
    await page.getByLabel("Email", { exact: true }).fill("explore-browser@example.com");
    output = "";
    await page.getByRole("button", { name: "Send sign-in link", exact: true }).click();
    await page.getByText("Your sign-in link is ready.", { exact: false }).waitFor();
    let link;
    for (let i = 0; i < 60; i++) { link = readLink(); if (link) break; await sleep(100); }
    assert.ok(link, "Browser development magic link missing");
    const signed = await context.newPage();
    await signed.goto(link);
    await signed.getByRole("button", { name: "Save plan", exact: true }).waitFor();
    assert.equal(await signed.locator(".planner-selection").count(), 2, "Anonymous choices must restore in a new magic-link tab");
    assert.equal(await signed.locator(".planner-total strong").innerText(), before);
    assert.equal((await (await context.request.get(base + "/api/explore/plans")).json()).plans.length, 0, "Sign-in must not automatically save a trip");
    assert.equal((await (await context.request.get(base + "/api/explore/requests")).json()).requests.length, 0, "Sign-in must not automatically submit a request");
    await signed.getByRole("button", { name: "Save plan", exact: true }).click();
    await signed.getByText("Plan saved to your account.", { exact: false }).waitFor();
    await signed.getByRole("checkbox", { name: /I understand this is a sample request/ }).check();
    await signed.getByRole("button", { name: "Send sample care request", exact: true }).click();
    await signed.getByText("Sample care request recorded.", { exact: false }).waitFor();
    await signed.getByRole("checkbox", { name: /I understand this is a sample request/ }).check();
    await signed.getByRole("button", { name: "Send sample care request", exact: true }).click();
    await signed.getByText("Sample care request recorded.", { exact: false }).waitFor();
    const savedPlannerUrl = signed.url();
    await signed.route("**/api/explore/plans", (route) => route.request().method() === "PUT" ? route.abort("internetdisconnected") : route.continue());
    await signed.getByRole("combobox", { name: /^Travellers/ }).selectOption("2");
    await signed.getByRole("button", { name: "Save plan", exact: true }).click();
    await signed.getByRole("alert").filter({ hasText: /connection|connect|offline/i }).waitFor();
    assert.equal(await signed.getByRole("combobox", { name: /^Travellers/ }).inputValue(), "2", "Connection failure preserves choices");
    await signed.unroute("**/api/explore/plans");
    await signed.getByRole("button", { name: "Save plan", exact: true }).click();
    await signed.getByText("Plan saved to your account.", { exact: false }).waitFor();
    await signed.goto(base + "/account");
    await signed.getByRole("heading", { name: "Your saved care trips", exact: true }).waitFor();
    assert.equal(await signed.locator(".saved-care-card").count(), 1);
    await signed.getByRole("heading", { name: "Sample care requests", exact: true }).waitFor();
    assert.equal(await signed.getByText("Open original trip", { exact: false }).count(), 1);
    await signed.screenshot({ path: "docs/ui-review/explore-account-desktop.png", fullPage: true });
    checks.push("Browser: treatment synonyms, filters, comparison cap, pagination/history, flight+stay selection, invalidation, magic-link new-tab restoration, save, duplicate request, account display, aborted-save recovery and successful retry");
    const user = (await (await context.request.get(base + "/api/auth/get-session")).json()).user;
    const accountStorageKey = `bv.publicCareDraft.v1:user:${user.id}`;
    const newAnonymous = { draft: { ...draft, travellers: 2, flightId: null, stayQuoteId: null }, fare: null, stay: null, updatedAt: Date.now() };
    await signed.evaluate((value) => localStorage.setItem("bv.publicCareDraft.v1", JSON.stringify(value)), newAnonymous);
    await signed.goto(base + "/explore/trip?offer=lima-dental-implants&resume=1");
    await signed.getByRole("button", { name: "Save plan", exact: true }).waitFor();
    await signed.waitForFunction(() => document.querySelectorAll(".planner-fields select")[1]?.value === "2");
    assert.equal(await signed.getByRole("combobox", { name: /^Travellers/ }).inputValue(), "2", "Explicit resume must prefer fresh anonymous choices over older account draft");
    assert.equal(await signed.evaluate(() => localStorage.getItem("bv.publicCareDraft.v1")), null);
    await signed.goto(savedPlannerUrl);
    await signed.getByRole("button", { name: "Save plan again", exact: true }).waitFor();
    await signed.waitForFunction((key) => JSON.parse(localStorage.getItem(key) || "null")?.draft?.from === "JFK", accountStorageKey);
    const priorAccountDraft = await signed.evaluate((key) => JSON.parse(localStorage.getItem(key)).draft, accountStorageKey);
    await context.clearCookies();
    await context.addCookies(strangerCookie.split("; ").map((pair) => { const cut = pair.indexOf("="); return { name: pair.slice(0, cut), value: pair.slice(cut + 1), url: base, httpOnly: true, sameSite: "Lax" }; }));
    // Better Auth refetches its live session on visibility changes (five-second focus throttle).
    await sleep(5100);
    await signed.bringToFront();
    await signed.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await signed.getByRole("alert").filter({ hasText: "unavailable for this account" }).waitFor();
    assert.equal(await signed.getByRole("button", { name: "Save plan", exact: true }).isDisabled(), true, "Failed owned load must disable save");
    assert.equal(await signed.getByRole("combobox", { name: /^Flying from/ }).inputValue(), "", "Failed owned load must not retain prior account route");
    assert.deepEqual(await signed.evaluate((key) => JSON.parse(localStorage.getItem(key)).draft, accountStorageKey), priorAccountDraft, "Other account load must not overwrite prior user cache");
    assert.equal(await signed.evaluate(() => localStorage.getItem("bv.publicCareDraft.v1")), null, "Failed owned load must not persist into anonymous cache");
    const stranger = (await json("/api/auth/get-session", "GET", undefined, strangerCookie)).user;
    assert.equal(await signed.evaluate((key) => localStorage.getItem(key), `bv.publicCareDraft.v1:user:${stranger.id}`), null, "Failed owned load must not persist previous choices into the new account cache");
    checks.push("Browser: explicit anonymous resume overrides older same-offer account draft; live account switch clears inaccessible saved choices, disables save and preserves old/new account and anonymous caches");

    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1024 });
      for (const path of ["/explore", "/destinations", "/treatments", "/destinations/afghanistan", "/explore/offers/lima-dental-implants", `/explore/trip?${tripQuery}`]) {
        await page.goto(base + path);
        await page.locator("main").waitFor();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        assert.equal(overflow, false, `${path} overflows at ${width}px`);
        const font = await page.locator("body").evaluate((element) => getComputedStyle(element).fontFamily);
        assert.match(font, /matter/i);
      }
      await page.goto(base + "/explore");
      if (width === 390) {
        const filterTrigger = page.getByRole("button", { name: /^Filter care options/ });
        await filterTrigger.click();
        const filters = page.getByRole("dialog", { name: "Refine your search" });
        await filters.waitFor({ state: "visible" });
        await filters.locator('select[name="specialty"]').selectOption("dental");
        await page.keyboard.press("Escape");
        await filters.waitFor({ state: "hidden" });
        assert.equal(await filterTrigger.evaluate((element) => element === document.activeElement), true, "Closing filters returns keyboard focus");
        await filterTrigger.click();
        await filters.getByRole("button", { name: "Apply filters", exact: true }).click();
        await page.waitForURL((url) => url.searchParams.get("specialty") === "dental");
        assert.ok(await page.locator(".explore-offer").count() > 0, "Mobile drawer applies its single set of filters");
        await page.goto(`${base}/explore/trip?${tripQuery}`);
        await page.getByRole("combobox", { name: /^Travellers/ }).selectOption("2");
        await page.getByRole("button", { name: "Compare sample flights", exact: true }).click();
        await page.locator(".planner-results").first().getByRole("button", { name: "Add to plan", exact: true }).first().click();
        await page.getByRole("button", { name: "Compare sample stays", exact: true }).click();
        await page.locator(".planner-stay-results").getByRole("button", { name: "Add to plan", exact: true }).first().click();
        assert.equal(await page.locator(".planner-selection").count(), 2, "Mobile trip planning supports flight and stay selection");
        const compactSummary = page.locator(".planner-mobile-summary");
        assert.equal(await compactSummary.isVisible(), true, "Mobile subtotal is available while browsing travel results");
        assert.equal(await compactSummary.evaluate((element) => getComputedStyle(element).position), "fixed");
        assert.equal(await compactSummary.locator("strong").innerText(), await page.locator(".planner-total strong").innerText());
        await compactSummary.click();
        await page.waitForURL((url) => url.hash === "#planner-summary-title");
        await page.screenshot({ path: "docs/ui-review/explore-planner-mobile.png", fullPage: true });
        await page.goto(base + "/explore");
      }
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement?.tagName === "BODY"), false);
      await page.screenshot({ path: `docs/ui-review/explore-${width}.png`, fullPage: true });
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(base + "/explore");
    assert.equal(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), true);
    const sameTab = await browser.newContext({ viewport: { width: 1440, height: 1024 } });
    const sameTabPage = await sameTab.newPage();
    sameTabPage.on("pageerror", (error) => errors.push(error.message));
    await sameTabPage.goto(`${base}/explore/trip?${tripQuery}`);
    await sameTabPage.getByRole("combobox", { name: /^Travellers/ }).selectOption("3");
    await sameTabPage.getByRole("link", { name: "Sign in to save plan", exact: true }).click();
    await sameTabPage.getByLabel("Email", { exact: true }).fill("explore-same-tab@example.com");
    output = "";
    await sameTabPage.getByRole("button", { name: "Send sign-in link", exact: true }).click();
    await sameTabPage.getByText("Your sign-in link is ready.", { exact: false }).waitFor();
    let sameTabLink;
    for (let i = 0; i < 60; i++) { sameTabLink = readLink(); if (sameTabLink) break; await sleep(100); }
    assert.ok(sameTabLink, "Same-tab development magic link missing");
    await sameTabPage.goto(sameTabLink);
    await sameTabPage.getByRole("button", { name: "Save plan", exact: true }).waitFor();
    assert.equal(await sameTabPage.getByRole("combobox", { name: /^Travellers/ }).inputValue(), "3", "Anonymous draft restores through same-tab magic-link sign-in");
    await sameTab.close();
    const guided = await browser.newContext({ viewport: { width: 1440, height: 1024 } });
    const guidedPage = await guided.newPage();
    guidedPage.on("pageerror", (error) => errors.push(error.message));
    await guidedPage.goto(base + "/start");
    await guidedPage.locator("main").waitFor();
    assert.ok(await guidedPage.locator("textarea").count() > 0, "The separate guided intake remains available");
    await guidedPage.goto(base + "/login");
    await guidedPage.getByRole("button", { name: "Try a sample case", exact: true }).click();
    await guidedPage.waitForURL(/\/case\//);
    for (const path of ["/case/options", "/case/flights", "/case/plan"]) {
      await guidedPage.goto(base + path);
      await guidedPage.locator("main").waitFor();
      assert.ok(!guidedPage.url().includes("/login"), `${path} preserves sample navigation`);
      assert.equal(await guidedPage.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    }
    await guided.close();
    assert.deepEqual(errors, [], "Browser runtime errors");
    checks.push("Browser: 1440px/390px route matrix, mobile filter drawer/focus return and trip selections, fixed subtotal/review shortcut, no horizontal overflow/runtime errors, Matter fonts, keyboard entry, reduced-motion rendering; same-tab magic-link restoration; guided intake and sample options/flights/plan remain available");
    await context.close();
    await browser.close(); browser = null;
  }
  await writeFile("docs/ui-review/explore-check.json", JSON.stringify({ checkedAt: new Date().toISOString(), checks, sampleOnly: true }, null, 2) + "\n");
  console.log(`Explore smoke passed: ${checks.join("; ")}`);
  if (process.argv.includes("--browser")) {
    console.log(`Disposable Explore preview: ${base}/explore`);
    await new Promise((resolve) => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve); });
  }
} finally {
  if (browser) await browser.close();
  await pool.end();
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), sleep(5000)]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
