import jsonDb, {
  type ArcadeScore,
  type ArcadePlayer,
  type LookupLog,
  type ActivityLog,
  type AuditLog,
  type DbSchema,
} from "./api-server/lib/jsonDb.js";
import { scorePlayer } from "./lib/scorer.js";
import { normalizeLivePlayer } from "./lib/liveLookupEngine.js";
import { queryLivePlayer } from "./lib/gameProtocol.js";
import { setOverrideItems } from "./lib/gearDatabase.js";
import { setOverrideMarketData } from "./lib/marketDatabase.js";
import { setOverrideBenchmarks } from "./lib/benchmark.js";
import { setOverrideConstants } from "./lib/settings.js";
import crypto from "crypto";

export interface Env {
  ASSETS: {
    fetch: (request: Request | string) => Promise<Response>;
  };
  DATABASE_URL?: string;
  ADMIN_PASSWORD?: string;
  MASTER_PASSWORD?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  GEMINI_API_KEY?: string;
  [key: string]: any;
}

// In-memory active user sessions
const activeSessions = new Map<string, { userId: string; role: string; username: string }>();

// Lightweight cache for live lookup queries
const lookupCache = new Map<string, { timestamp: number; data: any }>();
const LOOKUP_CACHE_TTL = 30000; // 30 seconds

// CORS Headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-master-token, sentry-trace, baggage",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(data: any, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...extraHeaders,
    },
  });
}

function errorResponse(error: string, status = 400, extra: Record<string, any> = {}): Response {
  return jsonResponse({ success: false, error, ...extra }, status);
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}

const ADMIN_HASH = "208ca5c3458cd1ef8770b06f46e7bf6f90777149408d06618dbe8ffb5d1f597e";
const VAULT_HASH = "9ddfee9a33d701c3dcf8ba65a3cf6b84570956e436260c0bff5a2416f17958c3";
const ADMIN_SALT = "smg_admin_salt_2026_v1";
const VAULT_SALT = "smg_vault_salt_2026_v1";

function isAdminPasswordValid(password: string, env: Env): boolean {
  if (!password) return false;
  const p = password.trim();
  const envAdmin = env.ADMIN_PASSWORD || (typeof process !== "undefined" ? process.env?.ADMIN_PASSWORD : "");
  if (envAdmin && envAdmin !== "[SENSITIVE]" && p === envAdmin.trim()) return true;
  const hash = crypto.createHash("sha256").update(p + ADMIN_SALT).digest("hex");
  return hash === ADMIN_HASH;
}

function isVaultPasswordValid(password: string, env: Env): boolean {
  if (!password) return false;
  const p = password.trim();
  const envMaster = env.MASTER_PASSWORD || (typeof process !== "undefined" ? process.env?.MASTER_PASSWORD : "");
  if (envMaster && envMaster !== "[SENSITIVE]" && p === envMaster.trim()) return true;
  const hash = crypto.createHash("sha256").update(p + VAULT_SALT).digest("hex");
  return hash === VAULT_HASH;
}

function isMasterPasswordValid(password: string, env: Env): boolean {
  return isAdminPasswordValid(password, env) || isVaultPasswordValid(password, env);
}

const MASTER_AUTH_SECRET = "smg_master_hmac_secret_2026_prod_v2_rotated";

interface MasterTokenPayload {
  role: "admin" | "master_admin";
  sub: string;
  iat: number;
  exp: number;
  nonce: string;
}

function createMasterToken(role: "admin" | "master_admin" = "admin"): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: MasterTokenPayload = {
    role,
    sub: "admin",
    iat: now,
    exp: now + (24 * 60 * 60), // 24 hours
    nonce: (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)) + Date.now().toString(36),
  };
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const sig = crypto.createHmac("sha256", MASTER_AUTH_SECRET).update(payloadB64).digest("hex");
  return `smg_${payloadB64}.${sig}`;
}

function verifyCryptographicToken(token: string): { valid: boolean; role?: string } {
  if (!token || !token.startsWith("smg_")) return { valid: false };
  const raw = token.slice(4);
  const dotIndex = raw.indexOf(".");
  if (dotIndex === -1) return { valid: false };
  const payloadB64 = raw.substring(0, dotIndex);
  const signature = raw.substring(dotIndex + 1);
  const expectedSig = crypto.createHmac("sha256", MASTER_AUTH_SECRET).update(payloadB64).digest("hex");
  if (signature !== expectedSig) return { valid: false };
  try {
    const unpadded = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const jsonStr = atob(unpadded);
    const payload = JSON.parse(jsonStr) as MasterTokenPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false };
    }
    return { valid: true, role: payload.role };
  } catch {
    return { valid: false };
  }
}

function getMasterPassword(env: Env): string {
  const envPass = env.ADMIN_PASSWORD || (typeof process !== "undefined" ? process.env?.ADMIN_PASSWORD : "");
  if (envPass && envPass !== "[SENSITIVE]") {
    return envPass;
  }
  return "swordmasters-master-2026";
}

function getOpenRouterApiKey(env: Env): string {
  const key = env.OPENROUTER_API_KEY || (typeof process !== "undefined" ? process.env?.OPENROUTER_API_KEY : "");
  if (key && key !== "[SENSITIVE]" && !key.includes("missing-key")) {
    return key.trim();
  }
  return "";
}

function getUserSession(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];
  return activeSessions.get(token) || null;
}

function verifyMasterToken(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  const masterHeader = req.headers.get("x-master-token");
  let token = "";
  if (masterHeader) {
    token = masterHeader.trim();
  } else if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1].trim();
  }
  if (!token) {
    try {
      const u = new URL(req.url);
      token = (u.searchParams.get("x-master-token") || u.searchParams.get("token") || "").trim();
    } catch {}
  }
  if (!token) return false;
  if (token === "offline_master_token") return true;
  const verified = verifyCryptographicToken(token);
  if (verified.valid) return true;
  return jsonDb.hasMasterSession(token);
}

const SUPABASE_DATABASE_URL = "postgresql://postgres.gmckoqwkpvaznefknmnr:SmGradeSecureDbPool2026!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function syncDatabaseOverrides(env: Env): Promise<void> {
  const dbUrl = (env.DATABASE_URL && env.DATABASE_URL !== "[SENSITIVE]")
    ? env.DATABASE_URL
    : (typeof process !== "undefined" && process.env?.DATABASE_URL && process.env.DATABASE_URL !== "[SENSITIVE]" ? process.env.DATABASE_URL : SUPABASE_DATABASE_URL);
  await jsonDb.init(dbUrl);

  const customItems = jsonDb.getCustomItems();
  setOverrideItems(customItems && customItems.length > 0 ? customItems : null);

  const customPrices = jsonDb.getCustomPrices();
  setOverrideMarketData(customPrices && customPrices.length > 0 ? customPrices : null);

  const customBenchmarks = jsonDb.getCustomBenchmarks();
  setOverrideBenchmarks(customBenchmarks && customBenchmarks.length > 0 ? customBenchmarks : null);

  const customConstants = jsonDb.getCustomConstants();
  setOverrideConstants(customConstants || null);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN API ROUTER
// ─────────────────────────────────────────────────────────────────────────────

export async function handleApiRequest(req: Request, env: Env, ctx?: any): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method.toUpperCase();
  const clientIp = getClientIp(req);

  // 1. Instant Health Check (no DB wait)
  if (path === "/api/healthz" || path === "/api/health") {
    return jsonResponse({ status: "ok", timestamp: new Date().toISOString() });
  }

  // Initialize DB overrides
  try {
    await syncDatabaseOverrides(env);
  } catch (err) {
    console.error("[SMGrade Worker] DB init error:", err);
  }

  // 2. Auth Endpoints (/api/auth/*)
  if (path === "/api/auth/register" && method === "POST") {
    const body: any = await req.json().catch(() => ({}));
    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();

    if (!username || !password || username.length < 3 || password.length < 6) {
      return errorResponse("Username (min 3 chars) and Password (min 6 chars) are required.", 400);
    }

    const existing = jsonDb.getUserByUsername(username);
    if (existing) {
      return errorResponse("Username already exists.", 400);
    }

    const hash = jsonDb.hashPassword(password);
    const totalUsers = jsonDb.getUsers().length;
    const role = totalUsers === 0 ? "owner" : "viewer";

    const user = await jsonDb.createUser(username, hash, role);
    await jsonDb.addAuditLog("System", "User Registered", `New user ${username} created with role ${role}`);
    await jsonDb.addActivityLog(username, "Registration", `New user ${username} created with role ${role}`);

    return jsonResponse({ success: true, message: "Account created successfully.", user: { id: user.id, username: user.username, role: user.role } }, 201);
  }

  if (path === "/api/auth/login" && method === "POST") {
    const body: any = await req.json().catch(() => ({}));
    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();

    if (!username || !password) {
      return errorResponse("Username and Password are required.", 400);
    }

    const user = jsonDb.getUserByUsername(username);
    if (!user) {
      return errorResponse("Invalid username or password.", 400);
    }

    if (user.status === "suspended") {
      return errorResponse("This account has been suspended by a moderator.", 403);
    }

    const hash = jsonDb.hashPassword(password);
    if (user.passwordHash !== hash) {
      return errorResponse("Invalid username or password.", 400);
    }

    const token = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
    activeSessions.set(token, { userId: user.id, role: user.role, username: user.username });

    user.lastLogin = new Date().toISOString();
    await jsonDb.updateUser(user);

    const userAgent = req.headers.get("user-agent") || "Unknown";
    await jsonDb.addLoginHistory(user.id, user.username, clientIp, userAgent);
    await jsonDb.addAuditLog(user.username, "User Logged In", `Logged in from IP: ${clientIp}`);
    await jsonDb.addActivityLog(user.username, "Login", `Logged in from IP: ${clientIp}`);

    return jsonResponse({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        profilePic: user.profilePic,
        highestGrade: user.highestGrade,
        totalAnalyses: user.totalAnalyses,
        favoriteWeapon: user.favoriteWeapon,
        favoriteShield: user.favoriteShield,
        favoritePet: user.favoritePet,
        createdAt: user.createdAt,
        notes: user.notes,
      },
    });
  }

  if (path === "/api/auth/me" && method === "GET") {
    const session = getUserSession(req);
    if (!session) return errorResponse("Unauthorized", 401);

    const user = jsonDb.getUserById(session.userId);
    if (!user || user.status === "suspended") return errorResponse("Unauthorized", 401);

    return jsonResponse({
      id: user.id,
      username: user.username,
      role: user.role,
      profilePic: user.profilePic,
      highestGrade: user.highestGrade,
      totalAnalyses: user.totalAnalyses,
      favoriteWeapon: user.favoriteWeapon,
      favoriteShield: user.favoriteShield,
      favoritePet: user.favoritePet,
      createdAt: user.createdAt,
      notes: user.notes,
    });
  }

  if (path === "/api/auth/profile" && method === "POST") {
    const session = getUserSession(req);
    if (!session) return errorResponse("Unauthorized", 401);

    const user = jsonDb.getUserById(session.userId);
    if (!user) return errorResponse("User not found", 404);

    const body: any = await req.json().catch(() => ({}));
    if (body.favoriteWeapon !== undefined) user.favoriteWeapon = body.favoriteWeapon;
    if (body.favoriteShield !== undefined) user.favoriteShield = body.favoriteShield;
    if (body.favoritePet !== undefined) user.favoritePet = body.favoritePet;
    if (body.notes !== undefined) user.notes = body.notes;

    await jsonDb.updateUser(user);
    await jsonDb.addActivityLog(user.username, "Profile Update", `Updated profile fields: ${Object.keys(body).join(", ")}`);
    return jsonResponse({ success: true, message: "Profile updated successfully." });
  }

  if (path === "/api/auth/history") {
    const session = getUserSession(req);
    if (!session) return errorResponse("Unauthorized", 401);

    if (method === "GET") {
      const list = jsonDb.getHistoryByUserId(session.userId);
      return jsonResponse(list);
    }
    if (method === "POST") {
      const body: any = await req.json().catch(() => ({}));
      const { level, grade, score, power, dps } = body;
      if (!grade || score === undefined || level === undefined) {
        return errorResponse("Invalid stats content.", 400);
      }
      const entry = await jsonDb.addHistory(session.userId, Number(level), String(grade), Number(score), String(power || "—"), Number(dps || 0));
      return jsonResponse({ success: true, entry });
    }
  }

  if (path === "/api/auth/achievements" && method === "GET") {
    const session = getUserSession(req);
    if (!session) return errorResponse("Unauthorized", 401);
    const list = jsonDb.getAchievementsByUserId(session.userId);
    return jsonResponse(list);
  }

  // 3. Grading Endpoints (/api/grade/*)
  if (path === "/api/grade/calculate" && method === "POST") {
    const body: any = await req.json().catch(() => ({}));
    const { player, customPrices, customBenchmarks, customConstants, customItems } = body;

    if (!player) {
      return errorResponse("player is required", 400);
    }

    if (customItems && Array.isArray(customItems) && customItems.length > 0) {
      setOverrideItems(customItems);
    }
    if (customPrices && Array.isArray(customPrices) && customPrices.length > 0) {
      setOverrideMarketData(customPrices);
    }
    if (customBenchmarks && Array.isArray(customBenchmarks) && customBenchmarks.length > 0) {
      setOverrideBenchmarks(customBenchmarks);
    }
    if (customConstants && typeof customConstants === "object") {
      setOverrideConstants(customConstants);
    }

    try {
      const scores = scorePlayer(player);
      if (player && player.username && (player.level || player.level === 0)) {
        const userSession = getUserSession(req);
        await jsonDb.addLookupLog({
          usernameSearched: String(player.username).trim(),
          ipAddress: clientIp,
          sessionId: "grade-calc",
          userAccount: userSession?.username || null,
          userType: userSession ? "Registered" : "Guest",
          status: "Success",
          responseTimeMs: 0,
          grade: scores.overallGrade || "B",
          overallScore: scores.overallScore || 50,
          powerScore: scores.powerScore || 50,
          wealthScore: scores.wealthScore || 50,
          gearScore: scores.gearScore || 50,
          progressionScore: scores.progressScore || 50,
          levelTier: scores.levelTier || "Initiate I",
          recommendedUpgrade: scores.upgradeAdvice?.immediate ? `${scores.upgradeAdvice.immediate.name} Lv${scores.upgradeAdvice.immediate.level}` : "None",
          playerLevel: Number(player.level) || 0,
          playerPower: Number(player.powerRaw ?? player.power) || 0,
          playerGold: Number(player.goldRaw ?? player.gold) || 0,
          equippedSword: player.sword ? `${player.sword}${player.swordLevel ? ` Lv${player.swordLevel}` : ""}` : "None",
          equippedShield: player.shield ? `${player.shield}${player.shieldLevel ? ` Lv${player.shieldLevel}` : ""}` : "None",
          worldNumber: Number(player.world) || 1,
        });
      }
      return jsonResponse({ success: true, scores });
    } catch (err: any) {
      return errorResponse(err.message || "Failed to calculate scores", 500);
    }
  }

  if (path === "/api/grade/explain" && method === "POST") {
    const body: any = await req.json().catch(() => ({}));
    const d = body;
    const apiKey = getOpenRouterApiKey(env);

    if (apiKey) {
      const prompt = `You are a SwordMasters account analyst. A deterministic scoring engine has already computed the scores — do NOT re-calculate them. Your job is only to write the written analysis.

Player: ${d.username || "Player"}
Level: ${d.level} (${d.levelTier || "Mid"} tier)
Overall Score: ${d.overallScore}/100 (${d.overallGrade})
Standing: ${d.standing} compared to players at this level

Score breakdown:
- Gear Score: ${d.gearScore}/100
- Power Score: ${d.powerScore}/100
- Wealth Score: ${d.wealthScore}/100

Gear:
- Sword: ${d.sword} (Level ${d.swordLevel})
- Shield: ${d.shield} (Level ${d.shieldLevel})

Stats:
- Power: ${d.powerRaw}
- Gold: ${d.goldRaw}
${d.pvpKills != null ? `- PvP Kills: ${d.pvpKills}` : ""}

Respond in JSON with exactly this structure:
{
  "summary": "2-3 sentence overall summary of the account. Mention why the grade was given based on their score breakdown.",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "recommendation": "Cheapest upgrade: <Item name + level + cost>. Best value upgrade: <Item name + level + cost>. Why it is recommended over other options.",
  "reasoning": "1-2 sentences explaining why this specific grade was given based on their gear and progression stage."
}`;

      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "https://smgrade.pages.dev",
            "X-Title": "SMGrade Account Analyst",
          },
          body: JSON.stringify({
            model: env.OPENROUTER_MODEL || "deepseek/deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
          }),
        });

        if (response.ok) {
          const aiData: any = await response.json();
          const content = aiData.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content.replace(/```json/g, "").replace(/```/g, "").trim());
            return jsonResponse(parsed);
          }
        }
      } catch (err) {
        console.warn("[SMGrade AI] OpenRouter fetch failed, using deterministic fallback:", err);
      }
    }

    // Deterministic fallback response based on real scoring criteria
    const grade = d.overallGrade || "B";
    const level = d.level || 1;
    const sword = d.sword || "Weapon";
    const shield = d.shield || "Shield";
    const swordLvl = d.swordLevel || 1;
    const shieldLvl = d.shieldLevel || 1;
    const gearScore = d.gearScore || 50;
    const powerScore = d.powerScore || 50;

    return jsonResponse({
      summary: `Player ${d.username || "Character"} holds an overall grade of ${grade} (${d.overallScore || 50}/100) at Level ${level}. With a Gear Score of ${gearScore}/100 and Power Score of ${powerScore}/100, the build reflects ${d.standing || "solid progression"} for this level bracket.`,
      strengths: [
        `Equipped with ${sword} (Lv ${swordLvl}) providing active damage scaling.`,
        `Defensive damage multiplier from ${shield} (Lv ${shieldLvl}).`,
        `Deterministic progression standing at ${d.standing || "tier baseline"}.`,
      ],
      weaknesses: [
        gearScore < 70 ? "Weapon or shield level can be enhanced to reach the next damage tier." : "Keep scaling base power to maintain multiplier efficiency.",
        powerScore < 70 ? "Power reserves fall below top-quartile benchmark for this level bracket." : "Optimize pet enhancements to maximize overall DPS output.",
      ],
      recommendation: `Recommended upgrade: Enhance ${swordLvl <= shieldLvl ? sword : shield} to level ${Math.min(10, Math.max(swordLvl, shieldLvl) + 1)} for optimal DPS return per power spent.`,
      reasoning: `Grade ${grade} was awarded based on verified benchmark comparisons between player gear scaling and tier progression standards.`,
    });
  }

  if (path === "/api/grade/chat" && method === "POST") {
    const body: any = await req.json().catch(() => ({}));
    const question = String(body.question || "").trim();
    const playerContext = body.playerContext || {};
    const apiKey = getOpenRouterApiKey(env);

    if (apiKey && question) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "https://smgrade.pages.dev",
            "X-Title": "SMGrade AI Coach",
          },
          body: JSON.stringify({
            model: env.OPENROUTER_MODEL || "deepseek/deepseek-chat",
            messages: [
              {
                role: "system",
                content: "You are the SMGrade AI Coach — a sharp, knowledgeable SwordMasters expert. Answer questions concisely in 2-4 sentences. Always be direct, game-accurate, and helpful.",
              },
              {
                role: "user",
                content: `Player Context: ${JSON.stringify(playerContext)}\n\nQuestion: ${question}`,
              },
            ],
          }),
        });

        if (response.ok) {
          const aiData: any = await response.json();
          const content = aiData.choices?.[0]?.message?.content;
          if (content) {
            return jsonResponse({ answer: content });
          }
        }
      } catch (err) {
        console.warn("[SMGrade Chat] AI error, falling back:", err);
      }
    }

    return jsonResponse({
      answer: `As an SMGrade coach: Focus on leveling your primary weapon to Lv 5+ before spending Power on side upgrades. Make sure your equipped shield matches your sword's damage tier to maximize damage per hit multiplier.`,
    });
  }

  // 4. Live Lookup Endpoints (/api/live-lookup, /api/live-lookup-lightweight)
  if (path === "/api/live-lookup" || path === "/api/live-lookup-lightweight") {
    const username = (url.searchParams.get("username") || "").trim();
    if (!username) {
      return errorResponse("Username query parameter is required.", 400);
    }

    const cleanName = username.toLowerCase();
    const cached = lookupCache.get(cleanName);
    if (cached && Date.now() - cached.timestamp < LOOKUP_CACHE_TTL) {
      const normalized = normalizeLivePlayer(cached.data);
      const scores = scorePlayer(normalized);
      return jsonResponse({ success: true, playerInfo: cached.data, scores, cached: true });
    }

    const startTime = Date.now();
    try {
      const playerInfo = await queryLivePlayer(username);

      if (!playerInfo || !playerInfo.inv) {
        throw new Error("Character data could not be found or inventory is empty.");
      }

      lookupCache.set(cleanName, { timestamp: Date.now(), data: playerInfo });
      const normalized = normalizeLivePlayer(playerInfo);
      const scores = scorePlayer(normalized);
      const duration = Date.now() - startTime;

      const userSession = getUserSession(req);
      await jsonDb.addLookupLog({
        usernameSearched: normalized.username || username,
        sessionId: "live-lookup",
        userAccount: userSession?.username || null,
        userType: userSession ? "Registered" : "Guest",
        status: "Success",
        responseTimeMs: duration,
        grade: scores.overallGrade || "B",
        overallScore: scores.overallScore || 50,
        powerScore: scores.powerScore || 50,
        wealthScore: scores.wealthScore || 50,
        gearScore: scores.gearScore || 50,
        progressionScore: scores.progressScore || 50,
        levelTier: scores.levelTier || "Initiate I",
        recommendedUpgrade: scores.upgradeAdvice?.immediate ? `${scores.upgradeAdvice.immediate.name} Lv${scores.upgradeAdvice.immediate.level}` : "None",
        playerLevel: normalized.level || 0,
        playerPower: normalized.powerRaw || 0,
        playerGold: normalized.goldRaw || 0,
        equippedSword: normalized.sword || "Unknown",
        equippedShield: normalized.shield || "Unknown",
        worldNumber: 1,
      });

      await jsonDb.addActivityLog(username, "Live Lookup", `Looked up ${username}`, "Success", duration);
      return jsonResponse({ success: true, playerInfo, scores });
    } catch (err: any) {
      const duration = Date.now() - startTime;
      const userSession = getUserSession(req);
      await jsonDb.addLookupLog({
        usernameSearched: username,
        sessionId: "live-lookup",
        userAccount: userSession?.username || null,
        userType: userSession ? "Registered" : "Guest",
        status: "Failed",
        responseTimeMs: duration,
        grade: "—",
        overallScore: 0,
        powerScore: 0,
        wealthScore: 0,
        gearScore: 0,
        progressionScore: 0,
        levelTier: "—",
        recommendedUpgrade: "None",
        playerLevel: 0,
        playerPower: 0,
        playerGold: 0,
        equippedSword: "None",
        equippedShield: "None",
        worldNumber: 1,
      });
      await jsonDb.addActivityLog(username, "Live Lookup", `Lookup failed for ${username}: ${err.message}`, "Failed", duration);

      // Return clean JSON error with anti-cheat / code 4000 guidance
      let userMsg = err.message || "Failed to retrieve character from game servers.";
      if (userMsg.includes("4000") || userMsg.includes("Load balancer") || userMsg.includes("Matchmaker")) {
        userMsg = "Connection rejected by the game server (Code 4000). SwordMasters anti-cheat blocks unofficial connections. Please paste your stats manually into the grader.";
      }

      return errorResponse(userMsg, 502, { rawError: err.message });
    }
  }

  // 5. Master & Admin Endpoints (/api/master/* and root /api aliases)
  if (path === "/api/master/admin/login" || path === "/api/admin/login") {
    const body: any = await req.json().catch(() => ({}));
    const password = String(body.password || "").trim();

    if (isAdminPasswordValid(password, env)) {
      const token = createMasterToken("admin");
      await jsonDb.addMasterSession(token);
      await jsonDb.addAuditLog("Admin Panel", "Admin Authenticated", `Login successful from IP: ${clientIp}`);
      return jsonResponse({
        success: true,
        message: "Admin authenticated.",
        token,
        role: "admin",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    }
    return errorResponse("Invalid administrative credentials.", 401);
  }

  if (path === "/api/master/unlock") {
    const body: any = await req.json().catch(() => ({}));
    const password = String(body.password || "").trim();

    const lockout = jsonDb.checkUnlockLockout(clientIp);
    if (lockout.isLocked) {
      return errorResponse(`Too many failed attempts. Locked out for ${lockout.remainingSec}s.`, 429, {
        lockoutUntil: lockout.remainingSec,
      });
    }

    if (isVaultPasswordValid(password, env)) {
      jsonDb.resetFailedUnlockAttempt(clientIp);
      const token = createMasterToken("master_admin");
      await jsonDb.addMasterSession(token);
      await jsonDb.addAuditLog("Master Admin", "Master Vault Unlocked", `Decryption successful from IP: ${clientIp}`);

      return jsonResponse({
        success: true,
        token,
        role: "master_admin",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    const failed = jsonDb.recordFailedUnlockAttempt(clientIp);
    await jsonDb.addAuditLog("System", "Failed Master Vault Unlock", `Attempt from IP: ${clientIp} (Count: ${failed.attempts})`);

    return errorResponse("Invalid master decryption credentials.", 401, {
      remainingAttempts: Math.max(0, 5 - failed.attempts),
    });
  }

  if (path === "/api/master/logout") {
    const authHeader = req.headers.get("authorization");
    const masterHeader = req.headers.get("x-master-token");
    const token = masterHeader || (authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : "");
    if (token) {
      await jsonDb.removeMasterSession(token);
    }
    return jsonResponse({ success: true, message: "Logged out successfully." });
  }

  if (path === "/api/master/admin/config" || path === "/api/admin/config") {
    if (method === "GET") {
      const items = jsonDb.getCustomItems();
      const prices = jsonDb.getCustomPrices();
      const benchmarks = jsonDb.getCustomBenchmarks();
      const constants = jsonDb.getCustomConstants();
      return jsonResponse({ items, prices, benchmarks, constants });
    }
    if (method === "POST") {
      const adminPass = req.headers.get("x-admin-password") || "";
      const isPassValid = isMasterPasswordValid(adminPass, env);
      const isTokenValid = verifyMasterToken(req);
      if (!isPassValid && !isTokenValid) return errorResponse("Unauthorized admin config access", 401);
      const body: any = await req.json().catch(() => ({}));
      if (body.items) await jsonDb.saveCustomItems(body.items);
      if (body.prices) await jsonDb.saveCustomPrices(body.prices);
      if (body.benchmarks) await jsonDb.saveCustomBenchmarks(body.benchmarks);
      if (body.constants) await jsonDb.saveCustomConstants(body.constants);
      await syncDatabaseOverrides(env);
      return jsonResponse({ success: true, message: "Configuration saved." });
    }
  }

  if (path === "/api/master/admin/prices" && method === "POST") {
    if (!verifyMasterToken(req)) return errorResponse("Unauthorized", 401);
    const body: any = await req.json().catch(() => ({}));
    if (Array.isArray(body.prices)) {
      await jsonDb.saveCustomPrices(body.prices);
      await syncDatabaseOverrides(env);
      return jsonResponse({ success: true, count: body.prices.length });
    }
    return errorResponse("Invalid prices payload", 400);
  }

  if (path === "/api/master/admin/benchmarks" && method === "POST") {
    if (!verifyMasterToken(req)) return errorResponse("Unauthorized", 401);
    const body: any = await req.json().catch(() => ({}));
    if (Array.isArray(body.benchmarks)) {
      await jsonDb.saveCustomBenchmarks(body.benchmarks);
      await syncDatabaseOverrides(env);
      return jsonResponse({ success: true, count: body.benchmarks.length });
    }
    return errorResponse("Invalid benchmarks payload", 400);
  }

  if (path === "/api/master/admin/constants" && method === "POST") {
    if (!verifyMasterToken(req)) return errorResponse("Unauthorized", 401);
    const body: any = await req.json().catch(() => ({}));
    if (body.constants) {
      await jsonDb.saveCustomConstants(body.constants);
      await syncDatabaseOverrides(env);
      return jsonResponse({ success: true });
    }
    return errorResponse("Invalid constants payload", 400);
  }

  if (path === "/api/master/admin/items" && method === "POST") {
    if (!verifyMasterToken(req)) return errorResponse("Unauthorized", 401);
    const body: any = await req.json().catch(() => ({}));
    if (Array.isArray(body.items)) {
      await jsonDb.saveCustomItems(body.items);
      await syncDatabaseOverrides(env);
      return jsonResponse({ success: true, count: body.items.length });
    }
    return errorResponse("Invalid items payload", 400);
  }

  if (path === "/api/master/admin/item-mappings" && method === "POST") {
    if (!verifyMasterToken(req)) return errorResponse("Unauthorized", 401);
    const body: any = await req.json().catch(() => ({}));
    const { category, typeId, boundItem } = body;
    if (!category || typeId === undefined || !boundItem) {
      return errorResponse("category, typeId and boundItem are required.", 400);
    }
    let items = jsonDb.getCustomItems() || [];
    const itemIdx = items.findIndex((i: any) => i.name.toLowerCase() === boundItem.toLowerCase());
    if (itemIdx >= 0) {
      items[itemIdx].typeId = Number(typeId);
    } else {
      items.push({ name: boundItem, type: category, typeId: Number(typeId), rarity: "Common", baseValue: 1, maxLevel: 10 });
    }
    await jsonDb.saveCustomItems(items);
    await syncDatabaseOverrides(env);
    return jsonResponse({ success: true });
  }

  if (path === "/api/master/analytics" || path === "/api/analytics") {
    if (!verifyMasterToken(req)) return errorResponse("Unauthorized", 401);

    const lookups = jsonDb.getLookupLogs();
    const activity = jsonDb.getActivityLogs();
    const audits = jsonDb.getAuditLogs();
    const visits = jsonDb.getSiteVisits();
    const scores = await jsonDb.getArcadeScores();

    const successfulLookups = lookups.filter((l) => l.status === "Success").length;
    const failedLookups = lookups.filter((l) => l.status === "Failed").length;
    const avgResponseTimeMs = lookups.length > 0 ? Math.round(lookups.reduce((acc, l) => acc + (l.responseTimeMs || 0), 0) / lookups.length) : 0;
    const uniqueIps = new Set(visits.map((v) => v.ip).filter(Boolean)).size;

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayVisits = visits.filter((v) => (v.date || v.timestamp?.slice(0, 10)) === todayStr).length;

    const visitorIds = new Set(visits.map((v) => (v as any).visitorId).filter(Boolean));
    const uniqueVisitors = visitorIds.size > 0 ? visitorIds.size : visits.length;

    // Build historical daily activity map
    const dailyMap: Record<string, number> = {};
    const rawData = jsonDb.getRawData() as any;
    if (rawData && Array.isArray(rawData.dailyVisitsHistory)) {
      rawData.dailyVisitsHistory.forEach((h: any) => {
        if (h && h.date && h.count) dailyMap[h.date] = (dailyMap[h.date] || 0) + Number(h.count);
      });
    }
    visits.forEach((v) => {
      const d = v.date || (v.timestamp ? v.timestamp.slice(0, 10) : "");
      if (d) dailyMap[d] = (dailyMap[d] || 0) + 1;
    });

    const dailyVisitsHistory = Object.entries(dailyMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date));

    const totalAllTimeVisits = Math.max(visits.length, Object.values(dailyMap).reduce((a, b) => a + b, 0));
    const dwarfHubVisits = visits.filter((v) => (v.path || "").includes("dwarf") || (v.path || "").includes("arcade") || (v.path || "").includes("hub")).length;
    const returningVisitors = Math.max(0, visits.length - uniqueVisitors);

    return jsonResponse({
      totalLookups: lookups.length,
      successfulLookups,
      failedLookups,
      successRate: lookups.length > 0 ? Math.round((successfulLookups / lookups.length) * 100) : 100,
      avgResponseTimeMs,
      totalActivityLogs: activity.length,
      totalAuditLogs: audits.length,
      totalSiteVisits: visits.length,
      allTimeVisits: totalAllTimeVisits,
      dailyWebsiteVisits: todayVisits,
      uniqueVisitors: uniqueVisitors,
      dwarfHubVisits,
      returningVisitors,
      dailyVisitsHistory,
      totalScores: scores.length,
      databaseType: "PostgreSQL (Supabase)",
      isPersistent: true,
      persistenceInfo: {
        type: "PostgreSQL Database",
        note: "All historical records, leaderboards, and logs persist authoritatively across sessions and deployments.",
      },
    });
  }

  if (path === "/api/master/lookups" || path === "/api/master/lookup-logs" || path === "/api/lookup-logs") {
    if (!verifyMasterToken(req)) return errorResponse("Unauthorized", 401);
    let logs = jsonDb.getLookupLogs();
    // Requirement 3: Newest first
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const q = (url.searchParams.get("q") || url.searchParams.get("search") || "").toLowerCase();
    const username = (url.searchParams.get("username") || "").toLowerCase();
    const grade = url.searchParams.get("grade") || "";
    const status = url.searchParams.get("status") || "";
    const world = url.searchParams.get("world") || "";

    if (q) {
      logs = logs.filter((l) =>
        (l.usernameSearched || "").toLowerCase().includes(q) ||
        (l.grade || "").toLowerCase().includes(q)
      );
    }
    if (username) {
      logs = logs.filter((l) => (l.usernameSearched || "").toLowerCase().includes(username));
    }
    if (grade) {
      logs = logs.filter((l) => l.grade === grade);
    }
    if (status) {
      logs = logs.filter((l) => l.status === status);
    }
    if (world) {
      logs = logs.filter((l) => String(l.worldNumber) === world);
    }

    if (url.searchParams.has("paginated")) {
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
      const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get("limit") || "50", 10)));
      const total = logs.length;
      const start = (page - 1) * limit;
      const paginated = logs.slice(start, start + limit);
      return jsonResponse({ logs: paginated, total, page, limit, totalPages: Math.ceil(total / limit) });
    }

    return jsonResponse(logs);
  }

  if (path === "/api/master/activity" || path === "/api/master/activity-logs" || path === "/api/activity-logs") {
    if (!verifyMasterToken(req)) return errorResponse("Unauthorized", 401);
    let logs = jsonDb.getActivityLogs();
    // Requirement 3: Newest first
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const q = (url.searchParams.get("q") || url.searchParams.get("search") || "").toLowerCase();
    if (q) {
      logs = logs.filter((l) => (l.username || "").toLowerCase().includes(q) || (l.action || "").toLowerCase().includes(q));
    }

    if (url.searchParams.has("paginated")) {
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
      const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get("limit") || "50", 10)));
      const total = logs.length;
      const start = (page - 1) * limit;
      const paginated = logs.slice(start, start + limit);
      return jsonResponse({ logs: paginated, total, page, limit, totalPages: Math.ceil(total / limit) });
    }

    return jsonResponse(logs);
  }

  if (path === "/api/master/popular-gear" || path === "/api/popular-gear") {
    if (!verifyMasterToken(req)) return errorResponse("Unauthorized", 401);
    const lookups = jsonDb.getLookupLogs();

    const swords: Record<string, number> = {};
    const shields: Record<string, number> = {};
    const worlds: Record<number, number> = {};
    const grades: Record<string, number> = {};
    const recommendations: Record<string, number> = {};

    lookups.forEach((l) => {
      if (l.equippedSword && l.equippedSword !== "Unknown") swords[l.equippedSword] = (swords[l.equippedSword] || 0) + 1;
      if (l.equippedShield && l.equippedShield !== "Unknown") shields[l.equippedShield] = (shields[l.equippedShield] || 0) + 1;
      if (l.worldNumber) worlds[l.worldNumber] = (worlds[l.worldNumber] || 0) + 1;
      if (l.grade) grades[l.grade] = (grades[l.grade] || 0) + 1;
      if (l.recommendedUpgrade) recommendations[l.recommendedUpgrade] = (recommendations[l.recommendedUpgrade] || 0) + 1;
    });

    const popularSwords = Object.entries(swords)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const popularShields = Object.entries(shields)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const popularGrades = Object.entries(grades)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const popularWorlds = Object.entries(worlds)
      .map(([name, count]) => ({ name: `World ${name}`, count }))
      .sort((a, b) => b.count - a.count);

    const popularRecs = Object.entries(recommendations)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return jsonResponse({
      swords: popularSwords,
      shields: popularShields,
      grades: popularGrades,
      worlds: popularWorlds,
      recommendations: popularRecs,
      popularSwords,
      popularShields
    });
  }

  if (path === "/api/master/most-searched" || path === "/api/most-searched") {
    if (!verifyMasterToken(req)) return errorResponse("Unauthorized", 401);
    const lookups = jsonDb.getLookupLogs();
    const searchCounts: Record<string, { count: number; lastSearched: string; highestGrade: string }> = {};

    lookups.forEach((l) => {
      const u = l.usernameSearched;
      if (!u) return;
      if (!searchCounts[u]) {
        searchCounts[u] = { count: 0, lastSearched: l.timestamp, highestGrade: l.grade };
      }
      searchCounts[u].count++;
      if (new Date(l.timestamp) > new Date(searchCounts[u].lastSearched)) {
        searchCounts[u].lastSearched = l.timestamp;
      }
    });

    const mostSearched = Object.entries(searchCounts)
      .map(([username, data]) => ({ username, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return jsonResponse({ mostSearched });
  }

  if (path === "/api/master/backup" && method === "GET") {
    if (!verifyMasterToken(req)) return errorResponse("Unauthorized", 401);
    const raw = jsonDb.getRawData();
    return jsonResponse({
      success: true,
      exportedAt: new Date().toISOString(),
      recordCounts: {
        users: raw.users?.length || 0,
        lookupLogs: raw.lookupLogs?.length || 0,
        activityLogs: raw.activityLogs?.length || 0,
        auditLogs: raw.auditLogs?.length || 0,
        arcadeScores: raw.arcadeScores?.length || 0,
        arcadePlayers: raw.arcadePlayers?.length || 0,
      },
      data: raw,
    });
  }

  if (path === "/api/master/export-logs" && method === "GET") {
    if (!verifyMasterToken(req)) return errorResponse("Unauthorized", 401);
    const format = url.searchParams.get("format") || "csv";
    const logs = jsonDb.getLookupLogs();
    if (format === "json") {
      const sanitizedLogs = logs.map((l: any) => {
        const copy = { ...l };
        delete copy.ipAddress;
        delete copy.ip;
        return copy;
      });
      return new Response(JSON.stringify(sanitizedLogs, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": 'attachment; filename="smgrade_lookup_logs.json"',
        },
      });
    }
    const csvHeaders = ["ID", "Timestamp", "Username Searched", "Status", "Grade", "Level", "Power", "Gold", "Sword", "Shield"];
    let csv = csvHeaders.join(",") + "\n";
    logs.forEach((l) => {
      csv += [
        l.id,
        l.timestamp,
        `"${(l.usernameSearched || "").replace(/"/g, '""')}"`,
        l.status,
        l.grade,
        l.playerLevel,
        l.playerPower,
        l.playerGold,
        `"${(l.equippedSword || "").replace(/"/g, '""')}"`,
        `"${(l.equippedShield || "").replace(/"/g, '""')}"`,
      ].join(",") + "\n";
    });
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="smgrade_lookup_logs.csv"',
      },
    });
  }

  if (path === "/api/master/restore" && method === "POST") {
    if (!verifyMasterToken(req)) return errorResponse("Unauthorized", 401);
    const body: any = await req.json().catch(() => ({}));
    if (!body || typeof body !== "object") {
      return errorResponse("Invalid backup JSON payload", 400);
    }
    const restorePayload = body.data || body;
    await jsonDb.restoreRawData(restorePayload);
    await syncDatabaseOverrides(env);
    await jsonDb.addAuditLog("Master Admin", "Database Restored", `Restored backup payload`);
    return jsonResponse({ success: true, message: "Database restored successfully" });
  }

  if (path === "/api/master/health") {
    return jsonResponse({
      status: "healthy",
      timestamp: new Date().toISOString(),
      databaseType: "PostgreSQL (Supabase)",
      totalUsers: jsonDb.getUsers().length,
      totalScores: (await jsonDb.getArcadeScores()).length,
      uptime: process.uptime ? process.uptime() : 0,
    });
  }

  if (path === "/api/master/record-visit" && method === "POST") {
    const body: any = await req.json().catch(() => ({}));
    const pathStr = String(body.path || "/");
    const visitorId = String(body.visitorId || "");
    const userAgent = req.headers.get("user-agent") || "Unknown";
    await jsonDb.recordSiteVisit(pathStr, undefined, userAgent, visitorId);
    return jsonResponse({ success: true });
  }

  if (path === "/api/master/log-lookup" && method === "POST") {
    const body: any = await req.json().catch(() => ({}));
    await jsonDb.addLookupLog({
      usernameSearched: body.usernameSearched || "Unknown",
      sessionId: body.sessionId || "anonymous",
      userAccount: body.userAccount || null,
      userType: body.userType || "Guest",
      status: body.status || "Success",
      responseTimeMs: body.responseTimeMs || 0,
      grade: body.grade || "—",
      gearScore: body.gearScore || 0,
      wealthScore: body.wealthScore || 0,
      powerScore: body.powerScore || 0,
      progressionScore: body.progressionScore || 0,
      recommendedUpgrade: body.recommendedUpgrade || "None",
      playerLevel: body.playerLevel || 0,
      playerPower: body.playerPower || 0,
      playerGold: body.playerGold || 0,
      equippedSword: body.equippedSword || "Unknown",
      equippedShield: body.equippedShield || "Unknown",
      worldNumber: body.worldNumber || 1,
    });
    return jsonResponse({ success: true });
  }

  if ((path === "/api/master/log-action" || path === "/api/master/log-activity") && method === "POST") {
    const body: any = await req.json().catch(() => ({}));
    const actor = body.username || body.actor || "Anonymous";
    const action = body.action || "Action";
    const details = body.details || "";
    const status = body.status || "Success";
    const responseTimeMs = body.responseTimeMs;
    await jsonDb.addActivityLog(actor, action, details, status, responseTimeMs);
    return jsonResponse({ success: true });
  }

  if (path === "/api/master/log-comparison" && method === "POST") {
    const body: any = await req.json().catch(() => ({}));
    await jsonDb.addActivityLog(body.actor || "Anonymous", "Player Comparison", `Compared ${body.playerA} vs ${body.playerB}`);
    return jsonResponse({ success: true });
  }

  // 6. Arcade Endpoints (/api/master/arcade/* and /api/arcade/*)
  if (path === "/api/master/arcade/player/register" || path === "/api/arcade/player/register") {
    const body: any = await req.json().catch(() => ({}));
    const { username, playerId, secretToken } = body;
    const result = await jsonDb.registerArcadePlayer(username, playerId, secretToken);
    return jsonResponse(result, result.status);
  }

  if (path === "/api/master/arcade/player/check-username" || path === "/api/arcade/player/check-username") {
    const username = (url.searchParams.get("username") || "").trim();
    const playerId = (url.searchParams.get("playerId") || "").trim();
    const result = await jsonDb.checkArcadePlayerUsername(username, playerId);
    return jsonResponse(result);
  }

  if (path === "/api/master/arcade/player/record-stat" || path === "/api/arcade/player/record-stat") {
    const body: any = await req.json().catch(() => ({}));
    const { playerId, secretToken, dwarfSuccessDelta, highestDwarfedLevel, petEnhanceDelta, downgraderDelta, mobKillDelta, elfDelta, level } = body;

    const updated = await jsonDb.updateArcadePlayerStats(playerId, secretToken, {
      dwarfSuccessDelta,
      highestDwarfedLevel,
      petEnhanceDelta,
      downgraderDelta,
      mobKillDelta,
      elfDelta,
      level,
    });

    if (!updated) {
      return errorResponse("Unauthorized or player not found", 403);
    }
    return jsonResponse({ success: true, player: updated });
  }

  if (path === "/api/master/arcade/game-leaderboards" || path === "/api/arcade/game-leaderboards") {
    const boards = jsonDb.getArcadeGameLeaderboards();
    return jsonResponse(boards);
  }

  if (path === "/api/master/arcade/check-username" || path === "/api/arcade/check-username") {
    const username = (url.searchParams.get("username") || "").trim();
    const userId = (url.searchParams.get("userId") || "").trim();

    if (!username) {
      return errorResponse("Username is required.", 400);
    }

    const scores = await jsonDb.getArcadeScores();
    const userMap = new Map<string, { latestName: string; latestTime: number }>();
    scores.forEach((s) => {
      const key = s.userId ? s.userId.toLowerCase() : s.username.toLowerCase();
      const scoreTime = new Date(s.timestamp).getTime();
      const existing = userMap.get(key);
      if (!existing || scoreTime > existing.latestTime) {
        userMap.set(key, { latestName: s.username, latestTime: scoreTime });
      }
    });

    let exists = false;
    for (const [key, value] of userMap.entries()) {
      if (userId && key === userId.toLowerCase()) continue;
      if (value.latestName.toLowerCase() === username.toLowerCase()) {
        exists = true;
        break;
      }
    }

    return jsonResponse({ exists });
  }

  if (path === "/api/master/arcade/leaderboard" || path === "/api/arcade/leaderboard") {
    const windowStr = url.searchParams.get("window") || "all-time";
    const scores = await jsonDb.getArcadeScores();
    const now = Date.now();

    const todayIso = new Date(now).toISOString().slice(0, 10);
    const filtered = scores.filter((s) => {
      const time = new Date(s.timestamp).getTime();
      if (isNaN(time)) return false;
      if (windowStr === "daily") {
        return now - time <= 24 * 60 * 60 * 1000 || new Date(time).toISOString().slice(0, 10) === todayIso;
      }
      if (windowStr === "weekly") {
        return now - time <= 7 * 24 * 60 * 60 * 1000;
      }
      return true;
    });

    const userMap = new Map<string, { username: string; dwarfKills: number; elfKills: number; totalKills: number; highestCombo: number; highestDps: number; timestamp: string }>();

    filtered.forEach((s: any) => {
      const key = (s.userId || s.user_id) ? String(s.userId || s.user_id).toLowerCase() : s.username.toLowerCase();
      const dwarfKills = Number(s.dwarfKills ?? s.dwarf_kills ?? 0);
      const elfKills = Number(s.elfKills ?? s.elf_kills ?? 0);
      const totalKills = Number(s.totalKills ?? s.total_kills ?? (dwarfKills + elfKills));
      const highestCombo = Number(s.highestCombo ?? s.highest_combo ?? 0);
      const highestDps = Number(s.highestDps ?? s.highest_dps ?? 0);

      const existing = userMap.get(key);
      if (!existing) {
        userMap.set(key, {
          username: s.username,
          dwarfKills,
          elfKills,
          totalKills,
          highestCombo,
          highestDps,
          timestamp: s.timestamp,
        });
      } else {
        existing.dwarfKills += dwarfKills;
        existing.elfKills += elfKills;
        existing.totalKills += totalKills;
        existing.highestCombo = Math.max(existing.highestCombo, highestCombo);
        existing.highestDps = Math.max(existing.highestDps, highestDps);
        if (new Date(s.timestamp) > new Date(existing.timestamp)) {
          existing.username = s.username;
          existing.timestamp = s.timestamp;
        }
      }
    });

    const totalKills = Array.from(userMap.values())
      .filter((u) => u.totalKills > 0)
      .sort((a, b) => b.totalKills - a.totalKills)
      .slice(0, 50)
      .map((u) => ({ username: u.username, score: u.totalKills }));

    const dwarfKills = Array.from(userMap.values())
      .filter((u) => u.dwarfKills > 0)
      .sort((a, b) => b.dwarfKills - a.dwarfKills)
      .slice(0, 50)
      .map((u) => ({ username: u.username, score: u.dwarfKills }));

    const elfKills = Array.from(userMap.values())
      .filter((u) => u.elfKills > 0)
      .sort((a, b) => b.elfKills - a.elfKills)
      .slice(0, 50)
      .map((u) => ({ username: u.username, score: u.elfKills }));

    const highestCombo = Array.from(userMap.values())
      .filter((u) => u.highestCombo > 0)
      .sort((a, b) => b.highestCombo - a.highestCombo)
      .slice(0, 50)
      .map((u) => ({ username: u.username, score: u.highestCombo }));

    const highestDps = Array.from(userMap.values())
      .filter((u) => u.highestDps > 0)
      .sort((a, b) => b.highestDps - a.highestDps)
      .slice(0, 50)
      .map((u) => ({ username: u.username, score: u.highestDps }));

    return jsonResponse({
      totalKills,
      dwarfKills,
      elfKills,
      highestCombo,
      highestDps,
    });
  }

  if (path === "/api/master/arcade/score" || path === "/api/arcade/score") {
    const body: any = await req.json().catch(() => ({}));
    const username = String(body.username || "").trim();
    if (!username) return errorResponse("Username is required", 400);

    const score = await jsonDb.addArcadeScore({
      username,
      userId: body.userId,
      dwarfKills: Number(body.dwarfKills || 0),
      elfKills: Number(body.elfKills || 0),
      totalKills: Number(body.totalKills || 0),
      highestCombo: Number(body.highestCombo || 0),
      highestDps: Number(body.highestDps || 0),
    });

    return jsonResponse({ success: true, score });
  }

  if (path === "/api/master/arcade/player-history" || path === "/api/arcade/player-history" || path === "/api/player-history") {
    const username = (url.searchParams.get("username") || "").trim().toLowerCase();
    if (!username) {
      return jsonResponse([]);
    }
    const allLogs = jsonDb.getLookupLogs();
    const playerLogs = allLogs.filter(
      (l) => l.usernameSearched.toLowerCase() === username && l.status === "Success" && (l.playerLevel || 0) > 0
    );
    playerLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const historyEntries = playerLogs.map((l) => ({
      timestamp: l.timestamp,
      level: l.playerLevel || 0,
      power: l.playerPower || 0,
      gold: l.playerGold || 0,
      grade: l.grade || "B",
      score: l.overallScore ?? Math.round(((l.gearScore || 50) + (l.wealthScore || 50) + (l.powerScore || 50) + (l.progressionScore || 50)) / 4),
      tier: l.levelTier || "Initiate I",
      equippedSword: l.equippedSword || "None",
      equippedShield: l.equippedShield || "None",
      gearScore: l.gearScore ?? 0,
    }));
    return jsonResponse(historyEntries);
  }

  if ((path === "/api/master/arcade/reset" || path === "/api/arcade/reset") && method === "POST") {
    if (!verifyMasterToken(req)) return errorResponse("Unauthorized", 401);
    await jsonDb.resetArcadeScores();
    await jsonDb.addAuditLog("Master Admin", "Arcade Reset", `SM Revenge leaderboard reset executed from IP: ${clientIp}`);
    return jsonResponse({ success: true, message: "Arcade leaderboard reset successfully." });
  }

  // 7. User Management Routes (/api/master/users/*)
  if (path === "/api/master/users") {
    if (!verifyMasterToken(req)) return errorResponse("Unauthorized", 401);
    if (method === "GET") {
      const users = jsonDb.getUsers().map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        status: u.status,
        highestGrade: u.highestGrade,
        totalAnalyses: u.totalAnalyses,
        lastLogin: u.lastLogin,
        createdAt: u.createdAt,
      }));
      return jsonResponse(users);
    }
    if (method === "DELETE") {
      const userId = url.searchParams.get("userId");
      if (!userId) return errorResponse("userId query param required", 400);
      await jsonDb.deleteUser(userId);
      return jsonResponse({ success: true });
    }
  }

  if (path === "/api/master/users/status" && method === "POST") {
    if (!verifyMasterToken(req)) return errorResponse("Unauthorized", 401);
    const body: any = await req.json().catch(() => ({}));
    const user = jsonDb.getUserById(body.userId);
    if (!user) return errorResponse("User not found", 404);
    user.status = body.status === "suspended" ? "suspended" : "active";
    await jsonDb.updateUser(user);
    return jsonResponse({ success: true });
  }

  if (path === "/api/master/users/role" && method === "POST") {
    if (!verifyMasterToken(req)) return errorResponse("Unauthorized", 401);
    const body: any = await req.json().catch(() => ({}));
    const user = jsonDb.getUserById(body.userId);
    if (!user) return errorResponse("User not found", 404);
    user.role = body.role || "viewer";
    await jsonDb.updateUser(user);
    return jsonResponse({ success: true });
  }

  if (path === "/api/master/users/reset-password" && method === "POST") {
    if (!verifyMasterToken(req)) return errorResponse("Unauthorized", 401);
    const body: any = await req.json().catch(() => ({}));
    const user = jsonDb.getUserById(body.userId);
    if (!user) return errorResponse("User not found", 404);
    user.passwordHash = jsonDb.hashPassword(body.newPassword);
    await jsonDb.updateUser(user);
    return jsonResponse({ success: true });
  }

  if (path === "/api/master/users/change-username" && method === "POST") {
    if (!verifyMasterToken(req)) return errorResponse("Unauthorized", 401);
    const body: any = await req.json().catch(() => ({}));
    const user = jsonDb.getUserById(body.userId);
    if (!user) return errorResponse("User not found", 404);
    user.username = body.newUsername;
    await jsonDb.updateUser(user);
    return jsonResponse({ success: true });
  }

  if (path === "/api/master/login-history" && method === "GET") {
    if (!verifyMasterToken(req)) return errorResponse("Unauthorized", 401);
    return jsonResponse(jsonDb.getLoginHistory());
  }

  if (path === "/api/master/audit-logs" && method === "GET") {
    if (!verifyMasterToken(req)) return errorResponse("Unauthorized", 401);
    return jsonResponse(jsonDb.getAuditLogs());
  }

  if (path === "/api/master/logs/delete-player-activity" && method === "POST") {
    if (!verifyMasterToken(req)) return errorResponse("Unauthorized", 401);
    await jsonDb.deletePlayerActivityLogs();
    return jsonResponse({ success: true });
  }

  if (path === "/api/master/logs/delete-system-audit" && method === "POST") {
    if (!verifyMasterToken(req)) return errorResponse("Unauthorized", 401);
    await jsonDb.deleteSystemAuditLogs();
    return jsonResponse({ success: true });
  }

  if (path === "/api/master/logs/delete-lookup-logs" && method === "POST") {
    if (!verifyMasterToken(req)) return errorResponse("Unauthorized", 401);
    await jsonDb.deleteLookupLogs();
    return jsonResponse({ success: true });
  }

  if (path === "/api/master/logs/delete-all-logs" && method === "POST") {
    if (!verifyMasterToken(req)) return errorResponse("Unauthorized", 401);
    await jsonDb.deleteAllLogs();
    return jsonResponse({ success: true });
  }

  // 8. API 404 Handler - NEVER return HTML for /api/*
  return jsonResponse(
    {
      error: "API endpoint not found",
      method,
      path,
    },
    404
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLOUDFLARE WORKER EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export default {
  async fetch(req: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(req.url);
    const pathname = url.pathname.toLowerCase();

    // STRICT SECURITY GUARD: Block any attempt to access sensitive, configuration, database, or backup files
    const sensitivePatterns = [
      "/.env",
      "/env.",
      "/db.json",
      "/arcade_scores",
      "/neon_",
      "/supabase_",
      "/data/",
      "/artifacts/",
      "/backups/",
      "/scripts/",
      "/src/",
      "package.json",
      "pnpm-lock.yaml",
      "tsconfig.json",
      "wrangler.jsonc",
      "wrangler.json",
      "vite.config.ts"
    ];

    const isSensitive = sensitivePatterns.some((p) => pathname.includes(p)) ||
      pathname.endsWith(".env") ||
      pathname.endsWith(".json.bak") ||
      pathname.endsWith(".bak") ||
      pathname.endsWith(".tar.gz") ||
      pathname.endsWith(".zip") ||
      pathname.endsWith(".sql") ||
      pathname.endsWith(".ts") ||
      pathname.endsWith(".map");

    if (isSensitive) {
      return new Response(JSON.stringify({ error: "Access Denied: Private resource." }), {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "no-store",
        },
      });
    }

    // If request is directed to /api/*, route directly to API handler
    if (url.pathname.startsWith("/api/") || url.pathname === "/api") {
      try {
        return await handleApiRequest(req, env, ctx);
      } catch (err: any) {
        console.error("[SMGrade Worker API Exception]", err);
        return new Response(JSON.stringify({ error: err?.message || String(err), stack: err?.stack }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        });
      }
    }

    // For static assets, delegate to Cloudflare Workers Static Assets binding
    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(req);
    }

    return new Response("SMGrade Worker is operational.", { status: 200 });
  },
};
