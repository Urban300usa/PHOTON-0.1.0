import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Server, Users, Activity, Crown, Gift, Check, RefreshCw, Clock, X, Plus, History, Award, Rocket, Heart, FlaskConical, Star, Sparkles, Trash2, Gem, Video, Building2, ChevronsUp, Trophy, HandHelping, Flag, Palette, LayoutGrid, UserPlus, Timer, Zap, HardDrive, Search, Edit, ChevronLeft, ChevronRight, Power } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { SPECIAL_BADGE_TYPES, FACTION_THEMES, BONUS_TILES, type SpecialBadgeType, type FactionTheme, type BonusTile } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ProSubscription, ProActivationCode, ProGift } from "@shared/schema";

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

interface AdminPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AdminPanel({ open, onOpenChange }: AdminPanelProps) {
  const { character, isAdmin } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  
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

  // Queries
  const { data: adminInfo, isLoading, error } = useQuery<AdminInfo>({
    queryKey: ["/api/admin/info"],
    enabled: open && isAdmin,
  });

  const { data: statsData } = useQuery<{ statistics: AdminStatistics }>({
    queryKey: ["/api/admin/statistics"],
    enabled: open && isAdmin,
  });

  const { data: subscriptionsData } = useQuery<{ subscriptions: ProSubscription[], count: number }>({
    queryKey: ["/api/admin/subscriptions"],
    enabled: open && isAdmin,
  });

  const { data: codesData } = useQuery<{ codes: ProActivationCode[], count: number }>({
    queryKey: ["/api/admin/activation-codes"],
    enabled: open && isAdmin,
  });

  const { data: giftsData } = useQuery<{ gifts: ProGift[] }>({
    queryKey: ["/api/admin/gifts"],
    enabled: open && isAdmin,
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
    enabled: open && isAdmin,
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
    enabled: open && isAdmin && activeTab === "system",
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
    enabled: open && isAdmin && activeTab === "sessions",
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
    enabled: open && isAdmin && activeTab === "codes",
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
    enabled: open && isAdmin && activeTab === "activity",
  });

  const photonCodes = photonCodesData?.codes || [];
  const photonCodesTotal = photonCodesData?.total || 0;
  const activityLogs = activityLogData?.logs || [];
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
        title: "Failed to Add Admin",
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
        title: "Failed to Remove Admin",
        description: error.message || "Failed to remove admin",
        variant: "destructive",
      });
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: async ({ sessionId, totalIsk, killCount }: { sessionId: string; totalIsk: number; killCount: number }) => {
      const response = await apiRequest("POST", "/api/admin/update-session", { sessionId, totalIsk, killCount });
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Session Updated", description: data.message });
      setEditingSession(null);
      refetchSessions();
    },
    onError: (error: any) => {
      toast({ title: "Update Failed", description: error.message || "Failed to update session", variant: "destructive" });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await apiRequest("POST", "/api/admin/delete-session", { sessionId });
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Session Deleted", description: data.message });
      refetchSessions();
    },
    onError: (error: any) => {
      toast({ title: "Delete Failed", description: error.message || "Failed to delete session", variant: "destructive" });
    },
  });

  const badgeIcons: Record<string, typeof Rocket> = {
    Rocket,
    Crown,
    Heart,
    FlaskConical,
    Star,
    Gem,
    Video,
    Building2,
    ChevronsUp,
    Trophy,
    HandHelping,
    Award,
    Flag,
  };

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

  if (!isAdmin) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="admin-panel-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Admin Control Panel
          </DialogTitle>
          <DialogDescription>
            Manage PRO subscriptions, view statistics, and control system settings
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <Activity className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="pro" data-testid="tab-pro">
              <Crown className="w-4 h-4 mr-2" />
              PRO
            </TabsTrigger>
            <TabsTrigger value="codes" data-testid="tab-codes">
              <Zap className="w-4 h-4 mr-2" />
              Codes
            </TabsTrigger>
            <TabsTrigger value="badges" data-testid="tab-badges">
              <Award className="w-4 h-4 mr-2" />
              Badges
            </TabsTrigger>
            <TabsTrigger value="sessions" data-testid="tab-sessions">
              <Timer className="w-4 h-4 mr-2" />
              Sessions
            </TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">
              <History className="w-4 h-4 mr-2" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="system" data-testid="tab-system">
              <Server className="w-4 h-4 mr-2" />
              System
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            <TabsContent value="overview" className="m-0 space-y-4">
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
                    {error ? "Failed to load server info" : adminInfo?.serverTime ? new Date(adminInfo.serverTime).toLocaleDateString() : ""}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pro" className="m-0 space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-blue-500" />
                    Auto-Check Wallet
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Scan your wallet for ISK payments containing activation codes.
                  </p>
                  <Button 
                    onClick={() => autoCheckMutation.mutate()}
                    disabled={autoCheckMutation.isPending}
                    className="w-full"
                    data-testid="button-auto-check"
                  >
                    {autoCheckMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Checking Wallet...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Check Wallet for Payments
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Gift className="w-4 h-4 text-emerald-500" />
                    Gift Codes ({codes.filter(c => c.isGiftCode).length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {codes.filter(c => c.isGiftCode).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No gift codes generated yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-auto">
                      {codes.filter(c => c.isGiftCode).map((code) => (
                        <div key={code.code} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                          <div>
                            <span className="font-mono text-sm">{code.code}</span>
                            <p className="text-xs text-muted-foreground">
                              {code.giftDurationDays} days - {code.giftNote || "No note"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(code.status)}
                            {code.status === "used" && code.redeemedByCharacterName && (
                              <span className="text-xs text-muted-foreground">
                                by {code.redeemedByCharacterName}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-500" />
                    Pending Payment Codes ({codes.filter(c => c.status === "pending" && !c.isGiftCode).length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {codes.filter(c => c.status === "pending" && !c.isGiftCode).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No pending payment codes.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-auto">
                      {codes.filter(c => c.status === "pending" && !c.isGiftCode).map((code) => (
                        <div key={code.code} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                          <div>
                            <span className="font-mono text-sm">{code.code}</span>
                            <p className="text-xs text-muted-foreground">
                              {code.characterName} - {formatIsk(code.iskAmount)}
                            </p>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            Expires: {formatDate(code.expiresAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Crown className="w-4 h-4 text-yellow-500" />
                    Active Subscriptions ({subscriptions.filter(s => s.status === "active").length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {subscriptions.filter(s => s.status === "active").length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active subscriptions.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-auto">
                      {subscriptions.filter(s => s.status === "active").map((sub) => (
                        <div key={sub.characterId} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                          <div>
                            <span className="font-medium">{sub.characterName}</span>
                            <p className="text-xs text-muted-foreground">
                              ID: {sub.characterId} - Expires: {formatDate(sub.expiresAt)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => extendSubscriptionMutation.mutate({ characterId: sub.characterId, days: 7 })}
                              disabled={extendSubscriptionMutation.isPending}
                              data-testid={`button-extend-${sub.characterId}`}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              7d
                            </Button>
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
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Gift className="w-4 h-4 text-pink-500" />
                    Gift PRO Subscription
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="giftCharacterId">Character ID</Label>
                      <Input
                        id="giftCharacterId"
                        placeholder="e.g., 95693805"
                        value={giftCharacterId}
                        onChange={(e) => setGiftCharacterId(e.target.value)}
                        data-testid="input-gift-character-id"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="giftCharacterName">Character Name</Label>
                      <Input
                        id="giftCharacterName"
                        placeholder="e.g., Neveth Yuliyandi"
                        value={giftCharacterName}
                        onChange={(e) => setGiftCharacterName(e.target.value)}
                        data-testid="input-gift-character-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="giftDays">Duration (Days)</Label>
                      <Input
                        id="giftDays"
                        type="number"
                        min="1"
                        placeholder="7"
                        value={giftDays}
                        onChange={(e) => setGiftDays(e.target.value)}
                        data-testid="input-gift-days"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="giftNote">Note (Optional)</Label>
                      <Input
                        id="giftNote"
                        placeholder="e.g., Welcome gift"
                        value={giftNote}
                        onChange={(e) => setGiftNote(e.target.value)}
                        data-testid="input-gift-note"
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={() => giftProMutation.mutate()}
                    disabled={giftProMutation.isPending || !isValidGiftForm()}
                    className="w-full"
                    data-testid="button-gift-pro"
                  >
                    {giftProMutation.isPending ? "Gifting..." : "Gift PRO Subscription"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Manual Verification
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Manually verify a payment by entering the activation code.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="PRO-XXXX-XXXX-XXXX"
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.toUpperCase())}
                      className="font-mono"
                      data-testid="input-verify-code"
                    />
                    <Button 
                      onClick={() => verifyPaymentMutation.mutate()}
                      disabled={verifyPaymentMutation.isPending || !verifyCode}
                      data-testid="button-verify-payment"
                    >
                      {verifyPaymentMutation.isPending ? "Verifying..." : "Verify"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Plus className="w-4 h-4 text-blue-500" />
                    Extend Subscription
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Extend an existing subscription by character ID.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Character ID"
                      value={extendCharacterId}
                      onChange={(e) => setExtendCharacterId(e.target.value)}
                      className="font-mono"
                      data-testid="input-extend-character-id"
                    />
                    <Input
                      placeholder="Days"
                      type="number"
                      min="1"
                      value={extendDays}
                      onChange={(e) => setExtendDays(e.target.value)}
                      className="w-24"
                      data-testid="input-extend-days"
                    />
                    <Button 
                      onClick={() => {
                        const charId = parseInt(extendCharacterId, 10);
                        const days = parseInt(extendDays, 10);
                        if (!isNaN(charId) && charId > 0 && !isNaN(days) && days > 0) {
                          extendSubscriptionMutation.mutate({ characterId: charId, days });
                        }
                      }}
                      disabled={extendSubscriptionMutation.isPending || !extendCharacterId || !extendDays}
                      data-testid="button-extend-subscription"
                    >
                      {extendSubscriptionMutation.isPending ? "Extending..." : "Extend"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Gift className="w-4 h-4 text-emerald-500" />
                    Generate Redeemable Code
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Generate a gift code with PRO time and optional bonus rewards.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>PRO Duration (days)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="365"
                        value={giftCodeDays}
                        onChange={(e) => setGiftCodeDays(e.target.value)}
                        data-testid="input-gift-code-days"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Note (optional)</Label>
                      <Input
                        placeholder="Reason for code"
                        value={giftCodeNote}
                        onChange={(e) => setGiftCodeNote(e.target.value)}
                        data-testid="input-gift-code-note"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Award className="w-3 h-3" />
                        Badge Reward (optional)
                      </Label>
                      <Select value={giftCodeBadge || "none"} onValueChange={(v) => setGiftCodeBadge(v === "none" ? "" : v as SpecialBadgeType)}>
                        <SelectTrigger data-testid="select-gift-code-badge">
                          <SelectValue placeholder="No badge" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No badge</SelectItem>
                          {(Object.keys(SPECIAL_BADGE_TYPES) as SpecialBadgeType[]).map((type) => {
                            const BadgeIcon = badgeIcons[SPECIAL_BADGE_TYPES[type].icon] || Star;
                            return (
                              <SelectItem key={type} value={type}>
                                <div className="flex items-center gap-2">
                                  <BadgeIcon className="w-4 h-4" />
                                  {SPECIAL_BADGE_TYPES[type].name}
                                  <span className="text-xs text-muted-foreground capitalize">
                                    ({SPECIAL_BADGE_TYPES[type].rarity})
                                  </span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Palette className="w-3 h-3" />
                        Theme Unlock (optional)
                      </Label>
                      <Select value={giftCodeTheme || "none"} onValueChange={(v) => setGiftCodeTheme(v === "none" ? "" : v as FactionTheme)}>
                        <SelectTrigger data-testid="select-gift-code-theme">
                          <SelectValue placeholder="No theme" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No theme</SelectItem>
                          {(Object.keys(FACTION_THEMES) as FactionTheme[]).map((theme) => (
                            <SelectItem key={theme} value={theme}>
                              {FACTION_THEMES[theme].name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <LayoutGrid className="w-3 h-3" />
                      Bonus Tiles (optional)
                    </Label>
                    <div className="grid grid-cols-2 gap-2 p-3 rounded-md bg-muted/50">
                      {(Object.keys(BONUS_TILES) as BonusTile[]).map((tile) => (
                        <div key={tile} className="flex items-center gap-2">
                          <Checkbox
                            id={`tile-${tile}`}
                            checked={giftCodeTiles.includes(tile)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setGiftCodeTiles([...giftCodeTiles, tile]);
                              } else {
                                setGiftCodeTiles(giftCodeTiles.filter(t => t !== tile));
                              }
                            }}
                            data-testid={`checkbox-tile-${tile}`}
                          />
                          <label htmlFor={`tile-${tile}`} className="text-sm cursor-pointer">
                            {BONUS_TILES[tile]}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button 
                    onClick={() => generateGiftCodeMutation.mutate()}
                    disabled={generateGiftCodeMutation.isPending || !giftCodeDays || parseInt(giftCodeDays, 10) <= 0}
                    className="w-full"
                    data-testid="button-generate-gift-code"
                  >
                    {generateGiftCodeMutation.isPending ? "Generating..." : "Generate Gift Code"}
                  </Button>

                  {generatedCode && generatedCodeDetails && (
                    <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30">
                      <p className="text-xs text-muted-foreground mb-1">Generated Code (copy to share):</p>
                      <div className="flex items-center justify-between gap-2">
                        <code className="font-mono text-lg font-bold text-emerald-400" data-testid="text-generated-code">
                          {generatedCode}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedCode);
                            toast({ title: "Copied!", description: "Code copied to clipboard" });
                          }}
                          data-testid="button-copy-code"
                        >
                          Copy
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 space-y-1">
                        <p>This code grants:</p>
                        <ul className="list-disc list-inside pl-2">
                          <li>{generatedCodeDetails.days} days of PRO</li>
                          {generatedCodeDetails.badge && (
                            <li>{SPECIAL_BADGE_TYPES[generatedCodeDetails.badge].name} badge</li>
                          )}
                          {generatedCodeDetails.theme && (
                            <li>{FACTION_THEMES[generatedCodeDetails.theme].name} theme</li>
                          )}
                          {generatedCodeDetails.tiles && generatedCodeDetails.tiles.length > 0 && (
                            <li>{generatedCodeDetails.tiles.map(t => BONUS_TILES[t]).join(", ")} tile(s)</li>
                          )}
                        </ul>
                        <p className="mt-1">Valid for 30 days.</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="badges" className="m-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500" />
                    Grant Special Badge
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Award special badges to recognize players for their contributions.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="badgeCharacterId">Character ID</Label>
                      <Input
                        id="badgeCharacterId"
                        type="number"
                        placeholder="e.g. 95693805"
                        value={badgeCharacterId}
                        onChange={(e) => setBadgeCharacterId(e.target.value)}
                        data-testid="input-badge-character-id"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="badgeCharacterName">Character Name</Label>
                      <Input
                        id="badgeCharacterName"
                        placeholder="e.g. Neveth Yuliyandi"
                        value={badgeCharacterName}
                        onChange={(e) => setBadgeCharacterName(e.target.value)}
                        data-testid="input-badge-character-name"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Badge Type</Label>
                      <Select value={badgeType} onValueChange={(v) => setBadgeType(v as SpecialBadgeType)}>
                        <SelectTrigger data-testid="select-badge-type">
                          <SelectValue placeholder="Select badge type" />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(SPECIAL_BADGE_TYPES) as SpecialBadgeType[]).map((type) => {
                            const BadgeIcon = badgeIcons[SPECIAL_BADGE_TYPES[type].icon] || Star;
                            return (
                              <SelectItem key={type} value={type}>
                                <div className="flex items-center gap-2">
                                  <BadgeIcon className="w-4 h-4" />
                                  {SPECIAL_BADGE_TYPES[type].name}
                                  <span className="text-xs text-muted-foreground capitalize">
                                    ({SPECIAL_BADGE_TYPES[type].rarity})
                                  </span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="badgeNote">Note (optional)</Label>
                      <Input
                        id="badgeNote"
                        placeholder="Reason for granting"
                        value={badgeNote}
                        onChange={(e) => setBadgeNote(e.target.value)}
                        data-testid="input-badge-note"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={() => grantBadgeMutation.mutate()}
                    disabled={grantBadgeMutation.isPending || !badgeCharacterId || !badgeCharacterName.trim()}
                    className="w-full"
                    data-testid="button-grant-badge"
                  >
                    {grantBadgeMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Granting...
                      </>
                    ) : (
                      <>
                        <Award className="w-4 h-4 mr-2" />
                        Grant Badge
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    All Special Badges ({specialBadges.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {specialBadges.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No special badges have been granted yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-auto">
                      {specialBadges.map((badge) => {
                        const badgeInfo = SPECIAL_BADGE_TYPES[badge.badgeType];
                        const BadgeIcon = badgeIcons[badgeInfo?.icon || "Star"] || Star;
                        return (
                          <div 
                            key={badge.id} 
                            className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br ${badgeInfo?.color || "from-gray-400 to-gray-500"}`}>
                                <BadgeIcon className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <span className="font-medium">{badge.characterName}</span>
                                <p className="text-xs text-muted-foreground">
                                  {badgeInfo?.name || badge.badgeType} - {badge.note || "No note"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Granted by {badge.grantedByAdminName} on {formatDate(badge.grantedAt)}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => revokeBadgeMutation.mutate({ 
                                characterId: badge.characterId, 
                                badgeType: badge.badgeType 
                              })}
                              disabled={revokeBadgeMutation.isPending}
                              data-testid={`button-revoke-badge-${badge.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sessions" className="m-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Timer className="w-4 h-4 text-primary" />
                    All Ratting Sessions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                      <Search className="w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by character name..."
                        value={sessionsSearch}
                        onChange={(e) => { setSessionsSearch(e.target.value); setSessionsPage(0); }}
                        className="flex-1"
                        data-testid="input-sessions-search"
                      />
                    </div>
                    <Select 
                      value={sessionsFilter} 
                      onValueChange={(v) => { setSessionsFilter(v as typeof sessionsFilter); setSessionsPage(0); }}
                    >
                      <SelectTrigger className="w-32" data-testid="select-sessions-filter">
                        <SelectValue placeholder="Filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => refetchSessions()}
                      data-testid="button-refresh-sessions"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Showing {sessionsData?.sessions?.length || 0} of {sessionsData?.total || 0} sessions
                  </div>

                  {!sessionsData?.sessions?.length ? (
                    <p className="text-sm text-muted-foreground">No sessions found.</p>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-auto">
                      {sessionsData.sessions.map((session) => (
                        <div 
                          key={session.id} 
                          className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${session.isActive ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
                            <div>
                              <span className="font-medium">{session.characterName}</span>
                              <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                                <span>{formatDate(session.startTime)}</span>
                                {session.endTime && (
                                  <span>- {formatDate(session.endTime)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              {editingSession === session.id ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    value={editSessionIsk}
                                    onChange={(e) => setEditSessionIsk(e.target.value)}
                                    placeholder="ISK"
                                    className="w-24 h-7 text-xs"
                                    data-testid={`input-edit-isk-${session.id}`}
                                  />
                                  <Input
                                    type="number"
                                    value={editSessionKills}
                                    onChange={(e) => setEditSessionKills(e.target.value)}
                                    placeholder="Kills"
                                    className="w-16 h-7 text-xs"
                                    data-testid={`input-edit-kills-${session.id}`}
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => updateSessionMutation.mutate({
                                      sessionId: session.id,
                                      totalIsk: parseInt(editSessionIsk, 10) || 0,
                                      killCount: parseInt(editSessionKills, 10) || 0,
                                    })}
                                    disabled={updateSessionMutation.isPending}
                                    data-testid={`button-save-session-${session.id}`}
                                  >
                                    <Check className="w-4 h-4 text-green-500" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setEditingSession(null)}
                                    data-testid={`button-cancel-edit-${session.id}`}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <div className="font-mono text-sm">{formatIsk(session.totalIsk)}</div>
                                  <div className="text-xs text-muted-foreground">{session.killCount} kills</div>
                                </>
                              )}
                            </div>
                            {editingSession !== session.id && (
                              <div className="flex items-center gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingSession(session.id);
                                    setEditSessionIsk(String(session.totalIsk));
                                    setEditSessionKills(String(session.killCount));
                                  }}
                                  data-testid={`button-edit-session-${session.id}`}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => deleteSessionMutation.mutate(session.id)}
                                  disabled={deleteSessionMutation.isPending}
                                  data-testid={`button-delete-session-${session.id}`}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSessionsPage(p => Math.max(0, p - 1))}
                      disabled={sessionsPage === 0}
                      data-testid="button-sessions-prev"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {sessionsPage + 1} of {Math.ceil((sessionsData?.total || 0) / sessionsPageSize) || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSessionsPage(p => p + 1)}
                      disabled={(sessionsPage + 1) * sessionsPageSize >= (sessionsData?.total || 0)}
                      data-testid="button-sessions-next"
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="m-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    Admin Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoading ? (
                    <p className="text-muted-foreground">Loading admin list...</p>
                  ) : error ? (
                    <p className="text-muted-foreground">Failed to load admin list. You may need to configure EVE_ADMIN_IDS.</p>
                  ) : (
                    <>
                      {/* Super Admins (env-configured) */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Super Admins (Environment)</Label>
                        {adminInfo?.superAdminIds?.map((id) => (
                          <div 
                            key={id} 
                            className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                          >
                            <div className="flex items-center gap-2">
                              <Crown className="w-4 h-4 text-yellow-500" />
                              <span className="font-mono text-sm">{id}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {id === character?.id && (
                                <Badge variant="default" className="bg-primary">You</Badge>
                              )}
                              <Badge variant="secondary">Super Admin</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Dynamic Admins */}
                      {adminInfo?.dynamicAdmins && adminInfo.dynamicAdmins.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Added Admins</Label>
                          {adminInfo.dynamicAdmins.map((admin: any) => (
                            <div 
                              key={admin.characterId} 
                              className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                            >
                              <div>
                                <span className="font-medium">{admin.characterName}</span>
                                <p className="text-xs text-muted-foreground">
                                  ID: {admin.characterId} - Added by {admin.addedByName}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {admin.characterId === character?.id && (
                                  <Badge variant="default" className="bg-primary">You</Badge>
                                )}
                                {adminInfo.isSuperAdmin && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => removeAdminMutation.mutate(admin.characterId)}
                                    disabled={removeAdminMutation.isPending}
                                    data-testid={`button-remove-admin-${admin.characterId}`}
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Add New Admin Form (super admins only) */}
                      {adminInfo?.isSuperAdmin && (
                        <div className="space-y-3 pt-3 border-t">
                          <Label className="text-sm font-medium flex items-center gap-2">
                            <UserPlus className="w-4 h-4" />
                            Add New Admin
                          </Label>
                          <div className="grid grid-cols-2 gap-3">
                            <Input
                              placeholder="Character ID"
                              value={newAdminCharacterId}
                              onChange={(e) => setNewAdminCharacterId(e.target.value)}
                              data-testid="input-new-admin-character-id"
                            />
                            <Input
                              placeholder="Character Name"
                              value={newAdminCharacterName}
                              onChange={(e) => setNewAdminCharacterName(e.target.value)}
                              data-testid="input-new-admin-character-name"
                            />
                          </div>
                          <Button
                            onClick={() => addAdminMutation.mutate()}
                            disabled={addAdminMutation.isPending || !newAdminCharacterId.trim() || !newAdminCharacterName.trim()}
                            className="w-full"
                            data-testid="button-add-admin"
                          >
                            {addAdminMutation.isPending ? "Adding..." : "Add Admin"}
                          </Button>
                        </div>
                      )}
                      
                      {!adminInfo?.isSuperAdmin && (
                        <p className="text-xs text-muted-foreground italic">
                          Only super admins can add or remove other admins.
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <History className="w-4 h-4 text-pink-500" />
                    Gift History ({gifts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {gifts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No gifts have been given yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-auto">
                      {gifts.map((gift) => (
                        <div key={gift.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                          <div>
                            <span className="font-medium">{gift.recipientCharacterName}</span>
                            <p className="text-xs text-muted-foreground">
                              {gift.durationDays} days - {gift.note || "No note"}
                            </p>
                            {gift.referenceCode && (
                              <p className="text-xs font-mono text-primary mt-0.5">
                                {gift.referenceCode}
                              </p>
                            )}
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            {formatDate(gift.giftedAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">All Subscriptions ({subscriptions.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {subscriptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No subscriptions found.</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-auto">
                      {subscriptions.map((sub) => (
                        <div key={sub.characterId} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                          <div className="flex items-center gap-2">
                            {getStatusBadge(sub.status)}
                            <div>
                              <span className="font-medium">{sub.characterName}</span>
                              <p className="text-xs text-muted-foreground">
                                ID: {sub.characterId}
                              </p>
                            </div>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            Expires: {formatDate(sub.expiresAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="codes" className="m-0 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" />
                      Generate PHOTON Codes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Code Type</Label>
                        <Select value={photonCodeType} onValueChange={(v) => setPhotonCodeType(v as typeof photonCodeType)}>
                          <SelectTrigger data-testid="select-photon-code-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pro_subscription">PRO Subscription</SelectItem>
                            <SelectItem value="badge_grant">Badge Grant</SelectItem>
                            <SelectItem value="theme_unlock">Theme Unlock</SelectItem>
                            <SelectItem value="tile_unlock">Tile Unlock</SelectItem>
                            <SelectItem value="bundle">Bundle (All)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {(photonCodeType === "pro_subscription" || photonCodeType === "bundle") && (
                        <div className="space-y-2">
                          <Label>PRO Duration (Days)</Label>
                          <Input
                            type="number"
                            min="1"
                            max="365"
                            value={photonProDays}
                            onChange={(e) => setPhotonProDays(e.target.value)}
                            data-testid="input-photon-pro-days"
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>Max Redemptions (0 = unlimited)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={photonMaxRedemptions}
                          onChange={(e) => setPhotonMaxRedemptions(e.target.value)}
                          data-testid="input-photon-max-redemptions"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Batch Count (1-100)</Label>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={photonBatchCount}
                          onChange={(e) => setPhotonBatchCount(e.target.value)}
                          data-testid="input-photon-batch-count"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Code Expiry (Days)</Label>
                        <Input
                          type="number"
                          min="1"
                          max="365"
                          value={photonExpiryDays}
                          onChange={(e) => setPhotonExpiryDays(e.target.value)}
                          disabled={photonNeverExpires}
                          data-testid="input-photon-expiry-days"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <Checkbox
                          id="photon-never-expires"
                          checked={photonNeverExpires}
                          onCheckedChange={(c) => setPhotonNeverExpires(!!c)}
                          data-testid="checkbox-photon-never-expires"
                        />
                        <Label htmlFor="photon-never-expires" className="text-sm">Never Expires</Label>
                      </div>
                    </div>

                    {(photonCodeType === "badge_grant" || photonCodeType === "bundle") && (
                      <div className="space-y-2">
                        <Label>Badges to Grant</Label>
                        <div className="flex flex-wrap gap-2">
                          {Object.keys(SPECIAL_BADGE_TYPES).map((bt) => (
                            <Badge
                              key={bt}
                              variant={photonBadges.includes(bt as SpecialBadgeType) ? "default" : "outline"}
                              className="cursor-pointer"
                              onClick={() => {
                                if (photonBadges.includes(bt as SpecialBadgeType)) {
                                  setPhotonBadges(photonBadges.filter(b => b !== bt));
                                } else {
                                  setPhotonBadges([...photonBadges, bt as SpecialBadgeType]);
                                }
                              }}
                            >
                              {SPECIAL_BADGE_TYPES[bt as SpecialBadgeType].name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {(photonCodeType === "theme_unlock" || photonCodeType === "bundle") && (
                      <div className="space-y-2">
                        <Label>Themes to Unlock</Label>
                        <div className="flex flex-wrap gap-2">
                          {Object.keys(FACTION_THEMES).map((t) => (
                            <Badge
                              key={t}
                              variant={photonThemes.includes(t as FactionTheme) ? "default" : "outline"}
                              className="cursor-pointer"
                              onClick={() => {
                                if (photonThemes.includes(t as FactionTheme)) {
                                  setPhotonThemes(photonThemes.filter(th => th !== t));
                                } else {
                                  setPhotonThemes([...photonThemes, t as FactionTheme]);
                                }
                              }}
                            >
                              {FACTION_THEMES[t as FactionTheme].name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {(photonCodeType === "tile_unlock" || photonCodeType === "bundle") && (
                      <div className="space-y-2">
                        <Label>Tiles to Unlock</Label>
                        <div className="flex flex-wrap gap-2">
                          {Object.keys(BONUS_TILES).map((t) => (
                            <Badge
                              key={t}
                              variant={photonTiles.includes(t as BonusTile) ? "default" : "outline"}
                              className="cursor-pointer"
                              onClick={() => {
                                if (photonTiles.includes(t as BonusTile)) {
                                  setPhotonTiles(photonTiles.filter(ti => ti !== t));
                                } else {
                                  setPhotonTiles([...photonTiles, t as BonusTile]);
                                }
                              }}
                            >
                              {BONUS_TILES[t as BonusTile]}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Internal Note (Optional)</Label>
                      <Input
                        value={photonNote}
                        onChange={(e) => setPhotonNote(e.target.value)}
                        placeholder="e.g., Streamer giveaway, Early bird"
                        maxLength={500}
                        data-testid="input-photon-note"
                      />
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => generatePhotonCodeMutation.mutate()}
                      disabled={generatePhotonCodeMutation.isPending}
                      data-testid="button-generate-photon-codes"
                    >
                      {generatePhotonCodeMutation.isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          Generate {parseInt(photonBatchCount) > 1 ? `${photonBatchCount} Codes` : "Code"}
                        </>
                      )}
                    </Button>

                    {generatedPhotonCodes.length > 0 && (
                      <Card className="bg-muted/50">
                        <CardContent className="pt-4">
                          <p className="text-sm font-medium mb-2">Generated Codes:</p>
                          <div className="space-y-1 max-h-32 overflow-auto">
                            {generatedPhotonCodes.map((code, i) => (
                              <div key={i} className="flex items-center justify-between gap-2">
                                <code className="text-sm font-mono text-primary">{code}</code>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    navigator.clipboard.writeText(code);
                                    toast({
                                      title: "Copied",
                                      description: "Code copied to clipboard",
                                    });
                                  }}
                                >
                                  Copy
                                </Button>
                              </div>
                            ))}
                          </div>
                          {generatedPhotonCodes.length > 1 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full mt-2"
                              onClick={() => {
                                navigator.clipboard.writeText(generatedPhotonCodes.join("\n"));
                                toast({
                                  title: "Copied All",
                                  description: `${generatedPhotonCodes.length} codes copied to clipboard`,
                                });
                              }}
                            >
                              Copy All
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" />
                      PHOTON Codes ({photonCodesTotal})
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Select value={photonCodesFilter} onValueChange={(v) => { setPhotonCodesFilter(v as typeof photonCodesFilter); setPhotonCodesPage(0); }}>
                        <SelectTrigger className="w-28" data-testid="select-photon-codes-filter">
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
                      <Button size="icon" variant="ghost" onClick={() => refetchPhotonCodes()} data-testid="button-refresh-photon-codes">
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {photonCodes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No PHOTON codes found.</p>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-auto">
                        {photonCodes.map((code) => (
                          <div key={code.id} className="p-3 rounded-md bg-muted/50 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <code className="text-sm font-mono text-primary">{code.code}</code>
                              <div className="flex items-center gap-2">
                                {getStatusBadge(code.status)}
                                {code.status === "active" && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => revokePhotonCodeMutation.mutate(code.id)}
                                    disabled={revokePhotonCodeMutation.isPending}
                                    data-testid={`button-revoke-photon-${code.id}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span>{code.codeType.replace("_", " ")}</span>
                              {code.proDurationDays && <span>{code.proDurationDays}d PRO</span>}
                              <span>{code.currentRedemptions}/{code.maxRedemptions === 0 ? "Unlimited" : code.maxRedemptions} redeemed</span>
                            </div>
                            {code.note && (
                              <p className="text-xs italic text-muted-foreground">{code.note}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              By {code.createdByAdminName} - {new Date(code.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    {photonCodesTotal > photonCodesPageSize && (
                      <div className="flex items-center justify-between mt-4">
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
              </div>
            </TabsContent>

            <TabsContent value="activity" className="m-0 space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" />
                    PHOTON Activity Log ({activityLogsTotal})
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Select value={activityFilter} onValueChange={(v) => { setActivityFilter(v as typeof activityFilter); setActivityPage(0); }}>
                      <SelectTrigger className="w-36" data-testid="select-activity-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Actions</SelectItem>
                        <SelectItem value="created">Created</SelectItem>
                        <SelectItem value="redeemed">Redeemed</SelectItem>
                        <SelectItem value="revoked">Revoked</SelectItem>
                        <SelectItem value="failed_redemption">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" onClick={() => refetchActivityLog()} data-testid="button-refresh-activity">
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {activityLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No activity logs found.</p>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-auto">
                      {activityLogs.map((log) => (
                        <div key={log.id} className="p-3 rounded-md bg-muted/50 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={
                                log.action === "created" ? "default" :
                                log.action === "redeemed" ? "secondary" :
                                log.action === "revoked" ? "destructive" :
                                "outline"
                              }>
                                {log.action.replace("_", " ")}
                              </Badge>
                              <code className="text-sm font-mono">{log.code}</code>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(log.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm">
                            <span className="font-medium">{log.actorCharacterName}</span>
                            {log.targetCharacterName && (
                              <> for <span className="font-medium">{log.targetCharacterName}</span></>
                            )}
                          </p>
                          {log.details && Object.keys(log.details).length > 0 && (
                            <details className="text-xs text-muted-foreground">
                              <summary className="cursor-pointer">Details</summary>
                              <pre className="mt-1 p-2 bg-background rounded overflow-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {activityLogsTotal > activityLogPageSize && (
                    <div className="flex items-center justify-between mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={activityPage === 0}
                        onClick={() => setActivityPage(p => p - 1)}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {activityPage + 1} of {Math.ceil(activityLogsTotal / activityLogPageSize)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={(activityPage + 1) * activityLogPageSize >= activityLogsTotal}
                        onClick={() => setActivityPage(p => p + 1)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="system" className="m-0 space-y-4">
              <div className="flex items-center justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetchSystemStats()}
                  data-testid="button-refresh-system-stats"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Server Uptime</CardTitle>
                    <Power className="w-4 h-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold font-mono">{systemStats?.uptime?.formatted || '0d 0h 0m'}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Since {systemStats?.uptime?.startedAt ? new Date(systemStats.uptime.startedAt).toLocaleString() : 'N/A'}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
                    <Timer className="w-4 h-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold font-mono">{systemStats?.sessions?.activeSessions || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {systemStats?.sessions?.uniqueUsers || 0} unique users
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total ISK Earned</CardTitle>
                    <Crown className="w-4 h-4 text-yellow-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold font-mono">{formatIsk(systemStats?.sessions?.totalIskEarned || 0)}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {systemStats?.sessions?.totalKills || 0} kills tracked
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                    <HardDrive className="w-4 h-4 text-purple-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold font-mono">
                      {systemStats?.memoryUsage?.heapUsed || 0} MB
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      of {systemStats?.memoryUsage?.heapTotal || 0} MB total
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">PRO Subscriptions</CardTitle>
                    <Crown className="w-4 h-4 text-yellow-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono">{stats?.totalSubscriptions || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats?.activeSubscriptions || 0} active, {stats?.expiredSubscriptions || 0} expired
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Activation Codes</CardTitle>
                    <Clock className="w-4 h-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono">{(stats?.pendingCodes || 0) + (stats?.usedCodes || 0)}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats?.pendingCodes || 0} pending, {stats?.usedCodes || 0} used
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    System Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Environment</span>
                      <Badge variant="outline">{systemStats?.environment || 'development'}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">ESI Status</span>
                      <Badge 
                        className={
                          systemStats?.esiStatus?.status === 'online' ? 'bg-green-600' :
                          systemStats?.esiStatus?.status === 'degraded' ? 'bg-yellow-600' :
                          'bg-red-600'
                        }
                      >
                        {systemStats?.esiStatus?.message || 'Unknown'}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Total Sessions</span>
                      <Badge variant="outline">{systemStats?.sessions?.totalSessions || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Processed Transactions</span>
                      <Badge variant="outline">{stats?.processedTransactions || 0}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">All Activation Codes ({codes.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {codes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No activation codes found.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-auto">
                      {codes.map((code) => (
                        <div key={code.code} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                          <div className="flex items-center gap-2">
                            {getStatusBadge(code.status)}
                            <div>
                              <span className="font-mono text-sm">{code.code}</span>
                              <p className="text-xs text-muted-foreground">
                                {code.characterName} - {formatIsk(code.iskAmount)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            Created: {formatDate(code.createdAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
