import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus,
  Trash2,
  Download,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Minus,
  Edit,
  Eye,
  FileText,
  Calendar,
  Clock,
  MapPin,
  Shield,
  Factory,
  Crosshair,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Star,
  BookmarkPlus,
  Bookmark,
  Globe,
  Loader2,
  Calculator,
  Search
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import html2canvas from "html2canvas";

// Types
interface AdmReport {
  id: string;
  name: string;
  regionName: string;
  reportDate: string;
  nextAdmRead: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

interface AdmSystem {
  id: string;
  reportId: string;
  systemId: number | null;
  systemName: string;
  strategicIndex: number | null;
  strategicPercent: number | null;
  vulnerableHours: number | null;
  adm: number;
  admChange: number | null;
  admTrend: string | null;
  admStatus: string;
  militaryLevel: number | null;
  militaryPercent: number | null;
  militaryChange: number | null;
  militaryTrend: string | null;
  militaryActivity: number | null;
  industrialLevel: number | null;
  industrialPercent: number | null;
  industrialChange: number | null;
  industrialTrend: string | null;
  industrialActivity: number | null;
  majorThreat: string | null;
  minorThreat: string | null;
  oreProspecting: string | null;
  sovHolder: string | null;
  isCapital: boolean;
  notes: string | null;
  sortOrder: number;
}

interface SavedAdmSystem {
  id: string;
  characterId: number;
  systemId: number | null;
  systemName: string;
  strategicIndex: number | null;
  strategicPercent: number | null;
  vulnerableHours: number | null;
  defaultAdm: number;
  defaultAdmStatus: string;
  militaryLevel: number | null;
  militaryPercent: number | null;
  industrialLevel: number | null;
  industrialPercent: number | null;
  majorThreat: string | null;
  minorThreat: string | null;
  oreProspecting: string | null;
  sovHolder: string | null;
  isCapital: boolean;
  notes: string | null;
  sortOrder: number;
}

// ESI sovereignty data types
interface EsiSovSystem {
  systemId: number;
  systemName: string;
  adm: number | null;
  vulnerableStartTime: string | null;
  vulnerableEndTime: string | null;
  allianceId: number | null;
  allianceTicker: string | null;
  allianceName: string | null;
  structureTypeId: number | null;
}

interface EsiRegionData {
  regionId: number;
  regionName: string;
  systems: EsiSovSystem[];
}

// ADM Index modifiers (official values from EVE)
const STRATEGIC_INDEX_MODIFIERS = [0, 0.4, 0.6, 0.8, 0.9, 1.0];
const MILITARY_INDEX_MODIFIERS = [0, 0.6, 1.2, 1.7, 2.1, 2.5];
const INDUSTRIAL_INDEX_MODIFIERS = [0, 0.6, 1.2, 1.7, 2.1, 2.5];

// Calculate ADM from index levels
const calculateAdm = (strategic: number, military: number, industrial: number, isCapital: boolean = false): number => {
  const base = 1.0;
  const stratMod = STRATEGIC_INDEX_MODIFIERS[Math.min(strategic, 5)] || 0;
  const milMod = MILITARY_INDEX_MODIFIERS[Math.min(military, 5)] || 0;
  const indMod = INDUSTRIAL_INDEX_MODIFIERS[Math.min(industrial, 5)] || 0;
  const capitalBonus = isCapital ? 2 : 0;
  return Math.min(base + stratMod + milMod + indMod + capitalBonus, 6);
};

// Calculate vulnerability window hours from ADM
const calculateVulnHours = (adm: number): number => {
  if (adm <= 0) return 18;
  return Math.round((18 / adm) * 10) / 10; // Round to 1 decimal
};

// Determine ADM status based on value
const getAdmStatus = (adm: number, minAdm: number = 4.0): "critical" | "warning" | "safe" => {
  if (adm < minAdm) return "critical";
  if (adm < minAdm + 0.5) return "warning";
  return "safe";
};

// Nullsec region IDs (only regions with sovereignty)
const NULLSEC_REGIONS: { id: number; name: string }[] = [
  { id: 10000001, name: "Derelik" },
  { id: 10000002, name: "The Forge" },
  { id: 10000003, name: "Vale of the Silent" },
  { id: 10000004, name: "UUA-F4" },
  { id: 10000005, name: "Detorid" },
  { id: 10000006, name: "Wicked Creek" },
  { id: 10000007, name: "Cache" },
  { id: 10000008, name: "Scalding Pass" },
  { id: 10000009, name: "Insmother" },
  { id: 10000010, name: "Tribute" },
  { id: 10000011, name: "Great Wildlands" },
  { id: 10000012, name: "Curse" },
  { id: 10000013, name: "Malpais" },
  { id: 10000014, name: "Catch" },
  { id: 10000015, name: "Venal" },
  { id: 10000016, name: "Lonetrek" },
  { id: 10000018, name: "The Spire" },
  { id: 10000021, name: "Outer Passage" },
  { id: 10000022, name: "Stain" },
  { id: 10000023, name: "Pure Blind" },
  { id: 10000025, name: "Immensea" },
  { id: 10000027, name: "Etherium Reach" },
  { id: 10000028, name: "Molden Heath" },
  { id: 10000029, name: "Geminate" },
  { id: 10000030, name: "Heimatar" },
  { id: 10000031, name: "Impass" },
  { id: 10000035, name: "Deklein" },
  { id: 10000036, name: "Devoid" },
  { id: 10000037, name: "Everyshore" },
  { id: 10000039, name: "Esoteria" },
  { id: 10000040, name: "Oasa" },
  { id: 10000041, name: "Syndicate" },
  { id: 10000042, name: "Metropolis" },
  { id: 10000045, name: "Tenal" },
  { id: 10000046, name: "Fade" },
  { id: 10000047, name: "Providence" },
  { id: 10000049, name: "Khanid" },
  { id: 10000050, name: "Querious" },
  { id: 10000051, name: "Cloud Ring" },
  { id: 10000052, name: "Kador" },
  { id: 10000054, name: "Aridia" },
  { id: 10000055, name: "Branch" },
  { id: 10000056, name: "Feythabolis" },
  { id: 10000057, name: "Outer Ring" },
  { id: 10000058, name: "Fountain" },
  { id: 10000059, name: "Paragon Soul" },
  { id: 10000060, name: "Delve" },
  { id: 10000062, name: "Omist" },
  { id: 10000063, name: "Period Basis" },
  { id: 10000064, name: "Perrigen Falls" },
  { id: 10000065, name: "Cobalt Edge" },
  { id: 10000066, name: "Tenerifis" },
  { id: 10000067, name: "Genesis" },
  { id: 10000068, name: "Verge Vendor" },
  { id: 10000069, name: "Black Rise" },
].sort((a, b) => a.name.localeCompare(b.name));

// Helper to get status color
const getStatusColor = (status: string) => {
  switch (status) {
    case "critical": return "text-red-500";
    case "warning": return "text-yellow-500";
    case "safe": return "text-green-500";
    default: return "text-white";
  }
};

// Helper to get trend icon
const getTrendIcon = (trend: string | null, change: number | null) => {
  if (!trend || change === null) return <Minus className="h-3 w-3 text-gray-500" />;
  if (trend === "up" || change > 0) return <ArrowUp className="h-3 w-3 text-green-500" />;
  if (trend === "down" || change < 0) return <ArrowDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-gray-500" />;
};

// Format index display (e.g., "3 + 24%")
const formatIndex = (level: number | null, percent: number | null) => {
  if (level === null) return "-";
  if (percent === null) return `${level}`;
  return `${level} + ${Math.round(percent)}%`;
};

// System Editor Dialog
function SystemEditorDialog({
  system,
  onSave,
  onSavePreset,
  onClose,
  isNew = false
}: {
  system: Partial<AdmSystem>;
  onSave: (data: Partial<AdmSystem>) => void;
  onSavePreset?: (data: Partial<AdmSystem>) => void;
  onClose: () => void;
  isNew?: boolean;
}) {
  const [formData, setFormData] = useState<Partial<AdmSystem>>(system);

  const handleSubmit = () => {
    if (!formData.systemName || formData.adm === undefined) {
      return;
    }
    onSave(formData);
  };

  const handleSavePreset = () => {
    if (!formData.systemName || formData.adm === undefined) {
      return;
    }
    onSavePreset?.(formData);
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isNew ? "Add System" : "Edit System"}</DialogTitle>
        <DialogDescription>
          Enter the system ADM data
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-4 py-4">
        {/* Basic Info */}
        <div className="col-span-2">
          <Label>System Name *</Label>
          <Input
            value={formData.systemName || ""}
            onChange={(e) => setFormData({ ...formData, systemName: e.target.value })}
            placeholder="e.g., 9S-GPT"
          />
        </div>

        <div>
          <Label>ADM *</Label>
          <Input
            type="number"
            step="0.1"
            value={formData.adm || ""}
            onChange={(e) => setFormData({ ...formData, adm: parseFloat(e.target.value) })}
            placeholder="e.g., 3.5"
          />
        </div>

        <div>
          <Label>ADM Status</Label>
          <Select
            value={formData.admStatus || "safe"}
            onValueChange={(v) => setFormData({ ...formData, admStatus: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="critical">Critical (Red)</SelectItem>
              <SelectItem value="warning">Warning (Yellow)</SelectItem>
              <SelectItem value="safe">Safe (Green)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>ADM Change (+/-)</Label>
          <Input
            type="number"
            step="0.1"
            value={formData.admChange || ""}
            onChange={(e) => setFormData({ ...formData, admChange: parseFloat(e.target.value) || null })}
            placeholder="e.g., 0.5 or -0.6"
          />
        </div>

        <div>
          <Label>Vulnerable Hours</Label>
          <Input
            type="number"
            step="0.1"
            value={formData.vulnerableHours || ""}
            onChange={(e) => setFormData({ ...formData, vulnerableHours: parseFloat(e.target.value) || null })}
            placeholder="e.g., 5.1"
          />
        </div>

        <Separator className="col-span-2" />

        {/* Strategic Index */}
        <div>
          <Label>Strategic Index</Label>
          <Input
            type="number"
            value={formData.strategicIndex || ""}
            onChange={(e) => setFormData({ ...formData, strategicIndex: parseFloat(e.target.value) || null })}
            placeholder="e.g., 3"
          />
        </div>

        <div>
          <Label>Strategic %</Label>
          <Input
            type="number"
            value={formData.strategicPercent || ""}
            onChange={(e) => setFormData({ ...formData, strategicPercent: parseFloat(e.target.value) || null })}
            placeholder="e.g., 17"
          />
        </div>

        <Separator className="col-span-2" />

        {/* Military Index */}
        <div>
          <Label>Military Level (0-5)</Label>
          <Input
            type="number"
            min="0" max="5"
            value={formData.militaryLevel ?? ""}
            onChange={(e) => setFormData({ ...formData, militaryLevel: parseInt(e.target.value) || null })}
          />
        </div>

        <div>
          <Label>Military %</Label>
          <Input
            type="number"
            value={formData.militaryPercent || ""}
            onChange={(e) => setFormData({ ...formData, militaryPercent: parseFloat(e.target.value) || null })}
            placeholder="e.g., 88"
          />
        </div>

        <div>
          <Label>Military Change</Label>
          <Input
            type="number"
            step="0.1"
            value={formData.militaryChange || ""}
            onChange={(e) => setFormData({ ...formData, militaryChange: parseFloat(e.target.value) || null })}
          />
        </div>

        <div>
          <Label>Military Activity %</Label>
          <Input
            type="number"
            value={formData.militaryActivity || ""}
            onChange={(e) => setFormData({ ...formData, militaryActivity: parseFloat(e.target.value) || null })}
          />
        </div>

        <Separator className="col-span-2" />

        {/* Industrial Index */}
        <div>
          <Label>Industrial Level (0-5)</Label>
          <Input
            type="number"
            min="0" max="5"
            value={formData.industrialLevel ?? ""}
            onChange={(e) => setFormData({ ...formData, industrialLevel: parseInt(e.target.value) || null })}
          />
        </div>

        <div>
          <Label>Industrial %</Label>
          <Input
            type="number"
            value={formData.industrialPercent || ""}
            onChange={(e) => setFormData({ ...formData, industrialPercent: parseFloat(e.target.value) || null })}
            placeholder="e.g., 12"
          />
        </div>

        <div>
          <Label>Industrial Change</Label>
          <Input
            type="number"
            step="0.1"
            value={formData.industrialChange || ""}
            onChange={(e) => setFormData({ ...formData, industrialChange: parseFloat(e.target.value) || null })}
          />
        </div>

        <div>
          <Label>Industrial Activity %</Label>
          <Input
            type="number"
            value={formData.industrialActivity || ""}
            onChange={(e) => setFormData({ ...formData, industrialActivity: parseFloat(e.target.value) || null })}
          />
        </div>

        <Separator className="col-span-2" />

        {/* Threat & Infrastructure */}
        <div>
          <Label>Major Threat</Label>
          <Input
            value={formData.majorThreat || ""}
            onChange={(e) => setFormData({ ...formData, majorThreat: e.target.value || null })}
            placeholder="e.g., M1, M2, M3"
          />
        </div>

        <div>
          <Label>Minor Threat</Label>
          <Input
            value={formData.minorThreat || ""}
            onChange={(e) => setFormData({ ...formData, minorThreat: e.target.value || null })}
            placeholder="e.g., ISO 1, MEGA 2"
          />
        </div>

        <div>
          <Label>Ore Prospecting</Label>
          <Input
            value={formData.oreProspecting || ""}
            onChange={(e) => setFormData({ ...formData, oreProspecting: e.target.value || null })}
            placeholder="e.g., ICE, MEGA 1, NOX 3"
          />
        </div>

        <div>
          <Label>Sovereignty Holder</Label>
          <Input
            value={formData.sovHolder || ""}
            onChange={(e) => setFormData({ ...formData, sovHolder: e.target.value || null })}
            placeholder="e.g., STAKAN, HORDE"
          />
        </div>

        <div className="col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="isCapital"
            checked={formData.isCapital || false}
            onChange={(e) => setFormData({ ...formData, isCapital: e.target.checked })}
            className="h-4 w-4"
          />
          <Label htmlFor="isCapital">Capital System (+2 ADM bonus)</Label>
        </div>
      </div>

      <DialogFooter className="flex justify-between sm:justify-between">
        <Button
          variant="outline"
          onClick={handleSavePreset}
          disabled={!formData.systemName || formData.adm === undefined}
          className="gap-1"
        >
          <BookmarkPlus className="h-4 w-4" />
          Save as Preset
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>Save System</Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}

// ESI Import Dialog Component
function EsiImportDialog({
  open,
  onOpenChange,
  onImport,
  existingSystems,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (systems: Partial<AdmSystem>[]) => void;
  existingSystems: string[];
}) {
  const { toast } = useToast();
  const [selectedRegion, setSelectedRegion] = useState<number | null>(null);
  const [selectedSystems, setSelectedSystems] = useState<Set<number>>(new Set());
  const [allianceFilter, setAllianceFilter] = useState<string>("");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [minAdmThreshold, setMinAdmThreshold] = useState<number>(4.0);

  // Fetch region sovereignty data
  const { data: regionData, isLoading: regionLoading, refetch } = useQuery({
    queryKey: ["esi-sovereignty-region", selectedRegion],
    queryFn: async () => {
      if (!selectedRegion) return null;
      const response = await fetch(`/api/esi/sovereignty/region/${selectedRegion}`);
      if (!response.ok) throw new Error("Failed to fetch region data");
      return response.json() as Promise<EsiRegionData>;
    },
    enabled: !!selectedRegion,
  });

  // Filter systems based on criteria
  const filteredSystems = regionData?.systems?.filter((sys) => {
    // Must have sovereignty (ADM)
    if (sys.adm === null) return false;

    // Alliance filter
    if (allianceFilter && sys.allianceTicker?.toLowerCase() !== allianceFilter.toLowerCase() &&
        sys.allianceName?.toLowerCase() !== allianceFilter.toLowerCase()) {
      return false;
    }

    // Search filter
    if (searchFilter && !sys.systemName.toLowerCase().includes(searchFilter.toLowerCase())) {
      return false;
    }

    return true;
  }) || [];

  // Get unique alliances from the data
  const alliances = regionData?.systems
    ?.filter((s) => s.allianceTicker)
    ?.reduce((acc, s) => {
      if (!acc.find((a) => a.ticker === s.allianceTicker)) {
        acc.push({ ticker: s.allianceTicker!, name: s.allianceName || "Unknown" });
      }
      return acc;
    }, [] as { ticker: string; name: string }[])
    ?.sort((a, b) => a.ticker.localeCompare(b.ticker)) || [];

  const handleSelectAll = () => {
    const newSelected = new Set(selectedSystems);
    filteredSystems.forEach((sys) => {
      if (!existingSystems.includes(sys.systemName)) {
        newSelected.add(sys.systemId);
      }
    });
    setSelectedSystems(newSelected);
  };

  const handleDeselectAll = () => {
    setSelectedSystems(new Set());
  };

  const handleToggleSystem = (systemId: number) => {
    const newSelected = new Set(selectedSystems);
    if (newSelected.has(systemId)) {
      newSelected.delete(systemId);
    } else {
      newSelected.add(systemId);
    }
    setSelectedSystems(newSelected);
  };

  const handleImport = () => {
    const systemsToImport = filteredSystems
      .filter((sys) => selectedSystems.has(sys.systemId))
      .map((sys) => {
        const vulnHours = sys.adm ? calculateVulnHours(sys.adm) : null;
        return {
          systemId: sys.systemId,
          systemName: sys.systemName,
          adm: sys.adm || 1.0,
          admStatus: sys.adm ? getAdmStatus(sys.adm, minAdmThreshold) : "safe",
          vulnerableHours: vulnHours,
          sovHolder: sys.allianceTicker || null,
          // These need to be filled in manually since ESI doesn't provide them
          strategicIndex: null,
          strategicPercent: null,
          militaryLevel: null,
          militaryPercent: null,
          industrialLevel: null,
          industrialPercent: null,
          majorThreat: null,
          minorThreat: null,
          oreProspecting: null,
          isCapital: false,
        } as Partial<AdmSystem>;
      });

    if (systemsToImport.length === 0) {
      toast({ title: "No systems selected", variant: "destructive" });
      return;
    }

    onImport(systemsToImport);
    setSelectedSystems(new Set());
    onOpenChange(false);
    toast({
      title: "Systems Imported",
      description: `Imported ${systemsToImport.length} systems from ESI`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Import from ESI
          </DialogTitle>
          <DialogDescription>
            Automatically fetch sovereignty data from EVE Online servers
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* Region Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Select Region</Label>
              <Select
                value={selectedRegion?.toString() || ""}
                onValueChange={(v) => {
                  setSelectedRegion(parseInt(v));
                  setSelectedSystems(new Set());
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a region..." />
                </SelectTrigger>
                <SelectContent>
                  {NULLSEC_REGIONS.map((region) => (
                    <SelectItem key={region.id} value={region.id.toString()}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Min ADM Threshold (for status)</Label>
              <Input
                type="number"
                step="0.1"
                min="1"
                max="6"
                value={minAdmThreshold}
                onChange={(e) => setMinAdmThreshold(parseFloat(e.target.value) || 4.0)}
              />
            </div>
          </div>

          {/* Filters */}
          {regionData && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Filter by Alliance</Label>
                <Select
                  value={allianceFilter || "__all__"}
                  onValueChange={(v) => setAllianceFilter(v === "__all__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All alliances" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All alliances</SelectItem>
                    {alliances.map((alliance) => (
                      <SelectItem key={alliance.ticker} value={alliance.ticker}>
                        [{alliance.ticker}] {alliance.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Search Systems</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search by name..."
                    className="pl-8"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Systems List */}
          <div className="flex-1 min-h-0 border rounded-md">
            {!selectedRegion ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Select a region to load sovereignty data
              </div>
            ) : regionLoading ? (
              <div className="flex items-center justify-center h-full gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading sovereignty data...
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* Header with select all */}
                <div className="flex items-center justify-between p-2 border-b bg-muted/50">
                  <div className="text-sm text-muted-foreground">
                    {filteredSystems.length} systems found, {selectedSystems.size} selected
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleSelectAll}>
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                      Clear
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => refetch()}>
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Refresh
                    </Button>
                  </div>
                </div>

                {/* Scrollable list */}
                <ScrollArea className="flex-1">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead>System</TableHead>
                        <TableHead>ADM</TableHead>
                        <TableHead>Vuln Window</TableHead>
                        <TableHead>Alliance</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSystems.map((sys) => {
                        const alreadyExists = existingSystems.includes(sys.systemName);
                        const vulnHours = sys.adm ? calculateVulnHours(sys.adm) : null;
                        const status = sys.adm ? getAdmStatus(sys.adm, minAdmThreshold) : "safe";

                        return (
                          <TableRow
                            key={sys.systemId}
                            className={alreadyExists ? "opacity-50" : "cursor-pointer hover:bg-accent"}
                            onClick={() => !alreadyExists && handleToggleSystem(sys.systemId)}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedSystems.has(sys.systemId)}
                                disabled={alreadyExists}
                                onCheckedChange={() => handleToggleSystem(sys.systemId)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              {sys.systemName}
                              {alreadyExists && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  Already added
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className={getStatusColor(status)}>
                              {sys.adm?.toFixed(1) || "-"}
                            </TableCell>
                            <TableCell>
                              {vulnHours ? `${vulnHours} hrs` : "-"}
                            </TableCell>
                            <TableCell>
                              {sys.allianceTicker ? `[${sys.allianceTicker}]` : "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                status === "critical" ? "destructive" :
                                status === "warning" ? "secondary" : "default"
                              }>
                                {status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedSystems.size === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Import {selectedSystems.size} Systems
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ADM Calculator Dialog
function AdmCalculatorDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [strategic, setStrategic] = useState(0);
  const [military, setMilitary] = useState(0);
  const [industrial, setIndustrial] = useState(0);
  const [isCapital, setIsCapital] = useState(false);

  const adm = calculateAdm(strategic, military, industrial, isCapital);
  const vulnHours = calculateVulnHours(adm);
  const entosisStructure = Math.min(adm * 10, 60); // 10 mins base, max 60
  const entosisNode = Math.min(adm * 4, 24); // 4 mins base, max 24

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            ADM Calculator
          </DialogTitle>
          <DialogDescription>
            Calculate ADM from index levels using official EVE formulas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Strategic Index (0-5)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="5"
                value={strategic}
                onChange={(e) => setStrategic(Math.min(5, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">
                +{STRATEGIC_INDEX_MODIFIERS[strategic]} modifier
              </span>
            </div>
          </div>

          <div>
            <Label>Military Index (0-5)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="5"
                value={military}
                onChange={(e) => setMilitary(Math.min(5, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">
                +{MILITARY_INDEX_MODIFIERS[military]} modifier
              </span>
            </div>
          </div>

          <div>
            <Label>Industrial Index (0-5)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="5"
                value={industrial}
                onChange={(e) => setIndustrial(Math.min(5, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">
                +{INDUSTRIAL_INDEX_MODIFIERS[industrial]} modifier
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="calc-capital"
              checked={isCapital}
              onCheckedChange={(checked) => setIsCapital(checked === true)}
            />
            <Label htmlFor="calc-capital">Capital System (+2 bonus)</Label>
          </div>

          <Separator />

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span>Base ADM:</span>
              <span>1.0</span>
            </div>
            <div className="flex justify-between">
              <span>Strategic:</span>
              <span>+{STRATEGIC_INDEX_MODIFIERS[strategic]}</span>
            </div>
            <div className="flex justify-between">
              <span>Military:</span>
              <span>+{MILITARY_INDEX_MODIFIERS[military]}</span>
            </div>
            <div className="flex justify-between">
              <span>Industrial:</span>
              <span>+{INDUSTRIAL_INDEX_MODIFIERS[industrial]}</span>
            </div>
            {isCapital && (
              <div className="flex justify-between text-yellow-500">
                <span>Capital Bonus:</span>
                <span>+2.0</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total ADM:</span>
              <span className={getStatusColor(getAdmStatus(adm))}>{adm.toFixed(1)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-muted/30 rounded p-2">
              <div className="text-muted-foreground">Vulnerability Window</div>
              <div className="font-bold">{vulnHours} hours</div>
            </div>
            <div className="bg-muted/30 rounded p-2">
              <div className="text-muted-foreground">Entosis (Structure)</div>
              <div className="font-bold">{entosisStructure.toFixed(0)} mins</div>
            </div>
            <div className="bg-muted/30 rounded p-2">
              <div className="text-muted-foreground">Entosis (Node)</div>
              <div className="font-bold">{entosisNode.toFixed(0)} mins</div>
            </div>
            <div className="bg-muted/30 rounded p-2">
              <div className="text-muted-foreground">Status</div>
              <Badge variant={
                getAdmStatus(adm) === "critical" ? "destructive" :
                getAdmStatus(adm) === "warning" ? "secondary" : "default"
              }>
                {getAdmStatus(adm)}
              </Badge>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ADM Report Visual Component
function AdmReportVisual({ report, systems }: { report: AdmReport; systems: AdmSystem[] }) {
  const reportRef = useRef<HTMLDivElement>(null);

  const handleExportImage = async () => {
    if (!reportRef.current) return;

    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#0a0a0a",
        scale: 2,
      });

      const link = document.createElement("a");
      link.download = `ADM_Report_${report.regionName}_${format(new Date(report.reportDate), "yyyy-MM-dd")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Failed to export image:", error);
    }
  };

  const sortedSystems = [...systems].sort((a, b) => a.adm - b.adm);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleExportImage}>
          <Download className="h-4 w-4 mr-2" />
          Export as Image
        </Button>
      </div>

      <div
        ref={reportRef}
        className="bg-[#0a0a0a] p-4 rounded-lg border border-gray-800 font-mono text-sm"
      >
        {/* Header */}
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold text-cyan-400">
            ADM REPORT for {report.regionName}
          </h2>
          <p className="text-gray-400">
            {format(new Date(report.reportDate), "MMM/dd/yyyy HH:mm")} Eve Time
          </p>
          {report.nextAdmRead && (
            <p className="text-yellow-500 text-xs">
              The next set point for ADMS is at {format(new Date(report.nextAdmRead), "HH:mm")}
            </p>
          )}
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-[60px_60px_80px_50px_50px_40px_80px_50px_40px_80px_50px_40px_50px_60px_70px_80px] gap-1 text-xs font-bold text-gray-400 border-b border-gray-700 pb-2 mb-2">
          <div>SI</div>
          <div>Vuln</div>
          <div>SYSTEM</div>
          <div>ADM</div>
          <div>+/-</div>
          <div>%</div>
          <div>Military</div>
          <div>+/-</div>
          <div>%</div>
          <div>Industrial</div>
          <div>+/-</div>
          <div>%</div>
          <div>Major</div>
          <div>Minor</div>
          <div>Ore</div>
          <div>Sov</div>
        </div>

        {/* Systems */}
        {sortedSystems.map((sys) => (
          <div
            key={sys.id}
            className="grid grid-cols-[60px_60px_80px_50px_50px_40px_80px_50px_40px_80px_50px_40px_50px_60px_70px_80px] gap-1 text-xs py-1 border-b border-gray-800"
          >
            {/* Strategic Index */}
            <div className="text-green-400">
              {sys.strategicIndex !== null ? `${sys.strategicIndex} + ${sys.strategicPercent || 0}%` : "-"}
            </div>

            {/* Vulnerable Hours */}
            <div className="text-gray-300">
              {sys.vulnerableHours ? `${sys.vulnerableHours} Hrs` : "-"}
            </div>

            {/* System Name */}
            <div className={`font-bold ${getStatusColor(sys.admStatus)} ${sys.isCapital ? "underline" : ""}`}>
              {sys.systemName}{sys.isCapital ? "*" : ""}
            </div>

            {/* ADM */}
            <div className={getStatusColor(sys.admStatus)}>
              {sys.adm.toFixed(1)}
            </div>

            {/* ADM Change */}
            <div className={sys.admChange && sys.admChange > 0 ? "text-green-400" : sys.admChange && sys.admChange < 0 ? "text-red-400" : "text-gray-500"}>
              {sys.admChange ? (sys.admChange > 0 ? `+${sys.admChange.toFixed(1)}` : sys.admChange.toFixed(1)) : "-"}
              {sys.admChange && (sys.admChange > 0 ? " ▲" : sys.admChange < 0 ? " ▼" : "")}
            </div>

            {/* ADM Activity % - placeholder */}
            <div className="text-gray-500">-</div>

            {/* Military */}
            <div className="text-gray-300">
              {formatIndex(sys.militaryLevel, sys.militaryPercent)}
            </div>

            {/* Military Change */}
            <div className={sys.militaryChange && sys.militaryChange > 0 ? "text-green-400" : sys.militaryChange && sys.militaryChange < 0 ? "text-red-400" : "text-gray-500"}>
              {sys.militaryChange ? `${sys.militaryChange > 0 ? "+" : ""}${sys.militaryChange}%` : "-"}
            </div>

            {/* Military Activity */}
            <div className="text-gray-500">
              {sys.militaryActivity ? `${sys.militaryActivity}%` : "-"}
            </div>

            {/* Industrial */}
            <div className="text-gray-300">
              {formatIndex(sys.industrialLevel, sys.industrialPercent)}
            </div>

            {/* Industrial Change */}
            <div className={sys.industrialChange && sys.industrialChange > 0 ? "text-green-400" : sys.industrialChange && sys.industrialChange < 0 ? "text-red-400" : "text-gray-500"}>
              {sys.industrialChange ? `${sys.industrialChange > 0 ? "+" : ""}${sys.industrialChange}%` : "-"}
            </div>

            {/* Industrial Activity */}
            <div className="text-gray-500">
              {sys.industrialActivity ? `${sys.industrialActivity}%` : "-"}
            </div>

            {/* Major Threat */}
            <div className="text-gray-300">{sys.majorThreat || "-"}</div>

            {/* Minor Threat */}
            <div className="text-gray-300">{sys.minorThreat || "-"}</div>

            {/* Ore Prospecting */}
            <div className="text-gray-300">{sys.oreProspecting || "-"}</div>

            {/* Sov Holder */}
            <div className={sys.sovHolder === "HORDE" ? "text-red-400" : "text-green-400"}>
              {sys.sovHolder || "-"}
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-gray-700 text-xs text-gray-400">
          <p>
            <span className="text-red-500">SYSTEM: RED</span> = ADM Below Min.
            <span className="text-yellow-500 ml-2">YELLOW</span> = ADM will drop below Min.
            <span className="text-green-500 ml-2">GREEN</span> = System is safe for next ADM read.
          </p>
          <p className="mt-1">
            MIL/IND: <span className="text-yellow-500">YELLOW</span> = INDEX may drop a level at next read.
            <span className="text-white ml-2">WHITE</span> = INDEX level will stay the same at next read.
          </p>
          <p className="mt-1">
            SYSTEM* = CAPITAL System which gets a +2 ADM bonus. x Hrs = Vulnerability Window.
          </p>
        </div>
      </div>
    </div>
  );
}

// Main Page Component
export default function AdmReportPage() {
  const { toast } = useToast();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSystemDialogOpen, setIsSystemDialogOpen] = useState(false);
  const [isEsiImportOpen, setIsEsiImportOpen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [editingSystem, setEditingSystem] = useState<Partial<AdmSystem> | null>(null);
  const [newReport, setNewReport] = useState({
    name: "",
    regionName: "",
    reportDate: new Date().toISOString().slice(0, 16),
    nextAdmRead: "",
  });

  // Fetch all reports
  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ["adm-reports"],
    queryFn: async () => {
      const response = await fetch("/api/admin/adm-reports");
      if (!response.ok) throw new Error("Failed to fetch ADM reports");
      return response.json();
    },
  });

  // Fetch selected report with systems
  const { data: selectedReportData, isLoading: reportLoading } = useQuery({
    queryKey: ["adm-report", selectedReportId],
    queryFn: async () => {
      if (!selectedReportId) return null;
      const response = await fetch(`/api/admin/adm-reports/${selectedReportId}`);
      if (!response.ok) throw new Error("Failed to fetch ADM report");
      return response.json();
    },
    enabled: !!selectedReportId,
  });

  // Fetch saved systems
  const { data: savedSystemsData } = useQuery({
    queryKey: ["saved-adm-systems"],
    queryFn: async () => {
      const response = await fetch("/api/admin/saved-adm-systems");
      if (!response.ok) throw new Error("Failed to fetch saved systems");
      return response.json();
    },
  });

  // Create report mutation
  const createReportMutation = useMutation({
    mutationFn: async (data: typeof newReport) => {
      const response = await fetch("/api/admin/adm-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          reportDate: new Date(data.reportDate).toISOString(),
          nextAdmRead: data.nextAdmRead ? new Date(data.nextAdmRead).toISOString() : null,
        }),
      });
      if (!response.ok) throw new Error("Failed to create report");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["adm-reports"] });
      setSelectedReportId(data.report.id);
      setIsCreateDialogOpen(false);
      setNewReport({ name: "", regionName: "", reportDate: new Date().toISOString().slice(0, 16), nextAdmRead: "" });
      toast({ title: "Report Created", description: "ADM report has been created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete report mutation
  const deleteReportMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/adm-reports/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete report");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adm-reports"] });
      setSelectedReportId(null);
      toast({ title: "Report Deleted", description: "ADM report has been deleted" });
    },
  });

  // Add system mutation
  const addSystemMutation = useMutation({
    mutationFn: async (data: Partial<AdmSystem>) => {
      const response = await fetch(`/api/admin/adm-reports/${selectedReportId}/systems`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to add system");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adm-report", selectedReportId] });
      setIsSystemDialogOpen(false);
      setEditingSystem(null);
      toast({ title: "System Added", description: "System has been added to the report" });
    },
  });

  // Update system mutation
  const updateSystemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AdmSystem> }) => {
      const response = await fetch(`/api/admin/adm-systems/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update system");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adm-report", selectedReportId] });
      setIsSystemDialogOpen(false);
      setEditingSystem(null);
      toast({ title: "System Updated", description: "System has been updated" });
    },
  });

  // Delete system mutation
  const deleteSystemMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/adm-systems/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete system");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adm-report", selectedReportId] });
      toast({ title: "System Deleted", description: "System has been removed from the report" });
    },
  });

  // Refresh ADMs from ESI mutation
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshAdmsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedReportId || systems.length === 0) {
        throw new Error("No systems to refresh");
      }

      console.log(`[ADM Refresh] Refreshing ${systems.length} systems`);

      // Fetch sovereignty structures data directly from ESI with cache-busting
      // Using direct ESI call to ensure fresh data
      const timestamp = Date.now();
      const sovResponse = await fetch(`https://esi.evetech.net/latest/sovereignty/structures/?datasource=tranquility&_=${timestamp}`);
      if (!sovResponse.ok) throw new Error("Failed to fetch sovereignty data from ESI");
      const structures = await sovResponse.json();

      console.log(`[ADM Refresh] Fetched ${structures.length} structures directly from ESI`);

      // Log raw ESI data for specific systems we're looking for
      const targetSystemIds = systems.map(s => s.systemId).filter(Boolean);
      const rawDataForTargets = structures.filter((s: any) => targetSystemIds.includes(s.solar_system_id));
      console.log(`[ADM Refresh] Raw ESI data for your systems:`, rawDataForTargets);

      // Build maps from system ID and system name to sovereignty data
      const sovBySystemId: Record<number, { adm: number; allianceId: number | null }> = {};
      const systemIdToSovMap = new Map<number, { adm: number; allianceId: number | null }>();

      // Structure type IDs: 32226 = TCU, 32458 = IHUB
      // ADM (vulnerability_occupancy_level) should be on the IHUB or TCU
      for (const structure of structures) {
        if (structure.vulnerability_occupancy_level !== undefined) {
          const existingSov = sovBySystemId[structure.solar_system_id];
          // Keep the higher ADM value if we already have one for this system
          if (!existingSov || structure.vulnerability_occupancy_level > existingSov.adm) {
            const newSovData = {
              adm: structure.vulnerability_occupancy_level,
              allianceId: structure.alliance_id,
            };
            sovBySystemId[structure.solar_system_id] = newSovData;
            systemIdToSovMap.set(structure.solar_system_id, newSovData);
          }
        }
      }

      // Log a sample of the data to verify
      const sampleSystemIds = Object.keys(sovBySystemId).slice(0, 5);
      console.log(`[ADM Refresh] Sample sov data:`, sampleSystemIds.map(id => ({ id, ...sovBySystemId[Number(id)] })));

      console.log(`[ADM Refresh] Built sov map with ${Object.keys(sovBySystemId).length} entries`);

      // For systems without systemId, we need to resolve names to IDs
      // Get all system IDs from sov data and resolve their names
      const allSovSystemIds = Object.keys(sovBySystemId).map(Number);
      const systemNameToId: Record<string, number> = {};

      // Batch resolve names (500 at a time)
      for (let i = 0; i < allSovSystemIds.length; i += 500) {
        const batch = allSovSystemIds.slice(i, i + 500);
        const namesResponse = await fetch("/api/esi/universe/names", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: batch }),
        });

        if (namesResponse.ok) {
          const namesData = await namesResponse.json();
          const names = namesData.names || namesData;
          if (Array.isArray(names)) {
            for (const item of names) {
              // Map lowercase name to system ID for matching
              systemNameToId[item.name.toLowerCase()] = item.id;
            }
          }
        }
      }

      console.log(`[ADM Refresh] Resolved ${Object.keys(systemNameToId).length} system names`);

      // Get unique alliance IDs for systems we care about
      const allianceIds = new Set<number>();
      for (const sys of systems) {
        // Use stored systemId or look up by name
        const esiSystemId = sys.systemId || systemNameToId[sys.systemName.toLowerCase()];
        if (esiSystemId && sovBySystemId[esiSystemId]?.allianceId) {
          allianceIds.add(sovBySystemId[esiSystemId].allianceId!);
        }
      }

      // Fetch alliance tickers
      const allianceTickerMap: Record<number, string> = {};
      for (const allianceId of Array.from(allianceIds)) {
        try {
          const detailResponse = await fetch(`/api/esi/alliances/${allianceId}`);
          if (detailResponse.ok) {
            const detail = await detailResponse.json();
            allianceTickerMap[allianceId] = detail.ticker || "???";
          }
        } catch {
          // Ignore individual failures
        }
      }

      // Update each system in the report
      const updates: { systemId: string; systemName: string; oldAdm: number; newAdm: number; updated: boolean }[] = [];

      for (const sys of systems) {
        // Use stored systemId or look up by name
        const esiSystemId = sys.systemId || systemNameToId[sys.systemName.toLowerCase()];
        const esiData = esiSystemId ? sovBySystemId[esiSystemId] : null;

        console.log(`[ADM Refresh] ${sys.systemName}: storedId=${sys.systemId}, lookupId=${systemNameToId[sys.systemName.toLowerCase()]}, esiSystemId=${esiSystemId}, esiData=`, esiData);

        if (esiData) {
          const oldAdm = sys.adm;
          const newAdm = esiData.adm;
          const admChange = Math.round((newAdm - oldAdm) * 10) / 10;
          const vulnHours = calculateVulnHours(newAdm);
          const sovHolder = esiData.allianceId ? allianceTickerMap[esiData.allianceId] || sys.sovHolder : sys.sovHolder;

          console.log(`[ADM Refresh] Updating ${sys.systemName}: ${oldAdm} -> ${newAdm} (systemId: ${esiSystemId})`);

          // Update the system in the database
          const updateResponse = await fetch(`/api/admin/adm-systems/${sys.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemId: esiSystemId,
              adm: newAdm,
              admChange: admChange !== 0 ? admChange : sys.admChange,
              admTrend: admChange > 0 ? "up" : admChange < 0 ? "down" : sys.admTrend,
              admStatus: getAdmStatus(newAdm),
              vulnerableHours: vulnHours,
              sovHolder: sovHolder,
            }),
          });

          if (!updateResponse.ok) {
            console.error(`[ADM Refresh] Failed to update ${sys.systemName}:`, await updateResponse.text());
          } else {
            console.log(`[ADM Refresh] Successfully updated ${sys.systemName}`);
          }

          updates.push({
            systemId: sys.id,
            systemName: sys.systemName,
            oldAdm,
            newAdm,
            updated: true,
          });
        } else {
          console.log(`[ADM Refresh] System not found in ESI: ${sys.systemName}`);
          updates.push({
            systemId: sys.id,
            systemName: sys.systemName,
            oldAdm: sys.adm,
            newAdm: sys.adm,
            updated: false,
          });
        }
      }

      return updates;
    },
    onSuccess: async (updates) => {
      // Force refetch to get updated data
      await queryClient.refetchQueries({ queryKey: ["adm-report", selectedReportId] });

      const updatedCount = updates.filter((u) => u.updated).length;
      const notFoundCount = updates.filter((u) => !u.updated).length;

      let description = `Updated ${updatedCount} system${updatedCount !== 1 ? "s" : ""}`;
      if (notFoundCount > 0) {
        description += `. ${notFoundCount} system${notFoundCount !== 1 ? "s" : ""} not found in ESI.`;
      }

      toast({
        title: "ADMs Refreshed",
        description,
      });
      setIsRefreshing(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Refresh Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsRefreshing(false);
    },
  });

  // Save system preset mutation
  const saveSystemPresetMutation = useMutation({
    mutationFn: async (data: Partial<AdmSystem>) => {
      const response = await fetch("/api/admin/saved-adm-systems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemName: data.systemName,
          systemId: data.systemId,
          strategicIndex: data.strategicIndex,
          strategicPercent: data.strategicPercent,
          vulnerableHours: data.vulnerableHours,
          defaultAdm: data.adm || 3.0,
          defaultAdmStatus: data.admStatus || "safe",
          militaryLevel: data.militaryLevel,
          militaryPercent: data.militaryPercent,
          industrialLevel: data.industrialLevel,
          industrialPercent: data.industrialPercent,
          majorThreat: data.majorThreat,
          minorThreat: data.minorThreat,
          oreProspecting: data.oreProspecting,
          sovHolder: data.sovHolder,
          isCapital: data.isCapital,
          notes: data.notes,
        }),
      });
      if (!response.ok) throw new Error("Failed to save system preset");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-adm-systems"] });
      toast({ title: "Preset Saved", description: "System preset has been saved/updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save system preset", variant: "destructive" });
    },
  });

  // Delete saved system mutation
  const deleteSavedSystemMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/saved-adm-systems/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete saved system");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-adm-systems"] });
      toast({ title: "Removed", description: "System removed from saved list" });
    },
  });

  const reports: AdmReport[] = reportsData?.reports || [];
  const selectedReport: AdmReport | null = selectedReportData?.report || null;
  const systems: AdmSystem[] = selectedReportData?.systems || [];
  const savedSystems: SavedAdmSystem[] = savedSystemsData?.systems || [];
  const existingSystemNames = systems.map((s) => s.systemName);

  // Bulk import from ESI
  const handleEsiImport = async (systemsToImport: Partial<AdmSystem>[]) => {
    if (!selectedReportId) {
      toast({ title: "Select a report first", variant: "destructive" });
      return;
    }

    // Import systems one by one
    for (const sys of systemsToImport) {
      try {
        await fetch(`/api/admin/adm-reports/${selectedReportId}/systems`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sys),
        });
      } catch (error) {
        console.error(`Failed to import ${sys.systemName}:`, error);
      }
    }

    queryClient.invalidateQueries({ queryKey: ["adm-report", selectedReportId] });
  };

  // Quick add from saved system
  const handleQuickAdd = (saved: SavedAdmSystem) => {
    if (!selectedReportId) {
      toast({ title: "Select a report first", variant: "destructive" });
      return;
    }
    addSystemMutation.mutate({
      systemName: saved.systemName,
      systemId: saved.systemId,
      strategicIndex: saved.strategicIndex,
      strategicPercent: saved.strategicPercent,
      vulnerableHours: saved.vulnerableHours,
      adm: saved.defaultAdm,
      admStatus: saved.defaultAdmStatus,
      militaryLevel: saved.militaryLevel,
      militaryPercent: saved.militaryPercent,
      industrialLevel: saved.industrialLevel,
      industrialPercent: saved.industrialPercent,
      majorThreat: saved.majorThreat,
      minorThreat: saved.minorThreat,
      oreProspecting: saved.oreProspecting,
      sovHolder: saved.sovHolder,
      isCapital: saved.isCapital,
      notes: saved.notes,
    });
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            ADM Report Generator
          </h1>
          <p className="text-muted-foreground">
            Create and manage Activity Defense Multiplier reports for your sovereignty
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsCalculatorOpen(true)}>
            <Calculator className="h-4 w-4 mr-2" />
            Calculator
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Report
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create ADM Report</DialogTitle>
              <DialogDescription>Create a new ADM report for a region</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Report Name</Label>
                <Input
                  value={newReport.name}
                  onChange={(e) => setNewReport({ ...newReport, name: e.target.value })}
                  placeholder="e.g., Weekly ADM Report"
                />
              </div>
              <div>
                <Label>Region Name</Label>
                <Input
                  value={newReport.regionName}
                  onChange={(e) => setNewReport({ ...newReport, regionName: e.target.value })}
                  placeholder="e.g., OUTER PASSAGE"
                />
              </div>
              <div>
                <Label>Report Date/Time (EVE Time)</Label>
                <Input
                  type="datetime-local"
                  value={newReport.reportDate}
                  onChange={(e) => setNewReport({ ...newReport, reportDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Next ADM Read (Optional)</Label>
                <Input
                  type="datetime-local"
                  value={newReport.nextAdmRead}
                  onChange={(e) => setNewReport({ ...newReport, nextAdmRead: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => createReportMutation.mutate(newReport)}
                disabled={!newReport.name || !newReport.regionName || createReportMutation.isPending}
              >
                Create Report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Sidebar - Reports & Saved Systems */}
        <div className="lg:col-span-1 space-y-4">
          {/* Reports List */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[250px]">
                {reportsLoading ? (
                  <div className="text-center text-muted-foreground">Loading...</div>
                ) : reports.length === 0 ? (
                  <div className="text-center text-muted-foreground">No reports yet</div>
                ) : (
                  <div className="space-y-2">
                    {reports.map((report) => (
                      <div
                        key={report.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedReportId === report.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-accent"
                        }`}
                        onClick={() => setSelectedReportId(report.id)}
                      >
                        <div className="font-medium">{report.name}</div>
                        <div className="text-sm text-muted-foreground">{report.regionName}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(report.reportDate), "MMM dd, yyyy HH:mm")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Saved Systems */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bookmark className="h-4 w-4" />
                Saved Systems
              </CardTitle>
              <CardDescription className="text-xs">
                Click to quick-add to report
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {savedSystems.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-4">
                    No saved systems yet. Save a system from the editor to use it again.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {savedSystems.map((saved) => (
                      <div
                        key={saved.id}
                        className="group flex items-center justify-between p-2 rounded-md hover:bg-accent cursor-pointer"
                      >
                        <div
                          className="flex-1 min-w-0"
                          onClick={() => handleQuickAdd(saved)}
                        >
                          <div className="font-medium text-sm truncate flex items-center gap-1">
                            {saved.systemName}
                            {saved.isCapital && <Star className="h-3 w-3 text-yellow-500" />}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ADM: {saved.defaultAdm} | {saved.sovHolder || "No sov"}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSavedSystemMutation.mutate(saved.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Report Editor / Viewer */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {selectedReport ? selectedReport.name : "Select a Report"}
              </CardTitle>
              {selectedReport && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEsiImportOpen(true)}
                  >
                    <Globe className="h-4 w-4 mr-1" />
                    Import from ESI
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsRefreshing(true);
                      refreshAdmsMutation.mutate();
                    }}
                    disabled={isRefreshing || systems.length === 0}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
                    {isRefreshing ? "Refreshing..." : "Refresh ADMs"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingSystem({ adm: 3.0, admStatus: "safe" });
                      setIsSystemDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add System
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm("Delete this report?")) {
                        deleteReportMutation.mutate(selectedReport.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedReport ? (
              <div className="text-center text-muted-foreground py-12">
                Select a report from the list or create a new one
              </div>
            ) : reportLoading ? (
              <div className="text-center text-muted-foreground py-12">Loading...</div>
            ) : (
              <Tabs defaultValue="edit">
                <TabsList>
                  <TabsTrigger value="edit">
                    <Edit className="h-4 w-4 mr-1" />
                    Edit Data
                  </TabsTrigger>
                  <TabsTrigger value="preview">
                    <Eye className="h-4 w-4 mr-1" />
                    Preview Report
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="edit" className="mt-4">
                  {systems.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      No systems added yet. Click "Add System" to start.
                    </div>
                  ) : (
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>System</TableHead>
                            <TableHead>ADM</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Military</TableHead>
                            <TableHead>Industrial</TableHead>
                            <TableHead>Sov</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {systems.map((sys) => (
                            <TableRow key={sys.id}>
                              <TableCell className="font-medium">
                                {sys.systemName}
                                {sys.isCapital && <Badge variant="outline" className="ml-2">Capital</Badge>}
                              </TableCell>
                              <TableCell>{sys.adm.toFixed(1)}</TableCell>
                              <TableCell>
                                <Badge variant={
                                  sys.admStatus === "critical" ? "destructive" :
                                  sys.admStatus === "warning" ? "secondary" : "default"
                                }>
                                  {sys.admStatus}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatIndex(sys.militaryLevel, sys.militaryPercent)}</TableCell>
                              <TableCell>{formatIndex(sys.industrialLevel, sys.industrialPercent)}</TableCell>
                              <TableCell>{sys.sovHolder || "-"}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingSystem(sys);
                                      setIsSystemDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      if (confirm("Delete this system?")) {
                                        deleteSystemMutation.mutate(sys.id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </TabsContent>

                <TabsContent value="preview" className="mt-4">
                  <AdmReportVisual report={selectedReport} systems={systems} />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Editor Dialog */}
      <Dialog open={isSystemDialogOpen} onOpenChange={(open) => {
        setIsSystemDialogOpen(open);
        if (!open) setEditingSystem(null);
      }}>
        {editingSystem && (
          <SystemEditorDialog
            system={editingSystem}
            isNew={!editingSystem.id}
            onSave={(data) => {
              if (editingSystem.id) {
                updateSystemMutation.mutate({ id: editingSystem.id, data });
              } else {
                addSystemMutation.mutate(data);
              }
            }}
            onSavePreset={(data) => {
              saveSystemPresetMutation.mutate(data);
            }}
            onClose={() => {
              setIsSystemDialogOpen(false);
              setEditingSystem(null);
            }}
          />
        )}
      </Dialog>

      {/* ESI Import Dialog */}
      <EsiImportDialog
        open={isEsiImportOpen}
        onOpenChange={setIsEsiImportOpen}
        onImport={handleEsiImport}
        existingSystems={existingSystemNames}
      />

      {/* ADM Calculator Dialog */}
      <AdmCalculatorDialog
        open={isCalculatorOpen}
        onOpenChange={setIsCalculatorOpen}
      />
    </div>
  );
}
