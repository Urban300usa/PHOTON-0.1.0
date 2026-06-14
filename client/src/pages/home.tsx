import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import StatCard from "@/components/StatCard";
import SessionControls from "@/components/SessionControls";
import IncomeEntry from "@/components/IncomeEntry";
import SessionHistory from "@/components/SessionHistory";
import WalletOverview from "@/components/WalletOverview";
import DashboardGrid from "@/components/DashboardGrid";
import CharacterStatus from "@/components/CharacterStatus";
import PlexGoalTracker from "@/components/PlexGoalTracker";
import IncomeGoals from "@/components/IncomeGoals";
import AchievementsList from "@/components/AchievementsList";
import SpecialBadges from "@/components/SpecialBadges";
import CorpTaxSettings from "@/components/CorpTaxSettings";
import LootTracker from "@/components/LootTracker";
import Leaderboard from "@/components/Leaderboard";
import ShareableSessionCard from "@/components/ShareableSessionCard";
import TileLibrary, { getVisibleTileIds, setVisibleTileIds } from "@/components/TileLibrary";
import TutorialOverlay from "@/components/TutorialOverlay";
import { ProFeatureGate, ProLockedOverlay } from "@/components/ProFeatureGate";
import { useProContext } from "@/contexts/ProContext";
import { TutorialProvider } from "@/contexts/TutorialContext";
import { useSidebarActions } from "@/contexts/SidebarActionsContext";
import { useWhatsNew } from "@/contexts/WhatsNewContext";
import { Wallet, Clock, TrendingUp, Target, Crosshair, Timer, Rocket, Sparkles, Trophy, Award, Package, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface IncomeEntryType {
  id: string;
  amount: number;
  timestamp: Date;
}

interface Session {
  id: string;
  date: Date;
  duration: number;
  totalIsk: number;
  bountyIsk: number;
  lootIsk: number;
  iskPerHour: number;
  kills: number;
}

function formatISK(value: number): string {
  if (value >= 1000000000) {
    return (value / 1000000000).toFixed(2) + "B";
  }
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + "M";
  }
  return value.toLocaleString();
}

const FALLBACK_VERSION = "0.3.0-dev";

export default function Home() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const { isPro } = useProContext();

  const { data: latestChangelog } = useQuery<{ changelog: { version: string } | null }>({
    queryKey: ["/api/changelog/latest"],
    staleTime: 5 * 60 * 1000,
  });

  const currentVersion = latestChangelog?.changelog?.version || FALLBACK_VERSION;
  const { 
    exportTriggered,
    resetExportTrigger
  } = useSidebarActions();
  const { autoShowWhatsNew } = useWhatsNew();
  
  useEffect(() => {
    autoShowWhatsNew();
  }, []);
  const [currentSessionIsk, setCurrentSessionIsk] = useState(0);
  const [currentSessionKills, setCurrentSessionKills] = useState(0);
  const [currentSessionLootIsk, setCurrentSessionLootIsk] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [recentEntries, setRecentEntries] = useState<IncomeEntryType[]>([]);
  
  const [sessions, setSessions] = useState<Session[]>([]);
  
  const [visibleTiles, setVisibleTiles] = useState<Set<string>>(() => getVisibleTileIds());
  
  // Toggle for including loot in total ISK calculations
  const [includeLootInTotal, setIncludeLootInTotal] = useState<boolean>(() => {
    const saved = localStorage.getItem('photon_includeLootInTotal');
    return saved !== null ? JSON.parse(saved) : true; // Default to including loot
  });

  useEffect(() => {
    localStorage.setItem('photon_includeLootInTotal', JSON.stringify(includeLootInTotal));
  }, [includeLootInTotal]);

  // Query active session from backend to sync loot values
  // Always query when authenticated - backend session may exist even if local state is inactive
  interface ActiveSessionData {
    session: {
      id: string;
      lootIsk: number;
      bountyIsk: number;
      totalIsk: number;
      isActive: boolean;
    } | null;
  }
  
  const { data: activeSessionData, refetch: refetchActiveSession } = useQuery<ActiveSessionData>({
    queryKey: ["/api/sessions/active"],
    enabled: isAuthenticated,
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Sync loot from backend active session
  useEffect(() => {
    if (activeSessionData?.session && activeSessionData.session.isActive) {
      setCurrentSessionLootIsk(activeSessionData.session.lootIsk || 0);
      // Also sync with backend session state if it exists
      if (!isSessionActive && activeSessionData.session.isActive) {
        // Backend has an active session but local state doesn't - sync it
        setIsSessionActive(true);
      }
    } else if (activeSessionData !== undefined && !activeSessionData?.session) {
      // Backend returned null session - clear stale loot values
      setCurrentSessionLootIsk(0);
    }
  }, [activeSessionData?.session?.lootIsk, activeSessionData?.session?.isActive, activeSessionData, isSessionActive]);

  const handleTileVisibilityChange = useCallback((tileId: string, visible: boolean) => {
    setVisibleTiles(prev => {
      const next = new Set(Array.from(prev));
      if (visible) {
        next.add(tileId);
      } else {
        next.delete(tileId);
      }
      setVisibleTileIds(next);
      return next;
    });
  }, []);
  
  // Track last seen bounty for auto-detection
  const lastSeenBountyRef = useRef<string | null>(null);
  const MIN_BOUNTY_FOR_AUTO_START = 2000000; // 2M ISK minimum

  // Auto-start session when bounty over 2M ISK is detected
  useEffect(() => {
    if (!isAuthenticated || isSessionActive) return;

    const checkForBounties = async () => {
      try {
        const response = await fetch('/api/wallet/bounties');
        if (!response.ok) return;
        
        const data = await response.json();
        if (!data.bounties || data.bounties.length === 0) return;
        
        const latestBounty = data.bounties[0];
        
        // Check if this is a new bounty we haven't seen
        if (latestBounty.id !== lastSeenBountyRef.current) {
          // Update last seen
          lastSeenBountyRef.current = latestBounty.id;
          
          // Check if bounty is over 2M ISK and auto-start session
          if (latestBounty.amount >= MIN_BOUNTY_FOR_AUTO_START) {
            setIsSessionActive(true);
            setSessionStartTime(new Date(latestBounty.date));
            setCurrentSessionIsk(latestBounty.amount);
            setCurrentSessionKills(1);
            setRecentEntries([{
              id: latestBounty.id.toString(),
              amount: latestBounty.amount,
              timestamp: new Date(latestBounty.date)
            }]);
            toast({
              title: "Session Auto-Started",
              description: `Detected ${formatISK(latestBounty.amount)} ISK bounty. Session started automatically!`,
            });
          }
        }
      } catch (error) {
        // Silently fail - user may not be authenticated or API unavailable
      }
    };

    // Check immediately and then every 30 seconds
    checkForBounties();
    const interval = setInterval(checkForBounties, 30000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated, isSessionActive, toast]);

  // Calculate total ISK - when toggle is off, subtract loot from totals
  // Backend sessions store totalIsk which already includes lootIsk, so we subtract when toggle is off
  const calculateEffectiveIsk = (session: Session) => {
    if (includeLootInTotal) {
      return session.totalIsk;
    }
    return session.totalIsk - (session.lootIsk || 0);
  };
  
  const historicalIsk = sessions.reduce((sum, s) => sum + calculateEffectiveIsk(s), 0);
  const currentEffectiveIsk = includeLootInTotal 
    ? currentSessionIsk + currentSessionLootIsk
    : currentSessionIsk;
  const totalAllTimeIsk = historicalIsk + currentEffectiveIsk;
  
  const totalTimeRatted = sessions.reduce((sum, s) => sum + s.duration, 0);
  const averageIskPerHour = sessions.length > 0 
    ? sessions.reduce((sum, s) => sum + s.iskPerHour, 0) / sessions.length 
    : 0;

  const calculateCurrentIskPerHour = useCallback(() => {
    if (!sessionStartTime || currentSessionIsk === 0) return 0;
    const hoursElapsed = (new Date().getTime() - sessionStartTime.getTime()) / 3600000;
    if (hoursElapsed < 0.01) return 0;
    return currentSessionIsk / hoursElapsed;
  }, [sessionStartTime, currentSessionIsk]);

  const handleSessionStart = () => {
    setIsSessionActive(true);
    setSessionStartTime(new Date());
    setCurrentSessionIsk(0);
    setCurrentSessionKills(0);
    setCurrentSessionLootIsk(0);
    setRecentEntries([]);
    toast({
      title: "Session Started",
      description: "Your ratting session has begun. Good hunting!",
    });
  };

  const handleSessionStop = () => {
    if (sessionStartTime && (currentSessionIsk > 0 || currentSessionLootIsk > 0)) {
      const duration = Math.floor((new Date().getTime() - sessionStartTime.getTime()) / 1000);
      const totalSessionIsk = currentSessionIsk + currentSessionLootIsk;
      const iskPerHour = duration > 0 ? (totalSessionIsk / duration) * 3600 : 0;
      
      const newSession: Session = {
        id: Date.now().toString(),
        date: sessionStartTime,
        duration,
        totalIsk: totalSessionIsk,
        bountyIsk: currentSessionIsk,
        lootIsk: currentSessionLootIsk,
        iskPerHour: Math.floor(iskPerHour),
        kills: currentSessionKills,
      };
      
      setSessions(prev => [newSession, ...prev]);
      toast({
        title: "Session Saved",
        description: `Earned ${formatISK(totalSessionIsk)} ISK in this session.`,
      });
    }
    
    setIsSessionActive(false);
    setSessionStartTime(null);
    setCurrentSessionIsk(0);
    setCurrentSessionKills(0);
    setCurrentSessionLootIsk(0);
  };

  const handleAddIncome = (amount: number) => {
    setCurrentSessionIsk(prev => prev + amount);
    setCurrentSessionKills(prev => prev + 1);
    setRecentEntries(prev => [
      { id: Date.now().toString(), amount, timestamp: new Date() },
      ...prev.slice(0, 9)
    ]);
  };

  const handleDeleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    toast({
      title: "Session Deleted",
      description: "The session has been removed from history.",
    });
  };

  const handleExportData = useCallback(() => {
    const data = {
      sessions,
      exportedAt: new Date().toISOString(),
      totalIsk: totalAllTimeIsk,
      totalSessions: sessions.length,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `photon-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Data Exported",
      description: "Your session data has been downloaded.",
    });
  }, [sessions, totalAllTimeIsk, toast]);

  useEffect(() => {
    if (exportTriggered) {
      handleExportData();
      resetExportTrigger();
    }
  }, [exportTriggered, handleExportData, resetExportTrigger]);

  const formatTotalTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  // Standard tier: limited to 3 most recent sessions
  const displayedSessions = isPro ? sessions : sessions.slice(0, 3);

  // PRO-only tiles configuration - positioned to fit nicely with standard tiles
  const proOnlyTiles = useMemo(() => [
    {
      id: "stat-session-kills",
      title: "Session Kills",
      component: (
        <ProFeatureGate 
          feature="session_kills" 
          className="h-full"
        >
          <StatCard 
            label="Session Kills"
            value={currentSessionKills.toString()}
            icon={Crosshair}
          />
        </ProFeatureGate>
      ),
      defaultLayout: { x: 8, y: 5, w: 4, h: 3, minW: 2, minH: 2 },
      proOnly: true
    },
    {
      id: "stat-total-isk",
      title: "Total ISK",
      component: (
        <ProFeatureGate 
          feature="total_isk_stat" 
          className="h-full"
        >
          <StatCard 
            label="Total All-Time"
            value={`${formatISK(totalAllTimeIsk)} ISK`}
            icon={Target}
          />
        </ProFeatureGate>
      ),
      defaultLayout: { x: 0, y: 14, w: 4, h: 3, minW: 2, minH: 2 },
      proOnly: true
    },
    {
      id: "stat-avg-isk",
      title: "Average ISK",
      component: (
        <ProFeatureGate 
          feature="avg_isk_stat" 
          className="h-full"
        >
          <StatCard 
            label="Avg ISK/Hour"
            value={`${formatISK(averageIskPerHour)}/hr`}
            icon={Timer}
          />
        </ProFeatureGate>
      ),
      defaultLayout: { x: 4, y: 14, w: 4, h: 3, minW: 2, minH: 2 },
      proOnly: true
    },
    {
      id: "stat-total-time",
      title: "Total Time",
      component: (
        <ProFeatureGate 
          feature="total_time_stat" 
          className="h-full"
        >
          <StatCard 
            label="Total Time Ratted"
            value={formatTotalTime(totalTimeRatted)}
            icon={Clock}
          />
        </ProFeatureGate>
      ),
      defaultLayout: { x: 8, y: 14, w: 4, h: 3, minW: 2, minH: 2 },
      proOnly: true
    },
    {
      id: "wallet-overview",
      title: "Wallet Overview",
      component: (
        <ProFeatureGate 
          feature="wallet_overview" 
          className="h-full"
        >
          <div className="h-full overflow-auto p-4">
            <WalletOverview isAuthenticated={isAuthenticated} />
          </div>
        </ProFeatureGate>
      ),
      defaultLayout: { x: 8, y: 8, w: 4, h: 6, minW: 3, minH: 4 },
      proOnly: true
    },
    {
      id: "character-status",
      title: "Character Status",
      component: (
        <ProFeatureGate 
          feature="advanced_stats" 
          className="h-full"
        >
          <CharacterStatus isAuthenticated={isAuthenticated} isPro={isPro} />
        </ProFeatureGate>
      ),
      defaultLayout: { x: 0, y: 17, w: 4, h: 4, minW: 2, minH: 3 },
      proOnly: true
    },
    {
      id: "income-goals",
      title: "Income Goals",
      component: (
        <ProFeatureGate 
          feature="advanced_stats" 
          className="h-full"
        >
          <IncomeGoals 
            isAuthenticated={isAuthenticated}
            isPro={isPro}
          />
        </ProFeatureGate>
      ),
      defaultLayout: { x: 0, y: 21, w: 4, h: 5, minW: 3, minH: 4 },
      proOnly: true
    },
    {
      id: "plex-goal",
      title: "PLEX Goal",
      component: (
        <ProFeatureGate 
          feature="advanced_stats" 
          className="h-full"
        >
          <PlexGoalTracker 
            currentIsk={totalAllTimeIsk} 
            isAuthenticated={isAuthenticated}
            isPro={isPro}
          />
        </ProFeatureGate>
      ),
      defaultLayout: { x: 4, y: 21, w: 4, h: 4, minW: 2, minH: 3 },
      proOnly: true
    },
    {
      id: "achievements",
      title: "Achievements",
      component: (
        <ProFeatureGate 
          feature="advanced_stats" 
          className="h-full"
        >
          <AchievementsList 
            isAuthenticated={isAuthenticated}
            isPro={isPro}
            compact={false}
          />
        </ProFeatureGate>
      ),
      defaultLayout: { x: 8, y: 17, w: 4, h: 6, minW: 4, minH: 4 },
      proOnly: true
    },
  ], [currentSessionKills, totalAllTimeIsk, averageIskPerHour, totalTimeRatted, isAuthenticated, isPro, currentSessionIsk]);

  // Standard tiles available to everyone
  const standardTiles = useMemo(() => [
    {
      id: "session-controls",
      title: "Session Timer",
      component: (
        <SessionControls
          onSessionStart={handleSessionStart}
          onSessionStop={handleSessionStop}
        />
      ),
      defaultLayout: { x: 0, y: 0, w: 8, h: 5, minW: 4, minH: 4 }
    },
    {
      id: "income-entry",
      title: "Income Entry",
      component: (
        <IncomeEntry 
          onAddIncome={handleAddIncome}
          recentEntries={recentEntries}
        />
      ),
      defaultLayout: { x: 8, y: 0, w: 4, h: 5, minW: 3, minH: 4 }
    },
    {
      id: "stat-current-session",
      title: "Current Session",
      component: (
        <StatCard 
          label="Current Session"
          value={`${formatISK(currentSessionIsk)} ISK`}
          icon={Wallet}
          highlight={isSessionActive}
        />
      ),
      defaultLayout: { x: 0, y: 5, w: 4, h: 3, minW: 2, minH: 2 }
    },
    {
      id: "stat-isk-per-hour",
      title: "ISK/Hour",
      component: (
        <StatCard 
          label="Current ISK/Hour"
          value={`${formatISK(calculateCurrentIskPerHour())}/hr`}
          icon={TrendingUp}
          highlight={isSessionActive}
        />
      ),
      defaultLayout: { x: 4, y: 5, w: 4, h: 3, minW: 2, minH: 2 }
    },
    {
      id: "session-history",
      title: isPro ? "Session History" : "Session History (Last 3)",
      component: (
        <div className="h-full overflow-auto p-4">
          <SessionHistory 
            sessions={displayedSessions}
            onDeleteSession={handleDeleteSession}
            limitedMode={!isPro}
          />
        </div>
      ),
      defaultLayout: { x: 0, y: 8, w: 8, h: 6, minW: 4, minH: 4 }
    },
    {
      id: "special-badges",
      title: "Special Badges",
      component: (
        <div className="h-full overflow-visible">
          <SpecialBadges />
        </div>
      ),
      defaultLayout: { x: 8, y: 5, w: 4, h: 4, minW: 3, minH: 3 }
    },
    {
      id: "corp-tax",
      title: "Corp Tax Settings",
      component: (
        <CorpTaxSettings compact={true} />
      ),
      defaultLayout: { x: 8, y: 9, w: 4, h: 5, minW: 2, minH: 3 }
    },
    {
      id: "loot-tracker",
      title: "Loot Tracker",
      component: (
        <div className="h-full overflow-auto">
          <LootTracker compact={true} />
        </div>
      ),
      defaultLayout: { x: 0, y: 14, w: 6, h: 6, minW: 3, minH: 5 }
    },
    {
      id: "leaderboard",
      title: "Leaderboards",
      component: (
        <Leaderboard compact={true} />
      ),
      defaultLayout: { x: 6, y: 14, w: 6, h: 5, minW: 3, minH: 4 }
    },
    {
      id: "share-session",
      title: "Share Session",
      component: (
        <div className="p-4 flex flex-col items-center justify-center h-full">
          <ShareableSessionCard 
            sessionData={isSessionActive ? {
              totalIsk: currentSessionIsk,
              duration: sessionStartTime ? Math.floor((Date.now() - sessionStartTime.getTime()) / 1000) : 0,
              iskPerHour: calculateCurrentIskPerHour(),
              date: sessionStartTime || new Date(),
              kills: currentSessionKills
            } : undefined}
          />
          <p className="text-xs text-muted-foreground text-center mt-2">
            Generate a shareable card with your session stats
          </p>
        </div>
      ),
      defaultLayout: { x: 6, y: 19, w: 6, h: 5, minW: 4, minH: 4 }
    },
    {
      id: "dashboard-settings",
      title: "Dashboard Settings",
      component: (
        <div className="p-4 space-y-4 h-full">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="loot-toggle" className="text-sm font-medium flex items-center gap-2">
                <Package className="w-4 h-4" />
                Include Loot in Totals
              </Label>
              <p className="text-xs text-muted-foreground">
                When enabled, loot value is added to session ISK totals
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Switch
                  id="loot-toggle"
                  checked={includeLootInTotal}
                  onCheckedChange={setIncludeLootInTotal}
                  data-testid="switch-include-loot"
                />
              </TooltipTrigger>
              <TooltipContent>
                {includeLootInTotal ? "Loot included in totals" : "Loot excluded from totals"}
              </TooltipContent>
            </Tooltip>
          </div>
          
          {currentSessionLootIsk > 0 && (
            <div className="p-3 rounded-md bg-muted/50 border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current Session Loot</span>
                <span className="font-mono text-sm">{formatISK(currentSessionLootIsk)} ISK</span>
              </div>
            </div>
          )}
        </div>
      ),
      defaultLayout: { x: 0, y: 20, w: 4, h: 4, minW: 3, minH: 3 }
    },
  ], [
    currentSessionIsk, 
    isSessionActive, 
    recentEntries, 
    displayedSessions, 
    isPro,
    calculateCurrentIskPerHour,
    sessionStartTime,
    currentSessionKills,
    includeLootInTotal,
    currentSessionLootIsk
  ]);

  // Combine tiles based on PRO status and filter by visibility
  const dashboardTiles = useMemo(() => {
    let allTiles;
    if (isPro) {
      // PRO users get all tiles with draggable/resizable capability
      allTiles = [...standardTiles, ...proOnlyTiles];
    } else {
      // Standard users get limited tiles, showing PRO locked overlays for premium features
      const featureMap: Record<string, "session_kills" | "total_isk_stat" | "avg_isk_stat" | "total_time_stat" | "wallet_overview" | "character_status" | "plex_goal" | "achievements"> = {
        'stat-session-kills': 'session_kills',
        'stat-total-isk': 'total_isk_stat',
        'stat-avg-isk': 'avg_isk_stat',
        'stat-total-time': 'total_time_stat',
        'wallet-overview': 'wallet_overview',
        'character-status': 'character_status',
        'plex-goal': 'plex_goal',
        'achievements': 'achievements',
      };
      allTiles = [
        ...standardTiles,
        // Show locked PRO tiles so users can see what they're missing
        ...proOnlyTiles.map(tile => ({
          ...tile,
          component: (
            <ProLockedOverlay 
              feature={featureMap[tile.id] || 'advanced_stats'}
              className="h-full"
            />
          )
        }))
      ];
    }
    // Filter by visibility - show only tiles the user has enabled
    return allTiles.filter(tile => visibleTiles.has(tile.id));
  }, [standardTiles, proOnlyTiles, isPro, visibleTiles]);

  return (
    <TutorialProvider>
      <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8 relative">
        <div className="max-w-7xl mx-auto">
          {/* Ratting Tracker Header */}
          <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Crosshair className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Ratting Tracker</h1>
                <p className="text-sm text-muted-foreground">
                  Track your EVE Online ratting income
                </p>
              </div>
            </div>
          </div>

          <DashboardGrid 
            tiles={dashboardTiles}
            headerContent={
              <TileLibrary
                isPro={isPro}
                visibleTiles={visibleTiles}
                onVisibilityChange={handleTileVisibilityChange}
              />
            }
          />
        </div>

        <div 
          className="fixed bottom-4 right-4 text-xs text-muted-foreground/60 font-mono"
          data-testid="text-version"
        >
          PHOTON v{currentVersion} | In Development
        </div>
      </div>
      <TutorialOverlay />
    </TutorialProvider>
  );
}
