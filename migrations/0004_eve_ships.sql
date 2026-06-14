-- EVE Ships static database for skill planner search
-- This table stores all ship types from EVE for fast partial-match searching

CREATE TABLE IF NOT EXISTS eve_ships (
  type_id INTEGER PRIMARY KEY,
  type_name TEXT NOT NULL,
  group_id INTEGER NOT NULL,
  group_name TEXT NOT NULL,
  category_id INTEGER NOT NULL DEFAULT 6,
  description TEXT,
  cached_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for fast searching
CREATE INDEX IF NOT EXISTS eve_ships_name_idx ON eve_ships(type_name);
CREATE INDEX IF NOT EXISTS eve_ships_group_idx ON eve_ships(group_id);
