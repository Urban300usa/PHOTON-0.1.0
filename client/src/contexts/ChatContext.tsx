import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";

interface ChatCtx {
  unread: number;
  clearUnread: () => void;
  pingSeq: number;            // bumps when a relevant message/delete arrives → consumers refetch
  setViewing: (channel: string | null) => void; // chat page reports the channel it's showing (null = not open)
}

const Ctx = createContext<ChatCtx | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [unread, setUnread] = useState(0);
  const [pingSeq, setPingSeq] = useState(0);
  const viewingRef = useRef<string | null>(null);
  const orgRef = useRef<{ corpId: number | null; allianceId: number | null }>({ corpId: null, allianceId: null });

  const setViewing = useCallback((channel: string | null) => { viewingRef.current = channel; }, []);
  const clearUnread = useCallback(() => setUnread(0), []);

  // Learn this character's corp + alliance ids once (so we can scope corp/alliance pings)
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const [c, a] = await Promise.all([
          fetch("/api/chat/corp?since=999999999").then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch("/api/chat/alliance?since=999999999").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ]);
        if (!cancelled) orgRef.current = { corpId: c?.orgId ?? null, allianceId: a?.orgId ?? null };
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  // Persistent WebSocket with auto-reconnect
  useEffect(() => {
    if (!isAuthenticated) return;
    let ws: WebSocket | null = null;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const connect = () => {
      try {
        ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/chat`);
        ws.onmessage = (e) => {
          try {
            const p = JSON.parse(e.data);
            let relevant = false;
            if (p.channel === "global" || p.channel === "*") relevant = true;
            else if (p.channel === "corp") relevant = p.corpId != null && p.corpId === orgRef.current.corpId;
            else if (p.channel === "alliance") relevant = p.allianceId != null && p.allianceId === orgRef.current.allianceId;
            if (!relevant) return;
            setPingSeq((s) => s + 1);
            if (p.type === "message" && viewingRef.current === null) setUnread((u) => u + 1);
          } catch { /* ignore */ }
        };
        ws.onclose = () => { if (!closed) reconnect = setTimeout(connect, 3000); };
        ws.onerror = () => { ws?.close(); };
      } catch {
        reconnect = setTimeout(connect, 3000);
      }
    };
    connect();
    return () => { closed = true; if (reconnect) clearTimeout(reconnect); ws?.close(); };
  }, [isAuthenticated]);

  return <Ctx.Provider value={{ unread, clearUnread, pingSeq, setViewing }}>{children}</Ctx.Provider>;
}

export function useChat() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useChat must be used within ChatProvider");
  return c;
}
