import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  DollarSign,
  Calendar,
  BarChart3,
  Zap,
  Users,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Crosshair,
  Pickaxe,
  Factory,
  Globe,
  ShoppingCart,
  ScrollText,
  BookOpen,
  Shield,
  Send,
  Award,
  HelpCircle,
  ChevronDown,
} from "lucide-react";
import { format, subDays, parseISO } from "date-fns";
import { useCharacterView } from "@/contexts/CharacterViewContext";
import { useAuth } from "@/hooks/use-auth";
import { formatISK } from "@/hooks/use-wallet";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";

// ─── Constants ───────────────────────────────────────────────────────────────

type TimeRange = "7d" | "14d" | "30d" | "90d";

const TIME_RANGES: { value: TimeRange; label: string; days: number }[] = [
  { value: "7d", label: "7 Days", days: 7 },
  { value: "14d", label: "14 Days", days: 14 },
  { value: "30d", label: "30 Days", days: 30 },
  { value: "90d", label: "90 Days", days: 90 },
];

const SOURCE_COLORS: Record<string, string> = {
  bounty: "#22c55e",
  mission: "#3b82f6",
  market: "#f59e0b",
  industry: "#8b5cf6",
  pi: "#14b8a6",
  mining: "#f97316",
  contracts: "#ec4899",
  corporation: "#6366f1",
  insurance: "#06b6d4",
  transfers: "#84cc16",
  rewards: "#eab308",
  sovereignty: "#ef4444",
  other: "#6b7280",
};

const SOURCE_LABELS: Record<string, string> = {
  bounty: "Bounties",
  mission: "Missions",
  market: "Market",
  industry: "Industry",
  pi: "Planetary",
  mining: "Mining",
  contracts: "Contracts",
  corporation: "Corp",
  insurance: "Insurance",
  transfers: "Transfers",
  rewards: "Rewards",
  sovereignty: "Sovereignty",
  other: "Other",
};

const SOURCE_ICONS: Record<string, React.ElementType> = {
  bounty: Crosshair,
  mission: ScrollText,
  market: ShoppingCart,
  industry: Factory,
  pi: Globe,
  mining: Pickaxe,
  contracts: BookOpen,
  corporation: Shield,
  insurance: Shield,
  transfers: Send,
  rewards: Award,
  sovereignty: Shield,
  other: HelpCircle,
};

// The 7 core sources that match dailyIncomeSummary columns
const CORE_SOURCES = ["bounty", "mission", "market", "industry", "pi", "mining", "other"] as const;

// ─── Page Component ──────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { isAuthenticated } = useAuth();
  const { viewMode } = useCharacterView();
  const { toast } = useToast();
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [activeTab, setActiveTab] = useState("overview");

  const days = TIME_RANGES.find(t => t.value === timeRange)!.days;
  const endDate = format(new Date(), "yyyy-MM-dd");
  const startDate = format(subDays(new Date(), days - 1), "yyyy-MM-dd");

  // Previous period for trend comparison
  const prevEndDate = format(subDays(new Date(), days), "yyyy-MM-dd");
  const prevStartDate = format(subDays(new Date(), days * 2 - 1), "yyyy-MM-dd");

  const viewAll = viewMode === "all";

  // ─── Queries ─────────────────────────────────────────────────────────────

  const stackedQuery = useQuery({
    queryKey: ["analytics-stacked", viewAll, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate, ...(viewAll ? { viewAll: "true" } : {}) });
      const res = await fetch(`/api/analytics/income/stacked?${params}`);
      if (!res.ok) throw new Error("Failed to fetch stacked data");
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  const prevPeriodQuery = useQuery({
    queryKey: ["analytics-stacked-prev", viewAll, prevStartDate, prevEndDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate: prevStartDate, endDate: prevEndDate, ...(viewAll ? { viewAll: "true" } : {}) });
      const res = await fetch(`/api/analytics/income/stacked?${params}`);
      if (!res.ok) throw new Error("Failed to fetch previous period data");
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  const breakdownQuery = useQuery({
    queryKey: ["analytics-breakdown", viewAll, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate, ...(viewAll ? { viewAll: "true" } : {}) });
      const res = await fetch(`/api/analytics/income/breakdown?${params}`);
      if (!res.ok) throw new Error("Failed to fetch breakdown");
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  const characterQuery = useQuery({
    queryKey: ["analytics-characters", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await fetch(`/api/analytics/income/by-character?${params}`);
      if (!res.ok) throw new Error("Failed to fetch character data");
      return res.json();
    },
    enabled: isAuthenticated && activeTab === "characters",
    staleTime: 5 * 60 * 1000,
  });

  const journalQuery = useQuery({
    queryKey: ["analytics-journal", viewAll],
    queryFn: async () => {
      const params = new URLSearchParams(viewAll ? { viewAll: "true" } : {});
      const res = await fetch(`/api/analytics/journal?${params}`);
      if (!res.ok) throw new Error("Failed to fetch journal");
      return res.json();
    },
    enabled: isAuthenticated && activeTab === "journal",
    staleTime: 2 * 60 * 1000,
  });

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/analytics/income/recalculate", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to recalculate");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["analytics-stacked"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-stacked-prev"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-breakdown"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-characters"] });
      toast({ title: "Income Synced", description: `Updated ${data.daysUpdated} days from wallet journal.` });
    },
    onError: () => {
      toast({ title: "Sync Failed", description: "Could not sync income data from ESI.", variant: "destructive" });
    },
  });

  // ─── Computed Values ─────────────────────────────────────────────────────

  const stackedData = stackedQuery.data?.data || [];
  const prevData = prevPeriodQuery.data?.data || [];
  const breakdown = breakdownQuery.data?.breakdown || { bounty: 0, mission: 0, market: 0, industry: 0, pi: 0, mining: 0, other: 0, total: 0 };

  const totalIncome = breakdown.total;
  const prevTotal = prevData.reduce((sum: number, d: any) => sum + (d.total || 0), 0);
  const dailyAvg = days > 0 ? totalIncome / days : 0;

  const trendPercent = prevTotal > 0 ? ((totalIncome - prevTotal) / prevTotal) * 100 : 0;

  const bestDay = useMemo(() => {
    if (!stackedData.length) return { date: "", amount: 0 };
    return stackedData.reduce((best: any, d: any) => d.total > best.amount ? { date: d.date, amount: d.total } : best, { date: "", amount: 0 });
  }, [stackedData]);

  const activeSources = useMemo(() => {
    return CORE_SOURCES.filter(s => (breakdown as any)[s] > 0).length;
  }, [breakdown]);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="border-dashed max-w-md">
          <CardContent className="pt-6 text-center">
            <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Income Analytics</h2>
            <p className="text-muted-foreground">Login with EVE Online to view your income analytics and trends.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Income Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your ISK flow across all income sources
          </p>
        </div>
        <div className="flex items-center gap-3">
          {viewAll && (
            <Badge variant="secondary" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              All Characters
            </Badge>
          )}
          <div className="flex rounded-md border border-border overflow-hidden">
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  timeRange === range.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted text-muted-foreground"
                }`}
              >
                {range.value}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => recalculateMutation.mutate()}
            disabled={recalculateMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${recalculateMutation.isPending ? "animate-spin" : ""}`} />
            Sync from ESI
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Income"
          value={formatISK(totalIncome)}
          subtext={`Last ${days} days`}
          trend={trendPercent}
          icon={DollarSign}
          loading={stackedQuery.isLoading}
        />
        <StatCard
          title="Daily Average"
          value={formatISK(dailyAvg)}
          subtext="ISK per day"
          icon={Calendar}
          loading={stackedQuery.isLoading}
        />
        <StatCard
          title="Best Day"
          value={formatISK(bestDay.amount)}
          subtext={bestDay.date ? format(parseISO(bestDay.date), "MMM d, yyyy") : "No data"}
          icon={TrendingUp}
          loading={stackedQuery.isLoading}
        />
        <StatCard
          title="Active Sources"
          value={`${activeSources}`}
          subtext={`of ${CORE_SOURCES.length} income streams`}
          icon={Zap}
          loading={breakdownQuery.isLoading}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="characters">Characters</TabsTrigger>
          <TabsTrigger value="journal">Journal</TabsTrigger>
        </TabsList>

        {/* ─── Overview Tab ─── */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Stacked Area Chart - 2/3 width */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Income Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                {stackedQuery.isLoading ? (
                  <Skeleton className="h-[350px] w-full" />
                ) : (
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stackedData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                        <defs>
                          {CORE_SOURCES.map(source => (
                            <linearGradient key={source} id={`grad-${source}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={SOURCE_COLORS[source]} stopOpacity={0.4} />
                              <stop offset="95%" stopColor={SOURCE_COLORS[source]} stopOpacity={0.05} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          className="text-muted-foreground"
                          tickLine={false}
                          tickFormatter={(d) => format(parseISO(d), "MMM d")}
                          interval={days <= 14 ? 0 : days <= 30 ? 2 : 6}
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          className="text-muted-foreground"
                          tickLine={false}
                          tickFormatter={(v) => formatISK(v)}
                          width={65}
                        />
                        <Tooltip content={<StackedTooltip />} />
                        {CORE_SOURCES.map(source => (
                          <Area
                            key={source}
                            type="monotone"
                            dataKey={source}
                            stackId="1"
                            stroke={SOURCE_COLORS[source]}
                            fill={`url(#grad-${source})`}
                            strokeWidth={1.5}
                          />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Donut Chart - 1/3 width */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Income Sources</CardTitle>
              </CardHeader>
              <CardContent>
                {breakdownQuery.isLoading ? (
                  <Skeleton className="h-[350px] w-full" />
                ) : (
                  <BreakdownDonut breakdown={breakdown} />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Sources Tab ─── */}
        <TabsContent value="sources" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Income by Source</CardTitle>
            </CardHeader>
            <CardContent>
              {breakdownQuery.isLoading || stackedQuery.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : (
                <SourcesTable breakdown={breakdown} stackedData={stackedData} days={days} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Characters Tab ─── */}
        <TabsContent value="characters" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Per-Character Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {characterQuery.isLoading ? (
                <Skeleton className="h-[400px] w-full" />
              ) : characterQuery.data?.characters?.length > 1 ? (
                <CharacterComparison characters={characterQuery.data.characters} days={days} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Link additional characters to compare income across alts.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Journal Tab ─── */}
        <TabsContent value="journal" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Wallet Journal</CardTitle>
            </CardHeader>
            <CardContent>
              {journalQuery.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <JournalTable entries={journalQuery.data?.entries || []} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function StatCard({ title, value, subtext, trend, icon: Icon, loading }: {
  title: string;
  value: string;
  subtext: string;
  trend?: number;
  icon: React.ElementType;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-32 mb-1" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{title}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="text-2xl font-bold font-mono">{value}</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">{subtext}</span>
          {trend !== undefined && trend !== 0 && (
            <Badge
              variant="outline"
              className={`text-xs ${
                trend > 0
                  ? "bg-green-500/10 border-green-500/30 text-green-500"
                  : "bg-red-500/10 border-red-500/30 text-red-500"
              }`}
            >
              {trend > 0 ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
              {Math.abs(trend).toFixed(1)}%
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StackedTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((sum: number, p: any) => sum + (p.value || 0), 0);

  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg min-w-[180px]">
      <p className="text-sm font-medium mb-2">{label ? format(parseISO(label), "MMM d, yyyy") : ""}</p>
      <div className="space-y-1">
        {payload
          .filter((p: any) => p.value > 0)
          .sort((a: any, b: any) => b.value - a.value)
          .map((p: any) => (
            <div key={p.dataKey} className="flex items-center justify-between text-xs gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-muted-foreground">{SOURCE_LABELS[p.dataKey] || p.dataKey}</span>
              </div>
              <span className="font-mono">{formatISK(p.value)}</span>
            </div>
          ))}
      </div>
      <Separator className="my-2" />
      <div className="flex items-center justify-between text-xs font-medium">
        <span>Total</span>
        <span className="font-mono text-primary">{formatISK(total)}</span>
      </div>
    </div>
  );
}

function BreakdownDonut({ breakdown }: { breakdown: any }) {
  const chartData = CORE_SOURCES
    .map(key => ({
      name: SOURCE_LABELS[key],
      value: breakdown[key] || 0,
      key,
    }))
    .filter(d => d.value > 0);

  if (!chartData.length) {
    return (
      <div className="h-[350px] flex items-center justify-center text-muted-foreground">
        No income data recorded
      </div>
    );
  }

  const DonutTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0];
    const pct = ((data.value / breakdown.total) * 100).toFixed(1);
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium">{data.name}</p>
        <p className="text-sm font-mono text-primary">{formatISK(data.value)}</p>
        <p className="text-xs text-muted-foreground">{pct}% of total</p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-xs text-muted-foreground">Total Income</p>
        <p className="text-2xl font-mono font-bold text-primary">{formatISK(breakdown.total)}</p>
      </div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={85}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={SOURCE_COLORS[entry.key]} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-1.5">
        {chartData
          .sort((a, b) => b.value - a.value)
          .map(entry => {
            const pct = ((entry.value / breakdown.total) * 100).toFixed(1);
            return (
              <div key={entry.key} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SOURCE_COLORS[entry.key] }} />
                  <span className="text-muted-foreground">{entry.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{pct}%</span>
                  <span className="font-mono text-sm">{formatISK(entry.value)}</span>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function SourcesTable({ breakdown, stackedData, days }: { breakdown: any; stackedData: any[]; days: number }) {
  const sources = CORE_SOURCES
    .map(key => {
      const total = (breakdown as any)[key] || 0;
      const pct = breakdown.total > 0 ? (total / breakdown.total) * 100 : 0;
      const dailyAvg = days > 0 ? total / days : 0;

      // Mini sparkline data
      const sparkData = stackedData.map((d: any) => (d as any)[key] || 0);

      return { key, total, pct, dailyAvg, sparkData };
    })
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-1">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_100px_80px_100px_100px] gap-2 text-xs text-muted-foreground font-medium px-3 py-2">
        <span>Source</span>
        <span className="text-right">Total</span>
        <span className="text-right">Share</span>
        <span className="text-right">Daily Avg</span>
        <span className="text-right">Trend</span>
      </div>
      <Separator />
      {sources.map(source => {
        const Icon = SOURCE_ICONS[source.key] || HelpCircle;
        // Simple sparkline via bar heights
        const maxVal = Math.max(...source.sparkData, 1);

        return (
          <div
            key={source.key}
            className="grid grid-cols-[1fr_100px_80px_100px_100px] gap-2 items-center px-3 py-3 rounded-md hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SOURCE_COLORS[source.key] }} />
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">{SOURCE_LABELS[source.key]}</span>
            </div>
            <span className="text-right font-mono text-sm">{formatISK(source.total)}</span>
            <span className="text-right text-sm text-muted-foreground">{source.pct.toFixed(1)}%</span>
            <span className="text-right font-mono text-sm text-muted-foreground">{formatISK(source.dailyAvg)}</span>
            <div className="flex items-end justify-end gap-px h-6">
              {source.sparkData.slice(-14).map((val: number, i: number) => (
                <div
                  key={i}
                  className="w-1 rounded-t-sm"
                  style={{
                    height: `${Math.max((val / maxVal) * 100, 4)}%`,
                    backgroundColor: source.total > 0 ? SOURCE_COLORS[source.key] : "hsl(var(--muted))",
                    opacity: 0.5 + (i / 14) * 0.5,
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}
      <Separator />
      <div className="grid grid-cols-[1fr_100px_80px_100px_100px] gap-2 items-center px-3 py-3 font-medium">
        <span className="text-sm">Total</span>
        <span className="text-right font-mono text-sm text-primary">{formatISK(breakdown.total)}</span>
        <span className="text-right text-sm">100%</span>
        <span className="text-right font-mono text-sm">{formatISK(days > 0 ? breakdown.total / days : 0)}</span>
        <span />
      </div>
    </div>
  );
}

function CharacterComparison({ characters, days }: { characters: any[]; days: number }) {
  // Bar chart data
  const barData = characters
    .filter((c: any) => c.total > 0)
    .sort((a: any, b: any) => b.total - a.total);

  return (
    <div className="space-y-6">
      {barData.length > 0 && (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="characterName" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatISK(v)} width={65} className="text-muted-foreground" />
              <Tooltip content={<CharTooltip />} />
              <Bar dataKey="bounty" stackId="a" fill={SOURCE_COLORS.bounty} name="Bounties" />
              <Bar dataKey="mission" stackId="a" fill={SOURCE_COLORS.mission} name="Missions" />
              <Bar dataKey="market" stackId="a" fill={SOURCE_COLORS.market} name="Market" />
              <Bar dataKey="industry" stackId="a" fill={SOURCE_COLORS.industry} name="Industry" />
              <Bar dataKey="pi" stackId="a" fill={SOURCE_COLORS.pi} name="PI" />
              <Bar dataKey="mining" stackId="a" fill={SOURCE_COLORS.mining} name="Mining" />
              <Bar dataKey="other" stackId="a" fill={SOURCE_COLORS.other} name="Other" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Character table */}
      <div className="space-y-1">
        <div className="grid grid-cols-[1fr_100px_100px_100px] gap-2 text-xs text-muted-foreground font-medium px-3 py-2">
          <span>Character</span>
          <span className="text-right">Total</span>
          <span className="text-right">Share</span>
          <span className="text-right">Daily Avg</span>
        </div>
        <Separator />
        {characters
          .sort((a: any, b: any) => b.total - a.total)
          .map((char: any) => {
            const grandTotal = characters.reduce((s: number, c: any) => s + c.total, 0);
            const pct = grandTotal > 0 ? (char.total / grandTotal) * 100 : 0;
            return (
              <div key={char.characterId} className="grid grid-cols-[1fr_100px_100px_100px] gap-2 items-center px-3 py-3 rounded-md hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <img
                    src={`https://images.evetech.net/characters/${char.characterId}/portrait?size=32`}
                    alt={char.characterName}
                    className="w-6 h-6 rounded-full"
                  />
                  <span className="font-medium text-sm">{char.characterName}</span>
                </div>
                <span className="text-right font-mono text-sm">{formatISK(char.total)}</span>
                <span className="text-right text-sm text-muted-foreground">{pct.toFixed(1)}%</span>
                <span className="text-right font-mono text-sm text-muted-foreground">{formatISK(days > 0 ? char.total / days : 0)}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function CharTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0);
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
      <p className="text-sm font-medium mb-2">{label}</p>
      {payload
        .filter((p: any) => p.value > 0)
        .sort((a: any, b: any) => b.value - a.value)
        .map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between text-xs gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-muted-foreground">{p.name}</span>
            </div>
            <span className="font-mono">{formatISK(p.value)}</span>
          </div>
        ))}
      <Separator className="my-2" />
      <div className="flex justify-between text-xs font-medium">
        <span>Total</span>
        <span className="font-mono text-primary">{formatISK(total)}</span>
      </div>
    </div>
  );
}

function JournalTable({ entries }: { entries: any[] }) {
  const [filter, setFilter] = useState<string>("all");
  const [showCount, setShowCount] = useState(50);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    entries.forEach(e => cats.add(e.category));
    return Array.from(cats).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    if (filter === "all") return entries;
    if (filter === "income") return entries.filter(e => e.amount > 0);
    if (filter === "expenses") return entries.filter(e => e.amount < 0);
    return entries.filter(e => e.category === filter);
  }, [entries, filter]);

  const totals = useMemo(() => {
    const income = filtered.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0);
    const expenses = filtered.filter(e => e.amount < 0).reduce((s, e) => s + e.amount, 0);
    return { income, expenses, net: income + expenses };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entries</SelectItem>
            <SelectItem value="income">Income Only</SelectItem>
            <SelectItem value="expenses">Expenses Only</SelectItem>
            <Separator className="my-1" />
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{SOURCE_LABELS[cat] || cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-4 ml-auto text-xs">
          <span className="text-muted-foreground">{filtered.length} entries</span>
          <Badge variant="outline" className="bg-green-500/10 border-green-500/30 text-green-500">
            <ArrowUpRight className="h-3 w-3 mr-0.5" />
            {formatISK(totals.income)}
          </Badge>
          <Badge variant="outline" className="bg-red-500/10 border-red-500/30 text-red-500">
            <ArrowDownRight className="h-3 w-3 mr-0.5" />
            {formatISK(Math.abs(totals.expenses))}
          </Badge>
          <Badge variant="outline">
            Net: {formatISK(totals.net)}
          </Badge>
        </div>
      </div>

      {/* Journal entries */}
      <div className="space-y-0.5 max-h-[600px] overflow-y-auto">
        <div className="grid grid-cols-[140px_1fr_90px_110px] gap-2 text-xs text-muted-foreground font-medium px-3 py-2 sticky top-0 bg-background z-10">
          <span>Date</span>
          <span>Description</span>
          <span className="text-right">Category</span>
          <span className="text-right">Amount</span>
        </div>
        <Separator />
        {filtered.slice(0, showCount).map((entry, i) => {
          const isPositive = entry.amount > 0;
          const CatIcon = SOURCE_ICONS[entry.category] || HelpCircle;
          return (
            <div
              key={`${entry.id}-${i}`}
              className="grid grid-cols-[140px_1fr_90px_110px] gap-2 items-center px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-sm"
            >
              <span className="text-xs text-muted-foreground font-mono">
                {format(new Date(entry.date), "MMM d HH:mm")}
              </span>
              <span className="truncate text-sm" title={entry.description || entry.reason || entry.ref_type}>
                {entry.description || entry.reason || entry.ref_type}
              </span>
              <div className="flex items-center justify-end gap-1">
                <CatIcon className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{SOURCE_LABELS[entry.category] || entry.category}</span>
              </div>
              <span className={`text-right font-mono text-sm ${isPositive ? "text-green-500" : "text-red-400"}`}>
                {isPositive ? "+" : ""}{formatISK(entry.amount)}
              </span>
            </div>
          );
        })}
      </div>

      {filtered.length > showCount && (
        <div className="text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCount(prev => prev + 50)}
          >
            <ChevronDown className="h-4 w-4 mr-1" />
            Show More ({filtered.length - showCount} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}
