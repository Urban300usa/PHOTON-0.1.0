import { createContext, useContext, useRef, type ReactNode } from "react";
import WhatsNewDialog, { type WhatsNewDialogHandle } from "@/components/WhatsNewDialog";

interface WhatsNewContextType {
  openWhatsNew: () => void;
  autoShowWhatsNew: () => void;
}

const WhatsNewContext = createContext<WhatsNewContextType | null>(null);

export function WhatsNewProvider({ children }: { children: ReactNode }) {
  const dialogRef = useRef<WhatsNewDialogHandle>(null);

  const openWhatsNew = () => {
    dialogRef.current?.open();
  };

  const autoShowWhatsNew = () => {
    dialogRef.current?.autoShow();
  };

  return (
    <WhatsNewContext.Provider value={{ openWhatsNew, autoShowWhatsNew }}>
      {children}
      <WhatsNewDialog ref={dialogRef} />
    </WhatsNewContext.Provider>
  );
}

export function useWhatsNew() {
  const context = useContext(WhatsNewContext);
  if (!context) {
    throw new Error("useWhatsNew must be used within a WhatsNewProvider");
  }
  return context;
}
