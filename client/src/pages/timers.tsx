import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock, AlertCircle, Factory, GraduationCap, ShoppingCart,
  FileText, Anchor, Globe2, AlertTriangle, RefreshCw,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/PageHeader";

interface TimerItem {
  category: string;
  label: string;
  detail: string;
  endsAt: string | null;
  meta?: { warning?: boolean };
}

interface TimersData {
  timers: TimerItem[];
  generatedAt: string;
}

const CATEGORY_META: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  industry: { icon: Factory, color: "text-orange-400", label: "Industry" },
  skill: { icon: GraduationCap, color: "text-blue-400", label: "Skills" },
  market: { icon: ShoppingCart, color: "text-green-400", label: "Market" },
  contract: { icon: FileText, color: "text-purple-400", label: "Contracts" },
  clone: { icon: Anchor, color: "text-cyan-400", label: "Clones" },
  pi: { icon: Globe2, color: "text-emerald-400", label: "Planetary" },
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Ready / Done";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  const sec = s % 60;
  return `${m}m ${sec}s`;
}

function urgencyColor(ms: number | null): string {
  if (ms === null) return "text-red-400";
  if (ms <= 0) return "text-muted-foreground";
  const h = ms / 3600000;
  if (h < 1) return "text-red-400";
  if (h < 24) return "text-orange-400";
  if (h < 24 * 3) return "text-yellow-400";
  return "text-green-400";
}

export default function TimersPage() {
  const { isAuthenticated } = useAuth();
  const [now, setNow] = useState(Date.now());
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<TimersData>({
    queryKey: ["/api/timers"],
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="border-dashed max-w-md">
          <CardContent className="pt-6 text-center">
            <Clock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Timer Dashboard</h2>
            <p className="text-muted-foreground">Login with EVE Online to see everything that needs your attention.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const timers = data?.timers ?? [];
  const categories = Array.from(new Set(timers.map((t) => t.category)));
  const shown = filter ? timers.filter((t) => t.category === filter) : timers;
  const warnings = timers.filter((t) => t.meta?.warning || t.endsAt === null).length;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1000px] mx-auto">
      {/* Header */}
      <PageHeader
        icon={Clock}
        title="Timer Dashboard"
        subtitle="Everything time-sensitive across your character — soonest first"
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {/* Warning banner */}
      {warnings > 0 && (
        <Card className="border-red-500/40 bg-red-500/5">
          <CardContent className="py-3 flex items-center gap-2 text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-medium">
              {warnings} item{warnings !== 1 ? "s" : ""} need attention now (idle queue / expired)
            </span>
          </CardContent>
        </Card>
      )}

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={filter === null ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setFilter(null)}
        >
          All ({timers.length})
        </Badge>
        {categories.map((cat) => {
          const meta = CATEGORY_META[cat] ?? { label: cat };
          const count = timers.filter((t) => t.category === cat).length;
          return (
            <Badge
              key={cat}
              variant={filter === cat ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilter(cat === filter ? null : cat)}
            >
              {meta.label} ({count})
            </Badge>
          );
        })}
      </div>

      {/* Timer list */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
        ) : isError ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
              <p className="text-muted-foreground">Failed to load timers. You may need to re-authorize ESI scopes.</p>
            </CardContent>
          </Card>
        ) : shown.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground">Nothing pending. All clear, capsuleer.</p>
            </CardContent>
          </Card>
        ) : (
          shown.map((t, i) => {
            const meta = CATEGORY_META[t.category] ?? { icon: Clock, color: "text-muted-foreground", label: t.category };
            const Icon = meta.icon;
            const ms = t.endsAt ? new Date(t.endsAt).getTime() - now : null;
            return (
              <Card key={i} className="hover:bg-accent/40 transition-colors">
                <CardContent className="py-3 flex items-center gap-3">
                  <div className={`flex-shrink-0 ${meta.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{t.label}</div>
                    <div className="text-sm text-muted-foreground truncate">{t.detail}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {t.endsAt === null ? (
                      <span className="text-red-400 font-semibold text-sm">Idle</span>
                    ) : (
                      <>
                        <div className={`font-mono font-semibold ${urgencyColor(ms)}`}>
                          {formatCountdown(ms!)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(t.endsAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
