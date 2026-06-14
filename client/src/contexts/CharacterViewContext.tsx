import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type CharacterViewMode = "single" | "all";

interface CharacterViewContextType {
  viewMode: CharacterViewMode;
  setViewMode: (mode: CharacterViewMode) => void;
  toggleViewMode: () => void;
}

const CharacterViewContext = createContext<CharacterViewContextType | null>(null);

export function CharacterViewProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<CharacterViewMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("characterViewMode");
      if (saved === "single" || saved === "all") {
        return saved;
      }
    }
    return "single";
  });

  const setViewMode = useCallback((mode: CharacterViewMode) => {
    setViewModeState(mode);
    localStorage.setItem("characterViewMode", mode);
  }, []);

  const toggleViewMode = useCallback(() => {
    setViewModeState(prev => {
      const newMode = prev === "single" ? "all" : "single";
      localStorage.setItem("characterViewMode", newMode);
      return newMode;
    });
  }, []);

  return (
    <CharacterViewContext.Provider value={{ viewMode, setViewMode, toggleViewMode }}>
      {children}
    </CharacterViewContext.Provider>
  );
}

export function useCharacterView() {
  const context = useContext(CharacterViewContext);
  if (!context) {
    throw new Error("useCharacterView must be used within a CharacterViewProvider");
  }
  return context;
}
