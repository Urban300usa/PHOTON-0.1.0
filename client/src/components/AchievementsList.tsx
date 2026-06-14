import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Trophy, Award, Medal, Crown, Star, Sparkles, 
  Coins, CircleDollarSign, TrendingUp, Play, 
  Zap, Moon, Sun, Lock, AlertCircle
} from "lucide-react";

interface Achievement {
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  requirement: number;
  rarity: string;
  isSecret?: boolean;
}

interface AchievementsData {
  achievements: Achievement[];
}

interface UserAchievementsData {
  earned: string[];
  progress: Record<string, number>;
}

const iconMap: Record<string, any> = {
  Play,
  Award,
  Medal,
  Trophy,
  Coins,
  CircleDollarSign,
  Crown,
  TrendingUp,
  Sparkles,
  Star,
  Zap,
  Moon,
  Sun,
};

function getRarityColor(rarity: string): string {
  switch (rarity) {
    case "common": return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    case "uncommon": return "bg-green-500/20 text-green-400 border-green-500/30";
    case "rare": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "epic": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "legendary": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    default: return "bg-muted text-muted-foreground";
  }
}

function getRarityIconGlow(rarity: string): string {
  switch (rarity) {
    case "common": return "";
    case "uncommon": return "drop-shadow-[0_0_3px_rgba(34,197,94,0.5)]";
    case "rare": return "drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]";
    case "epic": return "drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]";
    case "legendary": return "drop-shadow-[0_0_10px_rgba(245,158,11,0.7)]";
    default: return "";
  }
}

interface AchievementsListProps {
  isAuthenticated: boolean;
  isPro?: boolean;
  compact?: boolean;
}

export default function AchievementsList({ isAuthenticated, isPro = false, compact = false }: AchievementsListProps) {
  const { data: achievementsData, isLoading: achievementsLoading } = useQuery<AchievementsData>({
    queryKey: ["/api/achievements"],
    enabled: isPro,
  });

  const { data: userAchievements, isLoading: userLoading } = useQuery<UserAchievementsData>({
    queryKey: ["/api/user/achievements"],
    enabled: isAuthenticated && isPro,
  });

  const isLoading = achievementsLoading || (isAuthenticated && userLoading);
  const earnedCodes = new Set(userAchievements?.earned || []);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!achievementsData?.achievements) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[calc(100%-3rem)]">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">Unable to load achievements</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const achievements = achievementsData.achievements;
  const displayAchievements = compact ? achievements.slice(0, 5) : achievements;
  const earnedCount = achievements.filter(a => earnedCodes.has(a.code)).length;

  return (
    <Card className="h-full flex flex-col" data-testid="card-achievements">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Achievements
          </div>
          <Badge variant="secondary" className="text-xs" data-testid="badge-achievement-count">
            {earnedCount}/{achievements.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 overflow-y-auto flex-1 py-2">
        {displayAchievements.map((achievement) => {
          const IconComponent = iconMap[achievement.icon] || Trophy;
          const isEarned = earnedCodes.has(achievement.code);
          const isLocked = achievement.isSecret && !isEarned;

          return (
            <div 
              key={achievement.code}
              className={`flex items-center gap-3 p-2 rounded-md transition-colors ${
                isEarned 
                  ? "bg-muted/50" 
                  : "opacity-60 hover:opacity-80"
              }`}
              data-testid={`achievement-${achievement.code}`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                isEarned 
                  ? getRarityColor(achievement.rarity) 
                  : "bg-muted text-muted-foreground"
              }`}>
                {isLocked ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <IconComponent 
                    className={`w-4 h-4 ${isEarned ? getRarityIconGlow(achievement.rarity) : ""}`} 
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium truncate ${
                    isLocked ? "text-muted-foreground" : ""
                  }`}>
                    {isLocked ? "???" : achievement.name}
                  </span>
                  <Badge 
                    variant="outline" 
                    className={`text-[10px] px-1 py-0 ${getRarityColor(achievement.rarity)}`}
                  >
                    {achievement.rarity}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {isLocked ? "Secret achievement" : achievement.description}
                </p>
              </div>
              {isEarned && (
                <div className="flex-shrink-0">
                  <Badge 
                    variant="outline" 
                    className="bg-green-500/10 text-green-400 border-green-500/30 text-[10px] px-1.5 py-0"
                  >
                    Earned
                  </Badge>
                </div>
              )}
            </div>
          );
        })}

        {compact && achievements.length > 5 && (
          <p className="text-xs text-center text-muted-foreground pt-2">
            +{achievements.length - 5} more achievements
          </p>
        )}
      </CardContent>
    </Card>
  );
}
