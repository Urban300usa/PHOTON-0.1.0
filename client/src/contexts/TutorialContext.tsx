import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  placement?: "top" | "bottom" | "left" | "right";
}

// Main user tutorial steps
const USER_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to PHOTON!",
    description: "Track your EVE Online income from ratting, mining, industry, and more. Let's take a quick tour of the key features.",
    targetSelector: "[data-testid='session-controls-card']",
    placement: "bottom"
  },
  {
    id: "session-timer",
    title: "Session Timer",
    description: "Start a session to begin tracking your ratting time. The timer runs while you rat, and auto-starts when bounty income over 2M ISK is detected.",
    targetSelector: "[data-testid='session-controls-card']",
    placement: "right"
  },
  {
    id: "income-entry",
    title: "Quick Income Entry",
    description: "Manually add ISK income here. Use the quick buttons (+1M, +5M, etc.) or enter a custom amount. Perfect for logging bounties.",
    targetSelector: "[data-testid='income-entry-card']",
    placement: "left"
  },
  {
    id: "stats",
    title: "Live Statistics",
    description: "Track your current session earnings and ISK per hour rate in real-time. These update as you add income.",
    targetSelector: "[data-testid='stat-current-session-card']",
    placement: "bottom"
  },
  {
    id: "wallet-sync",
    title: "Wallet Sync",
    description: "PHOTON automatically syncs with your EVE wallet to detect bounty payments. Income is logged in real-time when you're ratting!",
    targetSelector: "[data-testid='stat-total-today-card']",
    placement: "bottom"
  },
  {
    id: "mining-page",
    title: "Mining Tracker",
    description: "Track your mining income with ESI integration. View your mining ledger, ore values at Jita prices, and historical data.",
    targetSelector: "[data-testid='nav-link-mining-tracker']",
    placement: "right"
  },
  {
    id: "industry-page",
    title: "Industry Jobs",
    description: "Monitor your manufacturing, invention, research, and reaction jobs. Track progress, costs, and profit calculations.",
    targetSelector: "[data-testid='nav-link-industry-jobs']",
    placement: "right"
  },
  {
    id: "planetary-page",
    title: "Planetary Industry",
    description: "Manage your PI colonies, monitor extractor status, and calculate production chain values with the built-in PI Calculator.",
    targetSelector: "[data-testid='nav-link-planetary']",
    placement: "right"
  },
  {
    id: "assets-page",
    title: "Assets Tracker",
    description: "View all your character assets, organized by location. See net worth calculations based on current Jita market prices.",
    targetSelector: "[data-testid='nav-link-assets']",
    placement: "right"
  },
  {
    id: "contracts-page",
    title: "Contracts",
    description: "Track your contracts including courier, item exchange, and auction contracts. Filter by status and view ISK values.",
    targetSelector: "[data-testid='nav-link-contracts']",
    placement: "right"
  },
  {
    id: "themes",
    title: "EVE Faction Themes",
    description: "Customize your experience with authentic EVE faction themes! Choose from Caldari, Amarr, Gallente, Minmatar, and more.",
    targetSelector: "[data-testid='button-theme-toggle']",
    placement: "bottom"
  },
  {
    id: "pro-features",
    title: "PRO Features",
    description: "Upgrade to PRO for exclusive themes, income goals, draggable dashboard tiles, priority support, and special badges. Pay with ISK in-game!",
    targetSelector: "[data-testid='sidebar-button-pro']",
    placement: "right"
  },
  {
    id: "support",
    title: "Need Help?",
    description: "Submit support tickets if you have questions or issues. Our team is here to help you get the most out of PHOTON.",
    targetSelector: "[data-testid='nav-link-support']",
    placement: "right"
  },
  {
    id: "session-history",
    title: "Session History",
    description: "View all your past ratting sessions with detailed stats including duration, total ISK, and efficiency.",
    targetSelector: "[data-testid='session-history-card']",
    placement: "top"
  },
  {
    id: "customize",
    title: "Customize Your Dashboard",
    description: "Click here to add or remove tiles from your dashboard. Enable features like Loot Tracker, Leaderboards, and more!",
    targetSelector: "[data-testid='button-tile-library']",
    placement: "bottom"
  }
];

// Admin-only tutorial steps - follows tab order left to right
const ADMIN_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "admin-welcome",
    title: "Admin Panel Overview",
    description: "Welcome to the PHOTON Admin Panel. Manage users, subscriptions, support, and monitor system health from one place.",
    targetSelector: "[data-testid='admin-tabs']",
    placement: "bottom"
  },
  {
    id: "admin-dashboard",
    title: "Dashboard",
    description: "Key metrics at a glance: active PRO subscribers, pending codes, gift stats, system health, and your admin status.",
    targetSelector: "[data-testid='tab-dashboard']",
    placement: "bottom"
  },
  {
    id: "admin-subscriptions",
    title: "Subscriptions",
    description: "Manage PRO subscriptions, generate PHOTON codes with custom benefits, and track code activity. Use the sub-tabs to switch between features.",
    targetSelector: "[data-testid='tab-subscriptions']",
    placement: "bottom"
  },
  {
    id: "admin-users",
    title: "Users",
    description: "Search users, view profiles, manage badges, add notes, suspend accounts, and promote admins.",
    targetSelector: "[data-testid='tab-users']",
    placement: "bottom"
  },
  {
    id: "admin-support",
    title: "Support",
    description: "View and respond to user support tickets. Track open, in-progress, and resolved issues.",
    targetSelector: "[data-testid='tab-support']",
    placement: "bottom"
  },
  {
    id: "admin-logs",
    title: "Logs",
    description: "View ratting sessions and audit admin actions. Use sub-tabs to switch between Sessions and Audit Log.",
    targetSelector: "[data-testid='tab-logs']",
    placement: "bottom"
  }
];

const USER_TUTORIAL_STORAGE_KEY = "photon-tutorial-v3";
const ADMIN_TUTORIAL_STORAGE_KEY = "photon-admin-tutorial-v1";

interface TutorialContextType {
  isActive: boolean;
  currentStep: number;
  steps: TutorialStep[];
  currentStepData: TutorialStep | null;
  next: () => void;
  prev: () => void;
  skip: () => void;
  complete: () => void;
  restart: () => void;
  hasCompleted: boolean;
}

interface AdminTutorialContextType {
  isActive: boolean;
  currentStep: number;
  steps: TutorialStep[];
  currentStepData: TutorialStep | null;
  next: () => void;
  prev: () => void;
  skip: () => void;
  complete: () => void;
  restart: () => void;
  hasCompleted: boolean;
}

const TutorialContext = createContext<TutorialContextType | null>(null);
const AdminTutorialContext = createContext<AdminTutorialContextType | null>(null);

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error("useTutorial must be used within a TutorialProvider");
  }
  return context;
}

export function useAdminTutorial() {
  const context = useContext(AdminTutorialContext);
  if (!context) {
    throw new Error("useAdminTutorial must be used within an AdminTutorialProvider");
  }
  return context;
}

interface TutorialProviderProps {
  children: ReactNode;
}

export function TutorialProvider({ children }: TutorialProviderProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const saved = localStorage.getItem(USER_TUTORIAL_STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setHasCompleted(data.completed === true);
        if (!data.completed) {
          setTimeout(() => setIsActive(true), 1000);
        }
      } catch {
        setTimeout(() => setIsActive(true), 1000);
      }
    } else {
      setTimeout(() => setIsActive(true), 1000);
    }
  }, []);

  const saveState = useCallback((completed: boolean) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(USER_TUTORIAL_STORAGE_KEY, JSON.stringify({ completed }));
  }, []);

  const next = useCallback(() => {
    if (currentStep < USER_TUTORIAL_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setIsActive(false);
      setHasCompleted(true);
      saveState(true);
    }
  }, [currentStep, saveState]);

  const prev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const skip = useCallback(() => {
    setIsActive(false);
    setHasCompleted(true);
    saveState(true);
  }, [saveState]);

  const complete = useCallback(() => {
    setIsActive(false);
    setHasCompleted(true);
    saveState(true);
  }, [saveState]);

  const restart = useCallback(() => {
    setCurrentStep(0);
    setHasCompleted(false);
    setIsActive(true);
    saveState(false);
  }, [saveState]);

  const currentStepData = isActive ? USER_TUTORIAL_STEPS[currentStep] : null;

  return (
    <TutorialContext.Provider
      value={{
        isActive,
        currentStep,
        steps: USER_TUTORIAL_STEPS,
        currentStepData,
        next,
        prev,
        skip,
        complete,
        restart,
        hasCompleted
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
}

interface AdminTutorialProviderProps {
  children: ReactNode;
}

export function AdminTutorialProvider({ children }: AdminTutorialProviderProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const saved = localStorage.getItem(ADMIN_TUTORIAL_STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setHasCompleted(data.completed === true);
      } catch {
        // Don't auto-start admin tutorial
      }
    }
  }, []);

  const saveState = useCallback((completed: boolean) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(ADMIN_TUTORIAL_STORAGE_KEY, JSON.stringify({ completed }));
  }, []);

  const next = useCallback(() => {
    if (currentStep < ADMIN_TUTORIAL_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setIsActive(false);
      setHasCompleted(true);
      saveState(true);
    }
  }, [currentStep, saveState]);

  const prev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const skip = useCallback(() => {
    setIsActive(false);
    setHasCompleted(true);
    saveState(true);
  }, [saveState]);

  const complete = useCallback(() => {
    setIsActive(false);
    setHasCompleted(true);
    saveState(true);
  }, [saveState]);

  const restart = useCallback(() => {
    setCurrentStep(0);
    setHasCompleted(false);
    setIsActive(true);
    saveState(false);
  }, [saveState]);

  const currentStepData = isActive ? ADMIN_TUTORIAL_STEPS[currentStep] : null;

  return (
    <AdminTutorialContext.Provider
      value={{
        isActive,
        currentStep,
        steps: ADMIN_TUTORIAL_STEPS,
        currentStepData,
        next,
        prev,
        skip,
        complete,
        restart,
        hasCompleted
      }}
    >
      {children}
    </AdminTutorialContext.Provider>
  );
}
