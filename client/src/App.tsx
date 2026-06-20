import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProProvider } from "@/contexts/ProContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SmartTooltipProvider } from "@/contexts/SmartTooltipContext";
import { SidebarActionsProvider, useSidebarActions } from "@/contexts/SidebarActionsContext";
import { CharacterViewProvider } from "@/contexts/CharacterViewContext";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import CommandPalette from "@/components/CommandPalette";
import { CommandPaletteProvider } from "@/contexts/CommandPaletteContext";
import { ChatProvider } from "@/contexts/ChatContext";
import AuthGate from "@/components/AuthGate";
import ProActivationModal from "@/components/ProActivationModal";
import PageTransition from "@/components/PageTransition";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { WhatsNewProvider } from "@/contexts/WhatsNewContext";
import Home from "@/pages/home";
import OverviewPage from "@/pages/overview";
import LoginPage from "@/pages/login";
import SharePage from "@/pages/share";
import MiningPage from "@/pages/mining";
import IndustryPage from "@/pages/industry";
import PlanetaryPage from "@/pages/planetary";
import AssetsPage from "@/pages/assets";
import ContractsPage from "@/pages/contracts";
import AdminPage from "@/pages/admin";
import SupportPage from "@/pages/support";
import SettingsPage from "@/pages/settings";
import SkillsPage from "@/pages/skills";
import MarketPage from "@/pages/market";
import OverlayPage from "@/pages/overlay";
import AdmReportPage from "@/pages/adm-report";
import JumpPlannerPage from "@/pages/jump-planner";
import AnalyticsPage from "@/pages/analytics";
import MarketIntelPage from "@/pages/market-intel";
import JumpClonesPage from "@/pages/jump-clones";
import WalletTransactionsPage from "@/pages/wallet-transactions";
import LoyaltyPointsPage from "@/pages/loyalty-points";
import StandingsPage from "@/pages/standings";
import NotificationsPage from "@/pages/notifications";
import KillboardPage from "@/pages/killboard";
import NetWorthHistoryPage from "@/pages/net-worth-history";
import TimersPage from "@/pages/timers";
import MarketOrdersPage from "@/pages/market-orders";
import BlueprintsPage from "@/pages/blueprints";
import ChatPage from "@/pages/chat";
import LeaderboardsPage from "@/pages/leaderboards";
import AppraisalPage from "@/pages/appraisal";
import LookupPage from "@/pages/lookup";
import NotFound from "@/pages/not-found";
import { Footer } from "@/components/Footer";
import { BackgroundEffect } from "@/components/BackgroundEffect";

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const sidebarStyle = {
    "--sidebar-width": "14rem",
    "--sidebar-width-icon": "3.5rem",
  } as React.CSSProperties;

  const { isProModalOpen, setProModalOpen } = useSidebarActions();

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-auto flex flex-col">
            <div className="flex-1">
              <AnimatePresence mode="wait">
                <PageTransition>
                  <ErrorBoundary>
                    {children}
                  </ErrorBoundary>
                </PageTransition>
              </AnimatePresence>
            </div>
            <Footer />
          </main>
        </SidebarInset>
      </div>
      <CommandPalette />
      <ProActivationModal
        open={isProModalOpen}
        onOpenChange={setProModalOpen}
      />
    </SidebarProvider>
  );
}

function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login">
        <PublicLayout>
          <LoginPage />
        </PublicLayout>
      </Route>
      <Route path="/share/:shareCode">
        <PublicLayout>
          <SharePage />
        </PublicLayout>
      </Route>
      <Route path="/overlay">
        <AuthGate>
          <OverlayPage />
        </AuthGate>
      </Route>
      <Route path="/admin">
        <AuthGate>
          <AuthenticatedLayout>
            <AdminPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/admin/adm-report">
        <AuthGate>
          <AuthenticatedLayout>
            <AdmReportPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/mining">
        <AuthGate>
          <AuthenticatedLayout>
            <MiningPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/industry">
        <AuthGate>
          <AuthenticatedLayout>
            <IndustryPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/planetary">
        <AuthGate>
          <AuthenticatedLayout>
            <PlanetaryPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/assets">
        <AuthGate>
          <AuthenticatedLayout>
            <AssetsPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/contracts">
        <AuthGate>
          <AuthenticatedLayout>
            <ContractsPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/skills">
        <AuthGate>
          <AuthenticatedLayout>
            <SkillsPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/market">
        <AuthGate>
          <AuthenticatedLayout>
            <MarketPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/jump-planner">
        <AuthGate>
          <AuthenticatedLayout>
            <JumpPlannerPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/analytics">
        <AuthGate>
          <AuthenticatedLayout>
            <AnalyticsPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/market-intel">
        <AuthGate>
          <AuthenticatedLayout>
            <MarketIntelPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/jump-clones">
        <AuthGate>
          <AuthenticatedLayout>
            <JumpClonesPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/wallet/transactions">
        <AuthGate>
          <AuthenticatedLayout>
            <WalletTransactionsPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/loyalty-points">
        <AuthGate>
          <AuthenticatedLayout>
            <LoyaltyPointsPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/standings">
        <AuthGate>
          <AuthenticatedLayout>
            <StandingsPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/notifications">
        <AuthGate>
          <AuthenticatedLayout>
            <NotificationsPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/killboard">
        <AuthGate>
          <AuthenticatedLayout>
            <KillboardPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/analytics/net-worth">
        <AuthGate>
          <AuthenticatedLayout>
            <NetWorthHistoryPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/timers">
        <AuthGate>
          <AuthenticatedLayout>
            <TimersPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/market-orders">
        <AuthGate>
          <AuthenticatedLayout>
            <MarketOrdersPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/blueprints">
        <AuthGate>
          <AuthenticatedLayout>
            <BlueprintsPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/chat">
        <AuthGate>
          <AuthenticatedLayout>
            <ChatPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/leaderboards">
        <AuthGate>
          <AuthenticatedLayout>
            <LeaderboardsPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/appraisal">
        <AuthGate>
          <AuthenticatedLayout>
            <AppraisalPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/lookup">
        <AuthGate>
          <AuthenticatedLayout>
            <LookupPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/support">
        <AuthGate>
          <AuthenticatedLayout>
            <SupportPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/settings">
        <AuthGate>
          <AuthenticatedLayout>
            <SettingsPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/ratting">
        <AuthGate>
          <AuthenticatedLayout>
            <Home />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route path="/">
        <AuthGate>
          <AuthenticatedLayout>
            <OverviewPage />
          </AuthenticatedLayout>
        </AuthGate>
      </Route>
      <Route>
        <PublicLayout>
          <NotFound />
        </PublicLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BackgroundEffect />
      <QueryClientProvider client={queryClient}>
        <ProProvider>
          <CharacterViewProvider>
            <SidebarActionsProvider>
              <SmartTooltipProvider>
                <TooltipProvider>
                  <WhatsNewProvider>
                    <CommandPaletteProvider>
                      <ChatProvider>
                        <Toaster />
                        <Router />
                      </ChatProvider>
                    </CommandPaletteProvider>
                  </WhatsNewProvider>
                </TooltipProvider>
              </SmartTooltipProvider>
            </SidebarActionsProvider>
          </CharacterViewProvider>
        </ProProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
