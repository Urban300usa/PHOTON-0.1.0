import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Target, TrendingUp, AlertCircle } from "lucide-react";

interface PlexPriceData {
  typeId: number;
  typeName: string;
  sellPrice: number | null;
  totalVolume: number;
  lastUpdated: string;
}

function formatISK(value: number): string {
  if (value >= 1000000000) {
    return (value / 1000000000).toFixed(2) + "B";
  }
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + "M";
  }
  return value.toLocaleString();
}

interface PlexGoalTrackerProps {
  currentIsk: number;
  targetPlex?: number;
  isAuthenticated?: boolean;
  isPro?: boolean;
}

export default function PlexGoalTracker({ 
  currentIsk, 
  targetPlex = 500,
  isAuthenticated = false,
  isPro = false
}: PlexGoalTrackerProps) {
  const { data, isLoading, error } = useQuery<PlexPriceData>({
    queryKey: ["/api/market/plex-price"],
    enabled: isPro,
    refetchInterval: 300000,
    staleTime: 60000,
  });

  const plexPrice = data?.sellPrice || 0;
  const omegaCost = plexPrice * targetPlex;
  const progress = omegaCost > 0 ? Math.min((currentIsk / omegaCost) * 100, 100) : 0;
  const iskNeeded = Math.max(0, omegaCost - currentIsk);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            PLEX Goal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data?.sellPrice) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            PLEX Goal
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[calc(100%-3rem)]">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">Unable to fetch PLEX price</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full" data-testid="card-plex-goal">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            PLEX Goal
          </div>
          <Badge variant="outline" className="text-xs">
            {targetPlex} PLEX
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-mono font-medium" data-testid="text-plex-progress">
              {progress.toFixed(1)}%
            </span>
          </div>
          <Progress value={progress} className="h-2" data-testid="progress-plex" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Target className="w-3 h-3" />
              <span className="text-xs uppercase tracking-wide">Target</span>
            </div>
            <p className="font-mono text-sm font-medium" data-testid="text-omega-cost">
              {formatISK(omegaCost)} ISK
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="w-3 h-3" />
              <span className="text-xs uppercase tracking-wide">Remaining</span>
            </div>
            <p className="font-mono text-sm font-medium" data-testid="text-isk-needed">
              {formatISK(iskNeeded)} ISK
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Current PLEX price (Jita)</span>
            <span className="font-mono" data-testid="text-plex-price">
              {formatISK(plexPrice)} ISK
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
