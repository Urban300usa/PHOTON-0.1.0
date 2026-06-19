import { useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Globe2, 
  RefreshCw, 
  Clock,
  AlertTriangle,
  Package,
  Factory,
  Timer,
  CheckCircle2,
  User,
  MapPin,
  Droplets,
  Mountain,
  Flame,
  Wind,
  Snowflake,
  Sun,
  Zap,
  Boxes,
  ArrowRight,
  TrendingUp,
  Coins,
  GitBranch,
  CircleDot,
  ArrowDown,
  Calculator,
  ChevronRight,
  Search,
  X
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  PI_COMMODITIES,
  PITier,
  PICommodity,
  ProductionChainNode,
  PlanetType,
  TIER_COLORS,
  TIER_NAMES,
  PLANET_TYPE_INFO,
  P0_PLANET_SOURCES,
  getCommoditiesByTier,
  buildProductionChain,
  calculateMaterialsByTier,
  getCommodityById,
  getPlanetTypesForNode
} from "@/lib/pi-chain-data";
import { useAuth } from "@/hooks/use-auth";
import { useCharacterView } from "@/contexts/CharacterViewContext";
import { EveIcon } from "@/components/EveIcon";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow, differenceInSeconds, differenceInHours, format, isPast, isFuture } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PiChainBuilder from "@/components/PiChainBuilder";

const CYCLE_INFO: Record<PITier, { cycleMinutes: number; outputPerCycle: number }> = {
  'P0': { cycleMinutes: 0, outputPerCycle: 0 },
  'P1': { cycleMinutes: 30, outputPerCycle: 20 },
  'P2': { cycleMinutes: 60, outputPerCycle: 5 },
  'P3': { cycleMinutes: 60, outputPerCycle: 3 },
  'P4': { cycleMinutes: 60, outputPerCycle: 1 },
};

type TimeFrame = 'cycle' | 'hour' | 'day';

interface PlanetaryPin {
  id: string;
  characterId: number;
  planetId: number;
  pinId: number;
  typeId: number;
  typeName: string;
  schematicId: number | null;
  schematicName: string | null;
  extractorProductTypeId: number | null;
  extractorProductName: string | null;
  cycleTime: number | null;
  headRadius: number | null;
  numHeads: number | null;
  quantityPerCycle: number | null;
  installTime: string | null;
  expiryTime: string | null;
  contentsJson: { typeId: number; typeName: string; quantity: number }[] | null;
  capacity: number | null;
  usedCapacity: number | null;
  latitude: number | null;
  longitude: number | null;
}

interface PlanetaryPlanet {
  id: string;
  characterId: number;
  characterName: string;
  planetId: number;
  planetName: string;
  planetTypeId: number;
  planetTypeName: string;
  solarSystemId: number;
  solarSystemName: string;
  upgradeLevel: number;
  numPins: number;
  lastUpdate: string | null;
  pins?: PlanetaryPin[];
}

interface PlanetsResponse {
  planets: PlanetaryPlanet[];
  characterId?: number;
  characterIds?: number[];
  viewAll: boolean;
}

interface SyncResult {
  characterId: number;
  success: boolean;
  reason?: string;
  planetCount?: number;
}

interface SyncResponse {
  results?: SyncResult[];
  result?: SyncResult;
  viewAll: boolean;
}

interface ExtractorValue {
  pinId: number;
  planetName: string;
  solarSystemName: string;
  characterId: number;
  productTypeId: number;
  productName: string;
  pricePerUnit: number;
  cycleTime: number;
  quantityPerCycle: number;
  unitsPerDay: number;
  iskPerDay: number;
  isActive: boolean;
  expiryTime: string | null;
}

interface FactoryValue {
  pinId: number;
  planetName: string;
  solarSystemName: string;
  characterId: number;
  schematicId: number;
  schematicName: string;
  typeName: string;
}

interface StorageContent {
  typeId: number;
  typeName: string;
  quantity: number;
  pricePerUnit: number;
  totalValue: number;
}

interface StorageValue {
  pinId: number;
  planetName: string;
  solarSystemName: string;
  characterId: number;
  typeName: string;
  capacity: number | null;
  usedCapacity: number | null;
  contents: StorageContent[];
  totalValue: number;
}

interface ValuesResponse {
  extractors: ExtractorValue[];
  factories: FactoryValue[];
  storage: StorageValue[];
  summary: {
    totalActiveExtractors: number;
    totalExtractors: number;
    totalFactories: number;
    totalDailyIsk: number;
    totalStorageValue: number;
    pricesLoaded: number;
  };
  viewAll: boolean;
}

const PLANET_TYPE_CONFIG: Record<string, { icon: typeof Globe2; color: string; bgColor: string }> = {
  'Temperate': { icon: Globe2, color: "text-green-500", bgColor: "bg-green-500/10" },
  'Barren': { icon: Mountain, color: "text-amber-600", bgColor: "bg-amber-600/10" },
  'Oceanic': { icon: Droplets, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  'Ice': { icon: Snowflake, color: "text-cyan-400", bgColor: "bg-cyan-400/10" },
  'Gas': { icon: Wind, color: "text-purple-500", bgColor: "bg-purple-500/10" },
  'Lava': { icon: Flame, color: "text-red-500", bgColor: "bg-red-500/10" },
  'Storm': { icon: Zap, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
  'Plasma': { icon: Sun, color: "text-orange-500", bgColor: "bg-orange-500/10" },
};

function getExtractorStatus(pin: PlanetaryPin): { status: 'active' | 'expiring' | 'expired' | 'idle'; label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (!pin.expiryTime) {
    return { status: 'idle', label: 'Idle', variant: 'outline' };
  }
  
  const expiry = new Date(pin.expiryTime);
  const now = new Date();
  
  if (isPast(expiry)) {
    return { status: 'expired', label: 'Expired', variant: 'destructive' };
  }
  
  const hoursRemaining = differenceInHours(expiry, now);
  if (hoursRemaining < 6) {
    return { status: 'expiring', label: 'Expiring Soon', variant: 'secondary' };
  }
  
  return { status: 'active', label: 'Active', variant: 'default' };
}

function formatTimeRemaining(expiryTime: string | null): string {
  if (!expiryTime) return 'N/A';
  
  const expiry = new Date(expiryTime);
  const now = new Date();
  
  if (isPast(expiry)) {
    return 'Expired ' + formatDistanceToNow(expiry, { addSuffix: true });
  }
  
  return formatDistanceToNow(expiry, { addSuffix: true });
}

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
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

function isExtractor(pin: PlanetaryPin): boolean {
  return pin.extractorProductTypeId !== null || pin.typeName?.toLowerCase().includes('extractor');
}

function isFactory(pin: PlanetaryPin): boolean {
  return pin.schematicId !== null || pin.typeName?.toLowerCase().includes('processor') || pin.typeName?.toLowerCase().includes('industry');
}

function isStorage(pin: PlanetaryPin): boolean {
  return pin.typeName?.toLowerCase().includes('storage') || pin.typeName?.toLowerCase().includes('launchpad');
}

function PlanetCard({ planet, showCharacter }: { planet: PlanetaryPlanet; showCharacter: boolean }) {
  const typeConfig = PLANET_TYPE_CONFIG[planet.planetTypeName] || { icon: Globe2, color: "text-muted-foreground", bgColor: "bg-muted" };
  const PlanetIcon = typeConfig.icon;
  
  const extractors = planet.pins?.filter(isExtractor) || [];
  const factories = planet.pins?.filter(isFactory) || [];
  const storages = planet.pins?.filter(isStorage) || [];
  
  const expiredExtractors = extractors.filter(p => getExtractorStatus(p).status === 'expired');
  const expiringExtractors = extractors.filter(p => getExtractorStatus(p).status === 'expiring');
  
  const hasIssues = expiredExtractors.length > 0 || expiringExtractors.length > 0;
  
  return (
    <Card className="hover-elevate" data-testid={`card-planet-${planet.planetId}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`p-2 rounded-lg ${typeConfig.bgColor}`}>
              <PlanetIcon className={`h-5 w-5 ${typeConfig.color}`} />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate" data-testid={`text-planet-name-${planet.planetId}`}>
                {planet.planetName}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {planet.solarSystemName}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1 items-end">
            <Badge variant="outline" className="text-xs">
              {planet.planetTypeName}
            </Badge>
            {hasIssues && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {expiredExtractors.length > 0 ? 'Expired' : 'Expiring'}
              </Badge>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-help">
                <Droplets className="h-3.5 w-3.5 text-blue-500" />
                <span>{extractors.length}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {extractors.length} Extractor{extractors.length !== 1 ? 's' : ''}
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-help">
                <Factory className="h-3.5 w-3.5 text-amber-500" />
                <span>{factories.length}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {factories.length} Factor{factories.length !== 1 ? 'ies' : 'y'}
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-help">
                <Boxes className="h-3.5 w-3.5 text-green-500" />
                <span>{storages.length}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {storages.length} Storage/Launchpad{storages.length !== 1 ? 's' : ''}
            </TooltipContent>
          </Tooltip>
        </div>
        
        {extractors.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Extractors</p>
            {extractors.slice(0, 3).map(extractor => {
              const status = getExtractorStatus(extractor);
              return (
                <div key={extractor.pinId} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 truncate flex-1 mr-2">
                    {extractor.extractorProductTypeId && (
                      <EveIcon typeId={extractor.extractorProductTypeId} size={32} alt={extractor.extractorProductName || ''} className="w-4 h-4" />
                    )}
                    <span className="truncate">
                      {extractor.extractorProductName || 'Unknown Resource'}
                    </span>
                  </div>
                  <Badge variant={status.variant} className="text-xs flex-shrink-0">
                    {extractor.expiryTime ? formatTimeRemaining(extractor.expiryTime) : status.label}
                  </Badge>
                </div>
              );
            })}
            {extractors.length > 3 && (
              <p className="text-xs text-muted-foreground">
                +{extractors.length - 3} more extractor{extractors.length - 3 !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}
        
        {showCharacter && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              {planet.characterName}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExtractorRow({ pin, showPlanet, planetName }: { pin: PlanetaryPin; showPlanet?: boolean; planetName?: string }) {
  const status = getExtractorStatus(pin);
  
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover-elevate" data-testid={`extractor-${pin.pinId}`}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {pin.extractorProductTypeId ? (
          <EveIcon typeId={pin.extractorProductTypeId} size={32} alt={pin.extractorProductName || ''} className="w-6 h-6 flex-shrink-0" />
        ) : (
          <Droplets className="h-4 w-4 text-blue-500 flex-shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {pin.extractorProductName || 'Unknown Resource'}
          </p>
          {showPlanet && planetName && (
            <p className="text-xs text-muted-foreground truncate">{planetName}</p>
          )}
          {pin.quantityPerCycle && pin.cycleTime && (
            <p className="text-xs text-muted-foreground">
              {pin.quantityPerCycle.toLocaleString()} units / {formatDuration(pin.cycleTime)}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {pin.numHeads && (
          <span className="text-xs text-muted-foreground">{pin.numHeads} heads</span>
        )}
        <Badge variant={status.variant}>
          {pin.expiryTime ? formatTimeRemaining(pin.expiryTime) : status.label}
        </Badge>
      </div>
    </div>
  );
}

export default function PlanetaryIndustry() {
  const { isAuthenticated, character } = useAuth();
  const { viewMode } = useCharacterView();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedCommodity, setSelectedCommodity] = useState<PICommodity | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTier, setSelectedTier] = useState<PITier | 'all'>('all');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('cycle');
  const [numFactories, setNumFactories] = useState(1);
  
  const [customsOfficeTax, setCustomsOfficeTax] = useState(10);
  const [salesTax, setSalesTax] = useState(3.6);
  const [brokerFee, setBrokerFee] = useState(3);
  
  const viewAll = viewMode === 'all';
  
  const { data: planetsData, isLoading, error, refetch } = useQuery<PlanetsResponse>({
    queryKey: ['/api/planetary/planets', viewAll],
    queryFn: async () => {
      const response = await fetch(`/api/planetary/planets?viewAll=${viewAll}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch planets');
      return response.json();
    },
    enabled: isAuthenticated,
  });
  
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/planetary/sync?viewAll=${viewAll}`);
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/planetary/planets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/planetary/values'] });
      
      const results = data.results || (data.result ? [data.result] : []);
      const scopeNotGranted = results.filter((r: any) => r.reason === 'scope_not_granted');
      const successful = results.filter((r: any) => r.success);
      const totalPlanets = successful.reduce((sum: number, r: any) => sum + (r.planetCount || 0), 0);
      
      if (scopeNotGranted.length > 0) {
        toast({
          title: "PI Scope Not Granted",
          description: "Some characters need to re-authenticate to grant Planetary Industry permissions. Please log out and log back in.",
          variant: "destructive",
        });
      } else if (successful.length > 0) {
        toast({
          title: "Sync Complete",
          description: `Synced ${totalPlanets} planet${totalPlanets !== 1 ? 's' : ''} from ${successful.length} character${successful.length !== 1 ? 's' : ''}.`,
        });
      } else {
        toast({
          title: "No Planets Found",
          description: "No planetary colonies found. Set up PI in EVE Online first.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync planetary data from ESI.",
        variant: "destructive",
      });
    },
  });
  
  const { data: valuesData, isLoading: valuesLoading } = useQuery<ValuesResponse>({
    queryKey: ['/api/planetary/values', viewAll],
    queryFn: async () => {
      const response = await fetch(`/api/planetary/values?viewAll=${viewAll}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch values');
      return response.json();
    },
    enabled: isAuthenticated && (activeTab === 'values' || activeTab === 'production'),
  });
  
  const cycleMultiplier = useMemo(() => {
    if (!selectedCommodity || selectedCommodity.tier === 'P0') return 1;
    const cycleInfo = CYCLE_INFO[selectedCommodity.tier];
    if (!cycleInfo.cycleMinutes) return 1;
    
    const cyclesPerHour = 60 / cycleInfo.cycleMinutes;
    const cyclesPerDay = cyclesPerHour * 24;
    
    switch (timeFrame) {
      case 'hour': return cyclesPerHour * numFactories;
      case 'day': return cyclesPerDay * numFactories;
      case 'cycle':
      default: return numFactories;
    }
  }, [selectedCommodity, timeFrame, numFactories]);
  
  const outputQuantity = useMemo(() => {
    if (!selectedCommodity || selectedCommodity.tier === 'P0') return 1;
    const cycleInfo = CYCLE_INFO[selectedCommodity.tier];
    return Math.ceil(cycleInfo.outputPerCycle * cycleMultiplier);
  }, [selectedCommodity, cycleMultiplier]);
  
  const chainMaterials = useMemo(() => {
    if (!selectedCommodity || selectedCommodity.tier === 'P0') return null;
    const chain = buildProductionChain(selectedCommodity.typeId, outputQuantity);
    if (!chain) return null;
    return calculateMaterialsByTier(chain);
  }, [selectedCommodity, outputQuantity]);
  
  const chainTypeIds = useMemo(() => {
    if (!chainMaterials) return [];
    const ids: number[] = [];
    for (const tier of ['P0', 'P1', 'P2', 'P3', 'P4'] as PITier[]) {
      chainMaterials[tier].forEach((_, typeId) => ids.push(typeId));
    }
    if (selectedCommodity) ids.push(selectedCommodity.typeId);
    return ids;
  }, [chainMaterials, selectedCommodity]);
  
  const { data: pricesData, isLoading: pricesLoading } = useQuery<{ prices: Record<number, number> }>({
    queryKey: ['/api/pi/prices', { typeIds: chainTypeIds.join(',') }],
    enabled: chainTypeIds.length > 0 && activeTab === 'calculator',
    queryFn: async () => {
      const response = await fetch(`/api/pi/prices?typeIds=${chainTypeIds.join(',')}`);
      if (!response.ok) throw new Error('Failed to fetch prices');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  
  const prices = pricesData?.prices || {};
  
  const planets = planetsData?.planets || [];
  
  const allExtractors = useMemo(() => {
    return planets.flatMap(planet => 
      (planet.pins || [])
        .filter(isExtractor)
        .map(pin => ({ ...pin, planetName: planet.planetName }))
    ).sort((a, b) => {
      if (!a.expiryTime && !b.expiryTime) return 0;
      if (!a.expiryTime) return 1;
      if (!b.expiryTime) return -1;
      return new Date(a.expiryTime).getTime() - new Date(b.expiryTime).getTime();
    });
  }, [planets]);
  
  const stats = useMemo(() => {
    const totalPlanets = planets.length;
    const totalExtractors = allExtractors.length;
    const activeExtractors = allExtractors.filter(e => getExtractorStatus(e).status === 'active').length;
    const expiredExtractors = allExtractors.filter(e => getExtractorStatus(e).status === 'expired').length;
    const expiringExtractors = allExtractors.filter(e => getExtractorStatus(e).status === 'expiring').length;
    
    return {
      totalPlanets,
      totalExtractors,
      activeExtractors,
      expiredExtractors,
      expiringExtractors,
    };
  }, [planets, allExtractors]);
  
  if (!isAuthenticated) {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <Globe2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
            <p className="text-muted-foreground mb-4">
              Please log in with your EVE Online account to view your planetary colonies.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container max-w-6xl mx-auto px-4 py-6">
      <PageHeader
        icon={Globe2}
        title="Planetary Industry"
        subtitle={viewAll ? 'Viewing all characters' : `Viewing ${character?.name || 'active character'}`}
        actions={
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            data-testid="button-sync-pi"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            {syncMutation.isPending ? 'Syncing...' : 'Sync from ESI'}
          </Button>
        }
      />
      
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold" data-testid="stat-total-planets">{stats.totalPlanets}</div>
            <p className="text-xs text-muted-foreground">Planets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold" data-testid="stat-total-extractors">{stats.totalExtractors}</div>
            <p className="text-xs text-muted-foreground">Extractors</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-500" data-testid="stat-active-extractors">{stats.activeExtractors}</div>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-500" data-testid="stat-expiring-extractors">{stats.expiringExtractors}</div>
            <p className="text-xs text-muted-foreground">Expiring</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-500" data-testid="stat-expired-extractors">{stats.expiredExtractors}</div>
            <p className="text-xs text-muted-foreground">Expired</p>
          </CardContent>
        </Card>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Globe2 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="extractors" data-testid="tab-extractors">
            <Droplets className="h-4 w-4 mr-2" />
            Extractors
          </TabsTrigger>
          <TabsTrigger value="values" data-testid="tab-values">
            <Coins className="h-4 w-4 mr-2" />
            ISK Values
          </TabsTrigger>
          <TabsTrigger value="production" data-testid="tab-production">
            <GitBranch className="h-4 w-4 mr-2" />
            Production
          </TabsTrigger>
          <TabsTrigger value="calculator" data-testid="tab-calculator">
            <Calculator className="h-4 w-4 mr-2" />
            PI Calculator
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-12 w-full mb-3" />
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : planets.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Globe2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Planetary Colonies Found</h3>
                <p className="text-muted-foreground mb-4">
                  {syncMutation.isPending 
                    ? 'Syncing your planetary data...' 
                    : 'Click "Sync from ESI" to fetch your planetary colonies, or set up PI in EVE Online first.'}
                </p>
                {!syncMutation.isPending && (
                  <Button onClick={() => syncMutation.mutate()} data-testid="button-sync-empty">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync from ESI
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {planets.map(planet => (
                <PlanetCard key={planet.id} planet={planet} showCharacter={viewAll} />
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="extractors">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : allExtractors.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Droplets className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Extractors Found</h3>
                <p className="text-muted-foreground">
                  Set up extractor control units on your planets in EVE Online to see them here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">All Extractors</CardTitle>
                <CardDescription>
                  Sorted by expiry time - expired and expiring extractors are shown first
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {allExtractors.map(extractor => (
                      <ExtractorRow 
                        key={`${extractor.characterId}-${extractor.pinId}`}
                        pin={extractor}
                        showPlanet
                        planetName={(extractor as any).planetName}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="values">
          {valuesLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-8 w-full mb-2" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Skeleton className="h-64 w-full" />
            </div>
          ) : !valuesData ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Coins className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Loading ISK Values</h3>
                <p className="text-muted-foreground">
                  Fetching Jita market prices for your PI commodities...
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                      <span className="text-sm font-medium">Daily Production</span>
                    </div>
                    <div className="text-2xl font-bold text-green-500" data-testid="stat-daily-isk">
                      {formatIsk(valuesData.summary.totalDailyIsk)} ISK
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      From {valuesData.summary.totalActiveExtractors} active extractor{valuesData.summary.totalActiveExtractors !== 1 ? 's' : ''}
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-amber-500/10 to-yellow-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Boxes className="h-5 w-5 text-amber-500" />
                      <span className="text-sm font-medium">Storage Value</span>
                    </div>
                    <div className="text-2xl font-bold text-amber-500" data-testid="stat-storage-value">
                      {formatIsk(valuesData.summary.totalStorageValue)} ISK
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Commodities in storage/launchpads
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Factory className="h-5 w-5 text-blue-500" />
                      <span className="text-sm font-medium">Processing</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-500" data-testid="stat-factories">
                      {valuesData.summary.totalFactories}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Active factories
                    </p>
                  </CardContent>
                </Card>
              </div>
              
              {valuesData.extractors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Droplets className="h-4 w-4" />
                      Extractor Production Values
                    </CardTitle>
                    <CardDescription>
                      Estimated daily ISK based on Jita sell prices
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[350px]">
                      <div className="space-y-2">
                        {valuesData.extractors
                          .sort((a, b) => b.iskPerDay - a.iskPerDay)
                          .map(extractor => (
                            <div 
                              key={extractor.pinId} 
                              className={`flex items-center justify-between p-3 border rounded-lg ${extractor.isActive ? '' : 'opacity-50'}`}
                              data-testid={`extractor-value-${extractor.pinId}`}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <EveIcon typeId={extractor.productTypeId} size={32} alt={extractor.productName} className="w-8 h-8 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{extractor.productName}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {extractor.planetName} - {extractor.unitsPerDay.toLocaleString()} units/day
                                  </p>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0 ml-2">
                                <p className={`font-medium ${extractor.isActive ? 'text-green-500' : 'text-muted-foreground'}`}>
                                  {formatIsk(extractor.iskPerDay)}/day
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  @ {formatIsk(extractor.pricePerUnit)}/unit
                                </p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
              
              {valuesData.storage.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Boxes className="h-4 w-4" />
                      Storage Contents Value
                    </CardTitle>
                    <CardDescription>
                      Current inventory value based on Jita sell prices
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3">
                        {valuesData.storage
                          .sort((a, b) => b.totalValue - a.totalValue)
                          .map(storage => (
                            <div 
                              key={storage.pinId} 
                              className="p-3 border rounded-lg"
                              data-testid={`storage-value-${storage.pinId}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Package className="h-4 w-4 text-amber-500" />
                                  <span className="text-sm font-medium">{storage.typeName}</span>
                                </div>
                                <Badge variant="outline">{formatIsk(storage.totalValue)} ISK</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">{storage.planetName}</p>
                              <div className="space-y-1">
                                {storage.contents.slice(0, 5).map(item => (
                                  <div key={item.typeId} className="flex items-center justify-between text-xs gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <EveIcon typeId={item.typeId} size={32} alt={item.typeName} className="w-4 h-4 flex-shrink-0" />
                                      <span className="text-muted-foreground truncate">{item.typeName}</span>
                                    </div>
                                    <span className="flex-shrink-0">{item.quantity.toLocaleString()} ({formatIsk(item.totalValue)})</span>
                                  </div>
                                ))}
                                {storage.contents.length > 5 && (
                                  <p className="text-xs text-muted-foreground">
                                    +{storage.contents.length - 5} more items
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="production">
          {valuesLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-64 w-full" />
            </div>
          ) : !valuesData ? (
            <Card>
              <CardContent className="p-8 text-center">
                <GitBranch className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Loading Production Chain</h3>
                <p className="text-muted-foreground">
                  Analyzing your planetary production setup...
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    Production Chain Overview
                  </CardTitle>
                  <CardDescription>
                    Visual overview of your PI production flow by planet
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {planets.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No planets found. Sync your PI data first.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {planets.map(planet => {
                        const extractors = planet.pins?.filter(isExtractor) || [];
                        const factories = planet.pins?.filter(isFactory) || [];
                        const storages = planet.pins?.filter(isStorage) || [];
                        
                        if (extractors.length === 0 && factories.length === 0) return null;
                        
                        const typeConfig = PLANET_TYPE_CONFIG[planet.planetTypeName] || { color: "text-muted-foreground", bgColor: "bg-muted" };
                        
                        return (
                          <div 
                            key={planet.id} 
                            className="p-4 border rounded-lg"
                            data-testid={`production-chain-${planet.planetId}`}
                          >
                            <div className="flex items-center gap-2 mb-4">
                              <Globe2 className={`h-5 w-5 ${typeConfig.color}`} />
                              <span className="font-medium">{planet.planetName}</span>
                              <Badge variant="outline" className="text-xs">{planet.solarSystemName}</Badge>
                            </div>
                            
                            <div className="flex flex-wrap items-start gap-4">
                              {extractors.length > 0 && (
                                <div className="space-y-2">
                                  <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <Droplets className="h-3 w-3" />
                                    Extractors
                                  </div>
                                  <div className="space-y-1">
                                    {extractors.map(ext => {
                                      const status = getExtractorStatus(ext);
                                      return (
                                        <div 
                                          key={ext.pinId}
                                          className={`flex items-center gap-2 p-2 rounded text-xs ${
                                            status.status === 'active' ? 'bg-green-500/10' :
                                            status.status === 'expiring' ? 'bg-yellow-500/10' :
                                            status.status === 'expired' ? 'bg-red-500/10' : 'bg-muted'
                                          }`}
                                        >
                                          {ext.extractorProductTypeId ? (
                                            <EveIcon typeId={ext.extractorProductTypeId} size={32} alt={ext.extractorProductName || ''} className="w-4 h-4 flex-shrink-0" />
                                          ) : (
                                            <CircleDot className={`h-3 w-3 flex-shrink-0 ${
                                              status.status === 'active' ? 'text-green-500' :
                                              status.status === 'expiring' ? 'text-yellow-500' :
                                              status.status === 'expired' ? 'text-red-500' : 'text-muted-foreground'
                                            }`} />
                                          )}
                                          <span className="truncate max-w-32">{ext.extractorProductName || 'Unknown'}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              
                              {extractors.length > 0 && factories.length > 0 && (
                                <div className="flex items-center self-center">
                                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                              
                              {factories.length > 0 && (
                                <div className="space-y-2">
                                  <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <Factory className="h-3 w-3" />
                                    Factories
                                  </div>
                                  <div className="space-y-1">
                                    {factories.map(fac => (
                                      <div 
                                        key={fac.pinId}
                                        className="flex items-center gap-2 p-2 bg-amber-500/10 rounded text-xs"
                                      >
                                        <CircleDot className="h-3 w-3 text-amber-500" />
                                        <span className="truncate max-w-32">{fac.schematicName || fac.typeName}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {factories.length > 0 && storages.length > 0 && (
                                <div className="flex items-center self-center">
                                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                              
                              {storages.length > 0 && (
                                <div className="space-y-2">
                                  <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <Package className="h-3 w-3" />
                                    Storage/Export
                                  </div>
                                  <div className="space-y-1">
                                    {storages.slice(0, 3).map(stor => (
                                      <div 
                                        key={stor.pinId}
                                        className="flex items-center gap-2 p-2 bg-blue-500/10 rounded text-xs"
                                      >
                                        <CircleDot className="h-3 w-3 text-blue-500" />
                                        <span className="truncate max-w-32">{stor.typeName}</span>
                                      </div>
                                    ))}
                                    {storages.length > 3 && (
                                      <p className="text-xs text-muted-foreground pl-2">
                                        +{storages.length - 3} more
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }).filter(Boolean)}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="calculator">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  PI Commodities
                </CardTitle>
                <CardDescription>
                  Select a commodity to view its production chain
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-commodities"
                    />
                    {searchTerm && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setSearchTerm("")}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  
                  {(() => {
                    const allCommodities = Object.values(PI_COMMODITIES);
                    const searchLower = searchTerm.toLowerCase();
                    
                    const filteredCommodities = allCommodities.filter(c => {
                      if (selectedTier !== 'all' && c.tier !== selectedTier) return false;
                      if (searchTerm) {
                        const nameLower = c.name.toLowerCase();
                        if (!nameLower.includes(searchLower) && 
                            !nameLower.split(' ').some(word => word.startsWith(searchLower))) {
                          return false;
                        }
                      }
                      return true;
                    });

                    const tierCounts = {
                      all: allCommodities.filter(c => !searchTerm || c.name.toLowerCase().includes(searchLower) || c.name.toLowerCase().split(' ').some(word => word.startsWith(searchLower))).length,
                      P0: allCommodities.filter(c => c.tier === 'P0' && (!searchTerm || c.name.toLowerCase().includes(searchLower))).length,
                      P1: allCommodities.filter(c => c.tier === 'P1' && (!searchTerm || c.name.toLowerCase().includes(searchLower))).length,
                      P2: allCommodities.filter(c => c.tier === 'P2' && (!searchTerm || c.name.toLowerCase().includes(searchLower))).length,
                      P3: allCommodities.filter(c => c.tier === 'P3' && (!searchTerm || c.name.toLowerCase().includes(searchLower))).length,
                      P4: allCommodities.filter(c => c.tier === 'P4' && (!searchTerm || c.name.toLowerCase().includes(searchLower))).length,
                    };

                    const groupedByTier = filteredCommodities.reduce((acc, c) => {
                      if (!acc[c.tier]) acc[c.tier] = [];
                      acc[c.tier].push(c);
                      return acc;
                    }, {} as Record<PITier, PICommodity[]>);

                    Object.keys(groupedByTier).forEach(tier => {
                      groupedByTier[tier as PITier].sort((a, b) => a.name.localeCompare(b.name));
                    });

                    return (
                      <>
                        <div className="flex flex-wrap gap-1">
                          <Button
                            size="sm"
                            variant={selectedTier === 'all' ? 'default' : 'outline'}
                            onClick={() => setSelectedTier('all')}
                            className="text-xs gap-1"
                            data-testid="button-tier-all"
                          >
                            All <span className="text-muted-foreground">({tierCounts.all})</span>
                          </Button>
                          {(['P4', 'P3', 'P2', 'P1', 'P0'] as PITier[]).map(tier => (
                            <Button
                              key={tier}
                              size="sm"
                              variant={selectedTier === tier ? 'default' : 'outline'}
                              onClick={() => setSelectedTier(tier)}
                              className={`text-xs gap-1 ${selectedTier === tier ? '' : TIER_COLORS[tier].text}`}
                              data-testid={`button-tier-${tier}`}
                            >
                              {tier} <span className="opacity-70">({tierCounts[tier]})</span>
                            </Button>
                          ))}
                        </div>

                        {searchTerm && (
                          <p className="text-xs text-muted-foreground">
                            Found {filteredCommodities.length} result{filteredCommodities.length !== 1 ? 's' : ''} for "{searchTerm}"
                          </p>
                        )}
                        
                        <ScrollArea className="h-[450px] pr-4">
                          <div className="space-y-4">
                            {selectedTier === 'all' ? (
                              (['P4', 'P3', 'P2', 'P1', 'P0'] as PITier[]).map(tier => {
                                const commodities = groupedByTier[tier];
                                if (!commodities || commodities.length === 0) return null;
                                const tierColors = TIER_COLORS[tier];
                                
                                return (
                                  <div key={tier} className="space-y-1">
                                    <div className={`sticky top-0 z-10 py-1.5 px-2 rounded-md ${tierColors.bg} ${tierColors.border} border backdrop-blur-sm`}>
                                      <span className={`text-xs font-medium ${tierColors.text}`}>
                                        {tier} - {TIER_NAMES[tier]} ({commodities.length})
                                      </span>
                                    </div>
                                    {commodities.map(commodity => {
                                      const isSelected = selectedCommodity?.typeId === commodity.typeId;
                                      return (
                                        <button
                                          key={commodity.typeId}
                                          onClick={() => {
                                            setSelectedCommodity(commodity);
                                            setNumFactories(1);
                                            setTimeFrame('cycle');
                                          }}
                                          className={`w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-left transition-colors ${
                                            isSelected 
                                              ? `${tierColors.bg} ${tierColors.border} border` 
                                              : 'hover:bg-muted'
                                          }`}
                                          data-testid={`commodity-${commodity.typeId}`}
                                        >
                                          <EveIcon typeId={commodity.typeId} size={32} alt={commodity.name} />
                                          <span className="text-sm truncate flex-1">{commodity.name}</span>
                                          {isSelected && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                );
                              })
                            ) : (
                              <div className="space-y-1">
                                {filteredCommodities
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map(commodity => {
                                    const tierColors = TIER_COLORS[commodity.tier];
                                    const isSelected = selectedCommodity?.typeId === commodity.typeId;
                                    return (
                                      <button
                                        key={commodity.typeId}
                                        onClick={() => {
                                          setSelectedCommodity(commodity);
                                          setNumFactories(1);
                                          setTimeFrame('cycle');
                                        }}
                                        className={`w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-left transition-colors ${
                                          isSelected 
                                            ? `${tierColors.bg} ${tierColors.border} border` 
                                            : 'hover:bg-muted'
                                        }`}
                                        data-testid={`commodity-${commodity.typeId}`}
                                      >
                                        <EveIcon typeId={commodity.typeId} size={32} alt={commodity.name} />
                                        <span className="text-sm truncate flex-1">{commodity.name}</span>
                                        {isSelected && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                                      </button>
                                    );
                                  })}
                              </div>
                            )}
                            
                            {filteredCommodities.length === 0 && (
                              <div className="text-center py-8 text-muted-foreground">
                                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No commodities found</p>
                                <p className="text-xs mt-1">Try a different search term</p>
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
            
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <GitBranch className="h-4 w-4" />
                      Production Chain
                    </CardTitle>
                    <CardDescription>
                      {selectedCommodity
                        ? `Materials required to produce ${selectedCommodity.name}`
                        : 'Select a commodity to see its production chain'}
                    </CardDescription>
                  </div>
                  <PiChainBuilder
                    selectedCommodity={selectedCommodity}
                    outputQuantity={outputQuantity}
                    timeFrame={timeFrame}
                    numFactories={numFactories}
                    prices={prices}
                    onLoadChain={(chain) => {
                      const commodity = getCommodityById(chain.targetProductTypeId);
                      if (commodity) {
                        setSelectedCommodity(commodity);
                      }
                    }}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {!selectedCommodity ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a commodity from the list to view its production chain</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="p-4 rounded-lg bg-muted/50 space-y-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-lg ${TIER_COLORS[selectedCommodity.tier].bg}`}>
                          <Package className={`h-6 w-6 ${TIER_COLORS[selectedCommodity.tier].text}`} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{selectedCommodity.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {TIER_NAMES[selectedCommodity.tier]} - Volume: {selectedCommodity.volume} m³
                            {prices[selectedCommodity.typeId] && (
                              <span className="ml-2">
                                • Jita: {formatIsk(prices[selectedCommodity.typeId])} ISK
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      
                      {selectedCommodity.tier !== 'P0' && (
                        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border/50">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {CYCLE_INFO[selectedCommodity.tier].cycleMinutes} min cycle
                            </span>
                            <span className="text-sm font-medium">
                              → {CYCLE_INFO[selectedCommodity.tier].outputPerCycle}x output
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 ml-auto">
                            <span className="text-xs text-muted-foreground">Factories:</span>
                            <Input
                              type="number"
                              min={1}
                              max={100}
                              value={numFactories}
                              onChange={(e) => setNumFactories(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                              className="w-16 h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              data-testid="input-factories"
                            />
                            
                            <Select value={timeFrame} onValueChange={(v) => setTimeFrame(v as TimeFrame)}>
                              <SelectTrigger className="w-24 h-8" data-testid="select-timeframe">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cycle">Per Cycle</SelectItem>
                                <SelectItem value="hour">Per Hour</SelectItem>
                                <SelectItem value="day">Per Day</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                      
                      {selectedCommodity.tier !== 'P0' && (
                        <div className="flex items-center justify-between text-sm pt-2 border-t border-border/50">
                          <span className="text-muted-foreground">
                            Output: <span className="font-medium text-foreground">{outputQuantity.toLocaleString()}x {selectedCommodity.name}</span>
                          </span>
                          <span className="text-muted-foreground">
                            {timeFrame === 'cycle' && `${numFactories} factor${numFactories > 1 ? 'ies' : 'y'} × 1 cycle`}
                            {timeFrame === 'hour' && `${numFactories} factor${numFactories > 1 ? 'ies' : 'y'} × ${60 / CYCLE_INFO[selectedCommodity.tier].cycleMinutes} cycles/hr`}
                            {timeFrame === 'day' && `${numFactories} factor${numFactories > 1 ? 'ies' : 'y'} × ${(60 / CYCLE_INFO[selectedCommodity.tier].cycleMinutes) * 24} cycles/day`}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {selectedCommodity.tier === 'P0' ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">P0 Raw Materials are extracted directly from planets.</p>
                        <p className="text-sm text-muted-foreground mt-2">No production chain required - use Extractor Control Units.</p>
                        
                        {P0_PLANET_SOURCES[selectedCommodity.typeId] && (
                          <div className="mt-6">
                            <p className="text-sm font-medium mb-3">Found on these planet types:</p>
                            <div className="flex flex-wrap justify-center gap-2">
                              {P0_PLANET_SOURCES[selectedCommodity.typeId].map(pt => (
                                <div 
                                  key={pt}
                                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border"
                                >
                                  <Globe2 className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">
                                    {PLANET_TYPE_INFO[pt].name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (() => {
                      const chain = buildProductionChain(selectedCommodity.typeId, outputQuantity);
                      if (!chain) return null;
                      
                      const materialsByTier = calculateMaterialsByTier(chain);

                      const ChainNode = ({ node, isRoot = false }: { node: ProductionChainNode; isRoot?: boolean }) => {
                        const tierColors = TIER_COLORS[node.commodity.tier];
                        const price = prices[node.commodity.typeId];
                        const hasChildren = node.children.length > 0;
                        const planetTypes = getPlanetTypesForNode(node);
                        
                        return (
                          <div className="flex items-center">
                            {hasChildren && (
                              <div className="flex items-center">
                                <div className="flex flex-col gap-1">
                                  {node.children.map((child, idx) => (
                                    <div key={`${child.commodity.typeId}-${idx}`} className="flex items-center">
                                      <ChainNode node={child} />
                                      <div className="w-3 h-0.5 bg-border" />
                                    </div>
                                  ))}
                                </div>
                                <div className="flex flex-col items-center">
                                  {node.children.length > 1 && (
                                    <div 
                                      className="w-0.5 bg-border"
                                      style={{ height: `calc(100% - 1rem)` }}
                                    />
                                  )}
                                </div>
                                <div className="w-3 h-0.5 bg-border" />
                              </div>
                            )}
                            
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div 
                                  className={`relative px-2 py-1.5 rounded-lg border-2 ${tierColors.border} ${tierColors.bg} min-w-[120px] ${isRoot ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''} cursor-help`}
                                  data-testid={`chain-node-${node.commodity.typeId}`}
                                >
                                  <div className="flex items-center gap-1 mb-0.5">
                                    <Badge variant="outline" className={`${tierColors.text} ${tierColors.border} text-[9px] px-1 py-0`}>
                                      {node.commodity.tier}
                                    </Badge>
                                    <span className={`text-[10px] font-bold ${tierColors.text}`}>
                                      x{node.quantity.toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <EveIcon typeId={node.commodity.typeId} size={32} alt={node.commodity.name} className="w-5 h-5" />
                                    <p className="text-[11px] font-medium leading-tight flex-1" title={node.commodity.name}>
                                      {node.commodity.name}
                                    </p>
                                  </div>
                                  {planetTypes.length > 0 && (
                                    <div className="flex flex-wrap gap-0.5 mt-1">
                                      {planetTypes.map(pt => (
                                        <span 
                                          key={pt}
                                          className="text-[8px] w-3.5 h-3.5 flex items-center justify-center rounded bg-muted text-muted-foreground font-medium"
                                          title={PLANET_TYPE_INFO[pt].name}
                                        >
                                          {PLANET_TYPE_INFO[pt].name[0]}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <div className="space-y-1.5">
                                  <div>
                                    <p className="font-medium text-sm">{node.commodity.name}</p>
                                    <p className="text-xs text-muted-foreground">{TIER_NAMES[node.commodity.tier]}</p>
                                  </div>
                                  {price && (
                                    <p className="text-xs">
                                      {formatIsk(price * node.quantity)} ISK total ({formatIsk(price)} each)
                                    </p>
                                  )}
                                  {planetTypes.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {planetTypes.map(pt => (
                                        <span 
                                          key={pt}
                                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground"
                                        >
                                          {PLANET_TYPE_INFO[pt].name}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        );
                      };
                      
                      return (
                        <div className="space-y-4">
                          <div className="flex justify-end p-2">
                            <ChainNode node={chain} isRoot />
                          </div>
                          
                          <div className="border-t pt-4">
                            <h4 className="text-sm font-medium mb-3">Materials Summary</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {(['P3', 'P2', 'P1', 'P0'] as PITier[]).map(tier => {
                                const materials = Array.from(materialsByTier[tier].values());
                                if (materials.length === 0) return null;
                                const tierColors = TIER_COLORS[tier];
                                const totalQty = materials.reduce((sum, m) => sum + m.quantity, 0);
                                
                                return (
                                  <Tooltip key={tier}>
                                    <TooltipTrigger asChild>
                                      <div className={`p-2 rounded border ${tierColors.border} ${tierColors.bg} cursor-help`}>
                                        <div className="flex items-center gap-1.5">
                                          <Badge variant="outline" className={`${tierColors.text} ${tierColors.border} text-[10px] px-1 py-0`}>
                                            {tier}
                                          </Badge>
                                          <span className="text-xs text-muted-foreground">{materials.length} types</span>
                                        </div>
                                        <p className={`text-sm font-bold ${tierColors.text} mt-1`}>
                                          {totalQty.toLocaleString()} units
                                        </p>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="max-w-xs">
                                      <div className="space-y-1">
                                        {materials.map(({ commodity, quantity }) => (
                                          <div key={commodity.typeId} className="flex justify-between gap-4 text-xs">
                                            <span>{commodity.name}</span>
                                            <span className="font-medium">{quantity.toLocaleString()}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })}
                            </div>
                          </div>
                          
                          <div className="pt-4 border-t">
                            <h4 className="text-sm font-medium mb-3">Taxes & Fees</h4>
                            <div className="grid grid-cols-3 gap-3 mb-4">
                              <div>
                                <label className="text-xs text-muted-foreground block mb-1">Customs Office Tax</label>
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.1}
                                    value={customsOfficeTax}
                                    onChange={(e) => setCustomsOfficeTax(parseFloat(e.target.value) || 0)}
                                    className="h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    data-testid="input-customs-tax"
                                  />
                                  <span className="text-xs text-muted-foreground">%</span>
                                </div>
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground block mb-1">Sales Tax</label>
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    min={0}
                                    max={10}
                                    step={0.1}
                                    value={salesTax}
                                    onChange={(e) => setSalesTax(parseFloat(e.target.value) || 0)}
                                    className="h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    data-testid="input-sales-tax"
                                  />
                                  <span className="text-xs text-muted-foreground">%</span>
                                </div>
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground block mb-1">Broker Fee</label>
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    min={0}
                                    max={10}
                                    step={0.1}
                                    value={brokerFee}
                                    onChange={(e) => setBrokerFee(parseFloat(e.target.value) || 0)}
                                    className="h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    data-testid="input-broker-fee"
                                  />
                                  <span className="text-xs text-muted-foreground">%</span>
                                </div>
                              </div>
                            </div>
                            
                            <h4 className="text-sm font-medium mb-2">
                              Profit Calculation 
                              <span className="text-muted-foreground font-normal ml-2">
                                ({timeFrame === 'cycle' ? 'Per Cycle' : timeFrame === 'hour' ? 'Per Hour' : 'Per Day'})
                              </span>
                            </h4>
                            
                            {Object.keys(prices).length > 0 && prices[selectedCommodity.typeId] ? (
                              (() => {
                                const p0Cost = Array.from(materialsByTier['P0'].values())
                                  .reduce((sum, m) => sum + (m.quantity * (prices[m.commodity.typeId] || 0)), 0);
                                const outputValue = prices[selectedCommodity.typeId] * outputQuantity;
                                
                                const exportTaxCost = outputValue * (customsOfficeTax / 100);
                                const salesTaxCost = outputValue * (salesTax / 100);
                                const brokerFeeCost = outputValue * (brokerFee / 100);
                                const totalTaxes = exportTaxCost + salesTaxCost + brokerFeeCost;
                                
                                const grossProfit = outputValue - p0Cost;
                                const netProfit = grossProfit - totalTaxes;
                                
                                const timeLabel = timeFrame === 'cycle' ? '/cycle' : timeFrame === 'hour' ? '/hr' : '/day';
                                
                                return (
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Output Value ({outputQuantity.toLocaleString()}x)</span>
                                      <span className="font-medium">{formatIsk(outputValue)} ISK</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">P0 Material Cost</span>
                                      <span className="text-red-400">-{formatIsk(p0Cost)} ISK</span>
                                    </div>
                                    <div className="flex justify-between border-t pt-2">
                                      <span className="font-medium">Gross Profit</span>
                                      <span className={grossProfit >= 0 ? 'text-green-500' : 'text-red-500'}>
                                        {grossProfit >= 0 ? '+' : ''}{formatIsk(grossProfit)} ISK
                                      </span>
                                    </div>
                                    
                                    <div className="pt-2 space-y-1 text-xs">
                                      <div className="flex justify-between text-muted-foreground">
                                        <span>Export Tax ({customsOfficeTax}%)</span>
                                        <span>-{formatIsk(exportTaxCost)}</span>
                                      </div>
                                      <div className="flex justify-between text-muted-foreground">
                                        <span>Sales Tax ({salesTax}%)</span>
                                        <span>-{formatIsk(salesTaxCost)}</span>
                                      </div>
                                      <div className="flex justify-between text-muted-foreground">
                                        <span>Broker Fee ({brokerFee}%)</span>
                                        <span>-{formatIsk(brokerFeeCost)}</span>
                                      </div>
                                    </div>
                                    
                                    <div className={`flex justify-between p-2 rounded-lg mt-2 ${netProfit >= 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                                      <span className="font-medium">Net Profit{timeLabel}</span>
                                      <span className={`font-bold ${netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {netProfit >= 0 ? '+' : ''}{formatIsk(netProfit)} ISK
                                      </span>
                                    </div>
                                    
                                    <div className="text-xs text-muted-foreground pt-2">
                                      <p>Margin: {((netProfit / outputValue) * 100).toFixed(1)}%</p>
                                      <p className="mt-1">
                                        Volume: {(selectedCommodity.volume * outputQuantity).toLocaleString()} m³
                                      </p>
                                    </div>
                                  </div>
                                );
                              })()
                            ) : pricesLoading ? (
                              <div className="text-center text-sm text-muted-foreground py-4">
                                <RefreshCw className="h-4 w-4 animate-spin inline mr-2" />
                                Loading Jita prices...
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">Select a commodity to see profit calculations</p>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
