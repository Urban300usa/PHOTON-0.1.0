import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Navigation2,
  Zap,
  Fuel,
  ChevronDown,
  ChevronRight,
  Save,
  Clipboard,
  Trash2,
  RotateCcw,
  Loader2,
  ArrowRightLeft,
  Bookmark,
  Signal,
  Settings2,
  Info,
} from "lucide-react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

import SystemSearch from "@/components/jump-planner/SystemSearch";
import UniverseMap from "@/components/jump-planner/UniverseMap";
import RouteTable from "@/components/jump-planner/RouteTable";
import SavedRoutes from "@/components/jump-planner/SavedRoutes";
import BeaconManager from "@/components/jump-planner/BeaconManager";
import FuelCheck from "@/components/jump-planner/FuelCheck";

import { buildGateGraph, findGateRoute, type GatePreference } from "@/lib/jump-planner/gate-router";
import { findJumpRoute } from "@/lib/jump-planner/jump-router";
import { findHybridRoute } from "@/lib/jump-planner/hybrid-router";
import { calculateFatigue, type FatigueHop } from "@/lib/jump-planner/fatigue";
import { jumpRange, fuelPerJump, lightYearDistance, formatNumber } from "@/lib/jump-planner/distance";
import { JUMP_SHIPS, JUMP_SHIP_CLASSES, SHIP_CLASS_GROUPS, type JumpShipDefinition } from "@/data/jump-drive-data";

type RouteMode = "jump" | "gate" | "hybrid";

interface RouteHop {
  systemId: number;
  segmentType: "origin" | "gate" | "jump";
  distanceLY: number;
}

interface UniverseData {
  systems: Record<string, { name: string; x: number; y: number; z: number; sec: number; conId: number; regId: number }>;
  gates: [number, number][];
  regions: Record<string, string>;
  constellations: Record<string, { name: string; regId: number }>;
}

export default function JumpPlannerPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Universe data (lazy loaded)
  const [universeData, setUniverseData] = useState<UniverseData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Route planning state
  const [origin, setOrigin] = useState<{ id: number; name: string } | null>(null);
  const [destination, setDestination] = useState<{ id: number; name: string } | null>(null);
  const [selectedShip, setSelectedShip] = useState<JumpShipDefinition | null>(null);
  const [routeMode, setRouteMode] = useState<RouteMode>("jump");
  const [jdcLevel, setJdcLevel] = useState(5);
  const [jfcLevel, setJfcLevel] = useState(5);
  const [jfLevel, setJfLevel] = useState(0);
  const [preferStations, setPreferStations] = useState(true);
  const [gatePreference, setGatePreference] = useState<GatePreference>("shortest");

  // Route results
  const [routeHops, setRouteHops] = useState<RouteHop[]>([]);
  const [fatigueHops, setFatigueHops] = useState<FatigueHop[]>([]);
  const [totalFuel, setTotalFuel] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);

  // Map interaction
  const [mapClickMode, setMapClickMode] = useState<"origin" | "destination" | null>(null);
  const [highlightedSystem, setHighlightedSystem] = useState<number | null>(null);

  // Beacon network
  const [selectedNetwork, setSelectedNetwork] = useState("Default");

  // Saved route dialog
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveRouteName, setSaveRouteName] = useState("");

  // Collapsible sections
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [beaconsOpen, setBeaconsOpen] = useState(false);
  const [savedRoutesOpen, setSavedRoutesOpen] = useState(false);

  // Inaccessible region IDs (runtime safeguard — data should already be filtered)
  const INACCESSIBLE_REGIONS = useMemo(() => {
    const set = new Set<number>();
    for (let r = 11000001; r <= 11000033; r++) set.add(r); // Wormhole
    for (let r = 12000001; r <= 12000005; r++) set.add(r); // Abyssal
    for (let r = 14000001; r <= 14000005; r++) set.add(r); // Drifter
    set.add(10000004); // Jove
    set.add(19000001); // Test
    return set;
  }, []);

  // Load universe data
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setIsLoadingData(true);
        const raw = await import("@/data/eve-universe.json");
        const data = raw.default as unknown as UniverseData;

        // Runtime filter safeguard: remove any stray inaccessible systems
        const filteredSystems: typeof data.systems = {};
        const removedIds = new Set<number>();
        for (const [idStr, sys] of Object.entries(data.systems)) {
          if (INACCESSIBLE_REGIONS.has(sys.regId)) {
            removedIds.add(parseInt(idStr));
          } else {
            filteredSystems[idStr] = sys;
          }
        }
        const filteredGates = removedIds.size > 0
          ? data.gates.filter(([a, b]) => !removedIds.has(a) && !removedIds.has(b))
          : data.gates;

        if (!cancelled) {
          setUniverseData({
            ...data,
            systems: filteredSystems,
            gates: filteredGates,
          });
          setIsLoadingData(false);
        }
      } catch (err) {
        console.error("Failed to load universe data:", err);
        if (!cancelled) setIsLoadingData(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [INACCESSIBLE_REGIONS]);

  // Pre-build gate graph
  const gateGraph = useMemo(() => {
    if (!universeData) return null;
    return buildGateGraph(universeData.gates);
  }, [universeData]);

  // All systems as array for jump router
  const allSystemsArray = useMemo(() => {
    if (!universeData) return [];
    return Object.entries(universeData.systems).map(([idStr, sys]) => ({
      id: parseInt(idStr),
      ...sys,
    }));
  }, [universeData]);

  // Fetch beacons for map display
  const { data: beaconsData } = useQuery({
    queryKey: ["/api/jump-planner/beacons", selectedNetwork],
    queryFn: async () => {
      const res = await fetch(`/api/jump-planner/beacons?network=${encodeURIComponent(selectedNetwork)}`);
      if (!res.ok) return { beacons: [] };
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const beaconSystemIds = useMemo(() => {
    const ids = new Set<number>();
    if (beaconsData?.beacons) {
      for (const b of beaconsData.beacons) {
        ids.add(b.systemId);
      }
    }
    return ids;
  }, [beaconsData]);

  // Auto-detect skills
  const skillsAutoDetect = useCallback(async () => {
    try {
      const res = await fetch("/api/jump-planner/character-skills");
      if (!res.ok) {
        toast({ title: "Skill auto-detect", description: "Could not fetch skills. Sync skills from the Skills page first.", variant: "destructive" });
        return;
      }
      const data = await res.json();
      setJdcLevel(data.jdc);
      setJfcLevel(data.jfc);
      setJfLevel(data.jf);
      toast({ title: "Skills detected", description: `JDC ${data.jdc} | JFC ${data.jfc} | JF ${data.jf} for ${data.characterName}` });
    } catch {
      toast({ title: "Error", description: "Failed to detect skills", variant: "destructive" });
    }
  }, [toast]);

  // Get current ship class info
  const shipClass = selectedShip
    ? JUMP_SHIP_CLASSES[selectedShip.className]
    : null;

  // Max jump range for display
  const maxRange = shipClass
    ? jumpRange(shipClass.baseRange, jdcLevel)
    : 0;

  // Calculate route
  const calculateRoute = useCallback(() => {
    if (!universeData || !gateGraph || !origin || !destination) return;

    setIsCalculating(true);

    // Use setTimeout to not block UI
    setTimeout(() => {
      try {
        const systemLookup = (id: number) => {
          const sys = universeData.systems[id.toString()];
          if (!sys) return undefined;
          return { ...sys, id };
        };

        let hops: RouteHop[] = [];

        if (routeMode === "gate") {
          const result = findGateRoute(origin.id, destination.id, gateGraph, systemLookup as any, {
            preference: gatePreference,
          });
          if (result.found) {
            hops = result.systemIds.map((id, i) => ({
              systemId: id,
              segmentType: i === 0 ? "origin" as const : "gate" as const,
              distanceLY: 0,
            }));
          } else {
            toast({ title: "No route found", description: "Could not find a gate route between these systems.", variant: "destructive" });
          }
        } else if (routeMode === "jump" && shipClass && selectedShip) {
          const result = findJumpRoute(origin.id, destination.id, allSystemsArray, {
            baseRange: shipClass.baseRange,
            jdcLevel,
            preferStations,
            beaconSystems: beaconSystemIds,
          });
          if (result.found) {
            hops = result.hops.map((h, i) => ({
              systemId: h.systemId,
              segmentType: i === 0 ? "origin" as const : "jump" as const,
              distanceLY: h.distanceLY,
            }));
          } else {
            toast({ title: "No route found", description: "Could not find a jump route. The destination may be unreachable with current jump range.", variant: "destructive" });
          }
        } else if (routeMode === "hybrid" && shipClass && selectedShip) {
          const result = findHybridRoute(
            origin.id,
            destination.id,
            allSystemsArray,
            gateGraph,
            systemLookup as any,
            {
              baseRange: shipClass.baseRange,
              jdcLevel,
              preferStations,
              gatePreference,
              beaconSystems: beaconSystemIds,
            },
          );
          if (result.found) {
            hops = result.hops;
          } else {
            toast({ title: "No route found", description: "Could not find a hybrid route between these systems.", variant: "destructive" });
          }
        }

        setRouteHops(hops);

        // Calculate fatigue for jump hops
        if (hops.length > 0) {
          const fatigueResult = calculateFatigue(
            hops.map((h) => ({ systemId: h.systemId, distanceLY: h.distanceLY })),
            (i) => hops[i].segmentType === "jump",
          );
          setFatigueHops(fatigueResult.hops);

          // Calculate total fuel
          if (shipClass && selectedShip) {
            let fuel = 0;
            for (const hop of hops) {
              if (hop.segmentType === "jump" && hop.distanceLY > 0) {
                fuel += fuelPerJump(
                  shipClass.baseFuelPerLY,
                  hop.distanceLY,
                  jfcLevel,
                  shipClass.isJumpFreighter ? jfLevel : 0,
                );
              }
            }
            setTotalFuel(fuel);
          } else {
            setTotalFuel(0);
          }
        } else {
          setFatigueHops([]);
          setTotalFuel(0);
        }
      } catch (err) {
        console.error("Route calculation error:", err);
        toast({ title: "Error", description: "Route calculation failed", variant: "destructive" });
      } finally {
        setIsCalculating(false);
      }
    }, 10);
  }, [universeData, gateGraph, origin, destination, routeMode, shipClass, selectedShip, jdcLevel, jfcLevel, jfLevel, preferStations, gatePreference, beaconSystemIds, allSystemsArray, toast]);

  // Map system click handler
  const handleMapSystemClick = useCallback((systemId: number) => {
    if (!universeData) return;
    const sys = universeData.systems[systemId.toString()];
    if (!sys) return;

    if (mapClickMode === "origin") {
      setOrigin({ id: systemId, name: sys.name });
      setMapClickMode(null);
    } else if (mapClickMode === "destination") {
      setDestination({ id: systemId, name: sys.name });
      setMapClickMode(null);
    } else {
      // Default: set as origin if no origin, else destination
      if (!origin) {
        setOrigin({ id: systemId, name: sys.name });
      } else if (!destination) {
        setDestination({ id: systemId, name: sys.name });
      }
    }
  }, [universeData, mapClickMode, origin, destination]);

  // Swap origin and destination
  const swapEndpoints = useCallback(() => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  }, [origin, destination]);

  // Clear route
  const clearRoute = useCallback(() => {
    setRouteHops([]);
    setFatigueHops([]);
    setTotalFuel(0);
    setOrigin(null);
    setDestination(null);
  }, []);

  // Save route
  const saveRouteMutation = useMutation({
    mutationFn: async () => {
      if (!origin || !destination || routeHops.length === 0) return;
      const res = await fetch("/api/jump-planner/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saveRouteName || `${origin.name} → ${destination.name}`,
          originSystemId: origin.id,
          originSystemName: origin.name,
          destinationSystemId: destination.id,
          destinationSystemName: destination.name,
          shipTypeId: selectedShip?.typeId ?? null,
          shipName: selectedShip?.name ?? null,
          routeDataJson: routeHops,
          skillConfig: { jdc: jdcLevel, jfc: jfcLevel, jf: jfLevel },
          totalFuel,
          totalJumps: routeHops.filter((h) => h.segmentType === "jump").length,
          totalGates: routeHops.filter((h) => h.segmentType === "gate").length,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jump-planner/routes"] });
      setSaveDialogOpen(false);
      setSaveRouteName("");
      toast({ title: "Route saved", description: "Your route has been saved." });
    },
  });

  // Load saved route
  const handleLoadRoute = useCallback((route: any) => {
    setOrigin({ id: route.originSystemId, name: route.originSystemName });
    setDestination({ id: route.destinationSystemId, name: route.destinationSystemName });
    if (route.skillConfig) {
      setJdcLevel(route.skillConfig.jdc ?? 5);
      setJfcLevel(route.skillConfig.jfc ?? 5);
      setJfLevel(route.skillConfig.jf ?? 0);
    }
    if (route.shipTypeId) {
      const ship = JUMP_SHIPS.find((s) => s.typeId === route.shipTypeId);
      if (ship) setSelectedShip(ship);
    }
    if (route.routeDataJson && Array.isArray(route.routeDataJson)) {
      setRouteHops(route.routeDataJson);
      // Recalculate fatigue
      const fatigueResult = calculateFatigue(
        route.routeDataJson.map((h: RouteHop) => ({ systemId: h.systemId, distanceLY: h.distanceLY })),
        (i: number) => route.routeDataJson[i].segmentType === "jump",
      );
      setFatigueHops(fatigueResult.hops);
      setTotalFuel(route.totalFuel || 0);
    }
    toast({ title: "Route loaded", description: route.name });
  }, [toast]);

  // Copy route to clipboard
  const copyRouteToClipboard = useCallback(() => {
    if (!universeData || routeHops.length === 0) return;
    const lines = routeHops.map((hop, i) => {
      const sys = universeData.systems[hop.systemId.toString()];
      return `${i}. ${sys?.name ?? hop.systemId} [${hop.segmentType}]${hop.distanceLY > 0 ? ` ${hop.distanceLY.toFixed(2)} LY` : ""}`;
    });
    navigator.clipboard.writeText(lines.join("\n"));
    toast({ title: "Copied", description: "Route copied to clipboard" });
  }, [routeHops, universeData, toast]);

  // Route stats
  const routeStats = useMemo(() => {
    const jumps = routeHops.filter((h) => h.segmentType === "jump").length;
    const gates = routeHops.filter((h) => h.segmentType === "gate").length;
    const totalLY = routeHops.reduce((sum, h) => sum + h.distanceLY, 0);
    const tripTime = fatigueHops.length > 0
      ? fatigueHops[fatigueHops.length - 1]?.cumulativeTime ?? 0
      : 0;
    return { jumps, gates, totalLY, tripTime };
  }, [routeHops, fatigueHops]);

  if (isLoadingData) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Navigation2 className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">Jump Planner</h1>
        </div>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin mr-3" />
          <span className="text-muted-foreground">Loading EVE universe data...</span>
        </div>
      </div>
    );
  }

  if (!universeData) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Navigation2 className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">Jump Planner</h1>
        </div>
        <div className="text-center py-24 text-muted-foreground">
          Failed to load universe data. Please refresh the page.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Navigation2 className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-bold">Jump Planner</h1>
        <Badge variant="outline" className="text-[10px]">
          {Object.keys(universeData.systems).length.toLocaleString()} systems
        </Badge>
        {maxRange > 0 && (
          <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-500/30">
            Range: {maxRange.toFixed(1)} LY
          </Badge>
        )}
      </div>

      {/* Main content */}
      <ResizablePanelGroup direction="vertical" className="flex-1">
        {/* Top: Controls + Map */}
        <ResizablePanel defaultSize={55} minSize={30}>
          <ResizablePanelGroup direction="horizontal">
            {/* Controls Panel */}
            <ResizablePanel defaultSize={28} minSize={20} maxSize={40}>
              <div className="h-full overflow-auto p-3 space-y-3 border-r">
                {/* Origin / Destination */}
                <div className="space-y-2">
                  <SystemSearch
                    systems={universeData.systems}
                    regions={universeData.regions}
                    value={origin}
                    onSelect={(id, name) => setOrigin({ id, name })}
                    placeholder="Origin system..."
                    label="Origin"
                  />
                  <div className="flex justify-center">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={swapEndpoints}>
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <SystemSearch
                    systems={universeData.systems}
                    regions={universeData.regions}
                    value={destination}
                    onSelect={(id, name) => setDestination({ id, name })}
                    placeholder="Destination system..."
                    label="Destination"
                  />
                </div>

                <Separator />

                {/* Route Mode */}
                <div>
                  <Label className="text-xs">Route Mode</Label>
                  <Tabs value={routeMode} onValueChange={(v) => setRouteMode(v as RouteMode)} className="mt-1">
                    <TabsList className="h-7 w-full">
                      <TabsTrigger value="jump" className="text-xs flex-1 h-5">Jump</TabsTrigger>
                      <TabsTrigger value="gate" className="text-xs flex-1 h-5">Gate</TabsTrigger>
                      <TabsTrigger value="hybrid" className="text-xs flex-1 h-5">Hybrid</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {/* Ship Selection (for jump/hybrid modes) */}
                {routeMode !== "gate" && (
                  <div>
                    <Label className="text-xs">Ship</Label>
                    <Select
                      value={selectedShip?.typeId.toString() || ""}
                      onValueChange={(v) => {
                        const ship = JUMP_SHIPS.find((s) => s.typeId === parseInt(v));
                        setSelectedShip(ship || null);
                        if (ship) {
                          const cls = JUMP_SHIP_CLASSES[ship.className];
                          if (cls.isJumpFreighter && jfLevel === 0) setJfLevel(4);
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs mt-1">
                        <SelectValue placeholder="Select ship..." />
                      </SelectTrigger>
                      <SelectContent>
                        {SHIP_CLASS_GROUPS.map((group) => (
                          <div key={group.label}>
                            <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase">
                              {group.label}
                            </div>
                            {group.ships.map((ship) => (
                              <SelectItem key={ship.typeId} value={ship.typeId.toString()} className="text-xs">
                                {ship.name}
                                <span className="text-muted-foreground ml-1">({ship.fuelTypeName.split(" ")[0]})</span>
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Skills */}
                {routeMode !== "gate" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Skills</Label>
                      <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={skillsAutoDetect}>
                        <Zap className="w-3 h-3 mr-1" />
                        Auto-detect
                      </Button>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-8">JDC</span>
                        <Slider
                          value={[jdcLevel]}
                          onValueChange={([v]) => setJdcLevel(v)}
                          min={0}
                          max={5}
                          step={1}
                          className="flex-1"
                        />
                        <span className="text-xs font-mono w-4 text-right">{jdcLevel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-8">JFC</span>
                        <Slider
                          value={[jfcLevel]}
                          onValueChange={([v]) => setJfcLevel(v)}
                          min={0}
                          max={5}
                          step={1}
                          className="flex-1"
                        />
                        <span className="text-xs font-mono w-4 text-right">{jfcLevel}</span>
                      </div>
                      {shipClass?.isJumpFreighter && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-8">JF</span>
                          <Slider
                            value={[jfLevel]}
                            onValueChange={([v]) => setJfLevel(v)}
                            min={0}
                            max={5}
                            step={1}
                            className="flex-1"
                          />
                          <span className="text-xs font-mono w-4 text-right">{jfLevel}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Gate preference (for gate/hybrid modes) */}
                {(routeMode === "gate" || routeMode === "hybrid") && (
                  <div>
                    <Label className="text-xs">Gate Preference</Label>
                    <Select value={gatePreference} onValueChange={(v) => setGatePreference(v as GatePreference)}>
                      <SelectTrigger className="h-7 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="shortest" className="text-xs">Shortest</SelectItem>
                        <SelectItem value="prefer_highsec" className="text-xs">Prefer Highsec</SelectItem>
                        <SelectItem value="prefer_lowsec" className="text-xs">Prefer Low/Null</SelectItem>
                        <SelectItem value="avoid_highsec" className="text-xs">Avoid Highsec</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Options */}
                {routeMode !== "gate" && (
                  <div className="flex items-center gap-2">
                    <Switch
                      id="prefer-stations"
                      checked={preferStations}
                      onCheckedChange={setPreferStations}
                      className="scale-75"
                    />
                    <Label htmlFor="prefer-stations" className="text-xs cursor-pointer">Prefer station systems</Label>
                  </div>
                )}

                <Separator />

                {/* Calculate button */}
                <Button
                  className="w-full h-9"
                  onClick={calculateRoute}
                  disabled={
                    !origin || !destination ||
                    (routeMode !== "gate" && !selectedShip) ||
                    isCalculating
                  }
                >
                  {isCalculating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Navigation2 className="w-4 h-4 mr-2" />
                      Calculate Route
                    </>
                  )}
                </Button>

                {/* Action buttons */}
                {routeHops.length > 0 && (
                  <div className="flex gap-1.5">
                    <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 h-7 text-xs">
                          <Save className="w-3 h-3 mr-1" />
                          Save
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[350px]">
                        <DialogHeader>
                          <DialogTitle className="text-sm">Save Route</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 mt-2">
                          <Input
                            value={saveRouteName}
                            onChange={(e) => setSaveRouteName(e.target.value)}
                            placeholder={`${origin?.name} → ${destination?.name}`}
                            className="h-8 text-sm"
                          />
                          <Button className="w-full h-8 text-sm" onClick={() => saveRouteMutation.mutate()}>
                            Save Route
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={copyRouteToClipboard}>
                      <Clipboard className="w-3 h-3 mr-1" />
                      Copy
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={clearRoute}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}

                <Separator />

                {/* Collapsible: Beacons */}
                <Collapsible open={beaconsOpen} onOpenChange={setBeaconsOpen}>
                  <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium w-full hover:text-foreground text-muted-foreground">
                    {beaconsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <Signal className="w-3 h-3 text-purple-400" />
                    Beacon Network
                    <Badge variant="outline" className="text-[9px] h-3.5 px-1 ml-auto">
                      {beaconSystemIds.size}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <BeaconManager
                      systems={universeData.systems as any}
                      regions={universeData.regions}
                      selectedNetwork={selectedNetwork}
                      onNetworkChange={setSelectedNetwork}
                      beaconSystemIds={beaconSystemIds}
                    />
                  </CollapsibleContent>
                </Collapsible>

                {/* Collapsible: Saved Routes */}
                <Collapsible open={savedRoutesOpen} onOpenChange={setSavedRoutesOpen}>
                  <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium w-full hover:text-foreground text-muted-foreground">
                    {savedRoutesOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <Bookmark className="w-3 h-3" />
                    Saved Routes
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <SavedRoutes onLoadRoute={handleLoadRoute} />
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Map */}
            <ResizablePanel defaultSize={72}>
              <UniverseMap
                systems={universeData.systems as any}
                gates={universeData.gates}
                regions={universeData.regions}
                constellations={universeData.constellations}
                route={routeHops.length > 0 ? routeHops : null}
                originId={origin?.id ?? null}
                destinationId={destination?.id ?? null}
                beaconSystemIds={beaconSystemIds}
                jumpRangeOriginId={routeMode !== "gate" && origin ? origin.id : null}
                jumpRangeLY={maxRange}
                onSystemClick={handleMapSystemClick}
                highlightedSystemId={highlightedSystem}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Bottom: Route Table */}
        <ResizablePanel defaultSize={45} minSize={20}>
          <div className="h-full flex flex-col">
            {/* Fuel check bar */}
            {routeHops.length > 0 && selectedShip && (
              <FuelCheck
                fuelTypeId={selectedShip.fuelTypeId}
                fuelTypeName={selectedShip.fuelTypeName}
                fuelNeeded={totalFuel}
                enabled={routeHops.length > 0}
              />
            )}

            <RouteTable
              hops={routeHops}
              fatigueHops={fatigueHops}
              systems={universeData.systems}
              regions={universeData.regions}
              totalFuel={totalFuel}
              fuelTypeName={selectedShip?.fuelTypeName ?? "Isotopes"}
              totalGates={routeStats.gates}
              totalJumps={routeStats.jumps}
              totalDistanceLY={routeStats.totalLY}
              totalTripTime={routeStats.tripTime}
              baseFuelPerLY={shipClass?.baseFuelPerLY ?? 0}
              jfcLevel={jfcLevel}
              jfLevel={jfLevel}
              isJumpFreighter={shipClass?.isJumpFreighter ?? false}
              onHoverSystem={setHighlightedSystem}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
