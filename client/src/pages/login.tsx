import { useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, TrendingUp, Wallet, Timer, ChartBar, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import photonLogo from "@assets/lucid-origin_Futuristic_app_icon_glowing_energy_sphere_electri_1764963358793.jpg";

const features = [
  {
    icon: Timer,
    title: "Session Tracking",
    description: "Track your ratting sessions with precision timers and auto-detection"
  },
  {
    icon: Wallet,
    title: "Wallet Integration",
    description: "Automatic bounty detection from your EVE wallet journal"
  },
  {
    icon: TrendingUp,
    title: "ISK/Hour Analytics",
    description: "Real-time statistics and historical performance analysis"
  },
  {
    icon: ChartBar,
    title: "Progress Tracking",
    description: "Track goals, achievements, and compare with others"
  }
];

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  // If already authenticated, redirect to home (AuthGate handles returnTo logic)
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      setLocation("/");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  const handleLogin = (useRealSSO = false) => {
    // In development mode, use dev login to bypass EVE OAuth (unless useRealSSO is true)
    // In production, always use real EVE SSO
    const isDev = import.meta.env.DEV;
    window.location.href = (isDev && !useRealSSO) ? "/api/auth/dev-login" : "/api/auth/login";
  };

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img 
                src={photonLogo} 
                alt="PHOTON" 
                className="w-20 h-20 rounded-xl object-cover"
                data-testid="img-login-logo"
              />
            </div>
            <h1 className="text-4xl font-bold tracking-tight mb-2">
              PHOTON
            </h1>
            <p className="text-xl text-muted-foreground max-w-md mx-auto">
              Track your EVE Online income with precision and style
            </p>
          </div>

          <Card className="mb-8">
            <CardHeader className="text-center pb-4">
              <CardTitle className="flex items-center justify-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Secure EVE Online Login
              </CardTitle>
              <CardDescription>
                Log in with your EVE Online account to start tracking your ratting sessions.
                We only request wallet read access - your account stays secure.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3 pb-6">
              <Button
                size="lg"
                onClick={() => handleLogin()}
                className="px-8"
                data-testid="button-login-eve"
              >
                Login with EVE Online
              </Button>
              {import.meta.env.DEV && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleLogin(true)}
                  className="text-xs"
                  data-testid="button-login-eve-real"
                >
                  Use Real EVE SSO (for ESI access)
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((feature) => (
              <Card key={feature.title} className="bg-card/50">
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="p-2 rounded-md bg-primary/10 shrink-0">
                    <feature.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-8 text-sm text-muted-foreground">
            <p>
              PHOTON uses EVE Online's official SSO for secure authentication.
              <br />
              We never see your password and only request minimal permissions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
