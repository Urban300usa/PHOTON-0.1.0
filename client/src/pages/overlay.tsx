import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Play,
  Square,
  Plus,
  TrendingUp,
  Clock,
  Wallet,
  Settings,
  ExternalLink,
  Minus,
  X,
  GripHorizontal,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Session {
  id: string;
  characterId: number;
  characterName: string;
  startTime: string;
  endTime: string | null;
  totalIsk: number;
  iskPerHour: number;
  durationSeconds: number;
  isActive: boolean;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${secs}s`;
}

function formatIsk(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`;
  }
  return value.toLocaleString();
}

const QUICK_ADD_AMOUNTS = [
  { label: "1M", value: 1_000_000 },
  { label: "5M", value: 5_000_000 },
  { label: "10M", value: 10_000_000 },
  { label: "25M", value: 25_000_000 },
];

export default function OverlayPage() {
  const { isAuthenticated, character } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [elapsed, setElapsed] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [opacity, setOpacity] = useState(90);

  // Fetch active session
  const { data: sessionData, isLoading } = useQuery<{ session: Session | null }>({
    queryKey: ["/api/sessions/active"],
    enabled: isAuthenticated,
    refetchInterval: 5000,
  });

  const activeSession = sessionData?.session;

  // Update elapsed time
  useEffect(() => {
    if (!activeSession?.startTime) {
      setElapsed(0);
      return;
    }

    const startTime = new Date(activeSession.startTime).getTime();

    const updateElapsed = () => {
      const now = Date.now();
      setElapsed(Math.floor((now - startTime) / 1000));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [activeSession?.startTime]);

  // Start session mutation
  const startMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/sessions/start");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions/active"] });
      toast({ title: "Session Started" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Stop session mutation
  const stopMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/sessions/stop");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({ title: "Session Ended" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add income mutation
  const addIncomeMutation = useMutation({
    mutationFn: async (amount: number) => {
      const response = await apiRequest("POST", "/api/sessions/income", { amount });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions/active"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Calculate current ISK/hour
  const currentIskPerHour = activeSession && elapsed > 0
    ? Math.round((activeSession.totalIsk / elapsed) * 3600)
    : 0;

  // Handle window controls
  const handleClose = () => {
    window.close();
  };

  const handleOpenMain = () => {
    window.open("/", "_blank");
  };

  if (!isAuthenticated) {
    return (
      <div
        className="min-h-screen bg-background/95 flex items-center justify-center p-4"
        style={{ opacity: opacity / 100 }}
      >
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">Please log in to use the overlay</p>
          <Button className="mt-4" onClick={handleOpenMain}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open PHOTON
          </Button>
        </Card>
      </div>
    );
  }

  if (isMinimized) {
    return (
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center"
        style={{ opacity: opacity / 100 }}
      >
        <Card
          className="p-2 cursor-move flex items-center gap-2"
          onClick={() => setIsMinimized(false)}
        >
          <GripHorizontal className="h-4 w-4 text-muted-foreground" />
          {activeSession ? (
            <>
              <Badge variant="default" className="bg-green-500">
                {formatDuration(elapsed)}
              </Badge>
              <span className="text-sm font-mono font-bold">
                {formatIsk(activeSession.totalIsk)}
              </span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">No session</span>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background/95 backdrop-blur-sm p-2"
      style={{ opacity: opacity / 100 }}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <GripHorizontal className="h-4 w-4 text-muted-foreground cursor-move" />
          <span className="text-xs font-medium text-muted-foreground">PHOTON Overlay</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsMinimized(true)}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleOpenMain}
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleClose}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <Card className="p-3 space-y-3">
        {/* Session timer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-lg font-mono font-bold">
              {formatDuration(elapsed)}
            </span>
          </div>
          {activeSession ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
            >
              <Square className="h-3 w-3 mr-1" />
              Stop
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <Play className="h-3 w-3 mr-1" />
              Start
            </Button>
          )}
        </div>

        {/* Current ISK */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Session ISK</span>
          </div>
          <span className="text-lg font-mono font-bold text-primary">
            {formatIsk(activeSession?.totalIsk || 0)}
          </span>
        </div>

        {/* ISK/Hour */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="text-xs text-muted-foreground">ISK/Hour</span>
          </div>
          <span className="text-lg font-mono font-bold text-green-500">
            {formatIsk(currentIskPerHour)}
          </span>
        </div>

        {/* Quick add buttons */}
        {activeSession && (
          <div className="grid grid-cols-4 gap-1">
            {QUICK_ADD_AMOUNTS.map((amount) => (
              <Button
                key={amount.value}
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => addIncomeMutation.mutate(amount.value)}
                disabled={addIncomeMutation.isPending}
              >
                <Plus className="h-2.5 w-2.5 mr-0.5" />
                {amount.label}
              </Button>
            ))}
          </div>
        )}

        {/* Character info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>{character?.name || "Unknown"}</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="30"
              max="100"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-16 h-1 cursor-pointer"
              title="Opacity"
            />
            <span className="text-[10px]">{opacity}%</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
