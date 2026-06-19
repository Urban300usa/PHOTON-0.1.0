import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL);
try {
  await sql`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS alliance_id integer`;
  console.log('alliance_id column added. SUCCESS');
} catch (e) { console.error('FAILED:', e.message); process.exitCode = 1; }
finally { await sql.end(); }
