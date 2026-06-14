import { db } from "./db";
import { supportTickets, ticketReplies } from "@shared/schema";
import type { TicketAttachment } from "@shared/schema";

interface RetentionResult {
  ticketsProcessed: number;
  repliesProcessed: number;
  filesDeleted: number;
  errors: string[];
}

export async function cleanupExpiredAttachments(): Promise<RetentionResult> {
  const result: RetentionResult = {
    ticketsProcessed: 0,
    repliesProcessed: 0,
    filesDeleted: 0,
    errors: [],
  };

  const now = new Date();

  try {
    const { ObjectStorageService } = await import("./objectStorage");
    const objectStorageService = new ObjectStorageService();

    const allTickets = await db.select().from(supportTickets);
    
    for (const ticket of allTickets) {
      const attachments = (ticket.attachments as TicketAttachment[]) || [];
      const validAttachments: TicketAttachment[] = [];
      let hasExpired = false;

      for (const attachment of attachments) {
        if (attachment.expiresAt && new Date(attachment.expiresAt) <= now) {
          try {
            await objectStorageService.deleteObject(attachment.url);
            result.filesDeleted++;
            hasExpired = true;
          } catch (error: any) {
            result.errors.push(`Failed to delete ${attachment.filename}: ${error.message}`);
            validAttachments.push(attachment);
          }
        } else {
          validAttachments.push(attachment);
        }
      }

      if (hasExpired) {
        await db.update(supportTickets)
          .set({ attachments: validAttachments })
          .where(require("drizzle-orm").eq(supportTickets.id, ticket.id));
        result.ticketsProcessed++;
      }
    }

    const allReplies = await db.select().from(ticketReplies);
    
    for (const reply of allReplies) {
      const attachments = (reply.attachments as TicketAttachment[]) || [];
      const validAttachments: TicketAttachment[] = [];
      let hasExpired = false;

      for (const attachment of attachments) {
        if (attachment.expiresAt && new Date(attachment.expiresAt) <= now) {
          try {
            await objectStorageService.deleteObject(attachment.url);
            result.filesDeleted++;
            hasExpired = true;
          } catch (error: any) {
            result.errors.push(`Failed to delete ${attachment.filename}: ${error.message}`);
            validAttachments.push(attachment);
          }
        } else {
          validAttachments.push(attachment);
        }
      }

      if (hasExpired) {
        await db.update(ticketReplies)
          .set({ attachments: validAttachments })
          .where(require("drizzle-orm").eq(ticketReplies.id, reply.id));
        result.repliesProcessed++;
      }
    }
  } catch (error: any) {
    result.errors.push(`Cleanup failed: ${error.message}`);
  }

  return result;
}

export function getExpirationStatus(expiresAt: string): {
  isExpired: boolean;
  daysRemaining: number;
  isExpiringSoon: boolean;
} {
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
