-- Migration: v0.4.0 Big Update - New Tables
-- Date: 2026-01-26
-- Description: Adds tables for skill queue, market orders, income analytics, and saved PI chains

-- ============================================
-- 1. Daily Income Summary - for income charts and analytics
-- ============================================
CREATE TABLE IF NOT EXISTS daily_income_summary (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  character_id integer NOT NULL,
  date text NOT NULL,
  bounty_income real NOT NULL DEFAULT 0,
  mission_income real NOT NULL DEFAULT 0,
  market_income real NOT NULL DEFAULT 0,
  industry_income real NOT NULL DEFAULT 0,
  pi_income real NOT NULL DEFAULT 0,
  mining_income real NOT NULL DEFAULT 0,
  other_income real NOT NULL DEFAULT 0,
  total_income real NOT NULL DEFAULT 0,
  session_count integer NOT NULL DEFAULT 0,
  total_session_time integer NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

-- Unique constraint for upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS daily_income_char_date_idx
  ON daily_income_summary(character_id, date);

-- Index for queries by character
CREATE INDEX IF NOT EXISTS idx_daily_income_character
  ON daily_income_summary(character_id);

-- ============================================
-- 2. Skill Queue - cached ESI skill queue data
-- ============================================
CREATE TABLE IF NOT EXISTS skill_queue (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  character_id integer NOT NULL,
  character_name text NOT NULL,
  queue_position integer NOT NULL,
  skill_id integer NOT NULL,
  skill_name text NOT NULL,
  started_level integer NOT NULL,
  finished_level integer NOT NULL,
  start_date timestamp,
  finish_date timestamp,
  training_start_sp integer,
  level_start_sp integer,
  level_end_sp integer,
  cached_at timestamp DEFAULT now() NOT NULL
);

-- Unique constraint for character + queue position
CREATE UNIQUE INDEX IF NOT EXISTS skill_queue_char_pos_idx
  ON skill_queue(character_id, queue_position);

-- Index for queries by character
CREATE INDEX IF NOT EXISTS idx_skill_queue_character
  ON skill_queue(character_id);

-- ============================================
-- 3. Skill Queue Alerts - notification preferences
-- ============================================
CREATE TABLE IF NOT EXISTS skill_queue_alerts (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  character_id integer NOT NULL UNIQUE,
  alert_on_empty boolean NOT NULL DEFAULT true,
  alert_hours_before_empty integer DEFAULT 24,
  last_alert_sent_at timestamp,
  created_at timestamp DEFAULT now() NOT NULL
);

-- ============================================
-- 4. Market Orders - cached character orders
-- ============================================
CREATE TABLE IF NOT EXISTS market_orders (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  character_id integer NOT NULL,
  character_name text NOT NULL,
  order_id bigint NOT NULL,
  type_id integer NOT NULL,
  type_name text NOT NULL,
  location_id bigint NOT NULL,
  location_name text,
  volume_total integer NOT NULL,
  volume_remain integer NOT NULL,
  price real NOT NULL,
  is_buy_order boolean NOT NULL,
  issued timestamp NOT NULL,
  duration integer NOT NULL,
  escrow real,
  range text,
  region_id integer,
  state text NOT NULL DEFAULT 'active',
  estimated_profit real,
  profit_margin real,
  cached_at timestamp DEFAULT now() NOT NULL
);

-- Unique constraint for character + order
CREATE UNIQUE INDEX IF NOT EXISTS market_orders_char_order_idx
  ON market_orders(character_id, order_id);

-- Index for queries by character
CREATE INDEX IF NOT EXISTS idx_market_orders_character
  ON market_orders(character_id);

-- Index for filtering by state
CREATE INDEX IF NOT EXISTS idx_market_orders_state
  ON market_orders(state);

-- ============================================
-- 5. Market Order History - completed/expired orders
-- ============================================
CREATE TABLE IF NOT EXISTS market_order_history (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  character_id integer NOT NULL,
  order_id bigint NOT NULL,
  type_id integer NOT NULL,
  type_name text NOT NULL,
  location_id bigint,
  location_name text,
  volume_total integer NOT NULL,
  volume_sold integer NOT NULL,
  price real NOT NULL,
  is_buy_order boolean NOT NULL,
  issued timestamp NOT NULL,
  completed_at timestamp,
  state text NOT NULL,
  total_revenue real,
  estimated_profit real,
  created_at timestamp DEFAULT now() NOT NULL
);

-- Index for queries by character
CREATE INDEX IF NOT EXISTS idx_market_order_history_character
  ON market_order_history(character_id);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_market_order_history_completed
  ON market_order_history(completed_at);

-- ============================================
-- 6. Saved PI Chains - user production chain presets
-- ============================================
CREATE TABLE IF NOT EXISTS saved_pi_chains (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  character_id integer NOT NULL,
  name text NOT NULL,
  description text,
  target_product_type_id integer NOT NULL,
  target_product_name text NOT NULL,
  target_tier text NOT NULL,
  units_per_day integer NOT NULL,
  chain_data_json jsonb NOT NULL,
  planet_assignments jsonb,
  estimated_daily_isk real,
  is_favorite boolean DEFAULT false,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

-- Index for queries by character
CREATE INDEX IF NOT EXISTS idx_saved_pi_chains_character
  ON saved_pi_chains(character_id);

-- Index for favorite chains
CREATE INDEX IF NOT EXISTS idx_saved_pi_chains_favorite
  ON saved_pi_chains(character_id, is_favorite);

-- ============================================
-- Done!
-- ============================================
