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
import AuthGate from "@/components/AuthGate";
import ProActivationModal from "@/components/ProActivationModal";
import PageTransition from "@/components/PageTransition";
import { WhatsNewProvider } from "@/contexts/WhatsNewContext";
import Home from "@/pages/home";
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
          <main className="flex-1 overflow-auto flex flex-col">
            <div className="flex-1">
              <AnimatePresence mode="wait">
                <PageTransition>
                  {children}
                </PageTransition>
              </AnimatePresence>
            </div>
            <Footer />
          </main>
        </SidebarInset>
      </div>
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
      <Route path="/">
        <AuthGate>
          <AuthenticatedLayout>
            <Home />
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
                    <Toaster />
                    <Router />
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
