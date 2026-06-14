import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ESI_BASE = "https://esi.evetech.net/latest";
const CONCURRENCY = 20; // Parallel ESI requests
const RETRY_DELAY = 1000;
const MAX_RETRIES = 3;

interface EsiSystem {
  system_id: number;
  name: string;
  position: { x: number; y: number; z: number };
  security_status: number;
  constellation_id: number;
  stargates?: number[];
}

interface EsiStargate {
  stargate_id: number;
  system_id: number;
  destination: { stargate_id: number; system_id: number };
}

interface EsiConstellation {
  constellation_id: number;
  name: string;
  region_id: number;
  systems: number[];
}

interface EsiRegion {
  region_id: number;
  name: string;
  constellations: number[];
}

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (res.status === 503 || res.status === 502 || res.status === 504) {
        console.warn(`  ESI ${res.status} for ${url}, retrying in ${RETRY_DELAY}ms...`);
        await sleep(RETRY_DELAY * (i + 1));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
      return await res.json();
    } catch (err: any) {
      if (i === retries - 1) throw err;
      console.warn(`  Retry ${i + 1}/${retries} for ${url}: ${err.message}`);
      await sleep(RETRY_DELAY * (i + 1));
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function batchFetch<T>(ids: number[], fetchFn: (id: number) => Promise<T | null>, label: string): Promise<Map<number, T>> {
  const results = new Map<number, T>();
  const total = ids.length;
  let completed = 0;

  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (id) => {
        const result = await fetchFn(id);
        completed++;
        if (completed % 200 === 0 || completed === total) {
          process.stdout.write(`\r  ${label}: ${completed}/${total} (${Math.round((completed / total) * 100)}%)`);
        }
        return { id, result };
      })
    );
    for (const { id, result } of batchResults) {
      if (result !== null) {
        results.set(id, result);
      }
    }
  }
  console.log(); // newline after progress
  return results;
}

async function main() {
  console.log("=== EVE Universe Data Generator ===\n");

  // Step 1: Fetch all region IDs
  console.log("1. Fetching region IDs...");
  const regionIds: number[] = await fetchWithRetry(`${ESI_BASE}/universe/regions/?datasource=tranquility`);
  console.log(`   Found ${regionIds.length} regions`);

  // Step 2: Fetch all region details
  console.log("2. Fetching region details...");
  const regionMap = await batchFetch<EsiRegion>(
    regionIds,
    (id) => fetchWithRetry(`${ESI_BASE}/universe/regions/${id}/?datasource=tranquility`),
    "Regions"
  );

  // Build regions output and collect constellation IDs
  const regions: Record<string, string> = {};
  const allConstellationIds: number[] = [];
  for (const [id, region] of regionMap) {
    regions[id.toString()] = region.name;
    allConstellationIds.push(...region.constellations);
  }
  console.log(`   Collected ${allConstellationIds.length} constellation IDs`);

  // Step 3: Fetch all constellation details
  console.log("3. Fetching constellation details...");
  const constellationMap = await batchFetch<EsiConstellation>(
    allConstellationIds,
    (id) => fetchWithRetry(`${ESI_BASE}/universe/constellations/${id}/?datasource=tranquility`),
    "Constellations"
  );

  // Build constellations output and collect system IDs
  const constellations: Record<string, { name: string; regId: number }> = {};
  const allSystemIds: number[] = [];
  for (const [id, con] of constellationMap) {
    constellations[id.toString()] = { name: con.name, regId: con.region_id };
    allSystemIds.push(...con.systems);
  }
  console.log(`   Collected ${allSystemIds.length} system IDs`);

  // Step 4: Fetch all system details
  console.log("4. Fetching system details (this takes a while)...");
  const systemMap = await batchFetch<EsiSystem>(
    allSystemIds,
    (id) => fetchWithRetry(`${ESI_BASE}/universe/systems/${id}/?datasource=tranquility`),
    "Systems"
  );

  // Build systems output and collect stargate IDs
  const systems: Record<string, { name: string; x: number; y: number; z: number; sec: number; conId: number; regId: number }> = {};
  const allStargateIds: number[] = [];
  const systemStargateMap = new Map<number, number[]>(); // systemId -> stargateIds

  for (const [id, sys] of systemMap) {
    const conId = sys.constellation_id;
    const con = constellations[conId.toString()];
    const regId = con?.regId ?? 0;

    systems[id.toString()] = {
      name: sys.name,
      x: sys.position.x,
      y: sys.position.y,
      z: sys.position.z,
      sec: Math.round(sys.security_status * 100) / 100, // round to 2 decimals
      conId: conId,
      regId: regId,
    };

    if (sys.stargates && sys.stargates.length > 0) {
      systemStargateMap.set(id, sys.stargates);
      allStargateIds.push(...sys.stargates);
    }
  }
  console.log(`   Collected ${allStargateIds.length} stargate IDs`);

  // Step 5: Fetch stargate details to build gate connections
  console.log("5. Fetching stargate details...");
  const stargateMap = await batchFetch<EsiStargate>(
    allStargateIds,
    (id) => fetchWithRetry(`${ESI_BASE}/universe/stargates/${id}/?datasource=tranquility`),
    "Stargates"
  );

  // Build gates as deduplicated pairs [fromSystemId, toSystemId] (lower ID first)
  const gateSet = new Set<string>();
  const gates: [number, number][] = [];

  for (const [, gate] of stargateMap) {
    const from = gate.system_id;
    const to = gate.destination.system_id;
    const key = from < to ? `${from}-${to}` : `${to}-${from}`;
    if (!gateSet.has(key)) {
      gateSet.add(key);
      gates.push(from < to ? [from, to] : [to, from]);
    }
  }
  console.log(`   Built ${gates.length} unique gate connections`);

  // Step 6: Filter inaccessible regions (wormhole, abyssal, jove, drifter, test)
  console.log("6. Filtering inaccessible systems...");
  const INACCESSIBLE_REGIONS = new Set<number>();
  for (let r = 11000001; r <= 11000033; r++) INACCESSIBLE_REGIONS.add(r); // Wormhole/Anoikis
  for (let r = 12000001; r <= 12000005; r++) INACCESSIBLE_REGIONS.add(r); // Abyssal Deadspace
  for (let r = 14000001; r <= 14000005; r++) INACCESSIBLE_REGIONS.add(r); // Drifter Enclaves
  INACCESSIBLE_REGIONS.add(10000004); // Jove space (A821-A / UUA-F4)
  INACCESSIBLE_REGIONS.add(19000001); // Test region

  // Remove inaccessible systems
  const removedSystemIds = new Set<number>();
  for (const idStr of Object.keys(systems)) {
    const sys = systems[idStr];
    if (INACCESSIBLE_REGIONS.has(sys.regId)) {
      removedSystemIds.add(parseInt(idStr));
      delete systems[idStr];
    }
  }
  console.log(`   Removed ${removedSystemIds.size} inaccessible systems`);

  // Filter gates referencing removed systems
  const filteredGates = gates.filter(([a, b]) => !removedSystemIds.has(a) && !removedSystemIds.has(b));
  const removedGateCount = gates.length - filteredGates.length;
  console.log(`   Removed ${removedGateCount} gates to inaccessible systems`);

  // Remove inaccessible constellations
  let removedConstellations = 0;
  for (const conIdStr of Object.keys(constellations)) {
    if (INACCESSIBLE_REGIONS.has(constellations[conIdStr].regId)) {
      delete constellations[conIdStr];
      removedConstellations++;
    }
  }
  console.log(`   Removed ${removedConstellations} inaccessible constellations`);

  // Remove inaccessible regions
  let removedRegions = 0;
  for (const regIdStr of Object.keys(regions)) {
    if (INACCESSIBLE_REGIONS.has(parseInt(regIdStr))) {
      delete regions[regIdStr];
      removedRegions++;
    }
  }
  console.log(`   Removed ${removedRegions} inaccessible regions`);

  // Step 7: Write output
  const output = {
    _meta: {
      generatedAt: new Date().toISOString(),
      systemCount: Object.keys(systems).length,
      gateCount: filteredGates.length,
      regionCount: Object.keys(regions).length,
      constellationCount: Object.keys(constellations).length,
      filteredSystems: removedSystemIds.size,
      filteredGates: removedGateCount,
    },
    systems,
    gates: filteredGates,
    regions,
    constellations,
  };

  const outputPath = path.resolve(__dirname, "../client/src/data/eve-universe.json");
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(output));
  const fileSizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
  console.log(`\n=== Done! ===`);
  console.log(`Output: ${outputPath}`);
  console.log(`File size: ${fileSizeMB} MB`);
  console.log(`Systems: ${output._meta.systemCount}`);
  console.log(`Gates: ${output._meta.gateCount}`);
  console.log(`Regions: ${output._meta.regionCount}`);
  console.log(`Constellations: ${output._meta.constellationCount}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
