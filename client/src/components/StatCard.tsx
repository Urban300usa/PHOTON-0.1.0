import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive: boolean;
  };
  highlight?: boolean;
}

export default function StatCard({ label, value, icon: Icon, trend, highlight }: StatCardProps) {
  const isIskValue = value.includes('ISK') || value.includes('/hr');

  return (
    <Card
      className={`hud-panel--accent fade-rise h-full w-full p-4 pl-5 flex flex-col justify-center relative overflow-hidden ${
        highlight ? 'border-primary/50 bg-primary/5 accent-glow' : ''
      }`}
      data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {/* left accent bar */}
      <span
        className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-full ${
          highlight ? 'bg-primary' : 'bg-primary/30'
        }`}
        aria-hidden
      />
      <div className="flex items-center justify-between gap-2 h-full">
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p className="hud-eyebrow mb-1.5 truncate" data-testid="text-stat-label">
            {label}
          </p>
          <p
            className={`hud-metric truncate ${isIskValue ? 'isk-value' : 'text-foreground'}`}
            data-testid="text-stat-value"
          >
            {value}
          </p>
          {trend && (
            <p
              className={`text-[clamp(0.65rem,1.5vw,0.875rem)] mt-1 font-mono ${trend.positive ? 'isk-positive' : 'isk-negative'}`}
              data-testid="text-stat-trend"
            >
              {trend.positive ? '▲ ' : '▼ '}{trend.positive ? '+' : ''}{trend.value}
            </p>
          )}
        </div>
        <div className={`p-2 rounded-md shrink-0 border ${highlight ? 'bg-primary/20 border-primary/40' : 'bg-muted/60 border-border'}`}>
          <Icon className={`w-4 h-4 ${highlight ? 'text-primary animate-glow' : 'text-muted-foreground'}`} />
        </div>
      </div>
    </Card>
  );
}
