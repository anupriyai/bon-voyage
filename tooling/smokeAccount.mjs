// Run only through tooling/testDatabase.py --command with disposable fake accounts.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { Pool } from "pg";

assert.equal(process.env.BON_VOYAGE_ISOLATED_TESTS, "1");
const reservation = createServer();
await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(port)], { env: { ...process.env, BETTER_AUTH_URL: base, DEV_STUDIO_ENABLED: "true" }, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => { output = (output + chunk).slice(-6000); });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const readLink = () => readFileSync(process.env.DEV_MAGIC_LINK_CAPTURE_FILE, "utf8").trim();
let cookie = "";
const request = (path, method = "GET", body) => fetch(base + path, { method, headers: { origin: base, ...(cookie ? { cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), redirect: "manual" });
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await request("/api/auth/get-session")).ok) break; } catch {}
    if (child.exitCode !== null || i === 99) throw new Error(`Isolated account server unavailable: ${output}`);
    await sleep(200);
  }
  const publicPage = await request("/explore");
  assert.equal(publicPage.status, 200);
  assert.equal(publicPage.headers.get("x-content-type-options"), "nosniff");
  assert.equal(publicPage.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.match(publicPage.headers.get("content-security-policy-report-only") || "", /frame-ancestors 'self'/);
  assert.equal((await request("/dev/studio")).status, 404);
  const email = "account-fake@example.com";
  assert.equal((await request("/api/auth/sign-in/magic-link", "POST", { email, callbackURL: "/account" })).status, 200);
  const firstLink = readLink();
  assert.ok(firstLink.startsWith(base));
  const verified = await fetch(firstLink, { redirect: "manual" });
  assert.equal(verified.status, 302);
  cookie = verified.headers.getSetCookie().map((part) => part.split(";")[0]).join("; ");
  assert.ok(cookie);
  const sessionCount = async () => Number((await pool.query("select count(*)::int as count from session")).rows[0].count);
  const initialSessions = await sessionCount();
  await fetch(firstLink, { redirect: "manual" });
  assert.equal(await sessionCount(), initialSessions, "A used sign-in link cannot create another session");
  assert.equal((await request("/api/account/profile")).status, 200);
  assert.equal((await request("/api/account/export")).status, 200);
  const profile = { displayName: "Synthetic Adult", accountKind: "patient", residenceCountry: "US", preferredLanguage: "en", timeZone: "UTC", adultConfirmed: true };
  assert.equal((await request("/api/account/profile", "PUT", { revision: 0, profile })).status, 200);
  const changedEmail = "account-fake-new@example.com";
  assert.equal((await request("/api/auth/change-email", "POST", { newEmail: changedEmail, callbackURL: "/account/profile" })).status, 200);
  const secondLink = readLink();
  assert.notEqual(secondLink, firstLink);
  assert.equal((await pool.query('select email from "user" where email=$1', [email])).rowCount, 1);
  assert.equal((await fetch(secondLink, { redirect: "manual" })).status, 302);
  assert.equal((await pool.query('select email from "user" where email=$1', [changedEmail])).rowCount, 1);
  assert.equal((await request("/api/auth/sign-in/magic-link", "POST", { email: changedEmail, callbackURL: "/account" })).status, 200);
  const expiredLink = readLink();
  await pool.query("update verification set expires_at=now() - interval '1 minute'");
  const beforeExpired = await sessionCount();
  await fetch(expiredLink, { redirect: "manual" });
  assert.equal(await sessionCount(), beforeExpired, "An expired sign-in link cannot create a session");
  const replay = await fetch(secondLink, { redirect: "manual" });
  assert.ok(replay.status >= 300);
  const [user] = (await pool.query('select id from "user" where email=$1', [changedEmail])).rows;
  // A synthetic coordinator is provisioned through an attributed database transaction.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(4242001::bigint)");
    await client.query("SELECT set_config('app.actor_id','account-smoke',true), set_config('app.actor_type','system',true), set_config('app.request_id','account-smoke',true)");
    await client.query('insert into "user" (id,name,email,email_verified,role) values ($1,$2,$3,true,$4)', ["operator-fake", "Fake operator", "operator-fake@example.com", "coordinator"]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  const grant = spawnSync(process.execPath, ["tooling/grantDeveloper.mjs", "operator-fake", changedEmail], { env: process.env, encoding: "utf8" });
  assert.equal(grant.status, 0, grant.stderr);
  assert.equal((await pool.query('select role from "user" where id=$1', [user.id])).rows[0].role, "developer");
  assert.equal((await pool.query("select actor_id from audit.log where table_name='user' and row_id=$1 and changed ? 'role' order by id desc limit 1", [user.id])).rows[0].actor_id, "operator-fake");
  const selfGrant = spawnSync(process.execPath, ["tooling/grantDeveloper.mjs", "operator-fake", "operator-fake@example.com"], { env: process.env, encoding: "utf8" });
  assert.notEqual(selfGrant.status, 0);
  assert.equal((await request("/dev/studio")).status, 200);
  const register = await request("/api/auth/passkey/generate-register-options");
  assert.equal(register.status, 200, await register.text());
  await pool.query("update session set created_at=now() - interval '1 hour' where user_id=$1", [user.id]);
  assert.equal((await request("/api/auth/passkey/generate-register-options")).status, 403);
  assert.equal((await request("/api/auth/change-email", "POST", { newEmail: "third@example.com" })).status, 403);
  console.log("Account smoke passed: security headers, link replay/expiry, encrypted profile API, export, verified email change, studio access, and fresh-session gates.");
} finally {
  await pool.end();
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), sleep(5000)]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
