import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function createTables() {
  try {
    console.log("Creating ADM reports tables...");

    await sql`
      CREATE TABLE IF NOT EXISTS adm_reports (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        region_name TEXT NOT NULL,
        report_date TIMESTAMP NOT NULL,
        next_adm_read TIMESTAMP,
        created_by INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    console.log("Created adm_reports table");

    await sql`
      CREATE TABLE IF NOT EXISTS adm_systems (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id VARCHAR NOT NULL REFERENCES adm_reports(id) ON DELETE CASCADE,
        system_id INTEGER,
        system_name TEXT NOT NULL,
        strategic_index REAL,
        strategic_percent REAL,
        vulnerable_hours REAL,
        adm REAL NOT NULL,
        adm_change REAL,
        adm_trend TEXT,
        adm_status TEXT NOT NULL DEFAULT 'safe',
        military_level INTEGER,
        military_percent REAL,
        military_change REAL,
        military_trend TEXT,
        military_activity REAL,
        industrial_level INTEGER,
        industrial_percent REAL,
        industrial_change REAL,
        industrial_trend TEXT,
        industrial_activity REAL,
        major_threat TEXT,
        minor_threat TEXT,
        ore_prospecting TEXT,
        sov_holder TEXT,
        is_capital BOOLEAN DEFAULT FALSE,
        notes TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    console.log("Created adm_systems table");

    await sql`CREATE INDEX IF NOT EXISTS adm_systems_report_idx ON adm_systems(report_id)`;
    await sql`CREATE INDEX IF NOT EXISTS adm_systems_name_idx ON adm_systems(system_name)`;
    console.log("Created indexes");

    console.log("Done!");
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await sql.end();
  }
}

createTables();
