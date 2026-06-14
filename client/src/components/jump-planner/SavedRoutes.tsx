import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Star, Trash2, ArrowRight, Navigation, Loader2 } from "lucide-react";
import { formatNumber } from "@/lib/jump-planner/distance";

interface SavedRoute {
  id: string;
  name: string;
  description: string | null;
  shipName: string | null;
  originSystemName: string;
  destinationSystemName: string;
  totalFuel: number | null;
  totalJumps: number | null;
  totalGates: number | null;
  isFavorite: boolean;
  routeDataJson: any;
  skillConfig: any;
  originSystemId: number;
  destinationSystemId: number;
  shipTypeId: number | null;
  updatedAt: string;
}

interface SavedRoutesProps {
  onLoadRoute: (route: SavedRoute) => void;
}

export default function SavedRoutes({ onLoadRoute }: SavedRoutesProps) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/jump-planner/routes"],
    queryFn: async () => {
      const res = await fetch("/api/jump-planner/routes");
      if (!res.ok) throw new Error("Failed to fetch routes");
      const json = await res.json();
      return json.routes as SavedRoute[];
    },
    staleTime: 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/jump-planner/routes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/jump-planner/routes"] }),
  });

  const favoriteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/jump-planner/routes/${id}/favorite`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to toggle favorite");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/jump-planner/routes"] }),
  });

  const routes = data || [];
  const sortedRoutes = [...routes].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span className="text-sm text-muted-foreground">Loading saved routes...</span>
      </div>
    );
  }

  if (sortedRoutes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm">
        <Navigation className="w-5 h-5 mb-2" />
        No saved routes yet
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[300px]">
      <div className="space-y-1 p-1">
        {sortedRoutes.map((route) => (
          <div
            key={route.id}
            className="flex items-center gap-2 p-2 rounded hover:bg-accent/50 cursor-pointer group"
            onClick={() => onLoadRoute(route)}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                favoriteMutation.mutate(route.id);
              }}
            >
              <Star
                className={`w-3.5 h-3.5 ${route.isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
              />
            </Button>

            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{route.name}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="truncate">{route.originSystemName}</span>
                <ArrowRight className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{route.destinationSystemName}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {route.shipName && (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                  {route.shipName}
                </Badge>
              )}
              {route.totalJumps != null && route.totalJumps > 0 && (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-orange-400 border-orange-500/30">
                  {route.totalJumps}J
                </Badge>
              )}
              {route.totalGates != null && route.totalGates > 0 && (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-yellow-400 border-yellow-500/30">
                  {route.totalGates}G
                </Badge>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                deleteMutation.mutate(route.id);
              }}
            >
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
