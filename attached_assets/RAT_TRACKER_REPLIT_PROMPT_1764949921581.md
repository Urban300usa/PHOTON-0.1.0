# RAT TRACKER - COMPREHENSIVE UI/UX IMPROVEMENTS & LORE-ACCURATE THEMES

## PROJECT CONTEXT: EXISTING FEATURES

This application is a comprehensive EVE Online ratting and mining tracker with the following current capabilities:

### Core Features
- EVE SSO Login: Authentication via EVE Online OAuth
- Session Tracking: Start/stop/pause/reset timers with duration display
- Income Entry: Quick ISK entry with preset amounts (1M, 5M, 10M, 25M)
- Session History: Table view of past sessions with sorting
- Wallet Overview: Current balance, bounties, recent transactions (requires ESI)
- Character Status: Ship, location, security status display (requires ESI)
- Customizable Dashboard: Draggable/resizable tile grid (PRO feature)
- Tile Library: Toggle which tiles appear on dashboard

### Mining Tracker (/mining page)
- Ore Breakdown: List of mined ores with quantities
- Mineral Processing: Calculate minerals from ores
- Adjustable Yield %: Slider for reprocessing yield (30-90%)
- Ore Selection: Choose which ores contribute to mineral totals
- Time Filtering: Filter by hour/day/week/month
- Jita Market Prices: Real-time valuations
- Delete/Refresh Ores: Remove ores from view, reset button

### PRO Subscription System
- ISK Payment: Pay via in-game transfers with RT-XXXX-XXXX codes
- Activation Codes: Generate and redeem codes
- Gift Codes: Create gift codes with bonuses
- Auto Wallet Check: Verify payments via ESI wallet API
- Theme Unlocks: Faction themes (Caldari, Amarr, Gallente, Minmatar)
- Bonus Tiles: PRO-exclusive dashboard tiles

### Additional Systems
- Special Badges: Legendary, Epic, Rare, Uncommon tiers (admin grants)
- Shareable Cards: /share/:id pages for session stats
- Loot Tracker: Track and value loot items with Jita prices
- Corp Tax Settings: Configure corporation tax rate
- PLEX Goal Tracker: Track progress toward PLEX goal
- Achievements: Track accomplishments
- Tutorial Overlay: Interactive tour for new users
- Theme System: Light/Dark mode + racial faction themes (Caldari, Amarr, Gallente, Minmatar)
- Admin Panel: Overview stats, gift PRO, verify payments, generate gift codes, manage badges, manage admins, view subscriptions/codes

---

## IMMEDIATE DASHBOARD IMPROVEMENTS

### 1. Mining Tab Button Relocation
Relocate the mining tab button to a more visually appealing position on the main dashboard. Use your best judgment for placement that improves the overall layout and user flow.

### 2. Pro Button Position
Move the pro button that's currently next to the character name. Position it to the LEFT of the character name instead.

### 3. Pro Button Menu Enhancement
When the pro button is clicked and opens its menu, display the remaining pro time inside that menu (e.g., "23 days remaining" or "5 hours left").

### 4. Character Box Pro Styling
Make the character box turn gold when pro is active. This should be a visual indicator that clearly shows pro status.

### 5. Mining Details Tile - Date Range Display
In the mining details tile, improve the visual design of the date range buttons (1hr, 1day, 1week, 1month) to make them much easier to distinguish from each other. Consider:
- Adding more spacing between buttons
- Using different background colors or border styles
- Increasing button size or text size
- Adding icons or visual indicators
- Improving the selected/active state styling

### 6. Mineral Repro % Input
Move the mineral repro % control into the mineral value box. Display it as a small editable input box that allows users to change the percentage value directly within that box.

### 7. Smart Tooltips on Hover
Add informative tooltips with intelligent behavior:

**Tooltip Content:**
- Tooltips appear when users hover over metrics, buttons, and data fields
- Explain what each metric represents (e.g., "Mining Rate: The speed at which you're currently mining resources")
- Explain how calculations work (e.g., "Mineral Repro %: The percentage of minerals that regenerate over time")
- Show pro benefits when hovering over the pro button
- Explain what each time range shows when hovering over 1hr/1day/1week/1month buttons

**Smart Display Logic:**
- Track which tooltips a user has already seen/interacted with and only show them to new users or users who haven't seen them yet (use localStorage to track viewed tooltips)
- Add a "Show Hints" toggle in the settings or header that allows users to turn tooltips on/off globally
- Use subtle fade-in animation and position tooltips intelligently to avoid covering important UI elements
- Mark tooltips as "viewed" after they've been displayed for 3+ seconds or dismissed

### 8. Pro Time Low Warning
Display a prominent notification badge or alert when pro subscription time is running low (less than 3 days remaining). This should:
- Appear on or near the pro button
- Use attention-grabbing colors (amber/orange for warning)
- Show exact time remaining (e.g., "2 days 5 hours left")
- Be dismissible but reappear on page reload if still under threshold
- Optionally include a "Renew Pro" call-to-action button

### 9. Estimated Earnings Projections
Add a dedicated section showing projected earnings based on current mining rates. Display:
- Projected earnings for next 24 hours
- Projected earnings for next 7 days
- Projected earnings for next 30 days
- Include a small disclaimer like "Based on current rate" or "Estimates may vary"
- Use a card or panel that stands out visually
- Consider adding a small trend graph or sparkline showing if projections are increasing/decreasing

### 10. Mining Session Timer
Add a real-time session timer that shows how long the current mining session has been active. Features:
- Display in HH:MM:SS format (or days if session is very long)
- Position it prominently, perhaps near the top of the mining details
- Include a label like "Session Duration" or "Mining For:"
- Auto-updates every second
- Consider adding a small "Session started at [time]" subtext
- Optionally add session milestones (badges at 1hr, 1day, 1week of continuous mining)

### 11. Mining History Log/Activity Feed
Create a scrollable activity feed or history panel showing recent mining activities. Include:
- Timestamps for each entry
- Activity type (e.g., "Mining started", "Rate changed", "Minerals collected", "Pro activated")
- Relevant values/amounts for each activity
- Color-coded entries (green for gains, blue for changes, gold for pro activities)
- Limit to last 20-50 entries with "Load More" option
- Add filter options (All, Today, This Week, Pro Activities)
- Make it collapsible or toggleable if space is limited

### 12. Export Mining Data
Add an export button that allows users to download their mining data as CSV. Features:
- Place button in an accessible location (top-right corner or in a menu)
- Include dialog to select date range for export
- CSV should include: timestamp, mining rate, minerals collected, session duration, active bonuses
- Add filename with automatic date (e.g., "mining_data_2025_12_05.csv")
- Show a success notification when download completes
- Consider adding export options for different formats (CSV, JSON, Excel)

### 13. Drag-and-Drop Dashboard Tiles with Layout Preview
Enable users to rearrange dashboard tiles/widgets by dragging and dropping them (same implementation as the main dashboard page). Include:

**Drag & Drop Features:**
- Visual feedback when dragging (lift effect, semi-transparent while moving)
- Drop zones highlighted when hovering with a dragged tile
- Smooth animations when tiles reposition
- Save user's preferred layout to localStorage or user preferences

**Preview Mode:**
- Add a "Preview Mode" toggle that allows users to test different layouts without committing the changes
- In Preview Mode: Display a floating toolbar with "Save Layout" and "Cancel" buttons
- Visual indicator showing the dashboard is in preview/edit mode (e.g., dashed borders around tiles, edit icon overlay)

**Additional Features:**
- Add a "Reset to Default Layout" option in settings
- Ensure mobile-friendly touch support for drag operations
- Lock certain critical tiles (like character info) or make them optionally lockable
- Show a brief tutorial tooltip the first time a user enters edit mode explaining how to rearrange tiles

---

## LORE-ACCURATE EVE ONLINE THEME SYSTEM

### Design Philosophy
After extensive research into EVE Online's faction lore, aesthetics, and design principles, create themes that authentically represent each faction's culture, technology, visual identity, and values established over EVE's 20+ year history.

---

## EMPIRE FACTION THEMES (Core Playable Races)

### CALDARI STATE - "Corporate Efficiency"

**Lore Background:**
- Mega-corporate dictatorship emphasizing discipline, duty, and meritocracy
- Former members of Gallente Federation who broke away in war
- Japanese-Finnish inspired culture
- Known for: Shield technology, missiles, ECM warfare, industrial strength

**Visual Identity:**
- Primary: Slate grey (#4A5568 to #5A6A7A) - industrial efficiency and corporate professionalism
- Secondary: Gunmetal (#2C3E50) - cold, utilitarian aesthetic
- Accent: Electric blue (#00A8FF) - shield technology, ECM systems
- Highlight: Cyan glow (#00D9FF) - active elements, shield recharge
- Background: Dark charcoal (#1A202C) with subtle grid patterns
- Text: Clean white (#F7FAFC) with blue hints

**Design Elements:**
- Clean, geometric, angular shapes (corporate precision)
- Minimal ornamentation - function over form
- Sharp corners and precise edges
- Subtle hexagonal grid patterns in backgrounds
- Industrial sans-serif typography
- ECM jamming wave effects (optional subtle animations)
- Box shadows with blue glow for depth

**Ship Aesthetic:** Blocky, angular, asymmetric "space brick" design. Practical workhorse vessels.

---

### AMARR EMPIRE - "Divine Authority"

**Lore Background:**
- Largest empire (40% of inhabited systems)
- Theocratic monarchy, ritualistic and authoritarian
- Religious zealots who practice slavery as "spiritual enlightenment"
- Known for: Laser weaponry, armor tanking, religious iconography, gold and scripture

**Visual Identity:**
- Primary: Imperial gold (#C9A959 to #D4AF37) - divinity, wealth, religious authority
- Secondary: Deep crimson/burgundy (#8B0000 to #A52A2A) - blood, sacrifice, passion
- Accent: Bright gold (#FFD700) - highlights, divine light
- Sacred: Pure white (#FAFAFA) - purity, scripture, righteousness
- Background: Rich dark brown (#2D1B00) to black gradient
- Text: Gold on dark, white on burgundy

**Design Elements:**
- Ornate, cathedral-inspired architecture
- Soaring spires and towers in UI elements
- Religious iconography (stylized geometric sacred symbols)
- Flowing curved lines mixed with rigid structure
- Serif typography with elegant flourishes
- Gold leaf effects, metallic sheens
- Subtle pulsing glow effects (divine presence)
- Card borders with engraved patterns

**Ship Aesthetic:** Curved, elegant, cathedral-like with golden hulls. Majestic and imposing.

---

### GALLENTE FEDERATION - "Liberal Democracy"

**Lore Background:**
- Democratic federation championing freedom, individual rights, and cultural diversity
- French-inspired culture (Tau Ceti French descendants)
- Known for: Drone technology, blasters, armor tanking, artistic expression, progressive values

**Visual Identity:**
- Primary: Deep teal/forest green (#00695C to #2E7D32) - life, growth, diversity
- Secondary: Emerald green (#00A86B) - vibrant, alive, progressive
- Accent: Cyan blue (#00BCD4) - technology, innovation, sky
- Highlight: Bright lime (#76FF03) - active states, vitality
- Background: Dark green-black (#0A1F1F) with organic gradients
- Text: Clean white (#FAFAFA) with green tints

**Design Elements:**
- Organic, flowing curves
- Art nouveau inspirations
- Nature-integrated design (crystalline city concepts)
- Smooth gradients and soft edges
- Modern sans-serif with humanist qualities
- Drone swarm patterns (subtle dot grids that move)
- Bioluminescent glow effects
- Glass-like transparency effects

**Ship Aesthetic:** Smooth, organic curves. Sensual and biomechanical aesthetics.

---

### MINMATAR REPUBLIC - "Tribal Resilience"

**Lore Background:**
- Youngest empire, born from rebellion against Amarr enslavement
- Seven tribes united
- Resourceful, proud, and fiercely independent
- Known for: Projectile weapons, speed, flexibility, "rust we trust" aesthetic, salvaged/improvised technology

**Visual Identity:**
- Primary: Rust red/orange (#B7410E to #CD5C5C) - oxidation, improvised materials, fire
- Secondary: Weathered bronze (#8B4513) - aged metals, tribal heritage
- Accent: Burnt orange (#FF6B35) - energy, rebellion, determination
- Tribal: Earth tones (#8B7355, #A0826D) - connection to Matar homeworld
- Background: Dark rust-brown (#1A0F0A) with texture
- Text: Warm white (#FFF8E7) with orange undertones

**Design Elements:**
- Asymmetric, improvised appearance
- Tribal patterns and geometric motifs (seven tribes)
- Riveted metal textures
- Exposed structural elements
- Weathered, battle-scarred aesthetics
- Bold, strong typography with industrial feel
- Sparks and fire particle effects (optional animations)
- Rough, textured surfaces

**Ship Aesthetic:** Patchwork, asymmetric "flying junkyards." Fast, scrappy, and resourceful.

---

## PIRATE FACTION THEMES (PRO-EXCLUSIVE)

### TRIGLAVIAN COLLECTIVE - "Abyssal Invasion" ⭐ PRO

**Lore Background:**
- Mysterious human civilization from Abyssal Deadspace
- Mastery of space-time mechanics and bioadaptive technology
- Alien yet human
- Invaded New Eden systems (Pochven region)
- Known for: Entropic disintegrators, red/black aesthetic, geometric ship designs, singularity cores

**Visual Identity:**
- Primary: Deep black (#0D0D0D) - the void, abyssal depths
- Secondary: Blood red (#8B0000 to #B22222) - entropy, destruction
- Accent: Bright crimson (#DC143C) - energy disintegration
- Energy: Orange-red glow (#FF4500) - singularity reactor cores
- Background: Pure black (#000000) with red nebula effects
- Text: White (#FFFFFF) with red highlights

**Design Elements:**
- Sharp, angular, crystalline geometric patterns
- Triangular motifs (representing "three-fold" Triglavian nature)
- Alien yet orderly aesthetic
- Pulsing red energy cores
- Hexagonal and triangular tessellations
- Harsh, alien typography
- Disintegration particle effects (red energy crackling)
- Singularity distortion effects around buttons

**Ship Aesthetic:** Carved, grown appearance. Organic geometry with glowing red singularity cores.

---

### GURISTAS PIRATES - "Profit & Chaos" ⭐ PRO

**Lore Background:**
- Founded by ex-Caldari Navy members "Fatal" and "The Rabbit"
- Professional pirates driven by greed, not ideology
- Bunny-skull logo
- Caldari-Gallente hybrid tech
- Known for: Traditional piracy, raids on Caldari State, honor among thieves, shield tanking

**Visual Identity:**
- Primary: Lime green (#32CD32 to #39FF14) - signature color, night vision aesthetic
- Secondary: Dark grey (#36454F) - stealth, shadows
- Accent: Hot pink/magenta (#FF1493) - cyberpunk flair, Fatal's style
- Tech: Cyan (#00FFFF) - electronics, tech
- Background: Very dark grey-black (#0A0A0A)
- Text: Bright white (#FFFFFF) with neon green glow

**Design Elements:**
- Cyberpunk/tech noir aesthetic
- Bunny skull iconography (stylized, abstract)
- Neon lighting effects
- Hacker/pirate UI elements (fake "terminal" effects)
- Angular but sleek shapes
- Futuristic tech typography
- Scanline effects (old CRT monitor aesthetic)
- Green glow effects on hover

**Ship Aesthetic:** Modified Caldari ships with aggressive paint jobs and upgraded systems.

---

### ANGEL CARTEL - "Outlaw Freedom" ⭐ PRO

**Lore Background:**
- Largest organized crime faction
- Minmatar-Gallente hybrid technology
- Dominations division
- Based in Curse region
- Known for: Speed (warp speed bonuses), projectile weapons, red/black color scheme, brutal efficiency

**Visual Identity:**
- Primary: Deep red (#8B0000 to #A52A2A) - blood, danger, outlaws
- Secondary: Black (#0F0F0F) - darkness, space piracy
- Accent: Bright red (#FF0000) - aggression, speed
- Metal: Silver/chrome (#C0C0C0) - projectile weapons
- Background: Black (#000000) with red stars/nebula
- Text: White (#FFFFFF) with red shadows

**Design Elements:**
- Aggressive, predatory aesthetic
- Wing motifs (angel theme, but dark/fallen)
- Speed lines and motion blur effects
- Chrome and red metal materials
- Bold, aggressive typography
- Bullet hole and impact textures
- Projectile tracer effects (optional animations)
- Sharp, dangerous looking UI elements

**Ship Aesthetic:** Fast, sleek Minmatar-Gallente hybrids. Built for hit-and-run tactics.

---

### BLOOD RAIDERS - "Vampiric Horror" ⭐ PRO

**Lore Background:**
- Heretical Amarr cult led by Omir Sarikusa
- Drain capsuleer blood for immortality rituals
- Amarr-Minmatar hybrid tech
- Known for: Energy vampirism (nos/neuts), blood harvesting, religious fanaticism, terror tactics

**Visual Identity:**
- Primary: Blood red (#8B0000) - obvious symbolism
- Secondary: Dark gold/bronze (#6B4423) - corrupted Amarr heritage
- Accent: Crimson (#DC143C) - fresh blood, energy drain
- Sacred Corrupt: Tarnished gold (#B8860B) - fallen divinity
- Background: Black-red gradient (#1A0000)
- Text: Bone white (#F5F5DC) with red glow

**Design Elements:**
- Corrupted Amarr religious aesthetic
- Blood droplet and vein patterns
- Gothic horror elements
- Tarnished gold and rusted metal
- Vampiric symbolism (abstract, stylized)
- Dripping effects
- Pulsing heartbeat animations (subtle)
- Energy drain visual effects

**Ship Aesthetic:** Corrupted Amarr vessels. Blood-red with tarnished gold trim.

---

## MYSTERY FACTION THEMES (PRO-EXCLUSIVE)

### JOVE EMPIRE - "Ancient Enigma" ⭐ PRO

**Lore Background:**
- Most technologically advanced race
- Mysterious, elusive, possibly extinct
- Genetic engineering masters suffering from Jovian Disease
- Gave capsule technology to others
- Known for: Technological superiority, enigmatic nature, lustrous black eyes, symmetrical features

**Visual Identity:**
- Primary: Deep purple (#4A148C to #6A1B9A) - mystery, ancient power
- Secondary: Black with blue sheen (#0D1F2D) - void, unknowable
- Accent: Electric violet (#9C27B0) - advanced technology
- Tech: Silver/platinum (#B0C4DE) - pristine, advanced materials
- Background: Very dark purple-black (#1A0033) with subtle star field
- Text: Luminous silver (#E0E0E0) with purple glow

**Design Elements:**
- Impossibly advanced, almost alien aesthetic
- Perfect symmetry (reflecting Jovian genetic engineering)
- Smooth, seamless surfaces (no visible seams or rivets)
- Holographic effects
- Ancient yet futuristic design language
- Mysterious glowing symbols
- Particle effects suggesting quantum mechanics
- Elegant, otherworldly typography

**Ship Aesthetic:** Smooth, seamless, impossibly advanced. Green or brown with organic carved appearance.

---

### SLEEPERS/DRIFTERS - "Ancient AI" ⭐ PRO

**Lore Background:**
- Jove offshoots who entered virtual reality to escape Jovian Disease
- Now emerging as cybernetic Drifters
- Found in wormhole space
- Known for: Blue electric effects, salvage, ancient technology, enigmatic constructs

**Visual Identity:**
- Primary: Deep teal (#004D40) - abyssal depths, ancient technology
- Secondary: Dark blue-grey (#263238) - cold metal, cybernetics
- Accent: Electric cyan (#00E5FF) - energy systems, awakening
- Ancient: Muted gold (#B8960B) - aged technology
- Background: Near-black blue (#0A1929) with subtle particle field
- Text: Cyan-white (#E0F7FA) with blue glow

**Design Elements:**
- Ancient yet functional aesthetic
- Sleeper structure patterns (geometric, precise)
- Cybernetic augmentation elements
- Holographic displays
- Blue electrical arcing effects
- Ancient rune-like patterns (geometric, not mystical)
- Quantum particle effects
- Cold, calculated typography

**Ship Aesthetic:** Geometric, precise, with glowing blue cores. Ancient but active.

---

## SPECIALIZED THEMES

### CONCORD - "Galactic Authority"

**Lore Background:**
- Consolidated Cooperation and Relations Command
- Interstellar police force
- Neutral arbiters
- Maintain peace between empires
- Known for: Law enforcement, powerful response fleets, diplomatic neutrality

**Visual Identity:**
- Primary: Navy blue (#001F3F to #0B3C5D) - authority, order
- Secondary: White (#FFFFFF) - neutrality, law
- Accent: Gold (#FFD700) - badges, official seals
- Warning: Bright yellow (#FFFF00) - police lights
- Background: Light grey-white gradient (#F5F5F5)
- Text: Navy blue on white, white on navy

**Design Elements:**
- Official, governmental aesthetic
- Badge and emblem motifs
- Clean, professional layouts
- Police/security visual language
- Authoritative typography
- Official document styling
- Warning stripe patterns
- Radio wave effects (for comms)

---

### SISTERS OF EVE - "Humanitarian Science"

**Lore Background:**
- Humanitarian organization combining religious belief with scientific exploration
- Believe EVE Gate is gateway to heaven
- Rescue operations
- Known for: Exploration, aid work, probe bonuses, dual armor/shield tank

**Visual Identity:**
- Primary: Pristine white (#FAFAFA) - purity, aid, hope
- Secondary: Rose gold (#B76E79) - compassion, feminine strength
- Accent: Soft blue (#4FC3F7) - exploration, discovery
- Sacred: Pearl (#E8DED2) - spiritual connection
- Background: Soft grey-blue (#ECEFF1)
- Text: Dark grey (#424242) on light, light on dark

**Design Elements:**
- Clean, medical/scientific aesthetic
- Exploration probe patterns
- Compassionate, welcoming design
- Rounded, friendly shapes
- Humanitarian iconography
- Soft shadows and glows
- Particle scan effects
- Gentle, approachable typography

---

### ORE (OUTER RING EXCAVATIONS) - "Industrial Mining"

**Lore Background:**
- Largest independent mining corporation
- Struck rich with Nocxium
- Left Gallente space for independence
- Known for: Mining barges, exhumers, industrial operations, yellow/black safety colors

**Visual Identity:**
- Primary: Industrial yellow (#FFB300) - heavy machinery, warning
- Secondary: Black (#1A1A1A) - space, industrial equipment
- Accent: Orange (#FF6600) - heat, excavation
- Safety: White (#FFFFFF) - safety striping
- Background: Dark grey (#2E2E2E)
- Text: Black on yellow, yellow on black

**Design Elements:**
- Industrial safety aesthetic
- Hazard stripes
- Heavy machinery design language
- Mining drill patterns
- Utilitarian, function-first design
- Bold safety typography
- Rock breaking effects
- Excavation particle animations

---

## THEME IMPLEMENTATION REQUIREMENTS

### Technical Specifications

**Core Implementation:**
- Use CSS custom properties (variables) for easy theme switching
- Implement smooth 0.3s ease-in-out transitions between themes
- Ensure WCAG AA accessibility (minimum 4.5:1 contrast ratio for text)
- Create theme preview thumbnails (200x150px) for theme selector
- Store theme preference in localStorage with fallback to system preference
- Apply themes globally across all pages and components

**Theme Storage Structure (localStorage):**
```json
{
  "selectedTheme": "caldari",
  "themePreferences": {
    "enableAnimations": true,
    "enableParticles": false,
    "enableSoundEffects": false,
    "reducedMotion": false
  }
}
```

### PRO Theme Tiers

**Free Themes:**
- Light (default)
- Dark (default)
- Caldari State
- Amarr Empire
- Gallente Federation
- Minmatar Republic
- CONCORD

**PRO-Exclusive Themes:**
- Triglavian Collective
- Guristas Pirates
- Angel Cartel
- Blood Raiders
- Jove Empire
- Sleepers/Drifters
- Sisters of EVE
- ORE (Outer Ring Excavations)

### Special Effects (Optional, PRO themes only)

**Performance Considerations:**
- Limit particle animations to 30fps
- Make all animations pausable
- Provide "Reduce Motion" toggle
- Lazy-load particle effects

**PRO Theme Enhancements:**
- Subtle particle animations
- Glow effects on hover
- Faction-specific sound effects (very subtle, toggleable)
- Custom cursor per theme (optional)
- Background parallax or subtle movement
- Advanced lighting effects

### Theme Selector UI

**Layout & Features:**
- Grid layout showing all themes with preview cards
- Faction logo/icon for each theme
- "PRO" badge on locked themes with upgrade prompt
- Hover preview effect showing theme colors
- Click to apply theme immediately
- Search/filter by faction type (Empire/Pirate/Mystery/Specialized)
- "Random" theme button
- "Match system time" option (light during day, dark at night)
- "Preview Mode" - see theme without committing

**Preview Card Contents:**
- Theme name and subtitle
- Small screenshot or color palette preview
- Faction icon
- PRO badge if applicable
- Short description (1-2 sentences)
- "Apply" button

### Responsive Considerations

**Mobile Optimization:**
- All themes must work on mobile devices
- Simplified effects on mobile if needed for performance
- Touch-friendly theme selector
- Reduced motion option for accessibility
- High contrast mode toggle
- Swipe gestures for theme carousel on mobile

**Accessibility Features:**
- WCAG AA compliance for all themes
- Color blind mode options
- High contrast alternatives
- Screen reader friendly theme names and descriptions
- Keyboard navigation for theme selector
- Focus indicators that work with each theme

### Additional Features

**Theme Customization (Future Enhancement):**
- Allow users to adjust accent colors
- Brightness/contrast sliders
- Custom background images (PRO)
- Save multiple theme variants

**Theme Events (Future Enhancement):**
- Holiday themes (Christmas, Foundation Day, etc.)
- Event themes (Alliance Tournament, Fanfest)
- Limited-time themes
- Community-created themes

---

## TECHNICAL NOTES

### Compatibility & Integration
- Maintain compatibility with existing EVE SSO authentication
- Preserve ESI API integrations for wallet and character data
- Ensure all new features respect PRO vs free tier distinctions
- Keep the existing theme system functional and integrate new themes seamlessly
- All localStorage usage should be namespaced to avoid conflicts (e.g., "rattracker_theme")
- Maintain responsive design for mobile users
- Follow existing UI patterns and design language throughout the application
- New themes should work across all application pages and components
- Ensure theme variables are centralized (CSS variables or theme config file) for easy maintenance

### Performance Optimization
- Lazy-load theme assets
- Minimize CSS by using variables
- Cache theme preferences
- Optimize animations for 60fps where possible
- Provide fallbacks for older browsers
- Test on low-end devices

### Testing Requirements
- Test all themes on major browsers (Chrome, Firefox, Safari, Edge)
- Verify accessibility with screen readers
- Check color contrast ratios
- Test on mobile devices
- Verify localStorage persistence
- Test theme switching performance
- Ensure no memory leaks from animations

---

## IMPLEMENTATION PRIORITY

### Phase 1 (Critical - Week 1)
1. Mining tab button relocation
2. Pro button repositioning
3. Pro button menu with time remaining
4. Character box gold styling for PRO
5. Date range button improvements
6. Mineral repro % input relocation

### Phase 2 (High Priority - Week 2)
7. Smart tooltips system
8. Pro time low warning
9. Mining session timer
10. Basic theme system infrastructure (CSS variables, storage)

### Phase 3 (Medium Priority - Week 3)
11. Mining history log/activity feed
12. Export mining data functionality
13. Empire faction themes (Caldari, Amarr, Gallente, Minmatar)
14. CONCORD theme

### Phase 4 (Enhancement - Week 4)
15. Estimated earnings projections
16. Drag-and-drop with preview mode
17. Pirate faction themes (Triglavian, Guristas, Angel Cartel, Blood Raiders)
18. Theme selector UI

### Phase 5 (Polish - Week 5+)
19. Mystery faction themes (Jove, Sleepers/Drifters)
20. Specialized themes (Sisters of EVE, ORE)
21. Special effects and animations for PRO themes
22. Mobile optimization
23. Accessibility enhancements
24. Performance optimization

---

## FINAL NOTES

This comprehensive upgrade transforms RAT TRACKER into a premium EVE Online experience with:

✅ Enhanced user experience with smart features
✅ Lore-accurate faction themes honoring 20+ years of EVE history
✅ PRO-exclusive content that adds real value
✅ Accessibility and performance considerations
✅ Mobile-friendly responsive design
✅ Extensive customization options

**Key Success Metrics:**
- User engagement increase
- PRO subscription conversion rate
- Session duration increase
- Theme usage statistics
- User satisfaction ratings

**Maintain the EVE Online aesthetic throughout** - the application should feel like an official EVE Online tool, respecting the game's visual language, lore, and community culture.

---

*For the glory of New Eden! o7*
