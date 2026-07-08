import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import jsonDb from "../lib/jsonDb";

const router = Router();

// In-memory sessions store
export const activeSessions = new Map<string, { userId: string; role: string; username: string }>();

// Helper to authenticate user from auth header
export function getSession(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];
  return activeSessions.get(token) || null;
}

// 1. Create Account
router.post("/register", (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password || username.trim().length < 3 || password.trim().length < 6) {
    res.status(400).json({ error: "Username (min 3 chars) and Password (min 6 chars) are required." });
    return;
  }

  const existing = jsonDb.getUserByUsername(username);
  if (existing) {
    res.status(400).json({ error: "Username already exists." });
    return;
  }

  const hash = jsonDb.hashPassword(password);
  const totalUsers = jsonDb.getUsers().length;
  // First user is owner, subsequent users are viewers
  const role = totalUsers === 0 ? "owner" : "viewer";

  const user = jsonDb.createUser(username.trim(), hash, role);
  jsonDb.addAuditLog("System", "User Registered", `New user ${username} created with role ${role}`);
  jsonDb.addActivityLog("System", "Registration", `New user ${username} created with role ${role}`);

  res.status(201).json({ success: true, message: "Account created successfully." });
});

// 2. Log In
router.post("/login", (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Username and Password are required." });
    return;
  }

  const user = jsonDb.getUserByUsername(username);
  if (!user) {
    res.status(400).json({ error: "Invalid username or password." });
    return;
  }

  if (user.status === "suspended") {
    res.status(403).json({ error: "This account has been suspended by a moderator." });
    return;
  }

  const hash = jsonDb.hashPassword(password);
  if (user.passwordHash !== hash) {
    res.status(400).json({ error: "Invalid username or password." });
    return;
  }

  // Generate session token
  const token = crypto.randomBytes(32).toString("hex");
  activeSessions.set(token, { userId: user.id, role: user.role, username: user.username });

  // Update last login
  user.lastLogin = new Date().toISOString();
  jsonDb.updateUser(user);

  // Add login log
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
  const userAgent = req.headers["user-agent"] || "Unknown";
  jsonDb.addLoginHistory(user.id, user.username, ip, userAgent);
  jsonDb.addAuditLog(user.username, "User Logged In", `Logged in from IP: ${ip}`);
  jsonDb.addActivityLog(user.username, "Login", `Logged in from IP: ${ip}`);

  res.json({
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
});

// 3. Get Current Profile (Me)
router.get("/me", (req: Request, res: Response) => {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = jsonDb.getUserById(session.userId);
  if (!user || user.status === "suspended") {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  res.json({
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
});

// 4. Save User Custom Profile Details (notes, favorites)
router.post("/profile", (req: Request, res: Response) => {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = jsonDb.getUserById(session.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { favoriteWeapon, favoriteShield, favoritePet, notes } = req.body;
  if (favoriteWeapon !== undefined) user.favoriteWeapon = favoriteWeapon;
  if (favoriteShield !== undefined) user.favoriteShield = favoriteShield;
  if (favoritePet !== undefined) user.favoritePet = favoritePet;
  if (notes !== undefined) user.notes = notes;

  jsonDb.updateUser(user);
  jsonDb.addActivityLog(user.username, "Profile Update", `Updated profile fields: ${Object.keys(req.body).filter(k => req.body[k] !== undefined).join(", ")}`);
  res.json({ success: true, message: "Profile updated successfully." });
});

// 5. Get Progression History
router.get("/history", (req: Request, res: Response) => {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const list = jsonDb.getHistoryByUserId(session.userId);
  res.json(list);
});

// 6. Save Grading Result in History
router.post("/history", (req: Request, res: Response) => {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { level, grade, score, power, dps } = req.body;
  if (!grade || score === undefined || level === undefined) {
    res.status(400).json({ error: "Invalid stats content." });
    return;
  }

  const entry = jsonDb.addHistory(session.userId, level, grade, score, power || "—", dps || 0);
  res.json({ success: true, entry });
});

// 7. Get Achievements
router.get("/achievements", (req: Request, res: Response) => {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const list = jsonDb.getAchievementsByUserId(session.userId);
  res.json(list);
});

export default router;
