import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Layers,
  ArrowRight,
  Trash2,
  Plus,
  Download,
  Calculator,
  Package,
} from "lucide-react";
import { EveIcon } from "@/components/EveIcon";
import {
  ORE_COMPRESSION_DATA,
  CompressionInfo,
  calculateCompression,
  CompressionResult,
} from "@/lib/moon-ore-data";

interface CompressionEntry {
  id: string;
  typeId: number;
  quantity: number;
}

function formatVolume(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M m³`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K m³`;
  }
  return `${value.toFixed(1)} m³`;
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

export default function CompressionCalculator() {
  const [entries, setEntries] = useState<CompressionEntry[]>([]);
  const [selectedOre, setSelectedOre] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");

  // Group ores by category for the selector
  const oreGroups = useMemo(() => {
    const groups: Record<string, CompressionInfo[]> = {};

    for (const ore of ORE_COMPRESSION_DATA) {
      // Extract base ore name (remove variant prefixes)
      const baseName = ore.name.split(" ").slice(-1)[0]; // Get last word
      if (!groups[baseName]) {
        groups[baseName] = [];
      }
      groups[baseName].push(ore);
    }

    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, []);

  const handleAddEntry = () => {
    if (!selectedOre || !quantity) return;

    const numQuantity = parseInt(quantity.replace(/,/g, ""));
    if (isNaN(numQuantity) || numQuantity <= 0) return;

    const newEntry: CompressionEntry = {
      id: `${selectedOre}-${Date.now()}`,
      typeId: parseInt(selectedOre),
      quantity: numQuantity,
    };

    setEntries([...entries, newEntry]);
    setQuantity("");
  };

  const handleRemoveEntry = (id: string) => {
    setEntries(entries.filter(e => e.id !== id));
  };

  const handleClearAll = () => {
    setEntries([]);
  };

  // Calculate compression results
  const results = useMemo(() => {
    return entries.map(entry => ({
      entry,
      result: calculateCompression(entry.typeId, entry.quantity),
    })).filter(r => r.result !== null) as { entry: CompressionEntry; result: CompressionResult }[];
  }, [entries]);

  // Calculate totals
  const totals = useMemo(() => {
    let totalInputVolume = 0;
    let totalOutputVolume = 0;

    for (const { result } of results) {
      totalInputVolume += result.inputVolume;
      totalOutputVolume += result.outputVolume;
    }

    const volumeSaved = totalInputVolume - totalOutputVolume;
    const volumeSavedPercent = totalInputVolume > 0 ? (volumeSaved / totalInputVolume) * 100 : 0;

    return {
      totalInputVolume,
      totalOutputVolume,
      volumeSaved,
      volumeSavedPercent,
    };
  }, [results]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Compression Calculator
        </CardTitle>
        <CardDescription>
          Calculate ore compression to reduce cargo volume
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Add ore form */}
        <div className="flex gap-2">
          <Select value={selectedOre} onValueChange={setSelectedOre}>
            <SelectTrigger className="flex-1" data-testid="select-ore">
              <SelectValue placeholder="Select ore..." />
            </SelectTrigger>
            <SelectContent>
              <ScrollArea className="h-[300px]">
                {oreGroups.map(([baseName, ores]) => (
                  <div key={baseName}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted sticky top-0">
                      {baseName}
                    </div>
                    {ores.map(ore => (
                      <SelectItem key={ore.typeId} value={ore.typeId.toString()}>
                        <div className="flex items-center gap-2">
                          <EveIcon typeId={ore.typeId} size={20} alt={ore.name} className="w-5 h-5" />
                          <span>{ore.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </ScrollArea>
            </SelectContent>
          </Select>
          <Input
            type="text"
            placeholder="Quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-32"
            data-testid="input-quantity"
          />
          <Button
            onClick={handleAddEntry}
            disabled={!selectedOre || !quantity}
            data-testid="button-add-ore"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Results table */}
        {results.length > 0 ? (
          <>
            <ScrollArea className="flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ore</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Before</TableHead>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="text-right">After</TableHead>
                    <TableHead className="text-right">Saved</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map(({ entry, result }) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <EveIcon typeId={result.inputTypeId} size={24} alt={result.inputName} className="w-6 h-6" />
                          <span className="text-sm truncate max-w-24">{result.inputName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatNumber(result.inputQuantity)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">
                        {formatVolume(result.inputVolume)}
                      </TableCell>
                      <TableCell className="text-center">
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatVolume(result.outputVolume)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="text-xs text-green-500">
                          -{result.volumeSavedPercent.toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleRemoveEntry(entry.id)}
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* Totals */}
            <div className="border-t pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Before Compression</p>
                  <p className="text-lg font-mono font-bold">
                    {formatVolume(totals.totalInputVolume)}
                  </p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">After Compression</p>
                  <p className="text-lg font-mono font-bold text-primary">
                    {formatVolume(totals.totalOutputVolume)}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Volume Saved</p>
                    <p className="text-lg font-mono font-bold text-green-500">
                      {formatVolume(totals.volumeSaved)}
                    </p>
                  </div>
                  <Badge className="bg-green-500 text-white text-lg px-3 py-1">
                    -{totals.volumeSavedPercent.toFixed(1)}%
                  </Badge>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleClearAll}
                data-testid="button-clear-all"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
            <Package className="h-12 w-12 mb-4 opacity-50" />
            <p>No ores added</p>
            <p className="text-sm mt-1">
              Select an ore and quantity to calculate compression
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
