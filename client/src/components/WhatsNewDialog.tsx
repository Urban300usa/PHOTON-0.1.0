import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Package, FileText, Factory, Globe2, Target, Zap, Rocket, Star, Crown, Gift, Heart, Check, Wrench, Bug, Shield, Gem } from "lucide-react";

const WHATS_NEW_STORAGE_KEY = "photon-whats-new-version";

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

const ICON_MAP: Record<string, typeof Sparkles> = {
  sparkles: Sparkles,
  package: Package,
  filetext: FileText,
  factory: Factory,
  globe2: Globe2,
  target: Target,
  zap: Zap,
  rocket: Rocket,
  star: Star,
  crown: Crown,
  gift: Gift,
  heart: Heart,
  check: Check,
  wrench: Wrench,
  bug: Bug,
  shield: Shield,
  gem: Gem,
};

const CHANGE_TYPE_MAP: Record<string, "new" | "improved" | "fixed"> = {
  feature: "new",
  improvement: "improved",
  fix: "fixed",
  pro: "new",
  removed: "fixed",
};

export interface WhatsNewDialogHandle {
  open: () => void;
  autoShow: () => void;
}

const WhatsNewDialog = forwardRef<WhatsNewDialogHandle, object>(
  (_, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [pendingAutoShow, setPendingAutoShow] = useState(false);

    const { data: changelogsData, isLoading } = useQuery<{ changelogs: ChangelogVersion[] }>({
      queryKey: ["/api/changelog"],
      staleTime: 5 * 60 * 1000,
    });

    const changelogs = changelogsData?.changelogs || [];
    const currentVersion = changelogs.length > 0 ? changelogs[0].version : null;

    useEffect(() => {
      if (pendingAutoShow && currentVersion) {
        const lastSeenVersion = localStorage.getItem(WHATS_NEW_STORAGE_KEY);
        if (lastSeenVersion !== currentVersion) {
          setTimeout(() => setIsOpen(true), 1500);
        }
        setPendingAutoShow(false);
      }
    }, [pendingAutoShow, currentVersion]);

    useImperativeHandle(ref, () => ({
      open: () => {
        setIsOpen(true);
        // Mark as seen immediately when manually opened
        if (currentVersion) {
          localStorage.setItem(WHATS_NEW_STORAGE_KEY, currentVersion);
          // Dispatch custom event to notify useHasUnseenChangelog hook
          window.dispatchEvent(new CustomEvent('whats-new-seen'));
        }
      },
      autoShow: () => {
        if (typeof window === "undefined") return;
        if (currentVersion) {
          const lastSeenVersion = localStorage.getItem(WHATS_NEW_STORAGE_KEY);
          if (lastSeenVersion !== currentVersion) {
            setTimeout(() => setIsOpen(true), 1500);
          }
        } else {
          setPendingAutoShow(true);
        }
      },
    }));

    const handleClose = () => {
      setIsOpen(false);
      if (currentVersion) {
        localStorage.setItem(WHATS_NEW_STORAGE_KEY, currentVersion);
      }
    };

    const getTypeBadge = (type: "new" | "improved" | "fixed") => {
      switch (type) {
        case "new":
          return <Badge variant="default" className="text-xs">New</Badge>;
        case "improved":
          return <Badge variant="secondary" className="text-xs">Improved</Badge>;
        case "fixed":
          return <Badge variant="outline" className="text-xs">Fixed</Badge>;
      }
    };

    const getIcon = (iconKey: string | null) => {
      if (!iconKey) return null;
      const IconComponent = ICON_MAP[iconKey.toLowerCase()];
      return IconComponent ? <IconComponent className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" /> : null;
    };

    const getChangeType = (changeType: string): "new" | "improved" | "fixed" => {
      return CHANGE_TYPE_MAP[changeType] || "new";
    };

    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-lg" data-testid="dialog-whats-new">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              What's New in PHOTON
            </DialogTitle>
            <DialogDescription>
              Check out the latest updates and improvements
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : changelogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No changelog entries yet.
              </div>
            ) : (
              <div className="space-y-6">
                {changelogs.map((entry) => (
                  <div key={entry.id} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        v{entry.version}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {entry.releaseDate}
                      </span>
                    </div>
                    <h3 className="font-semibold">{entry.title}</h3>
                    {entry.items && entry.items.length > 0 && (
                      <ul className="space-y-2">
                        {entry.items.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-start gap-2 text-sm"
                          >
                            {getTypeBadge(getChangeType(item.changeType))}
                            {getIcon(item.iconKey)}
                            <span className="text-muted-foreground">
                              {item.text}
                              {item.isProOnly && (
                                <Badge variant="secondary" className="ml-2 text-xs bg-purple-500/20 text-purple-500">PRO</Badge>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button onClick={handleClose} data-testid="button-close-whats-new">
              Got it!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);

WhatsNewDialog.displayName = "WhatsNewDialog";

export default WhatsNewDialog;

export function useHasUnseenChangelog() {
  const [hasUnseen, setHasUnseen] = useState(false);

  const { data: changelogsData } = useQuery<{ changelogs: ChangelogVersion[] }>({
    queryKey: ["/api/changelog"],
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const changelogs = changelogsData?.changelogs || [];
    if (changelogs.length === 0) {
      setHasUnseen(false);
      return;
    }
    const latestVersion = changelogs[0].version;
    const lastSeenVersion = localStorage.getItem(WHATS_NEW_STORAGE_KEY);
    setHasUnseen(lastSeenVersion !== latestVersion);
  }, [changelogsData]);

  // Listen for manual open event to immediately clear the glow
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleSeen = () => setHasUnseen(false);
    window.addEventListener('whats-new-seen', handleSeen);
    return () => window.removeEventListener('whats-new-seen', handleSeen);
  }, []);

  return hasUnseen;
}
