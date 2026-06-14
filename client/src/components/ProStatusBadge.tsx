import { Crown, Sparkles, Clock, AlertTriangle, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePro } from "@/hooks/use-pro";

interface ProStatusBadgeProps {
  onClick?: () => void;
}

function formatTimeRemaining(expiresAt: Date | null): { text: string; isLow: boolean; hoursLeft: number } {
  if (!expiresAt) return { text: "Unknown", isLow: false, hoursLeft: 0 };
  
  const now = Date.now();
  const diff = expiresAt.getTime() - now;
  
  if (diff <= 0) return { text: "Expired", isLow: true, hoursLeft: 0 };
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  
  const isLow = days < 3;
  
  if (days > 0) {
    return { 
      text: `${days} day${days !== 1 ? 's' : ''} ${remainingHours}h remaining`, 
      isLow, 
      hoursLeft: hours 
    };
  }
  
  return { 
    text: `${hours} hour${hours !== 1 ? 's' : ''} remaining`, 
    isLow, 
    hoursLeft: hours 
  };
}

export default function ProStatusBadge({ onClick }: ProStatusBadgeProps) {
  const { isPro, status, expiresAt } = usePro();

  if (isPro) {
    const { text: timeRemaining, isLow, hoursLeft } = formatTimeRemaining(expiresAt);
    const daysLeft = Math.floor(hoursLeft / 24);

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`gap-1.5 relative ${
              isLow 
                ? "bg-orange-500/20 border border-orange-500/50 text-orange-400 hover:bg-orange-500/30" 
                : "bg-amber-500/20 border border-amber-500/50 text-amber-400 hover:bg-amber-500/30"
            }`}
            data-testid="button-pro-menu"
          >
            <Crown className="w-4 h-4" />
            <span className="font-medium">PRO</span>
            {hoursLeft > 0 && (
              <span className="text-xs opacity-80">
                ({daysLeft > 0 ? `${daysLeft}d` : `${hoursLeft}h`})
              </span>
            )}
            <ChevronDown className="w-3 h-3 ml-0.5" />
            {isLow && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" data-testid="pro-menu-dropdown">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400" />
            PRO Subscription
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="px-2 py-2">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className={isLow ? "text-orange-400 font-medium" : "text-foreground"}>
                {timeRemaining}
              </span>
            </div>
            {isLow && (
              <div className="flex items-center gap-2 mt-2 text-xs text-orange-400 bg-orange-500/10 rounded-md p-2">
                <AlertTriangle className="w-3 h-3" />
                <span>Your PRO subscription is expiring soon!</span>
              </div>
            )}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={onClick}
            className="cursor-pointer"
            data-testid="menu-item-manage-pro"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Manage Subscription
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
      onClick={onClick}
      data-testid="button-upgrade-pro"
    >
      <Sparkles className="w-4 h-4" />
      <span>Upgrade to PRO</span>
    </Button>
  );
}
