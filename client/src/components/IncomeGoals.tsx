import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Target, Settings, Check, TrendingUp, Calendar, CalendarDays, CalendarRange } from "lucide-react";
import { useCharacterView } from "@/contexts/CharacterViewContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface IncomeGoalsData {
  goals: {
    dailyTarget: number;
    weeklyTarget: number;
    monthlyTarget: number;
  };
  progress: {
    dailyEarned: number;
    weeklyEarned: number;
    monthlyEarned: number;
  };
}

function formatISK(value: number): string {
  if (value >= 1000000000) {
    return (value / 1000000000).toFixed(2) + "B";
  }
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + "M";
  }
  return value.toLocaleString();
}

function parseISKInput(value: string): number {
  const cleaned = value.replace(/[,\s]/g, "").toLowerCase();
  const match = cleaned.match(/^([\d.]+)(b|m|k)?$/);
  if (!match) return 0;
  
  const num = parseFloat(match[1]);
  const suffix = match[2];
  
  if (suffix === "b") return num * 1000000000;
  if (suffix === "m") return num * 1000000;
  if (suffix === "k") return num * 1000;
  return num;
}

interface GoalRowProps {
  label: string;
  icon: React.ElementType;
  target: number;
  earned: number;
  period: string;
}

function GoalRow({ label, icon: Icon, target, earned, period }: GoalRowProps) {
  const progress = target > 0 ? Math.min((earned / target) * 100, 100) : 0;
  const isComplete = earned >= target && target > 0;
  const remaining = Math.max(0, target - earned);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
          {isComplete && (
            <Badge variant="outline" className="text-xs bg-green-500/10 border-green-500/30 text-green-500">
              <Check className="w-3 h-3 mr-1" />
              Complete
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {progress.toFixed(0)}%
        </span>
      </div>
      <Progress 
        value={progress} 
        className={`h-2 ${isComplete ? "[&>div]:bg-green-500" : ""}`}
        data-testid={`progress-${period}-goal`}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="font-mono" data-testid={`text-${period}-earned`}>
          {formatISK(earned)} / {target > 0 ? formatISK(target) : "Not set"}
        </span>
        {target > 0 && !isComplete && (
          <span className="font-mono" data-testid={`text-${period}-remaining`}>
            {formatISK(remaining)} to go
          </span>
        )}
      </div>
    </div>
  );
}

interface IncomeGoalsProps {
  isAuthenticated?: boolean;
  isPro?: boolean;
}

export default function IncomeGoals({ isAuthenticated = false, isPro = false }: IncomeGoalsProps) {
  const { toast } = useToast();
  const { viewMode } = useCharacterView();
  const viewAll = viewMode === "all";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dailyInput, setDailyInput] = useState("");
  const [weeklyInput, setWeeklyInput] = useState("");
  const [monthlyInput, setMonthlyInput] = useState("");

  const { data, isLoading, error } = useQuery<IncomeGoalsData>({
    queryKey: ["/api/income-goals", { viewAll }],
    queryFn: async () => {
      const response = await fetch(`/api/income-goals${viewAll ? "?viewAll=true" : ""}`);
      if (!response.ok) {
        throw new Error(`${response.status}`);
      }
      return response.json();
    },
    enabled: isAuthenticated && isPro,
    staleTime: 30000,
  });

  const updateGoalsMutation = useMutation({
    mutationFn: async (goals: { dailyTarget: number; weeklyTarget: number; monthlyTarget: number }) => {
      return apiRequest("POST", "/api/income-goals", goals);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/income-goals"] });
      setDialogOpen(false);
      toast({
        title: "Goals Updated",
        description: "Your income goals have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save goals. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = () => {
    if (data?.goals) {
      setDailyInput(data.goals.dailyTarget > 0 ? formatISK(data.goals.dailyTarget) : "");
      setWeeklyInput(data.goals.weeklyTarget > 0 ? formatISK(data.goals.weeklyTarget) : "");
      setMonthlyInput(data.goals.monthlyTarget > 0 ? formatISK(data.goals.monthlyTarget) : "");
    }
    setDialogOpen(true);
  };

  const handleSaveGoals = () => {
    updateGoalsMutation.mutate({
      dailyTarget: parseISKInput(dailyInput),
      weeklyTarget: parseISKInput(weeklyInput),
      monthlyTarget: parseISKInput(monthlyInput),
    });
  };

  if (isLoading) {
    return (
      <Card className="h-full" data-testid="card-income-goals">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="w-4 h-4" />
            Income Goals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-2 w-full" />
        </CardContent>
      </Card>
    );
  }

  const goals = data?.goals || { dailyTarget: 0, weeklyTarget: 0, monthlyTarget: 0 };
  const progress = data?.progress || { dailyEarned: 0, weeklyEarned: 0, monthlyEarned: 0 };

  const hasAnyGoals = goals.dailyTarget > 0 || goals.weeklyTarget > 0 || goals.monthlyTarget > 0;

  return (
    <Card className="h-full" data-testid="card-income-goals">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            Income Goals
          </div>
          <div className="flex items-center gap-2">
            {viewAll && (
              <Badge variant="outline" className="text-xs">
                All Characters
              </Badge>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={handleOpenDialog}
                  data-testid="button-edit-goals"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="dialog-income-goals">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Set Income Goals
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Set your ISK earning targets. Use shortcuts like "100M" or "1B".
                  </p>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="daily-goal" className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Daily Goal
                      </Label>
                      <Input
                        id="daily-goal"
                        placeholder="e.g., 100M"
                        value={dailyInput}
                        onChange={(e) => setDailyInput(e.target.value)}
                        data-testid="input-daily-goal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="weekly-goal" className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4" />
                        Weekly Goal
                      </Label>
                      <Input
                        id="weekly-goal"
                        placeholder="e.g., 500M"
                        value={weeklyInput}
                        onChange={(e) => setWeeklyInput(e.target.value)}
                        data-testid="input-weekly-goal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="monthly-goal" className="flex items-center gap-2">
                        <CalendarRange className="w-4 h-4" />
                        Monthly Goal
                      </Label>
                      <Input
                        id="monthly-goal"
                        placeholder="e.g., 2B"
                        value={monthlyInput}
                        onChange={(e) => setMonthlyInput(e.target.value)}
                        data-testid="input-monthly-goal"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => setDialogOpen(false)}
                      data-testid="button-cancel-goals"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSaveGoals}
                      disabled={updateGoalsMutation.isPending}
                      data-testid="button-save-goals"
                    >
                      {updateGoalsMutation.isPending ? "Saving..." : "Save Goals"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasAnyGoals ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <TrendingUp className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              No goals set yet
            </p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleOpenDialog}
              data-testid="button-set-first-goals"
            >
              <Target className="w-4 h-4 mr-2" />
              Set Your First Goal
            </Button>
          </div>
        ) : (
          <>
            <GoalRow
              label="Daily"
              icon={Calendar}
              target={goals.dailyTarget}
              earned={progress.dailyEarned}
              period="daily"
            />
            <GoalRow
              label="Weekly"
              icon={CalendarDays}
              target={goals.weeklyTarget}
              earned={progress.weeklyEarned}
              period="weekly"
            />
            <GoalRow
              label="Monthly"
              icon={CalendarRange}
              target={goals.monthlyTarget}
              earned={progress.monthlyEarned}
              period="monthly"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
