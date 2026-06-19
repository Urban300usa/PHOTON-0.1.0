import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * Catches render errors in a page subtree so a single bad page shows a friendly
 * message instead of blanking the entire app. PageTransition keys on location,
 * so this remounts (and resets) on navigation.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("[ErrorBoundary] Page crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center h-[70vh] p-6">
          <div className="max-w-md text-center hud-panel--accent rounded-[var(--hud-radius)] border border-card-border bg-card p-8">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Something went wrong on this page</h2>
            <p className="text-muted-foreground text-sm mb-5 break-words">{this.state.error.message}</p>
            <Button onClick={() => this.setState({ error: null })}>Try again</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
