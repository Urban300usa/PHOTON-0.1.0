import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import type { CharacterViewMode } from "@/contexts/CharacterViewContext";

interface WalletBounty {
  id: number;
  date: string;
  amount: number;
  description: string;
  characterId?: number;
}

interface WalletStats {
  todayTotal: number;
  todayCount: number;
  last24hTotal: number;
  last24hCount: number;
}

interface CharacterBreakdown {
  characterId: number;
  characterName: string;
  bountyCount: number;
  totalBounties: number;
}

interface WalletOverview {
  characterId: number;
  characterName: string;
  balance: number;
  recentBounties: WalletBounty[];
  stats: WalletStats;
  viewAll?: boolean;
  characterBreakdown?: CharacterBreakdown[];
}

interface BountiesResponse {
  bounties: WalletBounty[];
  summary: {
    totalBounties: number;
    bountyCount: number;
  };
  viewAll: boolean;
  characterBreakdown?: CharacterBreakdown[];
}

export function useWalletOverview(isAuthenticated: boolean = false, viewMode: CharacterViewMode = "single") {
  const viewAll = viewMode === "all";
  return useQuery<WalletOverview>({
    queryKey: ["/api/wallet/overview", { viewAll }],
    queryFn: async () => {
      const response = await fetch(`/api/wallet/overview${viewAll ? "?viewAll=true" : ""}`);
      if (!response.ok) {
        throw new Error(`${response.status}`);
      }
      return response.json();
    },
    enabled: isAuthenticated,
    refetchInterval: isAuthenticated ? 60000 : false,
    staleTime: 30000,
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.message?.includes("401")) {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
        return false;
      }
      return failureCount < 3;
    },
  });
}

export function useWalletBounties(isAuthenticated: boolean = false, viewMode: CharacterViewMode = "single") {
  const viewAll = viewMode === "all";
  return useQuery<BountiesResponse>({
    queryKey: ["/api/wallet/bounties", { viewAll }],
    queryFn: async () => {
      const response = await fetch(`/api/wallet/bounties${viewAll ? "?viewAll=true" : ""}`);
      if (!response.ok) {
        throw new Error(`${response.status}`);
      }
      return response.json();
    },
    enabled: isAuthenticated,
    refetchInterval: isAuthenticated ? 60000 : false,
    staleTime: 30000,
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.message?.includes("401")) {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
        return false;
      }
      return failureCount < 3;
    },
  });
}

export function useWalletBalance(isAuthenticated: boolean = false) {
  return useQuery<{ balance: number }>({
    queryKey: ["/api/wallet/balance"],
    enabled: isAuthenticated,
    refetchInterval: isAuthenticated ? 60000 : false,
    staleTime: 30000,
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.message?.includes("401")) {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
        return false;
      }
      return failureCount < 3;
    },
  });
}

export function formatISK(value: number): string {
  if (value >= 1000000000) {
    return (value / 1000000000).toFixed(2) + "B";
  }
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + "M";
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + "K";
  }
  return value.toLocaleString();
}

export function formatISKFull(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " ISK";
}
