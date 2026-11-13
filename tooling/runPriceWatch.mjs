const secret = process.env.CRON_SECRET;
if (!secret) throw new Error('CRON_SECRET is required');
const base = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
const response = await fetch(new URL('/api/price-watch/run', base), { headers: { Authorization: `Bearer ${secret}` } });
if (!response.ok) throw new Error(`Price watch returned ${response.status}`);
console.log(await response.json());
