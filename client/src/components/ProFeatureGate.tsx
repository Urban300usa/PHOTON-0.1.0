import { ReactNode } from "react";
import { useProContext, ProFeature } from "@/contexts/ProContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Crown } from "lucide-react";

interface ProFeatureGateProps {
  feature: ProFeature;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
  className?: string;
}

export function ProFeatureGate({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
  className,
}: ProFeatureGateProps) {
  const { isPro, isLoading } = useProContext();

  if (isLoading) {
    return (
      <div className={`animate-pulse bg-muted/50 rounded-md ${className}`}>
        {fallback}
      </div>
    );
  }

  if (isPro) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  return (
    <ProLockedOverlay feature={feature} className={className} />
  );
}

interface ProLockedOverlayProps {
  feature: ProFeature;
  className?: string;
}

function getFeatureLabel(feature: ProFeature): string {
  const labels: Record<ProFeature, string> = {
    wallet_overview: "Wallet Overview",
    draggable_tiles: "Customizable Dashboard",
    export_data: "Data Export",
    advanced_stats: "Advanced Statistics",
    unlimited_history: "Unlimited History",
    session_kills: "Kill Tracking",
    total_isk_stat: "Total ISK Stats",
    avg_isk_stat: "Average ISK Stats",
    total_time_stat: "Total Time Stats",
    character_status: "Character Status",
    plex_goal: "PLEX Goal Tracker",
    achievements: "Achievements",
  };
  return labels[feature] || feature;
}

export function ProLockedOverlay({ feature, className }: ProLockedOverlayProps) {
  return (
    <Card className={`relative overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/90 to-background/80 backdrop-blur-sm z-10" />
      <CardContent className="relative z-20 flex flex-col items-center justify-center h-full min-h-[120px] p-4 gap-3">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-muted-foreground" />
          <Badge variant="outline" className="gap-1 bg-amber-500/10 border-amber-500/30 text-amber-400">
            <Crown className="w-3 h-3" />
            PRO
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground text-center">
          {getFeatureLabel(feature)} requires PRO
        </p>
      </CardContent>
    </Card>
  );
}

export function ProBadge({ className }: { className?: string }) {
  const { isPro, expiresAt } = useProContext();

  if (!isPro) return null;

  const daysLeft = expiresAt 
    ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <Badge 
      variant="outline" 
      className={`gap-1 bg-amber-500/10 border-amber-500/30 text-amber-400 ${className}`}
      data-testid="badge-pro-status"
    >
      <Crown className="w-3 h-3" />
      PRO
      {daysLeft !== null && daysLeft <= 7 && (
        <span className="text-xs opacity-75">({daysLeft}d)</span>
      )}
    </Badge>
  );
}

export function StandardBadge({ className }: { className?: string }) {
  return (
    <Badge 
      variant="secondary" 
      className={`gap-1 ${className}`}
      data-testid="badge-standard-status"
    >
      Standard
    </Badge>
  );
}
