import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Building2, Percent, Save, RefreshCw, Wallet, ArrowRight } from "lucide-react";

interface UserProfile {
  characterId: number;
  characterName: string;
  firstLoginAt: string;
  proMemberSince: string | null;
  corpTaxRate: number;
}

interface CorpTaxSettingsProps {
  compact?: boolean;
}

function formatISK(value: number): string {
  if (value >= 1000000000) {
    return (value / 1000000000).toFixed(2) + "B";
  }
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + "M";
  }
  return value.toLocaleString();
}

export function calculateNetIsk(grossIsk: number, taxRate: number): number {
  return grossIsk * (1 - taxRate / 100);
}

export default function CorpTaxSettings({ compact = false }: CorpTaxSettingsProps) {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [taxRate, setTaxRate] = useState(0);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ["/api/user/profile"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (profile?.corpTaxRate !== undefined) {
      setTaxRate(profile.corpTaxRate);
      setHasChanges(false);
    }
  }, [profile?.corpTaxRate]);

  const updateTaxMutation = useMutation({
    mutationFn: async (rate: number) => {
      const response = await apiRequest("POST", "/api/user/corp-tax-rate", { rate });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Tax Rate Updated",
        description: data.message,
      });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update corp tax rate",
        variant: "destructive",
      });
    },
  });

  const handleSliderChange = (value: number[]) => {
    setTaxRate(value[0]);
    setHasChanges(value[0] !== (profile?.corpTaxRate ?? 0));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    const clampedValue = Math.min(100, Math.max(0, value));
    setTaxRate(clampedValue);
    setHasChanges(clampedValue !== (profile?.corpTaxRate ?? 0));
  };

  const handleSave = () => {
    updateTaxMutation.mutate(taxRate);
  };

  if (!isAuthenticated) {
    return (
      <Card className={compact ? "h-full" : ""}>
        <CardContent className="flex items-center justify-center h-full p-6">
          <p className="text-sm text-muted-foreground">Log in to set your corp tax rate</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={compact ? "h-full" : ""}>
        <CardContent className="flex items-center justify-center h-full p-6">
          <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const exampleBounty = 10000000; // 10M ISK
  const netBounty = calculateNetIsk(exampleBounty, taxRate);

  if (compact) {
    return (
      <div className="h-full flex flex-col p-4 gap-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          <span className="font-medium">Corp Tax Rate</span>
          <Badge variant="outline" className="ml-auto">
            {taxRate}%
          </Badge>
        </div>
        
        <div className="flex-1 flex flex-col gap-3">
          <Slider
            value={[taxRate]}
            onValueChange={handleSliderChange}
            max={100}
            step={0.5}
            className="w-full"
            data-testid="slider-corp-tax"
          />
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="w-4 h-4" />
            <span>{formatISK(exampleBounty)}</span>
            <ArrowRight className="w-3 h-3" />
            <span className="text-foreground font-medium">{formatISK(netBounty)} net</span>
          </div>
        </div>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={!hasChanges || updateTaxMutation.isPending}
          className="w-full"
          data-testid="button-save-tax"
        >
          {updateTaxMutation.isPending ? (
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          Corporation Tax Rate
        </CardTitle>
        <CardDescription>
          Set your corporation's tax rate to see net ISK after taxes on bounties.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="taxRate">Tax Rate (%)</Label>
              <div className="flex items-center gap-4 mt-2">
                <Slider
                  value={[taxRate]}
                  onValueChange={handleSliderChange}
                  max={100}
                  step={0.5}
                  className="flex-1"
                  data-testid="slider-corp-tax"
                />
                <div className="w-20">
                  <Input
                    id="taxRate"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={taxRate}
                    onChange={handleInputChange}
                    className="text-center"
                    data-testid="input-corp-tax"
                  />
                </div>
                <span className="text-muted-foreground">
                  <Percent className="w-4 h-4" />
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-md bg-muted/50 border">
            <p className="text-sm text-muted-foreground mb-2">Example calculation:</p>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-muted-foreground" />
                <span>Bounty: {formatISK(exampleBounty)}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <span className="text-foreground font-medium">
                  Net: {formatISK(netBounty)} ISK
                </span>
                <Badge variant="outline" className="text-xs">
                  -{taxRate}%
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={!hasChanges || updateTaxMutation.isPending}
          className="w-full"
          data-testid="button-save-tax-rate"
        >
          {updateTaxMutation.isPending ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Tax Rate
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export function useCorpTaxRate() {
  const { isAuthenticated } = useAuth();
  
  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["/api/user/profile"],
    enabled: isAuthenticated,
  });

  return profile?.corpTaxRate ?? 0;
}
