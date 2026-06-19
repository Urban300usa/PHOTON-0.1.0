import { useState, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { ObjectUploader } from "@/components/ObjectUploader";
import {
  Bug,
  Lightbulb,
  User,
  CreditCard,
  HelpCircle,
  Send,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  MessageSquare,
  ChevronRight,
  FileText,
  Paperclip,
  X,
  Image,
  File,
  Download,
  Pencil,
  Check,
} from "lucide-react";

interface Attachment {
  filename: string;
  url: string;
  size: number;
  type: string;
  uploadedAt?: string;
  expiresAt?: string;
}

function getExpirationStatus(expiresAt: string | undefined): {
  isExpired: boolean;
  daysRemaining: number;
  isExpiringSoon: boolean;
} {
  if (!expiresAt) return { isExpired: false, daysRemaining: 30, isExpiringSoon: false };
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  return {
    isExpired: daysRemaining <= 0,
    daysRemaining: Math.max(0, daysRemaining),
    isExpiringSoon: daysRemaining > 0 && daysRemaining <= 7,
  };
}

interface SupportTicket {
  id: string;
  ticketNumber: number;
  characterId: number;
  characterName: string;
  corporationId: number | null;
  corporationName: string | null;
  allianceId: number | null;
  allianceName: string | null;
  subject: string;
  message: string;
  messageEditedAt: string | null;
  category: string;
  priority: string;
  status: string;
  attachments: Attachment[];
  isPro: boolean;
  adminNotes: string | null;
  assignedToAdminId: number | null;
  assignedToAdminName: string | null;
  resolvedAt: string | null;
  resolvedByAdminId: number | null;
  resolvedByAdminName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TicketReply {
  id: string;
  ticketId: string;
  characterId: number;
  characterName: string;
  message: string;
  isAdmin: boolean;
  attachments: Attachment[];
  editedAt: string | null;
  createdAt: string;
}

interface TicketNotification {
  id: number;
  ticketId: string;
  replyId: string | null;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

const ticketSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters").max(200, "Subject is too long"),
  message: z.string().min(20, "Please provide more details (at least 20 characters)").max(5000, "Message is too long"),
  category: z.enum(["bug", "feature", "account", "billing", "other"]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
});

const replySchema = z.object({
  message: z.string().min(5, "Reply must be at least 5 characters").max(5000, "Reply is too long"),
});

type TicketFormData = z.infer<typeof ticketSchema>;
type ReplyFormData = z.infer<typeof replySchema>;

const categoryIcons: Record<string, typeof Bug> = {
  bug: Bug,
  feature: Lightbulb,
  account: User,
  billing: CreditCard,
  other: HelpCircle,
};

const categoryLabels: Record<string, string> = {
  bug: "Bug Report",
  feature: "Feature Request",
  account: "Account Issue",
  billing: "Billing Question",
  other: "Other",
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-blue-500/20 text-blue-500",
  high: "bg-orange-500/20 text-orange-500",
  urgent: "bg-red-500/20 text-red-500",
};

const statusColors: Record<string, string> = {
  open: "bg-yellow-500/20 text-yellow-500",
  in_progress: "bg-blue-500/20 text-blue-500",
  resolved: "bg-green-500/20 text-green-500",
  closed: "bg-muted text-muted-foreground",
};

const statusIcons: Record<string, typeof Clock> = {
  open: Clock,
  in_progress: Loader2,
  resolved: CheckCircle,
  closed: AlertCircle,
};

export default function SupportPage() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState("submit");
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [ticketAttachments, setTicketAttachments] = useState<Attachment[]>([]);
  const [replyAttachments, setReplyAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [editingTicketMessage, setEditingTicketMessage] = useState<string | null>(null);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editTicketText, setEditTicketText] = useState("");
  const [editReplyText, setEditReplyText] = useState("");

  const getUploadParameters = useCallback(async () => {
    const response = await fetch("/api/upload/presigned-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    if (!response.ok) throw new Error("Failed to get upload URL");
    return response.json();
  }, []);

  const handleUploadComplete = useCallback(async (
    result: { successful: { url: string; name: string; size: number; type: string }[] },
    target: "ticket" | "reply"
  ) => {
    const setAttachments = target === "ticket" ? setTicketAttachments : setReplyAttachments;
    
    for (const file of result.successful || []) {
      if (!file.url) continue;
      
      try {
        const response = await fetch("/api/upload/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            uploadURL: file.url,
            filename: file.name,
            size: file.size,
            type: file.type,
          }),
        });
        
        if (response.ok) {
          const attachment = await response.json();
          setAttachments(prev => [...prev, attachment]);
          toast({
            title: "File uploaded",
            description: `${file.name} has been attached`,
          });
        }
      } catch (error) {
        console.error("Failed to register upload:", error);
      }
    }
  }, [toast]);

  const removeAttachment = (url: string, target: "ticket" | "reply") => {
    if (target === "ticket") {
      setTicketAttachments(prev => prev.filter(a => a.url !== url));
    } else {
      setReplyAttachments(prev => prev.filter(a => a.url !== url));
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImageFile = (type: string): boolean => {
    return type.startsWith("image/");
  };

  const { data: tickets, isLoading: ticketsLoading } = useQuery<SupportTicket[]>({
    queryKey: ["/api/support/tickets"],
    enabled: isAuthenticated,
  });

  // Query for unread notifications (only when authenticated)
  const { data: notificationsData } = useQuery<{ notifications: TicketNotification[] }>({
    queryKey: ["/api/support/notifications"],
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: isAuthenticated,
  });

  // Group notifications by ticket ID for quick lookup
  const notificationsByTicket = (notificationsData?.notifications || []).reduce((acc, notif) => {
    if (!acc[notif.ticketId]) acc[notif.ticketId] = [];
    acc[notif.ticketId].push(notif);
    return acc;
  }, {} as Record<string, TicketNotification[]>);

  // Mark notifications as read mutation
  const markNotificationsReadMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      return apiRequest("POST", "/api/support/notifications/mark-all-read", { ticketId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/support/notifications/count"] });
    },
  });

  const { data: ticketDetails, isLoading: detailsLoading } = useQuery<{
    ticket: SupportTicket;
    replies: TicketReply[];
  }>({
    queryKey: ["/api/support/tickets", selectedTicket],
    queryFn: async () => {
      const response = await fetch(`/api/support/tickets/${selectedTicket}`);
      if (!response.ok) throw new Error("Failed to fetch ticket details");
      return response.json();
    },
    enabled: !!selectedTicket,
  });

  // Mark notifications as read when viewing a ticket
  const handleSelectTicket = (ticketId: string) => {
    setSelectedTicket(ticketId);
    // Mark notifications for this ticket as read
    if (notificationsByTicket[ticketId]?.length) {
      markNotificationsReadMutation.mutate(ticketId);
    }
  };

  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      subject: "",
      message: "",
      category: "bug",
      priority: "normal",
    },
  });

  const replyForm = useForm<ReplyFormData>({
    resolver: zodResolver(replySchema),
    defaultValues: {
      message: "",
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: TicketFormData) => {
      return apiRequest("POST", "/api/support/tickets", { ...data, attachments: ticketAttachments });
    },
    onSuccess: () => {
      toast({
        title: "Ticket Submitted",
        description: "Your support ticket has been created. We'll get back to you soon!",
      });
      form.reset();
      setTicketAttachments([]);
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      setActiveTab("history");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create ticket",
        variant: "destructive",
      });
    },
  });

  const createReplyMutation = useMutation({
    mutationFn: async ({ ticketId, message }: { ticketId: string; message: string }) => {
      return apiRequest("POST", `/api/support/tickets/${ticketId}/replies`, { message, attachments: replyAttachments });
    },
    onSuccess: () => {
      toast({
        title: "Reply Sent",
        description: "Your reply has been added to the ticket.",
      });
      replyForm.reset();
      setReplyAttachments([]);
      if (selectedTicket) {
        queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", selectedTicket] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send reply",
        variant: "destructive",
      });
    },
  });

  const editTicketMessageMutation = useMutation({
    mutationFn: async ({ ticketId, message }: { ticketId: string; message: string }) => {
      return apiRequest("PATCH", `/api/support/tickets/${ticketId}/message`, { message });
    },
    onSuccess: () => {
      toast({
        title: "Message Updated",
        description: "Your ticket message has been edited.",
      });
      setEditingTicketMessage(null);
      setEditTicketText("");
      if (selectedTicket) {
        queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", selectedTicket] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update message",
        variant: "destructive",
      });
    },
  });

  const editReplyMutation = useMutation({
    mutationFn: async ({ replyId, message }: { replyId: string; message: string }) => {
      return apiRequest("PATCH", `/api/support/replies/${replyId}`, { message });
    },
    onSuccess: () => {
      toast({
        title: "Reply Updated",
        description: "Your reply has been edited.",
      });
      setEditingReplyId(null);
      setEditReplyText("");
      if (selectedTicket) {
        queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", selectedTicket] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update reply",
        variant: "destructive",
      });
    },
  });

  const onSubmitTicket = (data: TicketFormData) => {
    createTicketMutation.mutate(data);
  };

  const onSubmitReply = (data: ReplyFormData) => {
    if (!selectedTicket) return;
    createReplyMutation.mutate({ ticketId: selectedTicket, message: data.message });
  };

  const renderTicketList = () => {
    if (ticketsLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (!tickets || tickets.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No tickets yet</p>
          <p className="text-sm">Submit a ticket to get help from our team</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {tickets.map((ticket) => {
          const CategoryIcon = categoryIcons[ticket.category] || HelpCircle;
          const StatusIcon = statusIcons[ticket.status] || Clock;
          const unreadCount = notificationsByTicket[ticket.id]?.length || 0;
          
          return (
            <Card
              key={ticket.id}
              className={`cursor-pointer transition-colors hover-elevate ${
                selectedTicket === ticket.id ? "ring-2 ring-primary" : ""
              } ${unreadCount > 0 ? "border-primary/50" : ""}`}
              onClick={() => handleSelectTicket(ticket.id)}
              data-testid={`ticket-card-${ticket.ticketNumber}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="relative">
                      <CategoryIcon className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      {unreadCount > 0 && (
                        <span 
                          className="absolute -top-1 -right-1 min-w-3 h-3 px-0.5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold"
                          data-testid={`badge-ticket-${ticket.ticketNumber}-unread`}
                        >
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground font-mono">
                          #{ticket.ticketNumber}
                        </span>
                        <Badge variant="secondary" className={priorityColors[ticket.priority]}>
                          {ticket.priority}
                        </Badge>
                        <Badge variant="secondary" className={statusColors[ticket.status]}>
                          <StatusIcon className={`h-3 w-3 mr-1 ${ticket.status === 'in_progress' ? 'animate-spin' : ''}`} />
                          {ticket.status.replace("_", " ")}
                        </Badge>
                        {unreadCount > 0 && (
                          <Badge variant="destructive" className="text-[10px]" data-testid={`badge-ticket-${ticket.ticketNumber}-new`}>
                            {unreadCount} new
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-medium mt-1 truncate">{ticket.subject}</h4>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {ticket.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(ticket.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const fadeInOut = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: 0.2, ease: "easeOut" }
  };

  const renderTicketDetails = () => {
    if (!selectedTicket) {
      return (
        <motion.div 
          key="empty"
          {...fadeInOut}
          className="text-center py-8 text-muted-foreground"
        >
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Select a ticket to view details</p>
        </motion.div>
      );
    }

    if (detailsLoading) {
      return (
        <motion.div 
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex items-center justify-center py-8"
        >
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </motion.div>
      );
    }

    if (!ticketDetails) {
      return (
        <motion.div 
          key="error"
          {...fadeInOut}
          className="text-center py-8 text-muted-foreground"
        >
          <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Failed to load ticket details</p>
        </motion.div>
      );
    }

    const { ticket, replies } = ticketDetails;
    const CategoryIcon = categoryIcons[ticket.category] || HelpCircle;
    const StatusIcon = statusIcons[ticket.status] || Clock;
    const canReply = ticket.status !== "closed";

    return (
      <motion.div 
        key={`ticket-${ticket.id}`}
        {...fadeInOut}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedTicket(null)}
            data-testid="button-back-to-list"
          >
            Back to list
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <CategoryIcon className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-mono">
                #{ticket.ticketNumber}
              </span>
              <Badge variant="secondary" className={priorityColors[ticket.priority]}>
                {ticket.priority}
              </Badge>
              <Badge variant="secondary" className={statusColors[ticket.status]}>
                <StatusIcon className={`h-3 w-3 mr-1 ${ticket.status === 'in_progress' ? 'animate-spin' : ''}`} />
                {ticket.status.replace("_", " ")}
              </Badge>
              {ticket.isPro && (
                <Badge variant="secondary" className="bg-primary/20 text-primary">
                  PRO
                </Badge>
              )}
            </div>
            <CardTitle className="text-lg">{ticket.subject}</CardTitle>
            <CardDescription>
              Submitted {format(new Date(ticket.createdAt), "MMMM d, yyyy 'at' h:mm a")}
              {ticket.assignedToAdminName && (
                <> • Assigned to {ticket.assignedToAdminName}</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-md p-4 space-y-3">
              {editingTicketMessage === ticket.id ? (
                <div className="space-y-3">
                  <Textarea
                    value={editTicketText}
                    onChange={(e) => setEditTicketText(e.target.value)}
                    className="min-h-[150px] text-base"
                    data-testid="input-edit-ticket-message"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        editTicketMessageMutation.mutate({ ticketId: ticket.id, message: editTicketText });
                      }}
                      disabled={editTicketMessageMutation.isPending || editTicketText.length < 20}
                      data-testid="button-save-ticket-edit"
                    >
                      {editTicketMessageMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Check className="h-4 w-4 mr-1" />
                      )}
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingTicketMessage(null);
                        setEditTicketText("");
                      }}
                      data-testid="button-cancel-ticket-edit"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="whitespace-pre-wrap text-base flex-1">{ticket.message}</p>
                    {ticket.status !== "closed" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingTicketMessage(ticket.id);
                          setEditTicketText(ticket.message);
                        }}
                        data-testid="button-edit-ticket-message"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {ticket.messageEditedAt && (
                    <span className="text-xs text-muted-foreground italic">
                      (edited {format(new Date(ticket.messageEditedAt), "MMM d, yyyy 'at' h:mm a")})
                    </span>
                  )}
                </div>
              )}
              
              {ticket.attachments && ticket.attachments.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <Paperclip className="h-3 w-3" />
                      Attachments ({ticket.attachments.length})
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Files expire after 30 days - download to save
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ticket.attachments.map((attachment, idx) => {
                      const expStatus = getExpirationStatus(attachment.expiresAt);
                      return (
                        <a
                          key={idx}
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-md bg-background border text-sm hover-elevate"
                          data-testid={`ticket-attachment-${idx}`}
                        >
                          {isImageFile(attachment.type) ? (
                            <Image className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <File className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="truncate max-w-[150px]">{attachment.filename}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatFileSize(attachment.size)}
                          </span>
                          {expStatus.isExpiringSoon && (
                            <Badge variant="secondary" className="text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">
                              {expStatus.daysRemaining}d left
                            </Badge>
                          )}
                          {expStatus.isExpired && (
                            <Badge variant="secondary" className="text-xs bg-red-500/20 text-red-600 dark:text-red-400">
                              Expired
                            </Badge>
                          )}
                          <Download className="h-3 w-3 text-muted-foreground" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {replies.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium">Replies</h4>
            {replies.map((reply) => (
              <Card key={reply.id} className={reply.isAdmin ? "border-primary/30" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">{reply.characterName}</span>
                    {reply.isAdmin && (
                      <Badge variant="secondary" className="bg-primary/20 text-primary">
                        Support Team
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {format(new Date(reply.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                  </div>
                  
                  {editingReplyId === reply.id ? (
                    <div className="space-y-3">
                      <Textarea
                        value={editReplyText}
                        onChange={(e) => setEditReplyText(e.target.value)}
                        className="min-h-[120px] text-base"
                        data-testid="input-edit-reply"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            editReplyMutation.mutate({ replyId: reply.id, message: editReplyText });
                          }}
                          disabled={editReplyMutation.isPending || editReplyText.length < 5}
                          data-testid="button-save-reply-edit"
                        >
                          {editReplyMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <Check className="h-4 w-4 mr-1" />
                          )}
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingReplyId(null);
                            setEditReplyText("");
                          }}
                          data-testid="button-cancel-reply-edit"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="whitespace-pre-wrap text-base flex-1">{reply.message}</p>
                        {ticket.status !== "closed" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditingReplyId(reply.id);
                              setEditReplyText(reply.message);
                            }}
                            data-testid={`button-edit-reply-${reply.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {reply.editedAt && (
                        <span className="text-xs text-muted-foreground italic">
                          (edited {format(new Date(reply.editedAt), "MMM d, yyyy 'at' h:mm a")})
                        </span>
                      )}
                    </div>
                  )}
                  
                  {reply.attachments && reply.attachments.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Paperclip className="h-3 w-3" />
                        Attachments
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {reply.attachments.map((attachment, idx) => {
                          const expStatus = getExpirationStatus(attachment.expiresAt);
                          return (
                            <a
                              key={idx}
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted text-xs hover-elevate"
                              data-testid={`reply-attachment-view-${idx}`}
                            >
                              {isImageFile(attachment.type) ? (
                                <Image className="h-3 w-3 text-muted-foreground" />
                              ) : (
                                <File className="h-3 w-3 text-muted-foreground" />
                              )}
                              <span className="truncate max-w-[120px]">{attachment.filename}</span>
                              {expStatus.isExpiringSoon && (
                                <Badge variant="secondary" className="text-[10px] px-1 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">
                                  {expStatus.daysRemaining}d
                                </Badge>
                              )}
                              {expStatus.isExpired && (
                                <Badge variant="secondary" className="text-[10px] px-1 bg-red-500/20 text-red-600 dark:text-red-400">
                                  Expired
                                </Badge>
                              )}
                              <Download className="h-3 w-3 text-muted-foreground" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {canReply && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Add a Reply</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...replyForm}>
                <form onSubmit={replyForm.handleSubmit(onSubmitReply)} className="space-y-4">
                  <FormField
                    control={replyForm.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="Type your reply..."
                            className="min-h-[140px] text-base"
                            data-testid="input-reply-message"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <ObjectUploader
                        maxNumberOfFiles={5}
                        maxFileSize={10485760}
                        allowedFileTypes={["image/*", ".pdf", ".txt", ".log", ".json"]}
                        onGetUploadParameters={getUploadParameters}
                        onComplete={(result) => handleUploadComplete(result, "reply")}
                        buttonVariant="outline"
                        buttonSize="sm"
                      >
                        <Paperclip className="h-4 w-4 mr-2" />
                        Attach
                      </ObjectUploader>
                      <span className="text-xs text-muted-foreground">
                        Max 10MB per file
                      </span>
                    </div>
                    
                    {replyAttachments.length > 0 && (
                      <div className="space-y-1">
                        {replyAttachments.map((attachment) => (
                          <div
                            key={attachment.url}
                            className="flex items-center gap-2 p-2 rounded-md bg-muted text-sm"
                            data-testid={`reply-attachment-${attachment.filename}`}
                          >
                            {isImageFile(attachment.type) ? (
                              <Image className="h-3 w-3 text-muted-foreground" />
                            ) : (
                              <File className="h-3 w-3 text-muted-foreground" />
                            )}
                            <span className="truncate flex-1">{attachment.filename}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(attachment.size)}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => removeAttachment(attachment.url, "reply")}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={createReplyMutation.isPending}
                    data-testid="button-send-reply"
                  >
                    {createReplyMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Reply
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {!canReply && (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">This ticket is closed and cannot receive new replies.</p>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <PageHeader
        icon={HelpCircle}
        title="Support Center"
        subtitle="Get help with PHOTON - submit bug reports, feature requests, or ask questions"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="submit" data-testid="tab-submit-ticket">
            <Plus className="h-4 w-4 mr-2" />
            Submit Ticket
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-ticket-history">
            <FileText className="h-4 w-4 mr-2" />
            My Tickets
            {tickets && tickets.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {tickets.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="submit">
          <Card>
            <CardHeader>
              <CardTitle>Submit a Support Ticket</CardTitle>
              <CardDescription>
                Describe your issue or request in detail. Our team will respond as soon as possible.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmitTicket)} className="space-y-6">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-category">
                                <SelectValue placeholder="Select a category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(categoryLabels).map(([value, label]) => {
                                const Icon = categoryIcons[value];
                                return (
                                  <SelectItem key={value} value={value}>
                                    <div className="flex items-center gap-2">
                                      <Icon className="h-4 w-4" />
                                      {label}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-priority">
                                <SelectValue placeholder="Select priority" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Please select appropriately - urgent issues should be truly critical
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Brief summary of your issue..."
                            data-testid="input-subject"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Please describe your issue in detail. Include steps to reproduce if reporting a bug, or explain your use case if requesting a feature..."
                            className="min-h-[200px] text-base"
                            data-testid="input-message"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          The more details you provide, the faster we can help you
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <FormLabel>Attachments (optional)</FormLabel>
                      <ObjectUploader
                        maxNumberOfFiles={5}
                        maxFileSize={10485760}
                        allowedFileTypes={["image/*", ".pdf", ".txt", ".log", ".json"]}
                        onGetUploadParameters={getUploadParameters}
                        onComplete={(result) => handleUploadComplete(result, "ticket")}
                        buttonVariant="outline"
                        buttonSize="sm"
                      >
                        <Paperclip className="h-4 w-4 mr-2" />
                        Attach Files
                      </ObjectUploader>
                    </div>
                    <FormDescription>
                      You can attach screenshots, logs, or other files (max 10MB each)
                    </FormDescription>
                    
                    {ticketAttachments.length > 0 && (
                      <div className="space-y-2">
                        {ticketAttachments.map((attachment) => (
                          <div
                            key={attachment.url}
                            className="flex items-center gap-3 p-2 rounded-md bg-muted"
                            data-testid={`attachment-${attachment.filename}`}
                          >
                            {isImageFile(attachment.type) ? (
                              <Image className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                            <span className="text-sm truncate flex-1">{attachment.filename}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(attachment.size)}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeAttachment(attachment.url, "ticket")}
                              data-testid={`button-remove-attachment-${attachment.filename}`}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full sm:w-auto"
                    disabled={createTicketMutation.isPending}
                    data-testid="button-submit-ticket"
                  >
                    {createTicketMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Submit Ticket
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="font-medium mb-4">Your Tickets</h3>
              {renderTicketList()}
            </div>
            <div className="lg:border-l lg:pl-6">
              <h3 className="font-medium mb-4">Ticket Details</h3>
              <AnimatePresence mode="wait">
                {renderTicketDetails()}
              </AnimatePresence>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
