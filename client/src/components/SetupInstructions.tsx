import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Info, ExternalLink, X } from "lucide-react";

interface SetupInstructionsProps {
  onDismiss?: () => void;
}

export default function SetupInstructions({ onDismiss }: SetupInstructionsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Card 
      className="p-6 border-primary/50 bg-primary/5 mb-8"
      data-testid="setup-instructions"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/20">
            <Info className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-primary">Setup Instructions</h3>
            <p className="text-sm text-muted-foreground">Optional ESI API integration for automatic tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid="button-toggle-instructions"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDismiss}
            data-testid="button-dismiss-instructions"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-6 space-y-4">
          <ol className="list-decimal list-inside space-y-3 text-sm">
            <li className="leading-relaxed">
              <span className="text-foreground">Register an application at </span>
              <a 
                href="https://developers.eveonline.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center gap-1"
                data-testid="link-eve-developers"
              >
                developers.eveonline.com
                <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li className="leading-relaxed">
              <span className="text-foreground">Set the callback URL to: </span>
              <code className="bg-muted px-2 py-1 rounded text-primary font-mono text-xs">
                {typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000'}/callback
              </code>
            </li>
            <li className="leading-relaxed">
              <span className="text-foreground">Add the following scopes: </span>
              <code className="bg-muted px-2 py-1 rounded text-primary font-mono text-xs">
                esi-wallet.read_character_wallet.v1
              </code>
            </li>
            <li className="leading-relaxed">
              <span className="text-foreground">Copy your Client ID and Secret Key to the settings</span>
            </li>
          </ol>

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              This integration is optional. You can manually track your ratting income without connecting to EVE's API.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
