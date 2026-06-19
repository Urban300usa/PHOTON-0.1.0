import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { MessageSquare, Send, Globe2, Building2, Flag, Trash2, ChevronUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useChat } from "@/contexts/ChatContext";
import { formatDistanceToNow } from "date-fns";

interface ChatMsg {
  id: number;
  channel: string;
  fromCharacterId: number;
  fromName: string;
  text: string;
  createdAt: string;
}
interface ChatResp { messages: ChatMsg[]; channel: string; orgId: number | null; isAdmin: boolean; characterId: number }
type Channel = "global" | "corp" | "alliance";

const CHANNEL_LABEL: Record<Channel, string> = { global: "everyone", corp: "your corp", alliance: "your alliance" };

export default function ChatPage() {
  const { isAuthenticated, character } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { clearUnread, pingSeq, setViewing } = useChat();
  const [channel, setChannel] = useState<Channel>("global");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [older, setOlder] = useState<ChatMsg[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<ChatResp>({
    queryKey: [`/api/chat/${channel}`],
    enabled: isAuthenticated,
    refetchInterval: 8000, // WS drives instant updates; this is just a safety net
  });

  const liveMessages = data?.messages ?? [];
  const isAdmin = data?.isAdmin ?? false;
  // Merge any "load earlier" pages (dedup by id), keep ascending
  const seen = new Set(liveMessages.map((m) => m.id));
  const messages = [...older.filter((m) => !seen.has(m.id)), ...liveMessages];

  // Report which channel we're viewing + clear unread while here
  useEffect(() => { setViewing(channel); clearUnread(); return () => setViewing(null); }, [channel, setViewing, clearUnread]);
  // On WS ping, refetch the active channel instantly
  useEffect(() => {
    if (pingSeq > 0) {
      queryClient.invalidateQueries({ queryKey: [`/api/chat/${channel}`] });
      clearUnread();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pingSeq]);
  // Reset "older" history when switching channels
  useEffect(() => { setOlder([]); }, [channel]);
  // Auto-scroll to newest
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [liveMessages.length, channel]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const res = await apiRequest("POST", `/api/chat/${channel}`, { text: trimmed });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Couldn't send", description: err.error || "Try again", variant: "destructive" });
      } else {
        setText("");
        queryClient.invalidateQueries({ queryKey: [`/api/chat/${channel}`] });
      }
    } catch {
      toast({ title: "Couldn't send", description: "Network error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const del = useCallback(async (id: number) => {
    try {
      const res = await apiRequest("DELETE", `/api/chat/message/${id}`);
      if (res.ok) {
        setOlder((prev) => prev.filter((m) => m.id !== id));
        queryClient.invalidateQueries({ queryKey: [`/api/chat/${channel}`] });
      }
    } catch { /* ignore */ }
  }, [channel, queryClient]);

  const loadOlder = async () => {
    if (loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const oldestId = messages[0].id;
      const res = await fetch(`/api/chat/${channel}?before=${oldestId}`);
      if (res.ok) {
        const d: ChatResp = await res.json();
        if (d.messages.length) setOlder((prev) => [...d.messages, ...prev]);
      }
    } catch { /* ignore */ } finally {
      setLoadingOlder(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="border-dashed max-w-md hud-panel--accent">
          <CardContent className="pt-6 text-center">
            <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Chat</h2>
            <p className="text-muted-foreground">Login with EVE Online to chat with other pilots.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-[900px] mx-auto flex flex-col h-[calc(100vh-7rem)]">
      <PageHeader
        icon={MessageSquare}
        title="Chat"
        subtitle="Talk with other PHOTON pilots in real time"
        actions={
          <Tabs value={channel} onValueChange={(v) => setChannel(v as Channel)}>
            <TabsList>
              <TabsTrigger value="global"><Globe2 className="h-3.5 w-3.5 mr-1.5" />Global</TabsTrigger>
              <TabsTrigger value="corp"><Building2 className="h-3.5 w-3.5 mr-1.5" />Corp</TabsTrigger>
              <TabsTrigger value="alliance"><Flag className="h-3.5 w-3.5 mr-1.5" />Alliance</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <Card className="hud-panel--accent flex-1 flex flex-col min-h-0">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-2/3" />)
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState bare icon={MessageSquare} message={`No messages in ${CHANNEL_LABEL[channel]} yet — say hello!`} />
            </div>
          ) : (
            <>
              {messages.length >= 40 && (
                <div className="flex justify-center">
                  <Button variant="ghost" size="sm" onClick={loadOlder} disabled={loadingOlder} className="text-xs text-muted-foreground">
                    <ChevronUp className="h-3.5 w-3.5 mr-1" />{loadingOlder ? "Loading…" : "Load earlier"}
                  </Button>
                </div>
              )}
              {messages.map((m) => {
                const mine = m.fromCharacterId === character?.id;
                const canDelete = mine || isAdmin;
                return (
                  <div key={m.id} className={`group flex gap-2.5 chat-msg-in ${mine ? "flex-row-reverse" : ""}`}>
                    <img
                      src={`https://images.evetech.net/characters/${m.fromCharacterId}/portrait?size=32`}
                      alt=""
                      className="h-8 w-8 rounded-md object-cover shrink-0 mt-0.5"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
                    />
                    <div className={`min-w-0 max-w-[75%] ${mine ? "text-right" : ""}`}>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground" style={mine ? { flexDirection: "row-reverse" } : undefined}>
                        <span className="font-semibold text-foreground/90">{mine ? "You" : m.fromName}</span>
                        <span>{formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}</span>
                        {canDelete && (
                          <button onClick={() => del(m.id)} className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive" title="Delete">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <div className={`mt-0.5 inline-block rounded-lg px-3 py-1.5 text-sm break-words ${mine ? "bg-primary/15 border border-primary/30" : "bg-muted/60 border border-border"}`}>
                        {m.text}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
          <div ref={bottomRef} />
        </CardContent>

        <div className="border-t border-border p-3 flex items-center gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={`Message ${CHANNEL_LABEL[channel]}…`}
            maxLength={500}
            disabled={sending}
          />
          <Button onClick={send} disabled={sending || !text.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
