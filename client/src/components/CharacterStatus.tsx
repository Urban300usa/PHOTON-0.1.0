import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Rocket, MapPin, Shield, AlertCircle } from "lucide-react";

interface CharacterStatusData {
  characterId: number;
  characterName: string;
  ship: {
    shipTypeId: number;
    shipTypeName: string;
    shipName: string;
  };
  location: {
    solarSystemId: number;
    solarSystemName: string;
    securityStatus: number;
    stationId: number | null;
    structureId: number | null;
  };
}

function getSecurityColor(sec: number): string {
  if (sec >= 0.5) return "text-green-400";
  if (sec >= 0.1) return "text-yellow-400";
  if (sec >= 0) return "text-orange-400";
  return "text-red-400";
}

function getSecurityBadgeVariant(sec: number): "default" | "secondary" | "destructive" | "outline" {
  if (sec >= 0.5) return "default";
  if (sec >= 0) return "secondary";
  return "destructive";
}

interface CharacterStatusProps {
  isAuthenticated: boolean;
  isPro?: boolean;
}

export default function CharacterStatus({ isAuthenticated, isPro = false }: CharacterStatusProps) {
  const { data, isLoading, error } = useQuery<CharacterStatusData>({
    queryKey: ["/api/character/status"],
    enabled: isAuthenticated && isPro,
    refetchInterval: 60000,
  });

  if (!isAuthenticated) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Rocket className="w-4 h-4" />
            Character Status
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[calc(100%-3rem)]">
          <p className="text-sm text-muted-foreground">Login to see your status</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Rocket className="w-4 h-4" />
            Character Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Rocket className="w-4 h-4" />
            Character Status
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[calc(100%-3rem)]">
          <div className="flex flex-col items-center gap-2 text-muted-foreground text-center px-4">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm">Location scopes not enabled</span>
            <span className="text-xs">Re-login after adding ESI location scopes to your EVE app</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="h-full" data-testid="card-character-status">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Rocket className="w-4 h-4" />
          Character Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Rocket className="w-3 h-3" />
            <span className="text-xs uppercase tracking-wide">Ship</span>
          </div>
          <p className="font-mono text-sm font-medium" data-testid="text-ship-name">
            {data.ship.shipTypeName}
          </p>
          {data.ship.shipName && (
            <p className="text-xs text-muted-foreground italic">"{data.ship.shipName}"</p>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span className="text-xs uppercase tracking-wide">Location</span>
          </div>
          <div className="flex items-center gap-2">
            <p className="font-mono text-sm font-medium" data-testid="text-system-name">
              {data.location.solarSystemName}
            </p>
            <Badge 
              variant={getSecurityBadgeVariant(data.location.securityStatus)}
              className="text-xs px-1.5 py-0"
              data-testid="badge-security-status"
            >
              <Shield className="w-3 h-3 mr-1" />
              <span className={getSecurityColor(data.location.securityStatus)}>
                {data.location.securityStatus.toFixed(1)}
              </span>
            </Badge>
          </div>
          {data.location.stationId && (
            <p className="text-xs text-muted-foreground">Docked in station</p>
          )}
          {data.location.structureId && (
            <p className="text-xs text-muted-foreground">Docked in structure</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
