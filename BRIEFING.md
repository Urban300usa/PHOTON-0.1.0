# PHOTON Development Briefing

## Project Overview
PHOTON is an EVE Online income tracker web application. See `CLAUDE.md` for full tech stack details.

---

## Recent Session Work (January 2026)

### Assets Page Enhancements

We made significant improvements to the Assets page (`client/src/pages/assets.tsx`) and the backend assets endpoint in `server/routes.ts`.

#### 1. Expandable Ships/Containers
- Ships and containers can now be clicked to reveal their contents
- Uses `location_id` -> `item_id` relationships from ESI to build parent-child hierarchy
- `AssetItemRow` component renders items recursively with proper indentation

#### 2. Ship Fitting Detection
- Detects if a ship has modules fitted by checking `location_flag` values
- Fitted module flags: `HiSlot0-7`, `MedSlot0-7`, `LoSlot0-7`, `RigSlot0-2`, `SubSystem`
- Ships with fitted modules show a green "Fitted" badge
- `fittingStats` object tracks: `highSlots`, `medSlots`, `lowSlots`, `rigSlots`, `drones`, `cargo`

#### 3. Fitting Display (Separate from Cargo)
- Fitted modules are stored in a separate `fittedModules` array (not in `contents`)
- When a ship is expanded, fitting is shown first, grouped by slot type:
  - High Slots (red)
  - Mid Slots (blue)
  - Low Slots (yellow)
  - Rig Slots (purple)
  - Subsystems (green)
- Cargo items shown below with "Cargo" header (if both exist)

#### 4. Sort Options
- Sort dropdown with options: Value, Name, Quantity, Ships & Fitted First
- Locations sorted by total value
- Items within locations sorted by selected option

#### 5. Ship vs Container Icons
- `isShip` field detection based on fitted modules or drone bays
- Ships show Ship icon, containers show Container icon

---

## Key Backend Changes (server/routes.ts)

### Assets Endpoint Helper Functions
```typescript
// Check if a location_flag is a fitted module slot
const isFittedModuleSlot = (flag: string): boolean => {
  return flag.startsWith('HiSlot') || flag.startsWith('MedSlot') ||
         flag.startsWith('LoSlot') || flag.startsWith('RigSlot') ||
         flag.startsWith('SubSystem');
};

// Get slot type from location_flag for display
const getSlotType = (flag: string): string | undefined => {
  if (flag.startsWith('HiSlot')) return 'high';
  if (flag.startsWith('MedSlot')) return 'med';
  if (flag.startsWith('LoSlot')) return 'low';
  if (flag.startsWith('RigSlot')) return 'rig';
  if (flag.startsWith('SubSystem')) return 'subsystem';
  return undefined;
};
```

### Asset Type Definition
```typescript
type AssetWithContents = typeof assetsWithNames[0] & {
  contents?: AssetWithContents[];
  fittedModules?: AssetWithContents[];
  isContainer?: boolean;
  isShip?: boolean;
  isFitted?: boolean;
  slotType?: string;
  fittingStats?: {
    highSlots: number;
    medSlots: number;
    lowSlots: number;
    rigSlots: number;
    drones: number;
    cargo: number;
  };
};
```

### buildContents Function
The `buildContents(parentId)` function:
1. Finds all children where `location_type === "item"` and `location_id === parentId`
2. Counts fitted modules by slot type for `fittingStats`
3. Builds `fittedModules` array (items where `isFittedModuleSlot(location_flag)` is true)
4. Builds `contents` array (items where `isFittedModuleSlot(location_flag)` is false)
5. Returns `{ contents, fittedModules, fittingStats, isShip }`

---

## Key Frontend Changes (client/src/pages/assets.tsx)

### AssetItem Interface
```typescript
interface AssetItem {
  item_id: number;
  type_id: number;
  location_id: number;
  location_type: string;
  location_flag: string;
  quantity: number;
  is_singleton: boolean;
  is_blueprint_copy?: boolean;
  characterId: number;
  characterName: string;
  typeName: string;
  locationName: string;
  unitPrice?: number;
  totalValue?: number;
  contents?: AssetItem[];
  fittedModules?: AssetItem[];
  isContainer?: boolean;
  isShip?: boolean;
  isFitted?: boolean;
  slotType?: string;
  fittingStats?: { highSlots, medSlots, lowSlots, rigSlots, drones, cargo };
}
```

### State Management
- `expandedLocations: Set<number>` - tracks expanded location groups
- `expandedContainers: Set<number>` - tracks expanded ships/containers
- `sortBy: SortOption` - current sort field
- `sortDirection: SortDirection` - asc/desc

---

## Current Issue (User Feedback)

The user reported: "when i clicked on the picture of the ship it first shows me the current fitting. the fitted button shows the same thing and so does the ship cargo button"

**Problem**: There's redundant information being displayed:
1. Expanding the ship shows the fitting details
2. The "Fitted" badge tooltip ALSO shows fitting slot counts
3. The cargo badge shows a count that might be confusing

**Suggested Fix**:
- Simplify the "Fitted" badge - just show it as an indicator without the tooltip (or with a simple "Click to view fitting" tooltip)
- The cargo badge should only appear if there's actual cargo (already does this via `hasContents`)
- Remove redundant tooltip from the Fitted badge since the expanded view shows full details

---

## Big Update Plan (In Progress)

See `C:\Users\tbrid\.claude\plans\humble-foraging-curry.md` for the full plan including:
- Skill Queue Monitor (new page)
- Market Orders Tracker (new page)
- Income Charts & Analytics
- Mining Tracker Improvements (moon ore, compression)
- PI Calculator Improvements (save chains)
- Dashboard Improvements (new widgets)
- Widget/Overlay Mode (already implemented at `/overlay`)

### Completed from Big Update:
- `/overlay` page and route
- Session controls "Pop Out" button
- Database migration file `migrations/0002_big_update_tables.sql`
- Market page shell (`client/src/pages/market.tsx`)
- Skills page shell (`client/src/pages/skills.tsx`)
- App.tsx routes for new pages
- AppSidebar navigation links

---

## Files of Interest

| File | Description |
|------|-------------|
| `client/src/pages/assets.tsx` | Assets page with ship fitting display |
| `server/routes.ts` | All API endpoints (~4000+ lines) |
| `shared/schema.ts` | Drizzle schema definitions |
| `migrations/0002_big_update_tables.sql` | New tables for big update |
| `client/src/pages/market.tsx` | Market orders page (shell) |
| `client/src/pages/skills.tsx` | Skills queue page (shell) |
| `client/src/pages/overlay.tsx` | Mini overlay popup |

---

## Recent Work: Ship Search Fix (February 2026)

### Problem
The skill planner ship search was using ESI's `/universe/ids/` endpoint which requires **exact name matches**. Users couldn't search for partial names like "Rav" to find "Raven".

### Solution
Created a static `eve_ships` database table that is populated once from ESI and then used for fast local searching with `ILIKE` (partial matching).

#### Changes Made:
1. **New table**: `eve_ships` in `shared/schema.ts` with indexes for fast searching
2. **New storage methods**: `searchEveShips()`, `upsertEveShips()`, `getEveShipCount()` in `server/storage.ts`
3. **New endpoints** in `server/routes.ts`:
   - `GET /api/skills/ships/status` - Check if ship database is populated
   - `POST /api/skills/ships/populate` - One-time population from ESI
   - Updated `GET /api/skills/ships/search` - Now uses local database
4. **Frontend auto-population**: `client/src/pages/skills.tsx` automatically triggers population if database is empty
5. **Migration**: `migrations/0004_eve_ships.sql`

#### How It Works:
1. On first visit to Skills page, frontend checks `/api/skills/ships/status`
2. If database is empty (`count: 0`), triggers `/api/skills/ships/populate`
3. Population fetches all ships from ESI category 6 (Ships), takes ~1 minute
4. Once populated, ship searches are instant with partial matching

---

## Next Steps

1. **Fix the redundant badge issue** - Simplify the Fitted badge to not duplicate info shown when expanded
2. **Continue Big Update implementation** - Backend routes for skills/market sync from ESI
3. **Income analytics** - Implement daily income aggregation and charts
