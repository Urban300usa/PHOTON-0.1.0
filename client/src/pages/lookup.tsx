import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  UserSearch, Search, Loader2, Building2, Users, Calendar,
  Skull, ExternalLink, Swords,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { formatISK } from "@/hooks/use-wallet";
import { PageHeader } from "@/components/PageHeader";
import { apiRequest } from "@/lib/queryClient";

interface ZkillStats {
  shipsDestroyed: number;
  iskDestroyed: number;
  shipsLost: number;
  iskLost: number;
  soloKills: number;
  dangerRatio: number | null;
  gangRatio: number | null;
}

interface IntelData {
  character: {
    id: number;
    name: string;
    birthday: string | null;
    ageDays: number | null;
    securityStatus: number;
    gender: string | null;
    race: string | null;
    description: string | null;
  };
  corporation: { id: number; name: string; ticker: string | null; memberCount: number | null; founded: string | null };
  alliance: { id: number; name: string; ticker: string | null } | null;
  history: Array<{ corpId: number; corpName: string; startDate: string; days: number; current: boolean }>;
  zkill: ZkillStats | null;
  portrait: string;
}

function secColor(s: number): string {
  if (s >= 5) return "text-cyan-300";
  if (s > 0) return "text-green-400";
  if (s === 0) return "text-muted-foreground";
  if (s > -5) return "text-orange-400";
  return "text-red-500";
}

function ageString(days: number | null): string {
  if (days == null) return "—";
  const years = days / 365.25;
  if (years >= 1) return `${years.toFixed(1)} yrs`;
  return `${days} days`;
}

function durationString(days: number): string {
  if (days >= 365) return `${(days / 365.25).toFixed(1)} yr`;
  if (days >= 30) return `${Math.round(days / 30.44)} mo`;
  return `${days}d`;
}

function StatBox({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
      <p className="hud-eyebrow text-[10px] text-muted-foreground">{label}</p>
      <p className={`hud-metric text-lg font-bold ${color ?? ""}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function LookupPage() {
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState("");
  const [data, setData] = useState<IntelData | null>(null);
  const [notFound, setNotFound] = useState(false);

  const lookup = useMutation({
    mutationFn: async (q: string): Promise<IntelData> => {
      const term = q.trim();
      let id: number;
      if (/^\d+$/.test(term)) {
        id = parseInt(term, 10);
      } else {
        const sres = await apiRequest("GET", `/api/tools/character/search?name=${encodeURIComponent(term)}`);
        const s = await sres.json();
        id = s.id;
      }
      const res = await apiRequest("GET", `/api/tools/character/${id}`);
      return (await res.json()) as IntelData;
    },
    onSuccess: (d) => { setData(d); setNotFound(false); },
    onError: () => { setData(null); setNotFound(true); },
  });

  const run = () => { if (query.trim()) lookup.mutate(query); };

  const ch = data?.character;
  const zk = data?.zkill;
  const shipEff = zk && (zk.shipsDestroyed + zk.shipsLost) > 0
    ? (zk.shipsDestroyed / (zk.shipsDestroyed + zk.shipsLost)) * 100
    : null;

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="border-dashed max-w-md">
          <CardContent className="pt-6 text-center">
            <UserSearch className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Character Lookup</h2>
            <p className="text-muted-foreground">Login with EVE Online to look up any pilot.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1000px] mx-auto">
      <PageHeader
        icon={UserSearch}
        title="Character Lookup"
        subtitle="Public intel on any EVE pilot — corp, age, security status & combat record"
      />

      {/* Search */}
      <form
        onSubmit={(e) => { e.preventDefault(); run(); }}
        className="flex items-center gap-2 max-w-xl"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Character name or ID (e.g. Chribba)"
            className="pl-9"
            autoFocus
          />
        </div>
        <Button type="submit" disabled={lookup.isPending || !query.trim()}>
          {lookup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Look up"}
        </Button>
      </form>

      {notFound && (
        <p className="text-sm text-muted-foreground">No character found for “{query.trim()}”. Check the spelling.</p>
      )}

      {!data && !notFound && !lookup.isPending && (
        <div className="text-center py-16 text-muted-foreground">
          <UserSearch className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>Search a pilot to pull their public record.</p>
        </div>
      )}

      {data && ch && (
        <div className="space-y-5">
          {/* Identity */}
          <Card className="hud-panel--accent">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-5">
                <img
                  src={data.portrait}
                  alt={ch.name}
                  className="h-28 w-28 rounded-lg border border-border/60 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-2xl font-bold">{ch.name}</h2>
                    <a
                      href={`https://zkillboard.com/character/${ch.id}/`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      zKillboard <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" />
                      {data.corporation.name}
                      {data.corporation.ticker && <span className="opacity-70">[{data.corporation.ticker}]</span>}
                    </span>
                    {data.alliance && (
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        {data.alliance.name}
                        {data.alliance.ticker && <span className="opacity-70">&lt;{data.alliance.ticker}&gt;</span>}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <StatBox
                      label="Security"
                      value={ch.securityStatus.toFixed(2)}
                      color={secColor(ch.securityStatus)}
                    />
                    <StatBox label="Age" value={ageString(ch.ageDays)} sub={ch.birthday ? new Date(ch.birthday).getFullYear().toString() : undefined} />
                    <StatBox label="Bloodline" value={ch.race ?? "—"} sub={ch.gender ?? undefined} />
                    <StatBox label="Corp Members" value={data.corporation.memberCount != null ? data.corporation.memberCount.toLocaleString() : "—"} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Combat record */}
          {zk && (zk.shipsDestroyed > 0 || zk.shipsLost > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="hud-eyebrow flex items-center gap-1.5">
                  <Swords className="h-3.5 w-3.5 text-primary" /> Combat Record
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  <StatBox label="Kills" value={zk.shipsDestroyed.toLocaleString()} color="text-green-400" />
                  <StatBox label="ISK Destroyed" value={formatISK(zk.iskDestroyed)} color="text-green-400" />
                  <StatBox label="Losses" value={zk.shipsLost.toLocaleString()} color="text-red-400" />
                  <StatBox label="ISK Lost" value={formatISK(zk.iskLost)} color="text-red-400" />
                  <StatBox label="Solo Kills" value={zk.soloKills.toLocaleString()} />
                  <StatBox
                    label="Ship Efficiency"
                    value={shipEff != null ? `${shipEff.toFixed(0)}%` : "—"}
                    color={shipEff != null && shipEff >= 50 ? "text-green-400" : "text-red-400"}
                  />
                </div>
                {(zk.dangerRatio != null || zk.gangRatio != null) && (
                  <div className="mt-4 space-y-2 max-w-md">
                    {zk.dangerRatio != null && (
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground flex items-center gap-1"><Skull className="h-3 w-3" /> Danger</span>
                          <span className="font-mono">{zk.dangerRatio}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-red-500/80" style={{ width: `${zk.dangerRatio}%` }} />
                        </div>
                      </div>
                    )}
                    {zk.gangRatio != null && (
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Gang ratio</span>
                          <span className="font-mono">{zk.gangRatio}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary/70" style={{ width: `${zk.gangRatio}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Employment history */}
          {data.history.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="hud-eyebrow flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" /> Employment History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Corporation</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.history.map((h, i) => (
                      <TableRow key={`${h.corpId}-${i}`}>
                        <TableCell className="font-medium">
                          {h.corpName}
                          {h.current && (
                            <Badge variant="outline" className="ml-2 text-green-400 border-green-400/40 text-[10px]">current</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(h.startDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          {durationString(h.days)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
