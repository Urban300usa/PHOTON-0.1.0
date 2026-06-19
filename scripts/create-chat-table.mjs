// One-off: create chat_messages table.
import 'dotenv/config';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }
const sql = postgres(url);

try {
  await sql`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id serial PRIMARY KEY,
      channel text NOT NULL,
      corp_id integer,
      from_character_id integer NOT NULL,
      from_name text NOT NULL,
      text text NOT NULL,
      created_at timestamp DEFAULT now() NOT NULL
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS chat_messages_channel_idx
    ON chat_messages (channel, corp_id, id)
  `;
  const check = await sql`SELECT to_regclass('public.chat_messages') AS tbl`;
  console.log('chat_messages table:', check[0].tbl);
  console.log('SUCCESS');
} catch (err) {
  console.error('FAILED:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
