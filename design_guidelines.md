# EVE Online Ratting Tracker - Design Guidelines

## Design Approach
**Utility-First with Gaming Aesthetic**: Combines productivity tool clarity with EVE Online's dark space theme. Draws inspiration from gaming dashboards (Steam, Discord) and data visualization tools (Grafana) while maintaining sci-fi character.

## Typography System

**Font Stack**: 
- Primary: 'Inter', 'Segoe UI', system-ui (clean, modern readability)
- Monospace: 'JetBrains Mono', 'Courier New' (for ISK values, timers, stats)

**Hierarchy**:
- Page Title (h1): 2xl-3xl, font-bold, gradient treatment
- Section Headers (h2): xl-2xl, font-semibold
- Card Titles (h3): lg, font-medium
- Stat Labels: sm, font-normal, muted
- Stat Values: 2xl-3xl, font-bold, monospace (for numbers/currency)
- Body Text: base, font-normal
- Helper Text: sm, muted

## Layout System

**Spacing Primitives**: Use Tailwind units of 4, 6, 8, 12 consistently
- Card padding: p-6 or p-8
- Section spacing: mb-8 or mb-12
- Grid gaps: gap-6
- Element spacing: space-y-4 within sections

**Container Strategy**:
- Max-width: max-w-7xl (1280px) centered
- Outer padding: px-4 md:px-6 lg:px-8
- Full viewport height usage for app-style experience

## Component Library

### 1. Header/Navigation
- Fixed or sticky top bar
- App title with gradient text treatment
- Action buttons aligned right (Start/Stop Session, Export Data)
- Clean horizontal layout, h-16 minimum height

### 2. Setup/Instructions Panel
- Collapsible card with border accent
- Numbered list with clear spacing (space-y-3)
- Code blocks with monospace font, subtle background differentiation
- Can be dismissible after initial setup

### 3. Statistics Grid
- Grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-4
- Stat Cards structure:
  - Small label text at top
  - Large numeric value (use monospace for ISK amounts)
  - Optional trend indicator or secondary metric below
  - Subtle border or background elevation
  - Icon placement: top-left or left-aligned with text
- Card height: min-h-32 for consistency

### 4. Session Controls
- Prominent Start/Stop button (large, gradient background)
- Timer display: Large monospace digits, centered or prominent placement
- Secondary actions (Pause, Reset) as smaller buttons nearby
- Status indicator (Active/Paused/Stopped) with dot or icon

### 5. Income Input/Logging
- Quick-entry form with number input
- Clear "Add Entry" button
- Optional preset buttons for common bounty amounts
- Inline validation feedback
- Recent entries list below input (last 5-10 entries)

### 6. Session History Table/List
- Data table with columns: Date, Duration, Total ISK, ISK/Hour, Kills
- Alternating row backgrounds for readability
- Sortable columns (clickable headers)
- Action column: View Details, Delete
- Responsive: Stack to cards on mobile
- Pagination or "Load More" if history grows

### 7. Action Buttons
- Primary actions: Gradient background, white text
- Secondary actions: Transparent with border
- Danger actions: Red accent for delete/reset
- Icon + text combination for clarity
- Consistent height: h-10 or h-12

## Information Architecture

**Primary Sections** (vertical stack):
1. App Header (sticky)
2. Setup Instructions (dismissible, only show if needed)
3. Active Session Controls (if session running)
4. Statistics Dashboard (grid of 4-6 key metrics)
5. Quick Income Entry
6. Session History Table

**Statistics to Display**:
- Current Session ISK
- Total All-Time ISK
- Current Session ISK/Hour
- Average ISK/Hour (all sessions)
- Total Time Ratted
- Active Session Duration

## Interaction Patterns

**Session Flow**:
1. Start button transitions to Stop button with pulsing indicator
2. Timer counts up in real-time (HH:MM:SS format)
3. Income entry immediately updates current session stats
4. Stop button prompts confirmation, saves to history

**Data Entry**:
- Number inputs with ISK formatting (add commas automatically)
- Enter key submits income entry
- Visual feedback on successful addition (brief highlight)

**State Management**:
- Empty state: Welcoming message with "Start Your First Session" CTA
- Active session: Highlighted controls, live updating stats
- Historical view: Sortable, filterable data table

## Visual Enhancements

**Gradient Applications** (sparingly):
- App title text
- Primary action buttons
- Active session status indicator
- Subtle card borders for emphasis

**Icons**: Use Heroicons (outline for secondary elements, solid for primary actions)
- Timer: Clock icon
- Income: Currency/Wallet icon  
- Statistics: Chart/Graph icons
- History: Calendar/List icon
- Controls: Play/Pause/Stop icons

**Depth & Elevation**:
- Base layer cards: subtle border, no shadow
- Active/focused elements: stronger border accent
- Modals/overlays: backdrop blur with elevated card

## Responsive Strategy

**Breakpoints**:
- Mobile (base): Single column, stacked stats
- Tablet (md): 2-column stats grid
- Desktop (lg+): 4-column stats grid, wider table

**Mobile Optimizations**:
- Larger touch targets (min 44px)
- Session controls float to bottom for thumb reach
- Simplified table view: card-based layout
- Collapsible sections to reduce scrolling

## No Images Required
This is a data-focused utility application. No hero imagery needed. Icons and data visualization are sufficient for visual interest.