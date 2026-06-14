import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function createTable() {
  try {
    console.log("Creating eve_ships table...");

    await sql`
      CREATE TABLE IF NOT EXISTS eve_ships (
        type_id INTEGER PRIMARY KEY,
        type_name TEXT NOT NULL,
        group_id INTEGER NOT NULL,
        group_name TEXT NOT NULL,
        category_id INTEGER NOT NULL DEFAULT 6,
        description TEXT,
        cached_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    console.log("Table created");

    await sql`CREATE INDEX IF NOT EXISTS eve_ships_name_idx ON eve_ships(type_name)`;
    await sql`CREATE INDEX IF NOT EXISTS eve_ships_group_idx ON eve_ships(group_id)`;
    console.log("Indexes created");

    const count = await sql`SELECT COUNT(*) as count FROM eve_ships`;
    console.log("Row count:", count[0].count);

    // List all tables with 'ship' in the name
    const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
    console.log("All tables:", tables.map(t => t.tablename).join(", "));

  } catch (e) {
    console.error("Error:", e);
  } finally {
    await sql.end();
  }
}

createTable();
