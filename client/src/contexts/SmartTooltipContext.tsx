import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

const STORAGE_KEY = 'photon-seen-tooltips';

export interface TooltipInfo {
  id: string;
  title: string;
  content: string;
  category?: 'mining' | 'ratting' | 'pro' | 'general';
}

export const TOOLTIPS: Record<string, TooltipInfo> = {
  'mining-reprocess': {
    id: 'mining-reprocess',
    title: 'Reprocessing Yield',
    content: 'Adjust this based on your skills and station. NPC stations give 50%, citadels with rigs can reach up to 90%.',
    category: 'mining',
  },
  'mining-timer': {
    id: 'mining-timer',
    title: 'Session Timer',
    content: 'Track your mining session duration. Great for calculating ISK/hour efficiency!',
    category: 'mining',
  },
  'mining-ores-selection': {
    id: 'mining-ores-selection',
    title: 'Ore Selection',
    content: 'Check ores to include them in mineral calculations. Uncheck to exclude specific ores.',
    category: 'mining',
  },
  'pro-benefits': {
    id: 'pro-benefits',
    title: 'PRO Subscription',
    content: 'PRO users get exclusive themes, custom dashboard layouts, and priority support!',
    category: 'pro',
  },
  'ratting-session': {
    id: 'ratting-session',
    title: 'Ratting Sessions',
    content: 'Start a session to track your bounty payments. The session will automatically sync with your wallet.',
    category: 'ratting',
  },
  'dashboard-tiles': {
    id: 'dashboard-tiles',
    title: 'Dashboard Tiles',
    content: 'PRO users can drag and resize tiles to customize their dashboard layout.',
    category: 'general',
  },
};

interface SmartTooltipContextValue {
  seenTooltips: Set<string>;
  isLoaded: boolean;
  markAsSeen: (tooltipId: string) => void;
  hasSeenTooltip: (tooltipId: string) => boolean;
  resetTooltips: () => void;
  getUnseenTooltips: (category?: string) => TooltipInfo[];
}

const SmartTooltipContext = createContext<SmartTooltipContextValue | null>(null);

export function SmartTooltipProvider({ children }: { children: ReactNode }) {
  const [seenTooltips, setSeenTooltips] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSeenTooltips(new Set(parsed));
      } catch (e) {
        console.error('Failed to parse stored tooltips:', e);
      }
    }
    setIsLoaded(true);
  }, []);

  const markAsSeen = useCallback((tooltipId: string) => {
    setSeenTooltips(prev => {
      const next = new Set(prev);
      next.add(tooltipId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  const hasSeenTooltip = useCallback((tooltipId: string): boolean => {
    return seenTooltips.has(tooltipId);
  }, [seenTooltips]);

  const resetTooltips = useCallback(() => {
    setSeenTooltips(new Set());
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const getUnseenTooltips = useCallback((category?: string): TooltipInfo[] => {
    return Object.values(TOOLTIPS).filter(tip => {
      const matchesCategory = !category || tip.category === category;
      const notSeen = !seenTooltips.has(tip.id);
      return matchesCategory && notSeen;
    });
  }, [seenTooltips]);

  return (
    <SmartTooltipContext.Provider
      value={{
        seenTooltips,
        isLoaded,
        markAsSeen,
        hasSeenTooltip,
        resetTooltips,
        getUnseenTooltips,
      }}
    >
      {children}
    </SmartTooltipContext.Provider>
  );
}

export function useSmartTooltipContext() {
  const context = useContext(SmartTooltipContext);
  if (!context) {
    throw new Error('useSmartTooltipContext must be used within SmartTooltipProvider');
  }
  return context;
}
