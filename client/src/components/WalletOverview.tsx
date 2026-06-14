import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useWalletOverview, formatISK, formatISKFull } from "@/hooks/use-wallet";
import { Wallet, TrendingUp, Clock, AlertCircle, Users } from "lucide-react";
import { format } from "date-fns";
import { useCharacterView } from "@/contexts/CharacterViewContext";

interface WalletOverviewProps {
  isAuthenticated: boolean;
}

export default function WalletOverview({ isAuthenticated }: WalletOverviewProps) {
  const { viewMode } = useCharacterView();
  const { data, isLoading, isError, error } = useWalletOverview(isAuthenticated, viewMode);

  if (!isAuthenticated) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center text-center py-8">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Login with EVE Online to view your wallet data
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Wallet Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-24" />
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>Failed to load wallet data. Please try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-medium">Wallet Balance</CardTitle>
            {viewMode === "all" && (
              <Badge variant="secondary" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                All Characters
              </Badge>
            )}
          </div>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-mono font-bold isk-value" data-testid="text-wallet-balance">
            {formatISK(data.balance)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {formatISKFull(data.balance)}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Bounties</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold" data-testid="text-today-bounties">
              {formatISK(data.stats.todayTotal)}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.stats.todayCount} bounty {data.stats.todayCount === 1 ? 'payment' : 'payments'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 24 Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold" data-testid="text-24h-bounties">
              {formatISK(data.stats.last24hTotal)}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.stats.last24hCount} bounty {data.stats.last24hCount === 1 ? 'payment' : 'payments'}
            </p>
          </CardContent>
        </Card>
      </div>

      {data.recentBounties.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base font-medium">Recent Bounties</CardTitle>
            <Badge variant="secondary" className="text-xs">
              ESI Data
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recentBounties.slice(0, 10).map((bounty) => (
                <div
                  key={bounty.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  data-testid={`bounty-entry-${bounty.id}`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(bounty.date), "MMM d, HH:mm")}
                    </span>
                    <span className="text-xs text-muted-foreground/70 truncate max-w-[200px]">
                      {bounty.description}
                    </span>
                  </div>
                  <span className="font-mono text-sm font-medium isk-positive">
                    +{formatISK(bounty.amount)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data.recentBounties.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center text-center py-4">
              <p className="text-muted-foreground">
                No recent bounty payments found
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Go ratting and your bounties will appear here!
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
