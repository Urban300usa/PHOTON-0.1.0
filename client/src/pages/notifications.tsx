import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/PageHeader";

interface Notification {
  id: number;
  type: string;
  timestamp: string;
  isRead: boolean;
  text: string;
}

interface NotificationsData {
  notifications: Notification[];
}

// EVE notification type friendly names and colors
const TYPE_INFO: Record<string, { label: string; color: string }> = {
  StructureUnderAttack: { label: "Structure Attack", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  StructureLostArmor: { label: "Lost Armor", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  StructureLostShields: { label: "Lost Shields", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  StructureDestroyed: { label: "Destroyed", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  WarDeclared: { label: "War Declared", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  WarInherited: { label: "War Inherited", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  WarSurrenderDeclined: { label: "Surrender Declined", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  ContractAccepted: { label: "Contract Accepted", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  ContractAssigned: { label: "Contract Assigned", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  ContractFinished: { label: "Contract Finished", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  ContractCancelled: { label: "Contract Cancelled", color: "bg-muted text-muted-foreground border-border" },
  MissionOfferExpired: { label: "Mission Expired", color: "bg-muted text-muted-foreground border-border" },
  MissionTimeoutExpiredMessage: { label: "Mission Timeout", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  KillReportVictim: { label: "Killed", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  KillReportFinalBlow: { label: "Final Blow", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  BountyPlacedChar: { label: "Bounty Placed", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  InfrastructureHubBillAboutToExpire: { label: "IHUB Bill", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
};

function getTypeInfo(type: string): { label: string; color: string } {
  return (
    TYPE_INFO[type] ?? {
      label: type.replace(/([A-Z])/g, " $1").trim(),
      color: "bg-muted text-muted-foreground border-border",
    }
  );
}

function NotificationRow({ notif }: { notif: Notification }) {
  const [expanded, setExpanded] = useState(false);
  const typeInfo = getTypeInfo(notif.type);
  const snippet = notif.text?.slice(0, 100) ?? "";
  const hasMore = (notif.text?.length ?? 0) > 100;

  return (
    <div
      className={`border-b border-border last:border-b-0 transition-colors ${
        !notif.isRead ? "bg-muted/20" : ""
      }`}
    >
      <button
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors"
        onClick={() => hasMore && setExpanded((e) => !e)}
      >
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${typeInfo.color}`}
            >
              {typeInfo.label}
            </span>
            {!notif.isRead && (
              <span className="h-2 w-2 rounded-full bg-primary" title="Unread" />
            )}
            <span className="text-xs text-muted-foreground ml-auto shrink-0">
              {formatDistanceToNow(parseISO(notif.timestamp), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm text-foreground/80">
            {expanded ? notif.text : snippet}
            {!expanded && hasMore && (
              <span className="text-muted-foreground">…</span>
            )}
          </p>
        </div>
        {hasMore && (
          <div className="shrink-0 text-muted-foreground mt-0.5">
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
        )}
      </button>
    </div>
  );
}

export default function NotificationsPage() {
  const { isAuthenticated } = useAuth();

  const { data, isLoading, isError } = useQuery<NotificationsData>({
    queryKey: ["/api/character/notifications"],
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000,
  });

  const notifications = (data?.notifications ?? []).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="border-dashed max-w-md">
          <CardContent className="pt-6 text-center">
            <Bell className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Notifications</h2>
            <p className="text-muted-foreground">Login with EVE Online to view your notifications.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[900px] mx-auto">
      <PageHeader
        icon={Bell}
        title="Notifications"
        subtitle="EVE Online alerts and messages"
        actions={!isLoading && unreadCount > 0 && (
          <Badge variant="default" className="text-sm">
            {unreadCount} Unread
          </Badge>
        )}
      />

      {/* Notification List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="p-4 border-b border-border space-y-2">
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-5 w-20 ml-auto" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : isError ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground">Failed to load notifications.</p>
          </CardContent>
        </Card>
      ) : notifications.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-8 pb-8 text-center">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground">No notifications found.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {notifications.map((notif) => (
              <NotificationRow key={notif.id} notif={notif} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
