import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useWalletBalance, formatISK } from "@/hooks/use-wallet";
import { useCommandPalette } from "@/contexts/CommandPaletteContext";
import { titleForPath } from "@/data/nav";
import { Search, Clock, Wallet, Bell } from "lucide-react";

interface TimersResp { timers: { label: string; endsAt: string | null }[] }
interface NotifCount { count: number }

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}
function urgencyColor(ms: number): string {
  const h = ms / 3600000;
  if (h < 1) return "text-red-400";
  if (h < 24) return "text-orange-400";
  return "text-green-400";
}

export function TopBar() {
  const [location] = useLocation();
  const { isAuthenticated, character } = useAuth();
  const { toggle } = useCommandPalette();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: timersData } = useQuery<TimersResp>({
    queryKey: ["/api/timers"],
    enabled: isAuthenticated,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
  const { data: walletData } = useWalletBalance(isAuthenticated);
  const { data: notif } = useQuery<NotifCount>({
    queryKey: ["/api/support/notifications/count"],
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });

  // Soonest upcoming timer
  const nextTimer = (timersData?.timers ?? [])
    .filter((t) => t.endsAt && new Date(t.endsAt).getTime() > now)
    .sort((a, b) => new Date(a.endsAt!).getTime() - new Date(b.endsAt!).getTime())[0];
  const nextMs = nextTimer ? new Date(nextTimer.endsAt!).getTime() - now : null;
  const unread = notif?.count ?? 0;

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-card-border bg-background/70 backdrop-blur-md px-3">
      <SidebarTrigger className="shrink-0" />
      <span className="hidden sm:block text-sm font-semibold text-foreground/90 truncate max-w-[180px]">
        {titleForPath(location)}
      </span>

      {/* ⌘K search */}
      <button
        onClick={toggle}
        className="ml-2 hidden md:flex items-center gap-2 h-9 w-64 rounded-md border border-card-border bg-muted/40 px-3 text-sm text-muted-foreground hover:border-primary/40 transition-colors"
        data-testid="topbar-command"
      >
        <Search className="h-4 w-4" />
        <span>Search…</span>
        <kbd className="ml-auto text-[10px] font-mono bg-background/80 border border-border rounded px-1.5 py-0.5">⌘K</kbd>
      </button>
      <button
        onClick={toggle}
        className="ml-1 flex md:hidden items-center justify-center h-9 w-9 rounded-md border border-card-border bg-muted/40 text-muted-foreground"
        aria-label="Search"
      >
        <Search className="h-4 w-4" />
      </button>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {/* Next timer pill */}
        {nextMs != null && (
          <Link
            href="/timers"
            className="hidden sm:flex items-center gap-1.5 h-9 rounded-md border border-card-border bg-card/60 px-2.5 hover:border-primary/40 transition-colors"
            title={nextTimer?.label}
          >
            <Clock className={`h-3.5 w-3.5 ${urgencyColor(nextMs)}`} />
            <span className={`text-xs font-mono font-semibold ${urgencyColor(nextMs)}`}>{fmtCountdown(nextMs)}</span>
          </Link>
        )}

        {/* Wallet */}
        {walletData && (
          <Link
            href="/wallet/transactions"
            className="hidden sm:flex items-center gap-1.5 h-9 rounded-md border border-card-border bg-card/60 px-2.5 hover:border-primary/40 transition-colors"
            title="Wallet balance"
          >
            <Wallet className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-mono font-semibold isk-value">{formatISK(walletData.balance)}</span>
          </Link>
        )}

        {/* Notifications */}
        <Link
          href="/notifications"
          className="relative flex items-center justify-center h-9 w-9 rounded-md border border-card-border bg-card/60 hover:border-primary/40 transition-colors"
          title="Notifications"
        >
          <Bell className="h-4 w-4 text-muted-foreground" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>

        {/* Character chip */}
        {character && (
          <div className="hidden md:flex items-center gap-2 h-9 rounded-md border border-card-border bg-card/60 pl-1 pr-2.5">
            <img
              src={`https://images.evetech.net/characters/${character.id}/portrait?size=32`}
              alt=""
              className="h-7 w-7 rounded-md object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
            />
            <span className="text-xs font-medium truncate max-w-[120px]">{character.name}</span>
          </div>
        )}
      </div>
    </header>
  );
}

export default TopBar;
