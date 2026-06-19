import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { FACTION_THEMES, type FactionTheme } from "@shared/schema";

export type ThemeMode = "light" | "dark";
export type BackgroundEffect = "none" | "starfield" | "nebula" | "space";

interface ThemeContextType {
  mode: ThemeMode;
  theme: FactionTheme;
  backgroundEffect: BackgroundEffect;
  reduceMotion: boolean;
  setMode: (mode: ThemeMode) => void;
  setTheme: (theme: FactionTheme) => void;
  setBackgroundEffect: (effect: BackgroundEffect) => void;
  setReduceMotion: (v: boolean) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "photon-tracker-theme";

interface StoredTheme {
  mode: ThemeMode;
  theme: FactionTheme;
  backgroundEffect?: BackgroundEffect;
  reduceMotion?: boolean;
}

const BACKGROUND_EFFECTS: BackgroundEffect[] = ["none", "starfield", "nebula", "space"];

function getStoredTheme(): StoredTheme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      let theme = parsed.theme;
      // Migrate old "light" and "dark" themes to "default"
      if (theme === "light" || theme === "dark") {
        theme = "default";
      }
      const isValidTheme = theme && theme in FACTION_THEMES;
      const bgEffect = BACKGROUND_EFFECTS.includes(parsed.backgroundEffect) ? parsed.backgroundEffect : "none";
      return {
        mode: parsed.mode === "light" ? "light" : "dark",
        theme: isValidTheme ? theme : "default",
        backgroundEffect: bgEffect,
        reduceMotion: !!parsed.reduceMotion,
      };
    }
  } catch (e) {
    console.error("Failed to parse stored theme:", e);
  }
  return { mode: "dark", theme: "default", backgroundEffect: "none", reduceMotion: false };
}

function storeTheme(theme: StoredTheme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  } catch (e) {
    console.error("Failed to store theme:", e);
  }
}

const ALL_THEME_CLASSES = Object.keys(FACTION_THEMES) as FactionTheme[];
const LEGACY_THEME_CLASSES = ["light", "dark"] as const;
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => getStoredTheme().mode);
  const [theme, setThemeState] = useState<FactionTheme>(() => getStoredTheme().theme);
  const [backgroundEffect, setBackgroundEffectState] = useState<BackgroundEffect>(() => getStoredTheme().backgroundEffect || "none");
  const [reduceMotion, setReduceMotionState] = useState<boolean>(() => !!getStoredTheme().reduceMotion);

  const applyTheme = useCallback((currentMode: ThemeMode, currentTheme: FactionTheme, currentBgEffect: BackgroundEffect) => {
    const root = document.documentElement;

    root.classList.remove("light", "dark");
    ALL_THEME_CLASSES.forEach((t) => root.classList.remove(t));
    LEGACY_THEME_CLASSES.forEach((t) => root.classList.remove(t));

    root.classList.add(currentMode);
    root.classList.add(currentTheme);
  }, []);

  useEffect(() => {
    applyTheme(mode, theme, backgroundEffect);
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
    storeTheme({ mode, theme, backgroundEffect, reduceMotion });
  }, [mode, theme, backgroundEffect, reduceMotion, applyTheme]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
  }, []);

  const setTheme = useCallback((newTheme: FactionTheme) => {
    setThemeState(newTheme);
  }, []);

  const setBackgroundEffect = useCallback((newEffect: BackgroundEffect) => {
    setBackgroundEffectState(newEffect);
  }, []);

  const setReduceMotion = useCallback((v: boolean) => {
    setReduceMotionState(v);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, theme, backgroundEffect, reduceMotion, setMode, setTheme, setBackgroundEffect, setReduceMotion, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
