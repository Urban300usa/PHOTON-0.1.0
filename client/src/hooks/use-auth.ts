import { useQuery, useQueryClient } from "@tanstack/react-query";

interface AuthStatus {
  authenticated: boolean;
  character?: {
    id: number;
    name: string;
    corporationId?: number | null;
    corporationName?: string | null;
    allianceId?: number | null;
    allianceName?: string | null;
  };
  isAdmin?: boolean;
}

export function useAuth() {
  const queryClient = useQueryClient();
  
  const { data: authStatus, isLoading, refetch } = useQuery<AuthStatus>({
    queryKey: ["/api/auth/status"],
    refetchOnWindowFocus: true,
    staleTime: 30000,
  });

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pro/status"] });
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return {
    isAuthenticated: authStatus?.authenticated ?? false,
    character: authStatus?.character ?? null,
    isAdmin: authStatus?.isAdmin ?? false,
    isLoading,
    refetch,
    logout,
  };
}
