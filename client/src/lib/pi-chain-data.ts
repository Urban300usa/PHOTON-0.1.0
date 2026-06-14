export type PITier = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

export type PlanetType = 'barren' | 'gas' | 'ice' | 'lava' | 'oceanic' | 'plasma' | 'storm' | 'temperate';

export interface PICommodity {
  typeId: number;
  name: string;
  tier: PITier;
  volume: number;
  inputs?: { typeId: number; quantity: number }[];
  outputQuantity?: number;
  cycleTime?: number;
  planetTypes?: PlanetType[];
}

export const PLANET_TYPE_INFO: Record<PlanetType, { name: string; color: string; bgColor: string }> = {
  barren: { name: "Barren", color: "text-amber-600", bgColor: "bg-amber-500/20" },
  gas: { name: "Gas", color: "text-cyan-400", bgColor: "bg-cyan-500/20" },
  ice: { name: "Ice", color: "text-blue-300", bgColor: "bg-blue-300/20" },
  lava: { name: "Lava", color: "text-orange-500", bgColor: "bg-orange-500/20" },
  oceanic: { name: "Oceanic", color: "text-blue-500", bgColor: "bg-blue-500/20" },
  plasma: { name: "Plasma", color: "text-purple-400", bgColor: "bg-purple-400/20" },
  storm: { name: "Storm", color: "text-emerald-400", bgColor: "bg-emerald-400/20" },
  temperate: { name: "Temperate", color: "text-green-500", bgColor: "bg-green-500/20" },
};

export const P0_PLANET_SOURCES: Record<number, PlanetType[]> = {
  2073: ['barren', 'gas', 'ice', 'oceanic', 'storm', 'temperate'],
  2310: ['temperate'],
  2267: ['barren', 'gas', 'lava', 'plasma', 'storm'],
  2288: ['barren', 'oceanic', 'temperate'],
  2287: ['oceanic', 'temperate'],
  2307: ['lava'],
  2272: ['ice', 'lava', 'plasma'],
  2309: ['gas', 'storm'],
  2311: ['barren', 'ice', 'oceanic', 'temperate'],
  2270: ['gas', 'ice', 'storm'],
  2306: ['barren', 'plasma'],
  2286: ['lava', 'plasma'],
  2268: ['ice', 'oceanic'],
  2305: ['gas', 'lava'],
  2266: ['lava', 'plasma', 'storm'],
};

export const PI_COMMODITIES: Record<number, PICommodity> = {
  2073: { typeId: 2073, name: "Aqueous Liquids", tier: "P0", volume: 0.01 },
  2310: { typeId: 2310, name: "Autotrophs", tier: "P0", volume: 0.01 },
  2267: { typeId: 2267, name: "Base Metals", tier: "P0", volume: 0.01 },
  2288: { typeId: 2288, name: "Carbon Compounds", tier: "P0", volume: 0.01 },
  2287: { typeId: 2287, name: "Complex Organisms", tier: "P0", volume: 0.01 },
  2307: { typeId: 2307, name: "Felsic Magma", tier: "P0", volume: 0.01 },
  2272: { typeId: 2272, name: "Heavy Metals", tier: "P0", volume: 0.01 },
  2309: { typeId: 2309, name: "Ionic Solutions", tier: "P0", volume: 0.01 },
  2311: { typeId: 2311, name: "Micro Organisms", tier: "P0", volume: 0.01 },
  2270: { typeId: 2270, name: "Noble Gas", tier: "P0", volume: 0.01 },
  2306: { typeId: 2306, name: "Noble Metals", tier: "P0", volume: 0.01 },
  2286: { typeId: 2286, name: "Non-CS Crystals", tier: "P0", volume: 0.01 },
  2268: { typeId: 2268, name: "Planktic Colonies", tier: "P0", volume: 0.01 },
  2305: { typeId: 2305, name: "Reactive Gas", tier: "P0", volume: 0.01 },
  2266: { typeId: 2266, name: "Suspended Plasma", tier: "P0", volume: 0.01 },

  2389: { typeId: 2389, name: "Bacteria", tier: "P1", volume: 0.38, inputs: [{ typeId: 2311, quantity: 3000 }], outputQuantity: 20, cycleTime: 1800 },
  2390: { typeId: 2390, name: "Biofuels", tier: "P1", volume: 0.38, inputs: [{ typeId: 2288, quantity: 3000 }], outputQuantity: 20, cycleTime: 1800 },
  2392: { typeId: 2392, name: "Biomass", tier: "P1", volume: 0.38, inputs: [{ typeId: 2268, quantity: 3000 }], outputQuantity: 20, cycleTime: 1800 },
  2393: { typeId: 2393, name: "Chiral Structures", tier: "P1", volume: 0.38, inputs: [{ typeId: 2286, quantity: 3000 }], outputQuantity: 20, cycleTime: 1800 },
  2395: { typeId: 2395, name: "Electrolytes", tier: "P1", volume: 0.38, inputs: [{ typeId: 2309, quantity: 3000 }], outputQuantity: 20, cycleTime: 1800 },
  2396: { typeId: 2396, name: "Industrial Fibers", tier: "P1", volume: 0.38, inputs: [{ typeId: 2310, quantity: 3000 }], outputQuantity: 20, cycleTime: 1800 },
  2397: { typeId: 2397, name: "Oxidizing Compound", tier: "P1", volume: 0.38, inputs: [{ typeId: 2305, quantity: 3000 }], outputQuantity: 20, cycleTime: 1800 },
  2398: { typeId: 2398, name: "Oxygen", tier: "P1", volume: 0.38, inputs: [{ typeId: 2270, quantity: 3000 }], outputQuantity: 20, cycleTime: 1800 },
  2399: { typeId: 2399, name: "Plasmoids", tier: "P1", volume: 0.38, inputs: [{ typeId: 2266, quantity: 3000 }], outputQuantity: 20, cycleTime: 1800 },
  2400: { typeId: 2400, name: "Precious Metals", tier: "P1", volume: 0.38, inputs: [{ typeId: 2306, quantity: 3000 }], outputQuantity: 20, cycleTime: 1800 },
  2401: { typeId: 2401, name: "Proteins", tier: "P1", volume: 0.38, inputs: [{ typeId: 2287, quantity: 3000 }], outputQuantity: 20, cycleTime: 1800 },
  3779: { typeId: 3779, name: "Reactive Metals", tier: "P1", volume: 0.38, inputs: [{ typeId: 2267, quantity: 3000 }], outputQuantity: 20, cycleTime: 1800 },
  2402: { typeId: 2402, name: "Silicon", tier: "P1", volume: 0.38, inputs: [{ typeId: 2307, quantity: 3000 }], outputQuantity: 20, cycleTime: 1800 },
  2403: { typeId: 2403, name: "Toxic Metals", tier: "P1", volume: 0.38, inputs: [{ typeId: 2272, quantity: 3000 }], outputQuantity: 20, cycleTime: 1800 },
  2317: { typeId: 2317, name: "Water", tier: "P1", volume: 0.38, inputs: [{ typeId: 2073, quantity: 3000 }], outputQuantity: 20, cycleTime: 1800 },

  2329: { typeId: 2329, name: "Biocells", tier: "P2", volume: 1.5, inputs: [{ typeId: 2390, quantity: 40 }, { typeId: 2400, quantity: 40 }], outputQuantity: 5, cycleTime: 3600 },
  3689: { typeId: 3689, name: "Construction Blocks", tier: "P2", volume: 1.5, inputs: [{ typeId: 3779, quantity: 40 }, { typeId: 2403, quantity: 40 }], outputQuantity: 5, cycleTime: 3600 },
  9834: { typeId: 9834, name: "Consumer Electronics", tier: "P2", volume: 1.5, inputs: [{ typeId: 2403, quantity: 40 }, { typeId: 2393, quantity: 40 }], outputQuantity: 5, cycleTime: 3600 },
  9832: { typeId: 9832, name: "Coolant", tier: "P2", volume: 1.5, inputs: [{ typeId: 2395, quantity: 40 }, { typeId: 2317, quantity: 40 }], outputQuantity: 5, cycleTime: 3600 },
  44: { typeId: 44, name: "Enriched Uranium", tier: "P2", volume: 1.5, inputs: [{ typeId: 2400, quantity: 40 }, { typeId: 2403, quantity: 40 }], outputQuantity: 5, cycleTime: 3600 },
  15317: { typeId: 15317, name: "Fertilizer", tier: "P2", volume: 1.5, inputs: [{ typeId: 2389, quantity: 40 }, { typeId: 2401, quantity: 40 }], outputQuantity: 5, cycleTime: 3600 },
  3683: { typeId: 3683, name: "Genetically Enhanced Livestock", tier: "P2", volume: 1.5, inputs: [{ typeId: 2401, quantity: 40 }, { typeId: 2392, quantity: 40 }], outputQuantity: 5, cycleTime: 3600 },
  3725: { typeId: 3725, name: "Livestock", tier: "P2", volume: 1.5, inputs: [{ typeId: 2401, quantity: 40 }, { typeId: 2390, quantity: 40 }], outputQuantity: 5, cycleTime: 3600 },
  9836: { typeId: 9836, name: "Mechanical Parts", tier: "P2", volume: 1.5, inputs: [{ typeId: 3779, quantity: 40 }, { typeId: 2400, quantity: 40 }], outputQuantity: 5, cycleTime: 3600 },
  3695: { typeId: 3695, name: "Microfiber Shielding", tier: "P2", volume: 1.5, inputs: [{ typeId: 2396, quantity: 40 }, { typeId: 2402, quantity: 40 }], outputQuantity: 5, cycleTime: 3600 },
  2327: { typeId: 2327, name: "Miniature Electronics", tier: "P2", volume: 1.5, inputs: [{ typeId: 2393, quantity: 40 }, { typeId: 2402, quantity: 40 }], outputQuantity: 5, cycleTime: 3600 },
  3697: { typeId: 3697, name: "Nanites", tier: "P2", volume: 1.5, inputs: [{ typeId: 2389, quantity: 40 }, { typeId: 3779, quantity: 40 }], outputQuantity: 5, cycleTime: 3600 },
  9842: { typeId: 9842, name: "Oxides", tier: "P2", volume: 1.5, inputs: [{ typeId: 2397, quantity: 40 }, { typeId: 2398, quantity: 40 }], outputQuantity: 5, cycleTime: 3600 },
  2463: { typeId: 2463, name: "Polyaramids", tier: "P2", volume: 1.5, inputs: [{ typeId: 2397, quantity: 40 }, { typeId: 2396, quantity: 40 }], outputQuantity: 5, cycleTime: 3600 },
  3691: { typeId: 3691, name: "Polytextiles", tier: "P2", volume: 1.5, inputs: [{ typeId: 2390, quantity: 40 }, { typeId: 2396, quantity: 40 }], outputQuantity: 5, cycleTime: 3600 },
  3828: { typeId: 3828, name: "Rocket Fuel", tier: "P2", volume: 1.5, inputs: [{ typeId: 2399, quantity: 40 }, { typeId: 2395, quantity: 40 }], outputQuantity: 5, cycleTime: 3600 },
  9830: { typeId: 9830, name: "Silicate Glass", tier: "P2", volume: 1.5, inputs: [{ typeId: 2402, quantity: 40 }, { typeId: 2397, quantity: 40 }], outputQuantity: 5, cycleTime: 3600 },
  3693: { typeId: 3693, name: "Superconductors", tier: "P2", volume: 1.5, inputs: [{ typeId: 2399, quantity: 40 }, { typeId: 2317, quantity: 40 }], outputQuantity: 5, cycleTime: 3600 },
  3775: { typeId: 3775, name: "Supertensile Plastics", tier: "P2", volume: 1.5, inputs: [{ typeId: 2392, quantity: 40 }, { typeId: 2398, quantity: 40 }], outputQuantity: 5, cycleTime: 3600 },
  2328: { typeId: 2328, name: "Synthetic Oil", tier: "P2", volume: 1.5, inputs: [{ typeId: 2395, quantity: 40 }, { typeId: 2398, quantity: 40 }], outputQuantity: 5, cycleTime: 3600 },
  3687: { typeId: 3687, name: "Test Cultures", tier: "P2", volume: 1.5, inputs: [{ typeId: 2389, quantity: 40 }, { typeId: 2317, quantity: 40 }], outputQuantity: 5, cycleTime: 3600 },
  2351: { typeId: 2351, name: "Transmitter", tier: "P2", volume: 1.5, inputs: [{ typeId: 2399, quantity: 40 }, { typeId: 2393, quantity: 40 }], outputQuantity: 5, cycleTime: 3600 },
  9838: { typeId: 9838, name: "Viral Agent", tier: "P2", volume: 1.5, inputs: [{ typeId: 2389, quantity: 40 }, { typeId: 2392, quantity: 40 }], outputQuantity: 5, cycleTime: 3600 },
  2312: { typeId: 2312, name: "Water-Cooled CPU", tier: "P2", volume: 1.5, inputs: [{ typeId: 3779, quantity: 40 }, { typeId: 2317, quantity: 40 }], outputQuantity: 5, cycleTime: 3600 },

  2358: { typeId: 2358, name: "Biotech Research Reports", tier: "P3", volume: 6, inputs: [{ typeId: 3697, quantity: 10 }, { typeId: 3725, quantity: 10 }, { typeId: 3689, quantity: 10 }], outputQuantity: 3, cycleTime: 3600 },
  2345: { typeId: 2345, name: "Camera Drones", tier: "P3", volume: 6, inputs: [{ typeId: 9830, quantity: 10 }, { typeId: 3828, quantity: 10 }], outputQuantity: 3, cycleTime: 3600 },
  2344: { typeId: 2344, name: "Condensates", tier: "P3", volume: 6, inputs: [{ typeId: 9832, quantity: 10 }, { typeId: 9842, quantity: 10 }], outputQuantity: 3, cycleTime: 3600 },
  2367: { typeId: 2367, name: "Cryoprotectant Solution", tier: "P3", volume: 6, inputs: [{ typeId: 3687, quantity: 10 }, { typeId: 2328, quantity: 10 }, { typeId: 15317, quantity: 10 }], outputQuantity: 3, cycleTime: 3600 },
  17392: { typeId: 17392, name: "Data Chips", tier: "P3", volume: 6, inputs: [{ typeId: 3775, quantity: 10 }, { typeId: 3695, quantity: 10 }], outputQuantity: 3, cycleTime: 3600 },
  2348: { typeId: 2348, name: "Gel-Matrix Biopaste", tier: "P3", volume: 6, inputs: [{ typeId: 9842, quantity: 10 }, { typeId: 2329, quantity: 10 }, { typeId: 3693, quantity: 10 }], outputQuantity: 3, cycleTime: 3600 },
  9840: { typeId: 9840, name: "Guidance Systems", tier: "P3", volume: 6, inputs: [{ typeId: 2312, quantity: 10 }, { typeId: 2351, quantity: 10 }], outputQuantity: 3, cycleTime: 3600 },
  2366: { typeId: 2366, name: "Hazmat Detection Systems", tier: "P3", volume: 6, inputs: [{ typeId: 3691, quantity: 10 }, { typeId: 9838, quantity: 10 }, { typeId: 2351, quantity: 10 }], outputQuantity: 3, cycleTime: 3600 },
  2349: { typeId: 2349, name: "Hermetic Membranes", tier: "P3", volume: 6, inputs: [{ typeId: 2463, quantity: 10 }, { typeId: 3683, quantity: 10 }], outputQuantity: 3, cycleTime: 3600 },
  2352: { typeId: 2352, name: "High-Tech Transmitters", tier: "P3", volume: 6, inputs: [{ typeId: 2463, quantity: 10 }, { typeId: 2351, quantity: 10 }], outputQuantity: 3, cycleTime: 3600 },
  2354: { typeId: 2354, name: "Industrial Explosives", tier: "P3", volume: 6, inputs: [{ typeId: 15317, quantity: 10 }, { typeId: 3691, quantity: 10 }], outputQuantity: 3, cycleTime: 3600 },
  2361: { typeId: 2361, name: "Neocoms", tier: "P3", volume: 6, inputs: [{ typeId: 2329, quantity: 10 }, { typeId: 9830, quantity: 10 }], outputQuantity: 3, cycleTime: 3600 },
  2360: { typeId: 2360, name: "Nuclear Reactors", tier: "P3", volume: 6, inputs: [{ typeId: 44, quantity: 10 }, { typeId: 3695, quantity: 10 }], outputQuantity: 3, cycleTime: 3600 },
  2338: { typeId: 2338, name: "Planetary Vehicles", tier: "P3", volume: 6, inputs: [{ typeId: 3775, quantity: 10 }, { typeId: 9836, quantity: 10 }, { typeId: 2327, quantity: 10 }], outputQuantity: 3, cycleTime: 3600 },
  2332: { typeId: 2332, name: "Robotics", tier: "P3", volume: 6, inputs: [{ typeId: 9836, quantity: 10 }, { typeId: 9834, quantity: 10 }], outputQuantity: 3, cycleTime: 3600 },
  2346: { typeId: 2346, name: "Smartfab Units", tier: "P3", volume: 6, inputs: [{ typeId: 3689, quantity: 10 }, { typeId: 2327, quantity: 10 }], outputQuantity: 3, cycleTime: 3600 },
  17898: { typeId: 17898, name: "Supercomputers", tier: "P3", volume: 6, inputs: [{ typeId: 2312, quantity: 10 }, { typeId: 9832, quantity: 10 }, { typeId: 9834, quantity: 10 }], outputQuantity: 3, cycleTime: 3600 },
  2319: { typeId: 2319, name: "Synthetic Synapses", tier: "P3", volume: 6, inputs: [{ typeId: 3775, quantity: 10 }, { typeId: 3687, quantity: 10 }], outputQuantity: 3, cycleTime: 3600 },
  2321: { typeId: 2321, name: "Transcranial Microcontrollers", tier: "P3", volume: 6, inputs: [{ typeId: 2329, quantity: 10 }, { typeId: 3697, quantity: 10 }], outputQuantity: 3, cycleTime: 3600 },
  2876: { typeId: 2876, name: "Ukomi Superconductors", tier: "P3", volume: 6, inputs: [{ typeId: 2328, quantity: 10 }, { typeId: 3693, quantity: 10 }], outputQuantity: 3, cycleTime: 3600 },
  17136: { typeId: 17136, name: "Vaccines", tier: "P3", volume: 6, inputs: [{ typeId: 3725, quantity: 10 }, { typeId: 9838, quantity: 10 }], outputQuantity: 3, cycleTime: 3600 },

  2867: { typeId: 2867, name: "Broadcast Node", tier: "P4", volume: 100, inputs: [{ typeId: 2361, quantity: 6 }, { typeId: 17392, quantity: 6 }, { typeId: 2352, quantity: 6 }], outputQuantity: 1, cycleTime: 3600 },
  2868: { typeId: 2868, name: "Integrity Response Drones", tier: "P4", volume: 100, inputs: [{ typeId: 3683, quantity: 40 }, { typeId: 2348, quantity: 6 }, { typeId: 2366, quantity: 6 }, { typeId: 2338, quantity: 6 }], outputQuantity: 1, cycleTime: 3600 },
  2869: { typeId: 2869, name: "Nano-Factory", tier: "P4", volume: 100, inputs: [{ typeId: 2396, quantity: 40 }, { typeId: 2354, quantity: 6 }, { typeId: 2876, quantity: 6 }], outputQuantity: 1, cycleTime: 3600 },
  2870: { typeId: 2870, name: "Organic Mortar Applicators", tier: "P4", volume: 100, inputs: [{ typeId: 2344, quantity: 6 }, { typeId: 2389, quantity: 40 }, { typeId: 2332, quantity: 6 }], outputQuantity: 1, cycleTime: 3600 },
  2871: { typeId: 2871, name: "Recursive Computing Module", tier: "P4", volume: 100, inputs: [{ typeId: 2319, quantity: 6 }, { typeId: 9840, quantity: 6 }, { typeId: 2321, quantity: 6 }], outputQuantity: 1, cycleTime: 3600 },
  2872: { typeId: 2872, name: "Self-Harmonizing Power Core", tier: "P4", volume: 100, inputs: [{ typeId: 2345, quantity: 6 }, { typeId: 2360, quantity: 6 }, { typeId: 2349, quantity: 6 }], outputQuantity: 1, cycleTime: 3600 },
  2875: { typeId: 2875, name: "Sterile Conduits", tier: "P4", volume: 100, inputs: [{ typeId: 2346, quantity: 6 }, { typeId: 2317, quantity: 40 }, { typeId: 17136, quantity: 6 }], outputQuantity: 1, cycleTime: 3600 },
  2874: { typeId: 2874, name: "Wetware Mainframe", tier: "P4", volume: 100, inputs: [{ typeId: 2358, quantity: 6 }, { typeId: 2367, quantity: 6 }, { typeId: 17898, quantity: 6 }], outputQuantity: 1, cycleTime: 3600 },
};

export const TIER_COLORS: Record<PITier, { bg: string; text: string; border: string }> = {
  P0: { bg: "bg-slate-500/20", text: "text-slate-400", border: "border-slate-500/50" },
  P1: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/50" },
  P2: { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/50" },
  P3: { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/50" },
  P4: { bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-500/50" },
};

export const TIER_NAMES: Record<PITier, string> = {
  P0: "Raw Materials",
  P1: "Processed Materials",
  P2: "Refined Commodities",
  P3: "Specialized Commodities",
  P4: "Advanced Commodities",
};

export function getCommodityById(typeId: number): PICommodity | undefined {
  return PI_COMMODITIES[typeId];
}

export function getCommoditiesByTier(tier: PITier): PICommodity[] {
  return Object.values(PI_COMMODITIES).filter(c => c.tier === tier);
}

export function getAllCommodities(): PICommodity[] {
  return Object.values(PI_COMMODITIES);
}

export interface ProductionChainNode {
  commodity: PICommodity;
  quantity: number;
  children: ProductionChainNode[];
}

export function buildProductionChain(typeId: number, quantity: number = 1): ProductionChainNode | null {
  const commodity = getCommodityById(typeId);
  if (!commodity) return null;
  
  const node: ProductionChainNode = {
    commodity,
    quantity,
    children: [],
  };
  
  if (commodity.inputs && commodity.outputQuantity) {
    const cyclesNeeded = Math.ceil(quantity / commodity.outputQuantity);
    
    for (const input of commodity.inputs) {
      const inputQuantityNeeded = input.quantity * cyclesNeeded;
      const childNode = buildProductionChain(input.typeId, inputQuantityNeeded);
      if (childNode) {
        node.children.push(childNode);
      }
    }
  }
  
  return node;
}

export function calculateTotalP0Required(chain: ProductionChainNode): Map<number, { commodity: PICommodity; quantity: number }> {
  const totals = new Map<number, { commodity: PICommodity; quantity: number }>();
  
  function traverse(node: ProductionChainNode) {
    if (node.commodity.tier === 'P0') {
      const existing = totals.get(node.commodity.typeId);
      if (existing) {
        existing.quantity += node.quantity;
      } else {
        totals.set(node.commodity.typeId, { commodity: node.commodity, quantity: node.quantity });
      }
    }
    
    for (const child of node.children) {
      traverse(child);
    }
  }
  
  traverse(chain);
  return totals;
}

export function calculateMaterialsByTier(chain: ProductionChainNode): Record<PITier, Map<number, { commodity: PICommodity; quantity: number }>> {
  const byTier: Record<PITier, Map<number, { commodity: PICommodity; quantity: number }>> = {
    P0: new Map(),
    P1: new Map(),
    P2: new Map(),
    P3: new Map(),
    P4: new Map(),
  };
  
  function traverse(node: ProductionChainNode) {
    const tierMap = byTier[node.commodity.tier];
    const existing = tierMap.get(node.commodity.typeId);
    if (existing) {
      existing.quantity += node.quantity;
    } else {
      tierMap.set(node.commodity.typeId, { commodity: node.commodity, quantity: node.quantity });
    }
    
    for (const child of node.children) {
      traverse(child);
    }
  }
  
  traverse(chain);
  return byTier;
}

export function getPlanetTypesForCommodity(typeId: number): PlanetType[] {
  const commodity = getCommodityById(typeId);
  if (!commodity) return [];
  
  if (commodity.tier === 'P0') {
    return P0_PLANET_SOURCES[typeId] || [];
  }
  
  if (!commodity.inputs) return [];
  
  const allPlanetTypes = new Set<PlanetType>();
  
  for (const input of commodity.inputs) {
    const inputPlanets = getPlanetTypesForCommodity(input.typeId);
    inputPlanets.forEach(p => allPlanetTypes.add(p));
  }
  
  return Array.from(allPlanetTypes).sort();
}

export function getPlanetTypesForNode(node: ProductionChainNode): PlanetType[] {
  if (node.commodity.tier === 'P0') {
    return P0_PLANET_SOURCES[node.commodity.typeId] || [];
  }
  
  const allPlanetTypes = new Set<PlanetType>();
  
  for (const child of node.children) {
    const childPlanets = getPlanetTypesForNode(child);
    childPlanets.forEach(p => allPlanetTypes.add(p));
  }
  
  return Array.from(allPlanetTypes).sort();
}
