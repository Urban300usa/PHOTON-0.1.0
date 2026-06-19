import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ShoppingCart, AlertCircle, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { formatISK } from "@/hooks/use-wallet";
import { PageHeader } from "@/components/PageHeader";

interface Order {
  orderId: number;
  typeId: number;
  typeName: string;
  locationName: string;
  isBuyOrder: boolean;
  price: number;
  volumeRemain: number;
  volumeTotal: number;
  issued: string;
  expiresAt: string;
  escrow: number | null;
  state: string;
  outbid: boolean;
  bestPrice: number | null;
}

interface OrdersData {
  activeOrders: Order[];
  historyOrders: Order[];
  summary: {
    activeCount: number;
    sellOrders: number;
    buyOrders: number;
    outbidCount: number;
    sellValueRemaining: number;
    buyEscrow: number;
  };
}

function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export default function MarketOrdersPage() {
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState("active");

  const { data, isLoading, isError } = useQuery<OrdersData>({
    queryKey: ["/api/character/market-orders"],
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000,
  });

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="border-dashed max-w-md">
          <CardContent className="pt-6 text-center">
            <ShoppingCart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Market Orders</h2>
            <p className="text-muted-foreground">Login with EVE Online to manage your market orders.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const s = data?.summary;
  const active = data?.activeOrders ?? [];
  const history = data?.historyOrders ?? [];

  const renderOrderRow = (o: Order, showOutbid: boolean) => (
    <TableRow key={o.orderId} className={o.outbid ? "bg-red-500/5" : ""}>
      <TableCell className="font-medium max-w-[200px] truncate">{o.typeName}</TableCell>
      <TableCell>
        <Badge variant="outline" className={o.isBuyOrder ? "text-blue-400 border-blue-400/40" : "text-green-400 border-green-400/40"}>
          {o.isBuyOrder ? "Buy" : "Sell"}
        </Badge>
      </TableCell>
      <TableCell className="text-right font-mono">{formatISK(o.price)}</TableCell>
      <TableCell className="text-right font-mono text-muted-foreground">
        {o.volumeRemain.toLocaleString()} / {o.volumeTotal.toLocaleString()}
      </TableCell>
      <TableCell className="max-w-[160px] truncate text-muted-foreground text-sm">{o.locationName}</TableCell>
      {showOutbid && (
        <TableCell className="text-right">
          {o.outbid ? (
            <span className="flex items-center justify-end gap-1 text-red-400 text-sm font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              Outbid {o.bestPrice ? `(${formatISK(o.bestPrice)})` : ""}
            </span>
          ) : o.bestPrice ? (
            <span className="text-green-400 text-sm">Best price</span>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          )}
        </TableCell>
      )}
      <TableCell className="text-right text-sm text-muted-foreground">
        {showOutbid ? timeLeft(o.expiresAt) : new Date(o.issued).toLocaleDateString()}
      </TableCell>
    </TableRow>
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1100px] mx-auto">
      <PageHeader icon={ShoppingCart} title="Market Orders" subtitle="Active orders with outbid detection, escrow & history" />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-normal">Active Orders</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-7 w-16" /> : <p className="text-2xl font-bold">{s?.activeCount ?? 0}</p>}
            {!isLoading && <p className="text-xs text-muted-foreground">{s?.sellOrders ?? 0} sell · {s?.buyOrders ?? 0} buy</p>}
          </CardContent>
        </Card>
        <Card className={s && s.outbidCount > 0 ? "border-red-500/40" : ""}>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-normal">Outbid</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-7 w-16" /> : (
              <p className={`text-2xl font-bold ${s && s.outbidCount > 0 ? "text-red-400" : ""}`}>{s?.outbidCount ?? 0}</p>
            )}
            <p className="text-xs text-muted-foreground">need a reprice</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-1"><TrendingUp className="h-3 w-3 text-green-400" />Sell Value</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-7 w-24" /> : <p className="text-xl font-bold text-green-400">{formatISK(s?.sellValueRemaining ?? 0)}</p>}
            <p className="text-xs text-muted-foreground">remaining on market</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-1"><TrendingDown className="h-3 w-3 text-blue-400" />Buy Escrow</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-7 w-24" /> : <p className="text-xl font-bold text-blue-400">{formatISK(s?.buyEscrow ?? 0)}</p>}
            <p className="text-xs text-muted-foreground">locked in buy orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Tables */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="history">History ({history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Remain / Total</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                    <TableHead className="text-right">Expires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
                    ))
                  ) : isError ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8">
                      <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                      <p className="text-muted-foreground">Failed to load. You may need to re-authorize ESI scopes.</p>
                    </TableCell></TableRow>
                  ) : active.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No active market orders.</TableCell></TableRow>
                  ) : (
                    active.map((o) => renderOrderRow(o, true))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Remain / Total</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Issued</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
                    ))
                  ) : history.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No order history.</TableCell></TableRow>
                  ) : (
                    history.map((o) => renderOrderRow(o, false))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
