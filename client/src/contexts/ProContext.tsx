import { createContext, useContext, ReactNode } from "react";
import { usePro } from "@/hooks/use-pro";

interface ProContextType {
  isPro: boolean;
  status: "active" | "expired" | "pending" | "none" | "not_authenticated";
  expiresAt: Date | null;
  isLoading: boolean;
  refetch: () => void;
  characterName?: string;
  pricing?: {
    weeklyIsk: number;
    monthlyIsk: number;
    recipientCharacterName: string;
  };
}

const ProContext = createContext<ProContextType | undefined>(undefined);

export function ProProvider({ children }: { children: ReactNode }) {
  const pro = usePro();

  const value: ProContextType = {
    isPro: pro.isPro,
    status: pro.status,
    expiresAt: pro.expiresAt,
    isLoading: pro.isLoading,
    refetch: pro.refetch,
    characterName: pro.characterName,
    pricing: pro.pricing,
  };

  return (
    <ProContext.Provider value={value}>
      {children}
    </ProContext.Provider>
  );
}

export function useProContext() {
  const context = useContext(ProContext);
  if (context === undefined) {
    throw new Error("useProContext must be used within a ProProvider");
  }
  return context;
}

export type ProFeature = 
  | "wallet_overview"
  | "draggable_tiles"
  | "export_data"
  | "advanced_stats"
  | "unlimited_history"
  | "session_kills"
  | "total_isk_stat"
  | "avg_isk_stat"
  | "total_time_stat"
  | "character_status"
  | "plex_goal"
  | "achievements";

export function isProFeature(feature: ProFeature): boolean {
  const proFeatures: ProFeature[] = [
    "wallet_overview",
    "draggable_tiles",
    "export_data",
    "advanced_stats",
    "unlimited_history",
    "session_kills",
    "total_isk_stat",
    "avg_isk_stat",
    "total_time_stat",
    "character_status",
    "plex_goal",
    "achievements",
  ];
  return proFeatures.includes(feature);
}
