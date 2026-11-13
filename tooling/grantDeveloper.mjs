// Operator-only local command. Never exposed through a public API.
// Usage: node --env-file=.env.local tooling/grantDeveloper.mjs <operator-user-id> <verified-target-email>
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const [operatorId, email] = process.argv.slice(2);
if (!operatorId || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: node --env-file=.env.local tooling/grantDeveloper.mjs <operator-user-id> <verified-target-email>");
  process.exit(2);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(4242001::bigint)");
  const actor = await client.query('SELECT id, role FROM public."user" WHERE id = $1 FOR UPDATE', [operatorId]);
  if (!actor.rows[0] || !["coordinator", "developer"].includes(actor.rows[0].role)) throw new Error("operator_role_required");
  const target = await client.query('SELECT id, role, email_verified FROM public."user" WHERE lower(email) = lower($1) FOR UPDATE', [email]);
  if (!target.rows[0]?.email_verified || target.rows[0].id === operatorId) throw new Error("verified_distinct_target_required");
  if (!["patient", "caregiver", "developer"].includes(target.rows[0].role)) throw new Error("cannot_replace_clinical_role");
  await client.query("SELECT set_config('app.actor_id', $1, true), set_config('app.actor_type', 'operator', true), set_config('app.request_id', $2, true)", [operatorId, randomUUID()]);
  await client.query('UPDATE public."user" SET role = $1, updated_at = now() WHERE id = $2', ["developer", target.rows[0].id]);
  await client.query("COMMIT");
  console.log("Developer role granted with an audit entry to the verified target account.");
} catch (error) {
  await client.query("ROLLBACK");
  console.error(`Developer grant failed: ${error instanceof Error ? error.message : "unknown_error"}`);
  process.exitCode = 1;
} finally { client.release(); await pool.end(); }
