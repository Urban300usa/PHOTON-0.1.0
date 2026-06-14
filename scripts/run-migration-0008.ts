import "dotenv/config";
import postgres from "postgres";
import * as fs from "fs";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  try {
    const migrationSql = fs.readFileSync("migrations/0008_market_intelligence.sql", "utf-8");
    await sql.unsafe(migrationSql);
    console.log("Migration 0008 applied successfully");

    const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND (tablename LIKE '%monitored%' OR tablename LIKE '%watchlist%' OR tablename LIKE '%market_snapshot%' OR tablename LIKE '%jita%')`;
    console.log("Market intelligence tables:", tables.map((t: any) => t.tablename));
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await sql.end();
  }
}

main();
