-- Skill Planner v0.5.0 Migration
-- Adds tables for trained skills, character attributes, skill plans, and skill metadata

-- Trained Skills - character's current skill levels from ESI
CREATE TABLE IF NOT EXISTS "trained_skills" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "character_id" integer NOT NULL,
  "character_name" text NOT NULL,
  "skill_id" integer NOT NULL,
  "skill_name" text NOT NULL,
  "trained_skill_level" integer NOT NULL,
  "active_skill_level" integer NOT NULL,
  "skillpoints_in_skill" bigint NOT NULL,
  "cached_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "trained_skills_char_skill_idx" ON "trained_skills" ("character_id", "skill_id");

-- Character Attributes - for training time calculations
CREATE TABLE IF NOT EXISTS "character_attributes" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "character_id" integer NOT NULL UNIQUE,
  "character_name" text NOT NULL,
  "charisma" integer NOT NULL,
  "intelligence" integer NOT NULL,
  "memory" integer NOT NULL,
  "perception" integer NOT NULL,
  "willpower" integer NOT NULL,
  "bonus_remaps" integer,
  "last_remap_date" timestamp,
  "accrued_remap_cooldown_date" timestamp,
  "total_sp" bigint,
  "unallocated_sp" integer,
  "cached_at" timestamp DEFAULT now() NOT NULL
);

-- Skill Plans - user-created training goals
CREATE TABLE IF NOT EXISTS "skill_plans" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "character_id" integer NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "goal_type" text NOT NULL,
  "goal_type_id" integer,
  "goal_type_name" text,
  "is_active" boolean NOT NULL DEFAULT false,
  "priority" integer NOT NULL DEFAULT 0,
  "estimated_training_time" bigint,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Skill Plan Items - individual skills in a plan
CREATE TABLE IF NOT EXISTS "skill_plan_items" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "plan_id" varchar NOT NULL REFERENCES "skill_plans"("id") ON DELETE CASCADE,
  "skill_id" integer NOT NULL,
  "skill_name" text NOT NULL,
  "target_level" integer NOT NULL,
  "current_level" integer NOT NULL DEFAULT 0,
  "priority" integer NOT NULL DEFAULT 0,
  "is_required" boolean NOT NULL DEFAULT true,
  "estimated_training_time" bigint,
  "notes" text
);

CREATE UNIQUE INDEX IF NOT EXISTS "skill_plan_items_plan_skill_idx" ON "skill_plan_items" ("plan_id", "skill_id", "target_level");

-- Ship Skill Requirements - static data for ship skill requirements
CREATE TABLE IF NOT EXISTS "ship_skill_requirements" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "ship_type_id" integer NOT NULL,
  "ship_name" text NOT NULL,
  "ship_group" text NOT NULL,
  "skill_id" integer NOT NULL,
  "skill_name" text NOT NULL,
  "required_level" integer NOT NULL,
  "is_prerequisite" boolean NOT NULL DEFAULT false,
  "cached_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ship_skill_req_idx" ON "ship_skill_requirements" ("ship_type_id", "skill_id");

-- Skill Metadata - cached skill information from ESI
CREATE TABLE IF NOT EXISTS "skill_metadata" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "skill_id" integer NOT NULL UNIQUE,
  "skill_name" text NOT NULL,
  "group_id" integer NOT NULL,
  "group_name" text NOT NULL,
  "description" text,
  "primary_attribute" text NOT NULL,
  "secondary_attribute" text NOT NULL,
  "training_time_multiplier" integer NOT NULL,
  "prerequisite_skills_json" jsonb,
  "cached_at" timestamp DEFAULT now() NOT NULL
);
