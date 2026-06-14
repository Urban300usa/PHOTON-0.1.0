import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Crosshair,
  Pickaxe,
  Factory,
  Globe2,
  Package,
  FileText,
  Shield,
  Settings,
  Crown,
  LogOut,
  User,
  Rocket,
  Heart,
  FlaskConical,
  Star,
  Award,
  Gem,
  Video,
  Building2,
  ChevronsUp,
  Trophy,
  HandHelping,
  Flag,
  Download,
  HelpCircle,
  Sparkles,
  GraduationCap,
  ShoppingCart,
  Navigation2,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import photonLogo from "@assets/lucid-origin_Futuristic_app_icon_glowing_energy_sphere_electri_1764963358793.jpg";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useProContext } from "@/contexts/ProContext";
import { useSidebarActions } from "@/contexts/SidebarActionsContext";
import { useToast } from "@/hooks/use-toast";
import { BADGE_RARITY_COLORS, type BadgeRarity } from "@shared/schema";
import { CharacterSwitcher } from "@/components/CharacterSwitcher";
import { useWhatsNew } from "@/contexts/WhatsNewContext";
import { useHasUnseenChangelog } from "@/components/WhatsNewDialog";

interface BadgeInfo {
  type: string;
  grantedAt: string;
  name?: string;
  icon?: string;
  rarity?: string;
}

interface NotificationCount {
  count: number;
}

const BADGE_ICONS: Record<string, typeof Crown> = {
  founder: Crown,
  early_backer: Rocket,
  donator: Heart,
  beta_tester: FlaskConical,
  supporter: Star,
  vip: Gem,
  content_creator: Video,
  corp_leader: Building2,
  fleet_commander: ChevronsUp,
  ratting_elite: Trophy,
  community_helper: HandHelping,
  event_winner: Award,
  alliance_member: Flag,
};

const BADGE_GRADIENTS: Record<string, string> = {
  founder: "from-purple-400 to-pink-500",
  early_backer: "from-amber-400 to-orange-500",
  donator: "from-red-400 to-rose-500",
  beta_tester: "from-cyan-400 to-blue-500",
  supporter: "from-yellow-400 to-amber-500",
  vip: "from-yellow-300 to-amber-600",
  content_creator: "from-violet-400 to-purple-600",
  corp_leader: "from-slate-400 to-zinc-600",
  fleet_commander: "from-red-500 to-orange-600",
  ratting_elite: "from-emerald-400 to-green-600",
  community_helper: "from-teal-400 to-cyan-600",
  event_winner: "from-amber-400 to-yellow-600",
  alliance_member: "from-blue-400 to-indigo-600",
};

function MiniCharacterBadge({ badge }: { badge: BadgeInfo }) {
  const Icon = BADGE_ICONS[badge.type] || Award;
  const gradient = BADGE_GRADIENTS[badge.type] || "from-gray-400 to-gray-600";
  const badgeName = badge.name || badge.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div 
          className={`w-6 h-6 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md cursor-help`}
          data-testid={`mini-badge-${badge.type}`}
        >
          <Icon className="w-3 h-3 text-white" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <span className="font-medium">{badgeName}</span>
      </TooltipContent>
    </Tooltip>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { character, isAdmin, isAuthenticated, logout } = useAuth();
  const { isPro } = useProContext();
  const { toast } = useToast();
  const { 
    setProModalOpen, 
    triggerExport
  } = useSidebarActions();
  const { openWhatsNew } = useWhatsNew();
  const hasUnseenChangelog = useHasUnseenChangelog();

  const { data: badgesData, isLoading: badgesLoading } = useQuery<{ badges: BadgeInfo[] }>({
    queryKey: ["/api/user/my-badges"],
    enabled: isAuthenticated,
  });

  // Query for support notification count
  const { data: notificationData } = useQuery<NotificationCount>({
    queryKey: ["/api/support/notifications/count"],
    enabled: isAuthenticated,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const unreadCount = notificationData?.count || 0;

  const navItems = [
    {
      title: "Ratting Tracker",
      url: "/",
      icon: Crosshair,
      isActive: location === "/",
      badge: 0,
    },
    {
      title: "Mining Tracker",
      url: "/mining",
      icon: Pickaxe,
      isActive: location === "/mining",
      badge: 0,
    },
    {
      title: "Industry Jobs",
      url: "/industry",
      icon: Factory,
      isActive: location === "/industry",
      badge: 0,
    },
    {
      title: "Planetary",
      url: "/planetary",
      icon: Globe2,
      isActive: location === "/planetary",
      badge: 0,
    },
    {
      title: "Assets",
      url: "/assets",
      icon: Package,
      isActive: location === "/assets",
      badge: 0,
    },
    {
      title: "Contracts",
      url: "/contracts",
      icon: FileText,
      isActive: location === "/contracts",
      badge: 0,
    },
    {
      title: "Skills",
      url: "/skills",
      icon: GraduationCap,
      isActive: location === "/skills",
      badge: 0,
    },
    {
      title: "Market",
      url: "/market",
      icon: ShoppingCart,
      isActive: location === "/market",
      badge: 0,
    },
    {
      title: "Market Intel",
      url: "/market-intel",
      icon: TrendingUp,
      isActive: location === "/market-intel",
      badge: 0,
    },
    {
      title: "Jump Planner",
      url: "/jump-planner",
      icon: Navigation2,
      isActive: location === "/jump-planner",
      badge: 0,
    },
    {
      title: "Analytics",
      url: "/analytics",
      icon: BarChart3,
      isActive: location === "/analytics",
      badge: 0,
    },
    {
      title: "Support",
      url: "/support",
      icon: HelpCircle,
      isActive: location === "/support",
      badge: unreadCount,
    },
    ...(isAdmin ? [{
      title: "Admin",
      url: "/admin",
      icon: Shield,
      isActive: location === "/admin",
      badge: 0,
    }] : []),
  ];

  const topBadges = (badgesData?.badges || []).slice(0, 3);

  const handleLogout = () => {
    logout();
  };

  const handleOpenPro = () => {
    setProModalOpen(true);
  };

  const handleOpenExport = () => {
    if (isPro) {
      triggerExport();
      toast({
        title: "Exporting Data",
        description: "Your session data will be downloaded shortly.",
      });
    } else {
      setProModalOpen(true);
    }
  };

  return (
    <Sidebar side="left" collapsible="icon" data-testid="app-sidebar-left">
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2">
            <img 
              src={photonLogo} 
              alt="PHOTON" 
              className="w-8 h-8 rounded-lg flex-shrink-0 object-cover"
              data-testid="img-sidebar-logo"
            />
            <span className="font-bold text-lg" data-testid="text-sidebar-title">
              PHOTON
            </span>
          </div>
          <SidebarTrigger data-testid="button-sidebar-collapse" />
        </div>
        <div className="hidden group-data-[collapsible=icon]:flex flex-col items-center gap-2">
          <img 
            src={photonLogo} 
            alt="PHOTON" 
            className="w-8 h-8 rounded-lg object-cover"
            data-testid="img-sidebar-logo-collapsed"
          />
          <SidebarTrigger data-testid="button-sidebar-expand" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={item.isActive}
                    tooltip={item.badge > 0 ? `${item.title} (${item.badge} new)` : item.title}
                  >
                    <Link href={item.url} data-testid={`nav-link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <div className="relative">
                        <item.icon className="w-4 h-4" />
                        {item.badge > 0 && (
                          <span 
                            className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold"
                            data-testid={`badge-${item.title.toLowerCase().replace(/\s+/g, '-')}-count`}
                          >
                            {item.badge > 99 ? "99+" : item.badge}
                          </span>
                        )}
                      </div>
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Features</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={handleOpenPro}
                  tooltip={isPro ? "PRO Active" : "Upgrade to PRO"}
                  data-testid="sidebar-button-pro"
                >
                  {isPro ? (
                    <Crown className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Star className="w-4 h-4" />
                  )}
                  <span className="flex items-center gap-2">
                    {isPro ? "PRO Active" : "Upgrade to PRO"}
                    {isPro && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 bg-amber-500/20 text-amber-400 border-amber-500/30">
                        PRO
                      </Badge>
                    )}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={handleOpenExport}
                  tooltip={isPro ? "Export Data" : "Export Data (PRO)"}
                  data-testid="sidebar-button-export"
                >
                  <Download className="w-4 h-4" />
                  <span className="flex items-center gap-2">
                    Export Data
                    {!isPro && (
                      <Crown className="w-3 h-3 text-amber-400" />
                    )}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild
                  tooltip="Settings"
                  data-testid="sidebar-button-settings"
                >
                  <Link href="/settings">
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      <SidebarFooter className="p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={openWhatsNew}
          className={`w-full justify-start gap-2 mb-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2 relative overflow-visible ${
            hasUnseenChangelog 
              ? "text-primary animate-pulse" 
              : ""
          }`}
          data-testid="button-whats-new"
        >
          <span className={`relative ${hasUnseenChangelog ? "animate-glow" : ""}`}>
            <Sparkles className="w-4 h-4" />
            {hasUnseenChangelog && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-ping" />
            )}
          </span>
          <span className="group-data-[collapsible=icon]:hidden">What's New</span>
          {hasUnseenChangelog && (
            <Badge variant="default" className="ml-auto text-[10px] px-1.5 py-0 group-data-[collapsible=icon]:hidden">
              New
            </Badge>
          )}
        </Button>
        <SidebarSeparator className="mb-2" />
        
        {isAuthenticated && character ? (
          <div className="rounded-lg bg-sidebar-accent/50" data-testid="sidebar-character-footer">
            <CharacterSwitcher />

            {(character.corporationName || character.allianceName) && (
              <div className="px-2 pb-2 space-y-0.5 group-data-[collapsible=icon]:hidden" data-testid="sidebar-corp-alliance">
                {character.corporationName && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building2 className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate" data-testid="text-corporation-name">{character.corporationName}</span>
                  </div>
                )}
                {character.allianceName && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Flag className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate" data-testid="text-alliance-name">{character.allianceName}</span>
                  </div>
                )}
              </div>
            )}

            {topBadges.length > 0 && (
              <div className="flex items-center gap-1 px-2 pb-2 group-data-[collapsible=icon]:justify-center" data-testid="sidebar-top-badges">
                {topBadges.map((badge, idx) => (
                  <MiniCharacterBadge key={idx} badge={badge} />
                ))}
              </div>
            )}

            {badgesLoading && (
              <div className="flex items-center gap-1 px-2 pb-2 group-data-[collapsible=icon]:justify-center">
                <Skeleton className="w-6 h-6 rounded-full" />
                <Skeleton className="w-6 h-6 rounded-full" />
                <Skeleton className="w-6 h-6 rounded-full" />
              </div>
            )}

            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2"
              onClick={handleLogout}
              data-testid="button-sidebar-logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="group-data-[collapsible=icon]:hidden">Logout</span>
            </Button>
          </div>
        ) : (
          <div className="p-2 text-center text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
            Not logged in
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
