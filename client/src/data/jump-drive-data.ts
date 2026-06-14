// EVE Online Jump Drive Ship Data
// All jump-capable ship classes with their base stats

export interface JumpShipClass {
  name: string;
  groupId: number;
  baseRange: number; // LY
  baseFuelPerLY: number; // isotopes per LY
  fuelTypeId: number; // Isotope type ID (faction-dependent, set per ship)
  fuelTypeName: string;
  canBridge: boolean; // Titans and Black Ops can bridge
  isBlackOps: boolean;
  isJumpFreighter: boolean;
}

export interface JumpShipDefinition {
  typeId: number;
  name: string;
  className: string; // key into JUMP_SHIP_CLASSES
  fuelTypeId: number;
  fuelTypeName: string;
}

// Ship group IDs for jump-capable ships
export const JUMP_CAPABLE_GROUP_IDS = {
  CARRIER: 547,
  DREADNOUGHT: 485,
  FAX: 1538,
  SUPERCARRIER: 659,
  TITAN: 30,
  JUMP_FREIGHTER: 902,
  BLACK_OPS: 898,
  RORQUAL: 883, // Industrial Command Ship (specifically Rorqual)
  CAPITAL_INDUSTRIAL: 883,
} as const;

// Base jump ranges by ship class (before JDC skill)
// JDC adds 25% per level: effectiveRange = baseRange * (1 + 0.25 * jdcLevel)
export const JUMP_SHIP_CLASSES: Record<string, Omit<JumpShipClass, "fuelTypeId" | "fuelTypeName">> = {
  carrier: {
    name: "Carrier",
    groupId: 547,
    baseRange: 5.0,
    baseFuelPerLY: 500,
    canBridge: false,
    isBlackOps: false,
    isJumpFreighter: false,
  },
  dreadnought: {
    name: "Dreadnought",
    groupId: 485,
    baseRange: 5.0,
    baseFuelPerLY: 500,
    canBridge: false,
    isBlackOps: false,
    isJumpFreighter: false,
  },
  fax: {
    name: "Force Auxiliary",
    groupId: 1538,
    baseRange: 5.0,
    baseFuelPerLY: 500,
    canBridge: false,
    isBlackOps: false,
    isJumpFreighter: false,
  },
  supercarrier: {
    name: "Supercarrier",
    groupId: 659,
    baseRange: 5.0,
    baseFuelPerLY: 500,
    canBridge: false,
    isBlackOps: false,
    isJumpFreighter: false,
  },
  titan: {
    name: "Titan",
    groupId: 30,
    baseRange: 5.0,
    baseFuelPerLY: 500,
    canBridge: true,
    isBlackOps: false,
    isJumpFreighter: false,
  },
  jumpFreighter: {
    name: "Jump Freighter",
    groupId: 902,
    baseRange: 5.0,
    baseFuelPerLY: 500,
    canBridge: false,
    isBlackOps: false,
    isJumpFreighter: true,
  },
  blackOps: {
    name: "Black Ops",
    groupId: 898,
    baseRange: 3.5,
    baseFuelPerLY: 350,
    canBridge: true,
    isBlackOps: true,
    isJumpFreighter: false,
  },
  rorqual: {
    name: "Rorqual",
    groupId: 883,
    baseRange: 5.0,
    baseFuelPerLY: 500,
    canBridge: false,
    isBlackOps: false,
    isJumpFreighter: false,
  },
};

// Fuel types - Isotopes by EVE faction
export const FUEL_TYPES = {
  HELIUM: { typeId: 16274, name: "Helium Isotopes", faction: "Amarr" },
  HYDROGEN: { typeId: 17889, name: "Hydrogen Isotopes", faction: "Minmatar" },
  NITROGEN: { typeId: 17888, name: "Nitrogen Isotopes", faction: "Caldari" },
  OXYGEN: { typeId: 17887, name: "Oxygen Isotopes", faction: "Gallente" },
} as const;

// Liquid Ozone for cyno modules
export const LIQUID_OZONE = { typeId: 16273, name: "Liquid Ozone" };
export const CYNO_OZONE_COST = 450; // Liquid Ozone per regular cyno activation
export const COVERT_CYNO_OZONE_COST = 300; // Liquid Ozone per covert cyno

// All jump-capable ships with their specific fuel types
export const JUMP_SHIPS: JumpShipDefinition[] = [
  // Amarr - Helium Isotopes
  { typeId: 24690, name: "Archon", className: "carrier", fuelTypeId: 16274, fuelTypeName: "Helium Isotopes" },
  { typeId: 19720, name: "Revelation", className: "dreadnought", fuelTypeId: 16274, fuelTypeName: "Helium Isotopes" },
  { typeId: 37604, name: "Apostle", className: "fax", fuelTypeId: 16274, fuelTypeName: "Helium Isotopes" },
  { typeId: 3764, name: "Aeon", className: "supercarrier", fuelTypeId: 16274, fuelTypeName: "Helium Isotopes" },
  { typeId: 11567, name: "Avatar", className: "titan", fuelTypeId: 16274, fuelTypeName: "Helium Isotopes" },
  { typeId: 28850, name: "Ark", className: "jumpFreighter", fuelTypeId: 16274, fuelTypeName: "Helium Isotopes" },
  { typeId: 22430, name: "Redeemer", className: "blackOps", fuelTypeId: 16274, fuelTypeName: "Helium Isotopes" },

  // Caldari - Nitrogen Isotopes
  { typeId: 24688, name: "Chimera", className: "carrier", fuelTypeId: 17888, fuelTypeName: "Nitrogen Isotopes" },
  { typeId: 19726, name: "Phoenix", className: "dreadnought", fuelTypeId: 17888, fuelTypeName: "Nitrogen Isotopes" },
  { typeId: 37606, name: "Minokawa", className: "fax", fuelTypeId: 17888, fuelTypeName: "Nitrogen Isotopes" },
  { typeId: 23913, name: "Wyvern", className: "supercarrier", fuelTypeId: 17888, fuelTypeName: "Nitrogen Isotopes" },
  { typeId: 3766, name: "Leviathan", className: "titan", fuelTypeId: 17888, fuelTypeName: "Nitrogen Isotopes" },
  { typeId: 28848, name: "Rhea", className: "jumpFreighter", fuelTypeId: 17888, fuelTypeName: "Nitrogen Isotopes" },
  { typeId: 22428, name: "Widow", className: "blackOps", fuelTypeId: 17888, fuelTypeName: "Nitrogen Isotopes" },

  // Gallente - Oxygen Isotopes
  { typeId: 24692, name: "Thanatos", className: "carrier", fuelTypeId: 17887, fuelTypeName: "Oxygen Isotopes" },
  { typeId: 19724, name: "Moros", className: "dreadnought", fuelTypeId: 17887, fuelTypeName: "Oxygen Isotopes" },
  { typeId: 37607, name: "Ninazu", className: "fax", fuelTypeId: 17887, fuelTypeName: "Oxygen Isotopes" },
  { typeId: 23917, name: "Nyx", className: "supercarrier", fuelTypeId: 17887, fuelTypeName: "Oxygen Isotopes" },
  { typeId: 671, name: "Erebus", className: "titan", fuelTypeId: 17887, fuelTypeName: "Oxygen Isotopes" },
  { typeId: 28846, name: "Anshar", className: "jumpFreighter", fuelTypeId: 17887, fuelTypeName: "Oxygen Isotopes" },
  { typeId: 22436, name: "Sin", className: "blackOps", fuelTypeId: 17887, fuelTypeName: "Oxygen Isotopes" },

  // Minmatar - Hydrogen Isotopes
  { typeId: 24694, name: "Nidhoggur", className: "carrier", fuelTypeId: 17889, fuelTypeName: "Hydrogen Isotopes" },
  { typeId: 19722, name: "Naglfar", className: "dreadnought", fuelTypeId: 17889, fuelTypeName: "Hydrogen Isotopes" },
  { typeId: 37605, name: "Lif", className: "fax", fuelTypeId: 17889, fuelTypeName: "Hydrogen Isotopes" },
  { typeId: 23915, name: "Hel", className: "supercarrier", fuelTypeId: 17889, fuelTypeName: "Hydrogen Isotopes" },
  { typeId: 3767, name: "Ragnarok", className: "titan", fuelTypeId: 17889, fuelTypeName: "Hydrogen Isotopes" },
  { typeId: 28844, name: "Nomad", className: "jumpFreighter", fuelTypeId: 17889, fuelTypeName: "Hydrogen Isotopes" },
  { typeId: 22440, name: "Panther", className: "blackOps", fuelTypeId: 17889, fuelTypeName: "Hydrogen Isotopes" },

  // ORE - Helium Isotopes (Rorqual only)
  { typeId: 28352, name: "Rorqual", className: "rorqual", fuelTypeId: 16274, fuelTypeName: "Helium Isotopes" },

  // Pirate faction / special
  { typeId: 45649, name: "Marshal", className: "blackOps", fuelTypeId: 16274, fuelTypeName: "Helium Isotopes" },
];

// Relevant skill IDs
export const SKILL_IDS = {
  JUMP_DRIVE_CALIBRATION: 21611, // Increases jump range by 25% per level
  JUMP_FUEL_CONSERVATION: 21610, // Reduces fuel need by 10% per level
  JUMP_FREIGHTERS: 20342, // Additional 10% fuel reduction per level for JFs
} as const;

// Ship classes grouped for UI selection
export const SHIP_CLASS_GROUPS = [
  {
    label: "Subcapital",
    ships: JUMP_SHIPS.filter((s) => s.className === "blackOps"),
  },
  {
    label: "Capital",
    ships: JUMP_SHIPS.filter((s) =>
      ["carrier", "dreadnought", "fax"].includes(s.className)
    ),
  },
  {
    label: "Supercapital",
    ships: JUMP_SHIPS.filter((s) =>
      ["supercarrier", "titan"].includes(s.className)
    ),
  },
  {
    label: "Industrial",
    ships: JUMP_SHIPS.filter((s) =>
      ["jumpFreighter", "rorqual"].includes(s.className)
    ),
  },
];
