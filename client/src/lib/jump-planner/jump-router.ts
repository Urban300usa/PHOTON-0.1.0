// Jump drive route planner
// Finds optimal routes for capital ships using jump drives

import { lightYearDistance, jumpRange, type SystemCoords } from "./distance";

export interface JumpRouteOptions {
  baseRange: number; // Base jump range in LY
  jdcLevel: number; // Jump Drive Calibration skill (0-5)
  preferStations: boolean; // Prefer systems with NPC stations
  avoidSystems?: Set<number>;
  avoidRegions?: Set<number>;
  beaconSystems?: Set<number>; // Systems with cyno beacons/alts
}

export interface JumpRouteHop {
  systemId: number;
  distanceLY: number; // Distance from previous hop
}

export interface JumpRouteResult {
  hops: JumpRouteHop[];
  totalDistanceLY: number;
  jumpCount: number;
  found: boolean;
}

interface SystemInfo {
  id: number;
  x: number;
  y: number;
  z: number;
  sec: number;
  regId: number;
  hasStation?: boolean;
}

// NPC station systems heuristic - systems with security > 0.4 likely have stations
// For full accuracy we'd need the station data, but this is a reasonable approximation
// Also lowsec systems with common NPC stations (like Amamake, Rancer, etc.)
function likelyHasStation(sec: number): boolean {
  return sec >= 0.45; // Highsec systems almost always have NPC stations
}

/**
 * Find all systems within jump range from a given position
 */
function findSystemsInRange(
  position: SystemCoords,
  maxRange: number,
  allSystems: SystemInfo[],
  avoidSystems?: Set<number>,
  avoidRegions?: Set<number>,
): SystemInfo[] {
  const results: SystemInfo[] = [];
  // Pre-compute maxRange squared to avoid sqrt in distance check
  // But we need actual LY for comparison, so just compute normally
  for (const sys of allSystems) {
    if (avoidSystems?.has(sys.id)) continue;
    if (avoidRegions?.has(sys.regId)) continue;
    // Cannot jump to highsec (security >= 0.45)
    if (sys.sec >= 0.45) continue;

    const dist = lightYearDistance(position, sys);
    if (dist <= maxRange && dist > 0) {
      results.push(sys);
    }
  }
  return results;
}

/**
 * Greedy jump route planner with A*-like optimization
 * Strategy: at each hop, jump to the reachable system closest to the destination
 * This produces near-optimal routes with fewest jumps
 */
export function findJumpRoute(
  originId: number,
  destinationId: number,
  allSystems: SystemInfo[],
  options: JumpRouteOptions,
): JumpRouteResult {
  if (originId === destinationId) {
    return {
      hops: [{ systemId: originId, distanceLY: 0 }],
      totalDistanceLY: 0,
      jumpCount: 0,
      found: true,
    };
  }

  const maxRange = jumpRange(options.baseRange, options.jdcLevel);
  const systemMap = new Map<number, SystemInfo>();
  for (const sys of allSystems) {
    systemMap.set(sys.id, sys);
  }

  const origin = systemMap.get(originId);
  const destination = systemMap.get(destinationId);
  if (!origin || !destination) {
    return { hops: [], totalDistanceLY: 0, jumpCount: 0, found: false };
  }

  // Check if destination is in highsec - can't jump to highsec
  // But we can jump to the nearest lowsec/null system
  const destIsHighsec = destination.sec >= 0.45;

  const hops: JumpRouteHop[] = [{ systemId: originId, distanceLY: 0 }];
  let currentPosition: SystemCoords = { x: origin.x, y: origin.y, z: origin.z };
  let currentId = originId;
  let totalDistance = 0;
  const visited = new Set<number>([originId]);
  const maxIterations = 200; // Safety limit

  for (let iter = 0; iter < maxIterations; iter++) {
    // Check if we can reach the destination directly
    if (!destIsHighsec) {
      const distToDest = lightYearDistance(currentPosition, destination);
      if (distToDest <= maxRange) {
        hops.push({ systemId: destinationId, distanceLY: distToDest });
        totalDistance += distToDest;
        return {
          hops,
          totalDistanceLY: totalDistance,
          jumpCount: hops.length - 1,
          found: true,
        };
      }
    }

    // Find all reachable systems
    const reachable = findSystemsInRange(
      currentPosition,
      maxRange,
      allSystems,
      options.avoidSystems,
      options.avoidRegions,
    ).filter((s) => !visited.has(s.id));

    if (reachable.length === 0) {
      return { hops, totalDistanceLY: totalDistance, jumpCount: hops.length - 1, found: false };
    }

    // Score each reachable system
    // Primary: distance to destination (lower is better)
    // Secondary: prefer beacon systems, prefer station systems
    let bestSystem: SystemInfo | null = null;
    let bestScore = Infinity;

    for (const sys of reachable) {
      const distToTarget = lightYearDistance(sys, destination);
      let score = distToTarget;

      // Beacon preference: significant bonus
      if (options.beaconSystems?.has(sys.id)) {
        score *= 0.7; // 30% bonus for beacon systems
      }

      // Station preference: mild bonus
      if (options.preferStations && likelyHasStation(sys.sec)) {
        score *= 0.9;
      }

      if (score < bestScore) {
        bestScore = score;
        bestSystem = sys;
      }
    }

    if (!bestSystem) {
      return { hops, totalDistanceLY: totalDistance, jumpCount: hops.length - 1, found: false };
    }

    const dist = lightYearDistance(currentPosition, bestSystem);
    hops.push({ systemId: bestSystem.id, distanceLY: dist });
    totalDistance += dist;
    visited.add(bestSystem.id);
    currentPosition = { x: bestSystem.x, y: bestSystem.y, z: bestSystem.z };
    currentId = bestSystem.id;
  }

  return { hops, totalDistanceLY: totalDistance, jumpCount: hops.length - 1, found: false };
}

/**
 * Calculate the straight-line LY distance between two systems
 */
export function directDistance(
  systemA: number,
  systemB: number,
  systemMap: Map<number, SystemInfo>,
): number {
  const a = systemMap.get(systemA);
  const b = systemMap.get(systemB);
  if (!a || !b) return Infinity;
  return lightYearDistance(a, b);
}
