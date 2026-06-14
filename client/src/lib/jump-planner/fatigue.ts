// Jump fatigue calculator
// Implements EVE Online's Phoebe jump fatigue mechanics

export interface FatigueHop {
  systemId: number;
  distanceLY: number;
  jumpCooldown: number; // seconds - time before next jump is possible
  fatigueAfter: number; // seconds - blue timer after this jump
  waitTime: number; // seconds - total wait at this system before jumping
  cumulativeTime: number; // seconds - total trip time up to this point
}

export interface FatigueResult {
  hops: FatigueHop[];
  totalTripTime: number; // seconds
  maxFatigue: number; // seconds - peak fatigue during trip
  maxCooldown: number; // seconds - longest cooldown
}

const MAX_FATIGUE_SECONDS = 5 * 60 * 60; // 5 hours max fatigue (blue timer)
const MAX_COOLDOWN_SECONDS = 30 * 60; // 30 minutes max cooldown (orange timer)
const MIN_FATIGUE_FLOOR = 600; // 10 minutes minimum fatigue floor

/**
 * Calculate jump fatigue for a sequence of jump hops
 * @param jumps - Array of { systemId, distanceLY } for each jump hop
 *                First entry is origin (distance=0, no fatigue change)
 *                Only "jump" type hops generate fatigue, gates do not
 * @param isJumpHop - Function that returns true if this hop is a jump (not a gate)
 * @returns Fatigue data per hop and trip totals
 */
export function calculateFatigue(
  jumps: { systemId: number; distanceLY: number }[],
  isJumpHop: (index: number) => boolean,
): FatigueResult {
  const hops: FatigueHop[] = [];
  let currentFatigue = 0; // seconds (blue timer)
  let cumulativeTime = 0;
  let maxFatigue = 0;
  let maxCooldown = 0;

  for (let i = 0; i < jumps.length; i++) {
    const { systemId, distanceLY } = jumps[i];

    if (i === 0 || !isJumpHop(i)) {
      // Origin system or gate hop - no fatigue change
      hops.push({
        systemId,
        distanceLY,
        jumpCooldown: 0,
        fatigueAfter: currentFatigue,
        waitTime: 0,
        cumulativeTime,
      });
      continue;
    }

    // This is a jump hop - calculate fatigue
    // Step 1: Calculate cooldown based on fatigue BEFORE jump
    const fatigueBefore = currentFatigue;
    const cooldown = Math.min(
      Math.max(
        (fatigueBefore * distanceLY) / 10,
        (1 + distanceLY) * 60, // minimum cooldown in seconds
      ),
      MAX_COOLDOWN_SECONDS,
    );

    // The wait time is the cooldown (must wait before next jump)
    // But for this hop, the wait is from the PREVIOUS hop's cooldown
    // Actually: the cooldown timer starts after the jump. You must wait for it before the NEXT jump.
    // For display: show the wait time AT this system before you can jump again.

    // Step 2: Calculate new fatigue after jump
    const fatigueFloor = Math.max(fatigueBefore, MIN_FATIGUE_FLOOR);
    const newFatigue = Math.min(
      fatigueFloor * (1 + distanceLY),
      MAX_FATIGUE_SECONDS,
    );

    // Step 3: Wait time = the cooldown from THIS jump (before next hop is possible)
    const waitTime = cooldown;

    cumulativeTime += waitTime;
    maxFatigue = Math.max(maxFatigue, newFatigue);
    maxCooldown = Math.max(maxCooldown, cooldown);

    hops.push({
      systemId,
      distanceLY,
      jumpCooldown: cooldown,
      fatigueAfter: newFatigue,
      waitTime,
      cumulativeTime,
    });

    // Fatigue decays while waiting for cooldown
    // Decay rate: fatigue reduces over time (1 minute per 10 minutes of fatigue, i.e., /10 per minute)
    // Actually: fatigue timer ticks down in real-time. After waiting `cooldown` seconds,
    // the fatigue has decreased by `cooldown` seconds.
    currentFatigue = Math.max(0, newFatigue - cooldown);
  }

  return {
    hops,
    totalTripTime: cumulativeTime,
    maxFatigue,
    maxCooldown,
  };
}

/**
 * Calculate fatigue for a single hypothetical jump (for preview)
 */
export function previewJumpFatigue(
  distanceLY: number,
  currentFatigue: number = 0,
): { cooldown: number; newFatigue: number } {
  const fatigueBefore = currentFatigue;
  const cooldown = Math.min(
    Math.max(
      (fatigueBefore * distanceLY) / 10,
      (1 + distanceLY) * 60,
    ),
    MAX_COOLDOWN_SECONDS,
  );

  const fatigueFloor = Math.max(fatigueBefore, MIN_FATIGUE_FLOOR);
  const newFatigue = Math.min(
    fatigueFloor * (1 + distanceLY),
    MAX_FATIGUE_SECONDS,
  );

  return { cooldown, newFatigue };
}
