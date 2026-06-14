// EVE Online distance and fuel calculation utilities

// EVE uses meters for coordinates. 1 light year = 9.461e15 meters
const METERS_PER_LY = 9.461e15;

export interface SystemCoords {
  x: number;
  y: number;
  z: number;
}

/**
 * Calculate light-year distance between two systems using their coordinates
 */
export function lightYearDistance(a: SystemCoords, b: SystemCoords): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) / METERS_PER_LY;
}

/**
 * Calculate effective jump range for a ship with JDC skill
 * JDC adds 25% per level to base range
 */
export function jumpRange(baseRange: number, jdcLevel: number): number {
  return baseRange * (1 + 0.25 * jdcLevel);
}

/**
 * Calculate fuel consumption for a single jump
 * @param baseFuelPerLY - base isotopes per LY for the ship class
 * @param distanceLY - distance of the jump in LY
 * @param jfcLevel - Jump Fuel Conservation skill level (0-5)
 * @param jfLevel - Jump Freighters skill level (0-5), only for JFs
 * @returns Number of isotopes consumed (rounded up)
 */
export function fuelPerJump(
  baseFuelPerLY: number,
  distanceLY: number,
  jfcLevel: number,
  jfLevel: number = 0,
): number {
  const jfcReduction = 1 - 0.1 * jfcLevel;
  const jfReduction = 1 - 0.1 * jfLevel;
  return Math.ceil(baseFuelPerLY * distanceLY * jfcReduction * jfReduction);
}

/**
 * Get CSS color for security status
 */
export function securityColor(sec: number): string {
  if (sec >= 0.9) return "#2ECC40"; // bright green
  if (sec >= 0.8) return "#3DA85C";
  if (sec >= 0.7) return "#4B9B5A";
  if (sec >= 0.6) return "#5D8E59";
  if (sec >= 0.5) return "#6F8157"; // olive green
  if (sec >= 0.4) return "#D4A017"; // yellow
  if (sec >= 0.3) return "#E08A1E";
  if (sec >= 0.2) return "#EC6E25";
  if (sec >= 0.1) return "#F8512C"; // orange
  if (sec > 0.0) return "#FF3333"; // red
  return "#CC0000"; // deep red for negative sec
}

/**
 * Get security status display class (highsec/lowsec/nullsec)
 */
export function securityClass(sec: number): "highsec" | "lowsec" | "nullsec" {
  if (sec >= 0.45) return "highsec"; // rounds to 0.5+
  if (sec > 0.0) return "lowsec";
  return "nullsec";
}

/**
 * Format security status for display (round to 1 decimal)
 */
export function formatSecurity(sec: number): string {
  const rounded = Math.round(sec * 10) / 10;
  if (rounded === 0 && sec < 0) return "-0.0";
  return rounded.toFixed(1);
}

/**
 * Format number with commas (e.g., 12450 -> "12,450")
 */
export function formatNumber(n: number): string {
  return n.toLocaleString();
}

/**
 * Format duration in seconds to human-readable
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hours}h ${remainMins}m` : `${hours}h`;
}
