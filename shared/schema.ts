import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, bigint, boolean, timestamp, real, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// User preferences including theme
export const userPreferences = pgTable("user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull().unique(),
  characterName: text("character_name").notNull(),
  theme: text("theme").notNull().default("default"), // default, amarr, caldari, gallente, minmatar
  lastSeenPatchVersion: text("last_seen_patch_version"),
  corpTaxRate: real("corp_tax_rate").notNull().default(0), // Corp tax percentage (0-100)
  firstLoginAt: timestamp("first_login_at").defaultNow().notNull(), // Member since date
  emailNotifications: boolean("email_notifications").notNull().default(true),
  proExpiryReminders: boolean("pro_expiry_reminders").notNull().default(true),
  supportTicketUpdates: boolean("support_ticket_updates").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Special badges (admin-granted, non-earnable through gameplay)
export const specialBadges = pgTable("special_badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull(),
  characterName: text("character_name").notNull(),
  badgeType: text("badge_type").notNull(), // early_backer, donator, founder, beta_tester, supporter
  grantedByAdminId: integer("granted_by_admin_id").notNull(),
  grantedByAdminName: text("granted_by_admin_name").notNull(),
  note: text("note"), // Optional admin note
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
});

// Ratting sessions with ship and system tracking
export const rattingSessions = pgTable("ratting_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull(),
  characterName: text("character_name").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  totalIsk: real("total_isk").notNull().default(0),
  bountyIsk: real("bounty_isk").notNull().default(0),
  lootIsk: real("loot_isk").notNull().default(0),
  killCount: integer("kill_count").notNull().default(0),
  shipTypeId: integer("ship_type_id"),
  shipTypeName: text("ship_type_name"),
  systemId: integer("system_id"),
  systemName: text("system_name"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Favorite ships per user
export const favoriteShips = pgTable("favorite_ships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull(),
  shipTypeId: integer("ship_type_id").notNull(),
  shipTypeName: text("ship_type_name").notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

// PLEX and ISK goals
export const userGoals = pgTable("user_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull(),
  goalType: text("goal_type").notNull(), // plex, isk, ship
  targetAmount: real("target_amount").notNull(),
  currentAmount: real("current_amount").notNull().default(0),
  targetItemId: integer("target_item_id"), // For ship/item goals
  targetItemName: text("target_item_name"),
  deadline: timestamp("deadline"),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Leaderboards
export const leaderboards = pgTable("leaderboards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  creatorCharacterId: integer("creator_character_id").notNull(),
  creatorCharacterName: text("creator_character_name").notNull(),
  isPublic: boolean("is_public").notNull().default(false),
  rankBy: text("rank_by").notNull().default("total_isk"), // total_isk, isk_per_hour, sessions
  timeFrame: text("time_frame").notNull().default("all_time"), // daily, weekly, monthly, all_time
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Leaderboard members
export const leaderboardMembers = pgTable("leaderboard_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leaderboardId: varchar("leaderboard_id").notNull(),
  characterId: integer("character_id").notNull(),
  characterName: text("character_name").notNull(),
  status: text("status").notNull().default("pending"), // pending, accepted, declined
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
});

// Loot entries
export const lootEntries = pgTable("loot_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  characterId: integer("character_id").notNull(),
  itemTypeId: integer("item_type_id").notNull(),
  itemTypeName: text("item_type_name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  estimatedPrice: real("estimated_price").notNull().default(0), // Per unit
  totalValue: real("total_value").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Cached item prices from Jita
export const itemPrices = pgTable("item_prices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  typeId: integer("type_id").notNull().unique(),
  typeName: text("type_name").notNull(),
  jitaSellPrice: real("jita_sell_price"),
  jitaBuyPrice: real("jita_buy_price"),
  averagePrice: real("average_price"),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

// Patch notes
export const patchNotes = pgTable("patch_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  version: text("version").notNull().unique(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  releaseDate: timestamp("release_date").defaultNow().notNull(),
  isPublished: boolean("is_published").notNull().default(false),
});

// Achievements/Badges
export const achievements = pgTable("achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(), // Icon name from lucide
  category: text("category").notNull(), // isk, sessions, kills, ships, milestones
  requirement: real("requirement").notNull(), // Numeric threshold
  rarity: text("rarity").notNull().default("common"), // common, uncommon, rare, epic, legendary
  isSecret: boolean("is_secret").notNull().default(false),
});

// User achievements
export const userAchievements = pgTable("user_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull(),
  achievementId: varchar("achievement_id").notNull(),
  earnedAt: timestamp("earned_at").defaultNow().notNull(),
  progress: real("progress").notNull().default(0),
});

// Corporation integration
export const corporations = pgTable("corporations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  corporationId: integer("corporation_id").notNull().unique(),
  corporationName: text("corporation_name").notNull(),
  isOptedIn: boolean("is_opted_in").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Corporation members who opted in
export const corpMembers = pgTable("corp_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  corporationId: integer("corporation_id").notNull(),
  characterId: integer("character_id").notNull(),
  characterName: text("character_name").notNull(),
  isOptedIn: boolean("is_opted_in").notNull().default(true),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

// Shareable session cards
export const sessionCards = pgTable("session_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  characterId: integer("character_id").notNull(),
  shareCode: text("share_code").notNull().unique(),
  cardData: jsonb("card_data").notNull(), // Snapshot of session data for the card
  expiresAt: timestamp("expires_at"),
  viewCount: integer("view_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// PRO Subscriptions - persisted per character
export const proSubscriptions = pgTable("pro_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull().unique(),
  characterName: text("character_name").notNull(),
  status: text("status").notNull().default("pending"), // active, expired, pending, revoked
  expiresAt: timestamp("expires_at"),
  activatedAt: timestamp("activated_at"),
  activationCode: text("activation_code"),
  giftedBy: integer("gifted_by"), // Admin character ID who gifted
  giftedAt: timestamp("gifted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// PRO Activation Codes
export const proActivationCodes = pgTable("pro_activation_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  characterId: integer("character_id").notNull(),
  characterName: text("character_name").notNull(),
  iskAmount: real("isk_amount").notNull().default(0),
  status: text("status").notNull().default("pending"), // pending, used, expired
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  isGiftCode: boolean("is_gift_code").notNull().default(false),
  giftDurationDays: integer("gift_duration_days"),
  giftNote: text("gift_note"),
  createdByAdminId: integer("created_by_admin_id"),
  createdByAdminName: text("created_by_admin_name"),
  redeemedByCharacterId: integer("redeemed_by_character_id"),
  redeemedByCharacterName: text("redeemed_by_character_name"),
  giftBadgeType: text("gift_badge_type"),
  giftThemeUnlock: text("gift_theme_unlock"),
  giftBonusTiles: jsonb("gift_bonus_tiles"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// PRO Gifts - track admin direct gifts
export const proGifts = pgTable("pro_gifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referenceCode: text("reference_code").notNull().unique(),
  recipientCharacterId: integer("recipient_character_id").notNull(),
  recipientCharacterName: text("recipient_character_name").notNull(),
  giftedByCharacterId: integer("gifted_by_character_id").notNull(),
  giftedByCharacterName: text("gifted_by_character_name").notNull(),
  durationDays: integer("duration_days").notNull(),
  note: text("note"),
  giftedAt: timestamp("gifted_at").defaultNow().notNull(),
});

// Dynamic Admins - track admins added by super admins
export const dynamicAdmins = pgTable("dynamic_admins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull().unique(),
  characterName: text("character_name").notNull(),
  addedByCharacterId: integer("added_by_character_id").notNull(),
  addedByCharacterName: text("added_by_character_name").notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

// PRO Subscription Notification Emails - emails to notify when new subscriptions occur
export const proNotificationEmails = pgTable("pro_notification_emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  addedByCharacterId: integer("added_by_character_id").notNull(),
  addedByCharacterName: text("added_by_character_name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

// Processed wallet transactions (to avoid duplicates)
export const processedTransactions = pgTable("processed_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: integer("transaction_id").notNull().unique(),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
});

// User unlocks (themes, tiles from gift codes)
export const userUnlocks = pgTable("user_unlocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull().unique(),
  unlockedThemes: jsonb("unlocked_themes").notNull().default([]),
  unlockedTiles: jsonb("unlocked_tiles").notNull().default([]),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// PHOTON Activation Codes - new format PHOTON-XXXX-XXXX-XXXX
export const photonActivationCodes = pgTable("photon_activation_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(), // Format: PHOTON-XXXX-XXXX-XXXX
  codeType: text("code_type").notNull().default("pro_subscription"), // pro_subscription, theme_unlock, badge_grant, tile_unlock, bundle
  createdByAdminId: integer("created_by_admin_id").notNull(),
  createdByAdminName: text("created_by_admin_name").notNull(),
  status: text("status").notNull().default("active"), // active, redeemed, expired, revoked
  maxRedemptions: integer("max_redemptions").notNull().default(1), // 1 for single-use, 0 for unlimited
  currentRedemptions: integer("current_redemptions").notNull().default(0),
  expiresAt: timestamp("expires_at"),
  proDurationDays: integer("pro_duration_days"), // For pro_subscription type
  badgeGrants: jsonb("badge_grants").default([]), // Array of badge types to grant
  themeUnlocks: jsonb("theme_unlocks").default([]), // Array of theme keys to unlock
  tileUnlocks: jsonb("tile_unlocks").default([]), // Array of tile IDs to unlock
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// PHOTON Code Redemptions - track who redeemed what codes
export const photonCodeRedemptions = pgTable("photon_code_redemptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  codeId: varchar("code_id").notNull(),
  code: text("code").notNull(),
  characterId: integer("character_id").notNull(),
  characterName: text("character_name").notNull(),
  redeemedAt: timestamp("redeemed_at").defaultNow().notNull(),
});

// PHOTON Code Activity Log - comprehensive audit trail
export const photonCodeActivityLog = pgTable("photon_code_activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  codeId: varchar("code_id"),
  code: text("code").notNull(),
  action: text("action").notNull(), // created, redeemed, expired, revoked
  actorCharacterId: integer("actor_character_id").notNull(),
  actorCharacterName: text("actor_character_name").notNull(),
  targetCharacterId: integer("target_character_id"),
  targetCharacterName: text("target_character_name"),
  details: jsonb("details").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Support Tickets - user bug reports and support requests
export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketNumber: integer("ticket_number").notNull().unique(), // Sequential ticket number for easy reference
  characterId: integer("character_id").notNull(),
  characterName: text("character_name").notNull(),
  corporationId: integer("corporation_id"),
  corporationName: text("corporation_name"),
  allianceId: integer("alliance_id"),
  allianceName: text("alliance_name"),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  messageEditedAt: timestamp("message_edited_at"), // When initial message was last edited
  category: text("category").notNull().default("bug"), // bug, feature, account, billing, other
  priority: text("priority").notNull().default("normal"), // low, normal, high, urgent
  status: text("status").notNull().default("open"), // open, in_progress, resolved, closed
  attachments: jsonb("attachments").default([]), // Array of {filename, url, size, type}
  isPro: boolean("is_pro").notNull().default(false), // Was user PRO when submitting
  adminNotes: text("admin_notes"), // Internal notes for admins
  assignedToAdminId: integer("assigned_to_admin_id"),
  assignedToAdminName: text("assigned_to_admin_name"),
  resolvedAt: timestamp("resolved_at"),
  resolvedByAdminId: integer("resolved_by_admin_id"),
  resolvedByAdminName: text("resolved_by_admin_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Ticket Replies - responses from admins or users
export const ticketReplies = pgTable("ticket_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull(),
  characterId: integer("character_id").notNull(),
  characterName: text("character_name").notNull(),
  message: text("message").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  attachments: jsonb("attachments").default([]), // Array of {filename, url, size, type}
  editedAt: timestamp("edited_at"), // When message was last edited (null = never edited)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Support Ticket Notifications - tracks unread replies for users and admins
export const ticketNotifications = pgTable("ticket_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull(),
  replyId: varchar("reply_id"), // Optional - if notification is for a specific reply
  recipientCharacterId: integer("recipient_character_id").notNull(), // Who should see this notification
  type: text("type").notNull(), // new_reply, status_change, assigned
  isRead: boolean("is_read").notNull().default(false),
  message: text("message").notNull(), // Brief notification text
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Admin Notes - notes left by admins on user profiles
export const adminNotes = pgTable("admin_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  targetCharacterId: integer("target_character_id").notNull(), // Who the note is about
  targetCharacterName: text("target_character_name").notNull(),
  authorCharacterId: integer("author_character_id").notNull(), // Who wrote the note
  authorCharacterName: text("author_character_name").notNull(),
  content: text("content").notNull(),
  isPinned: boolean("is_pinned").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User Suspensions - temporary or permanent suspensions
export const userSuspensions = pgTable("user_suspensions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull(),
  characterName: text("character_name").notNull(),
  suspendedByAdminId: integer("suspended_by_admin_id").notNull(),
  suspendedByAdminName: text("suspended_by_admin_name").notNull(),
  reason: text("reason").notNull(),
  expiresAt: timestamp("expires_at"), // null for permanent suspensions
  liftedAt: timestamp("lifted_at"), // When the suspension was lifted early
  liftedByAdminId: integer("lifted_by_admin_id"),
  liftedByAdminName: text("lifted_by_admin_name"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Admin Audit Log - tracks ALL admin actions for accountability
export const adminAuditLog = pgTable("admin_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminCharacterId: integer("admin_character_id").notNull(),
  adminCharacterName: text("admin_character_name").notNull(),
  action: text("action").notNull(), // gift_pro, revoke_pro, suspend_user, lift_suspension, promote_admin, demote_admin, add_note, etc.
  targetCharacterId: integer("target_character_id"), // Who was affected (optional for some actions)
  targetCharacterName: text("target_character_name"),
  details: jsonb("details").default({}), // Additional context as JSON
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Comprehensive Badge Definitions - with Lucide icons and rarity colors
export const badges = pgTable("badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  badgeKey: text("badge_key").notNull().unique(), // e.g., "founder", "early_backer"
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(), // Lucide React icon name
  rarity: text("rarity").notNull().default("uncommon"), // legendary, epic, rare, uncommon
  category: text("category").notNull().default("general"), // achievement, special, event, community
  colorGradient: text("color_gradient").notNull(), // e.g., "from-amber-400 to-orange-500"
  isAdminOnly: boolean("is_admin_only").notNull().default(false), // Can only be granted by admin
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User Badges - track which badges each user has
export const userBadges = pgTable("user_badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull(),
  characterName: text("character_name").notNull(),
  badgeId: varchar("badge_id").notNull(),
  badgeKey: text("badge_key").notNull(),
  grantedByAdminId: integer("granted_by_admin_id"),
  grantedByAdminName: text("granted_by_admin_name"),
  grantedViaCode: text("granted_via_code"), // PHOTON code if granted via code
  grantReason: text("grant_reason"),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
});

// Badge Activity Log - audit trail for badge grants/revokes
export const badgeActivityLog = pgTable("badge_activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  badgeId: varchar("badge_id"),
  badgeKey: text("badge_key").notNull(),
  action: text("action").notNull(), // granted, revoked
  actorCharacterId: integer("actor_character_id").notNull(),
  actorCharacterName: text("actor_character_name").notNull(),
  targetCharacterId: integer("target_character_id").notNull(),
  targetCharacterName: text("target_character_name").notNull(),
  reason: text("reason"),
  details: jsonb("details").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Pending ISK payments for PRO subscriptions
export const pendingPayments = pgTable("pending_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referenceCode: text("reference_code").notNull().unique(),
  characterId: integer("character_id").notNull(),
  characterName: text("character_name").notNull(),
  planType: text("plan_type").notNull(), // weekly, monthly
  iskAmount: real("isk_amount").notNull(),
  status: text("status").notNull().default("pending"), // pending, completed, expired, cancelled
  expiresAt: timestamp("expires_at").notNull(),
  completedAt: timestamp("completed_at"),
  transactionId: integer("transaction_id"), // ESI wallet transaction ID that fulfilled this
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Insert schemas for new tables
export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({ id: true, createdAt: true, updatedAt: true, firstLoginAt: true });
export const insertSpecialBadgeSchema = createInsertSchema(specialBadges).omit({ id: true, grantedAt: true });
export const insertRattingSessionSchema = createInsertSchema(rattingSessions).omit({ id: true, createdAt: true });
export const insertFavoriteShipSchema = createInsertSchema(favoriteShips).omit({ id: true, addedAt: true });
export const insertUserGoalSchema = createInsertSchema(userGoals).omit({ id: true, createdAt: true });
export const insertLeaderboardSchema = createInsertSchema(leaderboards).omit({ id: true, createdAt: true });
export const insertLeaderboardMemberSchema = createInsertSchema(leaderboardMembers).omit({ id: true, invitedAt: true });
export const insertLootEntrySchema = createInsertSchema(lootEntries).omit({ id: true, createdAt: true });
export const insertItemPriceSchema = createInsertSchema(itemPrices).omit({ id: true, lastUpdated: true });
export const insertPatchNoteSchema = createInsertSchema(patchNotes).omit({ id: true, releaseDate: true });
export const insertAchievementSchema = createInsertSchema(achievements).omit({ id: true });
export const insertUserAchievementSchema = createInsertSchema(userAchievements).omit({ id: true, earnedAt: true });
export const insertCorporationSchema = createInsertSchema(corporations).omit({ id: true, createdAt: true });
export const insertCorpMemberSchema = createInsertSchema(corpMembers).omit({ id: true, joinedAt: true });
export const insertSessionCardSchema = createInsertSchema(sessionCards).omit({ id: true, createdAt: true });
export const insertPendingPaymentSchema = createInsertSchema(pendingPayments).omit({ id: true, createdAt: true, completedAt: true });
export const insertPhotonActivationCodeSchema = createInsertSchema(photonActivationCodes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPhotonCodeRedemptionSchema = createInsertSchema(photonCodeRedemptions).omit({ id: true, redeemedAt: true });
export const insertPhotonCodeActivityLogSchema = createInsertSchema(photonCodeActivityLog).omit({ id: true, createdAt: true });
export const insertBadgeSchema = createInsertSchema(badges).omit({ id: true, createdAt: true });
export const insertUserBadgeSchema = createInsertSchema(userBadges).omit({ id: true, grantedAt: true });
export const insertBadgeActivityLogSchema = createInsertSchema(badgeActivityLog).omit({ id: true, createdAt: true });
export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({ id: true, ticketNumber: true, createdAt: true, updatedAt: true, resolvedAt: true });
export const insertTicketReplySchema = createInsertSchema(ticketReplies).omit({ id: true, createdAt: true });
export const insertTicketNotificationSchema = createInsertSchema(ticketNotifications).omit({ id: true, createdAt: true });
export const insertAdminNoteSchema = createInsertSchema(adminNotes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserSuspensionSchema = createInsertSchema(userSuspensions).omit({ id: true, createdAt: true, liftedAt: true });
export const insertAdminAuditLogSchema = createInsertSchema(adminAuditLog).omit({ id: true, createdAt: true });

// Types for new tables
export type UserPreferences = typeof userPreferences.$inferSelect;
export type SpecialBadge = typeof specialBadges.$inferSelect;
export type RattingSession = typeof rattingSessions.$inferSelect;
export type FavoriteShip = typeof favoriteShips.$inferSelect;
export type UserGoal = typeof userGoals.$inferSelect;
export type Leaderboard = typeof leaderboards.$inferSelect;
export type LeaderboardMember = typeof leaderboardMembers.$inferSelect;
export type LootEntry = typeof lootEntries.$inferSelect;
export type ItemPrice = typeof itemPrices.$inferSelect;
export type PatchNote = typeof patchNotes.$inferSelect;
export type Achievement = typeof achievements.$inferSelect;
export type UserAchievement = typeof userAchievements.$inferSelect;
export type Corporation = typeof corporations.$inferSelect;
export type CorpMember = typeof corpMembers.$inferSelect;
export type SessionCard = typeof sessionCards.$inferSelect;
export type PendingPayment = typeof pendingPayments.$inferSelect;
export type PhotonActivationCode = typeof photonActivationCodes.$inferSelect;
export type PhotonCodeRedemption = typeof photonCodeRedemptions.$inferSelect;
export type PhotonCodeActivityLog = typeof photonCodeActivityLog.$inferSelect;
export type Badge = typeof badges.$inferSelect;
export type UserBadge = typeof userBadges.$inferSelect;
export type BadgeActivityLog = typeof badgeActivityLog.$inferSelect;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type TicketReply = typeof ticketReplies.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type InsertTicketReply = z.infer<typeof insertTicketReplySchema>;
export type TicketNotification = typeof ticketNotifications.$inferSelect;
export type InsertTicketNotification = z.infer<typeof insertTicketNotificationSchema>;
export type AdminNote = typeof adminNotes.$inferSelect;
export type InsertAdminNote = z.infer<typeof insertAdminNoteSchema>;
export type UserSuspension = typeof userSuspensions.$inferSelect;
export type InsertUserSuspension = z.infer<typeof insertUserSuspensionSchema>;
export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type InsertAdminAuditLog = z.infer<typeof insertAdminAuditLogSchema>;

// Ticket attachment type
export interface TicketAttachment {
  filename: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: string; // ISO date string
  expiresAt: string; // ISO date string - 30 days from upload
}

// File retention constants
export const FILE_RETENTION_DAYS = 30;

// Ticket status and priority constants
export const TICKET_STATUSES = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
} as const;

export const TICKET_PRIORITIES = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
} as const;

export const TICKET_CATEGORIES = {
  bug: "Bug Report",
  feature: "Feature Request",
  account: "Account Issue",
  billing: "Billing",
  other: "Other",
} as const;

export type TicketStatus = keyof typeof TICKET_STATUSES;
export type TicketPriority = keyof typeof TICKET_PRIORITIES;
export type TicketCategory = keyof typeof TICKET_CATEGORIES;

// Admin Audit Log Action Types
export const ADMIN_AUDIT_ACTIONS = {
  // PRO subscription actions
  gift_pro: { label: "Gift PRO", color: "text-green-400", bgColor: "bg-green-500/10" },
  extend_pro: { label: "Extend PRO", color: "text-green-400", bgColor: "bg-green-500/10" },
  revoke_pro: { label: "Revoke PRO", color: "text-red-400", bgColor: "bg-red-500/10" },
  // Badge actions
  grant_badge: { label: "Grant Badge", color: "text-green-400", bgColor: "bg-green-500/10" },
  revoke_badge: { label: "Revoke Badge", color: "text-red-400", bgColor: "bg-red-500/10" },
  // Admin actions
  promote_admin: { label: "Promote Admin", color: "text-orange-400", bgColor: "bg-orange-500/10" },
  demote_admin: { label: "Demote Admin", color: "text-orange-400", bgColor: "bg-orange-500/10" },
  // Suspension actions
  suspend_user: { label: "Suspend User", color: "text-red-400", bgColor: "bg-red-500/10" },
  lift_suspension: { label: "Lift Suspension", color: "text-green-400", bgColor: "bg-green-500/10" },
  // Note actions
  add_note: { label: "Add Note", color: "text-blue-400", bgColor: "bg-blue-500/10" },
  edit_note: { label: "Edit Note", color: "text-blue-400", bgColor: "bg-blue-500/10" },
  delete_note: { label: "Delete Note", color: "text-red-400", bgColor: "bg-red-500/10" },
  pin_note: { label: "Pin Note", color: "text-blue-400", bgColor: "bg-blue-500/10" },
  // Code actions
  generate_code: { label: "Generate Code", color: "text-purple-400", bgColor: "bg-purple-500/10" },
  revoke_code: { label: "Revoke Code", color: "text-red-400", bgColor: "bg-red-500/10" },
  // Ticket actions
  assign_ticket: { label: "Assign Ticket", color: "text-blue-400", bgColor: "bg-blue-500/10" },
  resolve_ticket: { label: "Resolve Ticket", color: "text-green-400", bgColor: "bg-green-500/10" },
  close_ticket: { label: "Close Ticket", color: "text-gray-400", bgColor: "bg-gray-500/10" },
  // Other
  update_settings: { label: "Update Settings", color: "text-gray-400", bgColor: "bg-gray-500/10" },
} as const;

export type AdminAuditAction = keyof typeof ADMIN_AUDIT_ACTIONS;

// Rarity color constants for badges
export const BADGE_RARITY_COLORS = {
  legendary: { gradient: "from-amber-300 via-yellow-400 to-amber-500", text: "text-amber-400", border: "border-amber-500" },
  epic: { gradient: "from-purple-400 via-violet-500 to-purple-600", text: "text-purple-400", border: "border-purple-500" },
  rare: { gradient: "from-blue-400 via-cyan-500 to-blue-600", text: "text-blue-400", border: "border-blue-500" },
  uncommon: { gradient: "from-green-400 via-emerald-500 to-green-600", text: "text-green-400", border: "border-green-500" },
} as const;

export type BadgeRarity = keyof typeof BADGE_RARITY_COLORS;

// Theme definitions for EVE races
export const EVE_THEMES = {
  default: {
    name: "Default",
    description: "Classic EVE dark theme",
    colors: {
      primary: "200 100% 50%", // Cyan
      accent: "200 100% 40%",
    }
  },
  amarr: {
    name: "Amarr Empire",
    description: "Golden imperial theme",
    colors: {
      primary: "45 100% 50%", // Gold
      accent: "35 80% 45%",
    }
  },
  caldari: {
    name: "Caldari State",
    description: "Cool blue corporate theme",
    colors: {
      primary: "210 80% 55%", // Steel blue
      accent: "200 60% 40%",
    }
  },
  gallente: {
    name: "Gallente Federation",
    description: "Green democratic theme",
    colors: {
      primary: "150 70% 45%", // Teal green
      accent: "160 60% 35%",
    }
  },
  minmatar: {
    name: "Minmatar Republic",
    description: "Rust and red tribal theme",
    colors: {
      primary: "15 80% 50%", // Rust/Orange-red
      accent: "5 70% 40%",
    }
  }
} as const;

export type EveTheme = keyof typeof EVE_THEMES;

// PRO Subscription types (in-memory, not database tables yet)
export interface ProSubscription {
  characterId: number;
  characterName: string;
  status: "active" | "expired" | "pending" | "revoked";
  expiresAt: Date | null;
  activatedAt: Date | null;
  activationCode: string | null;
  giftedBy: number | null; // Admin character ID who gifted
  giftedAt: Date | null;
}

export interface ProActivationCode {
  code: string;
  characterId: number;
  characterName: string;
  createdAt: Date;
  expiresAt: Date;
  iskAmount: number;
  status: "pending" | "used" | "expired";
  usedAt: Date | null;
  // Gift code fields (optional - for admin-generated redeemable codes)
  isGiftCode?: boolean;
  giftDurationDays?: number;
  giftNote?: string;
  createdByAdminId?: number;
  createdByAdminName?: string;
  redeemedByCharacterId?: number;
  redeemedByCharacterName?: string;
  // Enhanced gift code parameters
  giftBadgeType?: SpecialBadgeType;
  giftThemeUnlock?: FactionTheme;
  giftBonusTiles?: BonusTile[];
}

export interface ProGift {
  id: string;
  referenceCode: string; // Unique tracking code like GIFT-XXXX-XXXX
  recipientCharacterId: number;
  recipientCharacterName: string;
  giftedByCharacterId: number;
  giftedByCharacterName: string;
  durationDays: number;
  note: string | null;
  giftedAt: Date;
}

// PRO Feature definitions
export const PRO_FEATURES = {
  UNLIMITED_SESSION_HISTORY: "unlimited_session_history",
  ADVANCED_ANALYTICS: "advanced_analytics",
  CUSTOM_DASHBOARD_LAYOUTS: "custom_dashboard_layouts",
  EXPORT_ALL_DATA: "export_all_data",
  WALLET_AUTO_SYNC: "wallet_auto_sync",
  PRIORITY_SUPPORT: "priority_support",
} as const;

export type ProFeature = typeof PRO_FEATURES[keyof typeof PRO_FEATURES];

// Standard tier limits
export const STANDARD_LIMITS = {
  maxSessionHistory: 10,
  maxExportDays: 7,
} as const;

// PRO pricing in ISK
export const PRO_PRICING = {
  weeklyIsk: 50000000, // 50 million ISK per week
  monthlyIsk: 150000000, // 150 million ISK per month (25% discount)
  recipientCharacterName: "Neveth Yuliyandi", // Character to send ISK to
} as const;

// Special badge definitions (admin-granted only)
export const SPECIAL_BADGE_TYPES = {
  // Original badges
  early_backer: {
    name: "Early Backer",
    description: "Supported PHOTON from the beginning",
    icon: "Rocket",
    color: "from-amber-400 to-orange-500",
    rarity: "legendary",
  },
  founder: {
    name: "Founder",
    description: "One of the founding members of PHOTON",
    icon: "Crown",
    color: "from-purple-400 to-pink-500",
    rarity: "legendary",
  },
  donator: {
    name: "Donator",
    description: "Generously donated to support development",
    icon: "Heart",
    color: "from-red-400 to-rose-500",
    rarity: "epic",
  },
  beta_tester: {
    name: "Beta Tester",
    description: "Helped test and improve PHOTON",
    icon: "FlaskConical",
    color: "from-cyan-400 to-blue-500",
    rarity: "rare",
  },
  supporter: {
    name: "Supporter",
    description: "A valued supporter of the community",
    icon: "Star",
    color: "from-yellow-400 to-amber-500",
    rarity: "uncommon",
  },
  // New badges for gift codes
  vip: {
    name: "VIP",
    description: "Very Important Pilot - Special recognition",
    icon: "Gem",
    color: "from-yellow-300 to-amber-600",
    rarity: "legendary",
  },
  content_creator: {
    name: "Content Creator",
    description: "Creates amazing EVE content for the community",
    icon: "Video",
    color: "from-violet-400 to-purple-600",
    rarity: "epic",
  },
  corp_leader: {
    name: "Corp Leader",
    description: "Leads their corporation with distinction",
    icon: "Building2",
    color: "from-slate-400 to-zinc-600",
    rarity: "epic",
  },
  fleet_commander: {
    name: "Fleet Commander",
    description: "Commands fleets into battle",
    icon: "ChevronsUp",
    color: "from-red-500 to-orange-600",
    rarity: "rare",
  },
  ratting_elite: {
    name: "Ratting Elite",
    description: "Top-tier ratting performance",
    icon: "Trophy",
    color: "from-emerald-400 to-green-600",
    rarity: "rare",
  },
  community_helper: {
    name: "Community Helper",
    description: "Helps fellow pilots in the community",
    icon: "HandHelping",
    color: "from-teal-400 to-cyan-600",
    rarity: "uncommon",
  },
  event_winner: {
    name: "Event Winner",
    description: "Won a PHOTON event or competition",
    icon: "Award",
    color: "from-amber-400 to-yellow-600",
    rarity: "epic",
  },
  alliance_member: {
    name: "Alliance Member",
    description: "Member of a partner alliance",
    icon: "Flag",
    color: "from-blue-400 to-indigo-600",
    rarity: "uncommon",
  },
} as const;

// Theme types for gift code unlocks - 15 total themes
// 7 Free themes: Default (PHOTON), Caldari, Amarr, Gallente, Minmatar, CONCORD, SCOPE
// 8 PRO-exclusive themes: Triglavian, Guristas, Angel Cartel, Blood Raiders, Jove, Sleepers/Drifters, Sisters of EVE, ORE
// Note: Light/Dark mode is controlled separately via Theme Mode toggle
export const FACTION_THEMES = {
  // Free themes (available to all users)
  default: {
    name: "Default (PHOTON)",
    description: "Standard PHOTON interface with cyan accents",
    isPro: false,
    primaryColor: "#00d4ff",
    accentColor: "#0ea5e9",
  },
  caldari: {
    name: "Caldari State",
    description: "Gunmetal gray with red engine accents",
    isPro: false,
    primaryColor: "#dc2626",
    accentColor: "#ef4444",
  },
  amarr: {
    name: "Amarr Empire",
    description: "Imperial gold and divine bronze",
    isPro: false,
    primaryColor: "#d97706",
    accentColor: "#b45309",
  },
  gallente: {
    name: "Gallente Federation",
    description: "Verdigris and bronze patina",
    isPro: false,
    primaryColor: "#0d9488",
    accentColor: "#14b8a6",
  },
  minmatar: {
    name: "Minmatar Republic",
    description: "Tribal rust and industrial orange",
    isPro: false,
    primaryColor: "#ea580c",
    accentColor: "#f97316",
  },
  concord: {
    name: "CONCORD",
    description: "Navy blue and gold authority",
    isPro: false,
    primaryColor: "#eab308",
    accentColor: "#fbbf24",
  },
  scope: {
    name: "SCOPE Network",
    description: "Breaking news red and white broadcast",
    isPro: false,
    primaryColor: "#dc2626",
    accentColor: "#ef4444",
  },
  // PRO-exclusive themes
  triglavian: {
    name: "Triglavian Collective",
    description: "Deep crimson abyssal tech",
    isPro: true,
    primaryColor: "#dc2626",
    accentColor: "#991b1b",
  },
  guristas: {
    name: "Guristas Pirates",
    description: "Pitch black and neon teal",
    isPro: true,
    primaryColor: "#14b8a6",
    accentColor: "#0d9488",
  },
  angel: {
    name: "Angel Cartel",
    description: "Fiery orange and chrome speed",
    isPro: true,
    primaryColor: "#f97316",
    accentColor: "#ea580c",
  },
  blood: {
    name: "Blood Raiders",
    description: "Wine red and dark burgundy cult",
    isPro: true,
    primaryColor: "#b91c1c",
    accentColor: "#7f1d1d",
  },
  jove: {
    name: "Jove Empire",
    description: "Alien blue-green enigma",
    isPro: true,
    primaryColor: "#0891b2",
    accentColor: "#0d9488",
  },
  sleepers: {
    name: "Sleepers / Drifters",
    description: "Electric cyan ancient power",
    isPro: true,
    primaryColor: "#06b6d4",
    accentColor: "#0891b2",
  },
  sisters: {
    name: "Sisters of EVE",
    description: "White and red humanitarian",
    isPro: true,
    primaryColor: "#e11d48",
    accentColor: "#be123c",
  },
  ore: {
    name: "ORE",
    description: "Bright industrial yellow mining",
    isPro: true,
    primaryColor: "#eab308",
    accentColor: "#ca8a04",
  },
} as const;

export type FactionTheme = keyof typeof FACTION_THEMES;

// Linked characters for multiboxing support
// Stores additional characters linked to a primary account
export const linkedCharacters = pgTable("linked_characters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  primaryCharacterId: integer("primary_character_id").notNull(), // The "main" account owner
  characterId: integer("character_id").notNull().unique(), // The linked alt character
  characterName: text("character_name").notNull(),
  corporationId: integer("corporation_id"),
  corporationName: text("corporation_name"),
  allianceId: integer("alliance_id"),
  allianceName: text("alliance_name"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at").notNull(),
  lastRefreshedAt: timestamp("last_refreshed_at"),
  isActive: boolean("is_active").notNull().default(true),
  linkedAt: timestamp("linked_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
});

export const insertLinkedCharacterSchema = createInsertSchema(linkedCharacters).omit({
  id: true,
  linkedAt: true,
  lastRefreshedAt: true,
  lastUsedAt: true,
});

export type InsertLinkedCharacter = z.infer<typeof insertLinkedCharacterSchema>;
export type LinkedCharacter = typeof linkedCharacters.$inferSelect;

// Income goals (daily/weekly/monthly targets per character)
export const incomeGoals = pgTable("income_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull().unique(),
  characterName: text("character_name").notNull(),
  dailyTarget: real("daily_target").notNull().default(0),
  weeklyTarget: real("weekly_target").notNull().default(0),
  monthlyTarget: real("monthly_target").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertIncomeGoalSchema = createInsertSchema(incomeGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertIncomeGoal = z.infer<typeof insertIncomeGoalSchema>;
export type IncomeGoal = typeof incomeGoals.$inferSelect;

// Bonus dashboard tiles that can be unlocked via gift codes
export const BONUS_TILES = {
  wallet_overview: "Wallet Overview",
  character_status: "Character Status",
  plex_goal: "PLEX Goal Tracker",
  achievements: "Achievements",
  session_kills: "Session Kills",
  total_isk_stats: "Total ISK Stats",
  average_isk_stats: "Average ISK Stats",
  total_time_stats: "Total Time Stats",
} as const;

export type BonusTile = keyof typeof BONUS_TILES;

export type SpecialBadgeType = keyof typeof SPECIAL_BADGE_TYPES;

// Moon Calculator - User moon data storage
export const userMoons = pgTable("user_moons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull(),
  moonName: text("moon_name").notNull(),
  systemName: text("system_name").notNull(),
  ores: jsonb("ores").notNull(), // Array of { name, quantity, rarity, material, yield, typeId }
  notes: text("notes"),
  isFavorite: boolean("is_favorite").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserMoonSchema = createInsertSchema(userMoons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserMoon = z.infer<typeof insertUserMoonSchema>;
export type UserMoon = typeof userMoons.$inferSelect;

// Moon Calculator - User saved material prices
export const userMoonPrices = pgTable("user_moon_prices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull().unique(),
  prices: jsonb("prices").notNull(), // Record<string, number> material -> price
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export const insertUserMoonPricesSchema = createInsertSchema(userMoonPrices).omit({
  id: true,
});

export type InsertUserMoonPrices = z.infer<typeof insertUserMoonPricesSchema>;
export type UserMoonPrices = typeof userMoonPrices.$inferSelect;

// Industry Jobs - Cached ESI job data with profit calculations
export const industryJobs = pgTable("industry_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull(),
  characterName: text("character_name").notNull(),
  jobId: integer("job_id").notNull(), // ESI job_id
  activityId: integer("activity_id").notNull(), // 1=Manufacturing, 3=TE, 4=ME, 5=Copying, 8=Invention, 9=Reactions
  blueprintId: integer("blueprint_id").notNull(),
  blueprintTypeId: integer("blueprint_type_id").notNull(),
  blueprintTypeName: text("blueprint_type_name").notNull(),
  productTypeId: integer("product_type_id"), // Output item type
  productTypeName: text("product_type_name"),
  facilityId: bigint("facility_id", { mode: "number" }), // Can be structure ID (bigint)
  stationId: bigint("station_id", { mode: "number" }), // Can be structure ID (bigint)
  locationName: text("location_name"),
  runs: integer("runs").notNull().default(1),
  licensedRuns: integer("licensed_runs"),
  probability: real("probability"), // For invention
  successfulRuns: integer("successful_runs"), // For completed invention
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  completedDate: timestamp("completed_date"), // When actually delivered
  status: text("status").notNull(), // active, ready, delivered, cancelled, paused, reverted
  cost: real("cost"), // ISK cost to run the job
  // Profit tracking (calculated from market data)
  materialCost: real("material_cost"), // Total input material cost
  outputValue: real("output_value"), // Market value of output
  estimatedProfit: real("estimated_profit"), // outputValue - materialCost - cost
  iskPerHour: real("isk_per_hour"), // Profit / job duration in hours
  // Timestamps
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertIndustryJobSchema = createInsertSchema(industryJobs).omit({
  id: true,
  cachedAt: true,
  updatedAt: true,
});

export type InsertIndustryJob = z.infer<typeof insertIndustryJobSchema>;
export type IndustryJob = typeof industryJobs.$inferSelect;

// Industry activity types
export const INDUSTRY_ACTIVITIES = {
  1: { name: "Manufacturing", icon: "Hammer", description: "Building items from blueprints" },
  3: { name: "TE Research", icon: "Clock", description: "Time Efficiency research" },
  4: { name: "ME Research", icon: "Percent", description: "Material Efficiency research" },
  5: { name: "Copying", icon: "Copy", description: "Creating blueprint copies" },
  8: { name: "Invention", icon: "Lightbulb", description: "Creating T2/T3 blueprints" },
  9: { name: "Reactions", icon: "FlaskConical", description: "Processing moon materials" },
} as const;

export type IndustryActivityId = keyof typeof INDUSTRY_ACTIVITIES;

// Planetary Industry - Cached ESI planetary data
export const planetaryPlanets = pgTable("planetary_planets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull(),
  characterName: text("character_name").notNull(),
  planetId: integer("planet_id").notNull(),
  planetName: text("planet_name").notNull(),
  planetTypeId: integer("planet_type_id").notNull(),
  planetTypeName: text("planet_type_name").notNull(), // Barren, Temperate, Gas, Ice, Lava, Oceanic, Plasma, Storm
  solarSystemId: integer("solar_system_id").notNull(),
  solarSystemName: text("solar_system_name").notNull(),
  upgradeLevel: integer("upgrade_level").notNull().default(0), // 0-5
  numPins: integer("num_pins").notNull().default(0),
  lastUpdate: timestamp("last_update"), // From ESI
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  characterPlanetUnique: uniqueIndex("planetary_planets_character_planet_idx").on(table.characterId, table.planetId),
}));

export const insertPlanetaryPlanetSchema = createInsertSchema(planetaryPlanets).omit({
  id: true,
  cachedAt: true,
  updatedAt: true,
});

export type InsertPlanetaryPlanet = z.infer<typeof insertPlanetaryPlanetSchema>;
export type PlanetaryPlanet = typeof planetaryPlanets.$inferSelect;

// Planetary pins (extractors, factories, storage, launchpads)
export const planetaryPins = pgTable("planetary_pins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull(),
  planetId: integer("planet_id").notNull(),
  pinId: bigint("pin_id", { mode: "number" }).notNull(), // ESI pin_id (bigint)
  typeId: integer("type_id").notNull(),
  typeName: text("type_name").notNull(),
  schematicId: integer("schematic_id"), // For factories
  schematicName: text("schematic_name"), // Product being produced
  extractorProductTypeId: integer("extractor_product_type_id"), // For extractors
  extractorProductName: text("extractor_product_name"),
  // Extractor details
  cycleTime: integer("cycle_time"), // Seconds per cycle
  headRadius: real("head_radius"),
  numHeads: integer("num_heads"),
  quantityPerCycle: integer("quantity_per_cycle"),
  installTime: timestamp("install_time"),
  expiryTime: timestamp("expiry_time"), // When extractor runs out
  // Contents (storage/launchpad)
  contentsJson: jsonb("contents_json").$type<Array<{typeId: number; typeName: string; quantity: number}>>(),
  // Capacity
  capacity: real("capacity"),
  usedCapacity: real("used_capacity"),
  // Position
  latitude: real("latitude"),
  longitude: real("longitude"),
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
}, (table) => ({
  characterPlanetPinUnique: uniqueIndex("planetary_pins_character_planet_pin_idx").on(table.characterId, table.planetId, table.pinId),
}));

export const insertPlanetaryPinSchema = createInsertSchema(planetaryPins).omit({
  id: true,
  cachedAt: true,
});

export type InsertPlanetaryPin = z.infer<typeof insertPlanetaryPinSchema>;
export type PlanetaryPin = typeof planetaryPins.$inferSelect;

// Planet type info
export const PLANET_TYPES = {
  2014: { name: "Temperate", icon: "TreePine", color: "text-green-500" },
  2015: { name: "Ice", icon: "Snowflake", color: "text-cyan-400" },
  2016: { name: "Gas", icon: "Cloud", color: "text-purple-400" },
  2017: { name: "Oceanic", icon: "Waves", color: "text-blue-500" },
  2063: { name: "Lava", icon: "Flame", color: "text-orange-500" },
  11: { name: "Barren", icon: "Mountain", color: "text-stone-400" },
  12: { name: "Storm", icon: "CloudLightning", color: "text-yellow-500" },
  13: { name: "Plasma", icon: "Zap", color: "text-pink-500" },
} as const;

// Changelog versions (parent table for releases)
export const changelogVersions = pgTable("changelog_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  version: text("version").notNull().unique(), // e.g., "0.3.0"
  title: text("title").notNull(), // e.g., "Multi-Character & Tracker Expansion"
  releaseDate: text("release_date").notNull(), // e.g., "January 2026"
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  publishedAt: timestamp("published_at"),
  createdByAdminId: integer("created_by_admin_id"),
  createdByAdminName: text("created_by_admin_name"),
});

export const insertChangelogVersionSchema = createInsertSchema(changelogVersions).omit({
  id: true,
  createdAt: true,
  publishedAt: true,
});

export type InsertChangelogVersion = z.infer<typeof insertChangelogVersionSchema>;
export type ChangelogVersion = typeof changelogVersions.$inferSelect;

// Changelog items (individual changes within a version)
export const changelogItems = pgTable("changelog_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  versionId: varchar("version_id").notNull(), // FK to changelogVersions
  changeType: text("change_type").notNull(), // "new", "improved", "fixed"
  iconKey: text("icon_key"), // Lucide icon name, e.g., "Package", "Zap"
  text: text("text").notNull(), // Description of the change
  sortOrder: integer("sort_order").notNull().default(0), // Display order
  isProOnly: boolean("is_pro_only").notNull().default(false), // PRO feature flag
  isAdminOnly: boolean("is_admin_only").notNull().default(false), // Exclude from public changelog
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChangelogItemSchema = createInsertSchema(changelogItems).omit({
  id: true,
  createdAt: true,
});

export type InsertChangelogItem = z.infer<typeof insertChangelogItemSchema>;
export type ChangelogItem = typeof changelogItems.$inferSelect;

// Changelog change types
export const CHANGELOG_CHANGE_TYPES = ["new", "improved", "fixed"] as const;
export type ChangelogChangeType = typeof CHANGELOG_CHANGE_TYPES[number];

// Available icons for changelog items
export const CHANGELOG_ICONS = [
  "Sparkles", "Package", "FileText", "Factory", "Globe2", "Target", "Zap",
  "Pickaxe", "Crosshair", "Shield", "Settings", "Crown", "Rocket", "Heart",
  "Star", "Award", "Gem", "Trophy", "Flag", "Download", "HelpCircle",
] as const;

// ESI Name Cache - stores resolved names for structures per character (privacy-compliant)
export const esiNameCache = pgTable("esi_name_cache", {
  id: bigint("id", { mode: "number" }).notNull(), // ESI entity ID (structure_id, etc.) - bigint for structure IDs
  characterId: integer("character_id").notNull(), // Owner of this cache entry
  name: text("name").notNull(),
  category: text("category").notNull(), // "structure", "character", "corporation"
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
}, (table) => ({
  pk: { columns: [table.id, table.characterId] }, // Composite primary key
}));

export const insertEsiNameCacheSchema = createInsertSchema(esiNameCache);
export type InsertEsiNameCache = z.infer<typeof insertEsiNameCacheSchema>;
export type EsiNameCache = typeof esiNameCache.$inferSelect;

// ============================================================================
// BIG UPDATE TABLES (v0.4.0) - Skill Queue, Market Orders, Income Analytics, PI Chains
// ============================================================================

// Daily Income Summary - aggregated income data for charts and analytics
export const dailyIncomeSummary = pgTable("daily_income_summary", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format for easy querying
  bountyIncome: real("bounty_income").notNull().default(0),
  missionIncome: real("mission_income").notNull().default(0),
  marketIncome: real("market_income").notNull().default(0), // From market sales
  industryIncome: real("industry_income").notNull().default(0),
  piIncome: real("pi_income").notNull().default(0),
  miningIncome: real("mining_income").notNull().default(0),
  otherIncome: real("other_income").notNull().default(0),
  totalIncome: real("total_income").notNull().default(0),
  sessionCount: integer("session_count").notNull().default(0),
  totalSessionTime: integer("total_session_time").notNull().default(0), // Seconds
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  characterDateUnique: uniqueIndex("daily_income_char_date_idx").on(table.characterId, table.date),
}));

export const insertDailyIncomeSummarySchema = createInsertSchema(dailyIncomeSummary).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDailyIncomeSummary = z.infer<typeof insertDailyIncomeSummarySchema>;
export type DailyIncomeSummary = typeof dailyIncomeSummary.$inferSelect;

// Skill Queue - cached ESI skill queue data
export const skillQueue = pgTable("skill_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull(),
  characterName: text("character_name").notNull(),
  queuePosition: integer("queue_position").notNull(), // 0-indexed position in queue
  skillId: integer("skill_id").notNull(),
  skillName: text("skill_name").notNull(),
  startedLevel: integer("started_level").notNull(), // Level training FROM
  finishedLevel: integer("finished_level").notNull(), // Level training TO
  startDate: timestamp("start_date"),
  finishDate: timestamp("finish_date"),
  trainingStartSp: integer("training_start_sp"),
  levelStartSp: integer("level_start_sp"),
  levelEndSp: integer("level_end_sp"),
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
}, (table) => ({
  characterQueueUnique: uniqueIndex("skill_queue_char_pos_idx").on(table.characterId, table.queuePosition),
}));

export const insertSkillQueueSchema = createInsertSchema(skillQueue).omit({
  id: true,
  cachedAt: true,
});

export type InsertSkillQueue = z.infer<typeof insertSkillQueueSchema>;
export type SkillQueue = typeof skillQueue.$inferSelect;

// Skill Queue Alerts - user notification preferences
export const skillQueueAlerts = pgTable("skill_queue_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull().unique(),
  alertOnEmpty: boolean("alert_on_empty").notNull().default(true),
  alertHoursBeforeEmpty: integer("alert_hours_before_empty").notNull().default(24),
  lastAlertSentAt: timestamp("last_alert_sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSkillQueueAlertsSchema = createInsertSchema(skillQueueAlerts).omit({
  id: true,
  createdAt: true,
  lastAlertSentAt: true,
});

export type InsertSkillQueueAlerts = z.infer<typeof insertSkillQueueAlertsSchema>;
export type SkillQueueAlerts = typeof skillQueueAlerts.$inferSelect;

// Market Orders - cached character orders from ESI
export const marketOrders = pgTable("market_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull(),
  characterName: text("character_name").notNull(),
  orderId: bigint("order_id", { mode: "number" }).notNull(),
  typeId: integer("type_id").notNull(),
  typeName: text("type_name").notNull(),
  locationId: bigint("location_id", { mode: "number" }).notNull(),
  locationName: text("location_name"),
  volumeTotal: integer("volume_total").notNull(),
  volumeRemain: integer("volume_remain").notNull(),
  price: real("price").notNull(),
  isBuyOrder: boolean("is_buy_order").notNull(),
  issued: timestamp("issued").notNull(),
  duration: integer("duration").notNull(), // Days
  escrow: real("escrow"), // For buy orders
  minVolume: integer("min_volume"),
  range: text("range"), // station, region, solarsystem, etc.
  regionId: integer("region_id"),
  state: text("state").notNull().default("active"), // active, expired, cancelled
  // Profit tracking
  estimatedProfit: real("estimated_profit"),
  profitMargin: real("profit_margin"), // Percentage
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
}, (table) => ({
  characterOrderUnique: uniqueIndex("market_orders_char_order_idx").on(table.characterId, table.orderId),
}));

export const insertMarketOrderSchema = createInsertSchema(marketOrders).omit({
  id: true,
  cachedAt: true,
});

export type InsertMarketOrder = z.infer<typeof insertMarketOrderSchema>;
export type MarketOrder = typeof marketOrders.$inferSelect;

// Market Order History - completed/expired orders for analytics
export const marketOrderHistory = pgTable("market_order_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull(),
  orderId: bigint("order_id", { mode: "number" }).notNull(),
  typeId: integer("type_id").notNull(),
  typeName: text("type_name").notNull(),
  locationId: bigint("location_id", { mode: "number" }),
  locationName: text("location_name"),
  volumeTotal: integer("volume_total").notNull(),
  volumeSold: integer("volume_sold").notNull(), // How many actually sold
  price: real("price").notNull(),
  isBuyOrder: boolean("is_buy_order").notNull(),
  issued: timestamp("issued").notNull(),
  completedAt: timestamp("completed_at"),
  state: text("state").notNull(), // expired, cancelled, fulfilled
  totalRevenue: real("total_revenue"), // price * volumeSold
  estimatedProfit: real("estimated_profit"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMarketOrderHistorySchema = createInsertSchema(marketOrderHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertMarketOrderHistory = z.infer<typeof insertMarketOrderHistorySchema>;
export type MarketOrderHistory = typeof marketOrderHistory.$inferSelect;

// Saved PI Production Chains - user's saved production chain presets
export const savedPiChains = pgTable("saved_pi_chains", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  targetProductTypeId: integer("target_product_type_id").notNull(),
  targetProductName: text("target_product_name").notNull(),
  targetTier: text("target_tier").notNull(), // P1, P2, P3, P4
  unitsPerDay: integer("units_per_day").notNull(),
  chainDataJson: jsonb("chain_data_json").notNull(), // Full chain configuration
  planetAssignments: jsonb("planet_assignments"), // Which planets produce what
  estimatedDailyIsk: real("estimated_daily_isk"),
  isFavorite: boolean("is_favorite").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSavedPiChainSchema = createInsertSchema(savedPiChains).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSavedPiChain = z.infer<typeof insertSavedPiChainSchema>;
export type SavedPiChain = typeof savedPiChains.$inferSelect;

// Trained Skills - character's current skill levels from ESI
export const trainedSkills = pgTable("trained_skills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull(),
  characterName: text("character_name").notNull(),
  skillId: integer("skill_id").notNull(),
  skillName: text("skill_name").notNull(),
  trainedSkillLevel: integer("trained_skill_level").notNull(), // 0-5
  activeSkillLevel: integer("active_skill_level").notNull(), // Currently usable level
  skillpointsInSkill: bigint("skillpoints_in_skill", { mode: "number" }).notNull(),
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
}, (table) => ({
  characterSkillUnique: uniqueIndex("trained_skills_char_skill_idx").on(table.characterId, table.skillId),
}));

export const insertTrainedSkillSchema = createInsertSchema(trainedSkills).omit({
  id: true,
  cachedAt: true,
});

export type InsertTrainedSkill = z.infer<typeof insertTrainedSkillSchema>;
export type TrainedSkill = typeof trainedSkills.$inferSelect;

// Character Attributes - for training time calculations
export const characterAttributes = pgTable("character_attributes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull().unique(),
  characterName: text("character_name").notNull(),
  charisma: integer("charisma").notNull(),
  intelligence: integer("intelligence").notNull(),
  memory: integer("memory").notNull(),
  perception: integer("perception").notNull(),
  willpower: integer("willpower").notNull(),
  bonusRemaps: integer("bonus_remaps"),
  lastRemapDate: timestamp("last_remap_date"),
  accruedRemapCooldownDate: timestamp("accrued_remap_cooldown_date"),
  totalSp: bigint("total_sp", { mode: "number" }),
  unallocatedSp: integer("unallocated_sp"),
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
});

export const insertCharacterAttributesSchema = createInsertSchema(characterAttributes).omit({
  id: true,
  cachedAt: true,
});

export type InsertCharacterAttributes = z.infer<typeof insertCharacterAttributesSchema>;
export type CharacterAttributes = typeof characterAttributes.$inferSelect;

// Skill Plans - user-created training goals
export const skillPlans = pgTable("skill_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  goalType: text("goal_type").notNull(), // "ship", "activity", "custom"
  goalTypeId: integer("goal_type_id"), // Ship typeId or activity category
  goalTypeName: text("goal_type_name"), // Ship name or activity name
  isActive: boolean("is_active").notNull().default(false),
  priority: integer("priority").notNull().default(0), // For ordering multiple plans
  estimatedTrainingTime: bigint("estimated_training_time", { mode: "number" }), // Seconds
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSkillPlanSchema = createInsertSchema(skillPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSkillPlan = z.infer<typeof insertSkillPlanSchema>;
export type SkillPlan = typeof skillPlans.$inferSelect;

// Skill Plan Items - individual skills in a plan
export const skillPlanItems = pgTable("skill_plan_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull().references(() => skillPlans.id, { onDelete: "cascade" }),
  skillId: integer("skill_id").notNull(),
  skillName: text("skill_name").notNull(),
  targetLevel: integer("target_level").notNull(), // 1-5
  currentLevel: integer("current_level").notNull().default(0), // Snapshot at plan creation
  priority: integer("priority").notNull().default(0), // Order within plan
  isRequired: boolean("is_required").notNull().default(true), // vs optional/nice-to-have
  estimatedTrainingTime: bigint("estimated_training_time", { mode: "number" }), // Seconds for this skill
  notes: text("notes"),
}, (table) => ({
  planSkillUnique: uniqueIndex("skill_plan_items_plan_skill_idx").on(table.planId, table.skillId, table.targetLevel),
}));

export const insertSkillPlanItemSchema = createInsertSchema(skillPlanItems).omit({
  id: true,
});

export type InsertSkillPlanItem = z.infer<typeof insertSkillPlanItemSchema>;
export type SkillPlanItem = typeof skillPlanItems.$inferSelect;

// Ship Skill Requirements - static data for ship skill requirements
export const shipSkillRequirements = pgTable("ship_skill_requirements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shipTypeId: integer("ship_type_id").notNull(),
  shipName: text("ship_name").notNull(),
  shipGroup: text("ship_group").notNull(), // Frigate, Cruiser, Battleship, etc.
  skillId: integer("skill_id").notNull(),
  skillName: text("skill_name").notNull(),
  requiredLevel: integer("required_level").notNull(),
  isPrerequisite: boolean("is_prerequisite").notNull().default(false), // Direct req vs prereq of req
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
}, (table) => ({
  shipSkillUnique: uniqueIndex("ship_skill_req_idx").on(table.shipTypeId, table.skillId),
}));

export const insertShipSkillRequirementSchema = createInsertSchema(shipSkillRequirements).omit({
  id: true,
  cachedAt: true,
});

export type InsertShipSkillRequirement = z.infer<typeof insertShipSkillRequirementSchema>;
export type ShipSkillRequirement = typeof shipSkillRequirements.$inferSelect;

// Skill Metadata - cached skill information from ESI
export const skillMetadata = pgTable("skill_metadata", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  skillId: integer("skill_id").notNull().unique(),
  skillName: text("skill_name").notNull(),
  groupId: integer("group_id").notNull(),
  groupName: text("group_name").notNull(),
  description: text("description"),
  primaryAttribute: text("primary_attribute").notNull(), // intelligence, memory, etc.
  secondaryAttribute: text("secondary_attribute").notNull(),
  trainingTimeMultiplier: integer("training_time_multiplier").notNull(), // rank
  prerequisiteSkillsJson: jsonb("prerequisite_skills_json"), // Array of {skillId, level}
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
});

export const insertSkillMetadataSchema = createInsertSchema(skillMetadata).omit({
  id: true,
  cachedAt: true,
});

export type InsertSkillMetadata = z.infer<typeof insertSkillMetadataSchema>;
export type SkillMetadata = typeof skillMetadata.$inferSelect;

// EVE Ships - static ship database for fast searching
export const eveShips = pgTable("eve_ships", {
  typeId: integer("type_id").primaryKey(),
  typeName: text("type_name").notNull(),
  groupId: integer("group_id").notNull(),
  groupName: text("group_name").notNull(),
  categoryId: integer("category_id").notNull().default(6), // 6 = Ships
  description: text("description"),
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
}, (table) => ({
  nameIdx: index("eve_ships_name_idx").on(table.typeName),
  groupIdx: index("eve_ships_group_idx").on(table.groupId),
}));

export const insertEveShipSchema = createInsertSchema(eveShips).omit({
  cachedAt: true,
});

export type InsertEveShip = z.infer<typeof insertEveShipSchema>;
export type EveShip = typeof eveShips.$inferSelect;

// ADM Reports - Alliance sovereignty ADM tracking
export const admReports = pgTable("adm_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // e.g., "OUTER PASSAGE"
  regionName: text("region_name").notNull(),
  reportDate: timestamp("report_date").notNull(),
  nextAdmRead: timestamp("next_adm_read"), // When next ADM read happens
  createdBy: integer("created_by").notNull(), // Admin character ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAdmReportSchema = createInsertSchema(admReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAdmReport = z.infer<typeof insertAdmReportSchema>;
export type AdmReport = typeof admReports.$inferSelect;

// ADM System Data - individual system entries for a report
export const admSystems = pgTable("adm_systems", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").notNull().references(() => admReports.id, { onDelete: "cascade" }),
  systemId: integer("system_id"), // ESI system ID (optional)
  systemName: text("system_name").notNull(),

  // Strategic Index
  strategicIndex: real("strategic_index"), // e.g., 3 for "3 + 17%"
  strategicPercent: real("strategic_percent"), // The percentage part

  // Vulnerability
  vulnerableHours: real("vulnerable_hours"), // e.g., 5.1

  // ADM
  adm: real("adm").notNull(), // e.g., 3.5
  admChange: real("adm_change"), // +/- change value
  admTrend: text("adm_trend"), // "up", "down", "stable"
  admStatus: text("adm_status").notNull().default("safe"), // "critical", "warning", "safe"

  // Military Index
  militaryLevel: integer("military_level"), // 0-5
  militaryPercent: real("military_percent"), // Percentage towards next level
  militaryChange: real("military_change"),
  militaryTrend: text("military_trend"),
  militaryActivity: real("military_activity"), // Heart % distribution

  // Industrial Index
  industrialLevel: integer("industrial_level"), // 0-5
  industrialPercent: real("industrial_percent"),
  industrialChange: real("industrial_change"),
  industrialTrend: text("industrial_trend"),
  industrialActivity: real("industrial_activity"), // Heart % distribution

  // Threat Detection
  majorThreat: text("major_threat"), // e.g., "M1", "M2", "M3"
  minorThreat: text("minor_threat"), // e.g., "ISO 1", "MEGA 2"

  // Infrastructure
  oreProspecting: text("ore_prospecting"), // e.g., "ICE", "MEGA 1", "NOX 3"

  // Sovereignty
  sovHolder: text("sov_holder"), // e.g., "STAKAN", "HORDE"
  isCapital: boolean("is_capital").default(false), // Capital system gets +2 ADM bonus

  // Notes
  notes: text("notes"),

  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  reportIdx: index("adm_systems_report_idx").on(table.reportId),
  systemNameIdx: index("adm_systems_name_idx").on(table.systemName),
}));

export const insertAdmSystemSchema = createInsertSchema(admSystems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAdmSystem = z.infer<typeof insertAdmSystemSchema>;
export type AdmSystem = typeof admSystems.$inferSelect;

// Saved ADM Systems - reusable system presets for ADM reports
export const savedAdmSystems = pgTable("saved_adm_systems", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull(),
  systemId: integer("system_id"),
  systemName: text("system_name").notNull(),

  // Strategic Index defaults
  strategicIndex: real("strategic_index"),
  strategicPercent: real("strategic_percent"),

  // Vulnerability
  vulnerableHours: real("vulnerable_hours"),

  // Default ADM values
  defaultAdm: real("default_adm").notNull().default(3.0),
  defaultAdmStatus: text("default_adm_status").notNull().default("safe"),

  // Military Index defaults
  militaryLevel: integer("military_level"),
  militaryPercent: real("military_percent"),

  // Industrial Index defaults
  industrialLevel: integer("industrial_level"),
  industrialPercent: real("industrial_percent"),

  // Threat Detection defaults
  majorThreat: text("major_threat"),
  minorThreat: text("minor_threat"),

  // Infrastructure
  oreProspecting: text("ore_prospecting"),

  // Sovereignty
  sovHolder: text("sov_holder"),
  isCapital: boolean("is_capital").default(false),

  // Notes
  notes: text("notes"),

  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  characterIdx: index("saved_adm_systems_character_idx").on(table.characterId),
  characterSystemUnique: uniqueIndex("saved_adm_systems_unique").on(table.characterId, table.systemName),
}));

export const insertSavedAdmSystemSchema = createInsertSchema(savedAdmSystems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSavedAdmSystem = z.infer<typeof insertSavedAdmSystemSchema>;
export type SavedAdmSystem = typeof savedAdmSystems.$inferSelect;

// Saved Jump Routes - user's saved jump planner routes
export const savedJumpRoutes = pgTable("saved_jump_routes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  shipTypeId: integer("ship_type_id"),
  shipName: text("ship_name"),
  originSystemId: integer("origin_system_id").notNull(),
  originSystemName: text("origin_system_name").notNull(),
  destinationSystemId: integer("destination_system_id").notNull(),
  destinationSystemName: text("destination_system_name").notNull(),
  routeDataJson: jsonb("route_data_json").notNull(), // Full route with hops, segments, fatigue
  skillConfig: jsonb("skill_config"), // { jdc, jfc, jf } levels used
  totalFuel: integer("total_fuel"),
  totalJumps: integer("total_jumps"),
  totalGates: integer("total_gates"),
  isFavorite: boolean("is_favorite").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  characterIdx: index("saved_jump_routes_character_idx").on(table.characterId),
}));

export const insertSavedJumpRouteSchema = createInsertSchema(savedJumpRoutes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSavedJumpRoute = z.infer<typeof insertSavedJumpRouteSchema>;
export type SavedJumpRoute = typeof savedJumpRoutes.$inferSelect;

// Jump Beacon Networks - cyno alt positions and beacon locations
export const jumpBeacons = pgTable("jump_beacons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull(),
  networkName: text("network_name").notNull().default("Default"),
  systemId: integer("system_id").notNull(),
  systemName: text("system_name").notNull(),
  beaconType: text("beacon_type").notNull(), // "cyno_alt", "beacon", "structure"
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  characterIdx: index("jump_beacons_character_idx").on(table.characterId),
  charSystemNetworkUnique: uniqueIndex("jump_beacons_char_system_network_idx")
    .on(table.characterId, table.systemId, table.networkName),
}));

export const insertJumpBeaconSchema = createInsertSchema(jumpBeacons).omit({
  id: true,
  createdAt: true,
});

export type InsertJumpBeacon = z.infer<typeof insertJumpBeaconSchema>;
export type JumpBeacon = typeof jumpBeacons.$inferSelect;

// ========================================
// Market Intelligence Module
// ========================================

// Monitored stations - stations/structures the user is tracking
export const monitoredStations = pgTable("monitored_stations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull(),
  stationId: bigint("station_id", { mode: "number" }).notNull(),
  stationName: text("station_name").notNull(),
  stationType: text("station_type").notNull(), // 'npc' or 'player_owned'
  regionId: integer("region_id").notNull(),
  solarSystemId: integer("solar_system_id"),
  authCharacterId: integer("auth_character_id"), // which char has docking/market access
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastFetchedAt: timestamp("last_fetched_at"),
}, (table) => ({
  characterIdx: index("monitored_stations_character_idx").on(table.characterId),
  stationIdx: index("monitored_stations_station_idx").on(table.stationId),
  charStationUnique: uniqueIndex("monitored_stations_char_station_idx")
    .on(table.characterId, table.stationId),
}));

export const insertMonitoredStationSchema = createInsertSchema(monitoredStations).omit({
  id: true,
  createdAt: true,
  lastFetchedAt: true,
});

export type InsertMonitoredStation = z.infer<typeof insertMonitoredStationSchema>;
export type MonitoredStation = typeof monitoredStations.$inferSelect;

// Watchlists - named groups of items to track at a station
export const watchlists = pgTable("watchlists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: integer("character_id").notNull(),
  monitoredStationId: varchar("monitored_station_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  characterIdx: index("watchlists_character_idx").on(table.characterId),
  stationIdx: index("watchlists_station_idx").on(table.monitoredStationId),
}));

export const insertWatchlistSchema = createInsertSchema(watchlists).omit({
  id: true,
  createdAt: true,
});

export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type Watchlist = typeof watchlists.$inferSelect;

// Watchlist items - individual items in a watchlist
export const watchlistItems = pgTable("watchlist_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  watchlistId: varchar("watchlist_id").notNull(),
  typeId: integer("type_id").notNull(),
  typeName: text("type_name").notNull(),
  minStockThreshold: integer("min_stock_threshold").default(5).notNull(),
  category: text("category"),
}, (table) => ({
  watchlistIdx: index("watchlist_items_watchlist_idx").on(table.watchlistId),
  typeIdx: index("watchlist_items_type_idx").on(table.typeId),
  watchlistTypeUnique: uniqueIndex("watchlist_items_watchlist_type_idx")
    .on(table.watchlistId, table.typeId),
}));

export const insertWatchlistItemSchema = createInsertSchema(watchlistItems).omit({
  id: true,
});

export type InsertWatchlistItem = z.infer<typeof insertWatchlistItemSchema>;
export type WatchlistItem = typeof watchlistItems.$inferSelect;

// Market snapshots - latest market data per item per station
export const marketSnapshots = pgTable("market_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  monitoredStationId: varchar("monitored_station_id").notNull(),
  typeId: integer("type_id").notNull(),
  sellPriceMin: real("sell_price_min"),
  sellVolumeTotal: integer("sell_volume_total"),
  buyPriceMax: real("buy_price_max"),
  orderCount: integer("order_count").default(0).notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
}, (table) => ({
  stationIdx: index("market_snapshots_station_idx").on(table.monitoredStationId),
  typeIdx: index("market_snapshots_type_idx").on(table.typeId),
  stationTypeUnique: uniqueIndex("market_snapshots_station_type_idx")
    .on(table.monitoredStationId, table.typeId),
}));

export const insertMarketSnapshotSchema = createInsertSchema(marketSnapshots).omit({
  id: true,
});

export type InsertMarketSnapshot = z.infer<typeof insertMarketSnapshotSchema>;
export type MarketSnapshot = typeof marketSnapshots.$inferSelect;

// Jita reference prices - cached Jita market prices
export const jitaReferencePrices = pgTable("jita_reference_prices", {
  typeId: integer("type_id").primaryKey(),
  sellMin: real("sell_min"),
  buyMax: real("buy_max"),
  volumeDaily: integer("volume_daily"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertJitaReferencePriceSchema = createInsertSchema(jitaReferencePrices);

export type InsertJitaReferencePrice = z.infer<typeof insertJitaReferencePriceSchema>;
export type JitaReferencePrice = typeof jitaReferencePrices.$inferSelect;
