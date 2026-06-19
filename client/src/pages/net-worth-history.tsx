import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, AlertCircle, BarChart3 } from "lucide-react";
import { format, parseISO, subDays } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/PageHeader";
import { formatISK } from "@/hooks/use-wallet";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface NetWorthSnapshot {
  date: string;
  totalValue: number;
}

type DaysRange = 30 | 60 | 90 | 365;

const RANGES: { value: DaysRange; label: string }[] = [
  { value: 30, label: "30d" },
  { value: 60, label: "60d" },
  { value: 90, label: "90d" },
  { value: 365, label: "1y" },
];

function formatYAxis(value: number): string {
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  return `${value.toFixed(0)}`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-md px-3 py-2 shadow-lg text-sm">
      <p className="text-muted-foreground text-xs mb-1">{label}</p>
      <p className="font-bold text-foreground">{formatISK(payload[0].value)}</p>
    </div>
  );
}

export default function NetWorthHistoryPage() {
  const { isAuthenticated } = useAuth();
  const [days, setDays] = useState<DaysRange>(90);

  const historyQuery = useQuery<NetWorthSnapshot[]>({
    queryKey: ["/api/analytics/net-worth/history", days],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/net-worth/history?days=${days}`);
      if (!res.ok) throw new Error("Failed to fetch net worth history");
      const data = await res.json();
      // Endpoint returns { history: [...] }; tolerate a bare array too.
      return Array.isArray(data) ? data : (data?.history ?? []);
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  // Auto-snapshot on page load
  useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/analytics/net-worth/snapshot", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to save snapshot");
      return res.json();
    },
  });

  const history = historyQuery.data ?? [];

  const chartData = useMemo(() => {
    return [...history]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        date: format(parseISO(d.date), "MMM d"),
        rawDate: d.date,
        value: d.totalValue,
      }));
  }, [history]);

  const latestValue = chartData.length > 0 ? chartData[chartData.length - 1].value : 0;
  const latestDate = chartData.length > 0 ? chartData[chartData.length - 1].rawDate : null;

  // Change vs 30d ago
  const thirtyDaysAgoDate = format(subDays(new Date(), 30), "yyyy-MM-dd");
  const thirtyDaysAgoEntry = chartData.find((d) => d.rawDate >= thirtyDaysAgoDate);
  const change30d = thirtyDaysAgoEntry ? latestValue - thirtyDaysAgoEntry.value : null;
  const change30dPct =
    change30d !== null && thirtyDaysAgoEntry && thirtyDaysAgoEntry.value > 0
      ? (change30d / thirtyDaysAgoEntry.value) * 100
      : null;

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="border-dashed max-w-md">
          <CardContent className="pt-6 text-center">
            <TrendingUp className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Net Worth History</h2>
            <p className="text-muted-foreground">Login with EVE Online to view your net worth history.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1200px] mx-auto">
      <PageHeader
        icon={TrendingUp}
        title="Net Worth History"
        subtitle="Your total asset value over time"
        actions={
          <div className="flex rounded-md border border-border overflow-hidden">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setDays(r.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  days === r.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted text-muted-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground font-normal">
              Current Net Worth
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historyQuery.isLoading ? (
              <Skeleton className="h-9 w-48" />
            ) : (
              <>
                <p className="text-3xl font-bold">{latestValue > 0 ? formatISK(latestValue) : "—"}</p>
                {latestDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Snapshot: {format(parseISO(latestDate), "MMM d, yyyy")}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground font-normal">
              Change (30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historyQuery.isLoading ? (
              <Skeleton className="h-9 w-40" />
            ) : change30d === null ? (
              <p className="text-muted-foreground text-sm">Not enough history</p>
            ) : (
              <div className="flex items-center gap-2">
                {change30d >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-400" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-400" />
                )}
                <p className={`text-3xl font-bold ${change30d >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {change30d >= 0 ? "+" : ""}
                  {formatISK(change30d)}
                </p>
                {change30dPct !== null && (
                  <Badge
                    variant="outline"
                    className={`ml-1 ${
                      change30d >= 0
                        ? "border-green-500/40 text-green-400"
                        : "border-red-500/40 text-red-400"
                    }`}
                  >
                    {change30dPct >= 0 ? "+" : ""}
                    {change30dPct.toFixed(1)}%
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Net Worth Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {historyQuery.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : historyQuery.isError ? (
            <div className="h-64 flex items-center justify-center">
              <div className="text-center">
                <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
                <p className="text-muted-foreground">Failed to load history.</p>
              </div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-muted-foreground">Your net worth will be tracked automatically each time you visit Assets.</p>
                <p className="text-xs text-muted-foreground mt-1">Check back after viewing your assets.</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={formatYAxis}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#netWorthGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#8b5cf6" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
