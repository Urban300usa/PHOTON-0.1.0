import { useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  RefreshCw, 
  AlertCircle,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  ShoppingCart,
  Gavel,
  Users,
  ArrowRight,
  Package,
  Calendar,
  MapPin,
  User,
  Building,
  Eye,
  Coins
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useCharacterView } from "@/contexts/CharacterViewContext";
import { EveIcon } from "@/components/EveIcon";
import { format, formatDistanceToNow, isPast } from "date-fns";

interface Contract {
  contract_id: number;
  issuer_id: number;
  issuer_corporation_id: number;
  assignee_id: number;
  acceptor_id: number;
  type: 'unknown' | 'item_exchange' | 'auction' | 'courier' | 'loan';
  status: string;
  title: string;
  for_corporation: boolean;
  availability: string;
  date_issued: string;
  date_expired: string;
  date_accepted?: string;
  date_completed?: string;
  days_to_complete?: number;
  end_location_id?: number;
  start_location_id?: number;
  price?: number;
  reward?: number;
  collateral?: number;
  buyout?: number;
  volume?: number;
  characterId: number;
  characterName: string;
  startLocationName?: string;
  endLocationName?: string;
  issuerName?: string;
  issuerCorporationName?: string;
  assigneeName?: string;
  acceptorName?: string;
}

interface ContractsData {
  contracts: Contract[];
  totalContracts: number;
  outstanding: number;
  inProgress: number;
  finished: number;
  totalValue: number;
  characterIds: number[];
  viewAll: boolean;
}

interface ContractItem {
  record_id: number;
  type_id: number;
  quantity: number;
  is_included: boolean;
  is_singleton?: boolean;
  raw_quantity?: number;
  typeName: string;
}

interface MarketPrices {
  prices: Record<number, { sellPrice: number | null; buyPrice: number | null; name: string }>;
  lastUpdated: string;
}

function getExpirationStatus(dateExpired: string): { status: 'expired' | 'critical' | 'warning' | 'ok'; label: string; color: string } {
  const now = new Date();
  const expiry = new Date(dateExpired);
  const hoursUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  if (hoursUntilExpiry <= 0) {
    return { status: 'expired', label: 'Expired', color: 'bg-red-500' };
  } else if (hoursUntilExpiry <= 24) {
    return { status: 'critical', label: `${Math.floor(hoursUntilExpiry)}h left`, color: 'bg-red-500' };
  } else if (hoursUntilExpiry <= 72) {
    const days = Math.floor(hoursUntilExpiry / 24);
    return { status: 'warning', label: `${days}d left`, color: 'bg-yellow-500' };
  } else {
    const days = Math.floor(hoursUntilExpiry / 24);
    return { status: 'ok', label: `${days}d left`, color: 'bg-green-500' };
  }
}

function formatISK(value: number): string {
  if (value >= 1000000000000) {
    return (value / 1000000000000).toFixed(2) + "T ISK";
  }
  if (value >= 1000000000) {
    return (value / 1000000000).toFixed(2) + "B ISK";
  }
  if (value >= 1000000) {
    return (value / 1000000).toFixed(2) + "M ISK";
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + "K ISK";
  }
  return value.toLocaleString() + " ISK";
}

function getContractTypeIcon(type: string) {
  switch (type) {
    case 'courier':
      return <Truck className="h-4 w-4" />;
    case 'item_exchange':
      return <ShoppingCart className="h-4 w-4" />;
    case 'auction':
      return <Gavel className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

function getContractTypeName(type: string): string {
  switch (type) {
    case 'courier': return 'Courier';
    case 'item_exchange': return 'Item Exchange';
    case 'auction': return 'Auction';
    case 'loan': return 'Loan';
    default: return 'Unknown';
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'outstanding':
      return <Badge variant="default" className="bg-blue-500">Outstanding</Badge>;
    case 'in_progress':
      return <Badge variant="default" className="bg-yellow-500">In Progress</Badge>;
    case 'finished':
    case 'finished_issuer':
    case 'finished_contractor':
      return <Badge variant="default" className="bg-green-500">Completed</Badge>;
    case 'cancelled':
      return <Badge variant="secondary">Cancelled</Badge>;
    case 'rejected':
      return <Badge variant="destructive">Rejected</Badge>;
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    case 'deleted':
      return <Badge variant="secondary">Deleted</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function getAvailabilityLabel(availability: string): string {
  switch (availability) {
    case 'public': return 'Public';
    case 'personal': return 'Personal';
    case 'corporation': return 'Corporation';
    case 'alliance': return 'Alliance';
    default: return availability;
  }
}

function ContractDetailDialog({ 
  contract, 
  open, 
  onOpenChange 
}: { 
  contract: Contract | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { data: itemsData, isLoading: itemsLoading } = useQuery<{ items: ContractItem[] }>({
    queryKey: ['/api/contracts', contract?.contract_id, 'items', contract?.characterId],
    queryFn: async () => {
      const response = await fetch(
        `/api/contracts/${contract?.contract_id}/items?characterId=${contract?.characterId}`,
        { credentials: 'include' }
      );
      if (!response.ok) {
        throw new Error('Failed to fetch contract items');
      }
      return response.json();
    },
    enabled: open && !!contract && (contract.type === 'item_exchange' || contract.type === 'auction'),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch market prices for contract items (batch in groups of 10)
  const items = itemsData?.items || [];
  const allTypeIds = Array.from(new Set(items.map(i => i.type_id)));
  
  const { data: marketData, isLoading: pricesLoading } = useQuery<MarketPrices & { failedBatches?: number }>({
    queryKey: ['/api/market/prices', allTypeIds.join(',')],
    queryFn: async () => {
      // Batch requests in groups of 10 (API limit)
      const allPrices: Record<number, { sellPrice: number | null; buyPrice: number | null; name: string }> = {};
      let failedBatches = 0;
      
      for (let i = 0; i < allTypeIds.length; i += 10) {
        const batch = allTypeIds.slice(i, i + 10);
        try {
          const response = await fetch('/api/market/prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ typeIds: batch }),
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            Object.assign(allPrices, data.prices);
          } else {
            failedBatches++;
          }
        } catch {
          failedBatches++;
        }
      }
      
      return { prices: allPrices, lastUpdated: new Date().toISOString(), failedBatches };
    },
    enabled: open && !!contract && items.length > 0 && allTypeIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  
  // Check if any items are missing price data
  const itemsMissingPrices = items.filter(item => 
    marketData?.prices && !marketData.prices[item.type_id]?.sellPrice
  ).length;

  if (!contract) return null;

  const includedItems = items.filter(i => i.is_included);
  const requestedItems = items.filter(i => !i.is_included);
  
  // Calculate total market value
  const calculateMarketValue = (itemList: ContractItem[]) => {
    if (!marketData?.prices) return null;
    let total = 0;
    for (const item of itemList) {
      const price = marketData.prices[item.type_id]?.sellPrice;
      if (price) {
        total += price * item.quantity;
      }
    }
    return total > 0 ? total : null;
  };
  
  const includedMarketValue = calculateMarketValue(includedItems);
  const requestedMarketValue = calculateMarketValue(requestedItems);
  const expirationStatus = getExpirationStatus(contract.date_expired);
  
  // Net value = what you receive - what you give - price you pay
  // Show calculation if any component has a value
  const hasAnyValue = includedMarketValue !== null || requestedMarketValue !== null || (contract.price && contract.price > 0);
  const netMarketGain = hasAnyValue 
    ? (includedMarketValue || 0) - (requestedMarketValue || 0) - (contract.price || 0)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getContractTypeIcon(contract.type)}
            {contract.title || getContractTypeName(contract.type)}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
            Contract #{contract.contract_id}
            {getStatusBadge(contract.status)}
            {contract.status === 'outstanding' && (
              <Badge className={expirationStatus.color}>
                {expirationStatus.label}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Issued By
                </div>
                <div className="font-medium">{contract.issuerName || 'Unknown'}</div>
                {contract.issuerCorporationName && (
                  <div className="text-xs text-muted-foreground">{contract.issuerCorporationName}</div>
                )}
              </div>

              {contract.assigneeName && (
                <div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Assigned To
                  </div>
                  <div className="font-medium">{contract.assigneeName}</div>
                </div>
              )}

              {contract.acceptorName && (
                <div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Accepted By
                  </div>
                  <div className="font-medium">{contract.acceptorName}</div>
                </div>
              )}
              
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Type
                </div>
                <div className="font-medium">{getContractTypeName(contract.type)}</div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Availability
                </div>
                <div className="font-medium">{getAvailabilityLabel(contract.availability)}</div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Your Character
                </div>
                <div className="font-medium text-primary">{contract.characterName}</div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Issued
                </div>
                <div className="font-medium">{format(new Date(contract.date_issued), 'MMM d, yyyy HH:mm')}</div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Expires
                </div>
                <div className={`font-medium ${isPast(new Date(contract.date_expired)) ? 'text-destructive' : ''}`}>
                  {format(new Date(contract.date_expired), 'MMM d, yyyy HH:mm')}
                  {!isPast(new Date(contract.date_expired)) && (
                    <span className="text-xs text-muted-foreground ml-1">
                      ({formatDistanceToNow(new Date(contract.date_expired), { addSuffix: true })})
                    </span>
                  )}
                </div>
              </div>

              {contract.date_accepted && (
                <div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Accepted
                  </div>
                  <div className="font-medium">{format(new Date(contract.date_accepted), 'MMM d, yyyy HH:mm')}</div>
                </div>
              )}

              {contract.date_completed && (
                <div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Completed
                  </div>
                  <div className="font-medium">{format(new Date(contract.date_completed), 'MMM d, yyyy HH:mm')}</div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {contract.type === 'courier' && (
            <>
              <div className="space-y-2">
                <div className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Route
                </div>
                <div className="p-3 rounded-lg bg-muted/50 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">From</div>
                    <div className="font-medium text-sm">{contract.startLocationName || 'Unknown'}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">To</div>
                    <div className="font-medium text-sm">{contract.endLocationName || 'Unknown'}</div>
                  </div>
                </div>
                {contract.days_to_complete && (
                  <div className="text-sm text-muted-foreground">
                    Days to complete: {contract.days_to_complete}
                  </div>
                )}
              </div>
              <Separator />
            </>
          )}

          <div className="space-y-2">
            <div className="text-sm font-medium flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Financial Details
            </div>
            <div className="grid grid-cols-2 gap-3">
              {contract.price !== undefined && contract.price > 0 && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground">Price</div>
                  <div className="font-medium text-primary">{formatISK(contract.price)}</div>
                </div>
              )}
              {contract.reward !== undefined && contract.reward > 0 && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground">Reward</div>
                  <div className="font-medium text-green-500">{formatISK(contract.reward)}</div>
                </div>
              )}
              {contract.collateral !== undefined && contract.collateral > 0 && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground">Collateral</div>
                  <div className="font-medium text-yellow-500">{formatISK(contract.collateral)}</div>
                </div>
              )}
              {contract.buyout !== undefined && contract.buyout > 0 && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground">Buyout</div>
                  <div className="font-medium">{formatISK(contract.buyout)}</div>
                </div>
              )}
              {contract.volume !== undefined && contract.volume > 0 && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground">Volume</div>
                  <div className="font-medium">{contract.volume.toLocaleString()} m³</div>
                </div>
              )}
            </div>
          </div>

          {(contract.type === 'item_exchange' || contract.type === 'auction') && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Contract Items
                  {pricesLoading && <RefreshCw className="h-3 w-3 animate-spin" />}
                </div>
                
                {itemsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : items.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-3 text-center">
                    No items in this contract
                  </div>
                ) : (
                  <div className="space-y-3">
                    {includedItems.length > 0 && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">You will receive:</div>
                        <div className="space-y-1">
                          {includedItems.map((item) => {
                            const marketPrice = marketData?.prices?.[item.type_id]?.sellPrice;
                            const totalValue = marketPrice ? marketPrice * item.quantity : null;
                            const isBlueprintCopy = item.raw_quantity !== undefined && item.raw_quantity < 0;
                            return (
                              <div 
                                key={item.record_id}
                                className="flex items-center gap-2 p-2 rounded bg-green-500/10 text-sm"
                              >
                                <EveIcon 
                                  typeId={item.type_id} 
                                  size={32} 
                                  alt={item.typeName}
                                  variant={isBlueprintCopy ? "bpc" : "icon"}
                                />
                                <span className="flex-1">{item.typeName}</span>
                                <span className="text-muted-foreground">x{item.quantity.toLocaleString()}</span>
                                {totalValue && (
                                  <span className="text-xs text-green-500 min-w-[80px] text-right">
                                    ~{formatISK(totalValue)}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {requestedItems.length > 0 && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">You will give:</div>
                        <div className="space-y-1">
                          {requestedItems.map((item) => {
                            const marketPrice = marketData?.prices?.[item.type_id]?.sellPrice;
                            const totalValue = marketPrice ? marketPrice * item.quantity : null;
                            const isBlueprintCopy = item.raw_quantity !== undefined && item.raw_quantity < 0;
                            return (
                              <div 
                                key={item.record_id}
                                className="flex items-center gap-2 p-2 rounded bg-red-500/10 text-sm"
                              >
                                <EveIcon 
                                  typeId={item.type_id} 
                                  size={32} 
                                  alt={item.typeName}
                                  variant={isBlueprintCopy ? "bpc" : "icon"}
                                />
                                <span className="flex-1">{item.typeName}</span>
                                <span className="text-muted-foreground">x{item.quantity.toLocaleString()}</span>
                                {totalValue && (
                                  <span className="text-xs text-red-500 min-w-[80px] text-right">
                                    ~{formatISK(totalValue)}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Market Value Comparison */}
                    {hasAnyValue && (
                      <div className="mt-3 p-3 rounded-lg bg-muted/50 border">
                        <div className="text-xs text-muted-foreground mb-2 flex items-center justify-between">
                          <span>Market Value Comparison (Jita Sell Prices)</span>
                          {(itemsMissingPrices > 0 || (marketData?.failedBatches && marketData.failedBatches > 0)) && (
                            <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                              Partial Data
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {includedMarketValue && (
                            <div>
                              <div className="text-xs text-muted-foreground">You Receive (Market Value)</div>
                              <div className="font-medium text-green-500">{formatISK(includedMarketValue)}</div>
                            </div>
                          )}
                          {requestedMarketValue && (
                            <div>
                              <div className="text-xs text-muted-foreground">You Give (Market Value)</div>
                              <div className="font-medium text-red-500">{formatISK(requestedMarketValue)}</div>
                            </div>
                          )}
                          {contract.price !== undefined && contract.price > 0 && (
                            <div>
                              <div className="text-xs text-muted-foreground">ISK You Pay</div>
                              <div className="font-medium text-red-500">{formatISK(contract.price)}</div>
                            </div>
                          )}
                        </div>
                        {netMarketGain !== null && (
                          <div className="mt-2 pt-2 border-t">
                            <div className="text-xs text-muted-foreground">Net Market Value</div>
                            <div className={`font-medium ${netMarketGain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {netMarketGain >= 0 ? '+' : ''}{formatISK(netMarketGain)}
                              <span className="text-xs text-muted-foreground ml-1">
                                ({netMarketGain >= 0 ? 'Good Deal' : 'You Lose Value'})
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Contracts() {
  const { isAuthenticated, isLoading: authLoading, character } = useAuth();
  const { viewMode } = useCharacterView();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const { data: contractsData, isLoading, error, refetch, isFetching } = useQuery<ContractsData>({
    queryKey: ['/api/contracts', viewMode],
    queryFn: async () => {
      const url = viewMode === 'all' 
        ? '/api/contracts?viewAll=true' 
        : '/api/contracts';
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch contracts');
      }
      return response.json();
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const filteredContracts = useMemo(() => {
    if (!contractsData?.contracts) return [];
    
    let filtered = contractsData.contracts;
    
    if (activeTab === 'outstanding') {
      filtered = filtered.filter(c => c.status === 'outstanding');
    } else if (activeTab === 'in_progress') {
      filtered = filtered.filter(c => c.status === 'in_progress');
    } else if (activeTab === 'completed') {
      filtered = filtered.filter(c => ['finished', 'finished_issuer', 'finished_contractor'].includes(c.status));
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(contract => 
        contract.title?.toLowerCase().includes(term) ||
        contract.characterName.toLowerCase().includes(term) ||
        contract.startLocationName?.toLowerCase().includes(term) ||
        contract.endLocationName?.toLowerCase().includes(term) ||
        getContractTypeName(contract.type).toLowerCase().includes(term)
      );
    }
    
    return filtered.sort((a, b) => new Date(b.date_issued).getTime() - new Date(a.date_issued).getTime());
  }, [contractsData, searchTerm, activeTab]);

  if (authLoading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Contracts
            </CardTitle>
            <CardDescription>
              Track your character's contracts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Log in with EVE Online to view your contracts
              </p>
              <Link href="/">
                <Button data-testid="button-login-home">Go to Dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex flex-col gap-6">
        <PageHeader
          icon={FileText}
          title="Contracts"
          subtitle={`${viewMode === 'all' ? 'All characters' : character?.name || 'Your character'}'s contracts`}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="button-refresh-contracts"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          }
        />

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <span>
                  {error instanceof Error && error.message.includes('scope') 
                    ? 'Please log out and log in again to grant contracts permission'
                    : 'Failed to load contracts. Please try again.'}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold text-primary" data-testid="text-total-value">
                  {formatISK(contractsData?.totalValue || 0)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Contracts</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">
                  {contractsData?.totalContracts || 0}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  {contractsData?.outstanding || 0}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-yellow-500" />
                  {contractsData?.inProgress || 0}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">View Mode</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={viewMode === 'all' ? 'default' : 'secondary'}>
                {viewMode === 'all' ? 'All Characters' : 'Single Character'}
              </Badge>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Contract List
                </CardTitle>
                <CardDescription>
                  Your contracts sorted by issue date
                </CardDescription>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search contracts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                  data-testid="input-search-contracts"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all" data-testid="tab-all">All ({contractsData?.totalContracts || 0})</TabsTrigger>
                <TabsTrigger value="outstanding" data-testid="tab-outstanding">Outstanding ({contractsData?.outstanding || 0})</TabsTrigger>
                <TabsTrigger value="in_progress" data-testid="tab-in-progress">In Progress ({contractsData?.inProgress || 0})</TabsTrigger>
                <TabsTrigger value="completed" data-testid="tab-completed">Completed ({contractsData?.finished || 0})</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab}>
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : filteredContracts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>
                      {searchTerm 
                        ? `No contracts found matching "${searchTerm}"`
                        : 'No contracts found'}
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[600px] pr-4">
                    <div className="space-y-3">
                      {filteredContracts.map((contract) => (
                        <div 
                          key={contract.contract_id}
                          className="p-4 rounded-lg border bg-card hover-elevate cursor-pointer transition-colors"
                          data-testid={`contract-${contract.contract_id}`}
                          onClick={() => {
                            setSelectedContract(contract);
                            setDetailDialogOpen(true);
                          }}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="p-2 rounded-lg bg-muted">
                                {getContractTypeIcon(contract.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">
                                    {contract.title || getContractTypeName(contract.type)}
                                  </span>
                                  {getStatusBadge(contract.status)}
                                  <Badge variant="outline">{getContractTypeName(contract.type)}</Badge>
                                </div>
                                
                                {contract.type === 'courier' && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                    <span className="truncate max-w-[200px]">{contract.startLocationName || 'Unknown'}</span>
                                    <ArrowRight className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate max-w-[200px]">{contract.endLocationName || 'Unknown'}</span>
                                  </div>
                                )}
                                
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2 flex-wrap">
                                  <span>Issued: {format(new Date(contract.date_issued), 'MMM d, yyyy')}</span>
                                  {contract.status === 'outstanding' && (() => {
                                    const expStatus = getExpirationStatus(contract.date_expired);
                                    return (
                                      <Badge className={`${expStatus.color} text-white text-xs`}>
                                        {expStatus.label}
                                      </Badge>
                                    );
                                  })()}
                                  {contract.issuerName && (
                                    <span className="text-muted-foreground">from {contract.issuerName}</span>
                                  )}
                                  {viewMode === 'all' && (
                                    <span className="text-primary">{contract.characterName}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                              {contract.price !== undefined && contract.price > 0 && (
                                <div className="font-medium">{formatISK(contract.price)}</div>
                              )}
                              {contract.reward !== undefined && contract.reward > 0 && (
                                <div className="text-sm text-green-500">Reward: {formatISK(contract.reward)}</div>
                              )}
                              {contract.collateral !== undefined && contract.collateral > 0 && (
                                <div className="text-sm text-muted-foreground">Collateral: {formatISK(contract.collateral)}</div>
                              )}
                              {contract.volume !== undefined && contract.volume > 0 && (
                                <div className="text-xs text-muted-foreground">{contract.volume.toLocaleString()} m³</div>
                              )}
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <Eye className="h-3 w-3" />
                                Click for details
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <ContractDetailDialog
        contract={selectedContract}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  );
}
