import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL environment variable is required");
    process.exit(1);
  }

  console.log("🔄 Running database migrations...");
  console.log(`📍 Database: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);

  const connection = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(connection);

  try {
    await migrate(db, { migrationsFolder: "./migrations" });
    console.log("✅ Migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigrations();
