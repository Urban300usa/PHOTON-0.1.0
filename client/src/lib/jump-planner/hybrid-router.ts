// Hybrid route planner - combines gate and jump segments
// Used for Jump Freighter routes through highsec, or any mixed travel

import { lightYearDistance, type SystemCoords } from "./distance";
import { findGateRoute, type GateRouteOptions, type GatePreference, buildGateGraph } from "./gate-router";
import { findJumpRoute, type JumpRouteOptions } from "./jump-router";

export interface HybridRouteOptions {
  // Jump options
  baseRange: number;
  jdcLevel: number;
  preferStations: boolean;
  beaconSystems?: Set<number>;

  // Gate options
  gatePreference: GatePreference;

  // Hybrid-specific
  avoidSystems?: Set<number>;
  avoidRegions?: Set<number>;
}

export type SegmentType = "gate" | "jump" | "origin";

export interface HybridRouteHop {
  systemId: number;
  segmentType: SegmentType;
  distanceLY: number; // For jump hops, the LY distance. For gates, 0.
}

export interface HybridRouteResult {
  hops: HybridRouteHop[];
  totalGates: number;
  totalJumps: number;
  totalDistanceLY: number;
  found: boolean;
}

interface SystemInfo {
  id: number;
  x: number;
  y: number;
  z: number;
  sec: number;
  regId: number;
}

/**
 * Find a hybrid route that combines gate travel through highsec with jump travel through low/null.
 *
 * Strategy:
 * 1. If origin is in highsec, gate to nearest lowsec exit, then jump
 * 2. If destination is in highsec, jump to nearest lowsec entry, then gate
 * 3. Jump through low/null between entry/exit points
 * 4. Use waypoints to split into segments
 */
export function findHybridRoute(
  originId: number,
  destinationId: number,
  allSystems: SystemInfo[],
  gateGraph: Map<number, Set<number>>,
  systemLookup: (id: number) => SystemInfo | undefined,
  options: HybridRouteOptions,
): HybridRouteResult {
  if (originId === destinationId) {
    return {
      hops: [{ systemId: originId, segmentType: "origin", distanceLY: 0 }],
      totalGates: 0,
      totalJumps: 0,
      totalDistanceLY: 0,
      found: true,
    };
  }

  const origin = systemLookup(originId);
  const dest = systemLookup(destinationId);
  if (!origin || !dest) {
    return { hops: [], totalGates: 0, totalJumps: 0, totalDistanceLY: 0, found: false };
  }

  const originIsHighsec = origin.sec >= 0.45;
  const destIsHighsec = dest.sec >= 0.45;

  // Case 1: Both highsec - pure gate route
  if (originIsHighsec && destIsHighsec) {
    const gateResult = findGateRoute(originId, destinationId, gateGraph, (id) => systemLookup(id) as any, {
      preference: options.gatePreference,
      avoidSystems: options.avoidSystems,
      avoidRegions: options.avoidRegions,
    });

    if (!gateResult.found) {
      return { hops: [], totalGates: 0, totalJumps: 0, totalDistanceLY: 0, found: false };
    }

    const hops: HybridRouteHop[] = gateResult.systemIds.map((id, i) => ({
      systemId: id,
      segmentType: i === 0 ? "origin" as SegmentType : "gate" as SegmentType,
      distanceLY: 0,
    }));

    return {
      hops,
      totalGates: gateResult.gateCount,
      totalJumps: 0,
      totalDistanceLY: 0,
      found: true,
    };
  }

  // Case 2: Neither is highsec - pure jump route
  if (!originIsHighsec && !destIsHighsec) {
    const jumpResult = findJumpRoute(originId, destinationId, allSystems, {
      baseRange: options.baseRange,
      jdcLevel: options.jdcLevel,
      preferStations: options.preferStations,
      avoidSystems: options.avoidSystems,
      avoidRegions: options.avoidRegions,
      beaconSystems: options.beaconSystems,
    });

    if (!jumpResult.found) {
      return { hops: [], totalGates: 0, totalJumps: 0, totalDistanceLY: 0, found: false };
    }

    const hops: HybridRouteHop[] = jumpResult.hops.map((h, i) => ({
      systemId: h.systemId,
      segmentType: i === 0 ? "origin" as SegmentType : "jump" as SegmentType,
      distanceLY: h.distanceLY,
    }));

    return {
      hops,
      totalGates: 0,
      totalJumps: jumpResult.jumpCount,
      totalDistanceLY: jumpResult.totalDistanceLY,
      found: true,
    };
  }

  // Case 3: Origin in highsec, destination in low/null
  // Gate to nearest lowsec border, then jump
  if (originIsHighsec && !destIsHighsec) {
    const exitSystem = findNearestLowsecExit(originId, gateGraph, systemLookup, dest, options.avoidSystems);
    if (!exitSystem) {
      return { hops: [], totalGates: 0, totalJumps: 0, totalDistanceLY: 0, found: false };
    }

    return buildTwoSegmentRoute(
      originId, exitSystem, destinationId,
      "gate_then_jump",
      allSystems, gateGraph, systemLookup, options,
    );
  }

  // Case 4: Origin in low/null, destination in highsec
  // Jump to nearest lowsec border, then gate
  if (!originIsHighsec && destIsHighsec) {
    const entrySystem = findNearestLowsecEntry(destinationId, gateGraph, systemLookup, origin, options.avoidSystems);
    if (!entrySystem) {
      return { hops: [], totalGates: 0, totalJumps: 0, totalDistanceLY: 0, found: false };
    }

    return buildTwoSegmentRoute(
      originId, entrySystem, destinationId,
      "jump_then_gate",
      allSystems, gateGraph, systemLookup, options,
    );
  }

  return { hops: [], totalGates: 0, totalJumps: 0, totalDistanceLY: 0, found: false };
}

/**
 * Find the nearest lowsec system accessible by gate from a highsec system,
 * that is also closest to the target position (for efficient jump routing)
 */
function findNearestLowsecExit(
  highsecSystemId: number,
  gateGraph: Map<number, Set<number>>,
  systemLookup: (id: number) => SystemInfo | undefined,
  target: SystemCoords,
  avoidSystems?: Set<number>,
): number | null {
  // BFS from highsec system to find lowsec border systems
  const visited = new Set<number>([highsecSystemId]);
  const queue: number[] = [highsecSystemId];
  const lowsecBorder: { id: number; dist: number; gates: number }[] = [];
  const maxDepth = 30;
  const depthMap = new Map<number, number>([[highsecSystemId, 0]]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDepth = depthMap.get(current) ?? 0;
    if (currentDepth > maxDepth) continue;

    const neighbors = gateGraph.get(current);
    if (!neighbors) continue;

    const neighborArr = Array.from(neighbors);
    for (let ni = 0; ni < neighborArr.length; ni++) {
      const neighbor = neighborArr[ni];
      if (visited.has(neighbor)) continue;
      if (avoidSystems?.has(neighbor)) continue;
      visited.add(neighbor);
      depthMap.set(neighbor, currentDepth + 1);

      const sys = systemLookup(neighbor);
      if (!sys) continue;

      if (sys.sec < 0.45) {
        // Found a lowsec/null border system
        const distToTarget = lightYearDistance(sys, target);
        lowsecBorder.push({ id: neighbor, dist: distToTarget, gates: currentDepth + 1 });
      } else {
        queue.push(neighbor);
      }
    }
  }

  if (lowsecBorder.length === 0) return null;

  // Pick the border system closest to destination (weighted by gate count)
  lowsecBorder.sort((a, b) => {
    // Balance: prefer fewer gates but also closer to target
    const scoreA = a.dist + a.gates * 2; // 2 LY penalty per gate
    const scoreB = b.dist + b.gates * 2;
    return scoreA - scoreB;
  });

  return lowsecBorder[0].id;
}

/**
 * Find the nearest lowsec system accessible by gate from a highsec destination,
 * that is also closest to the origin position
 */
function findNearestLowsecEntry(
  highsecSystemId: number,
  gateGraph: Map<number, Set<number>>,
  systemLookup: (id: number) => SystemInfo | undefined,
  origin: SystemCoords,
  avoidSystems?: Set<number>,
): number | null {
  // Same as exit but looking from destination side
  return findNearestLowsecExit(highsecSystemId, gateGraph, systemLookup, origin, avoidSystems);
}

/**
 * Build a two-segment hybrid route (gate segment + jump segment)
 */
function buildTwoSegmentRoute(
  originId: number,
  midpointId: number,
  destinationId: number,
  mode: "gate_then_jump" | "jump_then_gate",
  allSystems: SystemInfo[],
  gateGraph: Map<number, Set<number>>,
  systemLookup: (id: number) => SystemInfo | undefined,
  options: HybridRouteOptions,
): HybridRouteResult {
  const hops: HybridRouteHop[] = [];
  let totalGates = 0;
  let totalJumps = 0;
  let totalDistanceLY = 0;

  if (mode === "gate_then_jump") {
    // Segment 1: Gate from origin to midpoint
    const gateResult = findGateRoute(originId, midpointId, gateGraph, (id) => systemLookup(id) as any, {
      preference: options.gatePreference,
      avoidSystems: options.avoidSystems,
      avoidRegions: options.avoidRegions,
    });

    if (!gateResult.found) {
      return { hops: [], totalGates: 0, totalJumps: 0, totalDistanceLY: 0, found: false };
    }

    for (let i = 0; i < gateResult.systemIds.length; i++) {
      hops.push({
        systemId: gateResult.systemIds[i],
        segmentType: i === 0 ? "origin" : "gate",
        distanceLY: 0,
      });
    }
    totalGates = gateResult.gateCount;

    // Segment 2: Jump from midpoint to destination
    const jumpResult = findJumpRoute(midpointId, destinationId, allSystems, {
      baseRange: options.baseRange,
      jdcLevel: options.jdcLevel,
      preferStations: options.preferStations,
      avoidSystems: options.avoidSystems,
      avoidRegions: options.avoidRegions,
      beaconSystems: options.beaconSystems,
    });

    if (!jumpResult.found) {
      return { hops: [], totalGates: 0, totalJumps: 0, totalDistanceLY: 0, found: false };
    }

    // Skip first hop (midpoint already added)
    for (let i = 1; i < jumpResult.hops.length; i++) {
      hops.push({
        systemId: jumpResult.hops[i].systemId,
        segmentType: "jump",
        distanceLY: jumpResult.hops[i].distanceLY,
      });
    }
    totalJumps = jumpResult.jumpCount;
    totalDistanceLY = jumpResult.totalDistanceLY;
  } else {
    // Segment 1: Jump from origin to midpoint
    const jumpResult = findJumpRoute(originId, midpointId, allSystems, {
      baseRange: options.baseRange,
      jdcLevel: options.jdcLevel,
      preferStations: options.preferStations,
      avoidSystems: options.avoidSystems,
      avoidRegions: options.avoidRegions,
      beaconSystems: options.beaconSystems,
    });

    if (!jumpResult.found) {
      return { hops: [], totalGates: 0, totalJumps: 0, totalDistanceLY: 0, found: false };
    }

    for (let i = 0; i < jumpResult.hops.length; i++) {
      hops.push({
        systemId: jumpResult.hops[i].systemId,
        segmentType: i === 0 ? "origin" : "jump",
        distanceLY: jumpResult.hops[i].distanceLY,
      });
    }
    totalJumps = jumpResult.jumpCount;
    totalDistanceLY = jumpResult.totalDistanceLY;

    // Segment 2: Gate from midpoint to destination
    const gateResult = findGateRoute(midpointId, destinationId, gateGraph, (id) => systemLookup(id) as any, {
      preference: options.gatePreference,
      avoidSystems: options.avoidSystems,
      avoidRegions: options.avoidRegions,
    });

    if (!gateResult.found) {
      return { hops: [], totalGates: 0, totalJumps: 0, totalDistanceLY: 0, found: false };
    }

    // Skip first hop (midpoint already added)
    for (let i = 1; i < gateResult.systemIds.length; i++) {
      hops.push({
        systemId: gateResult.systemIds[i],
        segmentType: "gate",
        distanceLY: 0,
      });
    }
    totalGates = gateResult.gateCount;
  }

  return { hops, totalGates, totalJumps, totalDistanceLY, found: true };
}
