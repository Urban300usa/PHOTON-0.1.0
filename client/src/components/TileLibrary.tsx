import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutGrid,
  Wallet,
  Clock,
  TrendingUp,
  Target,
  Crosshair,
  Timer,
  User,
  Award,
  Trophy,
  History,
  Crown,
  Sparkles,
  Plus,
  Check,
  Building2,
  Package,
  Share2,
  Medal,
  Goal,
  GraduationCap,
  ShoppingCart,
  LineChart,
  PieChart,
} from "lucide-react";

export interface TileDefinition {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  proOnly: boolean;
  category: "core" | "stats" | "pro" | "features";
}

const TILE_DEFINITIONS: TileDefinition[] = [
  {
    id: "session-controls",
    title: "Session Timer",
    description: "Start, stop, and manage your ratting sessions with real-time duration tracking.",
    icon: Clock,
    proOnly: false,
    category: "core",
  },
  {
    id: "income-entry",
    title: "Income Entry",
    description: "Manually add ISK income entries with quick-add buttons for common amounts.",
    icon: Wallet,
    proOnly: false,
    category: "core",
  },
  {
    id: "stat-current-session",
    title: "Current Session ISK",
    description: "Displays the total ISK earned in your current active session.",
    icon: Wallet,
    proOnly: false,
    category: "stats",
  },
  {
    id: "stat-isk-per-hour",
    title: "ISK/Hour Rate",
    description: "Real-time calculation of your current ISK per hour earning rate.",
    icon: TrendingUp,
    proOnly: false,
    category: "stats",
  },
  {
    id: "session-history",
    title: "Session History",
    description: "View your past ratting sessions with ISK totals, duration, and efficiency stats.",
    icon: History,
    proOnly: false,
    category: "core",
  },
  {
    id: "stat-session-kills",
    title: "Session Kills",
    description: "Track the number of NPC kills in your current session.",
    icon: Crosshair,
    proOnly: true,
    category: "stats",
  },
  {
    id: "stat-total-isk",
    title: "Total ISK Earned",
    description: "Your all-time total ISK earned across all sessions.",
    icon: Target,
    proOnly: true,
    category: "stats",
  },
  {
    id: "stat-avg-isk",
    title: "Average ISK/Hour",
    description: "Your average ISK per hour across all sessions.",
    icon: Timer,
    proOnly: true,
    category: "stats",
  },
  {
    id: "stat-total-time",
    title: "Total Time Ratted",
    description: "Cumulative time spent ratting across all sessions.",
    icon: Clock,
    proOnly: true,
    category: "stats",
  },
  {
    id: "wallet-overview",
    title: "Wallet Overview",
    description: "Live view of your EVE wallet balance and recent transactions.",
    icon: Wallet,
    proOnly: true,
    category: "pro",
  },
  {
    id: "character-status",
    title: "Character Status",
    description: "View your character portrait, name, and current online status.",
    icon: User,
    proOnly: true,
    category: "pro",
  },
  {
    id: "income-goals",
    title: "Income Goals",
    description: "Set daily, weekly, and monthly ISK earning targets and track your progress.",
    icon: Goal,
    proOnly: true,
    category: "features",
  },
  {
    id: "plex-goal",
    title: "PLEX Goal Tracker",
    description: "Set and track progress towards your PLEX goal with visual progress bar.",
    icon: Target,
    proOnly: true,
    category: "features",
  },
  {
    id: "achievements",
    title: "Achievements",
    description: "View unlocked achievements and track progress on locked ones.",
    icon: Trophy,
    proOnly: true,
    category: "features",
  },
  {
    id: "special-badges",
    title: "Special Badges",
    description: "Display your special achievement badges earned for contributions.",
    icon: Award,
    proOnly: false,
    category: "features",
  },
  {
    id: "corp-tax",
    title: "Corp Tax Settings",
    description: "Set your corporation tax rate to calculate net ISK after taxes on bounties.",
    icon: Building2,
    proOnly: false,
    category: "features",
  },
  {
    id: "loot-tracker",
    title: "Loot Tracker",
    description: "Track and value your ratting loot with real-time Jita market prices.",
    icon: Package,
    proOnly: false,
    category: "features",
  },
  {
    id: "leaderboard",
    title: "Leaderboards",
    description: "Compete with other pilots on public or private leaderboards.",
    icon: Medal,
    proOnly: false,
    category: "features",
  },
  {
    id: "share-session",
    title: "Share Session",
    description: "Generate shareable cards of your sessions with badges and stats.",
    icon: Share2,
    proOnly: false,
    category: "features",
  },
  // v0.4.0 Big Update tiles
  {
    id: "skill-queue",
    title: "Skill Queue",
    description: "View your current skill training progress and upcoming skills in queue.",
    icon: GraduationCap,
    proOnly: false,
    category: "features",
  },
  {
    id: "market-orders",
    title: "Market Orders",
    description: "Track your active buy and sell orders with profit margins and status.",
    icon: ShoppingCart,
    proOnly: true,
    category: "pro",
  },
  {
    id: "income-chart",
    title: "Income Chart",
    description: "Historical ISK trends displayed as a line chart over time.",
    icon: LineChart,
    proOnly: true,
    category: "pro",
  },
  {
    id: "income-breakdown",
    title: "Income Breakdown",
    description: "Pie chart showing income distribution by source (bounties, mining, etc.).",
    icon: PieChart,
    proOnly: true,
    category: "pro",
  },
];

const CATEGORY_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  core: { label: "Core", icon: LayoutGrid },
  stats: { label: "Statistics", icon: TrendingUp },
  pro: { label: "PRO Features", icon: Crown },
  features: { label: "Features", icon: Sparkles },
};

const VISIBLE_TILES_KEY = "photon-visible-tiles-v2";

// Only show essential tiles by default - users can add more from the drawer
const DEFAULT_VISIBLE_TILES = [
  "session-controls",
  "income-entry", 
  "stat-current-session",
  "stat-isk-per-hour",
  "session-history",
];

function getDefaultVisibleTiles(): Set<string> {
  return new Set(DEFAULT_VISIBLE_TILES);
}

export function getVisibleTileIds(): Set<string> {
  if (typeof window === "undefined") {
    return getDefaultVisibleTiles();
  }
  try {
    const saved = localStorage.getItem(VISIBLE_TILES_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return new Set(parsed);
    }
  } catch {
    // Fall through to default
  }
  return getDefaultVisibleTiles();
}

export function setVisibleTileIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VISIBLE_TILES_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // localStorage may be unavailable
  }
}

interface TileLibraryProps {
  isPro: boolean;
  visibleTiles: Set<string>;
  onVisibilityChange: (tileId: string, visible: boolean) => void;
}

export default function TileLibrary({ isPro, visibleTiles, onVisibilityChange }: TileLibraryProps) {
  const [open, setOpen] = useState(false);

  const groupedTiles = TILE_DEFINITIONS.reduce((acc, tile) => {
    if (!acc[tile.category]) {
      acc[tile.category] = [];
    }
    acc[tile.category].push(tile);
    return acc;
  }, {} as Record<string, TileDefinition[]>);

  const categories = ["core", "stats", "features", "pro"];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-tile-library">
          <LayoutGrid className="w-4 h-4 mr-2" />
          Customize Tiles
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]" data-testid="tile-library-drawer">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-primary" />
            Tile Library
          </SheetTitle>
          <SheetDescription>
            Choose which tiles appear on your dashboard. Toggle tiles on or off to customize your view.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-10rem)] mt-6 pr-4">
          <div className="space-y-6">
            {categories.map((category) => {
              const tiles = groupedTiles[category];
              if (!tiles || tiles.length === 0) return null;

              const categoryInfo = CATEGORY_LABELS[category];
              const CategoryIcon = categoryInfo.icon;

              return (
                <div key={category} className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <CategoryIcon className="w-4 h-4" />
                    {categoryInfo.label}
                  </div>
                  <div className="space-y-2">
                    {tiles.map((tile) => {
                      const TileIcon = tile.icon;
                      const isVisible = visibleTiles.has(tile.id);
                      const isLocked = tile.proOnly && !isPro;

                      return (
                        <div
                          key={tile.id}
                          className={`flex items-start gap-3 p-3 rounded-md border transition-colors ${
                            isVisible 
                              ? "bg-accent/30 border-accent" 
                              : "bg-muted/30 border-border"
                          } ${isLocked ? "opacity-60" : ""}`}
                          data-testid={`tile-item-${tile.id}`}
                        >
                          <div className={`flex items-center justify-center w-10 h-10 rounded-md ${
                            isVisible ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                          }`}>
                            <TileIcon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{tile.title}</span>
                              {tile.proOnly && (
                                <Badge 
                                  variant="outline" 
                                  className="text-xs bg-amber-500/10 border-amber-500/30 text-amber-400"
                                >
                                  <Crown className="w-3 h-3 mr-1" />
                                  PRO
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {tile.description}
                            </p>
                          </div>
                          <div className="flex-shrink-0">
                            {isLocked ? (
                              <Badge variant="secondary" className="text-xs">
                                Locked
                              </Badge>
                            ) : (
                              <Switch
                                checked={isVisible}
                                onCheckedChange={(checked) => onVisibilityChange(tile.id, checked)}
                                data-testid={`switch-tile-${tile.id}`}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                const defaultTiles = getDefaultVisibleTiles();
                Array.from(defaultTiles).forEach(id => {
                  if (!visibleTiles.has(id)) {
                    onVisibilityChange(id, true);
                  }
                });
                Array.from(visibleTiles).forEach(id => {
                  if (!defaultTiles.has(id)) {
                    onVisibilityChange(id, false);
                  }
                });
              }}
              data-testid="button-reset-tiles"
            >
              Reset to Default
            </Button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export { TILE_DEFINITIONS };
