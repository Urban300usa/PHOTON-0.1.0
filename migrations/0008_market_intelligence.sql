-- Market Intelligence Module - Phase 1
-- Adds tables for station monitoring, watchlists, market snapshots, and Jita reference prices

-- Monitored stations - stations/structures the user is tracking
CREATE TABLE IF NOT EXISTS monitored_stations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id INTEGER NOT NULL,
  station_id BIGINT NOT NULL,
  station_name TEXT NOT NULL,
  station_type TEXT NOT NULL,
  region_id INTEGER NOT NULL,
  solar_system_id INTEGER,
  auth_character_id INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  last_fetched_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS monitored_stations_character_idx ON monitored_stations(character_id);
CREATE INDEX IF NOT EXISTS monitored_stations_station_idx ON monitored_stations(station_id);
CREATE UNIQUE INDEX IF NOT EXISTS monitored_stations_char_station_idx ON monitored_stations(character_id, station_id);

-- Watchlists - named groups of items to track at a station
CREATE TABLE IF NOT EXISTS watchlists (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id INTEGER NOT NULL,
  monitored_station_id VARCHAR NOT NULL REFERENCES monitored_stations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS watchlists_character_idx ON watchlists(character_id);
CREATE INDEX IF NOT EXISTS watchlists_station_idx ON watchlists(monitored_station_id);

-- Watchlist items - individual items in a watchlist
CREATE TABLE IF NOT EXISTS watchlist_items (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id VARCHAR NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  type_id INTEGER NOT NULL,
  type_name TEXT NOT NULL,
  min_stock_threshold INTEGER NOT NULL DEFAULT 5,
  category TEXT
);

CREATE INDEX IF NOT EXISTS watchlist_items_watchlist_idx ON watchlist_items(watchlist_id);
CREATE INDEX IF NOT EXISTS watchlist_items_type_idx ON watchlist_items(type_id);
CREATE UNIQUE INDEX IF NOT EXISTS watchlist_items_watchlist_type_idx ON watchlist_items(watchlist_id, type_id);

-- Market snapshots - latest market data per item per station
CREATE TABLE IF NOT EXISTS market_snapshots (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  monitored_station_id VARCHAR NOT NULL REFERENCES monitored_stations(id) ON DELETE CASCADE,
  type_id INTEGER NOT NULL,
  sell_price_min REAL,
  sell_volume_total INTEGER,
  buy_price_max REAL,
  order_count INTEGER NOT NULL DEFAULT 0,
  fetched_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS market_snapshots_station_idx ON market_snapshots(monitored_station_id);
CREATE INDEX IF NOT EXISTS market_snapshots_type_idx ON market_snapshots(type_id);
CREATE UNIQUE INDEX IF NOT EXISTS market_snapshots_station_type_idx ON market_snapshots(monitored_station_id, type_id);

-- Jita reference prices - cached Jita market prices
CREATE TABLE IF NOT EXISTS jita_reference_prices (
  type_id INTEGER PRIMARY KEY,
  sell_min REAL,
  buy_max REAL,
  volume_daily INTEGER,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
