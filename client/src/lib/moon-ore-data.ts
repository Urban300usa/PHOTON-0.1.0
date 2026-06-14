// Moon ore classification data for R4, R8, R16, R32, R64 ores
// Based on EVE Online moon mining

export type MoonOreRarity = "R4" | "R8" | "R16" | "R32" | "R64" | "Regular";

export interface MoonOreInfo {
  typeId: number;
  name: string;
  rarity: MoonOreRarity;
  material: string;
  yieldPerUnit: number;
  volume: number;
  materialTypeId: number;
}

// Moon ore data with type IDs, names, rarity, material yields
export const MOON_ORE_DATA: Record<number, MoonOreInfo> = {
  // R4 - Common moon ores
  45490: { typeId: 45490, name: "Zeolites", rarity: "R4", material: "Atmospheric Gases", yieldPerUnit: 65, volume: 10, materialTypeId: 16634 },
  45491: { typeId: 45491, name: "Sylvite", rarity: "R4", material: "Evaporite Deposits", yieldPerUnit: 65, volume: 10, materialTypeId: 16635 },
  45492: { typeId: 45492, name: "Bitumens", rarity: "R4", material: "Hydrocarbons", yieldPerUnit: 65, volume: 10, materialTypeId: 16633 },
  45493: { typeId: 45493, name: "Coesite", rarity: "R4", material: "Silicates", yieldPerUnit: 65, volume: 10, materialTypeId: 16636 },

  // R8 - Uncommon moon ores
  45494: { typeId: 45494, name: "Cobaltite", rarity: "R8", material: "Cobalt", yieldPerUnit: 40, volume: 10, materialTypeId: 16640 },
  45495: { typeId: 45495, name: "Euxenite", rarity: "R8", material: "Scandium", yieldPerUnit: 40, volume: 10, materialTypeId: 16639 },
  45496: { typeId: 45496, name: "Titanite", rarity: "R8", material: "Titanium", yieldPerUnit: 40, volume: 10, materialTypeId: 16638 },
  45497: { typeId: 45497, name: "Scheelite", rarity: "R8", material: "Tungsten", yieldPerUnit: 40, volume: 10, materialTypeId: 16637 },

  // R16 - Rare moon ores
  45498: { typeId: 45498, name: "Chromite", rarity: "R16", material: "Chromium", yieldPerUnit: 40, volume: 10, materialTypeId: 16641 },
  45499: { typeId: 45499, name: "Sperrylite", rarity: "R16", material: "Platinum", yieldPerUnit: 40, volume: 10, materialTypeId: 16644 },
  45500: { typeId: 45500, name: "Vanadinite", rarity: "R16", material: "Vanadium", yieldPerUnit: 40, volume: 10, materialTypeId: 16642 },
  45501: { typeId: 45501, name: "Otavite", rarity: "R16", material: "Cadmium", yieldPerUnit: 40, volume: 10, materialTypeId: 16643 },

  // R32 - Very Rare moon ores
  45502: { typeId: 45502, name: "Carnotite", rarity: "R32", material: "Technetium", yieldPerUnit: 50, volume: 10, materialTypeId: 16649 },
  45503: { typeId: 45503, name: "Cinnabar", rarity: "R32", material: "Mercury", yieldPerUnit: 50, volume: 10, materialTypeId: 16646 },
  45504: { typeId: 45504, name: "Pollucite", rarity: "R32", material: "Caesium", yieldPerUnit: 50, volume: 10, materialTypeId: 16647 },
  45506: { typeId: 45506, name: "Zircon", rarity: "R32", material: "Hafnium", yieldPerUnit: 50, volume: 10, materialTypeId: 16648 },

  // R64 - Exceptional moon ores
  45510: { typeId: 45510, name: "Monazite", rarity: "R64", material: "Neodymium", yieldPerUnit: 22, volume: 10, materialTypeId: 16651 },
  45511: { typeId: 45511, name: "Loparite", rarity: "R64", material: "Promethium", yieldPerUnit: 22, volume: 10, materialTypeId: 16652 },
  45512: { typeId: 45512, name: "Ytterbite", rarity: "R64", material: "Thulium", yieldPerUnit: 22, volume: 10, materialTypeId: 16653 },
  45513: { typeId: 45513, name: "Xenotime", rarity: "R64", material: "Dysprosium", yieldPerUnit: 22, volume: 10, materialTypeId: 16650 },
};

// Rarity colors for UI
export const RARITY_COLORS: Record<MoonOreRarity, { bg: string; text: string; border: string }> = {
  R4: { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/30" },
  R8: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/30" },
  R16: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30" },
  R32: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/30" },
  R64: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30" },
  Regular: { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" },
};

// Get rarity ranking for sorting (higher = rarer)
export const RARITY_RANK: Record<MoonOreRarity, number> = {
  Regular: 0,
  R4: 1,
  R8: 2,
  R16: 3,
  R32: 4,
  R64: 5,
};

// Get moon ore info by type ID
export function getMoonOreInfo(typeId: number): MoonOreInfo | null {
  return MOON_ORE_DATA[typeId] || null;
}

// Check if a type ID is a moon ore
export function isMoonOre(typeId: number): boolean {
  return typeId in MOON_ORE_DATA;
}

// Get moon ore rarity by type ID
export function getMoonOreRarity(typeId: number): MoonOreRarity {
  const ore = MOON_ORE_DATA[typeId];
  return ore?.rarity || "Regular";
}

// Get all moon ores of a specific rarity
export function getMoonOresByRarity(rarity: MoonOreRarity): MoonOreInfo[] {
  return Object.values(MOON_ORE_DATA).filter(ore => ore.rarity === rarity);
}

// Compression ratios for various ore types
export interface CompressionInfo {
  typeId: number;
  name: string;
  compressedTypeId: number;
  compressedName: string;
  compressionRatio: number; // units needed to compress
  volumePerUnit: number;
  compressedVolumePerUnit: number;
}

// Common ore compression data
export const ORE_COMPRESSION_DATA: CompressionInfo[] = [
  // Veldspar variants
  { typeId: 1230, name: "Veldspar", compressedTypeId: 28432, compressedName: "Compressed Veldspar", compressionRatio: 100, volumePerUnit: 0.1, compressedVolumePerUnit: 0.15 },
  { typeId: 17470, name: "Concentrated Veldspar", compressedTypeId: 28430, compressedName: "Compressed Concentrated Veldspar", compressionRatio: 100, volumePerUnit: 0.1, compressedVolumePerUnit: 0.15 },
  { typeId: 17471, name: "Dense Veldspar", compressedTypeId: 28431, compressedName: "Compressed Dense Veldspar", compressionRatio: 100, volumePerUnit: 0.1, compressedVolumePerUnit: 0.15 },

  // Scordite variants
  { typeId: 1228, name: "Scordite", compressedTypeId: 28429, compressedName: "Compressed Scordite", compressionRatio: 100, volumePerUnit: 0.15, compressedVolumePerUnit: 0.23 },
  { typeId: 17463, name: "Condensed Scordite", compressedTypeId: 28427, compressedName: "Compressed Condensed Scordite", compressionRatio: 100, volumePerUnit: 0.15, compressedVolumePerUnit: 0.23 },
  { typeId: 17464, name: "Massive Scordite", compressedTypeId: 28428, compressedName: "Compressed Massive Scordite", compressionRatio: 100, volumePerUnit: 0.15, compressedVolumePerUnit: 0.23 },

  // Pyroxeres variants
  { typeId: 1224, name: "Pyroxeres", compressedTypeId: 28424, compressedName: "Compressed Pyroxeres", compressionRatio: 100, volumePerUnit: 0.3, compressedVolumePerUnit: 0.16 },
  { typeId: 17459, name: "Solid Pyroxeres", compressedTypeId: 28425, compressedName: "Compressed Solid Pyroxeres", compressionRatio: 100, volumePerUnit: 0.3, compressedVolumePerUnit: 0.16 },
  { typeId: 17460, name: "Viscous Pyroxeres", compressedTypeId: 28426, compressedName: "Compressed Viscous Pyroxeres", compressionRatio: 100, volumePerUnit: 0.3, compressedVolumePerUnit: 0.16 },

  // Plagioclase variants
  { typeId: 18, name: "Plagioclase", compressedTypeId: 28422, compressedName: "Compressed Plagioclase", compressionRatio: 100, volumePerUnit: 0.35, compressedVolumePerUnit: 0.15 },
  { typeId: 17455, name: "Azure Plagioclase", compressedTypeId: 28421, compressedName: "Compressed Azure Plagioclase", compressionRatio: 100, volumePerUnit: 0.35, compressedVolumePerUnit: 0.15 },
  { typeId: 17456, name: "Rich Plagioclase", compressedTypeId: 28423, compressedName: "Compressed Rich Plagioclase", compressionRatio: 100, volumePerUnit: 0.35, compressedVolumePerUnit: 0.15 },

  // Omber variants
  { typeId: 1227, name: "Omber", compressedTypeId: 28416, compressedName: "Compressed Omber", compressionRatio: 100, volumePerUnit: 0.6, compressedVolumePerUnit: 0.3 },
  { typeId: 17867, name: "Silvery Omber", compressedTypeId: 28417, compressedName: "Compressed Silvery Omber", compressionRatio: 100, volumePerUnit: 0.6, compressedVolumePerUnit: 0.3 },
  { typeId: 17868, name: "Golden Omber", compressedTypeId: 28415, compressedName: "Compressed Golden Omber", compressionRatio: 100, volumePerUnit: 0.6, compressedVolumePerUnit: 0.3 },

  // Kernite variants
  { typeId: 20, name: "Kernite", compressedTypeId: 28410, compressedName: "Compressed Kernite", compressionRatio: 100, volumePerUnit: 1.2, compressedVolumePerUnit: 0.19 },
  { typeId: 17452, name: "Luminous Kernite", compressedTypeId: 28411, compressedName: "Compressed Luminous Kernite", compressionRatio: 100, volumePerUnit: 1.2, compressedVolumePerUnit: 0.19 },
  { typeId: 17453, name: "Fiery Kernite", compressedTypeId: 28409, compressedName: "Compressed Fiery Kernite", compressionRatio: 100, volumePerUnit: 1.2, compressedVolumePerUnit: 0.19 },

  // Jaspet variants
  { typeId: 1226, name: "Jaspet", compressedTypeId: 28406, compressedName: "Compressed Jaspet", compressionRatio: 100, volumePerUnit: 2, compressedVolumePerUnit: 0.15 },
  { typeId: 17448, name: "Pure Jaspet", compressedTypeId: 28408, compressedName: "Compressed Pure Jaspet", compressionRatio: 100, volumePerUnit: 2, compressedVolumePerUnit: 0.15 },
  { typeId: 17449, name: "Pristine Jaspet", compressedTypeId: 28407, compressedName: "Compressed Pristine Jaspet", compressionRatio: 100, volumePerUnit: 2, compressedVolumePerUnit: 0.15 },

  // Hemorphite variants
  { typeId: 1231, name: "Hemorphite", compressedTypeId: 28403, compressedName: "Compressed Hemorphite", compressionRatio: 100, volumePerUnit: 3, compressedVolumePerUnit: 0.16 },
  { typeId: 17444, name: "Vivid Hemorphite", compressedTypeId: 28405, compressedName: "Compressed Vivid Hemorphite", compressionRatio: 100, volumePerUnit: 3, compressedVolumePerUnit: 0.16 },
  { typeId: 17445, name: "Radiant Hemorphite", compressedTypeId: 28404, compressedName: "Compressed Radiant Hemorphite", compressionRatio: 100, volumePerUnit: 3, compressedVolumePerUnit: 0.16 },

  // Hedbergite variants
  { typeId: 21, name: "Hedbergite", compressedTypeId: 28400, compressedName: "Compressed Hedbergite", compressionRatio: 100, volumePerUnit: 3, compressedVolumePerUnit: 0.14 },
  { typeId: 17440, name: "Vitric Hedbergite", compressedTypeId: 28401, compressedName: "Compressed Vitric Hedbergite", compressionRatio: 100, volumePerUnit: 3, compressedVolumePerUnit: 0.14 },
  { typeId: 17441, name: "Glazed Hedbergite", compressedTypeId: 28402, compressedName: "Compressed Glazed Hedbergite", compressionRatio: 100, volumePerUnit: 3, compressedVolumePerUnit: 0.14 },

  // Gneiss variants
  { typeId: 1229, name: "Gneiss", compressedTypeId: 28397, compressedName: "Compressed Gneiss", compressionRatio: 100, volumePerUnit: 5, compressedVolumePerUnit: 0.1 },
  { typeId: 17865, name: "Iridescent Gneiss", compressedTypeId: 28398, compressedName: "Compressed Iridescent Gneiss", compressionRatio: 100, volumePerUnit: 5, compressedVolumePerUnit: 0.1 },
  { typeId: 17866, name: "Prismatic Gneiss", compressedTypeId: 28399, compressedName: "Compressed Prismatic Gneiss", compressionRatio: 100, volumePerUnit: 5, compressedVolumePerUnit: 0.1 },

  // Dark Ochre variants
  { typeId: 1232, name: "Dark Ochre", compressedTypeId: 28394, compressedName: "Compressed Dark Ochre", compressionRatio: 100, volumePerUnit: 8, compressedVolumePerUnit: 0.3 },
  { typeId: 17436, name: "Onyx Ochre", compressedTypeId: 28396, compressedName: "Compressed Onyx Ochre", compressionRatio: 100, volumePerUnit: 8, compressedVolumePerUnit: 0.3 },
  { typeId: 17437, name: "Obsidian Ochre", compressedTypeId: 28395, compressedName: "Compressed Obsidian Ochre", compressionRatio: 100, volumePerUnit: 8, compressedVolumePerUnit: 0.3 },

  // Spodumain variants
  { typeId: 19, name: "Spodumain", compressedTypeId: 28420, compressedName: "Compressed Spodumain", compressionRatio: 100, volumePerUnit: 16, compressedVolumePerUnit: 0.1 },
  { typeId: 17466, name: "Bright Spodumain", compressedTypeId: 28418, compressedName: "Compressed Bright Spodumain", compressionRatio: 100, volumePerUnit: 16, compressedVolumePerUnit: 0.1 },
  { typeId: 17467, name: "Gleaming Spodumain", compressedTypeId: 28419, compressedName: "Compressed Gleaming Spodumain", compressionRatio: 100, volumePerUnit: 16, compressedVolumePerUnit: 0.1 },

  // Crokite variants
  { typeId: 1225, name: "Crokite", compressedTypeId: 28391, compressedName: "Compressed Crokite", compressionRatio: 100, volumePerUnit: 16, compressedVolumePerUnit: 0.16 },
  { typeId: 17432, name: "Sharp Crokite", compressedTypeId: 28393, compressedName: "Compressed Sharp Crokite", compressionRatio: 100, volumePerUnit: 16, compressedVolumePerUnit: 0.16 },
  { typeId: 17433, name: "Crystalline Crokite", compressedTypeId: 28392, compressedName: "Compressed Crystalline Crokite", compressionRatio: 100, volumePerUnit: 16, compressedVolumePerUnit: 0.16 },

  // Bistot variants
  { typeId: 1223, name: "Bistot", compressedTypeId: 28388, compressedName: "Compressed Bistot", compressionRatio: 100, volumePerUnit: 16, compressedVolumePerUnit: 0.16 },
  { typeId: 17428, name: "Triclinic Bistot", compressedTypeId: 28390, compressedName: "Compressed Triclinic Bistot", compressionRatio: 100, volumePerUnit: 16, compressedVolumePerUnit: 0.16 },
  { typeId: 17429, name: "Monoclinic Bistot", compressedTypeId: 28389, compressedName: "Compressed Monoclinic Bistot", compressionRatio: 100, volumePerUnit: 16, compressedVolumePerUnit: 0.16 },

  // Arkonor variants
  { typeId: 22, name: "Arkonor", compressedTypeId: 28367, compressedName: "Compressed Arkonor", compressionRatio: 100, volumePerUnit: 16, compressedVolumePerUnit: 0.16 },
  { typeId: 17425, name: "Crimson Arkonor", compressedTypeId: 28385, compressedName: "Compressed Crimson Arkonor", compressionRatio: 100, volumePerUnit: 16, compressedVolumePerUnit: 0.16 },
  { typeId: 17426, name: "Prime Arkonor", compressedTypeId: 28387, compressedName: "Compressed Prime Arkonor", compressionRatio: 100, volumePerUnit: 16, compressedVolumePerUnit: 0.16 },

  // Mercoxit variants
  { typeId: 11396, name: "Mercoxit", compressedTypeId: 28413, compressedName: "Compressed Mercoxit", compressionRatio: 100, volumePerUnit: 40, compressedVolumePerUnit: 0.1 },
  { typeId: 17869, name: "Magma Mercoxit", compressedTypeId: 28412, compressedName: "Compressed Magma Mercoxit", compressionRatio: 100, volumePerUnit: 40, compressedVolumePerUnit: 0.1 },
  { typeId: 17870, name: "Vitreous Mercoxit", compressedTypeId: 28414, compressedName: "Compressed Vitreous Mercoxit", compressionRatio: 100, volumePerUnit: 40, compressedVolumePerUnit: 0.1 },
];

// Create a lookup map for compression data
export const COMPRESSION_MAP: Record<number, CompressionInfo> = Object.fromEntries(
  ORE_COMPRESSION_DATA.map(info => [info.typeId, info])
);

// Get compression info for an ore
export function getCompressionInfo(typeId: number): CompressionInfo | null {
  return COMPRESSION_MAP[typeId] || null;
}

// Calculate compression results
export interface CompressionResult {
  inputTypeId: number;
  inputName: string;
  inputQuantity: number;
  inputVolume: number;
  outputTypeId: number;
  outputName: string;
  outputQuantity: number;
  outputVolume: number;
  volumeSaved: number;
  volumeSavedPercent: number;
}

export function calculateCompression(typeId: number, quantity: number): CompressionResult | null {
  const info = getCompressionInfo(typeId);
  if (!info) return null;

  const inputVolume = quantity * info.volumePerUnit;
  const outputQuantity = Math.floor(quantity / info.compressionRatio);
  const outputVolume = outputQuantity * info.compressedVolumePerUnit;
  const volumeSaved = inputVolume - outputVolume;
  const volumeSavedPercent = inputVolume > 0 ? (volumeSaved / inputVolume) * 100 : 0;

  return {
    inputTypeId: typeId,
    inputName: info.name,
    inputQuantity: quantity,
    inputVolume,
    outputTypeId: info.compressedTypeId,
    outputName: info.compressedName,
    outputQuantity,
    outputVolume,
    volumeSaved,
    volumeSavedPercent,
  };
}
