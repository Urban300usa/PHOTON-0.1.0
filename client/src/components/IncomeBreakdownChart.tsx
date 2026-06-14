import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { PieChart as PieChartIcon, AlertCircle, Users, RefreshCw } from "lucide-react";
import { format, subDays } from "date-fns";
import { useCharacterView } from "@/contexts/CharacterViewContext";
import { formatISK } from "@/hooks/use-wallet";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
} from "recharts";

interface IncomeBreakdownChartProps {
  isAuthenticated: boolean;
  days?: number;
}

const COLORS = {
  bounty: "#22c55e",    // Green
  mission: "#3b82f6",   // Blue
  market: "#f59e0b",    // Amber
  industry: "#8b5cf6",  // Violet
  pi: "#14b8a6",        // Teal
  mining: "#f97316",    // Orange
  other: "#6b7280",     // Gray
};

const LABELS = {
  bounty: "Bounties",
  mission: "Missions",
  market: "Market",
  industry: "Industry",
  pi: "PI",
  mining: "Mining",
  other: "Other",
};

export default function IncomeBreakdownChart({ isAuthenticated, days = 30 }: IncomeBreakdownChartProps) {
  const { viewMode } = useCharacterView();

  const endDate = format(new Date(), "yyyy-MM-dd");
  const startDate = format(subDays(new Date(), days - 1), "yyyy-MM-dd");

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["income-breakdown", viewMode, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate,
        endDate,
        ...(viewMode === "all" ? { viewAll: "true" } : {}),
      });
      const response = await fetch(`/api/analytics/income/breakdown?${params}`);
      if (!response.ok) throw new Error("Failed to fetch income breakdown");
      return response.json();
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (!isAuthenticated) {
    return (
      <Card className="border-dashed h-full">
        <CardContent className="pt-6 h-full flex items-center justify-center">
          <div className="flex flex-col items-center justify-center text-center py-8">
            <PieChartIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Login with EVE Online to view income breakdown
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
          <CardTitle className="text-base font-medium">Income Sources</CardTitle>
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
            <p>Failed to load income breakdown</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const breakdown = data?.breakdown || {
    bounty: 0,
    mission: 0,
    market: 0,
    industry: 0,
    pi: 0,
    mining: 0,
    other: 0,
    total: 0,
  };

  // Prepare chart data
  const chartData = [
    { name: "Bounties", value: breakdown.bounty, key: "bounty" },
    { name: "Missions", value: breakdown.mission, key: "mission" },
    { name: "Market", value: breakdown.market, key: "market" },
    { name: "Industry", value: breakdown.industry, key: "industry" },
    { name: "PI", value: breakdown.pi, key: "pi" },
    { name: "Mining", value: breakdown.mining, key: "mining" },
    { name: "Other", value: breakdown.other, key: "other" },
  ].filter(d => d.value > 0);

  const hasData = chartData.length > 0;

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percentage = ((data.value / breakdown.total) * 100).toFixed(1);
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium">{data.name}</p>
          <p className="text-sm font-mono text-primary">{formatISK(data.value)}</p>
          <p className="text-xs text-muted-foreground">{percentage}% of total</p>
        </div>
      );
    }
    return null;
  };

  // Custom legend
  const renderLegend = (props: any) => {
    const { payload } = props;
    return (
      <div className="flex flex-wrap justify-center gap-2 mt-2">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-muted-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-medium">Income Sources</CardTitle>
          {viewMode === "all" && (
            <Badge variant="secondary" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              All
            </Badge>
          )}
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
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="text-center mb-2">
          <p className="text-xs text-muted-foreground">Last {days} days</p>
          <p className="text-lg font-mono font-bold text-primary">{formatISK(breakdown.total)}</p>
        </div>

        {hasData ? (
          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[entry.key as keyof typeof COLORS]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend content={renderLegend} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">No income data recorded</p>
          </div>
        )}

        {/* Income breakdown list */}
        {hasData && (
          <div className="mt-4 space-y-1">
            {chartData
              .sort((a, b) => b.value - a.value)
              .slice(0, 4)
              .map((entry) => (
                <div key={entry.key} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: COLORS[entry.key as keyof typeof COLORS] }}
                    />
                    <span className="text-muted-foreground">{entry.name}</span>
                  </div>
                  <span className="font-mono">{formatISK(entry.value)}</span>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
