import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCharacterView } from "@/contexts/CharacterViewContext";
import {
  GraduationCap,
  AlertCircle,
  RefreshCw,
  Clock,
  AlertTriangle,
  Users,
  Bell,
  ChevronRight,
  ChevronDown,
  Plus,
  Target,
  Rocket,
  Zap,
  Search,
  BookOpen,
  Trash2,
  Check,
  PlayCircle,
  BarChart3,
  Brain,
  Crosshair,
} from "lucide-react";
import { formatDistanceToNow, format, differenceInHours } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// Types
interface TrainedSkill {
  skillId: number;
  skillName: string;
  trainedSkillLevel: number;
  activeSkillLevel: number;
  skillpointsInSkill: number;
}

interface SkillPlan {
  id: string;
  name: string;
  description?: string;
  goalType: string;
  goalTypeId?: number;
  goalTypeName?: string;
  isActive: boolean;
  priority: number;
  estimatedTrainingTime?: number;
}

interface SkillPlanItem {
  id: string;
  skillId: number;
  skillName: string;
  targetLevel: number;
  currentLevel: number;
  priority: number;
  isRequired: boolean;
  estimatedTrainingTime?: number;
}

interface OptimizedSkill {
  skillId: number;
  skillName: string;
  fromLevel: number;
  toLevel: number;
  trainingTime: number;
  isPrerequisite: boolean;
  priority: number;
}

interface CharacterAttributes {
  intelligence: number;
  memory: number;
  perception: number;
  willpower: number;
  charisma: number;
  totalSp?: number;
  unallocatedSp?: number;
}

// Helper function to format training time
function formatTrainingTime(seconds: number): string {
  if (!seconds || seconds <= 0) return "0m";

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

// Skill Planner Component
function SkillPlanner() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedShip, setSelectedShip] = useState<{ typeId: number; name: string; group: string } | null>(null);
  const [strategy, setStrategy] = useState<"shortest_first" | "prerequisites_first" | "balanced">("shortest_first");
  const [isCreatePlanOpen, setIsCreatePlanOpen] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [optimizedPlan, setOptimizedPlan] = useState<OptimizedSkill[] | null>(null);
  const [totalTrainingTime, setTotalTrainingTime] = useState(0);

  // Fetch trained skills
  const { data: trainedData, isLoading: trainedLoading } = useQuery({
    queryKey: ["trained-skills"],
    queryFn: async () => {
      const response = await fetch("/api/skills/trained");
      if (!response.ok) throw new Error("Failed to fetch trained skills");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch character attributes
  const { data: attributesData } = useQuery({
    queryKey: ["character-attributes"],
    queryFn: async () => {
      const response = await fetch("/api/skills/attributes");
      if (!response.ok) throw new Error("Failed to fetch attributes");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch skill plans
  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ["skill-plans"],
    queryFn: async () => {
      const response = await fetch("/api/skills/plans");
      if (!response.ok) throw new Error("Failed to fetch skill plans");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Check ship database status and populate if needed
  const { data: shipStatusData } = useQuery({
    queryKey: ["ship-database-status"],
    queryFn: async () => {
      const response = await fetch("/api/skills/ships/status");
      if (!response.ok) throw new Error("Failed to fetch ship database status");
      return response.json();
    },
    staleTime: Infinity, // Only check once per session
  });

  // Auto-populate ship database if empty
  const populateShipsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/skills/ships/populate", { method: "POST" });
      if (!response.ok) throw new Error("Failed to populate ship database");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ship-database-status"] });
      toast({
        title: "Ship Database Ready",
        description: `Loaded ${data.count} ships from EVE database`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Load Ships",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Trigger population when we detect empty database
  useEffect(() => {
    if (shipStatusData && !shipStatusData.populated && !populateShipsMutation.isPending) {
      console.log("[Ship Database] Database empty, triggering population...");
      populateShipsMutation.mutate();
    }
  }, [shipStatusData]);

  // Search ships
  const { data: shipSearchData, isLoading: shipSearchLoading } = useQuery({
    queryKey: ["ship-search", searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return { ships: [] };
      console.log(`[Frontend] Searching for ship: "${searchQuery}"`);
      const response = await fetch(`/api/skills/ships/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error("Failed to search ships");
      const data = await response.json();
      console.log(`[Frontend] Got ${data.ships?.length || 0} results`);
      return data;
    },
    enabled: searchQuery.length >= 2 && shipStatusData?.populated !== false,
  });

  // Get ship requirements
  const { data: shipReqData, isLoading: shipReqLoading } = useQuery({
    queryKey: ["ship-requirements", selectedShip?.typeId],
    queryFn: async () => {
      if (!selectedShip) return { requirements: [] };
      const response = await fetch(`/api/skills/ships/${selectedShip.typeId}/requirements`);
      if (!response.ok) throw new Error("Failed to fetch ship requirements");
      return response.json();
    },
    enabled: !!selectedShip,
  });

  // Sync trained skills mutation
  const syncTrainedMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/skills/trained/sync", { method: "POST" });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || "Failed to sync skills");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["trained-skills"] });
      queryClient.invalidateQueries({ queryKey: ["character-attributes"] });
      toast({
        title: "Skills Synced",
        description: `Synced ${data.synced} skills (${(data.totalSp / 1000000).toFixed(1)}M SP)`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message.includes("Dev mode")
          ? "Use Real EVE SSO login to sync skills from ESI"
          : error.message,
        variant: "destructive",
      });
    },
  });

  // Optimize plan mutation
  const optimizeMutation = useMutation({
    mutationFn: async (targetSkills: { skillId: number; targetLevel: number }[]) => {
      const response = await fetch("/api/skills/plans/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetSkills, strategy }),
      });
      if (!response.ok) throw new Error("Failed to optimize plan");
      return response.json();
    },
    onSuccess: (data) => {
      setOptimizedPlan(data.optimizedPlan);
      setTotalTrainingTime(data.totalTrainingTime);
    },
  });

  // Create plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async (data: { name: string; goalType: string; goalTypeId?: number; goalTypeName?: string; items: any[] }) => {
      const response = await fetch("/api/skills/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create plan");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skill-plans"] });
      setIsCreatePlanOpen(false);
      setNewPlanName("");
      toast({
        title: "Plan Created",
        description: "Your skill plan has been saved",
      });
    },
  });

  // Delete plan mutation
  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await fetch(`/api/skills/plans/${planId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete plan");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skill-plans"] });
      toast({
        title: "Plan Deleted",
        description: "Your skill plan has been removed",
      });
    },
  });

  const trainedSkills: TrainedSkill[] = trainedData?.skills || [];
  const trainedMap = new Map(trainedSkills.map(s => [s.skillId, s.trainedSkillLevel]));
  const plans: SkillPlan[] = plansData?.plans || [];
  const attributes: CharacterAttributes | null = attributesData?.attributes || null;
  const ships = shipSearchData?.ships || [];
  const shipRequirements = shipReqData?.requirements || [];

  // Handle ship selection and optimization
  const handleShipSelect = (ship: { shipTypeId: number; shipName: string; shipGroup: string }) => {
    setSelectedShip({ typeId: ship.shipTypeId, name: ship.shipName, group: ship.shipGroup });
    setSearchQuery("");
  };

  // Optimize for selected ship
  useEffect(() => {
    console.log("[Skill Planner] shipRequirements:", shipRequirements);
    console.log("[Skill Planner] trainedMap size:", trainedMap.size);

    if (shipRequirements.length > 0) {
      const targetSkills = shipRequirements
        .filter((req: any) => {
          const currentLevel = trainedMap.get(req.skillId) || 0;
          console.log(`[Skill Planner] ${req.skillName}: current=${currentLevel}, required=${req.requiredLevel}, need=${currentLevel < req.requiredLevel}`);
          return currentLevel < req.requiredLevel;
        })
        .map((req: any) => ({
          skillId: req.skillId,
          targetLevel: req.requiredLevel,
        }));

      console.log("[Skill Planner] targetSkills to train:", targetSkills);

      if (targetSkills.length > 0) {
        optimizeMutation.mutate(targetSkills);
      } else {
        setOptimizedPlan([]);
        setTotalTrainingTime(0);
      }
    }
  }, [shipRequirements, strategy]);

  // Save current optimization as a plan
  const handleSavePlan = () => {
    if (!selectedShip || !optimizedPlan || !newPlanName.trim()) return;

    createPlanMutation.mutate({
      name: newPlanName.trim(),
      goalType: "ship",
      goalTypeId: selectedShip.typeId,
      goalTypeName: selectedShip.name,
      items: optimizedPlan.map((skill, index) => ({
        skillId: skill.skillId,
        skillName: skill.skillName,
        targetLevel: skill.toLevel,
        currentLevel: skill.fromLevel,
        priority: index,
        isRequired: !skill.isPrerequisite,
        estimatedTrainingTime: skill.trainingTime,
      })),
    });
  };

  if (trainedLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Attributes Overview */}
      {attributes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Character Attributes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-500">{attributes.intelligence}</p>
                <p className="text-xs text-muted-foreground">Intelligence</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-500">{attributes.memory}</p>
                <p className="text-xs text-muted-foreground">Memory</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-500">{attributes.perception}</p>
                <p className="text-xs text-muted-foreground">Perception</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-500">{attributes.willpower}</p>
                <p className="text-xs text-muted-foreground">Willpower</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-pink-500">{attributes.charisma}</p>
                <p className="text-xs text-muted-foreground">Charisma</p>
              </div>
            </div>
            {attributes.totalSp && (
              <div className="mt-4 pt-4 border-t flex justify-between text-sm">
                <span className="text-muted-foreground">Total Skillpoints</span>
                <span className="font-medium">{(attributes.totalSp / 1000000).toFixed(2)}M SP</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ship Goal Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Ship Training Goal
          </CardTitle>
          <CardDescription>
            Select a ship to see what skills you need and get an optimized training plan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Ship database loading indicator */}
          {populateShipsMutation.isPending && (
            <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
              <span className="text-sm text-blue-500">Loading ship database from EVE... This may take a minute.</span>
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={populateShipsMutation.isPending ? "Loading ship database..." : "Search for a ship (e.g., Raven, Ishtar, Orca)..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                disabled={populateShipsMutation.isPending}
              />
              {searchQuery.length >= 2 && !populateShipsMutation.isPending && (
                <Card className="absolute z-10 w-full mt-1 max-h-60 overflow-auto">
                  <CardContent className="p-2">
                    {shipSearchLoading ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Searching...</div>
                    ) : ships.length > 0 ? (
                      ships.map((ship: any) => (
                        <button
                          key={ship.shipTypeId}
                          onClick={() => handleShipSelect(ship)}
                          className="w-full text-left px-3 py-2 rounded hover:bg-accent flex items-center justify-between"
                        >
                          <span>{ship.shipName}</span>
                          <Badge variant="outline">{ship.shipGroup}</Badge>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No ships found matching "{searchQuery}"
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
            <Button
              variant="outline"
              onClick={() => syncTrainedMutation.mutate()}
              disabled={syncTrainedMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncTrainedMutation.isPending ? "animate-spin" : ""}`} />
              Sync Skills
            </Button>
          </div>

          {selectedShip && (
            <div className="p-4 bg-accent/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{selectedShip.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedShip.group}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedShip(null)}>
                  Clear
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Optimization Strategy & Results */}
      {selectedShip && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Training Plan for {selectedShip.name}
              </CardTitle>
              <Select value={strategy} onValueChange={(v: any) => setStrategy(v)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shortest_first">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Shortest First
                    </div>
                  </SelectItem>
                  <SelectItem value="prerequisites_first">
                    <div className="flex items-center gap-2">
                      <ChevronRight className="h-4 w-4" />
                      Prerequisites First
                    </div>
                  </SelectItem>
                  <SelectItem value="balanced">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Balanced
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {optimizedPlan && optimizedPlan.length > 0 && (
              <CardDescription>
                {optimizedPlan.length} skills to train • Total time: {formatTrainingTime(totalTrainingTime)}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {shipReqLoading || optimizeMutation.isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : optimizedPlan && optimizedPlan.length === 0 ? (
              <div className="text-center py-8">
                <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="font-medium">You can fly this ship!</h3>
                <p className="text-sm text-muted-foreground">
                  You already have all the required skills trained
                </p>
              </div>
            ) : optimizedPlan ? (
              <div className="space-y-4">
                <ScrollArea className="h-80">
                  <div className="space-y-2 pr-4">
                    {optimizedPlan.map((skill, index) => {
                      const currentLevel = trainedMap.get(skill.skillId) || 0;
                      return (
                        <div
                          key={`${skill.skillId}-${skill.toLevel}`}
                          className={`p-3 rounded-lg border ${skill.isPrerequisite ? "border-dashed bg-muted/30" : "bg-accent/30"}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-6">#{index + 1}</span>
                              {skill.isPrerequisite && (
                                <Badge variant="outline" className="text-xs">Prereq</Badge>
                              )}
                              <span className="font-medium">{skill.skillName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">
                                {currentLevel} → {skill.toLevel}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {formatTrainingTime(skill.trainingTime)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Total Training Time</p>
                    <p className="text-2xl font-bold">{formatTrainingTime(totalTrainingTime)}</p>
                  </div>
                  <Dialog open={isCreatePlanOpen} onOpenChange={setIsCreatePlanOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Save as Plan
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Save Training Plan</DialogTitle>
                        <DialogDescription>
                          Save this optimized training plan for {selectedShip.name}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <Label htmlFor="plan-name">Plan Name</Label>
                        <Input
                          id="plan-name"
                          placeholder={`${selectedShip.name} Training`}
                          value={newPlanName}
                          onChange={(e) => setNewPlanName(e.target.value)}
                          className="mt-2"
                        />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreatePlanOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSavePlan}
                          disabled={!newPlanName.trim() || createPlanMutation.isPending}
                        >
                          Save Plan
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a ship to see training requirements</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Saved Plans */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Saved Plans
          </CardTitle>
          <CardDescription>
            Your saved skill training plans
          </CardDescription>
        </CardHeader>
        <CardContent>
          {plansLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No saved plans yet</p>
              <p className="text-sm">Select a ship goal above to create your first plan</p>
            </div>
          ) : (
            <div className="space-y-3">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`p-4 rounded-lg border ${plan.isActive ? "border-primary bg-primary/5" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {plan.isActive && (
                          <Badge variant="default" className="text-xs">Active</Badge>
                        )}
                        <h4 className="font-medium">{plan.name}</h4>
                      </div>
                      {plan.goalTypeName && (
                        <p className="text-sm text-muted-foreground">
                          Goal: {plan.goalTypeName}
                        </p>
                      )}
                      {plan.estimatedTrainingTime && (
                        <p className="text-xs text-muted-foreground">
                          Est. time: {formatTrainingTime(plan.estimatedTrainingTime)}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deletePlanMutation.mutate(plan.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trained Skills Summary */}
      <Collapsible>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Trained Skills ({trainedSkills.length})
                </CardTitle>
                <ChevronDown className="h-4 w-4" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-1">
                  {trainedSkills
                    .sort((a, b) => a.skillName.localeCompare(b.skillName))
                    .map((skill) => (
                      <div
                        key={skill.skillId}
                        className="flex items-center justify-between py-1 px-2 rounded hover:bg-accent/50"
                      >
                        <span className="text-sm">{skill.skillName}</span>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((level) => (
                              <div
                                key={level}
                                className={`w-2 h-4 rounded-sm ${
                                  level <= skill.trainedSkillLevel
                                    ? "bg-primary"
                                    : "bg-muted"
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground w-8">
                            Lv{skill.trainedSkillLevel}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}

export default function SkillsPage() {
  const queryClient = useQueryClient();
  const { viewMode } = useCharacterView();
  const [alertHours, setAlertHours] = useState(24);

  const { data: statusData, isLoading: statusLoading, isError: statusError } = useQuery({
    queryKey: ["skill-queue-status"],
    queryFn: async () => {
      const response = await fetch("/api/skills/queue/status");
      if (!response.ok) throw new Error("Failed to fetch skill queue status");
      return response.json();
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ["skill-queue", viewMode],
    queryFn: async () => {
      const params = viewMode === "all" ? "?viewAll=true" : "";
      const response = await fetch(`/api/skills/queue${params}`);
      if (!response.ok) throw new Error("Failed to fetch skill queue");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: alertsData } = useQuery({
    queryKey: ["skill-queue-alerts"],
    queryFn: async () => {
      const response = await fetch("/api/skills/alerts");
      if (!response.ok) throw new Error("Failed to fetch alerts");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
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

  const alertsMutation = useMutation({
    mutationFn: async (data: { alertOnEmpty: boolean; alertHoursBeforeEmpty: number }) => {
      const response = await fetch("/api/skills/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update alerts");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skill-queue-alerts"] });
    },
  });

  const isLoading = statusLoading || queueLoading;
  const status = statusData || {};
  const queue = queueData?.queue || [];
  const alerts = alertsData?.alerts || { alertOnEmpty: true, alertHoursBeforeEmpty: 24 };

  // Group skills by character for multi-character view
  const skillsByCharacter = queue.reduce((acc: any, skill: any) => {
    const key = skill.characterName || "Unknown";
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(skill);
    return acc;
  }, {});

  // Calculate progress for a skill
  const getSkillProgress = (skill: any) => {
    if (!skill.startDate || !skill.finishDate) return 0;
    const start = new Date(skill.startDate).getTime();
    const end = new Date(skill.finishDate).getTime();
    const now = Date.now();
    if (now < start) return 0;
    if (now > end) return 100;
    return ((now - start) / (end - start)) * 100;
  };

  // Check if skill is currently training
  const isTraining = (skill: any) => {
    if (!skill.startDate || !skill.finishDate) return false;
    const now = Date.now();
    return now >= new Date(skill.startDate).getTime() && now < new Date(skill.finishDate).getTime();
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Skills</h1>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Skills</h1>
            <p className="text-sm text-muted-foreground">
              Track training and plan your skill goals
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === "all" && (
            <Badge variant="secondary">
              <Users className="h-3 w-3 mr-1" />
              All Characters
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            Sync Queue
          </Button>
        </div>
      </div>

      {statusError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">Failed to load skill queue</p>
                <p className="text-sm">Click "Sync from ESI" to fetch your skill data</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Queue Status</CardTitle>
          </CardHeader>
          <CardContent>
            {status.isEmpty ? (
              <div className="flex items-center gap-2 text-yellow-500">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-lg font-bold">Empty</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-500">
                <Clock className="h-5 w-5" />
                <span className="text-lg font-bold">{queue.length} Skills</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Time Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            {status.queueEndsAt ? (
              <>
                <p className="text-lg font-bold">
                  {Math.floor(status.hoursRemaining / 24)}d {Math.floor(status.hoursRemaining % 24)}h
                </p>
                <p className="text-xs text-muted-foreground">
                  Completes {format(new Date(status.queueEndsAt), "MMM d, HH:mm")}
                </p>
              </>
            ) : (
              <p className="text-lg font-bold text-muted-foreground">--</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Currently Training</CardTitle>
          </CardHeader>
          <CardContent>
            {status.currentSkill ? (
              <>
                <p className="text-lg font-bold truncate">{status.currentSkill.name}</p>
                <p className="text-xs text-muted-foreground">
                  Level {status.currentSkill.level} •{" "}
                  {formatDistanceToNow(new Date(status.currentSkill.finishDate), { addSuffix: true })}
                </p>
              </>
            ) : (
              <p className="text-lg font-bold text-muted-foreground">No skill training</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="queue" className="w-full">
        <TabsList>
          <TabsTrigger value="queue">Skill Queue</TabsTrigger>
          <TabsTrigger value="planner" className="flex items-center gap-1">
            <Target className="h-3 w-3" />
            Planner
          </TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-4">
          {queue.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center text-center py-8">
                  <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
                  <h3 className="text-lg font-medium">Skill Queue Empty</h3>
                  <p className="text-muted-foreground mt-1">
                    Add skills to your training queue in EVE Online
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : viewMode === "all" ? (
            // Multi-character view
            <div className="space-y-6">
              {Object.entries(skillsByCharacter).map(([charName, skills]: [string, any]) => (
                <Card key={charName}>
                  <CardHeader>
                    <CardTitle className="text-lg">{charName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {skills.map((skill: any, index: number) => {
                        const progress = getSkillProgress(skill);
                        const training = isTraining(skill);
                        return (
                          <div
                            key={`${skill.skillId}-${index}`}
                            className={`p-4 rounded-lg border ${training ? "border-primary bg-primary/5" : "border-border"}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {training && (
                                  <Badge variant="default" className="text-xs">
                                    Training
                                  </Badge>
                                )}
                                <span className="font-medium">{skill.skillName}</span>
                              </div>
                              <Badge variant="outline">Level {skill.finishedLevel}</Badge>
                            </div>
                            <Progress value={progress} className="h-2 mb-2" />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{Math.round(progress)}% complete</span>
                              {skill.finishDate && (
                                <span>
                                  {formatDistanceToNow(new Date(skill.finishDate), { addSuffix: true })}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            // Single character view
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {queue.map((skill: any, index: number) => {
                    const progress = getSkillProgress(skill);
                    const training = isTraining(skill);
                    return (
                      <div
                        key={`${skill.skillId}-${index}`}
                        className={`p-4 rounded-lg border ${training ? "border-primary bg-primary/5" : "border-border"}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-sm w-6">#{index + 1}</span>
                            {training && (
                              <Badge variant="default" className="text-xs">
                                Training
                              </Badge>
                            )}
                            <span className="font-medium">{skill.skillName}</span>
                          </div>
                          <Badge variant="outline">Level {skill.finishedLevel}</Badge>
                        </div>
                        <Progress value={progress} className="h-2 mb-2" />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{Math.round(progress)}% complete</span>
                          {skill.finishDate && (
                            <span>
                              {formatDistanceToNow(new Date(skill.finishDate), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="planner" className="mt-4">
          <SkillPlanner />
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Alert Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Alert when queue is empty</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when your skill queue becomes empty
                  </p>
                </div>
                <Switch
                  checked={alerts.alertOnEmpty}
                  onCheckedChange={(checked) =>
                    alertsMutation.mutate({
                      alertOnEmpty: checked,
                      alertHoursBeforeEmpty: alerts.alertHoursBeforeEmpty,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Alert hours before empty</Label>
                <p className="text-sm text-muted-foreground">
                  Get an alert when your queue has less than this many hours remaining
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={168}
                    value={alerts.alertHoursBeforeEmpty}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (value >= 1 && value <= 168) {
                        alertsMutation.mutate({
                          alertOnEmpty: alerts.alertOnEmpty,
                          alertHoursBeforeEmpty: value,
                        });
                      }
                    }}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">hours</span>
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> Browser notifications must be enabled for alerts to work.
                  Alerts are checked when you have the app open.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
