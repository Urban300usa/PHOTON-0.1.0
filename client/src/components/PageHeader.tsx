import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: React.ReactNode;
  /** Right-aligned actions (buttons, filters, refresh, etc.) */
  actions?: React.ReactNode;
  size?: "default" | "sm";
  className?: string;
}

/**
 * Canonical page header for the Command-Center HUD: icon chip + title + subtitle,
 * an actions slot, and a gradient divider. Replaces the inline header JSX that was
 * duplicated across every page so a restyle touches one file.
 */
export function PageHeader({ icon: Icon, title, subtitle, actions, size = "default", className }: PageHeaderProps) {
  const sm = size === "sm";
  return (
    <div className={`mb-5 ${className ?? ""}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`hud-panel--accent shrink-0 grid place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary ${
              sm ? "h-9 w-9" : "h-11 w-11"
            }`}
          >
            <Icon className={sm ? "h-4 w-4" : "h-5 w-5"} />
          </div>
          <div className="min-w-0">
            <h1 className={`font-bold tracking-tight truncate ${sm ? "text-xl" : "text-2xl"}`}>{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
      <hr className="hud-divider mt-3" />
    </div>
  );
}

export default PageHeader;
