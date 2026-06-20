import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Calculator, Coins, Tag, AlertTriangle, Copy, Check, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { formatISK } from "@/hooks/use-wallet";
import { PageHeader } from "@/components/PageHeader";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AppraisalItem {
  typeId: number;
  name: string;
  quantity: number;
  buyEach: number;
  sellEach: number;
  buyTotal: number;
  sellTotal: number;
  priced: boolean;
}

interface AppraisalResult {
  market: string;
  items: AppraisalItem[];
  unmatched: string[];
  totals: { buy: number; sell: number };
  itemCount: number;
}

const EXAMPLE = `Tritanium\t12000
Pyerite 4500
Damage Control II x3
PLEX
Mexallon 800`;

function exactISK(n: number): string {
  return `${Math.round(n).toLocaleString()} ISK`;
}

export default function AppraisalPage() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [result, setResult] = useState<AppraisalResult | null>(null);
  const [copied, setCopied] = useState(false);

  const appraise = useMutation({
    mutationFn: async (raw: string) => {
      const res = await apiRequest("POST", "/api/tools/appraisal", { text: raw });
      return (await res.json()) as AppraisalResult;
    },
    onSuccess: (data) => setResult(data),
    onError: (err: any) => {
      toast({
        title: "Appraisal failed",
        description: err?.message?.replace(/^\d+:\s*/, "") || "Could not appraise items.",
        variant: "destructive",
      });
    },
  });

  const run = () => {
    if (!text.trim()) return;
    appraise.mutate(text);
  };

  const copySummary = async () => {
    if (!result) return;
    const lines = result.items.map(
      (i) => `${i.name}\t${i.quantity}\t${Math.round(i.sellTotal).toLocaleString()}`,
    );
    const summary = [
      `PHOTON Appraisal — ${result.market}`,
      ...lines,
      ``,
      `Sell total: ${exactISK(result.totals.sell)}`,
      `Buy total:  ${exactISK(result.totals.buy)}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Copy failed", description: "Clipboard unavailable.", variant: "destructive" });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="border-dashed max-w-md">
          <CardContent className="pt-6 text-center">
            <Calculator className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Appraisal</h2>
            <p className="text-muted-foreground">Login with EVE Online to appraise items at Jita prices.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1100px] mx-auto">
      <PageHeader
        icon={Calculator}
        title="Appraisal"
        subtitle="Paste any inventory, cargo scan, or contract — get an instant Jita valuation"
        actions={
          result ? (
            <Button variant="outline" size="sm" onClick={copySummary}>
              {copied ? <Check className="h-4 w-4 mr-1.5 text-green-400" /> : <Copy className="h-4 w-4 mr-1.5" />}
              {copied ? "Copied" : "Copy result"}
            </Button>
          ) : undefined
        }
      />

      <div className="grid lg:grid-cols-[minmax(0,360px)_1fr] gap-6">
        {/* Input */}
        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) run();
            }}
            placeholder={`Paste items here, one per line. Formats supported:\n\nTritanium  12000   (tab or spaces)\nPyerite 4500\nDamage Control II x3\nPLEX            (no qty = 1)`}
            className="min-h-[260px] font-mono text-xs leading-relaxed"
            spellCheck={false}
          />
          <div className="flex items-center gap-2">
            <Button onClick={run} disabled={appraise.isPending || !text.trim()} className="flex-1">
              {appraise.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Appraising…</>
              ) : (
                <><Coins className="h-4 w-4 mr-1.5" />Appraise</>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Clear"
              onClick={() => { setText(""); setResult(null); }}
              disabled={appraise.isPending || (!text && !result)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
            onClick={() => setText(EXAMPLE)}
          >
            Load an example list
          </button>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Tip: in EVE, select items in any inventory and press <kbd className="px-1 rounded bg-muted">Ctrl</kbd>+
            <kbd className="px-1 rounded bg-muted">C</kbd>, then paste here. <kbd className="px-1 rounded bg-muted">Ctrl</kbd>+
            <kbd className="px-1 rounded bg-muted">Enter</kbd> to appraise.
          </p>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {/* Totals */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="hud-panel--accent">
              <CardHeader className="pb-1">
                <CardTitle className="hud-eyebrow flex items-center gap-1.5 text-green-400">
                  <Coins className="h-3.5 w-3.5" /> Sell (Jita min)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="hud-metric text-2xl font-bold text-green-400">
                  {result ? formatISK(result.totals.sell) : "—"}
                </p>
                {result && <p className="text-[11px] text-muted-foreground mt-0.5">{exactISK(result.totals.sell)}</p>}
              </CardContent>
            </Card>
            <Card className="hud-panel--accent">
              <CardHeader className="pb-1">
                <CardTitle className="hud-eyebrow flex items-center gap-1.5 text-blue-400">
                  <Tag className="h-3.5 w-3.5" /> Buy (Jita max)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="hud-metric text-2xl font-bold text-blue-400">
                  {result ? formatISK(result.totals.buy) : "—"}
                </p>
                {result && <p className="text-[11px] text-muted-foreground mt-0.5">{exactISK(result.totals.buy)}</p>}
              </CardContent>
            </Card>
          </div>

          {/* Unmatched warning */}
          {result && result.unmatched.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <span className="text-amber-400 font-medium">{result.unmatched.length} unrecognized</span>{" "}
                <span className="text-muted-foreground">
                  {result.unmatched.slice(0, 8).join(", ")}
                  {result.unmatched.length > 8 ? `, +${result.unmatched.length - 8} more` : ""}
                </span>
              </div>
            </div>
          )}

          {/* Items table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Sell each</TableHead>
                    <TableHead className="text-right">Sell total</TableHead>
                    <TableHead className="text-right">Buy total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!result ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        <Calculator className="h-10 w-10 mx-auto mb-3 opacity-40" />
                        Paste a list and hit Appraise to see Jita values.
                      </TableCell>
                    </TableRow>
                  ) : result.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                        No recognized items.
                      </TableCell>
                    </TableRow>
                  ) : (
                    result.items.map((it) => (
                      <TableRow key={it.typeId}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <img
                              src={`https://images.evetech.net/types/${it.typeId}/icon?size=32`}
                              alt=""
                              loading="lazy"
                              className="h-5 w-5 rounded-sm shrink-0"
                              onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
                            />
                            <span className="truncate max-w-[260px]">{it.name}</span>
                            {!it.priced && (
                              <Badge variant="outline" className="text-amber-400 border-amber-400/40 text-[10px]">
                                no Jita price
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {it.quantity.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground text-sm">
                          {it.sellEach > 0 ? formatISK(it.sellEach) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-green-400">
                          {it.sellTotal > 0 ? formatISK(it.sellTotal) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-blue-400/90">
                          {it.buyTotal > 0 ? formatISK(it.buyTotal) : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {result && (
            <p className="text-xs text-muted-foreground text-right">
              {result.itemCount} item{result.itemCount === 1 ? "" : "s"} · priced at {result.market}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
