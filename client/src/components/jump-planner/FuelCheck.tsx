import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Fuel, Check, AlertTriangle, Loader2 } from "lucide-react";
import { formatNumber } from "@/lib/jump-planner/distance";

interface FuelCheckProps {
  fuelTypeId: number;
  fuelTypeName: string;
  fuelNeeded: number;
  enabled: boolean; // Only check when we have a route
}

export default function FuelCheck({ fuelTypeId, fuelTypeName, fuelNeeded, enabled }: FuelCheckProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/jump-planner/fuel-check", fuelTypeId],
    queryFn: async () => {
      const res = await fetch(`/api/jump-planner/fuel-check/${fuelTypeId}`);
      if (!res.ok) throw new Error("Failed to check fuel");
      return res.json() as Promise<{ totalQuantity: number; locations: { locationId: number; quantity: number }[]; error?: string }>;
    },
    enabled: enabled && fuelNeeded > 0,
    staleTime: 5 * 60 * 1000,
  });

  if (!enabled || fuelNeeded <= 0) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-1.5">
        <Loader2 className="w-3 h-3 animate-spin" />
        Checking fuel inventory...
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="flex items-center gap-2 text-xs px-3 py-1.5">
        <Fuel className="w-3.5 h-3.5 text-muted-foreground" />
        <span>Need <strong>{formatNumber(fuelNeeded)}</strong> {fuelTypeName}</span>
        <span className="text-muted-foreground">(Login with ESI to check inventory)</span>
      </div>
    );
  }

  const surplus = data.totalQuantity - fuelNeeded;
  const hasSufficient = surplus >= 0;

  return (
    <div className="flex items-center gap-2 text-xs px-3 py-1.5">
      <Fuel className="w-3.5 h-3.5 text-muted-foreground" />
      <span>Need <strong>{formatNumber(fuelNeeded)}</strong> {fuelTypeName}</span>
      <span className="text-muted-foreground">|</span>
      <span>Have <strong>{formatNumber(data.totalQuantity)}</strong></span>
      {hasSufficient ? (
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-green-500/10 text-green-400 border-green-500/30">
          <Check className="w-2.5 h-2.5 mr-0.5" />
          Sufficient (+{formatNumber(surplus)})
        </Badge>
      ) : (
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-red-500/10 text-red-400 border-red-500/30">
          <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
          Need {formatNumber(Math.abs(surplus))} more
        </Badge>
      )}
    </div>
  );
}
