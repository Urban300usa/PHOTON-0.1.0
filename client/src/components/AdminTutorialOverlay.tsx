import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useAdminTutorial } from "@/contexts/TutorialContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, ChevronLeft, ChevronRight, Shield, SkipForward } from "lucide-react";

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function AdminTutorialOverlay() {
  const { isActive, currentStep, steps, currentStepData, next, prev, skip, complete } = useAdminTutorial();
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const getEffectiveSelector = useCallback(() => {
    if (!currentStepData) return null;
    return currentStepData.targetSelector;
  }, [currentStepData]);

  const updateTargetPosition = useCallback(() => {
    const selector = getEffectiveSelector();
    if (!selector) return;

    const element = document.querySelector(selector);
    if (element) {
      const rect = element.getBoundingClientRect();
      const padding = 8;
      setTargetRect({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2
      });

      const tooltipWidth = 320;
      const tooltipHeight = 200;
      const margin = 16;
      
      let top = 0;
      let left = 0;

      const placement = currentStepData?.placement || "bottom";

      switch (placement) {
        case "top":
          top = rect.top - tooltipHeight - margin;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case "bottom":
          top = rect.bottom + margin;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case "left":
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.left - tooltipWidth - margin;
          break;
        case "right":
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.right + margin;
          break;
        default:
          top = rect.bottom + margin;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
      }

      left = Math.max(margin, Math.min(left, window.innerWidth - tooltipWidth - margin));
      top = Math.max(margin, Math.min(top, window.innerHeight - tooltipHeight - margin));

      setTooltipPosition({ top, left });
    } else {
      setTargetRect(null);
      setTooltipPosition({ 
        top: window.innerHeight / 2 - 100, 
        left: window.innerWidth / 2 - 160 
      });
    }
  }, [currentStepData, getEffectiveSelector]);

  useEffect(() => {
    if (isActive) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      
      requestAnimationFrame(() => {
        tooltipRef.current?.focus();
      });
    } else {
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;

    updateTargetPosition();
    
    const handleResize = () => updateTargetPosition();
    const handleScroll = () => updateTargetPosition();
    
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);
    
    const observer = new MutationObserver(updateTargetPosition);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
      observer.disconnect();
    };
  }, [isActive, currentStep, updateTargetPosition]);

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          skip();
          break;
        case "ArrowRight":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
          e.preventDefault();
          prev();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isActive, next, prev, skip]);

  if (!isActive || !currentStepData) return null;

  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const overlay = (
    <div 
      className="fixed inset-0 z-[9999]"
      role="dialog"
      aria-modal="true"
      aria-label="Admin Tutorial"
    >
      <svg 
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: "none" }}
        aria-hidden="true"
      >
        <defs>
          <mask id="admin-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.75)"
          mask="url(#admin-spotlight-mask)"
          style={{ pointerEvents: "auto" }}
          onClick={(e) => e.stopPropagation()}
        />
      </svg>

      {targetRect && (
        <div
          className="absolute rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-transparent animate-pulse"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            pointerEvents: "none"
          }}
          aria-hidden="true"
        />
      )}

      <Card 
        ref={tooltipRef}
        tabIndex={-1}
        className="absolute w-80 shadow-2xl border-primary/50 bg-card/95 backdrop-blur-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          zIndex: 10000,
          pointerEvents: "auto"
        }}
        data-testid="admin-tutorial-tooltip"
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10">
                <Shield className="w-4 h-4 text-primary" aria-hidden="true" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">
                Admin Guide {currentStep + 1}/{steps.length}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mr-2 -mt-1"
              onClick={skip}
              data-testid="button-admin-tutorial-close"
              aria-label="Close tutorial"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <h3 className="font-semibold text-lg mb-2" data-testid="admin-tutorial-title">
            {currentStepData.title}
          </h3>
          <p className="text-sm text-muted-foreground mb-4" data-testid="admin-tutorial-description">
            {currentStepData.description}
          </p>

          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={skip}
              className="text-muted-foreground"
              data-testid="button-admin-tutorial-skip"
            >
              <SkipForward className="w-4 h-4 mr-1" aria-hidden="true" />
              Skip
            </Button>

            <div className="flex items-center gap-2">
              {!isFirstStep && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prev}
                  data-testid="button-admin-tutorial-prev"
                  aria-label="Previous step"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              )}
              <Button
                size="sm"
                onClick={isLastStep ? complete : next}
                data-testid="button-admin-tutorial-next"
              >
                {isLastStep ? "Done" : "Next"}
                {!isLastStep && <ChevronRight className="w-4 h-4 ml-1" aria-hidden="true" />}
              </Button>
            </div>
          </div>

          <div className="flex justify-center gap-1.5 mt-4" role="progressbar">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  index === currentStep 
                    ? "bg-primary" 
                    : index < currentStep 
                      ? "bg-primary/40" 
                      : "bg-muted-foreground/30"
                }`}
                aria-hidden="true"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return createPortal(overlay, document.body);
}
