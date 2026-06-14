-- Migration: Bigint fixes for EVE Online IDs
-- Date: 2026-01-26
-- Description: Changes integer columns to bigint for EVE structure IDs and adds missing unique constraints

-- ============================================
-- 1. ESI Name Cache - Change ID to bigint
-- ============================================
-- EVE structure IDs exceed 32-bit integer range (e.g., 1049591612123)

-- First drop the existing table and recreate with bigint
-- Note: This will lose cached names, but they will be re-fetched
DROP TABLE IF EXISTS esi_name_cache;

CREATE TABLE esi_name_cache (
  id bigint NOT NULL,
  character_id integer NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  cached_at timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY (id, character_id)
);

-- ============================================
-- 2. Industry Jobs - Change facility_id and station_id to bigint
-- ============================================
-- These can reference player structures which have bigint IDs

-- Check if columns exist and alter them
DO $$
BEGIN
  -- Alter facility_id if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'industry_jobs' AND column_name = 'facility_id'
  ) THEN
    ALTER TABLE industry_jobs ALTER COLUMN facility_id TYPE bigint;
  END IF;

  -- Alter station_id if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'industry_jobs' AND column_name = 'station_id'
  ) THEN
    ALTER TABLE industry_jobs ALTER COLUMN station_id TYPE bigint;
  END IF;
END $$;

-- ============================================
-- 3. Planetary Pins - Change pin_id to bigint
-- ============================================
-- ESI pin IDs can exceed 32-bit range

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'planetary_pins' AND column_name = 'pin_id'
  ) THEN
    ALTER TABLE planetary_pins ALTER COLUMN pin_id TYPE bigint;
  END IF;
END $$;

-- ============================================
-- 4. Add unique constraints for upsert operations
-- ============================================

-- Planetary planets: unique constraint on character + planet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'planetary_planets_character_planet_unique'
  ) THEN
    ALTER TABLE planetary_planets
      ADD CONSTRAINT planetary_planets_character_planet_unique
      UNIQUE (character_id, planet_id);
  END IF;
END $$;

-- Planetary pins: unique constraint on character + planet + pin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'planetary_pins_character_planet_pin_unique'
  ) THEN
    ALTER TABLE planetary_pins
      ADD CONSTRAINT planetary_pins_character_planet_pin_unique
      UNIQUE (character_id, planet_id, pin_id);
  END IF;
END $$;

-- ============================================
-- 5. Create index for better query performance
-- ============================================

-- Index for ESI name cache lookups
CREATE INDEX IF NOT EXISTS idx_esi_name_cache_character
  ON esi_name_cache(character_id);

-- Index for planetary queries
CREATE INDEX IF NOT EXISTS idx_planetary_planets_character
  ON planetary_planets(character_id);

CREATE INDEX IF NOT EXISTS idx_planetary_pins_character_planet
  ON planetary_pins(character_id, planet_id);
