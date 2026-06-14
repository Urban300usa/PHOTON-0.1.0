import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { LineChart, TrendingUp, AlertCircle, Users, RefreshCw } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { useCharacterView } from "@/contexts/CharacterViewContext";
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
import { useState } from "react";

interface IncomeChartProps {
  isAuthenticated: boolean;
  days?: number;
}

type TimeRange = "7d" | "14d" | "30d";

export default function IncomeChart({ isAuthenticated, days = 7 }: IncomeChartProps) {
  const { viewMode } = useCharacterView();
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");

  const effectiveDays = timeRange === "7d" ? 7 : timeRange === "14d" ? 14 : 30;
  const endDate = format(new Date(), "yyyy-MM-dd");
  const startDate = format(subDays(new Date(), effectiveDays - 1), "yyyy-MM-dd");

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["income-chart", viewMode, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate,
        endDate,
        ...(viewMode === "all" ? { viewAll: "true" } : {}),
      });
      const response = await fetch(`/api/analytics/income?${params}`);
      if (!response.ok) throw new Error("Failed to fetch income data");
      return response.json();
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // 1 minute
  });

  if (!isAuthenticated) {
    return (
      <Card className="border-dashed h-full">
        <CardContent className="pt-6 h-full flex items-center justify-center">
          <div className="flex flex-col items-center justify-center text-center py-8">
            <LineChart className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Login with EVE Online to view income charts
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Income Trend</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive h-full">
        <CardContent className="pt-6 h-full flex items-center justify-center">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>Failed to load income data</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Process data for chart
  const chartData = [];
  const rawData = data?.data || [];

  // Create a map of date -> income
  const incomeByDate = new Map<string, number>();
  for (const entry of rawData) {
    const existing = incomeByDate.get(entry.date) || 0;
    incomeByDate.set(entry.date, existing + (entry.totalIncome || 0));
  }

  // Fill in all days
  for (let i = effectiveDays - 1; i >= 0; i--) {
    const date = format(subDays(new Date(), i), "yyyy-MM-dd");
    chartData.push({
      date,
      label: format(new Date(date), "MMM d"),
      income: incomeByDate.get(date) || 0,
    });
  }

  // Calculate totals
  const totalIncome = chartData.reduce((sum, d) => sum + d.income, 0);
  const avgDaily = totalIncome / effectiveDays;

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-sm text-primary font-mono">
            {formatISK(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-medium">Income Trend</CardTitle>
          {viewMode === "all" && (
            <Badge variant="secondary" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              All
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border overflow-hidden">
            {(["7d", "14d", "30d"] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2 py-1 text-xs ${
                  timeRange === range
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="flex items-center gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground">Total ({effectiveDays}d)</p>
            <p className="text-lg font-mono font-bold text-primary">{formatISK(totalIncome)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Daily Avg</p>
            <p className="text-lg font-mono font-bold">{formatISK(avgDaily)}</p>
          </div>
        </div>

        <div className="flex-1 min-h-[150px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
                tickLine={false}
                tickFormatter={(value) => formatISK(value)}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="income"
                stroke="hsl(var(--primary))"
                fill="url(#incomeGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
