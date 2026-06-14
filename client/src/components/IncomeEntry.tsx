import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Zap } from "lucide-react";

interface IncomeEntryProps {
  onAddIncome?: (amount: number) => void;
  recentEntries?: Array<{ id: string; amount: number; timestamp: Date }>;
}

const QUICK_AMOUNTS = [
  { label: "1M", value: 1000000 },
  { label: "5M", value: 5000000 },
  { label: "10M", value: 10000000 },
  { label: "25M", value: 25000000 },
];

function formatISK(value: number): string {
  return value.toLocaleString() + " ISK";
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export default function IncomeEntry({ onAddIncome, recentEntries = [] }: IncomeEntryProps) {
  const [inputValue, setInputValue] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(inputValue.replace(/,/g, ""), 10);
    if (!isNaN(amount) && amount > 0) {
      onAddIncome?.(amount);
      setInputValue("");
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
    }
  };

  const handleQuickAdd = (amount: number) => {
    onAddIncome?.(amount);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 1500);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, "");
    if (raw) {
      setInputValue(parseInt(raw, 10).toLocaleString());
    } else {
      setInputValue("");
    }
  };

  return (
    <Card className="h-full w-full p-4 flex flex-col" data-testid="income-entry">
      <h3 className="text-[clamp(0.875rem,2vw,1.125rem)] font-semibold mb-3 flex items-center gap-2">
        <Zap className="w-4 h-4 text-primary shrink-0" />
        Quick Income Entry
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-3 flex-1 flex flex-col">
        <div className="flex gap-2">
          <Input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Enter ISK amount..."
            className={`font-mono flex-1 transition-colors text-sm ${showSuccess ? 'border-green-400 bg-green-400/10' : ''}`}
            data-testid="input-isk-amount"
          />
          <Button type="submit" size="sm" data-testid="button-add-income">
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
        
        <div className="flex flex-wrap gap-1">
          {QUICK_AMOUNTS.map((item) => (
            <Button
              key={item.value}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleQuickAdd(item.value)}
              data-testid={`button-quick-add-${item.label}`}
            >
              +{item.label}
            </Button>
          ))}
        </div>

        {recentEntries.length > 0 && (
          <div className="flex-1 pt-3 border-t border-border min-h-0 overflow-auto">
            <p className="text-xs text-muted-foreground mb-2">Recent Entries</p>
            <div className="space-y-1">
              {recentEntries.slice(0, 5).map((entry) => (
                <div 
                  key={entry.id} 
                  className="flex justify-between items-center text-xs py-0.5"
                  data-testid={`entry-${entry.id}`}
                >
                  <span className="font-mono text-green-400">+{formatISK(entry.amount)}</span>
                  <span className="text-muted-foreground">{formatTimeAgo(entry.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </form>
    </Card>
  );
}
