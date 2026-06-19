import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import {
  CreditCard,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { formatISK } from "@/hooks/use-wallet";

interface Transaction {
  transaction_id: number;
  date: string;
  type_id: number;
  typeName: string;
  unit_price: number;
  quantity: number;
  is_buy: boolean;
  location_id: number;
  locationName: string;
  client_id: number;
}

interface TransactionsData {
  transactions: Transaction[];
}

function TransactionSkeleton() {
  return (
    <TableRow>
      {Array.from({ length: 7 }).map((_, i) => (
        <TableCell key={i}>
          <Skeleton className="h-4 w-full" />
        </TableCell>
      ))}
    </TableRow>
  );
}

export default function WalletTransactionsPage() {
  const { isAuthenticated } = useAuth();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<"all" | "buy" | "sell">("all");

  const { data, isLoading, isError } = useQuery<TransactionsData>({
    queryKey: ["/api/wallet/transactions", page],
    queryFn: async () => {
      const res = await fetch(`/api/wallet/transactions?page=${page}`);
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000,
  });

  const allTransactions = data?.transactions ?? [];

  const filtered = useMemo(() => {
    if (tab === "buy") return allTransactions.filter((t) => t.is_buy);
    if (tab === "sell") return allTransactions.filter((t) => !t.is_buy);
    return allTransactions;
  }, [allTransactions, tab]);

  const totalIn = useMemo(
    () =>
      allTransactions
        .filter((t) => !t.is_buy)
        .reduce((sum, t) => sum + t.unit_price * t.quantity, 0),
    [allTransactions]
  );

  const totalOut = useMemo(
    () =>
      allTransactions
        .filter((t) => t.is_buy)
        .reduce((sum, t) => sum + t.unit_price * t.quantity, 0),
    [allTransactions]
  );

  const netFlow = totalIn - totalOut;

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="border-dashed max-w-md">
          <CardContent className="pt-6 text-center">
            <CreditCard className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Wallet Transactions</h2>
            <p className="text-muted-foreground">Login with EVE Online to view your transactions.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader icon={CreditCard} title="Wallet Transactions" subtitle="Buy and sell history from your wallet" />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground font-normal flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-green-400" />
              ISK In (Sales)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <p className="text-xl font-bold text-green-400">{formatISK(totalIn)}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground font-normal flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-red-400" />
              ISK Out (Purchases)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <p className="text-xl font-bold text-red-400">{formatISK(totalOut)}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground font-normal">Net Flow</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <p className={`text-xl font-bold ${netFlow >= 0 ? "text-green-400" : "text-red-400"}`}>
                {netFlow >= 0 ? "+" : ""}
                {formatISK(netFlow)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Table */}
      <Tabs value={tab} onValueChange={(v) => { setTab(v as typeof tab); setPage(1); }}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="buy">Buy</TabsTrigger>
          <TabsTrigger value="sell">Sell</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date / Time</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 15 }).map((_, i) => (
                      <TransactionSkeleton key={i} />
                    ))
                  ) : isError ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                        <p className="text-muted-foreground">Failed to load transactions.</p>
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                        <p className="text-muted-foreground">No transactions found.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((tx) => (
                      <TableRow key={tx.transaction_id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(parseISO(tx.date), "MMM d, yyyy")}
                          <br />
                          <span className="text-[11px]">{format(parseISO(tx.date), "HH:mm")}</span>
                        </TableCell>
                        <TableCell className="font-medium text-sm max-w-[180px] truncate">
                          {tx.typeName || `Type ${tx.type_id}`}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {tx.quantity.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatISK(tx.unit_price)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {formatISK(tx.unit_price * tx.quantity)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                          {tx.locationName || `Station ${tx.location_id}`}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              tx.is_buy
                                ? "border-red-500/40 text-red-400 bg-red-500/10"
                                : "border-green-500/40 text-green-400 bg-green-500/10"
                            }
                          >
                            {tx.is_buy ? "Buy" : "Sell"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">Page {page}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={isLoading || (allTransactions.length < 50)}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
