import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  icon: LucideIcon;
  title?: string;
  message: string;
  action?: React.ReactNode;
  /** Render inside a dashed Card (default) or bare (for use inside an existing card). */
  bare?: boolean;
  className?: string;
}

/**
 * Canonical empty / no-data state: centered dimmed icon + message (+ optional action).
 * Extracted from the pattern duplicated across pages so a restyle touches one file.
 */
export function EmptyState({ icon: Icon, title, message, action, bare = false, className }: EmptyStateProps) {
  const body = (
    <div className={`text-center py-12 ${className ?? ""}`}>
      <Icon className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
      {title && <p className="font-medium mb-1">{title}</p>}
      <p className="text-muted-foreground text-sm">{message}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );

  if (bare) return body;

  return (
    <Card className="border-dashed">
      <CardContent className="p-0">{body}</CardContent>
    </Card>
  );
}

export default EmptyState;
