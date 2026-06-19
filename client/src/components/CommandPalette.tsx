import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator, CommandShortcut,
} from "@/components/ui/command";
import { useCommandPalette } from "@/contexts/CommandPaletteContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCharacterView } from "@/contexts/CharacterViewContext";
import { NAV_ITEMS } from "@/data/nav";
import { Sun, Moon, Users, User, Navigation2, Settings, Sparkles } from "lucide-react";

interface SystemHit { id: string; name: string; sec: number }

function secColor(sec: number): string {
  if (sec >= 0.5) return "#4ade80";
  if (sec > 0) return "#facc15";
  return "#f87171";
}

export default function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const [, setLocation] = useLocation();
  const { mode, toggleMode } = useTheme();
  const { viewMode, toggleViewMode } = useCharacterView();
  const [query, setQuery] = useState("");
  const [systems, setSystems] = useState<SystemHit[] | null>(null);

  // Lazy-load the universe data only when the palette is first opened
  useEffect(() => {
    if (open && systems === null) {
      import("@/data/eve-universe.json").then((mod) => {
        const data: any = (mod as any).default ?? mod;
        const list: SystemHit[] = Object.entries(data.systems).map(([id, s]: [string, any]) => ({
          id, name: s.name, sec: s.sec,
        }));
        setSystems(list);
      }).catch(() => setSystems([]));
    }
  }, [open, systems]);

  const systemMatches = useMemo(() => {
    if (!query.trim() || !systems) return [];
    const q = query.toLowerCase();
    return systems.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, systems]);

  const go = (url: string) => { setOpen(false); setLocation(url); };
  const run = (fn: () => void) => { setOpen(false); fn(); };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to a page, search systems, run a command…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Pages">
          {NAV_ITEMS.map((item) => (
            <CommandItem key={item.url} value={`${item.title} ${item.group}`} onSelect={() => go(item.url)}>
              <item.icon className="text-muted-foreground" />
              <span>{item.title}</span>
              <CommandShortcut>{item.group}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        {systemMatches.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Systems">
              {systemMatches.map((s) => (
                <CommandItem key={s.id} value={`system-${s.name}`} onSelect={() => go(`/jump-planner?to=${encodeURIComponent(s.name)}`)}>
                  <Navigation2 className="text-muted-foreground" />
                  <span>{s.name}</span>
                  <CommandShortcut style={{ color: secColor(s.sec) }}>{s.sec.toFixed(1)}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Quick actions">
          <CommandItem value="toggle theme mode dark light" onSelect={() => run(toggleMode)}>
            {mode === "dark" ? <Sun className="text-muted-foreground" /> : <Moon className="text-muted-foreground" />}
            <span>Switch to {mode === "dark" ? "light" : "dark"} mode</span>
          </CommandItem>
          <CommandItem value="toggle all characters view" onSelect={() => run(toggleViewMode)}>
            {viewMode === "all" ? <User className="text-muted-foreground" /> : <Users className="text-muted-foreground" />}
            <span>View {viewMode === "all" ? "active character" : "all characters"}</span>
          </CommandItem>
          <CommandItem value="settings" onSelect={() => go("/settings")}>
            <Settings className="text-muted-foreground" />
            <span>Open Settings</span>
          </CommandItem>
          <CommandItem value="theme picker appearance" onSelect={() => go("/settings")}>
            <Sparkles className="text-muted-foreground" />
            <span>Change theme</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
