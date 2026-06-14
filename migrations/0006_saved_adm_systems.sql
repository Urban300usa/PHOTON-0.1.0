-- Saved ADM Systems - Reusable system presets for ADM reports
-- Allows users to save frequently-used systems for quick adding

CREATE TABLE IF NOT EXISTS saved_adm_systems (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id INTEGER NOT NULL,
  system_id INTEGER,
  system_name TEXT NOT NULL,

  -- Strategic Index defaults
  strategic_index REAL,
  strategic_percent REAL,

  -- Vulnerability
  vulnerable_hours REAL,

  -- Default ADM values
  default_adm REAL NOT NULL DEFAULT 3.0,
  default_adm_status TEXT NOT NULL DEFAULT 'safe',

  -- Military Index defaults
  military_level INTEGER,
  military_percent REAL,

  -- Industrial Index defaults
  industrial_level INTEGER,
  industrial_percent REAL,

  -- Threat Detection defaults
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

CREATE INDEX IF NOT EXISTS saved_adm_systems_character_idx ON saved_adm_systems(character_id);
CREATE UNIQUE INDEX IF NOT EXISTS saved_adm_systems_unique ON saved_adm_systems(character_id, system_name);
