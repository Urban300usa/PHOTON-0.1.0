# PHOTON - COMPLETE SYSTEM UPGRADE
## Themes + Code Generation + Badge System + Sidebar Navigation

---

## ⚠️ IMPORTANT INSTRUCTIONS FOR REPLIT AGENT

**READ THIS FIRST:**

This document contains multiple complex systems to implement. Follow these guidelines:

1. **DO NOT SKIP ANY FEATURES** - Every feature listed must be implemented
2. **ASK FOR INPUT WHEN NEEDED** - If you need clarification, file paths, existing code structure, or design decisions, STOP and ASK the user
3. **IMPLEMENT IN ORDER** - Follow the priority phases listed at the bottom
4. **TEST AS YOU GO** - Test each feature before moving to the next
5. **CONFIRM COMPLETION** - After each major feature, confirm it's working before continuing

**If you encounter ANY of these situations, STOP and ASK:**
- Unclear file structure or where to place new code
- Need to see existing code to integrate properly
- Unsure about database schema or models
- Need design mockups or visual clarification
- Conflicting requirements or technical limitations
- Need API keys, credentials, or configuration details
- Uncertainty about existing authentication/session management

**DO NOT:**
- Make assumptions about existing code structure
- Skip features because they seem complex
- Implement partial solutions
- Move on if something doesn't work

---

## TABLE OF CONTENTS

1. [Application Rebranding](#1-application-rebranding)
2. [Sidebar Navigation System](#2-sidebar-navigation-system)
3. [Lore-Accurate Theme System](#3-lore-accurate-theme-system)
4. [Code Generation & Redemption System](#4-code-generation--redemption-system)
5. [Badge System & User Management](#5-badge-system--user-management)
6. [Implementation Priority](#6-implementation-priority)

---

## 1. APPLICATION REBRANDING

### Complete Rename: RAT TRACKER → PHOTON

**Everywhere this name appears, change it to PHOTON:**

**Code & Configuration:**
- [ ] package.json - application name
- [ ] environment variables (RAT_TRACKER → PHOTON)
- [ ] All constant/variable names in code
- [ ] API endpoint names
- [ ] Database table names (or add migration notes)
- [ ] File names containing "rat-tracker" or "rattracker"
- [ ] localStorage keys (rattracker_ → photon_)

**User Interface:**
- [ ] Browser tab title: "PHOTON"
- [ ] Logo and branding
- [ ] All page headers and titles
- [ ] Login/welcome screens
- [ ] Footer text
- [ ] About/help text
- [ ] Meta tags for SEO

**Documentation:**
- [ ] README files
- [ ] Code comments
- [ ] User-facing documentation
- [ ] API documentation

**User Communications:**
- [ ] Email templates
- [ ] Notification messages
- [ ] Shareable card templates (/share/:id)

**⚠️ STOP AND ASK:** 
- What is the current project structure?
- Where are environment variables stored?
- What database system is being used?
- Are there any other places the old name appears?

---

## 2. SIDEBAR NAVIGATION SYSTEM

### Overview
Transform top navigation buttons into an animated collapsible sidebar.

### Specifications

**Dimensions:**
- Collapsed: 60px wide (icon-only)
- Expanded: 240px wide (icon + text)
- Height: Full viewport (100vh)
- Position: Fixed left side

**States:**
1. Expanded - Full width with icons and labels
2. Collapsed - Icons only
3. Mobile - Overlay mode

**Code Format:**
```
PHOTON-XXXX-XXXX-XXXX
       └─12 characters─┘
```

### Animation Timings

**Opening:**
- Duration: 300ms
- Easing: cubic-bezier(0.4, 0.0, 0.2, 1)
- Width expands 60px → 240px
- Text fades in after 50ms delay

**Closing:**
- Duration: 250ms
- Easing: cubic-bezier(0.4, 0.0, 0.2, 1)
- Width collapses 240px → 60px
- Text fades out immediately

**Hover Effects:**
- Background transition: 150ms
- Tooltips appear when collapsed (showing full menu name)

### Navigation Structure

**Main Navigation Items (in order):**
1. Dashboard - Home icon - Route: /
2. Mining - Pickaxe icon - Route: /mining
3. Loot Tracker - Treasure icon - Route: /loot
4. Sessions - Clock icon - Route: /sessions
5. Character - User icon - Route: /character
6. Settings - Gear icon - Route: /settings
7. PRO - Star icon (gold for PRO users) - Route: /pro

**Footer Section (when expanded):**
- Character avatar
- Character name
- Top 3 badges (with tooltips showing name and rarity)
- Logout button

### Responsive Behavior

**Desktop (>768px):**
- Remembers user's preferred state (localStorage)
- Click toggle to open/close
- Page content shifts smoothly

**Mobile (<768px):**
- Hidden by default
- Opens as overlay (doesn't push content)
- Semi-transparent backdrop (rgba(0,0,0,0.5))
- Click backdrop to close

### State Persistence

```javascript
localStorage.setItem('photon_sidebar_state', 'expanded'); // or 'collapsed'
```

### Accessibility

- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] ARIA labels and roles
- [ ] Focus indicators
- [ ] Screen reader announcements
- [ ] Respect prefers-reduced-motion

**⚠️ STOP AND ASK:**
- What framework is being used? (React, Vue, vanilla JS?)
- Where is the current navigation code located?
- What icon library should be used?
- Where should the toggle button be positioned?

---

## 3. LORE-ACCURATE THEME SYSTEM

### Overview
Implement 12 lore-accurate EVE Online faction themes based on extensive research into game aesthetics, culture, and visual identity.

### Technical Implementation

**CSS Variable Structure:**
```css
:root {
  --theme-primary: #4A5568;
  --theme-secondary: #2C3E50;
  --theme-accent: #00A8FF;
  --theme-highlight: #00D9FF;
  --theme-background: #1A202C;
  --theme-text: #F7FAFC;
  --theme-text-secondary: #A0AEC0;
}
```

**Theme Storage:**
```javascript
localStorage.setItem('photon_selected_theme', 'caldari');
```

### Theme Categories

**FREE THEMES (Available to all users):**
1. Light (default)
2. Dark (default)
3. Caldari State
4. Amarr Empire
5. Gallente Federation
6. Minmatar Republic
7. CONCORD

**PRO-EXCLUSIVE THEMES (Require active PRO subscription):**
8. Triglavian Collective ⭐
9. Guristas Pirates ⭐
10. Angel Cartel ⭐
11. Blood Raiders ⭐
12. Jove Empire ⭐
13. Sleepers/Drifters ⭐
14. Sisters of EVE ⭐
15. ORE (Outer Ring Excavations) ⭐

---

### EMPIRE FACTION THEMES

#### CALDARI STATE - "Corporate Efficiency"

**Lore:** Mega-corporate dictatorship. Japanese-Finnish culture. Industrial, efficient, disciplined.

**Colors:**
```css
--caldari-primary: #4A5568;        /* Slate grey */
--caldari-secondary: #2C3E50;      /* Gunmetal */
--caldari-accent: #00A8FF;         /* Electric blue */
--caldari-highlight: #00D9FF;      /* Cyan glow */
--caldari-background: #1A202C;     /* Dark charcoal */
--caldari-text: #F7FAFC;           /* Clean white */
```

**Design Elements:**
- Geometric, angular shapes
- Sharp corners
- Hexagonal grid patterns
- Industrial sans-serif typography
- Blue glow effects
- Minimal ornamentation

---

#### AMARR EMPIRE - "Divine Authority"

**Lore:** Largest empire. Theocratic monarchy. Religious zealots. Gold and scripture.

**Colors:**
```css
--amarr-primary: #D4AF37;          /* Imperial gold */
--amarr-secondary: #A52A2A;        /* Deep crimson */
--amarr-accent: #FFD700;           /* Bright gold */
--amarr-sacred: #FAFAFA;           /* Pure white */
--amarr-background: #2D1B00;       /* Dark brown */
--amarr-text: #FFD700;             /* Gold text */
```

**Design Elements:**
- Cathedral-inspired architecture
- Soaring spires
- Ornate patterns
- Flowing curves with rigid structure
- Serif typography with flourishes
- Gold leaf effects
- Pulsing glow (divine presence)
- Engraved borders

---

#### GALLENTE FEDERATION - "Liberal Democracy"

**Lore:** Democratic federation. French-inspired. Freedom, diversity, artistic expression.

**Colors:**
```css
--gallente-primary: #2E7D32;       /* Forest green */
--gallente-secondary: #00A86B;     /* Emerald */
--gallente-accent: #00BCD4;        /* Cyan blue */
--gallente-highlight: #76FF03;     /* Bright lime */
--gallente-background: #0A1F1F;    /* Dark green-black */
--gallente-text: #FAFAFA;          /* Clean white */
```

**Design Elements:**
- Organic, flowing curves
- Art nouveau inspirations
- Smooth gradients
- Nature-integrated design
- Drone swarm patterns
- Bioluminescent glows
- Glass-like transparency

---

#### MINMATAR REPUBLIC - "Tribal Resilience"

**Lore:** Youngest empire. Born from rebellion. Seven tribes. "Rust we trust" aesthetic.

**Colors:**
```css
--minmatar-primary: #CD5C5C;       /* Rust red */
--minmatar-secondary: #8B4513;     /* Weathered bronze */
--minmatar-accent: #FF6B35;        /* Burnt orange */
--minmatar-tribal: #A0826D;        /* Earth tones */
--minmatar-background: #1A0F0A;    /* Dark rust-brown */
--minmatar-text: #FFF8E7;          /* Warm white */
```

**Design Elements:**
- Asymmetric, improvised appearance
- Tribal patterns
- Riveted metal textures
- Exposed structural elements
- Weathered aesthetics
- Bold industrial typography
- Rough textured surfaces
- Fire/spark effects

---

### PIRATE FACTION THEMES (PRO-EXCLUSIVE)

#### TRIGLAVIAN COLLECTIVE - "Abyssal Invasion" ⭐

**Lore:** Mysterious civilization from Abyssal Deadspace. Space-time mechanics masters.

**Colors:**
```css
--triglavian-primary: #0D0D0D;     /* Deep black */
--triglavian-secondary: #B22222;   /* Blood red */
--triglavian-accent: #DC143C;      /* Bright crimson */
--triglavian-energy: #FF4500;      /* Orange-red glow */
--triglavian-background: #000000;  /* Pure black */
--triglavian-text: #FFFFFF;        /* White */
```

**Design Elements:**
- Sharp, angular, crystalline geometry
- Triangular motifs (three-fold nature)
- Alien yet orderly
- Pulsing red energy cores
- Hexagonal tessellations
- Harsh, alien typography
- Disintegration particle effects
- Singularity distortions

---

#### GURISTAS PIRATES - "Profit & Chaos" ⭐

**Lore:** Ex-Caldari Navy pirates. Led by "Fatal" and "The Rabbit". Bunny skull logo.

**Colors:**
```css
--guristas-primary: #39FF14;       /* Lime green */
--guristas-secondary: #36454F;     /* Dark grey */
--guristas-accent: #FF1493;        /* Hot pink */
--guristas-tech: #00FFFF;          /* Cyan */
--guristas-background: #0A0A0A;    /* Very dark grey */
--guristas-text: #FFFFFF;          /* Bright white */
```

**Design Elements:**
- Cyberpunk/tech noir aesthetic
- Bunny skull iconography (abstract)
- Neon lighting effects
- Hacker UI elements
- Futuristic typography
- Scanline effects (CRT monitor)
- Green glow on hover

---

#### ANGEL CARTEL - "Outlaw Freedom" ⭐

**Lore:** Largest crime faction. Fast ships. Red/black scheme. Brutal efficiency.

**Colors:**
```css
--angel-primary: #A52A2A;          /* Deep red */
--angel-secondary: #0F0F0F;        /* Black */
--angel-accent: #FF0000;           /* Bright red */
--angel-metal: #C0C0C0;            /* Silver chrome */
--angel-background: #000000;       /* Black */
--angel-text: #FFFFFF;             /* White */
```

**Design Elements:**
- Aggressive, predatory aesthetic
- Wing motifs (dark angel theme)
- Speed lines, motion blur
- Chrome and red metal
- Bold aggressive typography
- Bullet hole textures
- Projectile tracer effects
- Sharp, dangerous UI

---

#### BLOOD RAIDERS - "Vampiric Horror" ⭐

**Lore:** Heretical Amarr cult. Drain blood for immortality. Terror tactics.

**Colors:**
```css
--bloodraider-primary: #8B0000;    /* Blood red */
--bloodraider-secondary: #6B4423;  /* Dark gold/bronze */
--bloodraider-accent: #DC143C;     /* Crimson */
--bloodraider-corrupt: #B8860B;    /* Tarnished gold */
--bloodraider-background: #1A0000; /* Black-red gradient */
--bloodraider-text: #F5F5DC;       /* Bone white */
```

**Design Elements:**
- Corrupted Amarr aesthetic
- Blood droplet patterns
- Gothic horror elements
- Tarnished gold and rust
- Vampiric symbolism
- Dripping effects
- Heartbeat animations
- Energy drain visuals

---

### MYSTERY FACTION THEMES (PRO-EXCLUSIVE)

#### JOVE EMPIRE - "Ancient Enigma" ⭐

**Lore:** Most advanced race. Mysterious, possibly extinct. Genetic engineering masters.

**Colors:**
```css
--jove-primary: #6A1B9A;           /* Deep purple */
--jove-secondary: #0D1F2D;         /* Black with blue sheen */
--jove-accent: #9C27B0;            /* Electric violet */
--jove-tech: #B0C4DE;              /* Silver/platinum */
--jove-background: #1A0033;        /* Dark purple-black */
--jove-text: #E0E0E0;              /* Luminous silver */
```

**Design Elements:**
- Impossibly advanced aesthetic
- Perfect symmetry
- Seamless surfaces
- Holographic effects
- Ancient yet futuristic
- Mysterious glowing symbols
- Quantum particle effects
- Elegant, otherworldly typography

---

#### SLEEPERS/DRIFTERS - "Ancient AI" ⭐

**Lore:** Jove offshoots in virtual reality. Emerging as cybernetic Drifters. Wormhole space.

**Colors:**
```css
--sleeper-primary: #004D40;        /* Deep teal */
--sleeper-secondary: #263238;      /* Dark blue-grey */
--sleeper-accent: #00E5FF;         /* Electric cyan */
--sleeper-ancient: #B8960B;        /* Muted gold */
--sleeper-background: #0A1929;     /* Near-black blue */
--sleeper-text: #E0F7FA;           /* Cyan-white */
```

**Design Elements:**
- Ancient yet functional
- Geometric, precise patterns
- Cybernetic augmentation elements
- Holographic displays
- Blue electrical arcing
- Ancient rune-like patterns
- Quantum particle effects
- Cold, calculated typography

---

### SPECIALIZED THEMES

#### CONCORD - "Galactic Authority"

**Lore:** Interstellar police. Neutral arbiters. Law enforcement.

**Colors:**
```css
--concord-primary: #0B3C5D;        /* Navy blue */
--concord-secondary: #FFFFFF;      /* White */
--concord-accent: #FFD700;         /* Gold */
--concord-warning: #FFFF00;        /* Yellow */
--concord-background: #F5F5F5;     /* Light grey */
--concord-text: #001F3F;           /* Navy blue */
```

**Design Elements:**
- Official governmental aesthetic
- Badge and emblem motifs
- Clean professional layouts
- Authoritative typography
- Warning stripe patterns
- Radio wave effects

---

#### SISTERS OF EVE - "Humanitarian Science"

**Lore:** Humanitarian organization. Religious + scientific. Rescue operations.

**Colors:**
```css
--sisters-primary: #FAFAFA;        /* Pristine white */
--sisters-secondary: #B76E79;      /* Rose gold */
--sisters-accent: #4FC3F7;         /* Soft blue */
--sisters-sacred: #E8DED2;         /* Pearl */
--sisters-background: #ECEFF1;     /* Soft grey-blue */
--sisters-text: #424242;           /* Dark grey */
```

**Design Elements:**
- Medical/scientific aesthetic
- Exploration probe patterns
- Compassionate, welcoming design
- Rounded, friendly shapes
- Soft shadows and glows
- Gentle, approachable typography

---

#### ORE (OUTER RING EXCAVATIONS) - "Industrial Mining"

**Lore:** Largest independent mining corp. Yellow/black safety colors.

**Colors:**
```css
--ore-primary: #FFB300;            /* Industrial yellow */
--ore-secondary: #1A1A1A;          /* Black */
--ore-accent: #FF6600;             /* Orange */
--ore-safety: #FFFFFF;             /* White */
--ore-background: #2E2E2E;         /* Dark grey */
--ore-text: #1A1A1A;               /* Black on yellow */
```

**Design Elements:**
- Industrial safety aesthetic
- Hazard stripes
- Heavy machinery design
- Mining drill patterns
- Utilitarian, function-first
- Bold safety typography
- Rock breaking effects

---

### Theme Selector UI

**Design Requirements:**

```
┌─────────────────────────────────────────────┐
│ CHOOSE YOUR THEME                           │
├─────────────────────────────────────────────┤
│                                             │
│ Search: [____________] 🔍                   │
│                                             │
│ Filter: [All ▼] [Empire] [Pirate] [Other] │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│ │ CALDARI │ │ AMARR   │ │ GALLENTE│      │
│ │         │ │         │ │         │      │
│ │ [Apply] │ │ [Apply] │ │ [Apply] │      │
│ └─────────┘ └─────────┘ └─────────┘      │
│                                             │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│ │TRIGLAVIAN│ │GURISTAS │ │ ANGEL   │      │
│ │   ⭐PRO │ │  ⭐PRO  │ │  ⭐PRO  │      │
│ │ [Locked]│ │ [Locked]│ │ [Locked]│      │
│ └─────────┘ └─────────┘ └─────────┘      │
│                                             │
└─────────────────────────────────────────────┘
```

**Features:**
- Grid layout with preview cards
- Faction logo on each card
- Color palette preview
- PRO badge on locked themes
- Hover to see larger preview
- Click to apply immediately
- "Random" button
- "Match system time" toggle (light/dark based on time of day)

**Preview Card Contents:**
- Theme name
- Faction subtitle
- Small screenshot or color swatches
- Short description (1-2 sentences)
- Apply/Unlock button

---

### Theme Implementation Checklist

**Technical:**
- [ ] CSS custom properties for all themes
- [ ] Theme switching function
- [ ] LocalStorage persistence
- [ ] 300ms transition between themes
- [ ] Theme previews (200x150px images)
- [ ] PRO theme access control

**Accessibility:**
- [ ] WCAG AA compliance (4.5:1 contrast minimum)
- [ ] High contrast mode option
- [ ] Color blind friendly alternatives
- [ ] Reduced motion support
- [ ] Keyboard navigation in theme selector

**Responsive:**
- [ ] All themes work on mobile
- [ ] Simplified effects on low-end devices
- [ ] Touch-friendly theme selector
- [ ] Theme carousel for mobile

**⚠️ STOP AND ASK:**
- Where should theme CSS files be stored?
- What CSS preprocessor is being used (if any)?
- How is the current theme system implemented?
- Where should theme preview images be stored?
- Should themes be loaded dynamically or all at once?

---

## 4. CODE GENERATION & REDEMPTION SYSTEM

### Overview
Sophisticated activation code system for granting PRO time and badges. Codes are encoded but readable by users, with admin controls for precise configuration.

### Code Format

**Structure:**
```
PHOTON-XXXX-XXXX-XXXX
└─────┴────────────────┴─ 12 character encoded string
```

**Example codes:**
- `PHOTON-A7F2-K9M3-V5X1` - PRO time only
- `PHOTON-B3H8-N2P9-W7Y4` - Badge only
- `PHOTON-C5J4-M8Q2-Z9K6` - PRO + Badge combo

**Encoding Scheme:**

The 12 characters encode:
1. **Characters 1-2:** Code type identifier
   - `A*` = PRO time only
   - `B*` = Badge only
   - `C*` = PRO time + Badge
2. **Characters 3-6:** PRO duration (encoded days/hours/minutes)
3. **Characters 7-9:** Badge type(s) encoded
4. **Characters 10-11:** Max redemptions encoded
5. **Character 12:** Checksum for validation

**Character Set:** Use alphanumeric (excluding similar-looking: 0, O, 1, I, L) = 32 characters

**⚠️ NOTE FOR IMPLEMENTATION:**
The encoding/decoding algorithm should be secure but not overly complex. A simple base-32 encoding with checksum is sufficient. Users won't be able to guess patterns easily.

---

### Admin Panel - Code Generation

**Location:** Admin Panel → Codes → Generate New Code

**Code Generation Form:**

```
┌─────────────────────────────────────────────┐
│ GENERATE ACTIVATION CODE                    │
├─────────────────────────────────────────────┤
│                                             │
│ Code Type: *                                │
│ ○ PRO Time Only                            │
│ ○ Badge Only                                │
│ ○ PRO Time + Badge                          │
│                                             │
├─────────────────────────────────────────────┤
│ PRO DURATION (if PRO time selected)         │
├─────────────────────────────────────────────┤
│                                             │
│ Days:    [____]  (0-9999)                  │
│ Hours:   [____]  (0-23)                    │
│ Minutes: [____]  (0-59)                    │
│                                             │
│ Total Duration: 30 days, 12 hours, 30 min  │
│                                             │
├─────────────────────────────────────────────┤
│ BADGES (if badge selected)                  │
├─────────────────────────────────────────────┤
│                                             │
│ ☐ Early Adopter (Rare)                     │
│ ☐ Beta Tester (Rare)                       │
│ ☐ Legendary                                 │
│ ☐ Epic                                      │
│ ☐ Rare                                      │
│ ☐ Uncommon                                  │
│                                             │
│ Note: Multiple badges can be selected       │
│                                             │
├─────────────────────────────────────────────┤
│ CODE SETTINGS                               │
├─────────────────────────────────────────────┤
│                                             │
│ Max Redemptions: [____]                     │
│ (0 = unlimited, 1 = single use)            │
│                                             │
│ Code Valid Until: [Date Picker]            │
│ ☐ Never expires                            │
│                                             │
│ Internal Note/Label: *                      │
│ [_________________________________]         │
│ (e.g., "Fanfest 2025 Giveaway")           │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│ [ Generate Code ] [ Generate Batch (10) ]   │
│                                             │
└─────────────────────────────────────────────┘
```

**After Generation:**

```
┌─────────────────────────────────────────────┐
│ ✓ CODE GENERATED SUCCESSFULLY               │
├─────────────────────────────────────────────┤
│                                             │
│ PHOTON-A7F2-K9M3-V5X1                      │
│                                             │
│ [ Copy to Clipboard ]  [ Generate Another ] │
│                                             │
│ Grants:                                     │
│ • 30 days of PRO                           │
│ • Early Adopter Badge (Rare)               │
│                                             │
│ Settings:                                   │
│ • Max Uses: 1                              │
│ • Expires: Never                            │
│ • Note: "Fanfest 2025 Giveaway"           │
│                                             │
│ [ View All Codes ]                          │
│                                             │
└─────────────────────────────────────────────┘
```

---

### Admin Panel - Code Management

**Location:** Admin Panel → Codes → View All Codes

**Code List View:**

```
┌─────────────────────────────────────────────────────────────────┐
│ ACTIVATION CODES                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Search: [____________] 🔍                                       │
│                                                                 │
│ Filters:                                                        │
│ Status: [All ▼] [Active] [Expired] [Fully Redeemed]          │
│ Type:   [All ▼] [PRO Only] [Badge Only] [PRO+Badge]          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Code: PHOTON-A7F2-K9M3-V5X1                                    │
│ Created: Dec 5, 2025 by Admin_Name                             │
│ Grants: 30 days PRO + Early Adopter badge                      │
│ Status: Active (2/5 redeemed)                                  │
│ Expires: Never                                                  │
│ Note: "Fanfest 2025 Giveaway"                                  │
│ └─ [View Details] [Deactivate] [Delete]                       │
│                                                                 │
│ Code: PHOTON-B3H8-N2P9-W7Y4                                    │
│ Created: Dec 4, 2025 by Admin_Name                             │
│ Grants: Beta Tester badge                                      │
│ Status: Fully Redeemed (100/100)                               │
│ Expires: Jan 1, 2026                                           │
│ Note: "Beta Test Completion"                                   │
│ └─ [View Details] [Archive]                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Admin Panel - Code Activity Log

**Location:** Admin Panel → Codes → Activity Log

**This is a SPECIAL TAB that shows all code-related activities:**

```
┌─────────────────────────────────────────────────────────────────┐
│ CODE ACTIVITY LOG                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Date Range: [Last 30 Days ▼]  Export: [CSV] [Excel]          │
│                                                                 │
│ Filters:                                                        │
│ ☐ Code Generations  ☐ Code Redemptions  ☐ Code Modifications  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Dec 5, 2025 14:32:15                                           │
│ ✓ CODE REDEEMED                                                │
│ Code: PHOTON-A7F2-K9M3-V5X1                                    │
│ Redeemed by: Character_Name (Character_ID)                     │
│ Granted: 30 days PRO + Early Adopter badge                     │
│ IP Address: 192.168.1.1                                        │
│                                                                 │
│ Dec 5, 2025 14:15:08                                           │
│ ⚙️ CODE GENERATED                                              │
│ Code: PHOTON-A7F2-K9M3-V5X1                                    │
│ Generated by: Admin_Name (Admin_ID)                            │
│ Type: PRO + Badge                                              │
│ Settings: 5 max uses, never expires                            │
│ Note: "Fanfest 2025 Giveaway"                                  │
│                                                                 │
│ Dec 4, 2025 09:22:43                                           │
│ ✓ CODE REDEEMED                                                │
│ Code: PHOTON-B3H8-N2P9-W7Y4                                    │
│ Redeemed by: Another_Character (Character_ID)                  │
│ Granted: Beta Tester badge                                     │
│ IP Address: 192.168.1.2                                        │
│                                                                 │
│ Dec 3, 2025 16:45:12                                           │
│ ⚠️ FAILED REDEMPTION ATTEMPT                                   │
│ Code: PHOTON-XXXX-XXXX-XXXX (invalid)                         │
│ Attempted by: Some_User (User_ID)                             │
│ Reason: Invalid code format                                    │
│ IP Address: 192.168.1.3                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Activity Log Features:**
- Shows who generated which codes
- Shows who redeemed which codes
- Timestamps for all activities
- IP addresses for security
- Failed redemption attempts
- Code modifications (if admin edits settings)
- Searchable and filterable
- Export to CSV/Excel
- Pagination for large datasets

---

### User Code Redemption

**Location:** Settings → Redeem Code (or PRO page)

**Redemption Interface:**

```
┌─────────────────────────────────────────────┐
│ REDEEM ACTIVATION CODE                      │
├─────────────────────────────────────────────┤
│                                             │
│ Enter your code:                            │
│                                             │
│ PHOTON-[____]-[____]-[____]                │
│                                             │
│ [ Redeem Code ]                             │
│                                             │
├─────────────────────────────────────────────┤
│ PREVIOUSLY REDEEMED CODES                   │
├─────────────────────────────────────────────┤
│                                             │
│ • Dec 1, 2025 - 30 days PRO                │
│ • Nov 15, 2025 - Early Adopter badge       │
│ • Oct 30, 2025 - Beta Tester badge         │
│                                             │
│ [ Show More ]                               │
│                                             │
└─────────────────────────────────────────────┘
```

**Success Response:**

```
┌─────────────────────────────────────────────┐
│ ✓ CODE REDEEMED SUCCESSFULLY!               │
├─────────────────────────────────────────────┤
│                                             │
│ You received:                               │
│ • 30 days of PRO subscription              │
│ • Early Adopter Badge (Rare)               │
│                                             │
│ Your PRO subscription now expires:          │
│ January 15, 2026                            │
│                                             │
│ Your new badges are now visible on:         │
│ • Your profile                              │
│ • Shareable session cards                   │
│ • Sidebar (when expanded)                   │
│                                             │
│ [ Continue to Dashboard ]                   │
│                                             │
└─────────────────────────────────────────────┘
```

**Error Responses:**

```
┌─────────────────────────────────────────────┐
│ ❌ CODE REDEMPTION FAILED                   │
├─────────────────────────────────────────────┤
│                                             │
│ Error: Invalid code format                  │
│                                             │
│ Please check your code and try again.       │
│ Codes should be in format:                  │
│ PHOTON-XXXX-XXXX-XXXX                      │
│                                             │
│ [ Try Again ]                               │
│                                             │
└─────────────────────────────────────────────┘
```

**Possible Error Messages:**
- "Invalid code format"
- "Code not found"
- "Code has expired"
- "Code has reached maximum redemptions"
- "You have already redeemed this code"
- "This code is not yet active"

---

### Code System Database Schema

**Codes Table:**
```sql
CREATE TABLE activation_codes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(24) UNIQUE NOT NULL,  -- PHOTON-XXXX-XXXX-XXXX
  type ENUM('pro', 'badge', 'both') NOT NULL,
  
  -- PRO details
  pro_duration_days INT DEFAULT 0,
  pro_duration_hours INT DEFAULT 0,
  pro_duration_minutes INT DEFAULT 0,
  
  -- Badge details (JSON array of badge IDs)
  badge_ids JSON,
  
  -- Usage limits
  max_redemptions INT DEFAULT 1,  -- 0 = unlimited
  times_redeemed INT DEFAULT 0,
  
  -- Validity
  expires_at TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  internal_note VARCHAR(255),
  created_by INT,  -- Admin user ID
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

**Code Redemptions Table:**
```sql
CREATE TABLE code_redemptions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code_id INT NOT NULL,
  user_id INT NOT NULL,
  character_id INT,
  
  -- What was granted
  pro_days_granted INT,
  pro_hours_granted INT,
  pro_minutes_granted INT,
  badges_granted JSON,
  
  -- Metadata
  redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  FOREIGN KEY (code_id) REFERENCES activation_codes(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY unique_user_code (user_id, code_id)  -- Prevent double redemption
);
```

**Code Activity Log Table:**
```sql
CREATE TABLE code_activity_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  activity_type ENUM('generated', 'redeemed', 'modified', 'deactivated', 'failed_redemption') NOT NULL,
  code_id INT,
  code_string VARCHAR(24),
  
  -- Actor
  actor_id INT,  -- Admin or user ID
  actor_type ENUM('admin', 'user') NOT NULL,
  
  -- Details
  details JSON,  -- Flexible field for activity-specific data
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  
  FOREIGN KEY (code_id) REFERENCES activation_codes(id),
  FOREIGN KEY (actor_id) REFERENCES users(id)
);
```

---

### Code Generation Logic

**Encoding Function (Pseudo-code):**

```javascript
function generateCode(config) {
  // config = { type, proDays, proHours, proMinutes, badgeIds, maxRedemptions }
  
  // Character 1-2: Type identifier
  let typePrefix = '';
  if (config.type === 'pro') typePrefix = 'A';
  else if (config.type === 'badge') typePrefix = 'B';
  else if (config.type === 'both') typePrefix = 'C';
  
  // Character 3-6: PRO duration encoded (4 chars)
  const totalMinutes = (config.proDays * 24 * 60) + (config.proHours * 60) + config.proMinutes;
  const durationEncoded = encodeToBase32(totalMinutes, 4);
  
  // Character 7-9: Badge IDs encoded (3 chars)
  const badgeEncoded = encodeBadgeIds(config.badgeIds, 3);
  
  // Character 10-11: Max redemptions encoded (2 chars)
  const redemptionsEncoded = encodeToBase32(config.maxRedemptions, 2);
  
  // Character 12: Checksum
  const dataString = typePrefix + durationEncoded + badgeEncoded + redemptionsEncoded;
  const checksum = calculateChecksum(dataString);
  
  // Combine and format
  const fullCode = typePrefix + durationEncoded + badgeEncoded + redemptionsEncoded + checksum;
  const formatted = `PHOTON-${fullCode.substring(0,4)}-${fullCode.substring(4,8)}-${fullCode.substring(8,12)}`;
  
  return formatted;
}

function encodeToBase32(number, length) {
  const charset = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';  // No 0,1,I,L,O
  let encoded = '';
  
  for (let i = 0; i < length; i++) {
    encoded = charset[number % 32] + encoded;
    number = Math.floor(number / 32);
  }
  
  return encoded.padStart(length, '2');
}

function calculateChecksum(data) {
  // Simple checksum algorithm
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data.charCodeAt(i) * (i + 1);
  }
  return encodeToBase32(sum % 32, 1);
}
```

**Decoding Function:**

```javascript
function decodeCode(codeString) {
  // Remove PHOTON- prefix and dashes
  const code = codeString.replace('PHOTON-', '').replace(/-/g, '');
  
  // Validate length
  if (code.length !== 12) throw new Error('Invalid code format');
  
  // Validate checksum
  const dataString = code.substring(0, 11);
  const checksum = code.substring(11);
  if (calculateChecksum(dataString) !== checksum) {
    throw new Error('Invalid code (checksum failed)');
  }
  
  // Decode type
  const typeChar = code.charAt(0);
  let type = '';
  if (typeChar === 'A') type = 'pro';
  else if (typeChar === 'B') type = 'badge';
  else if (typeChar === 'C') type = 'both';
  
  // Decode PRO duration
  const durationEncoded = code.substring(1, 5);
  const totalMinutes = decodeFromBase32(durationEncoded);
  const proDays = Math.floor(totalMinutes / (24 * 60));
  const proHours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const proMinutes = totalMinutes % 60;
  
  // Decode badges
  const badgeEncoded = code.substring(5, 8);
  const badgeIds = decodeBadgeIds(badgeEncoded);
  
  // Decode max redemptions
  const redemptionsEncoded = code.substring(8, 10);
  const maxRedemptions = decodeFromBase32(redemptionsEncoded);
  
  return {
    type,
    proDays,
    proHours,
    proMinutes,
    badgeIds,
    maxRedemptions
  };
}
```

---

### Code Redemption Logic

**Validation Steps:**

1. Format validation (PHOTON-XXXX-XXXX-XXXX)
2. Code exists in database
3. Code is active
4. Code hasn't expired
5. Code hasn't reached max redemptions
6. User hasn't already redeemed this code
7. Decode code to get benefits

**Redemption Process:**

```javascript
async function redeemCode(userId, codeString) {
  // 1. Validate format
  if (!isValidCodeFormat(codeString)) {
    logFailedRedemption(userId, codeString, 'Invalid format');
    throw new Error('Invalid code format');
  }
  
  // 2. Find code in database
  const code = await findCode(codeString);
  if (!code) {
    logFailedRedemption(userId, codeString, 'Code not found');
    throw new Error('Code not found');
  }
  
  // 3. Check if active
  if (!code.is_active) {
    logFailedRedemption(userId, codeString, 'Code inactive');
    throw new Error('This code is no longer active');
  }
  
  // 4. Check expiration
  if (code.expires_at && code.expires_at < new Date()) {
    logFailedRedemption(userId, codeString, 'Code expired');
    throw new Error('This code has expired');
  }
  
  // 5. Check redemption limit
  if (code.max_redemptions > 0 && code.times_redeemed >= code.max_redemptions) {
    logFailedRedemption(userId, codeString, 'Max redemptions reached');
    throw new Error('This code has reached its maximum redemptions');
  }
  
  // 6. Check if user already redeemed
  const alreadyRedeemed = await hasUserRedeemedCode(userId, code.id);
  if (alreadyRedeemed) {
    logFailedRedemption(userId, codeString, 'Already redeemed by user');
    throw new Error('You have already redeemed this code');
  }
  
  // 7. Decode to get benefits
  const benefits = decodeCode(codeString);
  
  // 8. Grant benefits in transaction
  await db.transaction(async (trx) => {
    // Grant PRO time if applicable
    if (benefits.type === 'pro' || benefits.type === 'both') {
      const durationMinutes = (benefits.proDays * 24 * 60) + 
                               (benefits.proHours * 60) + 
                               benefits.proMinutes;
      await extendProSubscription(userId, durationMinutes, trx);
    }
    
    // Grant badges if applicable
    if (benefits.type === 'badge' || benefits.type === 'both') {
      for (const badgeId of benefits.badgeIds) {
        await grantBadge(userId, badgeId, 'code_redemption', trx);
      }
    }
    
    // Record redemption
    await recordRedemption(code.id, userId, benefits, trx);
    
    // Increment redemption count
    await incrementRedemptionCount(code.id, trx);
    
    // Log successful redemption
    await logSuccessfulRedemption(code.id, userId, codeString, benefits, trx);
  });
  
  return benefits;
}
```

**⚠️ STOP AND ASK:**
- What database system is being used?
- How is the current PRO subscription system implemented?
- Where should the encoding/decoding functions be placed?
- Should there be rate limiting on redemption attempts?
- What user information should be logged for security?

---

## 5. BADGE SYSTEM & USER MANAGEMENT

### Overview
Comprehensive badge system with admin grants, code redemptions, and achievement unlocks. Badges display in sidebar (top 3) and on shareable session cards.

### Badge Types & Rarity

**Rarity Tiers:**
1. **Legendary** - Extremely rare, special achievements
2. **Epic** - Very rare, significant accomplishments
3. **Rare** - Uncommon, notable achievements
4. **Uncommon** - Common but meaningful

**Special Event Badges (Rare tier):**
- Early Adopter
- Beta Tester
- Fanfest Attendee (future)
- Tournament Winner (future)
- Community Contributor (future)

---

### Badge Database Schema

**Badges Table:**
```sql
CREATE TABLE badges (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  rarity ENUM('legendary', 'epic', 'rare', 'uncommon') NOT NULL,
  icon_url VARCHAR(255),  -- Path to badge icon image
  
  -- Unlock conditions
  unlockable_via_achievement BOOLEAN DEFAULT FALSE,
  achievement_criteria JSON,  -- Criteria for automatic unlock
  
  -- Display
  display_order INT DEFAULT 0,
  is_visible BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**User Badges Table:**
```sql
CREATE TABLE user_badges (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  badge_id INT NOT NULL,
  
  -- How was it obtained
  granted_via ENUM('admin', 'code', 'achievement') NOT NULL,
  granted_by INT,  -- Admin ID if manually granted
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Display preferences
  is_showcased BOOLEAN DEFAULT TRUE,  -- Show on profile/cards
  showcase_order INT DEFAULT 0,  -- Order in top 3 display
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (badge_id) REFERENCES badges(id),
  FOREIGN KEY (granted_by) REFERENCES users(id),
  UNIQUE KEY unique_user_badge (user_id, badge_id)
);
```

**Badge Activity Log:**
```sql
CREATE TABLE badge_activity_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  activity_type ENUM('granted', 'revoked', 'achievement_unlocked') NOT NULL,
  badge_id INT NOT NULL,
  user_id INT NOT NULL,
  
  -- Actor (if manually granted/revoked)
  admin_id INT,
  
  -- Details
  grant_method ENUM('admin', 'code', 'achievement'),
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (badge_id) REFERENCES badges(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (admin_id) REFERENCES users(id)
);
```

---

### Admin Panel - User Management & Badge Grants

**Location:** Admin Panel → Users → Manage Users

**User Management Interface:**

```
┌─────────────────────────────────────────────────────────────────┐
│ USER MANAGEMENT                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Search: [____________] 🔍  [Search by Character/Email/ID]      │
│                                                                 │
│ Filters:                                                        │
│ ☐ PRO Users Only        ☐ Has Badges                          │
│ ☐ Free Users Only       ☐ Early Adopters                      │
│ ☐ Registered Last 30 Days  ☐ Beta Testers                     │
│ ☐ Active Last 7 Days    ☐ No Activity 30+ Days                │
│                                                                 │
│ Sort by: [Newest ▼]                                            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ [☐ Select All]  Bulk Actions: [Grant Badge ▼] [Export CSV]    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ☐ Character Name 1                                             │
│   Email: user1@email.com  |  ID: 12345                        │
│   PRO: Yes (expires Jan 15, 2026)                             │
│   Badges: 🏆 Early Adopter  ⭐ Epic  🎖️ Rare               │
│   Registered: Nov 1, 2025  |  Last Active: 2 hours ago        │
│   └─ [View Profile] [Grant Badge] [Manage PRO] [View Sessions]│
│                                                                 │
│ ☐ Character Name 2                                             │
│   Email: user2@email.com  |  ID: 12346                        │
│   PRO: No                                                      │
│   Badges: 🎖️ Beta Tester                                     │
│   Registered: Dec 1, 2025  |  Last Active: Yesterday          │
│   └─ [View Profile] [Grant Badge] [Manage PRO] [View Sessions]│
│                                                                 │
│ ☐ Character Name 3                                             │
│   Email: user3@email.com  |  ID: 12347                        │
│   PRO: Yes (expires Feb 20, 2026)                             │
│   Badges: None                                                 │
│   Registered: Oct 15, 2025  |  Last Active: 3 days ago        │
│   └─ [View Profile] [Grant Badge] [Manage PRO] [View Sessions]│
│                                                                 │
│                                                                 │
│ Showing 1-20 of 1,247 users  [Previous] [1] [2] [3] ... [Next]│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Grant Badge Modal (Single User)

**Triggered by:** Clicking "Grant Badge" on a user

```
┌─────────────────────────────────────────────┐
│ GRANT BADGE TO: Character Name 1            │
├─────────────────────────────────────────────┤
│                                             │
│ Select Badge: *                             │
│                                             │
│ ○ 🏆 Early Adopter (Rare)                  │
│   First users of PHOTON                    │
│                                             │
│ ○ 🎖️ Beta Tester (Rare)                   │
│   Participated in beta testing             │
│                                             │
│ ○ ⭐ Legendary Badge                        │
│   Exceptional achievement                   │
│                                             │
│ ○ 💎 Epic Badge                             │
│   Significant accomplishment                │
│                                             │
│ ○ 🔷 Rare Badge                             │
│   Notable achievement                       │
│                                             │
│ ○ 🔸 Uncommon Badge                         │
│   Common milestone                          │
│                                             │
│ Internal Note (optional):                   │
│ [_________________________________]         │
│                                             │
│ [ Grant Badge ]  [ Cancel ]                 │
│                                             │
└─────────────────────────────────────────────┘
```

---

### Grant Badge Modal (Bulk - Multiple Users)

**Triggered by:** Selecting multiple users and choosing "Grant Badge" from bulk actions

```
┌─────────────────────────────────────────────┐
│ BULK GRANT BADGE                            │
├─────────────────────────────────────────────┤
│                                             │
│ Selected Users: 15                          │
│                                             │
│ Character Name 1, Character Name 2,         │
│ Character Name 3, ... and 12 more           │
│                                             │
│ Select Badge to Grant: *                    │
│                                             │
│ [Early Adopter (Rare)        ▼]            │
│                                             │
│ Internal Note (optional):                   │
│ [_________________________________]         │
│ (e.g., "Rewarding early supporters")       │
│                                             │
│ ⚠️ Warning: This action cannot be undone.  │
│ All selected users will receive this badge. │
│                                             │
│ [ Grant to All ]  [ Cancel ]                │
│                                             │
└─────────────────────────────────────────────┘
```

**After Bulk Grant:**

```
┌─────────────────────────────────────────────┐
│ ✓ BADGES GRANTED SUCCESSFULLY               │
├─────────────────────────────────────────────┤
│                                             │
│ Early Adopter badge granted to:             │
│                                             │
│ • Character Name 1                          │
│ • Character Name 2                          │
│ • Character Name 3                          │
│ ... and 12 more users                       │
│                                             │
│ Total: 15 badges granted                    │
│                                             │
│ [ View Badge Activity Log ]  [ Close ]      │
│                                             │
└─────────────────────────────────────────────┘
```

---

### Admin Panel - Badge Activity Log

**Location:** Admin Panel → Badges → Activity Log

**This shows ALL badge-related activities:**

```
┌─────────────────────────────────────────────────────────────────┐
│ BADGE ACTIVITY LOG                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Date Range: [Last 30 Days ▼]  Export: [CSV] [Excel]          │
│                                                                 │
│ Filters:                                                        │
│ ☐ Admin Grants  ☐ Code Redemptions  ☐ Achievement Unlocks     │
│ Badge: [All Badges ▼]                                          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Dec 5, 2025 15:22:10                                           │
│ 🏆 BADGE GRANTED (Admin)                                       │
│ Badge: Early Adopter (Rare)                                    │
│ Granted to: Character_Name (User_ID: 12345)                    │
│ Granted by: Admin_Name (Admin_ID: 1)                          │
│ Note: "Rewarding early supporter"                             │
│                                                                 │
│ Dec 5, 2025 14:32:15                                           │
│ 🎖️ BADGE GRANTED (Code Redemption)                            │
│ Badge: Beta Tester (Rare)                                      │
│ Granted to: Another_Character (User_ID: 12346)                │
│ Via Code: PHOTON-B3H8-N2P9-W7Y4                               │
│                                                                 │
│ Dec 5, 2025 10:15:33                                           │
│ ⭐ BADGE UNLOCKED (Achievement)                                │
│ Badge: Mining Master (Epic)                                    │
│ Unlocked by: Third_Character (User_ID: 12347)                 │
│ Achievement: Mined 1,000,000 m³ of ore                        │
│                                                                 │
│ Dec 4, 2025 22:18:45                                           │
│ 🏆 BULK BADGE GRANT (Admin)                                    │
│ Badge: Early Adopter (Rare)                                    │
│ Granted to: 15 users                                           │
│ Granted by: Admin_Name (Admin_ID: 1)                          │
│ Note: "Beta test completion rewards"                          │
│ [ View Recipients List ]                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Badge Display - Sidebar (User View)

**When Sidebar is Expanded:**

```
┌─────────────────────┐
│                     │
│   [Character        │
│    Avatar]          │
│                     │
│ Character Name      │
│                     │
│ 🏆 🎖️ ⭐          │ ← Top 3 badges
│                     │
│ [Hover tooltip      │
│  shows badge name   │
│  and rarity]        │
│                     │
└─────────────────────┘
```

**When Sidebar is Collapsed:**

```
┌────┐
│    │
│[AV]│ ← Avatar only
│    │
│ 🏆 │ ← Top badge only
│    │
└────┘
```

**Tooltip on Hover:**

```
┌─────────────────────────┐
│ 🏆 Early Adopter        │
│ Rarity: Rare            │
│ Granted: Nov 1, 2025    │
└─────────────────────────┘
```

---

### Badge Display - Shareable Session Cards

**On /share/:id pages:**

```
┌─────────────────────────────────────────────┐
│ CHARACTER NAME'S RAT SESSION                │
│ 🏆 🎖️ ⭐                                   │ ← Badges here
├─────────────────────────────────────────────┤
│                                             │
│ Session Duration: 2 hours 35 minutes        │
│ ISK Earned: 125,000,000                     │
│ Efficiency: 48.3M ISK/hour                  │
│                                             │
│ ... rest of session details ...             │
│                                             │
└─────────────────────────────────────────────┘
```

---

### Badge Achievement System

**Achievement-Based Badge Unlocks:**

Some badges can be earned automatically when users achieve certain milestones.

**Example Achievements:**

```javascript
const BADGE_ACHIEVEMENTS = {
  'mining_master': {
    badge_id: 5,
    criteria: {
      total_ore_mined_m3: 1000000  // 1 million m³
    }
  },
  'session_veteran': {
    badge_id: 6,
    criteria: {
      total_sessions: 100
    }
  },
  'isk_billionaire': {
    badge_id: 7,
    criteria: {
      total_isk_earned: 1000000000  // 1 billion ISK
    }
  },
  'dedicated_miner': {
    badge_id: 8,
    criteria: {
      consecutive_days_mined: 30
    }
  }
};
```

**Achievement Check Logic:**

```javascript
async function checkBadgeAchievements(userId) {
  const userStats = await getUserStats(userId);
  
  for (const [achievementKey, achievement] of Object.entries(BADGE_ACHIEVEMENTS)) {
    // Check if user already has this badge
    const hasBadge = await userHasBadge(userId, achievement.badge_id);
    if (hasBadge) continue;
    
    // Check if criteria met
    let criteriaMet = true;
    for (const [stat, requiredValue] of Object.entries(achievement.criteria)) {
      if (userStats[stat] < requiredValue) {
        criteriaMet = false;
        break;
      }
    }
    
    // Grant badge if criteria met
    if (criteriaMet) {
      await grantBadge(userId, achievement.badge_id, 'achievement');
      await notifyUserBadgeUnlocked(userId, achievement.badge_id);
    }
  }
}
```

**When to Check Achievements:**
- After completing a mining session
- After updating user stats
- On login (daily check)
- When viewing profile/badges page

---

### Badge Management - Admin Panel

**Location:** Admin Panel → Badges → Manage Badges

**Badge List:**

```
┌─────────────────────────────────────────────────────────────────┐
│ BADGE MANAGEMENT                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ [ + Create New Badge ]                                          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 🏆 Early Adopter                                                │
│ Rarity: Rare  |  Granted to: 1,234 users                       │
│ Description: First users of PHOTON                             │
│ Unlockable via Achievement: No                                  │
│ └─ [Edit] [View Recipients] [Delete]                           │
│                                                                 │
│ 🎖️ Beta Tester                                                 │
│ Rarity: Rare  |  Granted to: 89 users                          │
│ Description: Participated in beta testing                      │
│ Unlockable via Achievement: No                                  │
│ └─ [Edit] [View Recipients] [Delete]                           │
│                                                                 │
│ ⭐ Mining Master                                                │
│ Rarity: Epic  |  Granted to: 456 users                         │
│ Description: Mined over 1 million m³ of ore                    │
│ Unlockable via Achievement: Yes (1M m³ ore)                    │
│ └─ [Edit] [View Recipients] [Delete]                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Create/Edit Badge Modal:**

```
┌─────────────────────────────────────────────┐
│ CREATE NEW BADGE                            │
├─────────────────────────────────────────────┤
│                                             │
│ Badge Name: *                               │
│ [_________________________________]         │
│                                             │
│ Description:                                │
│ [_________________________________]         │
│ [_________________________________]         │
│                                             │
│ Rarity: *                                   │
│ ○ Legendary  ○ Epic  ○ Rare  ○ Uncommon    │
│                                             │
│ Badge Icon:                                 │
│ [Choose File...] or [Icon URL]             │
│ Preview: [Icon Preview]                     │
│                                             │
│ Unlockable via Achievement:                 │
│ ☐ Yes (automatically grant on achievement) │
│                                             │
│ If yes, Achievement Criteria (JSON):        │
│ [_________________________________]         │
│ {                                           │
│   "total_ore_mined_m3": 1000000            │
│ }                                           │
│                                             │
│ Display Order: [___]                        │
│ (Lower numbers appear first)                │
│                                             │
│ ☑ Visible to users                         │
│                                             │
│ [ Save Badge ]  [ Cancel ]                  │
│                                             │
└─────────────────────────────────────────────┘
```

---

### User Badge Management (User View)

**Location:** User Profile → Badges

**User's Badge Collection:**

```
┌─────────────────────────────────────────────────────────────────┐
│ MY BADGES                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ You have earned 3 of 12 available badges                        │
│                                                                 │
│ TOP 3 SHOWCASED BADGES                                          │
│ (These appear on your profile and session cards)               │
│                                                                 │
│ 1. 🏆 Early Adopter (Rare)                                     │
│    [Move Down] [Remove from Showcase]                          │
│                                                                 │
│ 2. 🎖️ Beta Tester (Rare)                                      │
│    [Move Up] [Move Down] [Remove from Showcase]               │
│                                                                 │
│ 3. ⭐ Mining Enthusiast (Uncommon)                             │
│    [Move Up] [Remove from Showcase]                            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ ALL MY BADGES                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 🏆 Early Adopter (Rare)                                        │
│    Granted: Nov 1, 2025  |  Via: Admin Grant                   │
│    "First users of PHOTON"                                     │
│                                                                 │
│ 🎖️ Beta Tester (Rare)                                         │
│    Granted: Oct 15, 2025  |  Via: Code Redemption             │
│    "Participated in beta testing"                              │
│                                                                 │
│ ⭐ Mining Enthusiast (Uncommon)                                │
│    Unlocked: Nov 20, 2025  |  Via: Achievement                 │
│    "Mined over 100,000 m³ of ore"                              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ LOCKED BADGES (Not Yet Earned)                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 🔒 Mining Master (Epic)                                        │
│    "Mine over 1 million m³ of ore"                            │
│    Progress: 234,567 / 1,000,000 m³ (23%)                     │
│    [█████░░░░░░░░░░░░░░░] 23%                                 │
│                                                                 │
│ 🔒 ISK Billionaire (Legendary)                                │
│    "Earn over 1 billion ISK in total"                         │
│    Progress: 456,789,012 / 1,000,000,000 ISK (46%)           │
│    [████████░░░░░░░░░░░] 46%                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Badge Notifications

**When User Unlocks Badge via Achievement:**

```
┌─────────────────────────────────────────────┐
│ 🎉 BADGE UNLOCKED!                          │
├─────────────────────────────────────────────┤
│                                             │
│ You've earned:                              │
│                                             │
│        🏆                                    │
│   Mining Master                             │
│      (Epic)                                  │
│                                             │
│ "Mined over 1 million m³ of ore"          │
│                                             │
│ This badge now appears on your profile      │
│ and shareable session cards!                │
│                                             │
│ [ View My Badges ]  [ Close ]               │
│                                             │
└─────────────────────────────────────────────┘
```

**Toast Notification (Small, Non-Intrusive):**

```
┌─────────────────────────────────┐
│ ✓ Badge Unlocked!               │
│ 🏆 Mining Master (Epic)         │
│ [View]                          │
└─────────────────────────────────┘
```

---

### Initial Badge Setup

**Pre-populate these badges on deployment:**

```sql
INSERT INTO badges (name, description, rarity, unlockable_via_achievement) VALUES
('Early Adopter', 'First users of PHOTON', 'rare', FALSE),
('Beta Tester', 'Participated in beta testing', 'rare', FALSE),
('Mining Enthusiast', 'Mined over 100,000 m³ of ore', 'uncommon', TRUE),
('Mining Master', 'Mined over 1 million m³ of ore', 'epic', TRUE),
('Session Veteran', 'Completed 100 ratting sessions', 'rare', TRUE),
('ISK Millionaire', 'Earned over 100 million ISK', 'uncommon', TRUE),
('ISK Billionaire', 'Earned over 1 billion ISK', 'legendary', TRUE),
('Dedicated Miner', 'Mined for 30 consecutive days', 'epic', TRUE);
```

**⚠️ STOP AND ASK:**
- Where should badge icon images be stored?
- What image format/size for badge icons?
- Should there be different icon designs for each rarity?
- How should the top 3 badge selection work if user has more than 3?
- Should badges have levels/tiers (Bronze/Silver/Gold versions)?

---

## 6. IMPLEMENTATION PRIORITY

### Phase 1: Foundation (Week 1)
**Critical - Must Complete First**

- [ ] Application rebranding (RAT TRACKER → PHOTON)
  - All code references
  - UI elements
  - Documentation
  - Database (migration if needed)

- [ ] Database schema updates
  - Codes tables
  - Badges tables
  - Activity log tables
  - User badges table

- [ ] Basic sidebar navigation
  - Structure and layout
  - Toggle functionality
  - State persistence

**⚠️ CHECKPOINT:** Verify app loads correctly with new name and basic sidebar works

---

### Phase 2: Navigation & Basic Themes (Week 2)
**High Priority**

- [ ] Complete sidebar implementation
  - Animations (300ms open, 250ms close)
  - Desktop responsive behavior
  - Mobile overlay mode
  - Accessibility features

- [ ] Theme system infrastructure
  - CSS variable system
  - Theme storage (localStorage)
  - Theme switching function
  - Theme selector UI (basic)

- [ ] Implement FREE themes
  - Light (default)
  - Dark (default)
  - Caldari State
  - Amarr Empire
  - Gallente Federation
  - Minmatar Republic
  - CONCORD

**⚠️ CHECKPOINT:** Sidebar fully functional, can switch between free themes

---

### Phase 3: Code Generation System (Week 3)
**High Priority**

- [ ] Code generation backend
  - Encoding function
  - Decoding function
  - Validation logic
  - Database operations

- [ ] Admin code generation UI
  - Form interface
  - Code preview
  - Batch generation

- [ ] Code redemption user interface
  - Redemption page/modal
  - Success/error messages
  - Previously redeemed codes list

- [ ] Code activity logging
  - Log all generations
  - Log all redemptions
  - Log failed attempts

**⚠️ CHECKPOINT:** Admins can generate codes, users can redeem them

---

### Phase 4: Badge System (Week 4)
**High Priority**

- [ ] Badge database setup
  - Create initial badges
  - Badge icons (placeholder if needed)
  - Achievement criteria

- [ ] Admin badge management
  - User filtering and search
  - Single badge grant
  - Bulk badge grant
  - Badge activity log

- [ ] Badge display
  - Sidebar integration (top 3)
  - Shareable card integration
  - Tooltips with name and rarity
  - User badge collection page

- [ ] Achievement system
  - Criteria checking logic
  - Automatic badge unlocking
  - User notifications

**⚠️ CHECKPOINT:** Badges can be granted, displayed in sidebar and cards

---

### Phase 5: PRO Themes & Polish (Week 5)
**Enhancement**

- [ ] Implement PRO-exclusive themes
  - Triglavian Collective
  - Guristas Pirates
  - Angel Cartel
  - Blood Raiders
  - Jove Empire
  - Sleepers/Drifters
  - Sisters of EVE
  - ORE

- [ ] Theme access control
  - PRO check for locked themes
  - "Upgrade to PRO" prompts
  - Theme preview for locked themes

- [ ] Enhanced theme selector
  - Search and filter
  - Better previews
  - Random theme button
  - Match system time option

**⚠️ CHECKPOINT:** All themes implemented and access-controlled

---

### Phase 6: Testing & Optimization (Week 6)
**Critical**

- [ ] Comprehensive testing
  - All themes on all pages
  - Code generation/redemption flow
  - Badge granting (manual and achievement)
  - Sidebar on all devices
  - Accessibility compliance

- [ ] Performance optimization
  - Theme switching speed
  - Animation smoothness
  - Database query optimization
  - Mobile performance

- [ ] Bug fixes
  - Address any issues found
  - Cross-browser testing
  - Edge case handling

- [ ] Documentation
  - Admin guide for code generation
  - Admin guide for badge management
  - User guide for themes
  - Developer documentation

**⚠️ CHECKPOINT:** Everything works smoothly, no critical bugs

---

### Phase 7: Enhancements & Future Features (Ongoing)
**Optional**

- [ ] Additional badges
  - More achievement badges
  - Event badges
  - Seasonal badges

- [ ] Enhanced code features
  - Code usage analytics
  - Code expiration warnings
  - Automated code distribution

- [ ] Theme enhancements
  - User custom themes
  - Theme events
  - Community themes

- [ ] Badge enhancements
  - Badge levels/tiers
  - Badge showcase customization
  - Badge trading/gifting

---

## CRITICAL IMPLEMENTATION NOTES

### ⚠️ BEFORE STARTING ANY PHASE:

1. **Read Entire Document** - Understand all interconnected systems
2. **Ask Questions** - Stop and ask if anything is unclear
3. **Check Existing Code** - See how current systems work
4. **Plan Database Changes** - Schema changes affect everything
5. **Test Incrementally** - Test each feature before moving on

### ⚠️ WHEN TO STOP AND ASK:

- **File Structure** - "Where should I place this code?"
- **Existing Systems** - "How does the current X system work?"
- **Database** - "What's the current schema for Y table?"
- **Design Decisions** - "Should this look like A or B?"
- **Technical Limitations** - "I can't do X because of Y"
- **Conflicts** - "This feature conflicts with existing Z"
- **Missing Information** - "I need more details about X"

### ⚠️ QUALITY STANDARDS:

- **Code Quality** - Clean, commented, maintainable
- **Security** - Proper validation, sanitization, authentication
- **Performance** - Fast load times, smooth animations
- **Accessibility** - WCAG AA compliance minimum
- **Responsive** - Works on all devices
- **Testing** - Thoroughly test each feature
- **Documentation** - Document complex logic

---

## SUCCESS CRITERIA

### Application Rebranding ✓
- [ ] No references to "RAT TRACKER" remain
- [ ] All "PHOTON" branding implemented
- [ ] Database migrations successful
- [ ] All pages load correctly

### Sidebar Navigation ✓
- [ ] Opens/closes smoothly (300ms/250ms)
- [ ] Works on desktop and mobile
- [ ] State persists across sessions
- [ ] Keyboard accessible
- [ ] Top 3 badges display correctly in footer

### Theme System ✓
- [ ] All 15 themes implemented and working
- [ ] FREE themes accessible to all
- [ ] PRO themes locked for non-PRO users
- [ ] Theme switching is instant (<100ms)
- [ ] All themes meet WCAG AA standards
- [ ] Theme selector UI is intuitive
- [ ] Themes work on all pages

### Code Generation ✓
- [ ] Admins can generate codes with precise settings
- [ ] Codes encode type, duration, badges, limits
- [ ] Users can redeem codes successfully
- [ ] All redemptions logged in activity log
- [ ] Failed attempts logged
- [ ] Code activity log shows all activities
- [ ] Validation prevents double redemption
- [ ] Expiration works correctly

### Badge System ✓
- [ ] Admins can grant badges (single & bulk)
- [ ] Badges display in sidebar (top 3)
- [ ] Badges display on shareable cards
- [ ] Tooltips show badge name and rarity
- [ ] Achievement unlocks work automatically
- [ ] Badge activity log tracks all grants
- [ ] User badge collection page works
- [ ] Badge notifications appear correctly

### Overall Quality ✓
- [ ] No critical bugs
- [ ] Fast performance (< 2s page load)
- [ ] Smooth animations (60fps)
- [ ] Works on Chrome, Firefox, Safari, Edge
- [ ] Works on mobile devices
- [ ] Accessible to screen readers
- [ ] All features documented

---

## FINAL REMINDER

**This is a complex, multi-system upgrade. Take your time, ask questions, and test thoroughly. Every feature listed here MUST be implemented. Do not skip anything. If you encounter problems or need clarification, STOP and ASK the user.**

**Good luck, and may PHOTON shine bright! ⚡ o7**

---

*End of Document*
