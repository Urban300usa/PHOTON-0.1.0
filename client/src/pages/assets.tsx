import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Package,
  RefreshCw,
  MapPin,
  AlertCircle,
  Search,
  ChevronDown,
  ChevronRight,
  Boxes,
  Building2,
  Ship,
  Users,
  Container,
  Wrench,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useCharacterView } from "@/contexts/CharacterViewContext";
import { EveIcon } from "@/components/EveIcon";

interface AssetItem {
  item_id: number;
  type_id: number;
  location_id: number;
  location_flag: string;
  location_type: string;
  quantity: number;
  is_singleton: boolean;
  is_blueprint_copy?: boolean;
  characterId: number;
  characterName: string;
  typeName: string;
  locationName: string;
  unitPrice?: number;
  totalValue?: number;
  contents?: AssetItem[];
  fittedModules?: AssetItem[];
  isContainer?: boolean;
  isShip?: boolean;
  isFitted?: boolean;
  slotType?: string;
  fittingStats?: {
    highSlots: number;
    medSlots: number;
    lowSlots: number;
    rigSlots: number;
    drones: number;
    cargo: number;
  };
}

interface LocationGroup {
  locationId: number;
  locationName: string;
  locationType: string;
  items: AssetItem[];
  totalItems: number;
  locationValue?: number;
}

interface AssetsData {
  assets: LocationGroup[];
  totalAssets: number;
  totalNetWorth: number;
  characterIds: number[];
  viewAll: boolean;
}

function formatQuantity(value: number): string {
  if (value >= 1000000000) {
    return (value / 1000000000).toFixed(2) + "B";
  }
  if (value >= 1000000) {
    return (value / 1000000).toFixed(2) + "M";
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + "K";
  }
  return value.toLocaleString();
}

function formatISK(value: number): string {
  if (value >= 1000000000000) {
    return (value / 1000000000000).toFixed(2) + "T ISK";
  }
  if (value >= 1000000000) {
    return (value / 1000000000).toFixed(2) + "B ISK";
  }
  if (value >= 1000000) {
    return (value / 1000000).toFixed(2) + "M ISK";
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + "K ISK";
  }
  return value.toLocaleString() + " ISK";
}

type SortOption = 'name' | 'value' | 'quantity' | 'fitted';
type SortDirection = 'asc' | 'desc';

export default function Assets() {
  const { isAuthenticated, isLoading: authLoading, character } = useAuth();
  const { viewMode } = useCharacterView();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedLocations, setExpandedLocations] = useState<Set<number>>(new Set());
  const [expandedContainers, setExpandedContainers] = useState<Set<number>>(new Set());
  const [expandedFittings, setExpandedFittings] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>('value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const { data: assetsData, isLoading, error, refetch, isFetching } = useQuery<AssetsData>({
    queryKey: ['/api/assets', viewMode],
    queryFn: async () => {
      const url = viewMode === 'all' 
        ? '/api/assets?viewAll=true' 
        : '/api/assets';
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch assets');
      }
      return response.json();
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const filteredAssets = useMemo(() => {
    if (!assetsData?.assets) return [];

    // Sort function for items
    const sortItems = (items: AssetItem[]): AssetItem[] => {
      return [...items].sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'name':
            comparison = a.typeName.localeCompare(b.typeName);
            break;
          case 'value':
            comparison = (a.totalValue || 0) - (b.totalValue || 0);
            break;
          case 'quantity':
            comparison = a.quantity - b.quantity;
            break;
          case 'fitted':
            // Fitted ships first, then ships, then containers, then items
            const scoreA = (a.isFitted ? 3 : 0) + (a.isShip ? 2 : 0) + (a.isContainer ? 1 : 0);
            const scoreB = (b.isFitted ? 3 : 0) + (b.isShip ? 2 : 0) + (b.isContainer ? 1 : 0);
            comparison = scoreA - scoreB;
            break;
        }
        return sortDirection === 'desc' ? -comparison : comparison;
      });
    };

    // Sort function for locations (by total value)
    const sortLocations = (locations: LocationGroup[]): LocationGroup[] => {
      return [...locations].sort((a, b) => {
        const valueA = a.locationValue || 0;
        const valueB = b.locationValue || 0;
        return sortDirection === 'desc' ? valueB - valueA : valueA - valueB;
      });
    };

    let result = assetsData.assets;

    // Apply search filter if there's a search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();

      // Recursive function to check if an item or its contents match the search
      const itemMatches = (item: AssetItem): boolean => {
        if (item.typeName.toLowerCase().includes(term) ||
            item.characterName.toLowerCase().includes(term)) {
          return true;
        }
        if (item.contents) {
          return item.contents.some(child => itemMatches(child));
        }
        return false;
      };

      result = result
        .map(location => ({
          ...location,
          items: location.items.filter(item =>
            item.typeName.toLowerCase().includes(term) ||
            item.locationName.toLowerCase().includes(term) ||
            item.characterName.toLowerCase().includes(term) ||
            (item.contents && item.contents.some(child => itemMatches(child)))
          )
        }))
        .filter(location => location.items.length > 0 || location.locationName.toLowerCase().includes(term));
    }

    // Apply sorting to items within each location
    result = result.map(location => ({
      ...location,
      items: sortItems(location.items)
    }));

    // Sort locations by value
    result = sortLocations(result);

    return result;
  }, [assetsData, searchTerm, sortBy, sortDirection]);

  const toggleLocation = (locationId: number) => {
    setExpandedLocations(prev => {
      const next = new Set(prev);
      if (next.has(locationId)) {
        next.delete(locationId);
      } else {
        next.add(locationId);
      }
      return next;
    });
  };

  const toggleContainer = (itemId: number) => {
    setExpandedContainers(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const toggleFitting = (itemId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering container toggle
    setExpandedFittings(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (filteredAssets) {
      setExpandedLocations(new Set(filteredAssets.map(l => l.locationId)));
      // Expand all cargo containers and all fittings separately
      const allCargoIds: number[] = [];
      const allFittingIds: number[] = [];
      const collectExpandables = (items: AssetItem[]) => {
        for (const item of items) {
          if (item.contents && item.contents.length > 0) {
            allCargoIds.push(item.item_id);
            collectExpandables(item.contents);
          }
          if (item.fittedModules && item.fittedModules.length > 0) {
            allFittingIds.push(item.item_id);
          }
        }
      };
      filteredAssets.forEach(loc => collectExpandables(loc.items));
      setExpandedContainers(new Set(allCargoIds));
      setExpandedFittings(new Set(allFittingIds));
    }
  };

  const collapseAll = () => {
    setExpandedLocations(new Set());
    setExpandedContainers(new Set());
    setExpandedFittings(new Set());
  };

  // Recursive component to render an asset item with its contents
  const AssetItemRow = ({ item, depth = 0 }: { item: AssetItem; depth?: number }) => {
    const isCargoExpanded = expandedContainers.has(item.item_id);
    const isFittingExpanded = expandedFittings.has(item.item_id);
    const hasContents = item.contents && item.contents.length > 0;
    const hasFittedModules = item.fittedModules && item.fittedModules.length > 0;
    const isExpandable = hasContents; // Only expandable via chevron if has cargo

    // Group fitted modules by slot type
    const groupedFitting = hasFittedModules ? {
      high: item.fittedModules!.filter(m => m.slotType === 'high'),
      med: item.fittedModules!.filter(m => m.slotType === 'med'),
      low: item.fittedModules!.filter(m => m.slotType === 'low'),
      rig: item.fittedModules!.filter(m => m.slotType === 'rig'),
      subsystem: item.fittedModules!.filter(m => m.slotType === 'subsystem'),
    } : null;

    // For non-ship containers, clicking the row toggles cargo
    const isNonShipContainer = isExpandable && !item.isShip;

    return (
      <>
        <div
          key={item.item_id}
          className={`flex items-center justify-between py-2 px-3 rounded hover:bg-muted/30 transition-colors ${isNonShipContainer ? 'cursor-pointer' : ''}`}
          style={{ paddingLeft: `${12 + depth * 20}px` }}
          onClick={isNonShipContainer ? () => toggleContainer(item.item_id) : undefined}
          data-testid={`asset-${item.item_id}`}
        >
          <div className="flex items-center gap-3">
            {isNonShipContainer ? (
              isCargoExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )
            ) : (
              <div className="w-4" />
            )}
            <EveIcon
              typeId={item.type_id}
              size={item.isShip ? 64 : 32}
              alt={item.typeName}
              variant={item.is_blueprint_copy ? "bpc" : item.isShip ? "render" : "icon"}
              className={item.isShip ? "rounded-md" : ""}
            />
            <div>
              <p className="text-sm font-medium flex items-center gap-2">
                {item.typeName}
                {item.isShip && (hasFittedModules || hasContents) && (
                  <div className="flex gap-1">
                    {hasFittedModules && (
                      <Button
                        variant={isFittingExpanded ? "default" : "outline"}
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={(e) => toggleFitting(item.item_id, e)}
                      >
                        <Wrench className="h-3 w-3 mr-1" />
                        Fitting
                      </Button>
                    )}
                    {hasContents && (
                      <Button
                        variant={isCargoExpanded ? "default" : "outline"}
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={(e) => { e.stopPropagation(); toggleContainer(item.item_id); }}
                      >
                        <Container className="h-3 w-3 mr-1" />
                        Cargo ({item.contents!.length})
                      </Button>
                    )}
                  </div>
                )}
                {item.isShip && !hasFittedModules && !hasContents && (
                  <Badge variant="outline" className="text-xs text-blue-500">
                    <Ship className="h-3 w-3 mr-1" />
                    Ship
                  </Badge>
                )}
                {!item.isShip && hasContents && (
                  <Badge
                    variant="outline"
                    className={`text-xs cursor-pointer transition-colors ${isCargoExpanded ? 'ring-2 ring-primary' : 'hover:bg-muted'}`}
                    onClick={(e) => { e.stopPropagation(); toggleContainer(item.item_id); }}
                  >
                    <Container className="h-3 w-3 mr-1" />
                    {item.contents!.length}
                  </Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.location_flag.replace(/([A-Z])/g, ' $1').trim()}
                {viewMode === 'all' && (
                  <span className="ml-2 text-primary">• {item.characterName}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {item.totalValue !== undefined && item.totalValue > 0 && (
              <span className="text-xs text-muted-foreground">
                {formatISK(item.totalValue)}
              </span>
            )}
            {item.is_blueprint_copy && (
              <Badge variant="outline" className="text-xs">BPC</Badge>
            )}
            <Badge variant="secondary" className="font-mono">
              x{formatQuantity(item.quantity)}
            </Badge>
          </div>
        </div>
        {/* Fitting section - shown when Fitted badge is clicked */}
        {hasFittedModules && isFittingExpanded && groupedFitting && (
          <div className="border-l-2 border-green-500/40 ml-6">
            <div className="py-2 px-3 space-y-3" style={{ paddingLeft: `${12 + (depth + 1) * 20}px` }}>
              <p className="text-xs font-medium text-green-400 uppercase tracking-wide flex items-center gap-2">
                <Wrench className="h-3 w-3" />
                Ship Fitting
              </p>
              {groupedFitting.high.length > 0 && (
                <div className="space-y-1 rounded-md overflow-hidden">
                  <p className="text-xs slot-high font-semibold px-2 py-1 slot-high-bg">High Slots ({groupedFitting.high.length})</p>
                  {groupedFitting.high.map(mod => (
                    <div key={mod.item_id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted/30 transition-colors">
                      <EveIcon typeId={mod.type_id} size={32} alt={mod.typeName} />
                      <span className="text-sm flex-1">{mod.typeName}</span>
                      {mod.quantity > 1 && (
                        <Badge variant="secondary" className="font-mono text-xs">x{mod.quantity}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {groupedFitting.med.length > 0 && (
                <div className="space-y-1 rounded-md overflow-hidden">
                  <p className="text-xs slot-med font-semibold px-2 py-1 slot-med-bg">Mid Slots ({groupedFitting.med.length})</p>
                  {groupedFitting.med.map(mod => (
                    <div key={mod.item_id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted/30 transition-colors">
                      <EveIcon typeId={mod.type_id} size={32} alt={mod.typeName} />
                      <span className="text-sm flex-1">{mod.typeName}</span>
                      {mod.quantity > 1 && (
                        <Badge variant="secondary" className="font-mono text-xs">x{mod.quantity}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {groupedFitting.low.length > 0 && (
                <div className="space-y-1 rounded-md overflow-hidden">
                  <p className="text-xs slot-low font-semibold px-2 py-1 slot-low-bg">Low Slots ({groupedFitting.low.length})</p>
                  {groupedFitting.low.map(mod => (
                    <div key={mod.item_id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted/30 transition-colors">
                      <EveIcon typeId={mod.type_id} size={32} alt={mod.typeName} />
                      <span className="text-sm flex-1">{mod.typeName}</span>
                      {mod.quantity > 1 && (
                        <Badge variant="secondary" className="font-mono text-xs">x{mod.quantity}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {groupedFitting.rig.length > 0 && (
                <div className="space-y-1 rounded-md overflow-hidden">
                  <p className="text-xs slot-rig font-semibold px-2 py-1 slot-rig-bg">Rig Slots ({groupedFitting.rig.length})</p>
                  {groupedFitting.rig.map(mod => (
                    <div key={mod.item_id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted/30 transition-colors">
                      <EveIcon typeId={mod.type_id} size={32} alt={mod.typeName} />
                      <span className="text-sm flex-1">{mod.typeName}</span>
                      {mod.quantity > 1 && (
                        <Badge variant="secondary" className="font-mono text-xs">x{mod.quantity}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {groupedFitting.subsystem.length > 0 && (
                <div className="space-y-1 rounded-md overflow-hidden">
                  <p className="text-xs slot-subsystem font-semibold px-2 py-1 slot-subsystem-bg">Subsystems ({groupedFitting.subsystem.length})</p>
                  {groupedFitting.subsystem.map(mod => (
                    <div key={mod.item_id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted/30 transition-colors">
                      <EveIcon typeId={mod.type_id} size={32} alt={mod.typeName} />
                      <span className="text-sm flex-1">{mod.typeName}</span>
                      {mod.quantity > 1 && (
                        <Badge variant="secondary" className="font-mono text-xs">x{mod.quantity}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {/* Cargo section - shown when chevron is clicked */}
        {isExpandable && isCargoExpanded && (
          <div className="border-l-2 border-primary/20 ml-6">
            <div className="py-2 px-3" style={{ paddingLeft: `${12 + (depth + 1) * 20}px` }}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cargo</p>
            </div>
            {item.contents!.map(child => (
              <AssetItemRow key={child.item_id} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </>
    );
  };

  if (authLoading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Assets
            </CardTitle>
            <CardDescription>
              Track your character's assets and their locations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Log in with EVE Online to view your assets
              </p>
              <Link href="/">
                <Button data-testid="button-login-home">Go to Dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="h-6 w-6" />
              Assets
            </h1>
            <p className="text-muted-foreground mt-1">
              {viewMode === 'all' ? 'All characters' : character?.name || 'Your character'}'s assets and locations
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="button-refresh-assets"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <span>
                  {error instanceof Error && error.message.includes('scope') 
                    ? 'Please log out and log in again to grant assets permission'
                    : 'Failed to load assets. Please try again.'}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Net Worth</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold isk-value" data-testid="text-net-worth">
                  {formatISK(assetsData?.totalNetWorth || 0)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">
                  {formatQuantity(assetsData?.totalAssets || 0)}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Locations</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">
                  {assetsData?.assets?.length || 0}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Characters</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  {assetsData?.characterIds?.length || 1}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">View Mode</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={viewMode === 'all' ? 'default' : 'secondary'}>
                {viewMode === 'all' ? 'All Characters' : 'Single Character'}
              </Badge>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Assets by Location
                </CardTitle>
                <CardDescription>
                  Your items organized by their storage location
                </CardDescription>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search items or locations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-64"
                    data-testid="input-search-assets"
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      Sort: {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
                      {sortDirection === 'desc' ? (
                        <ArrowDown className="h-3 w-3 ml-1" />
                      ) : (
                        <ArrowUp className="h-3 w-3 ml-1" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setSortBy('value'); setSortDirection('desc'); }}>
                      Value (High to Low)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSortBy('value'); setSortDirection('asc'); }}>
                      Value (Low to High)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSortBy('name'); setSortDirection('asc'); }}>
                      Name (A-Z)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSortBy('name'); setSortDirection('desc'); }}>
                      Name (Z-A)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSortBy('quantity'); setSortDirection('desc'); }}>
                      Quantity (High to Low)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSortBy('fitted'); setSortDirection('desc'); }}>
                      Ships & Fitted First
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" size="sm" onClick={expandAll} data-testid="button-expand-all">
                  Expand All
                </Button>
                <Button variant="ghost" size="sm" onClick={collapseAll} data-testid="button-collapse-all">
                  Collapse All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Boxes className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>
                  {searchTerm 
                    ? `No items found matching "${searchTerm}"`
                    : 'No assets found'}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-2">
                  {filteredAssets.map((location) => (
                    <Collapsible
                      key={location.locationId}
                      open={expandedLocations.has(location.locationId)}
                      onOpenChange={() => toggleLocation(location.locationId)}
                    >
                      <CollapsibleTrigger asChild>
                        <div 
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                          data-testid={`location-${location.locationId}`}
                        >
                          <div className="flex items-center gap-3">
                            {expandedLocations.has(location.locationId) 
                              ? <ChevronDown className="h-4 w-4" />
                              : <ChevronRight className="h-4 w-4" />
                            }
                            {location.locationType === 'station' ? (
                              <Building2 className="h-5 w-5 text-blue-500" />
                            ) : location.locationType === 'solar_system' ? (
                              <MapPin className="h-5 w-5 text-yellow-500" />
                            ) : (
                              <Ship className="h-5 w-5 text-purple-500" />
                            )}
                            <div>
                              <p className="font-medium">{location.locationName}</p>
                              <p className="text-xs text-muted-foreground">
                                {location.locationType === 'station' ? 'Station' : 
                                 location.locationType === 'solar_system' ? 'Solar System' : 'Structure'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {location.locationValue !== undefined && location.locationValue > 0 && (
                              <span className="text-sm font-medium text-primary">
                                {formatISK(location.locationValue)}
                              </span>
                            )}
                            <Badge variant="secondary">
                              {location.items.length} item{location.items.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 ml-8 border-l-2 border-border pl-4 space-y-1">
                          {location.items.slice(0, 100).map((item) => (
                            <AssetItemRow key={item.item_id} item={item} />
                          ))}
                          {location.items.length > 100 && (
                            <div className="text-center py-2 text-sm text-muted-foreground">
                              ... and {location.items.length - 100} more items
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
