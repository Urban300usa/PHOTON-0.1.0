import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  securityColor,
  formatSecurity,
  formatNumber,
  formatDuration,
  fuelPerJump,
} from "@/lib/jump-planner/distance";
import type { FatigueHop } from "@/lib/jump-planner/fatigue";
import type { SegmentType } from "@/lib/jump-planner/hybrid-router";
import { ArrowRight, Fuel, Clock, Navigation } from "lucide-react";

interface SystemData {
  name: string;
  sec: number;
  regId: number;
}

interface RouteHop {
  systemId: number;
  segmentType: SegmentType;
  distanceLY: number;
}

interface RouteTableProps {
  hops: RouteHop[];
  fatigueHops: FatigueHop[];
  systems: Record<string, SystemData>;
  regions: Record<string, string>;
  totalFuel: number;
  fuelTypeName: string;
  totalGates: number;
  totalJumps: number;
  totalDistanceLY: number;
  totalTripTime: number;
  baseFuelPerLY: number;
  jfcLevel: number;
  jfLevel: number;
  isJumpFreighter: boolean;
  onHoverSystem: (systemId: number | null) => void;
}

export default function RouteTable({
  hops,
  fatigueHops,
  systems,
  regions,
  totalFuel,
  fuelTypeName,
  totalGates,
  totalJumps,
  totalDistanceLY,
  totalTripTime,
  baseFuelPerLY,
  jfcLevel,
  jfLevel,
  isJumpFreighter,
  onHoverSystem,
}: RouteTableProps) {
  if (hops.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        <Navigation className="w-4 h-4 mr-2" />
        Calculate a route to see results here
      </div>
    );
  }

  // Calculate fuel per hop
  const hopFuel = hops.map((hop) => {
    if (hop.segmentType !== "jump" || hop.distanceLY === 0) return 0;
    return fuelPerJump(baseFuelPerLY, hop.distanceLY, jfcLevel, isJumpFreighter ? jfLevel : 0);
  });

  return (
    <div className="flex flex-col h-full">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-4 px-3 py-2 bg-muted/30 border-b text-xs">
        <div className="flex items-center gap-1.5">
          <Navigation className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Hops:</span>
          <span className="font-medium">{hops.length - 1}</span>
          {totalJumps > 0 && (
            <span className="text-orange-400">({totalJumps} jump{totalJumps !== 1 ? "s" : ""})</span>
          )}
          {totalGates > 0 && (
            <span className="text-yellow-400">({totalGates} gate{totalGates !== 1 ? "s" : ""})</span>
          )}
        </div>
        {totalDistanceLY > 0 && (
          <div className="flex items-center gap-1.5">
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Distance:</span>
            <span className="font-medium">{totalDistanceLY.toFixed(2)} LY</span>
          </div>
        )}
        {totalFuel > 0 && (
          <div className="flex items-center gap-1.5">
            <Fuel className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Fuel:</span>
            <span className="font-medium">{formatNumber(totalFuel)} {fuelTypeName}</span>
          </div>
        )}
        {totalTripTime > 0 && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Trip time:</span>
            <span className="font-medium">{formatDuration(totalTripTime)}</span>
          </div>
        )}
      </div>

      {/* Table */}
      <ScrollArea className="flex-1">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-background border-b">
            <tr>
              <th className="text-left px-2 py-1.5 w-8">#</th>
              <th className="text-left px-2 py-1.5">System</th>
              <th className="text-left px-2 py-1.5">Region</th>
              <th className="text-center px-2 py-1.5 w-12">Sec</th>
              <th className="text-center px-2 py-1.5 w-16">Type</th>
              <th className="text-right px-2 py-1.5 w-16">Dist (LY)</th>
              <th className="text-right px-2 py-1.5 w-16">Fuel</th>
              <th className="text-right px-2 py-1.5 w-20">Cooldown</th>
              <th className="text-right px-2 py-1.5 w-20">Fatigue</th>
            </tr>
          </thead>
          <tbody>
            {hops.map((hop, idx) => {
              const sys = systems[hop.systemId.toString()];
              const region = sys ? regions[sys.regId.toString()] : "Unknown";
              const fatigue = fatigueHops[idx];
              const fuel = hopFuel[idx];

              return (
                <tr
                  key={idx}
                  className={`hover:bg-accent/50 transition-colors cursor-pointer border-b border-border/30 ${idx % 2 === 1 ? "bg-muted/15" : ""}`}
                  onMouseEnter={() => onHoverSystem(hop.systemId)}
                  onMouseLeave={() => onHoverSystem(null)}
                >
                  <td className="px-2 py-1.5 text-muted-foreground">{idx}</td>
                  <td className="px-2 py-1.5 font-medium text-[13px]">{sys?.name ?? `System ${hop.systemId}`}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{region}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span
                      className="font-mono text-[11px]"
                      style={{ color: securityColor(sys?.sec ?? 0) }}
                    >
                      {formatSecurity(sys?.sec ?? 0)}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {hop.segmentType === "origin" ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 h-4 bg-green-500/10 text-green-400 border-green-500/30">
                        origin
                      </Badge>
                    ) : hop.segmentType === "jump" ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 h-4 bg-orange-500/10 text-orange-400 border-orange-500/30">
                        jump
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 h-4 bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                        gate
                      </Badge>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    {hop.distanceLY > 0 ? hop.distanceLY.toFixed(2) : "-"}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    {fuel > 0 ? formatNumber(fuel) : "-"}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-orange-300/80">
                    {fatigue && fatigue.jumpCooldown > 0
                      ? formatDuration(fatigue.jumpCooldown)
                      : "-"}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-blue-300/80">
                    {fatigue && fatigue.fatigueAfter > 0
                      ? formatDuration(fatigue.fatigueAfter)
                      : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}
