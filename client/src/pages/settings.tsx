import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Settings, 
  Moon, 
  Sun, 
  Palette,
  User,
  Shield,
  Download,
  Trash2,
  Crown,
  CheckCircle,
  Loader2,
  Bell,
  AlertTriangle
} from "lucide-react";
import { useTheme, type ThemeMode, type BackgroundEffect } from "@/contexts/ThemeContext";
import { useAuth } from "@/hooks/use-auth";
import { useProContext } from "@/contexts/ProContext";
import { useSidebarActions } from "@/contexts/SidebarActionsContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { FACTION_THEMES, type FactionTheme } from "@shared/schema";

interface UserPreferences {
  emailNotifications: boolean;
  proExpiryReminders: boolean;
  supportTicketUpdates: boolean;
}

const modeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

const backgroundOptions: { value: BackgroundEffect; label: string; description: string }[] = [
  { value: "none", label: "None", description: "Solid background color" },
  { value: "starfield", label: "Star Field", description: "Subtle twinkling stars" },
  { value: "nebula", label: "Nebula", description: "Colorful space clouds" },
  { value: "space", label: "Full Space", description: "Stars and nebula combined" },
];

export default function SettingsPage() {
  const { character, isAuthenticated } = useAuth();
  const { isPro } = useProContext();
  const { mode, theme, backgroundEffect, reduceMotion, setMode, setTheme, setBackgroundEffect, setReduceMotion } = useTheme();
  const { triggerExport, setProModalOpen } = useSidebarActions();
  const { toast } = useToast();
  const [isClearing, setIsClearing] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);

  const { data: preferences, isLoading: prefsLoading } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
    enabled: isAuthenticated,
  });

  const updatePrefsMutation = useMutation({
    mutationFn: async (prefs: Partial<UserPreferences>) => {
      return apiRequest("PATCH", "/api/user/preferences", prefs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      toast({
        title: "Preferences Updated",
        description: "Your settings have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update preferences.",
        variant: "destructive",
      });
    },
  });

  const handleExportData = () => {
    if (isPro) {
      triggerExport();
      toast({
        title: "Exporting Data",
        description: "Your session data will be downloaded shortly.",
      });
    } else {
      setProModalOpen(true);
    }
  };

  const handleClearHistory = async () => {
    setIsClearing(true);
    try {
      await apiRequest("DELETE", "/api/sessions/clear");
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({
        title: "History Cleared",
        description: "All your session history has been deleted.",
      });
      setShowClearDialog(false);
    } catch {
      toast({
        title: "Error",
        description: "Failed to clear history.",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const allThemes = Object.entries(FACTION_THEMES).map(([id, theme]) => ({
    id: id as FactionTheme,
    ...theme
  }));
  const proThemes = allThemes.filter(t => t.isPro);
  const freeThemes = allThemes.filter(t => !t.isPro);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Settings
            </CardTitle>
            <CardDescription>
              Please log in to view your settings
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Settings Header */}
        <PageHeader
          icon={Settings}
          title="Settings"
          subtitle="Manage your preferences and account"
        />

        <div className="space-y-6">
          {/* Display Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Palette className="w-5 h-5" />
                Display
              </CardTitle>
              <CardDescription>
                Customize the appearance of PHOTON
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Theme Mode */}
              <div className="space-y-2">
                <Label>Theme Mode</Label>
                <div className="flex gap-2">
                  {modeOptions.map(({ value, label, icon: Icon }) => (
                    <Button
                      key={value}
                      variant={mode === value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMode(value)}
                      className="flex-1"
                      data-testid={`button-mode-${value}`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Background Effect */}
              <div className="space-y-3">
                <Label>Background Effect</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {backgroundOptions.map(({ value, label, description }) => (
                    <button
                      key={value}
                      onClick={() => setBackgroundEffect(value)}
                      className={`p-3 rounded-lg border-2 text-left transition-all hover:scale-[1.02] ${
                        backgroundEffect === value
                          ? 'border-primary bg-primary/5 shadow-md'
                          : 'border-border hover:border-primary/50'
                      }`}
                      data-testid={`button-bg-${value}`}
                    >
                      <div className="space-y-1">
                        <span className="font-medium text-sm flex items-center gap-2">
                          {label}
                          {backgroundEffect === value && (
                            <CheckCircle className="w-3 h-3 text-primary" />
                          )}
                        </span>
                        <p className="text-xs text-muted-foreground">{description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Motion */}
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <Label className="text-sm">Reduce Animations</Label>
                  <p className="text-xs text-muted-foreground">Minimize motion and transitions across the app</p>
                </div>
                <Switch checked={reduceMotion} onCheckedChange={setReduceMotion} data-testid="switch-reduce-motion" />
              </div>

              <Separator />

              {/* Faction Themes */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Faction Theme</Label>
                  {!isPro && (
                    <Badge variant="secondary" className="gap-1">
                      <Crown className="w-3 h-3" />
                      PRO themes available
                    </Badge>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="space-y-3">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Free Themes</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {freeThemes.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setTheme(t.id as FactionTheme)}
                          className={`relative p-3 rounded-lg border-2 text-left transition-all hover:scale-[1.02] ${
                            theme === t.id
                              ? 'border-primary bg-primary/5 shadow-md'
                              : 'border-border hover:border-primary/50'
                          }`}
                          data-testid={`button-theme-${t.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="w-10 h-10 rounded-md flex-shrink-0"
                              style={{
                                background: `linear-gradient(135deg, ${t.primaryColor} 0%, ${t.accentColor} 100%)`,
                                boxShadow: theme === t.id ? `0 0 12px ${t.primaryColor}40` : undefined
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{t.name}</span>
                                {theme === t.id && (
                                  <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {t.description}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <Crown className="w-3 h-3 text-amber-500" />
                      PRO Themes
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {proThemes.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => isPro && setTheme(t.id as FactionTheme)}
                          disabled={!isPro}
                          className={`relative p-3 rounded-lg border-2 text-left transition-all ${
                            !isPro
                              ? 'opacity-60 cursor-not-allowed border-border'
                              : theme === t.id
                                ? 'border-primary bg-primary/5 shadow-md hover:scale-[1.02]'
                                : 'border-border hover:border-primary/50 hover:scale-[1.02]'
                          }`}
                          data-testid={`button-theme-${t.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-10 h-10 rounded-md flex-shrink-0 ${!isPro ? 'grayscale' : ''}`}
                              style={{
                                background: `linear-gradient(135deg, ${t.primaryColor} 0%, ${t.accentColor} 100%)`,
                                boxShadow: isPro && theme === t.id ? `0 0 12px ${t.primaryColor}40` : undefined
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{t.name}</span>
                                {isPro && theme === t.id && (
                                  <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                                )}
                                {!isPro && (
                                  <Crown className="w-3 h-3 text-amber-500 flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {t.description}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="w-5 h-5" />
                Notifications
              </CardTitle>
              <CardDescription>
                Control how PHOTON communicates with you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {prefsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive important updates via email
                      </p>
                    </div>
                    <Switch
                      checked={preferences?.emailNotifications ?? false}
                      onCheckedChange={(checked) => 
                        updatePrefsMutation.mutate({ emailNotifications: checked })
                      }
                      disabled={updatePrefsMutation.isPending}
                      data-testid="switch-email-notifications"
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>PRO Expiry Reminders</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified before your PRO subscription expires
                      </p>
                    </div>
                    <Switch
                      checked={preferences?.proExpiryReminders ?? true}
                      onCheckedChange={(checked) => 
                        updatePrefsMutation.mutate({ proExpiryReminders: checked })
                      }
                      disabled={updatePrefsMutation.isPending}
                      data-testid="switch-pro-reminders"
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Support Ticket Updates</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications when your tickets are updated
                      </p>
                    </div>
                    <Switch
                      checked={preferences?.supportTicketUpdates ?? true}
                      onCheckedChange={(checked) => 
                        updatePrefsMutation.mutate({ supportTicketUpdates: checked })
                      }
                      disabled={updatePrefsMutation.isPending}
                      data-testid="switch-support-updates"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-5 h-5" />
                Account
              </CardTitle>
              <CardDescription>
                Your EVE Online character information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <img
                  src={`https://images.evetech.net/characters/${character?.id}/portrait?size=64`}
                  alt={character?.name}
                  className="w-16 h-16 rounded-lg"
                />
                <div>
                  <h3 className="font-semibold text-lg">{character?.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Character ID: {character?.id}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {isPro ? (
                      <Badge className="gap-1">
                        <Crown className="w-3 h-3" />
                        PRO
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Standard</Badge>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-muted-foreground">ESI Permissions</Label>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    Wallet Access
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    Character Info
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    Mining Ledger
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="w-5 h-5" />
                Data & Privacy
              </CardTitle>
              <CardDescription>
                Manage your data and session history
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Export Session Data</Label>
                  <p className="text-sm text-muted-foreground">
                    Download all your ratting session data as CSV
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={handleExportData}
                  data-testid="button-export-data"
                >
                  {isPro ? (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </>
                  ) : (
                    <>
                      <Crown className="w-4 h-4 mr-2" />
                      PRO Feature
                    </>
                  )}
                </Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-destructive">Clear Session History</Label>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete all your saved sessions
                  </p>
                </div>
                <Button 
                  variant="destructive" 
                  onClick={() => setShowClearDialog(true)}
                  disabled={isClearing}
                  data-testid="button-clear-history"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Clear History Confirmation Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Clear Session History
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all your ratting session history? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowClearDialog(false)}
              data-testid="button-cancel-clear"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearHistory}
              disabled={isClearing}
              data-testid="button-confirm-clear"
            >
              {isClearing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete All Sessions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
