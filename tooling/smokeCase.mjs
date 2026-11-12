// Run only via: python3 tooling/testDatabase.py --command node tooling/smokeCase.mjs
// Exercises the actual Next routes and development magic-link flow with fake data.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { Pool } from "pg";

assert.equal(process.env.BON_VOYAGE_ISOLATED_TESTS, "1", "Requires the disposable database runner");
const portServer = createServer();
await new Promise((resolve) => portServer.listen(0, "127.0.0.1", resolve));
const port = portServer.address().port;
await new Promise((resolve) => portServer.close(resolve));
const base = `http://127.0.0.1:${port}`;
let output = "";
let reviewing = false;
let lastBrowserLink = "";
function readLink() { try { return readFileSync(process.env.DEV_MAGIC_LINK_CAPTURE_FILE, "utf8").trim(); } catch { return ""; } }
function startServer(factor = "1") {
  output = "";
  const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", ...(process.argv.includes("--webpack") ? ["--webpack"] : []), "--hostname", "127.0.0.1", "--port", String(port)], { env: { ...process.env, BETTER_AUTH_URL: base, MOCK_FLIGHT_PRICE_FACTOR: factor }, stdio: ["ignore", "pipe", "pipe"] });
  for (const stream of [next.stdout, next.stderr]) stream.on("data", (chunk) => {
    output = (output + chunk).slice(-100000);
    if (reviewing) {
      const link = readLink();
      if (link && link !== lastBrowserLink) { lastBrowserLink = link; console.log("A local development sign-in link was created (not printed)."); }
    }
  });
  return next;
}
let child = startServer();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let cookie = "";
let browser;
const checks = [];
const traceReloads = process.argv.includes("--trace-reloads");
async function api(path, method = "GET", body, authenticated = true) {
  return fetch(base + path, { method, headers: { ...(authenticated && cookie ? { cookie } : {}), origin: base, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), redirect: "manual" });
}
async function waitReady() {
  for (let i = 0; i < 150; i++) {
    try { if ((await api("/api/auth/get-session")).ok) return; } catch {}
    if (child.exitCode !== null) throw new Error(`Disposable development server exited before readiness: ${output.slice(-1200)}`);
    await sleep(200);
  }
  throw new Error("Development server did not become ready");
}
async function stopServer() {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), sleep(5000)]);
  if (child.exitCode === null) { child.kill("SIGKILL"); await once(child, "exit"); }
}
async function runJourneyUi(seedCaseId, expectedAlert) {
  await api("/start", "GET", undefined, false);
  await api("/api/assistant", "POST", { task: "extract", text: "A synthetic intake warmup." }, false);
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  const capture = (page) => page.on("pageerror", (error) => errors.push(error.message));
  const authenticated = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  authenticated.on("page", capture);
  await authenticated.addCookies(cookie.split("; ").map((pair) => { const at = pair.indexOf("="); return { name: pair.slice(0, at), value: pair.slice(at + 1), url: base, httpOnly: true, sameSite: "Lax" }; }));
  const watched = await authenticated.newPage();
  await watched.goto(base + "/case/flights");
  const alert = watched.getByText(/Airfare dropped from/);
  await alert.waitFor();
  const alertText = await alert.innerText();
  assert.ok(alertText.includes(new Intl.NumberFormat("en-US", { style: "currency", currency: expectedAlert.currency }).format(Number(expectedAlert.to))));
  await mkdir("docs/ui-review", { recursive: true });
  await watched.screenshot({ path: "docs/ui-review/journey-continuation-price-drop.png", fullPage: true });
  checks.push("Real scheduled watch recheck after sample-price reduction generated one alert; protected-job replay deduplicated it; authenticated mobile panel displayed the actual lower fare");
  console.log("Journey UI: generated price-drop alert verified.");
  await authenticated.close();

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  context.on("page", capture);
  const page = await context.newPage();
  if (traceReloads) {
    page.on("pageerror", (error) => console.log(`Journey client error: ${error.message}`));
    page.on("websocket", (socket) => socket.on("framereceived", ({ payload }) => {
      try { const message = JSON.parse(String(payload)); const type = message.type ?? message.action; if (type) console.log(`Journey dev action: ${type}`); } catch {}
    }));
    page.on("framenavigated", (frame) => { if (frame === page.mainFrame()) console.log(`Journey UI navigation: ${new URL(frame.url()).pathname}`); });
    page.on("console", (message) => { if (/Fast Refresh|\[HMR\]/.test(message.text())) console.log(`Journey dev: ${message.text()}`); });
  }
  await page.goto(base + "/start");
  await page.locator("#bv-story").waitFor();
  await page.waitForFunction(() => localStorage.getItem("bon-voyage-store-v2:guest") !== null);
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.tagName === "BODY"), false);
  await page.locator("#bv-story").fill("My father Fake Patient is 68 and was diagnosed with stage 3 colon cancer last month. We live in Irbid, Jordan, and he speaks Arabic and English. We would like treatment within a month. We can pay around $40,000 ourselves. I am his son, Omar.");
  await page.getByRole("button", { name: /^Continue · I found/ }).waitFor();
  await page.getByRole("button", { name: /^Continue/ }).click();
  console.log("Journey UI: story submitted; completing intake questions.");
  await page.getByRole("button", { name: "Use default order", exact: true }).waitFor();
  await page.getByRole("button", { name: "Use default order", exact: true }).click();
  await page.getByRole("button", { name: /^Istanbul/ }).waitFor();
  await page.getByRole("button", { name: /^Istanbul/ }).click();
  await page.getByRole("button", { name: "Continue with 1", exact: true }).click();
  await page.getByRole("textbox", { name: "Your email", exact: true }).fill("mobile-journey@example.com");
  await page.getByRole("button", { name: "Save and review my brief", exact: true }).click();
  await page.getByRole("button", { name: "Create my case", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Create my case", exact: true }).getAttribute("aria-disabled"), "false");
  await page.screenshot({ path: "docs/ui-review/journey-continuation-mobile-brief.png", fullPage: true });
  await page.getByRole("button", { name: "Create my case", exact: true }).click();
  await page.getByRole("link", { name: "Add records", exact: true }).waitFor();
  await page.getByRole("link", { name: "Add records", exact: true }).click();
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("mobile-journey@example.com");
  output = "";
  await page.getByRole("button", { name: "Send sign-in link", exact: true }).click();
  await page.getByText("Your sign-in link is ready.", { exact: false }).waitFor();
  let link;
  for (let i = 0; i < 60; i++) { link = readLink(); if (link) break; await sleep(100); }
  assert.ok(link, "Mobile magic link missing");
  await page.goto(link);
  await page.waitForURL("**/case/records");
  await page.getByRole("heading", { name: /records|documents/i }).first().waitFor();
  await page.goto(base + "/case/options");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: /Istanbul/ }).click();
  await page.getByRole("button", { name: "Plan around Istanbul", exact: true }).click();
  await page.getByRole("link", { name: "Build my plan", exact: true }).click();
  await page.waitForURL("**/case/flights");
  const appointment = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  await page.getByLabel("Planning appointment", { exact: true }).fill(appointment);
  await page.getByLabel("Treatment days", { exact: true }).fill("7");
  await page.getByLabel("Recovery days", { exact: true }).fill("14");
  await page.getByLabel("Travellers", { exact: true }).fill("2");
  await page.getByLabel("Companion 1 age", { exact: true }).fill("35");
  await page.getByRole("button", { name: "Search flights", exact: true }).click();
  await page.getByRole("heading", { name: "Best balance", exact: true }).waitFor();
  await page.getByRole("button", { name: "Choose this fare", exact: true }).first().click();
  await page.getByText("Selected sample flights:", { exact: false }).waitFor();
  const list = await (await context.request.get(base + "/api/case")).json();
  const mobileCase = list.cases.find((item) => item.state.intake.patientName === "Fake Patient");
  assert.ok(mobileCase, "New mobile intake must create its own saved case");
  assert.notEqual(mobileCase.state.id, seedCaseId);
  assert.ok(!await page.getByText(/Airfare dropped from/).count(), "A new case must not inherit the earlier case's price alert");
  await page.screenshot({ path: "docs/ui-review/journey-continuation-mobile-flights.png", fullPage: true });

  const abortSave = (route) => route.request().method() === "PUT" ? route.abort("failed") : route.continue();
  await page.route("**/api/case", abortSave);
  await page.getByLabel("Treatment days", { exact: true }).fill("9");
  await page.getByText("We couldn’t save to your account.", { exact: false }).waitFor();
  assert.equal(await page.getByLabel("Treatment days", { exact: true }).inputValue(), "9");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Reload saved cases", exact: true }).click();
  assert.equal(await page.getByLabel("Treatment days", { exact: true }).inputValue(), "9", "Cancelled reload must preserve working choices");
  await page.unroute("**/api/case", abortSave);
  const retry = page.getByRole("button", { name: "Retry saving", exact: true });
  const retrySaved = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/case" && response.request().method() === "PUT" && response.ok());
  await retry.focus(); await page.keyboard.press("Enter");
  await retrySaved;
  await retry.waitFor({ state: "hidden" });
  const recovered = await (await context.request.get(`${base}/api/case?id=${mobileCase.state.id}`)).json();
  assert.equal(recovered.state.travelSchedule.treatmentDays, 9);
  checks.push("Mobile new story intake, brief review, case creation, magic-link adoption, hospital choice, adult+companion flight search/selection and account-owned saved case passed; save-network failure preserved choices and keyboard retry saved successfully after cancelled reload");

  const abortSearch = (route) => route.abort("failed");
  await page.route("**/api/travel/search", abortSearch);
  await page.getByRole("button", { name: "Search flights", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: /connection|connect|retry/i }).waitFor();
  assert.ok(!/Failed to fetch|NetworkError/.test(await page.getByRole("alert").last().innerText()));
  await page.unroute("**/api/travel/search", abortSearch);
  await page.getByRole("button", { name: "Search flights", exact: true }).click();
  await page.getByRole("heading", { name: "Best balance", exact: true }).waitFor();
  await page.getByRole("button", { name: "Choose this fare", exact: true }).first().click();
  await page.getByRole("link", { name: "Review your updated plan", exact: true }).click();
  await page.waitForURL("**/case/plan");
  await page.getByRole("button", { name: "Looks right", exact: true }).click();
  const selfOwner = page.getByRole("button", { name: "I’ll do it", exact: true }).first();
  await selfOwner.click(); assert.equal(await selfOwner.getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("textbox", { name: "Describe a change", exact: true }).fill("My brother wants to come too");
  await page.getByRole("button", { name: "Draft it", exact: true }).click();
  await page.getByRole("button", { name: "Keep current plan", exact: true }).waitFor();
  await page.getByRole("button", { name: "Keep current plan", exact: true }).click();
  await page.getByRole("button", { name: "Looks good, review", exact: true }).click();
  await page.getByRole("button", { name: "Approve and pay (simulated)", exact: true }).click();
  await page.getByRole("link", { name: "Go to your journey home", exact: true }).waitFor();
  await page.getByRole("link", { name: "Go to your journey home", exact: true }).click();
  await page.waitForURL("**/case/dashboard");
  checks.push("Mobile plan ownership, proposed-change dismissal, explicit review and simulated approval completed to dashboard; failed flight search recovered without raw browser errors");

  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/start?edit=1", "/case/options", "/case/flights", "/case/plan", "/case/dashboard"]) {
      await page.goto(base + path); await page.locator("main").waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${path} overflows at ${width}px`);
    }
    await page.screenshot({ path: `docs/ui-review/journey-continuation-${width}.png`, fullPage: true });
  }
  await page.getByRole("button", { name: /Message .*your coordinator/ }).click();
  const drawer = page.getByRole("dialog", { name: /Message/ });
  await drawer.waitFor();
  assert.equal(await drawer.evaluate((element) => element.contains(document.activeElement)), true, "Coordinator dialog should receive focus");
  await page.keyboard.press("Escape"); await drawer.waitFor({ state: "hidden" });
  assert.equal(await page.getByRole("button", { name: /Message .*your coordinator/ }).evaluate((element) => element === document.activeElement), true, "Escape must restore coordinator trigger focus");
  assert.deepEqual(errors, [], "Browser runtime exceptions");
  checks.push("320/390/768px intake-edit, options, flights, plan and dashboard had no horizontal overflow; keyboard reload-cancel/retry and coordinator dialog Escape/focus return passed; no runtime errors in reduced-motion mode");
  await context.close(); await browser.close(); browser = null;
}
try {
  await waitReady();
  assert.equal((await api("/api/case")).status, 401);
  const protectedPage = await api("/case/flights");
  assert.equal(protectedPage.status, 307);
  assert.ok(protectedPage.headers.get("location").includes("/login?next="));
  const sampleSpoof = await fetch(base + "/api/case", { headers: { cookie: "bv_demo=1" } });
  assert.equal(sampleSpoof.status, 401);
  const email = "smoke-patient@example.com";
  assert.equal((await api("/api/auth/sign-in/magic-link", "POST", { email, callbackURL: "/account" })).status, 200);
  let link;
  for (let i = 0; i < 50; i++) { link = readLink(); if (link) break; await sleep(100); }
  assert.ok(link, "Development link was not emitted");
  const verified = await fetch(link, { redirect: "manual" });
  assert.equal(verified.status, 302);
  cookie = verified.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  assert.ok(cookie.includes("session_token"));
  assert.equal((await api("/api/case")).status, 200);
  const id = randomUUID();
  const now = new Date().toISOString();
  const appointment = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const schedule = { appointment, treatmentDays: 7, recoveryDays: 14, passengers: 2, wheelchair: true, flexDays: 1 };
  const state = { id, updatedAt: now, travelSchedule: schedule, flightSelection: null,
    intake: { forWhom: "self", patientName: "FAKE HTTP PATIENT", age: "50", relationship: "", patientRelation: "", managerName: "", patientSeesAll: true, email, phone: "", contactVia: "email", diagnosis: "colon", diagnosisOther: "FAKE HTTP CLINICAL", stage: "3", origin: "jordan", originOther: "", originCity: "Irbid", languages: ["english"], priorities: ["cost"], budget: "25-50", insurance: "self", destinations: ["turkey"], timeline: "month" },
    draftStep: 5, complete: true, createdAt: now, sample: false, records: {}, unsorted: [], secondOpinionAt: null, secondOpinionSkipped: true, passportAdded: false, health: { medication: "FAKE HTTP HEALTH" }, costView: "expected", chosenId: "istanbul", chosenAt: now, owners: {}, taskStatus: {}, consultSlot: null, planApprovedAt: null, scanDecision: "pending", approved: [], chat: [] };
  const savedResponse = await api("/api/case", "PUT", { state, revision: null });
  assert.equal(savedResponse.status, 200, await savedResponse.clone().text());
  const saved = await savedResponse.json();
  const loaded = await (await api(`/api/case?id=${id}`)).json();
  assert.equal(loaded.state.intake.patientName, state.intake.patientName);
  assert.equal(loaded.record.appointmentDate, appointment);
  assert.equal((await api("/api/case", "PUT", { state, revision: null })).status, 409);
  const searchResponse = await api("/api/travel/search", "POST", { caseId: id, revision: saved.revision, schedule });
  assert.equal(searchResponse.status, 200);
  const result = await searchResponse.json();
  assert.equal(result.sample, true);
  assert.equal(result.requests, 1);
  assert.ok(result.ranking.picks.balanced);
  const widened = await (await api("/api/travel/search", "POST", { caseId: id, revision: saved.revision, schedule: { ...schedule, widen: true } })).json();
  assert.equal(widened.extraRequests, 2);
  const snapshots = await pool.query("select count(*)::int as n from fare_snapshots");
  assert.ok(snapshots.rows[0].n > 0);
  const raw = JSON.stringify((await pool.query("select * from case_clinical")).rows);
  assert.ok(!raw.includes("FAKE HTTP"));
  const audit = (await pool.query("select * from audit.verify()")).rows[0];
  assert.equal(audit.first_bad_id, null);
  const pick = result.ranking.picks.balanced.trip;
  const quoteResponse = await api("/api/travel/book", "POST", { action: "quote", caseId: id, searchId: result.searchId, offerId: pick.id });
  assert.equal(quoteResponse.status, 200, await quoteResponse.clone().text());
  const fare = (await quoteResponse.json()).fare;
  const traveler = { givenName: "Fake", familyName: "Patient", bornOn: "1980-01-01", title: "mr", gender: "m", email, phone: "+12025550123" };
  const bookInput = { caseId: id, searchId: result.searchId, offerId: fare.id, attemptId: randomUUID(), type: "instant", expectedAmount: fare.totalAmount, currency: fare.currency, acceptedConditions: true, assistance: true, travelers: [traveler, { ...traveler, givenName: "Other" }] };
  const bookingResponse = await api("/api/travel/book", "POST", bookInput);
  assert.equal(bookingResponse.status, 200, await bookingResponse.clone().text());
  const booking = await bookingResponse.json(); assert.equal(booking.status, "confirmed");
  assert.equal((await (await api("/api/travel/book", "POST", bookInput)).json()).id, booking.id);
  const watchResponse = await api("/api/price-watch", "POST", { caseId: id, searchId: result.searchId, offerId: fare.id });
  assert.equal(watchResponse.status, 200, await watchResponse.clone().text());
  const staysResponse = await api("/api/travel/stays", "POST", { action: "search", caseId: id, checkIn: pick.slices[0].segments[0].departAt.slice(0, 10), checkOut: pick.slices[1].segments[0].departAt.slice(0, 10), rooms: 1, guests: 2, radiusKm: 5 });
  assert.equal(staysResponse.status, 200, await staysResponse.clone().text());
  const stays = await staysResponse.json(); assert.equal(stays.results.length, 1);
  const stayQuoteResponse = await api("/api/travel/stays", "POST", { action: "quote", caseId: id, searchId: stays.searchId, resultId: stays.results[0].resultId });
  assert.equal(stayQuoteResponse.status, 200, await stayQuoteResponse.clone().text());
  const stayQuote = await stayQuoteResponse.json();
  const stayBook = { action: "book", caseId: id, localQuoteId: stayQuote.localQuoteId, attemptId: randomUUID(), expectedAmount: stayQuote.amount, currency: stayQuote.currency, expectedDue: stayQuote.dueAtAccommodation, dueCurrency: stayQuote.dueCurrency, acceptedConditions: true, email, phone: "+12025550123", guests: [{ givenName: "Fake", familyName: "Patient" }, { givenName: "Fake", familyName: "Companion" }] };
  const stayBookingResponse = await api("/api/travel/stays", "POST", stayBook);
  assert.equal(stayBookingResponse.status, 200, await stayBookingResponse.clone().text());
  assert.equal((await stayBookingResponse.json()).status, "confirmed");
  assert.equal((await api("/api/price-watch/run")).status, 401);
  assert.equal((await api("/api/audit/anchor")).status, 401);
  const finalAudit = (await pool.query("select * from audit.verify()")).rows[0]; assert.equal(finalAudit.first_bad_id, null);
  assert.equal((await api("/case/flights")).status, 200);
  if (process.argv.includes("--ui")) {
    const before = await (await api(`/api/price-watch?caseId=${id}`)).json();
    assert.equal(before.watches.length, 1);
    await stopServer(); child = startServer("0.5"); await waitReady();
    const jobResponse = await fetch(base + "/api/price-watch/run", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    assert.equal(jobResponse.status, 200); const job = await jobResponse.json();
    assert.equal(job.alerts, 1); assert.equal(job.digest.skipped, true, "No external email configuration in isolated mode");
    const after = await (await api(`/api/price-watch?caseId=${id}`)).json();
    assert.equal(after.alerts.length, 1); assert.ok(Number(after.alerts[0].to) < Number(after.alerts[0].from));
    const replay = await (await fetch(base + "/api/price-watch/run", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })).json();
    assert.equal(replay.skipped, true);
    await runJourneyUi(id, after.alerts[0]);
    await writeFile(`docs/ui-review/journey-continuation-${process.argv.includes("--webpack") ? "webpack" : "turbopack"}-check.json`, JSON.stringify({ checkedAt: new Date().toISOString(), checks, sampleOnly: true }, null, 2) + "\n");
    console.log(`Journey browser acceptance passed: ${checks.join("; ")}`);
  }
  if (process.argv.includes("--browser")) {
    output = "";
    assert.equal((await api("/api/auth/sign-in/magic-link", "POST", { email, callbackURL: "/account" })).status, 200);
    let browserLink;
    for (let i = 0; i < 50; i++) { browserLink = readLink(); if (browserLink) break; await sleep(100); }
    assert.ok(browserLink);
    console.log(`Disposable browser app: ${base}`);
    console.log("A local development sign-in link was created (not printed).");
    lastBrowserLink = browserLink;
    reviewing = true;
    console.log(`Fake case: ${id}`);
    console.log("Waiting for browser verification. Stop with Ctrl+C; the disposable server and database will be removed.");
    await new Promise((resolve) => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve); });
  }
  if (!process.argv.includes("--browser")) {
    assert.equal((await api("/api/auth/sign-out", "POST", {})).status, 200);
    assert.equal((await api("/api/case")).status, 401);
  }
  console.log(process.argv.includes("--browser") ? "Disposable browser session stopped; preflight HTTP checks completed." : "HTTP smoke passed: development magic link, session, private case save/reload, stale revision, search/widen, snapshots, encryption, audit, flight/stay routes, duplicate-safe booking, watch creation, quote-to-stay booking, protected jobs and sign-out.");
} catch (error) {
  const refreshMessages = output.split("\n").filter((line) => /Fast Refresh|full reload|GET \/start|POST \/api\/assistant/.test(line));
  if (traceReloads && refreshMessages.length) console.log(refreshMessages.join("\n"));
  if (browser) {
    const page = browser.contexts().at(-1)?.pages().at(-1);
    if (page && !page.isClosed()) {
      await page.screenshot({ path: "/private/tmp/bon-voyage-journey-failure.png", fullPage: true, timeout: 3000 }).catch(() => {});
      await writeFile("/private/tmp/bon-voyage-journey-failure.txt", await page.locator("body").innerText({ timeout: 3000 })).catch(() => {});
    }
  }
  throw error;
} finally {
  if (browser) await browser.close();
  await pool.end();
  await stopServer();
}
