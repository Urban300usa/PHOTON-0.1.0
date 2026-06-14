import { Moon, Sun, Palette, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useTheme, type ThemeMode } from "@/contexts/ThemeContext";
import { useProContext } from "@/contexts/ProContext";
import { FACTION_THEMES, type FactionTheme } from "@shared/schema";

const modeInfo: Record<ThemeMode, { name: string; icon: typeof Sun }> = {
  light: { name: "Light", icon: Sun },
  dark: { name: "Dark", icon: Moon },
};

export function ThemeToggle() {
  const { mode, theme, setMode, setTheme } = useTheme();
  const { isPro } = useProContext();
  const ModeIcon = modeInfo[mode].icon;

  const freeThemes = (Object.keys(FACTION_THEMES) as FactionTheme[]).filter(
    t => !FACTION_THEMES[t].isPro
  );
  const proThemes = (Object.keys(FACTION_THEMES) as FactionTheme[]).filter(
    t => FACTION_THEMES[t].isPro
  );

  const handleThemeSelect = (t: FactionTheme) => {
    const themeData = FACTION_THEMES[t];
    if (themeData.isPro && !isPro) {
      return;
    }
    setTheme(t);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="button-theme-toggle">
          <Palette className="h-4 w-4" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2">
          <ModeIcon className="h-4 w-4" />
          Display Mode
        </DropdownMenuLabel>
        {(Object.keys(modeInfo) as ThemeMode[]).map((m) => {
          const Icon = modeInfo[m].icon;
          return (
            <DropdownMenuItem
              key={m}
              onClick={() => setMode(m)}
              className={mode === m ? "bg-accent" : ""}
              data-testid={`menu-mode-${m}`}
            >
              <Icon className="mr-2 h-4 w-4" />
              {modeInfo[m].name}
              {mode === m && <span className="ml-auto text-xs text-muted-foreground">Active</span>}
            </DropdownMenuItem>
          );
        })}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuLabel className="flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Free Themes
        </DropdownMenuLabel>
        {freeThemes.map((t) => {
          const themeData = FACTION_THEMES[t];
          return (
            <DropdownMenuItem
              key={t}
              onClick={() => handleThemeSelect(t)}
              className={theme === t ? "bg-accent" : ""}
              data-testid={`menu-theme-${t}`}
            >
              <div 
                className="w-4 h-4 rounded-full mr-2 border border-border" 
                style={{ backgroundColor: themeData.primaryColor }}
              />
              <div className="flex flex-col flex-1">
                <span>{themeData.name}</span>
                <span className="text-xs text-muted-foreground">{themeData.description}</span>
              </div>
              {theme === t && <span className="ml-auto text-xs text-muted-foreground">Active</span>}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />
        
        <DropdownMenuLabel className="flex items-center gap-2">
          <Palette className="h-4 w-4" />
          PRO Themes
          <Badge variant="secondary" className="text-[10px] px-1">Coming Soon</Badge>
        </DropdownMenuLabel>
        {proThemes.map((t) => {
          const themeData = FACTION_THEMES[t];
          return (
            <DropdownMenuItem
              key={t}
              className="opacity-50 cursor-not-allowed"
              disabled={true}
              data-testid={`menu-theme-${t}`}
            >
              <div 
                className="w-4 h-4 rounded-full mr-2 border border-border" 
                style={{ backgroundColor: themeData.primaryColor }}
              />
              <div className="flex flex-col flex-1">
                <span className="flex items-center gap-1">
                  {themeData.name}
                  <Lock className="w-3 h-3" />
                </span>
                <span className="text-xs text-muted-foreground">{themeData.description}</span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
