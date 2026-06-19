import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Star, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/PageHeader";

interface LoyaltyPoint {
  corporationId: number;
  corporationName: string;
  points: number;
}

interface LoyaltyData {
  loyaltyPoints: LoyaltyPoint[];
}

function formatLP(n: number): string {
  return n.toLocaleString() + " LP";
}

export default function LoyaltyPointsPage() {
  const { isAuthenticated } = useAuth();

  const { data, isLoading, isError } = useQuery<LoyaltyData>({
    queryKey: ["/api/character/loyalty"],
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  const loyaltyPoints = (data?.loyaltyPoints ?? []).sort((a, b) => b.points - a.points);
  const totalLP = loyaltyPoints.reduce((sum, lp) => sum + lp.points, 0);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="border-dashed max-w-md">
          <CardContent className="pt-6 text-center">
            <Star className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Loyalty Points</h2>
            <p className="text-muted-foreground">Login with EVE Online to view your loyalty points.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[900px] mx-auto">
      <PageHeader icon={Star} title="Loyalty Points" subtitle="LP balance across all NPC corporations" />

      {/* Total LP Card */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm text-muted-foreground font-normal flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 text-yellow-400" />
            Total Loyalty Points
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-9 w-48" />
          ) : (
            <p className="text-3xl font-bold text-yellow-400">{formatLP(totalLP)}</p>
          )}
          {!isLoading && (
            <p className="text-sm text-muted-foreground mt-1">
              Across {loyaltyPoints.length} corporation{loyaltyPoints.length !== 1 ? "s" : ""}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Corporation</TableHead>
                <TableHead className="text-right">LP Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-8">
                    <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                    <p className="text-muted-foreground">Failed to load loyalty points.</p>
                  </TableCell>
                </TableRow>
              ) : loyaltyPoints.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-10">
                    <Star className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                    <p className="text-muted-foreground">No loyalty points found.</p>
                  </TableCell>
                </TableRow>
              ) : (
                loyaltyPoints.map((lp) => (
                  <TableRow key={lp.corporationId}>
                    <TableCell className="font-medium">
                      {lp.corporationName || `Corporation ${lp.corporationId}`}
                    </TableCell>
                    <TableCell className="text-right font-mono text-yellow-400 font-medium">
                      {formatLP(lp.points)}
                    </TableCell>
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
