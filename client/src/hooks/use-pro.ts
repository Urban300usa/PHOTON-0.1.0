import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useEffect, useCallback } from "react";

interface PendingCode {
  code: string;
  iskAmount: number;
  expiresAt: string;
}

interface ProStatus {
  isPro: boolean;
  status: "active" | "expired" | "pending" | "none" | "not_authenticated";
  expiresAt: string | null;
  activatedAt: string | null;
  pendingCode: PendingCode | null;
  pricing: {
    weeklyIsk: number;
    monthlyIsk: number;
    recipientCharacterName: string;
  };
  characterId?: number;
  characterName?: string;
}

interface GeneratedCode {
  code: string;
  iskAmount: number;
  expiresAt: string;
  recipientCharacter: string;
  instructions: string;
  isExisting: boolean;
}

interface FreeTrialResult {
  success: boolean;
  message: string;
  expiresAt: string;
}

interface PendingPayment {
  referenceCode: string;
  planType: "weekly" | "monthly";
  iskAmount: number;
  expiresAt: string;
  recipientCharacter: string;
  instructions: string;
  isExisting: boolean;
  status: "pending" | "completed" | "expired";
}

interface PaymentVerifyResult {
  found: boolean;
  success?: boolean;
  message: string;
  referenceCode?: string;
  expectedAmount?: number;
  transactionId?: number;
  amountPaid?: number;
  expiresAt?: string;
}

// Auto-refresh interval for PRO status (30 seconds)
const PRO_STATUS_REFRESH_INTERVAL = 30000;

export function usePro() {
  const { data: proStatus, isLoading, refetch } = useQuery<ProStatus>({
    queryKey: ["/api/pro/status"],
    refetchOnWindowFocus: true,
    refetchInterval: PRO_STATUS_REFRESH_INTERVAL,
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  // Force refetch when window becomes visible after being hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetch();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refetch]);

  const generateCodeMutation = useMutation({
    mutationFn: async (duration: "weekly" | "monthly") => {
      const response = await apiRequest("POST", "/api/pro/generate-code", { duration });
      return response.json() as Promise<GeneratedCode>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pro/status"] });
    },
  });

  const claimTrialMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/pro/claim-free-trial");
      return response.json() as Promise<FreeTrialResult>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pro/status"] });
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (planType: "weekly" | "monthly") => {
      const response = await apiRequest("POST", "/api/pro/payment/create", { planType });
      return response.json() as Promise<PendingPayment>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pro/status"] });
    },
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/pro/payment/verify");
      return response.json() as Promise<PaymentVerifyResult>;
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/pro/status"] });
      }
    },
  });

  return {
    isPro: proStatus?.isPro ?? false,
    status: proStatus?.status ?? "not_authenticated",
    expiresAt: proStatus?.expiresAt ? new Date(proStatus.expiresAt) : null,
    activatedAt: proStatus?.activatedAt ? new Date(proStatus.activatedAt) : null,
    pendingCode: proStatus?.pendingCode,
    pricing: proStatus?.pricing,
    characterId: proStatus?.characterId,
    characterName: proStatus?.characterName,
    isLoading,
    refetch,
    generateCode: generateCodeMutation.mutate,
    isGeneratingCode: generateCodeMutation.isPending,
    generatedCode: generateCodeMutation.data,
    claimTrial: claimTrialMutation.mutate,
    isClaimingTrial: claimTrialMutation.isPending,
    trialClaimed: claimTrialMutation.isSuccess,
    trialError: claimTrialMutation.error,
    createPayment: createPaymentMutation.mutate,
    isCreatingPayment: createPaymentMutation.isPending,
    pendingPayment: createPaymentMutation.data,
    verifyPayment: verifyPaymentMutation.mutate,
    isVerifyingPayment: verifyPaymentMutation.isPending,
    verifyResult: verifyPaymentMutation.data,
    resetPaymentState: () => {
      createPaymentMutation.reset();
      verifyPaymentMutation.reset();
    },
  };
}
