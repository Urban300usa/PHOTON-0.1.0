import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Save,
  FolderOpen,
  Star,
  StarOff,
  Trash2,
  MoreVertical,
  Plus,
  BookOpen,
  Calculator,
  Package,
  Edit2,
  Crown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProContext } from "@/contexts/ProContext";
import { apiRequest } from "@/lib/queryClient";
import { EveIcon } from "@/components/EveIcon";
import {
  PICommodity,
  PITier,
  TIER_COLORS,
  TIER_NAMES,
  buildProductionChain,
  calculateMaterialsByTier,
} from "@/lib/pi-chain-data";

interface SavedPiChain {
  id: string;
  characterId: number;
  name: string;
  description: string | null;
  targetProductTypeId: number;
  targetProductName: string;
  targetTier: PITier;
  unitsPerDay: number;
  chainDataJson: any;
  planetAssignments: any | null;
  estimatedDailyIsk: number | null;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PiChainBuilderProps {
  selectedCommodity: PICommodity | null;
  outputQuantity: number;
  timeFrame: "cycle" | "hour" | "day";
  numFactories: number;
  prices: Record<number, number>;
  onLoadChain?: (chain: SavedPiChain) => void;
}

function formatIsk(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

export default function PiChainBuilder({
  selectedCommodity,
  outputQuantity,
  timeFrame,
  numFactories,
  prices,
  onLoadChain,
}: PiChainBuilderProps) {
  const { toast } = useToast();
  const { isPro } = useProContext();
  const queryClient = useQueryClient();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [chainName, setChainName] = useState("");
  const [chainDescription, setChainDescription] = useState("");
  const [editingChain, setEditingChain] = useState<SavedPiChain | null>(null);

  // Fetch saved chains
  const { data: chainsData, isLoading: chainsLoading } = useQuery<{ chains: SavedPiChain[] }>({
    queryKey: ["/api/pi/chains"],
    enabled: isPro,
  });

  const savedChains = chainsData?.chains || [];

  // Calculate daily units for saving
  const dailyUnits = useMemo(() => {
    if (!selectedCommodity || selectedCommodity.tier === "P0") return outputQuantity;

    const cycleMinutes = {
      P0: 0, P1: 30, P2: 60, P3: 60, P4: 60,
    }[selectedCommodity.tier];

    if (!cycleMinutes) return outputQuantity;

    const cyclesPerDay = (24 * 60) / cycleMinutes;
    const outputPerCycle = {
      P0: 0, P1: 20, P2: 5, P3: 3, P4: 1,
    }[selectedCommodity.tier];

    return Math.ceil(outputPerCycle * cyclesPerDay * numFactories);
  }, [selectedCommodity, numFactories, outputQuantity]);

  // Calculate estimated daily ISK
  const estimatedDailyIsk = useMemo(() => {
    if (!selectedCommodity || !prices[selectedCommodity.typeId]) return 0;

    const chain = buildProductionChain(selectedCommodity.typeId, dailyUnits);
    if (!chain) return 0;

    const materialsByTier = calculateMaterialsByTier(chain);
    const p0Cost = Array.from(materialsByTier["P0"].values()).reduce(
      (sum, m) => sum + m.quantity * (prices[m.commodity.typeId] || 0),
      0
    );

    const outputValue = prices[selectedCommodity.typeId] * dailyUnits;
    return outputValue - p0Cost;
  }, [selectedCommodity, dailyUnits, prices]);

  // Save chain mutation
  const saveMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description: string;
      targetProductTypeId: number;
      targetProductName: string;
      targetTier: PITier;
      unitsPerDay: number;
      chainDataJson: any;
      estimatedDailyIsk: number;
    }) => {
      const response = await apiRequest("POST", "/api/pi/chains", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pi/chains"] });
      setSaveDialogOpen(false);
      setChainName("");
      setChainDescription("");
      toast({
        title: "Chain Saved",
        description: "Your production chain has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save production chain.",
        variant: "destructive",
      });
    },
  });

  // Update chain mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; isFavorite?: boolean }) => {
      const response = await apiRequest("PUT", `/api/pi/chains/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pi/chains"] });
      setEditingChain(null);
      toast({
        title: "Chain Updated",
        description: "Your production chain has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update production chain.",
        variant: "destructive",
      });
    },
  });

  // Delete chain mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/pi/chains/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pi/chains"] });
      toast({
        title: "Chain Deleted",
        description: "Your production chain has been deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete production chain.",
        variant: "destructive",
      });
    },
  });

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/pi/chains/${id}/favorite`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pi/chains"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to toggle favorite.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!selectedCommodity || !chainName.trim()) return;

    const chain = buildProductionChain(selectedCommodity.typeId, dailyUnits);
    if (!chain) return;

    saveMutation.mutate({
      name: chainName.trim(),
      description: chainDescription.trim(),
      targetProductTypeId: selectedCommodity.typeId,
      targetProductName: selectedCommodity.name,
      targetTier: selectedCommodity.tier,
      unitsPerDay: dailyUnits,
      chainDataJson: chain,
      estimatedDailyIsk,
    });
  };

  const handleLoad = (chain: SavedPiChain) => {
    if (onLoadChain) {
      onLoadChain(chain);
    }
    setLoadDialogOpen(false);
    toast({
      title: "Chain Loaded",
      description: `Loaded "${chain.name}" production chain.`,
    });
  };

  if (!isPro) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4 text-center">
          <Crown className="h-8 w-8 mx-auto mb-2 text-amber-500" />
          <p className="text-sm font-medium">PRO Feature</p>
          <p className="text-xs text-muted-foreground mt-1">
            Save and load production chains with PHOTON PRO
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Save Button */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={!selectedCommodity || selectedCommodity.tier === "P0"}
            data-testid="button-save-chain"
          >
            <Save className="h-4 w-4 mr-1" />
            Save Chain
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Production Chain</DialogTitle>
            <DialogDescription>
              Save this production chain configuration for quick access later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedCommodity && (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <EveIcon
                  typeId={selectedCommodity.typeId}
                  size={32}
                  alt={selectedCommodity.name}
                  className="w-8 h-8"
                />
                <div>
                  <p className="font-medium">{selectedCommodity.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {TIER_NAMES[selectedCommodity.tier]} • {dailyUnits.toLocaleString()} units/day
                  </p>
                </div>
                {estimatedDailyIsk > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    ~{formatIsk(estimatedDailyIsk)}/day
                  </Badge>
                )}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="My Production Chain"
                value={chainName}
                onChange={(e) => setChainName(e.target.value)}
                data-testid="input-chain-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description (optional)</label>
              <Textarea
                placeholder="Notes about this chain..."
                value={chainDescription}
                onChange={(e) => setChainDescription(e.target.value)}
                rows={3}
                data-testid="input-chain-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!chainName.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : "Save Chain"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Button */}
      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" data-testid="button-load-chain">
            <FolderOpen className="h-4 w-4 mr-1" />
            Load Chain
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Saved Production Chains</DialogTitle>
            <DialogDescription>
              Load a previously saved production chain configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {chainsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : savedChains.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No saved chains yet</p>
                <p className="text-sm mt-1">
                  Select a commodity and save a production chain to see it here.
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2 pr-4">
                  {savedChains
                    .sort((a, b) => {
                      if (a.isFavorite && !b.isFavorite) return -1;
                      if (!a.isFavorite && b.isFavorite) return 1;
                      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
                    })
                    .map((chain) => {
                      const tierColors = TIER_COLORS[chain.targetTier];
                      return (
                        <div
                          key={chain.id}
                          className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                          data-testid={`saved-chain-${chain.id}`}
                        >
                          <div className="relative">
                            <EveIcon
                              typeId={chain.targetProductTypeId}
                              size={40}
                              alt={chain.targetProductName}
                              className="w-10 h-10"
                            />
                            {chain.isFavorite && (
                              <Star className="absolute -top-1 -right-1 h-4 w-4 text-amber-500 fill-amber-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{chain.name}</p>
                              <Badge
                                variant="outline"
                                className={`${tierColors.text} ${tierColors.border} text-xs`}
                              >
                                {chain.targetTier}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {chain.targetProductName} • {chain.unitsPerDay.toLocaleString()} units/day
                            </p>
                            {chain.description && (
                              <p className="text-xs text-muted-foreground truncate mt-1">
                                {chain.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {chain.estimatedDailyIsk && chain.estimatedDailyIsk > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                ~{formatIsk(chain.estimatedDailyIsk)}/day
                              </Badge>
                            )}
                            <Button
                              size="sm"
                              onClick={() => handleLoad(chain)}
                            >
                              Load
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => toggleFavoriteMutation.mutate(chain.id)}
                                >
                                  {chain.isFavorite ? (
                                    <>
                                      <StarOff className="h-4 w-4 mr-2" />
                                      Remove Favorite
                                    </>
                                  ) : (
                                    <>
                                      <Star className="h-4 w-4 mr-2" />
                                      Add Favorite
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setEditingChain(chain)}
                                >
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => deleteMutation.mutate(chain.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingChain} onOpenChange={() => setEditingChain(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Production Chain</DialogTitle>
          </DialogHeader>
          {editingChain && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={editingChain.name}
                  onChange={(e) =>
                    setEditingChain({ ...editingChain, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={editingChain.description || ""}
                  onChange={(e) =>
                    setEditingChain({ ...editingChain, description: e.target.value })
                  }
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingChain(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingChain) {
                  updateMutation.mutate({
                    id: editingChain.id,
                    name: editingChain.name,
                    description: editingChain.description || "",
                  });
                }
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
