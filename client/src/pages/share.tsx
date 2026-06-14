import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Clock, 
  Wallet, 
  TrendingUp, 
  Calendar,
  Award,
  Crown,
  Rocket,
  Heart,
  FlaskConical,
  Star,
  User,
  Eye,
  AlertCircle
} from "lucide-react";

interface BadgeInfo {
  type: string;
  grantedAt: string;
}

interface SessionData {
  totalIsk: number;
  duration: number;
  iskPerHour: number;
  date: string;
  kills?: number;
}

interface SharedCardData {
  cardData: {
    characterName: string;
    characterId: number;
    session: SessionData;
    badges: BadgeInfo[];
    memberSince?: string;
    isPro: boolean;
  };
  viewCount: number;
  createdAt: string;
}

function formatISK(value: number): string {
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

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatTenure(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (days < 30) {
    return `${days} days`;
  }
  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months} month${months > 1 ? "s" : ""}`;
  }
  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? "s" : ""}`;
}

const BADGE_ICONS: Record<string, typeof Crown> = {
  founder: Crown,
  early_backer: Rocket,
  donator: Heart,
  beta_tester: FlaskConical,
  supporter: Star,
};

const BADGE_COLORS: Record<string, string> = {
  founder: "from-purple-500 to-pink-500",
  early_backer: "from-amber-500 to-orange-500",
  donator: "from-red-500 to-rose-500",
  beta_tester: "from-cyan-500 to-blue-500",
  supporter: "from-yellow-500 to-amber-500",
};

const BADGE_NAMES: Record<string, string> = {
  founder: "Founder",
  early_backer: "Early Backer",
  donator: "Donator",
  beta_tester: "Beta Tester",
  supporter: "Supporter",
};

function ShareBadge({ type }: { type: string }) {
  const Icon = BADGE_ICONS[type] || Award;
  const gradient = BADGE_COLORS[type] || "from-gray-500 to-gray-600";
  const name = BADGE_NAMES[type] || type.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase());
  
  return (
    <div 
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${gradient} text-white text-sm font-medium shadow-lg`}
      data-testid={`badge-${type}`}
    >
      <Icon className="w-4 h-4" />
      <span>{name}</span>
    </div>
  );
}

export default function SharePage() {
  const [match, params] = useRoute("/share/:shareCode");
  const shareCode = params?.shareCode;

  const { data, isLoading, error } = useQuery<SharedCardData>({
    queryKey: ["/api/share", shareCode],
    enabled: !!shareCode,
  });

  useEffect(() => {
    if (data?.cardData?.characterName) {
      document.title = `${data.cardData.characterName}'s Session - PHOTON`;
    }
  }, [data]);

  if (!match) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-800/50 border-primary/20">
          <CardContent className="p-6">
            <Skeleton className="h-12 w-48 mb-4" />
            <Skeleton className="h-32 w-full mb-4" />
            <Skeleton className="h-8 w-32" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-800/50 border-destructive/20">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Session Card Not Found</h2>
            <p className="text-muted-foreground">
              This session card may have expired or does not exist.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { cardData, viewCount } = data;
  const { characterName, session, badges, memberSince, isPro } = cardData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4">
      <Card 
        className="w-full max-w-md bg-slate-800/80 border-primary/20 shadow-2xl overflow-hidden"
        data-testid="shared-session-card"
      >
        <div className="bg-gradient-to-r from-primary/20 to-accent/20 p-1" />
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center ring-2 ring-primary/30">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="font-bold text-xl text-white">{characterName}</div>
                {memberSince && (
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Member for {formatTenure(memberSince)}
                  </div>
                )}
              </div>
            </div>
            {isPro && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                <Crown className="w-3 h-3 mr-1" />
                PRO
              </Badge>
            )}
          </div>

          {badges.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {badges.map((badge, idx) => (
                <ShareBadge key={idx} type={badge.type} />
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-black/40 rounded-lg p-4 text-center border border-green-500/20">
              <Wallet className="w-6 h-6 mx-auto mb-2 text-green-400" />
              <div className="text-xl font-bold text-white font-mono">
                {formatISK(session.totalIsk)}
              </div>
              <div className="text-xs text-muted-foreground">ISK Earned</div>
            </div>
            <div className="bg-black/40 rounded-lg p-4 text-center border border-blue-500/20">
              <Clock className="w-6 h-6 mx-auto mb-2 text-blue-400" />
              <div className="text-xl font-bold text-white font-mono">
                {formatDuration(session.duration)}
              </div>
              <div className="text-xs text-muted-foreground">Duration</div>
            </div>
            <div className="bg-black/40 rounded-lg p-4 text-center border border-amber-500/20">
              <TrendingUp className="w-6 h-6 mx-auto mb-2 text-amber-400" />
              <div className="text-xl font-bold text-white font-mono">
                {formatISK(session.iskPerHour)}/hr
              </div>
              <div className="text-xs text-muted-foreground">ISK/Hour</div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-slate-700">
            <span>PHOTON - EVE Online Income Tracker</span>
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {viewCount} views
            </span>
          </div>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-sm mt-6 text-center">
        Track your own EVE Online income at{" "}
        <a href="/" className="text-primary hover:underline">PHOTON</a>
      </p>
    </div>
  );
}
