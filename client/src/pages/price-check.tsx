import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tag, Search, Loader2, TrendingUp, TrendingDown, ArrowLeftRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { formatISK } from "@/hooks/use-wallet";
import { PageHeader } from "@/components/PageHeader";
import { apiRequest } from "@/lib/queryClient";

interface Hub {
  name: string;
  system: string;
  region: number;
  buy: number;
  sell: number;
  buyVolume: number;
  sellVolume: number;
}

interface PriceData {
  item: { typeId: number; name: string };
  hubs: Hub[];
  bestSellHub: string | null; // cheapest place to BUY (lowest sell)
  bestBuyHub: string | null;  // best place to SELL (highest buy)
}

export default function PriceCheckPage() {
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState("");
  const [data, setData] = useState<PriceData | null>(null);
  const [notFound, setNotFound] = useState(false);

  const check = useMutation({
    mutationFn: async (name: string): Promise<PriceData> => {
      const res = await apiRequest("GET", `/api/tools/price?name=${encodeURIComponent(name.trim())}`);
      return (await res.json()) as PriceData;
    },
    onSuccess: (d) => { setData(d); setNotFound(false); },
    onError: () => { setData(null); setNotFound(true); },
  });

  const run = () => { if (query.trim()) check.mutate(query); };

  // Arbitrage: buy at cheapest sell hub, sell at highest buy hub.
  const cheapestSell = data?.hubs.filter((h) => h.sell > 0).sort((a, b) => a.sell - b.sell)[0];
  const highestBuy = data?.hubs.filter((h) => h.buy > 0).sort((a, b) => b.buy - a.buy)[0];
  const spread = cheapestSell && highestBuy ? highestBuy.buy - cheapestSell.sell : null;

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="border-dashed max-w-md">
          <CardContent className="pt-6 text-center">
            <Tag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Price Check</h2>
            <p className="text-muted-foreground">Login with EVE Online to compare trade hub prices.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[900px] mx-auto">
      <PageHeader
        icon={Tag}
        title="Price Check"
        subtitle="Compare an item's buy & sell price across the major trade hubs"
      />

      <form onSubmit={(e) => { e.preventDefault(); run(); }} className="flex items-center gap-2 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Item name (e.g. PLEX, Damage Control II, Tritanium)"
            className="pl-9"
            autoFocus
          />
        </div>
        <Button type="submit" disabled={check.isPending || !query.trim()}>
          {check.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
        </Button>
      </form>

      {notFound && (
        <p className="text-sm text-muted-foreground">No item found for “{query.trim()}”. Check the spelling (exact item name).</p>
      )}

      {!data && !notFound && !check.isPending && (
        <div className="text-center py-16 text-muted-foreground">
          <Tag className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>Search an item to compare hub prices.</p>
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* Item header + best hubs */}
          <div className="flex items-center gap-3">
            <img
              src={`https://images.evetech.net/types/${data.item.typeId}/icon?size=64`}
              alt=""
              className="h-12 w-12 rounded-md border border-border/60"
              onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
            />
            <div>
              <h2 className="text-xl font-bold">{data.item.name}</h2>
              <p className="text-sm text-muted-foreground flex flex-wrap gap-x-4">
                {data.bestSellHub && (
                  <span className="flex items-center gap-1 text-green-400">
                    <TrendingDown className="h-3.5 w-3.5" /> Cheapest to buy: {data.bestSellHub}
                  </span>
                )}
                {data.bestBuyHub && (
                  <span className="flex items-center gap-1 text-blue-400">
                    <TrendingUp className="h-3.5 w-3.5" /> Best to sell: {data.bestBuyHub}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Cross-hub arbitrage hint */}
          {spread != null && spread > 0 && cheapestSell && highestBuy && cheapestSell.name !== highestBuy.name && (
            <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <ArrowLeftRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span className="text-muted-foreground">
                Buy in <span className="text-foreground font-medium">{cheapestSell.name}</span> at{" "}
                {formatISK(cheapestSell.sell)}, sell in <span className="text-foreground font-medium">{highestBuy.name}</span>{" "}
                at {formatISK(highestBuy.buy)} —{" "}
                <span className="text-green-400 font-medium">{formatISK(spread)}/unit</span> gross margin.
              </span>
            </div>
          )}

          {/* Hub table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hub</TableHead>
                    <TableHead className="text-right">Sell (buy from)</TableHead>
                    <TableHead className="text-right">Buy (sell to)</TableHead>
                    <TableHead className="text-right">Sell vol</TableHead>
                    <TableHead className="text-right">Buy vol</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.hubs.map((h) => (
                    <TableRow key={h.region}>
                      <TableCell>
                        <span className="font-medium">{h.name}</span>
                        <span className="text-muted-foreground text-xs ml-2">{h.system}</span>
                      </TableCell>
                      <TableCell className={`text-right font-mono ${h.name === data.bestSellHub ? "text-green-400 font-bold" : ""}`}>
                        {h.sell > 0 ? formatISK(h.sell) : "—"}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${h.name === data.bestBuyHub ? "text-blue-400 font-bold" : ""}`}>
                        {h.buy > 0 ? formatISK(h.buy) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground text-sm">
                        {h.sellVolume > 0 ? h.sellVolume.toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground text-sm">
                        {h.buyVolume > 0 ? h.buyVolume.toLocaleString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground text-right">Region-aggregated prices via Fuzzwork.</p>
        </div>
      )}
    </div>
  );
}
