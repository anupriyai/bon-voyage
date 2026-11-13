// npm run audit:verify: walks the audit hash chain and prints the head hash. Record that hash somewhere outside
// the database (anchoring); tampering is detectable back to the last recorded head.
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const { rows } = await client.query("select checked, first_bad_id, head_hash from audit.verify()");
  const { checked, first_bad_id, head_hash } = rows[0];
  if (first_bad_id) {
    console.error(`Audit chain BROKEN at row ${first_bad_id} (${checked} rows before it check out).`);
    process.exitCode = 1;
  } else {
    console.log(`Audit chain OK: ${checked} rows.\nHead hash (record this outside the database): ${head_hash}\nAt: ${new Date().toISOString()}`);
  }
} finally {
  await client.end();
}
