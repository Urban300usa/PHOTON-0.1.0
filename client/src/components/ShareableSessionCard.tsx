import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { 
  Share2, 
  Copy, 
  Check, 
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
  User
} from "lucide-react";

interface SessionData {
  totalIsk: number;
  duration: number;
  iskPerHour: number;
  date: Date;
  kills?: number;
}

interface BadgeInfo {
  type: string;
  grantedAt: string;
}

interface ShareableCardData {
  characterName: string;
  characterId: number;
  session: SessionData;
  badges: BadgeInfo[];
  memberSince?: string;
  isPro: boolean;
}

interface ShareableSessionCardProps {
  sessionData?: SessionData;
  onShare?: (shareCode: string) => void;
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

function MiniShareBadge({ type }: { type: string }) {
  const Icon = BADGE_ICONS[type] || Award;
  const gradient = BADGE_COLORS[type] || "from-gray-500 to-gray-600";
  
  return (
    <div 
      className={`w-6 h-6 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}
      title={type.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
    >
      <Icon className="w-3 h-3 text-white" />
    </div>
  );
}

export default function ShareableSessionCard({ sessionData, onShare }: ShareableSessionCardProps) {
  const { toast } = useToast();
  const { character, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const { data: profileData } = useQuery<{ 
    profile: { 
      firstLoginAt?: string;
      characterName?: string;
      characterId?: number;
    };
    isPro: boolean;
  }>({
    queryKey: ["/api/user/profile"],
    enabled: isAuthenticated,
  });

  const { data: badgesData } = useQuery<{ badges: BadgeInfo[] }>({
    queryKey: ["/api/user/my-badges"],
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <Button variant="outline" size="sm" disabled data-testid="button-share-session-disabled">
        <Share2 className="w-4 h-4 mr-2" />
        Login to Share
      </Button>
    );
  }

  const badges = badgesData?.badges || [];
  const memberSince = profileData?.profile?.firstLoginAt;
  const isPro = profileData?.isPro || false;
  const characterName = profileData?.profile?.characterName || character?.name || "Capsuleer";

  const handleGenerateLink = async () => {
    if (!sessionData) {
      toast({
        title: "No Session Data",
        description: "Start a session first to share your stats.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const cardData: ShareableCardData = {
        characterName,
        characterId: profileData?.profile?.characterId || 0,
        session: sessionData,
        badges: badges.map(b => ({ type: b.type, grantedAt: b.grantedAt })),
        memberSince,
        isPro,
      };

      const response = await apiRequest("POST", "/api/session-cards", { cardData });

      const data = await response.json();
      const link = `${window.location.origin}/share/${data.shareCode}`;
      setShareLink(link);
      onShare?.(data.shareCode);
      
      toast({
        title: "Share Link Created",
        description: "Your session card link is ready to share!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate share link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;
    
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied!",
        description: "Share link copied to clipboard.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy link.",
        variant: "destructive",
      });
    }
  };

  const currentSession = sessionData || {
    totalIsk: 0,
    duration: 0,
    iskPerHour: 0,
    date: new Date(),
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-share-session">
          <Share2 className="w-4 h-4 mr-2" />
          Share Session
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Your Session</DialogTitle>
          <DialogDescription>
            Generate a shareable card showcasing your ratting session stats and achievements.
          </DialogDescription>
        </DialogHeader>

        <div 
          ref={cardRef}
          className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-lg p-4 border border-primary/20 shadow-xl"
          data-testid="shareable-card-preview"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="font-bold text-white">{characterName}</div>
                {memberSince && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Member for {formatTenure(memberSince)}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-1">
              {badges.slice(0, 3).map((badge, idx) => (
                <MiniShareBadge key={idx} type={badge.type} />
              ))}
              {isPro && (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                  <Crown className="w-3 h-3 mr-1" />
                  PRO
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-black/30 rounded-md p-3">
              <Wallet className="w-5 h-5 mx-auto mb-1 text-green-400" />
              <div className="text-lg font-bold text-white font-mono">
                {formatISK(currentSession.totalIsk)}
              </div>
              <div className="text-xs text-muted-foreground">ISK Earned</div>
            </div>
            <div className="bg-black/30 rounded-md p-3">
              <Clock className="w-5 h-5 mx-auto mb-1 text-blue-400" />
              <div className="text-lg font-bold text-white font-mono">
                {formatDuration(currentSession.duration)}
              </div>
              <div className="text-xs text-muted-foreground">Duration</div>
            </div>
            <div className="bg-black/30 rounded-md p-3">
              <TrendingUp className="w-5 h-5 mx-auto mb-1 text-amber-400" />
              <div className="text-lg font-bold text-white font-mono">
                {formatISK(currentSession.iskPerHour)}/hr
              </div>
              <div className="text-xs text-muted-foreground">ISK/Hour</div>
            </div>
          </div>

          <div className="mt-3 text-center text-xs text-muted-foreground">
            PHOTON - EVE Online Income Tracker
          </div>
        </div>

        <div className="space-y-3 mt-4">
          {shareLink ? (
            <div className="flex gap-2">
              <Input 
                value={shareLink} 
                readOnly 
                className="flex-1 text-sm"
                data-testid="input-share-link"
              />
              <Button 
                size="icon" 
                onClick={handleCopyLink}
                data-testid="button-copy-link"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          ) : (
            <Button 
              onClick={handleGenerateLink} 
              disabled={isGenerating || !sessionData}
              className="w-full"
              data-testid="button-generate-link"
            >
              {isGenerating ? (
                "Generating..."
              ) : (
                <>
                  <Share2 className="w-4 h-4 mr-2" />
                  Generate Share Link
                </>
              )}
            </Button>
          )}
          
          {!sessionData && (
            <p className="text-sm text-muted-foreground text-center">
              Complete a session to share your stats!
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
