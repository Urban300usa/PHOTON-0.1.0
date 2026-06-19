import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCharacterView } from "@/contexts/CharacterViewContext";
import { formatISK } from "@/hooks/use-wallet";
import {
  ShoppingCart,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Search,
  Users,
  Package,
  History,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

export default function MarketPage() {
  const queryClient = useQueryClient();
  const { viewMode } = useCharacterView();
  const [searchTerm, setSearchTerm] = useState("");
  const [orderFilter, setOrderFilter] = useState<"all" | "buy" | "sell">("all");

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["market-orders-stats"],
    queryFn: async () => {
      const response = await fetch("/api/market/orders/stats");
      if (!response.ok) throw new Error("Failed to fetch market orders stats");
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });

  const { data: ordersData, isLoading: ordersLoading, isError: ordersError } = useQuery({
    queryKey: ["market-orders", viewMode],
    queryFn: async () => {
      const params = viewMode === "all" ? "?viewAll=true" : "";
      const response = await fetch(`/api/market/orders${params}`);
      if (!response.ok) throw new Error("Failed to fetch market orders");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["market-orders-history", viewMode],
    queryFn: async () => {
      const params = viewMode === "all" ? "?viewAll=true" : "";
      const response = await fetch(`/api/market/orders/history${params}`);
      if (!response.ok) throw new Error("Failed to fetch order history");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/market/orders/sync", { method: "POST" });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to sync market orders");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["market-orders"] });
      queryClient.invalidateQueries({ queryKey: ["market-orders-stats"] });
      queryClient.invalidateQueries({ queryKey: ["market-orders-history"] });
    },
  });

  const isLoading = statsLoading || ordersLoading;
  const stats = statsData || {
    activeOrders: 0,
    sellOrders: 0,
    buyOrders: 0,
    totalSellValue: 0,
    totalBuyEscrow: 0,
    recentSalesCount: 0,
    totalRecentRevenue: 0,
  };
  const orders = ordersData?.orders || [];
  const history = historyData?.history || [];

  // Filter orders
  const filteredOrders = orders.filter((order: any) => {
    const matchesSearch = order.typeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.locationName && order.locationName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = orderFilter === "all" ||
      (orderFilter === "buy" && order.isBuyOrder) ||
      (orderFilter === "sell" && !order.isBuyOrder);
    return matchesSearch && matchesFilter;
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader icon={ShoppingCart} title="Market Orders" subtitle="Track your buy and sell orders" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        icon={ShoppingCart}
        title="Market Orders"
        subtitle="Track your buy and sell orders"
        actions={
          <>
            {viewMode === "all" && (
              <Badge variant="secondary">
                <Users className="h-3 w-3 mr-1" />
                All Characters
              </Badge>
            )}
            <Button
              variant="outline"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              Sync from ESI
            </Button>
          </>
        }
      />

      {ordersError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">Failed to load market orders</p>
                <p className="text-sm">Click "Sync from ESI" to fetch your market data</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.activeOrders}</p>
            <p className="text-xs text-muted-foreground">
              {stats.sellOrders} sell / {stats.buyOrders} buy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Sell Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">{formatISK(stats.totalSellValue)}</p>
            <p className="text-xs text-muted-foreground">Listed for sale</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-4 w-4 text-blue-500" />
              Buy Escrow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">{formatISK(stats.totalBuyEscrow)}</p>
            <p className="text-xs text-muted-foreground">In escrow</p>
          </CardContent>
        </Card>

        <Card className={stats.recentSalesCount > 0 ? "border-green-500/30 bg-green-500/5" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recent Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold font-mono ${stats.recentSalesCount > 0 ? "text-green-500" : ""}`}>
              {formatISK(stats.totalRecentRevenue)}
            </p>
            <p className="text-xs text-muted-foreground">
              {stats.recentSalesCount} order{stats.recentSalesCount !== 1 ? "s" : ""} completed
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active">Active Orders</TabsTrigger>
          <TabsTrigger value="history">Order History</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {/* Filters */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by item or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex rounded-md border border-border overflow-hidden">
              {(["all", "sell", "buy"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setOrderFilter(filter)}
                  className={`px-3 py-1.5 text-sm capitalize ${
                    orderFilter === filter
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center text-center py-8">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No Active Orders</h3>
                  <p className="text-muted-foreground mt-1">
                    {orders.length > 0
                      ? "No orders match your search"
                      : "Your market orders will appear here after syncing"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Issued</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order: any) => (
                      <TableRow key={order.orderId}>
                        <TableCell>
                          <Badge
                            variant={order.isBuyOrder ? "outline" : "secondary"}
                            className={order.isBuyOrder ? "text-blue-500" : "text-green-500"}
                          >
                            {order.isBuyOrder ? "BUY" : "SELL"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{order.typeName}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {order.locationName || `Location ${order.locationId}`}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatISK(order.price)}
                        </TableCell>
                        <TableCell className="text-right">
                          {order.volumeRemain.toLocaleString()} / {order.volumeTotal.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatISK(order.price * order.volumeRemain)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(order.issued), "MMM d")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {historyLoading ? (
            <Skeleton className="h-96" />
          ) : history.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center text-center py-8">
                  <History className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No Order History</h3>
                  <p className="text-muted-foreground mt-1">
                    Completed and expired orders will appear here
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Sold</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead>Completed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((order: any) => (
                      <TableRow key={`${order.orderId}-${order.id}`}>
                        <TableCell>
                          <Badge
                            variant={order.isBuyOrder ? "outline" : "secondary"}
                            className={order.isBuyOrder ? "text-blue-500" : "text-green-500"}
                          >
                            {order.isBuyOrder ? "BUY" : "SELL"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{order.typeName}</TableCell>
                        <TableCell>
                          <Badge
                            variant={order.state === "fulfilled" ? "default" : "secondary"}
                            className={
                              order.state === "fulfilled"
                                ? "bg-green-500"
                                : order.state === "expired"
                                ? "bg-yellow-500"
                                : ""
                            }
                          >
                            {order.state}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatISK(order.price)}
                        </TableCell>
                        <TableCell className="text-right">
                          {order.volumeSold.toLocaleString()} / {order.volumeTotal.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-green-500">
                          {order.totalRevenue ? `+${formatISK(order.totalRevenue)}` : "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {order.completedAt
                            ? formatDistanceToNow(new Date(order.completedAt), { addSuffix: true })
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
