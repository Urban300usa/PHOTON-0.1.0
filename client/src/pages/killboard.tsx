import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Crosshair, ChevronLeft, ChevronRight, AlertCircle, Skull, Shield } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { formatISK } from "@/hooks/use-wallet";

interface Killmail {
  // Fields returned by /api/character/killmails
  id?: number;
  time?: string;
  systemName?: string;
  systemId?: number;
  victimShipName?: string | null;
  victimShipTypeId?: number | null;
  attackerCount?: number;
  iskLost?: number;
  isKill?: boolean;
}

interface KillmailsData {
  killmails: Killmail[];
  total?: number;
}

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
  className,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  loading?: boolean;
  className?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm text-muted-foreground font-normal flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <p className={`text-xl font-bold ${className ?? ""}`}>{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function KillmailRow({ km, isLoss }: { km: Killmail; isLoss: boolean }) {
  const shipName = km.victimShipName ?? "Unknown Ship";
  const time = km.time;
  const system = km.systemName ?? (km.systemId ? `System ${km.systemId}` : "Unknown");
  const attackers = km.attackerCount ?? 0;
  const value = 0; // real ISK value not yet provided by the killmail endpoint

  return (
    <TableRow>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {time ? format(parseISO(time), "MMM d, yyyy") : "—"}
        <br />
        <span className="text-[11px]">{time ? format(parseISO(time), "HH:mm") : ""}</span>
      </TableCell>
      <TableCell className="font-medium text-sm">{shipName}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{system}</TableCell>
      <TableCell className="text-sm text-center">{attackers || "—"}</TableCell>
      <TableCell className={`text-right text-sm font-medium ${isLoss ? "text-red-400" : "text-green-400"}`}>
        {value > 0 ? formatISK(value) : "—"}
      </TableCell>
    </TableRow>
  );
}

function SkeletonRow() {
  return (
    <TableRow>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableCell key={i}><Skeleton className="h-4 w-full" /></TableCell>
      ))}
    </TableRow>
  );
}

export default function KillboardPage() {
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<"kills" | "losses">("kills");
  const [killsPage, setKillsPage] = useState(1);
  const [lossesPage, setLossesPage] = useState(1);

  const page = tab === "kills" ? killsPage : lossesPage;
  const setPage = tab === "kills" ? setKillsPage : setLossesPage;

  const killsQuery = useQuery<KillmailsData>({
    queryKey: ["/api/character/killmails", "kills", killsPage],
    queryFn: async () => {
      const res = await fetch(`/api/character/killmails?type=kills&page=${killsPage}`);
      if (!res.ok) throw new Error("Failed to fetch kills");
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  const lossesQuery = useQuery<KillmailsData>({
    queryKey: ["/api/character/killmails", "losses", lossesPage],
    queryFn: async () => {
      const res = await fetch(`/api/character/killmails?type=losses&page=${lossesPage}`);
      if (!res.ok) throw new Error("Failed to fetch losses");
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  const activeQuery = tab === "kills" ? killsQuery : lossesQuery;
  const killmails = activeQuery.data?.killmails ?? [];

  // The killmail endpoint returns counts (not real ISK), so base stats on kill/loss counts.
  const totalKills = killsQuery.data?.killmails?.length ?? 0;
  const totalLosses = lossesQuery.data?.killmails?.length ?? 0;
  const iskDestroyed = 0; // real ISK value not yet provided by the endpoint
  const iskLost = 0;
  const efficiency = useMemo(() => {
    const total = totalKills + totalLosses;
    if (total <= 0) return 0;
    return (totalKills / total) * 100;
  }, [totalKills, totalLosses]);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="border-dashed max-w-md">
          <CardContent className="pt-6 text-center">
            <Crosshair className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Killboard</h2>
            <p className="text-muted-foreground">Login with EVE Online to view your killboard.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statsLoading = killsQuery.isLoading || lossesQuery.isLoading;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1200px] mx-auto">
      <PageHeader icon={Crosshair} title="Killboard" subtitle="Combat history and kill/loss statistics" />

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Kills"
          value={totalKills.toLocaleString()}
          icon={Skull}
          loading={statsLoading}
          className="text-green-400"
        />
        <StatCard
          title="Total Losses"
          value={totalLosses.toLocaleString()}
          icon={Shield}
          loading={statsLoading}
          className="text-red-400"
        />
        <StatCard
          title="ISK Destroyed"
          value={formatISK(iskDestroyed)}
          icon={Crosshair}
          loading={statsLoading}
          className="text-green-400"
        />
        <StatCard
          title="ISK Lost"
          value={formatISK(iskLost)}
          icon={Crosshair}
          loading={statsLoading}
          className="text-red-400"
        />
        <StatCard
          title="Efficiency"
          value={`${efficiency.toFixed(1)}%`}
          icon={Crosshair}
          loading={statsLoading}
          className={efficiency >= 50 ? "text-green-400" : "text-red-400"}
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="kills" className="flex items-center gap-1.5">
            <Skull className="h-3.5 w-3.5" />
            Kills
          </TabsTrigger>
          <TabsTrigger value="losses" className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Losses
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Ship</TableHead>
                    <TableHead>System</TableHead>
                    <TableHead className="text-center">Attackers</TableHead>
                    <TableHead className="text-right">ISK Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeQuery.isLoading ? (
                    Array.from({ length: 15 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : activeQuery.isError ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                        <p className="text-muted-foreground">Failed to load {tab}.</p>
                      </TableCell>
                    </TableRow>
                  ) : killmails.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10">
                        <Crosshair className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                        <p className="text-muted-foreground">No {tab} found.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    killmails.map((km, i) => (
                      <KillmailRow key={km.id ?? i} km={km} isLoss={tab === "losses"} />
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">Page {page}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || activeQuery.isLoading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={activeQuery.isLoading || killmails.length < 20}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
