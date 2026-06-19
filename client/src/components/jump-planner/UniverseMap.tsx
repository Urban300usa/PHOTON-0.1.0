import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { securityColor, formatSecurity } from "@/lib/jump-planner/distance";
import type { SegmentType } from "@/lib/jump-planner/hybrid-router";

interface DangerSystem { shipKills: number; podKills: number; npcKills: number; jumps: number }
interface DangerData { systems: Record<string, DangerSystem>; updatedAt: string }

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

const METERS_PER_LY = 9.461e15;
const DEFAULT_REGION_ID = 10000002; // The Forge (Jita)

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

  const [selectedRegionId, setSelectedRegionId] = useState<number>(DEFAULT_REGION_ID);
  const [camera, setCamera] = useState({ panX: 0, panY: 0, zoom: 1 });
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hover, setHover] = useState<{ x: number; y: number; sysId: number } | null>(null);
  const [showDanger, setShowDanger] = useState(false);

  // Live kill density per system (public ESI, last hour). Only fetched when enabled.
  const { data: dangerData } = useQuery<DangerData>({
    queryKey: ["/api/map/danger"],
    enabled: showDanger,
    staleTime: 5 * 60 * 1000,
    refetchInterval: showDanger ? 5 * 60 * 1000 : false,
  });

  // Drag state
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; panX: number; panY: number; moved: boolean }>({
    active: false, startX: 0, startY: 0, panX: 0, panY: 0, moved: false,
  });

  // Sorted region list for the dropdown
  const regionOptions = useMemo(
    () => Object.entries(regions)
      .map(([id, name]) => ({ id: Number(id), name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [regions]
  );

  // Auto-follow: when the highlighted / origin / destination system is in another
  // region, switch to it so the user sees the relevant part of the route.
  useEffect(() => {
    const focusId = highlightedSystemId ?? originId ?? destinationId;
    if (focusId == null) return;
    const sys = systems[String(focusId)];
    if (sys && sys.regId !== selectedRegionId) {
      setSelectedRegionId(sys.regId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedSystemId, originId, destinationId]);

  // Systems belonging to the selected region
  const regionSystems = useMemo(() => {
    const out: { id: number; s: SystemData }[] = [];
    for (const id in systems) {
      const s = systems[id];
      if (s.regId === selectedRegionId) out.push({ id: Number(id), s });
    }
    return out;
  }, [systems, selectedRegionId]);

  // Intra-region gate connections (both endpoints in this region)
  const regionGates = useMemo(() => {
    const idSet = new Set(regionSystems.map((r) => r.id));
    return gates.filter(([a, b]) => idSet.has(a) && idSet.has(b));
  }, [gates, regionSystems]);

  // Projection: fit region bounds (x, z plane) into the viewport at zoom = 1.
  const projection = useMemo(() => {
    if (regionSystems.length === 0) {
      return { cx: 0, cz: 0, baseScale: 1 };
    }
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const { s } of regionSystems) {
      if (s.x < minX) minX = s.x;
      if (s.x > maxX) maxX = s.x;
      if (s.z < minZ) minZ = s.z;
      if (s.z > maxZ) maxZ = s.z;
    }
    const spanX = Math.max(maxX - minX, 1);
    const spanZ = Math.max(maxZ - minZ, 1);
    const pad = 0.84;
    const baseScale = Math.min((size.w * pad) / spanX, (size.h * pad) / spanZ);
    return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, baseScale };
  }, [regionSystems, size]);

  // World (EVE x/z) → screen pixels. z is flipped so galactic "north" is up.
  const worldToScreen = useCallback(
    (x: number, z: number) => {
      const sx = size.w / 2 + (x - projection.cx) * projection.baseScale * camera.zoom + camera.panX;
      const sy = size.h / 2 - (z - projection.cz) * projection.baseScale * camera.zoom + camera.panY;
      return { sx, sy };
    },
    [size, projection, camera]
  );

  // Reset camera whenever the region changes (fit-to-region)
  useEffect(() => {
    setCamera({ panX: 0, panY: 0, zoom: 1 });
  }, [selectedRegionId]);

  // Track container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: Math.max(r.width, 100), h: Math.max(r.height, 100) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Lookup maps for route / markers
  const routeIndex = useMemo(() => {
    const m = new Map<number, RouteHop>();
    if (route) route.forEach((h) => m.set(h.systemId, h));
    return m;
  }, [route]);

  const routeGateSet = useMemo(() => {
    const set = new Set<string>();
    if (route) {
      for (let i = 0; i < route.length - 1; i++) {
        const a = route[i].systemId, b = route[i + 1].systemId;
        set.add(a < b ? `${a}:${b}` : `${b}:${a}`);
      }
    }
    return set;
  }, [route]);

  // ---- Render ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.fillStyle = "#0a0e17";
    ctx.fillRect(0, 0, size.w, size.h);

    // Subtle grid
    ctx.strokeStyle = "rgba(80, 120, 180, 0.06)";
    ctx.lineWidth = 1;
    const gridStep = 64;
    for (let gx = (camera.panX % gridStep); gx < size.w; gx += gridStep) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, size.h); ctx.stroke();
    }
    for (let gy = (camera.panY % gridStep); gy < size.h; gy += gridStep) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(size.w, gy); ctx.stroke();
    }

    if (regionSystems.length === 0) {
      ctx.fillStyle = "rgba(200,220,255,0.5)";
      ctx.font = "14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No systems in this region", size.w / 2, size.h / 2);
      return;
    }

    const screenById = new Map<number, { sx: number; sy: number }>();
    for (const { id, s } of regionSystems) {
      screenById.set(id, worldToScreen(s.x, s.z));
    }

    // Jump range circle
    if (jumpRangeOriginId != null && jumpRangeLY > 0) {
      const o = screenById.get(jumpRangeOriginId);
      if (o) {
        const radius = jumpRangeLY * METERS_PER_LY * projection.baseScale * camera.zoom;
        ctx.beginPath();
        ctx.arc(o.sx, o.sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(64, 160, 255, 0.06)";
        ctx.fill();
        ctx.strokeStyle = "rgba(64, 160, 255, 0.35)";
        ctx.setLineDash([6, 5]);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Danger halos (recent ship+pod kills, last hour) — drawn behind gates/nodes
    if (showDanger && dangerData?.systems) {
      for (const { id } of regionSystems) {
        const d = dangerData.systems[String(id)];
        if (!d) continue;
        const pvp = d.shipKills + d.podKills;
        if (pvp <= 0) continue;
        const p = screenById.get(id)!;
        const radius = Math.min(34, 8 + Math.sqrt(pvp) * 5) * Math.max(0.6, Math.min(camera.zoom, 1.6));
        const grad = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, radius);
        grad.addColorStop(0, "rgba(255,40,40,0.55)");
        grad.addColorStop(1, "rgba(255,40,40,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Gate lines
    ctx.lineWidth = 1;
    for (const [a, b] of regionGates) {
      const pa = screenById.get(a), pb = screenById.get(b);
      if (!pa || !pb) continue;
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (routeGateSet.has(key)) continue; // drawn later, on top
      ctx.strokeStyle = "rgba(120, 150, 200, 0.30)";
      ctx.beginPath();
      ctx.moveTo(pa.sx, pa.sy);
      ctx.lineTo(pb.sx, pb.sy);
      ctx.stroke();
    }

    // Route gate lines (glow on top)
    if (routeGateSet.size > 0) {
      for (const [a, b] of regionGates) {
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        if (!routeGateSet.has(key)) continue;
        const pa = screenById.get(a), pb = screenById.get(b);
        if (!pa || !pb) continue;
        ctx.strokeStyle = "rgba(255, 200, 60, 0.9)";
        ctx.lineWidth = 2.5;
        ctx.shadowColor = "rgba(255, 200, 60, 0.8)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(pa.sx, pa.sy);
        ctx.lineTo(pb.sx, pb.sy);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1;
      }
    }

    // System nodes + labels
    const dotR = Math.max(3, Math.min(7, 4 * camera.zoom));
    const showLabels = camera.zoom > 0.55 || regionSystems.length < 200;
    ctx.font = `${Math.max(9, Math.min(13, 10 * camera.zoom))}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    for (const { id, s } of regionSystems) {
      const p = screenById.get(id)!;
      if (p.sx < -40 || p.sx > size.w + 40 || p.sy < -40 || p.sy > size.h + 40) continue;

      const isOrigin = id === originId;
      const isDest = id === destinationId;
      const isBeacon = beaconSystemIds.has(id);
      const isHighlight = id === highlightedSystemId;
      const onRoute = routeIndex.has(id);
      const color = securityColor(s.sec);

      // marker rings
      if (isOrigin || isDest) {
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, dotR + 5, 0, Math.PI * 2);
        ctx.strokeStyle = isOrigin ? "#2ECC40" : "#3498ff";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      if (isHighlight) {
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, dotR + 8, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      if (isBeacon) {
        const d = dotR + 3;
        ctx.beginPath();
        ctx.moveTo(p.sx, p.sy - d); ctx.lineTo(p.sx + d, p.sy);
        ctx.lineTo(p.sx, p.sy + d); ctx.lineTo(p.sx - d, p.sy);
        ctx.closePath();
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // node dot
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, dotR, 0, Math.PI * 2);
      ctx.fillStyle = color;
      if (onRoute) { ctx.shadowColor = "rgba(255,200,60,0.9)"; ctx.shadowBlur = 6; }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // label
      if (showLabels) {
        const label = s.name;
        ctx.fillStyle = onRoute || isOrigin || isDest || isHighlight
          ? "rgba(255,255,255,0.95)"
          : "rgba(200,215,240,0.75)";
        // shadow for readability
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 3;
        ctx.fillText(label, p.sx + dotR + 3, p.sy);
        ctx.shadowBlur = 0;
      }
    }
  }, [regionSystems, regionGates, worldToScreen, size, camera, projection, originId,
      destinationId, beaconSystemIds, highlightedSystemId, routeIndex, routeGateSet,
      jumpRangeOriginId, jumpRangeLY, showDanger, dangerData]);

  // ---- Interaction ----
  const pickSystem = useCallback(
    (px: number, py: number): number | null => {
      let best: number | null = null;
      let bestDist = 14 * 14;
      for (const { id, s } of regionSystems) {
        const { sx, sy } = worldToScreen(s.x, s.z);
        const dx = sx - px, dy = sy - py;
        const d = dx * dx + dy * dy;
        if (d < bestDist) { bestDist = d; best = id; }
      }
      return best;
    },
    [regionSystems, worldToScreen]
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setCamera((cam) => {
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newZoom = Math.max(0.2, Math.min(12, cam.zoom * factor));
      // zoom toward cursor
      const k = newZoom / cam.zoom;
      const panX = mx - (mx - cam.panX) * k;
      const panY = my - (my - cam.panY) * k;
      return { zoom: newZoom, panX, panY };
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = {
      active: true, startX: e.clientX, startY: e.clientY,
      panX: camera.panX, panY: camera.panY, moved: false,
    };
  }, [camera]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const d = dragRef.current;
    if (d.active) {
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
      setCamera((cam) => ({ ...cam, panX: d.panX + dx, panY: d.panY + dy }));
      setHover(null);
      return;
    }
    const sysId = pickSystem(mx, my);
    setHover(sysId != null ? { x: mx, y: my, sysId } : null);
  }, [pickSystem]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const d = dragRef.current;
    d.active = false;
    if (!d.moved) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const sysId = pickSystem(e.clientX - rect.left, e.clientY - rect.top);
      if (sysId != null) onSystemClick(sysId);
    }
  }, [pickSystem, onSystemClick]);

  const handleDoubleClick = useCallback(() => {
    setCamera({ panX: 0, panY: 0, zoom: 1 });
  }, []);

  const hoverSys = hover ? systems[String(hover.sysId)] : null;

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-[#0a0e17]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { dragRef.current.active = false; setHover(null); }}
        onDoubleClick={handleDoubleClick}
      />

      {/* Region selector */}
      <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
        <select
          value={selectedRegionId}
          onChange={(e) => setSelectedRegionId(Number(e.target.value))}
          className="bg-[#121826]/90 border border-blue-900/60 text-blue-100 text-sm rounded-md px-2 py-1.5 outline-none focus:border-blue-500 backdrop-blur"
          data-testid="select-region"
        >
          {regionOptions.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <span className="text-xs text-blue-300/60">{regionSystems.length} systems</span>
        <button
          onClick={() => setShowDanger((v) => !v)}
          className={`text-xs rounded-md px-2 py-1.5 border backdrop-blur transition-colors ${
            showDanger
              ? "bg-red-600/30 border-red-500/70 text-red-200"
              : "bg-[#121826]/90 border-blue-900/60 text-blue-200/80 hover:border-red-500/50"
          }`}
          data-testid="toggle-danger"
          title="Highlight systems with recent ship/pod kills (last hour)"
        >
          {showDanger ? "● Danger ON" : "○ Danger"}
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3 text-[11px] text-blue-200/70 bg-[#121826]/80 rounded px-2 py-1 backdrop-blur z-10">
        <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full inline-block" style={{ background: "#2ECC40" }} />High</span>
        <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full inline-block" style={{ background: "#D4A017" }} />Low</span>
        <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full inline-block" style={{ background: "#CC0000" }} />Null</span>
        <span className="text-blue-300/40">scroll = zoom · drag = pan · dbl-click = reset</span>
      </div>

      {/* Hover tooltip */}
      {hover && hoverSys && (
        <div
          className="absolute pointer-events-none z-20 bg-[#0d1220] border border-blue-800/70 rounded px-2 py-1 text-xs shadow-lg"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <div className="font-semibold text-white">{hoverSys.name}</div>
          <div className="text-blue-300/80">
            Security <span style={{ color: securityColor(hoverSys.sec) }}>{formatSecurity(hoverSys.sec)}</span>
          </div>
          <div className="text-blue-300/50">{constellations[String(hoverSys.conId)]?.name ?? ""}</div>
          {showDanger && dangerData?.systems?.[String(hover.sysId)] && (
            <div className="text-red-300/90 mt-0.5">
              {dangerData.systems[String(hover.sysId)].shipKills + dangerData.systems[String(hover.sysId)].podKills} kills / hr
              <span className="text-blue-300/40"> · {dangerData.systems[String(hover.sysId)].jumps} jumps</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
