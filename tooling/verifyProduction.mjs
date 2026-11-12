// Read-only checks. Never makes a provider booking or sends an email.
import { Pool } from 'pg';
const live = process.argv.includes('--live');
const present = (name) => Boolean(process.env[name]);
const checks = {
  database: present('DATABASE_URL'), encryptionKey32Bytes: Buffer.from(process.env.DATA_KEY ?? '', 'base64').length === 32,
  authSecret: (process.env.BETTER_AUTH_SECRET?.length ?? 0) >= 32, httpsApplication: process.env.BETTER_AUTH_URL?.startsWith('https://') ?? false,
  emailKey: present('RESEND_API_KEY'), emailSender: present('RESEND_FROM'), cronSecret: (process.env.CRON_SECRET?.length ?? 0) >= 32,
  externalHttpsAnchor: process.env.AUDIT_ANCHOR_URL?.startsWith('https://') ?? false, anchorCredential: present('AUDIT_ANCHOR_TOKEN'), auditAlertRecipient: present('AUDIT_ALERT_EMAIL'),
  duffelMode: process.env.DUFFEL_ACCESS_TOKEN?.startsWith(live ? 'duffel_live_' : 'duffel_test_') ?? false,
};
if (live) { checks.liveSearchOptIn = process.env.DUFFEL_LIVE_ENABLED === 'true'; checks.legalOperationalApprovalRecorded = process.env.LIVE_RELEASE_APPROVED === 'true'; checks.liveBookingCodeEnabled = false; }
if (process.argv.includes('--database') && checks.database) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, max: 1 });
  try {
    const client = await pool.connect();
    try {
      const role = (await client.query('select rolsuper, rolcreatedb, rolcreaterole from pg_roles where rolname = current_user')).rows[0]; checks.restrictedAppRole = !role.rolsuper && !role.rolcreatedb && !role.rolcreaterole;
      checks.postgres18 = Number((await client.query("show server_version_num")).rows[0].server_version_num) >= 180000;
      const audit = (await client.query('select * from audit.verify()')).rows[0]; checks.auditChain = audit.first_bad_id === null;
      await client.query('begin'); await client.query("select pg_advisory_xact_lock(4242999::bigint), set_config('app.readiness_probe', 'active', true)");
      checks.transactionLocalSetting = (await client.query("select current_setting('app.readiness_probe', true) as value")).rows[0].value === 'active';
      await client.query('commit'); checks.settingDoesNotLeak = (await client.query("select current_setting('app.readiness_probe', true) as value")).rows[0].value !== 'active';
    } finally { client.release(); }
  } catch { checks.databaseProbe = false; }
  finally { await pool.end(); }
}
console.log(JSON.stringify({ mode: live ? 'live' : 'preview', checks, note: 'Configuration checks do not prove carrier access, email delivery, immutable storage, backups or legal clearance.' }, null, 2));
if (Object.values(checks).some((value) => value === false)) process.exitCode = 1;
