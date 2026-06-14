import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, AlertCircle, RefreshCw, Clock, AlertTriangle } from "lucide-react";
import { formatDistanceToNow, differenceInHours, format } from "date-fns";

interface SkillQueueWidgetProps {
  isAuthenticated: boolean;
  compact?: boolean;
}

export default function SkillQueueWidget({ isAuthenticated, compact = false }: SkillQueueWidgetProps) {
  const queryClient = useQueryClient();

  const { data: statusData, isLoading: statusLoading, isError: statusError } = useQuery({
    queryKey: ["skill-queue-status"],
    queryFn: async () => {
      const response = await fetch("/api/skills/queue/status");
      if (!response.ok) throw new Error("Failed to fetch skill queue status");
      return response.json();
    },
    enabled: isAuthenticated,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000, // 1 minute
  });

  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ["skill-queue"],
    queryFn: async () => {
      const response = await fetch("/api/skills/queue");
      if (!response.ok) throw new Error("Failed to fetch skill queue");
      return response.json();
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/skills/queue/sync", { method: "POST" });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to sync skill queue");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skill-queue"] });
      queryClient.invalidateQueries({ queryKey: ["skill-queue-status"] });
    },
  });

  if (!isAuthenticated) {
    return (
      <Card className="border-dashed h-full">
        <CardContent className="pt-6 h-full flex items-center justify-center">
          <div className="flex flex-col items-center justify-center text-center py-4">
            <GraduationCap className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">
              Login to view skill queue
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (statusLoading || queueLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Skill Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-24" />
        </CardContent>
      </Card>
    );
  }

  if (statusError) {
    return (
      <Card className="border-destructive h-full">
        <CardContent className="pt-6 h-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">Failed to load skill queue</p>
            <Button variant="outline" size="sm" onClick={() => syncMutation.mutate()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Sync from ESI
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const status = statusData || {};
  const queue = queueData?.queue || [];
  const isEmpty = status.isEmpty || queue.length === 0;
  const hoursRemaining = status.hoursRemaining || 0;
  const isLow = hoursRemaining > 0 && hoursRemaining < 24;

  // Calculate progress for current skill
  let progress = 0;
  if (status.currentSkill && queue[0]) {
    const skill = queue[0];
    if (skill.startDate && skill.finishDate) {
      const start = new Date(skill.startDate).getTime();
      const end = new Date(skill.finishDate).getTime();
      const now = Date.now();
      if (now >= start && now <= end) {
        progress = ((now - start) / (end - start)) * 100;
      }
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-medium">Skill Queue</CardTitle>
          {isEmpty && (
            <Badge variant="destructive" className="text-xs">
              Empty
            </Badge>
          )}
          {isLow && !isEmpty && (
            <Badge variant="secondary" className="text-xs text-yellow-500">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Low
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
            <AlertTriangle className="h-8 w-8 text-yellow-500 mb-2" />
            <p className="text-sm font-medium">Skill Queue Empty</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add skills to your queue in EVE
            </p>
          </div>
        ) : (
          <>
            {/* Current skill */}
            {status.currentSkill && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate">
                    {status.currentSkill.name}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    Level {status.currentSkill.level}
                  </Badge>
                </div>
                <Progress value={progress} className="h-2" />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground">
                    {Math.round(progress)}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {status.currentSkill.finishDate &&
                      formatDistanceToNow(new Date(status.currentSkill.finishDate), { addSuffix: true })}
                  </span>
                </div>
              </div>
            )}

            {/* Queue summary */}
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {queue.length} skill{queue.length !== 1 ? "s" : ""} in queue
              </span>
            </div>

            {/* Queue end time */}
            {status.queueEndsAt && (
              <div className="mt-2 p-2 bg-muted rounded-md">
                <p className="text-xs text-muted-foreground">Queue completes</p>
                <p className="text-sm font-medium">
                  {formatDistanceToNow(new Date(status.queueEndsAt), { addSuffix: true })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(status.queueEndsAt), "MMM d, HH:mm")}
                </p>
              </div>
            )}

            {/* Upcoming skills (non-compact) */}
            {!compact && queue.length > 1 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Coming up</p>
                {queue.slice(1, 4).map((skill: any, index: number) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="truncate text-muted-foreground">{skill.skillName}</span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      Lvl {skill.finishedLevel}
                    </Badge>
                  </div>
                ))}
                {queue.length > 4 && (
                  <p className="text-xs text-muted-foreground">
                    +{queue.length - 4} more...
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
