import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Anchor, MapPin, Cpu, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/PageHeader";

interface Implant {
  typeId: number;
  name: string;
}

interface JumpClone {
  id: number;
  locationId: number;
  locationType: string;
  locationName: string;
  implants: Implant[];
}

interface ClonesData {
  homeLocation: string;
  jumpClones: JumpClone[];
  activeImplants: Implant[];
}

function getImplantColor(name: string): string {
  // Hardwiring implants typically have slot 6-10 in name or specific keywords
  const lower = name.toLowerCase();
  if (
    lower.includes("hardwiring") ||
    lower.includes("eifyr") ||
    lower.includes("zor") ||
    lower.includes("inherent") ||
    /\bslot (6|7|8|9|10)\b/.test(lower) ||
    /^(6|7|8|9|10)[a-z]/i.test(name.trim())
  ) {
    return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  }
  // Attribute implants (slot 1-5) - yellow
  return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
}

function ImplantBadge({ implant }: { implant: Implant }) {
  const colorClass = getImplantColor(implant.name);
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}
    >
      {implant.name}
    </span>
  );
}

function CloneSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-32 mb-3" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function JumpClonesPage() {
  const { isAuthenticated } = useAuth();

  const { data, isLoading, isError } = useQuery<ClonesData>({
    queryKey: ["/api/character/clones"],
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="border-dashed max-w-md">
          <CardContent className="pt-6 text-center">
            <Anchor className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Jump Clones</h2>
            <p className="text-muted-foreground">Login with EVE Online to view your jump clones.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const jumpClones = data?.jumpClones ?? [];
  const activeImplants = data?.activeImplants ?? [];
  const homeLocation = data?.homeLocation ?? "Unknown";

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1200px] mx-auto">
      <PageHeader
        icon={Anchor}
        title="Jump Clones"
        subtitle="Manage your clones across New Eden"
        actions={
          <Badge variant="secondary" className="text-sm">
            {isLoading ? "…" : jumpClones.length} Clone{jumpClones.length !== 1 ? "s" : ""}
          </Badge>
        }
      />

      {/* Jump Clone Timer Note */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-md px-4 py-2 border border-border">
        <AlertCircle className="h-4 w-4 shrink-0" />
        Jump clone timer: 24h between jumps (reduced by Infomorph Psychology skill)
      </div>

      {/* Active Clone */}
      {isLoading ? (
        <CloneSkeleton />
      ) : (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              Active Clone
              <Badge variant="outline" className="ml-auto text-xs">Current</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {homeLocation}
            </div>
            {activeImplants.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No implants</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {activeImplants.map((imp) => (
                  <ImplantBadge key={imp.typeId} implant={imp} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Jump Clones Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <CloneSkeleton />
          <CloneSkeleton />
          <CloneSkeleton />
        </div>
      ) : isError ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground">Failed to load jump clones.</p>
          </CardContent>
        </Card>
      ) : jumpClones.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-8 pb-8 text-center">
            <Anchor className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground">No jump clones found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {jumpClones.map((clone, idx) => (
            <Card key={clone.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Anchor className="h-3.5 w-3.5 text-muted-foreground" />
                  Clone {idx + 1}
                  <Badge variant="outline" className="ml-auto text-[10px] capitalize">
                    {clone.locationType || "Station"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {clone.locationName || `Location ${clone.locationId}`}
                </div>
                {clone.implants.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No implants</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {clone.implants.map((imp) => (
                      <ImplantBadge key={imp.typeId} implant={imp} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
