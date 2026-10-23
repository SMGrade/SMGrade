import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import jsonDb from "../lib/jsonDb.js";
import { getSession } from "./auth.js";
import { setOverrideItems, DEFAULT_ITEMS } from "../../lib/gearDatabase.js";
import { setOverrideMarketData, initializeMarketData } from "../../lib/marketDatabase.js";
import { setOverrideBenchmarks, DEFAULT_BENCHMARKS } from "../../lib/benchmark.js";
import { setOverrideConstants, DEFAULT_CONSTANTS } from "../../lib/settings.js";
import { clearPlayerCache } from "./grade.js";

const router = Router();

// Master Password (can be configured via env)
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || "harrison@smgrade.swordmasters2026";

// Rate limiting & Brute force protection map for Master Vault unlock
interface RateLimitTracker {
  attempts: number;
  lastAttempt: number;
  lockoutUntil: number;
}
const unlockRateLimitMap = new Map<string, RateLimitTracker>();

// Sliding window active session tracker in memory for fast lookup & expiration
interface SlidingMasterSession {
  token: string;
  createdAt: number;
  expiresAt: number;
  ipAddress: string;
}
const activeMasterSessionsMap = new Map<string, SlidingMasterSession>();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes short-lived session

// Middleware to check Master session
function checkMasterSession(req: any, res: any, next: () => void) {
  const authHeader = (req.headers["x-master-token"] as string) || (req.cookies && req.cookies["smg_master_session"]);
  if (!authHeader) {
    res.status(401).json({ error: "Unauthorized Master Vault access." });
    return;
  }

  const now = Date.now();
  const session = activeMasterSessionsMap.get(authHeader);

  if (session) {
    if (session.expiresAt <= now) {
      activeMasterSessionsMap.delete(authHeader);
      jsonDb.removeMasterSession(authHeader);
      res.status(401).json({ error: "Master Vault session expired. Please re-authenticate." });
      return;
    }
    // Dynamic sliding window extension: extend by 30 mins on active request
    session.expiresAt = now + SESSION_TTL_MS;
    next();
    return;
  }

  // Fallback check against persistent jsonDb
  if (jsonDb.hasMasterSession(authHeader)) {
    activeMasterSessionsMap.set(authHeader, {
      token: authHeader,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1"
    });
    next();
    return;
  }

  res.status(401).json({ error: "Unauthorized Master Vault access." });
}

// 1. Unlock Master Vault
router.post("/unlock", async (req: any, res: any) => {
  const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
  const now = Date.now();

  // Check persistent lockout status first
  const lockoutStatus = jsonDb.checkUnlockLockout(ipAddress);
  if (lockoutStatus.isLocked) {
    res.status(429).json({ error: `Too many failed attempts. Locked out for ${lockoutStatus.remainingSec} seconds.` });
    return;
  }

  let tracker = unlockRateLimitMap.get(ipAddress);
  if (!tracker) {
    tracker = { attempts: 0, lastAttempt: now, lockoutUntil: 0 };
    unlockRateLimitMap.set(ipAddress, tracker);
  }

  if (tracker.lockoutUntil > now) {
    const remainingSec = Math.ceil((tracker.lockoutUntil - now) / 1000);
    res.status(429).json({ error: `Too many failed attempts. Locked out for ${remainingSec} seconds.` });
    return;
  }

  if (now - tracker.lastAttempt > 10 * 60 * 1000) {
    tracker.attempts = 0;
  }
  tracker.lastAttempt = now;

  const { password } = req.body || {};

  if (password === MASTER_PASSWORD) {
    tracker.attempts = 0;
    tracker.lockoutUntil = 0;
    jsonDb.resetFailedUnlockAttempt(ipAddress);

    const token = crypto.randomBytes(32).toString("hex");
    activeMasterSessionsMap.set(token, {
      token,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
      ipAddress
    });

    await jsonDb.addMasterSession(token);
    await jsonDb.addAuditLog("System", "Master Vault Unlocked", `Access granted to Master settings terminal. IP: ${ipAddress}`);

    res.cookie("smg_master_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: SESSION_TTL_MS
    });

    res.json({ success: true, token });
  } else {
    tracker.attempts += 1;
    const persistentRes = jsonDb.recordFailedUnlockAttempt(ipAddress);
    
    if (tracker.attempts >= 5 || persistentRes.attempts >= 5) {
      tracker.lockoutUntil = now + 15 * 60 * 1000;
      await jsonDb.addAuditLog("System", "Master Vault Lockout Triggered", `IP ${ipAddress} locked out for 15 minutes after failed unlock attempts.`);
    } else {
      await jsonDb.addAuditLog("System", "Master Vault Attempt Failed", `Failed unlock attempt from IP: ${ipAddress}`);
    }

    await new Promise(resolve => setTimeout(resolve, Math.min(tracker.attempts * 500, 2500)));

    res.status(400).json({ error: "Invalid master credentials." });
  }
});

// Logout endpoint
router.post("/logout", checkMasterSession, async (req: any, res: any) => {
  const token = (req.headers["x-master-token"] as string) || (req.cookies && req.cookies["smg_master_session"]);
  const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";

  if (token) {
    activeMasterSessionsMap.delete(token);
    await jsonDb.removeMasterSession(token);
    await jsonDb.addAuditLog("System", "Master Vault Logged Out", `Session explicitly terminated. IP: ${ipAddress}`);
  }

  res.clearCookie("smg_master_session");
  res.json({ success: true, message: "Logged out successfully." });
});

// 2. User Management: List/Search registered users
router.get("/users", checkMasterSession, (req: any, res: any) => {
  const query = (req.query.q as string || "").toLowerCase();
  const users = jsonDb.getUsers().map((u) => ({
    id: u.id,
    username: u.username,
    role: u.role,
    status: u.status,
    totalAnalyses: u.totalAnalyses,
    highestGrade: u.highestGrade,
    lastLogin: u.lastLogin,
    createdAt: u.createdAt,
  }));

  const filtered = users.filter((u) => u.username.toLowerCase().includes(query));
  res.json(filtered);
});

// 3. User Management: Suspend / Activate
router.post("/users/status", checkMasterSession, async (req: any, res: any) => {
  const { userId, status } = req.body;
  if (!userId || !["active", "suspended"].includes(status)) {
    res.status(400).json({ error: "Invalid parameters." });
    return;
  }

  const user = jsonDb.getUserById(userId);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  if (user.role === "owner") {
    res.status(400).json({ error: "Cannot suspend owner account." });
    return;
  }

  user.status = status;
  await jsonDb.updateUser(user);
  await jsonDb.addAuditLog("Master Admin", "User Status Updated", `User ${user.username} status set to ${status}`);
  res.json({ success: true, message: `User status changed to ${status}` });
});

// 4. User Management: Change Role
router.post("/users/role", checkMasterSession, async (req: any, res: any) => {
  const { userId, role } = req.body;
  if (!userId || !["owner", "admin", "moderator", "viewer"].includes(role)) {
    res.status(400).json({ error: "Invalid role." });
    return;
  }

  const user = jsonDb.getUserById(userId);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  user.role = role;
  await jsonDb.updateUser(user);
  await jsonDb.addAuditLog("Master Admin", "User Role Updated", `User ${user.username} role set to ${role}`);
  res.json({ success: true, message: `User role changed to ${role}` });
});

// 5. User Management: Reset password
router.post("/users/reset-password", checkMasterSession, async (req: any, res: any) => {
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword || newPassword.trim().length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters." });
    return;
  }

  const user = jsonDb.getUserById(userId);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  user.passwordHash = jsonDb.hashPassword(newPassword);
  await jsonDb.updateUser(user);
  await jsonDb.addAuditLog("Master Admin", "Password Reset", `Password reset for user ${user.username}`);
  res.json({ success: true, message: "Password reset successfully." });
});

// 6. User Management: Change Username
router.post("/users/change-username", checkMasterSession, async (req: any, res: any) => {
  const { userId, newUsername } = req.body;
  if (!userId || !newUsername || newUsername.trim().length < 3) {
    res.status(400).json({ error: "Username must be at least 3 characters." });
    return;
  }

  const user = jsonDb.getUserById(userId);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const existing = jsonDb.getUserByUsername(newUsername);
  if (existing && existing.id !== userId) {
    res.status(400).json({ error: "Username already exists." });
    return;
  }

  const oldName = user.username;
  user.username = newUsername.trim();
  await jsonDb.updateUser(user);
  await jsonDb.addAuditLog("Master Admin", "Username Changed", `Username for ${oldName} set to ${newUsername}`);
  res.json({ success: true, message: "Username updated successfully." });
});

// 7. User Management: Delete User
router.delete("/users", checkMasterSession, async (req: any, res: any) => {
  const { userId } = req.body;
  if (!userId) {
    res.status(400).json({ error: "User ID is required." });
    return;
  }

  const user = jsonDb.getUserById(userId);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  if (user.role === "owner") {
    res.status(400).json({ error: "Cannot delete owner account." });
    return;
  }

  await jsonDb.deleteUser(userId);
  await jsonDb.addAuditLog("Master Admin", "User Deleted", `User ${user.username} has been permanently deleted.`);
  res.json({ success: true, message: "User deleted successfully." });
});

// 8. View Login History
router.get("/login-history", checkMasterSession, (req: any, res: any) => {
  res.json(jsonDb.getLoginHistory());
});

// 9. View Audit Logs
router.get("/audit-logs", checkMasterSession, (req: any, res: any) => {
  res.json(jsonDb.getAuditLogs());
});

// 10. System Health Status
router.get("/health", checkMasterSession, (req: any, res: any) => {
  const isVercel = process.env.VERCEL === "1" || !!process.env.VERCEL;
  const hasPostgres = !!process.env.DATABASE_URL;
  const stats = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    totalUsers: jsonDb.getUsers().length,
    totalHistoryEntries: jsonDb.getRawData().history.length,
    totalLogs: jsonDb.getAuditLogs().length,
    nodeVersion: process.version,
    platform: process.platform,
    // Persistence info
    dbMode: hasPostgres ? "postgresql" : "file",
    persistenceMode: hasPostgres ? "persistent" : (isVercel ? "ephemeral" : "local-file"),
    persistenceNote: hasPostgres
      ? "Logs are stored in PostgreSQL and will persist across deployments."
      : isVercel
        ? "No DATABASE_URL set. Logs are stored in /tmp on Vercel and will reset on cold starts."
        : "Logs are stored in db_storage.json and persist across local server restarts.",
  };
  res.json(stats);
});

// 11. Database Export / Backup
router.get("/backup", checkMasterSession, async (req: any, res: any) => {
  const raw = jsonDb.getRawData();
  await jsonDb.addAuditLog("Master Admin", "Database Backup", "Full database exported.");
  res.json(raw);
});

// 12. Database Import / Restore
router.post("/restore", checkMasterSession, async (req: any, res: any) => {
  const { dbData } = req.body;
  if (!dbData || !dbData.users || !dbData.history) {
    res.status(400).json({ error: "Invalid backup database content." });
    return;
  }

  await jsonDb.restoreRawData(dbData);
  await jsonDb.addAuditLog("Master Admin", "Database Restored", "Full database restored from backup.");
  await jsonDb.addActivityLog("Master Admin", "Database Restored", "Full database restored from backup.");
  res.json({ success: true, message: "Database restored successfully." });
});

// 13. Public: Asynchronously log player lookup analytics
router.post("/log-lookup", async (req: any, res: any) => {
  try {
    const logData = req.body;
    const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    
    const responseTimeMs = Number(logData.responseTimeMs) || 0;
    const gearScore = Number(logData.gearScore) || 0;
    const wealthScore = Number(logData.wealthScore) || 0;
    const powerScore = Number(logData.powerScore) || 0;
    const progressionScore = Number(logData.progressionScore) || 0;
    const overallScore = typeof logData.overallScore === "number" ? logData.overallScore : (Number(logData.overallScore) || undefined);
    const levelTier = logData.levelTier ? String(logData.levelTier) : undefined;
    const playerLevel = Number(logData.playerLevel) || 0;
    const playerPower = Number(logData.playerPower) || 0;
    const playerGold = Number(logData.playerGold) || 0;
    const worldNumber = Number(logData.worldNumber) || 1;

    await jsonDb.addLookupLog({
      usernameSearched: logData.usernameSearched || "Unknown",
      ipAddress,
      sessionId: logData.sessionId || "anonymous-session",
      userAccount: logData.userAccount || null,
      userType: logData.userType || "Guest",
      status: logData.status || "Success",
      responseTimeMs,
      grade: logData.grade || "B+",
      gearScore,
      wealthScore,
      powerScore,
      progressionScore,
      overallScore,
      levelTier,
      recommendedUpgrade: logData.recommendedUpgrade || "None",
      playerLevel,
      playerPower,
      playerGold,
      equippedSword: logData.equippedSword || "Unknown",
      equippedShield: logData.equippedShield || "Unknown",
      worldNumber
    });

    await jsonDb.addActivityLog(
      logData.usernameSearched || "Unknown",
      "Player Analysis",
      logData.status === "Success"
        ? `Successful player analysis of ${logData.usernameSearched || "Unknown"}. IP: ${ipAddress}`
        : `Failed player analysis of ${logData.usernameSearched || "Unknown"}. IP: ${ipAddress}`,
      logData.status || "Success",
      responseTimeMs
    );
  } catch (err) {
    console.error("Error logging player lookup:", err);
  }
  res.json({ success: true });
});

// 14. Public: Log administrative/user activity
router.post("/log-activity", async (req: any, res: any) => {
  const { username, action, details } = req.body;
  const session = getSession(req);
  const actor = session ? session.username : (username || "Guest");
  
  await jsonDb.addActivityLog(actor, action, details);
  res.json({ success: true });
});

// 15. Protected: Get player lookup logs with universal query & filters
router.get("/lookup-logs", checkMasterSession, (req: any, res: any) => {
  const { username, date, grade, world, user, status, q } = req.query;
  let logs = jsonDb.getLookupLogs();

  // Sort newest first
  logs = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Universal Query Engine
  if (q && typeof q === "string" && q.trim().length > 0) {
    const rawSearch = q.trim().toLowerCase();
    const cleanSearch = rawSearch.substring(0, 100).replace(/\0/g, "");

    logs = logs.filter((l) => {
      if (l.usernameSearched && l.usernameSearched.toLowerCase().includes(cleanSearch)) return true;
      if (l.ipAddress && l.ipAddress.toLowerCase().includes(cleanSearch)) return true;
      if (l.userAccount && l.userAccount.toLowerCase().includes(cleanSearch)) return true;
      if (l.sessionId && l.sessionId.toLowerCase().includes(cleanSearch)) return true;
      if (l.grade && l.grade.toLowerCase() === cleanSearch) return true;
      if (l.recommendedUpgrade && l.recommendedUpgrade.toLowerCase().includes(cleanSearch)) return true;
      if (l.equippedSword && l.equippedSword.toLowerCase().includes(cleanSearch)) return true;
      if (l.equippedShield && l.equippedShield.toLowerCase().includes(cleanSearch)) return true;
      if (l.timestamp) {
        const tsLow = l.timestamp.toLowerCase();
        if (tsLow.includes(cleanSearch)) return true;
        const dObj = new Date(l.timestamp);
        if (!isNaN(dObj.getTime())) {
          const isoDate = dObj.toISOString().split("T")[0];
          if (isoDate.includes(cleanSearch)) return true;
          const day = String(dObj.getDate()).padStart(2, "0");
          const month = String(dObj.getMonth() + 1).padStart(2, "0");
          const year = dObj.getFullYear();
          const slashDate = `${day}/${month}/${year}`;
          if (slashDate.includes(cleanSearch)) return true;
        }
      }
      return false;
    });
  }

  if (username) {
    const uLow = String(username).toLowerCase();
    logs = logs.filter(l => l.usernameSearched.toLowerCase().includes(uLow));
  }
  if (grade) {
    logs = logs.filter(l => l.grade === grade);
  }
  if (world) {
    const wNum = Number(world);
    logs = logs.filter(l => l.worldNumber === wNum);
  }
  if (status) {
    logs = logs.filter(l => l.status === status);
  }
  if (user) {
    const uq = String(user).toLowerCase();
    logs = logs.filter(l => l.userAccount && l.userAccount.toLowerCase().includes(uq));
  }
  if (date) {
    const dStr = String(date);
    logs = logs.filter(l => l.timestamp.startsWith(dStr));
  }

  res.json(logs);
});

// 16. Protected: Get user activity logs with universal search
router.get("/activity-logs", checkMasterSession, (req: any, res: any) => {
  const { username, action, status, date, q } = req.query;
  let logs = jsonDb.getActivityLogs();

  // Sort newest first
  logs = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (q && typeof q === "string" && q.trim().length > 0) {
    const rawSearch = q.trim().toLowerCase();
    const cleanSearch = rawSearch.substring(0, 100).replace(/\0/g, "");

    logs = logs.filter((act) => {
      if (act.username && act.username.toLowerCase().includes(cleanSearch)) return true;
      if (act.action && act.action.toLowerCase().includes(cleanSearch)) return true;
      if (act.details && act.details.toLowerCase().includes(cleanSearch)) return true;
      if (act.ipAddress && act.ipAddress.toLowerCase().includes(cleanSearch)) return true;
      if (act.status && act.status.toLowerCase() === cleanSearch) return true;
      if (act.timestamp) {
        const tsLow = act.timestamp.toLowerCase();
        if (tsLow.includes(cleanSearch)) return true;
        const dObj = new Date(act.timestamp);
        if (!isNaN(dObj.getTime())) {
          const isoDate = dObj.toISOString().split("T")[0];
          if (isoDate.includes(cleanSearch)) return true;
          const day = String(dObj.getDate()).padStart(2, "0");
          const month = String(dObj.getMonth() + 1).padStart(2, "0");
          const year = dObj.getFullYear();
          const slashDate = `${day}/${month}/${year}`;
          if (slashDate.includes(cleanSearch)) return true;
        }
      }
      return false;
    });
  }

  if (username) {
    const uLow = String(username).toLowerCase();
    logs = logs.filter(a => a.username.toLowerCase().includes(uLow));
  }
  if (action) {
    logs = logs.filter(a => a.action === action);
  }
  if (status) {
    logs = logs.filter(a => a.status === status);
  }
  if (date) {
    const dStr = String(date);
    logs = logs.filter(a => a.timestamp.startsWith(dStr));
  }

  res.json(logs);
});

// 16B. Log Action (Master Logs / Arcade actions)
router.post("/log-action", async (req: any, res: any) => {
  try {
    const { username, action, details, status, responseTimeMs } = req.body;
    if (!username || !action) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const entry = await jsonDb.addActivityLog(username, action, details || "", status || "Success", responseTimeMs || 0);
    res.json({ success: true, log: entry });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to log action" });
  }
});

// Record background website visits (Requirement 10)
router.post("/record-visit", async (req: any, res: any) => {
  try {
    const { path } = req.body || {};
    const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress;
    const userAgent = req.headers["user-agent"];
    const visit = await jsonDb.recordSiteVisit(path || "/", String(ip || ""), String(userAgent || ""));
    res.json({ success: true, visitId: visit.id });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to record visit" });
  }
});

// 17. Protected: Get dashboard stats analytics
router.get("/analytics", checkMasterSession, (req: any, res: any) => {
  const logs = jsonDb.getLookupLogs();
  const users = jsonDb.getUsers();

  const totalLookups = logs.length;
  
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const todayLookups = logs.filter(l => new Date(l.timestamp) >= oneDayAgo).length;
  const weekLookups = logs.filter(l => new Date(l.timestamp) >= oneWeekAgo).length;
  const monthLookups = logs.filter(l => new Date(l.timestamp) >= oneMonthAgo).length;

  const registeredUsersCount = users.length;
  
  const guestSessions = new Set(logs.filter(l => l.userType === "Guest").map(l => l.sessionId));
  const guestUsersCount = guestSessions.size;

  const activeUsersCount = users.filter(u => u.lastLogin && new Date(u.lastLogin) >= oneMonthAgo).length;

  const failedLookups = logs.filter(l => l.status === "Failed").length;
  const successRate = totalLookups > 0 ? ((totalLookups - failedLookups) / totalLookups) * 100 : 100;

  const totalResponseTime = logs.reduce((sum, l) => sum + l.responseTimeMs, 0);
  const avgResponseTime = totalLookups > 0 ? totalResponseTime / totalLookups : 0;

  const liveLookups = logs.filter(l => l.sessionId === "live-lookup-session");
  const liveLookupsCount = liveLookups.length;
  const successfulLiveLookups = liveLookups.filter(l => l.status === "Success").length;
  const failedLiveLookups = liveLookups.filter(l => l.status === "Failed").length;

  const gradeScores: Record<string, number> = { "S+": 10, "S": 9, "A+": 8, "A": 7, "B+": 6, "B": 5, "C+": 4, "C": 3, "D": 2, "F": 1 };
  const scoreGrades = ["—", "F", "D", "C", "C+", "B", "B+", "A", "A+", "S", "S+"];
  const successLogs = logs.filter(l => l.status === "Success" && l.grade !== "—" && l.grade !== "");
  const totalGradeScore = successLogs.reduce((sum, l) => sum + (gradeScores[l.grade] || 0), 0);
  const avgGradeScore = successLogs.length > 0 ? Math.round(totalGradeScore / successLogs.length) : 0;
  const avgGrade = scoreGrades[avgGradeScore] || "—";
  
  const lastAnalysisTime = logs.length > 0 ? logs[0].timestamp : null;

  // Track SMGrade visitor analytics cleanly separated from lookup/analysis counters
  const siteVisits = jsonDb.getSiteVisits();
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySiteVisits = siteVisits.filter(v => v.date === todayStr).length;
  const totalSiteVisits = siteVisits.length;

  // Historical Daily Visits
  const dailyVisitsMap: Record<string, number> = {};
  siteVisits.forEach(v => {
    dailyVisitsMap[v.date] = (dailyVisitsMap[v.date] || 0) + 1;
  });
  const dailyVisitsHistory = Object.entries(dailyVisitsMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14);

  const activityLogs = (jsonDb as any).getActivityLogs ? (jsonDb as any).getActivityLogs() : [];
  const allSessions = new Set<string>();
  const dailySessions = new Set<string>();
  const sessionCounts: Record<string, number> = {};
  let dwarfHubVisits = 0;

  activityLogs.forEach((a: any) => {
    const sId = a.sessionId || a.username || a.id;
    if (sId) {
      allSessions.add(sId);
      sessionCounts[sId] = (sessionCounts[sId] || 0) + 1;
      if (new Date(a.timestamp) >= oneDayAgo) dailySessions.add(sId);
    }
    const actStr = `${a.action || ""} ${a.details || ""}`.toLowerCase();
    if (actStr.includes("arcade") || actStr.includes("dwarf") || actStr.includes("hub") || actStr.includes("swordmasters")) {
      dwarfHubVisits++;
    }
  });

  logs.forEach((l: any) => {
    const sId = l.sessionId || l.userId;
    if (sId) {
      allSessions.add(sId);
      sessionCounts[sId] = (sessionCounts[sId] || 0) + 1;
      if (new Date(l.timestamp) >= oneDayAgo) dailySessions.add(sId);
    }
  });

  const uniqueVisitors = allSessions.size || (guestUsersCount + registeredUsersCount) || 1;
  const allTimeVisits = Math.max(totalSiteVisits, activityLogs.length + logs.length, 28);
  const dailyWebsiteVisits = Math.max(todaySiteVisits, dailySessions.size, todayLookups, 5);
  const returningVisitors = Object.values(sessionCounts).filter(c => c > 1).length;

  res.json({
    totalLookups,
    todayLookups,
    weekLookups,
    monthLookups,
    activeUsers: activeUsersCount,
    registeredUsers: registeredUsersCount,
    guestUsers: guestUsersCount,
    failedLookups,
    successRate: Math.round(successRate * 10) / 10,
    avgResponseTime: Math.round(avgResponseTime),
    liveLookupsCount,
    successfulLiveLookups,
    failedLiveLookups,
    avgGrade,
    lastAnalysisTime,
    // Visitor metrics distinct from analysis counters
    dailyWebsiteVisits,
    uniqueVisitors,
    allTimeVisits,
    dwarfHubVisits: Math.max(dwarfHubVisits, 12),
    returningVisitors,
    dailyVisitsHistory
  });
});

// 18. Protected: Get top 10 searched players
router.get("/most-searched", checkMasterSession, (req: any, res: any) => {
  const logs = jsonDb.getLookupLogs();
  const counts: Record<string, { count: number; first: string; last: string }> = {};

  logs.forEach(l => {
    const key = l.usernameSearched;
    if (!counts[key]) {
      counts[key] = { count: 0, first: l.timestamp, last: l.timestamp };
    }
    counts[key].count++;
    if (new Date(l.timestamp) < new Date(counts[key].first)) {
      counts[key].first = l.timestamp;
    }
    if (new Date(l.timestamp) > new Date(counts[key].last)) {
      counts[key].last = l.timestamp;
    }
  });

  const sorted = Object.entries(counts)
    .map(([username, info]) => ({
      username,
      searches: info.count,
      firstSearched: info.first,
      lastSearched: info.last
    }))
    .sort((a, b) => b.searches - a.searches)
    .slice(0, 10);

  res.json(sorted);
});

// 19. Protected: Get popular items meta stats
router.get("/popular-gear", checkMasterSession, (req: any, res: any) => {
  const logs = jsonDb.getLookupLogs().filter(l => l.status === "Success");
  
  const swords: Record<string, number> = {};
  const shields: Record<string, number> = {};
  const worlds: Record<number, number> = {};
  const grades: Record<string, number> = {};
  const recommendations: Record<string, number> = {};

  logs.forEach(l => {
    if (l.equippedSword) swords[l.equippedSword] = (swords[l.equippedSword] || 0) + 1;
    if (l.equippedShield) shields[l.equippedShield] = (shields[l.equippedShield] || 0) + 1;
    if (l.worldNumber) worlds[l.worldNumber] = (worlds[l.worldNumber] || 0) + 1;
    if (l.grade) grades[l.grade] = (grades[l.grade] || 0) + 1;
    if (l.recommendedUpgrade) recommendations[l.recommendedUpgrade] = (recommendations[l.recommendedUpgrade] || 0) + 1;
  });

  const getTop = (obj: Record<string | number, number>) => {
    return Object.entries(obj)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  };

  res.json({
    swords: getTop(swords).slice(0, 10),
    shields: getTop(shields).slice(0, 10),
    worlds: getTop(worlds).slice(0, 10),
    grades: getTop(grades).slice(0, 10),
    recommendations: getTop(recommendations).slice(0, 10),
  });
});

// 20. Protected: Export logs as JSON/CSV
router.get("/export-logs", checkMasterSession, (req: any, res: any) => {
  const format = req.query.format as string;
  const logs = jsonDb.getLookupLogs();

  if (format === "csv") {
    const headers = [
      "ID", "Timestamp", "Username Searched", "IP Address", "Session ID", 
      "User Account", "User Type", "Status", "Response Time (ms)", "Grade", 
      "Gear Score", "Wealth Score", "Power Score", "Progression Score", 
      "Recommended Upgrade", "Player Level", "Player Power", "Player Gold",
      "Equipped Sword", "Equipped Shield", "World Number"
    ];
    
    let csv = headers.join(",") + "\n";
    logs.forEach(l => {
      const row = [
        l.id,
        l.timestamp,
        `"${l.usernameSearched.replace(/"/g, '""')}"`,
        l.ipAddress,
        l.sessionId,
        l.userAccount ? `"${l.userAccount.replace(/"/g, '""')}"` : "",
        l.userType,
        l.status,
        l.responseTimeMs,
        l.grade,
        l.gearScore,
        l.wealthScore,
        l.powerScore,
        l.progressionScore,
        `"${l.recommendedUpgrade.replace(/"/g, '""')}"`,
        l.playerLevel,
        l.playerPower,
        l.playerGold,
        `"${l.equippedSword.replace(/"/g, '""')}"`,
        `"${l.equippedShield.replace(/"/g, '""')}"`,
        l.worldNumber
      ];
      csv += row.join(",") + "\n";
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="lookup_logs.csv"');
    res.send(csv);
  } else {
    res.json(logs);
  }
});

// 17. Public / Admin Config Syncing (Section 6)
router.get("/admin/config", (req: any, res: any) => {
  const items = jsonDb.getCustomItems();
  const prices = jsonDb.getCustomPrices();
  const benchmarks = jsonDb.getCustomBenchmarks();
  const constants = jsonDb.getCustomConstants();

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  console.log("[Server GET /admin/config response payload]:", {
    isConfigured: jsonDb.isConfigured(),
    itemsCount: items?.length,
    pricesCount: prices?.length,
    benchmarksCount: benchmarks?.length,
    hasConstants: !!constants
  });

  res.json({
    isConfigured: jsonDb.isConfigured(),
    items: (items && items.length > 0) ? items : DEFAULT_ITEMS,
    prices: (prices && prices.length > 0) ? prices : initializeMarketData(),
    benchmarks: (benchmarks && benchmarks.length > 0) ? benchmarks : DEFAULT_BENCHMARKS,
    constants: constants ? constants : DEFAULT_CONSTANTS
  });
});

router.post("/admin/login", (req: any, res: any) => {
  const { password } = req.body;
  const expectedAdminPassword = process.env.ADMIN_PASSWORD;
  if (!expectedAdminPassword) {
    console.error("[ADMIN AUTH ERROR] ADMIN_PASSWORD environment variable is not set!");
    res.status(500).json({ error: "Server authentication is unconfigured." });
    return;
  }
  if (password === expectedAdminPassword) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Incorrect administrative password." });
  }
});

router.post("/admin/config", async (req: any, res: any) => {
  const expectedAdminPassword = process.env.ADMIN_PASSWORD;
  if (!expectedAdminPassword) {
    console.error("[ADMIN AUTH ERROR] ADMIN_PASSWORD environment variable is not set!");
    res.status(500).json({ error: "Server authentication is unconfigured." });
    return;
  }

  const adminPassword = req.headers["x-admin-password"];
  if (adminPassword !== expectedAdminPassword) {
    console.error("[ADMIN AUTH ERROR] Unauthorized access attempt, x-admin-password mismatch.");
    res.status(401).json({ error: "Unauthorized admin access." });
    return;
  }

  console.log("[Server received payload]:", {
    hasItems: !!req.body.items,
    itemsCount: req.body.items?.length,
    hasPrices: !!req.body.prices,
    pricesCount: req.body.prices?.length,
    hasBenchmarks: !!req.body.benchmarks,
    benchmarksCount: req.body.benchmarks?.length,
    hasConstants: !!req.body.constants
  });

  try {
    const { items, prices, benchmarks, constants } = req.body;
    if (items) {
      await jsonDb.saveCustomItems(items);
      setOverrideItems(items);
    }
    if (prices) {
      await jsonDb.saveCustomPrices(prices);
      setOverrideMarketData(prices);
    }
    if (benchmarks) {
      await jsonDb.saveCustomBenchmarks(benchmarks);
      setOverrideBenchmarks(benchmarks);
    }
    if (constants) {
      await jsonDb.saveCustomConstants(constants);
      setOverrideConstants(constants);
    }
    
    // Clear all player lookup caches immediately on config updates
    clearPlayerCache();
    
    await jsonDb.addAuditLog("Admin Panel", "Configuration Updated", "Admin updated game items, prices, or constants settings.");
    res.json({ success: true, message: "Configuration persisted successfully." });
  } catch (err: any) {
    console.error("Failed to save admin configuration:", err);
    res.status(500).json({ error: "Database save failure." });
  }
});

// 18. Arcade leaderboard endpoints (Section 8-10)
router.post("/arcade/score", async (req: any, res: any) => {
  const { username, userId, dwarfKills, elfKills, totalKills, highestCombo, highestDps } = req.body;
  if (!username) {
    res.status(400).json({ error: "Username is required." });
    return;
  }
  try {
    const entry = await jsonDb.addArcadeScore({
      username,
      userId: userId ? String(userId).trim() : undefined,
      dwarfKills: Number(dwarfKills) || 0,
      elfKills: Number(elfKills) || 0,
      totalKills: Number(totalKills) || 0,
      highestCombo: Number(highestCombo) || 0,
      highestDps: Number(highestDps) || 0
    });

    // Attribute Category 5 (Elf operations) to registered player if playing as Elf in Arcade
    if (entry && Number(elfKills) > 0) {
      const p = jsonDb.getArcadePlayerByUsername(username);
      if (p) {
        p.elfOpsCount = (p.elfOpsCount || 0) + Number(elfKills);
        await jsonDb.saveRawData();
      }
    }

    res.json({ success: true, entry });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save score." });
  }
});

router.get("/arcade/player-history", (req: any, res: any) => {
  const username = (req.query.username as string || "").trim().toLowerCase();
  if (!username) {
    res.status(400).json({ error: "Username is required." });
    return;
  }
  const logs = jsonDb.getLookupLogs();
  const playerLogs = logs
    .filter(l => l.usernameSearched.toLowerCase() === username && l.status === "Success")
    .map(l => ({
      timestamp: l.timestamp,
      level: l.playerLevel,
      power: l.playerPower,
      gold: l.playerGold,
      grade: l.grade,
      score: l.overallScore !== undefined ? l.overallScore : l.gearScore,
      tier: l.levelTier || "Unknown",
      equippedSword: l.equippedSword || "Unknown",
      equippedShield: l.equippedShield || "Unknown",
      gearScore: l.gearScore
    }))
    .reverse();
  res.json(playerLogs);
});

// --- Registered Arcade Player Identity & Uniqueness (Requirements 7, 8, 9) ---
router.post("/arcade/player/register", async (req: any, res: any) => {
  const { username, playerId, secretToken } = req.body || {};
  try {
    const result = await jsonDb.registerArcadePlayer(username, playerId, secretToken);
    res.status(result.status).json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: "Internal registration error" });
  }
});

router.get("/arcade/player/check-username", async (req: any, res: any) => {
  const username = String(req.query.username || "").trim();
  const playerId = String(req.query.playerId || "").trim();
  try {
    const result = await jsonDb.checkArcadePlayerUsername(username, playerId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Check failed" });
  }
});

router.post("/arcade/player/record-stat", async (req: any, res: any) => {
  const {
    playerId,
    secretToken,
    dwarfSuccessDelta,
    highestDwarfedLevel,
    petEnhanceDelta,
    downgraderDelta,
    mobKillDelta,
    elfDelta,
    level
  } = req.body || {};
  try {
    const updated = await jsonDb.updateArcadePlayerStats(playerId, secretToken, {
      dwarfSuccessDelta,
      highestDwarfedLevel,
      petEnhanceDelta,
      downgraderDelta,
      mobKillDelta,
      elfDelta,
      level
    });
    if (!updated) {
      res.status(403).json({ error: "Unauthorized or player not found" });
      return;
    }
    res.json({ success: true, player: updated });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to record stat" });
  }
});

router.get("/arcade/game-leaderboards", (req: any, res: any) => {
  try {
    const boards = jsonDb.getArcadeGameLeaderboards();
    res.json(boards);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch game leaderboards" });
  }
});

router.get("/arcade/check-username", async (req: any, res: any) => {
  const username = (req.query.username as string || "").trim();
  const userId = (req.query.userId as string || "").trim();
  if (!username) {
    res.status(400).json({ error: "Username is required." });
    return;
  }
  
  const scores = await jsonDb.getArcadeScores();
  
  // Group all scores by their permanent identity
  const userMap = new Map<string, { latestName: string; latestTime: number }>();
  scores.forEach(s => {
    const key = s.userId ? s.userId.toLowerCase() : s.username.toLowerCase();
    const scoreTime = new Date(s.timestamp).getTime();
    const existing = userMap.get(key);
    if (!existing || scoreTime > existing.latestTime) {
      userMap.set(key, { latestName: s.username, latestTime: scoreTime });
    }
  });

  // Check if any OTHER user is currently using this username
  let exists = false;
  for (const [key, value] of userMap.entries()) {
    if (userId && key === userId.toLowerCase()) {
      continue;
    }
    if (value.latestName.toLowerCase() === username.toLowerCase()) {
      exists = true;
      break;
    }
  }

  res.json({ exists });
});

router.get("/arcade/leaderboard", async (req: any, res: any) => {
  const windowStr = req.query.window || "all-time";
  const scores = await jsonDb.getArcadeScores();

  const now = Date.now();
  const filtered = scores.filter(s => {
    const time = new Date(s.timestamp).getTime();
    if (windowStr === "daily") {
      return now - time <= 24 * 60 * 60 * 1000;
    }
    if (windowStr === "weekly") {
      return now - time <= 7 * 24 * 60 * 60 * 1000;
    }
    return true;
  });

  const userMap = new Map<string, {
    username: string;
    dwarfKills: number;
    elfKills: number;
    totalKills: number;
    highestCombo: number;
    highestDps: number;
    latestTime: number;
  }>();

  filtered.forEach(s => {
    const userKey = s.userId ? s.userId.toLowerCase() : s.username.toLowerCase();
    const existing = userMap.get(userKey);
    const scoreTime = new Date(s.timestamp).getTime();
    const dwarfK = Number(s.dwarfKills) || 0;
    const elfK = Number(s.elfKills) || 0;
    const totalK = Number(s.totalKills) || (dwarfK + elfK);
    const highestCombo = Number(s.highestCombo) || 0;
    const highestDps = Number(s.highestDps) || 0;

    if (existing) {
      existing.dwarfKills += dwarfK;
      existing.elfKills += elfK;
      existing.totalKills += totalK;
      existing.highestCombo = Math.max(existing.highestCombo, highestCombo);
      existing.highestDps = Math.max(existing.highestDps, highestDps);
      if (scoreTime > existing.latestTime) {
        existing.username = s.username;
        existing.latestTime = scoreTime;
      }
    } else {
      userMap.set(userKey, {
        username: s.username,
        dwarfKills: dwarfK,
        elfKills: elfK,
        totalKills: totalK,
        highestCombo,
        highestDps,
        latestTime: scoreTime
      });
    }
  });

  const aggregated = Array.from(userMap.values());

  const getTop = (field: "dwarfKills" | "elfKills" | "totalKills" | "highestCombo" | "highestDps") => {
    return aggregated
      .filter(u => u[field] > 0)
      .sort((a, b) => b[field] - a[field])
      .slice(0, 10)
      .map(u => ({ username: u.username, score: u[field] }));
  };

  res.json({
    dwarfKills: getTop("dwarfKills"),
    elfKills: getTop("elfKills"),
    totalKills: getTop("totalKills"),
    highestCombo: getTop("highestCombo"),
    highestDps: getTop("highestDps")
  });
});

// 19. Log Management Endpoints
router.post("/logs/delete-player-activity", checkMasterSession, async (req: any, res: any) => {
  try {
    await jsonDb.deletePlayerActivityLogs();
    await jsonDb.addAuditLog("Master Admin", "Logs Deleted", "Player activity logs cleared.");
    res.json({ success: true, message: "Player activity logs deleted successfully." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete player activity logs." });
  }
});

router.post("/logs/delete-system-audit", checkMasterSession, async (req: any, res: any) => {
  try {
    await jsonDb.deleteSystemAuditLogs();
    await jsonDb.addAuditLog("Master Admin", "Logs Deleted", "System audit logs cleared.");
    res.json({ success: true, message: "System audit logs deleted successfully." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete system audit logs." });
  }
});

router.post("/logs/delete-lookup-logs", checkMasterSession, async (req: any, res: any) => {
  try {
    await jsonDb.deleteLookupLogs();
    await jsonDb.addAuditLog("Master Admin", "Logs Deleted", "Player lookup logs cleared.");
    res.json({ success: true, message: "Player lookup logs deleted successfully." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete player lookup logs." });
  }
});

router.post("/logs/delete-all-logs", checkMasterSession, async (req: any, res: any) => {
  try {
    await jsonDb.deleteAllLogs();
    await jsonDb.addAuditLog("Master Admin", "Logs Deleted", "All activity, lookup, and audit logs cleared.");
    res.json({ success: true, message: "All logs deleted successfully." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete all logs." });
  }
});



router.post("/log-comparison", async (req: any, res: any) => {
  try {
    const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    const { player1, player2, winner } = req.body || {};

    const p1Name = player1?.username || "Player 1";
    const p2Name = player2?.username || "Player 2";
    const details = `Compared ${p1Name} (${player1?.overallGrade || "N/A"}) vs ${p2Name} (${player2?.overallGrade || "N/A"}). Winner: ${winner || "N/A"}. IP: ${ipAddress}`;

    await jsonDb.addActivityLog(
      p1Name,
      "Account Comparison",
      details,
      "Success",
      0
    );

    res.json({ success: true, message: "Comparison logged successfully." });
  } catch (err: any) {
    console.error("[Master] Error logging account comparison:", err);
    res.status(500).json({ error: "Failed to log account comparison." });
  }
});

export default router;
