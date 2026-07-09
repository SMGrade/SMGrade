import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import jsonDb from "../lib/jsonDb.js";
import { getSession } from "./auth.js";

const router = Router();

// Master Password (can be configured via env)
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || "harrison@smgrade.swordmasters2026";

// Store active master session tokens
const masterSessions = new Set<string>();

// Middleware to check Master session
function checkMasterSession(req: any, res: any, next: () => void) {
  const authHeader = req.headers["x-master-token"];
  if (!authHeader || !masterSessions.has(authHeader as string)) {
    res.status(401).json({ error: "Unauthorized Master Vault access." });
    return;
  }
  next();
}

// 1. Unlock Master Vault
router.post("/unlock", (req: any, res: any) => {
  const { password } = req.body;
  if (password === MASTER_PASSWORD) {
    const token = crypto.randomBytes(32).toString("hex");
    masterSessions.add(token);
    jsonDb.addAuditLog("System", "Master Vault Unlocked", "Access granted to Master settings terminal.");
    jsonDb.addActivityLog("Master Admin", "Admin Login", "Master Vault session unlocked.");
    res.json({ success: true, token });
  } else {
    jsonDb.addAuditLog("System", "Master Vault Attempt Failed", "Incorrect password attempt.");
    jsonDb.addActivityLog("System", "Admin Login Attempt Failed", "Incorrect password attempt on Master Vault.");
    res.status(400).json({ error: "Invalid master credentials." });
  }
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
router.post("/users/status", checkMasterSession, (req: any, res: any) => {
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
  jsonDb.updateUser(user);
  jsonDb.addAuditLog("Master Admin", "User Status Updated", `User ${user.username} status set to ${status}`);
  res.json({ success: true, message: `User status changed to ${status}` });
});

// 4. User Management: Change Role
router.post("/users/role", checkMasterSession, (req: any, res: any) => {
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
  jsonDb.updateUser(user);
  jsonDb.addAuditLog("Master Admin", "User Role Updated", `User ${user.username} role set to ${role}`);
  res.json({ success: true, message: `User role changed to ${role}` });
});

// 5. User Management: Reset password
router.post("/users/reset-password", checkMasterSession, (req: any, res: any) => {
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
  jsonDb.updateUser(user);
  jsonDb.addAuditLog("Master Admin", "Password Reset", `Password reset for user ${user.username}`);
  res.json({ success: true, message: "Password reset successfully." });
});

// 6. User Management: Change Username
router.post("/users/change-username", checkMasterSession, (req: any, res: any) => {
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
  jsonDb.updateUser(user);
  jsonDb.addAuditLog("Master Admin", "Username Changed", `Username for ${oldName} set to ${newUsername}`);
  res.json({ success: true, message: "Username updated successfully." });
});

// 7. User Management: Delete User
router.delete("/users", checkMasterSession, (req: any, res: any) => {
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

  jsonDb.deleteUser(userId);
  jsonDb.addAuditLog("Master Admin", "User Deleted", `User ${user.username} has been permanently deleted.`);
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
  const stats = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    totalUsers: jsonDb.getUsers().length,
    totalHistoryEntries: jsonDb.getRawData().history.length,
    totalLogs: jsonDb.getAuditLogs().length,
    nodeVersion: process.version,
    platform: process.platform,
  };
  res.json(stats);
});

// 11. Database Export / Backup
router.get("/backup", checkMasterSession, (req: any, res: any) => {
  const raw = jsonDb.getRawData();
  jsonDb.addAuditLog("Master Admin", "Database Backup", "Full database exported.");
  res.json(raw);
});

// 12. Database Import / Restore
router.post("/restore", checkMasterSession, (req: any, res: any) => {
  const { dbData } = req.body;
  if (!dbData || !Array.isArray(dbData.users) || !Array.isArray(dbData.history)) {
    res.status(400).json({ error: "Invalid backup database content." });
    return;
  }

  jsonDb.restoreRawData(dbData);
  jsonDb.addAuditLog("Master Admin", "Database Restored", "Full database restored from backup.");
  jsonDb.addActivityLog("Master Admin", "Database Restored", "Full database restored from backup.");
  res.json({ success: true, message: "Database restored successfully." });
});

// 13. Public: Asynchronously log player lookup analytics
router.post("/log-lookup", (req: any, res: any) => {
  // Execute logging asynchronously to avoid blocking the main server thread
  setImmediate(() => {
    try {
      const logData = req.body;
      const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
      
      const responseTimeMs = Number(logData.responseTimeMs) || 0;
      const gearScore = Number(logData.gearScore) || 0;
      const wealthScore = Number(logData.wealthScore) || 0;
      const powerScore = Number(logData.powerScore) || 0;
      const progressionScore = Number(logData.progressionScore) || 0;
      const playerLevel = Number(logData.playerLevel) || 0;
      const playerPower = Number(logData.playerPower) || 0;
      const playerGold = Number(logData.playerGold) || 0;
      const worldNumber = Number(logData.worldNumber) || 1;

      jsonDb.addLookupLog({
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
        recommendedUpgrade: logData.recommendedUpgrade || "None",
        playerLevel,
        playerPower,
        playerGold,
        equippedSword: logData.equippedSword || "Unknown",
        equippedShield: logData.equippedShield || "Unknown",
        worldNumber
      });
    } catch (err) {
      console.error("Error logging player lookup:", err);
    }
  });
  res.json({ success: true });
});

// 14. Public: Log administrative/user activity
router.post("/log-activity", (req: any, res: any) => {
  const { username, action, details } = req.body;
  const session = getSession(req);
  const actor = session ? session.username : (username || "Guest");
  
  jsonDb.addActivityLog(actor, action, details);
  res.json({ success: true });
});

// 15. Protected: Get player lookup logs with query filters
router.get("/lookup-logs", checkMasterSession, (req: any, res: any) => {
  const { username, date, grade, world, user, status } = req.query;
  let logs = jsonDb.getLookupLogs();

  if (username) {
    const q = (username as string).toLowerCase();
    logs = logs.filter(l => l.usernameSearched.toLowerCase().includes(q));
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
    const uq = (user as string).toLowerCase();
    logs = logs.filter(l => l.userAccount && l.userAccount.toLowerCase().includes(uq));
  }
  if (date) {
    const dStr = date as string;
    logs = logs.filter(l => l.timestamp.startsWith(dStr));
  }

  res.json(logs);
});

// 16. Protected: Get user activity logs
router.get("/activity-logs", checkMasterSession, (req: any, res: any) => {
  res.json(jsonDb.getActivityLogs());
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

export default router;
