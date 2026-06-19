import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import StatCard from "@/components/StatCard";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/hooks/use-auth";
import { useWalletBalance, formatISK } from "@/hooks/use-wallet";
import {
  LayoutDashboard, Wallet, TrendingUp, Coins, ShoppingCart, Clock, Skull,
  ChevronRight, Factory, GraduationCap, Globe2, FileText, Anchor,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip as RTooltip, YAxis } from "recharts";

interface NetWorthResp { history: { date: string; totalValue: number }[] }
interface IncomeResp { data: any[] }
interface TimersResp { timers: { category: string; label: string; detail: string; endsAt: string | null }[] }
interface OrdersResp { summary: { activeCount: number; outbidCount: number; sellValueRemaining: number } }
interface KillsResp { killmails: { id: number; time: string; systemName: string; victimShipName: string | null; isKill: boolean; attackerCount: number }[] }

const CATEGORY_ICON: Record<string, typeof Clock> = {
  industry: Factory, skill: GraduationCap, market: ShoppingCart, contract: FileText, clone: Anchor, pi: Globe2,
};

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
function urgency(ms: number): string {
  const h = ms / 3600000;
  if (h < 1) return "text-red-400";
  if (h < 24) return "text-orange-400";
  return "text-green-400";
}
function today(): string { return new Date().toISOString().slice(0, 10); }

export default function OverviewPage() {
  const { isAuthenticated, character } = useAuth();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  const netWorthQ = useQuery<NetWorthResp>({ queryKey: ["/api/analytics/net-worth/history?days=30"], enabled: isAuthenticated, staleTime: 5 * 60_000 });
  const incomeQ = useQuery<IncomeResp>({ queryKey: [`/api/analytics/income?startDate=${today()}&endDate=${today()}`], enabled: isAuthenticated, staleTime: 5 * 60_000 });
  const timersQ = useQuery<TimersResp>({ queryKey: ["/api/timers"], enabled: isAuthenticated, staleTime: 60_000 });
  const ordersQ = useQuery<OrdersResp>({ queryKey: ["/api/character/market-orders"], enabled: isAuthenticated, staleTime: 2 * 60_000 });
  const killsQ = useQuery<KillsResp>({ queryKey: ["/api/character/killmails?type=kills&page=1"], enabled: isAuthenticated, staleTime: 5 * 60_000 });
  const { data: walletData } = useWalletBalance(isAuthenticated);

  const history = netWorthQ.data?.history ?? [];
  const netWorth = history.length ? history[history.length - 1].totalValue : 0;
  const netWorth30dAgo = history.length ? history[0].totalValue : 0;
  const netWorthChange = netWorth - netWorth30dAgo;

  const incomeRow = incomeQ.data?.data?.[0];
  const todayIncome = incomeRow
    ? ["bounty", "mission", "market", "industry", "pi", "mining", "other"].reduce((sum, k) => sum + (Number(incomeRow[k]) || 0), 0)
    : 0;

  const upcomingTimers = (timersQ.data?.timers ?? [])
    .filter((t) => t.endsAt && new Date(t.endsAt).getTime() > now)
    .sort((a, b) => new Date(a.endsAt!).getTime() - new Date(b.endsAt!).getTime())
    .slice(0, 4);

  const outbid = ordersQ.data?.summary?.outbidCount ?? 0;
  const recentKills = (killsQ.data?.killmails ?? []).slice(0, 4);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="border-dashed max-w-md hud-panel--accent">
          <CardContent className="pt-6 text-center">
            <LayoutDashboard className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Command Center</h2>
            <p className="text-muted-foreground">Login with EVE Online to see your overview.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        icon={LayoutDashboard}
        title={`Welcome back, ${character?.name?.split(" ")[0] ?? "Capsuleer"}`}
        subtitle="Your command center — everything at a glance"
      />

      {/* Hero stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <StatCard label="Wallet" value={formatISK(walletData?.balance ?? 0)} icon={Wallet} highlight />
        <StatCard
          label="Net Worth"
          value={formatISK(netWorth)}
          icon={TrendingUp}
          trend={history.length > 1 ? { value: formatISK(Math.abs(netWorthChange)) + " / 30d", positive: netWorthChange >= 0 } : undefined}
        />
        <StatCard label="Today's Income" value={formatISK(todayIncome)} icon={Coins} />
        <StatCard label="Orders Outbid" value={String(outbid)} icon={ShoppingCart} highlight={outbid > 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Net worth sparkline — wide */}
        <Card className="hud-panel--accent lg:col-span-2 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="hud-eyebrow">Net Worth · 30 days</span>
            <Link href="/analytics/net-worth" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              Details <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {netWorthQ.isLoading ? (
            <Skeleton className="h-44 w-full" />
          ) : history.length < 2 ? (
            <EmptyState bare icon={TrendingUp} message="Net worth is tracked each time you visit Assets. Check back tomorrow." />
          ) : (
            <ResponsiveContainer width="100%" height={176}>
              <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <RTooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [formatISK(v), "Net Worth"]}
                  labelFormatter={(l) => l}
                />
                <Area type="monotone" dataKey="totalValue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#nwGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Next timers */}
        <Card className="hud-panel--accent p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="hud-eyebrow">Next Up</span>
            <Link href="/timers" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              All timers <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {timersQ.isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : upcomingTimers.length === 0 ? (
            <EmptyState bare icon={Clock} message="Nothing pending. All clear." />
          ) : (
            <div className="space-y-2">
              {upcomingTimers.map((t, i) => {
                const Icon = CATEGORY_ICON[t.category] ?? Clock;
                const ms = new Date(t.endsAt!).getTime() - now;
                return (
                  <div key={i} className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{t.label}</div>
                      <div className="text-xs text-muted-foreground truncate">{t.detail}</div>
                    </div>
                    <span className={`text-xs font-mono font-semibold shrink-0 ${urgency(ms)}`}>{fmtCountdown(ms)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Recent kills */}
        <Card className="hud-panel--accent lg:col-span-3 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="hud-eyebrow">Recent Combat</span>
            <Link href="/killboard" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              Killboard <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {killsQ.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : recentKills.length === 0 ? (
            <EmptyState bare icon={Skull} message="No recent kills. Re-authorize ESI to enable killmails." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {recentKills.map((k) => (
                <div key={k.id} className="flex items-center gap-2.5 rounded-md border border-border bg-card/40 px-3 py-2">
                  <Skull className="h-4 w-4 text-red-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{k.victimShipName ?? "Unknown"}</div>
                    <div className="text-xs text-muted-foreground truncate">{k.systemName} · {k.attackerCount} pilots</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
