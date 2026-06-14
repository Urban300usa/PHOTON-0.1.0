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
      className={`h-full w-full p-4 flex flex-col justify-center card-glow ${highlight ? 'border-primary/50 bg-primary/5 accent-glow' : ''}`}
      data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center justify-between gap-2 h-full">
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p className="text-[clamp(0.7rem,2vw,0.875rem)] text-muted-foreground mb-1" data-testid="text-stat-label">
            {label}
          </p>
          <p
            className={`text-[clamp(1rem,4vw,1.875rem)] font-bold font-mono truncate leading-tight ${isIskValue ? 'isk-value' : ''}`}
            data-testid="text-stat-value"
          >
            {value}
          </p>
          {trend && (
            <p
              className={`text-[clamp(0.65rem,1.5vw,0.875rem)] mt-1 ${trend.positive ? 'isk-positive' : 'isk-negative'}`}
              data-testid="text-stat-trend"
            >
              {trend.positive ? '+' : ''}{trend.value}
            </p>
          )}
        </div>
        <div className={`p-2 rounded-md shrink-0 ${highlight ? 'bg-primary/20' : 'bg-muted'}`}>
          <Icon className={`w-4 h-4 ${highlight ? 'text-primary animate-glow' : 'text-muted-foreground'}`} />
        </div>
      </div>
    </Card>
  );
}
