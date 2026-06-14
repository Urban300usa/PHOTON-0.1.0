import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Shield, ShieldOff, Server, Users, Activity, Crown, Gift, Check, RefreshCw, Clock, X, Plus, History, Award, Rocket, Heart, FlaskConical, Star, Sparkles, Trash2, Gem, Video, Building2, ChevronsUp, Trophy, HandHelping, Flag, Palette, LayoutGrid, UserPlus, UserMinus, Timer, Zap, HardDrive, Search, Edit, ChevronLeft, ChevronRight, Power, ArrowLeft, Copy, MessageSquare, Bug, Lightbulb, User, CreditCard, HelpCircle, Loader2, AlertCircle, CheckCircle, FileText, GraduationCap, ScrollText, Moon, Wrench } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { SPECIAL_BADGE_TYPES, FACTION_THEMES, BONUS_TILES, type SpecialBadgeType, type FactionTheme, type BonusTile } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ProSubscription, ProActivationCode, ProGift } from "@shared/schema";
import { AdminTutorialProvider, useAdminTutorial } from "@/contexts/TutorialContext";
import AdminTutorialOverlay from "@/components/AdminTutorialOverlay";
import MoonCalculatorPage from "@/pages/moon-calculator";

interface DynamicAdmin {
  characterId: number;
  characterName: string;
  addedBy: number;
  addedByName: string;
  addedAt: Date;
}

interface AdminInfo {
  adminCharacterId: number;
  adminCharacterName: string;
  isSuperAdmin: boolean;
  configuredAdminIds: number[];
  superAdminIds: number[];
  dynamicAdmins: DynamicAdmin[];
  serverTime: string;
}

interface AdminStatistics {
  totalSubscriptions: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  pendingCodes: number;
  usedCodes: number;
  totalGifts: number;
  processedTransactions: number;
}

interface SupportTicket {
  id: string;
  ticketNumber: number;
  characterId: number;
  characterName: string;
  corporationId: number | null;
  corporationName: string | null;
  allianceId: number | null;
  allianceName: string | null;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  attachments: { filename: string; url: string; size: number; type: string }[];
  isPro: boolean;
  adminNotes: string | null;
  assignedToAdminId: number | null;
  assignedToAdminName: string | null;
  resolvedAt: string | null;
  resolvedByAdminId: number | null;
  resolvedByAdminName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TicketReply {
  id: string;
  ticketId: string;
  characterId: number;
  characterName: string;
  message: string;
  isAdmin: boolean;
  attachments: { filename: string; url: string; size: number; type: string }[];
  createdAt: string;
}

interface TicketStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
}

interface TicketNotification {
  id: number;
  ticketId: string;
  replyId: string | null;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationEmail {
  id: string;
  email: string;
  addedByCharacterId: number;
  addedByCharacterName: string;
  isActive: boolean;
  addedAt: string;
}

interface AdminUserListItem {
  characterId: number;
  characterName: string;
  corporationId: number | null;
  corporationName: string | null;
  allianceId: number | null;
  allianceName: string | null;
  isPro: boolean;
  proExpiresAt: string | null;
  isSuspended: boolean;
  suspensionReason: string | null;
  suspendedUntil: string | null;
  totalSessions: number;
  totalIsk: number;
  lastSeen: string | null;
  registeredAt: string | null;
  badgeCount: number;
}

interface AdminUserDetail {
  characterId: number;
  characterName: string;
  corporationId: number | null;
  corporationName: string | null;
  allianceId: number | null;
  allianceName: string | null;
  isPro: boolean;
  proStatus: string;
  proExpiresAt: string | null;
  proActivatedAt: string | null;
  isSuspended: boolean;
  isAdmin: boolean;
  totalSessions: number;
  totalIsk: number;
  totalKills: number;
  avgIskPerHour: number;
  registeredAt: string | null;
  lastSeen: string | null;
  activeSuspension: {
    id: string;
    reason: string;
    createdAt: string;
    expiresAt: string | null;
    suspendedByAdminId: number;
    suspendedByAdminName: string;
  } | null;
  recentSessions: {
    id: string;
    startTime: string;
    endTime: string | null;
    totalIsk: number;
    killCount: number;
    isActive: boolean;
  }[];
  badges: {
    id: string;
    badgeType: string;
    grantedAt: string;
    grantedByAdminName: string;
    note: string | null;
  }[];
  notes: {
    id: string;
    note: string;
    createdAt: string;
    createdByAdminId: number;
    createdByAdminName: string;
  }[];
  suspensionHistory: {
    id: string;
    reason: string;
    createdAt: string;
    expiresAt: string | null;
    liftedAt: string | null;
    suspendedByAdminName: string;
    liftedByAdminName: string | null;
    liftReason: string | null;
  }[];
  auditLog: {
    id: string;
    action: string;
    details: Record<string, unknown>;
    createdAt: string;
    adminCharacterName: string;
  }[];
}

interface AdminUserStats {
  totalUsers: number;
  proUsers: number;
  suspendedUsers: number;
  activeToday: number;
}

interface ChangelogVersion {
  id: string;
  version: string;
  title: string;
  releaseDate: string;
  isPublished: boolean;
  createdAt: string;
  publishedAt: string | null;
  createdByAdminId: number | null;
  createdByAdminName: string | null;
  items: ChangelogItem[];
}

interface ChangelogItem {
  id: string;
  versionId: string;
  changeType: string;
  iconKey: string | null;
  text: string;
  sortOrder: number;
  isProOnly: boolean;
  isAdminOnly: boolean;
  createdAt: string;
}

const CHANGE_TYPES = [
  { value: "feature", label: "New Feature", color: "text-green-500" },
  { value: "improvement", label: "Improvement", color: "text-blue-500" },
  { value: "fix", label: "Bug Fix", color: "text-yellow-500" },
  { value: "removed", label: "Removed", color: "text-red-500" },
  { value: "pro", label: "PRO Feature", color: "text-purple-500" },
];

const ICON_OPTIONS = [
  { value: "none", label: "None" },
  { value: "rocket", label: "Rocket" },
  { value: "star", label: "Star" },
  { value: "sparkles", label: "Sparkles" },
  { value: "crown", label: "Crown" },
  { value: "gift", label: "Gift" },
  { value: "zap", label: "Zap" },
  { value: "heart", label: "Heart" },
  { value: "check", label: "Check" },
  { value: "wrench", label: "Wrench" },
  { value: "bug", label: "Bug" },
  { value: "shield", label: "Shield" },
  { value: "gem", label: "Gem" },
];

interface GitCommit {
  hash: string;
  date: string;
  message: string;
  type: string;
}

interface GitCommitsData {
  commits: GitCommit[];
  currentVersion: string;
  nextVersions: { patch: string; minor: string; major: string };
  lastPublished: string | null;
}

interface ReleaseItem {
  id: string;
  description: string;
  type: string;
  selected: boolean;
  isProOnly: boolean;
  isAdminOnly: boolean;
}

function ChangelogManagement() {
  const { toast } = useToast();
  const [selectedVersion, setSelectedVersion] = useState<ChangelogVersion | null>(null);
  const [showCreateVersion, setShowCreateVersion] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<ChangelogItem | null>(null);
  const [showNewRelease, setShowNewRelease] = useState(false);

  const [newVersion, setNewVersion] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newReleaseDate, setNewReleaseDate] = useState("");
  
  const [releaseVersion, setReleaseVersion] = useState("");
  const [releaseTitle, setReleaseTitle] = useState("");
  const [releaseItems, setReleaseItems] = useState<ReleaseItem[]>([]);
  const [versionType, setVersionType] = useState<"patch" | "minor" | "major">("patch");
  const [publishImmediately, setPublishImmediately] = useState(true);

  const [itemChangeType, setItemChangeType] = useState("feature");
  const [itemIconKey, setItemIconKey] = useState("");
  const [itemText, setItemText] = useState("");
  const [itemIsProOnly, setItemIsProOnly] = useState(false);
  const [itemIsAdminOnly, setItemIsAdminOnly] = useState(false);

  const { data: changelogsData, isLoading, refetch } = useQuery<{ changelogs: ChangelogVersion[] }>({
    queryKey: ["/api/admin/changelog"],
  });

  const changelogs = changelogsData?.changelogs || [];

  const { data: gitCommitsData, refetch: refetchCommits } = useQuery<GitCommitsData>({
    queryKey: ["/api/admin/changelog/git-commits"],
    enabled: showNewRelease,
  });

  useEffect(() => {
    if (selectedVersion) {
      const updatedVersion = changelogs.find(c => c.id === selectedVersion.id);
      if (updatedVersion) {
        setSelectedVersion(updatedVersion);
      } else {
        setSelectedVersion(null);
      }
    }
  }, [changelogs]);

  const createVersionMutation = useMutation({
    mutationFn: async (data: { version: string; title: string; releaseDate: string }) => {
      const res = await apiRequest("POST", "/api/admin/changelog", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Changelog version created" });
      setShowCreateVersion(false);
      setNewVersion("");
      setNewTitle("");
      setNewReleaseDate("");
      refetch();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteVersionMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/changelog/${versionId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Changelog version deleted" });
      setSelectedVersion(null);
      refetch();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const publishVersionMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const res = await apiRequest("POST", `/api/admin/changelog/${versionId}/publish`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Changelog published!" });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/changelog/latest"] });
      queryClient.invalidateQueries({ queryKey: ["/api/changelog"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (data: { versionId: string; changeType: string; iconKey?: string; text: string; isProOnly?: boolean; isAdminOnly?: boolean }) => {
      const res = await apiRequest("POST", `/api/admin/changelog/${data.versionId}/items`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Item added" });
      setShowAddItem(false);
      resetItemForm();
      refetch();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async (data: { itemId: string; changeType?: string; iconKey?: string; text?: string; isProOnly?: boolean; isAdminOnly?: boolean }) => {
      const { itemId, ...updates } = data;
      const res = await apiRequest("PATCH", `/api/admin/changelog/items/${itemId}`, updates);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Item updated" });
      setEditingItem(null);
      resetItemForm();
      refetch();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/changelog/items/${itemId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Item deleted" });
      refetch();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const quickReleaseMutation = useMutation({
    mutationFn: async (data: {
      version: string;
      title: string;
      releaseDate: string;
      items: Array<{ description: string; type: string; isProOnly?: boolean; isAdminOnly?: boolean }>;
      publish: boolean;
    }) => {
      const res = await apiRequest("POST", "/api/admin/changelog/quick-release", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Success", 
        description: publishImmediately ? `v${releaseVersion} published!` : `v${releaseVersion} created as draft` 
      });
      setShowNewRelease(false);
      setReleaseItems([]);
      setReleaseTitle("");
      refetch();
      if (publishImmediately) {
        queryClient.invalidateQueries({ queryKey: ["/api/changelog/latest"] });
        queryClient.invalidateQueries({ queryKey: ["/api/changelog"] });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const openNewRelease = () => {
    setShowNewRelease(true);
    refetchCommits();
  };

  useEffect(() => {
    if (gitCommitsData && showNewRelease) {
      setReleaseVersion(gitCommitsData.nextVersions[versionType]);
      
      const items: ReleaseItem[] = gitCommitsData.commits.slice(0, 20).map((commit, idx) => ({
        id: commit.hash,
        description: commit.message.replace(/^(feat|fix|perf|security|breaking|improve):\s*/i, ''),
        type: commit.type,
        selected: false,
        isProOnly: false,
        isAdminOnly: false,
      }));
      setReleaseItems(items);
    }
  }, [gitCommitsData, showNewRelease]);

  useEffect(() => {
    if (gitCommitsData) {
      setReleaseVersion(gitCommitsData.nextVersions[versionType]);
    }
  }, [versionType, gitCommitsData]);

  const toggleReleaseItem = (id: string) => {
    setReleaseItems(items =>
      items.map(item => item.id === id ? { ...item, selected: !item.selected } : item)
    );
  };

  const updateReleaseItem = (id: string, updates: Partial<ReleaseItem>) => {
    setReleaseItems(items =>
      items.map(item => item.id === id ? { ...item, ...updates } : item)
    );
  };

  const addCustomReleaseItem = () => {
    const newItem: ReleaseItem = {
      id: `custom-${Date.now()}`,
      description: "",
      type: "feature",
      selected: true,
      isProOnly: false,
      isAdminOnly: false,
    };
    setReleaseItems([newItem, ...releaseItems]);
  };

  const removeReleaseItem = (id: string) => {
    setReleaseItems(items => items.filter(item => item.id !== id));
  };

  const handleQuickRelease = () => {
    const selectedItems = releaseItems
      .filter(item => item.selected && item.description.trim())
      .map(item => ({
        description: item.description,
        type: item.type,
        isProOnly: item.isProOnly,
        isAdminOnly: item.isAdminOnly,
      }));

    if (selectedItems.length === 0) {
      toast({ title: "Error", description: "Select at least one item", variant: "destructive" });
      return;
    }

    const now = new Date();
    const releaseDate = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    quickReleaseMutation.mutate({
      version: releaseVersion,
      title: releaseTitle || `Release ${releaseVersion}`,
      releaseDate,
      items: selectedItems,
      publish: publishImmediately,
    });
  };

  const resetItemForm = () => {
    setItemChangeType("feature");
    setItemIconKey("");
    setItemText("");
    setItemIsProOnly(false);
    setItemIsAdminOnly(false);
  };

  const handleEditItem = (item: ChangelogItem) => {
    setEditingItem(item);
    setItemChangeType(item.changeType);
    setItemIconKey(item.iconKey || "");
    setItemText(item.text);
    setItemIsProOnly(item.isProOnly);
    setItemIsAdminOnly(item.isAdminOnly);
  };

  const handleSaveItem = () => {
    if (editingItem) {
      updateItemMutation.mutate({
        itemId: editingItem.id,
        changeType: itemChangeType,
        iconKey: itemIconKey || undefined,
        text: itemText,
        isProOnly: itemIsProOnly,
        isAdminOnly: itemIsAdminOnly,
      });
    } else if (selectedVersion) {
      createItemMutation.mutate({
        versionId: selectedVersion.id,
        changeType: itemChangeType,
        iconKey: itemIconKey || undefined,
        text: itemText,
        isProOnly: itemIsProOnly,
        isAdminOnly: itemIsAdminOnly,
      });
    }
  };

  const getChangeTypeStyle = (type: string) => {
    return CHANGE_TYPES.find(t => t.value === type)?.color || "text-muted-foreground";
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="w-5 h-5" />
              Changelog Management
            </CardTitle>
            <CardDescription>Create and manage changelog entries for the What's New dialog</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={openNewRelease} data-testid="button-new-release">
              <Rocket className="w-4 h-4 mr-2" />
              New Release
            </Button>
            <Button variant="outline" onClick={() => setShowCreateVersion(true)} data-testid="button-create-changelog">
              <Plus className="w-4 h-4 mr-2" />
              Manual Version
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {changelogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No changelog versions yet. Create your first one!
            </div>
          ) : (
            <div className="space-y-3">
              {changelogs.map((changelog) => (
                <div
                  key={changelog.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedVersion?.id === changelog.id ? "border-primary bg-primary/5" : "hover-elevate"
                  }`}
                  onClick={() => setSelectedVersion(changelog)}
                  data-testid={`changelog-version-${changelog.id}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Badge variant={changelog.isPublished ? "default" : "secondary"}>
                        v{changelog.version}
                      </Badge>
                      <span className="font-medium">{changelog.title}</span>
                      {!changelog.isPublished && (
                        <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                          Draft
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{changelog.releaseDate}</span>
                      <span className="opacity-50">|</span>
                      <span>{changelog.items?.length || 0} items</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedVersion && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="outline">v{selectedVersion.version}</Badge>
                {selectedVersion.title}
              </CardTitle>
              <CardDescription>
                {selectedVersion.isPublished ? (
                  <span className="text-green-500">Published {selectedVersion.publishedAt ? new Date(selectedVersion.publishedAt).toLocaleDateString() : ""}</span>
                ) : (
                  <span className="text-yellow-500">Draft - not visible to users</span>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {!selectedVersion.isPublished && (
                <Button
                  variant="default"
                  onClick={() => publishVersionMutation.mutate(selectedVersion.id)}
                  disabled={publishVersionMutation.isPending || (selectedVersion.items?.length || 0) === 0}
                  data-testid="button-publish-changelog"
                >
                  {publishVersionMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Rocket className="w-4 h-4 mr-2" />
                  )}
                  Publish
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  resetItemForm();
                  setShowAddItem(true);
                }}
                data-testid="button-add-changelog-item"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
              <Button
                variant="destructive"
                size="icon"
                onClick={() => {
                  if (confirm("Delete this changelog version and all its items?")) {
                    deleteVersionMutation.mutate(selectedVersion.id);
                  }
                }}
                data-testid="button-delete-changelog"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {(selectedVersion.items?.length || 0) === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                No items yet. Add changelog entries to describe what changed.
              </div>
            ) : (
              <div className="space-y-2">
                {selectedVersion.items?.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Badge variant="outline" className={getChangeTypeStyle(item.changeType)}>
                        {CHANGE_TYPES.find(t => t.value === item.changeType)?.label || item.changeType}
                      </Badge>
                      <span className="truncate">{item.text}</span>
                      {item.isProOnly && (
                        <Badge variant="secondary" className="bg-purple-500/20 text-purple-500">PRO</Badge>
                      )}
                      {item.isAdminOnly && (
                        <Badge variant="secondary" className="bg-red-500/20 text-red-500">Admin</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditItem(item)}
                        data-testid={`button-edit-item-${item.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Delete this item?")) {
                            deleteItemMutation.mutate(item.id);
                          }
                        }}
                        data-testid={`button-delete-item-${item.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={showCreateVersion} onOpenChange={setShowCreateVersion}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Changelog Version</DialogTitle>
            <DialogDescription>Add a new version for the What's New dialog</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                placeholder="e.g., 0.4.0"
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
                data-testid="input-changelog-version"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g., New Features & Improvements"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                data-testid="input-changelog-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="releaseDate">Release Date</Label>
              <Input
                id="releaseDate"
                placeholder="e.g., January 2026"
                value={newReleaseDate}
                onChange={(e) => setNewReleaseDate(e.target.value)}
                data-testid="input-changelog-date"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateVersion(false)}>Cancel</Button>
            <Button
              onClick={() => createVersionMutation.mutate({ version: newVersion, title: newTitle, releaseDate: newReleaseDate })}
              disabled={!newVersion || !newTitle || !newReleaseDate || createVersionMutation.isPending}
              data-testid="button-confirm-create-changelog"
            >
              {createVersionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddItem || !!editingItem} onOpenChange={(open) => {
        if (!open) {
          setShowAddItem(false);
          setEditingItem(null);
          resetItemForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Changelog Item" : "Add Changelog Item"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "Update this changelog entry" : "Add a new entry to the changelog"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Change Type</Label>
              <Select value={itemChangeType} onValueChange={setItemChangeType}>
                <SelectTrigger data-testid="select-change-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANGE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <span className={type.color}>{type.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Icon (optional)</Label>
              <Select value={itemIconKey} onValueChange={setItemIconKey}>
                <SelectTrigger data-testid="select-icon">
                  <SelectValue placeholder="No icon" />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((icon) => (
                    <SelectItem key={icon.value} value={icon.value}>
                      {icon.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="itemText">Description</Label>
              <Textarea
                id="itemText"
                placeholder="Describe what changed..."
                value={itemText}
                onChange={(e) => setItemText(e.target.value)}
                className="min-h-[80px]"
                data-testid="input-item-text"
              />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isProOnly"
                  checked={itemIsProOnly}
                  onCheckedChange={(checked) => setItemIsProOnly(!!checked)}
                  data-testid="checkbox-pro-only"
                />
                <Label htmlFor="isProOnly" className="text-sm">PRO Only</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isAdminOnly"
                  checked={itemIsAdminOnly}
                  onCheckedChange={(checked) => setItemIsAdminOnly(!!checked)}
                  data-testid="checkbox-admin-only"
                />
                <Label htmlFor="isAdminOnly" className="text-sm">Admin Only (hidden from users)</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddItem(false);
              setEditingItem(null);
              resetItemForm();
            }}>Cancel</Button>
            <Button
              onClick={handleSaveItem}
              disabled={!itemText || createItemMutation.isPending || updateItemMutation.isPending}
              data-testid="button-confirm-save-item"
            >
              {(createItemMutation.isPending || updateItemMutation.isPending) ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {editingItem ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewRelease} onOpenChange={setShowNewRelease}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="w-5 h-5" />
              New Release
            </DialogTitle>
            <DialogDescription>
              Create a release from recent changes. Select commits to include and edit their descriptions.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <Label>Version</Label>
                <div className="flex items-center gap-2">
                  <Select value={versionType} onValueChange={(v: "patch" | "minor" | "major") => setVersionType(v)}>
                    <SelectTrigger className="w-28" data-testid="select-version-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="patch">Patch</SelectItem>
                      <SelectItem value="minor">Minor</SelectItem>
                      <SelectItem value="major">Major</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={releaseVersion}
                    onChange={(e) => setReleaseVersion(e.target.value)}
                    className="w-28 font-mono"
                    data-testid="input-release-version"
                  />
                  {gitCommitsData?.currentVersion && (
                    <span className="text-sm text-muted-foreground">
                      (current: v{gitCommitsData.currentVersion})
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <Label>Title (optional)</Label>
                <Input
                  placeholder={`Release ${releaseVersion}`}
                  value={releaseTitle}
                  onChange={(e) => setReleaseTitle(e.target.value)}
                  data-testid="input-release-title"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Changes</Label>
              <Button variant="outline" size="sm" onClick={addCustomReleaseItem} data-testid="button-add-custom-item">
                <Plus className="w-4 h-4 mr-1" />
                Add Custom
              </Button>
            </div>

            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
              {releaseItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {gitCommitsData ? "No recent commits found" : "Loading commits..."}
                </div>
              ) : (
                releaseItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      item.selected ? "border-primary bg-primary/5" : "opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={item.selected}
                        onCheckedChange={() => toggleReleaseItem(item.id)}
                        className="mt-1"
                        data-testid={`checkbox-item-${item.id}`}
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Select
                            value={item.type}
                            onValueChange={(v) => updateReleaseItem(item.id, { type: v })}
                          >
                            <SelectTrigger className="w-32 h-8" data-testid={`select-type-${item.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CHANGE_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  <span className={type.color}>{type.label}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {!item.id.startsWith('custom-') && (
                            <code className="text-xs text-muted-foreground bg-muted px-1 py-0.5 rounded">
                              {item.id}
                            </code>
                          )}
                          <div className="flex items-center gap-1 ml-auto">
                            <Checkbox
                              checked={item.isProOnly}
                              onCheckedChange={(c) => updateReleaseItem(item.id, { isProOnly: !!c })}
                              id={`pro-${item.id}`}
                            />
                            <Label htmlFor={`pro-${item.id}`} className="text-xs">PRO</Label>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeReleaseItem(item.id)}
                            data-testid={`button-remove-${item.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        <Input
                          value={item.description}
                          onChange={(e) => updateReleaseItem(item.id, { description: e.target.value })}
                          placeholder="Describe this change..."
                          className="h-8"
                          data-testid={`input-desc-${item.id}`}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t">
              <Checkbox
                id="publishImmediately"
                checked={publishImmediately}
                onCheckedChange={(c) => setPublishImmediately(!!c)}
                data-testid="checkbox-publish-immediately"
              />
              <Label htmlFor="publishImmediately">Publish immediately</Label>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <div className="flex items-center justify-between w-full">
              <span className="text-sm text-muted-foreground">
                {releaseItems.filter(i => i.selected).length} items selected
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setShowNewRelease(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleQuickRelease}
                  disabled={quickReleaseMutation.isPending || releaseItems.filter(i => i.selected && i.description.trim()).length === 0}
                  data-testid="button-create-release"
                >
                  {quickReleaseMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Rocket className="w-4 h-4 mr-2" />
                  )}
                  {publishImmediately ? "Publish Release" : "Create Draft"}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminPageContent() {
  const { character, isAdmin } = useAuth();
  const adminTutorial = useAdminTutorial();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [subscriptionsSubTab, setSubscriptionsSubTab] = useState<"manage" | "codes" | "activity">("manage");
  const [logsSubTab, setLogsSubTab] = useState<"sessions" | "audit">("sessions");
  
  // Gift PRO form state
  const [giftCharacterId, setGiftCharacterId] = useState("");
  const [giftCharacterName, setGiftCharacterName] = useState("");
  const [giftDays, setGiftDays] = useState("7");
  const [giftNote, setGiftNote] = useState("");
  
  // Payment verification state
  const [verifyCode, setVerifyCode] = useState("");
  
  // Extend subscription form state
  const [extendCharacterId, setExtendCharacterId] = useState("");
  const [extendDays, setExtendDays] = useState("7");
  
  // Gift code generation state
  const [giftCodeDays, setGiftCodeDays] = useState("7");
  const [giftCodeNote, setGiftCodeNote] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [giftCodeBadge, setGiftCodeBadge] = useState<SpecialBadgeType | "">("");
  const [giftCodeTheme, setGiftCodeTheme] = useState<FactionTheme | "">("");
  const [giftCodeTiles, setGiftCodeTiles] = useState<BonusTile[]>([]);
  const [generatedCodeDetails, setGeneratedCodeDetails] = useState<{
    days: number;
    badge?: SpecialBadgeType;
    theme?: FactionTheme;
    tiles?: BonusTile[];
  } | null>(null);
  
  // Special badges form state
  const [badgeCharacterId, setBadgeCharacterId] = useState("");
  const [badgeCharacterName, setBadgeCharacterName] = useState("");
  const [badgeType, setBadgeType] = useState<SpecialBadgeType>("supporter");
  const [badgeNote, setBadgeNote] = useState("");
  
  // Admin management state
  const [newAdminCharacterId, setNewAdminCharacterId] = useState("");
  const [newAdminCharacterName, setNewAdminCharacterName] = useState("");
  
  // Sessions management state
  const [sessionsPage, setSessionsPage] = useState(0);
  const [sessionsSearch, setSessionsSearch] = useState("");
  const [sessionsFilter, setSessionsFilter] = useState<"all" | "active" | "completed">("all");
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [editSessionIsk, setEditSessionIsk] = useState("");
  const [editSessionKills, setEditSessionKills] = useState("");

  // PHOTON codes state
  const [photonCodeType, setPhotonCodeType] = useState<"pro_subscription" | "theme_unlock" | "badge_grant" | "tile_unlock" | "bundle">("pro_subscription");
  const [photonProDays, setPhotonProDays] = useState("7");
  const [photonMaxRedemptions, setPhotonMaxRedemptions] = useState("1");
  const [photonNeverExpires, setPhotonNeverExpires] = useState(false);
  const [photonExpiryDays, setPhotonExpiryDays] = useState("30");
  const [photonBadges, setPhotonBadges] = useState<SpecialBadgeType[]>([]);
  const [photonThemes, setPhotonThemes] = useState<FactionTheme[]>([]);
  const [photonTiles, setPhotonTiles] = useState<BonusTile[]>([]);
  const [photonNote, setPhotonNote] = useState("");
  const [photonBatchCount, setPhotonBatchCount] = useState("1");
  const [generatedPhotonCodes, setGeneratedPhotonCodes] = useState<string[]>([]);
  const [photonCodesPage, setPhotonCodesPage] = useState(0);
  const [photonCodesFilter, setPhotonCodesFilter] = useState<"all" | "active" | "redeemed" | "revoked" | "expired">("all");

  // Activity log state
  const [activityPage, setActivityPage] = useState(0);
  const [activityFilter, setActivityFilter] = useState<"all" | "created" | "redeemed" | "revoked" | "failed_redemption">("all");

  // Admin audit log state
  const [auditLogPage, setAuditLogPage] = useState(0);
  const [auditLogActionFilter, setAuditLogActionFilter] = useState<string>("all");
  const [auditLogAdminFilter, setAuditLogAdminFilter] = useState<string>("");

  // Support tickets state
  const [ticketsPage, setTicketsPage] = useState(0);
  const [ticketsFilter, setTicketsFilter] = useState<"all" | "open" | "in_progress" | "resolved" | "closed">("all");
  const [ticketsCategoryFilter, setTicketsCategoryFilter] = useState<"all" | "bug" | "feature" | "account" | "billing" | "other">("all");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketReplyMessage, setTicketReplyMessage] = useState("");
  const [ticketAdminNotes, setTicketAdminNotes] = useState("");
  
  // Notification emails state
  const [newNotificationEmail, setNewNotificationEmail] = useState("");

  // User management state
  const [usersPage, setUsersPage] = useState(0);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersFilter, setUsersFilter] = useState<"all" | "pro" | "suspended" | "active">("all");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userDetailTab, setUserDetailTab] = useState<"overview" | "notes" | "sessions" | "badges" | "history">("overview");
  const [newUserNote, setNewUserNote] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendDays, setSuspendDays] = useState("7");
  const [suspendNote, setSuspendNote] = useState("");
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [liftSuspensionReason, setLiftSuspensionReason] = useState("");
  const [userBadgeType, setUserBadgeType] = useState<SpecialBadgeType>("supporter");
  const [userBadgeNote, setUserBadgeNote] = useState("");

  // Queries - enabled when admin (always on this page)
  const { data: adminInfo, isLoading, error } = useQuery<AdminInfo>({
    queryKey: ["/api/admin/info"],
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const { data: statsData } = useQuery<{ statistics: AdminStatistics }>({
    queryKey: ["/api/admin/statistics"],
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const { data: subscriptionsData } = useQuery<{ subscriptions: ProSubscription[], count: number }>({
    queryKey: ["/api/admin/subscriptions"],
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const { data: codesData } = useQuery<{ codes: ProActivationCode[], count: number }>({
    queryKey: ["/api/admin/activation-codes"],
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const { data: giftsData } = useQuery<{ gifts: ProGift[] }>({
    queryKey: ["/api/admin/gifts"],
    enabled: isAdmin,
    refetchInterval: 30000,
  });
  
  // Notification emails query
  const { data: notificationEmailsData, refetch: refetchNotificationEmails } = useQuery<{ emails: NotificationEmail[] }>({
    queryKey: ["/api/admin/notification-emails"],
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  // User management queries
  const usersPageSize = 20;
  const { data: usersData, refetch: refetchUsers, isLoading: usersLoading } = useQuery<{ users: AdminUserListItem[]; total: number; stats: AdminUserStats }>({
    queryKey: ["/api/admin/users", usersPage, usersSearch, usersFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(usersPageSize));
      params.set("offset", String(usersPage * usersPageSize));
      if (usersSearch) params.set("search", usersSearch);
      if (usersFilter === "pro") params.set("proOnly", "true");
      if (usersFilter === "suspended") params.set("suspendedOnly", "true");
      if (usersFilter === "active") params.set("activeOnly", "true");
      const response = await fetch(`/api/admin/users?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
    enabled: isAdmin && activeTab === "users",
    refetchInterval: 30000,
  });

  const { data: selectedUserData, refetch: refetchSelectedUser, isLoading: selectedUserLoading } = useQuery<AdminUserDetail>({
    queryKey: ["/api/admin/users", selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) throw new Error("No user selected");
      const response = await fetch(`/api/admin/users/${selectedUserId}`);
      if (!response.ok) throw new Error("Failed to fetch user details");
      return response.json();
    },
    enabled: isAdmin && selectedUserId !== null,
  });

  interface SpecialBadgeData {
    id: string;
    characterId: number;
    characterName: string;
    badgeType: SpecialBadgeType;
    grantedByAdminId: number;
    grantedByAdminName: string;
    note: string | null;
    grantedAt: string;
  }

  const { data: badgesData } = useQuery<{ badges: SpecialBadgeData[], count: number }>({
    queryKey: ["/api/admin/special-badges"],
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  interface SystemStats {
    uptime: { seconds: number; formatted: string; startedAt: string };
    esiStatus: { status: string; message: string; serverVersion?: string; startTime?: string };
    sessions: { totalSessions: number; activeSessions: number; totalIskEarned: number; totalKills: number; uniqueUsers: number };
    pro: AdminStatistics;
    environment: string;
    memoryUsage: { heapUsed: number; heapTotal: number };
  }

  const { data: systemStats, refetch: refetchSystemStats } = useQuery<SystemStats>({
    queryKey: ["/api/admin/system-stats"],
    enabled: isAdmin && activeTab === "dashboard",
    refetchInterval: 30000,
  });

  interface RattingSession {
    id: string;
    characterId: number;
    characterName: string;
    startTime: string;
    endTime: string | null;
    totalIsk: number;
    bountyIsk: number;
    lootIsk: number;
    killCount: number;
    isActive: boolean;
  }

  const sessionsPageSize = 20;
  const { data: sessionsData, refetch: refetchSessions } = useQuery<{ sessions: RattingSession[]; total: number }>({
    queryKey: ["/api/admin/sessions", sessionsPage, sessionsSearch, sessionsFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(sessionsPageSize));
      params.set("offset", String(sessionsPage * sessionsPageSize));
      if (sessionsSearch) params.set("characterName", sessionsSearch);
      if (sessionsFilter === "active") params.set("isActive", "true");
      if (sessionsFilter === "completed") params.set("isActive", "false");
      const response = await fetch(`/api/admin/sessions?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch sessions");
      return response.json();
    },
    enabled: isAdmin && activeTab === "logs" && logsSubTab === "sessions",
    refetchInterval: 30000,
  });

  interface PhotonCode {
    id: string;
    code: string;
    codeType: string;
    createdByAdminId: number;
    createdByAdminName: string;
    status: string;
    maxRedemptions: number;
    currentRedemptions: number;
    expiresAt: string | null;
    proDurationDays: number | null;
    badgeGrants: string[];
    themeUnlocks: string[];
    tileUnlocks: string[];
    note: string | null;
    createdAt: string;
    updatedAt: string;
  }

  interface PhotonActivityLog {
    id: string;
    codeId: string | null;
    code: string;
    action: string;
    actorCharacterId: number;
    actorCharacterName: string;
    targetCharacterId: number | null;
    targetCharacterName: string | null;
    details: Record<string, unknown>;
    createdAt: string;
  }

  interface AdminAuditLog {
    id: string;
    adminCharacterId: number;
    adminCharacterName: string;
    action: string;
    targetCharacterId: number | null;
    targetCharacterName: string | null;
    details: Record<string, unknown>;
    ipAddress: string | null;
    createdAt: string;
  }

  const photonCodesPageSize = 20;
  const { data: photonCodesData, refetch: refetchPhotonCodes } = useQuery<{ codes: PhotonCode[]; total: number }>({
    queryKey: ["/api/admin/photon-codes", photonCodesPage, photonCodesFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(photonCodesPageSize));
      params.set("offset", String(photonCodesPage * photonCodesPageSize));
      if (photonCodesFilter !== "all") params.set("status", photonCodesFilter);
      const response = await fetch(`/api/admin/photon-codes?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch PHOTON codes");
      return response.json();
    },
    enabled: isAdmin && activeTab === "subscriptions" && subscriptionsSubTab === "codes",
    refetchInterval: 30000,
  });

  const activityLogPageSize = 50;
  const { data: activityLogData, refetch: refetchActivityLog } = useQuery<{ logs: PhotonActivityLog[]; total: number }>({
    queryKey: ["/api/admin/photon-activity-log", activityPage, activityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(activityLogPageSize));
      params.set("offset", String(activityPage * activityLogPageSize));
      if (activityFilter !== "all") params.set("action", activityFilter);
      const response = await fetch(`/api/admin/photon-activity-log?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch activity log");
      return response.json();
    },
    enabled: isAdmin && activeTab === "subscriptions" && subscriptionsSubTab === "activity",
    refetchInterval: 30000,
  });

  // Admin audit log query
  const auditLogPageSize = 50;
  const { data: auditLogData, refetch: refetchAuditLog } = useQuery<{ logs: AdminAuditLog[]; total: number }>({
    queryKey: ["/api/admin/audit-log", auditLogPage, auditLogActionFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(auditLogPageSize));
      params.set("offset", String(auditLogPage * auditLogPageSize));
      if (auditLogActionFilter !== "all") params.set("action", auditLogActionFilter);
      const response = await fetch(`/api/admin/audit-log?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch audit log");
      return response.json();
    },
    enabled: isAdmin && activeTab === "logs" && logsSubTab === "audit",
    refetchInterval: 30000,
  });

  const auditLogs = auditLogData?.logs || [];
  const auditLogsTotal = auditLogData?.total || 0;

  // Support tickets queries
  const ticketsPageSize = 20;
  const { data: ticketsData, refetch: refetchTickets } = useQuery<{ tickets: SupportTicket[]; total: number }>({
    queryKey: ["/api/admin/support/tickets", ticketsPage, ticketsFilter, ticketsCategoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(ticketsPageSize));
      params.set("offset", String(ticketsPage * ticketsPageSize));
      if (ticketsFilter !== "all") params.set("status", ticketsFilter);
      if (ticketsCategoryFilter !== "all") params.set("category", ticketsCategoryFilter);
      const response = await fetch(`/api/admin/support/tickets?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch tickets");
      return response.json();
    },
    enabled: isAdmin && activeTab === "support",
    refetchInterval: 30000,
  });

  const { data: ticketStatsData } = useQuery<TicketStats>({
    queryKey: ["/api/admin/support/tickets/stats"],
    enabled: isAdmin && activeTab === "support",
    refetchInterval: 30000,
  });

  // Query for admin notifications
  const { data: adminNotificationsData } = useQuery<{ notifications: TicketNotification[] }>({
    queryKey: ["/api/support/notifications"],
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  // Group notifications by ticket ID for quick lookup
  const adminNotificationsByTicket = (adminNotificationsData?.notifications || []).reduce((acc, notif) => {
    if (!acc[notif.ticketId]) acc[notif.ticketId] = [];
    acc[notif.ticketId].push(notif);
    return acc;
  }, {} as Record<string, TicketNotification[]>);

  const totalAdminNotifications = adminNotificationsData?.notifications?.length || 0;

  // Mark notifications as read mutation
  const markAdminNotificationsReadMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      return apiRequest("POST", "/api/support/notifications/mark-all-read", { ticketId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/support/notifications/count"] });
    },
  });

  const { data: selectedTicketData, refetch: refetchSelectedTicket } = useQuery<{
    ticket: SupportTicket;
    replies: TicketReply[];
  }>({
    queryKey: ["/api/support/tickets", selectedTicketId],
    queryFn: async () => {
      const response = await fetch(`/api/support/tickets/${selectedTicketId}`);
      if (!response.ok) throw new Error("Failed to fetch ticket details");
      return response.json();
    },
    enabled: isAdmin && !!selectedTicketId,
  });

  const photonCodes = photonCodesData?.codes || [];
  const photonCodesTotal = photonCodesData?.total || 0;
  const activityLogs = activityLogData?.logs || [];
  const tickets = ticketsData?.tickets || [];
  const ticketsTotal = ticketsData?.total || 0;
  const ticketStats = ticketStatsData;
  const activityLogsTotal = activityLogData?.total || 0;

  const stats = statsData?.statistics;
  const subscriptions = subscriptionsData?.subscriptions || [];
  const codes = codesData?.codes || [];
  const gifts = giftsData?.gifts || [];
  const specialBadges = badgesData?.badges || [];

  // Validate numeric inputs
  const isValidGiftForm = () => {
    const charId = parseInt(giftCharacterId, 10);
    const days = parseInt(giftDays, 10);
    return (
      !isNaN(charId) && 
      charId > 0 && 
      giftCharacterName.trim().length > 0 && 
      !isNaN(days) && 
      days > 0
    );
  };

  const giftProMutation = useMutation({
    mutationFn: async () => {
      const charId = parseInt(giftCharacterId, 10);
      const days = parseInt(giftDays, 10);
      
      if (isNaN(charId) || charId <= 0) {
        throw new Error("Invalid character ID");
      }
      if (isNaN(days) || days <= 0) {
        throw new Error("Invalid duration");
      }
      
      const response = await apiRequest("POST", "/api/admin/gift-pro", {
        recipientCharacterId: charId,
        recipientCharacterName: giftCharacterName.trim(),
        durationDays: days,
        note: giftNote.trim() || null,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "PRO Gifted",
        description: `${data.message}. Reference: ${data.referenceCode}`,
      });
      setGiftCharacterId("");
      setGiftCharacterName("");
      setGiftDays("7");
      setGiftNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/statistics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gifts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Gift Failed",
        description: error.message || "Failed to gift PRO",
        variant: "destructive",
      });
    },
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/verify-payment", {
        activationCode: verifyCode,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Payment Verified",
        description: data.message,
      });
      setVerifyCode("");
      queryClient.invalidateQueries({ queryKey: ["/api/pro/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/activation-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/statistics"] });
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Failed to verify payment",
        variant: "destructive",
      });
    },
  });

  const autoCheckMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/auto-check-payments", {});
      return response.json();
    },
    onSuccess: (data) => {
      const count = data.activatedSubscriptions?.length || 0;
      toast({
        title: "Wallet Check Complete",
        description: count > 0 
          ? `Activated ${count} subscription(s) automatically!` 
          : "No new payments found with valid activation codes.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pro/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/activation-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/statistics"] });
    },
    onError: (error: any) => {
      toast({
        title: "Auto-Check Failed",
        description: error.message || "Failed to check wallet for payments",
        variant: "destructive",
      });
    },
  });

  const revokeSubscriptionMutation = useMutation({
    mutationFn: async (characterId: number) => {
      const response = await apiRequest("POST", "/api/admin/revoke-subscription", { characterId });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Subscription Revoked",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/statistics"] });
    },
    onError: (error: any) => {
      toast({
        title: "Revoke Failed",
        description: error.message || "Failed to revoke subscription",
        variant: "destructive",
      });
    },
  });
  
  // Notification email mutations
  const addNotificationEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", "/api/admin/notification-emails", { email });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Email Added",
        description: data.message,
      });
      setNewNotificationEmail("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notification-emails"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Add Email",
        description: error.message || "Failed to add notification email",
        variant: "destructive",
      });
    },
  });
  
  const removeNotificationEmailMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/notification-emails/${id}`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Email Removed",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notification-emails"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Remove Email",
        description: error.message || "Failed to remove notification email",
        variant: "destructive",
      });
    },
  });
  
  const toggleNotificationEmailMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiRequest("PATCH", `/api/admin/notification-emails/${id}/toggle`, { isActive });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Email Updated",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notification-emails"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Update Email",
        description: error.message || "Failed to update notification email",
        variant: "destructive",
      });
    },
  });

  // User management mutations
  const suspendUserMutation = useMutation({
    mutationFn: async ({ characterId, characterName, reason, daysUntilExpiry }: { characterId: number; characterName: string; reason: string; daysUntilExpiry?: number }) => {
      const response = await apiRequest("POST", `/api/admin/suspensions`, { 
        characterId, 
        characterName,
        reason, 
        durationHours: daysUntilExpiry ? daysUntilExpiry * 24 : undefined
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User Suspended",
        description: "User has been suspended",
      });
      setSuspendReason("");
      setSuspendDays("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      refetchSelectedUser();
    },
    onError: (error: any) => {
      toast({
        title: "Suspension Failed",
        description: error.message || "Failed to suspend user",
        variant: "destructive",
      });
    },
  });

  const liftSuspensionMutation = useMutation({
    mutationFn: async ({ suspensionId, reason }: { suspensionId: string; reason?: string }) => {
      const response = await apiRequest("POST", `/api/admin/suspensions/${suspensionId}/lift`, { reason });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Suspension Lifted",
        description: "Suspension has been lifted",
      });
      setLiftSuspensionReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      refetchSelectedUser();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Lift Suspension",
        description: error.message || "Failed to lift suspension",
        variant: "destructive",
      });
    },
  });

  const addUserNoteMutation = useMutation({
    mutationFn: async ({ characterId, characterName, note }: { characterId: number; characterName: string; note: string }) => {
      const response = await apiRequest("POST", `/api/admin/notes`, { 
        targetCharacterId: characterId, 
        targetCharacterName: characterName,
        content: note 
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Note Added",
        description: "Admin note has been saved",
      });
      setNewUserNote("");
      refetchSelectedUser();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Add Note",
        description: error.message || "Failed to add note",
        variant: "destructive",
      });
    },
  });

  const grantUserBadgeMutation = useMutation({
    mutationFn: async ({ characterId, characterName, badgeType, note }: { characterId: number; characterName: string; badgeType: SpecialBadgeType; note?: string }) => {
      const response = await apiRequest("POST", `/api/admin/grant-badge`, { 
        characterId, 
        characterName, 
        badgeType, 
        note 
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Badge Granted",
        description: data.message || "Badge has been granted",
      });
      setUserBadgeNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/special-badges"] });
      refetchSelectedUser();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Grant Badge",
        description: error.message || "Failed to grant badge",
        variant: "destructive",
      });
    },
  });

  const revokeUserSubscriptionMutation = useMutation({
    mutationFn: async ({ characterId }: { characterId: number }) => {
      const response = await apiRequest("POST", `/api/admin/revoke-subscription`, { characterId });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Subscription Revoked",
        description: data.message || "Subscription has been revoked",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      refetchSelectedUser();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Revoke Subscription",
        description: error.message || "Failed to revoke subscription",
        variant: "destructive",
      });
    },
  });

  const extendSubscriptionMutation = useMutation({
    mutationFn: async ({ characterId, days }: { characterId: number; days: number }) => {
      const response = await apiRequest("POST", "/api/admin/extend-subscription", { characterId, days });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Subscription Extended",
        description: data.message,
      });
      setExtendCharacterId("");
      setExtendDays("7");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/statistics"] });
    },
    onError: (error: any) => {
      toast({
        title: "Extend Failed",
        description: error.message || "Failed to extend subscription",
        variant: "destructive",
      });
    },
  });

  const generateGiftCodeMutation = useMutation({
    mutationFn: async () => {
      const days = parseInt(giftCodeDays, 10);
      if (isNaN(days) || days <= 0 || days > 365) {
        throw new Error("Duration must be between 1 and 365 days");
      }
      const response = await apiRequest("POST", "/api/admin/generate-gift-code", {
        durationDays: days,
        note: giftCodeNote.trim() || undefined,
        badgeType: giftCodeBadge || undefined,
        themeUnlock: giftCodeTheme || undefined,
        bonusTiles: giftCodeTiles.length > 0 ? giftCodeTiles : undefined,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Gift Code Generated",
        description: data.message,
      });
      setGeneratedCode(data.code);
      setGeneratedCodeDetails({
        days: parseInt(giftCodeDays, 10),
        badge: giftCodeBadge || undefined,
        theme: giftCodeTheme || undefined,
        tiles: giftCodeTiles.length > 0 ? giftCodeTiles : undefined,
      });
      setGiftCodeNote("");
      setGiftCodeBadge("");
      setGiftCodeTheme("");
      setGiftCodeTiles([]);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/activation-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/statistics"] });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate gift code",
        variant: "destructive",
      });
    },
  });

  const generatePhotonCodeMutation = useMutation({
    mutationFn: async () => {
      const proDays = parseInt(photonProDays, 10);
      const maxRedemptions = parseInt(photonMaxRedemptions, 10);
      const batchCount = parseInt(photonBatchCount, 10);
      const expiryDays = parseInt(photonExpiryDays, 10);

      if (photonCodeType === "pro_subscription" && (isNaN(proDays) || proDays <= 0)) {
        throw new Error("PRO duration is required for subscription codes");
      }
      if (isNaN(batchCount) || batchCount < 1 || batchCount > 100) {
        throw new Error("Batch count must be between 1 and 100");
      }

      const expiresAt = photonNeverExpires ? null : 
        new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

      const response = await apiRequest("POST", "/api/admin/photon-codes", {
        codeType: photonCodeType,
        proDurationDays: proDays > 0 ? proDays : null,
        maxRedemptions,
        expiresAt,
        neverExpires: photonNeverExpires,
        badgeGrants: photonBadges,
        themeUnlocks: photonThemes,
        tileUnlocks: photonTiles,
        note: photonNote.trim() || null,
        batchCount,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "PHOTON Codes Generated",
        description: `Successfully generated ${data.count} code(s)`,
      });
      setGeneratedPhotonCodes(data.codes.map((c: PhotonCode) => c.code));
      setPhotonNote("");
      setPhotonBadges([]);
      setPhotonThemes([]);
      setPhotonTiles([]);
      setPhotonBatchCount("1");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/photon-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/photon-activity-log"] });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate PHOTON codes",
        variant: "destructive",
      });
    },
  });

  const revokePhotonCodeMutation = useMutation({
    mutationFn: async (codeId: string) => {
      const response = await apiRequest("PUT", `/api/admin/photon-codes/${codeId}/revoke`, {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Code Revoked",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/photon-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/photon-activity-log"] });
    },
    onError: (error: any) => {
      toast({
        title: "Revoke Failed",
        description: error.message || "Failed to revoke code",
        variant: "destructive",
      });
    },
  });

  const grantBadgeMutation = useMutation({
    mutationFn: async () => {
      const charId = parseInt(badgeCharacterId, 10);
      if (isNaN(charId) || charId <= 0) {
        throw new Error("Invalid character ID");
      }
      if (!badgeCharacterName.trim()) {
        throw new Error("Character name is required");
      }
      const response = await apiRequest("POST", "/api/admin/grant-badge", {
        characterId: charId,
        characterName: badgeCharacterName.trim(),
        badgeType,
        note: badgeNote.trim() || null,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Badge Granted",
        description: data.message,
      });
      setBadgeCharacterId("");
      setBadgeCharacterName("");
      setBadgeNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/special-badges"] });
    },
    onError: (error: any) => {
      toast({
        title: "Grant Failed",
        description: error.message || "Failed to grant badge",
        variant: "destructive",
      });
    },
  });

  const revokeBadgeMutation = useMutation({
    mutationFn: async ({ characterId, badgeType }: { characterId: number; badgeType: SpecialBadgeType }) => {
      const response = await apiRequest("POST", "/api/admin/revoke-badge", { characterId, badgeType });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Badge Revoked",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/special-badges"] });
    },
    onError: (error: any) => {
      toast({
        title: "Revoke Failed",
        description: error.message || "Failed to revoke badge",
        variant: "destructive",
      });
    },
  });
  
  // Admin management mutations
  const addAdminMutation = useMutation({
    mutationFn: async () => {
      const charId = parseInt(newAdminCharacterId, 10);
      if (isNaN(charId) || charId <= 0) {
        throw new Error("Invalid character ID");
      }
      if (!newAdminCharacterName.trim()) {
        throw new Error("Character name is required");
      }
      const response = await apiRequest("POST", "/api/admin/add-admin", {
        characterId: charId,
        characterName: newAdminCharacterName.trim(),
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Admin Added",
        description: data.message,
      });
      setNewAdminCharacterId("");
      setNewAdminCharacterName("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/info"] });
    },
    onError: (error: any) => {
      toast({
        title: "Add Failed",
        description: error.message || "Failed to add admin",
        variant: "destructive",
      });
    },
  });

  const removeAdminMutation = useMutation({
    mutationFn: async (characterId: number) => {
      const response = await apiRequest("POST", "/api/admin/remove-admin", { characterId });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Admin Removed",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/info"] });
    },
    onError: (error: any) => {
      toast({
        title: "Remove Failed",
        description: error.message || "Failed to remove admin",
        variant: "destructive",
      });
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: async ({ sessionId, totalIsk, killCount }: { sessionId: string; totalIsk: number; killCount: number }) => {
      const response = await apiRequest("PUT", `/api/admin/sessions/${sessionId}`, { totalIsk, killCount });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Session Updated",
        description: data.message,
      });
      setEditingSession(null);
      setEditSessionIsk("");
      setEditSessionKills("");
      refetchSessions();
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update session",
        variant: "destructive",
      });
    },
  });

  const terminateSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await apiRequest("POST", `/api/admin/sessions/${sessionId}/terminate`, {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Session Terminated",
        description: data.message,
      });
      refetchSessions();
    },
    onError: (error: any) => {
      toast({
        title: "Terminate Failed",
        description: error.message || "Failed to terminate session",
        variant: "destructive",
      });
    },
  });

  // Support ticket mutations
  const updateTicketStatusMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/support/tickets/${ticketId}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Status Updated",
        description: "Ticket status has been updated",
      });
      refetchTickets();
      refetchSelectedTicket();
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update ticket status",
        variant: "destructive",
      });
    },
  });

  const assignTicketMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const response = await apiRequest("PATCH", `/api/admin/support/tickets/${ticketId}/assign`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Ticket Assigned",
        description: "You have been assigned to this ticket",
      });
      refetchTickets();
      refetchSelectedTicket();
    },
    onError: (error: any) => {
      toast({
        title: "Assignment Failed",
        description: error.message || "Failed to assign ticket",
        variant: "destructive",
      });
    },
  });

  const updateTicketNotesMutation = useMutation({
    mutationFn: async ({ ticketId, notes }: { ticketId: string; notes: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/support/tickets/${ticketId}/notes`, { notes });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Notes Updated",
        description: "Admin notes have been saved",
      });
      refetchSelectedTicket();
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update notes",
        variant: "destructive",
      });
    },
  });

  const createTicketReplyMutation = useMutation({
    mutationFn: async ({ ticketId, message }: { ticketId: string; message: string }) => {
      const response = await apiRequest("POST", `/api/support/tickets/${ticketId}/replies`, { message, attachments: [] });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Reply Sent",
        description: "Your reply has been added to the ticket",
      });
      setTicketReplyMessage("");
      refetchSelectedTicket();
    },
    onError: (error: any) => {
      toast({
        title: "Reply Failed",
        description: error.message || "Failed to send reply",
        variant: "destructive",
      });
    },
  });

  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString();
  };

  const formatIsk = (amount: number) => {
    return new Intl.NumberFormat().format(amount) + " ISK";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-600">Active</Badge>;
      case "expired":
        return <Badge variant="secondary">Expired</Badge>;
      case "revoked":
        return <Badge variant="destructive">Revoked</Badge>;
      case "pending":
        return <Badge className="bg-yellow-600">Pending</Badge>;
      case "used":
        return <Badge className="bg-blue-600">Used</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getBadgeIcon = (badgeType: SpecialBadgeType) => {
    const info = SPECIAL_BADGE_TYPES[badgeType];
    switch (info?.icon) {
      case "Star": return <Star className="w-3 h-3" />;
      case "Heart": return <Heart className="w-3 h-3" />;
      case "Trophy": return <Trophy className="w-3 h-3" />;
      case "Rocket": return <Rocket className="w-3 h-3" />;
      case "FlaskConical": return <FlaskConical className="w-3 h-3" />;
      case "Crown": return <Crown className="w-3 h-3" />;
      case "Gem": return <Gem className="w-3 h-3" />;
      case "Video": return <Video className="w-3 h-3" />;
      case "Building2": return <Building2 className="w-3 h-3" />;
      case "ChevronsUp": return <ChevronsUp className="w-3 h-3" />;
      case "HandHelping": return <HandHelping className="w-3 h-3" />;
      case "Flag": return <Flag className="w-3 h-3" />;
      default: return <Award className="w-3 h-3" />;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Code copied to clipboard",
    });
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Shield className="w-5 h-5" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You do not have administrator privileges to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setLocation("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-card/50">
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-back-dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              <div>
                <h1 className="text-xl font-bold">Admin Control Panel</h1>
                <p className="text-sm text-muted-foreground">Manage PRO subscriptions, view statistics, and control system settings</p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => adminTutorial.restart()}
            data-testid="button-admin-tutorial"
          >
            <GraduationCap className="w-4 h-4 mr-2" />
            Admin Guide
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="flex flex-wrap gap-1 h-auto mb-4" data-testid="admin-tabs">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">
              <Activity className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="subscriptions" data-testid="tab-subscriptions">
              <Crown className="w-4 h-4 mr-2" />
              Subscriptions
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="support" data-testid="tab-support">
              <MessageSquare className="w-4 h-4 mr-2" />
              Support
              {ticketStats && ticketStats.open > 0 && (
                <Badge variant="secondary" className="ml-2 bg-yellow-500/20 text-yellow-500">
                  {ticketStats.open}
                </Badge>
              )}
              {totalAdminNotifications > 0 && (
                <Badge variant="destructive" className="ml-1" data-testid="badge-admin-notifications">
                  {totalAdminNotifications}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="logs" data-testid="tab-logs">
              <FileText className="w-4 h-4 mr-2" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="tools" data-testid="tab-tools">
              <Wrench className="w-4 h-4 mr-2" />
              Tools
            </TabsTrigger>
            <TabsTrigger value="changelog" data-testid="tab-changelog">
              <ScrollText className="w-4 h-4 mr-2" />
              Changelog
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            <TabsContent value="dashboard" className="m-0 space-y-4 animate-in fade-in-0 duration-200">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active PRO</CardTitle>
                    <Crown className="w-4 h-4 text-yellow-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono">{stats?.activeSubscriptions || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">subscribers</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pending Codes</CardTitle>
                    <Clock className="w-4 h-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono">{stats?.pendingCodes || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">awaiting payment</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Gifts</CardTitle>
                    <Gift className="w-4 h-4 text-pink-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono">{stats?.totalGifts || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">subscriptions gifted</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Processed</CardTitle>
                    <Check className="w-4 h-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono">{stats?.processedTransactions || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">wallet transactions</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Admin Status</CardTitle>
                  <Badge variant="default" className="bg-primary">Active</Badge>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{character?.name}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Character ID: {character?.id}
                  </p>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Server Time</CardTitle>
                    <Server className="w-4 h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold font-mono">
                      {isLoading ? "Loading..." : error ? "Error" : adminInfo?.serverTime ? 
                        new Date(adminInfo.serverTime).toLocaleTimeString() : "N/A"}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {adminInfo?.serverTime ? new Date(adminInfo.serverTime).toLocaleDateString() : ""}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                    <Clock className="w-4 h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono">{systemStats?.uptime.formatted || "N/A"}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Started: {systemStats?.uptime.startedAt ? formatDate(systemStats.uptime.startedAt) : "N/A"}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">ESI Status</CardTitle>
                    <Server className="w-4 h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {systemStats?.esiStatus.status === "online" ? (
                        <Badge className="bg-green-600">Online</Badge>
                      ) : (
                        <Badge variant="destructive">Offline</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {systemStats?.esiStatus.message || "Unknown"}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                    <HardDrive className="w-4 h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono">
                      {systemStats?.memoryUsage ? 
                        `${systemStats.memoryUsage.heapUsed}MB` : "N/A"}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      of {systemStats?.memoryUsage ? 
                        `${systemStats.memoryUsage.heapTotal}MB` : "N/A"} heap
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Platform Statistics</CardTitle>
                  <Activity className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <div>
                      <div className="text-lg font-bold font-mono">{systemStats?.sessions.totalSessions || 0}</div>
                      <p className="text-xs text-muted-foreground">Total Sessions</p>
                    </div>
                    <div>
                      <div className="text-lg font-bold font-mono">{systemStats?.sessions.activeSessions || 0}</div>
                      <p className="text-xs text-muted-foreground">Active Now</p>
                    </div>
                    <div>
                      <div className="text-lg font-bold font-mono">{systemStats?.sessions.uniqueUsers || 0}</div>
                      <p className="text-xs text-muted-foreground">Unique Users</p>
                    </div>
                    <div>
                      <div className="text-lg font-bold font-mono">
                        {systemStats?.sessions.totalIskEarned ? formatIsk(systemStats.sessions.totalIskEarned) : "0 ISK"}
                      </div>
                      <p className="text-xs text-muted-foreground">Total ISK Earned</p>
                    </div>
                    <div>
                      <div className="text-lg font-bold font-mono">{systemStats?.sessions.totalKills || 0}</div>
                      <p className="text-xs text-muted-foreground">Total Kills</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => refetchSystemStats()} data-testid="button-refresh-stats">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Stats
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="subscriptions" className="m-0 space-y-4 animate-in fade-in-0 duration-200">
              <div className="flex items-center gap-2 mb-4">
                <Button 
                  variant={subscriptionsSubTab === "manage" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setSubscriptionsSubTab("manage")}
                  data-testid="subtab-manage"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Manage PRO
                </Button>
                <Button 
                  variant={subscriptionsSubTab === "codes" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setSubscriptionsSubTab("codes")}
                  data-testid="subtab-codes"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  PHOTON Codes
                </Button>
                <Button 
                  variant={subscriptionsSubTab === "activity" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setSubscriptionsSubTab("activity")}
                  data-testid="subtab-activity"
                >
                  <History className="w-4 h-4 mr-2" />
                  Activity
                </Button>
              </div>

              {subscriptionsSubTab === "manage" && (
              <>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gift className="w-4 h-4" />
                      Gift PRO Subscription
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="giftCharacterId">Character ID</Label>
                      <Input
                        id="giftCharacterId"
                        placeholder="12345678"
                        value={giftCharacterId}
                        onChange={(e) => setGiftCharacterId(e.target.value)}
                        data-testid="input-gift-character-id"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="giftCharacterName">Character Name</Label>
                      <Input
                        id="giftCharacterName"
                        placeholder="Character Name"
                        value={giftCharacterName}
                        onChange={(e) => setGiftCharacterName(e.target.value)}
                        data-testid="input-gift-character-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="giftDays">Duration (days)</Label>
                      <Select value={giftDays} onValueChange={setGiftDays}>
                        <SelectTrigger data-testid="select-gift-days">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7 days</SelectItem>
                          <SelectItem value="14">14 days</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                          <SelectItem value="365">365 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="giftNote">Note (optional)</Label>
                      <Input
                        id="giftNote"
                        placeholder="Reason for gift..."
                        value={giftNote}
                        onChange={(e) => setGiftNote(e.target.value)}
                        data-testid="input-gift-note"
                      />
                    </div>
                    <Button 
                      className="w-full" 
                      disabled={!isValidGiftForm() || giftProMutation.isPending}
                      onClick={() => giftProMutation.mutate()}
                      data-testid="button-gift-pro"
                    >
                      {giftProMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Gift className="w-4 h-4 mr-2" />
                      )}
                      Gift PRO
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      Payment Verification
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="verifyCode">Activation Code</Label>
                      <Input
                        id="verifyCode"
                        placeholder="PRO-XXXX-XXXX"
                        value={verifyCode}
                        onChange={(e) => setVerifyCode(e.target.value)}
                        data-testid="input-verify-code"
                      />
                    </div>
                    <Button 
                      className="w-full" 
                      disabled={!verifyCode.trim() || verifyPaymentMutation.isPending}
                      onClick={() => verifyPaymentMutation.mutate()}
                      data-testid="button-verify-payment"
                    >
                      {verifyPaymentMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 mr-2" />
                      )}
                      Verify Payment
                    </Button>
                    <div className="border-t pt-4">
                      <Button 
                        variant="outline" 
                        className="w-full"
                        disabled={autoCheckMutation.isPending}
                        onClick={() => autoCheckMutation.mutate()}
                        data-testid="button-auto-check"
                      >
                        {autoCheckMutation.isPending ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Auto-Check Wallet
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">
                        Automatically check wallet for pending payments
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="w-4 h-4" />
                    Active Subscriptions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {subscriptions.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No active subscriptions</p>
                  ) : (
                    <div className="space-y-2">
                      {subscriptions.slice(0, 10).map((sub) => (
                        <div key={sub.characterId} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                          <div>
                            <div className="font-medium">{sub.characterName}</div>
                            <div className="text-xs text-muted-foreground">
                              Expires: {sub.expiresAt ? formatDate(sub.expiresAt) : "Never"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(sub.status)}
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => revokeSubscriptionMutation.mutate(sub.characterId)}
                              disabled={revokeSubscriptionMutation.isPending}
                              data-testid={`button-revoke-${sub.characterId}`}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    PRO Subscription Notification Emails
                  </CardTitle>
                  <CardDescription>
                    Email addresses that receive alerts when new PRO subscriptions are activated
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="Enter email address..."
                      value={newNotificationEmail}
                      onChange={(e) => setNewNotificationEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newNotificationEmail.trim()) {
                          addNotificationEmailMutation.mutate(newNotificationEmail.trim());
                        }
                      }}
                      data-testid="input-notification-email"
                    />
                    <Button
                      onClick={() => addNotificationEmailMutation.mutate(newNotificationEmail.trim())}
                      disabled={!newNotificationEmail.trim() || addNotificationEmailMutation.isPending}
                      data-testid="button-add-notification-email"
                    >
                      {addNotificationEmailMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  
                  {notificationEmailsData?.emails && notificationEmailsData.emails.length > 0 ? (
                    <div className="space-y-2">
                      {notificationEmailsData.emails.map((email) => (
                        <div 
                          key={email.id} 
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                          data-testid={`notification-email-${email.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-medium">{email.email}</div>
                              <div className="text-xs text-muted-foreground">
                                Added by {email.addedByCharacterName}
                              </div>
                            </div>
                            {!email.isActive && (
                              <Badge variant="outline" className="text-xs">Disabled</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleNotificationEmailMutation.mutate({ 
                                id: email.id, 
                                isActive: !email.isActive 
                              })}
                              disabled={toggleNotificationEmailMutation.isPending}
                              data-testid={`button-toggle-email-${email.id}`}
                            >
                              <Power className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => removeNotificationEmailMutation.mutate(email.id)}
                              disabled={removeNotificationEmailMutation.isPending}
                              data-testid={`button-remove-email-${email.id}`}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4 text-sm">
                      No notification emails configured. Add emails to receive alerts about new PRO subscriptions.
                    </p>
                  )}
                </CardContent>
              </Card>
              </>
              )}

              {subscriptionsSubTab === "codes" && (
              <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Generate PHOTON Code
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Code Type</Label>
                      <Select value={photonCodeType} onValueChange={(v: any) => setPhotonCodeType(v)}>
                        <SelectTrigger data-testid="select-photon-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pro_subscription">PRO Subscription</SelectItem>
                          <SelectItem value="theme_unlock">Theme Unlock</SelectItem>
                          <SelectItem value="badge_grant">Badge Grant</SelectItem>
                          <SelectItem value="tile_unlock">Tile Unlock</SelectItem>
                          <SelectItem value="bundle">Bundle</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(photonCodeType === "pro_subscription" || photonCodeType === "bundle") && (
                      <div className="space-y-2">
                        <Label>PRO Duration (days)</Label>
                        <Input
                          type="number"
                          min="1"
                          max="365"
                          value={photonProDays}
                          onChange={(e) => setPhotonProDays(e.target.value)}
                          data-testid="input-photon-days"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Max Redemptions</Label>
                      <Input
                        type="number"
                        min="1"
                        max="1000"
                        value={photonMaxRedemptions}
                        onChange={(e) => setPhotonMaxRedemptions(e.target.value)}
                        data-testid="input-photon-max-redemptions"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Batch Count</Label>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={photonBatchCount}
                        onChange={(e) => setPhotonBatchCount(e.target.value)}
                        data-testid="input-photon-batch"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="neverExpires"
                          checked={photonNeverExpires}
                          onCheckedChange={(c) => setPhotonNeverExpires(!!c)}
                          data-testid="checkbox-never-expires"
                        />
                        <Label htmlFor="neverExpires">Never Expires</Label>
                      </div>
                      {!photonNeverExpires && (
                        <Input
                          type="number"
                          min="1"
                          max="365"
                          placeholder="Expiry days"
                          value={photonExpiryDays}
                          onChange={(e) => setPhotonExpiryDays(e.target.value)}
                          data-testid="input-photon-expiry"
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Note (optional)</Label>
                      <Input
                        placeholder="Internal note..."
                        value={photonNote}
                        onChange={(e) => setPhotonNote(e.target.value)}
                        data-testid="input-photon-note"
                      />
                    </div>
                  </div>

                  {(photonCodeType === "badge_grant" || photonCodeType === "bundle") && (
                    <div className="space-y-2">
                      <Label>Badges to Grant</Label>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(SPECIAL_BADGE_TYPES).map(([key, info]) => (
                          <Button
                            key={key}
                            size="sm"
                            variant={photonBadges.includes(key as SpecialBadgeType) ? "default" : "outline"}
                            onClick={() => {
                              if (photonBadges.includes(key as SpecialBadgeType)) {
                                setPhotonBadges(photonBadges.filter(b => b !== key));
                              } else {
                                setPhotonBadges([...photonBadges, key as SpecialBadgeType]);
                              }
                            }}
                            data-testid={`button-badge-${key}`}
                          >
                            {getBadgeIcon(key as SpecialBadgeType)}
                            <span className="ml-1">{info.name}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {(photonCodeType === "theme_unlock" || photonCodeType === "bundle") && (
                    <div className="space-y-2">
                      <Label>Themes to Unlock</Label>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(FACTION_THEMES).filter(([_, info]) => info.isPro).map(([key, info]) => (
                          <Button
                            key={key}
                            size="sm"
                            variant={photonThemes.includes(key as FactionTheme) ? "default" : "outline"}
                            onClick={() => {
                              if (photonThemes.includes(key as FactionTheme)) {
                                setPhotonThemes(photonThemes.filter(t => t !== key));
                              } else {
                                setPhotonThemes([...photonThemes, key as FactionTheme]);
                              }
                            }}
                            data-testid={`button-theme-${key}`}
                          >
                            <Palette className="w-3 h-3 mr-1" />
                            {info.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {(photonCodeType === "tile_unlock" || photonCodeType === "bundle") && (
                    <div className="space-y-2">
                      <Label>Tiles to Unlock</Label>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(BONUS_TILES).map(([key, tileName]) => (
                          <Button
                            key={key}
                            size="sm"
                            variant={photonTiles.includes(key as BonusTile) ? "default" : "outline"}
                            onClick={() => {
                              if (photonTiles.includes(key as BonusTile)) {
                                setPhotonTiles(photonTiles.filter(t => t !== key));
                              } else {
                                setPhotonTiles([...photonTiles, key as BonusTile]);
                              }
                            }}
                            data-testid={`button-tile-${key}`}
                          >
                            <LayoutGrid className="w-3 h-3 mr-1" />
                            {tileName}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button 
                    className="w-full" 
                    disabled={generatePhotonCodeMutation.isPending}
                    onClick={() => generatePhotonCodeMutation.mutate()}
                    data-testid="button-generate-photon"
                  >
                    {generatePhotonCodeMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4 mr-2" />
                    )}
                    Generate PHOTON Code(s)
                  </Button>

                  {generatedPhotonCodes.length > 0 && (
                    <div className="mt-4 p-4 rounded-lg bg-muted">
                      <Label className="text-sm font-medium">Generated Codes:</Label>
                      <div className="space-y-2 mt-2">
                        {generatedPhotonCodes.map((code, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <code className="flex-1 text-sm font-mono bg-background p-2 rounded">{code}</code>
                            <Button size="icon" variant="ghost" onClick={() => copyToClipboard(code)}>
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      PHOTON Codes
                    </span>
                    <div className="flex items-center gap-2">
                      <Select value={photonCodesFilter} onValueChange={(v: any) => setPhotonCodesFilter(v)}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="redeemed">Redeemed</SelectItem>
                          <SelectItem value="revoked">Revoked</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" onClick={() => refetchPhotonCodes()}>
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {photonCodes.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No PHOTON codes found</p>
                  ) : (
                    <div className="space-y-2">
                      {photonCodes.map((code) => (
                        <div key={code.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <code className="font-mono text-sm">{code.code}</code>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(code.code)}>
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-xs">{code.codeType}</Badge>
                              <span>{code.currentRedemptions}/{code.maxRedemptions} uses</span>
                              {code.proDurationDays && <span>{code.proDurationDays}d PRO</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(code.status)}
                            {code.status === "active" && (
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => revokePhotonCodeMutation.mutate(code.id)}
                                disabled={revokePhotonCodeMutation.isPending}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {photonCodesTotal > photonCodesPageSize && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={photonCodesPage === 0}
                        onClick={() => setPhotonCodesPage(p => p - 1)}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {photonCodesPage + 1} of {Math.ceil(photonCodesTotal / photonCodesPageSize)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={(photonCodesPage + 1) * photonCodesPageSize >= photonCodesTotal}
                        onClick={() => setPhotonCodesPage(p => p + 1)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              </>
              )}

              {subscriptionsSubTab === "activity" && (
              <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Code Activity Log
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <Select value={activityFilter} onValueChange={(v: any) => { setActivityFilter(v); setActivityPage(0); }}>
                      <SelectTrigger className="w-[180px]" data-testid="select-activity-filter">
                        <SelectValue placeholder="Filter by type..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Activity</SelectItem>
                        <SelectItem value="created">Created</SelectItem>
                        <SelectItem value="redeemed">Redeemed</SelectItem>
                        <SelectItem value="revoked">Revoked</SelectItem>
                        <SelectItem value="failed_redemption">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => refetchActivityLog()}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>

                  {activityLogData?.logs && activityLogData.logs.length > 0 ? (
                    <div className="space-y-2">
                      {activityLogData.logs.map((log) => (
                        <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={
                                log.action === "redeemed" ? "default" :
                                log.action === "created" ? "secondary" :
                                log.action === "revoked" ? "destructive" : "outline"
                              }>
                                {log.action}
                              </Badge>
                              <span className="font-mono text-sm">{log.code}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {log.actorCharacterName || "System"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(log.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No activity recorded yet</p>
                  )}

                  {activityLogData && activityLogData.total > 50 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={activityPage === 0}
                        onClick={() => setActivityPage(p => p - 1)}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {activityPage + 1} of {Math.ceil(activityLogData.total / 50)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={(activityPage + 1) * 50 >= activityLogData.total}
                        onClick={() => setActivityPage(p => p + 1)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              </>
              )}
            </TabsContent>

            <TabsContent value="users" className="m-0 space-y-4 animate-in fade-in-0 duration-200">
              {/* User Browser with Search and Details */}
              <div className="grid gap-4 lg:grid-cols-3">
                {/* User List Panel */}
                <Card className="lg:col-span-1">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Users
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => refetchUsers()}>
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </CardTitle>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search users..."
                          value={usersSearch}
                          onChange={(e) => { setUsersSearch(e.target.value); setUsersPage(0); }}
                          className="pl-8"
                          data-testid="input-users-search"
                        />
                      </div>
                      <Select value={usersFilter} onValueChange={(v: "all" | "pro" | "suspended" | "active") => { setUsersFilter(v); setUsersPage(0); }}>
                        <SelectTrigger className="w-24" data-testid="select-users-filter">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="pro">PRO</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[400px]">
                      {usersLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : (usersData?.users || []).length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No users found</p>
                      ) : (
                        <div className="divide-y">
                          {(usersData?.users || []).map((user) => (
                            <div
                              key={user.characterId}
                              className={`p-3 cursor-pointer hover-elevate ${selectedUserId === user.characterId ? 'bg-accent' : ''}`}
                              onClick={() => setSelectedUserId(user.characterId)}
                              data-testid={`user-row-${user.characterId}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{user.characterName}</span>
                                {user.isPro && <Badge variant="secondary" className="text-xs"><Zap className="w-3 h-3 mr-1" />PRO</Badge>}
                                {user.isSuspended && <Badge variant="destructive" className="text-xs">Suspended</Badge>}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                ID: {user.characterId} | Sessions: {user.totalSessions}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                    {usersData && usersData.total > usersPageSize && (
                      <div className="flex items-center justify-center gap-2 p-2 border-t">
                        <Button size="sm" variant="outline" disabled={usersPage === 0} onClick={() => setUsersPage(p => p - 1)}>
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {usersPage + 1}/{Math.ceil(usersData.total / usersPageSize)}
                        </span>
                        <Button size="sm" variant="outline" disabled={(usersPage + 1) * usersPageSize >= usersData.total} onClick={() => setUsersPage(p => p + 1)}>
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* User Details Panel */}
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {selectedUserId ? (selectedUserData?.characterName || 'Loading...') : 'Select a User'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!selectedUserId ? (
                      <p className="text-center text-muted-foreground py-8">Click on a user to view their details</p>
                    ) : selectedUserLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : selectedUserData ? (
                      <div className="space-y-4">
                        {/* User Info */}
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Character ID</p>
                            <p className="font-mono text-sm">{selectedUserData.characterId}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Status</p>
                            <div className="flex gap-2 flex-wrap">
                              {selectedUserData.recentSessions?.some(s => s.isActive) && (
                                <Badge variant="default" className="bg-green-500/20 text-green-500 border-green-500/30">
                                  <Activity className="w-3 h-3 mr-1" />
                                  In Session
                                </Badge>
                              )}
                              {selectedUserData.isPro && <Badge variant="secondary"><Zap className="w-3 h-3 mr-1" />PRO</Badge>}
                              {selectedUserData.isAdmin && <Badge variant="outline"><Shield className="w-3 h-3 mr-1" />Admin</Badge>}
                              {selectedUserData.isSuspended && <Badge variant="destructive">Suspended</Badge>}
                              {!selectedUserData.isPro && !selectedUserData.isAdmin && !selectedUserData.isSuspended && <Badge variant="outline">Free User</Badge>}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Corporation</p>
                            <p className="text-sm">{selectedUserData.corporationName || <span className="text-muted-foreground italic">Unknown</span>}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Alliance</p>
                            <p className="text-sm">{selectedUserData.allianceName || <span className="text-muted-foreground italic">None</span>}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Total Sessions</p>
                            <p className="font-mono text-sm">{selectedUserData.totalSessions}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Total ISK Earned</p>
                            <p className="font-mono text-sm">{(selectedUserData.totalIsk || 0).toLocaleString()} ISK</p>
                          </div>
                        </div>
                        
                        {/* Recent Sessions */}
                        {selectedUserData.recentSessions && selectedUserData.recentSessions.length > 0 && (
                          <>
                            <Separator />
                            <div className="space-y-2">
                              <Label className="text-sm font-medium flex items-center gap-2">
                                <History className="w-4 h-4" />
                                Recent Sessions ({selectedUserData.recentSessions.length})
                              </Label>
                              <div className="space-y-1 max-h-40 overflow-y-auto">
                                {selectedUserData.recentSessions.slice(0, 5).map((session) => (
                                  <div 
                                    key={session.id}
                                    className={`flex items-center justify-between p-2 rounded-md text-sm ${
                                      session.isActive ? 'bg-green-500/10 border border-green-500/30' : 'bg-muted/50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      {session.isActive && (
                                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                      )}
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(session.startTime).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs">
                                      <span className="font-mono">{(session.totalIsk || 0).toLocaleString()} ISK</span>
                                      <span className="text-muted-foreground">{session.killCount || 0} kills</span>
                                      {session.isActive ? (
                                        <Badge variant="default" className="bg-green-500 text-white text-[10px] px-1.5 py-0">Active</Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">Ended</Badge>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        )}

                        <Separator />

                        {/* User Actions */}
                        <div className="space-y-3">
                          <Label className="text-sm font-medium">Actions</Label>
                          <div className="flex flex-wrap gap-2">
                            {/* Toggle Suspension */}
                            {selectedUserData.isSuspended && selectedUserData.activeSuspension ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (confirm('Lift suspension for this user?')) {
                                    liftSuspensionMutation.mutate({ suspensionId: selectedUserData.activeSuspension!.id });
                                  }
                                }}
                                disabled={liftSuspensionMutation.isPending}
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Lift Suspension
                              </Button>
                            ) : !selectedUserData.isSuspended ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSuspendReason("");
                                  setSuspendDays("7");
                                  setSuspendNote("");
                                  setShowSuspendDialog(true);
                                }}
                                disabled={suspendUserMutation.isPending}
                              >
                                <ShieldOff className="w-3 h-3 mr-1" />
                                Suspend
                              </Button>
                            ) : null}

                            {/* Gift PRO */}
                            {!selectedUserData.isPro && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (confirm(`Gift PRO subscription to ${selectedUserData.characterName}?`)) {
                                    // Set the form state and trigger mutation
                                    setGiftCharacterId(String(selectedUserData.characterId));
                                    setGiftCharacterName(selectedUserData.characterName);
                                    setGiftDays("7");
                                    setTimeout(() => giftProMutation.mutate(), 100);
                                  }
                                }}
                                disabled={giftProMutation.isPending}
                              >
                                <Gift className="w-3 h-3 mr-1" />
                                Gift PRO (7d)
                              </Button>
                            )}

                            {/* Revoke PRO */}
                            {selectedUserData.isPro && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  if (confirm(`Revoke PRO from ${selectedUserData.characterName}?`)) {
                                    revokeSubscriptionMutation.mutate(selectedUserData.characterId);
                                  }
                                }}
                                disabled={revokeSubscriptionMutation.isPending}
                              >
                                <X className="w-3 h-3 mr-1" />
                                Revoke PRO
                              </Button>
                            )}

                            {/* Admin Toggle - Only for Super Admins */}
                            {adminInfo?.isSuperAdmin && (
                              selectedUserData.isAdmin ? (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    if (confirm(`Remove admin privileges from ${selectedUserData.characterName}?`)) {
                                      removeAdminMutation.mutate(selectedUserData.characterId);
                                    }
                                  }}
                                  disabled={removeAdminMutation.isPending}
                                >
                                  <UserMinus className="w-3 h-3 mr-1" />
                                  Remove Admin
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    if (confirm(`Make ${selectedUserData.characterName} an admin?`)) {
                                      // Use mutation with the selected user's info
                                      setNewAdminCharacterId(String(selectedUserData.characterId));
                                      setNewAdminCharacterName(selectedUserData.characterName);
                                      setTimeout(() => addAdminMutation.mutate(), 100);
                                    }
                                  }}
                                  disabled={addAdminMutation.isPending}
                                >
                                  <UserPlus className="w-3 h-3 mr-1" />
                                  Make Admin
                                </Button>
                              )
                            )}
                          </div>
                        </div>

                        <Separator />

                        {/* Grant Badge to Selected User */}
                        <div className="space-y-3">
                          <Label className="text-sm font-medium">Grant Badge</Label>
                          <div className="flex gap-2 flex-wrap">
                            <Select value={userBadgeType} onValueChange={(v: SpecialBadgeType) => setUserBadgeType(v)}>
                              <SelectTrigger className="w-40" data-testid="select-user-badge-type">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(SPECIAL_BADGE_TYPES).map(([key, info]) => (
                                  <SelectItem key={key} value={key}>
                                    <span className="flex items-center gap-1">
                                      {getBadgeIcon(key as SpecialBadgeType)}
                                      {info.name}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              onClick={() => {
                                grantUserBadgeMutation.mutate({
                                  characterId: selectedUserData.characterId,
                                  characterName: selectedUserData.characterName,
                                  badgeType: userBadgeType,
                                  note: userBadgeNote || undefined,
                                });
                              }}
                              disabled={grantUserBadgeMutation.isPending}
                            >
                              <Award className="w-3 h-3 mr-1" />
                              Grant
                            </Button>
                          </div>
                        </div>

                        {/* User's Current Badges */}
                        {selectedUserData.badges && selectedUserData.badges.length > 0 && (
                          <>
                            <Separator />
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Current Badges</Label>
                              <div className="flex flex-wrap gap-2">
                                {selectedUserData.badges.map((badge: any) => (
                                  <div key={badge.id} className="flex items-center gap-1 p-2 rounded-lg bg-muted/50">
                                    {getBadgeIcon(badge.badgeType)}
                                    <span className="text-sm">{SPECIAL_BADGE_TYPES[badge.badgeType as SpecialBadgeType]?.name}</span>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-5 w-5"
                                      onClick={() => revokeBadgeMutation.mutate({ characterId: selectedUserData.characterId, badgeType: badge.badgeType })}
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">Failed to load user</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="support" className="m-0 space-y-4 animate-in fade-in-0 duration-200">
              {/* Ticket Stats Overview */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Open</CardTitle>
                    <Clock className="w-4 h-4 text-yellow-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono">{ticketStats?.open || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                    <Loader2 className="w-4 h-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono">{ticketStats?.inProgress || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Resolved</CardTitle>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono">{ticketStats?.resolved || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total</CardTitle>
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono">{ticketStats?.total || 0}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Ticket Filters */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Support Tickets
                    </span>
                    <div className="flex items-center gap-2">
                      <Select value={ticketsFilter} onValueChange={(v: any) => { setTicketsFilter(v); setTicketsPage(0); }}>
                        <SelectTrigger className="w-[130px]" data-testid="select-tickets-status">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={ticketsCategoryFilter} onValueChange={(v: any) => { setTicketsCategoryFilter(v); setTicketsPage(0); }}>
                        <SelectTrigger className="w-[130px]" data-testid="select-tickets-category">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          <SelectItem value="bug">Bug</SelectItem>
                          <SelectItem value="feature">Feature</SelectItem>
                          <SelectItem value="account">Account</SelectItem>
                          <SelectItem value="billing">Billing</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" onClick={() => refetchTickets()} data-testid="button-refresh-tickets">
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {/* Ticket List */}
                    <div className="space-y-2">
                      {tickets.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">No tickets found</p>
                      ) : (
                        <>
                          {tickets.map((ticket) => {
                            const categoryIcons: Record<string, typeof Bug> = {
                              bug: Bug,
                              feature: Lightbulb,
                              account: User,
                              billing: CreditCard,
                              other: HelpCircle,
                            };
                            const CategoryIcon = categoryIcons[ticket.category] || HelpCircle;
                            const priorityColors: Record<string, string> = {
                              low: "bg-muted text-muted-foreground",
                              normal: "bg-blue-500/20 text-blue-500",
                              high: "bg-orange-500/20 text-orange-500",
                              urgent: "bg-red-500/20 text-red-500",
                            };
                            const statusColors: Record<string, string> = {
                              open: "bg-yellow-500/20 text-yellow-500",
                              in_progress: "bg-blue-500/20 text-blue-500",
                              resolved: "bg-green-500/20 text-green-500",
                              closed: "bg-muted text-muted-foreground",
                            };
                            const unreadCount = adminNotificationsByTicket[ticket.id]?.length || 0;
                            
                            return (
                              <div
                                key={ticket.id}
                                className={`p-3 rounded-lg cursor-pointer transition-colors hover-elevate ${
                                  selectedTicketId === ticket.id ? "ring-2 ring-primary bg-muted/50" : "bg-muted/30"
                                } ${unreadCount > 0 ? "border border-destructive/50" : ""}`}
                                onClick={() => {
                                  setSelectedTicketId(ticket.id);
                                  setTicketAdminNotes(ticket.adminNotes || "");
                                  // Mark notifications for this ticket as read
                                  if (unreadCount > 0) {
                                    markAdminNotificationsReadMutation.mutate(ticket.id);
                                  }
                                }}
                                data-testid={`ticket-row-${ticket.ticketNumber}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <div className="relative">
                                      <CategoryIcon className="w-4 h-4 text-muted-foreground" />
                                      {unreadCount > 0 && (
                                        <span 
                                          className="absolute -top-1 -right-1 min-w-3 h-3 px-0.5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold"
                                          data-testid={`badge-admin-ticket-${ticket.ticketNumber}-unread`}
                                        >
                                          {unreadCount}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-xs font-mono text-muted-foreground">#{ticket.ticketNumber}</span>
                                    {ticket.isPro && (
                                      <Badge variant="secondary" className="bg-primary/20 text-primary text-xs">PRO</Badge>
                                    )}
                                    {unreadCount > 0 && (
                                      <Badge variant="destructive" className="text-[10px]" data-testid={`badge-admin-ticket-${ticket.ticketNumber}-new`}>
                                        {unreadCount} new
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Badge variant="secondary" className={`text-xs ${priorityColors[ticket.priority]}`}>
                                      {ticket.priority}
                                    </Badge>
                                    <Badge variant="secondary" className={`text-xs ${statusColors[ticket.status]}`}>
                                      {ticket.status.replace("_", " ")}
                                    </Badge>
                                  </div>
                                </div>
                                <h4 className="font-medium mt-1 truncate">{ticket.subject}</h4>
                                <div className="text-xs text-muted-foreground mt-1">
                                  <span>{ticket.characterName}</span>
                                  {ticket.corporationName && <span> [{ticket.corporationName}]</span>}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatDate(ticket.createdAt)}
                                </p>
                              </div>
                            );
                          })}
                          
                          {/* Pagination */}
                          {ticketsTotal > ticketsPageSize && (
                            <div className="flex items-center justify-between mt-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setTicketsPage(Math.max(0, ticketsPage - 1))}
                                disabled={ticketsPage === 0}
                              >
                                <ChevronLeft className="w-4 h-4" />
                                Previous
                              </Button>
                              <span className="text-sm text-muted-foreground">
                                Page {ticketsPage + 1} of {Math.ceil(ticketsTotal / ticketsPageSize)}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setTicketsPage(ticketsPage + 1)}
                                disabled={(ticketsPage + 1) * ticketsPageSize >= ticketsTotal}
                              >
                                Next
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Ticket Details */}
                    <div className="border-l pl-4">
                      {!selectedTicketId ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>Select a ticket to view details</p>
                        </div>
                      ) : !selectedTicketData ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium">Ticket #{selectedTicketData.ticket.ticketNumber}</h3>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedTicketId(null)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-wrap gap-2">
                            {!selectedTicketData.ticket.assignedToAdminId && (
                              <Button
                                size="sm"
                                onClick={() => assignTicketMutation.mutate(selectedTicketData.ticket.id)}
                                disabled={assignTicketMutation.isPending}
                              >
                                Assign to Me
                              </Button>
                            )}
                            <Select
                              value={selectedTicketData.ticket.status}
                              onValueChange={(status) => updateTicketStatusMutation.mutate({ 
                                ticketId: selectedTicketData.ticket.id, 
                                status 
                              })}
                            >
                              <SelectTrigger className="w-[130px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">Open</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="resolved">Resolved</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* User Info */}
                          <div className="p-3 bg-muted/30 rounded-lg text-sm">
                            <div className="font-medium">{selectedTicketData.ticket.characterName}</div>
                            {selectedTicketData.ticket.corporationName && (
                              <div className="text-muted-foreground">
                                Corp: {selectedTicketData.ticket.corporationName}
                              </div>
                            )}
                            {selectedTicketData.ticket.allianceName && (
                              <div className="text-muted-foreground">
                                Alliance: {selectedTicketData.ticket.allianceName}
                              </div>
                            )}
                            {selectedTicketData.ticket.assignedToAdminName && (
                              <div className="text-primary mt-2">
                                Assigned to: {selectedTicketData.ticket.assignedToAdminName}
                              </div>
                            )}
                          </div>

                          {/* Message */}
                          <div>
                            <Label className="text-xs text-muted-foreground">Subject</Label>
                            <p className="font-medium">{selectedTicketData.ticket.subject}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Message</Label>
                            <div className="p-3 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap max-h-40 overflow-auto">
                              {selectedTicketData.ticket.message}
                            </div>
                          </div>

                          {/* Admin Notes */}
                          <div>
                            <Label className="text-xs text-muted-foreground">Admin Notes (private)</Label>
                            <textarea
                              className="w-full p-2 text-sm border rounded-md bg-background min-h-[60px]"
                              value={ticketAdminNotes}
                              onChange={(e) => setTicketAdminNotes(e.target.value)}
                              placeholder="Internal notes..."
                              data-testid="textarea-admin-notes"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-1"
                              onClick={() => updateTicketNotesMutation.mutate({
                                ticketId: selectedTicketData.ticket.id,
                                notes: ticketAdminNotes,
                              })}
                              disabled={updateTicketNotesMutation.isPending}
                            >
                              Save Notes
                            </Button>
                          </div>

                          {/* Replies */}
                          {selectedTicketData.replies.length > 0 && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Conversation</Label>
                              <div className="space-y-2 mt-2 max-h-60 overflow-auto">
                                {selectedTicketData.replies.map((reply) => (
                                  <div
                                    key={reply.id}
                                    className={`p-2 rounded-lg text-sm ${
                                      reply.isAdmin ? "bg-primary/10 border-l-2 border-primary" : "bg-muted/50"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium text-xs">{reply.characterName}</span>
                                      {reply.isAdmin && (
                                        <Badge variant="secondary" className="text-xs bg-primary/20 text-primary">Admin</Badge>
                                      )}
                                      <span className="text-xs text-muted-foreground ml-auto">
                                        {formatDate(reply.createdAt)}
                                      </span>
                                    </div>
                                    <p className="whitespace-pre-wrap">{reply.message}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Reply Form */}
                          {selectedTicketData.ticket.status !== "closed" && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Reply to User</Label>
                              <textarea
                                className="w-full p-2 text-sm border rounded-md bg-background min-h-[80px]"
                                value={ticketReplyMessage}
                                onChange={(e) => setTicketReplyMessage(e.target.value)}
                                placeholder="Type your reply..."
                                data-testid="textarea-reply"
                              />
                              <Button
                                size="sm"
                                className="mt-1"
                                onClick={() => createTicketReplyMutation.mutate({
                                  ticketId: selectedTicketData.ticket.id,
                                  message: ticketReplyMessage,
                                })}
                                disabled={createTicketReplyMutation.isPending || !ticketReplyMessage.trim()}
                              >
                                {createTicketReplyMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : null}
                                Send Reply
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="logs" className="m-0 space-y-4 animate-in fade-in-0 duration-200">
              <div className="flex items-center gap-2 mb-4">
                <Button 
                  variant={logsSubTab === "sessions" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setLogsSubTab("sessions")}
                >
                  <Timer className="w-4 h-4 mr-2" />
                  Sessions
                </Button>
                <Button 
                  variant={logsSubTab === "audit" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setLogsSubTab("audit")}
                >
                  <ScrollText className="w-4 h-4 mr-2" />
                  Audit Log
                </Button>
              </div>

              {logsSubTab === "sessions" && (
              <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Timer className="w-4 h-4" />
                      Ratting Sessions
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search by name..."
                          className="pl-8 w-[200px]"
                          value={sessionsSearch}
                          onChange={(e) => setSessionsSearch(e.target.value)}
                          data-testid="input-sessions-search"
                        />
                      </div>
                      <Select value={sessionsFilter} onValueChange={(v: any) => setSessionsFilter(v)}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" onClick={() => refetchSessions()}>
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!sessionsData?.sessions?.length ? (
                    <p className="text-muted-foreground text-center py-4">No sessions found</p>
                  ) : (
                    <div className="space-y-2">
                      {sessionsData.sessions.map((session) => (
                        <div key={session.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{session.characterName}</span>
                              {session.isActive ? (
                                <Badge className="bg-green-600">Active</Badge>
                              ) : (
                                <Badge variant="secondary">Completed</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Started: {formatDate(session.startTime)}
                              {session.endTime && ` | Ended: ${formatDate(session.endTime)}`}
                            </div>
                            {editingSession === session.id ? (
                              <div className="flex items-center gap-2 mt-2">
                                <Input
                                  type="number"
                                  placeholder="Total ISK"
                                  value={editSessionIsk}
                                  onChange={(e) => setEditSessionIsk(e.target.value)}
                                  className="w-32"
                                />
                                <Input
                                  type="number"
                                  placeholder="Kills"
                                  value={editSessionKills}
                                  onChange={(e) => setEditSessionKills(e.target.value)}
                                  className="w-20"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => updateSessionMutation.mutate({
                                    sessionId: session.id,
                                    totalIsk: parseInt(editSessionIsk) || session.totalIsk,
                                    killCount: parseInt(editSessionKills) || session.killCount,
                                  })}
                                  disabled={updateSessionMutation.isPending}
                                >
                                  Save
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingSession(null)}>
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <div className="text-sm">
                                <span className="font-mono">{formatIsk(session.totalIsk)}</span>
                                <span className="text-muted-foreground"> | {session.killCount} kills</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setEditingSession(session.id);
                                setEditSessionIsk(String(session.totalIsk));
                                setEditSessionKills(String(session.killCount));
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            {session.isActive && (
                              <Button
                                size="icon"
                                variant="destructive"
                                onClick={() => terminateSessionMutation.mutate(session.id)}
                                disabled={terminateSessionMutation.isPending}
                              >
                                <Power className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {sessionsData && sessionsData.total > sessionsPageSize && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={sessionsPage === 0}
                        onClick={() => setSessionsPage(p => p - 1)}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {sessionsPage + 1} of {Math.ceil(sessionsData.total / sessionsPageSize)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={(sessionsPage + 1) * sessionsPageSize >= sessionsData.total}
                        onClick={() => setSessionsPage(p => p + 1)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              </>
              )}

              {logsSubTab === "audit" && (
              <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Admin Audit Log
                    </span>
                    <div className="flex items-center gap-2">
                      <Select value={auditLogActionFilter} onValueChange={(v) => { setAuditLogActionFilter(v); setAuditLogPage(0); }}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Filter by action" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Actions</SelectItem>
                          <SelectItem value="suspend_user">Suspend User</SelectItem>
                          <SelectItem value="lift_suspension">Lift Suspension</SelectItem>
                          <SelectItem value="create_note">Create Note</SelectItem>
                          <SelectItem value="delete_note">Delete Note</SelectItem>
                          <SelectItem value="grant_badge">Grant Badge</SelectItem>
                          <SelectItem value="revoke_badge">Revoke Badge</SelectItem>
                          <SelectItem value="add_admin">Add Admin</SelectItem>
                          <SelectItem value="remove_admin">Remove Admin</SelectItem>
                          <SelectItem value="gift_pro">Gift PRO</SelectItem>
                          <SelectItem value="revoke_subscription">Revoke Subscription</SelectItem>
                          <SelectItem value="extend_subscription">Extend Subscription</SelectItem>
                          <SelectItem value="delete_session">Delete Session</SelectItem>
                          <SelectItem value="generate_photon_codes">Generate PHOTON Codes</SelectItem>
                          <SelectItem value="revoke_photon_code">Revoke PHOTON Code</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" onClick={() => refetchAuditLog()} data-testid="button-refresh-audit-log">
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {auditLogs.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No audit log entries found</p>
                  ) : (
                    <div className="space-y-2">
                      {auditLogs.map((log) => (
                        <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50" data-testid={`audit-log-entry-${log.id}`}>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={
                                log.action.includes("suspend") || log.action.includes("revoke") ? "destructive" :
                                log.action.includes("grant") || log.action.includes("add") || log.action.includes("create") ? "default" :
                                "secondary"
                              } className={
                                log.action.includes("grant") || log.action.includes("add") || log.action.includes("create") ? "bg-green-600" : ""
                              }>
                                {log.action.replace(/_/g, ' ').toUpperCase()}
                              </Badge>
                              <span className="text-sm text-muted-foreground">by</span>
                              <span className="font-medium">{log.adminCharacterName}</span>
                            </div>
                            {log.targetCharacterName && (
                              <p className="text-sm">
                                Target: <span className="font-medium">{log.targetCharacterName}</span>
                                <span className="text-muted-foreground"> ({log.targetCharacterId})</span>
                              </p>
                            )}
                            {log.details && Object.keys(log.details).length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {Object.entries(log.details).map(([key, value]) => (
                                  <span key={key} className="mr-2">
                                    <span className="font-medium">{key}:</span> {String(value)}
                                  </span>
                                ))}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {formatDate(log.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {auditLogsTotal > auditLogPageSize && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={auditLogPage === 0}
                        onClick={() => setAuditLogPage(p => p - 1)}
                        data-testid="button-audit-log-prev"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {auditLogPage + 1} of {Math.ceil(auditLogsTotal / auditLogPageSize)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={(auditLogPage + 1) * auditLogPageSize >= auditLogsTotal}
                        onClick={() => setAuditLogPage(p => p + 1)}
                        data-testid="button-audit-log-next"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              </>
              )}
            </TabsContent>

            <TabsContent value="tools" className="m-0 animate-in fade-in-0 duration-200">
              <div className="space-y-6">
                {/* ADM Report Tool */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      ADM Report Generator
                    </CardTitle>
                    <CardDescription>
                      Create Activity Defense Multiplier reports for your sovereignty systems
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={() => window.location.href = '/admin/adm-report'}>
                      Open ADM Report Tool
                    </Button>
                  </CardContent>
                </Card>

                {/* Moon Calculator */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Moon className="w-5 h-5" />
                      Metenox Moon Calculator
                    </CardTitle>
                    <CardDescription>
                      Calculate ISK/month values for Metenox moon mining operations
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <MoonCalculatorPage embedded />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="changelog" className="m-0 animate-in fade-in-0 duration-200">
              <ChangelogManagement />
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Suspend User Dialog */}
        <Dialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldOff className="w-5 h-5 text-destructive" />
                Suspend User
              </DialogTitle>
              <DialogDescription>
                {selectedUserData ? `Suspending ${selectedUserData.characterName}` : 'Suspend this user from PHOTON'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="suspendDuration">Duration (days)</Label>
                <Select value={suspendDays} onValueChange={setSuspendDays}>
                  <SelectTrigger data-testid="select-suspend-duration">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 day</SelectItem>
                    <SelectItem value="3">3 days</SelectItem>
                    <SelectItem value="7">7 days (1 week)</SelectItem>
                    <SelectItem value="14">14 days (2 weeks)</SelectItem>
                    <SelectItem value="30">30 days (1 month)</SelectItem>
                    <SelectItem value="90">90 days (3 months)</SelectItem>
                    <SelectItem value="365">365 days (1 year)</SelectItem>
                    <SelectItem value="0">Permanent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="suspendReason">Reason *</Label>
                <Select value={suspendReason} onValueChange={setSuspendReason}>
                  <SelectTrigger data-testid="select-suspend-reason">
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Terms of Service Violation">Terms of Service Violation</SelectItem>
                    <SelectItem value="Abuse of Features">Abuse of Features</SelectItem>
                    <SelectItem value="Cheating / Exploits">Cheating / Exploits</SelectItem>
                    <SelectItem value="Harassment">Harassment</SelectItem>
                    <SelectItem value="Spam / Bot Activity">Spam / Bot Activity</SelectItem>
                    <SelectItem value="Fraudulent Activity">Fraudulent Activity</SelectItem>
                    <SelectItem value="Other">Other (specify in notes)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="suspendNote">Notes (optional)</Label>
                <Textarea
                  id="suspendNote"
                  placeholder="Additional details about this suspension..."
                  value={suspendNote}
                  onChange={(e) => setSuspendNote(e.target.value)}
                  className="min-h-[80px]"
                  data-testid="input-suspend-note"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSuspendDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedUserData && suspendReason) {
                    const fullReason = suspendNote 
                      ? `${suspendReason}: ${suspendNote}` 
                      : suspendReason;
                    suspendUserMutation.mutate({
                      characterId: selectedUserData.characterId,
                      characterName: selectedUserData.characterName,
                      reason: fullReason,
                      daysUntilExpiry: suspendDays === "0" ? undefined : parseInt(suspendDays, 10),
                    });
                    setShowSuspendDialog(false);
                  }
                }}
                disabled={!suspendReason || suspendUserMutation.isPending}
                data-testid="button-confirm-suspend"
              >
                {suspendUserMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ShieldOff className="w-4 h-4 mr-2" />
                )}
                Suspend User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <AdminTutorialOverlay />
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminTutorialProvider>
      <AdminPageContent />
    </AdminTutorialProvider>
  );
}
