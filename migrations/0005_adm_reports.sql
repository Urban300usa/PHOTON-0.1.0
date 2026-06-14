-- ADM Reports - Alliance sovereignty ADM tracking
-- Tracks Activity Defense Multiplier data for nullsec systems

CREATE TABLE IF NOT EXISTS adm_reports (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  region_name TEXT NOT NULL,
  report_date TIMESTAMP NOT NULL,
  next_adm_read TIMESTAMP,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS adm_systems (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id VARCHAR NOT NULL REFERENCES adm_reports(id) ON DELETE CASCADE,
  system_id INTEGER,
  system_name TEXT NOT NULL,

  -- Strategic Index
  strategic_index REAL,
  strategic_percent REAL,

  -- Vulnerability
  vulnerable_hours REAL,

  -- ADM
  adm REAL NOT NULL,
  adm_change REAL,
  adm_trend TEXT,
  adm_status TEXT NOT NULL DEFAULT 'safe',

  -- Military Index
  military_level INTEGER,
  military_percent REAL,
  military_change REAL,
  military_trend TEXT,
  military_activity REAL,

  -- Industrial Index
  industrial_level INTEGER,
  industrial_percent REAL,
  industrial_change REAL,
  industrial_trend TEXT,
  industrial_activity REAL,

  -- Threat Detection
  major_threat TEXT,
  minor_threat TEXT,

  -- Infrastructure
  ore_prospecting TEXT,

  -- Sovereignty
  sov_holder TEXT,
  is_capital BOOLEAN DEFAULT FALSE,

  -- Notes
  notes TEXT,

  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS adm_systems_report_idx ON adm_systems(report_id);
CREATE INDEX IF NOT EXISTS adm_systems_name_idx ON adm_systems(system_name);
