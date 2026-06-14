import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { EveIcon } from "@/components/EveIcon";
import { 
  Package, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Search, 
  Coins,
  TrendingUp,
  Clock,
  ClipboardPaste,
  Calculator,
  ExternalLink,
  Save,
  Check
} from "lucide-react";

interface SearchItem {
  typeId: number;
  name: string;
  volume?: number;
  published?: boolean;
  marketGroupId?: number;
}

interface LootEntry {
  id: string;
  typeId: number;
  typeName: string;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number | null;
  addedAt: Date;
}

interface LootTrackerProps {
  compact?: boolean;
  onTotalChange?: (total: number) => void;
}

interface ActiveSessionResponse {
  session: {
    id: string;
    characterId: number;
    characterName: string;
    startTime: string;
    isActive: boolean;
    totalIsk: number;
    bountyIsk: number;
    lootIsk: number;
    killCount: number;
  } | null;
}

function formatISK(value: number): string {
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

const COMMON_LOOT = [
  { typeId: 15331, name: "Overseer's Personal Effects" },
  { typeId: 34, name: "Tritanium" },
  { typeId: 35, name: "Pyerite" },
  { typeId: 36, name: "Mexallon" },
  { typeId: 37, name: "Isogen" },
  { typeId: 38, name: "Nocxium" },
  { typeId: 39, name: "Zydrine" },
  { typeId: 40, name: "Megacyte" },
  { typeId: 11399, name: "Morphite" },
];

interface AppraisalResult {
  success: boolean;
  source: string;
  market: string;
  items: Array<{
    typeId: number;
    name: string;
    quantity: number;
    unitPrice: number | null;
    totalPrice: number | null;
  }>;
  totalSellValue: number;
  totalBuyValue: number | null;
  itemCount: number;
  parsedCount: number;
  appraisalUrl: string | null;
  lastUpdated: string;
}

export default function LootTracker({ 
  compact = false, 
  onTotalChange
}: LootTrackerProps) {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SearchItem | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [lootEntries, setLootEntries] = useState<LootEntry[]>([]);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [isAppraising, setIsAppraising] = useState(false);
  const [lastAppraisal, setLastAppraisal] = useState<AppraisalResult | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);

  // Query active session from backend
  const { data: activeSessionData, refetch: refetchActiveSession } = useQuery<ActiveSessionResponse>({
    queryKey: ["/api/sessions/active"],
    enabled: isAuthenticated,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const activeSession = activeSessionData?.session;
  const activeSessionId = activeSession?.id || null;
  const sessionLootIsk = activeSession?.lootIsk || 0;

  const { data: searchResults, isLoading: isSearching } = useQuery<{ items: SearchItem[] }>({
    queryKey: ["/api/items/search", searchQuery],
    queryFn: async () => {
      const response = await fetch(`/api/items/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error("Search failed");
      return response.json();
    },
    enabled: searchQuery.length >= 2,
  });

  const { data: commonPrices, isLoading: isLoadingCommon, refetch: refetchCommon } = useQuery<{
    items: { typeId: number; name: string; sellPrice: number | null }[];
  }>({
    queryKey: ["/api/market/common-loot"],
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const lootTotal = lootEntries.reduce((sum, entry) => sum + (entry.totalPrice || 0), 0);

  useEffect(() => {
    onTotalChange?.(lootTotal);
  }, [lootTotal, onTotalChange]);

  const fetchPrice = useCallback(async (typeId: number): Promise<number | null> => {
    try {
      const response = await fetch(`/api/market/price/${typeId}`);
      if (response.ok) {
        const data = await response.json();
        return data.jitaSellPrice;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const handleAddItem = async () => {
    if (!selectedItem) return;
    
    const qty = parseInt(quantity, 10) || 1;
    if (qty <= 0) return;

    setIsLoadingPrice(true);
    
    try {
      const unitPrice = await fetchPrice(selectedItem.typeId);
      
      const entry: LootEntry = {
        id: Date.now().toString(),
        typeId: selectedItem.typeId,
        typeName: selectedItem.name,
        quantity: qty,
        unitPrice,
        totalPrice: unitPrice ? unitPrice * qty : null,
        addedAt: new Date(),
      };

      setLootEntries(prev => [entry, ...prev]);
      setSelectedItem(null);
      setQuantity("1");
      setSearchQuery("");
      
      toast({
        title: "Loot Added",
        description: `Added ${qty}x ${selectedItem.name}`,
      });
    } finally {
      setIsLoadingPrice(false);
    }
  };

  const handleQuickAdd = async (item: { typeId: number; name: string }) => {
    const qty = parseInt(quantity, 10) || 1;
    if (qty <= 0) return;

    setIsLoadingPrice(true);
    
    try {
      // Try to get price from cached common loot prices first
      let unitPrice = commonPrices?.items.find(p => p.typeId === item.typeId)?.sellPrice ?? null;
      
      // Fallback to API if not in cache
      if (unitPrice === null) {
        unitPrice = await fetchPrice(item.typeId);
      }
      
      const entry: LootEntry = {
        id: Date.now().toString(),
        typeId: item.typeId,
        typeName: item.name,
        quantity: qty,
        unitPrice,
        totalPrice: unitPrice ? unitPrice * qty : null,
        addedAt: new Date(),
      };

      setLootEntries(prev => [entry, ...prev]);
      setQuantity("1");
      
      toast({
        title: "Loot Added",
        description: `Added ${qty}x ${item.name}`,
      });
    } finally {
      setIsLoadingPrice(false);
    }
  };

  const handleRemoveEntry = (id: string) => {
    setLootEntries(prev => prev.filter(e => e.id !== id));
  };

  const handleClearAll = () => {
    setLootEntries([]);
    toast({
      title: "Loot Cleared",
      description: "All loot entries have been removed.",
    });
  };

  const handleAppraise = async () => {
    if (!pasteText.trim()) {
      toast({
        title: "No Items",
        description: "Please paste your loot from EVE to appraise.",
        variant: "destructive",
      });
      return;
    }

    setIsAppraising(true);
    try {
      const response = await apiRequest("POST", "/api/loot/appraise", { text: pasteText });
      
      const data = await response.json();
      
      if (data.success) {
        setLastAppraisal(data);
        
        // Add all appraised items to loot entries
        const newEntries: LootEntry[] = data.items.map((item: AppraisalResult["items"][0]) => ({
          id: `${Date.now()}-${item.typeId}-${Math.random().toString(36).slice(2)}`,
          typeId: item.typeId,
          typeName: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          addedAt: new Date(),
        }));
        
        setLootEntries(prev => [...newEntries, ...prev]);
        setPasteText("");
        
        toast({
          title: "Loot Appraised",
          description: `Added ${data.itemCount} items worth ${formatISK(data.totalSellValue)} ISK`,
        });
      } else {
        throw new Error(data.error || "Appraisal failed");
      }
    } catch (error) {
      console.error("Appraisal error:", error);
      toast({
        title: "Appraisal Failed",
        description: error instanceof Error ? error.message : "Failed to appraise loot",
        variant: "destructive",
      });
    } finally {
      setIsAppraising(false);
    }
  };

  const handleCommitToSession = async () => {
    if (!activeSessionId || lootEntries.length === 0) {
      toast({
        title: "Cannot Apply",
        description: activeSessionId ? "No loot to apply" : "No active session",
        variant: "destructive",
      });
      return;
    }

    setIsCommitting(true);
    try {
      const items = lootEntries.map(e => ({
        typeId: e.typeId,
        typeName: e.typeName,
        quantity: e.quantity,
        unitPrice: e.unitPrice,
        totalPrice: e.totalPrice,
      }));

      const response = await apiRequest("POST", "/api/loot/commit", {
        items,
        totalValue: lootTotal,
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Loot Applied",
          description: `${formatISK(data.lootTotal)} ISK added to session`,
        });
        
        // Clear local entries after committing
        setLootEntries([]);
        
        // Refresh active session to update loot total
        refetchActiveSession();
        queryClient.invalidateQueries({ queryKey: ["/api/sessions/active"] });
      } else {
        throw new Error(data.error || "Failed to apply loot");
      }
    } catch (error) {
      console.error("Commit loot error:", error);
      toast({
        title: "Apply Failed",
        description: error instanceof Error ? error.message : "Failed to apply loot to session",
        variant: "destructive",
      });
    } finally {
      setIsCommitting(false);
    }
  };

  if (compact) {
    return (
      <div className="h-full flex flex-col p-4 gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            <span className="font-medium">Loot Tracker</span>
          </div>
          <Badge variant="outline" className="font-mono">
            {formatISK(lootTotal)} ISK
          </Badge>
        </div>

        <div className="flex gap-2">
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-20"
            placeholder="Qty"
            data-testid="input-loot-quantity"
          />
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1 justify-start" data-testid="button-search-item">
                <Search className="w-4 h-4 mr-2" />
                {selectedItem ? selectedItem.name : "Search item..."}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-80" align="start">
              <Command>
                <CommandInput
                  placeholder="Search items..."
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
                <CommandList>
                  {isSearching && <CommandEmpty>Searching...</CommandEmpty>}
                  {!isSearching && searchQuery.length >= 2 && (
                    <CommandEmpty>No items found.</CommandEmpty>
                  )}
                  {searchResults?.items && searchResults.items.length > 0 && (
                    <CommandGroup>
                      {searchResults.items.map((item) => (
                        <CommandItem
                          key={item.typeId}
                          onSelect={() => {
                            setSelectedItem(item);
                            setSearchOpen(false);
                          }}
                          className="flex items-center gap-2"
                        >
                          <EveIcon typeId={item.typeId} size={32} alt={item.name} />
                          {item.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Button
            onClick={handleAddItem}
            disabled={!selectedItem || isLoadingPrice}
            size="icon"
            data-testid="button-add-loot"
          >
            {isLoadingPrice ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </Button>
        </div>

        <div className="flex gap-1 flex-wrap">
          {COMMON_LOOT.slice(0, 4).map((item) => (
            <Button
              key={item.typeId}
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => handleQuickAdd(item)}
              disabled={isLoadingPrice}
              data-testid={`button-quick-add-${item.typeId}`}
            >
              {item.name.slice(0, 8)}
            </Button>
          ))}
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-2">
            {lootEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <EveIcon typeId={entry.typeId} size={32} className="flex-shrink-0" alt={entry.typeName} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate block">{entry.typeName}</span>
                    <span className="text-xs text-muted-foreground">
                      {entry.quantity}x @ {entry.unitPrice ? formatISK(entry.unitPrice) : "?"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">
                    {entry.totalPrice ? formatISK(entry.totalPrice) : "N/A"}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => handleRemoveEntry(entry.id)}
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {activeSessionId && lootEntries.length > 0 && (
          <Button
            onClick={handleCommitToSession}
            disabled={isCommitting}
            size="sm"
            variant="secondary"
            className="w-full"
            data-testid="button-apply-loot-session-compact"
          >
            {isCommitting ? (
              <RefreshCw className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <Save className="w-3 h-3 mr-1" />
            )}
            Apply to Session
          </Button>
        )}

        {sessionLootIsk > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Check className="w-3 h-3 text-green-500" />
              Saved
            </span>
            <span className="font-mono">{formatISK(sessionLootIsk)} ISK</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          Loot Tracker
        </CardTitle>
        <CardDescription>
          Track and value your ratting loot with real-time Jita prices.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-md bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">Current Loot</span>
            </div>
            <span className="text-xl font-bold font-mono">{formatISK(lootTotal)} ISK</span>
          </div>
          
          {sessionLootIsk > 0 && (
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/50 border">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Session Loot (Saved)</span>
              </div>
              <span className="font-mono text-sm">{formatISK(sessionLootIsk)} ISK</span>
            </div>
          )}
          
          {activeSessionId && lootEntries.length > 0 && (
            <Button
              onClick={handleCommitToSession}
              disabled={isCommitting}
              className="w-full"
              variant="secondary"
              data-testid="button-apply-loot-session"
            >
              {isCommitting ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Apply {formatISK(lootTotal)} ISK to Session
            </Button>
          )}
          
          {!activeSessionId && lootEntries.length > 0 && (
            <p className="text-sm text-muted-foreground text-center">
              Start a ratting session to save loot to your earnings
            </p>
          )}
        </div>

        <Tabs defaultValue="paste" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="paste" data-testid="tab-paste-loot">
              <ClipboardPaste className="w-4 h-4 mr-2" />
              Paste from EVE
            </TabsTrigger>
            <TabsTrigger value="search" data-testid="tab-search-loot">
              <Search className="w-4 h-4 mr-2" />
              Search Items
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="space-y-4 mt-4">
            <div className="space-y-3">
              <Label htmlFor="paste-loot">Paste Loot from EVE</Label>
              <p className="text-sm text-muted-foreground">
                Copy items from your inventory in EVE (Ctrl+C) and paste them here for instant appraisal using Janice.
              </p>
              <Textarea
                id="paste-loot"
                placeholder={`Paste items here...\n\nExample:\nTritanium\t10000\nPyerite\t5000\nMegacyte\t100`}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className="min-h-[120px] font-mono text-sm"
                data-testid="textarea-paste-loot"
              />
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleAppraise}
                  disabled={!pasteText.trim() || isAppraising}
                  className="flex-1"
                  data-testid="button-appraise-loot"
                >
                  {isAppraising ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Calculator className="w-4 h-4 mr-2" />
                  )}
                  Appraise Loot
                </Button>
                {lastAppraisal?.appraisalUrl && (
                  <Button
                    variant="outline"
                    size="icon"
                    asChild
                    data-testid="button-view-janice"
                  >
                    <a href={lastAppraisal.appraisalUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                )}
              </div>
              {lastAppraisal && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Source: {lastAppraisal.source === "janice" ? "Janice" : "ESI"}</span>
                  <span>Market: Jita</span>
                  <span>{lastAppraisal.itemCount} items appraised</span>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="search" className="space-y-4 mt-4">
            <div className="space-y-3">
              <Label>Add Loot Item</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-24"
                  placeholder="Qty"
                  data-testid="input-loot-quantity-full"
                />
                <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-start" data-testid="button-search-item-full">
                      <Search className="w-4 h-4 mr-2" />
                      {selectedItem ? selectedItem.name : "Search for an item..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-96" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Type item name to search..."
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                      />
                      <CommandList>
                        {isSearching && <CommandEmpty>Searching...</CommandEmpty>}
                        {!isSearching && searchQuery.length < 2 && (
                          <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
                        )}
                        {!isSearching && searchQuery.length >= 2 && (!searchResults?.items || searchResults.items.length === 0) && (
                          <CommandEmpty>No items found.</CommandEmpty>
                        )}
                        {searchResults?.items && searchResults.items.length > 0 && (
                          <CommandGroup heading="Search Results">
                            {searchResults.items.map((item) => (
                              <CommandItem
                                key={item.typeId}
                                onSelect={() => {
                                  setSelectedItem(item);
                                  setSearchOpen(false);
                                }}
                              >
                                {item.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button
                  onClick={handleAddItem}
                  disabled={!selectedItem || isLoadingPrice}
                  data-testid="button-add-loot-full"
                >
                  {isLoadingPrice ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Add
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Quick Add Common Loot</Label>
              <div className="flex gap-2 flex-wrap">
                {COMMON_LOOT.map((item) => (
                  <Button
                    key={item.typeId}
                    size="sm"
                    variant="outline"
                    onClick={() => handleQuickAdd(item)}
                    disabled={isLoadingPrice}
                    data-testid={`button-quick-add-full-${item.typeId}`}
                  >
                    {item.name}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {lootEntries.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label>Loot Entries ({lootEntries.length})</Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClearAll}
                className="text-destructive"
                data-testid="button-clear-loot"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {lootEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 rounded-md bg-muted/50 border gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{entry.typeName}</span>
                        <Badge variant="secondary" className="text-xs">
                          x{entry.quantity}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1 flex-wrap">
                        <span>Unit: {entry.unitPrice ? formatISK(entry.unitPrice) : "Unknown"}</span>
                        <Clock className="w-3 h-3" />
                        <span>{entry.addedAt.toLocaleTimeString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-lg">
                        {entry.totalPrice ? formatISK(entry.totalPrice) : "N/A"}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemoveEntry(entry.id)}
                        data-testid={`button-remove-loot-${entry.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
