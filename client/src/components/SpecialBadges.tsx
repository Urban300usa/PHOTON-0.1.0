import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Rocket, 
  Crown, 
  Heart, 
  FlaskConical, 
  Star,
  Award,
  Sparkles
} from "lucide-react";

interface SpecialBadgeInfo {
  id: string;
  characterId: number;
  characterName: string;
  badgeType: string;
  grantedAt: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  rarity: string;
}

const iconMap: Record<string, typeof Rocket> = {
  Rocket,
  Crown,
  Heart,
  FlaskConical,
  Star,
  Award,
};

const rarityColors: Record<string, string> = {
  common: "border-gray-400",
  uncommon: "border-green-500",
  rare: "border-blue-500",
  epic: "border-purple-500",
  legendary: "border-amber-500",
};

const rarityGlow: Record<string, string> = {
  common: "",
  uncommon: "shadow-green-500/20",
  rare: "shadow-blue-500/30",
  epic: "shadow-purple-500/40",
  legendary: "shadow-amber-500/60 shadow-lg",
};

interface SpecialBadgesProps {
  compact?: boolean;
  showTitle?: boolean;
}

export default function SpecialBadges({ compact = false, showTitle = true }: SpecialBadgesProps) {
  const { data, isLoading } = useQuery<{ badges: SpecialBadgeInfo[] }>({
    queryKey: ["/api/user/my-badges"],
  });

  const badges = data?.badges || [];

  if (isLoading) {
    return (
      <div className="flex gap-2">
        <Skeleton className="w-10 h-10 rounded-full" />
        <Skeleton className="w-10 h-10 rounded-full" />
      </div>
    );
  }

  if (badges.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {badges.map((badge) => {
          const IconComponent = iconMap[badge.icon] || Star;
          return (
            <Tooltip key={badge.id}>
              <TooltipTrigger asChild>
                <div
                  className={`
                    relative flex items-center justify-center
                    w-8 h-8 rounded-full
                    bg-gradient-to-br ${badge.color}
                    border-2 ${rarityColors[badge.rarity]}
                    shadow-lg ${rarityGlow[badge.rarity]}
                    cursor-pointer transition-transform hover:scale-110
                  `}
                  data-testid={`badge-compact-${badge.badgeType}`}
                >
                  <IconComponent className="w-4 h-4 text-white drop-shadow-md" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="text-center">
                  <p className="font-bold">{badge.name}</p>
                  <p className="text-xs text-muted-foreground">{badge.description}</p>
                  <p className="text-xs text-muted-foreground mt-1 capitalize">
                    {badge.rarity} Badge
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  }

  return (
    <Card className="overflow-visible" data-testid="special-badges-card">
      {showTitle && (
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Special Badges
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={showTitle ? "" : "pt-4"}>
        <div className="flex flex-wrap gap-3">
          {badges.map((badge) => {
            const IconComponent = iconMap[badge.icon] || Star;
            return (
              <Tooltip key={badge.id}>
                <TooltipTrigger asChild>
                  <div
                    className={`
                      relative flex flex-col items-center gap-1.5
                      p-3 rounded-lg
                      bg-gradient-to-br ${badge.color}
                      border-2 ${rarityColors[badge.rarity]}
                      shadow-xl ${rarityGlow[badge.rarity]}
                      cursor-pointer transition-all duration-200
                      hover:scale-105 hover:shadow-2xl
                    `}
                    data-testid={`badge-full-${badge.badgeType}`}
                  >
                    <div className="relative">
                      <IconComponent className="w-8 h-8 text-white drop-shadow-lg" />
                      {badge.rarity === "legendary" && (
                        <div className="absolute -top-1 -right-1">
                          <Sparkles className="w-4 h-4 text-yellow-200 drop-shadow-[0_0_4px_rgba(253,224,71,0.8)]" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-bold text-white drop-shadow-md whitespace-nowrap">
                      {badge.name}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="text-center">
                    <p className="font-bold">{badge.name}</p>
                    <p className="text-sm text-muted-foreground">{badge.description}</p>
                    <p className="text-xs text-muted-foreground mt-2 capitalize">
                      {badge.rarity} Badge
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Granted {new Date(badge.grantedAt).toLocaleDateString()}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function SpecialBadgesInline({ characterId }: { characterId?: number }) {
  const { data, isLoading } = useQuery<{ badges: SpecialBadgeInfo[] }>({
    queryKey: characterId 
      ? ["/api/user/special-badges", characterId]
      : ["/api/user/my-badges"],
    enabled: characterId !== undefined || true,
  });

  const badges = data?.badges || [];

  if (isLoading || badges.length === 0) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-1">
      {badges.slice(0, 5).map((badge) => {
        const IconComponent = iconMap[badge.icon] || Star;
        return (
          <Tooltip key={badge.id}>
            <TooltipTrigger asChild>
              <div
                className={`
                  flex items-center justify-center
                  w-6 h-6 rounded-full
                  bg-gradient-to-br ${badge.color}
                  border ${rarityColors[badge.rarity]}
                  shadow ${rarityGlow[badge.rarity]}
                `}
                data-testid={`badge-inline-${badge.badgeType}`}
              >
                <IconComponent className="w-3 h-3 text-white" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="font-medium">{badge.name}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
      {badges.length > 5 && (
        <Badge variant="secondary" className="text-xs px-1.5">
          +{badges.length - 5}
        </Badge>
      )}
    </div>
  );
}
