import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

interface AuthGateProps {
  children: React.ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const hasCheckedReturnTo = useRef(false);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      if (location !== "/login") {
        sessionStorage.setItem("photon:returnTo", location);
      }
      setLocation("/login");
      hasCheckedReturnTo.current = false;
    } else if (!hasCheckedReturnTo.current) {
      hasCheckedReturnTo.current = true;
      const returnTo = sessionStorage.getItem("photon:returnTo");
      if (returnTo && returnTo !== "/" && returnTo !== location) {
        sessionStorage.removeItem("photon:returnTo");
        setLocation(returnTo);
      }
    }
  }, [isAuthenticated, isLoading, location, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
