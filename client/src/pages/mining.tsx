import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { 
  Pickaxe, 
  RefreshCw, 
  Calendar,
  Coins,
  AlertCircle,
  BarChart3,
  Gem,
  Clock,
  CalendarDays,
  CalendarRange,
  Layers,
  Sparkles,
  Trash2,
  RotateCcw,
  Settings2,
  Filter,
  Timer,
  Percent,
  Play,
  Pause,
  RotateCw,
  TrendingUp,
  Download
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useCharacterView } from "@/contexts/CharacterViewContext";
import { SmartTooltip } from "@/components/SmartTooltip";
import { EveIcon } from "@/components/EveIcon";
import { formatDistanceToNow } from "date-fns";
import { getMoonOreRarity, RARITY_COLORS, MoonOreRarity } from "@/lib/moon-ore-data";
import CompressionCalculator from "@/components/CompressionCalculator";

interface OreBreakdown {
  typeId: number;
  typeName: string;
  quantity: number;
  volume: number;
  sellPrice: number | null;
  buyPrice: number | null;
  totalSellValue: number | null;
  totalBuyValue: number | null;
  mineralYields: Record<string, number>;
}

interface MineralBreakdown {
  name: string;
  typeId: number;
  quantity: number;
  sellPrice: number;
  buyPrice: number;
  totalSellValue: number;
  totalBuyValue: number;
}

interface TimeAggregate {
  quantity: number;
  value: number;
}

interface DailyBreakdown {
  date: string;
  quantity: number;
  value: number;
  oreTypes: Record<number, number>;
}

interface MiningData {
  oreBreakdown: OreBreakdown[];
  mineralBreakdown: MineralBreakdown[];
  timeAggregates: {
    hourly: TimeAggregate;
    daily: TimeAggregate;
    weekly: TimeAggregate;
    monthly: TimeAggregate;
    total: TimeAggregate;
  };
  dailyBreakdown: DailyBreakdown[];
  summary: {
    totalEntries: number;
    totalQuantity: number;
    totalOreValue: number;
    totalMineralValue: number;
    uniqueOreTypes: number;
    uniqueMinerals: number;
  };
  lastUpdated: string;
  priceSource: string;
}

type TimePeriod = "hourly" | "daily" | "weekly" | "monthly";
type ViewMode = "ores" | "minerals" | "history" | "compression";

function formatISK(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0";
  if (value >= 1000000000) {
    return (value / 1000000000).toFixed(2) + "B";
  }
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + "M";
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + "K";
  }
  return value.toLocaleString();
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0";
  if (value >= 1000000000) {
    return (value / 1000000000).toFixed(2) + "B";
  }
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + "M";
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + "K";
  }
  return value.toLocaleString();
}

function formatVolume(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0 m³";
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + "M m³";
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + "K m³";
  }
  return value.toFixed(0) + " m³";
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { 
    month: "short", 
    day: "numeric",
    year: "numeric"
  });
}

const TIME_PERIOD_CONFIG: Record<TimePeriod, { label: string; icon: typeof Clock; description: string; days: number }> = {
  hourly: { label: "Last Hour", icon: Clock, description: "Past 60 minutes", days: 0 },
  daily: { label: "Today", icon: CalendarDays, description: "Last 24 hours", days: 1 },
  weekly: { label: "This Week", icon: CalendarRange, description: "Last 7 days", days: 7 },
  monthly: { label: "This Month", icon: Calendar, description: "Last 30 days", days: 30 },
};

const MINERAL_COLORS: Record<string, string> = {
  Tritanium: "bg-slate-500",
  Pyerite: "bg-amber-500",
  Mexallon: "bg-emerald-500",
  Isogen: "bg-cyan-500",
  Nocxium: "bg-purple-500",
  Zydrine: "bg-blue-500",
  Megacyte: "bg-rose-500",
  Morphite: "bg-violet-500",
};

function calculateMineralsFromOres(
  ores: OreBreakdown[], 
  yieldPercent: number,
  mineralPrices: MineralBreakdown[]
) {
  const mineralTotals: Record<string, number> = {};
  const yieldMultiplier = yieldPercent / 100;
  const priceMap = new Map(mineralPrices.map(m => [m.name, m]));
  
  for (const ore of ores) {
    if (ore.mineralYields) {
      for (const [mineral, baseAmount] of Object.entries(ore.mineralYields)) {
        mineralTotals[mineral] = (mineralTotals[mineral] || 0) + Math.floor(baseAmount * yieldMultiplier);
      }
    }
  }
  
  return Object.entries(mineralTotals)
    .map(([name, quantity]) => {
      const priceData = priceMap.get(name);
      return {
        name,
        typeId: priceData?.typeId || 0,
        quantity,
        sellPrice: priceData?.sellPrice || 0,
        buyPrice: priceData?.buyPrice || 0,
        totalSellValue: quantity * (priceData?.sellPrice || 0),
        totalBuyValue: quantity * (priceData?.buyPrice || 0),
      };
    })
    .filter(m => m.quantity > 0)
    .sort((a, b) => b.totalSellValue - a.totalSellValue);
}

function formatTimer(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function MiningPage() {
  const { isAuthenticated } = useAuth();
  const { viewMode: characterViewMode } = useCharacterView();
  const viewAll = characterViewMode === "all";
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("monthly");
  const [detailsTimePeriod, setDetailsTimePeriod] = useState<TimePeriod>("monthly");
  const [displayMode, setDisplayMode] = useState<ViewMode>("ores");
  const [reprocessYield, setReprocessYield] = useState<number>(() => {
    const saved = localStorage.getItem("photon-mining-reprocess-yield");
    return saved ? parseInt(saved) : 70;
  });
  const [reprocessInput, setReprocessInput] = useState<string>(() => {
    const saved = localStorage.getItem("photon-mining-reprocess-yield");
    return saved || "70";
  });
  const [excludedOres, setExcludedOres] = useState<Set<number>>(new Set());
  const [selectedOresForMinerals, setSelectedOresForMinerals] = useState<Set<number>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  
  const [sessionTimer, setSessionTimer] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const timerRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = window.setInterval(() => {
        setSessionTimer(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTimerRunning]);
  
  const handleReprocessYieldChange = useCallback((value: string) => {
    setReprocessInput(value);
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      setReprocessYield(numValue);
      localStorage.setItem("photon-mining-reprocess-yield", numValue.toString());
    }
  }, []);
  
  const handleReprocessYieldBlur = useCallback(() => {
    let numValue = parseInt(reprocessInput);
    if (isNaN(numValue)) numValue = 70;
    if (numValue < 30) numValue = 30;
    if (numValue > 90) numValue = 90;
    setReprocessYield(numValue);
    setReprocessInput(numValue.toString());
    localStorage.setItem("photon-mining-reprocess-yield", numValue.toString());
  }, [reprocessInput]);
  
  const toggleTimer = useCallback(() => {
    setIsTimerRunning(prev => !prev);
  }, []);
  
  const resetTimer = useCallback(() => {
    setSessionTimer(0);
    setIsTimerRunning(false);
  }, []);
  
  const { data: miningData, isLoading, error, refetch, isFetching } = useQuery<MiningData>({
    queryKey: ["/api/mining/valued", viewAll],
    queryFn: async () => {
      const res = await fetch(`/api/mining/valued?viewAll=${viewAll}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: Failed to fetch mining data`);
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000, // 2 minutes before considered stale
    refetchInterval: 3 * 60 * 1000, // Auto-refresh every 3 minutes
    refetchIntervalInBackground: false, // Only refresh when tab is focused
    retry: (failureCount, error: any) => {
      if (error?.status === 403) return false;
      return failureCount < 2;
    },
  });

  const isMissingScopeError = error && (
    (error as any)?.status === 403 || 
    (error as any)?.message?.includes("missing_scope") ||
    (error as any)?.message?.includes("403")
  );

  const defaultTimeAggregate = { quantity: 0, value: 0 };

  const filteredOreBreakdown = useMemo(() => {
    if (!miningData?.oreBreakdown) return [];
    return miningData.oreBreakdown.filter(ore => !excludedOres.has(ore.typeId));
  }, [miningData?.oreBreakdown, excludedOres]);

  const filteredDailyBreakdown = useMemo(() => {
    if (!miningData?.dailyBreakdown) return [];
    const now = new Date();
    const config = TIME_PERIOD_CONFIG[detailsTimePeriod];
    
    if (config.days === 0) {
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      return miningData.dailyBreakdown.filter(day => new Date(day.date) >= hourAgo);
    }
    
    const cutoffDate = new Date(now.getTime() - config.days * 24 * 60 * 60 * 1000);
    return miningData.dailyBreakdown.filter(day => new Date(day.date) >= cutoffDate);
  }, [miningData?.dailyBreakdown, detailsTimePeriod]);

  const timeFilteredOres = useMemo(() => {
    if (!miningData?.dailyBreakdown || !filteredOreBreakdown.length) return filteredOreBreakdown;
    
    const now = new Date();
    const config = TIME_PERIOD_CONFIG[detailsTimePeriod];
    let cutoffDate: Date;
    
    if (config.days === 0) {
      cutoffDate = new Date(now.getTime() - 60 * 60 * 1000);
    } else {
      cutoffDate = new Date(now.getTime() - config.days * 24 * 60 * 60 * 1000);
    }
    
    const oreQuantitiesInPeriod: Record<number, number> = {};
    for (const day of miningData.dailyBreakdown) {
      if (new Date(day.date) >= cutoffDate) {
        for (const [typeId, quantity] of Object.entries(day.oreTypes)) {
          const id = parseInt(typeId);
          oreQuantitiesInPeriod[id] = (oreQuantitiesInPeriod[id] || 0) + quantity;
        }
      }
    }
    
    return filteredOreBreakdown
      .map(ore => {
        const periodQuantity = oreQuantitiesInPeriod[ore.typeId] || 0;
        const quantityRatio = ore.quantity > 0 ? periodQuantity / ore.quantity : 0;
        
        const scaledMineralYields: Record<string, number> = {};
        if (ore.mineralYields) {
          for (const [mineral, amount] of Object.entries(ore.mineralYields)) {
            scaledMineralYields[mineral] = Math.floor(amount * quantityRatio);
          }
        }
        
        return {
          ...ore,
          quantity: periodQuantity,
          totalSellValue: ore.sellPrice ? periodQuantity * ore.sellPrice : null,
          totalBuyValue: ore.buyPrice ? periodQuantity * ore.buyPrice : null,
          mineralYields: scaledMineralYields,
        };
      })
      .filter(ore => ore.quantity > 0)
      .sort((a, b) => (b.totalSellValue || 0) - (a.totalSellValue || 0));
  }, [filteredOreBreakdown, miningData?.dailyBreakdown, detailsTimePeriod]);

  useEffect(() => {
    if (timeFilteredOres.length > 0 && selectedOresForMinerals.size === 0) {
      setSelectedOresForMinerals(new Set(timeFilteredOres.map(o => o.typeId)));
    }
  }, [timeFilteredOres]);

  const calculatedMinerals = useMemo(() => {
    const oresToUse = timeFilteredOres.filter(ore => selectedOresForMinerals.has(ore.typeId));
    const mineralTotals: Record<string, number> = {};
    const yieldMultiplier = reprocessYield / 100;
    
    for (const ore of oresToUse) {
      if (ore.mineralYields) {
        for (const [mineral, baseAmount] of Object.entries(ore.mineralYields)) {
          mineralTotals[mineral] = (mineralTotals[mineral] || 0) + Math.floor(baseAmount * yieldMultiplier);
        }
      }
    }
    
    const mineralPrices = miningData?.mineralBreakdown || [];
    const priceMap = new Map(mineralPrices.map(m => [m.name, m]));
    
    return Object.entries(mineralTotals)
      .map(([name, quantity]) => {
        const priceData = priceMap.get(name);
        return {
          name,
          typeId: priceData?.typeId || 0,
          quantity,
          sellPrice: priceData?.sellPrice || 0,
          buyPrice: priceData?.buyPrice || 0,
          totalSellValue: quantity * (priceData?.sellPrice || 0),
          totalBuyValue: quantity * (priceData?.buyPrice || 0),
        };
      })
      .filter(m => m.quantity > 0)
      .sort((a, b) => b.totalSellValue - a.totalSellValue);
  }, [timeFilteredOres, selectedOresForMinerals, reprocessYield, miningData?.mineralBreakdown]);

  const totalMineralValue = useMemo(() => {
    return calculatedMinerals.reduce((sum, m) => sum + m.totalSellValue, 0);
  }, [calculatedMinerals]);

  const projectedEarnings = useMemo(() => {
    if (!miningData?.timeAggregates) return null;
    
    const hourlyValue = miningData.timeAggregates.hourly?.value || 0;
    const dailyValue = miningData.timeAggregates.daily?.value || 0;
    const weeklyValue = miningData.timeAggregates.weekly?.value || 0;
    
    const hourlyRate = hourlyValue > 0 ? hourlyValue : (dailyValue / 24);
    
    return {
      perHour: hourlyRate,
      daily: hourlyRate * 24,
      weekly: hourlyRate * 24 * 7,
      monthly: hourlyRate * 24 * 30,
      basedOn: hourlyValue > 0 ? 'hourly' : 'daily',
    };
  }, [miningData?.timeAggregates]);

  const currentPeriodData = miningData?.timeAggregates?.[selectedPeriod] || defaultTimeAggregate;

  const exportToCSV = useCallback(() => {
    if (!miningData) return;
    
    const rows: string[][] = [];
    const allOres = miningData.oreBreakdown || [];
    const allDays = miningData.dailyBreakdown || [];
    
    rows.push(['Mining Export', `Generated: ${new Date().toLocaleString()}`]);
    rows.push([]);
    
    rows.push(['Export Settings']);
    rows.push(['Reprocess Yield', `${reprocessYield}%`]);
    rows.push(['Session Timer', formatTimer(sessionTimer)]);
    rows.push([]);
    
    rows.push(['Time Period Summary']);
    rows.push(['Period', 'Value (ISK)', 'Quantity']);
    (Object.keys(TIME_PERIOD_CONFIG) as TimePeriod[]).forEach(period => {
      const config = TIME_PERIOD_CONFIG[period];
      const data = miningData.timeAggregates?.[period] || { value: 0, quantity: 0 };
      rows.push([config.label, data.value.toString(), data.quantity.toString()]);
    });
    rows.push([]);
    
    rows.push(['Projected Earnings']);
    rows.push(['Rate', 'Value']);
    if (projectedEarnings) {
      rows.push(['ISK/Hour', projectedEarnings.perHour.toLocaleString()]);
      rows.push(['24 Hours', projectedEarnings.daily.toLocaleString()]);
      rows.push(['7 Days', projectedEarnings.weekly.toLocaleString()]);
      rows.push(['30 Days', projectedEarnings.monthly.toLocaleString()]);
    } else {
      rows.push(['No earnings data available', '']);
    }
    rows.push([]);
    
    rows.push(['Complete Ore Breakdown (All Data)']);
    rows.push(['Ore Name', 'Quantity', 'Sell Price/Unit', 'Total Value', 'Volume (m3)']);
    allOres.forEach(ore => {
      rows.push([
        ore.typeName,
        ore.quantity.toString(),
        (ore.sellPrice || 0).toString(),
        (ore.totalSellValue || 0).toString(),
        (ore.quantity * ore.volume).toFixed(2)
      ]);
    });
    rows.push([]);
    
    const allMinerals = calculateMineralsFromOres(allOres, reprocessYield, miningData.mineralBreakdown || []);
    rows.push(['Complete Mineral Breakdown (at ' + reprocessYield + '% yield)']);
    rows.push(['Mineral', 'Quantity', 'Sell Price/Unit', 'Total Value']);
    allMinerals.forEach(mineral => {
      rows.push([
        mineral.name,
        mineral.quantity.toString(),
        mineral.sellPrice.toString(),
        mineral.totalSellValue.toString()
      ]);
    });
    rows.push([]);
    
    rows.push(['Complete Daily History (All Data)']);
    rows.push(['Date', 'Day of Week', 'Quantity', 'Value (ISK)', 'Ore Types Count', '% Change']);
    allDays.forEach((day, index) => {
      const dayDate = new Date(day.date);
      const dayOfWeek = dayDate.toLocaleDateString('en-US', { weekday: 'long' });
      const prevDay = allDays[index + 1];
      const percentChange = prevDay && prevDay.value > 0 
        ? (((day.value - prevDay.value) / prevDay.value) * 100).toFixed(1)
        : 'N/A';
      rows.push([
        day.date,
        dayOfWeek,
        day.quantity.toString(),
        day.value.toString(),
        Object.keys(day.oreTypes).length.toString(),
        percentChange + '%'
      ]);
    });
    
    const csvContent = rows.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `mining-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [miningData, reprocessYield, sessionTimer, projectedEarnings]);

  const handleDeleteOre = (typeId: number) => {
    setExcludedOres(prev => new Set([...Array.from(prev), typeId]));
    setSelectedOresForMinerals(prev => {
      const next = new Set(Array.from(prev));
      next.delete(typeId);
      return next;
    });
  };

  const handleResetOres = () => {
    setExcludedOres(new Set());
    if (timeFilteredOres.length > 0) {
      setSelectedOresForMinerals(new Set(miningData?.oreBreakdown.map(o => o.typeId) || []));
    }
  };

  const handleToggleOreForMinerals = (typeId: number) => {
    setSelectedOresForMinerals(prev => {
      const next = new Set(prev);
      if (next.has(typeId)) {
        next.delete(typeId);
      } else {
        next.add(typeId);
      }
      return next;
    });
  };

  const handleSelectAllOresForMinerals = () => {
    setSelectedOresForMinerals(new Set(timeFilteredOres.map(o => o.typeId)));
  };

  const handleDeselectAllOresForMinerals = () => {
    setSelectedOresForMinerals(new Set());
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pickaxe className="w-5 h-5" />
              Mining Tracker
            </CardTitle>
            <CardDescription>
              Please log in to view your mining data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="w-full" data-testid="button-login-mining">
                Log in with EVE Online
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Pickaxe className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Mining Tracker</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Powered by Janice</span>
                {miningData?.lastUpdated && (
                  <>
                    <span className="text-muted-foreground/50">|</span>
                    <span className="flex items-center gap-1">
                      {isFetching ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3" />
                          <span data-testid="text-mining-last-updated">
                            Updated {formatDistanceToNow(new Date(miningData.lastUpdated), { addSuffix: true })}
                          </span>
                        </>
                      )}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              data-testid="button-settings-mining"
            >
              <Settings2 className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              onClick={exportToCSV}
              disabled={!miningData || isLoading}
              data-testid="button-export-mining"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button 
              variant="outline" 
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="button-refresh-mining"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {showSettings && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Reprocessing Yield: {reprocessYield}%
                  </label>
                  <Slider
                    value={[reprocessYield]}
                    onValueChange={(value) => {
                      setReprocessYield(value[0]);
                      setReprocessInput(value[0].toString());
                      localStorage.setItem("photon-mining-reprocess-yield", value[0].toString());
                    }}
                    min={30}
                    max={90}
                    step={1}
                    className="w-full max-w-xs"
                    data-testid="slider-reprocess-yield"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Adjust based on your skills and station (NPC: 50%, Citadel max: ~90%)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isMissingScopeError ? (
          <Card className="border-amber-500/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-500">
                <AlertCircle className="w-5 h-5" />
                Mining Permission Required
              </CardTitle>
              <CardDescription>
                Your current login doesn't have permission to access mining data.
                Please log out and log back in to grant the mining ledger permission.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                onClick={() => window.location.href = "/api/auth/logout"}
                data-testid="button-reauth-mining"
              >
                Log Out to Re-authenticate
              </Button>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : error ? (
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                Error Loading Mining Data
              </CardTitle>
              <CardDescription>
                {(error as any)?.message || "Failed to load mining data"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => refetch()} data-testid="button-retry-mining">
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : miningData ? (
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CalendarRange className="w-4 h-4" />
                  Time Period
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(Object.keys(TIME_PERIOD_CONFIG) as TimePeriod[]).map((period) => {
                    const config = TIME_PERIOD_CONFIG[period];
                    const Icon = config.icon;
                    const periodData = miningData.timeAggregates?.[period] || defaultTimeAggregate;
                    const isSelected = selectedPeriod === period;
                    
                    return (
                      <button
                        key={period}
                        onClick={() => setSelectedPeriod(period)}
                        className={`
                          p-4 rounded-lg border-2 transition-all text-left relative overflow-visible
                          ${isSelected 
                            ? 'border-primary bg-primary/10 shadow-[0_0_12px_rgba(var(--primary),0.3)]' 
                            : 'border-border/50 hover:border-border hover-elevate'
                          }
                        `}
                        data-testid={`period-${period}`}
                      >
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary" />
                        )}
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`p-1.5 rounded ${isSelected ? 'bg-primary/20' : 'bg-muted'}`}>
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
                          <span className={`text-sm font-semibold ${isSelected ? 'text-primary' : ''}`}>
                            {config.label}
                          </span>
                        </div>
                        <div className={`text-xl font-bold ${isSelected ? 'text-amber-400' : 'text-amber-500'}`}>
                          {formatISK(periodData.value)} ISK
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatNumber(periodData.quantity)} units mined
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Coins className="w-4 h-4" />
                    Ore Value ({TIME_PERIOD_CONFIG[selectedPeriod].label})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-500" data-testid="text-mining-ore-value">
                    {formatISK(currentPeriodData?.value || 0)} ISK
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sell immediately price
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Mineral Value ({selectedOresForMinerals.size} ores)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-500" data-testid="text-mining-mineral-value">
                    {formatISK(totalMineralValue)} ISK
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <SmartTooltip tooltipId="mining-reprocess" showIcon side="bottom">
                      <span className="text-xs text-muted-foreground">Repro:</span>
                    </SmartTooltip>
                    <div className="relative flex items-center">
                      <Input
                        type="text"
                        value={reprocessInput}
                        onChange={(e) => handleReprocessYieldChange(e.target.value)}
                        onBlur={handleReprocessYieldBlur}
                        className="w-14 h-7 text-sm text-center pr-5 font-mono"
                        data-testid="input-reprocess-yield"
                      />
                      <Percent className="w-3 h-3 absolute right-2 text-muted-foreground" />
                    </div>
                    <span className="text-xs text-muted-foreground">yield</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card className={isTimerRunning ? "border-primary/50" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Timer className="w-4 h-4" />
                    <SmartTooltip tooltipId="mining-timer" showIcon>
                      Session Timer
                    </SmartTooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div 
                    className={`text-2xl font-bold font-mono ${isTimerRunning ? "text-primary" : "text-muted-foreground"}`}
                    data-testid="text-session-timer"
                  >
                    {formatTimer(sessionTimer)}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      variant={isTimerRunning ? "secondary" : "default"}
                      size="sm"
                      onClick={toggleTimer}
                      className="h-7"
                      data-testid="button-toggle-timer"
                    >
                      {isTimerRunning ? (
                        <>
                          <Pause className="w-3 h-3 mr-1" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 mr-1" />
                          Start
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetTimer}
                      className="h-7"
                      data-testid="button-reset-timer"
                    >
                      <RotateCw className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {projectedEarnings && projectedEarnings.perHour > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Estimated Earnings (based on {projectedEarnings.basedOn} rate)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="text-xs text-muted-foreground mb-1">Per Hour</div>
                      <div className="text-lg font-bold text-cyan-500" data-testid="text-projected-hourly">
                        {formatISK(projectedEarnings.perHour)}
                      </div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="text-xs text-muted-foreground mb-1">24 Hours</div>
                      <div className="text-lg font-bold text-cyan-500" data-testid="text-projected-daily">
                        {formatISK(projectedEarnings.daily)}
                      </div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="text-xs text-muted-foreground mb-1">7 Days</div>
                      <div className="text-lg font-bold text-cyan-500" data-testid="text-projected-weekly">
                        {formatISK(projectedEarnings.weekly)}
                      </div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="text-xs text-muted-foreground mb-1">30 Days</div>
                      <div className="text-lg font-bold text-cyan-500" data-testid="text-projected-monthly">
                        {formatISK(projectedEarnings.monthly)}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-3">
                    Projections assume continuous mining at current rate
                  </p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-primary" />
                    Mining Details
                  </CardTitle>
                  <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
                      {(Object.keys(TIME_PERIOD_CONFIG) as TimePeriod[]).map((period) => {
                        const config = TIME_PERIOD_CONFIG[period];
                        const Icon = config.icon;
                        const isSelected = detailsTimePeriod === period;
                        return (
                          <Button
                            key={period}
                            variant={isSelected ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setDetailsTimePeriod(period)}
                            className={`h-8 px-3 gap-1.5 ${isSelected ? "" : "text-muted-foreground"}`}
                            data-testid={`details-period-${period}`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline text-xs">{config.label}</span>
                          </Button>
                        );
                      })}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant={displayMode === "ores" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setDisplayMode("ores")}
                        data-testid="view-ores"
                      >
                        <Gem className="w-4 h-4 mr-1" />
                        Ores
                      </Button>
                      <Button
                        variant={displayMode === "minerals" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setDisplayMode("minerals")}
                        data-testid="view-minerals"
                      >
                        <Sparkles className="w-4 h-4 mr-1" />
                        Minerals
                      </Button>
                      <Button
                        variant={displayMode === "history" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setDisplayMode("history")}
                        data-testid="view-history"
                      >
                        <BarChart3 className="w-4 h-4 mr-1" />
                        History
                      </Button>
                      <Button
                        variant={displayMode === "compression" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setDisplayMode("compression")}
                        data-testid="view-compression"
                      >
                        <Layers className="w-4 h-4 mr-1" />
                        Compress
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {displayMode === "ores" && (
                  <>
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <SmartTooltip tooltipId="mining-ores-selection" showIcon side="right">
                        <p className="text-sm text-muted-foreground">
                          {timeFilteredOres.length} ore types in {TIME_PERIOD_CONFIG[detailsTimePeriod].label.toLowerCase()}
                        </p>
                      </SmartTooltip>
                      <div className="flex gap-2">
                        {excludedOres.size > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResetOres}
                            data-testid="button-reset-ores"
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Reset ({excludedOres.size})
                          </Button>
                        )}
                      </div>
                    </div>
                    {timeFilteredOres.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Pickaxe className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No mining data found for {TIME_PERIOD_CONFIG[detailsTimePeriod].label.toLowerCase()}</p>
                        <p className="text-sm">Mining ledger updates approximately every 30 minutes</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-2 pr-4">
                          {timeFilteredOres.map((ore, index) => {
                            const maxValue = timeFilteredOres[0]?.totalSellValue || 1;
                            const percentage = ore.totalSellValue ? (ore.totalSellValue / maxValue) * 100 : 0;
                            const isSelectedForMinerals = selectedOresForMinerals.has(ore.typeId);
                            
                            return (
                              <div 
                                key={ore.typeId} 
                                className={`p-3 rounded-lg bg-muted/50 hover-elevate ${!isSelectedForMinerals ? 'opacity-60' : ''}`}
                                data-testid={`ore-item-${ore.typeId}`}
                              >
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <Checkbox
                                      checked={isSelectedForMinerals}
                                      onCheckedChange={() => handleToggleOreForMinerals(ore.typeId)}
                                      data-testid={`checkbox-ore-${ore.typeId}`}
                                    />
                                    <EveIcon typeId={ore.typeId} size={32} className="flex-shrink-0" alt={ore.typeName} />
                                    <span className="text-sm text-muted-foreground w-6 flex-shrink-0">
                                      #{index + 1}
                                    </span>
                                    <span className="font-medium truncate">
                                      {ore.typeName}
                                    </span>
                                    {(() => {
                                      const rarity = getMoonOreRarity(ore.typeId);
                                      if (rarity !== "Regular") {
                                        const colors = RARITY_COLORS[rarity];
                                        return (
                                          <Badge variant="outline" className={`text-xs ${colors.text} ${colors.border} ${colors.bg}`}>
                                            {rarity}
                                          </Badge>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <Badge variant="outline" className="font-mono">
                                      {formatNumber(ore.quantity)}
                                    </Badge>
                                    {ore.totalSellValue !== null && (
                                      <Badge className="bg-amber-500/10 text-amber-500 font-mono">
                                        {formatISK(ore.totalSellValue)} ISK
                                      </Badge>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => handleDeleteOre(ore.typeId)}
                                      data-testid={`button-delete-ore-${ore.typeId}`}
                                    >
                                      <Trash2 className="w-3 h-3 text-muted-foreground" />
                                    </Button>
                                  </div>
                                </div>
                                <Progress value={percentage} className="h-1" />
                                <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                                  <span>{formatVolume(ore.quantity * ore.volume)}</span>
                                  {ore.sellPrice && (
                                    <span>{formatISK(ore.sellPrice)}/unit</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    )}
                  </>
                )}

                {displayMode === "minerals" && (
                  <>
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <p className="text-sm text-muted-foreground">
                        Estimated minerals from {selectedOresForMinerals.size} selected ores @ {reprocessYield}% yield
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSelectAllOresForMinerals}
                          data-testid="button-select-all-ores"
                        >
                          Select All
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDeselectAllOresForMinerals}
                          data-testid="button-deselect-all-ores"
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                    {calculatedMinerals.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No mineral data calculated</p>
                        <p className="text-sm">Select ores in the Ores tab to calculate minerals</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-3 pr-4">
                          {calculatedMinerals.map((mineral) => {
                            const maxValue = calculatedMinerals[0]?.totalSellValue || 1;
                            const percentage = (mineral.totalSellValue / maxValue) * 100;
                            const colorClass = MINERAL_COLORS[mineral.name] || "bg-gray-500";
                            
                            return (
                              <div 
                                key={mineral.name} 
                                className="p-3 rounded-lg bg-muted/50 hover-elevate"
                                data-testid={`mineral-item-${mineral.name}`}
                              >
                                <div className="flex items-center justify-between gap-4 mb-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <EveIcon typeId={mineral.typeId} size={32} className="flex-shrink-0" alt={mineral.name} />
                                    <span className="font-medium truncate">
                                      {mineral.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <Badge variant="outline" className="font-mono">
                                      {formatNumber(mineral.quantity)}
                                    </Badge>
                                    <Badge className="bg-emerald-500/10 text-emerald-500 font-mono">
                                      {formatISK(mineral.totalSellValue)} ISK
                                    </Badge>
                                  </div>
                                </div>
                                <Progress value={percentage} className="h-1" />
                                <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                                  <span>At {reprocessYield}% yield</span>
                                  <span>{formatISK(mineral.sellPrice)}/unit</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    )}
                  </>
                )}

                {displayMode === "history" && (
                  <>
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <p className="text-sm text-muted-foreground">
                        {filteredDailyBreakdown.length} days in {TIME_PERIOD_CONFIG[detailsTimePeriod].label.toLowerCase()}
                      </p>
                      {filteredDailyBreakdown.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          Total: {formatISK(filteredDailyBreakdown.reduce((sum, d) => sum + d.value, 0))} ISK
                        </Badge>
                      )}
                    </div>
                    {filteredDailyBreakdown.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No mining history found for {TIME_PERIOD_CONFIG[detailsTimePeriod].label.toLowerCase()}</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-2 pr-4">
                          {filteredDailyBreakdown.map((day, index) => {
                            const maxValue = filteredDailyBreakdown[0]?.value || 1;
                            const percentage = maxValue > 0 ? (day.value / maxValue) * 100 : 0;
                            const dayDate = new Date(day.date);
                            const now = new Date();
                            const daysAgo = Math.floor((now.getTime() - dayDate.getTime()) / (1000 * 60 * 60 * 24));
                            const relativeTime = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`;
                            const oreCount = Object.keys(day.oreTypes).length;
                            const prevDay = filteredDailyBreakdown[index + 1];
                            const valueChange = prevDay ? ((day.value - prevDay.value) / prevDay.value) * 100 : 0;

                            return (
                              <div
                                key={day.date}
                                className="p-4 rounded-lg bg-muted/50 hover-elevate"
                                data-testid={`daily-item-${day.date}`}
                              >
                                <div className="flex items-start justify-between gap-4 mb-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Calendar className="w-4 h-4 text-muted-foreground" />
                                      <span className="font-medium">
                                        {formatDate(day.date)}
                                      </span>
                                      <Badge variant="outline" className="text-xs font-normal">
                                        {relativeTime}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <Gem className="w-3 h-3" />
                                        {oreCount} ore {oreCount === 1 ? 'type' : 'types'}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Layers className="w-3 h-3" />
                                        {formatNumber(day.quantity)} units
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                    <Badge className="bg-amber-500/10 text-amber-500 font-mono">
                                      {formatISK(day.value)} ISK
                                    </Badge>
                                    {prevDay && Math.abs(valueChange) > 0.1 && (
                                      <span className={`text-xs flex items-center gap-0.5 ${valueChange > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        <TrendingUp className={`w-3 h-3 ${valueChange < 0 ? 'rotate-180' : ''}`} />
                                        {valueChange > 0 ? '+' : ''}{valueChange.toFixed(0)}%
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <Progress value={percentage} className="h-1.5" />
                                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                                  <span className="font-mono">{dayDate.toLocaleDateString('en-US', { weekday: 'long' })}</span>
                                  <span>~{formatISK(day.value / 24)}/hr avg</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    )}
                  </>
                )}

                {displayMode === "compression" && (
                  <div className="h-[500px]">
                    <CompressionCalculator />
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="text-xs text-muted-foreground space-y-2">
                    <p className="font-medium">About Mining Data</p>
                    <p>
                      EVE Online's mining ledger is not updated in real-time. CCP's servers typically take 
                      <span className="font-medium text-foreground/80"> 30 minutes to several hours </span> 
                      to process and record mining activity. This is a limitation of the EVE API (ESI), not PHOTON.
                    </p>
                    <p>
                      PHOTON automatically checks for new data every 3 minutes. When ESI updates your ledger, 
                      you'll see it here.
                    </p>
                    <div className="pt-1 text-muted-foreground/70">
                      Prices: {miningData.priceSource} | Reprocessing: {reprocessYield}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
