import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { securityColor, formatSecurity } from "@/lib/jump-planner/distance";
import type { SegmentType } from "@/lib/jump-planner/hybrid-router";

interface SystemData {
  name: string;
  x: number;
  y: number;
  z: number;
  sec: number;
  conId: number;
  regId: number;
}

interface RouteHop {
  systemId: number;
  segmentType: SegmentType;
  distanceLY: number;
}

interface UniverseMapProps {
  systems: Record<string, SystemData>;
  gates: [number, number][];
  regions: Record<string, string>;
  constellations: Record<string, { name: string; regId: number }>;
  route: RouteHop[] | null;
  originId: number | null;
  destinationId: number | null;
  beaconSystemIds: Set<number>;
  jumpRangeOriginId: number | null;
  jumpRangeLY: number;
  onSystemClick: (systemId: number) => void;
  highlightedSystemId: number | null;
}

// Convert LY to EVE coordinate units for range circle
const METERS_PER_LY = 9.461e15;

// Super-region mapping: region name → galaxy-scale label
const SUPER_REGION_MAP: Record<string, string> = {
  // Amarr Empire
  "Domain": "Amarr Empire", "Devoid": "Amarr Empire", "Tash-Murkon": "Amarr Empire",
  "Kador": "Amarr Empire", "Kor-Azor": "Amarr Empire", "Genesis": "Amarr Empire",
  "Aridia": "Amarr Empire", "The Bleak Lands": "Amarr Empire",
  "Khanid": "Amarr Empire", "Derelik": "Amarr Empire",
  // Caldari State
  "The Forge": "Caldari State", "The Citadel": "Caldari State",
  "Lonetrek": "Caldari State", "Black Rise": "Caldari State",
  // Gallente Federation
  "Essence": "Gallente Federation", "Everyshore": "Gallente Federation",
  "Sinq Laison": "Gallente Federation", "Verge Vendor": "Gallente Federation",
  "Placid": "Gallente Federation", "Solitude": "Gallente Federation",
  // Minmatar Republic
  "Heimatar": "Minmatar Republic", "Metropolis": "Minmatar Republic",
  "Molden Heath": "Minmatar Republic",
  // The North
  "Deklein": "The North", "Branch": "The North", "Tenal": "The North",
  "Tribute": "The North", "Vale of the Silent": "The North",
  "Pure Blind": "The North", "Fade": "The North", "Geminate": "The North",
  "Venal": "The North",
  // The West
  "Fountain": "The West", "Cloud Ring": "The West",
  "Outer Ring": "The West", "Syndicate": "The West",
  // The Southwest (Delve area)
  "Delve": "The Southwest", "Querious": "The Southwest",
  "Period Basis": "The Southwest", "Paragon Soul": "The Southwest",
  // The South
  "Catch": "The South", "Providence": "The South", "Esoteria": "The South",
  "Feythabolis": "The South", "Omist": "The South", "Impass": "The South",
  "Stain": "The South",
  // The Southeast
  "Immensea": "The Southeast", "Tenerifis": "The Southeast",
  "Detorid": "The Southeast", "Wicked Creek": "The Southeast",
  "Scalding Pass": "The Southeast", "Insmother": "The Southeast",
  "Cache": "The Southeast", "Curse": "The Southeast", "Great Wildlands": "The Southeast",
  // The Drone Lands
  "Cobalt Edge": "Drone Lands", "Etherium Reach": "Drone Lands",
  "Malpais": "Drone Lands", "Oasa": "Drone Lands",
  "Outer Passage": "Drone Lands", "Perrigen Falls": "Drone Lands",
  "The Kalevala Expanse": "Drone Lands", "The Spire": "Drone Lands",
  // Pochven
  "Pochven": "Pochven",
};

// Star field background
interface Star {
  x: number;
  y: number;
  brightness: number;
  size: number;
}

function generateStarField(count: number, width: number, height: number): Star[] {
  const stars: Star[] = [];
  let seed = 42;
  const rand = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand() * width,
      y: rand() * height,
      brightness: 0.15 + rand() * 0.35,
      size: 0.3 + rand() * 0.7,
    });
  }
  return stars;
}

export default function UniverseMap({
  systems,
  gates,
  regions,
  constellations,
  route,
  originId,
  destinationId,
  beaconSystemIds,
  jumpRangeOriginId,
  jumpRangeLY,
  onSystemClick,
  highlightedSystemId,
}: UniverseMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Camera: simple pan + zoom (2D top-down)
  const [camera, setCamera] = useState({ panX: 0, panY: 0, zoom: 1 });

  // Interaction state
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [hoveredSystem, setHoveredSystem] = useState<{ id: number; x: number; y: number } | null>(null);

  // Star field
  const starFieldRef = useRef<Star[]>([]);
  const starFieldSizeRef = useRef({ w: 0, h: 0 });

  // Pre-compute flat projected positions: EVE x → screen x, EVE z → screen y
  // Normalize to [-0.5, 0.5] so the map fits nicely
  const { projected, bounds } = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const sys of Object.values(systems)) {
      if (sys.x < minX) minX = sys.x;
      if (sys.x > maxX) maxX = sys.x;
      if (sys.z < minZ) minZ = sys.z;
      if (sys.z > maxZ) maxZ = sys.z;
    }
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const rangeX = maxX - minX || 1;
    const rangeZ = maxZ - minZ || 1;
    const maxRange = Math.max(rangeX, rangeZ);

    const result = new Map<number, [number, number]>();
    for (const [idStr, sys] of Object.entries(systems)) {
      const nx = (sys.x - cx) / maxRange;
      const nz = (sys.z - cz) / maxRange;
      result.set(parseInt(idStr), [nx, nz]);
    }

    // Compute projected bounds
    let pMinX = Infinity, pMaxX = -Infinity, pMinY = Infinity, pMaxY = -Infinity;
    result.forEach(([px, py]) => {
      if (px < pMinX) pMinX = px;
      if (px > pMaxX) pMaxX = px;
      if (py < pMinY) pMinY = py;
      if (py > pMaxY) pMaxY = py;
    });

    return {
      projected: result,
      bounds: { minX: pMinX, maxX: pMaxX, minY: pMinY, maxY: pMaxY, maxRange },
    };
  }, [systems]);

  // Region centers
  const regionCenters = useMemo(() => {
    const accum = new Map<number, { sx: number; sy: number; count: number }>();
    for (const [idStr, sys] of Object.entries(systems)) {
      const pos = projected.get(parseInt(idStr));
      if (!pos) continue;
      const entry = accum.get(sys.regId);
      if (entry) {
        entry.sx += pos[0];
        entry.sy += pos[1];
        entry.count++;
      } else {
        accum.set(sys.regId, { sx: pos[0], sy: pos[1], count: 1 });
      }
    }
    const centers = new Map<number, { sx: number; sy: number; name: string }>();
    accum.forEach(({ sx, sy, count }, regId) => {
      const name = regions[regId.toString()];
      if (name) centers.set(regId, { sx: sx / count, sy: sy / count, name });
    });
    return centers;
  }, [systems, projected, regions]);

  // Super-region centers
  const superRegionCenters = useMemo(() => {
    const accum = new Map<string, { sx: number; sy: number; count: number }>();
    regionCenters.forEach(({ sx, sy, name: regName }) => {
      const superName = SUPER_REGION_MAP[regName];
      if (!superName) return;
      const entry = accum.get(superName);
      if (entry) {
        entry.sx += sx;
        entry.sy += sy;
        entry.count++;
      } else {
        accum.set(superName, { sx, sy, count: 1 });
      }
    });
    const centers: Array<{ sx: number; sy: number; name: string }> = [];
    accum.forEach(({ sx, sy, count }, name) => {
      centers.push({ sx: sx / count, sy: sy / count, name });
    });
    return centers;
  }, [regionCenters]);

  // Gate index for fast rendering
  const gateIndex = useMemo(() => {
    const idx = new Map<number, number[]>();
    for (const [a, b] of gates) {
      let listA = idx.get(a);
      if (!listA) { listA = []; idx.set(a, listA); }
      listA.push(b);
    }
    return idx;
  }, [gates]);

  // Initial fit
  const initialFitDone = useRef(false);
  useEffect(() => {
    if (initialFitDone.current) return;
    const canvas = canvasRef.current;
    if (!canvas || projected.size === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.width / dpr;
    const displayH = canvas.height / dpr;
    const { minX, maxX, minY, maxY } = bounds;
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const fitZoom = Math.min(displayW / rangeX, displayH / rangeY) * 0.85;

    setCamera({
      zoom: fitZoom,
      panX: displayW / 2 - ((minX + maxX) / 2) * fitZoom,
      panY: displayH / 2 - ((minY + maxY) / 2) * fitZoom,
    });
    initialFitDone.current = true;
  }, [projected, bounds]);

  // Resize canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = container.clientWidth * dpr;
      canvas.height = container.clientHeight * dpr;
      canvas.style.width = container.clientWidth + "px";
      canvas.style.height = container.clientHeight + "px";
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    return () => observer.disconnect();
  }, []);

  // === RENDER ===
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.width / dpr;
    const displayH = canvas.height / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, displayW, displayH);

    // Background
    ctx.fillStyle = "#06060c";
    ctx.fillRect(0, 0, displayW, displayH);

    // Star field
    if (starFieldSizeRef.current.w !== displayW || starFieldSizeRef.current.h !== displayH) {
      starFieldRef.current = generateStarField(300, displayW, displayH);
      starFieldSizeRef.current = { w: displayW, h: displayH };
    }
    for (const star of starFieldRef.current) {
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180, 200, 240, ${star.brightness})`;
      ctx.fill();
    }

    const { panX, panY, zoom } = camera;

    const toScreen = (wx: number, wy: number): [number, number] => [wx * zoom + panX, wy * zoom + panY];

    const baseSize = Math.max(0.6, Math.min(3.5, zoom * 0.8));
    const zoomLevel = zoom < 200 ? 0 : zoom < 1200 ? 1 : 2;

    // === GATE LINES ===
    const gateOpacity = zoomLevel === 0 ? 0.04 : zoomLevel === 1 ? 0.2 : 0.45;
    if (gateOpacity > 0.01) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(70, 90, 130, ${gateOpacity})`;
      ctx.lineWidth = zoomLevel >= 2 ? 0.8 : 0.5;

      gateIndex.forEach((neighbors, fromId) => {
        const fromPos = projected.get(fromId);
        if (!fromPos) return;
        const [fsx, fsy] = toScreen(fromPos[0], fromPos[1]);
        if (fsx < -200 || fsx > displayW + 200 || fsy < -200 || fsy > displayH + 200) return;

        for (const toId of neighbors) {
          if (toId < fromId) continue;
          const toPos = projected.get(toId);
          if (!toPos) continue;
          const [tsx, tsy] = toScreen(toPos[0], toPos[1]);
          if (tsx < -200 || tsx > displayW + 200 || tsy < -200 || tsy > displayH + 200) {
            if (fsx < -200 || fsx > displayW + 200 || fsy < -200 || fsy > displayH + 200) continue;
          }
          ctx.moveTo(fsx, fsy);
          ctx.lineTo(tsx, tsy);
        }
      });
      ctx.stroke();
    }

    // === JUMP RANGE CIRCLE ===
    if (jumpRangeOriginId && jumpRangeLY > 0) {
      const originPos = projected.get(jumpRangeOriginId);
      if (originPos) {
        const [sx, sy] = toScreen(originPos[0], originPos[1]);
        const radiusNorm = (jumpRangeLY * METERS_PER_LY) / bounds.maxRange;
        const radiusPixels = radiusNorm * zoom;
        ctx.beginPath();
        ctx.arc(sx, sy, radiusPixels, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(59, 130, 246, 0.06)";
        ctx.fill();
        ctx.strokeStyle = "rgba(59, 130, 246, 0.25)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Route system IDs
    const routeSystemIds = new Set<number>();
    if (route) {
      for (const hop of route) routeSystemIds.add(hop.systemId);
    }

    // === SYSTEM DOTS ===
    projected.forEach(([px, py], id) => {
      const [sx, sy] = toScreen(px, py);
      if (sx < -10 || sx > displayW + 10 || sy < -10 || sy > displayH + 10) return;

      const sys = systems[id.toString()];
      if (!sys) return;

      let size = baseSize;
      let color = securityColor(sys.sec);

      if (id === originId) {
        color = "#22c55e";
        size = baseSize * 3;
      } else if (id === destinationId) {
        color = "#ef4444";
        size = baseSize * 3;
      } else if (beaconSystemIds.has(id)) {
        color = "#a855f7";
        size = baseSize * 2;
      } else if (routeSystemIds.has(id)) {
        size = baseSize * 2;
      } else if (id === highlightedSystemId) {
        color = "#ffffff";
        size = baseSize * 3;
      }

      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });

    // === ZOOM-TIERED LABELS ===
    const drawLabel = (text: string, x: number, y: number, alpha: number) => {
      ctx.globalAlpha = alpha * 0.85;
      ctx.fillStyle = "#000000";
      ctx.fillText(text, x - 1, y);
      ctx.fillText(text, x + 1, y);
      ctx.fillText(text, x, y - 1);
      ctx.fillText(text, x, y + 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#d8dff0";
      ctx.fillText(text, x, y);
      ctx.globalAlpha = 1;
    };

    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    // Tier 1: Super-region names (galaxy scale)
    if (zoomLevel === 0) {
      ctx.font = `700 13px Inter, system-ui, sans-serif`;
      for (const sr of superRegionCenters) {
        const [sx, sy] = toScreen(sr.sx, sr.sy);
        if (sx < -100 || sx > displayW + 100 || sy < -20 || sy > displayH + 20) continue;
        drawLabel(sr.name, sx, sy, 0.7);
      }
    }

    // Tier 2: Region names (mid-zoom)
    if (zoomLevel === 1) {
      ctx.font = `600 11px Inter, system-ui, sans-serif`;
      regionCenters.forEach(({ sx: rsx, sy: rsy, name }) => {
        const [sx, sy] = toScreen(rsx, rsy);
        if (sx < -80 || sx > displayW + 80 || sy < -20 || sy > displayH + 20) return;
        drawLabel(name, sx, sy, 0.55);
      });
    }

    // Tier 3: System names (zoomed in)
    if (zoomLevel >= 2) {
      ctx.font = `600 10px Inter, system-ui, sans-serif`;
      ctx.textAlign = "left";
      projected.forEach(([px, py], id) => {
        const [sx, sy] = toScreen(px, py);
        if (sx < -50 || sx > displayW + 50 || sy < -15 || sy > displayH + 15) return;
        const sys = systems[id.toString()];
        if (!sys) return;
        drawLabel(sys.name, sx + baseSize + 4, sy, 0.8);
      });
    }

    ctx.textAlign = "start";

    // === ROUTE LINES (with glow) ===
    if (route && route.length > 1) {
      for (let i = 1; i < route.length; i++) {
        const prevPos = projected.get(route[i - 1].systemId);
        const currPos = projected.get(route[i].systemId);
        if (!prevPos || !currPos) continue;

        const [sx1, sy1] = toScreen(prevPos[0], prevPos[1]);
        const [sx2, sy2] = toScreen(currPos[0], currPos[1]);
        const isJump = route[i].segmentType === "jump";

        // Glow
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.strokeStyle = isJump ? "rgba(249, 115, 22, 0.15)" : "rgba(234, 179, 8, 0.12)";
        ctx.lineWidth = isJump ? 8 : 6;
        ctx.setLineDash([]);
        ctx.stroke();

        // Crisp line
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        if (isJump) {
          ctx.strokeStyle = "rgba(249, 115, 22, 0.9)";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 3]);
        } else {
          ctx.strokeStyle = "rgba(234, 179, 8, 0.7)";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Origin/destination markers
      for (const id of [originId, destinationId]) {
        if (!id) continue;
        const pos = projected.get(id);
        if (!pos) continue;
        const [sx, sy] = toScreen(pos[0], pos[1]);

        ctx.beginPath();
        ctx.arc(sx, sy, baseSize * 5, 0, Math.PI * 2);
        ctx.fillStyle = id === originId ? "rgba(34, 197, 94, 0.08)" : "rgba(239, 68, 68, 0.08)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sx, sy, baseSize * 3.5, 0, Math.PI * 2);
        ctx.strokeStyle = id === originId ? "#22c55e" : "#ef4444";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // === TOOLTIP ===
    const labelSystem = hoveredSystem || (highlightedSystemId ? { id: highlightedSystemId, x: 0, y: 0 } : null);
    if (labelSystem) {
      const sys = systems[labelSystem.id.toString()];
      const pos = projected.get(labelSystem.id);
      if (sys && pos) {
        const [sx, sy] = toScreen(pos[0], pos[1]);
        const con = constellations[sys.conId.toString()];
        const regionName = regions[sys.regId.toString()] || "";
        const conName = con?.name || "";

        ctx.font = "bold 11px Inter, system-ui, sans-serif";
        ctx.textAlign = "start";
        const nameWidth = ctx.measureText(sys.name).width;
        ctx.font = "10px Inter, system-ui, sans-serif";
        const detailText = `${conName} / ${regionName}`;
        const detailWidth = ctx.measureText(detailText).width;
        const secText = formatSecurity(sys.sec);
        const secWidth = ctx.measureText(secText).width;

        const padding = 8;
        const lineHeight = 16;
        const boxW = Math.max(nameWidth + secWidth + 20, detailWidth) + padding * 2;
        const boxH = lineHeight * 2 + padding * 2;

        let ttX = sx + 14;
        let ttY = sy - boxH / 2;
        if (ttX + boxW > displayW - 10) ttX = sx - boxW - 14;
        if (ttY < 10) ttY = 10;
        if (ttY + boxH > displayH - 10) ttY = displayH - boxH - 10;

        // Rounded rect background
        const r = 4;
        ctx.beginPath();
        ctx.moveTo(ttX + r, ttY);
        ctx.lineTo(ttX + boxW - r, ttY);
        ctx.arcTo(ttX + boxW, ttY, ttX + boxW, ttY + r, r);
        ctx.lineTo(ttX + boxW, ttY + boxH - r);
        ctx.arcTo(ttX + boxW, ttY + boxH, ttX + boxW - r, ttY + boxH, r);
        ctx.lineTo(ttX + r, ttY + boxH);
        ctx.arcTo(ttX, ttY + boxH, ttX, ttY + boxH - r, r);
        ctx.lineTo(ttX, ttY + r);
        ctx.arcTo(ttX, ttY, ttX + r, ttY, r);
        ctx.closePath();
        ctx.fillStyle = "rgba(10, 12, 20, 0.92)";
        ctx.fill();
        ctx.strokeStyle = "rgba(100, 120, 160, 0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();

        const dotX = ttX + padding + 4;
        const dotY = ttY + padding + 6;

        ctx.beginPath();
        ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
        ctx.fillStyle = securityColor(sys.sec);
        ctx.fill();

        ctx.font = "bold 11px Inter, system-ui, sans-serif";
        ctx.fillStyle = "#e0e4ef";
        ctx.textBaseline = "middle";
        ctx.fillText(sys.name, dotX + 8, dotY);

        ctx.font = "10px Inter, system-ui, sans-serif";
        ctx.fillStyle = securityColor(sys.sec);
        ctx.fillText(secText, dotX + 8 + nameWidth + 6, dotY);

        ctx.fillStyle = "rgba(160, 170, 200, 0.7)";
        ctx.fillText(detailText, ttX + padding, dotY + lineHeight);
      }
    }
  }, [camera, systems, regions, constellations, gates, gateIndex, projected, bounds, regionCenters, superRegionCenters, route, originId, destinationId, beaconSystemIds, jumpRangeOriginId, jumpRangeLY, hoveredSystem, highlightedSystemId]);

  // Animation frame
  useEffect(() => {
    let frame: number;
    const loop = () => { render(); frame = requestAnimationFrame(loop); };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [render]);

  // === MOUSE HANDLERS ===
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: camera.panX, panY: camera.panY };
  }, [camera]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (isDragging) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setCamera((c) => ({
        ...c,
        panX: dragStart.current.panX + dx,
        panY: dragStart.current.panY + dy,
      }));
      return;
    }

    // Hover detection
    let bestId: number | null = null;
    let bestDist = Infinity;
    const threshold = 12;

    projected.forEach(([px, py], id) => {
      const screenX = px * camera.zoom + camera.panX;
      const screenY = py * camera.zoom + camera.panY;
      const dx = screenX - mx;
      const dy = screenY - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < threshold && dist < bestDist) {
        bestDist = dist;
        bestId = id;
      }
    });

    if (bestId !== null) {
      setHoveredSystem({ id: bestId, x: mx, y: my });
      canvas.style.cursor = "pointer";
    } else {
      setHoveredSystem(null);
      canvas.style.cursor = isDragging ? "grabbing" : "grab";
    }
  }, [isDragging, camera, projected]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
    setHoveredSystem(null);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const dx = Math.abs(e.clientX - dragStart.current.x);
    const dy = Math.abs(e.clientY - dragStart.current.y);
    if (dx > 5 || dy > 5) return;
    if (hoveredSystem) onSystemClick(hoveredSystem.id);
  }, [hoveredSystem, onSystemClick]);

  const handleDoubleClick = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.width / dpr;
    const displayH = canvas.height / dpr;
    const { minX, maxX, minY, maxY } = bounds;
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const fitZoom = Math.min(displayW / rangeX, displayH / rangeY) * 0.85;

    setCamera({
      zoom: fitZoom,
      panX: displayW / 2 - ((minX + maxX) / 2) * fitZoom,
      panY: displayH / 2 - ((minY + maxY) / 2) * fitZoom,
    });
  }, [bounds]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newZoom = camera.zoom * factor;

    setCamera((c) => ({
      ...c,
      zoom: newZoom,
      panX: mx - (mx - c.panX) * factor,
      panY: my - (my - c.panY) * factor,
    }));
  }, [camera]);

  // Center on system when origin/destination set
  useEffect(() => {
    if (!originId && !destinationId) return;
    if (route && route.length > 1) return;
    const targetId = originId || destinationId;
    if (!targetId) return;
    const pos = projected.get(targetId);
    if (!pos) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.width / dpr;
    const displayH = canvas.height / dpr;

    setCamera((c) => ({
      ...c,
      panX: displayW / 2 - pos[0] * c.zoom,
      panY: displayH / 2 - pos[1] * c.zoom,
    }));
  }, [originId, destinationId]);

  // Fit route in view
  useEffect(() => {
    if (!route || route.length < 2) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.width / dpr;
    const displayH = canvas.height / dpr;

    let rMinX = Infinity, rMaxX = -Infinity, rMinY = Infinity, rMaxY = -Infinity;
    for (const hop of route) {
      const pos = projected.get(hop.systemId);
      if (!pos) continue;
      if (pos[0] < rMinX) rMinX = pos[0];
      if (pos[0] > rMaxX) rMaxX = pos[0];
      if (pos[1] < rMinY) rMinY = pos[1];
      if (pos[1] > rMaxY) rMaxY = pos[1];
    }
    if (rMinX === Infinity) return;

    const padding = 0.15;
    const rangeX = (rMaxX - rMinX) || 0.001;
    const rangeY = (rMaxY - rMinY) || 0.001;
    const fitZoom = Math.min(
      displayW * (1 - padding * 2) / rangeX,
      displayH * (1 - padding * 2) / rangeY,
    );

    setCamera((c) => ({
      ...c,
      zoom: fitZoom,
      panX: displayW / 2 - ((rMinX + rMaxX) / 2) * fitZoom,
      panY: displayH / 2 - ((rMinY + rMaxY) / 2) * fitZoom,
    }));
  }, [route]);

  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#06060c] rounded-md overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      />

      {/* Legend */}
      <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-sm rounded-md px-2.5 py-2 text-[10px] flex flex-col gap-1.5 pointer-events-none border border-white/5">
        <div className="flex gap-3 items-center">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" /> Highsec
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-yellow-500" /> Lowsec
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-600" /> Nullsec
          </span>
        </div>
        <div className="flex gap-3 items-center text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-[1px] bg-[rgb(70,90,130)]" /> Gates
          </span>
          {route && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-yellow-500" /> Gate route
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-orange-500 border-dashed" style={{ borderTop: "1px dashed" }} /> Jump
              </span>
            </>
          )}
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-md px-2.5 py-1.5 text-[10px] text-muted-foreground pointer-events-none border border-white/5">
        Drag to pan | Scroll to zoom | Double-click to reset
      </div>

      {/* Zoom control */}
      <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm rounded-md border border-white/5 flex flex-col items-center select-none" style={{ width: 36 }}>
        <button
          className="w-full h-7 flex items-center justify-center text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-t-md transition-colors"
          onClick={() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const dpr = window.devicePixelRatio || 1;
            const cx = (canvas.width / dpr) / 2;
            const cy = (canvas.height / dpr) / 2;
            const factor = 1.4;
            setCamera((c) => ({
              ...c,
              zoom: c.zoom * factor,
              panX: cx - (cx - c.panX) * factor,
              panY: cy - (cy - c.panY) * factor,
            }));
          }}
        >
          +
        </button>
        <div className="w-full border-t border-b border-white/5 py-1.5 flex flex-col items-center gap-0.5">
          <span className="text-[9px] font-mono text-white/50">
            {camera.zoom < 200 ? "Galaxy" : camera.zoom < 1200 ? "Region" : "System"}
          </span>
          <div className="w-5 h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-400/60"
              style={{ width: `${Math.min(100, Math.max(5, Math.log(camera.zoom + 1) / Math.log(10000) * 100))}%` }}
            />
          </div>
        </div>
        <button
          className="w-full h-7 flex items-center justify-center text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-b-md transition-colors"
          onClick={() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const dpr = window.devicePixelRatio || 1;
            const cx = (canvas.width / dpr) / 2;
            const cy = (canvas.height / dpr) / 2;
            const factor = 1 / 1.4;
            setCamera((c) => ({
              ...c,
              zoom: c.zoom * factor,
              panX: cx - (cx - c.panX) * factor,
              panY: cy - (cy - c.panY) * factor,
            }));
          }}
        >
          −
        </button>
      </div>
    </div>
  );
}
