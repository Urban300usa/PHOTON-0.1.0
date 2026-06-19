import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage, generateActivationCode, generateGiftReferenceCode, generatePhotonCode, type SpecialBadgeData, type PhotonCodeData } from "./storage";
import session from "express-session";
import MemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import fs from "fs";

// Write to a log file synchronously so auth logs aren't lost to stdout buffering
function authLog(...args: any[]) {
  const msg = `[${new Date().toISOString()}] [Auth] ${args.map(String).join(" ")}\n`;
  process.stdout.write(msg);
  if (process.env.AUTH_LOG_FILE) {
    try { fs.appendFileSync(process.env.AUTH_LOG_FILE, msg); } catch {}
  }
}
import { PRO_PRICING, SPECIAL_BADGE_TYPES, FACTION_THEMES, BONUS_TILES, type ProSubscription, type ProActivationCode, type ProGift, type SpecialBadgeType, type FactionTheme, type BonusTile } from "@shared/schema";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getCachedCorpAllianceInfo } from "./esiCache";

// Validation schemas for admin routes
const giftProSchema = z.object({
  recipientCharacterId: z.union([
    z.number().int().positive("Character ID must be a positive integer"),
    z.string().regex(/^\d+$/, "Character ID must be numeric").transform(val => parseInt(val, 10))
  ]).pipe(z.number().int().positive()),
  recipientCharacterName: z.string().min(1, "Character name is required").max(100).transform(val => val.trim()),
  durationDays: z.union([
    z.number().int().positive("Duration must be a positive integer").max(365),
    z.string().regex(/^\d+$/, "Duration must be numeric").transform(val => parseInt(val, 10))
  ]).pipe(z.number().int().positive().max(365)),
  note: z.string().max(500).transform(val => val.trim() || null).nullable().optional(),
});

const verifyPaymentSchema = z.object({
  activationCode: z.string().toUpperCase().regex(/^PHOTON-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/, "Invalid activation code format"),
});

const sessionCardSchema = z.object({
  cardData: z.object({
    characterName: z.string().max(100),
    characterId: z.number().int().positive().optional(),
    session: z.object({
      totalIsk: z.number().min(0),
      duration: z.number().min(0),
      iskPerHour: z.number().min(0),
      date: z.string().or(z.date()).optional(),
      kills: z.number().int().min(0).optional(),
    }),
    badges: z.array(z.object({
      type: z.string(),
      grantedAt: z.string().optional(),
    })).default([]),
    memberSince: z.string().optional(),
    isPro: z.boolean().default(false),
  }),
});

const createLeaderboardSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).transform(val => val.trim()),
  isPublic: z.boolean().default(false),
  rankBy: z.enum(["total_isk", "isk_per_hour", "sessions"]).default("total_isk"),
  timeFrame: z.enum(["daily", "weekly", "monthly", "all_time"]).default("all_time"),
});

const MemoryStoreSession = MemoryStore(session);
const PgSession = connectPgSimple(session);

// Admin configuration - comma-separated list of character IDs (super admins from env)
const SUPER_ADMIN_IDS: Set<number> = new Set(
  (process.env.EVE_ADMIN_IDS || "")
    .split(",")
    .map(id => parseInt(id.trim(), 10))
    .filter(id => !isNaN(id))
);

// Helper to check if a character is a super admin (can manage other admins)
function isSuperAdmin(characterId: number): boolean {
  return SUPER_ADMIN_IDS.has(characterId);
}

// Helper to get EVE OAuth credentials based on environment
function getEveCredentials(): { clientId: string | undefined; clientSecret: string | undefined } {
  const isDev = process.env.NODE_ENV === "development";
  if (isDev && process.env.EVE_DEV_CLIENT_ID && process.env.EVE_DEV_CLIENT_SECRET) {
    return {
      clientId: process.env.EVE_DEV_CLIENT_ID,
      clientSecret: process.env.EVE_DEV_CLIENT_SECRET,
    };
  }
  return {
    clientId: process.env.EVE_CLIENT_ID,
    clientSecret: process.env.EVE_CLIENT_SECRET,
  };
}

// Helper to check if a character is admin (async due to database check)
async function isAdminAsync(characterId: number): Promise<boolean> {
  if (SUPER_ADMIN_IDS.has(characterId)) return true;
  return storage.isDynamicAdmin(characterId);
}

// Get all admin IDs (async due to database check)
async function getAllAdminIdsAsync(): Promise<number[]> {
  const dynamicAdmins = await storage.getDynamicAdmins();
  return [...Array.from(SUPER_ADMIN_IDS), ...dynamicAdmins.map(a => a.characterId)];
}

// Admin middleware (async version)
async function requireAdminAsync(req: Request, res: Response, next: NextFunction) {
  if (!req.session.character) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const isAdminUser = await isAdminAsync(req.session.character.characterId);
  if (!isAdminUser) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

// Wrapper to use async middleware
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAdminAsync(req, res, next).catch(next);
}

const ESI_AUTH_URL = "https://login.eveonline.com/v2/oauth/authorize";
const ESI_TOKEN_URL = "https://login.eveonline.com/v2/oauth/token";
const ESI_VERIFY_URL = "https://login.eveonline.com/oauth/verify";
const ESI_BASE_URL = "https://esi.evetech.net/latest";

interface EveCharacter {
  characterId: number;
  characterName: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

declare module "express-session" {
  interface SessionData {
    character?: EveCharacter;
    state?: string;
    linkingCharacter?: boolean; // Flag for link character flow
    reauthorizingCharacterId?: number; // Character being reauthorized
    activeCharacterId?: number; // Currently active character for multiboxing
  }
}

// Authenticated request with guaranteed character
interface AuthenticatedRequest extends Request {
  user: EveCharacter;
}

// Authentication middleware
function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.session.character) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  // Attach user to request for type safety
  (req as AuthenticatedRequest).user = req.session.character;
  next();
}

// Suspension check middleware - use after isAuthenticated
async function checkSuspension(req: Request, res: Response, next: NextFunction) {
  if (!req.session.character) {
    return next();
  }
  
  try {
    const suspension = await storage.getActiveSuspension(req.session.character.characterId);
    if (suspension) {
      const expiresText = suspension.expiresAt 
        ? `until ${new Date(suspension.expiresAt).toLocaleDateString()}`
        : 'permanently';
      
      res.status(403).json({ 
        error: "Account suspended",
        message: `Your account has been suspended ${expiresText}. Reason: ${suspension.reason}`,
        suspension: {
          reason: suspension.reason,
          expiresAt: suspension.expiresAt,
          suspendedAt: suspension.createdAt,
        }
      });
      return;
    }
    next();
  } catch (error) {
    // If check fails, allow access (fail open)
    console.error("Suspension check error:", error);
    next();
  }
}

// Helper function to refresh access token if expired
// Returns the access token if valid/refreshed, or null if refresh failed (session will be destroyed)
async function refreshTokenIfNeeded(req: Request): Promise<string | null> {
  const character = req.session.character;
  if (!character) return null;

  // Check if using dev-mode token (can't be used for ESI calls)
  if (character.accessToken === "dev-mode-token") {
    console.warn("Dev-mode token cannot be used for ESI API calls. Please log in with real EVE SSO.");
    return null;
  }

  // Check if token is still valid (with 5 minute buffer)
  if (Date.now() < character.expiresAt - 300000) {
    return character.accessToken;
  }

  const { clientId, clientSecret } = getEveCredentials();

  if (!clientId || !clientSecret) {
    // Clear invalid session to prevent retry loops
    req.session.destroy(() => {});
    return null;
  }

  try {
    const response = await fetch(ESI_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: character.refreshToken,
      }),
    });

    if (!response.ok) {
      console.error("Token refresh failed:", await response.text());
      // Clear invalid session to prevent retry loops - force re-login
      req.session.destroy(() => {});
      return null;
    }

    const tokens = await response.json();
    
    // Update session with new tokens
    req.session.character = {
      ...character,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || character.refreshToken,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    };

    return tokens.access_token;
  } catch (error) {
    console.error("Token refresh error:", error);
    // Clear invalid session to prevent retry loops
    req.session.destroy(() => {});
    return null;
  }
}

// Helper function to refresh access token for a linked character
// Returns the access token if valid/refreshed, or null if refresh failed
async function refreshLinkedCharacterToken(linkedChar: {
  characterId: number;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
}): Promise<string | null> {
  // Check if token is still valid (with 5 minute buffer)
  if (Date.now() < linkedChar.tokenExpiresAt.getTime() - 300000) {
    return linkedChar.accessToken;
  }

  const { clientId, clientSecret } = getEveCredentials();

  if (!clientId || !clientSecret) {
    return null;
  }

  try {
    const response = await fetch(ESI_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: linkedChar.refreshToken,
      }),
    });

    if (!response.ok) {
      console.error(`Token refresh failed for linked char ${linkedChar.characterId}:`, await response.text());
      return null;
    }

    const tokens = await response.json();
    
    // Update the linked character's tokens in storage
    await storage.updateLinkedCharacterTokens(linkedChar.characterId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || linkedChar.refreshToken,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    });

    return tokens.access_token;
  } catch (error) {
    console.error(`Token refresh error for linked char ${linkedChar.characterId}:`, error);
    return null;
  }
}

// Helper to get the active character's info and token
// Returns characterId, characterName, and a valid access token for the active character
async function getActiveCharacterInfo(req: Request): Promise<{
  characterId: number;
  characterName: string;
  accessToken: string;
  isPrimary: boolean;
} | null> {
  if (!req.session.character) {
    return null;
  }

  const primaryCharacterId = req.session.character.characterId;
  const primaryCharacterName = req.session.character.characterName;
  const activeCharacterId = req.session.activeCharacterId || primaryCharacterId;

  if (activeCharacterId === primaryCharacterId) {
    // Active character is the primary character
    const accessToken = await refreshTokenIfNeeded(req);
    if (!accessToken) return null;
    
    return {
      characterId: primaryCharacterId,
      characterName: primaryCharacterName,
      accessToken,
      isPrimary: true,
    };
  } else {
    // Active character is a linked character
    const linkedChar = await storage.getLinkedCharacter(activeCharacterId);
    if (!linkedChar) return null;
    
    const accessToken = await refreshLinkedCharacterToken(linkedChar);
    if (!accessToken) return null;
    
    return {
      characterId: linkedChar.characterId,
      characterName: linkedChar.characterName,
      accessToken,
      isPrimary: false,
    };
  }
}

// Helper to fetch bounties for a single character
async function fetchCharacterBounties(characterId: number, accessToken: string): Promise<any[]> {
  try {
    const response = await fetch(
      `${ESI_BASE_URL}/characters/${characterId}/wallet/journal/?datasource=tranquility`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch bounties for character ${characterId}`);
      return [];
    }

    const journal = await response.json();
    
    // Filter for bounty-related payments
    return journal.filter((entry: any) => 
      entry.ref_type === "bounty_prizes" || 
      entry.ref_type === "bounty_prize" ||
      entry.ref_type === "agent_mission_reward" ||
      entry.ref_type === "agent_mission_time_bonus_reward"
    ).map((entry: any) => ({
      id: entry.id,
      date: entry.date,
      amount: entry.amount,
      balance: entry.balance,
      description: entry.description || entry.reason || `${entry.ref_type} payment`,
      refType: entry.ref_type,
      characterId,
    }));
  } catch (error) {
    console.error(`Error fetching bounties for character ${characterId}:`, error);
    return [];
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Trust proxy for secure cookies behind reverse proxy
  app.set('trust proxy', 1);

  // Health check (used by Docker/Caddy/load balancers; no auth, no session)
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", uptime: process.uptime(), ts: new Date().toISOString() });
  });

  // Create session store - use PostgreSQL for reliability (persists across restarts)
  // Electron serves over http://localhost even in production, so don't require HTTPS cookies
  const isProduction = process.env.NODE_ENV === "production" && !process.env.ELECTRON_RUN;
  let sessionStore;
  
  if (process.env.DATABASE_URL) {
    // Use PostgreSQL session store for reliability (both dev and prod)
    // This ensures sessions persist across server restarts
    const pgPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
    });
    sessionStore = new PgSession({
      pool: pgPool,
      tableName: 'user_sessions',
      createTableIfMissing: true,
    });
    console.log("Using PostgreSQL session store");
  } else {
    // Fallback to memory store only if no database available
    sessionStore = new MemoryStoreSession({
      checkPeriod: 86400000,
    });
    console.log("Using memory session store (sessions will be lost on restart)");
  }
  
  // Session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "eve-ratting-tracker-secret",
      resave: false,
      saveUninitialized: true, // Need true for OAuth state persistence across redirects
      store: sessionStore,
      cookie: {
        secure: isProduction,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax', // Required for OAuth redirects
      },
    })
  );

  // Dev-only: Auto-login endpoint for development testing
  // This bypasses EVE OAuth entirely in development mode
  if (process.env.NODE_ENV !== "production") {
    app.get("/api/auth/dev-login", async (req: Request, res: Response) => {
      // Get dev character ID from env or use default test ID
      const devCharacterId = parseInt(process.env.DEV_CHARACTER_ID || "95693805");
      const devCharacterName = process.env.DEV_CHARACTER_NAME || "Dev Test User";
      
      req.session.character = {
        characterId: devCharacterId,
        characterName: devCharacterName,
        accessToken: "dev-mode-token",
        refreshToken: "dev-mode-refresh",
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      };
      
      console.log(`[DEV] Auto-logged in as ${devCharacterName} (${devCharacterId})`);
      res.redirect("/");
    });
    
    console.log("[DEV] Dev login available at /api/auth/dev-login");
  }

  // Debug: show token scopes (decoded from JWT payload)
  app.get("/api/auth/debug-scopes", async (req: Request, res: Response) => {
    const token = await refreshTokenIfNeeded(req);
    if (!token) { res.json({ error: "No token" }); return; }
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      // Test one structure lookup too
      const testStructureId = 1051295814701; // first failing structure from logs
      const esiRes = await fetch(
        `${ESI_BASE_URL}/universe/structures/${testStructureId}/?datasource=tranquility`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const esiBody = await esiRes.text();
      res.json({
        scopes: payload.scp || payload.scope,
        sub: payload.sub,
        structureTest: { id: testStructureId, status: esiRes.status, body: esiBody.substring(0, 200) }
      });
    } catch (e: any) {
      res.json({ error: e.message });
    }
  });

  // Get current auth status with corporation and alliance info (cached)
  app.get("/api/auth/status", async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    if (req.session.character) {
      const characterId = req.session.character.characterId;
      const isAdminUser = await isAdminAsync(characterId);
      
      // Get cached corporation and alliance info (5 min TTL, non-blocking)
      const corpAlliance = await getCachedCorpAllianceInfo(characterId);
      
      res.json({
        authenticated: true,
        character: {
          id: characterId,
          name: req.session.character.characterName,
          corporationId: corpAlliance.corporationId,
          corporationName: corpAlliance.corporationName,
          allianceId: corpAlliance.allianceId,
          allianceName: corpAlliance.allianceName,
        },
        isAdmin: isAdminUser,
      });
    } else {
      res.json({ authenticated: false, isAdmin: false });
    }
  });

  // Helper to get the correct base URL (handles reverse proxy)
  const getBaseUrl = (req: Request): string => {
    // Use environment variable if set, otherwise detect from request
    if (process.env.APP_URL) {
      return process.env.APP_URL;
    }
    const protocol = req.get("x-forwarded-proto") || req.protocol;
    const host = req.get("host");
    const baseUrl = `${protocol}://${host}`;
    console.log(`Generated base URL: ${baseUrl} (proto: ${protocol}, host: ${host}, x-forwarded-proto: ${req.get("x-forwarded-proto")})`);
    return baseUrl;
  };

  // Show the callback URL that needs to be configured in EVE Developer
  app.get("/api/auth/callback-url", (req: Request, res: Response) => {
    const callbackUrl = `${getBaseUrl(req)}/api/auth/callback`;
    res.json({ 
      callbackUrl,
      instructions: "Add this URL to your EVE Developer Application's callback URLs"
    });
  });

  // Initiate ESI login
  app.get("/api/auth/login", (req: Request, res: Response) => {
    const { clientId } = getEveCredentials();
    
    if (!clientId) {
      res.status(500).json({ error: "EVE credentials not configured" });
      return;
    }

    // Log existing session state before generating new one
    console.log("LOGIN: Starting login flow", {
      sessionId: req.sessionID,
      existingState: req.session.state,
    });

    // Generate state for CSRF protection
    const state = Math.random().toString(36).substring(2, 15);
    req.session.state = state;
    
    console.log("LOGIN: State generated and stored", {
      sessionId: req.sessionID,
      newState: state,
    });

    const redirectUri = `${getBaseUrl(req)}/api/auth/callback`;
    // All ESI scopes required by PHOTON
    // Note: Corporation and alliance info is public and doesn't require scopes
    const scopes = [
      "esi-wallet.read_character_wallet.v1", // For bounty, ISK, and wallet journal tracking
      "esi-industry.read_character_mining.v1", // For mining ledger tracking
      "esi-industry.read_character_jobs.v1", // For industry job tracking
      "esi-location.read_location.v1", // For current system tracking
      "esi-location.read_ship_type.v1", // For current ship detection
      "esi-universe.read_structures.v1", // For structure names
      "esi-assets.read_assets.v1", // For character asset tracking
      "esi-contracts.read_character_contracts.v1", // For contract tracking
      "esi-planets.manage_planets.v1", // For planetary industry tracking
      "esi-skills.read_skillqueue.v1", // For skill queue monitoring (v0.4.0)
      "esi-skills.read_skills.v1", // For trained skills and skill planner (v0.5.0)
      "esi-markets.read_character_orders.v1", // For market order tracking (v0.4.0)
      "esi-markets.structure_markets.v1", // For reading market orders at player-owned structures (Market Intel)
      "esi-search.search_structures.v1", // For searching player-owned structures by name (Market Intel)
      "esi-clones.read_clones.v1", // Jump clones (v0.6.0)
      "esi-clones.read_implants.v1", // Active implants for jump clones (v0.6.0)
      "esi-killmails.read_killmails.v1", // Killboard (v0.6.0)
      "esi-characters.read_notifications.v1", // Notifications (v0.6.0)
      "esi-characters.read_standings.v1", // NPC standings (v0.6.0)
      "esi-characters.read_loyalty.v1", // Loyalty points (v0.6.0)
      "esi-characters.read_blueprints.v1", // Blueprint library (v0.7.0)
    ].join(" ");

    const authUrl = new URL(ESI_AUTH_URL);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("state", state);

    // Explicitly save session before redirecting to ensure state persists
    // Note: MemoryStore saves synchronously, so we proceed even if callback has an error
    req.session.save((err) => {
      if (err) {
        console.warn("LOGIN: Session save warning (proceeding anyway):", err);
      }
      console.log("LOGIN: Redirecting to EVE SSO", {
        sessionId: req.sessionID,
        state: state,
      });
      res.redirect(authUrl.toString());
    });
  });

  // Handle ESI callback
  app.get("/api/auth/callback", async (req: Request, res: Response) => {
    const { code, state } = req.query;
    const { clientId, clientSecret } = getEveCredentials();

    console.log("CALLBACK: Received from EVE SSO", { 
      hasCode: !!code, 
      stateFromUrl: state, 
      stateFromSession: req.session.state,
      sessionId: req.sessionID,
      cookieHeader: req.headers.cookie ? 'present' : 'missing',
    });

    if (!clientId || !clientSecret) {
      res.redirect("/?error=credentials_not_configured");
      return;
    }

    if (state !== req.session.state) {
      console.error("State mismatch:", { urlState: state, sessionState: req.session.state });
      res.redirect("/?error=invalid_state");
      return;
    }

    if (!code || typeof code !== "string") {
      res.redirect("/?error=no_code");
      return;
    }

    try {
      // Exchange code for tokens
      const redirectUri = `${getBaseUrl(req)}/api/auth/callback`;
      const tokenResponse = await fetch(ESI_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: redirectUri,
        }),
      });

      authLog(" Token exchange status:", tokenResponse.status, tokenResponse.statusText);
      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        authLog(" FATAL: Token exchange failed:", error);
        res.redirect("/?error=token_exchange_failed");
        return;
      }

      const tokens = await tokenResponse.json();
      authLog(" Token exchange OK, has access_token:", !!tokens.access_token);

      // Verify token and get character info
      const verifyResponse = await fetch(ESI_VERIFY_URL, {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      authLog(" Verify status:", verifyResponse.status, verifyResponse.statusText);
      if (!verifyResponse.ok) {
        const verifyErr = await verifyResponse.text();
        authLog(" FATAL: Verify failed:", verifyErr);
        res.redirect("/?error=verification_failed");
        return;
      }

      const characterInfo = await verifyResponse.json();
      authLog(" Character info:", characterInfo.CharacterID, characterInfo.CharacterName);

      // Check if this is a link character flow or reauth flow
      const isLinkFlow = req.session.linkingCharacter === true;
      const isReauthFlow = req.session.reauthorizingCharacterId !== undefined;
      const reauthCharacterId = req.session.reauthorizingCharacterId;
      const existingCharacter = req.session.character;

      // Clear the OAuth state and flags
      delete req.session.state;
      delete req.session.linkingCharacter;
      delete req.session.reauthorizingCharacterId;

      // REAUTHORIZE FLOW - Update tokens for existing character
      if (isReauthFlow && reauthCharacterId && existingCharacter) {
        authLog(` Reauth flow: Refreshing permissions for character ${characterInfo.CharacterID}`);

        // Verify the reauthed character matches what we expected
        if (characterInfo.CharacterID !== reauthCharacterId) {
          authLog(` Reauth flow: Character mismatch - expected ${reauthCharacterId}, got ${characterInfo.CharacterID}`);
          res.redirect("/settings?error=character_mismatch");
          return;
        }

        const isPrimaryReauth = reauthCharacterId === existingCharacter.characterId;

        try {
          if (isPrimaryReauth) {
            // Update primary character session
            req.session.character = {
              characterId: characterInfo.CharacterID,
              characterName: characterInfo.CharacterName,
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              expiresAt: Date.now() + tokens.expires_in * 1000,
            };
            authLog(` Reauth flow: Updated primary character ${characterInfo.CharacterName}`);
          } else {
            // Update linked character tokens
            await storage.updateLinkedCharacterTokens(reauthCharacterId, {
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            });
            authLog(` Reauth flow: Updated linked character ${characterInfo.CharacterName}`);
          }

          req.session.save((saveErr) => {
            if (saveErr) {
              authLog(" Reauth session save failed:", saveErr);
            }
            res.redirect("/settings?success=permissions_updated");
          });
        } catch (reauthError) {
          authLog(" Failed to update character tokens:", reauthError);
          res.redirect("/settings?error=reauth_failed");
        }
        return;
      }

      if (isLinkFlow && existingCharacter) {
        // LINK CHARACTER FLOW - Add character to existing account
        authLog(` Link flow: Adding ${characterInfo.CharacterName} to account of ${existingCharacter.characterName}`);

        // Cannot link the same character that's already the primary
        if (characterInfo.CharacterID === existingCharacter.characterId) {
          authLog(` Link flow: User tried to link their own primary character`);
          res.redirect("/settings?error=cannot_link_self");
          return;
        }

        // Check if character is already linked to any account
        const isAlreadyLinked = await storage.isCharacterLinked(characterInfo.CharacterID);
        if (isAlreadyLinked) {
          authLog(` Link flow: Character ${characterInfo.CharacterName} is already linked`);
          res.redirect("/settings?error=character_already_linked");
          return;
        }

        // Fetch corporation and alliance info from ESI
        let corporationId: number | undefined;
        let corporationName: string | undefined;
        let allianceId: number | undefined;
        let allianceName: string | undefined;

        try {
          const charInfoResponse = await fetch(
            `${ESI_BASE_URL}/characters/${characterInfo.CharacterID}/?datasource=tranquility`
          );
          if (charInfoResponse.ok) {
            const charData = await charInfoResponse.json();
            corporationId = charData.corporation_id;
            allianceId = charData.alliance_id;

            // Get corporation name
            if (corporationId) {
              const corpResponse = await fetch(
                `${ESI_BASE_URL}/corporations/${corporationId}/?datasource=tranquility`
              );
              if (corpResponse.ok) {
                const corpData = await corpResponse.json();
                corporationName = corpData.name;
              }
            }

            // Get alliance name
            if (allianceId) {
              const allianceResponse = await fetch(
                `${ESI_BASE_URL}/alliances/${allianceId}/?datasource=tranquility`
              );
              if (allianceResponse.ok) {
                const allianceData = await allianceResponse.json();
                allianceName = allianceData.name;
              }
            }
          }
        } catch (esiError) {
          authLog(" Failed to fetch corp/alliance info:", esiError);
          // Continue without corp/alliance info
        }

        // Link the character
        try {
          await storage.linkCharacter({
            primaryCharacterId: existingCharacter.characterId,
            characterId: characterInfo.CharacterID,
            characterName: characterInfo.CharacterName,
            corporationId: corporationId,
            corporationName: corporationName,
            allianceId: allianceId,
            allianceName: allianceName,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            isActive: true,
          });

          authLog(` Successfully linked ${characterInfo.CharacterName} to ${existingCharacter.characterName}`);
          
          req.session.save((saveErr) => {
            if (saveErr) {
              authLog(" Session save failed:", saveErr);
            }
            res.redirect("/settings?success=character_linked");
          });
        } catch (linkError) {
          authLog(" Failed to link character:", linkError);
          res.redirect("/settings?error=link_failed");
        }
        return;
      }

      // NORMAL LOGIN FLOW
      // Store character in session
      req.session.character = {
        characterId: characterInfo.CharacterID,
        characterName: characterInfo.CharacterName,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
      };

      authLog(` Login successful for ${characterInfo.CharacterName} (${characterInfo.CharacterID})`);

      // Create or update user profile in database (this tracks first login)
      try {
        const existingProfile = await storage.getUserProfile(characterInfo.CharacterID);
        if (!existingProfile) {
          // First time login - create profile
          await storage.createOrUpdateUserProfile({
            characterId: characterInfo.CharacterID,
            characterName: characterInfo.CharacterName,
            firstLoginAt: new Date(),
            corpTaxRate: 0,
          });
          authLog(` Created user profile for ${characterInfo.CharacterName} (${characterInfo.CharacterID})`);
        } else {
          // Update character name in case it changed
          await storage.createOrUpdateUserProfile({
            ...existingProfile,
            characterName: characterInfo.CharacterName,
          });
          authLog(` Updated existing profile for ${characterInfo.CharacterName}`);
        }
      } catch (profileError) {
        authLog(" Failed to create/update user profile:", profileError);
        // Don't fail login if profile creation fails
      }

      // CRITICAL: Save the session BEFORE redirecting
      // This ensures the session cookie is flushed to the store before the browser redirects
      req.session.save((saveErr) => {
        if (saveErr) {
          authLog(" FATAL: Session save failed:", saveErr);
          res.redirect("/login?error=session_save_failed");
          return;
        }

        authLog(` Session saved successfully, redirecting to dashboard`);
        res.redirect("/");
      });
    } catch (error) {
      authLog(" FATAL: OAuth callback error:", error);
      res.redirect("/login?error=auth_failed");
    }
  });

  // Logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        res.status(500).json({ error: "Failed to logout" });
      } else {
        res.json({ success: true });
      }
    });
  });

  // ===== MULTIBOXING / LINKED CHARACTERS ENDPOINTS =====

  // Get linked characters for the current user
  app.get("/api/characters/linked", isAuthenticated, async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    try {
      const primaryCharacterId = user.characterId;
      const linkedCharacters = await storage.getLinkedCharacters(primaryCharacterId);
      
      // Return simplified character data (no tokens)
      const characters = linkedCharacters.map(char => ({
        id: char.id,
        characterId: char.characterId,
        characterName: char.characterName,
        corporationId: char.corporationId,
        corporationName: char.corporationName,
        allianceId: char.allianceId,
        allianceName: char.allianceName,
        isActive: char.isActive,
        linkedAt: char.linkedAt,
        lastUsedAt: char.lastUsedAt,
      }));

      // Add primary character as the first entry
      const primaryCharacter = {
        characterId: user.characterId,
        characterName: user.characterName,
        isPrimary: true,
        isActive: req.session.activeCharacterId === user.characterId || !req.session.activeCharacterId,
      };

      res.json({
        primaryCharacter,
        linkedCharacters: characters,
        activeCharacterId: req.session.activeCharacterId || user.characterId,
      });
    } catch (error) {
      console.error("Error fetching linked characters:", error);
      res.status(500).json({ error: "Failed to fetch linked characters" });
    }
  });

  // Initiate link character OAuth flow
  app.get("/api/auth/link-character", isAuthenticated, (req: Request, res: Response) => {
    const { clientId } = getEveCredentials();
    
    if (!clientId) {
      res.status(500).json({ error: "EVE credentials not configured" });
      return;
    }

    // Generate state for CSRF protection - include "link" prefix to distinguish from login
    const state = `link_${Math.random().toString(36).substring(2, 15)}`;
    req.session.state = state;
    req.session.linkingCharacter = true; // Flag to indicate this is a link flow

    console.log("LINK_CHARACTER: Starting link flow", {
      sessionId: req.sessionID,
      primaryCharacterId: req.session.character?.characterId,
      state: state,
    });

    const redirectUri = `${getBaseUrl(req)}/api/auth/callback`;
    const scopes = [
      "esi-wallet.read_character_wallet.v1",
      "esi-industry.read_character_mining.v1",
      "esi-industry.read_character_jobs.v1",
      "esi-location.read_location.v1",
      "esi-location.read_ship_type.v1",
      "esi-universe.read_structures.v1",
      "esi-assets.read_assets.v1",
      "esi-contracts.read_character_contracts.v1",
      "esi-planets.manage_planets.v1",
      "esi-skills.read_skillqueue.v1",
      "esi-markets.read_character_orders.v1",
      "esi-clones.read_clones.v1",
      "esi-clones.read_implants.v1",
      "esi-killmails.read_killmails.v1",
      "esi-characters.read_notifications.v1",
      "esi-characters.read_standings.v1",
      "esi-characters.read_loyalty.v1",
      "esi-characters.read_blueprints.v1",
    ].join(" ");

    const authUrl = new URL(ESI_AUTH_URL);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("state", state);

    req.session.save((err) => {
      if (err) {
        console.warn("LINK_CHARACTER: Session save warning:", err);
      }
      res.redirect(authUrl.toString());
    });
  });

  // Re-authorize a character (refresh ESI permissions)
  app.get("/api/auth/reauthorize/:characterId", isAuthenticated, async (req: Request, res: Response) => {
    const { clientId } = getEveCredentials();
    const user = (req as AuthenticatedRequest).user;
    
    if (!clientId) {
      res.status(500).json({ error: "EVE credentials not configured" });
      return;
    }

    const characterId = parseInt(req.params.characterId);
    if (isNaN(characterId)) {
      res.status(400).json({ error: "Invalid character ID" });
      return;
    }

    // Check if this is the primary character or a linked character
    const isPrimary = characterId === user.characterId;
    if (!isPrimary) {
      const linkedChars = await storage.getLinkedCharacters(user.characterId);
      const linkedChar = linkedChars.find(c => c.characterId === characterId);
      if (!linkedChar) {
        res.status(404).json({ error: "Character not found on this account" });
        return;
      }
    }

    // Generate state for CSRF protection - include "reauth" prefix and character ID
    const state = `reauth_${characterId}_${Math.random().toString(36).substring(2, 15)}`;
    req.session.state = state;
    req.session.reauthorizingCharacterId = characterId;

    console.log("REAUTHORIZE: Starting reauth flow", {
      sessionId: req.sessionID,
      characterId: characterId,
      isPrimary: isPrimary,
      state: state,
    });

    const redirectUri = `${getBaseUrl(req)}/api/auth/callback`;
    const scopes = [
      "esi-wallet.read_character_wallet.v1",
      "esi-industry.read_character_mining.v1",
      "esi-industry.read_character_jobs.v1",
      "esi-location.read_location.v1",
      "esi-location.read_ship_type.v1",
      "esi-universe.read_structures.v1",
      "esi-assets.read_assets.v1",
      "esi-contracts.read_character_contracts.v1",
      "esi-planets.manage_planets.v1",
      "esi-skills.read_skillqueue.v1",
      "esi-markets.read_character_orders.v1",
      "esi-clones.read_clones.v1",
      "esi-clones.read_implants.v1",
      "esi-killmails.read_killmails.v1",
      "esi-characters.read_notifications.v1",
      "esi-characters.read_standings.v1",
      "esi-characters.read_loyalty.v1",
      "esi-characters.read_blueprints.v1",
    ].join(" ");

    const authUrl = new URL(ESI_AUTH_URL);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("state", state);

    req.session.save((err) => {
      if (err) {
        console.warn("REAUTHORIZE: Session save warning:", err);
      }
      res.redirect(authUrl.toString());
    });
  });

  // Unlink a character
  app.delete("/api/characters/linked/:characterId", isAuthenticated, async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    try {
      const primaryCharacterId = user.characterId;
      const characterIdToUnlink = parseInt(req.params.characterId);

      if (isNaN(characterIdToUnlink)) {
        res.status(400).json({ error: "Invalid character ID" });
        return;
      }

      // Cannot unlink yourself (primary character)
      if (characterIdToUnlink === primaryCharacterId) {
        res.status(400).json({ error: "Cannot unlink your primary character" });
        return;
      }

      // Verify the character belongs to this account
      const linkedChars = await storage.getLinkedCharacters(primaryCharacterId);
      const charToUnlink = linkedChars.find(c => c.characterId === characterIdToUnlink);
      
      if (!charToUnlink) {
        res.status(404).json({ error: "Character not found or not linked to this account" });
        return;
      }

      await storage.unlinkCharacter(primaryCharacterId, characterIdToUnlink);
      
      // If the unlinked character was the active one, reset to primary
      if (req.session.activeCharacterId === characterIdToUnlink) {
        req.session.activeCharacterId = primaryCharacterId;
      }

      console.log(`Unlinked character ${characterIdToUnlink} from primary ${primaryCharacterId}`);
      res.json({ success: true, message: "Character unlinked successfully" });
    } catch (error) {
      console.error("Error unlinking character:", error);
      res.status(500).json({ error: "Failed to unlink character" });
    }
  });

  // Switch active character
  app.post("/api/characters/switch", isAuthenticated, async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    try {
      const { characterId } = req.body;
      const primaryCharacterId = user.characterId;

      if (!characterId || isNaN(parseInt(characterId))) {
        res.status(400).json({ error: "Invalid character ID" });
        return;
      }

      const targetCharacterId = parseInt(characterId);

      // Allow switching to primary character
      if (targetCharacterId === primaryCharacterId) {
        req.session.activeCharacterId = primaryCharacterId;
        req.session.save(() => {
          res.json({ 
            success: true, 
            activeCharacterId: primaryCharacterId,
            characterName: user.characterName,
          });
        });
        return;
      }

      // Verify the target character is linked to this account
      const linkedChars = await storage.getLinkedCharacters(primaryCharacterId);
      const targetChar = linkedChars.find(c => c.characterId === targetCharacterId);

      if (!targetChar) {
        res.status(404).json({ error: "Character not found or not linked to this account" });
        return;
      }

      // Update active character in session
      req.session.activeCharacterId = targetCharacterId;
      
      // Update last used timestamp
      await storage.updateLinkedCharacterLastUsed(targetCharacterId);

      req.session.save(() => {
        res.json({ 
          success: true, 
          activeCharacterId: targetCharacterId,
          characterName: targetChar.characterName,
        });
      });
    } catch (error) {
      console.error("Error switching character:", error);
      res.status(500).json({ error: "Failed to switch character" });
    }
  });

  // Get current active character info
  app.get("/api/characters/active", isAuthenticated, async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    try {
      const primaryCharacterId = user.characterId;
      const activeCharacterId = req.session.activeCharacterId || primaryCharacterId;

      // If active is primary, return primary info
      if (activeCharacterId === primaryCharacterId) {
        res.json({
          characterId: primaryCharacterId,
          characterName: user.characterName,
          isPrimary: true,
          accessToken: user.accessToken, // For ESI calls
        });
        return;
      }

      // Otherwise, get linked character info
      const linkedChar = await storage.getLinkedCharacter(activeCharacterId);
      if (!linkedChar) {
        // Fallback to primary if linked char not found
        req.session.activeCharacterId = primaryCharacterId;
        res.json({
          characterId: primaryCharacterId,
          characterName: user.characterName,
          isPrimary: true,
          accessToken: user.accessToken,
        });
        return;
      }

      res.json({
        characterId: linkedChar.characterId,
        characterName: linkedChar.characterName,
        isPrimary: false,
        corporationId: linkedChar.corporationId,
        corporationName: linkedChar.corporationName,
        allianceId: linkedChar.allianceId,
        allianceName: linkedChar.allianceName,
        accessToken: linkedChar.accessToken, // For ESI calls
      });
    } catch (error) {
      console.error("Error getting active character:", error);
      res.status(500).json({ error: "Failed to get active character" });
    }
  });

  // ===== END MULTIBOXING ENDPOINTS =====

  // Get wallet balance (requires authentication)
  // Respects active character selection for multi-character support
  app.get("/api/wallet/balance", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed for active character" });
        return;
      }

      const response = await fetch(
        `${ESI_BASE_URL}/characters/${activeChar.characterId}/wallet/?datasource=tranquility`,
        {
          headers: {
            Authorization: `Bearer ${activeChar.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Wallet balance error:", errorText);
        res.status(response.status).json({ error: "Failed to fetch wallet balance" });
        return;
      }

      const balance = await response.json();
      res.json({ balance, characterId: activeChar.characterId, characterName: activeChar.characterName });
    } catch (error) {
      console.error("Wallet balance error:", error);
      res.status(500).json({ error: "Failed to fetch wallet balance" });
    }
  });

  // Get wallet journal (requires authentication)
  // Respects active character selection for multi-character support
  app.get("/api/wallet/journal", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed for active character" });
        return;
      }

      const response = await fetch(
        `${ESI_BASE_URL}/characters/${activeChar.characterId}/wallet/journal/?datasource=tranquility`,
        {
          headers: {
            Authorization: `Bearer ${activeChar.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Wallet journal error:", errorText);
        res.status(response.status).json({ error: "Failed to fetch wallet journal" });
        return;
      }

      const journal = await response.json();
      res.json(journal);
    } catch (error) {
      console.error("Wallet journal error:", error);
      res.status(500).json({ error: "Failed to fetch wallet data" });
    }
  });

  // Get bounty income from wallet journal (filtered)
  // Supports ?viewAll=true to aggregate bounties from all linked characters
  // In single mode, respects the active character selection
  app.get("/api/wallet/bounties", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const viewAll = req.query.viewAll === "true";
      const primaryCharacterId = req.session.character.characterId;
      const primaryCharacterName = req.session.character.characterName;
      const activeCharacterId = req.session.activeCharacterId || primaryCharacterId;

      let allBounties: any[] = [];
      const characterBreakdown: { characterId: number; characterName: string; bountyCount: number; totalBounties: number }[] = [];

      if (viewAll) {
        // Aggregate mode: fetch from primary and all linked characters
        const primaryToken = await refreshTokenIfNeeded(req);
        if (primaryToken) {
          const primaryBounties = await fetchCharacterBounties(primaryCharacterId, primaryToken);
          allBounties = [...primaryBounties];
          
          if (primaryBounties.length > 0) {
            characterBreakdown.push({
              characterId: primaryCharacterId,
              characterName: primaryCharacterName,
              bountyCount: primaryBounties.length,
              totalBounties: primaryBounties.reduce((sum, b) => sum + b.amount, 0),
            });
          }
        }

        const linkedCharacters = await storage.getLinkedCharacters(primaryCharacterId);
        
        for (const linkedChar of linkedCharacters) {
          if (!linkedChar.isActive) continue;
          
          const linkedToken = await refreshLinkedCharacterToken(linkedChar);
          if (!linkedToken) continue;
          
          const linkedBounties = await fetchCharacterBounties(linkedChar.characterId, linkedToken);
          allBounties = [...allBounties, ...linkedBounties];
          
          if (linkedBounties.length > 0) {
            characterBreakdown.push({
              characterId: linkedChar.characterId,
              characterName: linkedChar.characterName,
              bountyCount: linkedBounties.length,
              totalBounties: linkedBounties.reduce((sum, b) => sum + b.amount, 0),
            });
          }
        }
      } else {
        // Single character mode: fetch only for the active character
        let activeToken: string | null = null;
        let activeCharacterName = primaryCharacterName;

        if (activeCharacterId === primaryCharacterId) {
          // Active character is the primary character
          activeToken = await refreshTokenIfNeeded(req);
          activeCharacterName = primaryCharacterName;
        } else {
          // Active character is a linked character
          const linkedChar = await storage.getLinkedCharacter(activeCharacterId);
          if (linkedChar) {
            activeToken = await refreshLinkedCharacterToken(linkedChar);
            activeCharacterName = linkedChar.characterName;
          }
        }

        if (!activeToken) {
          res.status(401).json({ error: "Token refresh failed for active character" });
          return;
        }

        const bounties = await fetchCharacterBounties(activeCharacterId, activeToken);
        allBounties = bounties;
        
        if (bounties.length > 0) {
          characterBreakdown.push({
            characterId: activeCharacterId,
            characterName: activeCharacterName,
            bountyCount: bounties.length,
            totalBounties: bounties.reduce((sum, b) => sum + b.amount, 0),
          });
        }
      }

      // Sort all bounties by date (most recent first)
      allBounties.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Calculate summary statistics
      const totalBounties = allBounties.reduce((sum: number, b: any) => sum + b.amount, 0);
      const bountyCount = allBounties.length;

      res.json({
        bounties: allBounties,
        summary: {
          totalBounties,
          bountyCount,
        },
        viewAll,
        activeCharacterId,
        characterBreakdown: viewAll ? characterBreakdown : undefined,
      });
    } catch (error) {
      console.error("Wallet bounties error:", error);
      res.status(500).json({ error: "Failed to fetch bounty data" });
    }
  });

  // Get mining ledger data
  // Respects active character selection for multi-character support
  app.get("/api/mining/ledger", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed for active character" });
        return;
      }
      
      // Fetch mining ledger from ESI
      const response = await fetch(
        `${ESI_BASE_URL}/characters/${activeChar.characterId}/mining/?datasource=tranquility`,
        {
          headers: {
            Authorization: `Bearer ${activeChar.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Mining ledger error:", errorText);
        
        // Check for missing scope error
        if (response.status === 403) {
          res.status(403).json({ 
            error: "Missing mining scope", 
            message: "Please log out and log in again to grant mining permissions" 
          });
          return;
        }
        
        res.status(response.status).json({ error: "Failed to fetch mining ledger" });
        return;
      }

      const miningLedger = await response.json();
      
      // Get unique type IDs and system IDs for name resolution
      const typeIds = Array.from(new Set(miningLedger.map((e: any) => e.type_id))) as number[];
      const systemIds = Array.from(new Set(miningLedger.map((e: any) => e.solar_system_id))) as number[];
      
      // Fetch type names in parallel (limit to first 50 to avoid too many requests)
      const typeNamePromises = typeIds.slice(0, 50).map(async (typeId: number) => {
        try {
          const typeResponse = await fetch(
            `${ESI_BASE_URL}/universe/types/${typeId}/?datasource=tranquility&language=en`
          );
          if (typeResponse.ok) {
            const data = await typeResponse.json();
            return { typeId, name: data.name, volume: data.volume || 0 };
          }
          return { typeId, name: `Type ${typeId}`, volume: 0 };
        } catch {
          return { typeId, name: `Type ${typeId}`, volume: 0 };
        }
      });
      
      // Fetch system names in parallel
      const systemNamePromises = systemIds.slice(0, 50).map(async (systemId: number) => {
        try {
          const systemResponse = await fetch(
            `${ESI_BASE_URL}/universe/systems/${systemId}/?datasource=tranquility&language=en`
          );
          if (systemResponse.ok) {
            const data = await systemResponse.json();
            return { systemId, name: data.name };
          }
          return { systemId, name: `System ${systemId}` };
        } catch {
          return { systemId, name: `System ${systemId}` };
        }
      });
      
      const [typeNames, systemNames] = await Promise.all([
        Promise.all(typeNamePromises),
        Promise.all(systemNamePromises),
      ]);
      
      // Create lookup maps
      const typeNameMap = new Map(typeNames.map(t => [t.typeId, { name: t.name, volume: t.volume }]));
      const systemNameMap = new Map(systemNames.map(s => [s.systemId, s.name]));
      
      // Enrich mining entries with names
      const enrichedLedger = miningLedger.map((entry: any) => ({
        date: entry.date,
        typeId: entry.type_id,
        typeName: typeNameMap.get(entry.type_id)?.name || `Type ${entry.type_id}`,
        volume: typeNameMap.get(entry.type_id)?.volume || 0,
        quantity: entry.quantity,
        solarSystemId: entry.solar_system_id,
        solarSystemName: systemNameMap.get(entry.solar_system_id) || `System ${entry.solar_system_id}`,
      }));
      
      // Group by ore type for summary
      const oreBreakdown: Record<number, { typeName: string; quantity: number; volume: number }> = {};
      for (const entry of enrichedLedger) {
        if (!oreBreakdown[entry.typeId]) {
          oreBreakdown[entry.typeId] = {
            typeName: entry.typeName,
            quantity: 0,
            volume: entry.volume,
          };
        }
        oreBreakdown[entry.typeId].quantity += entry.quantity;
      }
      
      // Calculate totals
      const totalQuantity = enrichedLedger.reduce((sum: number, e: any) => sum + e.quantity, 0);
      const totalVolume = enrichedLedger.reduce((sum: number, e: any) => sum + (e.quantity * e.volume), 0);
      
      res.json({
        ledger: enrichedLedger,
        oreBreakdown: Object.values(oreBreakdown),
        summary: {
          totalEntries: enrichedLedger.length,
          totalQuantity,
          totalVolume,
          uniqueOreTypes: Object.keys(oreBreakdown).length,
        },
      });
    } catch (error) {
      console.error("Mining ledger error:", error);
      res.status(500).json({ error: "Failed to fetch mining data" });
    }
  });

  // Ore reprocessing data: base minerals per 100 units of ore (at 100% efficiency)
  // Using approximate values - actual yields depend on skills and station
  const ORE_MINERALS: Record<string, Record<string, number>> = {
    // Basic Ores
    "Veldspar": { Tritanium: 400 },
    "Concentrated Veldspar": { Tritanium: 420 },
    "Dense Veldspar": { Tritanium: 440 },
    "Stable Veldspar": { Tritanium: 460 },
    "Scordite": { Tritanium: 150, Pyerite: 90 },
    "Condensed Scordite": { Tritanium: 158, Pyerite: 95 },
    "Massive Scordite": { Tritanium: 165, Pyerite: 99 },
    "Glossy Scordite": { Tritanium: 173, Pyerite: 104 },
    "Pyroxeres": { Pyerite: 90, Mexallon: 30, Nocxium: 5 },
    "Solid Pyroxeres": { Pyerite: 95, Mexallon: 32, Nocxium: 5 },
    "Viscous Pyroxeres": { Pyerite: 99, Mexallon: 33, Nocxium: 6 },
    "Opulent Pyroxeres": { Pyerite: 104, Mexallon: 35, Nocxium: 6 },
    "Plagioclase": { Tritanium: 175, Pyerite: 70, Mexallon: 35 },
    "Azure Plagioclase": { Tritanium: 184, Pyerite: 74, Mexallon: 37 },
    "Rich Plagioclase": { Tritanium: 193, Pyerite: 77, Mexallon: 39 },
    "Sparkling Plagioclase": { Tritanium: 201, Pyerite: 81, Mexallon: 40 },
    // Moderate Ores
    "Omber": { Tritanium: 85, Pyerite: 34, Isogen: 85 },
    "Silvery Omber": { Tritanium: 89, Pyerite: 36, Isogen: 89 },
    "Golden Omber": { Tritanium: 94, Pyerite: 37, Isogen: 94 },
    "Platinoid Omber": { Tritanium: 98, Pyerite: 39, Isogen: 98 },
    "Kernite": { Tritanium: 134, Mexallon: 134, Isogen: 134 },
    "Luminous Kernite": { Tritanium: 141, Mexallon: 141, Isogen: 141 },
    "Fiery Kernite": { Tritanium: 147, Mexallon: 147, Isogen: 147 },
    "Resplendent Kernite": { Tritanium: 154, Mexallon: 154, Isogen: 154 },
    "Jaspet": { Mexallon: 150, Nocxium: 50, Zydrine: 8 },
    "Pure Jaspet": { Mexallon: 158, Nocxium: 53, Zydrine: 8 },
    "Pristine Jaspet": { Mexallon: 165, Nocxium: 55, Zydrine: 9 },
    "Immaculate Jaspet": { Mexallon: 173, Nocxium: 58, Zydrine: 9 },
    "Hemorphite": { Tritanium: 212, Isogen: 212, Nocxium: 106, Zydrine: 16 },
    "Vivid Hemorphite": { Tritanium: 223, Isogen: 223, Nocxium: 111, Zydrine: 17 },
    "Radiant Hemorphite": { Tritanium: 233, Isogen: 233, Nocxium: 117, Zydrine: 18 },
    "Scintillating Hemorphite": { Tritanium: 244, Isogen: 244, Nocxium: 122, Zydrine: 18 },
    "Hedbergite": { Pyerite: 90, Isogen: 180, Nocxium: 42, Zydrine: 17 },
    "Vitric Hedbergite": { Pyerite: 95, Isogen: 189, Nocxium: 44, Zydrine: 18 },
    "Glazed Hedbergite": { Pyerite: 99, Isogen: 198, Nocxium: 46, Zydrine: 19 },
    "Lustrous Hedbergite": { Pyerite: 104, Isogen: 207, Nocxium: 48, Zydrine: 20 },
    // Rare Ores
    "Gneiss": { Tritanium: 171, Mexallon: 171, Isogen: 343, Zydrine: 17 },
    "Iridescent Gneiss": { Tritanium: 180, Mexallon: 180, Isogen: 360, Zydrine: 18 },
    "Prismatic Gneiss": { Tritanium: 188, Mexallon: 188, Isogen: 377, Zydrine: 19 },
    "Brilliant Gneiss": { Tritanium: 197, Mexallon: 197, Isogen: 394, Zydrine: 20 },
    "Dark Ochre": { Tritanium: 250, Isogen: 500, Nocxium: 50, Zydrine: 25 },
    "Onyx Ochre": { Tritanium: 263, Isogen: 525, Nocxium: 53, Zydrine: 26 },
    "Obsidian Ochre": { Tritanium: 275, Isogen: 550, Nocxium: 55, Zydrine: 28 },
    "Jet Ochre": { Tritanium: 288, Isogen: 575, Nocxium: 58, Zydrine: 29 },
    "Crokite": { Tritanium: 331, Nocxium: 110, Zydrine: 55 },
    "Sharp Crokite": { Tritanium: 348, Nocxium: 116, Zydrine: 58 },
    "Crystalline Crokite": { Tritanium: 364, Nocxium: 121, Zydrine: 61 },
    "Pellucid Crokite": { Tritanium: 381, Nocxium: 127, Zydrine: 63 },
    "Spodumain": { Tritanium: 700, Pyerite: 140, Mexallon: 140, Isogen: 28 },
    "Bright Spodumain": { Tritanium: 735, Pyerite: 147, Mexallon: 147, Isogen: 29 },
    "Gleaming Spodumain": { Tritanium: 770, Pyerite: 154, Mexallon: 154, Isogen: 31 },
    "Dazzling Spodumain": { Tritanium: 805, Pyerite: 161, Mexallon: 161, Isogen: 32 },
    "Bistot": { Pyerite: 170, Zydrine: 34, Megacyte: 17 },
    "Triclinic Bistot": { Pyerite: 179, Zydrine: 36, Megacyte: 18 },
    "Monoclinic Bistot": { Pyerite: 187, Zydrine: 37, Megacyte: 19 },
    "Cubic Bistot": { Pyerite: 196, Zydrine: 39, Megacyte: 20 },
    "Arkonor": { Tritanium: 300, Mexallon: 166, Megacyte: 33 },
    "Crimson Arkonor": { Tritanium: 315, Mexallon: 174, Megacyte: 35 },
    "Prime Arkonor": { Tritanium: 330, Mexallon: 183, Megacyte: 36 },
    "Flawless Arkonor": { Tritanium: 345, Mexallon: 191, Megacyte: 38 },
    "Mercoxit": { Morphite: 140 },
    "Magma Mercoxit": { Morphite: 147 },
    "Vitreous Mercoxit": { Morphite: 154 },
    "Glowing Mercoxit": { Morphite: 161 },
  };

  // Janice API for pricing
  const JANICE_API_URL = "https://janice.e-351.com/api/rest/v2";
  const JANICE_API_KEY = "G9KwKq3465588VPd6747t95Zh94q3W2E"; // Public sample key

  // Helper to get Janice prices for items using appraisal API
  async function getJanicePrices(items: { typeId: number; typeName: string; quantity: number }[]): Promise<Map<number, { sell: number; buy: number }>> {
    const priceMap = new Map<number, { sell: number; buy: number }>();
    
    if (items.length === 0) return priceMap;
    
    try {
      // Format as text input for Janice appraisal API
      const inputText = items.map(item => `${item.typeName} x1`).join("\n");
      
      const response = await fetch(`${JANICE_API_URL}/appraisal?market=2&designation=appraisal&pricing=sell&pricingVariant=immediate&persist=false`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "X-ApiKey": JANICE_API_KEY,
          "Accept": "application/json",
        },
        body: inputText,
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Map results back to type IDs based on item name matching
        if (data.items && Array.isArray(data.items)) {
          for (let i = 0; i < data.items.length && i < items.length; i++) {
            const jaItem = data.items[i];
            const origItem = items[i];
            
            if (jaItem.immediatePrices) {
              priceMap.set(origItem.typeId, {
                sell: jaItem.immediatePrices.sellPrice || 0,
                buy: jaItem.immediatePrices.buyPrice || 0,
              });
            }
          }
        }
      } else {
        console.error("Janice API error response:", response.status, await response.text().catch(() => ""));
      }
    } catch (error) {
      console.error("Janice API error:", error);
    }
    
    return priceMap;
  }

  // TypeID-based ore mineral yields for authoritative lookup
  // Key ore type IDs from EVE Online
  const ORE_TYPE_MINERALS: Record<number, Record<string, number>> = {
    // Veldspar variants
    1230: { Tritanium: 400 }, // Veldspar
    17470: { Tritanium: 420 }, // Concentrated Veldspar
    17471: { Tritanium: 440 }, // Dense Veldspar
    46689: { Tritanium: 460 }, // Stable Veldspar
    // Scordite variants
    1228: { Tritanium: 150, Pyerite: 90 }, // Scordite
    17463: { Tritanium: 158, Pyerite: 95 }, // Condensed Scordite
    17464: { Tritanium: 165, Pyerite: 99 }, // Massive Scordite
    46687: { Tritanium: 173, Pyerite: 104 }, // Glossy Scordite
    // Pyroxeres variants
    1224: { Pyerite: 90, Mexallon: 30, Nocxium: 5 }, // Pyroxeres
    17459: { Pyerite: 95, Mexallon: 32, Nocxium: 5 }, // Solid Pyroxeres
    17460: { Pyerite: 99, Mexallon: 33, Nocxium: 6 }, // Viscous Pyroxeres
    46686: { Pyerite: 104, Mexallon: 35, Nocxium: 6 }, // Opulent Pyroxeres
    // Plagioclase variants
    18: { Tritanium: 175, Pyerite: 70, Mexallon: 35 }, // Plagioclase
    17455: { Tritanium: 184, Pyerite: 74, Mexallon: 37 }, // Azure Plagioclase
    17456: { Tritanium: 193, Pyerite: 77, Mexallon: 39 }, // Rich Plagioclase
    46685: { Tritanium: 201, Pyerite: 81, Mexallon: 40 }, // Sparkling Plagioclase
    // Omber variants
    1227: { Tritanium: 85, Pyerite: 34, Isogen: 85 }, // Omber
    17867: { Tritanium: 89, Pyerite: 36, Isogen: 89 }, // Silvery Omber
    17868: { Tritanium: 94, Pyerite: 37, Isogen: 94 }, // Golden Omber
    46684: { Tritanium: 98, Pyerite: 39, Isogen: 98 }, // Platinoid Omber
    // Kernite variants
    20: { Tritanium: 134, Mexallon: 134, Isogen: 134 }, // Kernite
    17452: { Tritanium: 141, Mexallon: 141, Isogen: 141 }, // Luminous Kernite
    17453: { Tritanium: 147, Mexallon: 147, Isogen: 147 }, // Fiery Kernite
    46683: { Tritanium: 154, Mexallon: 154, Isogen: 154 }, // Resplendent Kernite
    // Jaspet variants
    1226: { Mexallon: 150, Nocxium: 50, Zydrine: 8 }, // Jaspet
    17448: { Mexallon: 158, Nocxium: 53, Zydrine: 8 }, // Pure Jaspet
    17449: { Mexallon: 165, Nocxium: 55, Zydrine: 9 }, // Pristine Jaspet
    46682: { Mexallon: 173, Nocxium: 58, Zydrine: 9 }, // Immaculate Jaspet
    // Hemorphite variants
    1231: { Tritanium: 212, Isogen: 212, Nocxium: 106, Zydrine: 16 }, // Hemorphite
    17444: { Tritanium: 223, Isogen: 223, Nocxium: 111, Zydrine: 17 }, // Vivid Hemorphite
    17445: { Tritanium: 233, Isogen: 233, Nocxium: 117, Zydrine: 18 }, // Radiant Hemorphite
    46681: { Tritanium: 244, Isogen: 244, Nocxium: 122, Zydrine: 18 }, // Scintillating Hemorphite
    // Hedbergite variants
    21: { Pyerite: 90, Isogen: 180, Nocxium: 42, Zydrine: 17 }, // Hedbergite
    17440: { Pyerite: 95, Isogen: 189, Nocxium: 44, Zydrine: 18 }, // Vitric Hedbergite
    17441: { Pyerite: 99, Isogen: 198, Nocxium: 46, Zydrine: 19 }, // Glazed Hedbergite
    46680: { Pyerite: 104, Isogen: 207, Nocxium: 48, Zydrine: 20 }, // Lustrous Hedbergite
    // Gneiss variants
    1229: { Tritanium: 171, Mexallon: 171, Isogen: 343, Zydrine: 17 }, // Gneiss
    17865: { Tritanium: 180, Mexallon: 180, Isogen: 360, Zydrine: 18 }, // Iridescent Gneiss
    17866: { Tritanium: 188, Mexallon: 188, Isogen: 377, Zydrine: 19 }, // Prismatic Gneiss
    46679: { Tritanium: 197, Mexallon: 197, Isogen: 394, Zydrine: 20 }, // Brilliant Gneiss
    // Dark Ochre variants
    1232: { Tritanium: 250, Isogen: 500, Nocxium: 50, Zydrine: 25 }, // Dark Ochre
    17436: { Tritanium: 263, Isogen: 525, Nocxium: 53, Zydrine: 26 }, // Onyx Ochre
    17437: { Tritanium: 275, Isogen: 550, Nocxium: 55, Zydrine: 28 }, // Obsidian Ochre
    46678: { Tritanium: 288, Isogen: 575, Nocxium: 58, Zydrine: 29 }, // Jet Ochre
    // Crokite variants
    1225: { Tritanium: 331, Nocxium: 110, Zydrine: 55 }, // Crokite
    17432: { Tritanium: 348, Nocxium: 116, Zydrine: 58 }, // Sharp Crokite
    17433: { Tritanium: 364, Nocxium: 121, Zydrine: 61 }, // Crystalline Crokite
    46677: { Tritanium: 381, Nocxium: 127, Zydrine: 63 }, // Pellucid Crokite
    // Spodumain variants
    19: { Tritanium: 700, Pyerite: 140, Mexallon: 140, Isogen: 28 }, // Spodumain
    17466: { Tritanium: 735, Pyerite: 147, Mexallon: 147, Isogen: 29 }, // Bright Spodumain
    17467: { Tritanium: 770, Pyerite: 154, Mexallon: 154, Isogen: 31 }, // Gleaming Spodumain
    46688: { Tritanium: 805, Pyerite: 161, Mexallon: 161, Isogen: 32 }, // Dazzling Spodumain
    // Bistot variants
    1223: { Pyerite: 170, Zydrine: 34, Megacyte: 17 }, // Bistot
    17428: { Pyerite: 179, Zydrine: 36, Megacyte: 18 }, // Triclinic Bistot
    17429: { Pyerite: 187, Zydrine: 37, Megacyte: 19 }, // Monoclinic Bistot
    46676: { Pyerite: 196, Zydrine: 39, Megacyte: 20 }, // Cubic Bistot
    // Arkonor variants
    22: { Tritanium: 300, Mexallon: 166, Megacyte: 33 }, // Arkonor
    17425: { Tritanium: 315, Mexallon: 174, Megacyte: 35 }, // Crimson Arkonor
    17426: { Tritanium: 330, Mexallon: 183, Megacyte: 36 }, // Prime Arkonor
    46675: { Tritanium: 345, Mexallon: 191, Megacyte: 38 }, // Flawless Arkonor
    // Mercoxit variants
    11396: { Morphite: 140 }, // Mercoxit
    17869: { Morphite: 147 }, // Magma Mercoxit
    17870: { Morphite: 154 }, // Vitreous Mercoxit
    46691: { Morphite: 161 }, // Glowing Mercoxit
  };

  // Helper to calculate minerals from ore (using typeId for authoritative lookup)
  function calculateMinerals(oreName: string, quantity: number, reprocessYield: number = 0.7, typeId?: number): Record<string, number> {
    const minerals: Record<string, number> = {};
    
    // First try typeID-based lookup (authoritative)
    let oreData: Record<string, number> | undefined;
    if (typeId && ORE_TYPE_MINERALS[typeId]) {
      oreData = ORE_TYPE_MINERALS[typeId];
    }
    
    // Fallback to name-based lookup
    if (!oreData) {
      let oreNameLower = oreName.toLowerCase().trim();
      
      // Strip "Compressed" prefix for compressed ore matching
      if (oreNameLower.startsWith("compressed ")) {
        oreNameLower = oreNameLower.substring(11);
      }
      
      // Try exact match (case-insensitive)
      for (const [key, value] of Object.entries(ORE_MINERALS)) {
        if (key.toLowerCase() === oreNameLower) {
          oreData = value;
          break;
        }
      }
      
      // If no exact match, try partial matching
      if (!oreData) {
        const oreWords = oreNameLower.split(/\s+/);
        for (const [key, value] of Object.entries(ORE_MINERALS)) {
          const keyLower = key.toLowerCase();
          if (oreNameLower.includes(keyLower)) {
            oreData = value;
            break;
          }
          const keyLastWord = keyLower.split(/\s+/).pop() || "";
          if (oreWords.includes(keyLastWord)) {
            oreData = value;
            break;
          }
        }
      }
    }
    
    if (!oreData) return minerals;
    
    // Calculate minerals per batch of 100 ore, applying yield
    const batches = quantity / 100;
    for (const [mineral, baseAmount] of Object.entries(oreData)) {
      minerals[mineral] = Math.floor(batches * baseAmount * reprocessYield);
    }
    
    return minerals;
  }

  // Get enhanced mining data with time-based aggregations and Janice pricing
  app.get("/api/mining/valued", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const viewAll = req.query.viewAll === 'true';
      const period = (req.query.period as string) || "daily";
      
      // Build list of characters to fetch data for
      let charactersToFetch: Array<{ characterId: number; accessToken: string }> = [];
      
      if (viewAll) {
        // Get all linked characters
        const primaryCharacterId = req.session.character.characterId;
        const linkedCharacters = await storage.getLinkedCharacters(primaryCharacterId);
        
        // Add primary character
        const primaryChar = await getActiveCharacterInfo(req);
        if (primaryChar) {
          charactersToFetch.push({ characterId: primaryChar.characterId, accessToken: primaryChar.accessToken });
        }
        
        // Add linked characters with refreshed tokens
        for (const linked of linkedCharacters) {
          try {
            const accessToken = await refreshLinkedCharacterToken(linked);
            if (accessToken) {
              charactersToFetch.push({ characterId: linked.characterId, accessToken });
            }
          } catch (err) {
            console.error(`Failed to refresh token for linked character ${linked.characterId}`);
          }
        }
      } else {
        // Just the active character
        const activeChar = await getActiveCharacterInfo(req);
        if (!activeChar) {
          res.status(401).json({ error: "Token refresh failed for active character" });
          return;
        }
        charactersToFetch.push({ characterId: activeChar.characterId, accessToken: activeChar.accessToken });
      }
      
      if (charactersToFetch.length === 0) {
        res.status(401).json({ error: "No characters available" });
        return;
      }
      
      // Fetch mining ledger from ESI for all characters
      let miningLedger: any[] = [];
      for (const char of charactersToFetch) {
        try {
          const response = await fetch(
            `${ESI_BASE_URL}/characters/${char.characterId}/mining/?datasource=tranquility`,
            {
              headers: {
                Authorization: `Bearer ${char.accessToken}`,
              },
            }
          );
          
          if (response.ok) {
            const charLedger = await response.json();
            miningLedger = miningLedger.concat(charLedger);
          } else if (response.status === 403 || response.status === 401) {
            console.log(`Mining scope not granted for character ${char.characterId}`);
          }
        } catch (err) {
          console.error(`Failed to fetch mining ledger for character ${char.characterId}`);
        }
      }
      
      // Return empty data if no mining data (scope not granted for any character)
      if (miningLedger.length === 0) {
        res.json({
          oreBreakdown: [],
          mineralBreakdown: [],
          timeAggregates: {
            hourly: { quantity: 0, value: 0 },
            daily: { quantity: 0, value: 0 },
            weekly: { quantity: 0, value: 0 },
            monthly: { quantity: 0, value: 0 },
            total: { quantity: 0, value: 0 },
          },
          dailyBreakdown: [],
          lastUpdated: new Date().toISOString(),
          viewAll,
        });
        return;
      }
      
      // Get unique type IDs
      const typeIds = Array.from(new Set(miningLedger.map((e: any) => e.type_id))) as number[];
      
      // Fetch type names from ESI (process ALL types, not limited to 50)
      const typeNamePromises = typeIds.map(async (typeId: number) => {
        try {
          const typeResponse = await fetch(
            `${ESI_BASE_URL}/universe/types/${typeId}/?datasource=tranquility&language=en`
          );
          if (typeResponse.ok) {
            const data = await typeResponse.json();
            return { typeId, name: data.name, volume: data.volume || 0, groupId: data.group_id };
          }
          return { typeId, name: `Type ${typeId}`, volume: 0, groupId: 0 };
        } catch {
          return { typeId, name: `Type ${typeId}`, volume: 0, groupId: 0 };
        }
      });
      
      const typeNames = await Promise.all(typeNamePromises);
      const typeNameMap = new Map(typeNames.map(t => [t.typeId, t]));
      
      // Get Janice prices for ores
      const oreItems = typeNames.map(t => ({ typeId: t.typeId, typeName: t.name, quantity: 1 }));
      const janicePrices = await getJanicePrices(oreItems);
      
      // Calculate time-based aggregations
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // Aggregate by ore type (including per-ore mineral yields for client-side filtering)
      const oreBreakdown: Record<number, { 
        typeId: number;
        typeName: string; 
        quantity: number; 
        volume: number;
        sellPrice: number | null;
        buyPrice: number | null;
        totalSellValue: number | null;
        totalBuyValue: number | null;
        mineralYields: Record<string, number>;
      }> = {};
      
      // Aggregate by time periods
      const timeAggregates = {
        hourly: { quantity: 0, value: 0 },
        daily: { quantity: 0, value: 0 },
        weekly: { quantity: 0, value: 0 },
        monthly: { quantity: 0, value: 0 },
        total: { quantity: 0, value: 0 },
      };
      
      // Daily breakdown for chart
      const dailyBreakdown: Record<string, { date: string; quantity: number; value: number; oreTypes: Record<number, number> }> = {};
      
      // Mineral totals
      const mineralTotals: Record<string, number> = {};
      
      for (const entry of miningLedger) {
        const typeInfo = typeNameMap.get(entry.type_id);
        const prices = janicePrices.get(entry.type_id);
        const entryDate = new Date(entry.date);
        const sellPrice = prices?.sell || 0;
        const entryValue = entry.quantity * sellPrice;
        
        // Ore breakdown
        if (!oreBreakdown[entry.type_id]) {
          oreBreakdown[entry.type_id] = {
            typeId: entry.type_id,
            typeName: typeInfo?.name || `Type ${entry.type_id}`,
            quantity: 0,
            volume: typeInfo?.volume || 0,
            sellPrice: prices?.sell || null,
            buyPrice: prices?.buy || null,
            totalSellValue: null,
            totalBuyValue: null,
            mineralYields: {},
          };
        }
        oreBreakdown[entry.type_id].quantity += entry.quantity;
        
        // Calculate per-ore mineral yields (at 100% yield, client will apply yield %)
        if (typeInfo?.name) {
          const oreMinerals = calculateMinerals(typeInfo.name, entry.quantity, 1.0, entry.type_id);
          for (const [mineral, amount] of Object.entries(oreMinerals)) {
            oreBreakdown[entry.type_id].mineralYields[mineral] = 
              (oreBreakdown[entry.type_id].mineralYields[mineral] || 0) + amount;
          }
        }
        
        // Time aggregates
        timeAggregates.total.quantity += entry.quantity;
        timeAggregates.total.value += entryValue;
        
        if (entryDate >= monthAgo) {
          timeAggregates.monthly.quantity += entry.quantity;
          timeAggregates.monthly.value += entryValue;
        }
        if (entryDate >= weekAgo) {
          timeAggregates.weekly.quantity += entry.quantity;
          timeAggregates.weekly.value += entryValue;
        }
        if (entryDate >= dayAgo) {
          timeAggregates.daily.quantity += entry.quantity;
          timeAggregates.daily.value += entryValue;
        }
        if (entryDate >= hourAgo) {
          timeAggregates.hourly.quantity += entry.quantity;
          timeAggregates.hourly.value += entryValue;
        }
        
        // Daily breakdown
        const dateKey = entry.date;
        if (!dailyBreakdown[dateKey]) {
          dailyBreakdown[dateKey] = { date: dateKey, quantity: 0, value: 0, oreTypes: {} };
        }
        dailyBreakdown[dateKey].quantity += entry.quantity;
        dailyBreakdown[dateKey].value += entryValue;
        dailyBreakdown[dateKey].oreTypes[entry.type_id] = (dailyBreakdown[dateKey].oreTypes[entry.type_id] || 0) + entry.quantity;
        
        // Calculate minerals for global totals
        if (typeInfo?.name) {
          const minerals = calculateMinerals(typeInfo.name, entry.quantity, 0.7, entry.type_id);
          for (const [mineral, amount] of Object.entries(minerals)) {
            mineralTotals[mineral] = (mineralTotals[mineral] || 0) + amount;
          }
        }
      }
      
      // Calculate total values for ore breakdown
      for (const ore of Object.values(oreBreakdown)) {
        if (ore.sellPrice !== null) {
          ore.totalSellValue = ore.quantity * ore.sellPrice;
        }
        if (ore.buyPrice !== null) {
          ore.totalBuyValue = ore.quantity * ore.buyPrice;
        }
      }
      
      // Get mineral prices from Janice
      const mineralTypeIds: Record<string, number> = {
        Tritanium: 34,
        Pyerite: 35,
        Mexallon: 36,
        Isogen: 37,
        Nocxium: 38,
        Zydrine: 39,
        Megacyte: 40,
        Morphite: 11399,
      };
      
      const mineralItems = Object.entries(mineralTypeIds).map(([name, typeId]) => ({ 
        typeId, 
        typeName: name, 
        quantity: 1 
      }));
      const mineralPrices = await getJanicePrices(mineralItems);
      
      // Calculate mineral values
      const mineralBreakdown = Object.entries(mineralTotals).map(([name, quantity]) => {
        const typeId = mineralTypeIds[name] || 0;
        const prices = mineralPrices.get(typeId);
        return {
          name,
          typeId,
          quantity,
          sellPrice: prices?.sell || 0,
          buyPrice: prices?.buy || 0,
          totalSellValue: quantity * (prices?.sell || 0),
          totalBuyValue: quantity * (prices?.buy || 0),
        };
      }).sort((a, b) => b.totalSellValue - a.totalSellValue);
      
      const totalMineralValue = mineralBreakdown.reduce((sum, m) => sum + m.totalSellValue, 0);
      
      res.json({
        oreBreakdown: Object.values(oreBreakdown).sort((a, b) => (b.totalSellValue || 0) - (a.totalSellValue || 0)),
        mineralBreakdown,
        timeAggregates,
        dailyBreakdown: Object.values(dailyBreakdown).sort((a, b) => b.date.localeCompare(a.date)),
        summary: {
          totalEntries: miningLedger.length,
          totalQuantity: timeAggregates.total.quantity,
          totalOreValue: timeAggregates.total.value,
          totalMineralValue,
          uniqueOreTypes: Object.keys(oreBreakdown).length,
          uniqueMinerals: Object.keys(mineralTotals).length,
        },
        lastUpdated: new Date().toISOString(),
        priceSource: "Janice",
      });
    } catch (error) {
      console.error("Mining valued error:", error);
      res.status(500).json({ error: "Failed to fetch mining valuations" });
    }
  });

  // Get moon material prices from ESI (public endpoint, no auth required)
  // Used by the Metenox Moon Calculator to fetch current Jita buy prices
  app.get("/api/moon/material-prices", async (req: Request, res: Response) => {
    try {
      // ESI type IDs for moon materials (goo)
      const MATERIAL_TYPE_IDS: Record<string, number> = {
        "Atmospheric Gases": 16634,
        "Evaporite Deposits": 16635,
        "Hydrocarbons": 16633,
        "Silicates": 16636,
        "Cobalt": 16640,
        "Scandium": 16639,
        "Titanium": 16638,
        "Tungsten": 16637,
        "Cadmium": 16643,
        "Chromium": 16641,
        "Platinum": 16644,
        "Vanadium": 16642,
        "Caesium": 16647,
        "Hafnium": 16648,
        "Mercury": 16646,
        "Technetium": 16649,
        "Dysprosium": 16650,
        "Neodymium": 16651,
        "Promethium": 16652,
        "Thulium": 16653,
      };

      // Jita region ID (The Forge)
      const JITA_REGION_ID = 10000002;
      
      // Fetch sell orders for each material in parallel
      const pricePromises = Object.entries(MATERIAL_TYPE_IDS).map(async ([materialName, typeId]) => {
        try {
          const response = await fetch(
            `${ESI_BASE_URL}/markets/${JITA_REGION_ID}/orders/?datasource=tranquility&order_type=sell&type_id=${typeId}`,
            {
              headers: {
                "User-Agent": "PHOTON EVE Income Tracker",
              },
            }
          );
          
          if (!response.ok) {
            console.warn(`Failed to fetch price for ${materialName} (${typeId}): ${response.status}`);
            return { material: materialName, price: 0 };
          }
          
          const orders = await response.json();
          
          // Find the lowest sell price (market price for valuation)
          let minSellPrice = Infinity;
          for (const order of orders) {
            if (order.price < minSellPrice) {
              minSellPrice = order.price;
            }
          }
          
          return { material: materialName, price: minSellPrice === Infinity ? 0 : minSellPrice };
        } catch (error) {
          console.warn(`Error fetching price for ${materialName}:`, error);
          return { material: materialName, price: 0 };
        }
      });
      
      const priceResults = await Promise.all(pricePromises);
      
      // Convert to object format
      const prices: Record<string, number> = {};
      for (const result of priceResults) {
        prices[result.material] = result.price;
      }
      
      res.json({
        prices,
        source: "ESI Jita Sell Orders",
        fetchedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Moon material prices error:", error);
      res.status(500).json({ error: "Failed to fetch moon material prices" });
    }
  });

  // Get user's saved moons
  app.get("/api/moon/data", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    
    try {
      const characterId = req.session.character.characterId;
      const moons = await storage.getUserMoons(characterId);
      const prices = await storage.getUserMoonPrices(characterId);
      
      res.json({
        moons,
        prices: prices?.prices || null,
        pricesLastUpdated: prices?.lastUpdated || null,
      });
    } catch (error) {
      console.error("Get moon data error:", error);
      res.status(500).json({ error: "Failed to get moon data" });
    }
  });

  // Create a new moon
  app.post("/api/moon/data", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    
    try {
      const characterId = req.session.character.characterId;
      const { moonName, systemName, ores, notes } = req.body;
      
      if (!moonName || !systemName || !ores) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }
      
      const moon = await storage.createUserMoon({
        characterId,
        moonName,
        systemName,
        ores,
        notes: notes || null,
        isFavorite: false,
      });
      
      res.json(moon);
    } catch (error) {
      console.error("Create moon error:", error);
      res.status(500).json({ error: "Failed to create moon" });
    }
  });

  // Update a moon (notes, favorite)
  app.patch("/api/moon/data/:moonId", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    
    try {
      const characterId = req.session.character.characterId;
      const { moonId } = req.params;
      const { notes, isFavorite } = req.body;
      
      const updates: { notes?: string; isFavorite?: boolean } = {};
      if (notes !== undefined) updates.notes = notes;
      if (isFavorite !== undefined) updates.isFavorite = isFavorite;
      
      const moon = await storage.updateUserMoon(moonId, characterId, updates);
      
      if (!moon) {
        res.status(404).json({ error: "Moon not found" });
        return;
      }
      
      res.json(moon);
    } catch (error) {
      console.error("Update moon error:", error);
      res.status(500).json({ error: "Failed to update moon" });
    }
  });

  // Delete a moon
  app.delete("/api/moon/data/:moonId", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    
    try {
      const characterId = req.session.character.characterId;
      const { moonId } = req.params;
      
      const deleted = await storage.deleteUserMoon(moonId, characterId);
      
      if (!deleted) {
        res.status(404).json({ error: "Moon not found" });
        return;
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Delete moon error:", error);
      res.status(500).json({ error: "Failed to delete moon" });
    }
  });

  // Save user's custom prices
  app.post("/api/moon/prices", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    
    try {
      const characterId = req.session.character.characterId;
      const { prices } = req.body;
      
      if (!prices || typeof prices !== 'object') {
        res.status(400).json({ error: "Invalid prices data" });
        return;
      }
      
      const saved = await storage.saveUserMoonPrices(characterId, prices);
      
      res.json({
        prices: saved.prices,
        lastUpdated: saved.lastUpdated,
      });
    } catch (error) {
      console.error("Save moon prices error:", error);
      res.status(500).json({ error: "Failed to save moon prices" });
    }
  });

  // ============================================
  // INDUSTRY JOBS ENDPOINTS
  // Feature inspired by EVE Guru and EVE Cookbook
  // ============================================

  // Activity ID mappings for EVE Online industry
  const INDUSTRY_ACTIVITIES: Record<number, string> = {
    1: "Manufacturing",
    3: "Researching Time Efficiency",
    4: "Researching Material Efficiency",
    5: "Copying",
    7: "Reverse Engineering",
    8: "Invention",
    9: "Reactions",
    11: "Reactions",
  };

  // Get industry jobs for active character (or all characters if viewAll=true)
  app.get("/api/industry/jobs", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const viewAll = req.query.viewAll === 'true';
      const status = req.query.status as string | undefined;
      const activityId = req.query.activityId ? parseInt(req.query.activityId as string) : undefined;
      
      if (viewAll) {
        // Get all linked character IDs
        const primaryCharacterId = req.session.character.characterId;
        const linkedCharacters = await storage.getLinkedCharacters(primaryCharacterId);
        const allCharacterIds = [primaryCharacterId, ...linkedCharacters.map(lc => lc.characterId)];
        
        const jobs = await storage.getIndustryJobsForCharacters(allCharacterIds, { status, activityId });
        res.json({ jobs, characterIds: allCharacterIds });
      } else {
        // Get active character only
        const activeChar = await getActiveCharacterInfo(req);
        if (!activeChar) {
          res.status(401).json({ error: "Token refresh failed" });
          return;
        }
        
        const jobs = await storage.getIndustryJobs(activeChar.characterId, { status, activityId });
        res.json({ jobs, characterId: activeChar.characterId });
      }
    } catch (error) {
      console.error("Get industry jobs error:", error);
      res.status(500).json({ error: "Failed to get industry jobs" });
    }
  });

  // Fetch industry jobs from ESI and sync to database
  app.post("/api/industry/sync", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const viewAll = req.query.viewAll === 'true';
      const includeCompleted = req.query.includeCompleted === 'true';
      
      const syncCharacter = async (characterId: number, characterName: string, accessToken: string) => {
        // Fetch jobs from ESI
        const esiUrl = `${ESI_BASE_URL}/characters/${characterId}/industry/jobs/?datasource=tranquility&include_completed=${includeCompleted}`;
        const esiRes = await fetch(esiUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!esiRes.ok) {
          if (esiRes.status === 403) {
            console.log(`Industry scope not granted for character ${characterId}`);
            return { characterId, success: false, reason: 'scope_not_granted' };
          }
          console.error(`ESI error for industry jobs:`, await esiRes.text());
          return { characterId, success: false, reason: 'esi_error' };
        }

        const esiJobs = await esiRes.json() as any[];
        
        // Get type names for blueprints and products
        const typeIds = new Set<number>();
        for (const job of esiJobs) {
          typeIds.add(job.blueprint_type_id);
          if (job.product_type_id) typeIds.add(job.product_type_id);
        }

        const typeNames = await Promise.all(
          Array.from(typeIds).map(async (typeId) => {
            try {
              const typeRes = await fetch(`${ESI_BASE_URL}/universe/types/${typeId}/?datasource=tranquility`);
              if (typeRes.ok) {
                const data = await typeRes.json();
                return { typeId, name: data.name };
              }
            } catch (e) {
              console.error(`Failed to get type name for ${typeId}`);
            }
            return { typeId, name: `Type ${typeId}` };
          })
        );
        const typeNameMap = new Map(typeNames.map(t => [t.typeId, t.name]));

        // Transform and save jobs
        const jobsToSave = esiJobs.map(job => ({
          characterId,
          characterName,
          jobId: job.job_id,
          activityId: job.activity_id,
          blueprintId: job.blueprint_id,
          blueprintTypeId: job.blueprint_type_id,
          blueprintTypeName: typeNameMap.get(job.blueprint_type_id) || `Type ${job.blueprint_type_id}`,
          productTypeId: job.product_type_id || null,
          productTypeName: job.product_type_id ? (typeNameMap.get(job.product_type_id) || null) : null,
          facilityId: job.facility_id || null,
          stationId: job.station_id || null,
          locationName: null, // Could be fetched from ESI if needed
          runs: job.runs,
          licensedRuns: job.licensed_runs || null,
          probability: job.probability || null,
          successfulRuns: job.successful_runs || null,
          startDate: new Date(job.start_date),
          endDate: new Date(job.end_date),
          completedDate: job.completed_date ? new Date(job.completed_date) : null,
          status: job.status,
          cost: job.cost || null,
          materialCost: null, // To be calculated with market prices
          outputValue: null, // To be calculated with market prices
          estimatedProfit: null,
          iskPerHour: null,
        }));

        await storage.upsertIndustryJobs(jobsToSave);
        
        // Remove stale jobs
        const currentJobIds = esiJobs.map((j: any) => j.job_id);
        await storage.deleteStaleIndustryJobs(characterId, currentJobIds);

        return { characterId, success: true, jobCount: esiJobs.length };
      };

      let results: any[] = [];

      if (viewAll) {
        // Sync all linked characters
        const primaryCharacterId = req.session.character.characterId;
        const linkedCharacters = await storage.getLinkedCharacters(primaryCharacterId);
        
        // Sync primary character
        const primaryToken = await refreshTokenIfNeeded(req);
        if (primaryToken) {
          results.push(await syncCharacter(
            primaryCharacterId,
            req.session.character.characterName,
            primaryToken
          ));
        }

        // Sync linked characters
        for (const linked of linkedCharacters) {
          try {
            const linkedToken = await refreshLinkedCharacterToken(linked);
            if (linkedToken) {
              results.push(await syncCharacter(linked.characterId, linked.characterName, linkedToken));
            }
          } catch (err) {
            console.error(`Failed to sync linked character ${linked.characterId}:`, err);
            results.push({ characterId: linked.characterId, success: false, reason: 'token_error' });
          }
        }
      } else {
        // Sync active character only
        const activeChar = await getActiveCharacterInfo(req);
        if (!activeChar) {
          res.status(401).json({ error: "Token refresh failed" });
          return;
        }
        
        results.push(await syncCharacter(activeChar.characterId, activeChar.characterName, activeChar.accessToken));
      }

      res.json({ success: true, results });
    } catch (error) {
      console.error("Sync industry jobs error:", error);
      res.status(500).json({ error: "Failed to sync industry jobs" });
    }
  });

  // Get industry job statistics
  app.get("/api/industry/stats", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const viewAll = req.query.viewAll === 'true';
      
      if (viewAll) {
        // Aggregate stats across all characters
        const primaryCharacterId = req.session.character.characterId;
        const linkedCharacters = await storage.getLinkedCharacters(primaryCharacterId);
        const allCharacterIds = [primaryCharacterId, ...linkedCharacters.map(lc => lc.characterId)];
        
        const allStats = await Promise.all(allCharacterIds.map(id => storage.getIndustryJobStats(id)));
        
        const aggregated = allStats.reduce((acc, stats) => ({
          activeJobs: acc.activeJobs + stats.activeJobs,
          completedToday: acc.completedToday + stats.completedToday,
          totalProfit: acc.totalProfit + stats.totalProfit,
          avgIskPerHour: acc.avgIskPerHour + stats.avgIskPerHour,
        }), { activeJobs: 0, completedToday: 0, totalProfit: 0, avgIskPerHour: 0 });
        
        // Average the ISK/hr across characters with data
        const charsWithData = allStats.filter(s => s.avgIskPerHour > 0).length;
        if (charsWithData > 0) {
          aggregated.avgIskPerHour = aggregated.avgIskPerHour / charsWithData;
        }
        
        res.json(aggregated);
      } else {
        const activeChar = await getActiveCharacterInfo(req);
        if (!activeChar) {
          res.status(401).json({ error: "Token refresh failed" });
          return;
        }
        
        const stats = await storage.getIndustryJobStats(activeChar.characterId);
        res.json(stats);
      }
    } catch (error) {
      console.error("Get industry stats error:", error);
      res.status(500).json({ error: "Failed to get industry stats" });
    }
  });

  // Calculate profitability for a job using market prices
  app.post("/api/industry/calculate-profit", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const { productTypeId, productQuantity, materialCost, installationCost } = req.body;
      
      if (!productTypeId || !productQuantity) {
        res.status(400).json({ error: "Product type ID and quantity required" });
        return;
      }

      // Get Jita sell price for the product
      const priceRes = await fetch(
        `${ESI_BASE_URL}/markets/10000002/orders/?datasource=tranquility&order_type=sell&type_id=${productTypeId}`
      );
      
      let sellPrice = 0;
      if (priceRes.ok) {
        const orders = await priceRes.json() as any[];
        // Get lowest sell price (Jita 4-4)
        const jitaOrders = orders.filter((o: any) => o.location_id === 60003760);
        if (jitaOrders.length > 0) {
          sellPrice = Math.min(...jitaOrders.map((o: any) => o.price));
        } else if (orders.length > 0) {
          sellPrice = Math.min(...orders.map((o: any) => o.price));
        }
      }

      const outputValue = sellPrice * productQuantity;
      const totalCost = (materialCost || 0) + (installationCost || 0);
      const estimatedProfit = outputValue - totalCost;

      res.json({
        productTypeId,
        productQuantity,
        sellPrice,
        outputValue,
        materialCost: materialCost || 0,
        installationCost: installationCost || 0,
        totalCost,
        estimatedProfit,
        profitMargin: totalCost > 0 ? ((estimatedProfit / totalCost) * 100).toFixed(2) : '0.00',
      });
    } catch (error) {
      console.error("Calculate profit error:", error);
      res.status(500).json({ error: "Failed to calculate profit" });
    }
  });

  // ============================================
  // ASSETS ENDPOINTS
  // ============================================

  // Get character assets from ESI
  // ESI scope required: esi-assets.read_assets.v1
  app.get("/api/assets", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const viewAll = req.query.viewAll === 'true';
      
      interface ESIAsset {
        item_id: number;
        type_id: number;
        location_id: number;
        location_flag: string;
        location_type: string;
        quantity: number;
        is_singleton: boolean;
        is_blueprint_copy?: boolean;
      }

      interface AssetWithDetails extends ESIAsset {
        characterId: number;
        characterName: string;
        typeName?: string;
        locationName?: string;
      }

      const fetchAssetsForCharacter = async (
        characterId: number,
        characterName: string,
        accessToken: string
      ): Promise<AssetWithDetails[]> => {
        const allAssets: ESIAsset[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          const response = await fetch(
            `${ESI_BASE_URL}/characters/${characterId}/assets/?datasource=tranquility&page=${page}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

          if (!response.ok) {
            if (response.status === 403) {
              console.warn(`Missing assets scope for character ${characterId}`);
              return [];
            }
            throw new Error(`Failed to fetch assets: ${response.status}`);
          }

          const assets = await response.json() as ESIAsset[];
          allAssets.push(...assets);

          // Check X-Pages header for pagination
          const totalPages = parseInt(response.headers.get('X-Pages') || '1');
          hasMore = page < totalPages;
          page++;
        }

        return allAssets.map(asset => ({
          ...asset,
          characterId,
          characterName,
        }));
      };

      let allAssets: AssetWithDetails[] = [];
      const characterIds: number[] = [];

      if (viewAll) {
        const primaryCharacterId = req.session.character.characterId;
        const primaryCharacterName = req.session.character.characterName;
        const linkedCharacters = await storage.getLinkedCharacters(primaryCharacterId);
        
        // Fetch for primary character
        const primaryToken = await refreshTokenIfNeeded(req);
        if (primaryToken) {
          const primaryAssets = await fetchAssetsForCharacter(
            primaryCharacterId,
            primaryCharacterName,
            primaryToken
          );
          allAssets.push(...primaryAssets);
          characterIds.push(primaryCharacterId);
        }

        // Fetch for linked characters
        for (const linked of linkedCharacters) {
          const token = await refreshLinkedCharacterToken(linked);
          if (token) {
            const assets = await fetchAssetsForCharacter(
              linked.characterId,
              linked.characterName,
              token
            );
            allAssets.push(...assets);
            characterIds.push(linked.characterId);
          }
        }
      } else {
        const activeChar = await getActiveCharacterInfo(req);
        if (!activeChar) {
          // Check if using dev-mode token
          if (req.session.character?.accessToken === "dev-mode-token") {
            res.status(401).json({
              error: "Dev mode cannot access ESI",
              message: "Please log out and use 'Real EVE SSO' login to access assets data"
            });
            return;
          }
          res.status(401).json({ error: "Token refresh failed" });
          return;
        }

        allAssets = await fetchAssetsForCharacter(
          activeChar.characterId,
          activeChar.characterName,
          activeChar.accessToken
        );
        characterIds.push(activeChar.characterId);
      }

      // Get unique type IDs and location IDs for name resolution
      const typeIds = Array.from(new Set(allAssets.map(a => a.type_id)));
      const locationIds = Array.from(new Set(allAssets.map(a => a.location_id)));

      // Resolve type names using batched POST /universe/names (up to 1000 IDs per request)
      const typeNameMap = new Map<number, string>();
      const batchSize = 500; // ESI limit for /universe/names
      for (let i = 0; i < typeIds.length; i += batchSize) {
        const batch = typeIds.slice(i, i + batchSize);
        try {
          const response = await fetch(
            `${ESI_BASE_URL}/universe/names/?datasource=tranquility`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(batch),
            }
          );
          if (response.ok) {
            const names = await response.json() as { id: number; name: string; category: string }[];
            names.forEach(n => typeNameMap.set(n.id, n.name));
          }
        } catch (error) {
          console.warn('Failed to resolve type names batch:', error);
          // Fall back to basic names for this batch
          batch.forEach(id => {
            if (!typeNameMap.has(id)) {
              typeNameMap.set(id, `Type ${id}`);
            }
          });
        }
      }

      // Resolve location names (stations, structures, solar systems)
      const locationNameMap = new Map<number, string>();
      
      // Categorize location IDs by type based on EVE ID ranges:
      // Solar systems: 30000000-32000000
      // Stations: 60000000-64000000
      // Player structures: >= 1000000000000
      // Items (ships/containers): other high values
      const solarSystemIds = locationIds.filter(id => id >= 30000000 && id < 33000000);
      const stationIds = locationIds.filter(id => id >= 60000000 && id < 64000000);
      const structureIds = locationIds.filter(id => id >= 1000000000000);
      const itemIds = locationIds.filter(id => 
        (id < 30000000 || (id >= 33000000 && id < 60000000) || (id >= 64000000 && id < 1000000000000))
      );

      // Batch resolve solar systems and stations via /universe/names/
      const resolvableIds = [...solarSystemIds, ...stationIds];
      for (let i = 0; i < resolvableIds.length; i += batchSize) {
        const batch = resolvableIds.slice(i, i + batchSize);
        if (batch.length === 0) continue;
        try {
          const response = await fetch(
            `${ESI_BASE_URL}/universe/names/?datasource=tranquility`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(batch),
            }
          );
          if (response.ok) {
            const names = await response.json() as { id: number; name: string; category: string }[];
            names.forEach(n => locationNameMap.set(n.id, n.name));
          }
        } catch (error) {
          console.warn('Failed to resolve location names batch:', error);
        }
      }

      // Fetch ESI market prices now — before structure name lookups consume the ESI error budget.
      // /markets/prices/ is a public bulk endpoint (no auth, one request, all items).
      const priceMap = new Map<number, number>();
      try {
        const priceResponse = await fetch(`${ESI_BASE_URL}/markets/prices/?datasource=tranquility`);
        if (priceResponse.ok) {
          const prices = await priceResponse.json() as { type_id: number; average_price?: number; adjusted_price?: number }[];
          for (const p of prices) {
            const price = p.adjusted_price || p.average_price || 0;
            if (price > 0) priceMap.set(p.type_id, price);
          }
          console.log(`[Assets] Fetched ${prices.length} ESI market prices, mapped ${priceMap.size} non-zero prices`);
        } else {
          console.warn(`[Assets] Failed to fetch market prices: ${priceResponse.status}`);
        }
      } catch (err) {
        console.warn('[Assets] Error fetching market prices:', err);
      }

      // Fetch structure names (requires auth) - these are player-owned citadels
      // First check cache for any previously resolved structure names (per-character for privacy)
      const currentCharacterId = req.session.character!.characterId;

      if (structureIds.length > 0) {
        let cachedNames = new Map<number, { name: string; category: string }>();
        try {
          cachedNames = await storage.getEsiNames(currentCharacterId, structureIds);
          cachedNames.forEach((value, id) => {
            locationNameMap.set(id, value.name);
          });
        } catch (cacheError) {
          console.warn("Failed to fetch cached ESI names, continuing without cache:", cacheError);
        }

        // Only fetch from ESI for structures not in cache
        const uncachedStructureIds = structureIds.filter(id => !cachedNames.has(id));

        if (uncachedStructureIds.length > 0) {
          // Build a map of structure IDs to characters who have assets there
          // This helps us use the right token for each structure
          const structureToCharacters = new Map<number, Set<number>>();
          for (const asset of allAssets) {
            if (asset.location_id >= 1000000000000) {
              if (!structureToCharacters.has(asset.location_id)) {
                structureToCharacters.set(asset.location_id, new Set());
              }
              structureToCharacters.get(asset.location_id)!.add(asset.characterId);
            }
          }

          // Build character token map for all characters we have assets for
          const characterTokens = new Map<number, string>();
          const primaryToken = await refreshTokenIfNeeded(req);
          if (primaryToken) {
            characterTokens.set(currentCharacterId, primaryToken);
          }

          // Always collect linked character tokens for structure name resolution —
          // a different character may have docking access even when not in viewAll mode
          const linkedCharactersForNames = await storage.getLinkedCharacters(currentCharacterId);
          for (const linked of linkedCharactersForNames) {
            if (!linked.isActive) continue;
            const token = await refreshLinkedCharacterToken(linked);
            if (token) {
              characterTokens.set(linked.characterId, token);
            }
          }

          console.log(`[Assets] Resolving ${uncachedStructureIds.length} structure names using ${characterTokens.size} character tokens...`);

          // Log scopes on the primary token once so we can diagnose 403 issues
          const primaryTokenForScope = characterTokens.get(currentCharacterId);
          if (primaryTokenForScope) {
            try {
              const payload = JSON.parse(Buffer.from(primaryTokenForScope.split('.')[1], 'base64').toString());
              const scopes: string[] = Array.isArray(payload.scp) ? payload.scp : (payload.scp || payload.scope || '').split(' ');
              const hasStructureScope = scopes.some((s: string) => s.includes('read_structures'));
              console.log(`[Assets] Token scopes include read_structures: ${hasStructureScope}. All scopes: ${scopes.join(', ')}`);
              if (!hasStructureScope) {
                console.log('[Assets] WARNING: esi-universe.read_structures.v1 scope missing - user must log out and re-authenticate');
              }
            } catch {}
          }

          const newlyCached: { id: number; name: string; category: string }[] = [];
          let loggedFirstForbidden = false;

          // Process in batches of 20 to avoid rate limiting
          for (let i = 0; i < uncachedStructureIds.length; i += 20) {
            const batch = uncachedStructureIds.slice(i, i + 20);
            const structurePromises = batch.map(async (structureId) => {
              // Get characters who have assets in this structure
              const charactersWithAssets = structureToCharacters.get(structureId);

              // Try each character's token until one succeeds
              const tokensToTry: string[] = [];
              if (charactersWithAssets) {
                for (const charId of charactersWithAssets) {
                  const token = characterTokens.get(charId);
                  if (token) tokensToTry.push(token);
                }
              }
              // Also try other tokens as fallback
              for (const token of characterTokens.values()) {
                if (!tokensToTry.includes(token)) {
                  tokensToTry.push(token);
                }
              }

              for (const token of tokensToTry) {
                try {
                  const response = await fetch(
                    `${ESI_BASE_URL}/universe/structures/${structureId}/?datasource=tranquility`,
                    {
                      headers: {
                        Authorization: `Bearer ${token}`,
                      },
                    }
                  );
                  if (response.ok) {
                    const data = await response.json() as { name: string; solar_system_id?: number };
                    console.log(`[Assets] Structure ${structureId}: Resolved as "${data.name}"`);
                    return { id: structureId, name: data.name, shouldCache: true };
                  } else if (response.status === 403) {
                    if (!loggedFirstForbidden) {
                      loggedFirstForbidden = true;
                      const body = await response.text();
                      console.log(`[Assets] Structure ${structureId}: 403 Forbidden - ESI says: ${body}`);
                    }
                    // 403 means this token doesn't have access, try next
                  } else {
                    console.log(`[Assets] Structure ${structureId}: HTTP ${response.status}, trying next token`);
                  }
                } catch (err) {
                  console.warn(`[Assets] Structure ${structureId} fetch error:`, err);
                }
              }

              // All tokens failed — use ID-based fallback and cache so we skip next time
              const idSuffix = String(structureId).slice(-6);
              console.log(`[Assets] Structure ${structureId}: No tokens have access (tried ${tokensToTry.length})`);
              return { id: structureId, name: `Unknown Structure (…${idSuffix})`, shouldCache: true };
            });
            const results = await Promise.all(structurePromises);
            results.forEach(r => {
              if (r.name) {
                locationNameMap.set(r.id, r.name);
                // Cache successfully fetched names for future use (per-character)
                if (r.shouldCache) {
                  newlyCached.push({ id: r.id, name: r.name, category: 'structure' });
                }
              }
            });
          }

          console.log(`[Assets] Resolved ${newlyCached.length} structure names successfully`);

          // Save to cache (per-character for privacy compliance)
          if (newlyCached.length > 0) {
            try {
              await storage.cacheEsiNames(currentCharacterId, newlyCached);
            } catch (cacheError) {
              console.warn("Failed to cache ESI names:", cacheError);
            }
          }
        }
      }

      // For item IDs (ships/containers), look them up to get the item type name
      // These are assets stored inside other assets (like items in a ship's cargo)
      for (const itemId of itemIds) {
        // Check if this item_id corresponds to one of the assets we fetched
        const parentAsset = allAssets.find(a => a.item_id === itemId);
        if (parentAsset) {
          const typeName = typeNameMap.get(parentAsset.type_id);
          if (typeName) {
            locationNameMap.set(itemId, typeName);
          }
        }
      }

      // Helper to generate descriptive fallback names
      const getLocationFallback = (id: number): string => {
        if (id >= 30000000 && id < 33000000) return `Solar System`;
        if (id >= 60000000 && id < 64000000) return `Station`;
        if (id >= 1000000000000) return `Player Structure`;
        return `Container/Ship`;
      };

      // Add names to assets
      const assetsWithNames = allAssets.map(asset => ({
        ...asset,
        typeName: typeNameMap.get(asset.type_id) || `Type ${asset.type_id}`,
        locationName: locationNameMap.get(asset.location_id) || getLocationFallback(asset.location_id),
      }));

      // Build a map of item_id -> asset for quick lookup
      const assetByItemId = new Map<number, typeof assetsWithNames[0]>();
      for (const asset of assetsWithNames) {
        assetByItemId.set(asset.item_id, asset);
      }

      // First, identify all Asset Safety wrap container IDs so we can skip items inside them
      const assetSafetyWrapIds = new Set<number>();
      for (const asset of allAssets) {
        if (asset.location_flag === 'AssetSafety') {
          assetSafetyWrapIds.add(asset.item_id);
        }
      }

      // Build parent-child relationships
      // Key = parent item_id, Value = array of child assets
      const childrenByParentId = new Map<number, typeof assetsWithNames>();
      for (const asset of assetsWithNames) {
        // Skip Asset Safety items
        if (asset.location_flag === 'AssetSafety' || assetSafetyWrapIds.has(asset.location_id)) {
          continue;
        }
        // If location_type is 'item', this asset is inside another asset (ship/container)
        if (asset.location_type === 'item') {
          const parentId = asset.location_id;
          if (!childrenByParentId.has(parentId)) {
            childrenByParentId.set(parentId, []);
          }
          childrenByParentId.get(parentId)!.push(asset);
        }
      }

      // Function to trace an asset up to its root station/structure
      const getRootLocation = (asset: typeof assetsWithNames[0]): { locationId: number; locationName: string; locationType: string } | null => {
        let current = asset;
        const visited = new Set<number>();

        while (current.location_type === 'item') {
          // Prevent infinite loops
          if (visited.has(current.location_id)) {
            return null;
          }
          visited.add(current.location_id);

          const parent = assetByItemId.get(current.location_id);
          if (!parent) {
            // Parent not found - might be in a structure we can't see
            return null;
          }
          current = parent;
        }

        // Now current should be at a station/structure
        return {
          locationId: current.location_id,
          locationName: current.locationName || getLocationFallback(current.location_id),
          locationType: current.location_type,
        };
      };

      // Helper to check if an asset is a ship or container that can hold items
      const isShipOrContainer = (asset: typeof assetsWithNames[0]): boolean => {
        return childrenByParentId.has(asset.item_id);
      };

      // Type for assets with nested contents
      type AssetWithContents = typeof assetsWithNames[0] & {
        contents?: AssetWithContents[];
        fittedModules?: AssetWithContents[];
        isContainer?: boolean;
        isShip?: boolean;
        isFitted?: boolean;
        slotType?: string;
        fittingStats?: {
          highSlots: number;
          medSlots: number;
          lowSlots: number;
          rigSlots: number;
          drones: number;
          cargo: number;
        };
      };

      // Helper to check if a location_flag indicates a fitted module
      const isFittedSlot = (flag: string): boolean => {
        return flag.startsWith('HiSlot') || flag.startsWith('MedSlot') ||
               flag.startsWith('LoSlot') || flag.startsWith('RigSlot') ||
               flag.startsWith('SubSystem');
      };

      // Group by location for easier display
      const groupedByLocation: Record<string, {
        locationId: number;
        locationName: string;
        locationType: string;
        items: AssetWithContents[];
        totalItems: number;
      }> = {};

      // Valid flags for items to show at station level
      const validStationFlags = new Set([
        'Hangar', 'Cargo', 'FleetHangar', 'CorpSAG1', 'CorpSAG2', 'CorpSAG3',
        'CorpSAG4', 'CorpSAG5', 'CorpSAG6', 'CorpSAG7', 'Deliveries',
        'ShipHangar', 'StructureActive'
      ]);

      const isValidFlag = (flag: string): boolean => {
        if (validStationFlags.has(flag)) return true;
        if (flag.startsWith('HiSlot') || flag.startsWith('MedSlot') ||
            flag.startsWith('LoSlot') || flag.startsWith('RigSlot') ||
            flag.startsWith('SubSystem') || flag.startsWith('Implant') ||
            flag.startsWith('Skill')) return true;
        return false;
      };

      // Helper to check if a location_flag is a fitted module slot (not cargo/drones)
      const isFittedModuleSlot = (flag: string): boolean => {
        return flag.startsWith('HiSlot') || flag.startsWith('MedSlot') ||
               flag.startsWith('LoSlot') || flag.startsWith('RigSlot') ||
               flag.startsWith('SubSystem');
      };

      // Get slot type from location_flag for display
      const getSlotType = (flag: string): string | undefined => {
        if (flag.startsWith('HiSlot')) return 'high';
        if (flag.startsWith('MedSlot')) return 'med';
        if (flag.startsWith('LoSlot')) return 'low';
        if (flag.startsWith('RigSlot')) return 'rig';
        if (flag.startsWith('SubSystem')) return 'subsystem';
        return undefined;
      };

      // Build contents recursively for a container/ship and calculate fitting stats
      const buildContents = (parentId: number): { contents: AssetWithContents[]; fittedModules: AssetWithContents[]; fittingStats: AssetWithContents['fittingStats']; isShip: boolean } => {
        const children = childrenByParentId.get(parentId);
        if (!children) return { contents: [], fittedModules: [], fittingStats: undefined, isShip: false };

        let highSlots = 0, medSlots = 0, lowSlots = 0, rigSlots = 0, drones = 0, cargo = 0;
        let hasDroneBay = false;
        let hasShipSlots = false;

        // First pass: count fitting stats
        for (const child of children) {
          if (child.location_flag.startsWith('HiSlot')) { highSlots++; hasShipSlots = true; }
          else if (child.location_flag.startsWith('MedSlot')) { medSlots++; hasShipSlots = true; }
          else if (child.location_flag.startsWith('LoSlot')) { lowSlots++; hasShipSlots = true; }
          else if (child.location_flag.startsWith('RigSlot')) { rigSlots++; hasShipSlots = true; }
          else if (child.location_flag.startsWith('SubSystem')) { hasShipSlots = true; }
          else if (child.location_flag === 'DroneBay') { drones += child.quantity; hasDroneBay = true; }
          else if (child.location_flag === 'FighterBay' || child.location_flag.startsWith('FighterTube')) { hasDroneBay = true; }
          else if (child.location_flag === 'Cargo') cargo++;
        }

        // Build fitted modules list (separate from cargo contents)
        const fittedModules = children
          .filter(child => isFittedModuleSlot(child.location_flag))
          .map(child => ({
            ...child,
            slotType: getSlotType(child.location_flag),
          }));

        // Build cargo contents (excluding fitted modules)
        const mappedContents = children
          .filter(child => !isFittedModuleSlot(child.location_flag))
          .map(child => {
            const { contents: nestedContents, fittedModules: nestedFitted } = buildContents(child.item_id);
            return {
              ...child,
              contents: nestedContents.length > 0 ? nestedContents : undefined,
              isContainer: nestedContents.length > 0,
            };
          });

        const hasFitting = highSlots > 0 || medSlots > 0 || lowSlots > 0 || rigSlots > 0;
        const fittingStats = hasFitting ? { highSlots, medSlots, lowSlots, rigSlots, drones, cargo } : undefined;

        // It's a ship if it has fitted modules, ship slots, or drone bay
        const isShip = hasShipSlots || hasDroneBay;

        return { contents: mappedContents, fittedModules, fittingStats, isShip };
      };

      for (const asset of assetsWithNames) {
        // Skip Asset Safety items entirely (wraps and items inside wraps)
        if (asset.location_flag === 'AssetSafety' || assetSafetyWrapIds.has(asset.location_id)) {
          continue;
        }

        // Skip items that are inside other items - they'll be shown as contents
        if (asset.location_type === 'item') {
          continue;
        }

        // Only show items with valid flags
        if (!isValidFlag(asset.location_flag)) {
          continue;
        }

        const locKey = `${asset.location_id}`;
        if (!groupedByLocation[locKey]) {
          groupedByLocation[locKey] = {
            locationId: asset.location_id,
            locationName: asset.locationName || `Location ${asset.location_id}`,
            locationType: asset.location_type,
            items: [],
            totalItems: 0,
          };
        }

        // Build this item with its contents if it's a ship/container
        const { contents, fittedModules, fittingStats, isShip } = buildContents(asset.item_id);
        const isFitted = fittingStats !== undefined;
        const hasContentsOrFitting = contents.length > 0 || fittedModules.length > 0;
        const assetWithContents: AssetWithContents = {
          ...asset,
          contents: contents.length > 0 ? contents : undefined,
          fittedModules: fittedModules.length > 0 ? fittedModules : undefined,
          isContainer: hasContentsOrFitting,
          isShip,
          isFitted,
          fittingStats,
        };

        groupedByLocation[locKey].items.push(assetWithContents);
        groupedByLocation[locKey].totalItems++;
      }

      // Also handle items inside ships/containers that aren't at a station
      // (e.g., ships in space with cargo) - trace them to their root location
      for (const asset of assetsWithNames) {
        // Skip Asset Safety items
        if (asset.location_flag === 'AssetSafety' || assetSafetyWrapIds.has(asset.location_id)) {
          continue;
        }

        // Only process top-level ships/containers that are in 'item' location
        // but whose parent isn't in our asset list (orphaned containers)
        if (asset.location_type === 'item' && !assetByItemId.has(asset.location_id)) {
          // Group by parent location_id — each missing container gets its own group.
          // Also check if the location_id is actually a known station/structure (ESI data quirk).
          const locKey = `orphan_${asset.location_id}`;
          if (!groupedByLocation[locKey]) {
            const knownLocationName = locationNameMap.get(asset.location_id);
            const idSuffix = String(asset.location_id).slice(-6);
            groupedByLocation[locKey] = {
              locationId: asset.location_id,
              locationName: knownLocationName || `Unknown Container (…${idSuffix})`,
              locationType: knownLocationName ? 'station' : 'other',
              items: [],
              totalItems: 0,
            };
          }

          const { contents, fittedModules, fittingStats, isShip } = buildContents(asset.item_id);
          const isFitted = fittingStats !== undefined;
          const hasContentsOrFitting = contents.length > 0 || fittedModules.length > 0;
          const assetWithContents: AssetWithContents = {
            ...asset,
            contents: contents.length > 0 ? contents : undefined,
            fittedModules: fittedModules.length > 0 ? fittedModules : undefined,
            isContainer: hasContentsOrFitting,
            isShip,
            isFitted,
            fittingStats,
          };

          groupedByLocation[locKey].items.push(assetWithContents);
          groupedByLocation[locKey].totalItems++;
        }
      }

      // Calculate total from filtered assets, not raw ESI response
      const groupedAssets = Object.values(groupedByLocation);
      const totalFilteredAssets = groupedAssets.reduce((sum, loc) => sum + loc.items.length, 0);

      // priceMap already populated above (fetched before structure name lookups)

      // Recursively price all items including those nested inside ships/containers
      const priceItemTree = (items: AssetWithContents[]): { pricedItems: AssetWithContents[]; treeValue: number } => {
        let treeValue = 0;
        const pricedItems = items.map(item => {
          const unitPrice = priceMap.get(item.type_id) || 0;
          const totalValue = unitPrice * item.quantity;
          treeValue += totalValue;
          let pricedContents: AssetWithContents[] | undefined;
          let contentsValue = 0;
          if (item.contents) {
            const result = priceItemTree(item.contents);
            pricedContents = result.pricedItems;
            contentsValue += result.treeValue;
            treeValue += result.treeValue;
          }
          let pricedFitted: AssetWithContents[] | undefined;
          if (item.fittedModules) {
            const result = priceItemTree(item.fittedModules);
            pricedFitted = result.pricedItems;
            contentsValue += result.treeValue;
            treeValue += result.treeValue;
          }
          return {
            ...item,
            unitPrice,
            totalValue: totalValue + contentsValue,
            contents: pricedContents,
            fittedModules: pricedFitted,
          };
        });
        return { pricedItems, treeValue };
      };

      // Calculate net worth and add prices to items
      let totalNetWorth = 0;
      const assetsWithPrices = groupedAssets.map(location => {
        const { pricedItems, treeValue } = priceItemTree(location.items);
        totalNetWorth += treeValue;
        return { ...location, items: pricedItems, locationValue: treeValue };
      });

      res.json({
        assets: assetsWithPrices,
        totalAssets: totalFilteredAssets,
        totalNetWorth,
        characterIds,
        viewAll,
      });
    } catch (error) {
      console.error("Get assets error:", error);
      console.error("Get assets error stack:", error instanceof Error ? error.stack : 'No stack');
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to fetch assets", details: errorMessage });
    }
  });

  // ============================================
  // CONTRACTS ENDPOINTS
  // ============================================

  // ESI scope required: esi-contracts.read_character_contracts.v1

  interface ESIContract {
    contract_id: number;
    issuer_id: number;
    issuer_corporation_id: number;
    assignee_id: number;
    acceptor_id: number;
    type: 'unknown' | 'item_exchange' | 'auction' | 'courier' | 'loan';
    status: 'outstanding' | 'in_progress' | 'finished_issuer' | 'finished_contractor' | 'finished' | 'cancelled' | 'rejected' | 'failed' | 'deleted' | 'reversed';
    title: string;
    for_corporation: boolean;
    availability: 'public' | 'personal' | 'corporation' | 'alliance';
    date_issued: string;
    date_expired: string;
    date_accepted?: string;
    date_completed?: string;
    days_to_complete?: number;
    end_location_id?: number;
    start_location_id?: number;
    price?: number;
    reward?: number;
    collateral?: number;
    buyout?: number;
    volume?: number;
  }

  async function fetchContractsForCharacter(
    characterId: number,
    characterName: string,
    accessToken: string
  ): Promise<(ESIContract & { characterId: number; characterName: string })[]> {
    const allContracts: (ESIContract & { characterId: number; characterName: string })[] = [];
    let page = 1;
    
    while (true) {
      const response = await fetch(
        `${ESI_BASE_URL}/characters/${characterId}/contracts/?datasource=tranquility&page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Missing contracts scope - please log out and log in again');
        }
        throw new Error(`ESI error: ${response.status}`);
      }
      
      const contracts = await response.json() as ESIContract[];
      allContracts.push(...contracts.map(c => ({ ...c, characterId, characterName })));
      
      const pages = parseInt(response.headers.get('x-pages') || '1');
      if (page >= pages) break;
      page++;
    }
    
    return allContracts;
  }

  // Get contracts for active character (or all characters if viewAll=true)
  app.get("/api/contracts", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const viewAll = req.query.viewAll === 'true';
      let allContracts: (ESIContract & { characterId: number; characterName: string })[] = [];
      const characterIds: number[] = [];

      if (viewAll) {
        const primaryCharacterId = req.session.character.characterId;
        const linkedCharacters = await storage.getLinkedCharacters(primaryCharacterId);

        // Fetch for primary character
        const primaryToken = await refreshTokenIfNeeded(req);
        if (primaryToken) {
          const contracts = await fetchContractsForCharacter(
            primaryCharacterId,
            req.session.character.characterName,
            primaryToken
          );
          allContracts.push(...contracts);
          characterIds.push(primaryCharacterId);
        }

        // Fetch for linked characters
        for (const linked of linkedCharacters) {
          const token = await refreshLinkedCharacterToken(linked);
          if (token) {
            const contracts = await fetchContractsForCharacter(
              linked.characterId,
              linked.characterName,
              token
            );
            allContracts.push(...contracts);
            characterIds.push(linked.characterId);
          }
        }
      } else {
        const activeChar = await getActiveCharacterInfo(req);
        if (!activeChar) {
          res.status(401).json({ error: "Token refresh failed" });
          return;
        }

        allContracts = await fetchContractsForCharacter(
          activeChar.characterId,
          activeChar.characterName,
          activeChar.accessToken
        );
        characterIds.push(activeChar.characterId);
      }

      // Resolve location names for start/end locations
      const locationIds = new Set<number>();
      allContracts.forEach(c => {
        if (c.start_location_id) locationIds.add(c.start_location_id);
        if (c.end_location_id) locationIds.add(c.end_location_id);
      });

      const locationNameMap = new Map<number, string>();
      const allLocationIds = Array.from(locationIds);
      const stationIds = allLocationIds.filter(id => id < 1000000000000 && id > 60000000);
      const structureIds = allLocationIds.filter(id => id >= 1000000000000);
      
      // Batch station name resolution (up to 500 per request)
      const batchSize = 500;
      for (let i = 0; i < stationIds.length; i += batchSize) {
        const batch = stationIds.slice(i, i + batchSize);
        try {
          const response = await fetch(
            `${ESI_BASE_URL}/universe/names/?datasource=tranquility`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(batch),
            }
          );
          if (response.ok) {
            const names = await response.json() as { id: number; name: string }[];
            names.forEach(n => locationNameMap.set(n.id, n.name));
          }
        } catch {}
      }

      // Resolve structure names (requires auth, limit to prevent rate limiting)
      if (structureIds.length > 0) {
        const activeChar = await getActiveCharacterInfo(req);
        if (activeChar) {
          for (const structureId of structureIds.slice(0, 30)) {
            try {
              const response = await fetch(
                `${ESI_BASE_URL}/universe/structures/${structureId}/?datasource=tranquility`,
                {
                  headers: {
                    Authorization: `Bearer ${activeChar.accessToken}`,
                  },
                }
              );
              if (response.ok) {
                const data = await response.json() as { name: string };
                locationNameMap.set(structureId, data.name);
              }
            } catch {}
          }
        }
      }

      // Resolve character/corporation names for issuer, assignee, acceptor
      const entityIdSet = new Set<number>();
      allContracts.forEach(c => {
        if (c.issuer_id) entityIdSet.add(c.issuer_id);
        if (c.assignee_id && c.assignee_id !== 0) entityIdSet.add(c.assignee_id);
        if (c.acceptor_id && c.acceptor_id !== 0) entityIdSet.add(c.acceptor_id);
        if (c.issuer_corporation_id) entityIdSet.add(c.issuer_corporation_id);
      });

      const entityNameMap = new Map<number, string>();
      const entityIds = Array.from(entityIdSet);
      
      // Batch name resolution (up to 500 per request)
      for (let i = 0; i < entityIds.length; i += batchSize) {
        const batch = entityIds.slice(i, i + batchSize);
        try {
          const response = await fetch(
            `${ESI_BASE_URL}/universe/names/?datasource=tranquility`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(batch),
            }
          );
          if (response.ok) {
            const names = await response.json() as { id: number; name: string }[];
            names.forEach(n => entityNameMap.set(n.id, n.name));
          }
        } catch {}
      }

      // Add location names and entity names to contracts
      const contractsWithNames = allContracts.map(contract => ({
        ...contract,
        startLocationName: contract.start_location_id ? locationNameMap.get(contract.start_location_id) || `Location ${contract.start_location_id}` : undefined,
        endLocationName: contract.end_location_id ? locationNameMap.get(contract.end_location_id) || `Location ${contract.end_location_id}` : undefined,
        issuerName: entityNameMap.get(contract.issuer_id) || `Character ${contract.issuer_id}`,
        issuerCorporationName: entityNameMap.get(contract.issuer_corporation_id) || undefined,
        assigneeName: contract.assignee_id && contract.assignee_id !== 0 ? entityNameMap.get(contract.assignee_id) || `Entity ${contract.assignee_id}` : undefined,
        acceptorName: contract.acceptor_id && contract.acceptor_id !== 0 ? entityNameMap.get(contract.acceptor_id) || `Entity ${contract.acceptor_id}` : undefined,
      }));

      // Calculate summary stats
      const now = new Date();
      const outstanding = contractsWithNames.filter(c => c.status === 'outstanding').length;
      const inProgress = contractsWithNames.filter(c => c.status === 'in_progress').length;
      const finished = contractsWithNames.filter(c => ['finished', 'finished_issuer', 'finished_contractor'].includes(c.status)).length;
      const totalValue = contractsWithNames.reduce((sum, c) => sum + (c.price || 0) + (c.reward || 0), 0);

      res.json({
        contracts: contractsWithNames,
        totalContracts: contractsWithNames.length,
        outstanding,
        inProgress,
        finished,
        totalValue,
        characterIds,
        viewAll,
      });
    } catch (error) {
      console.error("Get contracts error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch contracts";
      res.status(500).json({ error: message });
    }
  });

  // Get contract items (for item exchange contracts)
  app.get("/api/contracts/:contractId/items", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const contractId = parseInt(req.params.contractId);
      const characterId = req.query.characterId ? parseInt(req.query.characterId as string) : null;
      
      if (isNaN(contractId)) {
        res.status(400).json({ error: "Invalid contract ID" });
        return;
      }

      // Get the access token for the specified character
      let accessToken: string | null = null;
      let targetCharacterId: number;
      
      if (characterId && characterId !== req.session.character.characterId) {
        // It's a linked character
        const linkedCharacters = await storage.getLinkedCharacters(req.session.character.characterId);
        const linkedChar = linkedCharacters.find(lc => lc.characterId === characterId);
        if (!linkedChar) {
          res.status(403).json({ error: "Character not linked to your account" });
          return;
        }
        accessToken = await refreshLinkedCharacterToken(linkedChar);
        targetCharacterId = characterId;
      } else {
        // Primary character
        accessToken = await refreshTokenIfNeeded(req);
        targetCharacterId = req.session.character.characterId;
      }

      if (!accessToken) {
        res.status(401).json({ error: "Token refresh failed" });
        return;
      }

      // Fetch contract items from ESI
      const response = await fetch(
        `${ESI_BASE_URL}/characters/${targetCharacterId}/contracts/${contractId}/items/?datasource=tranquility`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          // Contract might not have items or doesn't exist
          res.json({ items: [] });
          return;
        }
        throw new Error(`ESI error: ${response.status}`);
      }

      const items = await response.json() as {
        record_id: number;
        type_id: number;
        quantity: number;
        is_included: boolean;
        is_singleton?: boolean;
        raw_quantity?: number;
      }[];

      // Resolve type names
      const typeIds = Array.from(new Set(items.map(item => item.type_id)));
      const typeNameMap = new Map<number, string>();
      
      if (typeIds.length > 0) {
        try {
          const namesResponse = await fetch(
            `${ESI_BASE_URL}/universe/names/?datasource=tranquility`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(typeIds),
            }
          );
          if (namesResponse.ok) {
            const names = await namesResponse.json() as { id: number; name: string }[];
            names.forEach(n => typeNameMap.set(n.id, n.name));
          }
        } catch {}
      }

      // Add type names to items
      const itemsWithNames = items.map(item => ({
        ...item,
        typeName: typeNameMap.get(item.type_id) || `Type ${item.type_id}`,
      }));

      res.json({ items: itemsWithNames });
    } catch (error) {
      console.error("Get contract items error:", error);
      res.status(500).json({ error: "Failed to fetch contract items" });
    }
  });

  // ============================================
  // PLANETARY INDUSTRY ENDPOINTS
  // ============================================

  // ESI scope required: esi-planets.manage_planets.v1
  const PI_SCOPE = "esi-planets.manage_planets.v1";

  // Get planetary colonies for active character (or all characters if viewAll=true)
  app.get("/api/planetary/planets", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const viewAll = req.query.viewAll === 'true';
      
      if (viewAll) {
        const primaryCharacterId = req.session.character.characterId;
        const linkedCharacters = await storage.getLinkedCharacters(primaryCharacterId);
        const allCharacterIds = [primaryCharacterId, ...linkedCharacters.map(lc => lc.characterId)];
        
        const planets = await storage.getPlanetaryPlanetsForCharacters(allCharacterIds);
        
        // Get pins for all planets
        const planetsWithPins = await Promise.all(
          planets.map(async (planet) => {
            const pins = await storage.getPlanetaryPins(planet.characterId, planet.planetId);
            return { ...planet, pins };
          })
        );
        
        res.json({ planets: planetsWithPins, characterIds: allCharacterIds, viewAll: true });
      } else {
        const activeChar = await getActiveCharacterInfo(req);
        if (!activeChar) {
          res.status(401).json({ error: "Token refresh failed" });
          return;
        }
        
        const planets = await storage.getPlanetaryPlanets(activeChar.characterId);
        
        // Get pins for all planets
        const planetsWithPins = await Promise.all(
          planets.map(async (planet) => {
            const pins = await storage.getPlanetaryPins(planet.characterId, planet.planetId);
            return { ...planet, pins };
          })
        );
        
        res.json({ planets: planetsWithPins, characterId: activeChar.characterId, viewAll: false });
      }
    } catch (error) {
      console.error("Get planetary planets error:", error);
      res.status(500).json({ error: "Failed to get planetary colonies" });
    }
  });

  // Sync planetary data from ESI
  app.post("/api/planetary/sync", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const viewAll = req.query.viewAll === 'true';
      
      const syncCharacter = async (characterId: number, characterName: string, accessToken: string) => {
        // Fetch list of planets from ESI
        const planetsRes = await fetch(
          `${ESI_BASE_URL}/characters/${characterId}/planets/?datasource=tranquility`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!planetsRes.ok) {
          if (planetsRes.status === 403) {
            console.log(`Planetary scope not granted for character ${characterId}`);
            return { characterId, success: false, reason: 'scope_not_granted' };
          }
          console.error(`ESI error for planetary:`, await planetsRes.text());
          return { characterId, success: false, reason: 'esi_error' };
        }

        const esiPlanets = await planetsRes.json() as any[];
        
        // Fetch details for each planet
        const planetDetails = await Promise.all(
          esiPlanets.map(async (planet: any) => {
            try {
              // Get planet details
              const detailRes = await fetch(
                `${ESI_BASE_URL}/characters/${characterId}/planets/${planet.planet_id}/?datasource=tranquility`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
              );
              
              if (!detailRes.ok) {
                console.error(`Failed to get planet ${planet.planet_id} details`);
                return null;
              }
              
              const detail = await detailRes.json() as any;
              
              // Get planet universe info (name, type)
              const universeRes = await fetch(
                `${ESI_BASE_URL}/universe/planets/${planet.planet_id}/?datasource=tranquility`
              );
              
              let planetName = `Planet ${planet.planet_id}`;
              let systemId = 0;
              if (universeRes.ok) {
                const universeInfo = await universeRes.json() as any;
                planetName = universeInfo.name || planetName;
                systemId = universeInfo.system_id || 0;
              }
              
              // Get system name
              let systemName = "Unknown System";
              if (systemId) {
                const systemRes = await fetch(
                  `${ESI_BASE_URL}/universe/systems/${systemId}/?datasource=tranquility`
                );
                if (systemRes.ok) {
                  const systemInfo = await systemRes.json() as any;
                  systemName = systemInfo.name || systemName;
                }
              }
              
              // Get type names for pins
              const pinTypeIds = new Set<number>();
              const schematicIds = new Set<number>();
              
              for (const pin of detail.pins || []) {
                pinTypeIds.add(pin.type_id);
                if (pin.schematic_id) schematicIds.add(pin.schematic_id);
                if (pin.extractor_details?.product_type_id) {
                  pinTypeIds.add(pin.extractor_details.product_type_id);
                }
                for (const content of pin.contents || []) {
                  pinTypeIds.add(content.type_id);
                }
              }
              
              // Fetch all type names
              const typeNameMap = new Map<number, string>();
              await Promise.all(
                Array.from(pinTypeIds).map(async (typeId) => {
                  try {
                    const typeRes = await fetch(`${ESI_BASE_URL}/universe/types/${typeId}/?datasource=tranquility`);
                    if (typeRes.ok) {
                      const data = await typeRes.json();
                      typeNameMap.set(typeId, data.name);
                    }
                  } catch (e) {
                    typeNameMap.set(typeId, `Type ${typeId}`);
                  }
                })
              );
              
              // Fetch schematic names
              const schematicNameMap = new Map<number, string>();
              await Promise.all(
                Array.from(schematicIds).map(async (schematicId) => {
                  try {
                    const schematicRes = await fetch(`${ESI_BASE_URL}/universe/schematics/${schematicId}/?datasource=tranquility`);
                    if (schematicRes.ok) {
                      const data = await schematicRes.json();
                      schematicNameMap.set(schematicId, data.schematic_name);
                    }
                  } catch (e) {
                    schematicNameMap.set(schematicId, `Schematic ${schematicId}`);
                  }
                })
              );
              
              // Planet type mapping
              const planetTypeNames: Record<string, string> = {
                'temperate': 'Temperate',
                'barren': 'Barren',
                'oceanic': 'Oceanic',
                'ice': 'Ice',
                'gas': 'Gas',
                'lava': 'Lava',
                'storm': 'Storm',
                'plasma': 'Plasma',
              };
              
              return {
                planet: {
                  characterId,
                  characterName,
                  planetId: planet.planet_id,
                  planetName,
                  planetTypeId: planet.planet_type_id || 0,
                  planetTypeName: planetTypeNames[planet.planet_type?.toLowerCase()] || planet.planet_type || 'Unknown',
                  solarSystemId: systemId,
                  solarSystemName: systemName,
                  upgradeLevel: planet.upgrade_level || 0,
                  numPins: planet.num_pins || (detail.pins?.length || 0),
                  lastUpdate: planet.last_update ? new Date(planet.last_update) : null,
                },
                pins: (detail.pins || []).map((pin: any) => ({
                  characterId,
                  planetId: planet.planet_id,
                  pinId: pin.pin_id,
                  typeId: pin.type_id,
                  typeName: typeNameMap.get(pin.type_id) || `Type ${pin.type_id}`,
                  schematicId: pin.schematic_id || null,
                  schematicName: pin.schematic_id ? schematicNameMap.get(pin.schematic_id) || null : null,
                  extractorProductTypeId: pin.extractor_details?.product_type_id || null,
                  extractorProductName: pin.extractor_details?.product_type_id 
                    ? typeNameMap.get(pin.extractor_details.product_type_id) || null 
                    : null,
                  cycleTime: pin.extractor_details?.cycle_time || null,
                  headRadius: pin.extractor_details?.head_radius || null,
                  numHeads: pin.extractor_details?.heads?.length || null,
                  quantityPerCycle: pin.extractor_details?.qty_per_cycle || null,
                  installTime: pin.install_time ? new Date(pin.install_time) : null,
                  expiryTime: pin.expiry_time ? new Date(pin.expiry_time) : null,
                  contentsJson: pin.contents?.map((c: any) => ({
                    typeId: c.type_id,
                    typeName: typeNameMap.get(c.type_id) || `Type ${c.type_id}`,
                    quantity: c.amount || 0,
                  })) || null,
                  capacity: null, // Not directly provided by ESI
                  usedCapacity: null,
                  latitude: pin.latitude || null,
                  longitude: pin.longitude || null,
                })),
              };
            } catch (e) {
              console.error(`Error processing planet ${planet.planet_id}:`, e);
              return null;
            }
          })
        );
        
        // Filter out nulls and save to database
        const validPlanets = planetDetails.filter(p => p !== null);
        
        for (const { planet, pins } of validPlanets) {
          await storage.upsertPlanetaryPlanet(planet);
          await storage.upsertPlanetaryPins(characterId, planet.planetId, pins);
        }
        
        // Remove planets that no longer exist
        const currentPlanetIds = esiPlanets.map((p: any) => p.planet_id);
        await storage.deleteStalePlanetaryPlanets(characterId, currentPlanetIds);
        
        return { characterId, success: true, planetCount: validPlanets.length };
      };
      
      if (viewAll) {
        const primaryCharacterId = req.session.character.characterId;
        const linkedCharacters = await storage.getLinkedCharacters(primaryCharacterId);
        
        const results: any[] = [];
        
        // Sync primary character
        const primaryChar = await getActiveCharacterInfo(req);
        if (primaryChar) {
          const result = await syncCharacter(primaryChar.characterId, primaryChar.characterName, primaryChar.accessToken);
          results.push(result);
        }
        
        // Sync linked characters
        for (const linked of linkedCharacters) {
          try {
            const accessToken = await refreshLinkedCharacterToken(linked);
            if (accessToken) {
              const result = await syncCharacter(linked.characterId, linked.characterName, accessToken);
              results.push(result);
            }
          } catch (err) {
            console.error(`Failed to sync planetary for linked character ${linked.characterId}`);
            results.push({ characterId: linked.characterId, success: false, reason: 'token_refresh_failed' });
          }
        }
        
        res.json({ results, viewAll: true });
      } else {
        const activeChar = await getActiveCharacterInfo(req);
        if (!activeChar) {
          // Check if using dev-mode token
          if (req.session.character?.accessToken === "dev-mode-token") {
            res.status(401).json({
              error: "Dev mode cannot access ESI",
              message: "Please log out and use 'Real EVE SSO' login to access planetary data"
            });
            return;
          }
          res.status(401).json({ error: "Token refresh failed" });
          return;
        }

        const result = await syncCharacter(activeChar.characterId, activeChar.characterName, activeChar.accessToken);
        res.json({ result, viewAll: false });
      }
    } catch (error) {
      console.error("Sync planetary error:", error);
      console.error("Sync planetary error stack:", error instanceof Error ? error.stack : 'No stack trace');
      // Check if using dev-mode token
      if (req.session.character?.accessToken === "dev-mode-token") {
        res.status(401).json({
          error: "Dev mode cannot access ESI",
          message: "Please log out and use 'Real EVE SSO' login to access planetary data"
        });
        return;
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to sync planetary data", details: errorMessage });
    }
  });

  // Get PI commodity prices from Jita (for calculator)
  app.get("/api/pi/prices", async (req: Request, res: Response) => {
    try {
      const typeIdsParam = req.query.typeIds;
      if (!typeIdsParam || typeof typeIdsParam !== 'string') {
        res.status(400).json({ error: "typeIds query parameter required" });
        return;
      }
      
      const typeIds = typeIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (typeIds.length === 0) {
        res.status(400).json({ error: "No valid type IDs provided" });
        return;
      }
      
      // Limit to 100 type IDs to prevent abuse
      const limitedTypeIds = typeIds.slice(0, 100);
      
      const FORGE_REGION_ID = 10000002; // Jita region
      const priceMap: Record<number, number> = {};
      
      // Fetch prices in batches
      const pricePromises = limitedTypeIds.map(async (typeId) => {
        try {
          const ordersRes = await fetch(
            `${ESI_BASE_URL}/markets/${FORGE_REGION_ID}/orders/?datasource=tranquility&type_id=${typeId}&order_type=sell`,
            { headers: { 'Accept': 'application/json' } }
          );
          
          if (ordersRes.ok) {
            const orders = await ordersRes.json();
            if (Array.isArray(orders) && orders.length > 0) {
              // Find lowest sell price in Jita 4-4 (station_id: 60003760)
              const jitaOrders = orders.filter((o: any) => o.location_id === 60003760);
              if (jitaOrders.length > 0) {
                priceMap[typeId] = Math.min(...jitaOrders.map((o: any) => o.price));
              } else {
                // Fallback to lowest sell in region
                priceMap[typeId] = Math.min(...orders.map((o: any) => o.price));
              }
            }
          }
        } catch {
          // Skip failed price fetches
        }
      });
      
      await Promise.all(pricePromises);
      
      res.json({ prices: priceMap });
    } catch (error) {
      console.error("PI prices error:", error);
      res.status(500).json({ error: "Failed to fetch prices" });
    }
  });

  // Get PI production values with Jita prices
  app.get("/api/planetary/values", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const viewAll = req.query.viewAll === 'true';
      
      // Get all planets and pins
      let planets: any[] = [];
      if (viewAll) {
        const primaryCharacterId = req.session.character.characterId;
        const linkedCharacters = await storage.getLinkedCharacters(primaryCharacterId);
        const allCharacterIds = [primaryCharacterId, ...linkedCharacters.map(lc => lc.characterId)];
        planets = await storage.getPlanetaryPlanetsForCharacters(allCharacterIds);
      } else {
        const activeChar = await getActiveCharacterInfo(req);
        if (!activeChar) {
          res.status(401).json({ error: "Token refresh failed" });
          return;
        }
        planets = await storage.getPlanetaryPlanets(activeChar.characterId);
      }
      
      // Gather all pins
      const allPinsWithPlanet: any[] = [];
      for (const planet of planets) {
        const pins = await storage.getPlanetaryPins(planet.characterId, planet.planetId);
        pins.forEach(pin => allPinsWithPlanet.push({ ...pin, planetName: planet.planetName, solarSystemName: planet.solarSystemName }));
      }
      
      // Collect all unique type IDs that need prices
      const typeIds = new Set<number>();
      for (const pin of allPinsWithPlanet) {
        if (pin.extractorProductTypeId) typeIds.add(pin.extractorProductTypeId);
        // Schematic outputs - we need to get the output type from the schematic
        if (pin.schematicId) {
          // Schematic IDs correspond to the output product type
          // We'll fetch schematic details to get input/output
        }
        if (pin.contentsJson) {
          for (const content of pin.contentsJson) {
            typeIds.add(content.typeId);
          }
        }
      }
      
      // Fetch Jita sell prices for all type IDs
      const FORGE_REGION_ID = 10000002; // Jita region
      const priceMap = new Map<number, number>();
      const pricePromises = Array.from(typeIds).map(async (typeId) => {
        try {
          const ordersRes = await fetch(
            `${ESI_BASE_URL}/markets/${FORGE_REGION_ID}/orders/?datasource=tranquility&type_id=${typeId}&order_type=sell`
          );
          if (ordersRes.ok) {
            const orders = await ordersRes.json() as any[];
            if (orders.length > 0) {
              const lowestSell = Math.min(...orders.map(o => o.price));
              priceMap.set(typeId, lowestSell);
            }
          }
        } catch (e) {
          console.error(`Failed to fetch price for type ${typeId}:`, e);
        }
      });
      await Promise.all(pricePromises);
      
      // Calculate production values
      const SECONDS_PER_DAY = 86400;
      const extractorValues: any[] = [];
      const factoryValues: any[] = [];
      const storageValues: any[] = [];
      
      for (const pin of allPinsWithPlanet) {
        // Extractor production value
        if (pin.extractorProductTypeId && pin.quantityPerCycle && pin.cycleTime && pin.cycleTime > 0) {
          const pricePerUnit = priceMap.get(pin.extractorProductTypeId) || 0;
          const cyclesPerDay = SECONDS_PER_DAY / pin.cycleTime;
          const unitsPerDay = pin.quantityPerCycle * cyclesPerDay;
          const iskPerDay = unitsPerDay * pricePerUnit;
          
          // Check if extractor is active
          const isActive = pin.expiryTime ? new Date(pin.expiryTime) > new Date() : false;
          
          extractorValues.push({
            pinId: pin.pinId,
            planetName: pin.planetName,
            solarSystemName: pin.solarSystemName,
            characterId: pin.characterId,
            productTypeId: pin.extractorProductTypeId,
            productName: pin.extractorProductName || 'Unknown',
            pricePerUnit,
            cycleTime: pin.cycleTime,
            quantityPerCycle: pin.quantityPerCycle,
            unitsPerDay: Math.round(unitsPerDay),
            iskPerDay: Math.round(iskPerDay),
            isActive,
            expiryTime: pin.expiryTime,
          });
        }
        
        // Factory schematic production (if we have schematic info)
        if (pin.schematicId && pin.schematicName) {
          factoryValues.push({
            pinId: pin.pinId,
            planetName: pin.planetName,
            solarSystemName: pin.solarSystemName,
            characterId: pin.characterId,
            schematicId: pin.schematicId,
            schematicName: pin.schematicName,
            typeName: pin.typeName,
          });
        }
        
        // Storage/Launchpad contents value
        if (pin.contentsJson && pin.contentsJson.length > 0) {
          let totalValue = 0;
          const contents = pin.contentsJson.map((item: any) => {
            const price = priceMap.get(item.typeId) || 0;
            const value = item.quantity * price;
            totalValue += value;
            return {
              typeId: item.typeId,
              typeName: item.typeName,
              quantity: item.quantity,
              pricePerUnit: price,
              totalValue: Math.round(value),
            };
          });
          
          storageValues.push({
            pinId: pin.pinId,
            planetName: pin.planetName,
            solarSystemName: pin.solarSystemName,
            characterId: pin.characterId,
            typeName: pin.typeName,
            capacity: pin.capacity,
            usedCapacity: pin.usedCapacity,
            contents,
            totalValue: Math.round(totalValue),
          });
        }
      }
      
      // Calculate totals
      const totalDailyIsk = extractorValues
        .filter(e => e.isActive)
        .reduce((sum, e) => sum + e.iskPerDay, 0);
      
      const totalStorageValue = storageValues
        .reduce((sum, s) => sum + s.totalValue, 0);
      
      res.json({
        extractors: extractorValues,
        factories: factoryValues,
        storage: storageValues,
        summary: {
          totalActiveExtractors: extractorValues.filter(e => e.isActive).length,
          totalExtractors: extractorValues.length,
          totalFactories: factoryValues.length,
          totalDailyIsk: Math.round(totalDailyIsk),
          totalStorageValue: Math.round(totalStorageValue),
          pricesLoaded: priceMap.size,
        },
        viewAll,
      });
    } catch (error) {
      console.error("Get planetary values error:", error);
      res.status(500).json({ error: "Failed to calculate planetary values" });
    }
  });

  // Get combined wallet data (balance + recent bounties)
  // Respects active character selection for multi-character support
  app.get("/api/wallet/overview", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      // Get the appropriate token based on active character
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed for active character" });
        return;
      }
      
      const { accessToken, characterId, characterName } = activeChar;

      // Fetch balance and journal in parallel
      const [balanceRes, journalRes] = await Promise.all([
        fetch(`${ESI_BASE_URL}/characters/${characterId}/wallet/?datasource=tranquility`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(`${ESI_BASE_URL}/characters/${characterId}/wallet/journal/?datasource=tranquility`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      if (!balanceRes.ok || !journalRes.ok) {
        res.status(500).json({ error: "Failed to fetch wallet data" });
        return;
      }

      const balance = await balanceRes.json();
      const journal = await journalRes.json();

      // Filter for bounties
      const bounties = journal.filter((entry: any) => 
        entry.ref_type === "bounty_prizes" || 
        entry.ref_type === "bounty_prize"
      ).slice(0, 20).map((entry: any) => ({
        id: entry.id,
        date: entry.date,
        amount: entry.amount,
        description: entry.description || "Bounty Payment",
      }));

      // Calculate today's bounties
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayBounties = bounties.filter((b: any) => new Date(b.date) >= today);
      const todayTotal = todayBounties.reduce((sum: number, b: any) => sum + b.amount, 0);

      // Calculate last 24 hours
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const last24hBounties = bounties.filter((b: any) => new Date(b.date) >= last24h);
      const last24hTotal = last24hBounties.reduce((sum: number, b: any) => sum + b.amount, 0);

      res.json({
        characterId,
        characterName,
        balance,
        recentBounties: bounties,
        stats: {
          todayTotal,
          todayCount: todayBounties.length,
          last24hTotal,
          last24hCount: last24hBounties.length,
        },
      });
    } catch (error) {
      console.error("Wallet overview error:", error);
      res.status(500).json({ error: "Failed to fetch wallet overview" });
    }
  });

  // ============ SHIP & LOCATION TRACKING (PRO FEATURE) ============

  // Get character's current ship
  // Respects active character selection for multi-character support
  app.get("/api/character/ship", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed for active character" });
        return;
      }

      const { characterId, accessToken } = activeChar;
      
      const response = await fetch(
        `${ESI_BASE_URL}/characters/${characterId}/ship/?datasource=tranquility`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Ship fetch error:", errorText);
        res.status(response.status).json({ error: "Failed to fetch ship data" });
        return;
      }

      const shipData = await response.json();
      
      // Get ship type name from universe types
      const typeResponse = await fetch(
        `${ESI_BASE_URL}/universe/types/${shipData.ship_type_id}/?datasource=tranquility`
      );
      
      let shipTypeName = "Unknown Ship";
      if (typeResponse.ok) {
        const typeData = await typeResponse.json();
        shipTypeName = typeData.name;
      }

      res.json({
        shipTypeId: shipData.ship_type_id,
        shipTypeName,
        shipName: shipData.ship_name,
        shipItemId: shipData.ship_item_id,
      });
    } catch (error) {
      console.error("Ship fetch error:", error);
      res.status(500).json({ error: "Failed to fetch ship data" });
    }
  });

  // Get character's current location
  // Respects active character selection for multi-character support
  app.get("/api/character/location", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed for active character" });
        return;
      }

      const { characterId, accessToken } = activeChar;
      
      const response = await fetch(
        `${ESI_BASE_URL}/characters/${characterId}/location/?datasource=tranquility`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Location fetch error:", errorText);
        res.status(response.status).json({ error: "Failed to fetch location data" });
        return;
      }

      const locationData = await response.json();
      
      // Get system name
      const systemResponse = await fetch(
        `${ESI_BASE_URL}/universe/systems/${locationData.solar_system_id}/?datasource=tranquility`
      );
      
      let systemName = "Unknown System";
      let securityStatus = 0;
      let constellationId = null;
      let regionId = null;
      
      if (systemResponse.ok) {
        const systemData = await systemResponse.json();
        systemName = systemData.name;
        securityStatus = systemData.security_status;
        constellationId = systemData.constellation_id;
      }

      // Get constellation and region info if we have constellation
      let constellationName = null;
      let regionName = null;
      
      if (constellationId) {
        const constellationResponse = await fetch(
          `${ESI_BASE_URL}/universe/constellations/${constellationId}/?datasource=tranquility`
        );
        if (constellationResponse.ok) {
          const constellationData = await constellationResponse.json();
          constellationName = constellationData.name;
          regionId = constellationData.region_id;
          
          // Get region name
          if (regionId) {
            const regionResponse = await fetch(
              `${ESI_BASE_URL}/universe/regions/${regionId}/?datasource=tranquility`
            );
            if (regionResponse.ok) {
              const regionData = await regionResponse.json();
              regionName = regionData.name;
            }
          }
        }
      }

      res.json({
        solarSystemId: locationData.solar_system_id,
        solarSystemName: systemName,
        securityStatus: Math.round(securityStatus * 10) / 10,
        stationId: locationData.station_id || null,
        structureId: locationData.structure_id || null,
        constellationId,
        constellationName,
        regionId,
        regionName,
      });
    } catch (error) {
      console.error("Location fetch error:", error);
      res.status(500).json({ error: "Failed to fetch location data" });
    }
  });

  // Get character's current ship AND location combined (for efficiency)
  // Respects active character selection for multi-character support
  app.get("/api/character/status", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed for active character" });
        return;
      }

      const { characterId, characterName, accessToken } = activeChar;
      
      // Fetch ship and location in parallel
      const [shipResponse, locationResponse] = await Promise.all([
        fetch(
          `${ESI_BASE_URL}/characters/${characterId}/ship/?datasource=tranquility`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        ),
        fetch(
          `${ESI_BASE_URL}/characters/${characterId}/location/?datasource=tranquility`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        ),
      ]);

      if (!shipResponse.ok || !locationResponse.ok) {
        res.status(500).json({ error: "Failed to fetch character status" });
        return;
      }

      const [shipData, locationData] = await Promise.all([
        shipResponse.json(),
        locationResponse.json(),
      ]);

      // Fetch ship type name and system info in parallel
      const [typeResponse, systemResponse] = await Promise.all([
        fetch(`${ESI_BASE_URL}/universe/types/${shipData.ship_type_id}/?datasource=tranquility`),
        fetch(`${ESI_BASE_URL}/universe/systems/${locationData.solar_system_id}/?datasource=tranquility`),
      ]);

      let shipTypeName = "Unknown Ship";
      if (typeResponse.ok) {
        const typeData = await typeResponse.json();
        shipTypeName = typeData.name;
      }

      let systemName = "Unknown System";
      let securityStatus = 0;
      if (systemResponse.ok) {
        const systemData = await systemResponse.json();
        systemName = systemData.name;
        securityStatus = systemData.security_status;
      }

      res.json({
        characterId,
        characterName,
        ship: {
          shipTypeId: shipData.ship_type_id,
          shipTypeName,
          shipName: shipData.ship_name,
        },
        location: {
          solarSystemId: locationData.solar_system_id,
          solarSystemName: systemName,
          securityStatus: Math.round(securityStatus * 10) / 10,
          stationId: locationData.station_id || null,
          structureId: locationData.structure_id || null,
        },
      });
    } catch (error) {
      console.error("Character status error:", error);
      res.status(500).json({ error: "Failed to fetch character status" });
    }
  });

  // ============ INCOME GOALS ============

  // Get income goals and progress for the active character (or aggregated if viewAll=true)
  app.get("/api/income-goals", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const viewAll = req.query.viewAll === "true";
      const primaryCharacterId = req.session.character.characterId;
      const activeCharacterId = req.session.activeCharacterId || primaryCharacterId;

      let goals = { dailyTarget: 0, weeklyTarget: 0, monthlyTarget: 0 };
      let progress = { dailyEarned: 0, weeklyEarned: 0, monthlyEarned: 0 };
      const characterBreakdown: { characterId: number; characterName: string; daily: number; weekly: number; monthly: number }[] = [];

      if (viewAll) {
        // Aggregate mode: sum earnings from all characters, use primary's goals
        const primaryGoals = await storage.getIncomeGoals(primaryCharacterId);
        if (primaryGoals) {
          goals = {
            dailyTarget: primaryGoals.dailyTarget,
            weeklyTarget: primaryGoals.weeklyTarget,
            monthlyTarget: primaryGoals.monthlyTarget,
          };
        }

        // Get earnings from primary character
        const primaryDaily = await storage.getIncomeEarnings(primaryCharacterId, 'daily');
        const primaryWeekly = await storage.getIncomeEarnings(primaryCharacterId, 'weekly');
        const primaryMonthly = await storage.getIncomeEarnings(primaryCharacterId, 'monthly');
        progress.dailyEarned += primaryDaily;
        progress.weeklyEarned += primaryWeekly;
        progress.monthlyEarned += primaryMonthly;
        characterBreakdown.push({
          characterId: primaryCharacterId,
          characterName: req.session.character.characterName,
          daily: primaryDaily,
          weekly: primaryWeekly,
          monthly: primaryMonthly,
        });

        // Get earnings from all linked characters
        const linkedCharacters = await storage.getLinkedCharacters(primaryCharacterId);
        for (const linkedChar of linkedCharacters) {
          if (!linkedChar.isActive) continue;
          const linkedDaily = await storage.getIncomeEarnings(linkedChar.characterId, 'daily');
          const linkedWeekly = await storage.getIncomeEarnings(linkedChar.characterId, 'weekly');
          const linkedMonthly = await storage.getIncomeEarnings(linkedChar.characterId, 'monthly');
          progress.dailyEarned += linkedDaily;
          progress.weeklyEarned += linkedWeekly;
          progress.monthlyEarned += linkedMonthly;
          characterBreakdown.push({
            characterId: linkedChar.characterId,
            characterName: linkedChar.characterName,
            daily: linkedDaily,
            weekly: linkedWeekly,
            monthly: linkedMonthly,
          });
        }
      } else {
        // Single character mode: get goals and earnings for active character only
        const characterGoals = await storage.getIncomeGoals(activeCharacterId);
        if (characterGoals) {
          goals = {
            dailyTarget: characterGoals.dailyTarget,
            weeklyTarget: characterGoals.weeklyTarget,
            monthlyTarget: characterGoals.monthlyTarget,
          };
        }

        progress.dailyEarned = await storage.getIncomeEarnings(activeCharacterId, 'daily');
        progress.weeklyEarned = await storage.getIncomeEarnings(activeCharacterId, 'weekly');
        progress.monthlyEarned = await storage.getIncomeEarnings(activeCharacterId, 'monthly');
      }

      res.json({ goals, progress, viewAll, characterBreakdown: viewAll ? characterBreakdown : undefined });
    } catch (error) {
      console.error("Income goals fetch error:", error);
      res.status(500).json({ error: "Failed to fetch income goals" });
    }
  });

  // Save income goals for the active character
  app.post("/api/income-goals", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const primaryCharacterId = req.session.character.characterId;
      const primaryCharacterName = req.session.character.characterName;
      const activeCharacterId = req.session.activeCharacterId || primaryCharacterId;

      // Get the character name for the active character
      let characterName = primaryCharacterName;
      if (activeCharacterId !== primaryCharacterId) {
        const linkedChar = await storage.getLinkedCharacter(activeCharacterId);
        if (linkedChar) {
          characterName = linkedChar.characterName;
        }
      }

      const { dailyTarget, weeklyTarget, monthlyTarget } = req.body;

      // Validate inputs
      if (typeof dailyTarget !== 'number' || typeof weeklyTarget !== 'number' || typeof monthlyTarget !== 'number') {
        res.status(400).json({ error: "Invalid goal values" });
        return;
      }

      const result = await storage.upsertIncomeGoals({
        characterId: activeCharacterId,
        characterName,
        dailyTarget: Math.max(0, dailyTarget),
        weeklyTarget: Math.max(0, weeklyTarget),
        monthlyTarget: Math.max(0, monthlyTarget),
      });

      res.json(result);
    } catch (error) {
      console.error("Income goals save error:", error);
      res.status(500).json({ error: "Failed to save income goals" });
    }
  });

  // ============ PLEX GOAL TRACKING ============

  // Get current PLEX price from ESI
  // Cache for PLEX price
  let cachedPlexPrice: { price: number; timestamp: number } | null = null;
  const PLEX_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  app.get("/api/market/plex-price", async (req: Request, res: Response) => {
    try {
      // PLEX type ID is 44992
      const PLEX_TYPE_ID = 44992;
      // The Forge region (Jita) ID
      const FORGE_REGION_ID = 10000002;
      
      // Check cache first
      if (cachedPlexPrice && Date.now() - cachedPlexPrice.timestamp < PLEX_CACHE_DURATION) {
        res.json({
          typeId: PLEX_TYPE_ID,
          typeName: "PLEX",
          sellPrice: cachedPlexPrice.price,
          totalVolume: 0,
          lastUpdated: new Date(cachedPlexPrice.timestamp).toISOString(),
          cached: true,
        });
        return;
      }
      
      // Try ESI market orders endpoint
      const response = await fetch(
        `${ESI_BASE_URL}/markets/${FORGE_REGION_ID}/orders/?datasource=tranquility&type_id=${PLEX_TYPE_ID}&order_type=sell`,
        {
          headers: {
            "User-Agent": "PHOTON EVE Tracker - contact: admin@example.com",
          }
        }
      );
      
      if (response.ok) {
        const orders = await response.json();
        
        // Find lowest sell price in Jita (station 60003760)
        let lowestPrice = Infinity;
        let totalVolume = 0;
        
        for (const order of orders) {
          if (order.price < lowestPrice) {
            lowestPrice = order.price;
          }
          totalVolume += order.volume_remain;
        }
        
        if (lowestPrice !== Infinity) {
          cachedPlexPrice = { price: lowestPrice, timestamp: Date.now() };
          res.json({
            typeId: PLEX_TYPE_ID,
            typeName: "PLEX",
            sellPrice: lowestPrice,
            totalVolume,
            lastUpdated: new Date().toISOString(),
          });
          return;
        }
      }
      
      // Fallback: Try EVE Marketer API
      try {
        const marketerResponse = await fetch(
          `https://api.evemarketer.com/ec/marketstat/json?typeid=${PLEX_TYPE_ID}&regionlimit=${FORGE_REGION_ID}`
        );
        
        if (marketerResponse.ok) {
          const data = await marketerResponse.json();
          if (data && data[0] && data[0].sell) {
            const price = data[0].sell.min;
            cachedPlexPrice = { price, timestamp: Date.now() };
            res.json({
              typeId: PLEX_TYPE_ID,
              typeName: "PLEX",
              sellPrice: price,
              totalVolume: data[0].sell.volume || 0,
              lastUpdated: new Date().toISOString(),
              source: "evemarketer",
            });
            return;
          }
        }
      } catch (e) {
        console.error("EVE Marketer fallback failed:", e);
      }
      
      // Last resort: use a reasonable estimated price (~5M ISK per PLEX as of late 2024)
      const estimatedPrice = 5000000;
      res.json({
        typeId: PLEX_TYPE_ID,
        typeName: "PLEX",
        sellPrice: estimatedPrice,
        totalVolume: 0,
        lastUpdated: new Date().toISOString(),
        estimated: true,
      });
    } catch (error) {
      console.error("PLEX price fetch error:", error);
      // Return estimated price on error
      res.json({
        typeId: 44992,
        typeName: "PLEX",
        sellPrice: 5000000,
        totalVolume: 0,
        lastUpdated: new Date().toISOString(),
        estimated: true,
      });
    }
  });

  // ============ PRO SUBSCRIPTION ROUTES ============

  // Get current PRO status
  app.get("/api/pro/status", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.json({ 
        isPro: false, 
        status: "not_authenticated",
        pricing: PRO_PRICING,
      });
      return;
    }

    const { characterId, characterName } = req.session.character;
    
    // Admins always have PRO status
    const isAdminUser = await isAdminAsync(characterId);
    if (isAdminUser) {
      res.json({
        isPro: true,
        status: "active",
        expiresAt: null, // Never expires for admins
        activatedAt: new Date().toISOString(),
        isAdminGrant: true,
        pricing: PRO_PRICING,
        characterId,
        characterName,
      });
      return;
    }
    
    const subscription = await storage.getProSubscription(characterId);
    const activeCode = await storage.getActiveCodeForCharacter(characterId);
    
    // Check suspension status
    const suspension = await storage.getActiveSuspension(characterId);

    res.json({
      isPro: subscription?.status === "active",
      status: subscription?.status || "none",
      expiresAt: subscription?.expiresAt,
      activatedAt: subscription?.activatedAt,
      pendingCode: activeCode ? {
        code: activeCode.code,
        iskAmount: activeCode.iskAmount,
        expiresAt: activeCode.expiresAt,
      } : null,
      pricing: PRO_PRICING,
      characterId,
      characterName,
      isSuspended: !!suspension,
      suspension: suspension ? {
        reason: suspension.reason,
        expiresAt: suspension.expiresAt,
        suspendedAt: suspension.createdAt,
      } : null,
    });
  });

  // Generate activation code for payment
  app.post("/api/pro/generate-code", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const { characterId, characterName } = req.session.character;
    const { duration = "weekly" } = req.body;

    // Check if there's already an active code
    const existingCode = await storage.getActiveCodeForCharacter(characterId);
    if (existingCode) {
      res.json({
        code: existingCode.code,
        iskAmount: existingCode.iskAmount,
        expiresAt: existingCode.expiresAt,
        recipientCharacter: PRO_PRICING.recipientCharacterName,
        instructions: `Send ${existingCode.iskAmount.toLocaleString()} ISK to "${PRO_PRICING.recipientCharacterName}" with reason: ${existingCode.code}`,
        isExisting: true,
      });
      return;
    }

    // Create new activation code
    const code = generateActivationCode();
    const iskAmount = duration === "monthly" ? PRO_PRICING.monthlyIsk : PRO_PRICING.weeklyIsk;
    const codeData: ProActivationCode = {
      code,
      characterId,
      characterName,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Code valid for 7 days
      iskAmount,
      status: "pending",
      usedAt: null,
    };

    await storage.createActivationCode(codeData);

    res.json({
      code,
      iskAmount,
      expiresAt: codeData.expiresAt,
      recipientCharacter: PRO_PRICING.recipientCharacterName,
      instructions: `Send ${iskAmount.toLocaleString()} ISK to "${PRO_PRICING.recipientCharacterName}" with reason: ${code}`,
      isExisting: false,
    });
  });

  // Gift free week (self-service button for logged-in users - one time only)
  app.post("/api/pro/claim-free-trial", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const { characterId, characterName } = req.session.character;
    
    // Check if user already has or had PRO
    const existingSub = await storage.getProSubscription(characterId);
    if (existingSub) {
      res.status(400).json({ error: "Free trial already claimed or PRO already active" });
      return;
    }

    // Create PRO subscription for 7 days
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const subscription: ProSubscription = {
      characterId,
      characterName,
      status: "active",
      expiresAt,
      activatedAt: new Date(),
      activationCode: "FREE-TRIAL",
      giftedBy: null,
      giftedAt: null,
    };

    await storage.createOrUpdateProSubscription(subscription);

    res.json({
      success: true,
      message: "Free week of PRO activated!",
      expiresAt,
    });
  });

  // ============ ADMIN ROUTES ============
  
  // Get admin info and stats
  app.get("/api/admin/info", requireAdmin, async (req: Request, res: Response) => {
    const currentCharId = req.session.character?.characterId || 0;
    const dynamicAdmins = await storage.getDynamicAdmins();
    const allAdminIds = await getAllAdminIdsAsync();
    res.json({
      adminCharacterId: currentCharId,
      adminCharacterName: req.session.character?.characterName,
      isSuperAdmin: isSuperAdmin(currentCharId),
      configuredAdminIds: allAdminIds,
      superAdminIds: Array.from(SUPER_ADMIN_IDS),
      dynamicAdmins,
      serverTime: new Date().toISOString(),
    });
  });

  // Admin: Add a new admin
  const addAdminSchema = z.object({
    characterId: z.union([z.number(), z.string()]).transform(val => {
      const num = typeof val === "string" ? parseInt(val, 10) : val;
      if (isNaN(num) || num <= 0) throw new Error("Invalid character ID");
      return num;
    }),
    characterName: z.string().min(1).max(100).transform(val => val.trim()),
  });
  
  app.post("/api/admin/add-admin", requireAdmin, async (req: Request, res: Response) => {
    const currentChar = req.session.character!;
    
    // Only super admins can add other admins
    if (!isSuperAdmin(currentChar.characterId)) {
      res.status(403).json({ error: "Only super admins can add new admins" });
      return;
    }
    
    const parseResult = addAdminSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ 
        error: "Validation failed", 
        details: parseResult.error.errors.map(e => e.message).join(", ")
      });
      return;
    }
    
    const { characterId, characterName } = parseResult.data;
    
    // Check if already an admin
    const alreadyAdmin = await isAdminAsync(characterId);
    if (alreadyAdmin) {
      res.status(400).json({ error: "Character is already an admin" });
      return;
    }
    
    // Add to dynamic admins via storage
    const adminEntry = await storage.addDynamicAdmin({
      characterId,
      characterName,
      addedBy: currentChar.characterId,
      addedByName: currentChar.characterName,
    });
    
    // Log audit
    await storage.createAuditLog({
      adminCharacterId: currentChar.characterId,
      adminCharacterName: currentChar.characterName,
      action: 'add_admin',
      targetCharacterId: characterId,
      targetCharacterName: characterName,
      details: {},
    });
    
    res.json({
      success: true,
      message: `Added ${characterName} as admin`,
      admin: adminEntry,
    });
  });
  
  // Admin: Remove an admin
  app.post("/api/admin/remove-admin", requireAdmin, async (req: Request, res: Response) => {
    const currentChar = req.session.character!;
    
    // Only super admins can remove other admins
    if (!isSuperAdmin(currentChar.characterId)) {
      res.status(403).json({ error: "Only super admins can remove admins" });
      return;
    }
    
    const { characterId } = req.body;
    const numCharId = typeof characterId === "string" ? parseInt(characterId, 10) : characterId;
    
    if (isNaN(numCharId) || numCharId <= 0) {
      res.status(400).json({ error: "Invalid character ID" });
      return;
    }
    
    // Cannot remove super admins
    if (isSuperAdmin(numCharId)) {
      res.status(400).json({ error: "Cannot remove super admins. They are configured in environment variables." });
      return;
    }
    
    // Check if is a dynamic admin and remove
    const isDynamic = await storage.isDynamicAdmin(numCharId);
    if (!isDynamic) {
      res.status(404).json({ error: "Character is not a dynamic admin" });
      return;
    }
    
    const removedAdmin = await storage.removeDynamicAdmin(numCharId);
    
    // Log audit
    await storage.createAuditLog({
      adminCharacterId: currentChar.characterId,
      adminCharacterName: currentChar.characterName,
      action: 'remove_admin',
      targetCharacterId: numCharId,
      targetCharacterName: removedAdmin?.characterName || String(numCharId),
      details: {},
    });
    
    res.json({
      success: true,
      message: `Removed admin privileges from ${removedAdmin?.characterName || numCharId}`,
    });
  });

  // ============ PRO NOTIFICATION EMAIL ROUTES ============
  
  // Get all notification emails
  app.get("/api/admin/notification-emails", requireAdmin, async (req: Request, res: Response) => {
    try {
      const emails = await storage.getProNotificationEmails();
      res.json({ emails });
    } catch (error) {
      console.error("Error fetching notification emails:", error);
      res.status(500).json({ error: "Failed to fetch notification emails" });
    }
  });
  
  // Add a notification email
  const addEmailSchema = z.object({
    email: z.string().email("Invalid email address").max(255),
  });
  
  app.post("/api/admin/notification-emails", requireAdmin, async (req: Request, res: Response) => {
    const parseResult = addEmailSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ 
        error: "Validation failed", 
        details: parseResult.error.errors.map(e => e.message).join(", ")
      });
      return;
    }
    
    const { email } = parseResult.data;
    const adminChar = req.session.character!;
    
    try {
      // Check if email already exists
      const existing = await storage.getProNotificationEmails();
      if (existing.some(e => e.email.toLowerCase() === email.toLowerCase())) {
        res.status(400).json({ error: "Email already exists" });
        return;
      }
      
      const newEmail = await storage.addProNotificationEmail(
        email,
        adminChar.characterId,
        adminChar.characterName
      );
      
      res.json({
        success: true,
        message: `Added notification email: ${email}`,
        email: newEmail,
      });
    } catch (error) {
      console.error("Error adding notification email:", error);
      res.status(500).json({ error: "Failed to add notification email" });
    }
  });
  
  // Remove a notification email
  app.delete("/api/admin/notification-emails/:id", requireAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    
    try {
      const success = await storage.removeProNotificationEmail(id);
      if (!success) {
        res.status(404).json({ error: "Notification email not found" });
        return;
      }
      
      res.json({
        success: true,
        message: "Notification email removed",
      });
    } catch (error) {
      console.error("Error removing notification email:", error);
      res.status(500).json({ error: "Failed to remove notification email" });
    }
  });
  
  // Toggle notification email active status
  app.patch("/api/admin/notification-emails/:id/toggle", requireAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { isActive } = req.body;
    
    if (typeof isActive !== "boolean") {
      res.status(400).json({ error: "isActive must be a boolean" });
      return;
    }
    
    try {
      const updated = await storage.toggleProNotificationEmail(id, isActive);
      if (!updated) {
        res.status(404).json({ error: "Notification email not found" });
        return;
      }
      
      res.json({
        success: true,
        message: `Notification email ${isActive ? 'enabled' : 'disabled'}`,
        email: updated,
      });
    } catch (error) {
      console.error("Error toggling notification email:", error);
      res.status(500).json({ error: "Failed to toggle notification email" });
    }
  });

  // Placeholder for future admin features
  app.get("/api/admin/stats", requireAdmin, (req: Request, res: Response) => {
    res.json({
      message: "Admin stats endpoint - coming soon",
      features: [
        "View all user sessions",
        "Manual session corrections",
        "System diagnostics",
        "Feature flags",
      ],
    });
  });

  // Admin: Gift PRO time to a character
  app.post("/api/admin/gift-pro", requireAdmin, async (req: Request, res: Response) => {
    const parseResult = giftProSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ 
        error: "Validation failed", 
        details: parseResult.error.errors.map(e => e.message).join(", ")
      });
      return;
    }
    
    const { recipientCharacterId, recipientCharacterName, durationDays, note } = parseResult.data;
    const adminCharacter = req.session.character!;

    // Get existing subscription to calculate new expiry
    const existingSub = await storage.getProSubscription(recipientCharacterId);
    let newExpiresAt: Date;

    if (existingSub?.status === "active" && existingSub.expiresAt) {
      // Extend existing subscription
      newExpiresAt = new Date(existingSub.expiresAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
    } else {
      // Start fresh
      newExpiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    }

    const subscription: ProSubscription = {
      characterId: recipientCharacterId,
      characterName: recipientCharacterName,
      status: "active",
      expiresAt: newExpiresAt,
      activatedAt: existingSub?.activatedAt || new Date(),
      activationCode: existingSub?.activationCode || null,
      giftedBy: adminCharacter.characterId,
      giftedAt: new Date(),
    };

    await storage.createOrUpdateProSubscription(subscription);

    // Generate unique reference code for tracking
    const referenceCode = generateGiftReferenceCode();
    
    // Log the gift
    const gift: ProGift = {
      id: randomUUID(),
      referenceCode,
      recipientCharacterId,
      recipientCharacterName,
      giftedByCharacterId: adminCharacter.characterId,
      giftedByCharacterName: adminCharacter.characterName,
      durationDays,
      note: note || null,
      giftedAt: new Date(),
    };

    await storage.createGift(gift);

    // Log audit
    await storage.createAuditLog({
      adminCharacterId: adminCharacter.characterId,
      adminCharacterName: adminCharacter.characterName,
      action: 'gift_pro',
      targetCharacterId: recipientCharacterId,
      targetCharacterName: recipientCharacterName,
      details: { durationDays, referenceCode, note: note || null },
    });

    res.json({
      success: true,
      message: `Gifted ${durationDays} days of PRO to ${recipientCharacterName}`,
      referenceCode,
      subscription,
      gift,
    });
  });

  // Admin: Verify payment and activate PRO
  app.post("/api/admin/verify-payment", requireAdmin, async (req: Request, res: Response) => {
    const parseResult = verifyPaymentSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ 
        error: "Validation failed", 
        details: parseResult.error.errors.map(e => e.message).join(", ")
      });
      return;
    }
    
    const { activationCode } = parseResult.data;
    const codeData = await storage.getActivationCode(activationCode);
    if (!codeData) {
      res.status(404).json({ error: "Activation code not found" });
      return;
    }

    if (codeData.status === "used") {
      res.status(400).json({ error: "Activation code already used" });
      return;
    }

    if (codeData.status === "expired") {
      res.status(400).json({ error: "Activation code has expired" });
      return;
    }

    // Calculate duration based on amount paid
    const durationDays = codeData.iskAmount >= PRO_PRICING.monthlyIsk ? 30 : 7;

    // Get existing subscription to extend if active
    const existingSub = await storage.getProSubscription(codeData.characterId);
    let newExpiresAt: Date;

    if (existingSub?.status === "active" && existingSub.expiresAt) {
      newExpiresAt = new Date(existingSub.expiresAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
    } else {
      newExpiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    }

    // Create/update subscription
    const subscription: ProSubscription = {
      characterId: codeData.characterId,
      characterName: codeData.characterName,
      status: "active",
      expiresAt: newExpiresAt,
      activatedAt: new Date(),
      activationCode: activationCode,
      giftedBy: null,
      giftedAt: null,
    };

    await storage.createOrUpdateProSubscription(subscription);
    await storage.markCodeAsUsed(activationCode);

    res.json({
      success: true,
      message: `PRO activated for ${codeData.characterName} for ${durationDays} days`,
      subscription,
      codeData,
    });
  });

  // Admin: Get all pending activation codes
  app.get("/api/admin/pending-codes", requireAdmin, async (req: Request, res: Response) => {
    const pendingCodes = await storage.getAllPendingCodes();
    res.json({ 
      pendingCodes,
      count: pendingCodes.length,
    });
  });

  // Admin: Auto-check wallet for PRO payments
  app.post("/api/admin/auto-check-payments", requireAdmin, async (req: Request, res: Response) => {
    const adminCharacter = req.session.character;
    if (!adminCharacter) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const accessToken = await refreshTokenIfNeeded(req);
      if (!accessToken) {
        res.status(401).json({ error: "Token refresh failed - please re-login" });
        return;
      }

      // Fetch wallet journal for admin character
      const response = await fetch(
        `${ESI_BASE_URL}/characters/${adminCharacter.characterId}/wallet/journal/?datasource=tranquility`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Wallet check error:", errorText);
        res.status(response.status).json({ error: "Failed to fetch wallet journal" });
        return;
      }

      const journal = await response.json();
      
      // Get all pending activation codes
      const pendingCodes = await storage.getAllPendingCodes();
      const pendingCodeMap = new Map(pendingCodes.map(c => [c.code, c]));
      
      const activatedSubscriptions: any[] = [];
      const processedPayments: any[] = [];

      const skippedPayments: any[] = [];

      // Look for player donations with activation codes in the reason field
      for (const entry of journal) {
        // Skip if already processed successfully
        if (await storage.isTransactionProcessed(entry.id)) {
          continue;
        }

        // Only process player donations (ISK transfers)
        if (entry.ref_type !== "player_donation" || entry.amount <= 0) {
          continue;
        }

        // Check if reason contains an activation code
        const reason = entry.reason || entry.description || "";
        const codeMatch = reason.match(/PHOTON-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/i);
        
        if (!codeMatch) {
          // No activation code in reason - don't mark as processed, not relevant
          continue;
        }

        const activationCode = codeMatch[0].toUpperCase();
        const codeData = pendingCodeMap.get(activationCode);

        if (!codeData) {
          // Code not found in pending list - may already be used or invalid
          // Still don't mark as processed - we only track successful activations
          skippedPayments.push({
            transactionId: entry.id,
            code: activationCode,
            status: "code_not_pending",
            reason: "Activation code not found in pending codes (may already be used or invalid)",
            received: entry.amount,
          });
          continue;
        }

        // Verify payment amount matches expected amount
        const expectedAmount = codeData.iskAmount;
        const receivedAmount = entry.amount;

        if (receivedAmount < expectedAmount * 0.99) {
          // Payment too low (allowing 1% tolerance for rounding)
          // Don't mark as processed - admin may want to handle this manually
          processedPayments.push({
            transactionId: entry.id,
            code: activationCode,
            status: "insufficient_payment",
            expected: expectedAmount,
            received: receivedAmount,
            characterName: codeData.characterName,
          });
          continue;
        }

        // Calculate duration based on amount paid
        const durationDays = codeData.iskAmount >= PRO_PRICING.monthlyIsk ? 30 : 7;

        // Get existing subscription to extend if active
        const existingSub = await storage.getProSubscription(codeData.characterId);
        let newExpiresAt: Date;

        if (existingSub?.status === "active" && existingSub.expiresAt) {
          newExpiresAt = new Date(existingSub.expiresAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
        } else {
          newExpiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
        }

        // Create/update subscription
        const subscription: ProSubscription = {
          characterId: codeData.characterId,
          characterName: codeData.characterName,
          status: "active",
          expiresAt: newExpiresAt,
          activatedAt: new Date(),
          activationCode: activationCode,
          giftedBy: null,
          giftedAt: null,
        };

        await storage.createOrUpdateProSubscription(subscription);
        await storage.markCodeAsUsed(activationCode);
        await storage.markTransactionProcessed(entry.id);

        activatedSubscriptions.push({
          characterId: codeData.characterId,
          characterName: codeData.characterName,
          code: activationCode,
          durationDays,
          expiresAt: newExpiresAt,
          iskPaid: receivedAmount,
        });

        // Remove from pending map
        pendingCodeMap.delete(activationCode);
      }

      res.json({
        success: true,
        message: `Auto-check complete. ${activatedSubscriptions.length} subscription(s) activated.`,
        activatedSubscriptions,
        insufficientPayments: processedPayments,
        skippedPayments,
        remainingPendingCodes: pendingCodeMap.size,
      });
    } catch (error) {
      console.error("Auto-check payments error:", error);
      res.status(500).json({ error: "Failed to check wallet for payments" });
    }
  });

  // Admin: Get all gifts history
  app.get("/api/admin/gifts", requireAdmin, async (req: Request, res: Response) => {
    const gifts = await storage.getAllGifts();
    res.json({ gifts });
  });

  // Admin: Get all subscriptions
  app.get("/api/admin/subscriptions", requireAdmin, async (req: Request, res: Response) => {
    const subscriptions = await storage.getAllSubscriptions();
    res.json({ subscriptions, count: subscriptions.length });
  });

  // Admin: Get all activation codes
  app.get("/api/admin/activation-codes", requireAdmin, async (req: Request, res: Response) => {
    const codes = await storage.getAllActivationCodes();
    res.json({ codes, count: codes.length });
  });

  // Admin: Get statistics
  app.get("/api/admin/statistics", requireAdmin, async (req: Request, res: Response) => {
    const stats = await storage.getStatistics();
    res.json({ statistics: stats });
  });

  // Admin: Get expanded system stats with uptime, ESI status, etc.
  app.get("/api/admin/system-stats", requireAdmin, async (req: Request, res: Response) => {
    const sessionStats = await storage.getSessionStatistics();
    const proStats = await storage.getStatistics();
    
    const uptimeSeconds = process.uptime();
    const uptimeDays = Math.floor(uptimeSeconds / 86400);
    const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);
    const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
    const uptimeSecs = Math.floor(uptimeSeconds % 60);
    
    // Format uptime - show most relevant units
    let formattedUptime: string;
    if (uptimeDays > 0) {
      formattedUptime = `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`;
    } else if (uptimeHours > 0) {
      formattedUptime = `${uptimeHours}h ${uptimeMinutes}m ${uptimeSecs}s`;
    } else if (uptimeMinutes > 0) {
      formattedUptime = `${uptimeMinutes}m ${uptimeSecs}s`;
    } else {
      formattedUptime = `${uptimeSecs}s`;
    }
    
    let esiStatus: { status: string; message: string; serverVersion?: string; startTime?: string } = { 
      status: 'unknown', 
      message: 'Not checked' 
    };
    try {
      const esiResponse = await fetch('https://esi.evetech.net/latest/status/');
      if (esiResponse.ok) {
        const esiData = await esiResponse.json();
        esiStatus = { 
          status: 'online', 
          message: `${esiData.players?.toLocaleString() || 'N/A'} players online`,
          serverVersion: esiData.server_version,
          startTime: esiData.start_time
        };
      } else {
        esiStatus = { status: 'degraded', message: 'ESI API responding slowly' };
      }
    } catch {
      esiStatus = { status: 'offline', message: 'Unable to reach ESI API' };
    }
    
    res.json({
      uptime: {
        seconds: uptimeSeconds,
        formatted: formattedUptime,
        startedAt: new Date(Date.now() - uptimeSeconds * 1000).toISOString(),
      },
      esiStatus,
      sessions: sessionStats,
      pro: proStats,
      environment: process.env.NODE_ENV || 'development',
      memoryUsage: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    });
  });

  // Admin: Get all ratting sessions (global view)
  const getAllSessionsSchema = z.object({
    limit: z.string().optional().transform(v => v ? parseInt(v, 10) : 50),
    offset: z.string().optional().transform(v => v ? parseInt(v, 10) : 0),
    characterName: z.string().optional(),
    isActive: z.string().optional().transform(v => v === 'true' ? true : v === 'false' ? false : undefined),
    minIsk: z.string().optional().transform(v => v ? parseInt(v, 10) : undefined),
    maxIsk: z.string().optional().transform(v => v ? parseInt(v, 10) : undefined),
  });

  app.get("/api/admin/sessions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const options = getAllSessionsSchema.parse(req.query);
      const result = await storage.getAllRattingSessions(options);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to fetch sessions' });
    }
  });

  // Admin: Update a session
  const adminUpdateSessionSchema = z.object({
    sessionId: z.string(),
    totalIsk: z.number().optional(),
    bountyIsk: z.number().optional(),
    lootIsk: z.number().optional(),
    killCount: z.number().optional(),
  });

  app.post("/api/admin/update-session", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { sessionId, ...updates } = adminUpdateSessionSchema.parse(req.body);
      const session = await storage.adminUpdateRattingSession(sessionId, updates);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json({ success: true, session, message: 'Session updated' });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update session' });
    }
  });

  // Admin: Delete a session
  const adminDeleteSessionSchema = z.object({
    sessionId: z.string(),
  });

  app.post("/api/admin/delete-session", requireAdmin, async (req: Request, res: Response) => {
    try {
      const adminChar = req.session.character!;
      const { sessionId } = adminDeleteSessionSchema.parse(req.body);
      const success = await storage.adminDeleteRattingSession(sessionId);
      if (!success) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      // Log audit
      await storage.createAuditLog({
        adminCharacterId: adminChar.characterId,
        adminCharacterName: adminChar.characterName,
        action: 'delete_session',
        details: { sessionId },
      });
      
      res.json({ success: true, message: 'Session deleted' });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to delete session' });
    }
  });

  // Admin: Revoke a subscription
  const revokeSubscriptionSchema = z.object({
    characterId: z.union([z.number(), z.string()]).transform(val => {
      const num = typeof val === "string" ? parseInt(val, 10) : val;
      if (isNaN(num) || num <= 0) throw new Error("Invalid character ID");
      return num;
    }),
  });

  app.post("/api/admin/revoke-subscription", requireAdmin, async (req: Request, res: Response) => {
    try {
      const adminChar = req.session.character!;
      const { characterId } = revokeSubscriptionSchema.parse(req.body);
      const existingSub = await storage.getProSubscription(characterId);
      await storage.revokeSubscription(characterId);
      
      // Log audit
      await storage.createAuditLog({
        adminCharacterId: adminChar.characterId,
        adminCharacterName: adminChar.characterName,
        action: 'revoke_subscription',
        targetCharacterId: characterId,
        targetCharacterName: existingSub?.characterName || String(characterId),
        details: {},
      });
      
      res.json({ 
        success: true, 
        message: `Subscription revoked for character ${characterId}` 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid character ID" });
        return;
      }
      res.status(500).json({ error: "Failed to revoke subscription" });
    }
  });

  // Admin: Extend a subscription
  const extendSubscriptionSchema = z.object({
    characterId: z.union([z.number(), z.string()]).transform(val => {
      const num = typeof val === "string" ? parseInt(val, 10) : val;
      if (isNaN(num) || num <= 0) throw new Error("Invalid character ID");
      return num;
    }),
    days: z.union([z.number(), z.string()]).transform(val => {
      const num = typeof val === "string" ? parseInt(val, 10) : val;
      if (isNaN(num) || num <= 0) throw new Error("Invalid days");
      return num;
    }),
  });

  app.post("/api/admin/extend-subscription", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { characterId, days } = extendSubscriptionSchema.parse(req.body);
      
      // Check if subscription exists first
      const existingSub = await storage.getProSubscription(characterId);
      if (!existingSub) {
        res.status(404).json({ error: "Subscription not found for this character ID" });
        return;
      }
      
      // Check if subscription was revoked - prevent reactivation without explicit acknowledgment
      if (existingSub.status === "revoked") {
        res.status(400).json({ error: "Cannot extend a revoked subscription. Use gift to create a new subscription." });
        return;
      }
      
      const subscription = await storage.extendSubscription(characterId, days);
      
      if (!subscription) {
        res.status(500).json({ error: "Failed to extend subscription" });
        return;
      }
      
      // Log audit
      const adminChar = req.session.character!;
      await storage.createAuditLog({
        adminCharacterId: adminChar.characterId,
        adminCharacterName: adminChar.characterName,
        action: 'extend_subscription',
        targetCharacterId: characterId,
        targetCharacterName: subscription.characterName,
        details: { days },
      });
      
      res.json({ 
        success: true, 
        message: `Extended subscription for ${subscription.characterName} by ${days} days`,
        subscription,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid input" });
        return;
      }
      res.status(500).json({ error: "Failed to extend subscription" });
    }
  });

  // ============ SPECIAL BADGES (Admin-granted) ============
  
  const validBadgeTypes = Object.keys(SPECIAL_BADGE_TYPES) as SpecialBadgeType[];
  
  const grantBadgeSchema = z.object({
    characterId: z.union([z.number(), z.string()]).transform(val => {
      const num = typeof val === "string" ? parseInt(val, 10) : val;
      if (isNaN(num) || num <= 0) throw new Error("Invalid character ID");
      return num;
    }),
    characterName: z.string().min(1).max(100).transform(val => val.trim()),
    badgeType: z.enum(validBadgeTypes as [SpecialBadgeType, ...SpecialBadgeType[]]),
    note: z.string().max(200).nullable().optional().transform(val => val?.trim() || null),
  });
  
  // Admin: Grant special badge to a character
  app.post("/api/admin/grant-badge", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parseResult = grantBadgeSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ 
          error: "Validation failed", 
          details: parseResult.error.errors.map(e => e.message).join(", ")
        });
        return;
      }
      
      const { characterId, characterName, badgeType, note } = parseResult.data;
      const adminCharacter = req.session.character!;
      
      // Check if character already has this badge
      const hasBadge = await storage.hasSpecialBadge(characterId, badgeType);
      if (hasBadge) {
        res.status(400).json({ error: `Character already has the ${SPECIAL_BADGE_TYPES[badgeType].name} badge` });
        return;
      }
      
      const badge = await storage.grantSpecialBadge({
        characterId,
        characterName,
        badgeType,
        grantedByAdminId: adminCharacter.characterId,
        grantedByAdminName: adminCharacter.characterName,
        note,
      });
      
      // Log audit
      await storage.createAuditLog({
        adminCharacterId: adminCharacter.characterId,
        adminCharacterName: adminCharacter.characterName,
        action: 'grant_badge',
        targetCharacterId: characterId,
        targetCharacterName: characterName,
        details: { badgeType, badgeName: SPECIAL_BADGE_TYPES[badgeType].name },
      });
      
      res.json({
        success: true,
        message: `Granted ${SPECIAL_BADGE_TYPES[badgeType].name} badge to ${characterName}`,
        badge,
      });
    } catch (error) {
      console.error("Grant badge error:", error);
      res.status(500).json({ error: "Failed to grant badge" });
    }
  });
  
  // Admin: Revoke special badge from a character
  app.post("/api/admin/revoke-badge", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { characterId, badgeType } = req.body;
      
      const numCharId = typeof characterId === "string" ? parseInt(characterId, 10) : characterId;
      if (isNaN(numCharId) || numCharId <= 0) {
        res.status(400).json({ error: "Invalid character ID" });
        return;
      }
      
      if (!validBadgeTypes.includes(badgeType)) {
        res.status(400).json({ error: "Invalid badge type" });
        return;
      }
      
      await storage.revokeSpecialBadge(numCharId, badgeType);
      
      // Log audit
      const adminCharacter = req.session.character!;
      await storage.createAuditLog({
        adminCharacterId: adminCharacter.characterId,
        adminCharacterName: adminCharacter.characterName,
        action: 'revoke_badge',
        targetCharacterId: numCharId,
        targetCharacterName: String(numCharId),
        details: { badgeType, badgeName: SPECIAL_BADGE_TYPES[badgeType as SpecialBadgeType].name },
      });
      
      res.json({
        success: true,
        message: `Revoked ${SPECIAL_BADGE_TYPES[badgeType as SpecialBadgeType].name} badge from character ${numCharId}`,
      });
    } catch (error) {
      console.error("Revoke badge error:", error);
      res.status(500).json({ error: "Failed to revoke badge" });
    }
  });
  
  // Admin: Get all special badges
  app.get("/api/admin/special-badges", requireAdmin, async (req: Request, res: Response) => {
    const badges = await storage.getAllSpecialBadges();
    res.json({ badges, count: badges.length });
  });
  
  // Public: Get special badges for a character (for displaying on profile/cards)
  app.get("/api/user/special-badges/:characterId", async (req: Request, res: Response) => {
    const characterId = parseInt(req.params.characterId, 10);
    if (isNaN(characterId)) {
      res.status(400).json({ error: "Invalid character ID" });
      return;
    }
    
    const badges = await storage.getSpecialBadges(characterId);
    
    // Return badge data with type definitions
    const badgesWithInfo = badges.map(badge => ({
      ...badge,
      ...SPECIAL_BADGE_TYPES[badge.badgeType],
    }));
    
    res.json({ badges: badgesWithInfo });
  });
  
  // Get current user's special badges
  app.get("/api/user/my-badges", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    
    const badges = await storage.getSpecialBadges(req.session.character.characterId);
    
    const badgesWithInfo = badges.map(badge => ({
      ...badge,
      ...SPECIAL_BADGE_TYPES[badge.badgeType],
    }));
    
    res.json({ badges: badgesWithInfo });
  });
  
  // Get special badge type definitions (public)
  app.get("/api/special-badge-types", (req: Request, res: Response) => {
    res.json({ types: SPECIAL_BADGE_TYPES });
  });
  
  // ============ USER PROFILE & SETTINGS ============
  
  // Get user profile with tenure info
  app.get("/api/user/profile", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    
    const { characterId, characterName } = req.session.character;
    
    // Get or create profile
    let profile = await storage.getUserProfile(characterId);
    if (!profile) {
      profile = await storage.createOrUpdateUserProfile({
        characterId,
        characterName,
        firstLoginAt: new Date(),
        corpTaxRate: 0,
      });
    }
    
    // Get PRO subscription info for tenure
    const subscription = await storage.getProSubscription(characterId);
    const proMemberSince = subscription?.activatedAt || null;
    
    // Get special badges
    const badges = await storage.getSpecialBadges(characterId);
    const badgesWithInfo = badges.map(badge => ({
      ...badge,
      ...SPECIAL_BADGE_TYPES[badge.badgeType],
    }));
    
    res.json({
      profile: {
        ...profile,
        proMemberSince,
        isPro: subscription?.status === "active",
        proExpiresAt: subscription?.expiresAt || null,
      },
      specialBadges: badgesWithInfo,
    });
  });
  
  // Update corp tax rate
  app.post("/api/user/corp-tax-rate", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    
    const { taxRate } = req.body;
    const numRate = typeof taxRate === "string" ? parseFloat(taxRate) : taxRate;
    
    if (isNaN(numRate) || numRate < 0 || numRate > 100) {
      res.status(400).json({ error: "Tax rate must be between 0 and 100" });
      return;
    }
    
    const { characterId, characterName } = req.session.character;
    
    // Ensure profile exists
    let profile = await storage.getUserProfile(characterId);
    if (!profile) {
      profile = await storage.createOrUpdateUserProfile({
        characterId,
        characterName,
        firstLoginAt: new Date(),
        corpTaxRate: numRate,
      });
    } else {
      await storage.updateCorpTaxRate(characterId, numRate);
      profile.corpTaxRate = numRate;
    }
    
    res.json({ 
      success: true, 
      corpTaxRate: numRate,
      message: `Corp tax rate set to ${numRate}%`,
    });
  });
  
  // Get user notification preferences
  app.get("/api/user/preferences", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    
    const { characterId, characterName } = req.session.character;
    
    // Get or create profile to get preferences
    let profile = await storage.getUserProfile(characterId);
    if (!profile) {
      profile = await storage.createOrUpdateUserProfile({
        characterId,
        characterName,
        firstLoginAt: new Date(),
        corpTaxRate: 0,
      });
    }
    
    res.json({
      emailNotifications: profile.emailNotifications ?? true,
      proExpiryReminders: profile.proExpiryReminders ?? true,
      supportTicketUpdates: profile.supportTicketUpdates ?? true,
    });
  });
  
  // Update user notification preferences
  app.patch("/api/user/preferences", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    
    const { characterId, characterName } = req.session.character;
    const { emailNotifications, proExpiryReminders, supportTicketUpdates } = req.body;
    
    // Get or create profile
    let profile = await storage.getUserProfile(characterId);
    if (!profile) {
      profile = await storage.createOrUpdateUserProfile({
        characterId,
        characterName,
        firstLoginAt: new Date(),
        corpTaxRate: 0,
      });
    }
    
    // Update notification preferences
    await storage.updateUserNotificationPreferences(characterId, {
      emailNotifications: emailNotifications !== undefined ? emailNotifications : profile.emailNotifications,
      proExpiryReminders: proExpiryReminders !== undefined ? proExpiryReminders : profile.proExpiryReminders,
      supportTicketUpdates: supportTicketUpdates !== undefined ? supportTicketUpdates : profile.supportTicketUpdates,
    });
    
    res.json({ success: true });
  });

  // Admin: Generate redeemable gift codes
  const validBadgeTypesForGift = Object.keys(SPECIAL_BADGE_TYPES) as SpecialBadgeType[];
  const validThemes = Object.keys(FACTION_THEMES) as FactionTheme[];
  const validTiles = Object.keys(BONUS_TILES) as BonusTile[];

  const generateGiftCodeSchema = z.object({
    durationDays: z.number().int().min(1).max(365),
    note: z.string().max(200).optional(),
    badgeType: z.enum(validBadgeTypesForGift as [SpecialBadgeType, ...SpecialBadgeType[]]).optional(),
    themeUnlock: z.enum(validThemes as [FactionTheme, ...FactionTheme[]]).optional(),
    bonusTiles: z.array(z.enum(validTiles as [BonusTile, ...BonusTile[]])).optional(),
  });
  
  app.post("/api/admin/generate-gift-code", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parseResult = generateGiftCodeSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ 
          error: "Validation failed", 
          details: parseResult.error.errors.map(e => e.message).join(", ")
        });
        return;
      }
      
      const { durationDays, note, badgeType, themeUnlock, bonusTiles } = parseResult.data;
      const adminCharacter = req.session.character!;
      const code = generateActivationCode();
      
      const codeData: ProActivationCode = {
        code,
        characterId: 0, // Not tied to a specific character
        characterName: "Gift Code",
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Code valid for 30 days
        iskAmount: 0, // No ISK payment required
        status: "pending",
        usedAt: null,
        isGiftCode: true,
        giftDurationDays: durationDays,
        giftNote: note || undefined,
        createdByAdminId: adminCharacter.characterId,
        createdByAdminName: adminCharacter.characterName,
        giftBadgeType: badgeType,
        giftThemeUnlock: themeUnlock,
        giftBonusTiles: bonusTiles,
      };
      
      await storage.createActivationCode(codeData);
      
      res.json({
        success: true,
        code: codeData.code,
        durationDays,
        badgeType,
        themeUnlock,
        bonusTiles,
        expiresAt: codeData.expiresAt,
        note: note || null,
        message: `Gift code generated: ${code} (${durationDays} days of PRO)`,
      });
    } catch (error) {
      console.error("Generate gift code error:", error);
      res.status(500).json({ error: "Failed to generate gift code" });
    }
  });

  // =====================================
  // Admin User Management Routes
  // =====================================

  // Admin: Get all users with filtering and pagination
  const getUsersQuerySchema = z.object({
    limit: z.string().optional().transform(v => v ? parseInt(v, 10) : 50),
    offset: z.string().optional().transform(v => v ? parseInt(v, 10) : 0),
    search: z.string().optional(),
    activeOnly: z.string().optional().transform(v => v === 'true'),
    adminsOnly: z.string().optional().transform(v => v === 'true'),
    suspendedOnly: z.string().optional().transform(v => v === 'true'),
    proOnly: z.string().optional().transform(v => v === 'true'),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  });

  app.get("/api/admin/users", requireAdmin, async (req: Request, res: Response) => {
    try {
      const options = getUsersQuerySchema.parse(req.query);
      const result = await storage.getAllUsers(options);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to fetch users' });
    }
  });

  // Admin: Get user details
  app.get("/api/admin/users/:characterId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const characterId = parseInt(req.params.characterId, 10);
      if (isNaN(characterId)) {
        return res.status(400).json({ error: 'Invalid character ID' });
      }
      const userDetails = await storage.getUserDetails(characterId);
      if (!userDetails) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(userDetails);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch user details' });
    }
  });

  // Admin: Get active users count
  app.get("/api/admin/users-active-count", requireAdmin, async (req: Request, res: Response) => {
    try {
      const count = await storage.getActiveUsersCount();
      res.json({ count });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to get active users count' });
    }
  });

  // Admin: Create admin note for user
  const createNoteSchema = z.object({
    targetCharacterId: z.number(),
    targetCharacterName: z.string(),
    content: z.string().min(1).max(2000),
    isPinned: z.boolean().optional().default(false),
  });

  app.post("/api/admin/notes", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parseResult = createNoteSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'Invalid note data', details: parseResult.error.errors });
      }
      const adminCharacter = req.session.character!;
      const note = await storage.createAdminNote({
        ...parseResult.data,
        authorCharacterId: adminCharacter.characterId,
        authorCharacterName: adminCharacter.characterName,
      });

      // Log audit
      await storage.createAuditLog({
        adminCharacterId: adminCharacter.characterId,
        adminCharacterName: adminCharacter.characterName,
        action: 'create_note',
        targetCharacterId: parseResult.data.targetCharacterId,
        targetCharacterName: parseResult.data.targetCharacterName,
        details: { noteId: note.id, isPinned: note.isPinned },
      });

      res.json(note);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create note' });
    }
  });

  // Admin: Get notes for a user
  app.get("/api/admin/notes/:characterId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const characterId = parseInt(req.params.characterId, 10);
      if (isNaN(characterId)) {
        return res.status(400).json({ error: 'Invalid character ID' });
      }
      const notes = await storage.getAdminNotes(characterId);
      res.json({ notes });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch notes' });
    }
  });

  // Admin: Update note
  const updateNoteSchema = z.object({
    content: z.string().min(1).max(2000).optional(),
    isPinned: z.boolean().optional(),
  });

  app.patch("/api/admin/notes/:noteId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parseResult = updateNoteSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'Invalid update data' });
      }
      const note = await storage.updateAdminNote(req.params.noteId, parseResult.data);
      if (!note) {
        return res.status(404).json({ error: 'Note not found' });
      }
      res.json(note);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update note' });
    }
  });

  // Admin: Delete note
  app.delete("/api/admin/notes/:noteId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const adminCharacter = req.session.character!;
      const noteToDelete = await storage.getAdminNoteById(req.params.noteId);
      
      const success = await storage.deleteAdminNote(req.params.noteId);
      if (!success) {
        return res.status(404).json({ error: 'Note not found' });
      }

      // Log audit
      if (noteToDelete) {
        await storage.createAuditLog({
          adminCharacterId: adminCharacter.characterId,
          adminCharacterName: adminCharacter.characterName,
          action: 'delete_note',
          targetCharacterId: noteToDelete.targetCharacterId,
          targetCharacterName: noteToDelete.targetCharacterName,
          details: { noteId: req.params.noteId },
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete note' });
    }
  });

  // Admin: Suspend user
  const suspendUserSchema = z.object({
    characterId: z.number(),
    characterName: z.string(),
    reason: z.string().min(1).max(500),
    durationHours: z.number().optional(), // null = permanent
  });

  app.post("/api/admin/suspensions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parseResult = suspendUserSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'Invalid suspension data', details: parseResult.error.errors });
      }

      const adminCharacter = req.session.character!;
      const { characterId, characterName, reason, durationHours } = parseResult.data;

      // Check if user is already suspended
      const existingSuspension = await storage.getActiveSuspension(characterId);
      if (existingSuspension) {
        return res.status(400).json({ error: 'User is already suspended' });
      }

      const expiresAt = durationHours ? new Date(Date.now() + durationHours * 60 * 60 * 1000) : null;

      const suspension = await storage.createSuspension({
        characterId,
        characterName,
        suspendedByAdminId: adminCharacter.characterId,
        suspendedByAdminName: adminCharacter.characterName,
        reason,
        expiresAt,
      });

      // Log audit
      await storage.createAuditLog({
        adminCharacterId: adminCharacter.characterId,
        adminCharacterName: adminCharacter.characterName,
        action: 'suspend_user',
        targetCharacterId: characterId,
        targetCharacterName: characterName,
        details: { reason, durationHours, expiresAt, suspensionId: suspension.id },
      });

      res.json(suspension);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create suspension' });
    }
  });

  // Admin: Get suspension history for a user
  app.get("/api/admin/suspensions/:characterId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const characterId = parseInt(req.params.characterId, 10);
      if (isNaN(characterId)) {
        return res.status(400).json({ error: 'Invalid character ID' });
      }
      const history = await storage.getSuspensionHistory(characterId);
      res.json({ suspensions: history });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch suspension history' });
    }
  });

  // Admin: Get all active suspensions
  app.get("/api/admin/suspensions-active", requireAdmin, async (req: Request, res: Response) => {
    try {
      const suspensions = await storage.getAllActiveSuspensions();
      res.json({ suspensions });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch active suspensions' });
    }
  });

  // Admin: Lift suspension
  app.post("/api/admin/suspensions/:suspensionId/lift", requireAdmin, async (req: Request, res: Response) => {
    try {
      const adminCharacter = req.session.character!;
      const suspension = await storage.liftSuspension(
        req.params.suspensionId,
        adminCharacter.characterId,
        adminCharacter.characterName
      );

      if (!suspension) {
        return res.status(404).json({ error: 'Suspension not found' });
      }

      // Log audit
      await storage.createAuditLog({
        adminCharacterId: adminCharacter.characterId,
        adminCharacterName: adminCharacter.characterName,
        action: 'lift_suspension',
        targetCharacterId: suspension.characterId,
        targetCharacterName: suspension.characterName,
        details: { suspensionId: suspension.id, originalReason: suspension.reason },
      });

      res.json(suspension);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to lift suspension' });
    }
  });

  // Admin: Get audit log
  const getAuditLogSchema = z.object({
    limit: z.string().optional().transform(v => v ? parseInt(v, 10) : 50),
    offset: z.string().optional().transform(v => v ? parseInt(v, 10) : 0),
    adminCharacterId: z.string().optional().transform(v => v ? parseInt(v, 10) : undefined),
    targetCharacterId: z.string().optional().transform(v => v ? parseInt(v, 10) : undefined),
    action: z.string().optional(),
    startDate: z.string().optional().transform(v => v ? new Date(v) : undefined),
    endDate: z.string().optional().transform(v => v ? new Date(v) : undefined),
  });

  app.get("/api/admin/audit-log", requireAdmin, async (req: Request, res: Response) => {
    try {
      const options = getAuditLogSchema.parse(req.query);
      const result = await storage.getAuditLog(options);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to fetch audit log' });
    }
  });

  // Admin: Get audit log for specific user
  app.get("/api/admin/audit-log/user/:characterId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const characterId = parseInt(req.params.characterId, 10);
      if (isNaN(characterId)) {
        return res.status(400).json({ error: 'Invalid character ID' });
      }
      const logs = await storage.getAuditLogForUser(characterId);
      res.json({ logs });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch user audit log' });
    }
  });

  // =====================================
  // PHOTON Code System Routes
  // =====================================

  // Validation schema for PHOTON code generation
  const photonCodeGenerateSchema = z.object({
    codeType: z.enum(["pro_subscription", "theme_unlock", "badge_grant", "tile_unlock", "bundle"]).default("pro_subscription"),
    proDurationDays: z.number().int().min(1).max(365).optional().nullable(),
    maxRedemptions: z.number().int().min(0).max(10000).default(1), // 0 = unlimited
    expiresAt: z.string().datetime().optional().nullable(),
    neverExpires: z.boolean().default(false),
    badgeGrants: z.array(z.string()).default([]),
    themeUnlocks: z.array(z.string()).default([]),
    tileUnlocks: z.array(z.string()).default([]),
    note: z.string().max(500).optional().nullable(),
    batchCount: z.number().int().min(1).max(100).default(1),
  });

  // Admin: Generate PHOTON activation codes
  app.post("/api/admin/photon-codes", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parseResult = photonCodeGenerateSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: "Validation failed",
          details: parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(", ")
        });
        return;
      }

      const data = parseResult.data;
      const adminCharacter = req.session.character!;

      // Determine expiration
      let expiresAt: Date | null = null;
      if (!data.neverExpires && data.expiresAt) {
        expiresAt = new Date(data.expiresAt);
      } else if (!data.neverExpires) {
        // Default: 30 days from now
        expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }

      // Generate batch of codes
      const generatedCodes: PhotonCodeData[] = [];
      for (let i = 0; i < data.batchCount; i++) {
        const code = generatePhotonCode();
        
        const codeData = await storage.createPhotonCode({
          code,
          codeType: data.codeType,
          createdByAdminId: adminCharacter.characterId,
          createdByAdminName: adminCharacter.characterName,
          maxRedemptions: data.maxRedemptions,
          expiresAt,
          proDurationDays: data.proDurationDays ?? null,
          badgeGrants: data.badgeGrants,
          themeUnlocks: data.themeUnlocks,
          tileUnlocks: data.tileUnlocks,
          note: data.note ?? null,
        });

        // Log the creation
        await storage.logPhotonActivity({
          codeId: codeData.id,
          code: codeData.code,
          action: "created",
          actorCharacterId: adminCharacter.characterId,
          actorCharacterName: adminCharacter.characterName,
          details: {
            codeType: data.codeType,
            proDurationDays: data.proDurationDays,
            maxRedemptions: data.maxRedemptions,
            expiresAt: expiresAt?.toISOString(),
            badgeGrants: data.badgeGrants,
            themeUnlocks: data.themeUnlocks,
            tileUnlocks: data.tileUnlocks,
            batchIndex: i + 1,
            batchTotal: data.batchCount,
          },
        });

        generatedCodes.push(codeData);
      }
      
      // Log audit for batch generation
      await storage.createAuditLog({
        adminCharacterId: adminCharacter.characterId,
        adminCharacterName: adminCharacter.characterName,
        action: 'generate_photon_codes',
        details: {
          batchCount: data.batchCount,
          codeType: data.codeType,
          proDurationDays: data.proDurationDays,
          maxRedemptions: data.maxRedemptions,
        },
      });

      res.json({
        success: true,
        codes: generatedCodes,
        count: generatedCodes.length,
        message: `Generated ${generatedCodes.length} PHOTON code(s)`,
      });
    } catch (error) {
      console.error("Generate PHOTON code error:", error);
      res.status(500).json({ error: "Failed to generate PHOTON code" });
    }
  });

  // Admin: Get all PHOTON codes
  app.get("/api/admin/photon-codes", requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string | undefined;

      const result = await storage.getAllPhotonCodes({ limit, offset, status });
      
      res.json({
        success: true,
        codes: result.codes,
        total: result.total,
        limit,
        offset,
      });
    } catch (error) {
      console.error("Get PHOTON codes error:", error);
      res.status(500).json({ error: "Failed to get PHOTON codes" });
    }
  });

  // Admin: Get single PHOTON code with redemptions
  app.get("/api/admin/photon-codes/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const code = await storage.getPhotonCodeById(req.params.id);
      if (!code) {
        res.status(404).json({ error: "Code not found" });
        return;
      }

      const redemptions = await storage.getRedemptionsByCode(code.id);

      res.json({
        success: true,
        code,
        redemptions,
      });
    } catch (error) {
      console.error("Get PHOTON code error:", error);
      res.status(500).json({ error: "Failed to get PHOTON code" });
    }
  });

  // Admin: Revoke a PHOTON code
  app.put("/api/admin/photon-codes/:id/revoke", requireAdmin, async (req: Request, res: Response) => {
    try {
      const code = await storage.getPhotonCodeById(req.params.id);
      if (!code) {
        res.status(404).json({ error: "Code not found" });
        return;
      }

      if (code.status === "revoked") {
        res.status(400).json({ error: "Code is already revoked" });
        return;
      }

      const adminCharacter = req.session.character!;
      const updatedCode = await storage.revokePhotonCode(code.id);

      // Log the revocation
      await storage.logPhotonActivity({
        codeId: code.id,
        code: code.code,
        action: "revoked",
        actorCharacterId: adminCharacter.characterId,
        actorCharacterName: adminCharacter.characterName,
        details: {
          previousStatus: code.status,
          redemptionCount: code.currentRedemptions,
        },
      });
      
      // Log audit
      await storage.createAuditLog({
        adminCharacterId: adminCharacter.characterId,
        adminCharacterName: adminCharacter.characterName,
        action: 'revoke_photon_code',
        details: { codeId: code.id, code: code.code },
      });

      res.json({
        success: true,
        code: updatedCode,
        message: "Code revoked successfully",
      });
    } catch (error) {
      console.error("Revoke PHOTON code error:", error);
      res.status(500).json({ error: "Failed to revoke PHOTON code" });
    }
  });

  // Admin: Get PHOTON activity log
  app.get("/api/admin/photon-activity-log", requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const action = req.query.action as string | undefined;
      const codeId = req.query.codeId as string | undefined;

      const result = await storage.getPhotonActivityLog({ limit, offset, action, codeId });

      res.json({
        success: true,
        logs: result.logs,
        total: result.total,
        limit,
        offset,
      });
    } catch (error) {
      console.error("Get PHOTON activity log error:", error);
      res.status(500).json({ error: "Failed to get activity log" });
    }
  });

  // User: Redeem a PHOTON activation code
  const redeemPhotonCodeSchema = z.object({
    code: z.string()
      .transform(s => s.trim().toUpperCase())
      .refine(s => /^PHOTON-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(s), {
        message: "Invalid code format. Expected: PHOTON-XXXX-XXXX-XXXX"
      }),
  });

  app.post("/api/pro/redeem-photon-code", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const parseResult = redeemPhotonCodeSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: parseResult.error.errors[0]?.message || "Invalid code format"
      });
      return;
    }

    const normalizedCode = parseResult.data.code;
    const { characterId, characterName } = req.session.character;

    try {
      // Find the code
      const codeData = await storage.getPhotonCode(normalizedCode);
      if (!codeData) {
        // Log failed attempt
        await storage.logPhotonActivity({
          codeId: null,
          code: normalizedCode,
          action: "failed_redemption",
          actorCharacterId: characterId,
          actorCharacterName: characterName,
          details: { reason: "code_not_found" },
        });
        res.status(404).json({ error: "Activation code not found" });
        return;
      }

      // Check if code is active
      if (codeData.status !== "active") {
        await storage.logPhotonActivity({
          codeId: codeData.id,
          code: normalizedCode,
          action: "failed_redemption",
          actorCharacterId: characterId,
          actorCharacterName: characterName,
          details: { reason: `code_status_${codeData.status}` },
        });
        res.status(400).json({ error: `This code is ${codeData.status}` });
        return;
      }

      // Check expiration
      if (codeData.expiresAt && new Date() > codeData.expiresAt) {
        await storage.updatePhotonCodeStatus(codeData.id, "expired");
        await storage.logPhotonActivity({
          codeId: codeData.id,
          code: normalizedCode,
          action: "failed_redemption",
          actorCharacterId: characterId,
          actorCharacterName: characterName,
          details: { reason: "code_expired", expiredAt: codeData.expiresAt.toISOString() },
        });
        res.status(400).json({ error: "This code has expired" });
        return;
      }

      // Check if user already redeemed this code
      const alreadyRedeemed = await storage.hasCharacterRedeemedCode(codeData.id, characterId);
      if (alreadyRedeemed) {
        await storage.logPhotonActivity({
          codeId: codeData.id,
          code: normalizedCode,
          action: "failed_redemption",
          actorCharacterId: characterId,
          actorCharacterName: characterName,
          details: { reason: "already_redeemed" },
        });
        res.status(400).json({ error: "You have already redeemed this code" });
        return;
      }

      // Check max redemptions (0 = unlimited)
      if (codeData.maxRedemptions > 0 && codeData.currentRedemptions >= codeData.maxRedemptions) {
        await storage.logPhotonActivity({
          codeId: codeData.id,
          code: normalizedCode,
          action: "failed_redemption",
          actorCharacterId: characterId,
          actorCharacterName: characterName,
          details: { reason: "max_redemptions_reached", max: codeData.maxRedemptions },
        });
        res.status(400).json({ error: "This code has reached its maximum redemptions" });
        return;
      }

      // Process the redemption based on code type
      const results: Record<string, unknown> = {};

      // Handle PRO subscription grant
      if (codeData.codeType === "pro_subscription" || codeData.codeType === "bundle") {
        if (codeData.proDurationDays && codeData.proDurationDays > 0) {
          const existingSub = await storage.getProSubscription(characterId);
          let newExpiresAt: Date;

          if (existingSub?.status === "active" && existingSub.expiresAt) {
            newExpiresAt = new Date(existingSub.expiresAt.getTime() + codeData.proDurationDays * 24 * 60 * 60 * 1000);
          } else {
            newExpiresAt = new Date(Date.now() + codeData.proDurationDays * 24 * 60 * 60 * 1000);
          }

          const subscription: ProSubscription = {
            characterId,
            characterName,
            status: "active",
            expiresAt: newExpiresAt,
            activatedAt: existingSub?.activatedAt || new Date(),
            activationCode: normalizedCode,
            giftedBy: codeData.createdByAdminId,
            giftedAt: new Date(),
          };

          await storage.createOrUpdateProSubscription(subscription);
          results.proDays = codeData.proDurationDays;
          results.proExpiresAt = newExpiresAt.toISOString();
        }
      }

      // Handle badge grants
      if (codeData.badgeGrants && codeData.badgeGrants.length > 0) {
        const grantedBadges: string[] = [];
        for (const badgeKey of codeData.badgeGrants) {
          try {
            const hasExisting = await storage.hasSpecialBadge(characterId, badgeKey as SpecialBadgeType);
            if (!hasExisting) {
              await storage.grantSpecialBadge({
                characterId,
                characterName,
                badgeType: badgeKey as SpecialBadgeType,
                grantedByAdminId: codeData.createdByAdminId,
                grantedByAdminName: codeData.createdByAdminName,
                note: `Granted via PHOTON code: ${normalizedCode}`,
              });
              grantedBadges.push(badgeKey);
            }
          } catch (e) {
            console.error(`Failed to grant badge ${badgeKey}:`, e);
          }
        }
        if (grantedBadges.length > 0) {
          results.grantedBadges = grantedBadges;
        }
      }

      // Handle theme unlocks
      if (codeData.themeUnlocks && codeData.themeUnlocks.length > 0) {
        const unlockedThemes: string[] = [];
        for (const themeKey of codeData.themeUnlocks) {
          await storage.addUserUnlock(characterId, themeKey as FactionTheme);
          unlockedThemes.push(themeKey);
        }
        if (unlockedThemes.length > 0) {
          results.unlockedThemes = unlockedThemes;
        }
      }

      // Handle tile unlocks
      if (codeData.tileUnlocks && codeData.tileUnlocks.length > 0) {
        await storage.addUserUnlock(characterId, undefined, codeData.tileUnlocks as BonusTile[]);
        results.unlockedTiles = codeData.tileUnlocks;
      }

      // Record the redemption
      await storage.createPhotonRedemption({
        codeId: codeData.id,
        code: normalizedCode,
        characterId,
        characterName,
      });

      // Increment redemption count
      await storage.incrementCodeRedemption(codeData.id);

      // Log successful redemption
      await storage.logPhotonActivity({
        codeId: codeData.id,
        code: normalizedCode,
        action: "redeemed",
        actorCharacterId: characterId,
        actorCharacterName: characterName,
        details: results,
      });

      res.json({
        success: true,
        message: "Code redeemed successfully!",
        results,
      });
    } catch (error) {
      console.error("Redeem PHOTON code error:", error);
      res.status(500).json({ error: "Failed to redeem code" });
    }
  });

  // User: Redeem a PHOTON code
  const redeemCodeSchema = z.object({
    code: z.string()
      .transform(s => s.trim().toUpperCase())
      .refine(s => /^PHOTON-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(s), {
        message: "Invalid code format. Expected: PHOTON-XXXX-XXXX-XXXX"
      }),
  });
  
  app.post("/api/pro/redeem-code", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    
    const parseResult = redeemCodeSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ 
        error: parseResult.error.errors[0]?.message || "Invalid code format"
      });
      return;
    }
    
    const normalizedCode = parseResult.data.code;
    
    // Look up PHOTON code from the new table
    const photonCode = await storage.getPhotonCode(normalizedCode);
    
    if (!photonCode) {
      res.status(404).json({ error: "Activation code not found" });
      return;
    }
    
    if (photonCode.status === "revoked") {
      res.status(400).json({ error: "This code has been revoked" });
      return;
    }
    
    if (photonCode.status !== "active") {
      res.status(400).json({ error: "This code is no longer active" });
      return;
    }
    
    if (photonCode.currentRedemptions >= photonCode.maxRedemptions) {
      res.status(400).json({ error: "This code has reached its maximum redemptions" });
      return;
    }
    
    if (photonCode.expiresAt && new Date() > photonCode.expiresAt) {
      res.status(400).json({ error: "This code has expired" });
      return;
    }
    
    const { characterId, characterName } = req.session.character;
    const durationDays = photonCode.proDurationDays || 7;
    
    // Get existing subscription to extend if active
    const existingSub = await storage.getProSubscription(characterId);
    let newExpiresAt: Date;
    
    if (existingSub?.status === "active" && existingSub.expiresAt) {
      newExpiresAt = new Date(existingSub.expiresAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
    } else {
      newExpiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    }
    
    // Create/update subscription
    const subscription: ProSubscription = {
      characterId,
      characterName,
      status: "active",
      expiresAt: newExpiresAt,
      activatedAt: existingSub?.activatedAt || new Date(),
      activationCode: normalizedCode,
      giftedBy: photonCode.createdByAdminId || null,
      giftedAt: new Date(),
    };
    
    await storage.createOrUpdateProSubscription(subscription);
    
    // Increment the redemption counter for this PHOTON code
    await storage.incrementCodeRedemption(photonCode.id);
    
    // Log the redemption activity
    await storage.logPhotonActivity({
      codeId: photonCode.id,
      code: normalizedCode,
      action: "redeemed",
      actorCharacterId: characterId,
      actorCharacterName: characterName,
      details: { durationDays, expiresAt: newExpiresAt },
    });
    
    // Apply optional badge grants from PHOTON code
    let grantedBadges: string[] = [];
    if (photonCode.badgeGrants && photonCode.badgeGrants.length > 0) {
      for (const badgeType of photonCode.badgeGrants) {
        try {
          const hasExistingBadge = await storage.hasSpecialBadge(characterId, badgeType as SpecialBadgeType);
          if (!hasExistingBadge) {
            await storage.grantSpecialBadge({
              characterId,
              characterName,
              badgeType: badgeType as SpecialBadgeType,
              grantedByAdminId: photonCode.createdByAdminId || 0,
              grantedByAdminName: photonCode.createdByAdminName || "PHOTON Code System",
              note: `Granted via PHOTON code: ${normalizedCode}`,
            });
            grantedBadges.push(badgeType);
          }
        } catch (err) {
          console.error("Failed to grant badge from PHOTON code:", err);
        }
      }
    }
    
    // Apply optional theme and tile unlocks from PHOTON code
    let unlockedThemes: string[] = [];
    let unlockedTiles: string[] = [];
    if ((photonCode.themeUnlocks && photonCode.themeUnlocks.length > 0) || 
        (photonCode.tileUnlocks && photonCode.tileUnlocks.length > 0)) {
      try {
        const existingUnlocks = await storage.getUserUnlocks(characterId);
        const existingThemes = existingUnlocks?.unlockedThemes || [];
        const existingTiles = existingUnlocks?.unlockedTiles || [];
        
        // Unlock each theme
        const validThemeKeys = Object.keys(FACTION_THEMES);
        for (const theme of photonCode.themeUnlocks || []) {
          if (!(existingThemes as string[]).includes(theme) && validThemeKeys.includes(theme)) {
            await storage.addUserUnlock(characterId, theme as FactionTheme, undefined);
            unlockedThemes.push(theme);
          }
        }
        
        // Unlock tiles
        const validTileKeys = Object.keys(BONUS_TILES);
        if (photonCode.tileUnlocks && photonCode.tileUnlocks.length > 0) {
          const tilesToUnlock = photonCode.tileUnlocks.filter(tile => 
            !(existingTiles as string[]).includes(tile) && validTileKeys.includes(tile)
          ) as BonusTile[];
          if (tilesToUnlock.length > 0) {
            await storage.addUserUnlock(characterId, undefined, tilesToUnlock);
            unlockedTiles = tilesToUnlock;
          }
        }
      } catch (err) {
        console.error("Failed to apply unlocks from PHOTON code:", err);
      }
    }
    
    // Build detailed success message
    const extras: string[] = [];
    if (grantedBadges.length > 0) {
      for (const badge of grantedBadges) {
        extras.push(`${SPECIAL_BADGE_TYPES[badge as SpecialBadgeType]?.name || badge} badge`);
      }
    }
    if (unlockedThemes.length > 0) {
      for (const theme of unlockedThemes) {
        extras.push(`${FACTION_THEMES[theme as FactionTheme]?.name || theme} theme`);
      }
    }
    if (unlockedTiles.length > 0) extras.push(`${unlockedTiles.length} bonus tile(s)`);
    
    const extrasMessage = extras.length > 0 ? ` Plus: ${extras.join(", ")}!` : "";
    
    res.json({
      success: true,
      message: `Successfully redeemed ${durationDays} days of PRO!${extrasMessage}`,
      durationDays,
      expiresAt: newExpiresAt,
      subscription,
      grantedBadges,
      unlockedThemes,
      unlockedTiles,
    });
  });

  // ============ ISK PAYMENT FLOW ============

  // Create a pending payment with reference code
  const createPaymentSchema = z.object({
    planType: z.enum(["weekly", "monthly"]),
  });

  app.post("/api/pro/payment/create", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const { characterId, characterName } = req.session.character;
    const parseResult = createPaymentSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      res.status(400).json({ error: "Invalid plan type. Use 'weekly' or 'monthly'" });
      return;
    }

    const { planType } = parseResult.data;
    
    // Check if there's already an active pending payment
    const existingPayment = await storage.getActivePendingPayment(characterId);
    if (existingPayment) {
      res.json({
        referenceCode: existingPayment.referenceCode,
        planType: existingPayment.planType,
        iskAmount: existingPayment.iskAmount,
        expiresAt: existingPayment.expiresAt,
        recipientCharacter: PRO_PRICING.recipientCharacterName,
        instructions: `Send ${existingPayment.iskAmount.toLocaleString()} ISK to "${PRO_PRICING.recipientCharacterName}" with reason: ${existingPayment.referenceCode}`,
        isExisting: true,
        status: existingPayment.status,
      });
      return;
    }

    // Create new pending payment
    const iskAmount = planType === "monthly" ? PRO_PRICING.monthlyIsk : PRO_PRICING.weeklyIsk;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours to complete payment

    const payment = await storage.createPendingPayment({
      characterId,
      characterName,
      planType,
      iskAmount,
      expiresAt,
    });

    res.json({
      referenceCode: payment.referenceCode,
      planType: payment.planType,
      iskAmount: payment.iskAmount,
      expiresAt: payment.expiresAt,
      recipientCharacter: PRO_PRICING.recipientCharacterName,
      instructions: `Send ${payment.iskAmount.toLocaleString()} ISK to "${PRO_PRICING.recipientCharacterName}" with reason: ${payment.referenceCode}`,
      isExisting: false,
      status: payment.status,
    });
  });

  // Check payment status
  app.get("/api/pro/payment/status", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const { characterId } = req.session.character;
    
    // Get all pending payments for the user
    const payments = await storage.getPendingPaymentsByCharacter(characterId);
    
    // Get the most recent active payment
    const activePayment = await storage.getActivePendingPayment(characterId);
    
    res.json({
      activePayment: activePayment ? {
        referenceCode: activePayment.referenceCode,
        planType: activePayment.planType,
        iskAmount: activePayment.iskAmount,
        expiresAt: activePayment.expiresAt,
        status: activePayment.status,
        recipientCharacter: PRO_PRICING.recipientCharacterName,
      } : null,
      recentPayments: payments.slice(0, 5).map(p => ({
        referenceCode: p.referenceCode,
        planType: p.planType,
        iskAmount: p.iskAmount,
        status: p.status,
        createdAt: p.createdAt,
        completedAt: p.completedAt,
      })),
    });
  });

  // Verify payment by checking ESI wallet journal
  app.post("/api/pro/payment/verify", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const { characterId, characterName, accessToken } = req.session.character;
    
    // Get active pending payment
    const pendingPayment = await storage.getActivePendingPayment(characterId);
    if (!pendingPayment) {
      res.status(400).json({ error: "No active pending payment found. Please create a payment first." });
      return;
    }

    try {
      // Fetch wallet journal from ESI
      const walletResponse = await fetch(
        `${ESI_BASE_URL}/characters/${characterId}/wallet/journal/?datasource=tranquility`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!walletResponse.ok) {
        if (walletResponse.status === 403) {
          res.status(403).json({ error: "Wallet access not authorized. Please re-login with wallet permissions." });
          return;
        }
        console.error("ESI wallet error:", await walletResponse.text());
        res.status(500).json({ error: "Failed to fetch wallet data from EVE" });
        return;
      }

      const journalEntries = await walletResponse.json();
      
      // Look for a donation with the reference code in the reason
      const matchingEntry = journalEntries.find((entry: {
        ref_type: string;
        reason?: string;
        amount?: number;
        id?: number;
      }) => {
        // Look for player donations or ISK transfers
        if (entry.ref_type !== "player_donation" && entry.ref_type !== "player_trading") {
          return false;
        }
        
        // Check if the reference code is in the reason
        const reason = entry.reason?.toUpperCase() || "";
        const referenceCode = pendingPayment.referenceCode.toUpperCase();
        
        if (!reason.includes(referenceCode)) {
          return false;
        }
        
        // Check if the amount is sufficient (negative because it's a payment)
        const amount = Math.abs(entry.amount || 0);
        if (amount < pendingPayment.iskAmount) {
          return false;
        }
        
        // Check if this transaction was already processed
        return true;
      });

      if (!matchingEntry) {
        res.json({
          found: false,
          message: `Payment not yet detected. Make sure you've sent at least ${pendingPayment.iskAmount.toLocaleString()} ISK to "${PRO_PRICING.recipientCharacterName}" with "${pendingPayment.referenceCode}" in the reason field.`,
          referenceCode: pendingPayment.referenceCode,
          expectedAmount: pendingPayment.iskAmount,
        });
        return;
      }

      // Check if transaction was already processed
      const alreadyProcessed = await storage.isTransactionProcessed(matchingEntry.id);
      if (alreadyProcessed) {
        res.status(400).json({ error: "This transaction has already been processed" });
        return;
      }

      // Mark payment as completed
      await storage.completePendingPayment(pendingPayment.referenceCode, matchingEntry.id);
      await storage.markTransactionProcessed(matchingEntry.id);

      // Calculate subscription duration
      const durationDays = pendingPayment.planType === "monthly" ? 30 : 7;

      // Get existing subscription to extend if active
      const existingSub = await storage.getProSubscription(characterId);
      let newExpiresAt: Date;

      if (existingSub?.status === "active" && existingSub.expiresAt) {
        newExpiresAt = new Date(existingSub.expiresAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
      } else {
        newExpiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
      }

      // Create/update PRO subscription
      const subscription: ProSubscription = {
        characterId,
        characterName,
        status: "active",
        expiresAt: newExpiresAt,
        activatedAt: existingSub?.activatedAt || new Date(),
        activationCode: pendingPayment.referenceCode,
        giftedBy: null,
        giftedAt: null,
      };

      await storage.createOrUpdateProSubscription(subscription);

      res.json({
        found: true,
        success: true,
        message: `Payment verified! ${durationDays} days of PRO activated.`,
        transactionId: matchingEntry.id,
        amountPaid: Math.abs(matchingEntry.amount),
        expiresAt: newExpiresAt,
        subscription,
      });
    } catch (error) {
      console.error("Payment verification error:", error);
      res.status(500).json({ error: "Failed to verify payment" });
    }
  });

  // ============ ITEM PRICE & LOOT LOGGING ============

  // Search items by name using ESI
  app.get("/api/items/search", async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        res.status(400).json({ error: "Search query must be at least 2 characters" });
        return;
      }

      // Use ESI search endpoint
      const searchResponse = await fetch(
        `${ESI_BASE_URL}/search/?categories=inventory_type&datasource=tranquility&language=en&search=${encodeURIComponent(query)}&strict=false`
      );
      
      if (!searchResponse.ok) {
        console.error("ESI search error:", await searchResponse.text());
        res.status(500).json({ error: "Failed to search items" });
        return;
      }

      const searchData = await searchResponse.json();
      const typeIds = searchData.inventory_type || [];
      
      // Limit results to first 20 items
      const limitedIds = typeIds.slice(0, 20);
      
      if (limitedIds.length === 0) {
        res.json({ items: [] });
        return;
      }

      // Fetch type names for the results
      const typePromises = limitedIds.map(async (typeId: number) => {
        try {
          const typeResponse = await fetch(
            `${ESI_BASE_URL}/universe/types/${typeId}/?datasource=tranquility&language=en`
          );
          if (typeResponse.ok) {
            const data = await typeResponse.json();
            return {
              typeId,
              name: data.name,
              volume: data.volume || 0,
              published: data.published,
              marketGroupId: data.market_group_id,
            };
          }
          return null;
        } catch {
          return null;
        }
      });

      const results = await Promise.all(typePromises);
      const items = results.filter(Boolean);

      res.json({ items });
    } catch (error) {
      console.error("Item search error:", error);
      res.status(500).json({ error: "Failed to search items" });
    }
  });

  // Get item price from Jita (cached)
  app.get("/api/market/price/:typeId", async (req: Request, res: Response) => {
    try {
      const typeId = parseInt(req.params.typeId, 10);
      if (isNaN(typeId)) {
        res.status(400).json({ error: "Invalid type ID" });
        return;
      }

      // The Forge region (Jita) ID
      const FORGE_REGION_ID = 10000002;
      
      // Fetch both buy and sell orders
      const [sellResponse, buyResponse] = await Promise.all([
        fetch(
          `${ESI_BASE_URL}/markets/${FORGE_REGION_ID}/orders/?datasource=tranquility&type_id=${typeId}&order_type=sell`
        ),
        fetch(
          `${ESI_BASE_URL}/markets/${FORGE_REGION_ID}/orders/?datasource=tranquility&type_id=${typeId}&order_type=buy`
        ),
      ]);
      
      if (!sellResponse.ok || !buyResponse.ok) {
        res.status(500).json({ error: "Failed to fetch market data" });
        return;
      }

      const [sellOrders, buyOrders] = await Promise.all([
        sellResponse.json(),
        buyResponse.json(),
      ]);
      
      // Find lowest sell price
      let lowestSellPrice = Infinity;
      for (const order of sellOrders) {
        if (order.price < lowestSellPrice) {
          lowestSellPrice = order.price;
        }
      }

      // Find highest buy price
      let highestBuyPrice = 0;
      for (const order of buyOrders) {
        if (order.price > highestBuyPrice) {
          highestBuyPrice = order.price;
        }
      }

      // Get type name
      const typeResponse = await fetch(
        `${ESI_BASE_URL}/universe/types/${typeId}/?datasource=tranquility`
      );
      let typeName = "Unknown Item";
      if (typeResponse.ok) {
        const typeData = await typeResponse.json();
        typeName = typeData.name;
      }
      
      res.json({
        typeId,
        typeName,
        jitaSellPrice: lowestSellPrice === Infinity ? null : lowestSellPrice,
        jitaBuyPrice: highestBuyPrice || null,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Market price fetch error:", error);
      res.status(500).json({ error: "Failed to fetch market price" });
    }
  });

  // Batch lookup item prices (up to 10 at a time)
  app.post("/api/market/prices", async (req: Request, res: Response) => {
    try {
      const { typeIds } = req.body;
      if (!Array.isArray(typeIds) || typeIds.length === 0) {
        res.status(400).json({ error: "typeIds must be a non-empty array" });
        return;
      }
      if (typeIds.length > 10) {
        res.status(400).json({ error: "Maximum 10 items per request" });
        return;
      }

      const FORGE_REGION_ID = 10000002;
      const prices: Record<number, { sellPrice: number | null; buyPrice: number | null; name: string }> = {};

      // Fetch all type names first
      const typePromises = typeIds.map(async (typeId: number) => {
        const typeResponse = await fetch(
          `${ESI_BASE_URL}/universe/types/${typeId}/?datasource=tranquility`
        );
        if (typeResponse.ok) {
          const data = await typeResponse.json();
          return { typeId, name: data.name };
        }
        return { typeId, name: "Unknown Item" };
      });

      const typeNames = await Promise.all(typePromises);
      for (const { typeId, name } of typeNames) {
        prices[typeId] = { sellPrice: null, buyPrice: null, name };
      }

      // Fetch market data for each type
      for (const typeId of typeIds) {
        try {
          const [sellResponse, buyResponse] = await Promise.all([
            fetch(
              `${ESI_BASE_URL}/markets/${FORGE_REGION_ID}/orders/?datasource=tranquility&type_id=${typeId}&order_type=sell`
            ),
            fetch(
              `${ESI_BASE_URL}/markets/${FORGE_REGION_ID}/orders/?datasource=tranquility&type_id=${typeId}&order_type=buy`
            ),
          ]);

          if (sellResponse.ok) {
            const sellOrders = await sellResponse.json();
            let lowestSell = Infinity;
            for (const order of sellOrders) {
              if (order.price < lowestSell) lowestSell = order.price;
            }
            if (lowestSell !== Infinity) {
              prices[typeId].sellPrice = lowestSell;
            }
          }

          if (buyResponse.ok) {
            const buyOrders = await buyResponse.json();
            let highestBuy = 0;
            for (const order of buyOrders) {
              if (order.price > highestBuy) highestBuy = order.price;
            }
            if (highestBuy > 0) {
              prices[typeId].buyPrice = highestBuy;
            }
          }
        } catch (e) {
          console.error(`Failed to fetch prices for type ${typeId}`, e);
        }
      }

      res.json({
        prices,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Batch price fetch error:", error);
      res.status(500).json({ error: "Failed to fetch market prices" });
    }
  });

  // Common ratting loot items (pre-defined for quick lookup)
  const COMMON_RATTING_LOOT = [
    { typeId: 15331, name: "Overseer's Personal Effects" },
    { typeId: 16274, name: "Security Tags" },
    { typeId: 33359, name: "Compact Repair Module Blueprint" },
    { typeId: 34, name: "Tritanium" },
    { typeId: 35, name: "Pyerite" },
    { typeId: 36, name: "Mexallon" },
    { typeId: 37, name: "Isogen" },
    { typeId: 38, name: "Nocxium" },
    { typeId: 39, name: "Zydrine" },
    { typeId: 40, name: "Megacyte" },
    { typeId: 11399, name: "Morphite" },
  ];

  app.get("/api/market/common-loot", async (req: Request, res: Response) => {
    try {
      const FORGE_REGION_ID = 10000002;
      const prices: { typeId: number; name: string; sellPrice: number | null }[] = [];

      for (const item of COMMON_RATTING_LOOT) {
        try {
          const response = await fetch(
            `${ESI_BASE_URL}/markets/${FORGE_REGION_ID}/orders/?datasource=tranquility&type_id=${item.typeId}&order_type=sell`
          );
          
          let sellPrice: number | null = null;
          if (response.ok) {
            const orders = await response.json();
            let lowest = Infinity;
            for (const order of orders) {
              if (order.price < lowest) lowest = order.price;
            }
            if (lowest !== Infinity) sellPrice = lowest;
          }
          
          prices.push({
            typeId: item.typeId,
            name: item.name,
            sellPrice,
          });
        } catch (e) {
          prices.push({
            typeId: item.typeId,
            name: item.name,
            sellPrice: null,
          });
        }
      }

      res.json({
        items: prices,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Common loot price fetch error:", error);
      res.status(500).json({ error: "Failed to fetch common loot prices" });
    }
  });

  // Parse EVE clipboard text and appraise loot using Janice API
  app.post("/api/loot/appraise", async (req: Request, res: Response) => {
    try {
      const { text, market = "jita" } = req.body;
      
      if (!text || typeof text !== "string") {
        res.status(400).json({ error: "Text is required" });
        return;
      }

      // Parse EVE clipboard format: "Item Name\tQuantity" or just "Item Name"
      // Also handles "Item Name x123" and "123 Item Name" formats
      const lines = text.split(/[\r\n]+/).filter(line => line.trim());
      
      if (lines.length === 0) {
        res.status(400).json({ error: "No valid items found in text" });
        return;
      }

      interface ParsedItem {
        name: string;
        quantity: number;
      }

      const parsedItems: ParsedItem[] = [];
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let name = "";
        let quantity = 1;

        // Try tab-separated format first (EVE default copy format)
        if (trimmed.includes("\t")) {
          const parts = trimmed.split("\t");
          name = parts[0].trim();
          if (parts[1]) {
            // Remove commas and parse quantity
            const qtyStr = parts[1].replace(/,/g, "").trim();
            const parsed = parseInt(qtyStr, 10);
            if (!isNaN(parsed) && parsed > 0) {
              quantity = parsed;
            }
          }
        }
        // Try "Name x123" or "Name x 123" format
        else if (/\sx?\s*\d+$/i.test(trimmed)) {
          const match = trimmed.match(/^(.+?)\s+x?\s*(\d+)$/i);
          if (match) {
            name = match[1].trim();
            quantity = parseInt(match[2], 10) || 1;
          }
        }
        // Try "123 Name" or "123x Name" format
        else if (/^\d+\s*x?\s+/.test(trimmed)) {
          const match = trimmed.match(/^(\d+)\s*x?\s+(.+)$/i);
          if (match) {
            quantity = parseInt(match[1], 10) || 1;
            name = match[2].trim();
          }
        }
        // Just item name
        else {
          name = trimmed;
        }

        if (name) {
          parsedItems.push({ name, quantity });
        }
      }

      if (parsedItems.length === 0) {
        res.status(400).json({ error: "Could not parse any items from text" });
        return;
      }

      // Use Janice API for appraisal
      // API docs: https://janice.e-351.com/api/rest/docs/index.html
      // POST /api/rest/v2/appraisal with text/plain body containing raw clipboard text
      const janiceUrl = "https://janice.e-351.com/api/rest/v2/appraisal?market=2&persist=false";

      try {
        const janiceResponse = await fetch(janiceUrl, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain",
            "Accept": "application/json",
            "X-ApiKey": "G9KwKq3465588VPd6747t95Zh94q3W2E", // Public sample key
          },
          body: text, // Send the raw clipboard text directly
        });

        if (janiceResponse.ok) {
          const janiceData = await janiceResponse.json();
          
          // Transform Janice appraisal response to our format
          // Janice returns: { code, items: [{ itemType: { eid, name }, amount, effectivePrices: { totalBuyPrice, totalSellPrice, ... } }], ... }
          interface JaniceItem {
            itemType?: { eid: number; name: string };
            amount?: number;
            effectivePrices?: { 
              buyPrice?: number; 
              sellPrice?: number;
              totalBuyPrice?: number;
              totalSellPrice?: number;
            };
          }
          
          const items = (janiceData.items || []).map((item: JaniceItem) => {
            const qty = item.amount || 1;
            const sellPrice = item.effectivePrices?.sellPrice || null;
            const buyPrice = item.effectivePrices?.buyPrice || null;
            return {
              typeId: item.itemType?.eid || 0,
              name: item.itemType?.name || "Unknown",
              quantity: qty,
              unitPrice: sellPrice,
              buyPrice: buyPrice,
              totalPrice: item.effectivePrices?.totalSellPrice || (sellPrice ? sellPrice * qty : null),
            };
          });

          const totalSellValue = janiceData.effectivePrices?.totalSellPrice || 
            items.reduce((sum: number, item: { totalPrice?: number | null }) => sum + (item.totalPrice || 0), 0);
          const totalBuyValue = janiceData.effectivePrices?.totalBuyPrice ||
            items.reduce((sum: number, item: { buyPrice?: number | null; quantity?: number }) => 
              sum + ((item.buyPrice || 0) * (item.quantity || 1)), 0);

          // Build appraisal URL if code is returned
          const appraisalUrl = janiceData.code ? `https://janice.e-351.com/a/${janiceData.code}` : null;

          res.json({
            success: true,
            source: "janice",
            market: "jita",
            items,
            totalSellValue,
            totalBuyValue,
            itemCount: items.length,
            parsedCount: parsedItems.length,
            appraisalUrl,
            lastUpdated: new Date().toISOString(),
          });
          return;
        } else {
          const errorText = await janiceResponse.text();
          console.warn("Janice API error response:", janiceResponse.status, errorText);
        }
      } catch (janiceError) {
        console.warn("Janice API failed, falling back to ESI:", janiceError);
      }

      // Fallback to ESI market data if Janice fails
      const FORGE_REGION_ID = 10000002; // Jita region
      const results: Array<{
        typeId: number;
        name: string;
        quantity: number;
        unitPrice: number | null;
        totalPrice: number | null;
      }> = [];

      for (const item of parsedItems) {
        try {
          // Search for item type ID
          const searchResponse = await fetch(
            `${ESI_BASE_URL}/search/?categories=inventory_type&datasource=tranquility&language=en&search=${encodeURIComponent(item.name)}&strict=true`
          );
          
          if (!searchResponse.ok) {
            results.push({
              typeId: 0,
              name: item.name,
              quantity: item.quantity,
              unitPrice: null,
              totalPrice: null,
            });
            continue;
          }

          const searchData = await searchResponse.json();
          const typeIds = searchData.inventory_type || [];
          
          if (typeIds.length === 0) {
            // Try non-strict search
            const looseSearch = await fetch(
              `${ESI_BASE_URL}/search/?categories=inventory_type&datasource=tranquility&language=en&search=${encodeURIComponent(item.name)}&strict=false`
            );
            if (looseSearch.ok) {
              const looseData = await looseSearch.json();
              if (looseData.inventory_type?.length > 0) {
                typeIds.push(looseData.inventory_type[0]);
              }
            }
          }

          if (typeIds.length === 0) {
            results.push({
              typeId: 0,
              name: item.name,
              quantity: item.quantity,
              unitPrice: null,
              totalPrice: null,
            });
            continue;
          }

          const typeId = typeIds[0];
          
          // Get market price
          const sellResponse = await fetch(
            `${ESI_BASE_URL}/markets/${FORGE_REGION_ID}/orders/?datasource=tranquility&type_id=${typeId}&order_type=sell`
          );

          let unitPrice: number | null = null;
          if (sellResponse.ok) {
            const orders = await sellResponse.json();
            let lowest = Infinity;
            for (const order of orders) {
              if (order.price < lowest) lowest = order.price;
            }
            if (lowest !== Infinity) unitPrice = lowest;
          }

          results.push({
            typeId,
            name: item.name,
            quantity: item.quantity,
            unitPrice,
            totalPrice: unitPrice ? unitPrice * item.quantity : null,
          });
        } catch (e) {
          results.push({
            typeId: 0,
            name: item.name,
            quantity: item.quantity,
            unitPrice: null,
            totalPrice: null,
          });
        }
      }

      const totalValue = results.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

      res.json({
        success: true,
        source: "esi",
        market: "jita",
        items: results,
        totalSellValue: totalValue,
        totalBuyValue: null,
        itemCount: results.length,
        parsedCount: parsedItems.length,
        appraisalUrl: null,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Loot appraisal error:", error);
      res.status(500).json({ error: "Failed to appraise loot" });
    }
  });

  // Commit loot to active session
  app.post("/api/loot/commit", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const character = req.session.character;
      if (!character) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const { items, totalValue } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: "No loot items provided" });
        return;
      }

      // Get active session
      const activeSession = await storage.getActiveSession(character.characterId);
      if (!activeSession) {
        res.status(400).json({ error: "No active ratting session" });
        return;
      }

      // Upsert each loot entry (aggregated by item type)
      for (const item of items) {
        if (item.typeId && item.typeName && item.quantity > 0) {
          await storage.upsertLootEntry({
            sessionId: activeSession.id,
            characterId: character.characterId,
            itemTypeId: item.typeId,
            itemTypeName: item.typeName,
            quantity: item.quantity,
            estimatedPrice: item.unitPrice || 0,
            totalValue: item.totalPrice || 0,
          });
        }
      }

      // Calculate new loot total from all entries
      const lootEntries = await storage.getLootEntriesBySession(activeSession.id);
      const lootTotal = lootEntries.reduce((sum, e) => sum + e.totalValue, 0);

      // Update session with new loot total
      const updatedSession = await storage.commitLootToSession(activeSession.id, lootTotal);

      res.json({
        success: true,
        session: updatedSession,
        lootTotal,
        entriesCount: lootEntries.length,
      });
    } catch (error) {
      console.error("Loot commit error:", error);
      res.status(500).json({ error: "Failed to commit loot" });
    }
  });

  // Get loot entries for a session
  app.get("/api/sessions/:sessionId/loot", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const character = req.session.character;
      if (!character) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const { sessionId } = req.params;
      
      // Verify session belongs to user
      const session = await storage.getRattingSessionById(sessionId);
      if (!session || session.characterId !== character.characterId) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      const lootEntries = await storage.getLootEntriesBySession(sessionId);
      const lootTotal = lootEntries.reduce((sum, e) => sum + e.totalValue, 0);

      res.json({
        entries: lootEntries,
        totalValue: lootTotal,
        sessionLootIsk: session.lootIsk,
      });
    } catch (error) {
      console.error("Get session loot error:", error);
      res.status(500).json({ error: "Failed to get session loot" });
    }
  });

  // Clear loot for a session
  app.delete("/api/sessions/:sessionId/loot", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const character = req.session.character;
      if (!character) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const { sessionId } = req.params;
      
      // Verify session belongs to user
      const session = await storage.getRattingSessionById(sessionId);
      if (!session || session.characterId !== character.characterId) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      const deletedCount = await storage.clearSessionLoot(sessionId);
      
      // Reset session loot total
      await storage.commitLootToSession(sessionId, 0);

      res.json({
        success: true,
        deletedCount,
      });
    } catch (error) {
      console.error("Clear session loot error:", error);
      res.status(500).json({ error: "Failed to clear session loot" });
    }
  });

  // ============ PATCH NOTES ============
  
  // Get latest patch notes (public)
  app.get("/api/patch-notes", async (req: Request, res: Response) => {
    // For now, return static patch notes until we build the admin panel
    res.json({
      patchNotes: [
        {
          id: "v1.0.0",
          version: "1.0.0",
          title: "Initial Release",
          content: "Welcome to PHOTON! Track your EVE Online ISK income with real-time wallet integration.",
          releaseDate: new Date().toISOString(),
          features: [
            "EVE SSO Authentication",
            "Real-time wallet tracking",
            "Session auto-detection",
            "PRO subscription system",
          ],
        },
      ],
    });
  });

  // ============ ACHIEVEMENT DEFINITIONS ============
  
  const ACHIEVEMENT_DEFINITIONS = [
    { code: "first_session", name: "First Steps", description: "Complete your first ratting session", icon: "Play", category: "milestones", requirement: 1, rarity: "common" },
    { code: "10_sessions", name: "Getting Started", description: "Complete 10 ratting sessions", icon: "Award", category: "sessions", requirement: 10, rarity: "common" },
    { code: "50_sessions", name: "Dedicated Ratter", description: "Complete 50 ratting sessions", icon: "Medal", category: "sessions", requirement: 50, rarity: "uncommon" },
    { code: "100_sessions", name: "Session Master", description: "Complete 100 ratting sessions", icon: "Trophy", category: "sessions", requirement: 100, rarity: "rare" },
    { code: "1b_total", name: "Billionaire", description: "Earn 1 billion ISK total", icon: "Coins", category: "isk", requirement: 1000000000, rarity: "uncommon" },
    { code: "10b_total", name: "Space Mogul", description: "Earn 10 billion ISK total", icon: "CircleDollarSign", category: "isk", requirement: 10000000000, rarity: "rare" },
    { code: "100b_total", name: "ISK Titan", description: "Earn 100 billion ISK total", icon: "Crown", category: "isk", requirement: 100000000000, rarity: "epic" },
    { code: "100m_session", name: "Big Haul", description: "Earn 100M ISK in a single session", icon: "TrendingUp", category: "isk", requirement: 100000000, rarity: "uncommon" },
    { code: "500m_session", name: "Jackpot", description: "Earn 500M ISK in a single session", icon: "Sparkles", category: "isk", requirement: 500000000, rarity: "rare" },
    { code: "1b_session", name: "Mother Lode", description: "Earn 1 billion ISK in a single session", icon: "Star", category: "isk", requirement: 1000000000, rarity: "epic" },
    { code: "pro_subscriber", name: "PRO Supporter", description: "Subscribe to PRO", icon: "Zap", category: "milestones", requirement: 1, rarity: "uncommon" },
    { code: "night_owl", name: "Night Owl", description: "Start a session after midnight", icon: "Moon", category: "milestones", requirement: 1, rarity: "common", isSecret: true },
    { code: "early_bird", name: "Early Bird", description: "Start a session before 6 AM", icon: "Sun", category: "milestones", requirement: 1, rarity: "common", isSecret: true },
  ];

  // Get achievement definitions (public)
  app.get("/api/achievements", (req: Request, res: Response) => {
    // Filter out secret achievements unless user is authenticated
    const isAuthenticated = !!req.session.character;
    const achievements = ACHIEVEMENT_DEFINITIONS.map(a => ({
      ...a,
      description: a.isSecret && !isAuthenticated ? "???" : a.description,
    }));
    res.json({ achievements });
  });

  // Get user's earned achievements (requires auth)
  app.get("/api/user/achievements", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    // For now return empty until we implement achievement tracking
    res.json({
      earned: [],
      progress: {},
    });
  });

  // ============ RATTING SESSIONS (PERSISTENT) ============

  // Start a new ratting session
  // Respects active character selection for multi-character support
  app.post("/api/sessions/start", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const primaryCharacterId = req.session.character.characterId;
      const activeCharacterId = req.session.activeCharacterId || primaryCharacterId;
      
      // Get character name based on whether it's primary or linked
      let characterName = req.session.character.characterName;
      if (activeCharacterId !== primaryCharacterId) {
        const linkedChar = await storage.getLinkedCharacter(activeCharacterId);
        if (linkedChar) {
          characterName = linkedChar.characterName;
        }
      }
      
      // Check if user is suspended (check primary account suspension)
      const suspension = await storage.getActiveSuspension(primaryCharacterId);
      if (suspension) {
        const expiresText = suspension.expiresAt 
          ? `until ${new Date(suspension.expiresAt).toLocaleDateString()}`
          : 'permanently';
        res.status(403).json({ 
          error: "Account suspended",
          message: `Your account has been suspended ${expiresText}. Reason: ${suspension.reason}`,
        });
        return;
      }
      
      // Check if there's already an active session for the active character
      const activeSession = await storage.getActiveSession(activeCharacterId);
      if (activeSession) {
        res.status(400).json({ 
          error: "Active session already exists",
          session: activeSession
        });
        return;
      }

      const session = await storage.createRattingSession({
        characterId: activeCharacterId,
        characterName,
        startTime: new Date(),
      });

      console.log(`[Sessions] Started new session for ${characterName}: ${session.id}`);
      res.json({ session });
    } catch (error) {
      console.error("[Sessions] Failed to start session:", error);
      res.status(500).json({ error: "Failed to start session" });
    }
  });

  // Get active session
  // Respects active character selection for multi-character support
  app.get("/api/sessions/active", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const primaryCharacterId = req.session.character.characterId;
      const activeCharacterId = req.session.activeCharacterId || primaryCharacterId;
      
      const session = await storage.getActiveSession(activeCharacterId);
      res.json({ session: session || null, activeCharacterId });
    } catch (error) {
      console.error("[Sessions] Failed to get active session:", error);
      res.status(500).json({ error: "Failed to get active session" });
    }
  });

  // Get session history
  // Respects active character selection for multi-character support
  app.get("/api/sessions/history", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const primaryCharacterId = req.session.character.characterId;
      const activeCharacterId = req.session.activeCharacterId || primaryCharacterId;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      
      const sessions = await storage.getRattingSessions(activeCharacterId, limit);
      res.json({ sessions, activeCharacterId });
    } catch (error) {
      console.error("[Sessions] Failed to get session history:", error);
      res.status(500).json({ error: "Failed to get session history" });
    }
  });

  // Update active session (ISK, kills, etc.)
  app.patch("/api/sessions/:sessionId", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const { sessionId } = req.params;
      const session = await storage.getRattingSessionById(sessionId);
      
      if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      if (session.characterId !== req.session.character.characterId) {
        res.status(403).json({ error: "Not authorized" });
        return;
      }

      const updates = req.body;
      const updated = await storage.updateRattingSession(sessionId, updates);
      res.json({ session: updated });
    } catch (error) {
      console.error("[Sessions] Failed to update session:", error);
      res.status(500).json({ error: "Failed to update session" });
    }
  });

  // End active session
  app.post("/api/sessions/:sessionId/end", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const { sessionId } = req.params;
      const session = await storage.getRattingSessionById(sessionId);
      
      if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      if (session.characterId !== req.session.character.characterId) {
        res.status(403).json({ error: "Not authorized" });
        return;
      }

      if (!session.isActive) {
        res.status(400).json({ error: "Session already ended" });
        return;
      }

      const { totalIsk, bountyIsk, lootIsk, killCount } = req.body;
      const ended = await storage.endRattingSession(sessionId, new Date(), {
        totalIsk: totalIsk || 0,
        bountyIsk: bountyIsk || 0,
        lootIsk: lootIsk || 0,
        killCount: killCount || 0,
      });

      console.log(`[Sessions] Ended session for ${req.session.character.characterName}: ${sessionId}`);
      res.json({ session: ended });
    } catch (error) {
      console.error("[Sessions] Failed to end session:", error);
      res.status(500).json({ error: "Failed to end session" });
    }
  });

  // Stop the ACTIVE session (no id needed) — used by the ratting overlay
  app.post("/api/sessions/stop", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    try {
      const active = await storage.getActiveSession(req.session.character.characterId);
      if (!active) { res.status(404).json({ error: "No active session" }); return; }
      const ended = await storage.endRattingSession(active.id, new Date(), {
        totalIsk: active.totalIsk || 0,
        bountyIsk: active.bountyIsk || 0,
        lootIsk: active.lootIsk || 0,
        killCount: active.killCount || 0,
      });
      res.json({ session: ended });
    } catch (error) {
      console.error("[Sessions] Failed to stop active session:", error);
      res.status(500).json({ error: "Failed to stop session" });
    }
  });

  // Add manual income to the ACTIVE session — used by the ratting overlay
  app.post("/api/sessions/income", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    try {
      const amount = Number(req.body?.amount) || 0;
      if (amount <= 0) { res.status(400).json({ error: "Invalid amount" }); return; }
      const active = await storage.getActiveSession(req.session.character.characterId);
      if (!active) { res.status(404).json({ error: "No active session" }); return; }
      const updated = await storage.updateRattingSession(active.id, {
        totalIsk: (active.totalIsk || 0) + amount,
        bountyIsk: (active.bountyIsk || 0) + amount,
      });
      res.json({ session: updated });
    } catch (error) {
      console.error("[Sessions] Failed to add income:", error);
      res.status(500).json({ error: "Failed to add income" });
    }
  });

  // Delete a session (only completed ones)
  // Clear all completed session history for the active character.
  // MUST be registered before /api/sessions/:sessionId so "clear" isn't matched as an id.
  app.delete("/api/sessions/clear", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    try {
      const deleted = await storage.clearAllRattingSessions(req.session.character.characterId);
      res.json({ success: true, deleted });
    } catch (error) {
      console.error("Clear sessions error:", error);
      res.status(500).json({ error: "Failed to clear sessions" });
    }
  });

  app.delete("/api/sessions/:sessionId", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const { sessionId } = req.params;
      const session = await storage.getRattingSessionById(sessionId);
      
      if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      if (session.isActive) {
        res.status(400).json({ error: "Cannot delete active session" });
        return;
      }

      const deleted = await storage.deleteRattingSession(sessionId, req.session.character.characterId);
      if (!deleted) {
        res.status(403).json({ error: "Not authorized" });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[Sessions] Failed to delete session:", error);
      res.status(500).json({ error: "Failed to delete session" });
    }
  });

  // ============ SHAREABLE SESSION CARDS ============

  // Create a shareable session card
  app.post("/api/session-cards", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const validationResult = sessionCardSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ 
          error: "Invalid card data", 
          details: validationResult.error.errors 
        });
        return;
      }

      const { cardData } = validationResult.data;
      
      // Ensure character ID matches authenticated user
      const sanitizedCardData = {
        ...cardData,
        characterId: req.session.character.characterId,
        characterName: req.session.character.characterName,
      };

      // Generate a unique share code (8 chars alphanumeric)
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let shareCode = "";
      for (let i = 0; i < 8; i++) {
        shareCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const card = await storage.createSessionCard({
        sessionId: randomUUID(),
        characterId: req.session.character.characterId,
        shareCode,
        cardData: sanitizedCardData,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days expiry
      });

      res.json({ 
        id: card.id,
        shareCode: card.shareCode,
        expiresAt: card.expiresAt,
      });
    } catch (error) {
      console.error("Error creating session card:", error);
      res.status(500).json({ error: "Failed to create session card" });
    }
  });

  // Get a shared session card (public endpoint)
  app.get("/api/share/:shareCode", async (req: Request, res: Response) => {
    try {
      const { shareCode } = req.params;
      const card = await storage.getSessionCardByCode(shareCode);

      if (!card) {
        res.status(404).json({ error: "Session card not found or expired" });
        return;
      }

      // Check expiry
      if (card.expiresAt && new Date(card.expiresAt) < new Date()) {
        res.status(404).json({ error: "Session card has expired" });
        return;
      }

      // Increment view count
      await storage.incrementSessionCardViews(card.id);

      res.json({
        cardData: card.cardData,
        viewCount: (card.viewCount || 0) + 1,
        createdAt: card.createdAt,
      });
    } catch (error) {
      console.error("Error fetching session card:", error);
      res.status(500).json({ error: "Failed to fetch session card" });
    }
  });

  // Get user's session cards
  app.get("/api/session-cards", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const cards = await storage.getSessionCardsByCharacter(req.session.character.characterId);
      res.json({ cards });
    } catch (error) {
      console.error("Error fetching session cards:", error);
      res.status(500).json({ error: "Failed to fetch session cards" });
    }
  });

  // Delete a session card
  app.delete("/api/session-cards/:id", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const { id } = req.params;
      await storage.deleteSessionCard(id, req.session.character.characterId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting session card:", error);
      res.status(500).json({ error: "Failed to delete session card" });
    }
  });

  // ============ LEADERBOARDS ============

  // Create a leaderboard
  app.post("/api/leaderboards", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const validationResult = createLeaderboardSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ 
          error: "Invalid leaderboard data", 
          details: validationResult.error.errors 
        });
        return;
      }

      const { name, isPublic, rankBy, timeFrame } = validationResult.data;

      const leaderboard = await storage.createLeaderboard({
        name,
        creatorCharacterId: req.session.character.characterId,
        creatorCharacterName: req.session.character.characterName,
        isPublic,
        rankBy,
        timeFrame,
      });

      // Auto-add creator as member
      await storage.addLeaderboardMember({
        leaderboardId: leaderboard.id,
        characterId: req.session.character.characterId,
        characterName: req.session.character.characterName,
        status: "accepted",
      });

      res.json({ leaderboard });
    } catch (error) {
      console.error("Error creating leaderboard:", error);
      res.status(500).json({ error: "Failed to create leaderboard" });
    }
  });

  // Get all public leaderboards
  app.get("/api/leaderboards", async (req: Request, res: Response) => {
    try {
      const leaderboards = await storage.getPublicLeaderboards();
      res.json({ leaderboards });
    } catch (error) {
      console.error("Error fetching leaderboards:", error);
      res.status(500).json({ error: "Failed to fetch leaderboards" });
    }
  });

  // Get user's leaderboards (ones they created or are members of)
  app.get("/api/user/leaderboards", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const leaderboards = await storage.getUserLeaderboards(req.session.character.characterId);
      res.json({ leaderboards });
    } catch (error) {
      console.error("Error fetching user leaderboards:", error);
      res.status(500).json({ error: "Failed to fetch leaderboards" });
    }
  });

  // Get a single leaderboard with rankings
  app.get("/api/leaderboards/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const leaderboard = await storage.getLeaderboardById(id);

      if (!leaderboard) {
        res.status(404).json({ error: "Leaderboard not found" });
        return;
      }

      // Check access - public or user is member
      const characterId = req.session.character?.characterId;
      if (!leaderboard.isPublic && characterId) {
        const isMember = await storage.isLeaderboardMember(id, characterId);
        if (!isMember && leaderboard.creatorCharacterId !== characterId) {
          res.status(403).json({ error: "Access denied" });
          return;
        }
      } else if (!leaderboard.isPublic) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const rankings = await storage.getLeaderboardRankings(id, leaderboard.rankBy, leaderboard.timeFrame);
      const members = await storage.getLeaderboardMembers(id);

      res.json({ 
        leaderboard, 
        rankings,
        members,
      });
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  // Join a leaderboard
  app.post("/api/leaderboards/:id/join", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const { id } = req.params;
      const leaderboard = await storage.getLeaderboardById(id);

      if (!leaderboard) {
        res.status(404).json({ error: "Leaderboard not found" });
        return;
      }

      // Check if already a member
      const isMember = await storage.isLeaderboardMember(id, req.session.character.characterId);
      if (isMember) {
        res.status(400).json({ error: "Already a member of this leaderboard" });
        return;
      }

      await storage.addLeaderboardMember({
        leaderboardId: id,
        characterId: req.session.character.characterId,
        characterName: req.session.character.characterName,
        status: leaderboard.isPublic ? "accepted" : "pending",
      });

      res.json({ success: true, status: leaderboard.isPublic ? "accepted" : "pending" });
    } catch (error) {
      console.error("Error joining leaderboard:", error);
      res.status(500).json({ error: "Failed to join leaderboard" });
    }
  });

  // Leave a leaderboard
  app.post("/api/leaderboards/:id/leave", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const { id } = req.params;
      await storage.removeLeaderboardMember(id, req.session.character.characterId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error leaving leaderboard:", error);
      res.status(500).json({ error: "Failed to leave leaderboard" });
    }
  });

  // Delete a leaderboard (creator only)
  app.delete("/api/leaderboards/:id", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const { id } = req.params;
      const leaderboard = await storage.getLeaderboardById(id);

      if (!leaderboard) {
        res.status(404).json({ error: "Leaderboard not found" });
        return;
      }

      if (leaderboard.creatorCharacterId !== req.session.character.characterId) {
        res.status(403).json({ error: "Only the creator can delete this leaderboard" });
        return;
      }

      await storage.deleteLeaderboard(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting leaderboard:", error);
      res.status(500).json({ error: "Failed to delete leaderboard" });
    }
  });

  // =====================
  // FILE UPLOAD ROUTES (for support tickets)
  // =====================
  
  // Get presigned URL for file upload
  app.post("/api/upload/presigned-url", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ 
        method: "PUT" as const,
        url: uploadURL 
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Register uploaded file and get the normalized path
  app.post("/api/upload/register", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const { uploadURL, filename, size, type } = req.body;
    if (!uploadURL || !filename) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    try {
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      
      // Validate that the uploadURL is from a recently generated presigned URL
      // by checking it contains the expected bucket path
      const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
      if (privateDir && !uploadURL.includes(privateDir.replace(/^\//, ""))) {
        res.status(400).json({ error: "Invalid upload URL" });
        return;
      }
      
      // Set ACL policy - files are private, served through /objects route with access control
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        uploadURL,
        {
          owner: String(req.session.character.characterId),
          visibility: "private",
        }
      );

      // Return the path through our authenticated /objects endpoint
      // objectPath should be like "/objects/..." - ensure it starts with /objects
      const secureUrl = objectPath.startsWith('/objects') 
        ? objectPath 
        : `/objects${objectPath.startsWith('/') ? '' : '/'}${objectPath}`;

      // Calculate expiration date (30 days from now)
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      res.json({
        url: secureUrl,
        filename,
        size: size || 0,
        type: type || "application/octet-stream",
        uploadedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      console.error("Error registering upload:", error);
      res.status(500).json({ error: "Failed to register upload" });
    }
  });

  // Serve uploaded objects - requires authentication
  app.get("/objects/:objectPath(*)", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const { ObjectStorageService, ObjectNotFoundError } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error: any) {
      console.error("Error serving object:", error);
      if (error.name === "ObjectNotFoundError") {
        res.status(404).json({ error: "File not found" });
        return;
      }
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  // =====================
  // FILE RETENTION ROUTES
  // =====================

  // Admin: Run file retention cleanup
  app.post("/api/admin/cleanup-expired-files", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cleanupExpiredAttachments } = await import("./fileRetention");
      const result = await cleanupExpiredAttachments();
      
      // Log audit
      const adminChar = req.session.character!;
      await storage.createAuditLog({
        adminCharacterId: adminChar.characterId,
        adminCharacterName: adminChar.characterName,
        action: 'cleanup_expired_files',
        details: { 
          filesDeleted: result.filesDeleted,
          ticketsProcessed: result.ticketsProcessed,
          repliesProcessed: result.repliesProcessed,
        },
      });

      res.json({
        success: true,
        message: `Cleanup complete: ${result.filesDeleted} files deleted`,
        ...result,
      });
    } catch (error: any) {
      console.error("Error running cleanup:", error);
      res.status(500).json({ error: "Failed to run cleanup" });
    }
  });

  // =====================
  // SUPPORT TICKET ROUTES
  // =====================

  // Validation schemas for support tickets
  const attachmentSchema = z.object({
    filename: z.string(),
    url: z.string(),
    size: z.number(),
    type: z.string(),
    uploadedAt: z.string(),
    expiresAt: z.string(),
  });

  const createTicketSchema = z.object({
    subject: z.string().min(5, "Subject must be at least 5 characters").max(200).transform(val => val.trim()),
    message: z.string().min(20, "Message must be at least 20 characters").max(5000).transform(val => val.trim()),
    category: z.enum(["bug", "feature", "account", "billing", "other"]).default("bug"),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    attachments: z.array(attachmentSchema).default([]),
  });

  const createReplySchema = z.object({
    message: z.string().min(5, "Reply must be at least 5 characters").max(5000).transform(val => val.trim()),
    attachments: z.array(attachmentSchema).default([]),
  });

  // Create a support ticket (authenticated users)
  app.post("/api/support/tickets", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const parsed = createTicketSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.errors[0].message });
        return;
      }

      const { subject, message, category, priority, attachments } = parsed.data;

      // Check if user has PRO
      const proSub = await storage.getProSubscription(req.session.character.characterId);
      const isPro = !!(proSub?.status === 'active' && proSub.expiresAt && new Date(proSub.expiresAt) > new Date());

      // Get character details from ESI if available (corporation, alliance)
      let corporationId: number | undefined;
      let corporationName: string | undefined;
      let allianceId: number | undefined;
      let allianceName: string | undefined;

      try {
        const charInfoRes = await fetch(`${ESI_BASE_URL}/characters/${req.session.character.characterId}/?datasource=tranquility`);
        if (charInfoRes.ok) {
          const charInfo = await charInfoRes.json();
          corporationId = charInfo.corporation_id;
          
          if (corporationId) {
            const corpRes = await fetch(`${ESI_BASE_URL}/corporations/${corporationId}/?datasource=tranquility`);
            if (corpRes.ok) {
              const corpInfo = await corpRes.json();
              corporationName = corpInfo.name;
              allianceId = corpInfo.alliance_id;
              
              if (allianceId) {
                const allianceRes = await fetch(`${ESI_BASE_URL}/alliances/${allianceId}/?datasource=tranquility`);
                if (allianceRes.ok) {
                  const allianceInfo = await allianceRes.json();
                  allianceName = allianceInfo.name;
                }
              }
            }
          }
        }
      } catch (e) {
        console.error("Error fetching character ESI info for ticket:", e);
      }

      const ticket = await storage.createSupportTicket({
        characterId: req.session.character.characterId,
        characterName: req.session.character.characterName,
        corporationId,
        corporationName,
        allianceId,
        allianceName,
        subject,
        message,
        category,
        priority,
        attachments,
        isPro,
      });

      res.status(201).json(ticket);
    } catch (error) {
      console.error("Error creating support ticket:", error);
      res.status(500).json({ error: "Failed to create support ticket" });
    }
  });

  // Get user's own tickets
  app.get("/api/support/tickets", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const tickets = await storage.getSupportTicketsByCharacter(req.session.character.characterId);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching user tickets:", error);
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  // Get a specific ticket (owner or admin)
  app.get("/api/support/tickets/:id", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const ticket = await storage.getSupportTicket(req.params.id);
      if (!ticket) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      const isAdmin = await isAdminAsync(req.session.character.characterId);
      if (ticket.characterId !== req.session.character.characterId && !isAdmin) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const replies = await storage.getTicketReplies(ticket.id);
      res.json({ ticket, replies });
    } catch (error) {
      console.error("Error fetching ticket:", error);
      res.status(500).json({ error: "Failed to fetch ticket" });
    }
  });

  // Reply to a ticket (owner or admin)
  app.post("/api/support/tickets/:id/replies", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const parsed = createReplySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.errors[0].message });
        return;
      }

      const ticket = await storage.getSupportTicket(req.params.id);
      if (!ticket) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      const isAdmin = await isAdminAsync(req.session.character.characterId);
      if (ticket.characterId !== req.session.character.characterId && !isAdmin) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const reply = await storage.createTicketReply({
        ticketId: ticket.id,
        characterId: req.session.character.characterId,
        characterName: req.session.character.characterName,
        message: parsed.data.message,
        isAdmin,
        attachments: parsed.data.attachments,
      });

      // Create notification for the recipient
      if (isAdmin) {
        // Admin replied - notify the ticket owner
        await storage.createTicketNotification({
          ticketId: ticket.id,
          replyId: reply.id,
          recipientCharacterId: ticket.characterId,
          type: "new_reply",
          message: `Admin replied to ticket #${ticket.ticketNumber}: ${ticket.subject}`,
        });
      } else {
        // User replied - notify all admins (both super admins and dynamic admins)
        const allAdminIds = await getAllAdminIdsAsync();
        for (const adminId of allAdminIds) {
          await storage.createTicketNotification({
            ticketId: ticket.id,
            replyId: reply.id,
            recipientCharacterId: adminId,
            type: "new_reply",
            message: `${req.session.character.characterName} replied to ticket #${ticket.ticketNumber}`,
          });
        }
      }

      res.status(201).json(reply);
    } catch (error) {
      console.error("Error creating reply:", error);
      res.status(500).json({ error: "Failed to create reply" });
    }
  });

  // Edit ticket initial message (owner or admin)
  app.patch("/api/support/tickets/:id/message", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const { message } = req.body;
      if (!message || typeof message !== "string" || message.length < 20) {
        res.status(400).json({ error: "Message must be at least 20 characters" });
        return;
      }

      const ticket = await storage.getSupportTicket(req.params.id);
      if (!ticket) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      const isAdmin = await isAdminAsync(req.session.character.characterId);
      if (ticket.characterId !== req.session.character.characterId && !isAdmin) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const updatedTicket = await storage.updateTicketMessage(req.params.id, message);
      res.json(updatedTicket);
    } catch (error) {
      console.error("Error updating ticket message:", error);
      res.status(500).json({ error: "Failed to update ticket message" });
    }
  });

  // Edit reply message (author or admin)
  app.patch("/api/support/tickets/:ticketId/replies/:replyId", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const { message } = req.body;
      if (!message || typeof message !== "string" || message.length < 5) {
        res.status(400).json({ error: "Message must be at least 5 characters" });
        return;
      }

      const ticket = await storage.getSupportTicket(req.params.ticketId);
      if (!ticket) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      const reply = await storage.getTicketReply(req.params.replyId);
      if (!reply || reply.ticketId !== req.params.ticketId) {
        res.status(404).json({ error: "Reply not found" });
        return;
      }

      const isAdmin = await isAdminAsync(req.session.character.characterId);
      if (reply.characterId !== req.session.character.characterId && !isAdmin) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const updatedReply = await storage.updateTicketReply(req.params.replyId, message);
      res.json(updatedReply);
    } catch (error) {
      console.error("Error updating reply:", error);
      res.status(500).json({ error: "Failed to update reply" });
    }
  });

  // Admin: Get all tickets
  app.get("/api/admin/support/tickets", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { limit, offset, status, category, priority } = req.query;
      const result = await storage.getAllSupportTickets({
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
        status: status as string | undefined,
        category: category as string | undefined,
        priority: priority as string | undefined,
      });
      res.json(result);
    } catch (error) {
      console.error("Error fetching all tickets:", error);
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  // Admin: Get ticket statistics
  app.get("/api/admin/support/tickets/stats", requireAdmin, async (req: Request, res: Response) => {
    try {
      const stats = await storage.getSupportTicketStatistics();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching ticket stats:", error);
      res.status(500).json({ error: "Failed to fetch ticket statistics" });
    }
  });

  // Admin: Update ticket status
  app.patch("/api/admin/support/tickets/:id/status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      if (!status || !["open", "in_progress", "resolved", "closed"].includes(status)) {
        res.status(400).json({ error: "Invalid status" });
        return;
      }

      const ticket = await storage.updateSupportTicketStatus(
        req.params.id,
        status,
        req.session.character?.characterId,
        req.session.character?.characterName
      );

      if (!ticket) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      // Create notification for the ticket owner about status change
      const statusMessages: Record<string, string> = {
        in_progress: "is now being reviewed",
        resolved: "has been resolved",
        closed: "has been closed",
        open: "has been reopened",
      };
      if (statusMessages[status]) {
        await storage.createTicketNotification({
          ticketId: ticket.id,
          recipientCharacterId: ticket.characterId,
          type: "status_change",
          message: `Ticket #${ticket.ticketNumber} ${statusMessages[status]}`,
        });
      }

      res.json(ticket);
    } catch (error) {
      console.error("Error updating ticket status:", error);
      res.status(500).json({ error: "Failed to update ticket status" });
    }
  });

  // Admin: Update ticket notes
  app.patch("/api/admin/support/tickets/:id/notes", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { notes } = req.body;
      if (typeof notes !== "string") {
        res.status(400).json({ error: "Notes must be a string" });
        return;
      }

      const ticket = await storage.updateSupportTicketNotes(req.params.id, notes);
      if (!ticket) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      res.json(ticket);
    } catch (error) {
      console.error("Error updating ticket notes:", error);
      res.status(500).json({ error: "Failed to update ticket notes" });
    }
  });

  // Admin: Assign ticket
  app.patch("/api/admin/support/tickets/:id/assign", requireAdmin, async (req: Request, res: Response) => {
    try {
      if (!req.session.character) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const ticket = await storage.assignSupportTicket(
        req.params.id,
        req.session.character.characterId,
        req.session.character.characterName
      );

      if (!ticket) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      res.json(ticket);
    } catch (error) {
      console.error("Error assigning ticket:", error);
      res.status(500).json({ error: "Failed to assign ticket" });
    }
  });

  // Get unread notification count for current user
  app.get("/api/support/notifications/count", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      // Disable caching for notification counts to ensure fresh data
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      const count = await storage.getUnreadNotificationCount(req.session.character.characterId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching notification count:", error);
      res.status(500).json({ error: "Failed to fetch notification count" });
    }
  });

  // Get unread notifications for current user
  app.get("/api/support/notifications", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      // Disable caching for notifications to ensure fresh data
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      const notifications = await storage.getUnreadNotifications(req.session.character.characterId);
      res.json({ notifications });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // Mark a specific notification as read
  app.patch("/api/support/notifications/:id/read", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      await storage.markNotificationRead(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // Mark all notifications as read (optionally for a specific ticket)
  app.post("/api/support/notifications/mark-all-read", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const { ticketId } = req.body;
      await storage.markAllNotificationsRead(req.session.character.characterId, ticketId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      res.status(500).json({ error: "Failed to mark notifications as read" });
    }
  });

  // ============================================
  // CHANGELOG API ENDPOINTS
  // ============================================

  // Public: Get published changelogs (for WhatsNewDialog)
  app.get("/api/changelog", async (req: Request, res: Response) => {
    try {
      const changelogs = await storage.getPublishedChangelogs();
      res.json({ changelogs });
    } catch (error) {
      console.error("Error fetching changelogs:", error);
      res.status(500).json({ error: "Failed to fetch changelogs" });
    }
  });

  // Public: Get latest published version (for checking what's new)
  app.get("/api/changelog/latest", async (req: Request, res: Response) => {
    try {
      const changelog = await storage.getLatestPublishedChangelog();
      res.json({ changelog: changelog || null });
    } catch (error) {
      console.error("Error fetching latest changelog:", error);
      res.status(500).json({ error: "Failed to fetch latest changelog" });
    }
  });

  // Admin: Get all changelogs (including unpublished)
  app.get("/api/admin/changelog", requireAdmin, async (req: Request, res: Response) => {
    try {
      const changelogs = await storage.getAllChangelogs();
      res.json({ changelogs });
    } catch (error) {
      console.error("Error fetching all changelogs:", error);
      res.status(500).json({ error: "Failed to fetch changelogs" });
    }
  });

  // Admin: Create new changelog version
  app.post("/api/admin/changelog", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { version, title, releaseDate, isPublished } = req.body;
      
      if (!version || !title || !releaseDate) {
        res.status(400).json({ error: "Version, title, and release date are required" });
        return;
      }

      const adminId = req.session.character!.characterId;
      const adminName = req.session.character!.characterName;

      const changelog = await storage.createChangelogVersion({
        version,
        title,
        releaseDate,
        isPublished: isPublished ?? false,
        createdByAdminId: adminId,
        createdByAdminName: adminName,
      });

      // Log admin action
      await storage.createAuditLog({
        adminCharacterId: adminId,
        adminCharacterName: adminName,
        action: "create_changelog",
        details: { version, title },
      });

      res.json({ changelog });
    } catch (error) {
      console.error("Error creating changelog:", error);
      res.status(500).json({ error: "Failed to create changelog" });
    }
  });

  // Admin: Update changelog version
  app.patch("/api/admin/changelog/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { version, title, releaseDate, isPublished } = req.body;

      const changelog = await storage.updateChangelogVersion(id, {
        version,
        title,
        releaseDate,
        isPublished,
      });

      if (!changelog) {
        res.status(404).json({ error: "Changelog not found" });
        return;
      }

      // Log admin action
      await storage.createAuditLog({
        adminCharacterId: req.session.character!.characterId,
        adminCharacterName: req.session.character!.characterName,
        action: "update_changelog",
        details: { versionId: id, updates: { version, title, releaseDate, isPublished } },
      });

      res.json({ changelog });
    } catch (error) {
      console.error("Error updating changelog:", error);
      res.status(500).json({ error: "Failed to update changelog" });
    }
  });

  // Admin: Delete changelog version
  app.delete("/api/admin/changelog/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteChangelogVersion(id);

      if (!deleted) {
        res.status(404).json({ error: "Changelog not found" });
        return;
      }

      // Log admin action
      await storage.createAuditLog({
        adminCharacterId: req.session.character!.characterId,
        adminCharacterName: req.session.character!.characterName,
        action: "delete_changelog",
        details: { versionId: id },
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting changelog:", error);
      res.status(500).json({ error: "Failed to delete changelog" });
    }
  });

  // Admin: Publish changelog version
  app.post("/api/admin/changelog/:id/publish", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const changelog = await storage.publishChangelogVersion(id);

      if (!changelog) {
        res.status(404).json({ error: "Changelog not found" });
        return;
      }

      // Log admin action
      await storage.createAuditLog({
        adminCharacterId: req.session.character!.characterId,
        adminCharacterName: req.session.character!.characterName,
        action: "publish_changelog",
        details: { versionId: id, version: changelog.version },
      });

      res.json({ changelog });
    } catch (error) {
      console.error("Error publishing changelog:", error);
      res.status(500).json({ error: "Failed to publish changelog" });
    }
  });

  // Admin: Add changelog item
  app.post("/api/admin/changelog/:versionId/items", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { versionId } = req.params;
      const { changeType, iconKey, text, isProOnly, isAdminOnly, sortOrder } = req.body;

      if (!changeType || !text) {
        res.status(400).json({ error: "Change type and text are required" });
        return;
      }

      const item = await storage.createChangelogItem({
        versionId,
        changeType,
        iconKey,
        text,
        sortOrder,
        isProOnly: isProOnly ?? false,
        isAdminOnly: isAdminOnly ?? false,
      });

      res.json({ item });
    } catch (error) {
      console.error("Error creating changelog item:", error);
      res.status(500).json({ error: "Failed to create changelog item" });
    }
  });

  // Admin: Update changelog item
  app.patch("/api/admin/changelog/items/:itemId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const { changeType, iconKey, text, sortOrder, isProOnly, isAdminOnly } = req.body;

      const item = await storage.updateChangelogItem(itemId, {
        changeType,
        iconKey,
        text,
        sortOrder,
        isProOnly,
        isAdminOnly,
      });

      if (!item) {
        res.status(404).json({ error: "Changelog item not found" });
        return;
      }

      res.json({ item });
    } catch (error) {
      console.error("Error updating changelog item:", error);
      res.status(500).json({ error: "Failed to update changelog item" });
    }
  });

  // Admin: Delete changelog item
  app.delete("/api/admin/changelog/items/:itemId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const deleted = await storage.deleteChangelogItem(itemId);

      if (!deleted) {
        res.status(404).json({ error: "Changelog item not found" });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting changelog item:", error);
      res.status(500).json({ error: "Failed to delete changelog item" });
    }
  });

  // Admin: Reorder changelog items
  app.post("/api/admin/changelog/:versionId/items/reorder", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { versionId } = req.params;
      const { itemIds } = req.body;

      if (!Array.isArray(itemIds)) {
        res.status(400).json({ error: "itemIds must be an array" });
        return;
      }

      await storage.reorderChangelogItems(versionId, itemIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering changelog items:", error);
      res.status(500).json({ error: "Failed to reorder changelog items" });
    }
  });

  // Admin: Get git commits for changelog generation
  app.get("/api/admin/changelog/git-commits", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { execSync } = await import("child_process");
      
      // Get the latest published changelog version to find commits since then
      const latestChangelog = await storage.getLatestPublishedChangelog();
      
      // Get commits - if we have a published version, try to find commits since that tag
      // Otherwise get the last 50 commits
      let commits: Array<{ hash: string; date: string; message: string; type: string }> = [];
      
      try {
        // Get recent commits with hash, date, and message
        const gitLog = execSync(
          'git log --oneline --date=short --format="%h|%ad|%s" -50',
          { encoding: 'utf-8', timeout: 5000 }
        ).trim();
        
        if (gitLog) {
          commits = gitLog.split('\n').map(line => {
            const [hash, date, ...messageParts] = line.split('|');
            const message = messageParts.join('|');
            
            // Parse commit type from conventional commit format
            let type = 'improvement';
            const lowerMsg = message.toLowerCase();
            if (lowerMsg.startsWith('feat:') || lowerMsg.startsWith('feature:') || lowerMsg.includes('add ') || lowerMsg.includes('new ')) {
              type = 'feature';
            } else if (lowerMsg.startsWith('fix:') || lowerMsg.startsWith('bugfix:') || lowerMsg.includes('fix ')) {
              type = 'fix';
            } else if (lowerMsg.startsWith('perf:') || lowerMsg.includes('performance') || lowerMsg.includes('optimize')) {
              type = 'performance';
            } else if (lowerMsg.startsWith('security:') || lowerMsg.includes('security')) {
              type = 'security';
            } else if (lowerMsg.startsWith('breaking:') || lowerMsg.includes('breaking')) {
              type = 'breaking';
            }
            
            return { hash, date, message, type };
          }).filter(c => c.message && !c.message.toLowerCase().includes('merge'));
        }
      } catch (gitError) {
        console.log("Git log failed, returning empty commits list");
      }
      
      // Calculate next version suggestion
      const currentVersion = latestChangelog?.version || '0.0.0';
      const [major, minor, patch] = currentVersion.split('.').map(Number);
      
      const nextVersions = {
        patch: `${major}.${minor}.${patch + 1}`,
        minor: `${major}.${minor + 1}.0`,
        major: `${major + 1}.0.0`
      };
      
      res.json({
        commits,
        currentVersion,
        nextVersions,
        lastPublished: latestChangelog?.publishedAt || null
      });
    } catch (error) {
      console.error("Error fetching git commits:", error);
      res.status(500).json({ error: "Failed to fetch git commits" });
    }
  });

  // Admin: Quick release - create version with items in one request
  app.post("/api/admin/changelog/quick-release", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { version, title, releaseDate, items, publish } = req.body;
      
      if (!version || !title || !releaseDate) {
        res.status(400).json({ error: "Version, title, and releaseDate are required" });
        return;
      }
      
      // Create the version
      const changelog = await storage.createChangelogVersion({
        version,
        title,
        releaseDate,
        isPublished: false
      });
      
      // Add all items
      if (items && Array.isArray(items)) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          await storage.createChangelogItem({
            versionId: changelog.id,
            changeType: item.type || 'improvement',
            text: item.description,
            iconKey: item.icon || undefined,
            isProOnly: item.isProOnly || false,
            isAdminOnly: item.isAdminOnly || false,
            sortOrder: i
          });
        }
      }
      
      // Optionally publish immediately
      let finalChangelog = changelog;
      if (publish) {
        const published = await storage.publishChangelogVersion(changelog.id);
        if (published) {
          finalChangelog = published;
        }
      }
      
      // Log the action
      const session = req.session as any;
      await storage.createAuditLog({
        adminCharacterId: session.characterId,
        adminCharacterName: session.characterName,
        action: "quick_release_changelog",
        details: { version, title, itemCount: items?.length || 0, published: !!publish }
      });
      
      // Fetch the complete changelog with items
      const completeChangelog = await storage.getChangelogVersion(changelog.id);
      
      res.json({ changelog: completeChangelog });
    } catch (error: any) {
      console.error("Error creating quick release:", error);
      if (error.message?.includes('unique') || error.code === '23505') {
        res.status(400).json({ error: "Version already exists" });
        return;
      }
      res.status(500).json({ error: "Failed to create release" });
    }
  });

  // ============================================================================
  // BIG UPDATE v0.4.0 - Income Analytics Endpoints
  // ============================================================================

  // Get income data for a date range
  app.get("/api/analytics/income", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const viewAll = req.query.viewAll === 'true';
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!startDate || !endDate) {
        res.status(400).json({ error: "startDate and endDate are required" });
        return;
      }

      let data: any[];
      if (viewAll) {
        const primaryCharacterId = req.session.character!.characterId;
        const linkedCharacters = await storage.getLinkedCharacters(primaryCharacterId);
        const allCharacterIds = [primaryCharacterId, ...linkedCharacters.map(lc => lc.characterId)];
        data = await storage.getDailyIncomeSummaryRangeMultiChar(allCharacterIds, startDate, endDate);
      } else {
        const activeChar = await getActiveCharacterInfo(req);
        if (!activeChar) {
          res.status(401).json({ error: "Token refresh failed" });
          return;
        }
        data = await storage.getDailyIncomeSummaryRange(activeChar.characterId, startDate, endDate);
      }

      res.json({ data });
    } catch (error) {
      console.error("Income analytics error:", error);
      res.status(500).json({ error: "Failed to fetch income data" });
    }
  });

  // Get income breakdown by source
  app.get("/api/analytics/income/breakdown", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const viewAll = req.query.viewAll === 'true';
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!startDate || !endDate) {
        res.status(400).json({ error: "startDate and endDate are required" });
        return;
      }

      let data: any[];
      if (viewAll) {
        const primaryCharacterId = req.session.character!.characterId;
        const linkedCharacters = await storage.getLinkedCharacters(primaryCharacterId);
        const allCharacterIds = [primaryCharacterId, ...linkedCharacters.map(lc => lc.characterId)];
        data = await storage.getDailyIncomeSummaryRangeMultiChar(allCharacterIds, startDate, endDate);
      } else {
        const activeChar = await getActiveCharacterInfo(req);
        if (!activeChar) {
          res.status(401).json({ error: "Token refresh failed" });
          return;
        }
        data = await storage.getDailyIncomeSummaryRange(activeChar.characterId, startDate, endDate);
      }

      // Aggregate by source
      const breakdown = {
        bounty: 0,
        mission: 0,
        market: 0,
        industry: 0,
        pi: 0,
        mining: 0,
        other: 0,
        total: 0,
      };

      for (const day of data) {
        breakdown.bounty += day.bountyIncome || 0;
        breakdown.mission += day.missionIncome || 0;
        breakdown.market += day.marketIncome || 0;
        breakdown.industry += day.industryIncome || 0;
        breakdown.pi += day.piIncome || 0;
        breakdown.mining += day.miningIncome || 0;
        breakdown.other += day.otherIncome || 0;
        breakdown.total += day.totalIncome || 0;
      }

      res.json({ breakdown });
    } catch (error) {
      console.error("Income breakdown error:", error);
      res.status(500).json({ error: "Failed to fetch income breakdown" });
    }
  });

  // Recalculate income summaries from wallet journal
  app.post("/api/analytics/income/recalculate", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed" });
        return;
      }

      // Fetch wallet journal from ESI
      const journalRes = await fetch(
        `${ESI_BASE_URL}/characters/${activeChar.characterId}/wallet/journal/?datasource=tranquility`,
        {
          headers: {
            'Authorization': `Bearer ${activeChar.accessToken}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!journalRes.ok) {
        res.status(journalRes.status).json({ error: "Failed to fetch wallet journal" });
        return;
      }

      const journal = await journalRes.json();

      // Group by date and income type
      const dailyData: Map<string, any> = new Map();

      for (const entry of journal) {
        if (entry.amount <= 0) continue; // Only positive income

        const date = entry.date.substring(0, 10); // YYYY-MM-DD
        if (!dailyData.has(date)) {
          dailyData.set(date, {
            characterId: activeChar.characterId,
            date,
            bountyIncome: 0,
            missionIncome: 0,
            marketIncome: 0,
            industryIncome: 0,
            piIncome: 0,
            miningIncome: 0,
            otherIncome: 0,
            totalIncome: 0,
            sessionCount: 0,
            totalSessionTime: 0,
          });
        }

        const day = dailyData.get(date)!;
        const refType = entry.ref_type;

        // Categorize by ref_type
        if (refType === 'bounty_prizes' || refType === 'bounty_prize') {
          day.bountyIncome += entry.amount;
        } else if (refType === 'agent_mission_reward' || refType === 'agent_mission_time_bonus_reward') {
          day.missionIncome += entry.amount;
        } else if (refType === 'market_transaction' || refType === 'brokers_fee') {
          day.marketIncome += entry.amount;
        } else if (refType === 'industry_job_tax' || refType.includes('manufacturing')) {
          day.industryIncome += entry.amount;
        } else if (refType === 'planetary_export_tax' || refType === 'planetary_import_tax') {
          day.piIncome += entry.amount;
        } else if (refType.includes('mining') || refType === 'reprocessing_tax') {
          day.miningIncome += entry.amount;
        } else {
          day.otherIncome += entry.amount;
        }

        day.totalIncome += entry.amount;
      }

      // Upsert all daily summaries
      let updated = 0;
      for (const day of dailyData.values()) {
        await storage.upsertDailyIncomeSummary(day);
        updated++;
      }

      res.json({ message: "Income data recalculated", daysUpdated: updated });
    } catch (error) {
      console.error("Income recalculate error:", error);
      res.status(500).json({ error: "Failed to recalculate income data" });
    }
  });

  // ============================================================================
  // BIG UPDATE v0.4.0 - Skill Queue Endpoints
  // ============================================================================

  // Get skill queue
  app.get("/api/skills/queue", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const viewAll = req.query.viewAll === 'true';

      let data: any[];
      if (viewAll) {
        const primaryCharacterId = req.session.character!.characterId;
        const linkedCharacters = await storage.getLinkedCharacters(primaryCharacterId);
        const allCharacterIds = [primaryCharacterId, ...linkedCharacters.map(lc => lc.characterId)];
        data = await storage.getSkillQueueMultiChar(allCharacterIds);
      } else {
        const activeChar = await getActiveCharacterInfo(req);
        if (!activeChar) {
          res.status(401).json({ error: "Token refresh failed" });
          return;
        }
        data = await storage.getSkillQueue(activeChar.characterId);
      }

      res.json({ queue: data });
    } catch (error) {
      console.error("Skill queue error:", error);
      res.status(500).json({ error: "Failed to fetch skill queue" });
    }
  });

  // Sync skill queue from ESI
  app.post("/api/skills/queue/sync", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed" });
        return;
      }

      // Check dev mode
      if (activeChar.accessToken === "dev-mode-token") {
        res.status(401).json({
          error: "Dev mode cannot access ESI",
          message: "Please log out and use 'Real EVE SSO' login to access skill data"
        });
        return;
      }

      // Fetch skill queue from ESI
      const queueRes = await fetch(
        `${ESI_BASE_URL}/characters/${activeChar.characterId}/skillqueue/?datasource=tranquility`,
        {
          headers: {
            'Authorization': `Bearer ${activeChar.accessToken}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!queueRes.ok) {
        if (queueRes.status === 403) {
          res.status(403).json({
            error: "Missing ESI scope",
            message: "Please re-authorize to grant skill queue access"
          });
          return;
        }
        res.status(queueRes.status).json({ error: "Failed to fetch skill queue from ESI" });
        return;
      }

      const esiQueue = await queueRes.json();

      // Resolve skill names
      const skillIds = [...new Set(esiQueue.map((s: any) => s.skill_id))];
      const skillNames: Map<number, string> = new Map();

      if (skillIds.length > 0) {
        const namesRes = await fetch(
          `${ESI_BASE_URL}/universe/names/?datasource=tranquility`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(skillIds)
          }
        );

        if (namesRes.ok) {
          const names = await namesRes.json();
          for (const n of names) {
            skillNames.set(n.id, n.name);
          }
        }
      }

      // Transform to our schema
      const skills = esiQueue.map((s: any, index: number) => ({
        characterId: activeChar.characterId,
        characterName: activeChar.characterName,
        queuePosition: index,
        skillId: s.skill_id,
        skillName: skillNames.get(s.skill_id) || `Skill ${s.skill_id}`,
        startedLevel: s.finished_level - 1,
        finishedLevel: s.finished_level,
        startDate: s.start_date ? new Date(s.start_date) : null,
        finishDate: s.finish_date ? new Date(s.finish_date) : null,
        trainingStartSp: s.training_start_sp || null,
        levelStartSp: s.level_start_sp || null,
        levelEndSp: s.level_end_sp || null,
      }));

      // Upsert to database
      await storage.upsertSkillQueue(activeChar.characterId, skills);

      res.json({ message: "Skill queue synced", count: skills.length });
    } catch (error) {
      console.error("Skill queue sync error:", error);
      res.status(500).json({ error: "Failed to sync skill queue" });
    }
  });

  // Get skill queue status summary
  app.get("/api/skills/queue/status", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed" });
        return;
      }

      const queue = await storage.getSkillQueue(activeChar.characterId);
      const now = new Date();

      // Find currently training skill
      const currentSkill = queue.find(s =>
        s.startDate && s.finishDate &&
        new Date(s.startDate) <= now &&
        new Date(s.finishDate) > now
      );

      // Calculate time until queue empties
      const lastSkill = queue[queue.length - 1];
      const queueEndsAt = lastSkill?.finishDate ? new Date(lastSkill.finishDate) : null;
      const hoursRemaining = queueEndsAt ? Math.max(0, (queueEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60)) : 0;

      res.json({
        totalSkills: queue.length,
        isEmpty: queue.length === 0,
        currentSkill: currentSkill ? {
          name: currentSkill.skillName,
          level: currentSkill.finishedLevel,
          finishDate: currentSkill.finishDate,
        } : null,
        queueEndsAt,
        hoursRemaining: Math.round(hoursRemaining * 10) / 10,
      });
    } catch (error) {
      console.error("Skill queue status error:", error);
      res.status(500).json({ error: "Failed to get skill queue status" });
    }
  });

  // Get skill queue alerts
  app.get("/api/skills/alerts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed" });
        return;
      }

      const alerts = await storage.getSkillQueueAlerts(activeChar.characterId);
      res.json({ alerts: alerts || { alertOnEmpty: true, alertHoursBeforeEmpty: 24 } });
    } catch (error) {
      console.error("Skill queue alerts error:", error);
      res.status(500).json({ error: "Failed to fetch skill queue alerts" });
    }
  });

  // Update skill queue alerts
  app.post("/api/skills/alerts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed" });
        return;
      }

      const { alertOnEmpty, alertHoursBeforeEmpty } = req.body;

      const alerts = await storage.upsertSkillQueueAlerts({
        characterId: activeChar.characterId,
        alertOnEmpty: alertOnEmpty ?? true,
        alertHoursBeforeEmpty: alertHoursBeforeEmpty ?? 24,
      });

      res.json({ alerts });
    } catch (error) {
      console.error("Skill queue alerts update error:", error);
      res.status(500).json({ error: "Failed to update skill queue alerts" });
    }
  });

  // ============================================================================
  // ADM REPORTS - Alliance sovereignty ADM tracking (Admin Only)
  // ============================================================================

  // Get all ADM reports
  app.get("/api/admin/adm-reports", requireAdmin, async (req: Request, res: Response) => {
    try {
      const reports = await storage.getAllAdmReports();
      res.json({ reports });
    } catch (error) {
      console.error("Get ADM reports error:", error);
      res.status(500).json({ error: "Failed to fetch ADM reports" });
    }
  });

  // Get single ADM report with systems
  app.get("/api/admin/adm-reports/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = await storage.getAdmReportWithSystems(id);
      if (!data) {
        res.status(404).json({ error: "Report not found" });
        return;
      }
      res.json(data);
    } catch (error) {
      console.error("Get ADM report error:", error);
      res.status(500).json({ error: "Failed to fetch ADM report" });
    }
  });

  // Create new ADM report
  app.post("/api/admin/adm-reports", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { name, regionName, reportDate, nextAdmRead, systems } = req.body;

      if (!name || !regionName || !reportDate) {
        res.status(400).json({ error: "name, regionName, and reportDate are required" });
        return;
      }

      const adminId = req.session.character!.characterId;

      // Create the report
      const report = await storage.createAdmReport({
        name,
        regionName,
        reportDate: new Date(reportDate),
        nextAdmRead: nextAdmRead ? new Date(nextAdmRead) : null,
        createdBy: adminId,
      });

      // Create systems if provided
      if (systems && Array.isArray(systems) && systems.length > 0) {
        const systemsToCreate = systems.map((sys: any, index: number) => ({
          reportId: report.id,
          systemName: sys.systemName,
          systemId: sys.systemId || null,
          strategicIndex: sys.strategicIndex || null,
          strategicPercent: sys.strategicPercent || null,
          vulnerableHours: sys.vulnerableHours || null,
          adm: sys.adm,
          admChange: sys.admChange || null,
          admTrend: sys.admTrend || null,
          admStatus: sys.admStatus || 'safe',
          militaryLevel: sys.militaryLevel || null,
          militaryPercent: sys.militaryPercent || null,
          militaryChange: sys.militaryChange || null,
          militaryTrend: sys.militaryTrend || null,
          militaryActivity: sys.militaryActivity || null,
          industrialLevel: sys.industrialLevel || null,
          industrialPercent: sys.industrialPercent || null,
          industrialChange: sys.industrialChange || null,
          industrialTrend: sys.industrialTrend || null,
          industrialActivity: sys.industrialActivity || null,
          majorThreat: sys.majorThreat || null,
          minorThreat: sys.minorThreat || null,
          oreProspecting: sys.oreProspecting || null,
          sovHolder: sys.sovHolder || null,
          isCapital: sys.isCapital || false,
          notes: sys.notes || null,
          sortOrder: index,
        }));

        await storage.createAdmSystemsBatch(systemsToCreate);
      }

      const fullReport = await storage.getAdmReportWithSystems(report.id);
      res.json(fullReport);
    } catch (error) {
      console.error("Create ADM report error:", error);
      res.status(500).json({ error: "Failed to create ADM report" });
    }
  });

  // Update ADM report
  app.put("/api/admin/adm-reports/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, regionName, reportDate, nextAdmRead, systems } = req.body;

      const existing = await storage.getAdmReport(id);
      if (!existing) {
        res.status(404).json({ error: "Report not found" });
        return;
      }

      // Update report
      await storage.updateAdmReport(id, {
        name: name || existing.name,
        regionName: regionName || existing.regionName,
        reportDate: reportDate ? new Date(reportDate) : existing.reportDate,
        nextAdmRead: nextAdmRead ? new Date(nextAdmRead) : existing.nextAdmRead,
      });

      // If systems provided, replace all systems
      if (systems && Array.isArray(systems)) {
        await storage.deleteAdmSystemsForReport(id);

        if (systems.length > 0) {
          const systemsToCreate = systems.map((sys: any, index: number) => ({
            reportId: id,
            systemName: sys.systemName,
            systemId: sys.systemId || null,
            strategicIndex: sys.strategicIndex || null,
            strategicPercent: sys.strategicPercent || null,
            vulnerableHours: sys.vulnerableHours || null,
            adm: sys.adm,
            admChange: sys.admChange || null,
            admTrend: sys.admTrend || null,
            admStatus: sys.admStatus || 'safe',
            militaryLevel: sys.militaryLevel || null,
            militaryPercent: sys.militaryPercent || null,
            militaryChange: sys.militaryChange || null,
            militaryTrend: sys.militaryTrend || null,
            militaryActivity: sys.militaryActivity || null,
            industrialLevel: sys.industrialLevel || null,
            industrialPercent: sys.industrialPercent || null,
            industrialChange: sys.industrialChange || null,
            industrialTrend: sys.industrialTrend || null,
            industrialActivity: sys.industrialActivity || null,
            majorThreat: sys.majorThreat || null,
            minorThreat: sys.minorThreat || null,
            oreProspecting: sys.oreProspecting || null,
            sovHolder: sys.sovHolder || null,
            isCapital: sys.isCapital || false,
            notes: sys.notes || null,
            sortOrder: index,
          }));

          await storage.createAdmSystemsBatch(systemsToCreate);
        }
      }

      const fullReport = await storage.getAdmReportWithSystems(id);
      res.json(fullReport);
    } catch (error) {
      console.error("Update ADM report error:", error);
      res.status(500).json({ error: "Failed to update ADM report" });
    }
  });

  // Delete ADM report
  app.delete("/api/admin/adm-reports/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteAdmReport(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete ADM report error:", error);
      res.status(500).json({ error: "Failed to delete ADM report" });
    }
  });

  // Add single system to a report
  app.post("/api/admin/adm-reports/:id/systems", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const sys = req.body;

      const existing = await storage.getAdmReport(id);
      if (!existing) {
        res.status(404).json({ error: "Report not found" });
        return;
      }

      const existingSystems = await storage.getAdmSystemsForReport(id);
      const sortOrder = existingSystems.length;

      const system = await storage.createAdmSystem({
        reportId: id,
        systemName: sys.systemName,
        systemId: sys.systemId || null,
        strategicIndex: sys.strategicIndex || null,
        strategicPercent: sys.strategicPercent || null,
        vulnerableHours: sys.vulnerableHours || null,
        adm: sys.adm,
        admChange: sys.admChange || null,
        admTrend: sys.admTrend || null,
        admStatus: sys.admStatus || 'safe',
        militaryLevel: sys.militaryLevel || null,
        militaryPercent: sys.militaryPercent || null,
        militaryChange: sys.militaryChange || null,
        militaryTrend: sys.militaryTrend || null,
        militaryActivity: sys.militaryActivity || null,
        industrialLevel: sys.industrialLevel || null,
        industrialPercent: sys.industrialPercent || null,
        industrialChange: sys.industrialChange || null,
        industrialTrend: sys.industrialTrend || null,
        industrialActivity: sys.industrialActivity || null,
        majorThreat: sys.majorThreat || null,
        minorThreat: sys.minorThreat || null,
        oreProspecting: sys.oreProspecting || null,
        sovHolder: sys.sovHolder || null,
        isCapital: sys.isCapital || false,
        notes: sys.notes || null,
        sortOrder,
      });

      res.json({ system });
    } catch (error) {
      console.error("Add ADM system error:", error);
      res.status(500).json({ error: "Failed to add system" });
    }
  });

  // Update single system
  app.put("/api/admin/adm-systems/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const sys = req.body;

      const system = await storage.updateAdmSystem(id, {
        systemName: sys.systemName,
        systemId: sys.systemId,
        strategicIndex: sys.strategicIndex,
        strategicPercent: sys.strategicPercent,
        vulnerableHours: sys.vulnerableHours,
        adm: sys.adm,
        admChange: sys.admChange,
        admTrend: sys.admTrend,
        admStatus: sys.admStatus,
        militaryLevel: sys.militaryLevel,
        militaryPercent: sys.militaryPercent,
        militaryChange: sys.militaryChange,
        militaryTrend: sys.militaryTrend,
        militaryActivity: sys.militaryActivity,
        industrialLevel: sys.industrialLevel,
        industrialPercent: sys.industrialPercent,
        industrialChange: sys.industrialChange,
        industrialTrend: sys.industrialTrend,
        industrialActivity: sys.industrialActivity,
        majorThreat: sys.majorThreat,
        minorThreat: sys.minorThreat,
        oreProspecting: sys.oreProspecting,
        sovHolder: sys.sovHolder,
        isCapital: sys.isCapital,
        notes: sys.notes,
        sortOrder: sys.sortOrder,
      });

      if (!system) {
        res.status(404).json({ error: "System not found" });
        return;
      }

      res.json({ system });
    } catch (error) {
      console.error("Update ADM system error:", error);
      res.status(500).json({ error: "Failed to update system" });
    }
  });

  // Delete single system
  app.delete("/api/admin/adm-systems/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteAdmSystem(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete ADM system error:", error);
      res.status(500).json({ error: "Failed to delete system" });
    }
  });

  // ============================================================================
  // SAVED ADM SYSTEMS - Reusable system presets for quick adding
  // ============================================================================

  // Get saved ADM systems for user
  app.get("/api/admin/saved-adm-systems", requireAdmin, async (req: Request, res: Response) => {
    try {
      const characterId = req.session.character!.characterId;
      const systems = await storage.getSavedAdmSystems(characterId);
      res.json({ systems });
    } catch (error) {
      console.error("Get saved ADM systems error:", error);
      res.status(500).json({ error: "Failed to fetch saved systems" });
    }
  });

  // Create saved ADM system
  app.post("/api/admin/saved-adm-systems", requireAdmin, async (req: Request, res: Response) => {
    try {
      const characterId = req.session.character!.characterId;
      const data = req.body;

      const system = await storage.createSavedAdmSystem({
        characterId,
        systemName: data.systemName,
        systemId: data.systemId || null,
        strategicIndex: data.strategicIndex || null,
        strategicPercent: data.strategicPercent || null,
        vulnerableHours: data.vulnerableHours || null,
        defaultAdm: data.defaultAdm || 3.0,
        defaultAdmStatus: data.defaultAdmStatus || "safe",
        militaryLevel: data.militaryLevel || null,
        militaryPercent: data.militaryPercent || null,
        industrialLevel: data.industrialLevel || null,
        industrialPercent: data.industrialPercent || null,
        majorThreat: data.majorThreat || null,
        minorThreat: data.minorThreat || null,
        oreProspecting: data.oreProspecting || null,
        sovHolder: data.sovHolder || null,
        isCapital: data.isCapital || false,
        notes: data.notes || null,
        sortOrder: data.sortOrder || 0,
      });

      res.json({ system });
    } catch (error) {
      console.error("Create saved ADM system error:", error);
      res.status(500).json({ error: "Failed to save system" });
    }
  });

  // Update saved ADM system
  app.put("/api/admin/saved-adm-systems/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = req.body;

      const system = await storage.updateSavedAdmSystem(id, data);
      res.json({ system });
    } catch (error) {
      console.error("Update saved ADM system error:", error);
      res.status(500).json({ error: "Failed to update saved system" });
    }
  });

  // Delete saved ADM system
  app.delete("/api/admin/saved-adm-systems/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteSavedAdmSystem(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete saved ADM system error:", error);
      res.status(500).json({ error: "Failed to delete saved system" });
    }
  });

  // ============================================================================
  // ESI SOVEREIGNTY DATA - Public endpoints for ADM auto-import
  // ============================================================================

  // Get all sovereignty structures from ESI (public, no auth required)
  app.get("/api/esi/sovereignty/structures", async (req: Request, res: Response) => {
    try {
      const esiResponse = await fetch("https://esi.evetech.net/latest/sovereignty/structures/?datasource=tranquility");
      if (!esiResponse.ok) {
        throw new Error(`ESI returned ${esiResponse.status}`);
      }
      const structures = await esiResponse.json();
      res.json({ structures });
    } catch (error) {
      console.error("ESI sovereignty structures error:", error);
      res.status(500).json({ error: "Failed to fetch sovereignty structures from ESI" });
    }
  });

  // Get sovereignty map from ESI (which alliance owns what)
  app.get("/api/esi/sovereignty/map", async (req: Request, res: Response) => {
    try {
      const esiResponse = await fetch("https://esi.evetech.net/latest/sovereignty/map/?datasource=tranquility");
      if (!esiResponse.ok) {
        throw new Error(`ESI returned ${esiResponse.status}`);
      }
      const systems = await esiResponse.json();
      res.json({ systems });
    } catch (error) {
      console.error("ESI sovereignty map error:", error);
      res.status(500).json({ error: "Failed to fetch sovereignty map from ESI" });
    }
  });

  // Get all regions from ESI
  app.get("/api/esi/universe/regions", async (req: Request, res: Response) => {
    try {
      const esiResponse = await fetch("https://esi.evetech.net/latest/universe/regions/?datasource=tranquility");
      if (!esiResponse.ok) {
        throw new Error(`ESI returned ${esiResponse.status}`);
      }
      const regionIds = await esiResponse.json();
      res.json({ regionIds });
    } catch (error) {
      console.error("ESI regions error:", error);
      res.status(500).json({ error: "Failed to fetch regions from ESI" });
    }
  });

  // Get region details including constellations
  app.get("/api/esi/universe/regions/:regionId", async (req: Request, res: Response) => {
    try {
      const { regionId } = req.params;
      const esiResponse = await fetch(`https://esi.evetech.net/latest/universe/regions/${regionId}/?datasource=tranquility`);
      if (!esiResponse.ok) {
        throw new Error(`ESI returned ${esiResponse.status}`);
      }
      const region = await esiResponse.json();
      res.json(region);
    } catch (error) {
      console.error("ESI region details error:", error);
      res.status(500).json({ error: "Failed to fetch region details from ESI" });
    }
  });

  // Get constellation details including systems
  app.get("/api/esi/universe/constellations/:constellationId", async (req: Request, res: Response) => {
    try {
      const { constellationId } = req.params;
      const esiResponse = await fetch(`https://esi.evetech.net/latest/universe/constellations/${constellationId}/?datasource=tranquility`);
      if (!esiResponse.ok) {
        throw new Error(`ESI returned ${esiResponse.status}`);
      }
      const constellation = await esiResponse.json();
      res.json(constellation);
    } catch (error) {
      console.error("ESI constellation details error:", error);
      res.status(500).json({ error: "Failed to fetch constellation details from ESI" });
    }
  });

  // Get system details
  app.get("/api/esi/universe/systems/:systemId", async (req: Request, res: Response) => {
    try {
      const { systemId } = req.params;
      const esiResponse = await fetch(`https://esi.evetech.net/latest/universe/systems/${systemId}/?datasource=tranquility`);
      if (!esiResponse.ok) {
        throw new Error(`ESI returned ${esiResponse.status}`);
      }
      const system = await esiResponse.json();
      res.json(system);
    } catch (error) {
      console.error("ESI system details error:", error);
      res.status(500).json({ error: "Failed to fetch system details from ESI" });
    }
  });

  // Bulk resolve system names
  app.post("/api/esi/universe/names", async (req: Request, res: Response) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: "ids array required" });
        return;
      }
      // ESI limits to 1000 IDs per request
      const limitedIds = ids.slice(0, 1000);
      const esiResponse = await fetch("https://esi.evetech.net/latest/universe/names/?datasource=tranquility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(limitedIds),
      });
      if (!esiResponse.ok) {
        throw new Error(`ESI returned ${esiResponse.status}`);
      }
      const names = await esiResponse.json();
      res.json({ names });
    } catch (error) {
      console.error("ESI names error:", error);
      res.status(500).json({ error: "Failed to resolve names from ESI" });
    }
  });

  // Get alliance info
  app.get("/api/esi/alliances/:allianceId", async (req: Request, res: Response) => {
    try {
      const { allianceId } = req.params;
      const esiResponse = await fetch(`https://esi.evetech.net/latest/alliances/${allianceId}/?datasource=tranquility`);
      if (!esiResponse.ok) {
        throw new Error(`ESI returned ${esiResponse.status}`);
      }
      const alliance = await esiResponse.json();
      res.json(alliance);
    } catch (error) {
      console.error("ESI alliance error:", error);
      res.status(500).json({ error: "Failed to fetch alliance from ESI" });
    }
  });

  // Combined endpoint: Get sovereignty data for a specific region with all names resolved
  app.get("/api/esi/sovereignty/region/:regionId", async (req: Request, res: Response) => {
    try {
      const { regionId } = req.params;

      // 1. Get region info to get constellation IDs
      const regionResponse = await fetch(`https://esi.evetech.net/latest/universe/regions/${regionId}/?datasource=tranquility`);
      if (!regionResponse.ok) throw new Error("Failed to fetch region");
      const region = await regionResponse.json();

      // 2. Get all constellations to get system IDs
      const constellationPromises = region.constellations.map(async (constId: number) => {
        const constResponse = await fetch(`https://esi.evetech.net/latest/universe/constellations/${constId}/?datasource=tranquility`);
        if (!constResponse.ok) return null;
        return constResponse.json();
      });
      const constellations = (await Promise.all(constellationPromises)).filter(Boolean);

      // 3. Collect all system IDs in this region
      const systemIds = new Set<number>();
      for (const constellation of constellations) {
        for (const systemId of constellation.systems) {
          systemIds.add(systemId);
        }
      }

      // 4. Get sovereignty structures
      const sovResponse = await fetch("https://esi.evetech.net/latest/sovereignty/structures/?datasource=tranquility");
      if (!sovResponse.ok) throw new Error("Failed to fetch sovereignty structures");
      const allStructures = await sovResponse.json();

      // 5. Filter structures to only those in our region
      const regionStructures = allStructures.filter((s: any) => systemIds.has(s.solar_system_id));

      // 6. Collect unique IDs for name resolution
      const idsToResolve = new Set<number>();
      Array.from(systemIds).forEach((systemId) => {
        idsToResolve.add(systemId);
      });
      const allianceIds = new Set<number>();
      for (const structure of regionStructures) {
        if (structure.alliance_id) {
          allianceIds.add(structure.alliance_id);
        }
      }

      // 7. Resolve system names
      const namesResponse = await fetch("https://esi.evetech.net/latest/universe/names/?datasource=tranquility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Array.from(idsToResolve)),
      });
      const names = namesResponse.ok ? await namesResponse.json() : [];
      const nameMap = new Map(names.map((n: any) => [n.id, n.name]));

      // 8. Resolve alliance names
      const alliancePromises = Array.from(allianceIds).map(async (allianceId) => {
        try {
          const allianceResponse = await fetch(`https://esi.evetech.net/latest/alliances/${allianceId}/?datasource=tranquility`);
          if (!allianceResponse.ok) return { id: allianceId, ticker: "???", name: "Unknown" };
          const alliance = await allianceResponse.json();
          return { id: allianceId, ticker: alliance.ticker, name: alliance.name };
        } catch {
          return { id: allianceId, ticker: "???", name: "Unknown" };
        }
      });
      const alliances = await Promise.all(alliancePromises);
      const allianceMap = new Map(alliances.map(a => [a.id, a]));

      // 9. Build the response - group by system, showing the best structure (SovHub preferred)
      const systemMap = new Map<number, any>();

      // First, add all systems in the region (even those without structures)
      Array.from(systemIds).forEach((systemId) => {
        systemMap.set(systemId, {
          systemId,
          systemName: nameMap.get(systemId) || `System ${systemId}`,
          adm: null,
          vulnerableStartTime: null,
          vulnerableEndTime: null,
          allianceId: null,
          allianceTicker: null,
          allianceName: null,
          structureTypeId: null,
        });
      });

      // Then update with structure data (SovHub type 32458 takes priority)
      for (const structure of regionStructures) {
        const existing = systemMap.get(structure.solar_system_id);
        // SovHub (32458) takes priority over other structures
        if (!existing || existing.structureTypeId !== 32458 || structure.structure_type_id === 32458) {
          const alliance = structure.alliance_id ? allianceMap.get(structure.alliance_id) : null;
          systemMap.set(structure.solar_system_id, {
            systemId: structure.solar_system_id,
            systemName: nameMap.get(structure.solar_system_id) || `System ${structure.solar_system_id}`,
            adm: structure.vulnerability_occupancy_level || null,
            vulnerableStartTime: structure.vulnerable_start_time || null,
            vulnerableEndTime: structure.vulnerable_end_time || null,
            allianceId: structure.alliance_id || null,
            allianceTicker: alliance?.ticker || null,
            allianceName: alliance?.name || null,
            structureTypeId: structure.structure_type_id,
          });
        }
      }

      res.json({
        regionId: parseInt(regionId),
        regionName: region.name,
        systems: Array.from(systemMap.values()).sort((a, b) => a.systemName.localeCompare(b.systemName)),
      });
    } catch (error) {
      console.error("ESI region sovereignty error:", error);
      res.status(500).json({ error: "Failed to fetch region sovereignty data" });
    }
  });

  // ============================================================================
  // SKILL PLANNER v0.5.0 - Trained Skills & Skill Planning Endpoints
  // ============================================================================

  // Get trained skills for a character
  app.get("/api/skills/trained", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const viewAll = req.query.viewAll === 'true';

      let skills: any[];
      if (viewAll) {
        const primaryCharacterId = req.session.character!.characterId;
        const linkedCharacters = await storage.getLinkedCharacters(primaryCharacterId);
        const allCharacterIds = [primaryCharacterId, ...linkedCharacters.map(lc => lc.characterId)];
        skills = await storage.getTrainedSkillsMultiChar(allCharacterIds);
      } else {
        const activeChar = await getActiveCharacterInfo(req);
        if (!activeChar) {
          res.status(401).json({ error: "Token refresh failed" });
          return;
        }
        skills = await storage.getTrainedSkills(activeChar.characterId);
      }

      res.json({ skills });
    } catch (error) {
      console.error("Trained skills error:", error);
      res.status(500).json({ error: "Failed to fetch trained skills" });
    }
  });

  // Sync trained skills from ESI
  app.post("/api/skills/trained/sync", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed" });
        return;
      }

      // Check dev mode
      if (activeChar.accessToken === "dev-mode-token") {
        res.status(401).json({
          error: "Dev mode cannot access ESI",
          message: "Please log out and use 'Real EVE SSO' login to access skill data"
        });
        return;
      }

      // Fetch skills from ESI
      const skillsRes = await fetch(
        `${ESI_BASE_URL}/characters/${activeChar.characterId}/skills/?datasource=tranquility`,
        {
          headers: {
            'Authorization': `Bearer ${activeChar.accessToken}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!skillsRes.ok) {
        if (skillsRes.status === 403) {
          res.status(403).json({
            error: "Missing ESI scope",
            message: "Please re-authorize to grant skills access"
          });
          return;
        }
        res.status(skillsRes.status).json({ error: "Failed to fetch skills from ESI" });
        return;
      }

      const esiData = await skillsRes.json();
      const esiSkills = esiData.skills || [];

      // Resolve skill names
      const skillIds = esiSkills.map((s: any) => s.skill_id);
      const skillNames: Map<number, string> = new Map();

      if (skillIds.length > 0) {
        // Batch skill ID resolution (ESI limit is 1000 per request)
        const batchSize = 500;
        for (let i = 0; i < skillIds.length; i += batchSize) {
          const batch = skillIds.slice(i, i + batchSize);
          const namesRes = await fetch(
            `${ESI_BASE_URL}/universe/names/?datasource=tranquility`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(batch)
            }
          );
          if (namesRes.ok) {
            const names = await namesRes.json();
            names.forEach((n: { id: number; name: string }) => {
              skillNames.set(n.id, n.name);
            });
          }
        }
      }

      // Transform to our schema
      const trainedSkills = esiSkills.map((s: any) => ({
        characterId: activeChar.characterId,
        characterName: activeChar.characterName,
        skillId: s.skill_id,
        skillName: skillNames.get(s.skill_id) || `Unknown Skill ${s.skill_id}`,
        trainedSkillLevel: s.trained_skill_level,
        activeSkillLevel: s.active_skill_level,
        skillpointsInSkill: s.skillpoints_in_skill,
      }));

      // Save to database
      await storage.upsertTrainedSkills(activeChar.characterId, trainedSkills);

      // Also save character attributes
      await storage.upsertCharacterAttributes({
        characterId: activeChar.characterId,
        characterName: activeChar.characterName,
        charisma: esiData.charisma || 19,
        intelligence: esiData.intelligence || 20,
        memory: esiData.memory || 20,
        perception: esiData.perception || 20,
        willpower: esiData.willpower || 20,
        bonusRemaps: esiData.bonus_remaps,
        lastRemapDate: esiData.last_remap_date ? new Date(esiData.last_remap_date) : null,
        accruedRemapCooldownDate: esiData.accrued_remap_cooldown_date ? new Date(esiData.accrued_remap_cooldown_date) : null,
        totalSp: esiData.total_sp,
        unallocatedSp: esiData.unallocated_sp,
      });

      res.json({
        synced: trainedSkills.length,
        totalSp: esiData.total_sp,
        unallocatedSp: esiData.unallocated_sp,
      });
    } catch (error: any) {
      console.error("Trained skills sync error:", error);
      // Check if it's a database table error
      const errorMsg = error?.message || String(error);
      if (errorMsg.includes("relation") && errorMsg.includes("does not exist")) {
        res.status(500).json({
          error: "Database tables not created",
          message: "Please run 'npm run db:migrate' to create the skill planner tables"
        });
      } else {
        res.status(500).json({ error: "Failed to sync trained skills", message: errorMsg });
      }
    }
  });

  // Get character attributes
  app.get("/api/skills/attributes", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed" });
        return;
      }

      const attributes = await storage.getCharacterAttributes(activeChar.characterId);
      res.json({ attributes });
    } catch (error) {
      console.error("Character attributes error:", error);
      res.status(500).json({ error: "Failed to fetch character attributes" });
    }
  });

  // Get skill plans for a character
  app.get("/api/skills/plans", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed" });
        return;
      }

      const plans = await storage.getSkillPlans(activeChar.characterId);
      res.json({ plans });
    } catch (error) {
      console.error("Skill plans error:", error);
      res.status(500).json({ error: "Failed to fetch skill plans" });
    }
  });

  // Get a specific skill plan with its items
  app.get("/api/skills/plans/:planId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { planId } = req.params;
      const plan = await storage.getSkillPlan(planId);

      if (!plan) {
        res.status(404).json({ error: "Skill plan not found" });
        return;
      }

      const items = await storage.getSkillPlanItems(planId);
      res.json({ plan, items });
    } catch (error) {
      console.error("Skill plan error:", error);
      res.status(500).json({ error: "Failed to fetch skill plan" });
    }
  });

  // Create a new skill plan
  app.post("/api/skills/plans", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed" });
        return;
      }

      const { name, description, goalType, goalTypeId, goalTypeName, items } = req.body;

      if (!name || !goalType) {
        res.status(400).json({ error: "Name and goalType are required" });
        return;
      }

      // Create the plan
      const plan = await storage.createSkillPlan({
        characterId: activeChar.characterId,
        name,
        description,
        goalType,
        goalTypeId,
        goalTypeName,
        isActive: false,
        priority: 0,
      });

      // Add items if provided
      if (items && Array.isArray(items) && items.length > 0) {
        const planItems = items.map((item: any, index: number) => ({
          planId: plan.id,
          skillId: item.skillId,
          skillName: item.skillName,
          targetLevel: item.targetLevel,
          currentLevel: item.currentLevel || 0,
          priority: item.priority ?? index,
          isRequired: item.isRequired ?? true,
          estimatedTrainingTime: item.estimatedTrainingTime,
          notes: item.notes,
        }));
        await storage.addSkillPlanItems(planItems);
      }

      res.json({ plan });
    } catch (error) {
      console.error("Create skill plan error:", error);
      res.status(500).json({ error: "Failed to create skill plan" });
    }
  });

  // Update a skill plan
  app.put("/api/skills/plans/:planId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { planId } = req.params;
      const { name, description, priority, isActive } = req.body;

      const plan = await storage.updateSkillPlan(planId, {
        name,
        description,
        priority,
        isActive,
      });

      if (!plan) {
        res.status(404).json({ error: "Skill plan not found" });
        return;
      }

      res.json({ plan });
    } catch (error) {
      console.error("Update skill plan error:", error);
      res.status(500).json({ error: "Failed to update skill plan" });
    }
  });

  // Delete a skill plan
  app.delete("/api/skills/plans/:planId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { planId } = req.params;
      const deleted = await storage.deleteSkillPlan(planId);

      if (!deleted) {
        res.status(404).json({ error: "Skill plan not found" });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Delete skill plan error:", error);
      res.status(500).json({ error: "Failed to delete skill plan" });
    }
  });

  // Set a plan as active
  app.post("/api/skills/plans/:planId/activate", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed" });
        return;
      }

      const { planId } = req.params;
      await storage.setActiveSkillPlan(activeChar.characterId, planId);

      res.json({ success: true });
    } catch (error) {
      console.error("Activate skill plan error:", error);
      res.status(500).json({ error: "Failed to activate skill plan" });
    }
  });

  // Search for ships (for goal selection) - uses local database
  app.get("/api/skills/ships/search", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        res.json({ ships: [] });
        return;
      }

      console.log(`[Ship Search] Searching for: "${query}"`);

      // Search local eve_ships database (fast partial matching with ILIKE)
      const results = await storage.searchEveShips(query);

      // Map to expected format
      const ships = results.map(ship => ({
        shipTypeId: ship.typeId,
        shipName: ship.typeName,
        shipGroup: ship.groupName,
      }));

      console.log(`[Ship Search] Found ${ships.length} ships`);
      res.json({ ships });
    } catch (error) {
      console.error("Ship search error:", error);
      res.status(500).json({ error: "Failed to search ships" });
    }
  });

  // Get ship database status
  app.get("/api/skills/ships/status", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const count = await storage.getEveShipCount();
      console.log(`[Ship Status] Database has ${count} ships, populated: ${count > 0}`);
      res.json({ count, populated: count > 0 });
    } catch (error) {
      console.error("Ship status error:", error);
      res.status(500).json({ error: "Failed to get ship database status" });
    }
  });

  // Populate ship database from ESI (one-time operation)
  app.post("/api/skills/ships/populate", isAuthenticated, async (req: Request, res: Response) => {
    try {
      // Check if already populated
      const existingCount = await storage.getEveShipCount();
      if (existingCount > 0) {
        res.json({ message: "Ship database already populated", count: existingCount });
        return;
      }

      console.log("[Ship Populate] Starting ship database population from ESI...");

      // Ship category ID is 6
      const categoryRes = await fetch(
        `${ESI_BASE_URL}/universe/categories/6/?datasource=tranquility`
      );

      if (!categoryRes.ok) {
        throw new Error(`Failed to fetch ship category: ${categoryRes.status}`);
      }

      const categoryData = await categoryRes.json();
      const groupIds: number[] = categoryData.groups || [];
      console.log(`[Ship Populate] Found ${groupIds.length} ship groups`);

      const ships: { typeId: number; typeName: string; groupId: number; groupName: string; categoryId: number; description?: string }[] = [];

      // Fetch each group
      for (const groupId of groupIds) {
        try {
          const groupRes = await fetch(
            `${ESI_BASE_URL}/universe/groups/${groupId}/?datasource=tranquility`
          );

          if (!groupRes.ok) continue;

          const groupData = await groupRes.json();
          const groupName = groupData.name;
          const typeIds: number[] = groupData.types || [];

          console.log(`[Ship Populate] Processing group ${groupId} (${groupName}) with ${typeIds.length} types`);

          // Fetch each type in the group
          for (const typeId of typeIds) {
            try {
              const typeRes = await fetch(
                `${ESI_BASE_URL}/universe/types/${typeId}/?datasource=tranquility`
              );

              if (!typeRes.ok) continue;

              const typeData = await typeRes.json();

              // Skip unpublished items
              if (!typeData.published) continue;

              ships.push({
                typeId: typeData.type_id,
                typeName: typeData.name,
                groupId: groupId,
                groupName: groupName,
                categoryId: 6,
                description: typeData.description?.substring(0, 500),
              });
            } catch (e) {
              console.error(`[Ship Populate] Error fetching type ${typeId}:`, e);
            }
          }

          // Small delay between groups to be nice to ESI
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (e) {
          console.error(`[Ship Populate] Error fetching group ${groupId}:`, e);
        }
      }

      console.log(`[Ship Populate] Saving ${ships.length} ships to database...`);
      await storage.upsertEveShips(ships);

      console.log(`[Ship Populate] Done! Populated ${ships.length} ships`);
      res.json({ message: "Ship database populated", count: ships.length });
    } catch (error) {
      console.error("Ship populate error:", error);
      res.status(500).json({ error: "Failed to populate ship database" });
    }
  });

  // Get skill requirements for a ship - fetches from ESI with full prerequisite chain
  app.get("/api/skills/ships/:shipTypeId/requirements", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const shipTypeId = parseInt(req.params.shipTypeId);
      if (isNaN(shipTypeId)) {
        res.status(400).json({ error: "Invalid ship type ID" });
        return;
      }

      const forceRefresh = req.query.refresh === 'true';
      console.log(`[Ship Requirements] Fetching requirements for ship ${shipTypeId} (refresh: ${forceRefresh})`);

      // First try local cache (unless force refresh)
      if (!forceRefresh) {
        const cachedReqs = await storage.getShipSkillRequirements(shipTypeId);
        if (cachedReqs.length > 0) {
          console.log(`[Ship Requirements] Found ${cachedReqs.length} cached requirements`);
          res.json({ requirements: cachedReqs });
          return;
        }
      }

      // Fetch ship type info from ESI
      const typeRes = await fetch(
        `${ESI_BASE_URL}/universe/types/${shipTypeId}/?datasource=tranquility`
      );

      if (!typeRes.ok) {
        res.status(404).json({ error: "Ship not found" });
        return;
      }

      const typeData = await typeRes.json();
      const dogmaAttrs = typeData.dogma_attributes || [];

      // Helper function to extract skill requirements from dogma attributes
      const extractSkillRequirements = (attrs: any[]): { skillId: number; requiredLevel: number }[] => {
        const attrMap = new Map(attrs.map((a: any) => [a.attribute_id, a.value]));
        const requirements: { skillId: number; requiredLevel: number }[] = [];

        // 182-186 = requiredSkill1-5 (skill type ID)
        // 277-281 = requiredSkill1Level-5Level (required level)
        const skillAttrIds = [182, 183, 184, 185, 186];
        const levelAttrIds = [277, 278, 279, 280, 281];

        for (let i = 0; i < 5; i++) {
          const skillId = attrMap.get(skillAttrIds[i]);
          const level = attrMap.get(levelAttrIds[i]);
          if (skillId && level && skillId > 0) {
            requirements.push({ skillId: Math.floor(skillId), requiredLevel: Math.floor(level) });
          }
        }
        return requirements;
      };

      // Recursively fetch all skill prerequisites
      const allRequirements: Map<number, { skillId: number; skillName: string; requiredLevel: number; isPrerequisite: boolean }> = new Map();
      const processedSkills = new Set<number>();

      const fetchSkillPrerequisites = async (skillId: number, requiredLevel: number, isPrereq: boolean): Promise<void> => {
        // Track the highest required level for this skill
        const existing = allRequirements.get(skillId);
        if (existing && existing.requiredLevel >= requiredLevel) {
          return; // Already have this skill at same or higher level
        }

        // Fetch skill type info
        const skillRes = await fetch(
          `${ESI_BASE_URL}/universe/types/${skillId}/?datasource=tranquility`
        );

        if (!skillRes.ok) {
          console.log(`[Ship Requirements] Failed to fetch skill ${skillId}`);
          return;
        }

        const skillData = await skillRes.json();

        allRequirements.set(skillId, {
          skillId,
          skillName: skillData.name,
          requiredLevel,
          isPrerequisite: isPrereq,
        });

        // Don't re-process prerequisites we've already handled
        if (processedSkills.has(skillId)) return;
        processedSkills.add(skillId);

        // Get this skill's prerequisites
        const skillDogma = skillData.dogma_attributes || [];
        const prereqs = extractSkillRequirements(skillDogma);

        // Recursively fetch prerequisites
        for (const prereq of prereqs) {
          await fetchSkillPrerequisites(prereq.skillId, prereq.requiredLevel, true);
        }
      };

      // Extract direct ship requirements
      const directReqs = extractSkillRequirements(dogmaAttrs);
      console.log(`[Ship Requirements] Ship has ${directReqs.length} direct requirements`);

      // Fetch all requirements including prerequisites
      for (const req of directReqs) {
        await fetchSkillPrerequisites(req.skillId, req.requiredLevel, false);
      }

      const requirements = Array.from(allRequirements.values());
      console.log(`[Ship Requirements] Total requirements including prereqs: ${requirements.length}`);

      // Cache the results for future use
      if (requirements.length > 0) {
        const groupRes = await fetch(
          `${ESI_BASE_URL}/universe/groups/${typeData.group_id}/?datasource=tranquility`
        );
        let groupName = "Ship";
        if (groupRes.ok) {
          const groupData = await groupRes.json();
          groupName = groupData.name;
        }

        // Clear old cached requirements before inserting new ones
        await storage.deleteShipSkillRequirements(shipTypeId);

        await storage.upsertShipSkillRequirements(
          requirements.map(req => ({
            shipTypeId,
            shipName: typeData.name,
            shipGroup: groupName,
            skillId: req.skillId,
            skillName: req.skillName,
            requiredLevel: req.requiredLevel,
            isPrerequisite: req.isPrerequisite,
          }))
        );
      }

      res.json({ requirements });
    } catch (error) {
      console.error("Ship requirements error:", error);
      res.status(500).json({ error: "Failed to fetch ship requirements" });
    }
  });

  // Get skill metadata (for skill browser)
  app.get("/api/skills/metadata", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const metadata = await storage.getAllSkillMetadata();
      res.json({ metadata });
    } catch (error) {
      console.error("Skill metadata error:", error);
      res.status(500).json({ error: "Failed to fetch skill metadata" });
    }
  });

  // Search skills by name
  app.get("/api/skills/search", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        res.json({ skills: [] });
        return;
      }

      const skills = await storage.searchSkillsByName(query);
      res.json({ skills });
    } catch (error) {
      console.error("Skill search error:", error);
      res.status(500).json({ error: "Failed to search skills" });
    }
  });

  // Generate optimized skill plan based on goals and current skills
  app.post("/api/skills/plans/optimize", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed" });
        return;
      }

      const { targetSkills, strategy } = req.body;
      // targetSkills: Array of { skillId, targetLevel }
      // strategy: "shortest_first" | "prerequisites_first" | "balanced"

      if (!targetSkills || !Array.isArray(targetSkills) || targetSkills.length === 0) {
        res.status(400).json({ error: "targetSkills array is required" });
        return;
      }

      // Get character's current skills
      const trainedSkills = await storage.getTrainedSkills(activeChar.characterId);
      const trainedMap = new Map(trainedSkills.map(s => [s.skillId, s.trainedSkillLevel]));

      // Get character attributes for time calculations
      const attributes = await storage.getCharacterAttributes(activeChar.characterId);
      const charAttributes = attributes || {
        intelligence: 20,
        memory: 20,
        perception: 20,
        willpower: 20,
        charisma: 19,
      };

      // Get skill metadata for all target skills
      const allSkillMetadata = await storage.getAllSkillMetadata();
      const metadataMap = new Map(allSkillMetadata.map(m => [m.skillId, m]));

      // Build the skill plan with prerequisites
      interface SkillToTrain {
        skillId: number;
        skillName: string;
        fromLevel: number;
        toLevel: number;
        trainingTime: number; // seconds
        isPrerequisite: boolean;
        priority: number;
      }

      const skillsToTrain: SkillToTrain[] = [];
      const processedSkills = new Set<string>(); // "skillId-level" to avoid duplicates

      // Helper function to calculate training time
      const calculateTrainingTime = (
        skillId: number,
        fromLevel: number,
        toLevel: number
      ): number => {
        const metadata = metadataMap.get(skillId);
        if (!metadata) return 0;

        const rank = metadata.trainingTimeMultiplier || 1;
        const primaryAttr = (charAttributes as any)[metadata.primaryAttribute] || 20;
        const secondaryAttr = (charAttributes as any)[metadata.secondaryAttribute] || 20;

        // SP per minute = primary + secondary/2
        const spPerMinute = primaryAttr + secondaryAttr / 2;

        // SP required for each level (cumulative formula)
        const spForLevel = (level: number) => {
          const baseMultipliers = [0, 250, 1415, 8000, 45255, 256000];
          return Math.ceil(baseMultipliers[level] * rank);
        };

        let totalSp = 0;
        for (let level = fromLevel + 1; level <= toLevel; level++) {
          const spNeeded = spForLevel(level) - spForLevel(level - 1);
          totalSp += spNeeded;
        }

        // Time in seconds
        return Math.ceil((totalSp / spPerMinute) * 60);
      };

      // Helper function to add a skill and its prerequisites
      const addSkillWithPrereqs = (
        skillId: number,
        targetLevel: number,
        isPrereq: boolean
      ) => {
        const metadata = metadataMap.get(skillId);
        if (!metadata) return;

        // Check prerequisites first
        const prereqs = metadata.prerequisiteSkillsJson as Array<{ skillId: number; level: number }> | null;
        if (prereqs && Array.isArray(prereqs)) {
          for (const prereq of prereqs) {
            const currentPrereqLevel = trainedMap.get(prereq.skillId) || 0;
            if (currentPrereqLevel < prereq.level) {
              addSkillWithPrereqs(prereq.skillId, prereq.level, true);
            }
          }
        }

        // Add this skill if not already processed at this level or higher
        const currentLevel = trainedMap.get(skillId) || 0;
        if (currentLevel >= targetLevel) return;

        const key = `${skillId}-${targetLevel}`;
        if (processedSkills.has(key)) return;
        processedSkills.add(key);

        const trainingTime = calculateTrainingTime(skillId, currentLevel, targetLevel);

        skillsToTrain.push({
          skillId,
          skillName: metadata.skillName,
          fromLevel: currentLevel,
          toLevel: targetLevel,
          trainingTime,
          isPrerequisite: isPrereq,
          priority: 0, // Will be set during sorting
        });
      };

      // Process all target skills
      for (const target of targetSkills) {
        addSkillWithPrereqs(target.skillId, target.targetLevel, false);
      }

      // Sort based on strategy
      const selectedStrategy = strategy || "shortest_first";

      if (selectedStrategy === "shortest_first") {
        // Train shortest skills first (quick wins)
        skillsToTrain.sort((a, b) => {
          // Prerequisites always come before their dependents
          if (a.isPrerequisite && !b.isPrerequisite) return -1;
          if (!a.isPrerequisite && b.isPrerequisite) return 1;
          // Then sort by training time
          return a.trainingTime - b.trainingTime;
        });
      } else if (selectedStrategy === "prerequisites_first") {
        // Train prerequisites first, then targets in order given
        skillsToTrain.sort((a, b) => {
          if (a.isPrerequisite && !b.isPrerequisite) return -1;
          if (!a.isPrerequisite && b.isPrerequisite) return 1;
          return 0;
        });
      } else {
        // Balanced: alternate between short and long
        skillsToTrain.sort((a, b) => a.trainingTime - b.trainingTime);
      }

      // Assign priorities
      skillsToTrain.forEach((skill, index) => {
        skill.priority = index;
      });

      // Calculate total training time
      const totalTrainingTime = skillsToTrain.reduce((sum, s) => sum + s.trainingTime, 0);

      res.json({
        optimizedPlan: skillsToTrain,
        totalTrainingTime,
        totalSkills: skillsToTrain.length,
        strategy: selectedStrategy,
      });
    } catch (error) {
      console.error("Optimize skill plan error:", error);
      res.status(500).json({ error: "Failed to optimize skill plan" });
    }
  });

  // Sync skill metadata from ESI (admin/initial load)
  app.post("/api/skills/metadata/sync", isAuthenticated, async (req: Request, res: Response) => {
    try {
      // Fetch all skill groups
      const groupsRes = await fetch(
        `${ESI_BASE_URL}/universe/categories/16/?datasource=tranquility`
      );

      if (!groupsRes.ok) {
        res.status(groupsRes.status).json({ error: "Failed to fetch skill categories" });
        return;
      }

      const categoryData = await groupsRes.json();
      const groupIds = categoryData.groups || [];

      let totalSynced = 0;
      const skillMetadataList: any[] = [];

      // Fetch each group to get skill type IDs
      for (const groupId of groupIds) {
        const groupRes = await fetch(
          `${ESI_BASE_URL}/universe/groups/${groupId}/?datasource=tranquility`
        );

        if (!groupRes.ok) continue;

        const groupData = await groupRes.json();
        const skillTypeIds = groupData.types || [];
        const groupName = groupData.name;

        // Fetch each skill type
        for (const typeId of skillTypeIds) {
          const typeRes = await fetch(
            `${ESI_BASE_URL}/universe/types/${typeId}/?datasource=tranquility`
          );

          if (!typeRes.ok) continue;

          const typeData = await typeRes.json();

          // Extract skill attributes from dogma_attributes
          const dogmaAttrs = typeData.dogma_attributes || [];
          const attrMap = new Map(dogmaAttrs.map((a: any) => [a.attribute_id, a.value]));

          // Attribute IDs:
          // 180 = primaryAttribute, 181 = secondaryAttribute
          // 275 = skillTimeConstant (rank/multiplier)
          const primaryAttrId = attrMap.get(180);
          const secondaryAttrId = attrMap.get(181);
          const rank = attrMap.get(275) || 1;

          const attrNames: Record<number, string> = {
            164: 'charisma',
            165: 'intelligence',
            166: 'memory',
            167: 'perception',
            168: 'willpower',
          };

          // Extract prerequisites from dogma_attributes
          // 182-186 = requiredSkill1-5, 277-281 = requiredSkill1Level-5Level
          const prereqs: Array<{ skillId: number; level: number }> = [];
          const prereqSkillAttrs = [182, 183, 184, 277, 278];
          const prereqLevelAttrs = [277, 278, 279, 280, 281];

          for (let i = 0; i < 5; i++) {
            const skillAttrId = 182 + i;
            const levelAttrId = 277 + i;
            const prereqSkillId = attrMap.get(skillAttrId);
            const prereqLevel = attrMap.get(levelAttrId);
            if (prereqSkillId && prereqLevel) {
              prereqs.push({ skillId: prereqSkillId, level: prereqLevel });
            }
          }

          skillMetadataList.push({
            skillId: typeId,
            skillName: typeData.name,
            groupId,
            groupName,
            description: typeData.description,
            primaryAttribute: attrNames[primaryAttrId] || 'perception',
            secondaryAttribute: attrNames[secondaryAttrId] || 'willpower',
            trainingTimeMultiplier: rank,
            prerequisiteSkillsJson: prereqs.length > 0 ? prereqs : null,
          });

          totalSynced++;
        }
      }

      // Save all metadata
      await storage.upsertSkillMetadataBatch(skillMetadataList);

      res.json({
        synced: totalSynced,
        groups: groupIds.length,
      });
    } catch (error) {
      console.error("Skill metadata sync error:", error);
      res.status(500).json({ error: "Failed to sync skill metadata" });
    }
  });

  // ============================================================================
  // BIG UPDATE v0.4.0 - Market Orders Endpoints
  // ============================================================================

  // Get market orders
  app.get("/api/market/orders", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const viewAll = req.query.viewAll === 'true';

      let orders: any[];
      if (viewAll) {
        const primaryCharacterId = req.session.character!.characterId;
        const linkedCharacters = await storage.getLinkedCharacters(primaryCharacterId);
        const allCharacterIds = [primaryCharacterId, ...linkedCharacters.map(lc => lc.characterId)];
        orders = await storage.getMarketOrdersMultiChar(allCharacterIds);
      } else {
        const activeChar = await getActiveCharacterInfo(req);
        if (!activeChar) {
          res.status(401).json({ error: "Token refresh failed" });
          return;
        }
        orders = await storage.getMarketOrders(activeChar.characterId);
      }

      res.json({ orders });
    } catch (error) {
      console.error("Market orders error:", error);
      res.status(500).json({ error: "Failed to fetch market orders" });
    }
  });

  // Sync market orders from ESI
  app.post("/api/market/orders/sync", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed" });
        return;
      }

      // Check dev mode
      if (activeChar.accessToken === "dev-mode-token") {
        res.status(401).json({
          error: "Dev mode cannot access ESI",
          message: "Please log out and use 'Real EVE SSO' login to access market data"
        });
        return;
      }

      // Fetch orders from ESI
      const ordersRes = await fetch(
        `${ESI_BASE_URL}/characters/${activeChar.characterId}/orders/?datasource=tranquility`,
        {
          headers: {
            'Authorization': `Bearer ${activeChar.accessToken}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!ordersRes.ok) {
        if (ordersRes.status === 403) {
          res.status(403).json({
            error: "Missing ESI scope",
            message: "Please re-authorize to grant market orders access"
          });
          return;
        }
        res.status(ordersRes.status).json({ error: "Failed to fetch market orders from ESI" });
        return;
      }

      const esiOrders = await ordersRes.json();

      // Resolve type names
      const typeIds = [...new Set(esiOrders.map((o: any) => o.type_id))];
      const typeNames: Map<number, string> = new Map();

      if (typeIds.length > 0) {
        const namesRes = await fetch(
          `${ESI_BASE_URL}/universe/names/?datasource=tranquility`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(typeIds)
          }
        );

        if (namesRes.ok) {
          const names = await namesRes.json();
          for (const n of names) {
            typeNames.set(n.id, n.name);
          }
        }
      }

      // Resolve location names
      const locationIds = [...new Set(esiOrders.map((o: any) => o.location_id))];
      const locationNames: Map<number, string> = new Map();

      // Try to resolve from cache first
      const cachedNames = await storage.getEsiNames(activeChar.characterId, locationIds);
      for (const [id, data] of cachedNames) {
        locationNames.set(id, data.name);
      }

      // Resolve uncached locations
      const uncachedLocationIds = locationIds.filter(id => !locationNames.has(id));
      const newlyCached: { id: number; name: string; category: string }[] = [];

      console.log(`[Market] Resolving ${uncachedLocationIds.length} location names (${locationIds.length} total, ${cachedNames.size} cached)`);

      for (const locationId of uncachedLocationIds) {
        try {
          if (locationId < 1000000000000) {
            // NPC station - use public endpoint
            console.log(`[Market] Fetching station name for ${locationId}`);
            const stationRes = await fetch(
              `${ESI_BASE_URL}/universe/stations/${locationId}/?datasource=tranquility`,
              { headers: { 'Accept': 'application/json' } }
            );
            if (stationRes.ok) {
              const data = await stationRes.json();
              console.log(`[Market] Station ${locationId}: ${data.name}`);
              locationNames.set(locationId, data.name);
              newlyCached.push({ id: locationId, name: data.name, category: 'station' });
            } else {
              console.log(`[Market] Station ${locationId}: HTTP ${stationRes.status}`);
            }
          } else {
            // Player structure - requires auth
            console.log(`[Market] Fetching structure name for ${locationId}`);
            const structureRes = await fetch(
              `${ESI_BASE_URL}/universe/structures/${locationId}/?datasource=tranquility`,
              {
                headers: {
                  'Authorization': `Bearer ${activeChar.accessToken}`,
                  'Accept': 'application/json'
                }
              }
            );
            if (structureRes.ok) {
              const data = await structureRes.json();
              console.log(`[Market] Structure ${locationId}: ${data.name}`);
              locationNames.set(locationId, data.name);
              newlyCached.push({ id: locationId, name: data.name, category: 'structure' });
            } else {
              console.log(`[Market] Structure ${locationId}: HTTP ${structureRes.status} (setting as Private Structure)`);
              // Structure access denied - might be a citadel we can't dock at
              locationNames.set(locationId, 'Private Structure');
            }
          }
        } catch (err) {
          console.warn(`[Market] Failed to resolve location ${locationId}:`, err);
        }
      }

      console.log(`[Market] Resolved ${newlyCached.length} new location names, caching...`);

      // Cache newly resolved names
      if (newlyCached.length > 0) {
        try {
          await storage.cacheEsiNames(activeChar.characterId, newlyCached);
        } catch (cacheErr) {
          console.warn("Failed to cache location names:", cacheErr);
        }
      }

      // Transform to our schema
      const orders = esiOrders.map((o: any) => ({
        characterId: activeChar.characterId,
        characterName: activeChar.characterName,
        orderId: o.order_id,
        typeId: o.type_id,
        typeName: typeNames.get(o.type_id) || `Item ${o.type_id}`,
        locationId: o.location_id,
        locationName: locationNames.get(o.location_id) || null,
        volumeTotal: o.volume_total,
        volumeRemain: o.volume_remain,
        price: o.price,
        isBuyOrder: o.is_buy_order ?? false,
        issued: new Date(o.issued),
        duration: o.duration,
        escrow: o.escrow || null,
        minVolume: o.min_volume || null,
        range: o.range || null,
        regionId: o.region_id,
        state: 'active',
        estimatedProfit: null,
        profitMargin: null,
      }));

      // Sync to database (handles moving expired orders to history)
      await storage.syncMarketOrders(activeChar.characterId, orders);

      res.json({ message: "Market orders synced", count: orders.length });
    } catch (error) {
      console.error("Market orders sync error:", error);
      res.status(500).json({ error: "Failed to sync market orders" });
    }
  });

  // Get market order history
  app.get("/api/market/orders/history", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const viewAll = req.query.viewAll === 'true';
      const limit = parseInt(req.query.limit as string) || 100;

      let history: any[];
      if (viewAll) {
        const primaryCharacterId = req.session.character!.characterId;
        const linkedCharacters = await storage.getLinkedCharacters(primaryCharacterId);
        const allCharacterIds = [primaryCharacterId, ...linkedCharacters.map(lc => lc.characterId)];
        history = await storage.getMarketOrderHistoryMultiChar(allCharacterIds, limit);
      } else {
        const activeChar = await getActiveCharacterInfo(req);
        if (!activeChar) {
          res.status(401).json({ error: "Token refresh failed" });
          return;
        }
        history = await storage.getMarketOrderHistory(activeChar.characterId, limit);
      }

      res.json({ history });
    } catch (error) {
      console.error("Market order history error:", error);
      res.status(500).json({ error: "Failed to fetch market order history" });
    }
  });

  // Get market orders stats
  app.get("/api/market/orders/stats", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed" });
        return;
      }

      const orders = await storage.getMarketOrders(activeChar.characterId);
      const history = await storage.getMarketOrderHistory(activeChar.characterId, 30);

      const buyOrders = orders.filter(o => o.isBuyOrder);
      const sellOrders = orders.filter(o => !o.isBuyOrder);

      const totalSellValue = sellOrders.reduce((sum, o) => sum + (o.price * o.volumeRemain), 0);
      const totalBuyEscrow = buyOrders.reduce((sum, o) => sum + (o.escrow || 0), 0);

      const recentSales = history.filter(h => !h.isBuyOrder && h.state === 'fulfilled');
      const totalRecentRevenue = recentSales.reduce((sum, h) => sum + (h.totalRevenue || 0), 0);

      res.json({
        activeOrders: orders.length,
        sellOrders: sellOrders.length,
        buyOrders: buyOrders.length,
        totalSellValue,
        totalBuyEscrow,
        recentSalesCount: recentSales.length,
        totalRecentRevenue,
      });
    } catch (error) {
      console.error("Market orders stats error:", error);
      res.status(500).json({ error: "Failed to fetch market order stats" });
    }
  });

  // ============================================================================
  // BIG UPDATE v0.4.0 - Saved PI Chains Endpoints
  // ============================================================================

  // Get saved PI chains
  app.get("/api/pi/chains", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed" });
        return;
      }

      const chains = await storage.getSavedPiChains(activeChar.characterId);
      res.json({ chains });
    } catch (error) {
      console.error("PI chains error:", error);
      res.status(500).json({ error: "Failed to fetch PI chains" });
    }
  });

  // Create saved PI chain
  app.post("/api/pi/chains", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed" });
        return;
      }

      const { name, description, targetProductTypeId, targetProductName, targetTier, unitsPerDay, chainDataJson, planetAssignments, estimatedDailyIsk } = req.body;

      if (!name || !targetProductTypeId || !targetProductName || !targetTier || !unitsPerDay || !chainDataJson) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      const chain = await storage.createSavedPiChain({
        characterId: activeChar.characterId,
        name,
        description,
        targetProductTypeId,
        targetProductName,
        targetTier,
        unitsPerDay,
        chainDataJson,
        planetAssignments,
        estimatedDailyIsk,
        isFavorite: false,
      });

      res.json({ chain });
    } catch (error) {
      console.error("Create PI chain error:", error);
      res.status(500).json({ error: "Failed to create PI chain" });
    }
  });

  // Update saved PI chain
  app.put("/api/pi/chains/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed" });
        return;
      }

      const chainId = req.params.id;
      const existing = await storage.getSavedPiChain(chainId);

      if (!existing) {
        res.status(404).json({ error: "Chain not found" });
        return;
      }

      if (existing.characterId !== activeChar.characterId) {
        res.status(403).json({ error: "Not authorized" });
        return;
      }

      const chain = await storage.updateSavedPiChain(chainId, req.body);
      res.json({ chain });
    } catch (error) {
      console.error("Update PI chain error:", error);
      res.status(500).json({ error: "Failed to update PI chain" });
    }
  });

  // Delete saved PI chain
  app.delete("/api/pi/chains/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed" });
        return;
      }

      const chainId = req.params.id;
      const existing = await storage.getSavedPiChain(chainId);

      if (!existing) {
        res.status(404).json({ error: "Chain not found" });
        return;
      }

      if (existing.characterId !== activeChar.characterId) {
        res.status(403).json({ error: "Not authorized" });
        return;
      }

      await storage.deleteSavedPiChain(chainId);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete PI chain error:", error);
      res.status(500).json({ error: "Failed to delete PI chain" });
    }
  });

  // Toggle PI chain favorite
  app.post("/api/pi/chains/:id/favorite", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed" });
        return;
      }

      const chainId = req.params.id;
      const existing = await storage.getSavedPiChain(chainId);

      if (!existing) {
        res.status(404).json({ error: "Chain not found" });
        return;
      }

      if (existing.characterId !== activeChar.characterId) {
        res.status(403).json({ error: "Not authorized" });
        return;
      }

      const chain = await storage.togglePiChainFavorite(chainId);
      res.json({ chain });
    } catch (error) {
      console.error("Toggle PI chain favorite error:", error);
      res.status(500).json({ error: "Failed to toggle favorite" });
    }
  });

  // ============================================================================
  // JUMP PLANNER - Saved Routes & Beacon Networks
  // ============================================================================

  // Get saved jump routes for active character
  app.get("/api/jump-planner/routes", async (req, res) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const routes = await storage.getSavedJumpRoutes(activeChar.characterId);
      res.json({ routes });
    } catch (error) {
      console.error("Get jump routes error:", error);
      res.status(500).json({ error: "Failed to fetch saved routes" });
    }
  });

  // Save a new jump route
  app.post("/api/jump-planner/routes", async (req, res) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const route = await storage.createSavedJumpRoute({
        characterId: activeChar.characterId,
        ...req.body,
      });
      res.json({ route });
    } catch (error) {
      console.error("Save jump route error:", error);
      res.status(500).json({ error: "Failed to save route" });
    }
  });

  // Update a saved jump route
  app.put("/api/jump-planner/routes/:id", async (req, res) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const existing = await storage.getSavedJumpRoute(req.params.id);
      if (!existing) {
        res.status(404).json({ error: "Route not found" });
        return;
      }
      if (existing.characterId !== activeChar.characterId) {
        res.status(403).json({ error: "Not authorized" });
        return;
      }

      const route = await storage.updateSavedJumpRoute(req.params.id, req.body);
      res.json({ route });
    } catch (error) {
      console.error("Update jump route error:", error);
      res.status(500).json({ error: "Failed to update route" });
    }
  });

  // Delete a saved jump route
  app.delete("/api/jump-planner/routes/:id", async (req, res) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const existing = await storage.getSavedJumpRoute(req.params.id);
      if (!existing) {
        res.status(404).json({ error: "Route not found" });
        return;
      }
      if (existing.characterId !== activeChar.characterId) {
        res.status(403).json({ error: "Not authorized" });
        return;
      }

      await storage.deleteSavedJumpRoute(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete jump route error:", error);
      res.status(500).json({ error: "Failed to delete route" });
    }
  });

  // Toggle route favorite
  app.post("/api/jump-planner/routes/:id/favorite", async (req, res) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const existing = await storage.getSavedJumpRoute(req.params.id);
      if (!existing || existing.characterId !== activeChar.characterId) {
        res.status(404).json({ error: "Route not found" });
        return;
      }

      const route = await storage.toggleJumpRouteFavorite(req.params.id);
      res.json({ route });
    } catch (error) {
      console.error("Toggle jump route favorite error:", error);
      res.status(500).json({ error: "Failed to toggle favorite" });
    }
  });

  // Get jump beacons for active character
  app.get("/api/jump-planner/beacons", async (req, res) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const networkName = req.query.network as string | undefined;
      const beacons = await storage.getJumpBeacons(activeChar.characterId, networkName);
      res.json({ beacons });
    } catch (error) {
      console.error("Get jump beacons error:", error);
      res.status(500).json({ error: "Failed to fetch beacons" });
    }
  });

  // Get beacon network names
  app.get("/api/jump-planner/beacons/networks", async (req, res) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const networks = await storage.getJumpBeaconNetworks(activeChar.characterId);
      res.json({ networks });
    } catch (error) {
      console.error("Get beacon networks error:", error);
      res.status(500).json({ error: "Failed to fetch beacon networks" });
    }
  });

  // Add a jump beacon
  app.post("/api/jump-planner/beacons", async (req, res) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const beacon = await storage.createJumpBeacon({
        characterId: activeChar.characterId,
        ...req.body,
      });
      res.json({ beacon });
    } catch (error) {
      console.error("Save jump beacon error:", error);
      res.status(500).json({ error: "Failed to save beacon" });
    }
  });

  // Delete a jump beacon
  app.delete("/api/jump-planner/beacons/:id", async (req, res) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      await storage.deleteJumpBeacon(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete jump beacon error:", error);
      res.status(500).json({ error: "Failed to delete beacon" });
    }
  });

  // Get character's jump-related skills (JDC, JFC, JF)
  app.get("/api/jump-planner/character-skills", async (req, res) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      // Skill IDs for jump-related skills
      const SKILL_IDS = {
        JDC: 21611,  // Jump Drive Calibration
        JFC: 21610,  // Jump Fuel Conservation
        JF: 20342,   // Jump Freighters
      };

      const trainedSkills = await storage.getTrainedSkills(activeChar.characterId);
      const jdcSkill = trainedSkills.find(s => s.skillId === SKILL_IDS.JDC);
      const jfcSkill = trainedSkills.find(s => s.skillId === SKILL_IDS.JFC);
      const jfSkill = trainedSkills.find(s => s.skillId === SKILL_IDS.JF);

      res.json({
        jdc: jdcSkill?.trainedSkillLevel ?? 0,
        jfc: jfcSkill?.trainedSkillLevel ?? 0,
        jf: jfSkill?.trainedSkillLevel ?? 0,
        characterName: activeChar.characterName,
      });
    } catch (error) {
      console.error("Get jump skills error:", error);
      res.status(500).json({ error: "Failed to fetch character skills" });
    }
  });

  // Check fuel inventory from character assets
  app.get("/api/jump-planner/fuel-check/:typeId", async (req, res) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const typeId = parseInt(req.params.typeId);
      if (isNaN(typeId)) {
        res.status(400).json({ error: "Invalid type ID" });
        return;
      }

      // Fetch character assets from ESI
      const assetsResponse = await fetch(
        `${ESI_BASE_URL}/characters/${activeChar.characterId}/assets/?datasource=tranquility`,
        { headers: { Authorization: `Bearer ${activeChar.accessToken}` } }
      );

      if (!assetsResponse.ok) {
        res.json({ totalQuantity: 0, locations: [], error: "Could not fetch assets" });
        return;
      }

      const assets: any[] = await assetsResponse.json();

      // Filter for the requested isotope type
      const fuelAssets = assets.filter(a => a.type_id === typeId);

      const locations: { locationId: number; quantity: number }[] = [];
      let totalQuantity = 0;

      for (const asset of fuelAssets) {
        totalQuantity += asset.quantity;
        locations.push({
          locationId: asset.location_id,
          quantity: asset.quantity,
        });
      }

      res.json({ totalQuantity, locations });
    } catch (error) {
      console.error("Fuel check error:", error);
      res.status(500).json({ error: "Failed to check fuel inventory" });
    }
  });

  // ============================================================================
  // Income Analytics v2 - Detailed Analytics Page Endpoints
  // ============================================================================

  // Per-character income breakdown for multi-char comparison
  app.get("/api/analytics/income/by-character", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!startDate || !endDate) {
        res.status(400).json({ error: "startDate and endDate are required" });
        return;
      }

      const primaryCharacterId = req.session.character!.characterId;
      const primaryCharacterName = req.session.character!.characterName;
      const linkedCharacters = await storage.getLinkedCharacters(primaryCharacterId);

      const allCharacters = [
        { characterId: primaryCharacterId, characterName: primaryCharacterName },
        ...linkedCharacters.map(lc => ({ characterId: lc.characterId, characterName: lc.characterName })),
      ];

      const result = [];
      for (const char of allCharacters) {
        const data = await storage.getDailyIncomeSummaryRange(char.characterId, startDate, endDate);
        const totals = {
          bounty: 0, mission: 0, market: 0, industry: 0, pi: 0, mining: 0, other: 0, total: 0,
        };
        for (const day of data) {
          totals.bounty += day.bountyIncome || 0;
          totals.mission += day.missionIncome || 0;
          totals.market += day.marketIncome || 0;
          totals.industry += day.industryIncome || 0;
          totals.pi += day.piIncome || 0;
          totals.mining += day.miningIncome || 0;
          totals.other += day.otherIncome || 0;
          totals.total += day.totalIncome || 0;
        }
        result.push({
          characterId: char.characterId,
          characterName: char.characterName,
          ...totals,
          dailyData: data,
        });
      }

      res.json({ characters: result });
    } catch (error) {
      console.error("Per-character analytics error:", error);
      res.status(500).json({ error: "Failed to fetch per-character analytics" });
    }
  });

  // Wallet journal with categorization for the Journal tab
  app.get("/api/analytics/journal", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const viewAll = req.query.viewAll === 'true';
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Token refresh failed" });
        return;
      }

      const fetchJournal = async (characterId: number, characterName: string, accessToken: string) => {
        const journalRes = await fetch(
          `${ESI_BASE_URL}/characters/${characterId}/wallet/journal/?datasource=tranquility`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json'
            }
          }
        );
        if (!journalRes.ok) return [];
        const journal = await journalRes.json();
        return journal.map((entry: any) => ({
          ...entry,
          characterId,
          characterName,
          category: categorizeRefType(entry.ref_type),
        }));
      };

      let allEntries: any[] = await fetchJournal(
        activeChar.characterId, activeChar.characterName, activeChar.accessToken
      );

      if (viewAll) {
        const linkedCharacters = await storage.getLinkedCharacters(req.session.character!.characterId);
        for (const lc of linkedCharacters) {
          if (lc.characterId !== activeChar.characterId) {
            const entries = await fetchJournal(lc.characterId, lc.characterName, lc.accessToken);
            allEntries = allEntries.concat(entries);
          }
        }
      }

      // Sort by date descending
      allEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      res.json({ entries: allEntries });
    } catch (error) {
      console.error("Journal analytics error:", error);
      res.status(500).json({ error: "Failed to fetch wallet journal" });
    }
  });

  // Stacked income data: daily breakdown by source for stacked area chart
  app.get("/api/analytics/income/stacked", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const viewAll = req.query.viewAll === 'true';
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!startDate || !endDate) {
        res.status(400).json({ error: "startDate and endDate are required" });
        return;
      }

      let data: any[];
      if (viewAll) {
        const primaryCharacterId = req.session.character!.characterId;
        const linkedCharacters = await storage.getLinkedCharacters(primaryCharacterId);
        const allCharacterIds = [primaryCharacterId, ...linkedCharacters.map(lc => lc.characterId)];
        data = await storage.getDailyIncomeSummaryRangeMultiChar(allCharacterIds, startDate, endDate);
      } else {
        const activeChar = await getActiveCharacterInfo(req);
        if (!activeChar) {
          res.status(401).json({ error: "Token refresh failed" });
          return;
        }
        data = await storage.getDailyIncomeSummaryRange(activeChar.characterId, startDate, endDate);
      }

      // Aggregate multi-char data by date
      const byDate = new Map<string, any>();
      for (const day of data) {
        const existing = byDate.get(day.date);
        if (existing) {
          existing.bounty += day.bountyIncome || 0;
          existing.mission += day.missionIncome || 0;
          existing.market += day.marketIncome || 0;
          existing.industry += day.industryIncome || 0;
          existing.pi += day.piIncome || 0;
          existing.mining += day.miningIncome || 0;
          existing.other += day.otherIncome || 0;
          existing.total += day.totalIncome || 0;
        } else {
          byDate.set(day.date, {
            date: day.date,
            bounty: day.bountyIncome || 0,
            mission: day.missionIncome || 0,
            market: day.marketIncome || 0,
            industry: day.industryIncome || 0,
            pi: day.piIncome || 0,
            mining: day.miningIncome || 0,
            other: day.otherIncome || 0,
            total: day.totalIncome || 0,
          });
        }
      }

      // Fill missing dates with zeros
      const result = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().substring(0, 10);
        result.push(byDate.get(dateStr) || {
          date: dateStr, bounty: 0, mission: 0, market: 0,
          industry: 0, pi: 0, mining: 0, other: 0, total: 0,
        });
      }

      res.json({ data: result });
    } catch (error) {
      console.error("Stacked income error:", error);
      res.status(500).json({ error: "Failed to fetch stacked income data" });
    }
  });

  // ============================================================================
  // MARKET INTELLIGENCE
  // ============================================================================

  // ESI helper: fetch market orders for a region, filtered by station
  async function fetchRegionMarketOrders(regionId: number, stationId: number): Promise<any[]> {
    const allOrders: any[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const url = `${ESI_BASE_URL}/markets/${regionId}/orders/?datasource=tranquility&order_type=all&page=${page}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`ESI region market fetch failed: ${response.status} for region ${regionId} page ${page}`);
        break;
      }

      const orders: any[] = await response.json();
      // Filter to only orders at our target station
      allOrders.push(...orders.filter((o: any) => o.location_id === stationId));

      if (page === 1) {
        const pagesHeader = response.headers.get("x-pages");
        if (pagesHeader) {
          totalPages = parseInt(pagesHeader, 10);
        }
      }

      page++;
    }

    return allOrders;
  }

  // ESI helper: fetch market orders for a player-owned structure
  async function fetchStructureMarketOrders(structureId: number, accessToken: string): Promise<any[]> {
    const allOrders: any[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const url = `${ESI_BASE_URL}/markets/structures/${structureId}/?datasource=tranquility&page=${page}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("No market access to this structure. The character may lack docking rights or the structure may not have a market module.");
        }
        console.error(`ESI structure market fetch failed: ${response.status} for structure ${structureId}`);
        break;
      }

      const orders: any[] = await response.json();
      allOrders.push(...orders);

      if (page === 1) {
        const pagesHeader = response.headers.get("x-pages");
        if (pagesHeader) {
          totalPages = parseInt(pagesHeader, 10);
        }
      }

      page++;
    }

    return allOrders;
  }

  // Helper: aggregate ESI orders by type_id
  function aggregateOrdersByType(orders: any[]): Map<number, { sellMin: number | null; sellVol: number; buyMax: number | null; count: number }> {
    const typeMap = new Map<number, { sellMin: number | null; sellVol: number; buyMax: number | null; count: number }>();

    for (const order of orders) {
      const existing = typeMap.get(order.type_id) || { sellMin: null, sellVol: 0, buyMax: null, count: 0 };

      if (order.is_buy_order) {
        existing.buyMax = existing.buyMax === null ? order.price : Math.max(existing.buyMax, order.price);
      } else {
        existing.sellMin = existing.sellMin === null ? order.price : Math.min(existing.sellMin, order.price);
        existing.sellVol += order.volume_remain;
      }

      existing.count++;
      typeMap.set(order.type_id, existing);
    }

    return typeMap;
  }

  // Major trade hubs for NPC station search
  const TRADE_HUBS = [
    { id: 60003760, name: "Jita IV - Moon 4 - Caldari Navy Assembly Plant", regionId: 10000002, solarSystemId: 30000142 },
    { id: 60008494, name: "Amarr VIII (Oris) - Emperor Family Academy", regionId: 10000043, solarSystemId: 30002187 },
    { id: 60011866, name: "Dodixie IX - Moon 20 - Federation Navy Assembly Plant", regionId: 10000032, solarSystemId: 30002659 },
    { id: 60004588, name: "Rens VI - Moon 8 - Brutor Tribe Treasury", regionId: 10000030, solarSystemId: 30002510 },
    { id: 60005686, name: "Hek VIII - Moon 12 - Boundless Creation Factory", regionId: 10000042, solarSystemId: 30002053 },
  ];

  // --- Station Management ---

  app.get("/api/market/intel/stations", async (req, res) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }
      const stations = await storage.getMonitoredStations(activeChar.characterId);
      res.json({ stations });
    } catch (error) {
      console.error("Get monitored stations error:", error);
      res.status(500).json({ error: "Failed to fetch monitored stations" });
    }
  });

  app.post("/api/market/intel/stations", async (req, res) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const { stationId, stationName, stationType, regionId, solarSystemId, authCharacterId } = req.body;
      if (!stationId || !stationName || !stationType || !regionId) {
        res.status(400).json({ error: "Missing required fields: stationId, stationName, stationType, regionId" });
        return;
      }

      const station = await storage.addMonitoredStation({
        characterId: activeChar.characterId,
        stationId: Number(stationId),
        stationName,
        stationType,
        regionId: Number(regionId),
        solarSystemId: solarSystemId ? Number(solarSystemId) : null,
        authCharacterId: authCharacterId ? Number(authCharacterId) : null,
        isActive: true,
      });

      res.json({ station });
    } catch (error) {
      console.error("Add monitored station error:", error);
      res.status(500).json({ error: "Failed to add monitored station" });
    }
  });

  app.delete("/api/market/intel/stations/:id", async (req, res) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }
      await storage.removeMonitoredStation(req.params.id, activeChar.characterId);
      res.json({ success: true });
    } catch (error) {
      console.error("Remove monitored station error:", error);
      res.status(500).json({ error: "Failed to remove monitored station" });
    }
  });

  app.get("/api/market/intel/stations/search", async (req, res) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const query = (req.query.q as string || "").trim();
      if (query.length < 2) {
        res.status(400).json({ error: "Search query must be at least 2 characters" });
        return;
      }

      const results: any[] = [];

      // Search trade hubs first (always available, no ESI call)
      const matchedHubs = TRADE_HUBS.filter(hub =>
        hub.name.toLowerCase().includes(query.toLowerCase())
      );
      results.push(...matchedHubs.map(hub => ({
        id: hub.id,
        name: hub.name,
        type: "npc",
        regionId: hub.regionId,
        solarSystemId: hub.solarSystemId,
      })));

      // Search ESI for player-owned structures if user has a real token
      if (activeChar.accessToken !== "dev-mode-token" && query.length >= 3) {
        try {
          const searchUrl = `${ESI_BASE_URL}/characters/${activeChar.characterId}/search/?datasource=tranquility&categories=structure&search=${encodeURIComponent(query)}&strict=false`;
          const searchResponse = await fetch(searchUrl, {
            headers: { Authorization: `Bearer ${activeChar.accessToken}` },
          });

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const structureIds = (searchData.structure || []).slice(0, 10);

            for (const structureId of structureIds) {
              try {
                const structUrl = `${ESI_BASE_URL}/universe/structures/${structureId}/?datasource=tranquility`;
                const structResponse = await fetch(structUrl, {
                  headers: { Authorization: `Bearer ${activeChar.accessToken}` },
                });

                if (structResponse.ok) {
                  const structData = await structResponse.json();
                  results.push({
                    id: structureId,
                    name: structData.name,
                    type: "player_owned",
                    regionId: null, // Will need to be resolved
                    solarSystemId: structData.solar_system_id,
                  });
                }
              } catch (err) {
                // Skip individual structure lookup failures
              }
            }
          }
        } catch (err) {
          console.error("ESI structure search error:", err);
        }
      }

      res.json({ results });
    } catch (error) {
      console.error("Station search error:", error);
      res.status(500).json({ error: "Failed to search stations" });
    }
  });

  // --- Watchlist Management ---

  app.get("/api/market/intel/watchlists", async (req, res) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const stationId = req.query.stationId as string | undefined;
      const watchlistData = await storage.getWatchlists(activeChar.characterId, stationId);
      res.json({ watchlists: watchlistData });
    } catch (error) {
      console.error("Get watchlists error:", error);
      res.status(500).json({ error: "Failed to fetch watchlists" });
    }
  });

  app.post("/api/market/intel/watchlists", async (req, res) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const { monitoredStationId, name } = req.body;
      if (!monitoredStationId || !name) {
        res.status(400).json({ error: "Missing required fields: monitoredStationId, name" });
        return;
      }

      // Verify station belongs to user
      const station = await storage.getMonitoredStation(monitoredStationId, activeChar.characterId);
      if (!station) {
        res.status(404).json({ error: "Station not found" });
        return;
      }

      const watchlist = await storage.createWatchlist({
        characterId: activeChar.characterId,
        monitoredStationId,
        name,
      });

      res.json({ watchlist });
    } catch (error) {
      console.error("Create watchlist error:", error);
      res.status(500).json({ error: "Failed to create watchlist" });
    }
  });

  app.delete("/api/market/intel/watchlists/:id", async (req, res) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }
      await storage.deleteWatchlist(req.params.id, activeChar.characterId);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete watchlist error:", error);
      res.status(500).json({ error: "Failed to delete watchlist" });
    }
  });

  app.get("/api/market/intel/watchlists/:id/items", async (req, res) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      // Verify watchlist belongs to user
      const watchlist = await storage.getWatchlist(req.params.id, activeChar.characterId);
      if (!watchlist) {
        res.status(404).json({ error: "Watchlist not found" });
        return;
      }

      const items = await storage.getWatchlistItems(req.params.id);
      res.json({ items });
    } catch (error) {
      console.error("Get watchlist items error:", error);
      res.status(500).json({ error: "Failed to fetch watchlist items" });
    }
  });

  app.post("/api/market/intel/watchlists/:id/items", async (req, res) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const watchlistId = req.params.id;
      const { typeId, typeName, minStockThreshold, category } = req.body;

      // Verify watchlist belongs to user
      const watchlist = await storage.getWatchlist(watchlistId, activeChar.characterId);
      if (!watchlist) {
        res.status(404).json({ error: "Watchlist not found" });
        return;
      }

      // If typeId and typeName are provided directly, use them
      if (typeId && typeName) {
        const item = await storage.addWatchlistItem({
          watchlistId,
          typeId: Number(typeId),
          typeName,
          minStockThreshold: minStockThreshold || 5,
          category: category || null,
        });
        res.json({ item });
        return;
      }

      // Otherwise try to look up via Fuzzwork API
      if (typeName) {
        try {
          const fuzzUrl = `https://www.fuzzwork.co.uk/api/typeid.php?typename=${encodeURIComponent(typeName)}`;
          const fuzzResponse = await fetch(fuzzUrl);
          if (fuzzResponse.ok) {
            const fuzzData = await fuzzResponse.json();
            if (fuzzData.typeID && parseInt(fuzzData.typeID, 10) > 0) {
              const item = await storage.addWatchlistItem({
                watchlistId,
                typeId: parseInt(fuzzData.typeID, 10),
                typeName: fuzzData.typeName || typeName,
                minStockThreshold: minStockThreshold || 5,
                category: category || null,
              });
              res.json({ item });
              return;
            }
          }
        } catch (err) {
          console.error("Fuzzwork API error:", err);
        }
        res.status(404).json({ error: `Item "${typeName}" not found in EVE database` });
        return;
      }

      res.status(400).json({ error: "Must provide typeId+typeName or typeName for lookup" });
    } catch (error) {
      console.error("Add watchlist item error:", error);
      res.status(500).json({ error: "Failed to add watchlist item" });
    }
  });

  app.delete("/api/market/intel/watchlists/:id/items/:itemId", async (req, res) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      // Verify watchlist belongs to user
      const watchlist = await storage.getWatchlist(req.params.id, activeChar.characterId);
      if (!watchlist) {
        res.status(404).json({ error: "Watchlist not found" });
        return;
      }

      await storage.removeWatchlistItem(req.params.itemId);
      res.json({ success: true });
    } catch (error) {
      console.error("Remove watchlist item error:", error);
      res.status(500).json({ error: "Failed to remove watchlist item" });
    }
  });

  // --- Market Data Sync ---

  app.post("/api/market/intel/sync/:stationId", async (req, res) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const station = await storage.getMonitoredStation(req.params.stationId, activeChar.characterId);
      if (!station) {
        res.status(404).json({ error: "Station not found" });
        return;
      }

      let orders: any[];

      if (station.stationType === "player_owned") {
        // Structure market - needs auth
        let accessToken = activeChar.accessToken;

        // If a specific auth character was set and it's a linked char, use their token
        if (station.authCharacterId && station.authCharacterId !== activeChar.characterId) {
          const linkedChars = await storage.getLinkedCharacters(req.session.character!.characterId);
          const linkedChar = linkedChars.find(lc => lc.characterId === station.authCharacterId);
          if (linkedChar) {
            const linkedToken = await refreshLinkedCharacterToken(linkedChar);
            if (linkedToken) {
              accessToken = linkedToken;
            }
          }
        }

        if (accessToken === "dev-mode-token") {
          res.status(400).json({ error: "Dev mode cannot access ESI. Use Real EVE SSO login." });
          return;
        }

        orders = await fetchStructureMarketOrders(station.stationId, accessToken);
      } else {
        // NPC station - public endpoint
        orders = await fetchRegionMarketOrders(station.regionId, station.stationId);
      }

      // Aggregate orders by type
      const typeMap = aggregateOrdersByType(orders);

      // Upsert snapshots
      let snapshotCount = 0;
      for (const [typeId, data] of typeMap) {
        await storage.upsertMarketSnapshot({
          monitoredStationId: station.id,
          typeId,
          sellPriceMin: data.sellMin,
          sellVolumeTotal: data.sellVol,
          buyPriceMax: data.buyMax,
          orderCount: data.count,
          fetchedAt: new Date(),
        });
        snapshotCount++;
      }

      // Update station's last fetched time
      await storage.updateMonitoredStationFetchTime(station.id);

      res.json({ success: true, snapshotCount, orderCount: orders.length });
    } catch (error: any) {
      console.error("Sync station market data error:", error);
      res.status(500).json({ error: error.message || "Failed to sync market data" });
    }
  });

  app.post("/api/market/intel/sync-jita", async (req, res) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const JITA_REGION = 10000002; // The Forge
      const JITA_STATION = 60003760; // Jita 4-4

      // Fetch all orders for The Forge region, filtered to Jita station
      const orders = await fetchRegionMarketOrders(JITA_REGION, JITA_STATION);

      // Aggregate by type
      const typeMap = aggregateOrdersByType(orders);

      // Upsert Jita reference prices
      let priceCount = 0;
      for (const [typeId, data] of typeMap) {
        await storage.upsertJitaReferencePrice({
          typeId,
          sellMin: data.sellMin,
          buyMax: data.buyMax,
          volumeDaily: data.sellVol, // Using sell volume as proxy
          updatedAt: new Date(),
        });
        priceCount++;
      }

      res.json({ success: true, priceCount });
    } catch (error) {
      console.error("Sync Jita prices error:", error);
      res.status(500).json({ error: "Failed to sync Jita prices" });
    }
  });

  // --- Gap Analysis ---

  app.get("/api/market/intel/gaps/:stationId", async (req, res) => {
    try {
      const activeChar = await getActiveCharacterInfo(req);
      if (!activeChar) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const stationId = req.params.stationId;
      const watchlistId = req.query.watchlistId as string;

      if (!watchlistId) {
        res.status(400).json({ error: "watchlistId query parameter is required" });
        return;
      }

      // Verify station and watchlist belong to user
      const station = await storage.getMonitoredStation(stationId, activeChar.characterId);
      if (!station) {
        res.status(404).json({ error: "Station not found" });
        return;
      }

      const watchlist = await storage.getWatchlist(watchlistId, activeChar.characterId);
      if (!watchlist) {
        res.status(404).json({ error: "Watchlist not found" });
        return;
      }

      // Get watchlist items
      const items = await storage.getWatchlistItems(watchlistId);
      const typeIds = items.map(i => i.typeId);

      if (typeIds.length === 0) {
        res.json({ gaps: [], stationName: station.stationName, lastFetchedAt: station.lastFetchedAt });
        return;
      }

      // Get market snapshots and Jita prices
      const [snapshots, jitaPrices] = await Promise.all([
        storage.getMarketSnapshotsByTypes(stationId, typeIds),
        storage.getJitaReferencePrices(typeIds),
      ]);

      const snapshotMap = new Map(snapshots.map(s => [s.typeId, s]));
      const jitaMap = new Map(jitaPrices.map(j => [j.typeId, j]));

      // Calculate gap analysis
      const gaps = items.map(item => {
        const snapshot = snapshotMap.get(item.typeId);
        const jita = jitaMap.get(item.typeId);

        const currentStock = snapshot?.sellVolumeTotal ?? 0;
        let status: "out_of_stock" | "low_stock" | "stocked" = "stocked";
        if (currentStock === 0) {
          status = "out_of_stock";
        } else if (currentStock < item.minStockThreshold) {
          status = "low_stock";
        }

        const jitaSellMin = jita?.sellMin ?? null;
        const jitaBuyMax = jita?.buyMax ?? null;
        // Recommended sell price: 20% markup over Jita sell
        const recommendedPrice = jitaSellMin ? jitaSellMin * 1.20 : null;
        // Profit = recommended sell price - Jita buy price (what you'd pay in Jita)
        const profitPerUnit = (recommendedPrice && jitaSellMin) ? recommendedPrice - jitaSellMin : null;

        return {
          typeId: item.typeId,
          typeName: item.typeName,
          category: item.category,
          minStockThreshold: item.minStockThreshold,
          currentStock,
          status,
          localSellMin: snapshot?.sellPriceMin ?? null,
          jitaSellMin,
          jitaBuyMax,
          recommendedPrice,
          profitPerUnit,
        };
      });

      // Sort: out_of_stock first, then low_stock, then stocked
      const statusOrder = { out_of_stock: 0, low_stock: 1, stocked: 2 };
      gaps.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

      res.json({ gaps, stationName: station.stationName, lastFetchedAt: station.lastFetchedAt });
    } catch (error) {
      console.error("Gap analysis error:", error);
      res.status(500).json({ error: "Failed to calculate gap analysis" });
    }
  });

  // ============================================================================
  // NEW FEATURE ENDPOINTS (v0.6.0)
  // ============================================================================

  // 1. Jump Clones - GET /api/character/clones
  // ESI scope: esi-clones.read_clones.v1
  app.get("/api/character/clones", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    try {
      const token = await refreshTokenIfNeeded(req);
      if (!token) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const characterId = req.session.character.characterId;
      const characterName = req.session.character.characterName;

      // Fetch clone data and active implants in parallel
      const [clonesRes, implantsRes] = await Promise.all([
        fetch(`${ESI_BASE_URL}/characters/${characterId}/clones/?datasource=tranquility`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${ESI_BASE_URL}/characters/${characterId}/implants/?datasource=tranquility`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!clonesRes.ok) {
        res.status(clonesRes.status).json({ error: "Failed to fetch clone data from ESI" });
        return;
      }
      if (!implantsRes.ok) {
        res.status(implantsRes.status).json({ error: "Failed to fetch implants data from ESI" });
        return;
      }

      const clonesData = await clonesRes.json();
      const activeImplantTypeIds: number[] = await implantsRes.json();

      // Collect all type IDs for name resolution
      const jumpClones: any[] = clonesData.jump_clones || [];
      const allTypeIds = new Set<number>();
      for (const clone of jumpClones) {
        for (const typeId of (clone.implants || [])) {
          allTypeIds.add(typeId);
        }
      }
      for (const typeId of activeImplantTypeIds) {
        allTypeIds.add(typeId);
      }

      // Resolve type names
      const typeNames = new Map<number, string>();
      if (allTypeIds.size > 0) {
        try {
          const namesRes = await fetch(`${ESI_BASE_URL}/universe/names/?datasource=tranquility`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(Array.from(allTypeIds)),
          });
          if (namesRes.ok) {
            const namesData = await namesRes.json();
            for (const item of namesData) {
              typeNames.set(item.id, item.name);
            }
          }
        } catch (err) {
          console.warn("Failed to resolve implant type names:", err);
        }
      }

      // Collect location IDs for name resolution
      const locationIds = new Set<number>();
      if (clonesData.home_location?.location_id) {
        locationIds.add(clonesData.home_location.location_id);
      }
      for (const clone of jumpClones) {
        if (clone.location_id) locationIds.add(clone.location_id);
      }

      // Resolve location names
      const locationNames = new Map<number, string>();
      for (const locationId of Array.from(locationIds)) {
        try {
          if (locationId < 64000000) {
            // NPC station
            const stationRes = await fetch(
              `${ESI_BASE_URL}/universe/stations/${locationId}/?datasource=tranquility`,
              { headers: { Accept: "application/json" } }
            );
            if (stationRes.ok) {
              const data = await stationRes.json();
              locationNames.set(locationId, data.name);
            }
          } else {
            // Player structure - requires auth token
            const structureRes = await fetch(
              `${ESI_BASE_URL}/universe/structures/${locationId}/?datasource=tranquility`,
              { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
            );
            if (structureRes.ok) {
              const data = await structureRes.json();
              locationNames.set(locationId, data.name);
            } else if (structureRes.status === 403) {
              locationNames.set(locationId, "Private Structure");
            }
          }
        } catch (err) {
          console.warn(`Failed to resolve clone location ${locationId}:`, err);
        }
      }

      const homeLocation = clonesData.home_location
        ? {
            locationId: clonesData.home_location.location_id,
            locationType: clonesData.home_location.location_type,
            locationName: locationNames.get(clonesData.home_location.location_id) || null,
          }
        : null;

      const resolvedJumpClones = jumpClones.map((clone: any) => ({
        id: clone.jump_clone_id,
        locationId: clone.location_id,
        locationType: clone.location_type,
        locationName: locationNames.get(clone.location_id) || null,
        implants: (clone.implants || []).map((typeId: number) => ({
          typeId,
          name: typeNames.get(typeId) || `Item ${typeId}`,
        })),
      }));

      const resolvedActiveImplants = activeImplantTypeIds.map((typeId) => ({
        typeId,
        name: typeNames.get(typeId) || `Item ${typeId}`,
      }));

      res.json({
        homeLocation,
        jumpClones: resolvedJumpClones,
        activeImplants: resolvedActiveImplants,
        characterName,
      });
    } catch (error) {
      console.error("Clones error:", error);
      res.status(500).json({ error: "Failed to fetch clone data" });
    }
  });

  // 2. Wallet Transactions - GET /api/wallet/transactions
  // ESI scope: esi-wallet.read_character_wallet.v1
  app.get("/api/wallet/transactions", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    try {
      const viewAll = req.query.viewAll === "true";
      const page = parseInt((req.query.page as string) || "1", 10);
      const primaryCharacterId = req.session.character.characterId;
      const primaryCharacterName = req.session.character.characterName;

      // Helper to fetch and enrich transactions for one character
      const fetchCharacterTransactions = async (charId: number, charToken: string, charName: string): Promise<any[]> => {
        const txRes = await fetch(
          `${ESI_BASE_URL}/characters/${charId}/wallet/transactions/?datasource=tranquility&page=${page}`,
          { headers: { Authorization: `Bearer ${charToken}` } }
        );
        if (!txRes.ok) return [];
        const transactions: any[] = await txRes.json();

        // Collect type IDs and location IDs
        const typeIds = Array.from(new Set(transactions.map((t: any) => t.type_id as number)));
        const locationIds = Array.from(new Set(transactions.map((t: any) => t.location_id as number)));

        const typeNames = new Map<number, string>();
        const locationNames = new Map<number, string>();

        // Resolve type names
        if (typeIds.length > 0) {
          try {
            const namesRes = await fetch(`${ESI_BASE_URL}/universe/names/?datasource=tranquility`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(typeIds),
            });
            if (namesRes.ok) {
              const namesData = await namesRes.json();
              for (const item of namesData) {
                typeNames.set(item.id, item.name);
              }
            }
          } catch (err) {
            console.warn("Failed to resolve transaction type names:", err);
          }
        }

        // Resolve location names (stations only for transactions)
        for (const locationId of locationIds) {
          try {
            const stationRes = await fetch(
              `${ESI_BASE_URL}/universe/stations/${locationId}/?datasource=tranquility`,
              { headers: { Accept: "application/json" } }
            );
            if (stationRes.ok) {
              const data = await stationRes.json();
              locationNames.set(locationId, data.name);
            }
          } catch (err) {
            console.warn(`Failed to resolve transaction location ${locationId}:`, err);
          }
        }

        return transactions.map((t: any) => ({
          ...t,
          typeName: typeNames.get(t.type_id) || `Item ${t.type_id}`,
          locationName: locationNames.get(t.location_id) || null,
          characterId: charId,
          characterName: charName,
        }));
      }

      let allTransactions: any[] = [];

      if (viewAll) {
        const primaryToken = await refreshTokenIfNeeded(req);
        if (primaryToken) {
          const txs = await fetchCharacterTransactions(primaryCharacterId, primaryToken, primaryCharacterName);
          allTransactions = [...allTransactions, ...txs];
        }
        const linkedCharacters = await storage.getLinkedCharacters(primaryCharacterId);
        for (const linkedChar of linkedCharacters) {
          if (!linkedChar.isActive) continue;
          const linkedToken = await refreshLinkedCharacterToken(linkedChar);
          if (!linkedToken) continue;
          const txs = await fetchCharacterTransactions(linkedChar.characterId, linkedToken, linkedChar.characterName);
          allTransactions = [...allTransactions, ...txs];
        }
      } else {
        const activeCharacterId = req.session.activeCharacterId || primaryCharacterId;
        let activeToken: string | null = null;
        let activeCharacterName = primaryCharacterName;
        if (activeCharacterId === primaryCharacterId) {
          activeToken = await refreshTokenIfNeeded(req);
        } else {
          const linkedChar = await storage.getLinkedCharacter(activeCharacterId);
          if (linkedChar) {
            activeToken = await refreshLinkedCharacterToken(linkedChar);
            activeCharacterName = linkedChar.characterName;
          }
        }
        if (!activeToken) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
        allTransactions = await fetchCharacterTransactions(activeCharacterId, activeToken, activeCharacterName);
      }

      // Sort by date descending
      allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      res.json({
        transactions: allTransactions,
        characterId: primaryCharacterId,
        characterName: primaryCharacterName,
      });
    } catch (error) {
      console.error("Wallet transactions error:", error);
      res.status(500).json({ error: "Failed to fetch wallet transactions" });
    }
  });

  // 3. Loyalty Points - GET /api/character/loyalty
  // No special ESI scope required (uses wallet auth token)
  app.get("/api/character/loyalty", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    try {
      const viewAll = req.query.viewAll === "true";
      const primaryCharacterId = req.session.character.characterId;
      const primaryCharacterName = req.session.character.characterName;

      const fetchLoyaltyPoints = async (charId: number, charToken: string): Promise<{ corporationId: number; points: number }[]> => {
        const res = await fetch(
          `${ESI_BASE_URL}/characters/${charId}/loyalty/points/?datasource=tranquility`,
          { headers: { Authorization: `Bearer ${charToken}` } }
        );
        if (!res.ok) return [];
        const data = await res.json();
        return data.map((item: any) => ({ corporationId: item.corporation_id, points: item.loyalty_points }));
      }

      let combinedPoints: { corporationId: number; points: number }[] = [];

      if (viewAll) {
        const primaryToken = await refreshTokenIfNeeded(req);
        if (primaryToken) {
          const lp = await fetchLoyaltyPoints(primaryCharacterId, primaryToken);
          combinedPoints = [...combinedPoints, ...lp];
        }
        const linkedCharacters = await storage.getLinkedCharacters(primaryCharacterId);
        for (const linkedChar of linkedCharacters) {
          if (!linkedChar.isActive) continue;
          const linkedToken = await refreshLinkedCharacterToken(linkedChar);
          if (!linkedToken) continue;
          const lp = await fetchLoyaltyPoints(linkedChar.characterId, linkedToken);
          combinedPoints = [...combinedPoints, ...lp];
        }
        // Merge by corporation (sum points)
        const merged = new Map<number, number>();
        for (const lp of combinedPoints) {
          merged.set(lp.corporationId, (merged.get(lp.corporationId) || 0) + lp.points);
        }
        combinedPoints = Array.from(merged.entries()).map(([corporationId, points]) => ({ corporationId, points }));
      } else {
        const activeCharacterId = req.session.activeCharacterId || primaryCharacterId;
        let activeToken: string | null = null;
        if (activeCharacterId === primaryCharacterId) {
          activeToken = await refreshTokenIfNeeded(req);
        } else {
          const linkedChar = await storage.getLinkedCharacter(activeCharacterId);
          if (linkedChar) activeToken = await refreshLinkedCharacterToken(linkedChar);
        }
        if (!activeToken) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
        combinedPoints = await fetchLoyaltyPoints(activeCharacterId, activeToken);
      }

      // Resolve corporation names
      const corpIds = Array.from(new Set(combinedPoints.map((lp) => lp.corporationId)));
      const corpNames = new Map<number, string>();
      if (corpIds.length > 0) {
        try {
          const namesRes = await fetch(`${ESI_BASE_URL}/universe/names/?datasource=tranquility`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(corpIds),
          });
          if (namesRes.ok) {
            const namesData = await namesRes.json();
            for (const item of namesData) {
              corpNames.set(item.id, item.name);
            }
          }
        } catch (err) {
          console.warn("Failed to resolve corporation names for loyalty points:", err);
        }
      }

      const loyaltyPoints = combinedPoints.map((lp) => ({
        corporationId: lp.corporationId,
        corporationName: corpNames.get(lp.corporationId) || `Corporation ${lp.corporationId}`,
        points: lp.points,
      }));

      // Sort by points descending
      loyaltyPoints.sort((a, b) => b.points - a.points);

      res.json({
        loyaltyPoints,
        characterName: primaryCharacterName,
      });
    } catch (error) {
      console.error("Loyalty points error:", error);
      res.status(500).json({ error: "Failed to fetch loyalty points" });
    }
  });

  // 4. NPC Standings - GET /api/character/standings
  // ESI scope: esi-characters.read_standings.v1
  app.get("/api/character/standings", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    try {
      const token = await refreshTokenIfNeeded(req);
      if (!token) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const characterId = req.session.character.characterId;
      const characterName = req.session.character.characterName;

      const standingsRes = await fetch(
        `${ESI_BASE_URL}/characters/${characterId}/standings/?datasource=tranquility`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!standingsRes.ok) {
        res.status(standingsRes.status).json({ error: "Failed to fetch standings from ESI" });
        return;
      }
      const standingsData: any[] = await standingsRes.json();

      // Resolve names for all from_ids
      const fromIds = Array.from(new Set(standingsData.map((s: any) => s.from_id as number)));
      const entityNames = new Map<number, string>();
      if (fromIds.length > 0) {
        try {
          const namesRes = await fetch(`${ESI_BASE_URL}/universe/names/?datasource=tranquility`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fromIds),
          });
          if (namesRes.ok) {
            const namesData = await namesRes.json();
            for (const item of namesData) {
              entityNames.set(item.id, item.name);
            }
          }
        } catch (err) {
          console.warn("Failed to resolve standings entity names:", err);
        }
      }

      const standings = standingsData
        .map((s: any) => ({
          fromId: s.from_id,
          fromType: s.from_type,
          name: entityNames.get(s.from_id) || `Entity ${s.from_id}`,
          standing: s.standing,
        }))
        .sort((a, b) => b.standing - a.standing);

      res.json({ standings, characterName });
    } catch (error) {
      console.error("Standings error:", error);
      res.status(500).json({ error: "Failed to fetch standings" });
    }
  });

  // 5. Notifications - GET /api/character/notifications
  // ESI scope: esi-characters.read_notifications.v1
  app.get("/api/character/notifications", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    try {
      const token = await refreshTokenIfNeeded(req);
      if (!token) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const characterId = req.session.character.characterId;
      const characterName = req.session.character.characterName;

      const notifRes = await fetch(
        `${ESI_BASE_URL}/characters/${characterId}/notifications/?datasource=tranquility`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!notifRes.ok) {
        res.status(notifRes.status).json({ error: "Failed to fetch notifications from ESI" });
        return;
      }
      const notifData: any[] = await notifRes.json();

      // Sort by timestamp desc, return last 50
      notifData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const notifications = notifData.slice(0, 50).map((n: any) => ({
        id: n.notification_id,
        type: n.type,
        timestamp: n.timestamp,
        isRead: n.is_read,
        text: n.text || null,
      }));

      res.json({ notifications, characterName });
    } catch (error) {
      console.error("Notifications error:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // 6. Killmail List - GET /api/character/killmails
  // ESI scope: esi-killmails.read_killmails.v1
  app.get("/api/character/killmails", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    try {
      const token = await refreshTokenIfNeeded(req);
      if (!token) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const characterId = req.session.character.characterId;
      const characterName = req.session.character.characterName;
      const filterType = (req.query.type as string) || "kills";
      const page = parseInt((req.query.page as string) || "1", 10);

      // Fetch recent killmail references
      const recentRes = await fetch(
        `${ESI_BASE_URL}/characters/${characterId}/killmails/recent/?datasource=tranquility`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!recentRes.ok) {
        res.status(recentRes.status).json({ error: "Failed to fetch killmails from ESI" });
        return;
      }
      const recentKillmails: { killmail_id: number; killmail_hash: string }[] = await recentRes.json();

      // Fetch full killmail details (limit to avoid too many ESI calls)
      const pageSize = 20;
      const start = (page - 1) * pageSize;
      const pageRefs = recentKillmails.slice(start, start + pageSize * 3); // fetch extra to allow filtering

      const fullKillmails: any[] = [];
      for (const ref of pageRefs) {
        try {
          const kmRes = await fetch(
            `${ESI_BASE_URL}/killmails/${ref.killmail_id}/${ref.killmail_hash}/?datasource=tranquility`,
            { headers: { Accept: "application/json" } }
          );
          if (kmRes.ok) {
            const km = await kmRes.json();
            fullKillmails.push({ ...km, killmail_hash: ref.killmail_hash });
          }
        } catch (err) {
          console.warn(`Failed to fetch killmail ${ref.killmail_id}:`, err);
        }
      }

      // Filter by kills or losses
      let filtered = fullKillmails;
      if (filterType === "losses") {
        filtered = fullKillmails.filter(
          (km: any) => km.victim?.character_id === characterId
        );
      } else {
        // kills: character is among attackers
        filtered = fullKillmails.filter(
          (km: any) =>
            km.victim?.character_id !== characterId &&
            (km.attackers || []).some((a: any) => a.character_id === characterId)
        );
      }

      // Trim to page size
      const paginated = filtered.slice(0, pageSize);

      // Collect type IDs (ship types) and system IDs for resolution
      const typeIds = new Set<number>();
      const systemIds = new Set<number>();
      for (const km of paginated) {
        if (km.victim?.ship_type_id) typeIds.add(km.victim.ship_type_id);
        if (km.solar_system_id) systemIds.add(km.solar_system_id);
      }

      const typeNames = new Map<number, string>();
      const systemNames = new Map<number, string>();

      if (typeIds.size > 0 || systemIds.size > 0) {
        try {
          const idsToResolve = Array.from(typeIds).concat(Array.from(systemIds));
          const namesRes = await fetch(`${ESI_BASE_URL}/universe/names/?datasource=tranquility`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(idsToResolve),
          });
          if (namesRes.ok) {
            const namesData = await namesRes.json();
            for (const item of namesData) {
              if (typeIds.has(item.id)) typeNames.set(item.id, item.name);
              if (systemIds.has(item.id)) systemNames.set(item.id, item.name);
            }
          }
        } catch (err) {
          console.warn("Failed to resolve killmail names:", err);
        }
      }

      const killmails = paginated.map((km: any) => {
        return {
          id: km.killmail_id,
          hash: km.killmail_hash,
          time: km.killmail_time,
          systemId: km.solar_system_id,
          systemName: systemNames.get(km.solar_system_id) || `System ${km.solar_system_id}`,
          victimShipTypeId: km.victim?.ship_type_id || null,
          victimShipName: km.victim?.ship_type_id ? (typeNames.get(km.victim.ship_type_id) || `Ship ${km.victim.ship_type_id}`) : null,
          iskLost: km.victim?.items
            ? km.victim.items.reduce((sum: number, item: any) => sum + (item.quantity_destroyed || 0), 0)
            : 0,
          isKill: filterType === "kills",
          attackerCount: (km.attackers || []).length,
        };
      });

      res.json({
        killmails,
        total: recentKillmails.length,
        characterName,
      });
    } catch (error) {
      console.error("Killmails error:", error);
      res.status(500).json({ error: "Failed to fetch killmails" });
    }
  });

  // 7a. Net Worth History - GET /api/analytics/net-worth/history
  app.get("/api/analytics/net-worth/history", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    try {
      const characterId = req.session.character.characterId;
      const days = parseInt((req.query.days as string) || "30", 10);
      const history = await storage.getNetWorthHistory(characterId, days);
      res.json({ history, characterId });
    } catch (error) {
      console.error("Net worth history error:", error);
      res.status(500).json({ error: "Failed to fetch net worth history" });
    }
  });

  // 7b. Net Worth Snapshot - POST /api/analytics/net-worth/snapshot
  app.post("/api/analytics/net-worth/snapshot", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    try {
      const characterId = req.session.character.characterId;
      const { totalValue } = req.body;
      if (typeof totalValue !== "number" || isNaN(totalValue)) {
        res.status(400).json({ error: "Invalid totalValue: must be a number" });
        return;
      }
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      await storage.saveNetWorthSnapshot(characterId, today, totalValue);
      res.json({ success: true, date: today, totalValue });
    } catch (error) {
      console.error("Net worth snapshot error:", error);
      res.status(500).json({ error: "Failed to save net worth snapshot" });
    }
  });

  // ============================================================================
  // NEW FEATURE ENDPOINTS (v0.7.0)
  // ============================================================================

  // Shared helper: resolve a set of IDs to names via ESI /universe/names/ (batched by 1000)
  async function resolveNames(ids: number[]): Promise<Map<number, { name: string; category: string }>> {
    const out = new Map<number, { name: string; category: string }>();
    const unique = Array.from(new Set(ids)).filter((n) => n > 0);
    for (let i = 0; i < unique.length; i += 1000) {
      const batch = unique.slice(i, i + 1000);
      try {
        const r = await fetch(`${ESI_BASE_URL}/universe/names/?datasource=tranquility`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(batch),
        });
        if (r.ok) {
          const data = await r.json();
          for (const item of data) out.set(item.id, { name: item.name, category: item.category });
        }
      } catch (err) {
        console.warn("resolveNames batch failed:", err);
      }
    }
    return out;
  }

  // Shared helper: resolve station/structure location names (NPC stations public, structures need token)
  async function resolveLocationNames(locationIds: number[], token: string): Promise<Map<number, string>> {
    const names = new Map<number, string>();
    const unique = Array.from(new Set(locationIds)).filter((n) => n > 0);
    const stationIds = unique.filter((id) => id < 100000000);
    const structureIds = unique.filter((id) => id >= 100000000);
    // NPC stations via /universe/names/ (batched)
    if (stationIds.length > 0) {
      const resolved = await resolveNames(stationIds);
      for (const [id, info] of resolved) names.set(id, info.name);
    }
    // Player structures one-by-one (auth required)
    for (const id of structureIds) {
      try {
        const r = await fetch(`${ESI_BASE_URL}/universe/structures/${id}/?datasource=tranquility`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        if (r.ok) {
          const data = await r.json();
          names.set(id, data.name);
        } else if (r.status === 403) {
          names.set(id, "Private Structure");
        }
      } catch { /* ignore */ }
    }
    return names;
  }

  // 1. Blueprint Library - GET /api/character/blueprints
  // ESI scope: esi-characters.read_blueprints.v1
  app.get("/api/character/blueprints", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    try {
      const token = await refreshTokenIfNeeded(req);
      if (!token) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const characterId = req.session.character.characterId;

      // Blueprints are paginated
      const all: any[] = [];
      for (let page = 1; page <= 20; page++) {
        const r = await fetch(
          `${ESI_BASE_URL}/characters/${characterId}/blueprints/?datasource=tranquility&page=${page}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!r.ok) {
          if (page === 1) {
            res.status(r.status).json({ error: "Failed to fetch blueprints from ESI" });
            return;
          }
          break;
        }
        const batch = await r.json();
        if (!Array.isArray(batch) || batch.length === 0) break;
        all.push(...batch);
        if (batch.length < 1000) break;
      }

      const typeNames = await resolveNames(all.map((b) => b.type_id));
      const locationNames = await resolveLocationNames(all.map((b) => b.location_id), token);

      // type names also include their group/category via a second pass would need SDE;
      // keep it light here — the page groups by name prefix / BPO vs BPC.
      const blueprints = all.map((b) => ({
        itemId: b.item_id,
        typeId: b.type_id,
        typeName: typeNames.get(b.type_id)?.name || `Type ${b.type_id}`,
        locationId: b.location_id,
        locationName: locationNames.get(b.location_id) || `Location ${String(b.location_id).slice(-6)}`,
        locationFlag: b.location_flag,
        materialEfficiency: b.material_efficiency,
        timeEfficiency: b.time_efficiency,
        quantity: b.quantity, // -1 = BPO (original), -2 = BPC stack
        runs: b.runs, // -1 = infinite (BPO)
        isOriginal: b.quantity === -1 || b.runs === -1,
      }));

      // Summary stats
      const originals = blueprints.filter((b) => b.isOriginal).length;
      const copies = blueprints.length - originals;

      res.json({
        blueprints,
        summary: { total: blueprints.length, originals, copies },
        characterName: req.session.character.characterName,
      });
    } catch (error) {
      console.error("Blueprints error:", error);
      res.status(500).json({ error: "Failed to fetch blueprints" });
    }
  });

  // 2. Market Order Manager - GET /api/market/orders
  // ESI scope: esi-markets.read_character_orders.v1
  app.get("/api/character/market-orders", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    try {
      const token = await refreshTokenIfNeeded(req);
      if (!token) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const characterId = req.session.character.characterId;

      const [activeRes, historyRes] = await Promise.all([
        fetch(`${ESI_BASE_URL}/characters/${characterId}/orders/?datasource=tranquility`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${ESI_BASE_URL}/characters/${characterId}/orders/history/?datasource=tranquility`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!activeRes.ok) {
        res.status(activeRes.status).json({ error: "Failed to fetch market orders from ESI" });
        return;
      }
      const active: any[] = await activeRes.json();
      const history: any[] = historyRes.ok ? await historyRes.json() : [];

      // Resolve type + location names across both sets
      const allTypeIds = [...active, ...history].map((o) => o.type_id);
      const allLocIds = [...active, ...history].map((o) => o.location_id);
      const typeNames = await resolveNames(allTypeIds);
      const locationNames = await resolveLocationNames(allLocIds, token);

      // Outbid detection for ACTIVE orders via Fuzzwork aggregates, grouped by region
      const byRegion = new Map<number, Set<number>>();
      for (const o of active) {
        if (!o.region_id) continue;
        if (!byRegion.has(o.region_id)) byRegion.set(o.region_id, new Set());
        byRegion.get(o.region_id)!.add(o.type_id);
      }
      // region -> typeId -> { buyMax, sellMin }
      const marketRef = new Map<number, Map<number, { buyMax: number; sellMin: number }>>();
      for (const [regionId, typeSet] of byRegion) {
        const types = Array.from(typeSet);
        const refMap = new Map<number, { buyMax: number; sellMin: number }>();
        try {
          // Fuzzwork aggregates: many types in one call
          const url = `https://market.fuzzwork.co.uk/aggregates/?region=${regionId}&types=${types.join(",")}`;
          const r = await fetch(url, { headers: { "User-Agent": "PHOTON-EVE-Tracker/0.7" } });
          if (r.ok) {
            const data = await r.json();
            for (const tid of types) {
              const entry = data[String(tid)];
              if (entry) {
                refMap.set(tid, {
                  buyMax: parseFloat(entry.buy?.max ?? "0") || 0,
                  sellMin: parseFloat(entry.sell?.min ?? "0") || 0,
                });
              }
            }
          }
        } catch (err) {
          console.warn(`Fuzzwork aggregates failed for region ${regionId}:`, err);
        }
        marketRef.set(regionId, refMap);
      }

      const mapOrder = (o: any, isActive: boolean) => {
        const ref = isActive ? marketRef.get(o.region_id)?.get(o.type_id) : undefined;
        let outbid = false;
        let bestPrice: number | null = null;
        if (ref) {
          if (o.is_buy_order) {
            bestPrice = ref.buyMax;
            outbid = ref.buyMax > o.price + 0.001; // someone bidding higher
          } else {
            bestPrice = ref.sellMin;
            outbid = ref.sellMin > 0 && ref.sellMin < o.price - 0.001; // someone selling cheaper
          }
        }
        const issued = new Date(o.issued).getTime();
        const expires = issued + (o.duration || 0) * 86400000;
        return {
          orderId: o.order_id,
          typeId: o.type_id,
          typeName: typeNames.get(o.type_id)?.name || `Type ${o.type_id}`,
          locationId: o.location_id,
          locationName: locationNames.get(o.location_id) || `Location ${String(o.location_id).slice(-6)}`,
          regionId: o.region_id,
          isBuyOrder: !!o.is_buy_order,
          price: o.price,
          volumeRemain: o.volume_remain,
          volumeTotal: o.volume_total,
          issued: o.issued,
          duration: o.duration,
          expiresAt: new Date(expires).toISOString(),
          escrow: o.escrow ?? null,
          state: o.state || (isActive ? "open" : "unknown"),
          outbid,
          bestPrice,
        };
      };

      const activeOrders = active.map((o) => mapOrder(o, true));
      const historyOrders = history.map((o) => mapOrder(o, false))
        .sort((a, b) => new Date(b.issued).getTime() - new Date(a.issued).getTime())
        .slice(0, 100);

      const sellEscrow = activeOrders.filter((o) => !o.isBuyOrder).reduce((s, o) => s + o.price * o.volumeRemain, 0);
      const buyEscrow = activeOrders.filter((o) => o.isBuyOrder).reduce((s, o) => s + (o.escrow || 0), 0);
      const outbidCount = activeOrders.filter((o) => o.outbid).length;

      res.json({
        activeOrders,
        historyOrders,
        summary: {
          activeCount: activeOrders.length,
          sellOrders: activeOrders.filter((o) => !o.isBuyOrder).length,
          buyOrders: activeOrders.filter((o) => o.isBuyOrder).length,
          outbidCount,
          sellValueRemaining: sellEscrow,
          buyEscrow,
        },
        characterName: req.session.character.characterName,
      });
    } catch (error) {
      console.error("Market orders error:", error);
      res.status(500).json({ error: "Failed to fetch market orders" });
    }
  });

  // 3. Route Danger Data - GET /api/map/danger
  // Public ESI: /universe/system_kills/ (ship+pod+npc kills per system, last hour)
  let dangerCache: { ts: number; data: any } | null = null;
  app.get("/api/map/danger", async (_req: Request, res: Response) => {
    try {
      // Cache for 5 minutes (ESI updates hourly anyway)
      if (dangerCache && Date.now() - dangerCache.ts < 5 * 60 * 1000) {
        res.json(dangerCache.data);
        return;
      }
      const [killsRes, jumpsRes] = await Promise.all([
        fetch(`${ESI_BASE_URL}/universe/system_kills/?datasource=tranquility`),
        fetch(`${ESI_BASE_URL}/universe/system_jumps/?datasource=tranquility`),
      ]);
      if (!killsRes.ok) {
        res.status(killsRes.status).json({ error: "Failed to fetch system kills from ESI" });
        return;
      }
      const kills: any[] = await killsRes.json();
      const jumps: any[] = jumpsRes.ok ? await jumpsRes.json() : [];

      const systems: Record<string, { shipKills: number; podKills: number; npcKills: number; jumps: number }> = {};
      for (const k of kills) {
        systems[k.system_id] = {
          shipKills: k.ship_kills || 0,
          podKills: k.pod_kills || 0,
          npcKills: k.npc_kills || 0,
          jumps: 0,
        };
      }
      for (const j of jumps) {
        if (systems[j.system_id]) systems[j.system_id].jumps = j.ship_jumps || 0;
        else systems[j.system_id] = { shipKills: 0, podKills: 0, npcKills: 0, jumps: j.ship_jumps || 0 };
      }

      const payload = { systems, updatedAt: new Date().toISOString() };
      dangerCache = { ts: Date.now(), data: payload };
      res.json(payload);
    } catch (error) {
      console.error("Danger map error:", error);
      res.status(500).json({ error: "Failed to fetch danger data" });
    }
  });

  // 4. Unified Timer Dashboard - GET /api/timers
  // Aggregates every time-sensitive event from across the character's ESI data.
  app.get("/api/timers", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    try {
      const token = await refreshTokenIfNeeded(req);
      if (!token) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const characterId = req.session.character.characterId;
      const auth = { headers: { Authorization: `Bearer ${token}` } };
      const timers: Array<{ category: string; label: string; detail: string; endsAt: string | null; meta?: any }> = [];
      const typeIdsToResolve = new Set<number>();
      const pendingTypeLabels: Array<{ idx: number; typeId: number; prefix: string }> = [];

      // --- Industry jobs ---
      try {
        const r = await fetch(`${ESI_BASE_URL}/characters/${characterId}/industry/jobs/?datasource=tranquility&include_completed=false`, auth);
        if (r.ok) {
          const jobs: any[] = await r.json();
          const activityNames: Record<number, string> = { 1: "Manufacturing", 3: "TE Research", 4: "ME Research", 5: "Copying", 8: "Invention", 9: "Reactions" };
          for (const j of jobs) {
            if (j.status === "delivered" || j.status === "cancelled") continue;
            const idx = timers.length;
            timers.push({
              category: "industry",
              label: activityNames[j.activity_id] || "Industry Job",
              detail: `Blueprint ${j.blueprint_type_id}`,
              endsAt: j.end_date,
            });
            typeIdsToResolve.add(j.blueprint_type_id);
            pendingTypeLabels.push({ idx, typeId: j.blueprint_type_id, prefix: activityNames[j.activity_id] || "Job" });
          }
        }
      } catch (err) { console.warn("timers: industry failed", err); }

      // --- Skill queue ---
      try {
        const r = await fetch(`${ESI_BASE_URL}/characters/${characterId}/skillqueue/?datasource=tranquility`, auth);
        if (r.ok) {
          const queue: any[] = await r.json();
          const now = Date.now();
          // currently-training skill = the one whose finish_date is next in the future
          const training = queue.filter((s) => s.finish_date && new Date(s.finish_date).getTime() > now)
            .sort((a, b) => new Date(a.finish_date).getTime() - new Date(b.finish_date).getTime());
          if (training.length > 0) {
            const cur = training[0];
            const idx = timers.length;
            timers.push({ category: "skill", label: "Skill finishing", detail: `Skill ${cur.skill_id} → L${cur.finished_level}`, endsAt: cur.finish_date });
            typeIdsToResolve.add(cur.skill_id);
            pendingTypeLabels.push({ idx, typeId: cur.skill_id, prefix: `Training to L${cur.finished_level}:` });
            // whole queue end
            const last = training[training.length - 1];
            if (last !== cur) {
              timers.push({ category: "skill", label: "Skill queue empty", detail: `${training.length} skills queued`, endsAt: last.finish_date });
            }
          } else {
            timers.push({ category: "skill", label: "Skill queue EMPTY", detail: "No skills training", endsAt: null, meta: { warning: true } });
          }
        }
      } catch (err) { console.warn("timers: skillqueue failed", err); }

      // --- Market orders (expiry) ---
      try {
        const r = await fetch(`${ESI_BASE_URL}/characters/${characterId}/orders/?datasource=tranquility`, auth);
        if (r.ok) {
          const orders: any[] = await r.json();
          for (const o of orders) {
            const expires = new Date(o.issued).getTime() + (o.duration || 0) * 86400000;
            const idx = timers.length;
            timers.push({
              category: "market",
              label: `${o.is_buy_order ? "Buy" : "Sell"} order expires`,
              detail: `Type ${o.type_id} ×${o.volume_remain}`,
              endsAt: new Date(expires).toISOString(),
            });
            typeIdsToResolve.add(o.type_id);
            pendingTypeLabels.push({ idx, typeId: o.type_id, prefix: `${o.is_buy_order ? "Buy" : "Sell"} order:` });
          }
        }
      } catch (err) { console.warn("timers: orders failed", err); }

      // --- Contracts (outstanding, expiring) ---
      try {
        const r = await fetch(`${ESI_BASE_URL}/characters/${characterId}/contracts/?datasource=tranquility`, auth);
        if (r.ok) {
          const contracts: any[] = await r.json();
          for (const c of contracts) {
            if (c.status !== "outstanding" && c.status !== "in_progress") continue;
            if (!c.date_expired) continue;
            timers.push({
              category: "contract",
              label: `${(c.type || "contract").replace(/_/g, " ")} expires`,
              detail: c.title || `Contract ${c.contract_id}`,
              endsAt: c.date_expired,
            });
          }
        }
      } catch (err) { console.warn("timers: contracts failed", err); }

      // --- Jump clone cooldown ---
      try {
        const r = await fetch(`${ESI_BASE_URL}/characters/${characterId}/clones/?datasource=tranquility`, auth);
        if (r.ok) {
          const data = await r.json();
          if (data.last_clone_jump_date) {
            const ready = new Date(data.last_clone_jump_date).getTime() + 24 * 3600 * 1000;
            timers.push({
              category: "clone",
              label: "Jump clone ready",
              detail: ready > Date.now() ? "Cooldown active" : "Ready to jump",
              endsAt: new Date(ready).toISOString(),
            });
          }
        }
      } catch (err) { console.warn("timers: clones failed", err); }

      // --- PI extractor cycles ---
      try {
        const r = await fetch(`${ESI_BASE_URL}/characters/${characterId}/planets/?datasource=tranquility`, auth);
        if (r.ok) {
          const planets: any[] = await r.json();
          // Limit to avoid excessive calls
          for (const planet of planets.slice(0, 12)) {
            try {
              const pr = await fetch(`${ESI_BASE_URL}/characters/${characterId}/planets/${planet.planet_id}/?datasource=tranquility`, auth);
              if (!pr.ok) continue;
              const detail = await pr.json();
              let soonest: number | null = null;
              for (const pin of detail.pins || []) {
                if (pin.expiry_time) {
                  const t = new Date(pin.expiry_time).getTime();
                  if (soonest === null || t < soonest) soonest = t;
                }
              }
              if (soonest !== null) {
                timers.push({
                  category: "pi",
                  label: "PI extractor expires",
                  detail: `Planet ${planet.planet_id} (${planet.planet_type})`,
                  endsAt: new Date(soonest).toISOString(),
                });
              }
            } catch { /* ignore single planet */ }
          }
        }
      } catch (err) { console.warn("timers: planets failed", err); }

      // Resolve type names and patch details
      if (typeIdsToResolve.size > 0) {
        const names = await resolveNames(Array.from(typeIdsToResolve));
        for (const p of pendingTypeLabels) {
          const nm = names.get(p.typeId)?.name;
          if (nm) timers[p.idx].detail = `${p.prefix} ${nm}`;
        }
      }

      // Sort: nulls (warnings) first, then soonest endsAt
      timers.sort((a, b) => {
        if (a.endsAt === null && b.endsAt === null) return 0;
        if (a.endsAt === null) return -1;
        if (b.endsAt === null) return 1;
        return new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime();
      });

      res.json({ timers, characterName: req.session.character.characterName, generatedAt: new Date().toISOString() });
    } catch (error) {
      console.error("Timers error:", error);
      res.status(500).json({ error: "Failed to aggregate timers" });
    }
  });

  // ============================================================================
  // CHAT (v1.0.0) — Global + Corp + Alliance channels, WebSocket realtime
  // ============================================================================
  const chatRateLimit = new Map<number, number>(); // characterId -> last post ms
  const charOrgCache = new Map<number, { corpId: number | null; allianceId: number | null; ts: number }>();
  // Resolve a character's corp + alliance via public ESI, cached 1h.
  async function getCharacterOrg(characterId: number): Promise<{ corpId: number | null; allianceId: number | null }> {
    const cached = charOrgCache.get(characterId);
    if (cached && Date.now() - cached.ts < 3600_000) return { corpId: cached.corpId, allianceId: cached.allianceId };
    try {
      const r = await fetch(`${ESI_BASE_URL}/characters/${characterId}/?datasource=tranquility`);
      if (r.ok) {
        const d = await r.json();
        const org = { corpId: d.corporation_id ?? null, allianceId: d.alliance_id ?? null };
        charOrgCache.set(characterId, { ...org, ts: Date.now() });
        return org;
      }
    } catch { /* ignore */ }
    return { corpId: null, allianceId: null };
  }

  // --- WebSocket: lightweight "something changed" notifier (no content, no auth needed) ---
  // Clients refetch the affected channel over the authed HTTP endpoint, which enforces membership.
  const chatWss = new WebSocketServer({ server: httpServer, path: "/ws/chat" });
  function broadcastChat(payload: { type: string; channel: string; corpId?: number | null; allianceId?: number | null }) {
    const data = JSON.stringify(payload);
    chatWss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(data);
    });
  }
  chatWss.on("connection", (ws) => {
    ws.on("error", () => { /* ignore */ });
  });

  const validChannel = (c: string) => (c === "corp" || c === "alliance") ? c : "global";

  // GET /api/chat/:channel?since=<id>&before=<id>  (channel: global | corp | alliance)
  app.get("/api/chat/:channel", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    try {
      const channel = validChannel(req.params.channel);
      const since = parseInt((req.query.since as string) || "0", 10) || 0;
      const before = parseInt((req.query.before as string) || "0", 10) || 0;
      const characterId = req.session.character.characterId;

      let orgId: number | null = null;
      if (channel === "corp" || channel === "alliance") {
        const org = await getCharacterOrg(characterId);
        orgId = channel === "corp" ? org.corpId : org.allianceId;
        if (orgId == null) {
          res.json({ messages: [], channel, orgId: null, isAdmin: false });
          return;
        }
      }

      const messages = before > 0
        ? await storage.getChatMessagesBefore(channel, orgId, before, 40)
        : await storage.getChatMessages(channel, orgId, since, 60);
      const isAdmin = await isAdminAsync(characterId);
      res.json({ messages, channel, orgId, isAdmin, characterId });
    } catch (error) {
      console.error("Chat fetch error:", error);
      res.status(500).json({ error: "Failed to fetch chat" });
    }
  });

  // POST /api/chat/:channel  body: { text }
  app.post("/api/chat/:channel", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    try {
      const channel = validChannel(req.params.channel);
      const characterId = req.session.character.characterId;
      const text = String(req.body?.text ?? "").trim();

      if (!text) { res.status(400).json({ error: "Message is empty" }); return; }
      if (text.length > 500) { res.status(400).json({ error: "Message too long (max 500)" }); return; }

      const last = chatRateLimit.get(characterId) ?? 0;
      if (Date.now() - last < 1500) { res.status(429).json({ error: "Slow down a moment" }); return; }

      let corpId: number | null = null;
      let allianceId: number | null = null;
      if (channel === "corp" || channel === "alliance") {
        const org = await getCharacterOrg(characterId);
        corpId = org.corpId;
        allianceId = org.allianceId;
        if (channel === "corp" && corpId == null) { res.status(400).json({ error: "No corporation on record" }); return; }
        if (channel === "alliance" && allianceId == null) { res.status(400).json({ error: "You are not in an alliance" }); return; }
      }

      const message = await storage.saveChatMessage({
        channel, corpId, allianceId,
        fromCharacterId: characterId,
        fromName: req.session.character.characterName,
        text,
      });
      chatRateLimit.set(characterId, Date.now());
      broadcastChat({ type: "message", channel, corpId, allianceId });
      res.json({ message });
    } catch (error) {
      console.error("Chat post error:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // DELETE /api/chat/message/:id  (own message, or admin)
  app.delete("/api/chat/message/:id", async (req: Request, res: Response) => {
    if (!req.session.character) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    try {
      const id = parseInt(req.params.id, 10);
      if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
      const characterId = req.session.character.characterId;
      const isAdmin = await isAdminAsync(characterId);
      const ok = await storage.deleteChatMessage(id, characterId, isAdmin);
      if (!ok) { res.status(403).json({ error: "Not allowed" }); return; }
      broadcastChat({ type: "delete", channel: "*" });
      res.json({ success: true });
    } catch (error) {
      console.error("Chat delete error:", error);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  return httpServer;
}

// Helper: categorize wallet journal ref_type into income source
function categorizeRefType(refType: string): string {
  // Bounties (ratting, NPC kills)
  if (['bounty_prizes', 'bounty_prize', 'bounty'].includes(refType)) return 'bounty';
  // Missions
  if (['agent_mission_reward', 'agent_mission_time_bonus_reward', 'mission_reward',
       'mission_completion', 'agent_services_rendered'].includes(refType)) return 'mission';
  // Market (trading)
  if (['market_transaction', 'brokers_fee', 'transaction_tax', 'market_escrow',
       'market_fine_paid', 'market_provider_tax'].includes(refType)) return 'market';
  // Industry (manufacturing, research, reactions)
  if (['industry_job_tax', 'manufacturing', 'researching_technology',
       'researching_time_productivity', 'researching_material_productivity',
       'copying', 'reverse_engineering', 'reaction'].includes(refType)) return 'industry';
  // Planetary Industry
  if (['planetary_import_tax', 'planetary_export_tax', 'planetary_construction'].includes(refType)) return 'pi';
  // Mining
  if (refType.includes('mining') || refType === 'reprocessing_tax') return 'mining';
  // Contracts
  if (refType.startsWith('contract_')) return 'contracts';
  // Corporation
  if (['corporation_payment', 'corporation_dividend_payment', 'corporation_account_withdrawal',
       'corporation_bulk_payment', 'corporate_reward_payout', 'corporate_reward_tax'].includes(refType)) return 'corporation';
  // Insurance
  if (refType === 'insurance') return 'insurance';
  // Player transfers
  if (['player_donation', 'player_trading'].includes(refType)) return 'transfers';
  // Incursions / PvE rewards
  if (['bounty_surcharge', 'bounty_reimbursement', 'ess_escrow_transfer',
       'project_discovery_reward', 'daily_challenge_reward', 'daily_goal_payouts',
       'season_challenge_reward', 'milestone_reward_payment', 'opportunity_reward',
       'resource_wars_reward', 'air_career_program_reward'].includes(refType)) return 'rewards';
  // Sovereignty
  if (['sovereignity_bill', 'infrastructure_hub_maintenance', 'skyhook_claim_fee'].includes(refType)) return 'sovereignty';

  return 'other';
}
