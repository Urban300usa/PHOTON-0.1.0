import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function clearCache() {
  try {
    console.log("Clearing ship skill requirements cache...");
    await sql`DELETE FROM ship_skill_requirements`;
    const count = await sql`SELECT COUNT(*) as count FROM ship_skill_requirements`;
    console.log("Remaining rows:", count[0].count);
    console.log("Done! Ship requirements will be re-fetched with full prerequisite chains.");
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await sql.end();
  }
}

clearCache();
