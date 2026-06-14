import "dotenv/config";
import postgres from "postgres";
import * as fs from "fs";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  try {
    const migrationSql = fs.readFileSync("migrations/0007_jump_planner.sql", "utf-8");
    await sql.unsafe(migrationSql);
    console.log("Migration 0007 applied successfully");

    const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND (tablename LIKE '%jump%' OR tablename LIKE '%beacon%')`;
    console.log("Jump planner tables:", tables.map((t: any) => t.tablename));
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await sql.end();
  }
}

main();
