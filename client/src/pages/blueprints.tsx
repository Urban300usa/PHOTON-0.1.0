import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FileStack, AlertCircle, Search } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/PageHeader";

interface Blueprint {
  itemId: number;
  typeId: number;
  typeName: string;
  locationName: string;
  materialEfficiency: number;
  timeEfficiency: number;
  quantity: number;
  runs: number;
  isOriginal: boolean;
}

interface BlueprintsData {
  blueprints: Blueprint[];
  summary: { total: number; originals: number; copies: number };
}

export default function BlueprintsPage() {
  const { isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

  const { data, isLoading, isError } = useQuery<BlueprintsData>({
    queryKey: ["/api/character/blueprints"],
    enabled: isAuthenticated,
    staleTime: 10 * 60 * 1000,
  });

  const blueprints = data?.blueprints ?? [];

  const filtered = useMemo(() => {
    let list = blueprints;
    if (tab === "bpo") list = list.filter((b) => b.isOriginal);
    else if (tab === "bpc") list = list.filter((b) => !b.isOriginal);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((b) => b.typeName.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => a.typeName.localeCompare(b.typeName));
  }, [blueprints, tab, search]);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="border-dashed max-w-md">
          <CardContent className="pt-6 text-center">
            <FileStack className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Blueprint Library</h2>
            <p className="text-muted-foreground">Login with EVE Online to view your blueprints.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const s = data?.summary;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1100px] mx-auto">
      <PageHeader icon={FileStack} title="Blueprint Library" subtitle="Every BPO and BPC you own, with ME/TE and runs" />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-normal">Total</CardTitle></CardHeader>
          <CardContent>{isLoading ? <Skeleton className="h-7 w-16" /> : <p className="text-2xl font-bold">{s?.total ?? 0}</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-normal">Originals (BPO)</CardTitle></CardHeader>
          <CardContent>{isLoading ? <Skeleton className="h-7 w-16" /> : <p className="text-2xl font-bold text-blue-400">{s?.originals ?? 0}</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-normal">Copies (BPC)</CardTitle></CardHeader>
          <CardContent>{isLoading ? <Skeleton className="h-7 w-16" /> : <p className="text-2xl font-bold text-purple-400">{s?.copies ?? 0}</p>}</CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="bpo">BPO</TabsTrigger>
            <TabsTrigger value="bpc">BPC</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search blueprints…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Blueprint</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead className="text-right">ME</TableHead>
                <TableHead className="text-right">TE</TableHead>
                <TableHead className="text-right">Runs</TableHead>
                <TableHead>Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
                ))
              ) : isError ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">
                  <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                  <p className="text-muted-foreground">Failed to load. You may need to re-authorize ESI scopes (read_blueprints).</p>
                </TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  {blueprints.length === 0 ? "No blueprints found." : "No blueprints match your search."}
                </TableCell></TableRow>
              ) : (
                filtered.map((b) => (
                  <TableRow key={b.itemId}>
                    <TableCell className="font-medium max-w-[260px] truncate">{b.typeName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={b.isOriginal ? "text-blue-400 border-blue-400/40" : "text-purple-400 border-purple-400/40"}>
                        {b.isOriginal ? "BPO" : "BPC"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{b.materialEfficiency}%</TableCell>
                    <TableCell className="text-right font-mono">{b.timeEfficiency}%</TableCell>
                    <TableCell className="text-right font-mono">{b.runs === -1 ? "∞" : b.runs}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">{b.locationName}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
