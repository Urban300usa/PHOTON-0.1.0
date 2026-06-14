import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, AlertCircle, RefreshCw, TrendingUp, TrendingDown, Package } from "lucide-react";
import { formatISK } from "@/hooks/use-wallet";

interface MarketOrdersWidgetProps {
  isAuthenticated: boolean;
  compact?: boolean;
}

export default function MarketOrdersWidget({ isAuthenticated, compact = false }: MarketOrdersWidgetProps) {
  const queryClient = useQueryClient();

  const { data: statsData, isLoading: statsLoading, isError: statsError } = useQuery({
    queryKey: ["market-orders-stats"],
    queryFn: async () => {
      const response = await fetch("/api/market/orders/stats");
      if (!response.ok) throw new Error("Failed to fetch market orders stats");
      return response.json();
    },
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 2 * 60 * 1000, // 2 minutes
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["market-orders"],
    queryFn: async () => {
      const response = await fetch("/api/market/orders");
      if (!response.ok) throw new Error("Failed to fetch market orders");
      return response.json();
    },
    enabled: isAuthenticated && !compact,
    staleTime: 5 * 60 * 1000, // 5 minutes
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
    },
  });

  if (!isAuthenticated) {
    return (
      <Card className="border-dashed h-full">
        <CardContent className="pt-6 h-full flex items-center justify-center">
          <div className="flex flex-col items-center justify-center text-center py-4">
            <ShoppingCart className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">
              Login to view market orders
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (statsLoading || ordersLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Market Orders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (statsError) {
    return (
      <Card className="border-destructive h-full">
        <CardContent className="pt-6 h-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">Failed to load market orders</p>
            <Button variant="outline" size="sm" onClick={() => syncMutation.mutate()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Sync from ESI
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

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
  const hasOrders = stats.activeOrders > 0;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-medium">Market Orders</CardTitle>
          {stats.activeOrders > 0 && (
            <Badge variant="secondary" className="text-xs">
              {stats.activeOrders} active
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {!hasOrders ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
            <Package className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">No Active Orders</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your market orders will appear here
            </p>
          </div>
        ) : (
          <>
            {/* Order summary */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-2 bg-muted rounded-md">
                <div className="flex items-center gap-1 mb-1">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-muted-foreground">Sell Orders</span>
                </div>
                <p className="text-sm font-medium">{stats.sellOrders}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {formatISK(stats.totalSellValue)}
                </p>
              </div>
              <div className="p-2 bg-muted rounded-md">
                <div className="flex items-center gap-1 mb-1">
                  <TrendingDown className="h-3 w-3 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Buy Orders</span>
                </div>
                <p className="text-sm font-medium">{stats.buyOrders}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {formatISK(stats.totalBuyEscrow)} escrow
                </p>
              </div>
            </div>

            {/* Recent sales */}
            {stats.recentSalesCount > 0 && (
              <div className="p-2 bg-green-500/10 border border-green-500/20 rounded-md mb-4">
                <p className="text-xs text-green-500">Recent Sales</p>
                <p className="text-sm font-medium text-green-500">
                  {stats.recentSalesCount} order{stats.recentSalesCount !== 1 ? "s" : ""} completed
                </p>
                <p className="text-xs font-mono text-green-500">
                  +{formatISK(stats.totalRecentRevenue)} revenue
                </p>
              </div>
            )}

            {/* Recent orders (non-compact) */}
            {!compact && orders.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Recent Orders</p>
                {orders.slice(0, 5).map((order: any) => (
                  <div key={order.orderId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge
                        variant={order.isBuyOrder ? "outline" : "secondary"}
                        className={`text-xs shrink-0 ${order.isBuyOrder ? "text-blue-500" : "text-green-500"}`}
                      >
                        {order.isBuyOrder ? "BUY" : "SELL"}
                      </Badge>
                      <span className="truncate text-muted-foreground">{order.typeName}</span>
                    </div>
                    <span className="font-mono text-xs shrink-0">
                      {formatISK(order.price)}
                    </span>
                  </div>
                ))}
                {orders.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{orders.length - 5} more orders
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
