import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Trophy, 
  Medal, 
  Crown, 
  Plus,
  Users,
  Globe,
  Lock,
  TrendingUp,
  Clock,
  Target,
  LogIn,
  LogOut,
  Trash2,
  Loader2
} from "lucide-react";

interface LeaderboardData {
  id: string;
  name: string;
  creatorCharacterId: number;
  creatorCharacterName: string;
  isPublic: boolean;
  rankBy: string;
  timeFrame: string;
  createdAt: string;
}

interface LeaderboardMember {
  id: string;
  leaderboardId: string;
  characterId: number;
  characterName: string;
  status: string;
  invitedAt: string;
}

interface LeaderboardRanking {
  rank: number;
  characterId: number;
  characterName: string;
  value: number;
  sessions: number;
}

function formatISK(value: number): string {
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

function getRankIcon(rank: number) {
  switch (rank) {
    case 1:
      return <Crown className="w-5 h-5 text-amber-400" />;
    case 2:
      return <Medal className="w-5 h-5 text-slate-400" />;
    case 3:
      return <Medal className="w-5 h-5 text-amber-600" />;
    default:
      return <span className="w-5 h-5 flex items-center justify-center text-sm text-muted-foreground">{rank}</span>;
  }
}

function getRankBgColor(rank: number): string {
  switch (rank) {
    case 1:
      return "bg-amber-500/10 border-amber-500/20";
    case 2:
      return "bg-slate-500/10 border-slate-500/20";
    case 3:
      return "bg-amber-600/10 border-amber-600/20";
    default:
      return "";
  }
}

interface LeaderboardProps {
  compact?: boolean;
}

export default function Leaderboard({ compact = false }: LeaderboardProps) {
  const { toast } = useToast();
  const { isAuthenticated, character } = useAuth();
  const [activeTab, setActiveTab] = useState("my");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedLeaderboard, setSelectedLeaderboard] = useState<string | null>(null);
  
  const [newLeaderboard, setNewLeaderboard] = useState({
    name: "",
    isPublic: true,
    rankBy: "total_isk",
    timeFrame: "all_time",
  });

  const { data: myLeaderboardsData, isLoading: isLoadingMy } = useQuery<{ leaderboards: LeaderboardData[] }>({
    queryKey: ["/api/user/leaderboards"],
    enabled: isAuthenticated,
  });

  const { data: publicLeaderboardsData, isLoading: isLoadingPublic } = useQuery<{ leaderboards: LeaderboardData[] }>({
    queryKey: ["/api/leaderboards"],
  });

  const { data: leaderboardDetails, isLoading: isLoadingDetails } = useQuery<{ 
    leaderboard: LeaderboardData; 
    rankings: LeaderboardRanking[]; 
    members: LeaderboardMember[] 
  }>({
    queryKey: ["/api/leaderboards", selectedLeaderboard],
    enabled: !!selectedLeaderboard,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newLeaderboard) => {
      return apiRequest("POST", "/api/leaderboards", data);
    },
    onSuccess: () => {
      toast({ title: "Leaderboard Created", description: "Your new leaderboard is ready!" });
      queryClient.invalidateQueries({ queryKey: ["/api/user/leaderboards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboards"] });
      setCreateDialogOpen(false);
      setNewLeaderboard({ name: "", isPublic: true, rankBy: "total_isk", timeFrame: "all_time" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create leaderboard", variant: "destructive" });
    },
  });

  const joinMutation = useMutation({
    mutationFn: async (leaderboardId: string) => {
      return apiRequest("POST", `/api/leaderboards/${leaderboardId}/join`);
    },
    onSuccess: () => {
      toast({ title: "Joined!", description: "You've joined the leaderboard" });
      queryClient.invalidateQueries({ queryKey: ["/api/user/leaderboards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboards", selectedLeaderboard] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to join leaderboard", variant: "destructive" });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async (leaderboardId: string) => {
      return apiRequest("POST", `/api/leaderboards/${leaderboardId}/leave`);
    },
    onSuccess: () => {
      toast({ title: "Left", description: "You've left the leaderboard" });
      queryClient.invalidateQueries({ queryKey: ["/api/user/leaderboards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboards", selectedLeaderboard] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to leave leaderboard", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (leaderboardId: string) => {
      return apiRequest("DELETE", `/api/leaderboards/${leaderboardId}`);
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Leaderboard has been deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/user/leaderboards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboards"] });
      setSelectedLeaderboard(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete leaderboard", variant: "destructive" });
    },
  });

  const myLeaderboards = myLeaderboardsData?.leaderboards || [];
  const publicLeaderboards = publicLeaderboardsData?.leaderboards || [];

  const handleCreate = () => {
    if (!newLeaderboard.name.trim()) {
      toast({ title: "Error", description: "Please enter a name for your leaderboard", variant: "destructive" });
      return;
    }
    createMutation.mutate(newLeaderboard);
  };

  const isMember = (leaderboard: LeaderboardData) => {
    if (!character) return false;
    return leaderboardDetails?.members?.some(
      m => m.characterId === character.id && m.status === "accepted"
    );
  };

  const isCreator = (leaderboard: LeaderboardData) => {
    if (!character) return false;
    return leaderboard.creatorCharacterId === character.id;
  };

  if (compact) {
    return (
      <Card data-testid="leaderboard-compact-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            Leaderboards
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoadingMy ? (
            <Skeleton className="h-20 w-full" />
          ) : myLeaderboards.length > 0 ? (
            <div className="space-y-2">
              {myLeaderboards.slice(0, 3).map(lb => (
                <div 
                  key={lb.id} 
                  className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/50"
                  data-testid={`leaderboard-item-${lb.id}`}
                >
                  <div className="flex items-center gap-2">
                    {lb.isPublic ? (
                      <Globe className="w-3 h-3 text-muted-foreground" />
                    ) : (
                      <Lock className="w-3 h-3 text-muted-foreground" />
                    )}
                    <span className="truncate max-w-[120px]">{lb.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {lb.rankBy === "total_isk" ? "ISK" : lb.rankBy === "isk_per_hour" ? "ISK/hr" : "Sessions"}
                  </Badge>
                </div>
              ))}
              {myLeaderboards.length > 3 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{myLeaderboards.length - 3} more
                </p>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-4">
              {isAuthenticated ? (
                <>
                  <p>No leaderboards yet</p>
                  <p className="text-xs mt-1">Create or join one to compete!</p>
                </>
              ) : (
                <p>Log in to view leaderboards</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full" data-testid="leaderboard-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Leaderboards
          </CardTitle>
          {isAuthenticated && (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-create-leaderboard">
                  <Plus className="w-4 h-4 mr-1" />
                  Create
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Leaderboard</DialogTitle>
                  <DialogDescription>
                    Create a new leaderboard to compete with other pilots.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="lb-name">Leaderboard Name</Label>
                    <Input
                      id="lb-name"
                      placeholder="e.g., Corp Ratters of the Month"
                      value={newLeaderboard.name}
                      onChange={(e) => setNewLeaderboard({ ...newLeaderboard, name: e.target.value })}
                      data-testid="input-leaderboard-name"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="lb-public">Public Leaderboard</Label>
                    <Switch
                      id="lb-public"
                      checked={newLeaderboard.isPublic}
                      onCheckedChange={(checked) => setNewLeaderboard({ ...newLeaderboard, isPublic: checked })}
                      data-testid="switch-leaderboard-public"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lb-rank-by">Rank By</Label>
                    <Select
                      value={newLeaderboard.rankBy}
                      onValueChange={(value) => setNewLeaderboard({ ...newLeaderboard, rankBy: value })}
                    >
                      <SelectTrigger id="lb-rank-by" data-testid="select-rank-by">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="total_isk">Total ISK Earned</SelectItem>
                        <SelectItem value="isk_per_hour">ISK Per Hour</SelectItem>
                        <SelectItem value="sessions">Total Sessions</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lb-time-frame">Time Frame</Label>
                    <Select
                      value={newLeaderboard.timeFrame}
                      onValueChange={(value) => setNewLeaderboard({ ...newLeaderboard, timeFrame: value })}
                    >
                      <SelectTrigger id="lb-time-frame" data-testid="select-time-frame">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="all_time">All Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    onClick={handleCreate} 
                    disabled={createMutation.isPending}
                    data-testid="button-confirm-create"
                  >
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Leaderboard"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <CardDescription>Compete with other pilots and climb the ranks</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="my" className="flex-1" data-testid="tab-my-leaderboards">
              <Users className="w-4 h-4 mr-1" />
              My Boards
            </TabsTrigger>
            <TabsTrigger value="public" className="flex-1" data-testid="tab-public-leaderboards">
              <Globe className="w-4 h-4 mr-1" />
              Public
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="my" className="mt-4">
            {!isAuthenticated ? (
              <div className="text-center py-8 text-muted-foreground">
                <Lock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Log in to view your leaderboards</p>
              </div>
            ) : isLoadingMy ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : myLeaderboards.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No leaderboards yet</p>
                <p className="text-sm mt-1">Create or join a leaderboard to start competing!</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {myLeaderboards.map(lb => (
                    <div 
                      key={lb.id}
                      className={`p-3 rounded-md border cursor-pointer transition-colors hover-elevate ${
                        selectedLeaderboard === lb.id ? "bg-accent border-accent" : "bg-card"
                      }`}
                      onClick={() => setSelectedLeaderboard(lb.id)}
                      data-testid={`leaderboard-my-${lb.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {lb.isPublic ? (
                            <Globe className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <Lock className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="font-medium">{lb.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {lb.rankBy === "total_isk" ? "ISK" : lb.rankBy === "isk_per_hour" ? "ISK/hr" : "Sessions"}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {lb.timeFrame.replace("_", " ")}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Created by {lb.creatorCharacterName}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="public" className="mt-4">
            {isLoadingPublic ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : publicLeaderboards.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Globe className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No public leaderboards yet</p>
                <p className="text-sm mt-1">Be the first to create one!</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {publicLeaderboards.map(lb => (
                    <div 
                      key={lb.id}
                      className={`p-3 rounded-md border cursor-pointer transition-colors hover-elevate ${
                        selectedLeaderboard === lb.id ? "bg-accent border-accent" : "bg-card"
                      }`}
                      onClick={() => setSelectedLeaderboard(lb.id)}
                      data-testid={`leaderboard-public-${lb.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{lb.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {lb.rankBy === "total_isk" ? "ISK" : lb.rankBy === "isk_per_hour" ? "ISK/hr" : "Sessions"}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Created by {lb.creatorCharacterName}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        {selectedLeaderboard && (
          <div className="mt-4 pt-4 border-t">
            {isLoadingDetails ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : leaderboardDetails ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">{leaderboardDetails.leaderboard.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {leaderboardDetails.members.length} member{leaderboardDetails.members.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {isAuthenticated && !isCreator(leaderboardDetails.leaderboard) && (
                      isMember(leaderboardDetails.leaderboard) ? (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => leaveMutation.mutate(selectedLeaderboard)}
                          disabled={leaveMutation.isPending}
                          data-testid="button-leave-leaderboard"
                        >
                          <LogOut className="w-4 h-4 mr-1" />
                          Leave
                        </Button>
                      ) : (
                        <Button 
                          size="sm" 
                          onClick={() => joinMutation.mutate(selectedLeaderboard)}
                          disabled={joinMutation.isPending}
                          data-testid="button-join-leaderboard"
                        >
                          <LogIn className="w-4 h-4 mr-1" />
                          Join
                        </Button>
                      )
                    )}
                    {isAuthenticated && isCreator(leaderboardDetails.leaderboard) && (
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        onClick={() => deleteMutation.mutate(selectedLeaderboard)}
                        disabled={deleteMutation.isPending}
                        data-testid="button-delete-leaderboard"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <h5 className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Rankings
                  </h5>
                  {leaderboardDetails.rankings.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      No rankings yet. Start ratting to compete!
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {leaderboardDetails.rankings.map(ranking => (
                        <div 
                          key={ranking.characterId}
                          className={`flex items-center justify-between p-2 rounded-md border ${getRankBgColor(ranking.rank)}`}
                          data-testid={`ranking-${ranking.characterId}`}
                        >
                          <div className="flex items-center gap-3">
                            {getRankIcon(ranking.rank)}
                            <span className="font-medium">{ranking.characterName}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-sm">
                              {leaderboardDetails.leaderboard.rankBy === "sessions" 
                                ? `${ranking.sessions} sessions`
                                : formatISK(ranking.value)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
