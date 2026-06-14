import { 
  type User, 
  type InsertUser, 
  type ProSubscription, 
  type ProActivationCode, 
  type ProGift,
  type SpecialBadgeType,
  type FactionTheme,
  type BonusTile,
  type TicketAttachment,
  type LinkedCharacter,
  type InsertLinkedCharacter,
  type UserMoon,
  type InsertUserMoon,
  type UserMoonPrices,
  proSubscriptions,
  proActivationCodes,
  proGifts,
  dynamicAdmins,
  proNotificationEmails as proNotificationEmailsTable,
  processedTransactions as processedTransactionsTable,
  userUnlocks as userUnlocksTable,
  specialBadges as specialBadgesTable,
  userPreferences,
  pendingPayments as pendingPaymentsTable,
  rattingSessions as rattingSessionsTable,
  lootEntries as lootEntriesTable,
  photonActivationCodes as photonCodesTable,
  photonCodeRedemptions as photonRedemptionsTable,
  photonCodeActivityLog as photonActivityLogTable,
  supportTickets as supportTicketsTable,
  ticketReplies as ticketRepliesTable,
  ticketNotifications as ticketNotificationsTable,
  adminNotes as adminNotesTable,
  userSuspensions as userSuspensionsTable,
  adminAuditLog as adminAuditLogTable,
  linkedCharacters as linkedCharactersTable,
  incomeGoals as incomeGoalsTable,
  userMoons as userMoonsTable,
  userMoonPrices as userMoonPricesTable,
  industryJobs as industryJobsTable,
  planetaryPlanets as planetaryPlanetsTable,
  planetaryPins as planetaryPinsTable,
  changelogVersions as changelogVersionsTable,
  changelogItems as changelogItemsTable,
  esiNameCache as esiNameCacheTable,
  // Big Update v0.4.0 tables
  dailyIncomeSummary as dailyIncomeSummaryTable,
  skillQueue as skillQueueTable,
  skillQueueAlerts as skillQueueAlertsTable,
  marketOrders as marketOrdersTable,
  marketOrderHistory as marketOrderHistoryTable,
  savedPiChains as savedPiChainsTable,
  // Skill Planner v0.5.0 tables
  trainedSkills as trainedSkillsTable,
  characterAttributes as characterAttributesTable,
  skillPlans as skillPlansTable,
  skillPlanItems as skillPlanItemsTable,
  shipSkillRequirements as shipSkillRequirementsTable,
  skillMetadata as skillMetadataTable,
  eveShips as eveShipsTable,
  // ADM Reports
  admReports as admReportsTable,
  admSystems as admSystemsTable,
  savedAdmSystems as savedAdmSystemsTable,
  type DailyIncomeSummary,
  type InsertDailyIncomeSummary,
  type SkillQueue,
  type InsertSkillQueue,
  type SkillQueueAlerts,
  type InsertSkillQueueAlerts,
  type MarketOrder,
  type InsertMarketOrder,
  type MarketOrderHistory,
  type InsertMarketOrderHistory,
  type SavedPiChain,
  type InsertSavedPiChain,
  // Skill Planner v0.5.0 types
  type TrainedSkill,
  type InsertTrainedSkill,
  type CharacterAttributes,
  type InsertCharacterAttributes,
  type SkillPlan,
  type InsertSkillPlan,
  type SkillPlanItem,
  type InsertSkillPlanItem,
  type ShipSkillRequirement,
  type InsertShipSkillRequirement,
  type SkillMetadata,
  type InsertSkillMetadata,
  type EveShip,
  type InsertEveShip,
  // ADM Reports types
  type AdmReport,
  type InsertAdmReport,
  type AdmSystem,
  type InsertAdmSystem,
  type SavedAdmSystem,
  type InsertSavedAdmSystem,
  // Jump Planner
  savedJumpRoutes as savedJumpRoutesTable,
  jumpBeacons as jumpBeaconsTable,
  type SavedJumpRoute,
  type InsertSavedJumpRoute,
  type JumpBeacon,
  type InsertJumpBeacon,
  // Market Intelligence
  monitoredStations as monitoredStationsTable,
  watchlists as watchlistsTable,
  watchlistItems as watchlistItemsTable,
  marketSnapshots as marketSnapshotsTable,
  jitaReferencePrices as jitaReferencePricesTable,
  type MonitoredStation,
  type InsertMonitoredStation,
  type Watchlist,
  type InsertWatchlist,
  type WatchlistItem,
  type InsertWatchlistItem,
  type MarketSnapshot,
  type InsertMarketSnapshot,
  type JitaReferencePrice,
  type InsertJitaReferencePrice,
} from "@shared/schema";
import { randomUUID, randomBytes } from "crypto";
import { db } from "./db";
import { eq, and, lt, desc, ilike, gte, lte, sql, inArray } from "drizzle-orm";
import { getCachedCorpAllianceInfo } from "./esiCache";

// Special badge data structure (in-memory for now)
export interface SpecialBadgeData {
  id: string;
  characterId: number;
  characterName: string;
  badgeType: SpecialBadgeType;
  grantedByAdminId: number;
  grantedByAdminName: string;
  note: string | null;
  grantedAt: Date;
}

// User profile data for tenure tracking
export interface UserProfile {
  characterId: number;
  characterName: string;
  firstLoginAt: Date;
  corpTaxRate: number;
  emailNotifications?: boolean;
  proExpiryReminders?: boolean;
  supportTicketUpdates?: boolean;
}

// Pending payment data for ISK-based PRO purchases
export interface PendingPaymentData {
  id: string;
  referenceCode: string;
  characterId: number;
  characterName: string;
  planType: 'weekly' | 'monthly';
  iskAmount: number;
  status: 'pending' | 'completed' | 'expired' | 'cancelled';
  expiresAt: Date;
  completedAt: Date | null;
  transactionId: number | null;
  createdAt: Date;
}

// Session card data
export interface SessionCardData {
  id: string;
  sessionId: string;
  characterId: number;
  shareCode: string;
  cardData: unknown;
  expiresAt?: Date;
  viewCount: number;
  createdAt: Date;
}

// Leaderboard data
export interface LeaderboardData {
  id: string;
  name: string;
  creatorCharacterId: number;
  creatorCharacterName: string;
  isPublic: boolean;
  rankBy: string;
  timeFrame: string;
  createdAt: Date;
}

// Leaderboard member data
export interface LeaderboardMemberData {
  id: string;
  leaderboardId: string;
  characterId: number;
  characterName: string;
  status: string;
  invitedAt: Date;
  respondedAt?: Date;
}

// Leaderboard ranking data
export interface LeaderboardRanking {
  rank: number;
  characterId: number;
  characterName: string;
  value: number;
  sessions: number;
}

// User unlocks data - tracks themes, tiles, and other unlocks from gift codes
export interface UserUnlocks {
  characterId: number;
  unlockedThemes: FactionTheme[];
  unlockedTiles: BonusTile[];
  updatedAt: Date;
}

// Dynamic admin data - for admins added by super admins
export interface DynamicAdminData {
  id: string;
  characterId: number;
  characterName: string;
  addedBy: number;
  addedByName: string;
  addedAt: Date;
}

// PRO notification email data - for emails notified on new subscriptions
export interface ProNotificationEmailData {
  id: string;
  email: string;
  addedByCharacterId: number;
  addedByCharacterName: string;
  isActive: boolean;
  addedAt: Date;
}

// Ratting session data - for tracking individual sessions
export interface RattingSessionData {
  id: string;
  characterId: number;
  characterName: string;
  startTime: Date;
  endTime: Date | null;
  totalIsk: number;
  bountyIsk: number;
  lootIsk: number;
  killCount: number;
  shipTypeId: number | null;
  shipTypeName: string | null;
  systemId: number | null;
  systemName: string | null;
  isActive: boolean;
  createdAt: Date;
}

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // PRO Subscription methods
  getProSubscription(characterId: number): Promise<ProSubscription | undefined>;
  createOrUpdateProSubscription(subscription: ProSubscription): Promise<ProSubscription>;
  
  // Activation code methods
  getActivationCode(code: string): Promise<ProActivationCode | undefined>;
  getActiveCodeForCharacter(characterId: number): Promise<ProActivationCode | undefined>;
  getAllPendingCodes(): Promise<ProActivationCode[]>;
  createActivationCode(codeData: ProActivationCode): Promise<ProActivationCode>;
  markCodeAsUsed(code: string): Promise<void>;
  
  // Gift methods
  createGift(gift: ProGift): Promise<ProGift>;
  getGiftsForCharacter(characterId: number): Promise<ProGift[]>;
  getAllGifts(): Promise<ProGift[]>;
  
  // Processed transactions tracking
  isTransactionProcessed(transactionId: number): Promise<boolean>;
  markTransactionProcessed(transactionId: number): Promise<void>;
  
  // Admin statistics methods
  getAllSubscriptions(): Promise<ProSubscription[]>;
  getAllActivationCodes(): Promise<ProActivationCode[]>;
  getStatistics(): Promise<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    expiredSubscriptions: number;
    pendingCodes: number;
    usedCodes: number;
    totalGifts: number;
    processedTransactions: number;
  }>;
  
  // Subscription management
  revokeSubscription(characterId: number): Promise<void>;
  extendSubscription(characterId: number, days: number): Promise<ProSubscription | undefined>;
  
  // Special badges methods
  grantSpecialBadge(badge: Omit<SpecialBadgeData, 'id' | 'grantedAt'>): Promise<SpecialBadgeData>;
  revokeSpecialBadge(characterId: number, badgeType: SpecialBadgeType): Promise<void>;
  getSpecialBadges(characterId: number): Promise<SpecialBadgeData[]>;
  getAllSpecialBadges(): Promise<SpecialBadgeData[]>;
  hasSpecialBadge(characterId: number, badgeType: SpecialBadgeType): Promise<boolean>;
  
  // User profile methods
  getUserProfile(characterId: number): Promise<UserProfile | undefined>;
  createOrUpdateUserProfile(profile: UserProfile): Promise<UserProfile>;
  updateCorpTaxRate(characterId: number, taxRate: number): Promise<void>;
  updateUserNotificationPreferences(characterId: number, prefs: {
    emailNotifications?: boolean;
    proExpiryReminders?: boolean;
    supportTicketUpdates?: boolean;
  }): Promise<void>;
  
  // Session card methods
  createSessionCard(card: Omit<SessionCardData, 'id' | 'viewCount' | 'createdAt'>): Promise<SessionCardData>;
  getSessionCardByCode(shareCode: string): Promise<SessionCardData | undefined>;
  getSessionCardsByCharacter(characterId: number): Promise<SessionCardData[]>;
  incrementSessionCardViews(cardId: string): Promise<void>;
  deleteSessionCard(cardId: string, characterId: number): Promise<void>;
  
  // Leaderboard methods
  createLeaderboard(data: Omit<LeaderboardData, 'id' | 'createdAt'>): Promise<LeaderboardData>;
  getLeaderboardById(id: string): Promise<LeaderboardData | undefined>;
  getPublicLeaderboards(): Promise<LeaderboardData[]>;
  getUserLeaderboards(characterId: number): Promise<LeaderboardData[]>;
  deleteLeaderboard(id: string): Promise<void>;
  
  // Leaderboard member methods
  addLeaderboardMember(member: Omit<LeaderboardMemberData, 'id' | 'invitedAt'>): Promise<LeaderboardMemberData>;
  getLeaderboardMembers(leaderboardId: string): Promise<LeaderboardMemberData[]>;
  isLeaderboardMember(leaderboardId: string, characterId: number): Promise<boolean>;
  removeLeaderboardMember(leaderboardId: string, characterId: number): Promise<void>;
  getLeaderboardRankings(leaderboardId: string, rankBy: string, timeFrame: string): Promise<LeaderboardRanking[]>;
  
  // User unlocks methods
  getUserUnlocks(characterId: number): Promise<UserUnlocks | undefined>;
  addUserUnlock(characterId: number, theme?: FactionTheme, tiles?: BonusTile[]): Promise<UserUnlocks>;
  
  // Dynamic admin methods
  addDynamicAdmin(admin: Omit<DynamicAdminData, 'id' | 'addedAt'>): Promise<DynamicAdminData>;
  removeDynamicAdmin(characterId: number): Promise<DynamicAdminData | undefined>;
  getDynamicAdmins(): Promise<DynamicAdminData[]>;
  isDynamicAdmin(characterId: number): Promise<boolean>;
  
  // PRO notification email methods
  addProNotificationEmail(email: string, addedByCharacterId: number, addedByCharacterName: string): Promise<ProNotificationEmailData>;
  removeProNotificationEmail(id: string): Promise<boolean>;
  getProNotificationEmails(): Promise<ProNotificationEmailData[]>;
  toggleProNotificationEmail(id: string, isActive: boolean): Promise<ProNotificationEmailData | undefined>;
  
  // Pending payment methods
  createPendingPayment(payment: {
    characterId: number;
    characterName: string;
    planType: 'weekly' | 'monthly';
    iskAmount: number;
    expiresAt: Date;
  }): Promise<PendingPaymentData>;
  getPendingPaymentByCode(referenceCode: string): Promise<PendingPaymentData | undefined>;
  getPendingPaymentsByCharacter(characterId: number): Promise<PendingPaymentData[]>;
  getActivePendingPayment(characterId: number): Promise<PendingPaymentData | undefined>;
  completePendingPayment(referenceCode: string, transactionId: number): Promise<PendingPaymentData | undefined>;
  expirePendingPayments(): Promise<number>;
  
  // Ratting session methods
  createRattingSession(session: {
    characterId: number;
    characterName: string;
    startTime: Date;
  }): Promise<RattingSessionData>;
  getActiveSession(characterId: number): Promise<RattingSessionData | undefined>;
  getRattingSessions(characterId: number, limit?: number): Promise<RattingSessionData[]>;
  getRattingSessionById(sessionId: string): Promise<RattingSessionData | undefined>;
  updateRattingSession(sessionId: string, updates: Partial<RattingSessionData>): Promise<RattingSessionData | undefined>;
  endRattingSession(sessionId: string, endTime: Date, totals: {
    totalIsk: number;
    bountyIsk: number;
    lootIsk?: number;
    killCount?: number;
  }): Promise<RattingSessionData | undefined>;
  deleteRattingSession(sessionId: string, characterId: number): Promise<boolean>;
  
  // Admin session methods
  getAllRattingSessions(options?: {
    limit?: number;
    offset?: number;
    characterName?: string;
    isActive?: boolean;
    minIsk?: number;
    maxIsk?: number;
  }): Promise<{ sessions: RattingSessionData[]; total: number }>;
  adminUpdateRattingSession(sessionId: string, updates: Partial<RattingSessionData>): Promise<RattingSessionData | undefined>;
  adminDeleteRattingSession(sessionId: string): Promise<boolean>;
  getSessionStatistics(): Promise<{
    totalSessions: number;
    activeSessions: number;
    totalIskEarned: number;
    totalKills: number;
    uniqueUsers: number;
  }>;
  
  // Loot entry methods (aggregated by item type per session)
  upsertLootEntry(entry: {
    sessionId: string;
    characterId: number;
    itemTypeId: number;
    itemTypeName: string;
    quantity: number;
    estimatedPrice: number;
    totalValue: number;
  }): Promise<LootEntryData>;
  getLootEntriesBySession(sessionId: string): Promise<LootEntryData[]>;
  clearSessionLoot(sessionId: string): Promise<number>;
  commitLootToSession(sessionId: string, lootTotal: number): Promise<RattingSessionData | undefined>;

  // PHOTON Code methods
  createPhotonCode(code: {
    code: string;
    codeType: string;
    createdByAdminId: number;
    createdByAdminName: string;
    maxRedemptions: number;
    expiresAt: Date | null;
    proDurationDays: number | null;
    badgeGrants: string[];
    themeUnlocks: string[];
    tileUnlocks: string[];
    note: string | null;
  }): Promise<PhotonCodeData>;
  getPhotonCode(code: string): Promise<PhotonCodeData | undefined>;
  getPhotonCodeById(id: string): Promise<PhotonCodeData | undefined>;
  getAllPhotonCodes(options?: { limit?: number; offset?: number; status?: string }): Promise<{ codes: PhotonCodeData[]; total: number }>;
  updatePhotonCodeStatus(codeId: string, status: string): Promise<PhotonCodeData | undefined>;
  incrementCodeRedemption(codeId: string): Promise<PhotonCodeData | undefined>;
  revokePhotonCode(codeId: string): Promise<PhotonCodeData | undefined>;

  // PHOTON Code redemption methods
  createPhotonRedemption(redemption: {
    codeId: string;
    code: string;
    characterId: number;
    characterName: string;
  }): Promise<PhotonRedemptionData>;
  getRedemptionsByCode(codeId: string): Promise<PhotonRedemptionData[]>;
  getRedemptionsByCharacter(characterId: number): Promise<PhotonRedemptionData[]>;
  hasCharacterRedeemedCode(codeId: string, characterId: number): Promise<boolean>;

  // PHOTON Activity log methods
  logPhotonActivity(log: {
    codeId: string | null;
    code: string;
    action: string;
    actorCharacterId: number;
    actorCharacterName: string;
    targetCharacterId?: number;
    targetCharacterName?: string;
    details?: Record<string, unknown>;
  }): Promise<PhotonActivityLogData>;
  getPhotonActivityLog(options?: { limit?: number; offset?: number; action?: string; codeId?: string }): Promise<{ logs: PhotonActivityLogData[]; total: number }>;

  // Support Ticket methods
  createSupportTicket(ticket: {
    characterId: number;
    characterName: string;
    corporationId?: number;
    corporationName?: string;
    allianceId?: number;
    allianceName?: string;
    subject: string;
    message: string;
    category: string;
    priority?: string;
    attachments?: TicketAttachment[];
    isPro: boolean;
  }): Promise<SupportTicketData>;
  getSupportTicket(ticketId: string): Promise<SupportTicketData | undefined>;
  getSupportTicketsByCharacter(characterId: number): Promise<SupportTicketData[]>;
  getAllSupportTickets(options?: {
    limit?: number;
    offset?: number;
    status?: string;
    category?: string;
    priority?: string;
  }): Promise<{ tickets: SupportTicketData[]; total: number }>;
  updateSupportTicketStatus(ticketId: string, status: string, adminId?: number, adminName?: string): Promise<SupportTicketData | undefined>;
  updateSupportTicketNotes(ticketId: string, notes: string): Promise<SupportTicketData | undefined>;
  assignSupportTicket(ticketId: string, adminId: number, adminName: string): Promise<SupportTicketData | undefined>;
  getSupportTicketStatistics(): Promise<{
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
    byCategory: Record<string, number>;
    byPriority: Record<string, number>;
  }>;

  // Ticket Reply methods
  createTicketReply(reply: {
    ticketId: string;
    characterId: number;
    characterName: string;
    message: string;
    isAdmin: boolean;
    attachments?: TicketAttachment[];
  }): Promise<TicketReplyData>;
  getTicketReplies(ticketId: string): Promise<TicketReplyData[]>;
  getTicketReply(replyId: string): Promise<TicketReplyData | undefined>;
  updateTicketMessage(ticketId: string, message: string): Promise<SupportTicketData | undefined>;
  updateTicketReply(replyId: string, message: string): Promise<TicketReplyData | undefined>;

  // Ticket Notification methods
  createTicketNotification(notification: {
    ticketId: string;
    replyId?: string;
    recipientCharacterId: number;
    type: string;
    message: string;
  }): Promise<TicketNotificationData>;
  getUnreadNotifications(characterId: number): Promise<TicketNotificationData[]>;
  getUnreadNotificationCount(characterId: number): Promise<number>;
  markNotificationRead(notificationId: string): Promise<void>;
  markAllNotificationsRead(characterId: number, ticketId?: string): Promise<void>;

  // Admin Notes methods
  createAdminNote(note: {
    targetCharacterId: number;
    targetCharacterName: string;
    authorCharacterId: number;
    authorCharacterName: string;
    content: string;
    isPinned?: boolean;
  }): Promise<AdminNoteData>;
  getAdminNotes(targetCharacterId: number): Promise<AdminNoteData[]>;
  updateAdminNote(noteId: string, updates: { content?: string; isPinned?: boolean }): Promise<AdminNoteData | undefined>;
  deleteAdminNote(noteId: string): Promise<boolean>;
  getAdminNoteById(noteId: string): Promise<AdminNoteData | undefined>;

  // User Suspension methods
  createSuspension(suspension: {
    characterId: number;
    characterName: string;
    suspendedByAdminId: number;
    suspendedByAdminName: string;
    reason: string;
    expiresAt?: Date | null;
  }): Promise<UserSuspensionData>;
  getActiveSuspension(characterId: number): Promise<UserSuspensionData | undefined>;
  getSuspensionHistory(characterId: number): Promise<UserSuspensionData[]>;
  liftSuspension(suspensionId: string, liftedByAdminId: number, liftedByAdminName: string): Promise<UserSuspensionData | undefined>;
  getAllActiveSuspensions(): Promise<UserSuspensionData[]>;

  // Admin Audit Log methods
  createAuditLog(log: {
    adminCharacterId: number;
    adminCharacterName: string;
    action: string;
    targetCharacterId?: number;
    targetCharacterName?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
  }): Promise<AdminAuditLogData>;
  getAuditLog(options?: {
    limit?: number;
    offset?: number;
    adminCharacterId?: number;
    targetCharacterId?: number;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ logs: AdminAuditLogData[]; total: number }>;
  getAuditLogForUser(targetCharacterId: number, limit?: number): Promise<AdminAuditLogData[]>;

  // User management methods for admin panel
  getAllUsers(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    activeOnly?: boolean;
    adminsOnly?: boolean;
    suspendedOnly?: boolean;
    proOnly?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ users: UserManagementData[]; total: number }>;
  getUserDetails(characterId: number): Promise<UserDetailData | undefined>;
  getActiveUsersCount(): Promise<number>;

  // Linked characters methods for multiboxing support
  linkCharacter(data: InsertLinkedCharacter): Promise<LinkedCharacter>;
  unlinkCharacter(primaryCharacterId: number, characterId: number): Promise<void>;
  getLinkedCharacters(primaryCharacterId: number): Promise<LinkedCharacter[]>;
  getLinkedCharacter(characterId: number): Promise<LinkedCharacter | undefined>;
  isCharacterLinked(characterId: number): Promise<boolean>;
  updateLinkedCharacterTokens(characterId: number, tokens: {
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
  }): Promise<void>;
  updateLinkedCharacterLastUsed(characterId: number): Promise<void>;
  getPrimaryCharacterId(characterId: number): Promise<number | undefined>;

  // Income goals methods
  getIncomeGoals(characterId: number): Promise<IncomeGoalData | undefined>;
  upsertIncomeGoals(data: {
    characterId: number;
    characterName: string;
    dailyTarget: number;
    weeklyTarget: number;
    monthlyTarget: number;
  }): Promise<IncomeGoalData>;
  getIncomeEarnings(characterId: number, period: 'daily' | 'weekly' | 'monthly'): Promise<number>;

  // Moon Calculator data methods
  getUserMoons(characterId: number): Promise<UserMoon[]>;
  createUserMoon(data: InsertUserMoon): Promise<UserMoon>;
  updateUserMoon(moonId: string, characterId: number, updates: { notes?: string; isFavorite?: boolean }): Promise<UserMoon | undefined>;
  deleteUserMoon(moonId: string, characterId: number): Promise<boolean>;
  getUserMoonPrices(characterId: number): Promise<UserMoonPrices | undefined>;
  saveUserMoonPrices(characterId: number, prices: Record<string, number>): Promise<UserMoonPrices>;

  // Industry Jobs methods
  getIndustryJobs(characterId: number, options?: { status?: string; activityId?: number }): Promise<IndustryJobData[]>;
  getIndustryJobsForCharacters(characterIds: number[], options?: { status?: string; activityId?: number }): Promise<IndustryJobData[]>;
  upsertIndustryJob(job: Omit<IndustryJobData, 'id' | 'cachedAt' | 'updatedAt'>): Promise<IndustryJobData>;
  upsertIndustryJobs(jobs: Omit<IndustryJobData, 'id' | 'cachedAt' | 'updatedAt'>[]): Promise<IndustryJobData[]>;
  deleteStaleIndustryJobs(characterId: number, currentJobIds: number[]): Promise<number>;
  getIndustryJobStats(characterId: number): Promise<{
    activeJobs: number;
    completedToday: number;
    totalProfit: number;
    avgIskPerHour: number;
  }>;

  // Planetary Industry methods
  getPlanetaryPlanets(characterId: number): Promise<PlanetaryPlanetData[]>;
  getPlanetaryPlanetsForCharacters(characterIds: number[]): Promise<PlanetaryPlanetData[]>;
  upsertPlanetaryPlanet(planet: Omit<PlanetaryPlanetData, 'id' | 'cachedAt' | 'updatedAt'>): Promise<PlanetaryPlanetData>;
  deleteStalePlanetaryPlanets(characterId: number, currentPlanetIds: number[]): Promise<number>;
  getPlanetaryPins(characterId: number, planetId: number): Promise<PlanetaryPinData[]>;
  getPlanetaryPinsForCharacter(characterId: number): Promise<PlanetaryPinData[]>;
  upsertPlanetaryPins(characterId: number, planetId: number, pins: Omit<PlanetaryPinData, 'id' | 'cachedAt'>[]): Promise<void>;
  deletePlanetaryPins(characterId: number, planetId: number): Promise<void>;

  // Changelog methods
  getPublishedChangelogs(): Promise<ChangelogVersionData[]>;
  getLatestPublishedChangelog(): Promise<ChangelogVersionData | undefined>;
  getAllChangelogs(): Promise<ChangelogVersionData[]>;
  getChangelogVersion(versionId: string): Promise<ChangelogVersionData | undefined>;
  createChangelogVersion(data: {
    version: string;
    title: string;
    releaseDate: string;
    isPublished?: boolean;
    createdByAdminId?: number;
    createdByAdminName?: string;
  }): Promise<ChangelogVersionData>;
  updateChangelogVersion(versionId: string, updates: {
    version?: string;
    title?: string;
    releaseDate?: string;
    isPublished?: boolean;
  }): Promise<ChangelogVersionData | undefined>;
  deleteChangelogVersion(versionId: string): Promise<boolean>;
  publishChangelogVersion(versionId: string): Promise<ChangelogVersionData | undefined>;
  getChangelogItems(versionId: string, includeAdminOnly?: boolean): Promise<ChangelogItemData[]>;
  createChangelogItem(data: {
    versionId: string;
    changeType: string;
    iconKey?: string;
    text: string;
    sortOrder?: number;
    isProOnly?: boolean;
    isAdminOnly?: boolean;
  }): Promise<ChangelogItemData>;
  updateChangelogItem(itemId: string, updates: {
    changeType?: string;
    iconKey?: string;
    text?: string;
    sortOrder?: number;
    isProOnly?: boolean;
    isAdminOnly?: boolean;
  }): Promise<ChangelogItemData | undefined>;
  deleteChangelogItem(itemId: string): Promise<boolean>;
  reorderChangelogItems(versionId: string, itemIds: string[]): Promise<void>;

  // ESI Name Cache methods (per-character for privacy compliance)
  getEsiNames(characterId: number, ids: number[]): Promise<Map<number, { name: string; category: string }>>;
  cacheEsiNames(characterId: number, entries: { id: number; name: string; category: string }[]): Promise<void>;

  // Market Intelligence methods
  getMonitoredStations(characterId: number): Promise<MonitoredStation[]>;
  getMonitoredStation(id: string, characterId: number): Promise<MonitoredStation | undefined>;
  addMonitoredStation(data: InsertMonitoredStation): Promise<MonitoredStation>;
  removeMonitoredStation(id: string, characterId: number): Promise<void>;
  updateMonitoredStationFetchTime(id: string): Promise<void>;

  getWatchlists(characterId: number, stationId?: string): Promise<Watchlist[]>;
  getWatchlist(id: string, characterId: number): Promise<Watchlist | undefined>;
  createWatchlist(data: InsertWatchlist): Promise<Watchlist>;
  deleteWatchlist(id: string, characterId: number): Promise<void>;
  getWatchlistItems(watchlistId: string): Promise<WatchlistItem[]>;
  addWatchlistItem(data: InsertWatchlistItem): Promise<WatchlistItem>;
  removeWatchlistItem(id: string): Promise<void>;

  upsertMarketSnapshot(data: InsertMarketSnapshot): Promise<MarketSnapshot>;
  getMarketSnapshotsByTypes(monitoredStationId: string, typeIds: number[]): Promise<MarketSnapshot[]>;
  upsertJitaReferencePrice(data: InsertJitaReferencePrice): Promise<JitaReferencePrice>;
  getJitaReferencePrices(typeIds: number[]): Promise<JitaReferencePrice[]>;
}

// Income goal data type
export interface IncomeGoalData {
  id: string;
  characterId: number;
  characterName: string;
  dailyTarget: number;
  weeklyTarget: number;
  monthlyTarget: number;
  createdAt: Date;
  updatedAt: Date;
}

// Industry job data type
export interface IndustryJobData {
  id: string;
  characterId: number;
  characterName: string;
  jobId: number;
  activityId: number;
  blueprintId: number;
  blueprintTypeId: number;
  blueprintTypeName: string;
  productTypeId: number | null;
  productTypeName: string | null;
  facilityId: number | null;
  stationId: number | null;
  locationName: string | null;
  runs: number;
  licensedRuns: number | null;
  probability: number | null;
  successfulRuns: number | null;
  startDate: Date;
  endDate: Date;
  completedDate: Date | null;
  status: string;
  cost: number | null;
  materialCost: number | null;
  outputValue: number | null;
  estimatedProfit: number | null;
  iskPerHour: number | null;
  cachedAt: Date;
  updatedAt: Date;
}

// Planetary planet data type
export interface PlanetaryPlanetData {
  id: string;
  characterId: number;
  characterName: string;
  planetId: number;
  planetName: string;
  planetTypeId: number;
  planetTypeName: string;
  solarSystemId: number;
  solarSystemName: string;
  upgradeLevel: number;
  numPins: number;
  lastUpdate: Date | null;
  cachedAt: Date;
  updatedAt: Date;
}

// Planetary pin data type
export interface PlanetaryPinData {
  id: string;
  characterId: number;
  planetId: number;
  pinId: number;
  typeId: number;
  typeName: string;
  schematicId: number | null;
  schematicName: string | null;
  extractorProductTypeId: number | null;
  extractorProductName: string | null;
  cycleTime: number | null;
  headRadius: number | null;
  numHeads: number | null;
  quantityPerCycle: number | null;
  installTime: Date | null;
  expiryTime: Date | null;
  contentsJson: Array<{typeId: number; typeName: string; quantity: number}> | null;
  capacity: number | null;
  usedCapacity: number | null;
  latitude: number | null;
  longitude: number | null;
  cachedAt: Date;
}

// Loot entry data type
export interface LootEntryData {
  id: string;
  sessionId: string;
  characterId: number;
  itemTypeId: number;
  itemTypeName: string;
  quantity: number;
  estimatedPrice: number;
  totalValue: number;
  createdAt: Date;
}

// Changelog version data type
export interface ChangelogVersionData {
  id: string;
  version: string;
  title: string;
  releaseDate: string;
  isPublished: boolean;
  createdAt: Date;
  publishedAt: Date | null;
  createdByAdminId: number | null;
  createdByAdminName: string | null;
  items?: ChangelogItemData[];
}

// Changelog item data type
export interface ChangelogItemData {
  id: string;
  versionId: string;
  changeType: string;
  iconKey: string | null;
  text: string;
  sortOrder: number;
  isProOnly: boolean;
  isAdminOnly: boolean;
  createdAt: Date;
}

// PHOTON Code data structures
export interface PhotonCodeData {
  id: string;
  code: string;
  codeType: string;
  createdByAdminId: number;
  createdByAdminName: string;
  status: string;
  maxRedemptions: number;
  currentRedemptions: number;
  expiresAt: Date | null;
  proDurationDays: number | null;
  badgeGrants: string[];
  themeUnlocks: string[];
  tileUnlocks: string[];
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PhotonRedemptionData {
  id: string;
  codeId: string;
  code: string;
  characterId: number;
  characterName: string;
  redeemedAt: Date;
}

export interface PhotonActivityLogData {
  id: string;
  codeId: string | null;
  code: string;
  action: string;
  actorCharacterId: number;
  actorCharacterName: string;
  targetCharacterId: number | null;
  targetCharacterName: string | null;
  details: Record<string, unknown>;
  createdAt: Date;
}

// Support ticket data structures
export interface SupportTicketData {
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
  messageEditedAt?: Date | null;
  category: string;
  priority: string;
  status: string;
  attachments: TicketAttachment[];
  isPro: boolean;
  adminNotes: string | null;
  assignedToAdminId: number | null;
  assignedToAdminName: string | null;
  resolvedAt: Date | null;
  resolvedByAdminId: number | null;
  resolvedByAdminName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketReplyData {
  id: string;
  ticketId: string;
  characterId: number;
  characterName: string;
  message: string;
  isAdmin: boolean;
  attachments: TicketAttachment[];
  editedAt?: Date | null;
  createdAt: Date;
}

export interface TicketNotificationData {
  id: string;
  ticketId: string;
  replyId: string | null;
  recipientCharacterId: number;
  type: string;
  isRead: boolean;
  message: string;
  createdAt: Date;
}

// Admin Notes data structure
export interface AdminNoteData {
  id: string;
  targetCharacterId: number;
  targetCharacterName: string;
  authorCharacterId: number;
  authorCharacterName: string;
  content: string;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// User Suspension data structure
export interface UserSuspensionData {
  id: string;
  characterId: number;
  characterName: string;
  suspendedByAdminId: number;
  suspendedByAdminName: string;
  reason: string;
  expiresAt: Date | null;
  liftedAt: Date | null;
  liftedByAdminId: number | null;
  liftedByAdminName: string | null;
  isActive: boolean;
  createdAt: Date;
}

// Admin Audit Log data structure
export interface AdminAuditLogData {
  id: string;
  adminCharacterId: number;
  adminCharacterName: string;
  action: string;
  targetCharacterId: number | null;
  targetCharacterName: string | null;
  details: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: Date;
}

// User management data for admin panel
export interface UserManagementData {
  characterId: number;
  characterName: string;
  firstLoginAt: Date;
  lastActiveAt: Date | null;
  isOnline: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isPro: boolean;
  proExpiresAt: Date | null;
  isSuspended: boolean;
  suspensionReason: string | null;
  sessionCount: number;
  totalIsk: number;
  hasNotes: boolean;
}

// Detailed user data for admin panel
export interface UserDetailData {
  characterId: number;
  characterName: string;
  corporationId: number | null;
  corporationName: string | null;
  allianceId: number | null;
  allianceName: string | null;
  firstLoginAt: Date;
  lastActiveAt: Date | null;
  isOnline: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isPro: boolean;
  proExpiresAt: Date | null;
  proActivatedAt: Date | null;
  isSuspended: boolean;
  activeSuspension: UserSuspensionData | null;
  corpTaxRate: number;
  theme: string;
  sessionCount: number;
  totalIsk: number;
  totalKills: number;
  averageIskPerHour: number;
  totalTimePlayedMinutes: number;
  recentSessions: RattingSessionData[];
  badges: SpecialBadgeData[];
  notes: AdminNoteData[];
  adminHistory: AdminAuditLogData[];
  unlocks: UserUnlocks | null;
  promotedByAdminName: string | null;
  promotedAt: Date | null;
}

// Generate a secure, readable activation code
function generateActivationCode(): string {
  const bytes = randomBytes(6);
  const code = bytes.toString("hex").toUpperCase();
  return `PRO-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}

// Generate a unique gift reference code for admin gifts
function generateGiftReferenceCode(): string {
  const bytes = randomBytes(4);
  const code = bytes.toString("hex").toUpperCase();
  return `GIFT-${code.slice(0, 4)}-${code.slice(4, 8)}`;
}

// Generate a unique payment reference code for ISK payments
function generatePaymentReferenceCode(): string {
  const bytes = randomBytes(4);
  const code = bytes.toString("hex").toUpperCase();
  return `RT-${code.slice(0, 4)}-${code.slice(4, 8)}`;
}

// Generate PHOTON activation code in format PHOTON-XXXX-XXXX-XXXX
// Uses base-32 alphabet (no 0,1,I,L,O to avoid confusion)
const PHOTON_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // 32 chars
function generatePhotonCode(): string {
  const bytes = randomBytes(12);
  let code = "";
  for (let i = 0; i < 12; i++) {
    code += PHOTON_ALPHABET[bytes[i] % 32];
  }
  return `PHOTON-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private proSubscriptions: Map<number, ProSubscription>;
  private activationCodes: Map<string, ProActivationCode>;
  private gifts: Map<string, ProGift>;
  private processedTransactions: Set<number>;
  private specialBadges: Map<string, SpecialBadgeData>;
  private userProfiles: Map<number, UserProfile>;
  private sessionCards: Map<string, SessionCardData>;
  private leaderboards: Map<string, LeaderboardData>;
  private leaderboardMembers: Map<string, LeaderboardMemberData>;
  private userUnlocks: Map<number, UserUnlocks>;
  private dynamicAdminsMap: Map<number, DynamicAdminData>;
  private pendingPayments: Map<string, PendingPaymentData>;
  private rattingSessions: Map<string, RattingSessionData>;
  private lootEntries: Map<string, LootEntryData>;
  private adminNotesMap: Map<string, AdminNoteData>;
  private userSuspensionsMap: Map<string, UserSuspensionData>;
  private adminAuditLogMap: Map<string, AdminAuditLogData>;

  constructor() {
    this.users = new Map();
    this.proSubscriptions = new Map();
    this.activationCodes = new Map();
    this.gifts = new Map();
    this.processedTransactions = new Set();
    this.specialBadges = new Map();
    this.userProfiles = new Map();
    this.sessionCards = new Map();
    this.leaderboards = new Map();
    this.leaderboardMembers = new Map();
    this.userUnlocks = new Map();
    this.dynamicAdminsMap = new Map();
    this.pendingPayments = new Map();
    this.rattingSessions = new Map();
    this.lootEntries = new Map();
    this.adminNotesMap = new Map();
    this.userSuspensionsMap = new Map();
    this.adminAuditLogMap = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // PRO Subscription methods
  async getProSubscription(characterId: number): Promise<ProSubscription | undefined> {
    const sub = this.proSubscriptions.get(characterId);
    if (sub && sub.expiresAt && new Date() > sub.expiresAt) {
      sub.status = "expired";
      this.proSubscriptions.set(characterId, sub);
    }
    return sub;
  }

  async createOrUpdateProSubscription(subscription: ProSubscription): Promise<ProSubscription> {
    this.proSubscriptions.set(subscription.characterId, subscription);
    return subscription;
  }

  // Activation code methods
  async getActivationCode(code: string): Promise<ProActivationCode | undefined> {
    const codeData = this.activationCodes.get(code);
    if (codeData && codeData.status === "pending" && new Date() > codeData.expiresAt) {
      codeData.status = "expired";
      this.activationCodes.set(code, codeData);
    }
    return codeData;
  }

  async getActiveCodeForCharacter(characterId: number): Promise<ProActivationCode | undefined> {
    const codes = Array.from(this.activationCodes.values());
    return codes.find(
      c => c.characterId === characterId && c.status === "pending" && new Date() < c.expiresAt
    );
  }

  async createActivationCode(codeData: ProActivationCode): Promise<ProActivationCode> {
    this.activationCodes.set(codeData.code, codeData);
    return codeData;
  }

  async markCodeAsUsed(code: string): Promise<void> {
    const codeData = this.activationCodes.get(code);
    if (codeData) {
      codeData.status = "used";
      codeData.usedAt = new Date();
      this.activationCodes.set(code, codeData);
    }
  }

  // Gift methods
  async createGift(gift: ProGift): Promise<ProGift> {
    this.gifts.set(gift.id, gift);
    return gift;
  }

  async getGiftsForCharacter(characterId: number): Promise<ProGift[]> {
    return Array.from(this.gifts.values()).filter(
      g => g.recipientCharacterId === characterId
    );
  }

  async getAllGifts(): Promise<ProGift[]> {
    return Array.from(this.gifts.values()).sort(
      (a, b) => b.giftedAt.getTime() - a.giftedAt.getTime()
    );
  }

  // Get all pending activation codes for auto-verification
  async getAllPendingCodes(): Promise<ProActivationCode[]> {
    const now = new Date();
    return Array.from(this.activationCodes.values()).filter(
      c => c.status === "pending" && now < c.expiresAt
    );
  }

  // Processed transactions tracking to avoid duplicate processing
  async isTransactionProcessed(transactionId: number): Promise<boolean> {
    return this.processedTransactions.has(transactionId);
  }

  async markTransactionProcessed(transactionId: number): Promise<void> {
    this.processedTransactions.add(transactionId);
  }

  // Get all subscriptions for admin view
  async getAllSubscriptions(): Promise<ProSubscription[]> {
    const now = new Date();
    const subs = Array.from(this.proSubscriptions.values());
    
    // Update expired statuses
    for (const sub of subs) {
      if (sub.expiresAt && now > sub.expiresAt && sub.status === "active") {
        sub.status = "expired";
        this.proSubscriptions.set(sub.characterId, sub);
      }
    }
    
    return subs.sort((a, b) => {
      // Active subscriptions first, then by expiry date
      if (a.status === "active" && b.status !== "active") return -1;
      if (b.status === "active" && a.status !== "active") return 1;
      if (a.expiresAt && b.expiresAt) {
        return b.expiresAt.getTime() - a.expiresAt.getTime();
      }
      return 0;
    });
  }

  // Get all activation codes for admin view
  async getAllActivationCodes(): Promise<ProActivationCode[]> {
    const now = new Date();
    const codes = Array.from(this.activationCodes.values());
    
    // Update expired statuses
    for (const code of codes) {
      if (code.status === "pending" && now > code.expiresAt) {
        code.status = "expired";
        this.activationCodes.set(code.code, code);
      }
    }
    
    return codes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Get admin statistics
  async getStatistics(): Promise<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    expiredSubscriptions: number;
    pendingCodes: number;
    usedCodes: number;
    totalGifts: number;
    processedTransactions: number;
  }> {
    const subs = await this.getAllSubscriptions();
    const codes = await this.getAllActivationCodes();
    const gifts = await this.getAllGifts();
    
    return {
      totalSubscriptions: subs.length,
      activeSubscriptions: subs.filter(s => s.status === "active").length,
      expiredSubscriptions: subs.filter(s => s.status === "expired").length,
      pendingCodes: codes.filter(c => c.status === "pending").length,
      usedCodes: codes.filter(c => c.status === "used").length,
      totalGifts: gifts.length,
      processedTransactions: this.processedTransactions.size,
    };
  }

  // Revoke a subscription
  async revokeSubscription(characterId: number): Promise<void> {
    const sub = this.proSubscriptions.get(characterId);
    if (sub) {
      sub.status = "revoked";
      sub.expiresAt = new Date();
      this.proSubscriptions.set(characterId, sub);
    }
  }

  // Extend a subscription (does not extend revoked subscriptions)
  async extendSubscription(characterId: number, days: number): Promise<ProSubscription | undefined> {
    const sub = this.proSubscriptions.get(characterId);
    if (!sub) return undefined;
    
    // Don't allow extending revoked subscriptions
    if (sub.status === "revoked") {
      return undefined;
    }
    
    const now = new Date();
    const baseDate = sub.status === "active" && sub.expiresAt && sub.expiresAt > now 
      ? sub.expiresAt 
      : now;
    
    sub.expiresAt = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
    sub.status = "active";
    this.proSubscriptions.set(characterId, sub);
    
    return sub;
  }

  // Special badges methods
  async grantSpecialBadge(badge: Omit<SpecialBadgeData, 'id' | 'grantedAt'>): Promise<SpecialBadgeData> {
    const id = randomUUID();
    const badgeKey = `${badge.characterId}-${badge.badgeType}`;
    
    const newBadge: SpecialBadgeData = {
      ...badge,
      id,
      grantedAt: new Date(),
    };
    
    this.specialBadges.set(badgeKey, newBadge);
    return newBadge;
  }

  async revokeSpecialBadge(characterId: number, badgeType: SpecialBadgeType): Promise<void> {
    const badgeKey = `${characterId}-${badgeType}`;
    this.specialBadges.delete(badgeKey);
  }

  async getSpecialBadges(characterId: number): Promise<SpecialBadgeData[]> {
    return Array.from(this.specialBadges.values()).filter(
      b => b.characterId === characterId
    ).sort((a, b) => a.grantedAt.getTime() - b.grantedAt.getTime());
  }

  async getAllSpecialBadges(): Promise<SpecialBadgeData[]> {
    return Array.from(this.specialBadges.values()).sort(
      (a, b) => b.grantedAt.getTime() - a.grantedAt.getTime()
    );
  }

  async hasSpecialBadge(characterId: number, badgeType: SpecialBadgeType): Promise<boolean> {
    const badgeKey = `${characterId}-${badgeType}`;
    return this.specialBadges.has(badgeKey);
  }

  // User profile methods
  async getUserProfile(characterId: number): Promise<UserProfile | undefined> {
    return this.userProfiles.get(characterId);
  }

  async createOrUpdateUserProfile(profile: UserProfile): Promise<UserProfile> {
    const existing = this.userProfiles.get(profile.characterId);
    if (existing) {
      // Preserve firstLoginAt, update other fields
      const updated: UserProfile = {
        ...existing,
        characterName: profile.characterName,
        corpTaxRate: profile.corpTaxRate,
      };
      this.userProfiles.set(profile.characterId, updated);
      return updated;
    }
    this.userProfiles.set(profile.characterId, profile);
    return profile;
  }

  async updateCorpTaxRate(characterId: number, taxRate: number): Promise<void> {
    const profile = this.userProfiles.get(characterId);
    if (profile) {
      profile.corpTaxRate = taxRate;
      this.userProfiles.set(characterId, profile);
    }
  }

  async updateUserNotificationPreferences(characterId: number, prefs: {
    emailNotifications?: boolean;
    proExpiryReminders?: boolean;
    supportTicketUpdates?: boolean;
  }): Promise<void> {
    const profile = this.userProfiles.get(characterId);
    if (profile) {
      if (prefs.emailNotifications !== undefined) profile.emailNotifications = prefs.emailNotifications;
      if (prefs.proExpiryReminders !== undefined) profile.proExpiryReminders = prefs.proExpiryReminders;
      if (prefs.supportTicketUpdates !== undefined) profile.supportTicketUpdates = prefs.supportTicketUpdates;
      this.userProfiles.set(characterId, profile);
    }
  }

  // Session card methods
  async createSessionCard(card: Omit<SessionCardData, 'id' | 'viewCount' | 'createdAt'>): Promise<SessionCardData> {
    const id = randomUUID();
    const newCard: SessionCardData = {
      ...card,
      id,
      viewCount: 0,
      createdAt: new Date(),
    };
    this.sessionCards.set(id, newCard);
    return newCard;
  }

  async getSessionCardByCode(shareCode: string): Promise<SessionCardData | undefined> {
    return Array.from(this.sessionCards.values()).find(
      c => c.shareCode === shareCode
    );
  }

  async getSessionCardsByCharacter(characterId: number): Promise<SessionCardData[]> {
    return Array.from(this.sessionCards.values())
      .filter(c => c.characterId === characterId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async incrementSessionCardViews(cardId: string): Promise<void> {
    const card = this.sessionCards.get(cardId);
    if (card) {
      card.viewCount += 1;
      this.sessionCards.set(cardId, card);
    }
  }

  async deleteSessionCard(cardId: string, characterId: number): Promise<void> {
    const card = this.sessionCards.get(cardId);
    if (card && card.characterId === characterId) {
      this.sessionCards.delete(cardId);
    }
  }

  // Leaderboard methods
  async createLeaderboard(data: Omit<LeaderboardData, 'id' | 'createdAt'>): Promise<LeaderboardData> {
    const id = randomUUID();
    const newLeaderboard: LeaderboardData = {
      ...data,
      id,
      createdAt: new Date(),
    };
    this.leaderboards.set(id, newLeaderboard);
    return newLeaderboard;
  }

  async getLeaderboardById(id: string): Promise<LeaderboardData | undefined> {
    return this.leaderboards.get(id);
  }

  async getPublicLeaderboards(): Promise<LeaderboardData[]> {
    return Array.from(this.leaderboards.values())
      .filter(l => l.isPublic)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getUserLeaderboards(characterId: number): Promise<LeaderboardData[]> {
    const memberOfIds = new Set(
      Array.from(this.leaderboardMembers.values())
        .filter(m => m.characterId === characterId && m.status === "accepted")
        .map(m => m.leaderboardId)
    );
    
    return Array.from(this.leaderboards.values())
      .filter(l => l.creatorCharacterId === characterId || memberOfIds.has(l.id))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async deleteLeaderboard(id: string): Promise<void> {
    this.leaderboards.delete(id);
    // Also delete all members
    const entries = Array.from(this.leaderboardMembers.entries());
    for (const [key, member] of entries) {
      if (member.leaderboardId === id) {
        this.leaderboardMembers.delete(key);
      }
    }
  }

  // Leaderboard member methods
  async addLeaderboardMember(member: Omit<LeaderboardMemberData, 'id' | 'invitedAt'>): Promise<LeaderboardMemberData> {
    const id = randomUUID();
    const newMember: LeaderboardMemberData = {
      ...member,
      id,
      invitedAt: new Date(),
    };
    this.leaderboardMembers.set(id, newMember);
    return newMember;
  }

  async getLeaderboardMembers(leaderboardId: string): Promise<LeaderboardMemberData[]> {
    return Array.from(this.leaderboardMembers.values())
      .filter(m => m.leaderboardId === leaderboardId)
      .sort((a, b) => a.invitedAt.getTime() - b.invitedAt.getTime());
  }

  async isLeaderboardMember(leaderboardId: string, characterId: number): Promise<boolean> {
    return Array.from(this.leaderboardMembers.values()).some(
      m => m.leaderboardId === leaderboardId && m.characterId === characterId
    );
  }

  async removeLeaderboardMember(leaderboardId: string, characterId: number): Promise<void> {
    const entries = Array.from(this.leaderboardMembers.entries());
    for (const [key, member] of entries) {
      if (member.leaderboardId === leaderboardId && member.characterId === characterId) {
        this.leaderboardMembers.delete(key);
        break;
      }
    }
  }

  async getLeaderboardRankings(leaderboardId: string, rankBy: string, timeFrame: string): Promise<LeaderboardRanking[]> {
    // Get all members of this leaderboard
    const members = await this.getLeaderboardMembers(leaderboardId);
    const acceptedMembers = members.filter(m => m.status === "accepted");
    
    // For now, return sample rankings based on members
    // In a real implementation, this would aggregate session data
    const rankings: LeaderboardRanking[] = acceptedMembers.map((member, index) => ({
      rank: index + 1,
      characterId: member.characterId,
      characterName: member.characterName,
      value: 0, // Would be calculated from session data
      sessions: 0, // Would be calculated from session data
    }));
    
    return rankings;
  }

  // User unlocks methods
  async getUserUnlocks(characterId: number): Promise<UserUnlocks | undefined> {
    return this.userUnlocks.get(characterId);
  }

  async addUserUnlock(characterId: number, theme?: FactionTheme, tiles?: BonusTile[]): Promise<UserUnlocks> {
    const existing = this.userUnlocks.get(characterId) || {
      characterId,
      unlockedThemes: [],
      unlockedTiles: [],
      updatedAt: new Date(),
    };

    // Add theme if provided and not already unlocked
    if (theme && !existing.unlockedThemes.includes(theme)) {
      existing.unlockedThemes.push(theme);
    }

    // Add tiles if provided, avoiding duplicates
    if (tiles && tiles.length > 0) {
      for (const tile of tiles) {
        if (!existing.unlockedTiles.includes(tile)) {
          existing.unlockedTiles.push(tile);
        }
      }
    }

    existing.updatedAt = new Date();
    this.userUnlocks.set(characterId, existing);
    return existing;
  }
  
  // Dynamic admin methods (in-memory fallback)
  async addDynamicAdmin(admin: Omit<DynamicAdminData, 'id' | 'addedAt'>): Promise<DynamicAdminData> {
    const id = randomUUID();
    const data: DynamicAdminData = {
      ...admin,
      id,
      addedAt: new Date(),
    };
    this.dynamicAdminsMap.set(admin.characterId, data);
    return data;
  }
  
  async removeDynamicAdmin(characterId: number): Promise<DynamicAdminData | undefined> {
    const admin = this.dynamicAdminsMap.get(characterId);
    this.dynamicAdminsMap.delete(characterId);
    return admin;
  }
  
  async getDynamicAdmins(): Promise<DynamicAdminData[]> {
    return Array.from(this.dynamicAdminsMap.values());
  }
  
  async isDynamicAdmin(characterId: number): Promise<boolean> {
    return this.dynamicAdminsMap.has(characterId);
  }

  // PRO notification email methods (in-memory)
  private proNotificationEmailsMap: Map<string, ProNotificationEmailData> = new Map();
  
  async addProNotificationEmail(email: string, addedByCharacterId: number, addedByCharacterName: string): Promise<ProNotificationEmailData> {
    const id = randomUUID();
    const data: ProNotificationEmailData = {
      id,
      email,
      addedByCharacterId,
      addedByCharacterName,
      isActive: true,
      addedAt: new Date(),
    };
    this.proNotificationEmailsMap.set(id, data);
    return data;
  }
  
  async removeProNotificationEmail(id: string): Promise<boolean> {
    return this.proNotificationEmailsMap.delete(id);
  }
  
  async getProNotificationEmails(): Promise<ProNotificationEmailData[]> {
    return Array.from(this.proNotificationEmailsMap.values());
  }
  
  async toggleProNotificationEmail(id: string, isActive: boolean): Promise<ProNotificationEmailData | undefined> {
    const email = this.proNotificationEmailsMap.get(id);
    if (email) {
      email.isActive = isActive;
      this.proNotificationEmailsMap.set(id, email);
    }
    return email;
  }

  // Pending payment methods
  async createPendingPayment(payment: {
    characterId: number;
    characterName: string;
    planType: 'weekly' | 'monthly';
    iskAmount: number;
    expiresAt: Date;
  }): Promise<PendingPaymentData> {
    const id = randomUUID();
    const referenceCode = generatePaymentReferenceCode();
    const now = new Date();
    
    const pendingPayment: PendingPaymentData = {
      id,
      referenceCode,
      characterId: payment.characterId,
      characterName: payment.characterName,
      planType: payment.planType,
      iskAmount: payment.iskAmount,
      status: 'pending',
      expiresAt: payment.expiresAt,
      completedAt: null,
      transactionId: null,
      createdAt: now,
    };
    
    this.pendingPayments.set(referenceCode, pendingPayment);
    return pendingPayment;
  }

  async getPendingPaymentByCode(referenceCode: string): Promise<PendingPaymentData | undefined> {
    return this.pendingPayments.get(referenceCode);
  }

  async getPendingPaymentsByCharacter(characterId: number): Promise<PendingPaymentData[]> {
    return Array.from(this.pendingPayments.values())
      .filter(p => p.characterId === characterId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getActivePendingPayment(characterId: number): Promise<PendingPaymentData | undefined> {
    const now = new Date();
    return Array.from(this.pendingPayments.values())
      .find(p => p.characterId === characterId && p.status === 'pending' && p.expiresAt > now);
  }

  async completePendingPayment(referenceCode: string, transactionId: number): Promise<PendingPaymentData | undefined> {
    const payment = this.pendingPayments.get(referenceCode);
    if (!payment || payment.status !== 'pending') return undefined;
    
    payment.status = 'completed';
    payment.completedAt = new Date();
    payment.transactionId = transactionId;
    this.pendingPayments.set(referenceCode, payment);
    return payment;
  }

  async expirePendingPayments(): Promise<number> {
    const now = new Date();
    let count = 0;
    for (const [code, payment] of Array.from(this.pendingPayments.entries())) {
      if (payment.status === 'pending' && payment.expiresAt <= now) {
        payment.status = 'expired';
        this.pendingPayments.set(code, payment);
        count++;
      }
    }
    return count;
  }

  // Ratting session methods
  async createRattingSession(session: {
    characterId: number;
    characterName: string;
    startTime: Date;
  }): Promise<RattingSessionData> {
    const id = randomUUID();
    const newSession: RattingSessionData = {
      id,
      characterId: session.characterId,
      characterName: session.characterName,
      startTime: session.startTime,
      endTime: null,
      totalIsk: 0,
      bountyIsk: 0,
      lootIsk: 0,
      killCount: 0,
      shipTypeId: null,
      shipTypeName: null,
      systemId: null,
      systemName: null,
      isActive: true,
      createdAt: new Date(),
    };
    this.rattingSessions.set(id, newSession);
    return newSession;
  }

  async getActiveSession(characterId: number): Promise<RattingSessionData | undefined> {
    return Array.from(this.rattingSessions.values())
      .find(s => s.characterId === characterId && s.isActive);
  }

  async getRattingSessions(characterId: number, limit?: number): Promise<RattingSessionData[]> {
    const sessions = Array.from(this.rattingSessions.values())
      .filter(s => s.characterId === characterId && !s.isActive)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    return limit ? sessions.slice(0, limit) : sessions;
  }

  async getRattingSessionById(sessionId: string): Promise<RattingSessionData | undefined> {
    return this.rattingSessions.get(sessionId);
  }

  async updateRattingSession(sessionId: string, updates: Partial<RattingSessionData>): Promise<RattingSessionData | undefined> {
    const session = this.rattingSessions.get(sessionId);
    if (!session) return undefined;
    
    const updated = { ...session, ...updates };
    this.rattingSessions.set(sessionId, updated);
    return updated;
  }

  async endRattingSession(sessionId: string, endTime: Date, totals: {
    totalIsk: number;
    bountyIsk: number;
    lootIsk?: number;
    killCount?: number;
  }): Promise<RattingSessionData | undefined> {
    const session = this.rattingSessions.get(sessionId);
    if (!session) return undefined;
    
    session.endTime = endTime;
    session.totalIsk = totals.totalIsk;
    session.bountyIsk = totals.bountyIsk;
    session.lootIsk = totals.lootIsk ?? 0;
    session.killCount = totals.killCount ?? 0;
    session.isActive = false;
    
    this.rattingSessions.set(sessionId, session);
    return session;
  }

  async deleteRattingSession(sessionId: string, characterId: number): Promise<boolean> {
    const session = this.rattingSessions.get(sessionId);
    if (!session || session.characterId !== characterId) return false;
    this.rattingSessions.delete(sessionId);
    return true;
  }

  // Admin session methods
  async getAllRattingSessions(options?: {
    limit?: number;
    offset?: number;
    characterName?: string;
    isActive?: boolean;
    minIsk?: number;
    maxIsk?: number;
  }): Promise<{ sessions: RattingSessionData[]; total: number }> {
    let sessions = Array.from(this.rattingSessions.values());
    
    if (options?.characterName) {
      const search = options.characterName.toLowerCase();
      sessions = sessions.filter(s => s.characterName.toLowerCase().includes(search));
    }
    if (options?.isActive !== undefined) {
      sessions = sessions.filter(s => s.isActive === options.isActive);
    }
    if (options?.minIsk !== undefined) {
      sessions = sessions.filter(s => s.totalIsk >= options.minIsk!);
    }
    if (options?.maxIsk !== undefined) {
      sessions = sessions.filter(s => s.totalIsk <= options.maxIsk!);
    }
    
    sessions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    
    const total = sessions.length;
    const offset = options?.offset || 0;
    const limit = options?.limit || 50;
    
    return {
      sessions: sessions.slice(offset, offset + limit),
      total,
    };
  }

  async adminUpdateRattingSession(sessionId: string, updates: Partial<RattingSessionData>): Promise<RattingSessionData | undefined> {
    const session = this.rattingSessions.get(sessionId);
    if (!session) return undefined;
    
    const updated = { ...session, ...updates };
    this.rattingSessions.set(sessionId, updated);
    return updated;
  }

  async adminDeleteRattingSession(sessionId: string): Promise<boolean> {
    const session = this.rattingSessions.get(sessionId);
    if (!session) return false;
    this.rattingSessions.delete(sessionId);
    return true;
  }

  async getSessionStatistics(): Promise<{
    totalSessions: number;
    activeSessions: number;
    totalIskEarned: number;
    totalKills: number;
    uniqueUsers: number;
  }> {
    const sessions = Array.from(this.rattingSessions.values());
    const uniqueCharacterIds = new Set(sessions.map(s => s.characterId));
    
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.isActive).length,
      totalIskEarned: sessions.reduce((sum, s) => sum + s.totalIsk, 0),
      totalKills: sessions.reduce((sum, s) => sum + (s.killCount || 0), 0),
      uniqueUsers: uniqueCharacterIds.size,
    };
  }

  // Loot entry methods
  async upsertLootEntry(entry: {
    sessionId: string;
    characterId: number;
    itemTypeId: number;
    itemTypeName: string;
    quantity: number;
    estimatedPrice: number;
    totalValue: number;
  }): Promise<LootEntryData> {
    // Create a key for aggregation by session + itemTypeId
    const key = `${entry.sessionId}-${entry.itemTypeId}`;
    const existing = this.lootEntries.get(key);
    
    if (existing) {
      // Update existing entry by adding quantities and values
      existing.quantity += entry.quantity;
      existing.totalValue += entry.totalValue;
      existing.estimatedPrice = existing.totalValue / existing.quantity;
      this.lootEntries.set(key, existing);
      return existing;
    }
    
    // Create new entry
    const newEntry: LootEntryData = {
      id: randomUUID(),
      sessionId: entry.sessionId,
      characterId: entry.characterId,
      itemTypeId: entry.itemTypeId,
      itemTypeName: entry.itemTypeName,
      quantity: entry.quantity,
      estimatedPrice: entry.estimatedPrice,
      totalValue: entry.totalValue,
      createdAt: new Date(),
    };
    this.lootEntries.set(key, newEntry);
    return newEntry;
  }

  async getLootEntriesBySession(sessionId: string): Promise<LootEntryData[]> {
    return Array.from(this.lootEntries.values())
      .filter(e => e.sessionId === sessionId)
      .sort((a, b) => b.totalValue - a.totalValue);
  }

  async clearSessionLoot(sessionId: string): Promise<number> {
    const toDelete = Array.from(this.lootEntries.entries())
      .filter(([_, e]) => e.sessionId === sessionId);
    toDelete.forEach(([key, _]) => this.lootEntries.delete(key));
    return toDelete.length;
  }

  async commitLootToSession(sessionId: string, lootTotal: number): Promise<RattingSessionData | undefined> {
    const session = this.rattingSessions.get(sessionId);
    if (!session) return undefined;
    
    session.lootIsk = lootTotal;
    session.totalIsk = session.bountyIsk + lootTotal;
    this.rattingSessions.set(sessionId, session);
    return session;
  }

  // Admin Notes methods
  async createAdminNote(note: {
    targetCharacterId: number;
    targetCharacterName: string;
    authorCharacterId: number;
    authorCharacterName: string;
    content: string;
    isPinned?: boolean;
  }): Promise<AdminNoteData> {
    const id = randomUUID();
    const now = new Date();
    const newNote: AdminNoteData = {
      id,
      targetCharacterId: note.targetCharacterId,
      targetCharacterName: note.targetCharacterName,
      authorCharacterId: note.authorCharacterId,
      authorCharacterName: note.authorCharacterName,
      content: note.content,
      isPinned: note.isPinned || false,
      createdAt: now,
      updatedAt: now,
    };
    this.adminNotesMap.set(id, newNote);
    return newNote;
  }

  async getAdminNotes(targetCharacterId: number): Promise<AdminNoteData[]> {
    return Array.from(this.adminNotesMap.values())
      .filter(n => n.targetCharacterId === targetCharacterId)
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }

  async updateAdminNote(noteId: string, updates: { content?: string; isPinned?: boolean }): Promise<AdminNoteData | undefined> {
    const note = this.adminNotesMap.get(noteId);
    if (!note) return undefined;
    if (updates.content !== undefined) note.content = updates.content;
    if (updates.isPinned !== undefined) note.isPinned = updates.isPinned;
    note.updatedAt = new Date();
    this.adminNotesMap.set(noteId, note);
    return note;
  }

  async deleteAdminNote(noteId: string): Promise<boolean> {
    return this.adminNotesMap.delete(noteId);
  }

  async getAdminNoteById(noteId: string): Promise<AdminNoteData | undefined> {
    return this.adminNotesMap.get(noteId);
  }

  // User Suspension methods
  async createSuspension(suspension: {
    characterId: number;
    characterName: string;
    suspendedByAdminId: number;
    suspendedByAdminName: string;
    reason: string;
    expiresAt?: Date | null;
  }): Promise<UserSuspensionData> {
    const id = randomUUID();
    const newSuspension: UserSuspensionData = {
      id,
      characterId: suspension.characterId,
      characterName: suspension.characterName,
      suspendedByAdminId: suspension.suspendedByAdminId,
      suspendedByAdminName: suspension.suspendedByAdminName,
      reason: suspension.reason,
      expiresAt: suspension.expiresAt || null,
      liftedAt: null,
      liftedByAdminId: null,
      liftedByAdminName: null,
      isActive: true,
      createdAt: new Date(),
    };
    this.userSuspensionsMap.set(id, newSuspension);
    return newSuspension;
  }

  async getActiveSuspension(characterId: number): Promise<UserSuspensionData | undefined> {
    const suspensions = Array.from(this.userSuspensionsMap.values())
      .filter(s => s.characterId === characterId && s.isActive);
    
    for (const suspension of suspensions) {
      if (suspension.expiresAt && new Date() > suspension.expiresAt) {
        suspension.isActive = false;
        this.userSuspensionsMap.set(suspension.id, suspension);
      }
    }
    
    return suspensions.find(s => s.isActive);
  }

  async getSuspensionHistory(characterId: number): Promise<UserSuspensionData[]> {
    return Array.from(this.userSuspensionsMap.values())
      .filter(s => s.characterId === characterId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async liftSuspension(suspensionId: string, liftedByAdminId: number, liftedByAdminName: string): Promise<UserSuspensionData | undefined> {
    const suspension = this.userSuspensionsMap.get(suspensionId);
    if (!suspension) return undefined;
    suspension.isActive = false;
    suspension.liftedAt = new Date();
    suspension.liftedByAdminId = liftedByAdminId;
    suspension.liftedByAdminName = liftedByAdminName;
    this.userSuspensionsMap.set(suspensionId, suspension);
    return suspension;
  }

  async getAllActiveSuspensions(): Promise<UserSuspensionData[]> {
    const now = new Date();
    return Array.from(this.userSuspensionsMap.values())
      .filter(s => s.isActive && (!s.expiresAt || s.expiresAt > now));
  }

  // Admin Audit Log methods
  async createAuditLog(log: {
    adminCharacterId: number;
    adminCharacterName: string;
    action: string;
    targetCharacterId?: number;
    targetCharacterName?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
  }): Promise<AdminAuditLogData> {
    const id = randomUUID();
    const newLog: AdminAuditLogData = {
      id,
      adminCharacterId: log.adminCharacterId,
      adminCharacterName: log.adminCharacterName,
      action: log.action,
      targetCharacterId: log.targetCharacterId || null,
      targetCharacterName: log.targetCharacterName || null,
      details: log.details || {},
      ipAddress: log.ipAddress || null,
      createdAt: new Date(),
    };
    this.adminAuditLogMap.set(id, newLog);
    return newLog;
  }

  async getAuditLog(options?: {
    limit?: number;
    offset?: number;
    adminCharacterId?: number;
    targetCharacterId?: number;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ logs: AdminAuditLogData[]; total: number }> {
    let logs = Array.from(this.adminAuditLogMap.values());
    
    if (options?.adminCharacterId) {
      logs = logs.filter(l => l.adminCharacterId === options.adminCharacterId);
    }
    if (options?.targetCharacterId) {
      logs = logs.filter(l => l.targetCharacterId === options.targetCharacterId);
    }
    if (options?.action) {
      logs = logs.filter(l => l.action === options.action);
    }
    if (options?.startDate) {
      logs = logs.filter(l => l.createdAt >= options.startDate!);
    }
    if (options?.endDate) {
      logs = logs.filter(l => l.createdAt <= options.endDate!);
    }
    
    logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = logs.length;
    
    if (options?.offset) {
      logs = logs.slice(options.offset);
    }
    if (options?.limit) {
      logs = logs.slice(0, options.limit);
    }
    
    return { logs, total };
  }

  async getAuditLogForUser(targetCharacterId: number, limit?: number): Promise<AdminAuditLogData[]> {
    let logs = Array.from(this.adminAuditLogMap.values())
      .filter(l => l.targetCharacterId === targetCharacterId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    if (limit) {
      logs = logs.slice(0, limit);
    }
    
    return logs;
  }

  // User management methods (stub for MemStorage - real implementation in DatabaseStorage)
  async getAllUsers(_options?: {
    limit?: number;
    offset?: number;
    search?: string;
    activeOnly?: boolean;
    adminsOnly?: boolean;
    suspendedOnly?: boolean;
    proOnly?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ users: UserManagementData[]; total: number }> {
    return { users: [], total: 0 };
  }

  async getUserDetails(_characterId: number): Promise<UserDetailData | undefined> {
    return undefined;
  }

  async getActiveUsersCount(): Promise<number> {
    return 0;
  }

  // Linked characters methods (stub for MemStorage - real implementation in DatabaseStorage)
  async linkCharacter(_data: InsertLinkedCharacter): Promise<LinkedCharacter> {
    throw new Error("Not implemented in MemStorage");
  }

  async unlinkCharacter(_primaryCharacterId: number, _characterId: number): Promise<void> {
    throw new Error("Not implemented in MemStorage");
  }

  async getLinkedCharacters(_primaryCharacterId: number): Promise<LinkedCharacter[]> {
    return [];
  }

  async getLinkedCharacter(_characterId: number): Promise<LinkedCharacter | undefined> {
    return undefined;
  }

  async isCharacterLinked(_characterId: number): Promise<boolean> {
    return false;
  }

  async updateLinkedCharacterTokens(_characterId: number, _tokens: {
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
  }): Promise<void> {
    throw new Error("Not implemented in MemStorage");
  }

  async updateLinkedCharacterLastUsed(_characterId: number): Promise<void> {
    throw new Error("Not implemented in MemStorage");
  }

  async getPrimaryCharacterId(_characterId: number): Promise<number | undefined> {
    return undefined;
  }

  // Income goals methods (stub for MemStorage - real implementation in DatabaseStorage)
  async getIncomeGoals(_characterId: number): Promise<IncomeGoalData | undefined> {
    return undefined;
  }

  async upsertIncomeGoals(_data: {
    characterId: number;
    characterName: string;
    dailyTarget: number;
    weeklyTarget: number;
    monthlyTarget: number;
  }): Promise<IncomeGoalData> {
    throw new Error("Not implemented in MemStorage");
  }

  async getIncomeEarnings(_characterId: number, _period: 'daily' | 'weekly' | 'monthly'): Promise<number> {
    return 0;
  }

  // Moon Calculator data methods (stub for MemStorage - real implementation in DatabaseStorage)
  async getUserMoons(_characterId: number): Promise<UserMoon[]> {
    return [];
  }

  async createUserMoon(_data: InsertUserMoon): Promise<UserMoon> {
    throw new Error("Not implemented in MemStorage");
  }

  async updateUserMoon(_moonId: string, _characterId: number, _updates: { notes?: string; isFavorite?: boolean }): Promise<UserMoon | undefined> {
    return undefined;
  }

  async deleteUserMoon(_moonId: string, _characterId: number): Promise<boolean> {
    return false;
  }

  async getUserMoonPrices(_characterId: number): Promise<UserMoonPrices | undefined> {
    return undefined;
  }

  async saveUserMoonPrices(_characterId: number, _prices: Record<string, number>): Promise<UserMoonPrices> {
    throw new Error("Not implemented in MemStorage");
  }

  // Industry Jobs methods (stub for MemStorage - real implementation in DatabaseStorage)
  async getIndustryJobs(_characterId: number, _options?: { status?: string; activityId?: number }): Promise<IndustryJobData[]> {
    return [];
  }

  async getIndustryJobsForCharacters(_characterIds: number[], _options?: { status?: string; activityId?: number }): Promise<IndustryJobData[]> {
    return [];
  }

  async upsertIndustryJob(_job: Omit<IndustryJobData, 'id' | 'cachedAt' | 'updatedAt'>): Promise<IndustryJobData> {
    throw new Error("Not implemented in MemStorage");
  }

  async upsertIndustryJobs(_jobs: Omit<IndustryJobData, 'id' | 'cachedAt' | 'updatedAt'>[]): Promise<IndustryJobData[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async deleteStaleIndustryJobs(_characterId: number, _currentJobIds: number[]): Promise<number> {
    return 0;
  }

  async getIndustryJobStats(_characterId: number): Promise<{
    activeJobs: number;
    completedToday: number;
    totalProfit: number;
    avgIskPerHour: number;
  }> {
    return { activeJobs: 0, completedToday: 0, totalProfit: 0, avgIskPerHour: 0 };
  }

  // Planetary Industry methods (stub for MemStorage)
  async getPlanetaryPlanets(_characterId: number): Promise<PlanetaryPlanetData[]> {
    return [];
  }
  async getPlanetaryPlanetsForCharacters(_characterIds: number[]): Promise<PlanetaryPlanetData[]> {
    return [];
  }
  async upsertPlanetaryPlanet(_planet: Omit<PlanetaryPlanetData, 'id' | 'cachedAt' | 'updatedAt'>): Promise<PlanetaryPlanetData> {
    throw new Error("Not implemented in MemStorage");
  }
  async deleteStalePlanetaryPlanets(_characterId: number, _currentPlanetIds: number[]): Promise<number> {
    return 0;
  }
  async getPlanetaryPins(_characterId: number, _planetId: number): Promise<PlanetaryPinData[]> {
    return [];
  }
  async getPlanetaryPinsForCharacter(_characterId: number): Promise<PlanetaryPinData[]> {
    return [];
  }
  async upsertPlanetaryPins(_characterId: number, _planetId: number, _pins: Omit<PlanetaryPinData, 'id' | 'cachedAt'>[]): Promise<void> {
    // Stub
  }
  async deletePlanetaryPins(_characterId: number, _planetId: number): Promise<void> {
    // Stub
  }

  // ESI Name Cache methods (stub for MemStorage)
  async getEsiNames(_characterId: number, _ids: number[]): Promise<Map<number, { name: string; category: string }>> {
    return new Map();
  }
  async cacheEsiNames(_characterId: number, _entries: { id: number; name: string; category: string }[]): Promise<void> {
    // Stub
  }

  // Market Intelligence stubs
  async getMonitoredStations(_characterId: number): Promise<MonitoredStation[]> { return []; }
  async getMonitoredStation(_id: string, _characterId: number): Promise<MonitoredStation | undefined> { return undefined; }
  async addMonitoredStation(_data: InsertMonitoredStation): Promise<MonitoredStation> { throw new Error("Not implemented in MemStorage"); }
  async removeMonitoredStation(_id: string, _characterId: number): Promise<void> {}
  async updateMonitoredStationFetchTime(_id: string): Promise<void> {}
  async getWatchlists(_characterId: number, _stationId?: string): Promise<Watchlist[]> { return []; }
  async getWatchlist(_id: string, _characterId: number): Promise<Watchlist | undefined> { return undefined; }
  async createWatchlist(_data: InsertWatchlist): Promise<Watchlist> { throw new Error("Not implemented in MemStorage"); }
  async deleteWatchlist(_id: string, _characterId: number): Promise<void> {}
  async getWatchlistItems(_watchlistId: string): Promise<WatchlistItem[]> { return []; }
  async addWatchlistItem(_data: InsertWatchlistItem): Promise<WatchlistItem> { throw new Error("Not implemented in MemStorage"); }
  async removeWatchlistItem(_id: string): Promise<void> {}
  async upsertMarketSnapshot(_data: InsertMarketSnapshot): Promise<MarketSnapshot> { throw new Error("Not implemented in MemStorage"); }
  async getMarketSnapshotsByTypes(_monitoredStationId: string, _typeIds: number[]): Promise<MarketSnapshot[]> { return []; }
  async upsertJitaReferencePrice(_data: InsertJitaReferencePrice): Promise<JitaReferencePrice> { throw new Error("Not implemented in MemStorage"); }
  async getJitaReferencePrices(_typeIds: number[]): Promise<JitaReferencePrice[]> { return []; }
}

// DatabaseStorage: Uses PostgreSQL for persistent data
export class DatabaseStorage extends MemStorage {
  // Override PRO subscription methods to use database
  async getProSubscription(characterId: number): Promise<ProSubscription | undefined> {
    const [result] = await db.select()
      .from(proSubscriptions)
      .where(eq(proSubscriptions.characterId, characterId))
      .limit(1);
    
    if (!result) return undefined;
    
    // Check if expired and update status
    const sub: ProSubscription = {
      characterId: result.characterId,
      characterName: result.characterName,
      status: result.status as ProSubscription["status"],
      expiresAt: result.expiresAt,
      activatedAt: result.activatedAt,
      activationCode: result.activationCode,
      giftedBy: result.giftedBy,
      giftedAt: result.giftedAt,
    };
    
    if (sub.expiresAt && new Date() > sub.expiresAt && sub.status === "active") {
      sub.status = "expired";
      await this.createOrUpdateProSubscription(sub);
    }
    
    return sub;
  }

  async createOrUpdateProSubscription(subscription: ProSubscription): Promise<ProSubscription> {
    const existing = await db.select()
      .from(proSubscriptions)
      .where(eq(proSubscriptions.characterId, subscription.characterId))
      .limit(1);
    
    if (existing.length > 0) {
      await db.update(proSubscriptions)
        .set({
          characterName: subscription.characterName,
          status: subscription.status,
          expiresAt: subscription.expiresAt,
          activatedAt: subscription.activatedAt,
          activationCode: subscription.activationCode,
          giftedBy: subscription.giftedBy,
          giftedAt: subscription.giftedAt,
          updatedAt: new Date(),
        })
        .where(eq(proSubscriptions.characterId, subscription.characterId));
    } else {
      await db.insert(proSubscriptions).values({
        characterId: subscription.characterId,
        characterName: subscription.characterName,
        status: subscription.status,
        expiresAt: subscription.expiresAt,
        activatedAt: subscription.activatedAt,
        activationCode: subscription.activationCode,
        giftedBy: subscription.giftedBy,
        giftedAt: subscription.giftedAt,
      });
    }
    
    return subscription;
  }

  async getAllSubscriptions(): Promise<ProSubscription[]> {
    const results = await db.select().from(proSubscriptions);
    return results.map(r => ({
      characterId: r.characterId,
      characterName: r.characterName,
      status: r.status as ProSubscription["status"],
      expiresAt: r.expiresAt,
      activatedAt: r.activatedAt,
      activationCode: r.activationCode,
      giftedBy: r.giftedBy,
      giftedAt: r.giftedAt,
    }));
  }

  async revokeSubscription(characterId: number): Promise<void> {
    await db.update(proSubscriptions)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(eq(proSubscriptions.characterId, characterId));
  }

  async extendSubscription(characterId: number, days: number): Promise<ProSubscription | undefined> {
    const sub = await this.getProSubscription(characterId);
    if (!sub) return undefined;
    
    const baseDate = sub.expiresAt && sub.expiresAt > new Date() ? sub.expiresAt : new Date();
    const newExpiresAt = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
    
    sub.expiresAt = newExpiresAt;
    sub.status = "active";
    return this.createOrUpdateProSubscription(sub);
  }

  // Override activation code methods to use database
  async getActivationCode(code: string): Promise<ProActivationCode | undefined> {
    const [result] = await db.select()
      .from(proActivationCodes)
      .where(eq(proActivationCodes.code, code))
      .limit(1);
    
    if (!result) return undefined;
    
    const codeData: ProActivationCode = {
      code: result.code,
      characterId: result.characterId,
      characterName: result.characterName,
      createdAt: result.createdAt,
      expiresAt: result.expiresAt,
      iskAmount: result.iskAmount,
      status: result.status as ProActivationCode["status"],
      usedAt: result.usedAt,
      isGiftCode: result.isGiftCode,
      giftDurationDays: result.giftDurationDays ?? undefined,
      giftNote: result.giftNote ?? undefined,
      createdByAdminId: result.createdByAdminId ?? undefined,
      createdByAdminName: result.createdByAdminName ?? undefined,
      redeemedByCharacterId: result.redeemedByCharacterId ?? undefined,
      redeemedByCharacterName: result.redeemedByCharacterName ?? undefined,
      giftBadgeType: result.giftBadgeType as SpecialBadgeType | undefined,
      giftThemeUnlock: result.giftThemeUnlock as FactionTheme | undefined,
      giftBonusTiles: result.giftBonusTiles as BonusTile[] | undefined,
    };
    
    // Check if expired
    if (codeData.status === "pending" && new Date() > codeData.expiresAt) {
      codeData.status = "expired";
      await this.markCodeAsUsed(code);
    }
    
    return codeData;
  }

  async getActiveCodeForCharacter(characterId: number): Promise<ProActivationCode | undefined> {
    const [result] = await db.select()
      .from(proActivationCodes)
      .where(and(
        eq(proActivationCodes.characterId, characterId),
        eq(proActivationCodes.status, "pending")
      ))
      .limit(1);
    
    if (!result || new Date() > result.expiresAt) return undefined;
    
    return {
      code: result.code,
      characterId: result.characterId,
      characterName: result.characterName,
      createdAt: result.createdAt,
      expiresAt: result.expiresAt,
      iskAmount: result.iskAmount,
      status: result.status as ProActivationCode["status"],
      usedAt: result.usedAt,
      isGiftCode: result.isGiftCode,
      giftDurationDays: result.giftDurationDays ?? undefined,
      giftNote: result.giftNote ?? undefined,
      createdByAdminId: result.createdByAdminId ?? undefined,
      createdByAdminName: result.createdByAdminName ?? undefined,
    };
  }

  async getAllPendingCodes(): Promise<ProActivationCode[]> {
    const results = await db.select()
      .from(proActivationCodes)
      .where(eq(proActivationCodes.status, "pending"));
    
    const now = new Date();
    return results
      .filter(r => now < r.expiresAt)
      .map(r => ({
        code: r.code,
        characterId: r.characterId,
        characterName: r.characterName,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        iskAmount: r.iskAmount,
        status: r.status as ProActivationCode["status"],
        usedAt: r.usedAt,
        isGiftCode: r.isGiftCode,
        giftDurationDays: r.giftDurationDays ?? undefined,
        giftNote: r.giftNote ?? undefined,
        createdByAdminId: r.createdByAdminId ?? undefined,
        createdByAdminName: r.createdByAdminName ?? undefined,
      }));
  }

  async createActivationCode(codeData: ProActivationCode): Promise<ProActivationCode> {
    await db.insert(proActivationCodes).values({
      code: codeData.code,
      characterId: codeData.characterId,
      characterName: codeData.characterName,
      expiresAt: codeData.expiresAt,
      iskAmount: codeData.iskAmount,
      status: codeData.status,
      usedAt: codeData.usedAt,
      isGiftCode: codeData.isGiftCode ?? false,
      giftDurationDays: codeData.giftDurationDays,
      giftNote: codeData.giftNote,
      createdByAdminId: codeData.createdByAdminId,
      createdByAdminName: codeData.createdByAdminName,
      giftBadgeType: codeData.giftBadgeType,
      giftThemeUnlock: codeData.giftThemeUnlock,
      giftBonusTiles: codeData.giftBonusTiles,
    });
    return codeData;
  }

  async markCodeAsUsed(code: string): Promise<void> {
    await db.update(proActivationCodes)
      .set({ status: "used", usedAt: new Date() })
      .where(eq(proActivationCodes.code, code));
  }

  async getAllActivationCodes(): Promise<ProActivationCode[]> {
    const results = await db.select().from(proActivationCodes);
    return results.map(r => ({
      code: r.code,
      characterId: r.characterId,
      characterName: r.characterName,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      iskAmount: r.iskAmount,
      status: r.status as ProActivationCode["status"],
      usedAt: r.usedAt,
      isGiftCode: r.isGiftCode,
      giftDurationDays: r.giftDurationDays ?? undefined,
      giftNote: r.giftNote ?? undefined,
      createdByAdminId: r.createdByAdminId ?? undefined,
      createdByAdminName: r.createdByAdminName ?? undefined,
      giftBadgeType: r.giftBadgeType as SpecialBadgeType | undefined,
      giftThemeUnlock: r.giftThemeUnlock as FactionTheme | undefined,
      giftBonusTiles: r.giftBonusTiles as BonusTile[] | undefined,
    }));
  }

  // Override gift methods to use database
  async createGift(gift: ProGift): Promise<ProGift> {
    await db.insert(proGifts).values({
      id: gift.id,
      referenceCode: gift.referenceCode,
      recipientCharacterId: gift.recipientCharacterId,
      recipientCharacterName: gift.recipientCharacterName,
      giftedByCharacterId: gift.giftedByCharacterId,
      giftedByCharacterName: gift.giftedByCharacterName,
      durationDays: gift.durationDays,
      note: gift.note,
      giftedAt: gift.giftedAt,
    });
    return gift;
  }

  async getGiftsForCharacter(characterId: number): Promise<ProGift[]> {
    const results = await db.select()
      .from(proGifts)
      .where(eq(proGifts.recipientCharacterId, characterId));
    
    return results.map(r => ({
      id: r.id,
      referenceCode: r.referenceCode,
      recipientCharacterId: r.recipientCharacterId,
      recipientCharacterName: r.recipientCharacterName,
      giftedByCharacterId: r.giftedByCharacterId,
      giftedByCharacterName: r.giftedByCharacterName,
      durationDays: r.durationDays,
      note: r.note,
      giftedAt: r.giftedAt,
    }));
  }

  async getAllGifts(): Promise<ProGift[]> {
    const results = await db.select().from(proGifts);
    return results
      .sort((a, b) => b.giftedAt.getTime() - a.giftedAt.getTime())
      .map(r => ({
        id: r.id,
        referenceCode: r.referenceCode,
        recipientCharacterId: r.recipientCharacterId,
        recipientCharacterName: r.recipientCharacterName,
        giftedByCharacterId: r.giftedByCharacterId,
        giftedByCharacterName: r.giftedByCharacterName,
        durationDays: r.durationDays,
        note: r.note,
        giftedAt: r.giftedAt,
      }));
  }

  // Override processed transactions to use database
  async isTransactionProcessed(transactionId: number): Promise<boolean> {
    const [result] = await db.select()
      .from(processedTransactionsTable)
      .where(eq(processedTransactionsTable.transactionId, transactionId))
      .limit(1);
    return !!result;
  }

  async markTransactionProcessed(transactionId: number): Promise<void> {
    try {
      await db.insert(processedTransactionsTable).values({ transactionId });
    } catch (e) {
      // Ignore duplicate key errors
    }
  }

  // Override dynamic admin methods to use database
  async addDynamicAdmin(admin: Omit<DynamicAdminData, 'id' | 'addedAt'>): Promise<DynamicAdminData> {
    const id = randomUUID();
    await db.insert(dynamicAdmins).values({
      id,
      characterId: admin.characterId,
      characterName: admin.characterName,
      addedByCharacterId: admin.addedBy,
      addedByCharacterName: admin.addedByName,
    });
    
    return {
      ...admin,
      id,
      addedAt: new Date(),
    };
  }

  async removeDynamicAdmin(characterId: number): Promise<DynamicAdminData | undefined> {
    const [existing] = await db.select()
      .from(dynamicAdmins)
      .where(eq(dynamicAdmins.characterId, characterId))
      .limit(1);
    
    if (!existing) return undefined;
    
    await db.delete(dynamicAdmins)
      .where(eq(dynamicAdmins.characterId, characterId));
    
    return {
      id: existing.id,
      characterId: existing.characterId,
      characterName: existing.characterName,
      addedBy: existing.addedByCharacterId,
      addedByName: existing.addedByCharacterName,
      addedAt: existing.addedAt,
    };
  }

  async getDynamicAdmins(): Promise<DynamicAdminData[]> {
    const results = await db.select().from(dynamicAdmins);
    return results.map(r => ({
      id: r.id,
      characterId: r.characterId,
      characterName: r.characterName,
      addedBy: r.addedByCharacterId,
      addedByName: r.addedByCharacterName,
      addedAt: r.addedAt,
    }));
  }

  async isDynamicAdmin(characterId: number): Promise<boolean> {
    const [result] = await db.select()
      .from(dynamicAdmins)
      .where(eq(dynamicAdmins.characterId, characterId))
      .limit(1);
    return !!result;
  }
  
  // PRO notification email methods (database)
  async addProNotificationEmail(email: string, addedByCharacterId: number, addedByCharacterName: string): Promise<ProNotificationEmailData> {
    const id = randomUUID();
    await db.insert(proNotificationEmailsTable).values({
      id,
      email,
      addedByCharacterId,
      addedByCharacterName,
      isActive: true,
    });
    
    return {
      id,
      email,
      addedByCharacterId,
      addedByCharacterName,
      isActive: true,
      addedAt: new Date(),
    };
  }
  
  async removeProNotificationEmail(id: string): Promise<boolean> {
    const result = await db.delete(proNotificationEmailsTable)
      .where(eq(proNotificationEmailsTable.id, id));
    return true;
  }
  
  async getProNotificationEmails(): Promise<ProNotificationEmailData[]> {
    const results = await db.select().from(proNotificationEmailsTable);
    return results.map(r => ({
      id: r.id,
      email: r.email,
      addedByCharacterId: r.addedByCharacterId,
      addedByCharacterName: r.addedByCharacterName,
      isActive: r.isActive,
      addedAt: r.addedAt,
    }));
  }
  
  async toggleProNotificationEmail(id: string, isActive: boolean): Promise<ProNotificationEmailData | undefined> {
    await db.update(proNotificationEmailsTable)
      .set({ isActive })
      .where(eq(proNotificationEmailsTable.id, id));
    
    const [result] = await db.select()
      .from(proNotificationEmailsTable)
      .where(eq(proNotificationEmailsTable.id, id))
      .limit(1);
    
    if (!result) return undefined;
    
    return {
      id: result.id,
      email: result.email,
      addedByCharacterId: result.addedByCharacterId,
      addedByCharacterName: result.addedByCharacterName,
      isActive: result.isActive,
      addedAt: result.addedAt,
    };
  }

  // Override user unlocks to use database
  async getUserUnlocks(characterId: number): Promise<UserUnlocks | undefined> {
    const [result] = await db.select()
      .from(userUnlocksTable)
      .where(eq(userUnlocksTable.characterId, characterId))
      .limit(1);
    
    if (!result) return undefined;
    
    return {
      characterId: result.characterId,
      unlockedThemes: (result.unlockedThemes as FactionTheme[]) || [],
      unlockedTiles: (result.unlockedTiles as BonusTile[]) || [],
      updatedAt: result.updatedAt,
    };
  }

  async addUserUnlock(characterId: number, theme?: FactionTheme, tiles?: BonusTile[]): Promise<UserUnlocks> {
    const existing = await this.getUserUnlocks(characterId);
    
    const unlockedThemes = existing?.unlockedThemes || [];
    const unlockedTiles = existing?.unlockedTiles || [];
    
    if (theme && !unlockedThemes.includes(theme)) {
      unlockedThemes.push(theme);
    }
    
    if (tiles) {
      for (const tile of tiles) {
        if (!unlockedTiles.includes(tile)) {
          unlockedTiles.push(tile);
        }
      }
    }
    
    if (existing) {
      await db.update(userUnlocksTable)
        .set({
          unlockedThemes,
          unlockedTiles,
          updatedAt: new Date(),
        })
        .where(eq(userUnlocksTable.characterId, characterId));
    } else {
      await db.insert(userUnlocksTable).values({
        characterId,
        unlockedThemes,
        unlockedTiles,
      });
    }
    
    return {
      characterId,
      unlockedThemes,
      unlockedTiles,
      updatedAt: new Date(),
    };
  }

  // Override statistics to use database
  async getStatistics() {
    const allSubs = await this.getAllSubscriptions();
    const allCodes = await this.getAllActivationCodes();
    const allGifts = await this.getAllGifts();
    const txCount = await db.select().from(processedTransactionsTable);
    
    return {
      totalSubscriptions: allSubs.length,
      activeSubscriptions: allSubs.filter(s => s.status === "active").length,
      expiredSubscriptions: allSubs.filter(s => s.status === "expired").length,
      pendingCodes: allCodes.filter(c => c.status === "pending").length,
      usedCodes: allCodes.filter(c => c.status === "used").length,
      totalGifts: allGifts.length,
      processedTransactions: txCount.length,
    };
  }

  // Override special badges to use database
  async grantSpecialBadge(badge: Omit<SpecialBadgeData, 'id' | 'grantedAt'>): Promise<SpecialBadgeData> {
    const id = randomUUID();
    await db.insert(specialBadgesTable).values({
      id,
      characterId: badge.characterId,
      characterName: badge.characterName,
      badgeType: badge.badgeType,
      grantedByAdminId: badge.grantedByAdminId,
      grantedByAdminName: badge.grantedByAdminName,
      note: badge.note,
    });
    
    return {
      ...badge,
      id,
      grantedAt: new Date(),
    };
  }

  async revokeSpecialBadge(characterId: number, badgeType: SpecialBadgeType): Promise<void> {
    await db.delete(specialBadgesTable)
      .where(and(
        eq(specialBadgesTable.characterId, characterId),
        eq(specialBadgesTable.badgeType, badgeType)
      ));
  }

  async getSpecialBadges(characterId: number): Promise<SpecialBadgeData[]> {
    const results = await db.select()
      .from(specialBadgesTable)
      .where(eq(specialBadgesTable.characterId, characterId));
    
    return results.map(r => ({
      id: r.id,
      characterId: r.characterId,
      characterName: r.characterName,
      badgeType: r.badgeType as SpecialBadgeType,
      grantedByAdminId: r.grantedByAdminId,
      grantedByAdminName: r.grantedByAdminName,
      note: r.note,
      grantedAt: r.grantedAt,
    }));
  }

  async getAllSpecialBadges(): Promise<SpecialBadgeData[]> {
    const results = await db.select().from(specialBadgesTable);
    return results.map(r => ({
      id: r.id,
      characterId: r.characterId,
      characterName: r.characterName,
      badgeType: r.badgeType as SpecialBadgeType,
      grantedByAdminId: r.grantedByAdminId,
      grantedByAdminName: r.grantedByAdminName,
      note: r.note,
      grantedAt: r.grantedAt,
    }));
  }

  async hasSpecialBadge(characterId: number, badgeType: SpecialBadgeType): Promise<boolean> {
    const [result] = await db.select()
      .from(specialBadgesTable)
      .where(and(
        eq(specialBadgesTable.characterId, characterId),
        eq(specialBadgesTable.badgeType, badgeType)
      ))
      .limit(1);
    return !!result;
  }

  // Override user profile methods to use database
  async getUserProfile(characterId: number): Promise<UserProfile | undefined> {
    const [result] = await db.select()
      .from(userPreferences)
      .where(eq(userPreferences.characterId, characterId))
      .limit(1);
    
    if (!result) return undefined;
    
    return {
      characterId: result.characterId,
      characterName: result.characterName,
      firstLoginAt: result.firstLoginAt,
      corpTaxRate: result.corpTaxRate,
      emailNotifications: result.emailNotifications,
      proExpiryReminders: result.proExpiryReminders,
      supportTicketUpdates: result.supportTicketUpdates,
    };
  }

  async createOrUpdateUserProfile(profile: UserProfile): Promise<UserProfile> {
    const existing = await db.select()
      .from(userPreferences)
      .where(eq(userPreferences.characterId, profile.characterId))
      .limit(1);
    
    if (existing.length > 0) {
      await db.update(userPreferences)
        .set({
          characterName: profile.characterName,
          corpTaxRate: profile.corpTaxRate,
          updatedAt: new Date(),
        })
        .where(eq(userPreferences.characterId, profile.characterId));
    } else {
      await db.insert(userPreferences).values({
        characterId: profile.characterId,
        characterName: profile.characterName,
        corpTaxRate: profile.corpTaxRate,
        firstLoginAt: profile.firstLoginAt,
      });
    }
    
    return profile;
  }

  async updateCorpTaxRate(characterId: number, taxRate: number): Promise<void> {
    await db.update(userPreferences)
      .set({ corpTaxRate: taxRate, updatedAt: new Date() })
      .where(eq(userPreferences.characterId, characterId));
  }

  async updateUserNotificationPreferences(characterId: number, prefs: {
    emailNotifications?: boolean;
    proExpiryReminders?: boolean;
    supportTicketUpdates?: boolean;
  }): Promise<void> {
    await db.update(userPreferences)
      .set({
        emailNotifications: prefs.emailNotifications,
        proExpiryReminders: prefs.proExpiryReminders,
        supportTicketUpdates: prefs.supportTicketUpdates,
        updatedAt: new Date(),
      })
      .where(eq(userPreferences.characterId, characterId));
  }

  // Override pending payment methods to use database
  async createPendingPayment(payment: {
    characterId: number;
    characterName: string;
    planType: 'weekly' | 'monthly';
    iskAmount: number;
    expiresAt: Date;
  }): Promise<PendingPaymentData> {
    const id = randomUUID();
    const referenceCode = generatePaymentReferenceCode();
    
    await db.insert(pendingPaymentsTable).values({
      id,
      referenceCode,
      characterId: payment.characterId,
      characterName: payment.characterName,
      planType: payment.planType,
      iskAmount: payment.iskAmount,
      status: 'pending',
      expiresAt: payment.expiresAt,
    });
    
    return {
      id,
      referenceCode,
      characterId: payment.characterId,
      characterName: payment.characterName,
      planType: payment.planType as 'weekly' | 'monthly',
      iskAmount: payment.iskAmount,
      status: 'pending',
      expiresAt: payment.expiresAt,
      completedAt: null,
      transactionId: null,
      createdAt: new Date(),
    };
  }

  async getPendingPaymentByCode(referenceCode: string): Promise<PendingPaymentData | undefined> {
    const [result] = await db.select()
      .from(pendingPaymentsTable)
      .where(eq(pendingPaymentsTable.referenceCode, referenceCode))
      .limit(1);
    
    if (!result) return undefined;
    
    return {
      id: result.id,
      referenceCode: result.referenceCode,
      characterId: result.characterId,
      characterName: result.characterName,
      planType: result.planType as 'weekly' | 'monthly',
      iskAmount: result.iskAmount,
      status: result.status as 'pending' | 'completed' | 'expired' | 'cancelled',
      expiresAt: result.expiresAt,
      completedAt: result.completedAt,
      transactionId: result.transactionId,
      createdAt: result.createdAt,
    };
  }

  async getPendingPaymentsByCharacter(characterId: number): Promise<PendingPaymentData[]> {
    const results = await db.select()
      .from(pendingPaymentsTable)
      .where(eq(pendingPaymentsTable.characterId, characterId));
    
    return results
      .map(r => ({
        id: r.id,
        referenceCode: r.referenceCode,
        characterId: r.characterId,
        characterName: r.characterName,
        planType: r.planType as 'weekly' | 'monthly',
        iskAmount: r.iskAmount,
        status: r.status as 'pending' | 'completed' | 'expired' | 'cancelled',
        expiresAt: r.expiresAt,
        completedAt: r.completedAt,
        transactionId: r.transactionId,
        createdAt: r.createdAt,
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getActivePendingPayment(characterId: number): Promise<PendingPaymentData | undefined> {
    const now = new Date();
    const [result] = await db.select()
      .from(pendingPaymentsTable)
      .where(and(
        eq(pendingPaymentsTable.characterId, characterId),
        eq(pendingPaymentsTable.status, 'pending')
      ))
      .limit(1);
    
    if (!result || result.expiresAt <= now) return undefined;
    
    return {
      id: result.id,
      referenceCode: result.referenceCode,
      characterId: result.characterId,
      characterName: result.characterName,
      planType: result.planType as 'weekly' | 'monthly',
      iskAmount: result.iskAmount,
      status: 'pending',
      expiresAt: result.expiresAt,
      completedAt: null,
      transactionId: null,
      createdAt: result.createdAt,
    };
  }

  async completePendingPayment(referenceCode: string, transactionId: number): Promise<PendingPaymentData | undefined> {
    const payment = await this.getPendingPaymentByCode(referenceCode);
    if (!payment || payment.status !== 'pending') return undefined;
    
    const now = new Date();
    await db.update(pendingPaymentsTable)
      .set({
        status: 'completed',
        completedAt: now,
        transactionId,
      })
      .where(eq(pendingPaymentsTable.referenceCode, referenceCode));
    
    return {
      ...payment,
      status: 'completed',
      completedAt: now,
      transactionId,
    };
  }

  async expirePendingPayments(): Promise<number> {
    const now = new Date();
    const result = await db.update(pendingPaymentsTable)
      .set({ status: 'expired' })
      .where(and(
        eq(pendingPaymentsTable.status, 'pending'),
        lt(pendingPaymentsTable.expiresAt, now)
      ));
    
    return 0; // Drizzle doesn't return affected rows count easily
  }

  // Override ratting session methods to use database
  async createRattingSession(session: {
    characterId: number;
    characterName: string;
    startTime: Date;
  }): Promise<RattingSessionData> {
    const id = randomUUID();
    
    await db.insert(rattingSessionsTable).values({
      id,
      characterId: session.characterId,
      characterName: session.characterName,
      startTime: session.startTime,
      isActive: true,
    });
    
    return {
      id,
      characterId: session.characterId,
      characterName: session.characterName,
      startTime: session.startTime,
      endTime: null,
      totalIsk: 0,
      bountyIsk: 0,
      lootIsk: 0,
      killCount: 0,
      shipTypeId: null,
      shipTypeName: null,
      systemId: null,
      systemName: null,
      isActive: true,
      createdAt: new Date(),
    };
  }

  async getActiveSession(characterId: number): Promise<RattingSessionData | undefined> {
    const [result] = await db.select()
      .from(rattingSessionsTable)
      .where(and(
        eq(rattingSessionsTable.characterId, characterId),
        eq(rattingSessionsTable.isActive, true)
      ))
      .limit(1);
    
    if (!result) return undefined;
    
    return this.mapDbSessionToData(result);
  }

  async getRattingSessions(characterId: number, limit?: number): Promise<RattingSessionData[]> {
    let query = db.select()
      .from(rattingSessionsTable)
      .where(and(
        eq(rattingSessionsTable.characterId, characterId),
        eq(rattingSessionsTable.isActive, false)
      ))
      .orderBy(desc(rattingSessionsTable.startTime));
    
    if (limit) {
      query = query.limit(limit) as typeof query;
    }
    
    const results = await query;
    return results.map(r => this.mapDbSessionToData(r));
  }

  async getRattingSessionById(sessionId: string): Promise<RattingSessionData | undefined> {
    const [result] = await db.select()
      .from(rattingSessionsTable)
      .where(eq(rattingSessionsTable.id, sessionId))
      .limit(1);
    
    if (!result) return undefined;
    
    return this.mapDbSessionToData(result);
  }

  async updateRattingSession(sessionId: string, updates: Partial<RattingSessionData>): Promise<RattingSessionData | undefined> {
    const session = await this.getRattingSessionById(sessionId);
    if (!session) return undefined;
    
    await db.update(rattingSessionsTable)
      .set({
        totalIsk: updates.totalIsk ?? session.totalIsk,
        bountyIsk: updates.bountyIsk ?? session.bountyIsk,
        lootIsk: updates.lootIsk ?? session.lootIsk,
        killCount: updates.killCount ?? session.killCount,
        shipTypeId: updates.shipTypeId ?? session.shipTypeId,
        shipTypeName: updates.shipTypeName ?? session.shipTypeName,
        systemId: updates.systemId ?? session.systemId,
        systemName: updates.systemName ?? session.systemName,
      })
      .where(eq(rattingSessionsTable.id, sessionId));
    
    return this.getRattingSessionById(sessionId);
  }

  async endRattingSession(sessionId: string, endTime: Date, totals: {
    totalIsk: number;
    bountyIsk: number;
    lootIsk?: number;
    killCount?: number;
  }): Promise<RattingSessionData | undefined> {
    const session = await this.getRattingSessionById(sessionId);
    if (!session) return undefined;
    
    await db.update(rattingSessionsTable)
      .set({
        endTime,
        totalIsk: totals.totalIsk,
        bountyIsk: totals.bountyIsk,
        lootIsk: totals.lootIsk ?? 0,
        killCount: totals.killCount ?? 0,
        isActive: false,
      })
      .where(eq(rattingSessionsTable.id, sessionId));
    
    return this.getRattingSessionById(sessionId);
  }

  async deleteRattingSession(sessionId: string, characterId: number): Promise<boolean> {
    const session = await this.getRattingSessionById(sessionId);
    if (!session || session.characterId !== characterId) return false;
    
    await db.delete(rattingSessionsTable)
      .where(eq(rattingSessionsTable.id, sessionId));
    
    return true;
  }

  // Admin session database methods
  async getAllRattingSessions(options?: {
    limit?: number;
    offset?: number;
    characterName?: string;
    isActive?: boolean;
    minIsk?: number;
    maxIsk?: number;
  }): Promise<{ sessions: RattingSessionData[]; total: number }> {
    const conditions = [];
    
    if (options?.characterName) {
      conditions.push(ilike(rattingSessionsTable.characterName, `%${options.characterName}%`));
    }
    if (options?.isActive !== undefined) {
      conditions.push(eq(rattingSessionsTable.isActive, options.isActive));
    }
    if (options?.minIsk !== undefined) {
      conditions.push(gte(rattingSessionsTable.totalIsk, options.minIsk));
    }
    if (options?.maxIsk !== undefined) {
      conditions.push(lte(rattingSessionsTable.totalIsk, options.maxIsk));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const totalResult = await db.select({ count: sql<number>`count(*)` })
      .from(rattingSessionsTable)
      .where(whereClause);
    
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    
    const sessions = await db.select()
      .from(rattingSessionsTable)
      .where(whereClause)
      .orderBy(desc(rattingSessionsTable.startTime))
      .limit(limit)
      .offset(offset);
    
    return {
      sessions: sessions.map(s => this.mapDbSessionToData(s)),
      total: Number(totalResult[0]?.count || 0),
    };
  }

  async adminUpdateRattingSession(sessionId: string, updates: Partial<RattingSessionData>): Promise<RattingSessionData | undefined> {
    const session = await this.getRattingSessionById(sessionId);
    if (!session) return undefined;
    
    await db.update(rattingSessionsTable)
      .set({
        totalIsk: updates.totalIsk ?? session.totalIsk,
        bountyIsk: updates.bountyIsk ?? session.bountyIsk,
        lootIsk: updates.lootIsk ?? session.lootIsk,
        killCount: updates.killCount ?? session.killCount,
        isActive: updates.isActive ?? session.isActive,
      })
      .where(eq(rattingSessionsTable.id, sessionId));
    
    return this.getRattingSessionById(sessionId);
  }

  async adminDeleteRattingSession(sessionId: string): Promise<boolean> {
    const session = await this.getRattingSessionById(sessionId);
    if (!session) return false;
    
    await db.delete(rattingSessionsTable)
      .where(eq(rattingSessionsTable.id, sessionId));
    
    return true;
  }

  async getSessionStatistics(): Promise<{
    totalSessions: number;
    activeSessions: number;
    totalIskEarned: number;
    totalKills: number;
    uniqueUsers: number;
  }> {
    const totalResult = await db.select({ count: sql<number>`count(*)` })
      .from(rattingSessionsTable);
    
    const activeResult = await db.select({ count: sql<number>`count(*)` })
      .from(rattingSessionsTable)
      .where(eq(rattingSessionsTable.isActive, true));
    
    const iskResult = await db.select({ sum: sql<number>`coalesce(sum(total_isk), 0)` })
      .from(rattingSessionsTable);
    
    const killResult = await db.select({ sum: sql<number>`coalesce(sum(kill_count), 0)` })
      .from(rattingSessionsTable);
    
    const uniqueResult = await db.select({ count: sql<number>`count(distinct character_id)` })
      .from(rattingSessionsTable);
    
    return {
      totalSessions: Number(totalResult[0]?.count || 0),
      activeSessions: Number(activeResult[0]?.count || 0),
      totalIskEarned: Number(iskResult[0]?.sum || 0),
      totalKills: Number(killResult[0]?.sum || 0),
      uniqueUsers: Number(uniqueResult[0]?.count || 0),
    };
  }

  // Loot entry database methods
  async upsertLootEntry(entry: {
    sessionId: string;
    characterId: number;
    itemTypeId: number;
    itemTypeName: string;
    quantity: number;
    estimatedPrice: number;
    totalValue: number;
  }): Promise<LootEntryData> {
    // Check if entry exists for this session + item type
    const [existing] = await db.select()
      .from(lootEntriesTable)
      .where(and(
        eq(lootEntriesTable.sessionId, entry.sessionId),
        eq(lootEntriesTable.itemTypeId, entry.itemTypeId)
      ))
      .limit(1);
    
    if (existing) {
      // Update existing entry by adding quantities and values
      const newQty = existing.quantity + entry.quantity;
      const newTotal = existing.totalValue + entry.totalValue;
      const newPrice = newTotal / newQty;
      
      await db.update(lootEntriesTable)
        .set({
          quantity: newQty,
          totalValue: newTotal,
          estimatedPrice: newPrice,
        })
        .where(eq(lootEntriesTable.id, existing.id));
      
      return {
        id: existing.id,
        sessionId: entry.sessionId,
        characterId: entry.characterId,
        itemTypeId: entry.itemTypeId,
        itemTypeName: entry.itemTypeName,
        quantity: newQty,
        estimatedPrice: newPrice,
        totalValue: newTotal,
        createdAt: existing.createdAt,
      };
    }
    
    // Create new entry
    const id = randomUUID();
    await db.insert(lootEntriesTable).values({
      id,
      sessionId: entry.sessionId,
      characterId: entry.characterId,
      itemTypeId: entry.itemTypeId,
      itemTypeName: entry.itemTypeName,
      quantity: entry.quantity,
      estimatedPrice: entry.estimatedPrice,
      totalValue: entry.totalValue,
    });
    
    return {
      id,
      sessionId: entry.sessionId,
      characterId: entry.characterId,
      itemTypeId: entry.itemTypeId,
      itemTypeName: entry.itemTypeName,
      quantity: entry.quantity,
      estimatedPrice: entry.estimatedPrice,
      totalValue: entry.totalValue,
      createdAt: new Date(),
    };
  }

  async getLootEntriesBySession(sessionId: string): Promise<LootEntryData[]> {
    const results = await db.select()
      .from(lootEntriesTable)
      .where(eq(lootEntriesTable.sessionId, sessionId))
      .orderBy(desc(lootEntriesTable.totalValue));
    
    return results.map(r => ({
      id: r.id,
      sessionId: r.sessionId,
      characterId: r.characterId,
      itemTypeId: r.itemTypeId,
      itemTypeName: r.itemTypeName,
      quantity: r.quantity,
      estimatedPrice: r.estimatedPrice,
      totalValue: r.totalValue,
      createdAt: r.createdAt,
    }));
  }

  async clearSessionLoot(sessionId: string): Promise<number> {
    const entries = await db.select()
      .from(lootEntriesTable)
      .where(eq(lootEntriesTable.sessionId, sessionId));
    
    if (entries.length > 0) {
      await db.delete(lootEntriesTable)
        .where(eq(lootEntriesTable.sessionId, sessionId));
    }
    
    return entries.length;
  }

  async commitLootToSession(sessionId: string, lootTotal: number): Promise<RattingSessionData | undefined> {
    const session = await this.getRattingSessionById(sessionId);
    if (!session) return undefined;
    
    await db.update(rattingSessionsTable)
      .set({
        lootIsk: lootTotal,
        totalIsk: session.bountyIsk + lootTotal,
      })
      .where(eq(rattingSessionsTable.id, sessionId));
    
    return this.getRattingSessionById(sessionId);
  }

  private mapDbSessionToData(result: typeof rattingSessionsTable.$inferSelect): RattingSessionData {
    return {
      id: result.id,
      characterId: result.characterId,
      characterName: result.characterName,
      startTime: result.startTime,
      endTime: result.endTime,
      totalIsk: result.totalIsk,
      bountyIsk: result.bountyIsk,
      lootIsk: result.lootIsk,
      killCount: result.killCount,
      shipTypeId: result.shipTypeId,
      shipTypeName: result.shipTypeName,
      systemId: result.systemId,
      systemName: result.systemName,
      isActive: result.isActive,
      createdAt: result.createdAt,
    };
  }

  // PHOTON Code methods implementation
  async createPhotonCode(code: {
    code: string;
    codeType: string;
    createdByAdminId: number;
    createdByAdminName: string;
    maxRedemptions: number;
    expiresAt: Date | null;
    proDurationDays: number | null;
    badgeGrants: string[];
    themeUnlocks: string[];
    tileUnlocks: string[];
    note: string | null;
  }): Promise<PhotonCodeData> {
    const id = randomUUID();
    const now = new Date();
    
    await db.insert(photonCodesTable).values({
      id,
      code: code.code,
      codeType: code.codeType,
      createdByAdminId: code.createdByAdminId,
      createdByAdminName: code.createdByAdminName,
      status: "active",
      maxRedemptions: code.maxRedemptions,
      currentRedemptions: 0,
      expiresAt: code.expiresAt,
      proDurationDays: code.proDurationDays,
      badgeGrants: code.badgeGrants,
      themeUnlocks: code.themeUnlocks,
      tileUnlocks: code.tileUnlocks,
      note: code.note,
    });

    return {
      id,
      code: code.code,
      codeType: code.codeType,
      createdByAdminId: code.createdByAdminId,
      createdByAdminName: code.createdByAdminName,
      status: "active",
      maxRedemptions: code.maxRedemptions,
      currentRedemptions: 0,
      expiresAt: code.expiresAt,
      proDurationDays: code.proDurationDays,
      badgeGrants: code.badgeGrants,
      themeUnlocks: code.themeUnlocks,
      tileUnlocks: code.tileUnlocks,
      note: code.note,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getPhotonCode(code: string): Promise<PhotonCodeData | undefined> {
    const [result] = await db.select()
      .from(photonCodesTable)
      .where(eq(photonCodesTable.code, code))
      .limit(1);
    
    if (!result) return undefined;
    return this.mapDbPhotonCode(result);
  }

  async getPhotonCodeById(id: string): Promise<PhotonCodeData | undefined> {
    const [result] = await db.select()
      .from(photonCodesTable)
      .where(eq(photonCodesTable.id, id))
      .limit(1);
    
    if (!result) return undefined;
    return this.mapDbPhotonCode(result);
  }

  async getAllPhotonCodes(options?: { limit?: number; offset?: number; status?: string }): Promise<{ codes: PhotonCodeData[]; total: number }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    let query = db.select().from(photonCodesTable);
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(photonCodesTable);
    
    if (options?.status) {
      query = query.where(eq(photonCodesTable.status, options.status)) as typeof query;
      countQuery = countQuery.where(eq(photonCodesTable.status, options.status)) as typeof countQuery;
    }
    
    const results = await query
      .orderBy(desc(photonCodesTable.createdAt))
      .limit(limit)
      .offset(offset);
    
    const [countResult] = await countQuery;
    const total = Number(countResult?.count ?? 0);

    return {
      codes: results.map(r => this.mapDbPhotonCode(r)),
      total,
    };
  }

  async updatePhotonCodeStatus(codeId: string, status: string): Promise<PhotonCodeData | undefined> {
    await db.update(photonCodesTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(photonCodesTable.id, codeId));
    
    return this.getPhotonCodeById(codeId);
  }

  async incrementCodeRedemption(codeId: string): Promise<PhotonCodeData | undefined> {
    const code = await this.getPhotonCodeById(codeId);
    if (!code) return undefined;

    const newCount = code.currentRedemptions + 1;
    let newStatus = code.status;
    
    // If max redemptions reached and not unlimited (0), mark as redeemed
    if (code.maxRedemptions > 0 && newCount >= code.maxRedemptions) {
      newStatus = "redeemed";
    }

    await db.update(photonCodesTable)
      .set({ 
        currentRedemptions: newCount,
        status: newStatus,
        updatedAt: new Date() 
      })
      .where(eq(photonCodesTable.id, codeId));
    
    return this.getPhotonCodeById(codeId);
  }

  async revokePhotonCode(codeId: string): Promise<PhotonCodeData | undefined> {
    await db.update(photonCodesTable)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(eq(photonCodesTable.id, codeId));
    
    return this.getPhotonCodeById(codeId);
  }

  // PHOTON Redemption methods
  async createPhotonRedemption(redemption: {
    codeId: string;
    code: string;
    characterId: number;
    characterName: string;
  }): Promise<PhotonRedemptionData> {
    const id = randomUUID();
    const now = new Date();

    await db.insert(photonRedemptionsTable).values({
      id,
      codeId: redemption.codeId,
      code: redemption.code,
      characterId: redemption.characterId,
      characterName: redemption.characterName,
    });

    return {
      id,
      codeId: redemption.codeId,
      code: redemption.code,
      characterId: redemption.characterId,
      characterName: redemption.characterName,
      redeemedAt: now,
    };
  }

  async getRedemptionsByCode(codeId: string): Promise<PhotonRedemptionData[]> {
    const results = await db.select()
      .from(photonRedemptionsTable)
      .where(eq(photonRedemptionsTable.codeId, codeId))
      .orderBy(desc(photonRedemptionsTable.redeemedAt));
    
    return results.map(r => ({
      id: r.id,
      codeId: r.codeId,
      code: r.code,
      characterId: r.characterId,
      characterName: r.characterName,
      redeemedAt: r.redeemedAt,
    }));
  }

  async getRedemptionsByCharacter(characterId: number): Promise<PhotonRedemptionData[]> {
    const results = await db.select()
      .from(photonRedemptionsTable)
      .where(eq(photonRedemptionsTable.characterId, characterId))
      .orderBy(desc(photonRedemptionsTable.redeemedAt));
    
    return results.map(r => ({
      id: r.id,
      codeId: r.codeId,
      code: r.code,
      characterId: r.characterId,
      characterName: r.characterName,
      redeemedAt: r.redeemedAt,
    }));
  }

  async hasCharacterRedeemedCode(codeId: string, characterId: number): Promise<boolean> {
    const [result] = await db.select()
      .from(photonRedemptionsTable)
      .where(and(
        eq(photonRedemptionsTable.codeId, codeId),
        eq(photonRedemptionsTable.characterId, characterId)
      ))
      .limit(1);
    
    return !!result;
  }

  // PHOTON Activity Log methods
  async logPhotonActivity(log: {
    codeId: string | null;
    code: string;
    action: string;
    actorCharacterId: number;
    actorCharacterName: string;
    targetCharacterId?: number;
    targetCharacterName?: string;
    details?: Record<string, unknown>;
  }): Promise<PhotonActivityLogData> {
    const id = randomUUID();
    const now = new Date();

    await db.insert(photonActivityLogTable).values({
      id,
      codeId: log.codeId,
      code: log.code,
      action: log.action,
      actorCharacterId: log.actorCharacterId,
      actorCharacterName: log.actorCharacterName,
      targetCharacterId: log.targetCharacterId ?? null,
      targetCharacterName: log.targetCharacterName ?? null,
      details: log.details ?? {},
    });

    return {
      id,
      codeId: log.codeId,
      code: log.code,
      action: log.action,
      actorCharacterId: log.actorCharacterId,
      actorCharacterName: log.actorCharacterName,
      targetCharacterId: log.targetCharacterId ?? null,
      targetCharacterName: log.targetCharacterName ?? null,
      details: log.details ?? {},
      createdAt: now,
    };
  }

  async getPhotonActivityLog(options?: { limit?: number; offset?: number; action?: string; codeId?: string }): Promise<{ logs: PhotonActivityLogData[]; total: number }> {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    let query = db.select().from(photonActivityLogTable);
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(photonActivityLogTable);
    
    const conditions = [];
    if (options?.action) {
      conditions.push(eq(photonActivityLogTable.action, options.action));
    }
    if (options?.codeId) {
      conditions.push(eq(photonActivityLogTable.codeId, options.codeId));
    }
    
    if (conditions.length > 0) {
      const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
      query = query.where(whereClause as any) as typeof query;
      countQuery = countQuery.where(whereClause as any) as typeof countQuery;
    }

    const results = await query
      .orderBy(desc(photonActivityLogTable.createdAt))
      .limit(limit)
      .offset(offset);
    
    const [countResult] = await countQuery;
    const total = Number(countResult?.count ?? 0);

    return {
      logs: results.map(r => ({
        id: r.id,
        codeId: r.codeId,
        code: r.code,
        action: r.action,
        actorCharacterId: r.actorCharacterId,
        actorCharacterName: r.actorCharacterName,
        targetCharacterId: r.targetCharacterId,
        targetCharacterName: r.targetCharacterName,
        details: r.details as Record<string, unknown>,
        createdAt: r.createdAt,
      })),
      total,
    };
  }

  private mapDbPhotonCode(result: typeof photonCodesTable.$inferSelect): PhotonCodeData {
    return {
      id: result.id,
      code: result.code,
      codeType: result.codeType,
      createdByAdminId: result.createdByAdminId,
      createdByAdminName: result.createdByAdminName,
      status: result.status,
      maxRedemptions: result.maxRedemptions,
      currentRedemptions: result.currentRedemptions,
      expiresAt: result.expiresAt,
      proDurationDays: result.proDurationDays,
      badgeGrants: (result.badgeGrants as string[]) ?? [],
      themeUnlocks: (result.themeUnlocks as string[]) ?? [],
      tileUnlocks: (result.tileUnlocks as string[]) ?? [],
      note: result.note,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  // Support Ticket methods
  async createSupportTicket(ticket: {
    characterId: number;
    characterName: string;
    corporationId?: number;
    corporationName?: string;
    allianceId?: number;
    allianceName?: string;
    subject: string;
    message: string;
    category: string;
    priority?: string;
    attachments?: TicketAttachment[];
    isPro: boolean;
  }): Promise<SupportTicketData> {
    const id = randomUUID();
    const now = new Date();
    
    // Get next ticket number from sequence
    const [seqResult] = await db.execute(sql`SELECT nextval('ticket_number_seq')::int as ticket_number`);
    const ticketNumber = (seqResult as any).ticket_number;

    await db.insert(supportTicketsTable).values({
      id,
      ticketNumber,
      characterId: ticket.characterId,
      characterName: ticket.characterName,
      corporationId: ticket.corporationId ?? null,
      corporationName: ticket.corporationName ?? null,
      allianceId: ticket.allianceId ?? null,
      allianceName: ticket.allianceName ?? null,
      subject: ticket.subject,
      message: ticket.message,
      category: ticket.category,
      priority: ticket.priority ?? 'normal',
      status: 'open',
      attachments: ticket.attachments ?? [],
      isPro: ticket.isPro,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id,
      ticketNumber,
      characterId: ticket.characterId,
      characterName: ticket.characterName,
      corporationId: ticket.corporationId ?? null,
      corporationName: ticket.corporationName ?? null,
      allianceId: ticket.allianceId ?? null,
      allianceName: ticket.allianceName ?? null,
      subject: ticket.subject,
      message: ticket.message,
      category: ticket.category,
      priority: ticket.priority ?? 'normal',
      status: 'open',
      attachments: ticket.attachments ?? [],
      isPro: ticket.isPro,
      adminNotes: null,
      assignedToAdminId: null,
      assignedToAdminName: null,
      resolvedAt: null,
      resolvedByAdminId: null,
      resolvedByAdminName: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getSupportTicket(ticketId: string): Promise<SupportTicketData | undefined> {
    const [result] = await db.select()
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.id, ticketId))
      .limit(1);
    
    if (!result) return undefined;
    return this.mapDbTicket(result);
  }

  async getSupportTicketsByCharacter(characterId: number): Promise<SupportTicketData[]> {
    const results = await db.select()
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.characterId, characterId))
      .orderBy(desc(supportTicketsTable.createdAt));
    
    return results.map(r => this.mapDbTicket(r));
  }

  async getAllSupportTickets(options?: {
    limit?: number;
    offset?: number;
    status?: string;
    category?: string;
    priority?: string;
  }): Promise<{ tickets: SupportTicketData[]; total: number }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    let query = db.select().from(supportTicketsTable);
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(supportTicketsTable);
    
    const conditions = [];
    if (options?.status) {
      conditions.push(eq(supportTicketsTable.status, options.status));
    }
    if (options?.category) {
      conditions.push(eq(supportTicketsTable.category, options.category));
    }
    if (options?.priority) {
      conditions.push(eq(supportTicketsTable.priority, options.priority));
    }
    
    if (conditions.length > 0) {
      const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
      query = query.where(whereClause as any) as typeof query;
      countQuery = countQuery.where(whereClause as any) as typeof countQuery;
    }

    const results = await query
      .orderBy(desc(supportTicketsTable.createdAt))
      .limit(limit)
      .offset(offset);
    
    const [countResult] = await countQuery;
    const total = Number(countResult?.count ?? 0);

    return {
      tickets: results.map(r => this.mapDbTicket(r)),
      total,
    };
  }

  async updateSupportTicketStatus(ticketId: string, status: string, adminId?: number, adminName?: string): Promise<SupportTicketData | undefined> {
    const now = new Date();
    const updates: Record<string, any> = {
      status,
      updatedAt: now,
    };
    
    if (status === 'resolved' || status === 'closed') {
      updates.resolvedAt = now;
      if (adminId && adminName) {
        updates.resolvedByAdminId = adminId;
        updates.resolvedByAdminName = adminName;
      }
    }

    await db.update(supportTicketsTable)
      .set(updates)
      .where(eq(supportTicketsTable.id, ticketId));
    
    return this.getSupportTicket(ticketId);
  }

  async updateSupportTicketNotes(ticketId: string, notes: string): Promise<SupportTicketData | undefined> {
    await db.update(supportTicketsTable)
      .set({ adminNotes: notes, updatedAt: new Date() })
      .where(eq(supportTicketsTable.id, ticketId));
    
    return this.getSupportTicket(ticketId);
  }

  async assignSupportTicket(ticketId: string, adminId: number, adminName: string): Promise<SupportTicketData | undefined> {
    await db.update(supportTicketsTable)
      .set({ 
        assignedToAdminId: adminId, 
        assignedToAdminName: adminName,
        status: 'in_progress',
        updatedAt: new Date() 
      })
      .where(eq(supportTicketsTable.id, ticketId));
    
    return this.getSupportTicket(ticketId);
  }

  async getSupportTicketStatistics(): Promise<{
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
    byCategory: Record<string, number>;
    byPriority: Record<string, number>;
  }> {
    const tickets = await db.select().from(supportTicketsTable);
    
    const stats = {
      total: tickets.length,
      open: 0,
      inProgress: 0,
      resolved: 0,
      closed: 0,
      byCategory: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
    };

    for (const t of tickets) {
      switch (t.status) {
        case 'open': stats.open++; break;
        case 'in_progress': stats.inProgress++; break;
        case 'resolved': stats.resolved++; break;
        case 'closed': stats.closed++; break;
      }
      stats.byCategory[t.category] = (stats.byCategory[t.category] ?? 0) + 1;
      stats.byPriority[t.priority] = (stats.byPriority[t.priority] ?? 0) + 1;
    }

    return stats;
  }

  // Ticket Reply methods
  async createTicketReply(reply: {
    ticketId: string;
    characterId: number;
    characterName: string;
    message: string;
    isAdmin: boolean;
    attachments?: TicketAttachment[];
  }): Promise<TicketReplyData> {
    const id = randomUUID();
    const now = new Date();

    await db.insert(ticketRepliesTable).values({
      id,
      ticketId: reply.ticketId,
      characterId: reply.characterId,
      characterName: reply.characterName,
      message: reply.message,
      isAdmin: reply.isAdmin,
      attachments: reply.attachments ?? [],
      createdAt: now,
    });

    // Update the ticket's updatedAt timestamp
    await db.update(supportTicketsTable)
      .set({ updatedAt: now })
      .where(eq(supportTicketsTable.id, reply.ticketId));

    return {
      id,
      ticketId: reply.ticketId,
      characterId: reply.characterId,
      characterName: reply.characterName,
      message: reply.message,
      isAdmin: reply.isAdmin,
      attachments: reply.attachments ?? [],
      createdAt: now,
    };
  }

  async getTicketReplies(ticketId: string): Promise<TicketReplyData[]> {
    const results = await db.select()
      .from(ticketRepliesTable)
      .where(eq(ticketRepliesTable.ticketId, ticketId))
      .orderBy(ticketRepliesTable.createdAt);
    
    return results.map(r => ({
      id: r.id,
      ticketId: r.ticketId,
      characterId: r.characterId,
      characterName: r.characterName,
      message: r.message,
      isAdmin: r.isAdmin,
      attachments: (r.attachments as TicketAttachment[]) ?? [],
      editedAt: r.editedAt,
      createdAt: r.createdAt,
    }));
  }

  async getTicketReply(replyId: string): Promise<TicketReplyData | undefined> {
    const result = await db.select()
      .from(ticketRepliesTable)
      .where(eq(ticketRepliesTable.id, replyId))
      .limit(1);
    
    if (result.length === 0) return undefined;
    
    const r = result[0];
    return {
      id: r.id,
      ticketId: r.ticketId,
      characterId: r.characterId,
      characterName: r.characterName,
      message: r.message,
      isAdmin: r.isAdmin,
      attachments: (r.attachments as TicketAttachment[]) ?? [],
      editedAt: r.editedAt,
      createdAt: r.createdAt,
    };
  }

  async updateTicketMessage(ticketId: string, message: string): Promise<SupportTicketData | undefined> {
    const now = new Date();
    await db.update(supportTicketsTable)
      .set({ message, messageEditedAt: now, updatedAt: now })
      .where(eq(supportTicketsTable.id, ticketId));
    
    return this.getSupportTicket(ticketId);
  }

  async updateTicketReply(replyId: string, message: string): Promise<TicketReplyData | undefined> {
    const now = new Date();
    await db.update(ticketRepliesTable)
      .set({ message, editedAt: now })
      .where(eq(ticketRepliesTable.id, replyId));
    
    return this.getTicketReply(replyId);
  }

  private mapDbTicket(result: typeof supportTicketsTable.$inferSelect): SupportTicketData {
    return {
      id: result.id,
      ticketNumber: result.ticketNumber,
      characterId: result.characterId,
      characterName: result.characterName,
      corporationId: result.corporationId,
      corporationName: result.corporationName,
      allianceId: result.allianceId,
      allianceName: result.allianceName,
      subject: result.subject,
      message: result.message,
      messageEditedAt: result.messageEditedAt,
      category: result.category,
      priority: result.priority,
      status: result.status,
      attachments: (result.attachments as TicketAttachment[]) ?? [],
      isPro: result.isPro,
      adminNotes: result.adminNotes,
      assignedToAdminId: result.assignedToAdminId,
      assignedToAdminName: result.assignedToAdminName,
      resolvedAt: result.resolvedAt,
      resolvedByAdminId: result.resolvedByAdminId,
      resolvedByAdminName: result.resolvedByAdminName,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  // Ticket Notification Methods
  async createTicketNotification(notification: {
    ticketId: string;
    replyId?: string;
    recipientCharacterId: number;
    type: string;
    message: string;
  }): Promise<TicketNotificationData> {
    const id = randomUUID();
    const now = new Date();

    await db.insert(ticketNotificationsTable).values({
      id,
      ticketId: notification.ticketId,
      replyId: notification.replyId || null,
      recipientCharacterId: notification.recipientCharacterId,
      type: notification.type,
      isRead: false,
      message: notification.message,
      createdAt: now,
    });

    return {
      id,
      ticketId: notification.ticketId,
      replyId: notification.replyId || null,
      recipientCharacterId: notification.recipientCharacterId,
      type: notification.type,
      isRead: false,
      message: notification.message,
      createdAt: now,
    };
  }

  async getUnreadNotifications(characterId: number): Promise<TicketNotificationData[]> {
    const results = await db.select()
      .from(ticketNotificationsTable)
      .where(and(
        eq(ticketNotificationsTable.recipientCharacterId, characterId),
        eq(ticketNotificationsTable.isRead, false)
      ))
      .orderBy(desc(ticketNotificationsTable.createdAt));

    return results.map(r => ({
      id: r.id,
      ticketId: r.ticketId,
      replyId: r.replyId,
      recipientCharacterId: r.recipientCharacterId,
      type: r.type,
      isRead: r.isRead,
      message: r.message,
      createdAt: r.createdAt,
    }));
  }

  async getUnreadNotificationCount(characterId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(ticketNotificationsTable)
      .where(and(
        eq(ticketNotificationsTable.recipientCharacterId, characterId),
        eq(ticketNotificationsTable.isRead, false)
      ));

    return Number(result[0]?.count ?? 0);
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    await db.update(ticketNotificationsTable)
      .set({ isRead: true })
      .where(eq(ticketNotificationsTable.id, notificationId));
  }

  async markAllNotificationsRead(characterId: number, ticketId?: string): Promise<void> {
    if (ticketId) {
      await db.update(ticketNotificationsTable)
        .set({ isRead: true })
        .where(and(
          eq(ticketNotificationsTable.recipientCharacterId, characterId),
          eq(ticketNotificationsTable.ticketId, ticketId)
        ));
    } else {
      await db.update(ticketNotificationsTable)
        .set({ isRead: true })
        .where(eq(ticketNotificationsTable.recipientCharacterId, characterId));
    }
  }

  // Admin Notes methods (database)
  async createAdminNote(note: {
    targetCharacterId: number;
    targetCharacterName: string;
    authorCharacterId: number;
    authorCharacterName: string;
    content: string;
    isPinned?: boolean;
  }): Promise<AdminNoteData> {
    const id = randomUUID();
    const now = new Date();

    await db.insert(adminNotesTable).values({
      id,
      targetCharacterId: note.targetCharacterId,
      targetCharacterName: note.targetCharacterName,
      authorCharacterId: note.authorCharacterId,
      authorCharacterName: note.authorCharacterName,
      content: note.content,
      isPinned: note.isPinned || false,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id,
      targetCharacterId: note.targetCharacterId,
      targetCharacterName: note.targetCharacterName,
      authorCharacterId: note.authorCharacterId,
      authorCharacterName: note.authorCharacterName,
      content: note.content,
      isPinned: note.isPinned || false,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getAdminNotes(targetCharacterId: number): Promise<AdminNoteData[]> {
    const results = await db.select()
      .from(adminNotesTable)
      .where(eq(adminNotesTable.targetCharacterId, targetCharacterId))
      .orderBy(desc(adminNotesTable.isPinned), desc(adminNotesTable.createdAt));

    return results.map(r => ({
      id: r.id,
      targetCharacterId: r.targetCharacterId,
      targetCharacterName: r.targetCharacterName,
      authorCharacterId: r.authorCharacterId,
      authorCharacterName: r.authorCharacterName,
      content: r.content,
      isPinned: r.isPinned,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async updateAdminNote(noteId: string, updates: { content?: string; isPinned?: boolean }): Promise<AdminNoteData | undefined> {
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.isPinned !== undefined) updateData.isPinned = updates.isPinned;

    await db.update(adminNotesTable)
      .set(updateData)
      .where(eq(adminNotesTable.id, noteId));

    return this.getAdminNoteById(noteId);
  }

  async deleteAdminNote(noteId: string): Promise<boolean> {
    const result = await db.delete(adminNotesTable)
      .where(eq(adminNotesTable.id, noteId));
    return true;
  }

  async getAdminNoteById(noteId: string): Promise<AdminNoteData | undefined> {
    const [result] = await db.select()
      .from(adminNotesTable)
      .where(eq(adminNotesTable.id, noteId))
      .limit(1);

    if (!result) return undefined;

    return {
      id: result.id,
      targetCharacterId: result.targetCharacterId,
      targetCharacterName: result.targetCharacterName,
      authorCharacterId: result.authorCharacterId,
      authorCharacterName: result.authorCharacterName,
      content: result.content,
      isPinned: result.isPinned,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  // User Suspension methods (database)
  async createSuspension(suspension: {
    characterId: number;
    characterName: string;
    suspendedByAdminId: number;
    suspendedByAdminName: string;
    reason: string;
    expiresAt?: Date | null;
  }): Promise<UserSuspensionData> {
    const id = randomUUID();
    const now = new Date();

    await db.insert(userSuspensionsTable).values({
      id,
      characterId: suspension.characterId,
      characterName: suspension.characterName,
      suspendedByAdminId: suspension.suspendedByAdminId,
      suspendedByAdminName: suspension.suspendedByAdminName,
      reason: suspension.reason,
      expiresAt: suspension.expiresAt || null,
      isActive: true,
      createdAt: now,
    });

    return {
      id,
      characterId: suspension.characterId,
      characterName: suspension.characterName,
      suspendedByAdminId: suspension.suspendedByAdminId,
      suspendedByAdminName: suspension.suspendedByAdminName,
      reason: suspension.reason,
      expiresAt: suspension.expiresAt || null,
      liftedAt: null,
      liftedByAdminId: null,
      liftedByAdminName: null,
      isActive: true,
      createdAt: now,
    };
  }

  async getActiveSuspension(characterId: number): Promise<UserSuspensionData | undefined> {
    const now = new Date();
    
    // First, expire any old suspensions
    await db.update(userSuspensionsTable)
      .set({ isActive: false })
      .where(and(
        eq(userSuspensionsTable.characterId, characterId),
        eq(userSuspensionsTable.isActive, true),
        lt(userSuspensionsTable.expiresAt, now)
      ));

    const [result] = await db.select()
      .from(userSuspensionsTable)
      .where(and(
        eq(userSuspensionsTable.characterId, characterId),
        eq(userSuspensionsTable.isActive, true)
      ))
      .limit(1);

    if (!result) return undefined;

    return {
      id: result.id,
      characterId: result.characterId,
      characterName: result.characterName,
      suspendedByAdminId: result.suspendedByAdminId,
      suspendedByAdminName: result.suspendedByAdminName,
      reason: result.reason,
      expiresAt: result.expiresAt,
      liftedAt: result.liftedAt,
      liftedByAdminId: result.liftedByAdminId,
      liftedByAdminName: result.liftedByAdminName,
      isActive: result.isActive,
      createdAt: result.createdAt,
    };
  }

  async getSuspensionHistory(characterId: number): Promise<UserSuspensionData[]> {
    const results = await db.select()
      .from(userSuspensionsTable)
      .where(eq(userSuspensionsTable.characterId, characterId))
      .orderBy(desc(userSuspensionsTable.createdAt));

    return results.map(r => ({
      id: r.id,
      characterId: r.characterId,
      characterName: r.characterName,
      suspendedByAdminId: r.suspendedByAdminId,
      suspendedByAdminName: r.suspendedByAdminName,
      reason: r.reason,
      expiresAt: r.expiresAt,
      liftedAt: r.liftedAt,
      liftedByAdminId: r.liftedByAdminId,
      liftedByAdminName: r.liftedByAdminName,
      isActive: r.isActive,
      createdAt: r.createdAt,
    }));
  }

  async liftSuspension(suspensionId: string, liftedByAdminId: number, liftedByAdminName: string): Promise<UserSuspensionData | undefined> {
    const now = new Date();

    await db.update(userSuspensionsTable)
      .set({
        isActive: false,
        liftedAt: now,
        liftedByAdminId,
        liftedByAdminName,
      })
      .where(eq(userSuspensionsTable.id, suspensionId));

    const [result] = await db.select()
      .from(userSuspensionsTable)
      .where(eq(userSuspensionsTable.id, suspensionId))
      .limit(1);

    if (!result) return undefined;

    return {
      id: result.id,
      characterId: result.characterId,
      characterName: result.characterName,
      suspendedByAdminId: result.suspendedByAdminId,
      suspendedByAdminName: result.suspendedByAdminName,
      reason: result.reason,
      expiresAt: result.expiresAt,
      liftedAt: result.liftedAt,
      liftedByAdminId: result.liftedByAdminId,
      liftedByAdminName: result.liftedByAdminName,
      isActive: result.isActive,
      createdAt: result.createdAt,
    };
  }

  async getAllActiveSuspensions(): Promise<UserSuspensionData[]> {
    const now = new Date();
    
    const results = await db.select()
      .from(userSuspensionsTable)
      .where(eq(userSuspensionsTable.isActive, true));

    return results
      .filter(r => !r.expiresAt || r.expiresAt > now)
      .map(r => ({
        id: r.id,
        characterId: r.characterId,
        characterName: r.characterName,
        suspendedByAdminId: r.suspendedByAdminId,
        suspendedByAdminName: r.suspendedByAdminName,
        reason: r.reason,
        expiresAt: r.expiresAt,
        liftedAt: r.liftedAt,
        liftedByAdminId: r.liftedByAdminId,
        liftedByAdminName: r.liftedByAdminName,
        isActive: r.isActive,
        createdAt: r.createdAt,
      }));
  }

  // Admin Audit Log methods (database)
  async createAuditLog(log: {
    adminCharacterId: number;
    adminCharacterName: string;
    action: string;
    targetCharacterId?: number;
    targetCharacterName?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
  }): Promise<AdminAuditLogData> {
    const id = randomUUID();
    const now = new Date();

    await db.insert(adminAuditLogTable).values({
      id,
      adminCharacterId: log.adminCharacterId,
      adminCharacterName: log.adminCharacterName,
      action: log.action,
      targetCharacterId: log.targetCharacterId || null,
      targetCharacterName: log.targetCharacterName || null,
      details: log.details || {},
      ipAddress: log.ipAddress || null,
      createdAt: now,
    });

    return {
      id,
      adminCharacterId: log.adminCharacterId,
      adminCharacterName: log.adminCharacterName,
      action: log.action,
      targetCharacterId: log.targetCharacterId || null,
      targetCharacterName: log.targetCharacterName || null,
      details: log.details || {},
      ipAddress: log.ipAddress || null,
      createdAt: now,
    };
  }

  async getAuditLog(options?: {
    limit?: number;
    offset?: number;
    adminCharacterId?: number;
    targetCharacterId?: number;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ logs: AdminAuditLogData[]; total: number }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    let query = db.select().from(adminAuditLogTable);
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(adminAuditLogTable);

    const conditions = [];
    if (options?.adminCharacterId) {
      conditions.push(eq(adminAuditLogTable.adminCharacterId, options.adminCharacterId));
    }
    if (options?.targetCharacterId) {
      conditions.push(eq(adminAuditLogTable.targetCharacterId, options.targetCharacterId));
    }
    if (options?.action) {
      conditions.push(eq(adminAuditLogTable.action, options.action));
    }
    if (options?.startDate) {
      conditions.push(gte(adminAuditLogTable.createdAt, options.startDate));
    }
    if (options?.endDate) {
      conditions.push(lte(adminAuditLogTable.createdAt, options.endDate));
    }

    if (conditions.length > 0) {
      const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
      query = query.where(whereClause as any) as typeof query;
      countQuery = countQuery.where(whereClause as any) as typeof countQuery;
    }

    const results = await query
      .orderBy(desc(adminAuditLogTable.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await countQuery;
    const total = Number(countResult?.count ?? 0);

    return {
      logs: results.map(r => ({
        id: r.id,
        adminCharacterId: r.adminCharacterId,
        adminCharacterName: r.adminCharacterName,
        action: r.action,
        targetCharacterId: r.targetCharacterId,
        targetCharacterName: r.targetCharacterName,
        details: (r.details as Record<string, unknown>) || {},
        ipAddress: r.ipAddress,
        createdAt: r.createdAt,
      })),
      total,
    };
  }

  async getAuditLogForUser(targetCharacterId: number, limit: number = 20): Promise<AdminAuditLogData[]> {
    const results = await db.select()
      .from(adminAuditLogTable)
      .where(eq(adminAuditLogTable.targetCharacterId, targetCharacterId))
      .orderBy(desc(adminAuditLogTable.createdAt))
      .limit(limit);

    return results.map(r => ({
      id: r.id,
      adminCharacterId: r.adminCharacterId,
      adminCharacterName: r.adminCharacterName,
      action: r.action,
      targetCharacterId: r.targetCharacterId,
      targetCharacterName: r.targetCharacterName,
      details: (r.details as Record<string, unknown>) || {},
      ipAddress: r.ipAddress,
      createdAt: r.createdAt,
    }));
  }

  // User management methods (database)
  async getAllUsers(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    activeOnly?: boolean;
    adminsOnly?: boolean;
    suspendedOnly?: boolean;
    proOnly?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ users: UserManagementData[]; total: number }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const now = new Date();
    const activeThreshold = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago

    // Get all user preferences (this is our user list)
    const allUsers = await db.select().from(userPreferences);
    
    // Get all active sessions
    const activeSessions = await db.select()
      .from(rattingSessionsTable)
      .where(eq(rattingSessionsTable.isActive, true));
    const activeCharacterIds = new Set(activeSessions.map(s => s.characterId));

    // Get all admins
    const allAdmins = await db.select().from(dynamicAdmins);
    const adminCharacterIds = new Set(allAdmins.map(a => a.characterId));

    // Get active suspensions
    const activeSuspensions = await db.select()
      .from(userSuspensionsTable)
      .where(eq(userSuspensionsTable.isActive, true));
    const suspendedMap = new Map(activeSuspensions.map(s => [s.characterId, s.reason]));

    // Get PRO subscriptions
    const allSubs = await db.select().from(proSubscriptions);
    const proMap = new Map(allSubs.map(s => [s.characterId, s]));

    // Get session counts and totals per user
    const allSessions = await db.select().from(rattingSessionsTable);
    const sessionStats = new Map<number, { count: number; totalIsk: number }>();
    for (const session of allSessions) {
      const stats = sessionStats.get(session.characterId) || { count: 0, totalIsk: 0 };
      stats.count++;
      stats.totalIsk += session.totalIsk || 0;
      sessionStats.set(session.characterId, stats);
    }

    // Get note counts
    const allNotes = await db.select().from(adminNotesTable);
    const noteCountMap = new Map<number, number>();
    for (const note of allNotes) {
      noteCountMap.set(note.targetCharacterId, (noteCountMap.get(note.targetCharacterId) || 0) + 1);
    }

    // Build user list
    let users: UserManagementData[] = allUsers.map(u => {
      const isOnline = activeCharacterIds.has(u.characterId);
      const isAdmin = adminCharacterIds.has(u.characterId);
      const isSuspended = suspendedMap.has(u.characterId);
      const proSub = proMap.get(u.characterId);
      const isPro = proSub?.status === 'active' && proSub.expiresAt && proSub.expiresAt > now;
      const stats = sessionStats.get(u.characterId) || { count: 0, totalIsk: 0 };

      return {
        characterId: u.characterId,
        characterName: u.characterName,
        firstLoginAt: u.firstLoginAt,
        lastActiveAt: u.updatedAt,
        isOnline,
        isAdmin,
        isSuperAdmin: false, // Will be checked against hardcoded list
        isPro: isPro || false,
        proExpiresAt: proSub?.expiresAt || null,
        isSuspended,
        suspensionReason: suspendedMap.get(u.characterId) || null,
        sessionCount: stats.count,
        totalIsk: stats.totalIsk,
        hasNotes: (noteCountMap.get(u.characterId) || 0) > 0,
      };
    });

    // Apply filters
    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      users = users.filter(u => u.characterName.toLowerCase().includes(searchLower));
    }
    if (options?.activeOnly) {
      users = users.filter(u => u.isOnline);
    }
    if (options?.adminsOnly) {
      users = users.filter(u => u.isAdmin);
    }
    if (options?.suspendedOnly) {
      users = users.filter(u => u.isSuspended);
    }
    if (options?.proOnly) {
      users = users.filter(u => u.isPro);
    }

    // Sort
    const sortBy = options?.sortBy || 'characterName';
    const sortOrder = options?.sortOrder || 'asc';
    users.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'characterName':
          comparison = a.characterName.localeCompare(b.characterName);
          break;
        case 'firstLoginAt':
          comparison = a.firstLoginAt.getTime() - b.firstLoginAt.getTime();
          break;
        case 'lastActiveAt':
          comparison = (a.lastActiveAt?.getTime() || 0) - (b.lastActiveAt?.getTime() || 0);
          break;
        case 'totalIsk':
          comparison = a.totalIsk - b.totalIsk;
          break;
        case 'sessionCount':
          comparison = a.sessionCount - b.sessionCount;
          break;
        default:
          comparison = a.characterName.localeCompare(b.characterName);
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    const total = users.length;
    users = users.slice(offset, offset + limit);

    return { users, total };
  }

  async getUserDetails(characterId: number): Promise<UserDetailData | undefined> {
    // Get user preferences
    const [userPref] = await db.select()
      .from(userPreferences)
      .where(eq(userPreferences.characterId, characterId))
      .limit(1);

    if (!userPref) return undefined;

    const now = new Date();

    // Get active session
    const [activeSession] = await db.select()
      .from(rattingSessionsTable)
      .where(and(
        eq(rattingSessionsTable.characterId, characterId),
        eq(rattingSessionsTable.isActive, true)
      ))
      .limit(1);
    const isOnline = !!activeSession;

    // Get admin status
    const [admin] = await db.select()
      .from(dynamicAdmins)
      .where(eq(dynamicAdmins.characterId, characterId))
      .limit(1);
    const isAdmin = !!admin;

    // Get PRO subscription
    const [proSub] = await db.select()
      .from(proSubscriptions)
      .where(eq(proSubscriptions.characterId, characterId))
      .limit(1);
    const isPro = proSub?.status === 'active' && proSub.expiresAt && proSub.expiresAt > now;

    // Get active suspension
    const activeSuspension = await this.getActiveSuspension(characterId);

    // Get all sessions for stats
    const sessions = await db.select()
      .from(rattingSessionsTable)
      .where(eq(rattingSessionsTable.characterId, characterId))
      .orderBy(desc(rattingSessionsTable.startTime));

    const totalIsk = sessions.reduce((sum, s) => sum + (s.totalIsk || 0), 0);
    const totalKills = sessions.reduce((sum, s) => sum + (s.killCount || 0), 0);
    const totalTimeMinutes = sessions.reduce((sum, s) => {
      if (s.endTime && s.startTime) {
        return sum + (s.endTime.getTime() - s.startTime.getTime()) / 60000;
      }
      return sum;
    }, 0);
    const avgIskPerHour = totalTimeMinutes > 0 ? (totalIsk / (totalTimeMinutes / 60)) : 0;

    // Get special badges
    const badges = await db.select()
      .from(specialBadgesTable)
      .where(eq(specialBadgesTable.characterId, characterId));

    // Get admin notes
    const notes = await this.getAdminNotes(characterId);

    // Get admin history for this user
    const adminHistory = await this.getAuditLogForUser(characterId, 20);

    // Get unlocks
    const unlocks = await this.getUserUnlocks(characterId);

    // Map recent sessions
    const recentSessions: RattingSessionData[] = sessions.slice(0, 10).map(s => ({
      id: s.id,
      characterId: s.characterId,
      characterName: s.characterName,
      startTime: s.startTime,
      endTime: s.endTime,
      totalIsk: s.totalIsk,
      bountyIsk: s.bountyIsk,
      lootIsk: s.lootIsk || 0,
      killCount: s.killCount || 0,
      shipTypeId: s.shipTypeId,
      shipTypeName: s.shipTypeName,
      systemId: s.systemId,
      systemName: s.systemName,
      isActive: s.isActive,
      createdAt: s.createdAt,
    }));

    // Get cached corporation and alliance info (5 min TTL, shared cache with auth)
    const corpAlliance = await getCachedCorpAllianceInfo(characterId);

    return {
      characterId: userPref.characterId,
      characterName: userPref.characterName,
      corporationId: corpAlliance.corporationId,
      corporationName: corpAlliance.corporationName,
      allianceId: corpAlliance.allianceId,
      allianceName: corpAlliance.allianceName,
      firstLoginAt: userPref.firstLoginAt,
      lastActiveAt: userPref.updatedAt,
      isOnline,
      isAdmin,
      isSuperAdmin: false,
      isPro: isPro || false,
      proExpiresAt: proSub?.expiresAt || null,
      proActivatedAt: proSub?.activatedAt || null,
      isSuspended: !!activeSuspension,
      activeSuspension: activeSuspension || null,
      corpTaxRate: userPref.corpTaxRate,
      theme: userPref.theme,
      sessionCount: sessions.length,
      totalIsk,
      totalKills,
      averageIskPerHour: avgIskPerHour,
      totalTimePlayedMinutes: totalTimeMinutes,
      recentSessions,
      badges: badges.map(b => ({
        id: b.id,
        characterId: b.characterId,
        characterName: b.characterName,
        badgeType: b.badgeType as SpecialBadgeType,
        grantedByAdminId: b.grantedByAdminId,
        grantedByAdminName: b.grantedByAdminName,
        note: b.note,
        grantedAt: b.grantedAt,
      })),
      notes,
      adminHistory,
      unlocks: unlocks || null,
      promotedByAdminName: admin?.addedByCharacterName || null,
      promotedAt: admin?.addedAt || null,
    };
  }

  async getActiveUsersCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(rattingSessionsTable)
      .where(eq(rattingSessionsTable.isActive, true));

    return Number(result[0]?.count ?? 0);
  }

  // Linked characters methods for multiboxing support
  async linkCharacter(data: InsertLinkedCharacter): Promise<LinkedCharacter> {
    const result = await db.insert(linkedCharactersTable)
      .values(data)
      .returning();
    return result[0];
  }

  async unlinkCharacter(primaryCharacterId: number, characterId: number): Promise<void> {
    await db.delete(linkedCharactersTable)
      .where(and(
        eq(linkedCharactersTable.primaryCharacterId, primaryCharacterId),
        eq(linkedCharactersTable.characterId, characterId)
      ));
  }

  async getLinkedCharacters(primaryCharacterId: number): Promise<LinkedCharacter[]> {
    return await db.select()
      .from(linkedCharactersTable)
      .where(eq(linkedCharactersTable.primaryCharacterId, primaryCharacterId))
      .orderBy(linkedCharactersTable.linkedAt);
  }

  async getLinkedCharacter(characterId: number): Promise<LinkedCharacter | undefined> {
    const result = await db.select()
      .from(linkedCharactersTable)
      .where(eq(linkedCharactersTable.characterId, characterId))
      .limit(1);
    return result[0];
  }

  async isCharacterLinked(characterId: number): Promise<boolean> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(linkedCharactersTable)
      .where(eq(linkedCharactersTable.characterId, characterId));
    return Number(result[0]?.count ?? 0) > 0;
  }

  async updateLinkedCharacterTokens(characterId: number, tokens: {
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
  }): Promise<void> {
    await db.update(linkedCharactersTable)
      .set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.tokenExpiresAt,
        lastRefreshedAt: new Date(),
      })
      .where(eq(linkedCharactersTable.characterId, characterId));
  }

  async updateLinkedCharacterLastUsed(characterId: number): Promise<void> {
    await db.update(linkedCharactersTable)
      .set({ lastUsedAt: new Date() })
      .where(eq(linkedCharactersTable.characterId, characterId));
  }

  async getPrimaryCharacterId(characterId: number): Promise<number | undefined> {
    const result = await db.select({ primaryCharacterId: linkedCharactersTable.primaryCharacterId })
      .from(linkedCharactersTable)
      .where(eq(linkedCharactersTable.characterId, characterId))
      .limit(1);
    return result[0]?.primaryCharacterId;
  }

  // Income goals methods
  async getIncomeGoals(characterId: number): Promise<IncomeGoalData | undefined> {
    const result = await db.select()
      .from(incomeGoalsTable)
      .where(eq(incomeGoalsTable.characterId, characterId))
      .limit(1);
    
    if (!result[0]) return undefined;
    
    return {
      id: result[0].id,
      characterId: result[0].characterId,
      characterName: result[0].characterName,
      dailyTarget: result[0].dailyTarget,
      weeklyTarget: result[0].weeklyTarget,
      monthlyTarget: result[0].monthlyTarget,
      createdAt: result[0].createdAt,
      updatedAt: result[0].updatedAt,
    };
  }

  async upsertIncomeGoals(data: {
    characterId: number;
    characterName: string;
    dailyTarget: number;
    weeklyTarget: number;
    monthlyTarget: number;
  }): Promise<IncomeGoalData> {
    const existing = await this.getIncomeGoals(data.characterId);
    
    if (existing) {
      await db.update(incomeGoalsTable)
        .set({
          dailyTarget: data.dailyTarget,
          weeklyTarget: data.weeklyTarget,
          monthlyTarget: data.monthlyTarget,
          updatedAt: new Date(),
        })
        .where(eq(incomeGoalsTable.characterId, data.characterId));
      
      return {
        ...existing,
        dailyTarget: data.dailyTarget,
        weeklyTarget: data.weeklyTarget,
        monthlyTarget: data.monthlyTarget,
        updatedAt: new Date(),
      };
    } else {
      const id = randomUUID();
      const now = new Date();
      
      await db.insert(incomeGoalsTable).values({
        id,
        characterId: data.characterId,
        characterName: data.characterName,
        dailyTarget: data.dailyTarget,
        weeklyTarget: data.weeklyTarget,
        monthlyTarget: data.monthlyTarget,
        createdAt: now,
        updatedAt: now,
      });
      
      return {
        id,
        characterId: data.characterId,
        characterName: data.characterName,
        dailyTarget: data.dailyTarget,
        weeklyTarget: data.weeklyTarget,
        monthlyTarget: data.monthlyTarget,
        createdAt: now,
        updatedAt: now,
      };
    }
  }

  async getIncomeEarnings(characterId: number, period: 'daily' | 'weekly' | 'monthly'): Promise<number> {
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        const dayOfWeek = now.getDay();
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }
    
    const result = await db.select({
      total: sql<number>`COALESCE(SUM(${rattingSessionsTable.totalIsk}), 0)`
    })
      .from(rattingSessionsTable)
      .where(and(
        eq(rattingSessionsTable.characterId, characterId),
        gte(rattingSessionsTable.startTime, startDate),
        eq(rattingSessionsTable.isActive, false)
      ));
    
    return Number(result[0]?.total ?? 0);
  }

  // Moon Calculator data methods
  async getUserMoons(characterId: number): Promise<UserMoon[]> {
    const results = await db.select()
      .from(userMoonsTable)
      .where(eq(userMoonsTable.characterId, characterId))
      .orderBy(desc(userMoonsTable.createdAt));
    
    return results;
  }

  async createUserMoon(data: InsertUserMoon): Promise<UserMoon> {
    const id = randomUUID();
    const now = new Date();
    
    const [result] = await db.insert(userMoonsTable).values({
      id,
      ...data,
      createdAt: now,
      updatedAt: now,
    }).returning();
    
    return result;
  }

  async updateUserMoon(moonId: string, characterId: number, updates: { notes?: string; isFavorite?: boolean }): Promise<UserMoon | undefined> {
    const [result] = await db.update(userMoonsTable)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(
        eq(userMoonsTable.id, moonId),
        eq(userMoonsTable.characterId, characterId)
      ))
      .returning();
    
    return result;
  }

  async deleteUserMoon(moonId: string, characterId: number): Promise<boolean> {
    const result = await db.delete(userMoonsTable)
      .where(and(
        eq(userMoonsTable.id, moonId),
        eq(userMoonsTable.characterId, characterId)
      ))
      .returning();
    
    return result.length > 0;
  }

  async getUserMoonPrices(characterId: number): Promise<UserMoonPrices | undefined> {
    const [result] = await db.select()
      .from(userMoonPricesTable)
      .where(eq(userMoonPricesTable.characterId, characterId))
      .limit(1);
    
    return result;
  }

  async saveUserMoonPrices(characterId: number, prices: Record<string, number>): Promise<UserMoonPrices> {
    const existing = await this.getUserMoonPrices(characterId);
    
    if (existing) {
      const [result] = await db.update(userMoonPricesTable)
        .set({
          prices,
          lastUpdated: new Date(),
        })
        .where(eq(userMoonPricesTable.characterId, characterId))
        .returning();
      
      return result;
    } else {
      const id = randomUUID();
      const [result] = await db.insert(userMoonPricesTable).values({
        id,
        characterId,
        prices,
        lastUpdated: new Date(),
      }).returning();
      
      return result;
    }
  }

  // Industry Jobs methods
  async getIndustryJobs(characterId: number, options?: { status?: string; activityId?: number }): Promise<IndustryJobData[]> {
    let query = db.select().from(industryJobsTable).where(eq(industryJobsTable.characterId, characterId));
    
    const results = await query.orderBy(desc(industryJobsTable.endDate));
    
    let filtered = results;
    if (options?.status) {
      filtered = filtered.filter(j => j.status === options.status);
    }
    if (options?.activityId) {
      filtered = filtered.filter(j => j.activityId === options.activityId);
    }
    
    return filtered.map(j => ({
      ...j,
      startDate: new Date(j.startDate),
      endDate: new Date(j.endDate),
      completedDate: j.completedDate ? new Date(j.completedDate) : null,
      cachedAt: new Date(j.cachedAt),
      updatedAt: new Date(j.updatedAt),
    }));
  }

  async getIndustryJobsForCharacters(characterIds: number[], options?: { status?: string; activityId?: number }): Promise<IndustryJobData[]> {
    if (characterIds.length === 0) return [];
    
    const results = await db.select()
      .from(industryJobsTable)
      .where(sql`${industryJobsTable.characterId} = ANY(${characterIds})`)
      .orderBy(desc(industryJobsTable.endDate));
    
    let filtered = results;
    if (options?.status) {
      filtered = filtered.filter(j => j.status === options.status);
    }
    if (options?.activityId) {
      filtered = filtered.filter(j => j.activityId === options.activityId);
    }
    
    return filtered.map(j => ({
      ...j,
      startDate: new Date(j.startDate),
      endDate: new Date(j.endDate),
      completedDate: j.completedDate ? new Date(j.completedDate) : null,
      cachedAt: new Date(j.cachedAt),
      updatedAt: new Date(j.updatedAt),
    }));
  }

  async upsertIndustryJob(job: Omit<IndustryJobData, 'id' | 'cachedAt' | 'updatedAt'>): Promise<IndustryJobData> {
    // Check if job exists
    const [existing] = await db.select()
      .from(industryJobsTable)
      .where(and(
        eq(industryJobsTable.characterId, job.characterId),
        eq(industryJobsTable.jobId, job.jobId)
      ))
      .limit(1);
    
    if (existing) {
      const [result] = await db.update(industryJobsTable)
        .set({
          ...job,
          updatedAt: new Date(),
        })
        .where(eq(industryJobsTable.id, existing.id))
        .returning();
      
      return {
        ...result,
        startDate: new Date(result.startDate),
        endDate: new Date(result.endDate),
        completedDate: result.completedDate ? new Date(result.completedDate) : null,
        cachedAt: new Date(result.cachedAt),
        updatedAt: new Date(result.updatedAt),
      };
    } else {
      const id = randomUUID();
      const [result] = await db.insert(industryJobsTable).values({
        id,
        ...job,
        cachedAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      
      return {
        ...result,
        startDate: new Date(result.startDate),
        endDate: new Date(result.endDate),
        completedDate: result.completedDate ? new Date(result.completedDate) : null,
        cachedAt: new Date(result.cachedAt),
        updatedAt: new Date(result.updatedAt),
      };
    }
  }

  async upsertIndustryJobs(jobs: Omit<IndustryJobData, 'id' | 'cachedAt' | 'updatedAt'>[]): Promise<IndustryJobData[]> {
    const results: IndustryJobData[] = [];
    for (const job of jobs) {
      const result = await this.upsertIndustryJob(job);
      results.push(result);
    }
    return results;
  }

  async deleteStaleIndustryJobs(characterId: number, currentJobIds: number[]): Promise<number> {
    if (currentJobIds.length === 0) {
      // Delete all jobs for this character if no current jobs
      const result = await db.delete(industryJobsTable)
        .where(eq(industryJobsTable.characterId, characterId))
        .returning();
      return result.length;
    }
    
    // Delete jobs that are no longer in the current list
    const result = await db.delete(industryJobsTable)
      .where(and(
        eq(industryJobsTable.characterId, characterId),
        sql`${industryJobsTable.jobId} != ALL(${currentJobIds})`
      ))
      .returning();
    
    return result.length;
  }

  async getIndustryJobStats(characterId: number): Promise<{
    activeJobs: number;
    completedToday: number;
    totalProfit: number;
    avgIskPerHour: number;
  }> {
    const jobs = await this.getIndustryJobs(characterId);
    
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const activeJobs = jobs.filter(j => j.status === 'active' || j.status === 'ready').length;
    const completedToday = jobs.filter(j => 
      j.status === 'delivered' && j.completedDate && j.completedDate >= startOfDay
    ).length;
    
    const completedWithProfit = jobs.filter(j => j.status === 'delivered' && j.estimatedProfit);
    const totalProfit = completedWithProfit.reduce((sum, j) => sum + (j.estimatedProfit || 0), 0);
    const avgIskPerHour = completedWithProfit.length > 0
      ? completedWithProfit.reduce((sum, j) => sum + (j.iskPerHour || 0), 0) / completedWithProfit.length
      : 0;
    
    return {
      activeJobs,
      completedToday,
      totalProfit,
      avgIskPerHour,
    };
  }

  // Planetary Industry methods
  async getPlanetaryPlanets(characterId: number): Promise<PlanetaryPlanetData[]> {
    const results = await db.select()
      .from(planetaryPlanetsTable)
      .where(eq(planetaryPlanetsTable.characterId, characterId));
    
    return results.map(r => ({
      id: r.id,
      characterId: r.characterId,
      characterName: r.characterName,
      planetId: r.planetId,
      planetName: r.planetName,
      planetTypeId: r.planetTypeId,
      planetTypeName: r.planetTypeName,
      solarSystemId: r.solarSystemId,
      solarSystemName: r.solarSystemName,
      upgradeLevel: r.upgradeLevel,
      numPins: r.numPins,
      lastUpdate: r.lastUpdate,
      cachedAt: r.cachedAt,
      updatedAt: r.updatedAt,
    }));
  }

  async getPlanetaryPlanetsForCharacters(characterIds: number[]): Promise<PlanetaryPlanetData[]> {
    if (characterIds.length === 0) return [];
    
    const results = await db.select()
      .from(planetaryPlanetsTable)
      .where(sql`${planetaryPlanetsTable.characterId} = ANY(${characterIds})`);
    
    return results.map(r => ({
      id: r.id,
      characterId: r.characterId,
      characterName: r.characterName,
      planetId: r.planetId,
      planetName: r.planetName,
      planetTypeId: r.planetTypeId,
      planetTypeName: r.planetTypeName,
      solarSystemId: r.solarSystemId,
      solarSystemName: r.solarSystemName,
      upgradeLevel: r.upgradeLevel,
      numPins: r.numPins,
      lastUpdate: r.lastUpdate,
      cachedAt: r.cachedAt,
      updatedAt: r.updatedAt,
    }));
  }

  async upsertPlanetaryPlanet(planet: Omit<PlanetaryPlanetData, 'id' | 'cachedAt' | 'updatedAt'>): Promise<PlanetaryPlanetData> {
    const [result] = await db.insert(planetaryPlanetsTable)
      .values({
        characterId: planet.characterId,
        characterName: planet.characterName,
        planetId: planet.planetId,
        planetName: planet.planetName,
        planetTypeId: planet.planetTypeId,
        planetTypeName: planet.planetTypeName,
        solarSystemId: planet.solarSystemId,
        solarSystemName: planet.solarSystemName,
        upgradeLevel: planet.upgradeLevel,
        numPins: planet.numPins,
        lastUpdate: planet.lastUpdate,
      })
      .onConflictDoUpdate({
        target: [planetaryPlanetsTable.characterId, planetaryPlanetsTable.planetId],
        set: {
          planetName: planet.planetName,
          planetTypeName: planet.planetTypeName,
          solarSystemName: planet.solarSystemName,
          upgradeLevel: planet.upgradeLevel,
          numPins: planet.numPins,
          lastUpdate: planet.lastUpdate,
          updatedAt: new Date(),
        },
      })
      .returning();
    
    return {
      id: result.id,
      characterId: result.characterId,
      characterName: result.characterName,
      planetId: result.planetId,
      planetName: result.planetName,
      planetTypeId: result.planetTypeId,
      planetTypeName: result.planetTypeName,
      solarSystemId: result.solarSystemId,
      solarSystemName: result.solarSystemName,
      upgradeLevel: result.upgradeLevel,
      numPins: result.numPins,
      lastUpdate: result.lastUpdate,
      cachedAt: result.cachedAt,
      updatedAt: result.updatedAt,
    };
  }

  async deleteStalePlanetaryPlanets(characterId: number, currentPlanetIds: number[]): Promise<number> {
    if (currentPlanetIds.length === 0) {
      const result = await db.delete(planetaryPlanetsTable)
        .where(eq(planetaryPlanetsTable.characterId, characterId))
        .returning();
      return result.length;
    }

    const result = await db.delete(planetaryPlanetsTable)
      .where(and(
        eq(planetaryPlanetsTable.characterId, characterId),
        sql`${planetaryPlanetsTable.planetId} != ALL(ARRAY[${sql.join(currentPlanetIds.map(id => sql`${id}`), sql`, `)}]::integer[])`
      ))
      .returning();

    return result.length;
  }

  async getPlanetaryPins(characterId: number, planetId: number): Promise<PlanetaryPinData[]> {
    const results = await db.select()
      .from(planetaryPinsTable)
      .where(and(
        eq(planetaryPinsTable.characterId, characterId),
        eq(planetaryPinsTable.planetId, planetId)
      ));
    
    return results.map(r => ({
      id: r.id,
      characterId: r.characterId,
      planetId: r.planetId,
      pinId: r.pinId,
      typeId: r.typeId,
      typeName: r.typeName,
      schematicId: r.schematicId,
      schematicName: r.schematicName,
      extractorProductTypeId: r.extractorProductTypeId,
      extractorProductName: r.extractorProductName,
      cycleTime: r.cycleTime,
      headRadius: r.headRadius,
      numHeads: r.numHeads,
      quantityPerCycle: r.quantityPerCycle,
      installTime: r.installTime,
      expiryTime: r.expiryTime,
      contentsJson: r.contentsJson as Array<{typeId: number; typeName: string; quantity: number}> | null,
      capacity: r.capacity,
      usedCapacity: r.usedCapacity,
      latitude: r.latitude,
      longitude: r.longitude,
      cachedAt: r.cachedAt,
    }));
  }

  async getPlanetaryPinsForCharacter(characterId: number): Promise<PlanetaryPinData[]> {
    const results = await db.select()
      .from(planetaryPinsTable)
      .where(eq(planetaryPinsTable.characterId, characterId));
    
    return results.map(r => ({
      id: r.id,
      characterId: r.characterId,
      planetId: r.planetId,
      pinId: r.pinId,
      typeId: r.typeId,
      typeName: r.typeName,
      schematicId: r.schematicId,
      schematicName: r.schematicName,
      extractorProductTypeId: r.extractorProductTypeId,
      extractorProductName: r.extractorProductName,
      cycleTime: r.cycleTime,
      headRadius: r.headRadius,
      numHeads: r.numHeads,
      quantityPerCycle: r.quantityPerCycle,
      installTime: r.installTime,
      expiryTime: r.expiryTime,
      contentsJson: r.contentsJson as Array<{typeId: number; typeName: string; quantity: number}> | null,
      capacity: r.capacity,
      usedCapacity: r.usedCapacity,
      latitude: r.latitude,
      longitude: r.longitude,
      cachedAt: r.cachedAt,
    }));
  }

  async upsertPlanetaryPins(characterId: number, planetId: number, pins: Omit<PlanetaryPinData, 'id' | 'cachedAt'>[]): Promise<void> {
    // Delete existing pins for this planet first
    await this.deletePlanetaryPins(characterId, planetId);
    
    // Insert new pins
    if (pins.length === 0) return;
    
    await db.insert(planetaryPinsTable).values(
      pins.map(pin => ({
        characterId: pin.characterId,
        planetId: pin.planetId,
        pinId: pin.pinId,
        typeId: pin.typeId,
        typeName: pin.typeName,
        schematicId: pin.schematicId,
        schematicName: pin.schematicName,
        extractorProductTypeId: pin.extractorProductTypeId,
        extractorProductName: pin.extractorProductName,
        cycleTime: pin.cycleTime,
        headRadius: pin.headRadius,
        numHeads: pin.numHeads,
        quantityPerCycle: pin.quantityPerCycle,
        installTime: pin.installTime,
        expiryTime: pin.expiryTime,
        contentsJson: pin.contentsJson,
        capacity: pin.capacity,
        usedCapacity: pin.usedCapacity,
        latitude: pin.latitude,
        longitude: pin.longitude,
      }))
    );
  }

  async deletePlanetaryPins(characterId: number, planetId: number): Promise<void> {
    await db.delete(planetaryPinsTable)
      .where(and(
        eq(planetaryPinsTable.characterId, characterId),
        eq(planetaryPinsTable.planetId, planetId)
      ));
  }

  // Changelog methods
  async getPublishedChangelogs(): Promise<ChangelogVersionData[]> {
    const versions = await db.select()
      .from(changelogVersionsTable)
      .where(eq(changelogVersionsTable.isPublished, true))
      .orderBy(desc(changelogVersionsTable.publishedAt));
    
    const result: ChangelogVersionData[] = [];
    for (const v of versions) {
      const items = await this.getChangelogItems(v.id, false);
      result.push({
        id: v.id,
        version: v.version,
        title: v.title,
        releaseDate: v.releaseDate,
        isPublished: v.isPublished,
        createdAt: v.createdAt,
        publishedAt: v.publishedAt,
        createdByAdminId: v.createdByAdminId,
        createdByAdminName: v.createdByAdminName,
        items,
      });
    }
    return result;
  }

  async getLatestPublishedChangelog(): Promise<ChangelogVersionData | undefined> {
    const [version] = await db.select()
      .from(changelogVersionsTable)
      .where(eq(changelogVersionsTable.isPublished, true))
      .orderBy(desc(changelogVersionsTable.publishedAt))
      .limit(1);
    
    if (!version) return undefined;
    
    const items = await this.getChangelogItems(version.id, false);
    return {
      id: version.id,
      version: version.version,
      title: version.title,
      releaseDate: version.releaseDate,
      isPublished: version.isPublished,
      createdAt: version.createdAt,
      publishedAt: version.publishedAt,
      createdByAdminId: version.createdByAdminId,
      createdByAdminName: version.createdByAdminName,
      items,
    };
  }

  async getAllChangelogs(): Promise<ChangelogVersionData[]> {
    const versions = await db.select()
      .from(changelogVersionsTable)
      .orderBy(desc(changelogVersionsTable.createdAt));
    
    const result: ChangelogVersionData[] = [];
    for (const v of versions) {
      const items = await this.getChangelogItems(v.id, true);
      result.push({
        id: v.id,
        version: v.version,
        title: v.title,
        releaseDate: v.releaseDate,
        isPublished: v.isPublished,
        createdAt: v.createdAt,
        publishedAt: v.publishedAt,
        createdByAdminId: v.createdByAdminId,
        createdByAdminName: v.createdByAdminName,
        items,
      });
    }
    return result;
  }

  async getChangelogVersion(versionId: string): Promise<ChangelogVersionData | undefined> {
    const [version] = await db.select()
      .from(changelogVersionsTable)
      .where(eq(changelogVersionsTable.id, versionId));
    
    if (!version) return undefined;
    
    const items = await this.getChangelogItems(versionId, true);
    return {
      id: version.id,
      version: version.version,
      title: version.title,
      releaseDate: version.releaseDate,
      isPublished: version.isPublished,
      createdAt: version.createdAt,
      publishedAt: version.publishedAt,
      createdByAdminId: version.createdByAdminId,
      createdByAdminName: version.createdByAdminName,
      items,
    };
  }

  async createChangelogVersion(data: {
    version: string;
    title: string;
    releaseDate: string;
    isPublished?: boolean;
    createdByAdminId?: number;
    createdByAdminName?: string;
  }): Promise<ChangelogVersionData> {
    const [result] = await db.insert(changelogVersionsTable)
      .values({
        version: data.version,
        title: data.title,
        releaseDate: data.releaseDate,
        isPublished: data.isPublished ?? false,
        createdByAdminId: data.createdByAdminId ?? null,
        createdByAdminName: data.createdByAdminName ?? null,
        publishedAt: data.isPublished ? new Date() : null,
      })
      .returning();
    
    return {
      id: result.id,
      version: result.version,
      title: result.title,
      releaseDate: result.releaseDate,
      isPublished: result.isPublished,
      createdAt: result.createdAt,
      publishedAt: result.publishedAt,
      createdByAdminId: result.createdByAdminId,
      createdByAdminName: result.createdByAdminName,
      items: [],
    };
  }

  async updateChangelogVersion(versionId: string, updates: {
    version?: string;
    title?: string;
    releaseDate?: string;
    isPublished?: boolean;
  }): Promise<ChangelogVersionData | undefined> {
    const updateData: Record<string, unknown> = {};
    if (updates.version !== undefined) updateData.version = updates.version;
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.releaseDate !== undefined) updateData.releaseDate = updates.releaseDate;
    if (updates.isPublished !== undefined) {
      updateData.isPublished = updates.isPublished;
      if (updates.isPublished) {
        updateData.publishedAt = new Date();
      }
    }
    
    if (Object.keys(updateData).length === 0) {
      return this.getChangelogVersion(versionId);
    }
    
    const [result] = await db.update(changelogVersionsTable)
      .set(updateData)
      .where(eq(changelogVersionsTable.id, versionId))
      .returning();
    
    if (!result) return undefined;
    
    const items = await this.getChangelogItems(versionId, true);
    return {
      id: result.id,
      version: result.version,
      title: result.title,
      releaseDate: result.releaseDate,
      isPublished: result.isPublished,
      createdAt: result.createdAt,
      publishedAt: result.publishedAt,
      createdByAdminId: result.createdByAdminId,
      createdByAdminName: result.createdByAdminName,
      items,
    };
  }

  async deleteChangelogVersion(versionId: string): Promise<boolean> {
    // Delete all items first
    await db.delete(changelogItemsTable)
      .where(eq(changelogItemsTable.versionId, versionId));
    
    const result = await db.delete(changelogVersionsTable)
      .where(eq(changelogVersionsTable.id, versionId))
      .returning();
    
    return result.length > 0;
  }

  async publishChangelogVersion(versionId: string): Promise<ChangelogVersionData | undefined> {
    return this.updateChangelogVersion(versionId, { isPublished: true });
  }

  async getChangelogItems(versionId: string, includeAdminOnly: boolean = false): Promise<ChangelogItemData[]> {
    let query = db.select()
      .from(changelogItemsTable)
      .where(eq(changelogItemsTable.versionId, versionId))
      .orderBy(changelogItemsTable.sortOrder);
    
    const results = await query;
    
    return results
      .filter(r => includeAdminOnly || !r.isAdminOnly)
      .map(r => ({
        id: r.id,
        versionId: r.versionId,
        changeType: r.changeType,
        iconKey: r.iconKey,
        text: r.text,
        sortOrder: r.sortOrder,
        isProOnly: r.isProOnly,
        isAdminOnly: r.isAdminOnly,
        createdAt: r.createdAt,
      }));
  }

  async createChangelogItem(data: {
    versionId: string;
    changeType: string;
    iconKey?: string;
    text: string;
    sortOrder?: number;
    isProOnly?: boolean;
    isAdminOnly?: boolean;
  }): Promise<ChangelogItemData> {
    // Get max sort order if not provided
    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const [maxResult] = await db.select({ max: sql<number>`COALESCE(MAX(sort_order), -1)` })
        .from(changelogItemsTable)
        .where(eq(changelogItemsTable.versionId, data.versionId));
      sortOrder = (maxResult?.max ?? -1) + 1;
    }
    
    const [result] = await db.insert(changelogItemsTable)
      .values({
        versionId: data.versionId,
        changeType: data.changeType,
        iconKey: data.iconKey ?? null,
        text: data.text,
        sortOrder,
        isProOnly: data.isProOnly ?? false,
        isAdminOnly: data.isAdminOnly ?? false,
      })
      .returning();
    
    return {
      id: result.id,
      versionId: result.versionId,
      changeType: result.changeType,
      iconKey: result.iconKey,
      text: result.text,
      sortOrder: result.sortOrder,
      isProOnly: result.isProOnly,
      isAdminOnly: result.isAdminOnly,
      createdAt: result.createdAt,
    };
  }

  async updateChangelogItem(itemId: string, updates: {
    changeType?: string;
    iconKey?: string;
    text?: string;
    sortOrder?: number;
    isProOnly?: boolean;
    isAdminOnly?: boolean;
  }): Promise<ChangelogItemData | undefined> {
    const updateData: Record<string, unknown> = {};
    if (updates.changeType !== undefined) updateData.changeType = updates.changeType;
    if (updates.iconKey !== undefined) updateData.iconKey = updates.iconKey;
    if (updates.text !== undefined) updateData.text = updates.text;
    if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder;
    if (updates.isProOnly !== undefined) updateData.isProOnly = updates.isProOnly;
    if (updates.isAdminOnly !== undefined) updateData.isAdminOnly = updates.isAdminOnly;
    
    if (Object.keys(updateData).length === 0) {
      const [item] = await db.select()
        .from(changelogItemsTable)
        .where(eq(changelogItemsTable.id, itemId));
      if (!item) return undefined;
      return {
        id: item.id,
        versionId: item.versionId,
        changeType: item.changeType,
        iconKey: item.iconKey,
        text: item.text,
        sortOrder: item.sortOrder,
        isProOnly: item.isProOnly,
        isAdminOnly: item.isAdminOnly,
        createdAt: item.createdAt,
      };
    }
    
    const [result] = await db.update(changelogItemsTable)
      .set(updateData)
      .where(eq(changelogItemsTable.id, itemId))
      .returning();
    
    if (!result) return undefined;
    
    return {
      id: result.id,
      versionId: result.versionId,
      changeType: result.changeType,
      iconKey: result.iconKey,
      text: result.text,
      sortOrder: result.sortOrder,
      isProOnly: result.isProOnly,
      isAdminOnly: result.isAdminOnly,
      createdAt: result.createdAt,
    };
  }

  async deleteChangelogItem(itemId: string): Promise<boolean> {
    const result = await db.delete(changelogItemsTable)
      .where(eq(changelogItemsTable.id, itemId))
      .returning();
    return result.length > 0;
  }

  async reorderChangelogItems(versionId: string, itemIds: string[]): Promise<void> {
    for (let i = 0; i < itemIds.length; i++) {
      await db.update(changelogItemsTable)
        .set({ sortOrder: i })
        .where(and(
          eq(changelogItemsTable.id, itemIds[i]),
          eq(changelogItemsTable.versionId, versionId)
        ));
    }
  }

  // ESI Name Cache methods (per-character for privacy compliance)
  async getEsiNames(characterId: number, ids: number[]): Promise<Map<number, { name: string; category: string }>> {
    const result = new Map<number, { name: string; category: string }>();
    if (ids.length === 0) return result;
    
    const rows = await db.select()
      .from(esiNameCacheTable)
      .where(and(
        eq(esiNameCacheTable.characterId, characterId),
        inArray(esiNameCacheTable.id, ids)
      ));
    
    for (const row of rows) {
      result.set(row.id, { name: row.name, category: row.category });
    }
    return result;
  }

  async cacheEsiNames(characterId: number, entries: { id: number; name: string; category: string }[]): Promise<void> {
    if (entries.length === 0) return;

    // Use upsert to update if exists, insert if not
    for (const entry of entries) {
      await db.insert(esiNameCacheTable)
        .values({
          id: entry.id,
          characterId: characterId,
          name: entry.name,
          category: entry.category,
        })
        .onConflictDoUpdate({
          target: [esiNameCacheTable.id, esiNameCacheTable.characterId],
          set: {
            name: entry.name,
            category: entry.category,
            cachedAt: new Date(),
          },
        });
    }
  }

  // ============================================================================
  // BIG UPDATE v0.4.0 - Daily Income Summary Methods
  // ============================================================================

  async getDailyIncomeSummary(characterId: number, date: string): Promise<DailyIncomeSummary | undefined> {
    const [result] = await db.select()
      .from(dailyIncomeSummaryTable)
      .where(and(
        eq(dailyIncomeSummaryTable.characterId, characterId),
        eq(dailyIncomeSummaryTable.date, date)
      ))
      .limit(1);
    return result;
  }

  async getDailyIncomeSummaryRange(
    characterId: number,
    startDate: string,
    endDate: string
  ): Promise<DailyIncomeSummary[]> {
    return db.select()
      .from(dailyIncomeSummaryTable)
      .where(and(
        eq(dailyIncomeSummaryTable.characterId, characterId),
        gte(dailyIncomeSummaryTable.date, startDate),
        lte(dailyIncomeSummaryTable.date, endDate)
      ))
      .orderBy(dailyIncomeSummaryTable.date);
  }

  async getDailyIncomeSummaryRangeMultiChar(
    characterIds: number[],
    startDate: string,
    endDate: string
  ): Promise<DailyIncomeSummary[]> {
    if (characterIds.length === 0) return [];
    return db.select()
      .from(dailyIncomeSummaryTable)
      .where(and(
        inArray(dailyIncomeSummaryTable.characterId, characterIds),
        gte(dailyIncomeSummaryTable.date, startDate),
        lte(dailyIncomeSummaryTable.date, endDate)
      ))
      .orderBy(dailyIncomeSummaryTable.date);
  }

  async upsertDailyIncomeSummary(data: InsertDailyIncomeSummary): Promise<DailyIncomeSummary> {
    const [result] = await db.insert(dailyIncomeSummaryTable)
      .values(data)
      .onConflictDoUpdate({
        target: [dailyIncomeSummaryTable.characterId, dailyIncomeSummaryTable.date],
        set: {
          bountyIncome: data.bountyIncome,
          missionIncome: data.missionIncome,
          marketIncome: data.marketIncome,
          industryIncome: data.industryIncome,
          piIncome: data.piIncome,
          miningIncome: data.miningIncome,
          otherIncome: data.otherIncome,
          totalIncome: data.totalIncome,
          sessionCount: data.sessionCount,
          totalSessionTime: data.totalSessionTime,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  // ============================================================================
  // BIG UPDATE v0.4.0 - Skill Queue Methods
  // ============================================================================

  async getSkillQueue(characterId: number): Promise<SkillQueue[]> {
    return db.select()
      .from(skillQueueTable)
      .where(eq(skillQueueTable.characterId, characterId))
      .orderBy(skillQueueTable.queuePosition);
  }

  async getSkillQueueMultiChar(characterIds: number[]): Promise<SkillQueue[]> {
    if (characterIds.length === 0) return [];
    return db.select()
      .from(skillQueueTable)
      .where(inArray(skillQueueTable.characterId, characterIds))
      .orderBy(skillQueueTable.characterId, skillQueueTable.queuePosition);
  }

  async upsertSkillQueue(characterId: number, skills: InsertSkillQueue[]): Promise<void> {
    // Delete existing queue for this character
    await db.delete(skillQueueTable)
      .where(eq(skillQueueTable.characterId, characterId));

    // Insert new queue
    if (skills.length > 0) {
      await db.insert(skillQueueTable).values(skills);
    }
  }

  async getSkillQueueAlerts(characterId: number): Promise<SkillQueueAlerts | undefined> {
    const [result] = await db.select()
      .from(skillQueueAlertsTable)
      .where(eq(skillQueueAlertsTable.characterId, characterId))
      .limit(1);
    return result;
  }

  async upsertSkillQueueAlerts(data: InsertSkillQueueAlerts): Promise<SkillQueueAlerts> {
    const [result] = await db.insert(skillQueueAlertsTable)
      .values(data)
      .onConflictDoUpdate({
        target: skillQueueAlertsTable.characterId,
        set: {
          alertOnEmpty: data.alertOnEmpty,
          alertHoursBeforeEmpty: data.alertHoursBeforeEmpty,
        },
      })
      .returning();
    return result;
  }

  // ============================================================================
  // BIG UPDATE v0.4.0 - Market Orders Methods
  // ============================================================================

  async getMarketOrders(characterId: number): Promise<MarketOrder[]> {
    return db.select()
      .from(marketOrdersTable)
      .where(eq(marketOrdersTable.characterId, characterId))
      .orderBy(desc(marketOrdersTable.issued));
  }

  async getMarketOrdersMultiChar(characterIds: number[]): Promise<MarketOrder[]> {
    if (characterIds.length === 0) return [];
    return db.select()
      .from(marketOrdersTable)
      .where(inArray(marketOrdersTable.characterId, characterIds))
      .orderBy(desc(marketOrdersTable.issued));
  }

  async upsertMarketOrder(data: InsertMarketOrder): Promise<MarketOrder> {
    const [result] = await db.insert(marketOrdersTable)
      .values(data)
      .onConflictDoUpdate({
        target: [marketOrdersTable.characterId, marketOrdersTable.orderId],
        set: {
          typeName: data.typeName,
          locationName: data.locationName,
          volumeRemain: data.volumeRemain,
          price: data.price,
          state: data.state,
          estimatedProfit: data.estimatedProfit,
          profitMargin: data.profitMargin,
          cachedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async syncMarketOrders(characterId: number, orders: InsertMarketOrder[]): Promise<void> {
    // Get current order IDs from ESI
    const newOrderIds = orders.map(o => o.orderId);

    // Get existing orders
    const existing = await db.select({ orderId: marketOrdersTable.orderId })
      .from(marketOrdersTable)
      .where(eq(marketOrdersTable.characterId, characterId));

    const existingOrderIds = existing.map(e => e.orderId);

    // Find orders that no longer exist (completed/expired)
    const removedOrderIds = existingOrderIds.filter(id => !newOrderIds.includes(id));

    // Move removed orders to history
    if (removedOrderIds.length > 0) {
      const removedOrders = await db.select()
        .from(marketOrdersTable)
        .where(and(
          eq(marketOrdersTable.characterId, characterId),
          inArray(marketOrdersTable.orderId, removedOrderIds)
        ));

      for (const order of removedOrders) {
        await db.insert(marketOrderHistoryTable).values({
          characterId: order.characterId,
          orderId: order.orderId,
          typeId: order.typeId,
          typeName: order.typeName,
          locationId: order.locationId,
          locationName: order.locationName,
          volumeTotal: order.volumeTotal,
          volumeSold: order.volumeTotal - order.volumeRemain,
          price: order.price,
          isBuyOrder: order.isBuyOrder,
          issued: order.issued,
          completedAt: new Date(),
          state: order.volumeRemain === 0 ? 'fulfilled' : 'expired',
          totalRevenue: order.isBuyOrder ? null : (order.volumeTotal - order.volumeRemain) * order.price,
          estimatedProfit: order.estimatedProfit,
        });
      }

      // Delete from active orders
      await db.delete(marketOrdersTable)
        .where(and(
          eq(marketOrdersTable.characterId, characterId),
          inArray(marketOrdersTable.orderId, removedOrderIds)
        ));
    }

    // Upsert current orders
    for (const order of orders) {
      await this.upsertMarketOrder(order);
    }
  }

  async getMarketOrderHistory(characterId: number, limit = 100): Promise<MarketOrderHistory[]> {
    return db.select()
      .from(marketOrderHistoryTable)
      .where(eq(marketOrderHistoryTable.characterId, characterId))
      .orderBy(desc(marketOrderHistoryTable.completedAt))
      .limit(limit);
  }

  async getMarketOrderHistoryMultiChar(characterIds: number[], limit = 100): Promise<MarketOrderHistory[]> {
    if (characterIds.length === 0) return [];
    return db.select()
      .from(marketOrderHistoryTable)
      .where(inArray(marketOrderHistoryTable.characterId, characterIds))
      .orderBy(desc(marketOrderHistoryTable.completedAt))
      .limit(limit);
  }

  // ============================================================================
  // BIG UPDATE v0.4.0 - Saved PI Chains Methods
  // ============================================================================

  async getSavedPiChains(characterId: number): Promise<SavedPiChain[]> {
    return db.select()
      .from(savedPiChainsTable)
      .where(eq(savedPiChainsTable.characterId, characterId))
      .orderBy(desc(savedPiChainsTable.isFavorite), savedPiChainsTable.name);
  }

  async getSavedPiChain(chainId: string): Promise<SavedPiChain | undefined> {
    const [result] = await db.select()
      .from(savedPiChainsTable)
      .where(eq(savedPiChainsTable.id, chainId))
      .limit(1);
    return result;
  }

  async createSavedPiChain(data: InsertSavedPiChain): Promise<SavedPiChain> {
    const [result] = await db.insert(savedPiChainsTable)
      .values(data)
      .returning();
    return result;
  }

  async updateSavedPiChain(chainId: string, data: Partial<InsertSavedPiChain>): Promise<SavedPiChain | undefined> {
    const [result] = await db.update(savedPiChainsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(savedPiChainsTable.id, chainId))
      .returning();
    return result;
  }

  async deleteSavedPiChain(chainId: string): Promise<boolean> {
    const result = await db.delete(savedPiChainsTable)
      .where(eq(savedPiChainsTable.id, chainId))
      .returning();
    return result.length > 0;
  }

  async togglePiChainFavorite(chainId: string): Promise<SavedPiChain | undefined> {
    const chain = await this.getSavedPiChain(chainId);
    if (!chain) return undefined;

    const [result] = await db.update(savedPiChainsTable)
      .set({ isFavorite: !chain.isFavorite, updatedAt: new Date() })
      .where(eq(savedPiChainsTable.id, chainId))
      .returning();
    return result;
  }

  // ============================================================================
  // SKILL PLANNER v0.5.0 - Trained Skills Methods
  // ============================================================================

  async getTrainedSkills(characterId: number): Promise<TrainedSkill[]> {
    return db.select()
      .from(trainedSkillsTable)
      .where(eq(trainedSkillsTable.characterId, characterId))
      .orderBy(trainedSkillsTable.skillName);
  }

  async getTrainedSkillsMultiChar(characterIds: number[]): Promise<TrainedSkill[]> {
    if (characterIds.length === 0) return [];
    return db.select()
      .from(trainedSkillsTable)
      .where(inArray(trainedSkillsTable.characterId, characterIds))
      .orderBy(trainedSkillsTable.characterName, trainedSkillsTable.skillName);
  }

  async upsertTrainedSkills(characterId: number, skills: InsertTrainedSkill[]): Promise<void> {
    if (skills.length === 0) return;

    // Delete existing skills for this character and insert new ones
    await db.delete(trainedSkillsTable)
      .where(eq(trainedSkillsTable.characterId, characterId));

    // Insert in batches to avoid query size limits
    const batchSize = 100;
    for (let i = 0; i < skills.length; i += batchSize) {
      const batch = skills.slice(i, i + batchSize);
      await db.insert(trainedSkillsTable).values(batch);
    }
  }

  async getTrainedSkill(characterId: number, skillId: number): Promise<TrainedSkill | undefined> {
    const [result] = await db.select()
      .from(trainedSkillsTable)
      .where(and(
        eq(trainedSkillsTable.characterId, characterId),
        eq(trainedSkillsTable.skillId, skillId)
      ))
      .limit(1);
    return result;
  }

  // ============================================================================
  // SKILL PLANNER v0.5.0 - Character Attributes Methods
  // ============================================================================

  async getCharacterAttributes(characterId: number): Promise<CharacterAttributes | undefined> {
    const [result] = await db.select()
      .from(characterAttributesTable)
      .where(eq(characterAttributesTable.characterId, characterId))
      .limit(1);
    return result;
  }

  async upsertCharacterAttributes(data: InsertCharacterAttributes): Promise<CharacterAttributes> {
    const [result] = await db.insert(characterAttributesTable)
      .values(data)
      .onConflictDoUpdate({
        target: characterAttributesTable.characterId,
        set: {
          ...data,
          cachedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  // ============================================================================
  // SKILL PLANNER v0.5.0 - Skill Plans Methods
  // ============================================================================

  async getSkillPlans(characterId: number): Promise<SkillPlan[]> {
    return db.select()
      .from(skillPlansTable)
      .where(eq(skillPlansTable.characterId, characterId))
      .orderBy(desc(skillPlansTable.isActive), skillPlansTable.priority, skillPlansTable.name);
  }

  async getSkillPlan(planId: string): Promise<SkillPlan | undefined> {
    const [result] = await db.select()
      .from(skillPlansTable)
      .where(eq(skillPlansTable.id, planId))
      .limit(1);
    return result;
  }

  async createSkillPlan(data: InsertSkillPlan): Promise<SkillPlan> {
    const [result] = await db.insert(skillPlansTable)
      .values(data)
      .returning();
    return result;
  }

  async updateSkillPlan(planId: string, data: Partial<InsertSkillPlan>): Promise<SkillPlan | undefined> {
    const [result] = await db.update(skillPlansTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(skillPlansTable.id, planId))
      .returning();
    return result;
  }

  async deleteSkillPlan(planId: string): Promise<boolean> {
    const result = await db.delete(skillPlansTable)
      .where(eq(skillPlansTable.id, planId))
      .returning();
    return result.length > 0;
  }

  async setActiveSkillPlan(characterId: number, planId: string): Promise<void> {
    // Deactivate all plans for this character
    await db.update(skillPlansTable)
      .set({ isActive: false })
      .where(eq(skillPlansTable.characterId, characterId));

    // Activate the specified plan
    await db.update(skillPlansTable)
      .set({ isActive: true })
      .where(eq(skillPlansTable.id, planId));
  }

  // ============================================================================
  // SKILL PLANNER v0.5.0 - Skill Plan Items Methods
  // ============================================================================

  async getSkillPlanItems(planId: string): Promise<SkillPlanItem[]> {
    return db.select()
      .from(skillPlanItemsTable)
      .where(eq(skillPlanItemsTable.planId, planId))
      .orderBy(skillPlanItemsTable.priority, skillPlanItemsTable.skillName);
  }

  async addSkillPlanItem(data: InsertSkillPlanItem): Promise<SkillPlanItem> {
    const [result] = await db.insert(skillPlanItemsTable)
      .values(data)
      .returning();
    return result;
  }

  async addSkillPlanItems(items: InsertSkillPlanItem[]): Promise<SkillPlanItem[]> {
    if (items.length === 0) return [];
    return db.insert(skillPlanItemsTable)
      .values(items)
      .returning();
  }

  async updateSkillPlanItem(itemId: string, data: Partial<InsertSkillPlanItem>): Promise<SkillPlanItem | undefined> {
    const [result] = await db.update(skillPlanItemsTable)
      .set(data)
      .where(eq(skillPlanItemsTable.id, itemId))
      .returning();
    return result;
  }

  async deleteSkillPlanItem(itemId: string): Promise<boolean> {
    const result = await db.delete(skillPlanItemsTable)
      .where(eq(skillPlanItemsTable.id, itemId))
      .returning();
    return result.length > 0;
  }

  async deleteAllSkillPlanItems(planId: string): Promise<void> {
    await db.delete(skillPlanItemsTable)
      .where(eq(skillPlanItemsTable.planId, planId));
  }

  // ============================================================================
  // SKILL PLANNER v0.5.0 - Ship Skill Requirements Methods
  // ============================================================================

  async getShipSkillRequirements(shipTypeId: number): Promise<ShipSkillRequirement[]> {
    return db.select()
      .from(shipSkillRequirementsTable)
      .where(eq(shipSkillRequirementsTable.shipTypeId, shipTypeId))
      .orderBy(shipSkillRequirementsTable.skillName);
  }

  async searchShipsByName(searchTerm: string, limit = 20): Promise<{ shipTypeId: number; shipName: string; shipGroup: string }[]> {
    const results = await db.selectDistinct({
      shipTypeId: shipSkillRequirementsTable.shipTypeId,
      shipName: shipSkillRequirementsTable.shipName,
      shipGroup: shipSkillRequirementsTable.shipGroup,
    })
      .from(shipSkillRequirementsTable)
      .where(ilike(shipSkillRequirementsTable.shipName, `%${searchTerm}%`))
      .limit(limit);
    return results;
  }

  async upsertShipSkillRequirements(requirements: InsertShipSkillRequirement[]): Promise<void> {
    if (requirements.length === 0) return;

    const batchSize = 100;
    for (let i = 0; i < requirements.length; i += batchSize) {
      const batch = requirements.slice(i, i + batchSize);
      await db.insert(shipSkillRequirementsTable)
        .values(batch)
        .onConflictDoUpdate({
          target: [shipSkillRequirementsTable.shipTypeId, shipSkillRequirementsTable.skillId],
          set: {
            requiredLevel: sql`excluded.required_level`,
            isPrerequisite: sql`excluded.is_prerequisite`,
            cachedAt: new Date(),
          },
        });
    }
  }

  async deleteShipSkillRequirements(shipTypeId: number): Promise<void> {
    await db.delete(shipSkillRequirementsTable)
      .where(eq(shipSkillRequirementsTable.shipTypeId, shipTypeId));
  }

  async clearAllShipSkillRequirements(): Promise<void> {
    await db.delete(shipSkillRequirementsTable);
  }

  // ============================================================================
  // SKILL PLANNER v0.5.0 - Skill Metadata Methods
  // ============================================================================

  async getSkillMetadata(skillId: number): Promise<SkillMetadata | undefined> {
    const [result] = await db.select()
      .from(skillMetadataTable)
      .where(eq(skillMetadataTable.skillId, skillId))
      .limit(1);
    return result;
  }

  async getAllSkillMetadata(): Promise<SkillMetadata[]> {
    return db.select()
      .from(skillMetadataTable)
      .orderBy(skillMetadataTable.groupName, skillMetadataTable.skillName);
  }

  async searchSkillsByName(searchTerm: string, limit = 20): Promise<SkillMetadata[]> {
    return db.select()
      .from(skillMetadataTable)
      .where(ilike(skillMetadataTable.skillName, `%${searchTerm}%`))
      .orderBy(skillMetadataTable.skillName)
      .limit(limit);
  }

  async upsertSkillMetadata(data: InsertSkillMetadata): Promise<SkillMetadata> {
    const [result] = await db.insert(skillMetadataTable)
      .values(data)
      .onConflictDoUpdate({
        target: skillMetadataTable.skillId,
        set: {
          ...data,
          cachedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async upsertSkillMetadataBatch(metadata: InsertSkillMetadata[]): Promise<void> {
    if (metadata.length === 0) return;

    const batchSize = 100;
    for (let i = 0; i < metadata.length; i += batchSize) {
      const batch = metadata.slice(i, i + batchSize);
      await db.insert(skillMetadataTable)
        .values(batch)
        .onConflictDoUpdate({
          target: skillMetadataTable.skillId,
          set: {
            skillName: sql`excluded.skill_name`,
            groupId: sql`excluded.group_id`,
            groupName: sql`excluded.group_name`,
            description: sql`excluded.description`,
            primaryAttribute: sql`excluded.primary_attribute`,
            secondaryAttribute: sql`excluded.secondary_attribute`,
            trainingTimeMultiplier: sql`excluded.training_time_multiplier`,
            prerequisiteSkillsJson: sql`excluded.prerequisite_skills_json`,
            cachedAt: new Date(),
          },
        });
    }
  }

  // ============================================================================
  // SKILL PLANNER v0.5.0 - EVE Ships Static Database Methods
  // ============================================================================

  async getEveShipCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(eveShipsTable);
    return Number(result[0]?.count || 0);
  }

  async searchEveShips(searchTerm: string, limit = 20): Promise<EveShip[]> {
    return db.select()
      .from(eveShipsTable)
      .where(ilike(eveShipsTable.typeName, `%${searchTerm}%`))
      .orderBy(eveShipsTable.typeName)
      .limit(limit);
  }

  async getEveShip(typeId: number): Promise<EveShip | undefined> {
    const [result] = await db.select()
      .from(eveShipsTable)
      .where(eq(eveShipsTable.typeId, typeId))
      .limit(1);
    return result;
  }

  async upsertEveShips(ships: InsertEveShip[]): Promise<void> {
    if (ships.length === 0) return;

    const batchSize = 100;
    for (let i = 0; i < ships.length; i += batchSize) {
      const batch = ships.slice(i, i + batchSize);
      await db.insert(eveShipsTable)
        .values(batch)
        .onConflictDoUpdate({
          target: eveShipsTable.typeId,
          set: {
            typeName: sql`excluded.type_name`,
            groupId: sql`excluded.group_id`,
            groupName: sql`excluded.group_name`,
            categoryId: sql`excluded.category_id`,
            description: sql`excluded.description`,
            cachedAt: new Date(),
          },
        });
    }
  }

  async clearEveShips(): Promise<void> {
    await db.delete(eveShipsTable);
  }

  // ============================================================================
  // ADM REPORTS - Alliance sovereignty ADM tracking
  // ============================================================================

  async createAdmReport(data: InsertAdmReport): Promise<AdmReport> {
    const [result] = await db.insert(admReportsTable)
      .values(data)
      .returning();
    return result;
  }

  async getAdmReport(id: string): Promise<AdmReport | undefined> {
    const [result] = await db.select()
      .from(admReportsTable)
      .where(eq(admReportsTable.id, id))
      .limit(1);
    return result;
  }

  async getAllAdmReports(): Promise<AdmReport[]> {
    return db.select()
      .from(admReportsTable)
      .orderBy(desc(admReportsTable.reportDate));
  }

  async updateAdmReport(id: string, data: Partial<InsertAdmReport>): Promise<AdmReport | undefined> {
    const [result] = await db.update(admReportsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(admReportsTable.id, id))
      .returning();
    return result;
  }

  async deleteAdmReport(id: string): Promise<void> {
    await db.delete(admReportsTable)
      .where(eq(admReportsTable.id, id));
  }

  // ADM Systems methods
  async createAdmSystem(data: InsertAdmSystem): Promise<AdmSystem> {
    const [result] = await db.insert(admSystemsTable)
      .values(data)
      .returning();
    return result;
  }

  async createAdmSystemsBatch(systems: InsertAdmSystem[]): Promise<AdmSystem[]> {
    if (systems.length === 0) return [];
    return db.insert(admSystemsTable)
      .values(systems)
      .returning();
  }

  async getAdmSystemsForReport(reportId: string): Promise<AdmSystem[]> {
    return db.select()
      .from(admSystemsTable)
      .where(eq(admSystemsTable.reportId, reportId))
      .orderBy(admSystemsTable.sortOrder, admSystemsTable.adm);
  }

  async getAdmSystem(id: string): Promise<AdmSystem | undefined> {
    const [result] = await db.select()
      .from(admSystemsTable)
      .where(eq(admSystemsTable.id, id))
      .limit(1);
    return result;
  }

  async updateAdmSystem(id: string, data: Partial<InsertAdmSystem>): Promise<AdmSystem | undefined> {
    const [result] = await db.update(admSystemsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(admSystemsTable.id, id))
      .returning();
    return result;
  }

  async deleteAdmSystem(id: string): Promise<void> {
    await db.delete(admSystemsTable)
      .where(eq(admSystemsTable.id, id));
  }

  async deleteAdmSystemsForReport(reportId: string): Promise<void> {
    await db.delete(admSystemsTable)
      .where(eq(admSystemsTable.reportId, reportId));
  }

  async getAdmReportWithSystems(id: string): Promise<{ report: AdmReport; systems: AdmSystem[] } | undefined> {
    const report = await this.getAdmReport(id);
    if (!report) return undefined;
    const systems = await this.getAdmSystemsForReport(id);
    return { report, systems };
  }

  // ============================================================================
  // SAVED ADM SYSTEMS - Reusable system presets
  // ============================================================================

  async createSavedAdmSystem(data: InsertSavedAdmSystem): Promise<SavedAdmSystem> {
    // Upsert: insert or update if system name already exists for this character
    const [result] = await db.insert(savedAdmSystemsTable)
      .values(data)
      .onConflictDoUpdate({
        target: [savedAdmSystemsTable.characterId, savedAdmSystemsTable.systemName],
        set: {
          systemId: data.systemId,
          strategicIndex: data.strategicIndex,
          strategicPercent: data.strategicPercent,
          vulnerableHours: data.vulnerableHours,
          defaultAdm: data.defaultAdm,
          defaultAdmStatus: data.defaultAdmStatus,
          militaryLevel: data.militaryLevel,
          militaryPercent: data.militaryPercent,
          industrialLevel: data.industrialLevel,
          industrialPercent: data.industrialPercent,
          majorThreat: data.majorThreat,
          minorThreat: data.minorThreat,
          oreProspecting: data.oreProspecting,
          sovHolder: data.sovHolder,
          isCapital: data.isCapital,
          notes: data.notes,
          sortOrder: data.sortOrder,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async getSavedAdmSystems(characterId: number): Promise<SavedAdmSystem[]> {
    return db.select()
      .from(savedAdmSystemsTable)
      .where(eq(savedAdmSystemsTable.characterId, characterId))
      .orderBy(savedAdmSystemsTable.sortOrder, savedAdmSystemsTable.systemName);
  }

  async getSavedAdmSystem(id: string): Promise<SavedAdmSystem | undefined> {
    const [result] = await db.select()
      .from(savedAdmSystemsTable)
      .where(eq(savedAdmSystemsTable.id, id));
    return result;
  }

  async updateSavedAdmSystem(id: string, data: Partial<InsertSavedAdmSystem>): Promise<SavedAdmSystem> {
    const [result] = await db.update(savedAdmSystemsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(savedAdmSystemsTable.id, id))
      .returning();
    return result;
  }

  async deleteSavedAdmSystem(id: string): Promise<void> {
    await db.delete(savedAdmSystemsTable)
      .where(eq(savedAdmSystemsTable.id, id));
  }

  // ============================================================================
  // JUMP PLANNER - Saved Routes
  // ============================================================================

  async getSavedJumpRoutes(characterId: number): Promise<SavedJumpRoute[]> {
    return db.select()
      .from(savedJumpRoutesTable)
      .where(eq(savedJumpRoutesTable.characterId, characterId))
      .orderBy(desc(savedJumpRoutesTable.updatedAt));
  }

  async getSavedJumpRoute(id: string): Promise<SavedJumpRoute | undefined> {
    const [result] = await db.select()
      .from(savedJumpRoutesTable)
      .where(eq(savedJumpRoutesTable.id, id))
      .limit(1);
    return result;
  }

  async createSavedJumpRoute(data: InsertSavedJumpRoute): Promise<SavedJumpRoute> {
    const [result] = await db.insert(savedJumpRoutesTable)
      .values(data)
      .returning();
    return result;
  }

  async updateSavedJumpRoute(id: string, data: Partial<InsertSavedJumpRoute>): Promise<SavedJumpRoute | undefined> {
    const [result] = await db.update(savedJumpRoutesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(savedJumpRoutesTable.id, id))
      .returning();
    return result;
  }

  async deleteSavedJumpRoute(id: string): Promise<void> {
    await db.delete(savedJumpRoutesTable)
      .where(eq(savedJumpRoutesTable.id, id));
  }

  async toggleJumpRouteFavorite(id: string): Promise<SavedJumpRoute | undefined> {
    const route = await this.getSavedJumpRoute(id);
    if (!route) return undefined;
    const [result] = await db.update(savedJumpRoutesTable)
      .set({ isFavorite: !route.isFavorite, updatedAt: new Date() })
      .where(eq(savedJumpRoutesTable.id, id))
      .returning();
    return result;
  }

  // ============================================================================
  // JUMP PLANNER - Beacon Networks
  // ============================================================================

  async getJumpBeacons(characterId: number, networkName?: string): Promise<JumpBeacon[]> {
    if (networkName) {
      return db.select()
        .from(jumpBeaconsTable)
        .where(and(
          eq(jumpBeaconsTable.characterId, characterId),
          eq(jumpBeaconsTable.networkName, networkName),
        ))
        .orderBy(jumpBeaconsTable.systemName);
    }
    return db.select()
      .from(jumpBeaconsTable)
      .where(eq(jumpBeaconsTable.characterId, characterId))
      .orderBy(jumpBeaconsTable.networkName, jumpBeaconsTable.systemName);
  }

  async getJumpBeaconNetworks(characterId: number): Promise<string[]> {
    const results = await db.selectDistinct({ networkName: jumpBeaconsTable.networkName })
      .from(jumpBeaconsTable)
      .where(eq(jumpBeaconsTable.characterId, characterId))
      .orderBy(jumpBeaconsTable.networkName);
    return results.map((r) => r.networkName);
  }

  async createJumpBeacon(data: InsertJumpBeacon): Promise<JumpBeacon> {
    const [result] = await db.insert(jumpBeaconsTable)
      .values(data)
      .onConflictDoUpdate({
        target: [jumpBeaconsTable.characterId, jumpBeaconsTable.systemId, jumpBeaconsTable.networkName],
        set: {
          beaconType: data.beaconType,
          notes: data.notes,
          systemName: data.systemName,
        },
      })
      .returning();
    return result;
  }

  async deleteJumpBeacon(id: string): Promise<void> {
    await db.delete(jumpBeaconsTable)
      .where(eq(jumpBeaconsTable.id, id));
  }

  // ============================================================================
  // MARKET INTELLIGENCE
  // ============================================================================

  async getMonitoredStations(characterId: number): Promise<MonitoredStation[]> {
    return db.select()
      .from(monitoredStationsTable)
      .where(eq(monitoredStationsTable.characterId, characterId))
      .orderBy(desc(monitoredStationsTable.createdAt));
  }

  async getMonitoredStation(id: string, characterId: number): Promise<MonitoredStation | undefined> {
    const [result] = await db.select()
      .from(monitoredStationsTable)
      .where(and(
        eq(monitoredStationsTable.id, id),
        eq(monitoredStationsTable.characterId, characterId),
      ));
    return result;
  }

  async addMonitoredStation(data: InsertMonitoredStation): Promise<MonitoredStation> {
    const [result] = await db.insert(monitoredStationsTable)
      .values(data)
      .onConflictDoUpdate({
        target: [monitoredStationsTable.characterId, monitoredStationsTable.stationId],
        set: {
          stationName: data.stationName,
          stationType: data.stationType,
          regionId: data.regionId,
          solarSystemId: data.solarSystemId,
          authCharacterId: data.authCharacterId,
          isActive: true,
        },
      })
      .returning();
    return result;
  }

  async removeMonitoredStation(id: string, characterId: number): Promise<void> {
    await db.delete(monitoredStationsTable)
      .where(and(
        eq(monitoredStationsTable.id, id),
        eq(monitoredStationsTable.characterId, characterId),
      ));
  }

  async updateMonitoredStationFetchTime(id: string): Promise<void> {
    await db.update(monitoredStationsTable)
      .set({ lastFetchedAt: new Date() })
      .where(eq(monitoredStationsTable.id, id));
  }

  async getWatchlists(characterId: number, stationId?: string): Promise<Watchlist[]> {
    const conditions = [eq(watchlistsTable.characterId, characterId)];
    if (stationId) {
      conditions.push(eq(watchlistsTable.monitoredStationId, stationId));
    }
    return db.select()
      .from(watchlistsTable)
      .where(and(...conditions))
      .orderBy(desc(watchlistsTable.createdAt));
  }

  async getWatchlist(id: string, characterId: number): Promise<Watchlist | undefined> {
    const [result] = await db.select()
      .from(watchlistsTable)
      .where(and(
        eq(watchlistsTable.id, id),
        eq(watchlistsTable.characterId, characterId),
      ));
    return result;
  }

  async createWatchlist(data: InsertWatchlist): Promise<Watchlist> {
    const [result] = await db.insert(watchlistsTable)
      .values(data)
      .returning();
    return result;
  }

  async deleteWatchlist(id: string, characterId: number): Promise<void> {
    await db.delete(watchlistsTable)
      .where(and(
        eq(watchlistsTable.id, id),
        eq(watchlistsTable.characterId, characterId),
      ));
  }

  async getWatchlistItems(watchlistId: string): Promise<WatchlistItem[]> {
    return db.select()
      .from(watchlistItemsTable)
      .where(eq(watchlistItemsTable.watchlistId, watchlistId))
      .orderBy(watchlistItemsTable.typeName);
  }

  async addWatchlistItem(data: InsertWatchlistItem): Promise<WatchlistItem> {
    const [result] = await db.insert(watchlistItemsTable)
      .values(data)
      .onConflictDoUpdate({
        target: [watchlistItemsTable.watchlistId, watchlistItemsTable.typeId],
        set: {
          typeName: data.typeName,
          minStockThreshold: data.minStockThreshold,
          category: data.category,
        },
      })
      .returning();
    return result;
  }

  async removeWatchlistItem(id: string): Promise<void> {
    await db.delete(watchlistItemsTable)
      .where(eq(watchlistItemsTable.id, id));
  }

  async upsertMarketSnapshot(data: InsertMarketSnapshot): Promise<MarketSnapshot> {
    const [result] = await db.insert(marketSnapshotsTable)
      .values(data)
      .onConflictDoUpdate({
        target: [marketSnapshotsTable.monitoredStationId, marketSnapshotsTable.typeId],
        set: {
          sellPriceMin: data.sellPriceMin,
          sellVolumeTotal: data.sellVolumeTotal,
          buyPriceMax: data.buyPriceMax,
          orderCount: data.orderCount,
          fetchedAt: data.fetchedAt,
        },
      })
      .returning();
    return result;
  }

  async getMarketSnapshotsByTypes(monitoredStationId: string, typeIds: number[]): Promise<MarketSnapshot[]> {
    if (typeIds.length === 0) return [];
    return db.select()
      .from(marketSnapshotsTable)
      .where(and(
        eq(marketSnapshotsTable.monitoredStationId, monitoredStationId),
        inArray(marketSnapshotsTable.typeId, typeIds),
      ));
  }

  async upsertJitaReferencePrice(data: InsertJitaReferencePrice): Promise<JitaReferencePrice> {
    const [result] = await db.insert(jitaReferencePricesTable)
      .values(data)
      .onConflictDoUpdate({
        target: jitaReferencePricesTable.typeId,
        set: {
          sellMin: data.sellMin,
          buyMax: data.buyMax,
          volumeDaily: data.volumeDaily,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async getJitaReferencePrices(typeIds: number[]): Promise<JitaReferencePrice[]> {
    if (typeIds.length === 0) return [];
    return db.select()
      .from(jitaReferencePricesTable)
      .where(inArray(jitaReferencePricesTable.typeId, typeIds));
  }
}

// Use DatabaseStorage for persistent data
export const storage = new DatabaseStorage();
export { generateActivationCode, generateGiftReferenceCode, generatePaymentReferenceCode, generatePhotonCode };
