import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL);
try {
  const r = await sql`DELETE FROM chat_messages`;
  console.log('Deleted test messages. Chat is clean. SUCCESS');
} catch (e) { console.error('FAILED:', e.message); process.exitCode = 1; }
finally { await sql.end(); }
