import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Play, Square, Pause, RotateCcw, Zap, ExternalLink } from "lucide-react";

interface SessionControlsProps {
  onSessionStart?: () => void;
  onSessionStop?: () => void;
  onSessionPause?: () => void;
  onSessionReset?: () => void;
}

export default function SessionControls({ 
  onSessionStart, 
  onSessionStop, 
  onSessionPause,
  onSessionReset 
}: SessionControlsProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, isPaused]);

  const formatTime = useCallback((totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const handleStart = () => {
    setIsRunning(true);
    setIsPaused(false);
    onSessionStart?.();
  };

  const handleStop = () => {
    setIsRunning(false);
    setIsPaused(false);
    onSessionStop?.();
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
    onSessionPause?.();
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    onSessionReset?.();
  };

  return (
    <Card className={`h-full w-full p-4 flex flex-col justify-center ${isRunning && !isPaused ? 'accent-glow' : ''}`} data-testid="session-controls">
      <div className="flex flex-col items-center justify-center gap-4 h-full">
        <div className="flex items-center gap-2">
          <span
            className={`status-dot ${
              isRunning
                ? isPaused
                  ? 'warning'
                  : 'online'
                : 'offline'
            }`}
            data-testid="status-indicator"
          />
          <span className="text-[clamp(0.7rem,1.5vw,0.875rem)] text-muted-foreground" data-testid="text-session-status">
            {isRunning ? (isPaused ? 'Paused' : 'Active Session') : 'Ready'}
          </span>
        </div>

        <div
          className={`text-[clamp(2rem,8vw,4rem)] font-mono font-bold tracking-wider leading-none ${isRunning && !isPaused ? 'isk-value' : ''}`}
          data-testid="text-session-timer"
        >
          {formatTime(elapsedSeconds)}
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-2">
          {!isRunning ? (
            <div className="flex flex-col items-center gap-3">
              <Button 
                onClick={handleStart}
                data-testid="button-start-session"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Session
              </Button>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>Auto-starts when bounty over 2M ISK detected</span>
              </div>
            </div>
          ) : (
            <>
              <Button 
                variant="destructive"
                onClick={handleStop}
                data-testid="button-stop-session"
              >
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>
              <Button 
                variant="secondary"
                onClick={handlePause}
                data-testid="button-pause-session"
              >
                <Pause className="w-4 h-4 mr-2" />
                {isPaused ? 'Resume' : 'Pause'}
              </Button>
            </>
          )}
          {(isRunning || elapsedSeconds > 0) && (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleReset}
              data-testid="button-reset-session"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  window.open(
                    "/overlay",
                    "photon-overlay",
                    "width=320,height=280,resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no"
                  );
                }}
                data-testid="button-open-overlay"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Open mini overlay</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </Card>
  );
}
