-- Jump Planner tables for saved routes and beacon networks

-- Saved jump routes
CREATE TABLE IF NOT EXISTS saved_jump_routes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  ship_type_id INTEGER,
  ship_name TEXT,
  origin_system_id INTEGER NOT NULL,
  origin_system_name TEXT NOT NULL,
  destination_system_id INTEGER NOT NULL,
  destination_system_name TEXT NOT NULL,
  route_data_json JSONB NOT NULL,
  skill_config JSONB,
  total_fuel INTEGER,
  total_jumps INTEGER,
  total_gates INTEGER,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS saved_jump_routes_character_idx ON saved_jump_routes(character_id);

-- Jump beacon networks (cyno alt positions and beacon locations)
CREATE TABLE IF NOT EXISTS jump_beacons (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id INTEGER NOT NULL,
  network_name TEXT NOT NULL DEFAULT 'Default',
  system_id INTEGER NOT NULL,
  system_name TEXT NOT NULL,
  beacon_type TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS jump_beacons_character_idx ON jump_beacons(character_id);
CREATE UNIQUE INDEX IF NOT EXISTS jump_beacons_char_system_network_idx ON jump_beacons(character_id, system_id, network_name);
