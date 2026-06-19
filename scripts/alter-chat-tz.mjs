import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL);
try {
  await sql`ALTER TABLE chat_messages ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC'`;
  const r = await sql`SELECT data_type FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='created_at'`;
  console.log('created_at type:', r[0].data_type, '-> SUCCESS');
} catch (e) {
  console.error('FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
