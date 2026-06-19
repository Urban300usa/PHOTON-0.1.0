// One-off: create net_worth_snapshots table (drizzle-kit push prompt is interactive).
import 'dotenv/config';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }

const sql = postgres(url);

try {
  await sql`
    CREATE TABLE IF NOT EXISTS net_worth_snapshots (
      id serial PRIMARY KEY,
      character_id integer NOT NULL,
      date text NOT NULL,
      total_value double precision NOT NULL,
      created_at timestamp DEFAULT now() NOT NULL
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS net_worth_snapshots_char_date
    ON net_worth_snapshots (character_id, date)
  `;
  const check = await sql`SELECT to_regclass('public.net_worth_snapshots') AS tbl`;
  console.log('net_worth_snapshots table:', check[0].tbl);
  console.log('SUCCESS');
} catch (err) {
  console.error('FAILED:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
