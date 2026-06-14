import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface SidebarActionsContextType {
  isProModalOpen: boolean;
  setProModalOpen: (open: boolean) => void;
  triggerExport: () => void;
  exportTriggered: boolean;
  resetExportTrigger: () => void;
}

const SidebarActionsContext = createContext<SidebarActionsContextType | undefined>(undefined);

export function SidebarActionsProvider({ children }: { children: ReactNode }) {
  const [isProModalOpen, setProModalOpenState] = useState(false);
  const [exportTriggered, setExportTriggered] = useState(false);

  const setProModalOpen = useCallback((open: boolean) => {
    setProModalOpenState(open);
  }, []);

  const triggerExport = useCallback(() => {
    setExportTriggered(true);
  }, []);

  const resetExportTrigger = useCallback(() => {
    setExportTriggered(false);
  }, []);

  return (
    <SidebarActionsContext.Provider 
      value={{ 
        isProModalOpen,
        setProModalOpen,
        triggerExport,
        exportTriggered,
        resetExportTrigger,
      }}
    >
      {children}
    </SidebarActionsContext.Provider>
  );
}

export function useSidebarActions() {
  const context = useContext(SidebarActionsContext);
  if (context === undefined) {
    throw new Error("useSidebarActions must be used within a SidebarActionsProvider");
  }
  return context;
}
