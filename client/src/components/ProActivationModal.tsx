import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Crown, Copy, Check, Gift, Zap, BarChart3, Download, Layout, Clock, Ticket, RefreshCw, CreditCard } from "lucide-react";
import { usePro } from "@/hooks/use-pro";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ProActivationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatISK(value: number): string {
  if (value >= 1000000000) {
    return (value / 1000000000).toFixed(1) + "B";
  }
  if (value >= 1000000) {
    return (value / 1000000).toFixed(0) + "M";
  }
  return value.toLocaleString();
}

export default function ProActivationModal({ open, onOpenChange }: ProActivationModalProps) {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const { 
    isPro, 
    status, 
    expiresAt, 
    pendingCode, 
    pricing,
    generateCode, 
    isGeneratingCode,
    generatedCode,
    claimTrial,
    isClaimingTrial,
    trialError,
    createPayment,
    isCreatingPayment,
    pendingPayment,
    verifyPayment,
    isVerifyingPayment,
    verifyResult,
    resetPaymentState,
  } = usePro();
  
  const [copied, setCopied] = useState(false);
  const [copiedPayment, setCopiedPayment] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<"weekly" | "monthly">("weekly");
  const [redeemCode, setRedeemCode] = useState("");

  const activeCode = generatedCode || pendingCode;
  const activePayment = pendingPayment;

  const redeemCodeMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("POST", "/api/pro/redeem-code", { code });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Code Redeemed!",
        description: data.message,
      });
      setRedeemCode("");
      queryClient.invalidateQueries({ queryKey: ["/api/pro/status"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Redemption Failed",
        description: error.message || "Invalid or expired code",
        variant: "destructive",
      });
    },
  });

  const handleCopyCode = () => {
    if (activeCode) {
      navigator.clipboard.writeText(activeCode.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Code Copied",
        description: "Activation code copied to clipboard",
      });
    }
  };

  const handleGenerateCode = () => {
    generateCode(selectedDuration);
  };

  const handleCreatePayment = () => {
    createPayment(selectedDuration, {
      onSuccess: (data) => {
        toast({
          title: data.isExisting ? "Payment Pending" : "Payment Created",
          description: `Send ${formatISK(data.iskAmount)} ISK with reference: ${data.referenceCode}`,
        });
      },
      onError: (error: any) => {
        toast({
          title: "Failed to Create Payment",
          description: error.message || "Could not generate payment reference",
          variant: "destructive",
        });
      },
    });
  };

  const handleVerifyPayment = () => {
    verifyPayment(undefined, {
      onSuccess: (data) => {
        if (data.success) {
          toast({
            title: "Payment Verified!",
            description: data.message,
          });
          onOpenChange(false);
        } else {
          toast({
            title: "Payment Not Found",
            description: data.message,
          });
        }
      },
      onError: (error: any) => {
        toast({
          title: "Verification Failed",
          description: error.message || "Could not verify payment",
          variant: "destructive",
        });
      },
    });
  };

  const handleCopyPaymentCode = () => {
    if (activePayment) {
      navigator.clipboard.writeText(activePayment.referenceCode);
      setCopiedPayment(true);
      setTimeout(() => setCopiedPayment(false), 2000);
      toast({
        title: "Reference Code Copied",
        description: "Payment reference copied to clipboard",
      });
    }
  };

  const handleClaimTrial = () => {
    claimTrial(undefined, {
      onSuccess: () => {
        toast({
          title: "Free Trial Activated",
          description: "Enjoy 7 days of PRO features!",
        });
        onOpenChange(false);
      },
      onError: (error: any) => {
        toast({
          title: "Trial Unavailable",
          description: error.message || "Free trial has already been claimed",
          variant: "destructive",
        });
      },
    });
  };

  const proFeatures = [
    { icon: BarChart3, name: "Advanced Analytics", description: "Detailed income breakdowns and trends" },
    { icon: Download, name: "Unlimited Export", description: "Export all historical data" },
    { icon: Layout, name: "Custom Layouts", description: "Save and share dashboard layouts" },
    { icon: Zap, name: "Auto Wallet Sync", description: "Automatic wallet data refresh" },
    { icon: Clock, name: "Full History", description: "Unlimited session history" },
  ];

  if (!isAuthenticated) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md" data-testid="pro-modal-unauthenticated">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-500" />
              Upgrade to PRO
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Please log in with your EVE character to upgrade to PRO.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="pro-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-500" />
            {isPro ? "PRO Subscription" : "Upgrade to PRO"}
          </DialogTitle>
          <DialogDescription>
            {isPro 
              ? `Your PRO subscription is active until ${expiresAt?.toLocaleDateString()}`
              : "Unlock advanced features with in-game ISK payment"
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {isPro ? (
            <div className="space-y-4">
              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Subscription</CardTitle>
                  <Badge className="bg-yellow-500 text-black">PRO</Badge>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">
                    {expiresAt ? `${Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days remaining` : "Active"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Expires: {expiresAt?.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-emerald-500/30 bg-emerald-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-emerald-500" />
                    Extend Subscription
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Have a gift code? Redeem it to add more time to your subscription.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="PHOTON-XXXX-XXXX-XXXX"
                      value={redeemCode}
                      onChange={(e) => setRedeemCode(e.target.value.trim().toUpperCase())}
                      className="font-mono"
                      disabled={redeemCodeMutation.isPending}
                      data-testid="input-extend-code"
                    />
                    <Button 
                      onClick={() => redeemCodeMutation.mutate(redeemCode.trim())}
                      disabled={redeemCodeMutation.isPending || !redeemCode.trim() || !/^PHOTON-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(redeemCode.trim())}
                      data-testid="button-extend-code"
                    >
                      {redeemCodeMutation.isPending ? "Redeeming..." : "Extend"}
                    </Button>
                  </div>
                  {redeemCode.trim() && !/^PHOTON-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(redeemCode.trim()) && (
                    <p className="text-xs text-destructive">
                      Invalid format. Codes look like: PHOTON-XXXX-XXXX-XXXX
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    The code's duration will be added to your current subscription.
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Tabs defaultValue="features" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="features">Features</TabsTrigger>
                <TabsTrigger value="activate">Activate</TabsTrigger>
                <TabsTrigger value="redeem">Redeem</TabsTrigger>
              </TabsList>

              <TabsContent value="features" className="space-y-4 mt-4">
                <div className="grid gap-3">
                  {proFeatures.map((feature) => (
                    <div 
                      key={feature.name}
                      className="flex items-center gap-3 p-3 rounded-md bg-muted/50"
                    >
                      <feature.icon className="w-5 h-5 text-primary" />
                      <div>
                        <div className="font-medium text-sm">{feature.name}</div>
                        <div className="text-xs text-muted-foreground">{feature.description}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <Card className="border-green-500/30 bg-green-500/5">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          <Gift className="w-4 h-4 text-green-500" />
                          Free 7-Day Trial
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Try all PRO features free for one week
                        </p>
                      </div>
                      <Button 
                        onClick={handleClaimTrial}
                        disabled={isClaimingTrial || status !== "none"}
                        data-testid="button-claim-trial"
                      >
                        {isClaimingTrial ? "Activating..." : status === "none" ? "Claim Trial" : "Already Claimed"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="activate" className="space-y-4 mt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card 
                    className={`cursor-pointer transition-colors ${selectedDuration === "weekly" ? "border-primary" : ""}`}
                    onClick={() => !activePayment && setSelectedDuration("weekly")}
                    data-testid="card-weekly-plan"
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Weekly</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold font-mono text-primary">
                        {pricing ? formatISK(pricing.weeklyIsk) : "50M"} ISK
                      </div>
                      <p className="text-xs text-muted-foreground">7 days of PRO</p>
                    </CardContent>
                  </Card>

                  <Card 
                    className={`cursor-pointer transition-colors ${selectedDuration === "monthly" ? "border-primary" : ""}`}
                    onClick={() => !activePayment && setSelectedDuration("monthly")}
                    data-testid="card-monthly-plan"
                  >
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                      <CardTitle className="text-sm">Monthly</CardTitle>
                      <Badge variant="secondary" className="text-xs">Save 25%</Badge>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold font-mono text-primary">
                        {pricing ? formatISK(pricing.monthlyIsk) : "150M"} ISK
                      </div>
                      <p className="text-xs text-muted-foreground">30 days of PRO</p>
                    </CardContent>
                  </Card>
                </div>

                {activePayment ? (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        Payment Reference
                        <Badge variant="outline">{activePayment.status === "pending" ? "Awaiting Payment" : activePayment.status}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-2">
                        <code className="flex-1 p-3 bg-muted rounded-md font-mono text-lg text-center">
                          {activePayment.referenceCode}
                        </code>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleCopyPaymentCode}
                          data-testid="button-copy-payment-code"
                        >
                          {copiedPayment ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>

                      <div className="space-y-2 text-sm">
                        <p className="font-medium">Payment Instructions:</p>
                        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                          <li>Open EVE Online and log in</li>
                          <li>Send exactly <span className="font-mono text-foreground">{formatISK(activePayment.iskAmount)} ISK</span> to <span className="font-medium text-foreground">{activePayment.recipientCharacter}</span></li>
                          <li>Put <span className="font-mono text-foreground">{activePayment.referenceCode}</span> in the payment reason/note field</li>
                          <li>Click "Check Payment" below after sending</li>
                        </ol>
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          className="flex-1"
                          onClick={handleVerifyPayment}
                          disabled={isVerifyingPayment}
                          data-testid="button-verify-payment"
                        >
                          {isVerifyingPayment ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              Checking...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Check Payment
                            </>
                          )}
                        </Button>
                      </div>

                      {verifyResult && !verifyResult.success && (
                        <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
                          <p className="text-xs text-amber-500">{verifyResult.message}</p>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">
                        Reference expires: {new Date(activePayment.expiresAt).toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={handleCreatePayment}
                    disabled={isCreatingPayment}
                    data-testid="button-create-payment"
                  >
                    {isCreatingPayment ? "Creating..." : "Pay with ISK"}
                  </Button>
                )}
              </TabsContent>

              <TabsContent value="redeem" className="space-y-4 mt-4">
                <Card className="border-emerald-500/30 bg-emerald-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-emerald-500" />
                      Redeem Gift Code
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Have a gift code? Enter it below to activate your PRO subscription.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="PHOTON-XXXX-XXXX-XXXX"
                        value={redeemCode}
                        onChange={(e) => setRedeemCode(e.target.value.trim().toUpperCase())}
                        className="font-mono"
                        disabled={redeemCodeMutation.isPending}
                        data-testid="input-redeem-code"
                      />
                      <Button 
                        onClick={() => redeemCodeMutation.mutate(redeemCode.trim())}
                        disabled={redeemCodeMutation.isPending || !redeemCode.trim() || !/^PHOTON-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(redeemCode.trim())}
                        data-testid="button-redeem-code"
                      >
                        {redeemCodeMutation.isPending ? "Redeeming..." : "Redeem"}
                      </Button>
                    </div>
                    {redeemCode.trim() && !/^PHOTON-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(redeemCode.trim()) && (
                      <p className="text-xs text-destructive">
                        Invalid format. Codes look like: PHOTON-XXXX-XXXX-XXXX
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Gift codes are generated by administrators and grant free PRO subscription time.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
