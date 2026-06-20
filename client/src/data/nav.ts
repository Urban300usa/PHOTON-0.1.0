import {
  LayoutDashboard, Crosshair, Clock, BarChart3, LineChart, Trophy,
  Pickaxe, Factory, FileStack, Globe2,
  Package, FileText, Receipt,
  ShoppingCart, CreditCard, TrendingUp,
  Navigation2, Anchor,
  GraduationCap, Award, Star,
  Skull, Bell, MessageSquare,
  HelpCircle, Settings,
  Calculator, UserSearch, Tag,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  group: string;
}

/**
 * Single source of truth for primary navigation. Consumed by the command
 * palette (and available to the sidebar/breadcrumb).
 */
export const NAV_ITEMS: NavItem[] = [
  { title: "Overview", url: "/", icon: LayoutDashboard, group: "Dashboard" },
  { title: "Ratting Tracker", url: "/ratting", icon: Crosshair, group: "Dashboard" },
  { title: "Timer Dashboard", url: "/timers", icon: Clock, group: "Dashboard" },
  { title: "Analytics", url: "/analytics", icon: BarChart3, group: "Dashboard" },
  { title: "Net Worth", url: "/analytics/net-worth", icon: LineChart, group: "Dashboard" },
  { title: "Leaderboards", url: "/leaderboards", icon: Trophy, group: "Dashboard" },

  { title: "Mining Tracker", url: "/mining", icon: Pickaxe, group: "Industry" },
  { title: "Industry Jobs", url: "/industry", icon: Factory, group: "Industry" },
  { title: "Blueprints", url: "/blueprints", icon: FileStack, group: "Industry" },
  { title: "Planetary", url: "/planetary", icon: Globe2, group: "Industry" },

  { title: "Assets", url: "/assets", icon: Package, group: "Assets & Wallet" },
  { title: "Contracts", url: "/contracts", icon: FileText, group: "Assets & Wallet" },
  { title: "Wallet Transactions", url: "/wallet/transactions", icon: Receipt, group: "Assets & Wallet" },

  { title: "Market", url: "/market", icon: ShoppingCart, group: "Market" },
  { title: "Market Orders", url: "/market-orders", icon: CreditCard, group: "Market" },
  { title: "Market Intel", url: "/market-intel", icon: TrendingUp, group: "Market" },

  { title: "Appraisal", url: "/appraisal", icon: Calculator, group: "Tools" },
  { title: "Character Lookup", url: "/lookup", icon: UserSearch, group: "Tools" },

  { title: "Jump Planner", url: "/jump-planner", icon: Navigation2, group: "Travel" },
  { title: "Jump Clones", url: "/jump-clones", icon: Anchor, group: "Travel" },

  { title: "Skills", url: "/skills", icon: GraduationCap, group: "Character" },
  { title: "Standings", url: "/standings", icon: Award, group: "Character" },
  { title: "Loyalty Points", url: "/loyalty-points", icon: Star, group: "Character" },

  { title: "Killboard", url: "/killboard", icon: Skull, group: "Combat & Comms" },
  { title: "Chat", url: "/chat", icon: MessageSquare, group: "Combat & Comms" },
  { title: "Notifications", url: "/notifications", icon: Bell, group: "Combat & Comms" },

  { title: "Support", url: "/support", icon: HelpCircle, group: "More" },
  { title: "Settings", url: "/settings", icon: Settings, group: "More" },
];

/** Look up a page title for the current path (for breadcrumb/top bar). */
export function titleForPath(path: string): string {
  const exact = NAV_ITEMS.find((n) => n.url === path);
  if (exact) return exact.title;
  // longest-prefix match for nested routes
  const prefix = NAV_ITEMS
    .filter((n) => n.url !== "/" && path.startsWith(n.url))
    .sort((a, b) => b.url.length - a.url.length)[0];
  return prefix?.title ?? "PHOTON";
}
