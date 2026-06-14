import { useQuery, useMutation } from "@tanstack/react-query";
import { ChevronDown, Plus, Check, Crown, User, X, Users, RefreshCw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useProContext } from "@/contexts/ProContext";
import { useCharacterView } from "@/contexts/CharacterViewContext";

interface LinkedCharacterInfo {
  id: string;
  characterId: number;
  characterName: string;
  corporationId?: number;
  corporationName?: string;
  allianceId?: number;
  allianceName?: string;
  isActive: boolean;
  linkedAt: string;
  lastUsedAt?: string;
}

interface PrimaryCharacter {
  characterId: number;
  characterName: string;
  isPrimary: boolean;
  isActive: boolean;
}

interface LinkedCharactersResponse {
  primaryCharacter: PrimaryCharacter;
  linkedCharacters: LinkedCharacterInfo[];
  activeCharacterId: number;
}

interface SwitchCharacterResponse {
  success: boolean;
  activeCharacterId: number;
  characterName: string;
}

export function CharacterSwitcher() {
  const { toast } = useToast();
  const { isPro } = useProContext();
  const { viewMode, setViewMode } = useCharacterView();

  const { data: charactersData, isLoading } = useQuery<LinkedCharactersResponse>({
    queryKey: ["/api/characters/linked"],
    staleTime: 30000,
  });

  const switchMutation = useMutation({
    mutationFn: async (characterId: number) => {
      const response = await apiRequest("POST", "/api/characters/switch", { characterId });
      return await response.json() as SwitchCharacterResponse;
    },
    onSuccess: (data) => {
      toast({
        title: "Character Switched",
        description: `Now playing as ${data.characterName}`,
      });
      // Clear all cached data and force refetch to ensure character-specific data updates
      // Using refetchType: 'all' ensures active queries are immediately refetched
      queryClient.invalidateQueries({ queryKey: ["/api/characters/linked"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/status"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/overview"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/bounties"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/journal"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions/active"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions/history"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/user/my-badges"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/user/achievements"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/pro/status"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/mining"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/mining/valued"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/mining/ledger"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/loot"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/character"], refetchType: 'all' });
    },
    onError: () => {
      toast({
        title: "Switch Failed",
        description: "Could not switch character. Please try again.",
        variant: "destructive",
      });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (characterId: number) => {
      return await apiRequest("DELETE", `/api/characters/linked/${characterId}`);
    },
    onSuccess: () => {
      toast({
        title: "Character Unlinked",
        description: "The character has been removed from your account.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/characters/linked"] });
    },
    onError: () => {
      toast({
        title: "Unlink Failed",
        description: "Could not unlink character. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddCharacter = () => {
    window.location.href = "/api/auth/link-character";
  };

  const handleReauthorize = (e: React.MouseEvent, characterId: number) => {
    e.stopPropagation();
    window.location.href = `/api/auth/reauthorize/${characterId}`;
  };

  const handleSwitchCharacter = (characterId: number) => {
    if (characterId !== charactersData?.activeCharacterId && !switchMutation.isPending) {
      switchMutation.mutate(characterId);
    }
  };

  const handleUnlinkCharacter = (e: React.MouseEvent, characterId: number) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to unlink this character?")) {
      unlinkMutation.mutate(characterId);
    }
  };

  if (isLoading || !charactersData) {
    return null;
  }

  const { primaryCharacter, linkedCharacters, activeCharacterId } = charactersData;
  const hasLinkedCharacters = linkedCharacters.length > 0;
  const totalCharacters = linkedCharacters.length + 1;

  const activeChar = activeCharacterId === primaryCharacter.characterId
    ? { characterId: primaryCharacter.characterId, characterName: primaryCharacter.characterName, isPrimary: true }
    : linkedCharacters.find(c => c.characterId === activeCharacterId) || primaryCharacter;

  const allCharacters = [
    { ...primaryCharacter, isPrimary: true },
    ...linkedCharacters.map(c => ({ ...c, isPrimary: false })),
  ];

  const handleViewModeChange = (checked: boolean) => {
    setViewMode(checked ? "all" : "single");
    // Force refetch all character-specific data when toggling view mode
    queryClient.invalidateQueries({ queryKey: ["/api/wallet"], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ["/api/wallet/bounties"], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ["/api/wallet/overview"], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ["/api/sessions"], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ["/api/sessions/active"], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ["/api/sessions/history"], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ["/api/mining"], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ["/api/mining/valued"], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ["/api/mining/ledger"], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ["/api/character"], refetchType: 'all' });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="w-full justify-between gap-2 p-2 h-auto"
          data-testid="button-character-switcher"
        >
          <div className="flex items-center gap-2 min-w-0">
            {viewMode === "all" && hasLinkedCharacters ? (
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-primary" />
              </div>
            ) : (
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarImage 
                  src={`https://images.evetech.net/characters/${activeChar.characterId}/portrait?size=64`}
                  alt={activeChar.characterName}
                />
                <AvatarFallback>
                  <User className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>
            )}
            <div className="flex flex-col items-start min-w-0 group-data-[collapsible=icon]:hidden">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium truncate max-w-[120px]" data-testid="text-active-character-name">
                  {viewMode === "all" && hasLinkedCharacters ? "All Characters" : activeChar.characterName}
                </span>
                {isPro && <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />}
              </div>
              {hasLinkedCharacters && (
                <span className="text-xs text-muted-foreground">
                  {viewMode === "all" ? `Viewing ${totalCharacters} combined` : `${totalCharacters} characters`}
                </span>
              )}
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 group-data-[collapsible=icon]:hidden" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px]" data-testid="dropdown-character-switcher">
        {hasLinkedCharacters && (
          <>
            <div className="px-3 py-2 flex items-center justify-between">
              <Label htmlFor="view-all-toggle" className="text-xs font-medium cursor-pointer">
                View All Combined
              </Label>
              <Switch
                id="view-all-toggle"
                checked={viewMode === "all"}
                onCheckedChange={handleViewModeChange}
                data-testid="switch-view-all"
              />
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          {viewMode === "all" ? "Switch to Single Character" : "Your Characters"}
        </div>
        
        {allCharacters.map((char) => {
          const isActive = char.characterId === activeCharacterId;
          return (
            <DropdownMenuItem
              key={char.characterId}
              className="flex items-center justify-between gap-2 cursor-pointer"
              onClick={() => handleSwitchCharacter(char.characterId)}
              data-testid={`menuitem-character-${char.characterId}`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Avatar className="w-7 h-7 flex-shrink-0">
                  <AvatarImage 
                    src={`https://images.evetech.net/characters/${char.characterId}/portrait?size=64`}
                    alt={char.characterName}
                  />
                  <AvatarFallback>
                    <User className="w-3 h-3" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm truncate">{char.characterName}</span>
                  {char.isPrimary && (
                    <span className="text-xs text-muted-foreground">Primary</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {isActive && <Check className="w-4 h-4 text-primary" />}
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-6 h-6"
                  onClick={(e) => handleReauthorize(e, char.characterId)}
                  title="Refresh ESI permissions"
                  data-testid={`button-reauth-${char.characterId}`}
                >
                  <RefreshCw className="w-3 h-3 text-muted-foreground" />
                </Button>
                {!char.isPrimary && !isActive && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6"
                    onClick={(e) => handleUnlinkCharacter(e, char.characterId)}
                    data-testid={`button-unlink-${char.characterId}`}
                  >
                    <X className="w-3 h-3 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          className="flex items-center gap-2 cursor-pointer"
          onClick={handleAddCharacter}
          data-testid="menuitem-add-character"
        >
          <div className="w-7 h-7 rounded-full border border-dashed border-muted-foreground flex items-center justify-center">
            <Plus className="w-4 h-4 text-muted-foreground" />
          </div>
          <span className="text-sm">Add Character</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
