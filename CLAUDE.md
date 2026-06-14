# PHOTON - EVE Online Income Tracker

> **IMPORTANT**: Read `BRIEFING.md` in the project root for details on recent development work, current issues, and the Big Update implementation progress.

## Project Overview
PHOTON is a web application for tracking EVE Online character income, assets, planetary industry, and more. It uses EVE's ESI API for data.

## Tech Stack
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: EVE Online SSO OAuth2

## Key Directories
- `client/src/pages/` - React pages (dashboard, assets, planetary, contracts, etc.)
- `server/routes.ts` - All API endpoints (~4000 lines)
- `server/storage.ts` - Database operations
- `shared/schema.ts` - Drizzle schema definitions (~1260 lines)

## Development Setup
- Dev login bypasses EVE OAuth with fake tokens (can't access ESI)
- Use "Real EVE SSO" button on login page for actual ESI access
- ESI credentials in `.env`: `EVE_DEV_CLIENT_ID`, `EVE_DEV_CLIENT_SECRET`

## Database Notes
- Uses PostgreSQL with Drizzle ORM
- Some IDs require bigint (EVE structure IDs exceed 32-bit)
- Migration files in `migrations/` folder
- Run `npm run db:migrate` to apply migrations
- Run `npm run db:push` for quick schema sync (dev only)

## Recent Fixes (Jan 2026)
1. **Bigint columns**: `esi_name_cache.id`, `industry_jobs.facility_id/station_id`, `planetary_pins.pin_id` changed to bigint
2. **Unique constraints**: Added to `planetary_planets` and `planetary_pins` for upsert operations
3. **Structure name resolution**: Fixed to try multiple character tokens when resolving player structure names (each character has different docking rights)
4. **SQL array syntax**: Fixed `deleteStalePlanetaryPlanets` to use proper PostgreSQL array syntax

## Multi-Character Support
- Primary character logs in via OAuth
- Linked characters stored in `linked_characters` table with their own tokens
- `viewAll` query param aggregates data across all characters
- Structure lookups try each character's token based on who has assets there

## ESI Scopes Used
- `esi-wallet.read_character_wallet.v1`
- `esi-assets.read_assets.v1`
- `esi-universe.read_structures.v1`
- `esi-planets.manage_planets.v1`
- `esi-industry.read_character_jobs.v1`
- `esi-contracts.read_character_contracts.v1`

## NPM Scripts
- `npm run dev` - Start dev server
- `npm run build` - Build for production
- `npm run db:push` - Push schema to database
- `npm run db:migrate` - Run migrations
- `npm run db:generate` - Generate new migration
