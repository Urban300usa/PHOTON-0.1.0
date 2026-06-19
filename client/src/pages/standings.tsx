import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/PageHeader";

interface Standing {
  fromId: number;
  fromType: "faction" | "npc_corp" | "agent";
  name: string;
  standing: number;
}

interface StandingsData {
  standings: Standing[];
}

function standingColor(value: number): string {
  if (value >= 5) return "text-green-400";
  if (value >= 0) return "text-yellow-400";
  return "text-red-400";
}

function StandingBar({ value }: { value: number }) {
  // value range: -10 to +10 → normalize to 0-100%
  const pct = ((value + 10) / 20) * 100;
  const color = value >= 5 ? "bg-green-500" : value >= 0 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-sm font-medium tabular-nums w-12 text-right ${standingColor(value)}`}>
        {value > 0 ? "+" : ""}
        {value.toFixed(2)}
      </span>
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  faction: "Faction",
  npc_corp: "Corp",
  agent: "Agent",
};

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    faction: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    npc_corp: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    agent: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors[type] ?? ""}`}>
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

function SkeletonRow() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
    </TableRow>
  );
}

export default function StandingsPage() {
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<"all" | "faction" | "npc_corp" | "agent">("all");

  const { data, isLoading, isError } = useQuery<StandingsData>({
    queryKey: ["/api/character/standings"],
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  const allStandings = data?.standings ?? [];

  const filtered = useMemo(() => {
    const list = tab === "all" ? allStandings : allStandings.filter((s) => s.fromType === tab);
    return [...list].sort((a, b) => b.standing - a.standing);
  }, [allStandings, tab]);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="border-dashed max-w-md">
          <CardContent className="pt-6 text-center">
            <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">NPC Standings</h2>
            <p className="text-muted-foreground">Login with EVE Online to view your standings.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const goodCount = allStandings.filter((s) => s.standing >= 5).length;
  const badCount = allStandings.filter((s) => s.standing < 0).length;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1100px] mx-auto">
      <PageHeader
        icon={BarChart3}
        title="NPC Standings"
        subtitle="Your reputation with factions, corporations, and agents"
        actions={!isLoading && (
          <div className="flex gap-2">
            <Badge variant="outline" className="border-green-500/40 text-green-400 bg-green-500/10">
              {goodCount} Positive
            </Badge>
            <Badge variant="outline" className="border-red-500/40 text-red-400 bg-red-500/10">
              {badCount} Negative
            </Badge>
          </div>
        )}
      />

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="faction">Factions</TabsTrigger>
          <TabsTrigger value="npc_corp">Corps</TabsTrigger>
          <TabsTrigger value="agent">Agents</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Standing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : isError ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8">
                        <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                        <p className="text-muted-foreground">Failed to load standings.</p>
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-10">
                        <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                        <p className="text-muted-foreground">No standings found.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((s) => (
                      <TableRow key={`${s.fromType}-${s.fromId}`}>
                        <TableCell className="font-medium">
                          {s.name || `Entity ${s.fromId}`}
                        </TableCell>
                        <TableCell>
                          <TypeBadge type={s.fromType} />
                        </TableCell>
                        <TableCell>
                          <StandingBar value={s.standing} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
