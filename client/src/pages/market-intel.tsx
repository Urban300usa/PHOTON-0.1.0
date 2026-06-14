import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  Building2,
  ListPlus,
  Package,
  AlertCircle,
} from "lucide-react";
import { formatISK } from "@/hooks/use-wallet";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface MonitoredStation {
  id: string;
  characterId: number;
  stationId: number;
  stationName: string;
  stationType: "npc" | "player_owned";
  regionId: number;
  solarSystemId: number | null;
  authCharacterId: number | null;
  isActive: boolean;
  createdAt: string;
  lastFetchedAt: string | null;
}

interface Watchlist {
  id: string;
  characterId: number;
  monitoredStationId: string;
  name: string;
  createdAt: string;
}

interface WatchlistItem {
  id: string;
  watchlistId: string;
  typeId: number;
  typeName: string;
  minStockThreshold: number;
  category: string | null;
}

interface GapItem {
  typeId: number;
  typeName: string;
  category: string | null;
  minStockThreshold: number;
  currentStock: number;
  status: "out_of_stock" | "low_stock" | "stocked";
  localSellMin: number | null;
  jitaSellMin: number | null;
  jitaBuyMax: number | null;
  recommendedPrice: number | null;
  profitPerUnit: number | null;
}

interface SearchResult {
  id: number;
  name: string;
  type: "npc" | "player_owned";
  regionId: number | null;
  solarSystemId: number | null;
}

export default function MarketIntelPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("stations");

  // Station management state
  const [showAddStation, setShowAddStation] = useState(false);
  const [stationSearch, setStationSearch] = useState("");
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);

  // Watchlist state
  const [showCreateWatchlist, setShowCreateWatchlist] = useState(false);
  const [watchlistStationId, setWatchlistStationId] = useState<string>("");
  const [watchlistName, setWatchlistName] = useState("");

  // Add item state
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemWatchlistId, setAddItemWatchlistId] = useState<string>("");
  const [itemName, setItemName] = useState("");
  const [itemThreshold, setItemThreshold] = useState("5");

  // Gap finder state
  const [gapStationId, setGapStationId] = useState<string>("");
  const [gapWatchlistId, setGapWatchlistId] = useState<string>("");

  // Expanded watchlists in station view
  const [expandedStations, setExpandedStations] = useState<Set<string>>(new Set());

  // ---- Queries ----

  const { data: stationsData, isLoading: stationsLoading } = useQuery<{ stations: MonitoredStation[] }>({
    queryKey: ["/api/market/intel/stations"],
  });
  const stations = stationsData?.stations || [];

  const { data: searchData, isLoading: searchLoading } = useQuery<{ results: SearchResult[] }>({
    queryKey: ["market-intel-search", stationSearch],
    queryFn: async () => {
      const res = await fetch(`/api/market/intel/stations/search?q=${encodeURIComponent(stationSearch)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: stationSearch.length >= 2 && showAddStation,
    staleTime: 30_000,
  });
  const searchResults = searchData?.results || [];

  const { data: watchlistsData } = useQuery<{ watchlists: Watchlist[] }>({
    queryKey: ["/api/market/intel/watchlists"],
  });
  const allWatchlists = watchlistsData?.watchlists || [];

  // Items for expanded watchlists
  const [watchlistItems, setWatchlistItems] = useState<Record<string, WatchlistItem[]>>({});

  const { data: gapData, isLoading: gapsLoading } = useQuery<{
    gaps: GapItem[];
    stationName: string;
    lastFetchedAt: string | null;
  }>({
    queryKey: ["market-intel-gaps", gapStationId, gapWatchlistId],
    queryFn: async () => {
      const res = await fetch(`/api/market/intel/gaps/${gapStationId}?watchlistId=${gapWatchlistId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Gap analysis failed");
      return res.json();
    },
    enabled: !!gapStationId && !!gapWatchlistId,
  });

  // ---- Mutations ----

  const addStationMutation = useMutation({
    mutationFn: async (data: {
      stationId: number;
      stationName: string;
      stationType: string;
      regionId: number | null;
      solarSystemId: number | null;
    }) => {
      const response = await fetch("/api/market/intel/stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to add station");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market/intel/stations"] });
      setShowAddStation(false);
      setStationSearch("");
      setSelectedResult(null);
      toast({ title: "Station added", description: "Station is now being monitored." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const removeStationMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/market/intel/stations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to remove station");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market/intel/stations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/market/intel/watchlists"] });
      toast({ title: "Station removed" });
    },
  });

  const syncStationMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/market/intel/sync/${id}`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to sync");
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/market/intel/stations"] });
      toast({
        title: "Market data synced",
        description: `${data.snapshotCount} item types from ${data.orderCount} orders.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    },
  });

  const syncJitaMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/market/intel/sync-jita", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to sync Jita prices");
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Jita prices synced",
        description: `${data.priceCount} reference prices updated.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Jita sync failed", description: err.message, variant: "destructive" });
    },
  });

  const createWatchlistMutation = useMutation({
    mutationFn: async (data: { monitoredStationId: string; name: string }) => {
      const response = await fetch("/api/market/intel/watchlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to create watchlist");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market/intel/watchlists"] });
      setShowCreateWatchlist(false);
      setWatchlistName("");
      toast({ title: "Watchlist created" });
    },
  });

  const deleteWatchlistMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/market/intel/watchlists/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete watchlist");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market/intel/watchlists"] });
      toast({ title: "Watchlist deleted" });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: { watchlistId: string; typeName: string; minStockThreshold: number }) => {
      const response = await fetch(`/api/market/intel/watchlists/${data.watchlistId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typeName: data.typeName, minStockThreshold: data.minStockThreshold }),
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to add item");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market/intel/watchlists"] });
      setShowAddItem(false);
      setItemName("");
      setItemThreshold("5");
      toast({ title: "Item added to watchlist" });
      // Refresh items for expanded watchlists
      if (addItemWatchlistId) {
        fetchWatchlistItems(addItemWatchlistId);
      }
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async ({ watchlistId, itemId }: { watchlistId: string; itemId: string }) => {
      const response = await fetch(`/api/market/intel/watchlists/${watchlistId}/items/${itemId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to remove item");
      return response.json();
    },
    onSuccess: (_data, variables) => {
      fetchWatchlistItems(variables.watchlistId);
      toast({ title: "Item removed" });
    },
  });

  // ---- Helpers ----

  async function fetchWatchlistItems(watchlistId: string) {
    try {
      const response = await fetch(`/api/market/intel/watchlists/${watchlistId}/items`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setWatchlistItems(prev => ({ ...prev, [watchlistId]: data.items }));
      }
    } catch {
      // Silently fail
    }
  }

  function toggleStationExpand(stationId: string) {
    setExpandedStations(prev => {
      const next = new Set(prev);
      if (next.has(stationId)) {
        next.delete(stationId);
      } else {
        next.add(stationId);
        // Load watchlist items for all watchlists at this station
        const stationWatchlists = allWatchlists.filter(w => w.monitoredStationId === stationId);
        for (const wl of stationWatchlists) {
          if (!watchlistItems[wl.id]) {
            fetchWatchlistItems(wl.id);
          }
        }
      }
      return next;
    });
  }

  const stationWatchlistsForGaps = allWatchlists.filter(w => w.monitoredStationId === gapStationId);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Market Intelligence</h1>
            <p className="text-sm text-muted-foreground">
              Monitor station markets and identify stocking opportunities
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => syncJitaMutation.mutate()}
          disabled={syncJitaMutation.isPending}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${syncJitaMutation.isPending ? "animate-spin" : ""}`} />
          Sync Jita Prices
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="stations">Stations</TabsTrigger>
          <TabsTrigger value="gaps">Gap Finder</TabsTrigger>
        </TabsList>

        {/* ===== STATIONS TAB ===== */}
        <TabsContent value="stations" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Monitored Stations</CardTitle>
                  <CardDescription>Stations and structures you are tracking for market data</CardDescription>
                </div>
                <Button onClick={() => setShowAddStation(true)} size="sm">
                  <Plus className="mr-2 h-4 w-4" /> Add Station
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {stationsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : stations.length === 0 ? (
                <div className="flex flex-col items-center text-center py-12">
                  <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No stations monitored</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Add a station to start tracking market data and finding stocking opportunities.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {stations.map(station => {
                    const stationWatchlists = allWatchlists.filter(
                      w => w.monitoredStationId === station.id
                    );
                    const isExpanded = expandedStations.has(station.id);

                    return (
                      <div key={station.id} className="border rounded-lg">
                        {/* Station row */}
                        <div className="flex items-center justify-between p-3">
                          <div
                            className="flex items-center gap-3 cursor-pointer flex-1"
                            onClick={() => toggleStationExpand(station.id)}
                          >
                            <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                            <div>
                              <div className="font-medium">{station.stationName}</div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant={station.stationType === "npc" ? "secondary" : "outline"} className="text-xs">
                                  {station.stationType === "npc" ? "NPC" : "Player Owned"}
                                </Badge>
                                {station.lastFetchedAt ? (
                                  <span>
                                    Synced {formatDistanceToNow(new Date(station.lastFetchedAt), { addSuffix: true })}
                                  </span>
                                ) : (
                                  <span className="text-yellow-500">Never synced</span>
                                )}
                                <span>{stationWatchlists.length} watchlist{stationWatchlists.length !== 1 ? "s" : ""}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => syncStationMutation.mutate(station.id)}
                              disabled={syncStationMutation.isPending}
                              title="Sync market data"
                            >
                              <RefreshCw className={`h-4 w-4 ${syncStationMutation.isPending ? "animate-spin" : ""}`} />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setWatchlistStationId(station.id);
                                setShowCreateWatchlist(true);
                              }}
                              title="Create watchlist"
                            >
                              <ListPlus className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeStationMutation.mutate(station.id)}
                              title="Remove station"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Expanded watchlists */}
                        {isExpanded && (
                          <div className="border-t px-3 pb-3 pt-2 space-y-2 bg-muted/30">
                            {stationWatchlists.length === 0 ? (
                              <p className="text-sm text-muted-foreground py-2">
                                No watchlists yet. Create one to track items at this station.
                              </p>
                            ) : (
                              stationWatchlists.map(wl => {
                                const items = watchlistItems[wl.id] || [];
                                return (
                                  <div key={wl.id} className="border rounded bg-background p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <div className="font-medium text-sm">{wl.name}</div>
                                      <div className="flex items-center gap-1">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            setAddItemWatchlistId(wl.id);
                                            setShowAddItem(true);
                                          }}
                                        >
                                          <Plus className="h-3 w-3 mr-1" /> Add Item
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => deleteWatchlistMutation.mutate(wl.id)}
                                          className="text-destructive hover:text-destructive"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                    {items.length > 0 ? (
                                      <div className="space-y-1">
                                        {items.map(item => (
                                          <div
                                            key={item.id}
                                            className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-muted"
                                          >
                                            <div>
                                              <span>{item.typeName}</span>
                                              <span className="text-muted-foreground ml-2 text-xs">
                                                (min: {item.minStockThreshold})
                                              </span>
                                            </div>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                              onClick={() =>
                                                removeItemMutation.mutate({
                                                  watchlistId: wl.id,
                                                  itemId: item.id,
                                                })
                                              }
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-muted-foreground">No items in this watchlist.</p>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== GAP FINDER TAB ===== */}
        <TabsContent value="gaps" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Gap Finder</CardTitle>
              <CardDescription>
                Compare watchlist items against actual market data to find stocking opportunities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Station</Label>
                  <Select value={gapStationId} onValueChange={(v) => { setGapStationId(v); setGapWatchlistId(""); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a station..." />
                    </SelectTrigger>
                    <SelectContent>
                      {stations.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.stationName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Watchlist</Label>
                  <Select
                    value={gapWatchlistId}
                    onValueChange={setGapWatchlistId}
                    disabled={!gapStationId || stationWatchlistsForGaps.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        !gapStationId
                          ? "Select a station first..."
                          : stationWatchlistsForGaps.length === 0
                          ? "No watchlists for this station"
                          : "Select a watchlist..."
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {stationWatchlistsForGaps.map(w => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Data age notice */}
              {gapData?.lastFetchedAt && (
                <div className="text-xs text-muted-foreground">
                  Market data for <span className="font-medium">{gapData.stationName}</span> last synced{" "}
                  {formatDistanceToNow(new Date(gapData.lastFetchedAt), { addSuffix: true })}
                </div>
              )}

              {/* Results */}
              {!gapStationId || !gapWatchlistId ? (
                <div className="flex flex-col items-center text-center py-12">
                  <Search className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Select a station and watchlist</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Choose a monitored station and one of its watchlists to see gap analysis.
                  </p>
                </div>
              ) : gapsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : gapData && gapData.gaps.length === 0 ? (
                <div className="flex flex-col items-center text-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No items in watchlist</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Add items to your watchlist in the Stations tab first, then sync market data.
                  </p>
                </div>
              ) : gapData ? (
                <>
                  {/* Summary badges */}
                  <div className="flex gap-3">
                    <Badge variant="destructive">
                      {gapData.gaps.filter(g => g.status === "out_of_stock").length} Out of Stock
                    </Badge>
                    <Badge variant="default">
                      {gapData.gaps.filter(g => g.status === "low_stock").length} Low Stock
                    </Badge>
                    <Badge variant="secondary">
                      {gapData.gaps.filter(g => g.status === "stocked").length} Stocked
                    </Badge>
                  </div>

                  {/* Gap table */}
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="w-24">Status</TableHead>
                          <TableHead className="w-28 text-right">Stock</TableHead>
                          <TableHead className="w-32 text-right">Local Price</TableHead>
                          <TableHead className="w-32 text-right">Jita Sell</TableHead>
                          <TableHead className="w-36 text-right">Recommended</TableHead>
                          <TableHead className="w-32 text-right">Profit/Unit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {gapData.gaps.map(item => (
                          <TableRow
                            key={item.typeId}
                            className={
                              item.status === "out_of_stock"
                                ? "bg-destructive/5"
                                : item.status === "low_stock"
                                ? "bg-yellow-500/5"
                                : ""
                            }
                          >
                            <TableCell className="font-medium">{item.typeName}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  item.status === "out_of_stock"
                                    ? "destructive"
                                    : item.status === "low_stock"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {item.status === "out_of_stock"
                                  ? "Out"
                                  : item.status === "low_stock"
                                  ? "Low"
                                  : "OK"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {item.currentStock}
                              <span className="text-muted-foreground">/{item.minStockThreshold}</span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {item.localSellMin != null ? formatISK(item.localSellMin) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {item.jitaSellMin != null ? formatISK(item.jitaSellMin) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {item.recommendedPrice != null ? formatISK(item.recommendedPrice) : "—"}
                            </TableCell>
                            <TableCell
                              className={`text-right font-mono text-sm ${
                                item.profitPerUnit != null && item.profitPerUnit > 0
                                  ? "text-green-500"
                                  : ""
                              }`}
                            >
                              {item.profitPerUnit != null ? formatISK(item.profitPerUnit) : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== DIALOGS ===== */}

      {/* Add Station Dialog */}
      <Dialog open={showAddStation} onOpenChange={setShowAddStation}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Monitored Station</DialogTitle>
            <DialogDescription>
              Search for an NPC station or player-owned structure to monitor its market.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Station or structure name..."
                  value={stationSearch}
                  onChange={e => {
                    setStationSearch(e.target.value);
                    setSelectedResult(null);
                  }}
                  className="pl-9"
                />
              </div>
            </div>

            {searchLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="max-h-60 overflow-y-auto border rounded-md divide-y">
                {searchResults.map(result => (
                  <button
                    key={result.id}
                    className={`w-full text-left p-3 hover:bg-accent transition-colors ${
                      selectedResult?.id === result.id ? "bg-accent" : ""
                    }`}
                    onClick={() => setSelectedResult(result)}
                  >
                    <div className="font-medium text-sm">{result.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {result.type === "npc" ? "NPC Station" : "Player Structure"}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            ) : stationSearch.length >= 2 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No results found</p>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Type at least 2 characters to search
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddStation(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedResult) return;
                addStationMutation.mutate({
                  stationId: selectedResult.id,
                  stationName: selectedResult.name,
                  stationType: selectedResult.type,
                  regionId: selectedResult.regionId || 0,
                  solarSystemId: selectedResult.solarSystemId,
                });
              }}
              disabled={!selectedResult || addStationMutation.isPending}
            >
              {addStationMutation.isPending ? "Adding..." : "Add Station"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Watchlist Dialog */}
      <Dialog open={showCreateWatchlist} onOpenChange={setShowCreateWatchlist}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Watchlist</DialogTitle>
            <DialogDescription>
              Create a named list of items to track at this station.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Watchlist Name</Label>
              <Input
                placeholder="e.g., Doctrine Ships, Ratting Supplies..."
                value={watchlistName}
                onChange={e => setWatchlistName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && watchlistName.trim()) {
                    createWatchlistMutation.mutate({
                      monitoredStationId: watchlistStationId,
                      name: watchlistName.trim(),
                    });
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateWatchlist(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!watchlistName.trim()) return;
                createWatchlistMutation.mutate({
                  monitoredStationId: watchlistStationId,
                  name: watchlistName.trim(),
                });
              }}
              disabled={!watchlistName.trim() || createWatchlistMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Item to Watchlist</DialogTitle>
            <DialogDescription>
              Enter an EVE item name. It will be looked up automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Item Name</Label>
              <Input
                placeholder="e.g., Hobgoblin II, Nova Heavy Missile..."
                value={itemName}
                onChange={e => setItemName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Minimum Stock Threshold</Label>
              <Input
                type="number"
                min="1"
                value={itemThreshold}
                onChange={e => setItemThreshold(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Alert when stock drops below this quantity
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItem(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!itemName.trim()) return;
                addItemMutation.mutate({
                  watchlistId: addItemWatchlistId,
                  typeName: itemName.trim(),
                  minStockThreshold: parseInt(itemThreshold, 10) || 5,
                });
              }}
              disabled={!itemName.trim() || addItemMutation.isPending}
            >
              {addItemMutation.isPending ? "Looking up..." : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
