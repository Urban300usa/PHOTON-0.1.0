interface AppHeaderProps {
  className?: string;
}

export default function AppHeader({ className = "" }: AppHeaderProps) {
  return (
    <header className={`bg-card border border-card-border rounded-md p-6 mb-8 ${className}`} data-testid="app-header">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 
            className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent"
            data-testid="text-app-title"
          >
            PHOTON
          </h1>
          <p className="text-muted-foreground text-sm mt-1" data-testid="text-app-subtitle">
            EVE Online Income Tracker
          </p>
        </div>
      </div>
    </header>
  );
}
