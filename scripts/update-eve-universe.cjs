/**
 * update-eve-universe.js
 *
 * Downloads fresh EVE SDE CSVs from Fuzzwork and regenerates
 * client/src/data/eve-universe.json
 *
 * Run with: node scripts/update-eve-universe.js
 */

"use strict";

const https = require("https");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// Output path relative to project root
const OUTPUT_PATH = path.join(__dirname, "../client/src/data/eve-universe.json");

// Fuzzwork SDE CSV URLs
const URLS = {
  systems: "https://www.fuzzwork.co.uk/dump/latest/csv/mapSolarSystems.csv",
  gates: "https://www.fuzzwork.co.uk/dump/latest/csv/mapSolarSystemJumps.csv",
  regions: "https://www.fuzzwork.co.uk/dump/latest/csv/mapRegions.csv",
  constellations: "https://www.fuzzwork.co.uk/dump/latest/csv/mapConstellations.csv",
};

// Region IDs to exclude (inaccessible / non-playable)
const EXCLUDED_REGION_IDS = new Set([
  // Wormhole regions
  ...Array.from({ length: 33 }, (_, i) => 11000001 + i),
  // Abyssal regions
  ...Array.from({ length: 5 }, (_, i) => 12000001 + i),
  // Drifter regions
  ...Array.from({ length: 5 }, (_, i) => 14000001 + i),
  // Jove space
  10000004,
  // Test system
  19000001,
]);

/**
 * Download a URL and return the raw string body.
 * Handles gzip/deflate encoding automatically.
 */
function download(url) {
  return new Promise((resolve, reject) => {
    console.log(`  Downloading: ${url}`);

    const req = https.get(url, { headers: {
      "Accept-Encoding": "gzip, deflate",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PHOTON-EVE-Tracker/0.6 (contact: tbridenbaker16@gmail.com)",
      "Accept": "text/csv,*/*",
    } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }

      const encoding = res.headers["content-encoding"];
      let stream = res;

      if (encoding === "gzip") {
        stream = res.pipe(zlib.createGunzip());
      } else if (encoding === "deflate") {
        stream = res.pipe(zlib.createInflate());
      }

      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      stream.on("error", reject);
    });

    req.on("error", reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error(`Timeout fetching ${url}`)); });
  });
}

/**
 * Parse a CSV string into an array of objects keyed by header names.
 * Handles quoted fields with commas inside.
 */
function parseCSV(text) {
  // Strip UTF-8 BOM so the first header name isn't prefixed with
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function main() {
  console.log("=== EVE Universe Data Updater ===\n");

  // --- Download all CSVs ---
  let systemsCSV, gatesCSV, regionsCSV, constellationsCSV;
  try {
    console.log("Fetching CSVs from Fuzzwork SDE...");
    [systemsCSV, gatesCSV, regionsCSV, constellationsCSV] = await Promise.all([
      download(URLS.systems),
      download(URLS.gates),
      download(URLS.regions),
      download(URLS.constellations),
    ]);
    console.log("  All CSVs downloaded successfully.\n");
  } catch (err) {
    console.error("\nERROR: Failed to download SDE data:", err.message);
    console.error("The existing eve-universe.json has NOT been modified.");
    process.exit(1);
  }

  // --- Parse regions first ---
  console.log("Parsing regions...");
  const regionsRaw = parseCSV(regionsCSV);
  const regions = {};
  const accessibleRegionIds = new Set();

  for (const row of regionsRaw) {
    const id = parseInt(row.regionID);
    if (!id || EXCLUDED_REGION_IDS.has(id)) continue;
    regions[id.toString()] = row.regionName;
    accessibleRegionIds.add(id);
  }
  console.log(`  ${Object.keys(regions).length} accessible regions found.\n`);

  // --- Parse constellations ---
  console.log("Parsing constellations...");
  const constellationsRaw = parseCSV(constellationsCSV);
  const constellations = {};

  for (const row of constellationsRaw) {
    const id = parseInt(row.constellationID);
    const regId = parseInt(row.regionID);
    if (!id || !regId || !accessibleRegionIds.has(regId)) continue;
    constellations[id.toString()] = {
      name: row.constellationName,
      regId,
    };
  }
  console.log(`  ${Object.keys(constellations).length} constellations found.\n`);

  // --- Parse solar systems ---
  console.log("Parsing solar systems...");
  const systemsRaw = parseCSV(systemsCSV);
  const systems = {};
  const accessibleSystemIds = new Set();

  for (const row of systemsRaw) {
    const id = parseInt(row.solarSystemID);
    const regId = parseInt(row.regionID);
    const conId = parseInt(row.constellationID);

    if (!id || !regId || !accessibleRegionIds.has(regId)) continue;

    const sec = parseFloat(row.security);

    systems[id.toString()] = {
      name: row.solarSystemName,
      x: parseFloat(row.x),
      y: parseFloat(row.y),
      z: parseFloat(row.z),
      sec: Math.round(sec * 10000) / 10000,
      conId,
      regId,
    };
    accessibleSystemIds.add(id);
  }
  console.log(`  ${Object.keys(systems).length} solar systems found.\n`);

  // --- Parse gates (stargates / jumps between solar systems) ---
  console.log("Parsing stargates...");
  const gatesRaw = parseCSV(gatesCSV);
  const gateSet = new Set();
  const gates = [];

  for (const row of gatesRaw) {
    const from = parseInt(row.fromSolarSystemID);
    const to = parseInt(row.toSolarSystemID);

    if (!from || !to) continue;
    if (!accessibleSystemIds.has(from) || !accessibleSystemIds.has(to)) continue;

    // Deduplicate: store only one direction (smaller ID first)
    const key = from < to ? `${from}:${to}` : `${to}:${from}`;
    if (gateSet.has(key)) continue;
    gateSet.add(key);

    const a = from < to ? from : to;
    const b = from < to ? to : from;
    gates.push([a, b]);
  }
  console.log(`  ${gates.length} stargate connections found.\n`);

  // --- Assemble output ---
  const output = { systems, gates, regions, constellations };

  // --- Sanity guard: never clobber good data with a bad parse ---
  if (Object.keys(systems).length < 4000 || gates.length < 5000 || Object.keys(regions).length < 50) {
    console.error("\nERROR: Parsed data looks incomplete — refusing to overwrite eve-universe.json.");
    console.error(`  systems=${Object.keys(systems).length} gates=${gates.length} regions=${Object.keys(regions).length}`);
    process.exit(1);
  }

  // --- Write file ---
  console.log(`Writing to ${OUTPUT_PATH} ...`);
  const json = JSON.stringify(output);
  fs.writeFileSync(OUTPUT_PATH, json, "utf-8");

  const fileSizeKB = Math.round(fs.statSync(OUTPUT_PATH).size / 1024);
  console.log(`  Done! File size: ${fileSizeKB} KB`);
  console.log(`\nSummary:`);
  console.log(`  Systems:        ${Object.keys(systems).length}`);
  console.log(`  Gates:          ${gates.length}`);
  console.log(`  Regions:        ${Object.keys(regions).length}`);
  console.log(`  Constellations: ${Object.keys(constellations).length}`);
  console.log("\nEVE universe data updated successfully!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
