import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Moon,
  Upload,
  Download,
  FileJson,
  FileSpreadsheet,
  Copy,
  Trash2,
  Settings2,
  ArrowUpDown,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
  RefreshCw,
  Star,
  MapPin,
  Database
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SmartTooltip } from "@/components/SmartTooltip";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

// Moon ore data with type IDs, names, rarity, material yields
const ORE_DATA: Record<number, { name: string; rarity: string; material: string; yield: number }> = {
  45490: { name: "Zeolites", rarity: "R4", material: "Atmospheric Gases", yield: 65 },
  45491: { name: "Sylvite", rarity: "R4", material: "Evaporite Deposits", yield: 65 },
  45492: { name: "Bitumens", rarity: "R4", material: "Hydrocarbons", yield: 65 },
  45493: { name: "Coesite", rarity: "R4", material: "Silicates", yield: 65 },
  45494: { name: "Cobaltite", rarity: "R8", material: "Cobalt", yield: 40 },
  45495: { name: "Euxenite", rarity: "R8", material: "Scandium", yield: 40 },
  45496: { name: "Titanite", rarity: "R8", material: "Titanium", yield: 40 },
  45497: { name: "Scheelite", rarity: "R8", material: "Tungsten", yield: 40 },
  45498: { name: "Chromite", rarity: "R16", material: "Chromium", yield: 40 },
  45499: { name: "Sperrylite", rarity: "R16", material: "Platinum", yield: 40 },
  45500: { name: "Vanadinite", rarity: "R16", material: "Vanadium", yield: 40 },
  45501: { name: "Otavite", rarity: "R16", material: "Cadmium", yield: 40 },
  45502: { name: "Carnotite", rarity: "R32", material: "Technetium", yield: 50 },
  45503: { name: "Cinnabar", rarity: "R32", material: "Mercury", yield: 50 },
  45504: { name: "Pollucite", rarity: "R32", material: "Caesium", yield: 50 },
  45506: { name: "Zircon", rarity: "R32", material: "Hafnium", yield: 50 },
  45510: { name: "Monazite", rarity: "R64", material: "Neodymium", yield: 22 },
  45511: { name: "Loparite", rarity: "R64", material: "Promethium", yield: 22 },
  45512: { name: "Ytterbite", rarity: "R64", material: "Thulium", yield: 22 },
  45513: { name: "Xenotime", rarity: "R64", material: "Dysprosium", yield: 22 },
};

const ORE_NAME_TO_ID: Record<string, number> = Object.fromEntries(
  Object.entries(ORE_DATA).map(([id, data]) => [data.name.toLowerCase(), parseInt(id)])
);

const RARITY_RANK: Record<string, number> = { R4: 1, R8: 2, R16: 3, R32: 4, R64: 5 };

const MATERIAL_NAMES = [
  "Atmospheric Gases", "Evaporite Deposits", "Hydrocarbons", "Silicates",
  "Cobalt", "Scandium", "Titanium", "Tungsten",
  "Cadmium", "Chromium", "Platinum", "Vanadium",
  "Caesium", "Hafnium", "Mercury", "Technetium",
  "Dysprosium", "Neodymium", "Promethium", "Thulium",
];

// ESI type IDs for moon materials (goo)
const MATERIAL_TYPE_IDS: Record<string, number> = {
  "Atmospheric Gases": 16634,
  "Evaporite Deposits": 16635,
  "Hydrocarbons": 16633,
  "Silicates": 16636,
  "Cobalt": 16640,
  "Scandium": 16639,
  "Titanium": 16638,
  "Tungsten": 16637,
  "Cadmium": 16643,
  "Chromium": 16641,
  "Platinum": 16644,
  "Vanadium": 16642,
  "Caesium": 16647,
  "Hafnium": 16648,
  "Mercury": 16646,
  "Technetium": 16649,
  "Dysprosium": 16650,
  "Neodymium": 16651,
  "Promethium": 16652,
  "Thulium": 16653,
};

const DEFAULT_PRICES: Record<string, number> = Object.fromEntries(
  MATERIAL_NAMES.map(m => [m, 0])
);

// Metenox constants
const ATHANOR_RATE = 30000; // m3/hour
const HOURS_PER_MONTH = 720;
const METENOX_EFFICIENCY = 0.40;
const METENOX_MONTHLY_M3 = ATHANOR_RATE * HOURS_PER_MONTH * METENOX_EFFICIENCY;

// Types
interface MoonOre {
  name: string;
  quantity: number;
  rarity: string;
  material: string;
  yield: number;
  typeId: number;
}

interface MoonData {
  name: string;
  system: string;
  ores: MoonOre[];
}

interface CalculatedOre extends MoonOre {
  units: number;
  isk: number;
}

interface CalculatedMoon extends MoonData {
  oreValues: CalculatedOre[];
  totalIsk: number;
  bestOre: string;
  bestRarity: string;
  hasR8Plus: boolean;
}

// Storage keys with photon prefix to avoid conflicts
const STORAGE_KEYS = {
  moons: 'photon-mooncalc-moons',
  prices: 'photon-mooncalc-prices',
  priceUpdate: 'photon-mooncalc-price-update'
};

// Parse EVE probe scan data
function parseProbeData(rawText: string): MoonData[] {
  const lines = rawText.trim().split('\n');
  const moons: MoonData[] = [];
  let currentMoon: MoonData | null = null;
  
  for (const line of lines) {
    if (line.startsWith('Moon\t') || line.includes('Moon Product')) continue;
    
    const parts = line.split('\t');
    
    if (parts[0] && parts[0].includes(' - Moon ') && !parts[1]) {
      const moonName = parts[0].trim();
      const systemMatch = moonName.match(/^([A-Z0-9-]+)/);
      const currentSystem = systemMatch ? systemMatch[1] : 'Unknown';
      currentMoon = { name: moonName, system: currentSystem, ores: [] };
      moons.push(currentMoon);
    }
    else if (currentMoon) {
      let oreName: string | undefined;
      let quantity: number;
      let typeId: number;
      
      if (parts[1] && parts[2]) {
        oreName = parts[1].trim();
        quantity = parseFloat(parts[2]);
        typeId = parseInt(parts[3]);
      } else if (parts[0] && parts[1]) {
        oreName = parts[0].trim();
        quantity = parseFloat(parts[1]);
        typeId = parseInt(parts[2]);
      } else {
        continue;
      }
      
      if (oreName && !isNaN(quantity) && quantity > 0) {
        let oreInfo = ORE_DATA[typeId];
        if (!oreInfo) {
          const lookupId = ORE_NAME_TO_ID[oreName.toLowerCase()];
          if (lookupId) {
            oreInfo = ORE_DATA[lookupId];
            typeId = lookupId;
          }
        }
        
        if (oreInfo) {
          currentMoon.ores.push({
            name: oreInfo.name,
            quantity,
            rarity: oreInfo.rarity,
            material: oreInfo.material,
            yield: oreInfo.yield,
            typeId
          });
        }
      }
    }
  }
  
  return moons.filter(m => m.ores.length > 0);
}

// Calculate moon value
function calculateMoonValue(moon: MoonData, prices: Record<string, number>): CalculatedMoon {
  let totalIsk = 0;
  const oreValues: CalculatedOre[] = [];
  
  for (const ore of moon.ores) {
    const units = METENOX_MONTHLY_M3 * ore.quantity * (ore.yield / 1000);
    const price = prices[ore.material] || 0;
    const isk = units * price;
    totalIsk += isk;
    oreValues.push({ ...ore, units, isk });
  }
  
  const bestOre = moon.ores.reduce((best, ore) => 
    (RARITY_RANK[ore.rarity] > RARITY_RANK[best.rarity]) ? ore : best
  , moon.ores[0]);
  
  return {
    ...moon,
    oreValues,
    totalIsk,
    bestOre: bestOre.name,
    bestRarity: bestOre.rarity,
    hasR8Plus: moon.ores.some(o => RARITY_RANK[o.rarity] >= 2)
  };
}

// Format ISK values
function formatIsk(value: number): string {
  if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B';
  if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
  if (value >= 1e3) return (value / 1e3).toFixed(0) + 'K';
  return value.toFixed(0);
}

// Rarity badge colors
function getRarityBadgeVariant(rarity: string): "default" | "secondary" | "destructive" | "outline" {
  switch (rarity) {
    case 'R64': return 'destructive';
    case 'R32': return 'default';
    default: return 'secondary';
  }
}

function getRarityClass(rarity: string): string {
  switch (rarity) {
    case 'R64': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    case 'R32': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
    case 'R16': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    case 'R8': return 'bg-green-500/20 text-green-300 border-green-500/30';
    default: return 'bg-muted text-muted-foreground';
  }
}

type SortField = 'name' | 'system' | 'totalIsk' | 'bestOre' | 'bestRarity';

// Database moon type (matches backend schema)
interface DbMoon {
  id: string;
  characterId: number;
  moonName: string;
  systemName: string;
  ores: MoonOre[];
  notes: string | null;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MoonCalculatorPageProps {
  embedded?: boolean;
}

export default function MoonCalculatorPage({ embedded = false }: MoonCalculatorPageProps) {
  const { toast } = useToast();
  
  // State
  const [rawInput, setRawInput] = useState('');
  const [moons, setMoons] = useState<MoonData[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>(DEFAULT_PRICES);
  const [sortField, setSortField] = useState<SortField>('totalIsk');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterSystem, setFilterSystem] = useState('all');
  const [filterRarity, setFilterRarity] = useState('all');
  const [showPrices, setShowPrices] = useState(false);
  const [selectedMoon, setSelectedMoon] = useState<CalculatedMoon | null>(null);
  const [lastPriceUpdate, setLastPriceUpdate] = useState<string | null>(null);
  const [showPriceImport, setShowPriceImport] = useState(false);
  const [priceImportText, setPriceImportText] = useState('');
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [jsonImportText, setJsonImportText] = useState('');
  const [isFetchingPrices, setIsFetchingPrices] = useState(false);
  const [activeTab, setActiveTab] = useState('calculator');
  const [dbMoons, setDbMoons] = useState<DbMoon[]>([]);
  const [isSavingToDb, setIsSavingToDb] = useState(false);
  
  // Fetch moon data from database
  const { data: moonData, isLoading: isLoadingMoons, refetch: refetchMoons } = useQuery<{
    moons: DbMoon[];
    prices: Record<string, number> | null;
    pricesLastUpdated: string | null;
  }>({
    queryKey: ['/api/moon/data'],
    enabled: true,
  });

  // Mutation to save a moon to database
  const saveMoonMutation = useMutation({
    mutationFn: async (moon: MoonData) => {
      const response = await apiRequest('POST', '/api/moon/data', {
        moonName: moon.name,
        systemName: moon.system,
        ores: moon.ores,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/moon/data'] });
    },
  });

  // Mutation to delete a moon from database
  const deleteMoonMutation = useMutation({
    mutationFn: async (moonId: string) => {
      await apiRequest('DELETE', `/api/moon/data/${moonId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/moon/data'] });
    },
  });

  // Mutation to toggle favorite
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ moonId, isFavorite }: { moonId: string; isFavorite: boolean }) => {
      const response = await apiRequest('PATCH', `/api/moon/data/${moonId}`, { isFavorite });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/moon/data'] });
    },
  });

  // Mutation to save prices to database
  const savePricesMutation = useMutation({
    mutationFn: async (priceData: Record<string, number>) => {
      const response = await apiRequest('POST', '/api/moon/prices', { prices: priceData });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/moon/data'] });
    },
  });

  // Track if we've already auto-fetched prices this session
  const [hasAutoFetched, setHasAutoFetched] = useState(false);

  // Load database data when available
  useEffect(() => {
    if (moonData) {
      setDbMoons(moonData.moons || []);
      if (moonData.prices) {
        setPrices(prev => ({ ...prev, ...moonData.prices }));
      }
      if (moonData.pricesLastUpdated) {
        setLastPriceUpdate(moonData.pricesLastUpdated);
      }
    }
  }, [moonData]);

  // Auto-fetch prices on first load if no saved prices exist
  useEffect(() => {
    // Only auto-fetch once per session, after moonData has loaded
    if (hasAutoFetched || isLoadingMoons) return;
    
    // Check if we have saved prices (from database or localStorage)
    const hasDatabasePrices = moonData?.prices && Object.keys(moonData.prices).length > 0;
    const hasLocalPrices = localStorage.getItem(STORAGE_KEYS.priceUpdate);
    
    if (!hasDatabasePrices && !hasLocalPrices) {
      // No saved prices - auto-fetch from ESI
      setHasAutoFetched(true);
      fetchEsiPricesOnLoad();
    } else {
      setHasAutoFetched(true);
    }
  }, [moonData, isLoadingMoons, hasAutoFetched]);

  // Separate function for auto-fetch (no toast on first load)
  const fetchEsiPricesOnLoad = async () => {
    setIsFetchingPrices(true);
    try {
      const response = await fetch('/api/moon/material-prices');
      if (!response.ok) {
        throw new Error('Failed to fetch prices');
      }
      
      const data = await response.json();
      
      if (data.prices) {
        setPrices(prev => ({ ...prev, ...data.prices }));
        const updateTime = new Date().toISOString();
        setLastPriceUpdate(updateTime);
        localStorage.setItem(STORAGE_KEYS.priceUpdate, updateTime);
      }
    } catch (error) {
      console.error('ESI price fetch error:', error);
    } finally {
      setIsFetchingPrices(false);
    }
  };
  
  // Load from localStorage on mount (for local calculator data)
  useEffect(() => {
    try {
      const savedMoons = localStorage.getItem(STORAGE_KEYS.moons);
      const savedPrices = localStorage.getItem(STORAGE_KEYS.prices);
      const savedPriceUpdate = localStorage.getItem(STORAGE_KEYS.priceUpdate);
      if (savedMoons) setMoons(JSON.parse(savedMoons));
      if (savedPrices && !moonData?.prices) setPrices(JSON.parse(savedPrices));
      if (savedPriceUpdate && !moonData?.pricesLastUpdated) setLastPriceUpdate(savedPriceUpdate);
    } catch (e) {
      console.error('Failed to load saved data:', e);
    }
  }, [moonData?.prices, moonData?.pricesLastUpdated]);
  
  // Save moons to localStorage
  useEffect(() => {
    if (moons.length > 0) {
      localStorage.setItem(STORAGE_KEYS.moons, JSON.stringify(moons));
    }
  }, [moons]);
  
  // Save prices to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.prices, JSON.stringify(prices));
  }, [prices]);

  // Save moons to database
  const saveToDatabase = async () => {
    if (moons.length === 0) {
      toast({
        title: "No Moons",
        description: "Add some moons first before saving to database.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSavingToDb(true);
    try {
      const existingNames = new Set(dbMoons.map(m => m.moonName));
      const newMoons = moons.filter(m => !existingNames.has(m.name));
      
      for (const moon of newMoons) {
        await saveMoonMutation.mutateAsync(moon);
      }
      
      await savePricesMutation.mutateAsync(prices);
      
      toast({
        title: "Saved to Database",
        description: `Saved ${newMoons.length} new moon(s) and prices to your account.`
      });
    } catch (error) {
      console.error('Failed to save to database:', error);
      toast({
        title: "Save Failed",
        description: "Could not save data to database.",
        variant: "destructive"
      });
    } finally {
      setIsSavingToDb(false);
    }
  };

  // Delete moon from database
  const handleDeleteDbMoon = async (moonId: string) => {
    try {
      await deleteMoonMutation.mutateAsync(moonId);
      toast({
        title: "Moon Deleted",
        description: "Moon removed from your saved data."
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Could not delete moon.",
        variant: "destructive"
      });
    }
  };

  // Toggle favorite
  const handleToggleFavorite = async (moonId: string, currentFavorite: boolean) => {
    try {
      await toggleFavoriteMutation.mutateAsync({ moonId, isFavorite: !currentFavorite });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Could not update favorite status.",
        variant: "destructive"
      });
    }
  };

  // Get systems from database moons
  const dbSystems = useMemo(() => {
    const systemMap = new Map<string, DbMoon[]>();
    for (const moon of dbMoons) {
      const existing = systemMap.get(moon.systemName) || [];
      existing.push(moon);
      systemMap.set(moon.systemName, existing);
    }
    return Array.from(systemMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [dbMoons]);

  // Calculate values for database moons
  const calculatedDbMoons = useMemo(() => {
    return dbMoons.map(m => {
      const moonData: MoonData = { name: m.moonName, system: m.systemName, ores: m.ores };
      return { ...calculateMoonValue(moonData, prices), id: m.id, isFavorite: m.isFavorite, createdAt: m.createdAt };
    });
  }, [dbMoons, prices]);
  
  // Calculate moon values
  const calculatedMoons = useMemo(() => {
    return moons.map(m => calculateMoonValue(m, prices));
  }, [moons, prices]);
  
  // Get unique systems for filter
  const systems = useMemo(() => {
    return Array.from(new Set(moons.map(m => m.system))).sort();
  }, [moons]);
  
  // Filter and sort moons
  const displayMoons = useMemo(() => {
    let filtered = calculatedMoons;
    
    if (filterSystem && filterSystem !== 'all') {
      filtered = filtered.filter(m => m.system === filterSystem);
    }
    if (filterRarity && filterRarity !== 'all') {
      filtered = filtered.filter(m => RARITY_RANK[m.bestRarity] >= RARITY_RANK[filterRarity]);
    }
    
    filtered.sort((a, b) => {
      let aVal: string | number = a[sortField];
      let bVal: string | number = b[sortField];
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }
      if (sortDir === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
    
    return filtered;
  }, [calculatedMoons, filterSystem, filterRarity, sortField, sortDir]);
  
  // Handlers
  const handleAddMoons = () => {
    const parsed = parseProbeData(rawInput);
    if (parsed.length > 0) {
      const existingNames = new Set(moons.map(m => m.name));
      const newMoons = parsed.filter(m => !existingNames.has(m.name));
      if (newMoons.length > 0) {
        setMoons([...moons, ...newMoons]);
        toast({
          title: "Moons Added",
          description: `Added ${newMoons.length} moon(s). ${parsed.length - newMoons.length} duplicate(s) skipped.`
        });
      } else {
        toast({
          title: "No New Moons",
          description: "All moons in the scan already exist.",
          variant: "destructive"
        });
      }
      setRawInput('');
    } else {
      toast({
        title: "Parse Error",
        description: "Could not parse any moon data from the input.",
        variant: "destructive"
      });
    }
  };
  
  const handleClearAll = () => {
    setMoons([]);
    setSelectedMoon(null);
    localStorage.removeItem(STORAGE_KEYS.moons);
    toast({
      title: "Data Cleared",
      description: "All moon data has been cleared."
    });
  };
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };
  
  const handlePriceChange = (material: string, value: string) => {
    setPrices(prev => ({ ...prev, [material]: parseFloat(value) || 0 }));
  };
  
  // Janice price workflow
  const fetchJanicePrices = async () => {
    const itemList = MATERIAL_NAMES.map(m => `${m} 1`).join('\n');
    try {
      await navigator.clipboard.writeText(itemList);
      toast({
        title: "Copied to Clipboard",
        description: "Material list copied. Paste in Janice, then copy the results back here."
      });
      window.open('https://janice.e-351.com', '_blank');
      setShowPriceImport(true);
    } catch (err) {
      setShowPriceImport(true);
      setPriceImportText(itemList);
    }
  };
  
  const parseJanicePaste = (text: string) => {
    const lines = text.trim().split('\n');
    const newPrices = { ...prices };
    let updated = 0;
    
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 4) {
        const name = parts[0].trim();
        const buyPrice = parseFloat(parts[3]?.replace(/,/g, '')) || 
                         parseFloat(parts[4]?.replace(/,/g, '')) || 0;
        
        if (MATERIAL_NAMES.includes(name) && buyPrice > 0) {
          newPrices[name] = buyPrice;
          updated++;
        }
      }
    }
    
    if (updated > 0) {
      setPrices(newPrices);
      const updateTime = new Date().toISOString();
      setLastPriceUpdate(updateTime);
      localStorage.setItem(STORAGE_KEYS.priceUpdate, updateTime);
      setShowPriceImport(false);
      setPriceImportText('');
      toast({
        title: "Prices Updated",
        description: `Updated ${updated} material prices from Janice.`
      });
    } else {
      toast({
        title: "Parse Error",
        description: "Could not parse prices from Janice output.",
        variant: "destructive"
      });
    }
  };
  
  // Fetch prices from ESI (Jita buy orders)
  const fetchEsiPrices = async () => {
    setIsFetchingPrices(true);
    try {
      const response = await fetch('/api/moon/material-prices');
      if (!response.ok) {
        throw new Error('Failed to fetch prices');
      }
      
      const data = await response.json();
      
      if (data.prices) {
        setPrices(prev => ({ ...prev, ...data.prices }));
        const updateTime = new Date().toISOString();
        setLastPriceUpdate(updateTime);
        localStorage.setItem(STORAGE_KEYS.priceUpdate, updateTime);
        
        toast({
          title: "Prices Updated",
          description: "Fetched current Jita sell prices from ESI."
        });
      }
    } catch (error) {
      console.error('ESI price fetch error:', error);
      toast({
        title: "Fetch Error",
        description: "Failed to fetch prices from ESI. Try Janice import instead.",
        variant: "destructive"
      });
    } finally {
      setIsFetchingPrices(false);
    }
  };
  
  // Export functions
  const exportCsv = () => {
    const headers = ['Moon', 'System', 'Total ISK/Month', 'Best Ore', 'Rarity', 'Ore Count'];
    const rows = displayMoons.map(m => [
      m.name, m.system, m.totalIsk.toFixed(0), m.bestOre, m.bestRarity, m.ores.length
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'metenox_moons.csv';
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const exportJson = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      prices,
      moons
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'metenox_data.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const importJson = () => {
    try {
      const data = JSON.parse(jsonImportText);
      if (data.moons && Array.isArray(data.moons)) {
        const existingNames = new Set(moons.map(m => m.name));
        const newMoons = data.moons.filter((m: MoonData) => !existingNames.has(m.name));
        setMoons([...moons, ...newMoons]);
        if (data.prices) {
          setPrices(prev => ({ ...prev, ...data.prices }));
        }
        setShowJsonImport(false);
        setJsonImportText('');
        toast({
          title: "Import Complete",
          description: `Imported ${newMoons.length} new moon(s). ${data.moons.length - newMoons.length} duplicate(s) skipped.`
        });
      } else {
        toast({
          title: "Invalid Format",
          description: "JSON is missing the moons array.",
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({
        title: "Parse Error",
        description: "Could not parse JSON data.",
        variant: "destructive"
      });
    }
  };
  
  const copyMarkdown = async () => {
    const lines = [
      '| Moon | System | ISK/Month | Best Ore | Rarity |',
      '|------|--------|-----------|----------|--------|',
      ...displayMoons.map(m => 
        `| ${m.name} | ${m.system} | ${formatIsk(m.totalIsk)} | ${m.bestOre} | ${m.bestRarity} |`
      )
    ];
    const markdown = lines.join('\n');
    try {
      await navigator.clipboard.writeText(markdown);
      toast({
        title: "Copied",
        description: "Markdown table copied to clipboard."
      });
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Could not copy to clipboard.",
        variant: "destructive"
      });
    }
  };
  
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    return sortDir === 'asc' ? 
      <ChevronUp className="w-3 h-3 ml-1" /> : 
      <ChevronDown className="w-3 h-3 ml-1" />;
  };
  
  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          icon={Moon}
          title="Metenox Moon Calculator"
          subtitle="Paste EVE probe scan data to calculate monthly ISK values for Metenox structures"
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={saveToDatabase}
              disabled={isSavingToDb || moons.length === 0}
              data-testid="button-save-to-database"
            >
              {isSavingToDb ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Database className="w-4 h-4 mr-2" />
              )}
              Save to Account
            </Button>
          }
        />
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2" data-testid="tabs-moon-calculator">
            <TabsTrigger value="calculator" data-testid="tab-calculator">
              <Upload className="w-4 h-4 mr-2" />
              Calculator
            </TabsTrigger>
            <TabsTrigger value="systems" data-testid="tab-systems">
              <MapPin className="w-4 h-4 mr-2" />
              Systems ({dbMoons.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="calculator" className="space-y-6 mt-6">
        {/* Import Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="w-4 h-4" />
              Import Moon Scans
            </CardTitle>
            <CardDescription>
              Paste raw probe scan data from EVE (Ctrl+V from &apos;Copy to Clipboard&apos;)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              className="font-mono text-sm min-h-[120px]"
              placeholder="Paste raw probe scan data here..."
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              data-testid="textarea-moon-scan"
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleAddMoons} disabled={!rawInput.trim()} data-testid="button-add-moons">
                <Upload className="w-4 h-4 mr-2" />
                Add Moons
              </Button>
              <Button 
                variant="default" 
                onClick={fetchEsiPrices} 
                disabled={isFetchingPrices}
                data-testid="button-fetch-esi-prices"
              >
                {isFetchingPrices ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {isFetchingPrices ? "Fetching..." : "Fetch Jita Prices"}
              </Button>
              <Button variant="secondary" onClick={fetchJanicePrices} data-testid="button-janice-prices">
                <ExternalLink className="w-4 h-4 mr-2" />
                Janice Import
              </Button>
              <Button variant="outline" onClick={() => setShowPrices(!showPrices)} data-testid="button-toggle-prices">
                <Settings2 className="w-4 h-4 mr-2" />
                {showPrices ? 'Hide' : 'Edit'} Prices
              </Button>
              <Button 
                variant="outline" 
                onClick={exportCsv} 
                disabled={displayMoons.length === 0}
                data-testid="button-export-csv"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button 
                variant="outline" 
                onClick={exportJson} 
                disabled={moons.length === 0}
                data-testid="button-export-json"
              >
                <Download className="w-4 h-4 mr-2" />
                Export JSON
              </Button>
              <Button variant="outline" onClick={() => setShowJsonImport(true)} data-testid="button-import-json">
                <FileJson className="w-4 h-4 mr-2" />
                Import JSON
              </Button>
              <Button 
                variant="outline" 
                onClick={copyMarkdown} 
                disabled={displayMoons.length === 0}
                data-testid="button-copy-markdown"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Markdown
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleClearAll}
                disabled={moons.length === 0}
                className="ml-auto"
                data-testid="button-clear-all"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>
            {lastPriceUpdate && (
              <p className="text-xs text-muted-foreground">
                Prices last updated: {new Date(lastPriceUpdate).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>
        
        {/* Price Editor */}
        {showPrices && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Material Prices (Jita Buy)</CardTitle>
              <CardDescription>Edit individual material prices manually</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(prices).map(([material, price]) => (
                  <div key={material} className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground w-28 truncate" title={material}>
                      {material}:
                    </label>
                    <Input
                      type="number"
                      value={price}
                      onChange={(e) => handlePriceChange(material, e.target.value)}
                      className="w-24 text-right text-sm"
                      data-testid={`input-price-${material.toLowerCase().replace(/\s+/g, '-')}`}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Filters */}
        {moons.length > 0 && (
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">System:</span>
              <Select value={filterSystem} onValueChange={setFilterSystem}>
                <SelectTrigger className="w-40" data-testid="select-filter-system">
                  <SelectValue placeholder="All Systems" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Systems</SelectItem>
                  {systems.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Min Rarity:</span>
              <Select value={filterRarity} onValueChange={setFilterRarity}>
                <SelectTrigger className="w-28" data-testid="select-filter-rarity">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any</SelectItem>
                  <SelectItem value="R8">R8+</SelectItem>
                  <SelectItem value="R16">R16+</SelectItem>
                  <SelectItem value="R32">R32+</SelectItem>
                  <SelectItem value="R64">R64</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground ml-auto" data-testid="text-moon-count">
              {displayMoons.length} moons ({moons.length} total)
            </div>
          </div>
        )}
        
        {/* Moon Table */}
        {displayMoons.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        className="cursor-pointer hover-elevate"
                        onClick={() => handleSort('name')}
                        data-testid="sort-moon-name"
                      >
                        <div className="flex items-center">Moon <SortIcon field="name" /></div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover-elevate"
                        onClick={() => handleSort('system')}
                        data-testid="sort-moon-system"
                      >
                        <div className="flex items-center">System <SortIcon field="system" /></div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover-elevate text-right"
                        onClick={() => handleSort('totalIsk')}
                        data-testid="sort-moon-isk"
                      >
                        <div className="flex items-center justify-end">ISK/Month <SortIcon field="totalIsk" /></div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover-elevate"
                        onClick={() => handleSort('bestOre')}
                        data-testid="sort-moon-ore"
                      >
                        <div className="flex items-center">Best Ore <SortIcon field="bestOre" /></div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover-elevate text-center"
                        onClick={() => handleSort('bestRarity')}
                        data-testid="sort-moon-rarity"
                      >
                        <div className="flex items-center justify-center">Rarity <SortIcon field="bestRarity" /></div>
                      </TableHead>
                      <TableHead className="text-center">Ores</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayMoons.map((moon) => (
                      <TableRow 
                        key={moon.name}
                        className="cursor-pointer hover-elevate"
                        onClick={() => setSelectedMoon(selectedMoon?.name === moon.name ? null : moon)}
                        data-testid={`row-moon-${moon.name.replace(/\s+/g, '-')}`}
                      >
                        <TableCell className="font-medium">{moon.name}</TableCell>
                        <TableCell className="text-muted-foreground">{moon.system}</TableCell>
                        <TableCell className="text-right font-mono text-green-500">
                          {formatIsk(moon.totalIsk)}
                        </TableCell>
                        <TableCell>{moon.bestOre}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={getRarityClass(moon.bestRarity)}>
                            {moon.bestRarity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">{moon.ores.length}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        ) : (
          <Card className="p-8">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <Moon className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                No moon data yet. Paste your probe scan results above to get started.
              </p>
            </CardContent>
          </Card>
        )}
        
        {/* Moon Detail Panel */}
        {selectedMoon && (
          <Card data-testid="card-moon-detail">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg" data-testid="text-selected-moon-name">{selectedMoon.name}</CardTitle>
              <CardDescription>
                System: {selectedMoon.system} | Total: <span className="text-green-500 font-mono" data-testid="text-selected-moon-isk">{formatIsk(selectedMoon.totalIsk)}</span> ISK/month
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ore</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-center">Rarity</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Units/Mo</TableHead>
                    <TableHead className="text-right">ISK/Mo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedMoon.oreValues.map(ore => (
                    <TableRow key={ore.name} data-testid={`row-ore-${ore.name.toLowerCase().replace(/\s+/g, '-')}`}>
                      <TableCell>{ore.name}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {(ore.quantity * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={getRarityClass(ore.rarity)} variant="outline">
                          {ore.rarity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{ore.material}</TableCell>
                      <TableCell className="text-right font-mono">
                        {ore.units.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-500">
                        {formatIsk(ore.isk)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
        
        {/* Footer with stats and attribution */}
        <div className="text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            Metenox efficiency: {METENOX_EFFICIENCY * 100}% | Monthly m3: {METENOX_MONTHLY_M3.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground" data-testid="text-data-persistence">
            Data persists in browser localStorage. Prices from Jita sell orders.
          </p>
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground pt-2 border-t border-border mt-4" data-testid="text-attribution">
            <Info className="w-3 h-3" />
            <span>Calculator adapted from Metenox Moon Mining Calculator by</span>
            <span className="font-medium text-foreground">Ricewhale Aideron</span>
          </div>
        </div>
          </TabsContent>
          
          {/* Systems Tab */}
          <TabsContent value="systems" className="space-y-6 mt-6">
            {isLoadingMoons ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ) : dbMoons.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <MapPin className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Saved Moons</h3>
                  <p className="text-muted-foreground mb-4">
                    Use the Calculator tab to scan moons, then save them to your account.
                  </p>
                  <Button onClick={() => setActiveTab('calculator')} data-testid="button-go-to-calculator">
                    Go to Calculator
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Summary Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Database className="w-4 h-4" />
                      Saved Moon Data
                    </CardTitle>
                    <CardDescription>
                      {dbMoons.length} moon(s) across {dbSystems.length} system(s) saved to your account
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Badge variant="secondary">
                        Total Value: {formatIsk(calculatedDbMoons.reduce((sum, m) => sum + m.totalIsk, 0))}/month
                      </Badge>
                      <Badge variant="secondary">
                        Favorites: {dbMoons.filter(m => m.isFavorite).length}
                      </Badge>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => refetchMoons()}
                      data-testid="button-refresh-moons"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </CardContent>
                </Card>
                
                {/* Systems Breakdown */}
                {dbSystems.map(([systemName, systemMoons]) => {
                  const systemTotal = systemMoons.reduce((sum, m) => {
                    const calc = calculatedDbMoons.find(c => c.id === m.id);
                    return sum + (calc?.totalIsk || 0);
                  }, 0);
                  
                  return (
                    <Card key={systemName}>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between gap-2 text-base">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-primary" />
                            {systemName}
                          </div>
                          <Badge variant="outline" className="font-mono">
                            {formatIsk(systemTotal)}/month
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          {systemMoons.length} moon(s)
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {systemMoons.map(moon => {
                            const calc = calculatedDbMoons.find(c => c.id === moon.id);
                            if (!calc) return null;
                            
                            return (
                              <div 
                                key={moon.id}
                                className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                                data-testid={`moon-row-${moon.id}`}
                              >
                                <div className="flex items-center gap-3">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleToggleFavorite(moon.id, moon.isFavorite)}
                                    data-testid={`button-favorite-${moon.id}`}
                                  >
                                    <Star 
                                      className={`w-4 h-4 ${moon.isFavorite ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground'}`}
                                    />
                                  </Button>
                                  <div>
                                    <p className="font-medium text-sm">{moon.moonName}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge className={getRarityClass(calc.bestRarity)} variant="outline">
                                        {calc.bestRarity}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">{calc.bestOre}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="font-mono text-sm text-green-500">
                                    {formatIsk(calc.totalIsk)}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteDbMoon(moon.id)}
                                    data-testid={`button-delete-${moon.id}`}
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Janice Price Import Dialog */}
      <Dialog open={showPriceImport} onOpenChange={setShowPriceImport}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Paste Janice Price Data</DialogTitle>
            <DialogDescription>
              Copy the results from Janice (use their &quot;Copy&quot; button) and paste here
            </DialogDescription>
          </DialogHeader>
          <Textarea
            className="font-mono text-sm min-h-[200px]"
            placeholder="Paste Janice output here..."
            value={priceImportText}
            onChange={(e) => setPriceImportText(e.target.value)}
            data-testid="textarea-janice-prices"
          />
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => { setShowPriceImport(false); setPriceImportText(''); }}
              data-testid="button-janice-cancel"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => parseJanicePaste(priceImportText)} 
              disabled={!priceImportText.trim()}
              data-testid="button-janice-import"
            >
              Import Prices
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* JSON Import Dialog */}
      <Dialog open={showJsonImport} onOpenChange={setShowJsonImport}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Moon Data (JSON)</DialogTitle>
            <DialogDescription>
              Paste exported JSON data from another user or backup
            </DialogDescription>
          </DialogHeader>
          <Textarea
            className="font-mono text-sm min-h-[200px]"
            placeholder='{"version": 1, "moons": [...], "prices": {...}}'
            value={jsonImportText}
            onChange={(e) => setJsonImportText(e.target.value)}
            data-testid="textarea-json-import"
          />
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => { setShowJsonImport(false); setJsonImportText(''); }}
              data-testid="button-json-cancel"
            >
              Cancel
            </Button>
            <Button 
              onClick={importJson} 
              disabled={!jsonImportText.trim()}
              data-testid="button-json-import"
            >
              Import Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
