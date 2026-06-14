import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, ChevronDown, Crown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useProContext } from "@/contexts/ProContext";

interface EsiLoginButtonProps {
  onLogout?: () => void;
}

export default function EsiLoginButton({ onLogout }: EsiLoginButtonProps) {
  const { isAuthenticated, character, isLoading, logout } = useAuth();
  const { isPro } = useProContext();

  const handleLogout = async () => {
    await logout();
    onLogout?.();
  };

  if (isLoading) {
    return (
      <Button variant="secondary" disabled data-testid="button-login-loading">
        <User className="w-4 h-4 mr-2" />
        Loading...
      </Button>
    );
  }

  if (isAuthenticated && character) {
    const characterId = character.id;
    const characterName = character.name;
    const avatarUrl = `https://images.evetech.net/characters/${characterId}/portrait?size=64`;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="secondary" 
            className={`gap-2 ${
              isPro 
                ? "bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-2 border-amber-500/50 hover:from-amber-500/30 hover:to-yellow-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]" 
                : ""
            }`}
            data-testid="button-character-menu"
          >
            <div className="relative">
              <Avatar className={`w-6 h-6 ${isPro ? "ring-2 ring-amber-400/70" : ""}`}>
                <AvatarImage src={avatarUrl} alt={characterName} />
                <AvatarFallback>{characterName.charAt(0)}</AvatarFallback>
              </Avatar>
              {isPro && (
                <Crown className="w-3 h-3 text-amber-400 absolute -top-1 -right-1" />
              )}
            </div>
            <span className={`hidden sm:inline max-w-32 truncate ${isPro ? "text-amber-100" : ""}`}>
              {characterName}
            </span>
            <ChevronDown className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem 
            onClick={handleLogout}
            className="cursor-pointer"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return null;
}
