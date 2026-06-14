// ESI Corporation/Alliance Cache
// Provides cached lookups for character corporation and alliance info
// to avoid hitting ESI on every auth check or admin lookup

interface CorpAllianceData {
  corporationId: number | null;
  corporationName: string | null;
  allianceId: number | null;
  allianceName: string | null;
  cachedAt: number;
}

const corpAllianceCache = new Map<number, CorpAllianceData>();
const CORP_ALLIANCE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getCachedCorpAllianceInfo(characterId: number): Promise<CorpAllianceData> {
  const cached = corpAllianceCache.get(characterId);
  if (cached && Date.now() - cached.cachedAt < CORP_ALLIANCE_CACHE_TTL) {
    return cached;
  }
  
  // Return empty data immediately if we can't fetch (non-blocking fallback)
  const emptyData: CorpAllianceData = {
    corporationId: null,
    corporationName: null,
    allianceId: null,
    allianceName: null,
    cachedAt: Date.now(),
  };
  
  try {
    // Fetch character public info (includes corp and alliance IDs)
    const charResponse = await fetch(
      `https://esi.evetech.net/latest/characters/${characterId}/?datasource=tranquility`,
      { signal: AbortSignal.timeout(3000) } // 3s timeout
    );
    
    if (!charResponse.ok) {
      corpAllianceCache.set(characterId, emptyData);
      return emptyData;
    }
    
    const charData = await charResponse.json();
    const corporationId = charData.corporation_id || null;
    const allianceId = charData.alliance_id || null;
    
    let corporationName: string | null = null;
    let allianceName: string | null = null;
    
    // Fetch corp and alliance names in parallel
    const fetchPromises: Promise<void>[] = [];
    
    if (corporationId) {
      fetchPromises.push(
        fetch(`https://esi.evetech.net/latest/corporations/${corporationId}/?datasource=tranquility`, 
          { signal: AbortSignal.timeout(2000) })
          .then(r => r.ok ? r.json() : null)
          .then(data => { corporationName = data?.name || null; })
          .catch(() => {})
      );
    }
    
    if (allianceId) {
      fetchPromises.push(
        fetch(`https://esi.evetech.net/latest/alliances/${allianceId}/?datasource=tranquility`,
          { signal: AbortSignal.timeout(2000) })
          .then(r => r.ok ? r.json() : null)
          .then(data => { allianceName = data?.name || null; })
          .catch(() => {})
      );
    }
    
    await Promise.all(fetchPromises);
    
    const result: CorpAllianceData = {
      corporationId,
      corporationName,
      allianceId,
      allianceName,
      cachedAt: Date.now(),
    };
    
    corpAllianceCache.set(characterId, result);
    return result;
  } catch (e) {
    console.error("Failed to fetch corp/alliance info:", e);
    corpAllianceCache.set(characterId, emptyData);
    return emptyData;
  }
}
