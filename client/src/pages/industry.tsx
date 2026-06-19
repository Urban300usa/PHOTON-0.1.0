import { useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Factory, 
  RefreshCw, 
  Clock,
  Coins,
  AlertCircle,
  Wrench,
  FlaskConical,
  Lightbulb,
  Atom,
  Timer,
  TrendingUp,
  CheckCircle2,
  PlayCircle,
  Package,
  Calendar,
  User
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useCharacterView } from "@/contexts/CharacterViewContext";
import { EveIcon } from "@/components/EveIcon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow, differenceInSeconds, format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface IndustryJob {
  id: string;
  characterId: number;
  characterName: string;
  jobId: number;
  activityId: number;
  blueprintId: number;
  blueprintTypeId: number;
  blueprintTypeName: string;
  productTypeId: number | null;
  productTypeName: string | null;
  facilityId: number | null;
  stationId: number | null;
  locationName: string | null;
  runs: number;
  licensedRuns: number | null;
  probability: number | null;
  successfulRuns: number | null;
  startDate: string;
  endDate: string;
  completedDate: string | null;
  status: string;
  cost: number | null;
  materialCost: number | null;
  outputValue: number | null;
  estimatedProfit: number | null;
  iskPerHour: number | null;
  cachedAt: string;
  updatedAt: string;
}

interface IndustryStats {
  activeJobs: number;
  completedToday: number;
  totalProfit: number;
  avgIskPerHour: number;
}

interface JobsResponse {
  jobs: IndustryJob[];
  characterId?: number;
  characterIds?: number[];
}

interface SyncResult {
  characterId: number;
  success: boolean;
  reason?: string;
  jobCount?: number;
}

interface SyncResponse {
  success: boolean;
  results: SyncResult[];
}

const ACTIVITY_CONFIG: Record<number, { name: string; icon: typeof Factory; color: string }> = {
  1: { name: "Manufacturing", icon: Factory, color: "text-blue-500" },
  3: { name: "TE Research", icon: Timer, color: "text-green-500" },
  4: { name: "ME Research", icon: Wrench, color: "text-green-500" },
  5: { name: "Copying", icon: Package, color: "text-purple-500" },
  7: { name: "Reverse Engineering", icon: FlaskConical, color: "text-amber-500" },
  8: { name: "Invention", icon: Lightbulb, color: "text-yellow-500" },
  9: { name: "Reactions", icon: Atom, color: "text-cyan-500" },
  11: { name: "Reactions", icon: Atom, color: "text-cyan-500" },
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  active: { label: "In Progress", variant: "default", icon: PlayCircle },
  ready: { label: "Ready", variant: "secondary", icon: CheckCircle2 },
  delivered: { label: "Delivered", variant: "outline", icon: Package },
  cancelled: { label: "Cancelled", variant: "destructive", icon: AlertCircle },
  paused: { label: "Paused", variant: "secondary", icon: Clock },
  reverted: { label: "Reverted", variant: "destructive", icon: AlertCircle },
};

function formatISK(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0";
  if (value >= 1000000000) {
    return (value / 1000000000).toFixed(2) + "B";
  }
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + "M";
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + "K";
  }
  return value.toLocaleString();
}

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getJobProgress(job: IndustryJob): number {
  if (job.status === 'delivered' || job.status === 'ready') return 100;
  if (job.status === 'cancelled' || job.status === 'reverted') return 0;
  
  const start = new Date(job.startDate).getTime();
  const end = new Date(job.endDate).getTime();
  const now = Date.now();
  
  if (now >= end) return 100;
  if (now <= start) return 0;
  
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
}

function getTimeRemaining(job: IndustryJob): string {
  if (job.status === 'delivered' || job.status === 'ready') return 'Complete';
  if (job.status === 'cancelled' || job.status === 'reverted') return 'N/A';
  
  const end = new Date(job.endDate);
  const now = new Date();
  
  if (now >= end) return 'Ready';
  
  const seconds = differenceInSeconds(end, now);
  return formatDuration(seconds);
}

function JobCard({ job, showCharacter }: { job: IndustryJob; showCharacter: boolean }) {
  const activity = ACTIVITY_CONFIG[job.activityId] || { name: "Unknown", icon: Factory, color: "text-muted-foreground" };
  const status = STATUS_CONFIG[job.status] || { label: job.status, variant: "secondary" as const, icon: Clock };
  const ActivityIcon = activity.icon;
  const StatusIcon = status.icon;
  const progress = getJobProgress(job);
  const timeRemaining = getTimeRemaining(job);
  
  return (
    <Card className="hover-elevate" data-testid={`card-job-${job.jobId}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <EveIcon 
              typeId={job.productTypeId || job.blueprintTypeId} 
              size={32} 
              className="flex-shrink-0" 
              alt={job.productTypeName || job.blueprintTypeName} 
            />
            <div className="min-w-0">
              <p className="font-medium text-sm truncate" data-testid={`text-job-blueprint-${job.jobId}`}>
                {job.productTypeName || job.blueprintTypeName}
              </p>
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                <ActivityIcon className={`h-3 w-3 ${activity.color}`} />
                {activity.name}
              </p>
            </div>
          </div>
          <Badge variant={status.variant} className="flex-shrink-0">
            <StatusIcon className="h-3 w-3 mr-1" />
            {status.label}
          </Badge>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {job.runs} run{job.runs !== 1 ? 's' : ''}
            </span>
            <span className="font-mono">{timeRemaining}</span>
          </div>
          
          <Progress value={progress} className="h-2" />
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 cursor-help">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(job.startDate), 'MMM d')}
                </span>
              </TooltipTrigger>
              <TooltipContent>{format(new Date(job.startDate), 'PPpp')}</TooltipContent>
            </Tooltip>
            {showCharacter && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 cursor-help">
                    <User className="h-3 w-3" />
                    {job.characterName.split(' ')[0]}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{job.characterName}</TooltipContent>
              </Tooltip>
            )}
          </div>
          
          {job.cost !== null && (
            <div className="flex items-center justify-between text-xs pt-1 border-t">
              <span className="text-muted-foreground">Install Cost</span>
              <span className="font-mono">{formatISK(job.cost)} ISK</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatsCard({ icon: Icon, title, value, subtitle, className }: {
  icon: typeof Factory;
  title: string;
  value: string | number;
  subtitle?: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-xl font-bold font-mono">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function IndustryPage() {
  const { character, isAuthenticated } = useAuth();
  const { viewMode } = useCharacterView();
  const [activeTab, setActiveTab] = useState<string>("active");
  const viewAll = viewMode === "all";
  
  const { data: jobsData, isLoading: jobsLoading, isError: jobsError, refetch: refetchJobs } = useQuery<JobsResponse>({
    queryKey: ['/api/industry/jobs', viewAll],
    queryFn: async () => {
      const res = await fetch(`/api/industry/jobs?viewAll=${viewAll}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch jobs');
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useQuery<IndustryStats>({
    queryKey: ['/api/industry/stats', viewAll],
    queryFn: async () => {
      const res = await fetch(`/api/industry/stats?viewAll=${viewAll}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/industry/sync?viewAll=${viewAll}&includeCompleted=true`);
      return response.json() as Promise<SyncResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/industry/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/industry/stats'] });
    },
  });

  const hasError = jobsError || statsError;

  const jobs = jobsData?.jobs || [];
  
  const filteredJobs = useMemo(() => {
    if (activeTab === "active") {
      return jobs.filter(j => j.status === 'active' || j.status === 'ready');
    }
    if (activeTab === "completed") {
      return jobs.filter(j => j.status === 'delivered');
    }
    return jobs;
  }, [jobs, activeTab]);

  const jobsByActivity = useMemo(() => {
    const grouped: Record<number, IndustryJob[]> = {};
    for (const job of filteredJobs) {
      if (!grouped[job.activityId]) {
        grouped[job.activityId] = [];
      }
      grouped[job.activityId].push(job);
    }
    return grouped;
  }, [filteredJobs]);

  const activeJobCount = jobs.filter(j => j.status === 'active' || j.status === 'ready').length;
  const completedJobCount = jobs.filter(j => j.status === 'delivered').length;

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center" data-testid="industry-unauthenticated">
        <Factory className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Industry Job Tracker</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Track your manufacturing, research, invention, and reaction jobs. 
          See progress, calculate profits, and manage your industrial empire.
        </p>
        <Link href="/">
          <Button data-testid="button-login-industry">Login with EVE Online</Button>
        </Link>
      </div>
    );
  }

  const scopeNotGranted = syncMutation.data?.results?.some(r => r.reason === 'scope_not_granted');

  return (
    <div className="p-4 md:p-6 space-y-6" data-testid="industry-page">
      <PageHeader
        icon={Factory}
        title="Industry Jobs"
        subtitle="Track manufacturing, research, invention, and reactions"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            data-testid="button-sync-industry"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            {syncMutation.isPending ? 'Syncing...' : 'Sync from ESI'}
          </Button>
        }
      />

      {hasError && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Failed to load industry data</p>
              <p className="text-xs text-muted-foreground mt-1">
                There was an error fetching your industry jobs. Try syncing from ESI or refreshing the page.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => { refetchJobs(); refetchStats(); }}
                data-testid="button-retry-industry"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {scopeNotGranted && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Industry scope not granted</p>
              <p className="text-xs text-muted-foreground mt-1">
                To track industry jobs, you need to re-authenticate with the industry jobs permission.
                Log out and log back in to grant the required scope.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsLoading ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : (
          <>
            <StatsCard
              icon={PlayCircle}
              title="Active Jobs"
              value={stats?.activeJobs ?? activeJobCount}
              subtitle="In progress"
            />
            <StatsCard
              icon={CheckCircle2}
              title="Completed Today"
              value={stats?.completedToday ?? 0}
              subtitle="Delivered"
            />
            <StatsCard
              icon={TrendingUp}
              title="Total Profit"
              value={formatISK(stats?.totalProfit ?? 0)}
              subtitle="All time"
            />
            <StatsCard
              icon={Coins}
              title="Avg ISK/Hour"
              value={formatISK(stats?.avgIskPerHour ?? 0)}
              subtitle="Per job"
            />
          </>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="active" data-testid="tab-active-jobs">
            Active ({activeJobCount})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed-jobs">
            Completed ({completedJobCount})
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all-jobs">
            All ({jobs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-6">
          {jobsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : filteredJobs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Factory className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {activeTab === "active" 
                    ? "No active industry jobs. Click 'Sync from ESI' to fetch your jobs."
                    : activeTab === "completed"
                    ? "No completed jobs found."
                    : "No industry jobs found. Click 'Sync from ESI' to fetch your jobs."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(jobsByActivity).map(([activityId, activityJobs]) => {
                const activity = ACTIVITY_CONFIG[parseInt(activityId)] || { name: "Other", icon: Factory, color: "text-muted-foreground" };
                const ActivityIcon = activity.icon;
                
                return (
                  <div key={activityId} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <ActivityIcon className={`h-5 w-5 ${activity.color}`} />
                      <h3 className="font-semibold">{activity.name}</h3>
                      <Badge variant="secondary">{activityJobs.length}</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activityJobs.map(job => (
                        <JobCard key={job.id} job={job} showCharacter={viewAll} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="text-xs text-muted-foreground text-center pt-4 border-t">
        Feature inspired by EVE Guru and EVE Cookbook
      </div>
    </div>
  );
}
