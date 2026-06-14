import { useState, useEffect } from 'react';
import { X, Lightbulb, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useSmartTooltipContext, TOOLTIPS } from '@/contexts/SmartTooltipContext';

interface SmartTooltipProps {
  tooltipId: string;
  children?: React.ReactNode;
  showIcon?: boolean;
  iconSize?: 'sm' | 'md';
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}

export function SmartTooltip({
  tooltipId,
  children,
  showIcon = true,
  iconSize = 'sm',
  side = 'top',
  align = 'center',
}: SmartTooltipProps) {
  const { hasSeenTooltip, markAsSeen, isLoaded } = useSmartTooltipContext();
  const [isOpen, setIsOpen] = useState(false);
  const [hasAutoShown, setHasAutoShown] = useState(false);

  const tooltipInfo = TOOLTIPS[tooltipId];
  const hasSeen = hasSeenTooltip(tooltipId);

  useEffect(() => {
    if (isLoaded && !hasSeen && !hasAutoShown && tooltipInfo) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        setHasAutoShown(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isLoaded, hasSeen, hasAutoShown, tooltipInfo]);

  if (!tooltipInfo) {
    return <>{children}</>;
  }

  const handleDismiss = () => {
    markAsSeen(tooltipId);
    setIsOpen(false);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open && !hasSeen) {
      markAsSeen(tooltipId);
    }
  };

  const iconClasses = iconSize === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {children ? (
          <div className="inline-flex items-center gap-1.5 cursor-help">
            {children}
            {showIcon && !hasSeen && (
              <div className="relative">
                <Lightbulb className={`${iconClasses} text-amber-500`} />
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              </div>
            )}
            {showIcon && hasSeen && (
              <HelpCircle className={`${iconClasses} text-muted-foreground opacity-50`} />
            )}
          </div>
        ) : showIcon ? (
          <button className="inline-flex items-center cursor-help">
            {!hasSeen ? (
              <div className="relative">
                <Lightbulb className={`${iconClasses} text-amber-500`} />
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              </div>
            ) : (
              <HelpCircle className={`${iconClasses} text-muted-foreground opacity-50`} />
            )}
          </button>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className="w-72 p-0"
        data-testid={`tooltip-${tooltipId}`}
      >
        <div className="p-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-amber-500/10">
                <Lightbulb className="w-4 h-4 text-amber-500" />
              </div>
              <h4 className="font-medium text-sm">{tooltipInfo.title}</h4>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mt-1 -mr-1"
              onClick={handleDismiss}
              data-testid={`tooltip-dismiss-${tooltipId}`}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {tooltipInfo.content}
          </p>
          {!hasSeen && (
            <Button
              variant="secondary"
              size="sm"
              className="w-full mt-3 h-7 text-xs"
              onClick={handleDismiss}
              data-testid={`tooltip-gotit-${tooltipId}`}
            >
              Got it!
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface TooltipResetButtonProps {
  className?: string;
}

export function TooltipResetButton({ className }: TooltipResetButtonProps) {
  const { resetTooltips, seenTooltips } = useSmartTooltipContext();
  const count = seenTooltips.size;

  if (count === 0) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={resetTooltips}
      className={className}
      data-testid="button-reset-tooltips"
    >
      <Lightbulb className="w-3.5 h-3.5 mr-1.5" />
      Show tips again ({count})
    </Button>
  );
}
