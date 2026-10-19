import fs from "fs";
import path from "path";
import crypto from "crypto";
import pg from "pg";
const { Pool } = pg;

const isVercel = process.env.VERCEL === "1" || !!process.env.VERCEL;
const READ_ONLY_DB_FILE = fs.existsSync(path.join(process.cwd(), "data", "db.json"))
  ? path.join(process.cwd(), "data", "db.json")
  : path.join(process.cwd(), "db_storage.json");
const DB_FILE = isVercel 
  ? path.join("/tmp", "db_storage.json") 
  : READ_ONLY_DB_FILE;

// Copy existing database to /tmp on Vercel if needed
if (isVercel && !fs.existsSync(DB_FILE)) {
  try {
    if (fs.existsSync(READ_ONLY_DB_FILE)) {
      fs.copyFileSync(READ_ONLY_DB_FILE, DB_FILE);
    }
  } catch (err) {
    console.error("Failed to copy db_storage.json to /tmp on Vercel:", err);
  }
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: "owner" | "admin" | "moderator" | "viewer";
  status: "active" | "suspended";
  profilePic: string;
  highestGrade: string;
  totalAnalyses: number;
  favoriteWeapon: string;
  favoriteShield: string;
  favoritePet: string;
  lastLogin: string;
  createdAt: string;
  notes: string;
}

export interface ProgressHistory {
  id: string;
  userId: string;
  date: string;
  level: number;
  grade: string;
  score: number;
  power: string;
  dps: number;
}

export interface Achievement {
  id: string;
  userId: string;
  badgeCode: string;
  unlockedAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
}

export interface LoginHistory {
  id: string;
  userId: string;
  username: string;
  timestamp: string;
  ip: string;
  userAgent: string;
}

export interface LookupLog {
  id: string;
  timestamp: string;
  usernameSearched: string;
  ipAddress: string;
  sessionId: string;
  userAccount: string | null;
  userType: "Guest" | "Registered";
  status: "Success" | "Failed";
  responseTimeMs: number;
  grade: string;
  gearScore: number;
  wealthScore: number;
  powerScore: number;
  progressionScore: number;
  overallScore?: number;
  levelTier?: string;
  recommendedUpgrade: string;
  playerLevel: number;
  playerPower: number;
  playerGold: number;
  equippedSword: string;
  equippedShield: string;
  worldNumber: number;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  username: string;
  action: string;
  details: string;
  ipAddress?: string;
  status?: string;
  responseTimeMs?: number;
}

export interface KillEvent {
  timestamp: string;
  previousKills: number;
  newKills: number;
  delta: number;
}

export interface ArcadeScore {
  id: string;
  username: string;
  userId?: string;
  previousUsernames?: string[];
  dwarfKills: number;
  elfKills: number;
  totalKills: number;
  highestCombo: number;
  highestDps: number;
  timestamp: string;
  firstSeen?: string;
  lastSeen?: string;
  killEvents?: KillEvent[];
}

export interface DbSchema {
  users: User[];
  history: ProgressHistory[];
  achievements: Achievement[];
  auditLogs: AuditLog[];
  loginHistory: LoginHistory[];
  settings: {
    maintenanceMode: boolean;
    registrationOpen: boolean;
    goldExchangeRate: number;
  };
  lookupLogs: LookupLog[];
  activityLogs: ActivityLog[];
  arcadeScores?: ArcadeScore[];
  customItems?: any[];
  customPrices?: any[];
  customBenchmarks?: any[];
  customConstants?: any;
  masterSessions?: string[];
  masterLockouts?: Record<string, { attempts: number; lastAttempt: number; lockoutUntil: number }>;
}

const DEFAULT_DB: DbSchema = {
  users: [],
  history: [],
  achievements: [],
  auditLogs: [],
  loginHistory: [],
  settings: {
    maintenanceMode: false,
    registrationOpen: true,
    goldExchangeRate: 1.0,
  },
  lookupLogs: [],
  activityLogs: [],
  arcadeScores: [],
  customItems: [],
  customPrices: [],
  customBenchmarks: [],
  customConstants: null,
  masterSessions: [],
};

export class JsonDatabase {
  private data: DbSchema;
  private pool: any = null;
  private tableCreated = false;
  private dbDisabled = false;
  private consecutiveFailures = 0;
  private queue: Promise<any> = Promise.resolve();
  private cacheUpdatedAt: Date | null = null;

  constructor() {
    this.data = this.loadFromFile();
    if (process.env.DATABASE_URL) {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
        },
        max: 3,
        idleTimeoutMillis: 15000,
        connectionTimeoutMillis: 15000,
        statement_timeout: 15000,
        query_timeout: 15000,
        allowExitOnIdle: true
      });
    }
  }

  private async executeAtomic<T>(fn: () => Promise<T> | T): Promise<T> {
    const next = this.queue.then(async () => {
      await this.syncFromDb();
      return fn();
    });
    this.queue = next.catch(() => {});
    return next;
  }

  private loadFromFile(): DbSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf8");
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error("Error reading database file, resetting to default:", err);
    }
    return DEFAULT_DB;
  }

  private saveToFile(data: DbSchema) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
      console.error("Error writing database file:", err);
    }
  }

  public async init(): Promise<void> {
    if (!this.pool || this.dbDisabled) {
      return;
    }
    if (!this.tableCreated) {
      try {
        await Promise.race([
          this.pool.query(`
            CREATE TABLE IF NOT EXISTS master_vault_state (
              id INT PRIMARY KEY,
              state TEXT NOT NULL,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS arcade_scores (
              id UUID PRIMARY KEY,
              username VARCHAR(255) NOT NULL,
              user_id VARCHAR(255),
              dwarf_kills INT NOT NULL DEFAULT 0,
              elf_kills INT NOT NULL DEFAULT 0,
              total_kills INT NOT NULL DEFAULT 0,
              highest_combo INT NOT NULL DEFAULT 0,
              highest_dps INT NOT NULL DEFAULT 0,
              timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
          `),
          new Promise((_, reject) => setTimeout(() => reject(new Error("DB init timeout")), 15000))
        ]);
        this.tableCreated = true;
        this.consecutiveFailures = 0; // Reset consecutive failures on success
      } catch (err) {
        this.consecutiveFailures++;
        console.warn(`[SMGrade DB] Failed to create master_vault_state table (Attempt ${this.consecutiveFailures}):`, err);
        if (this.consecutiveFailures >= 3) {
          console.warn("[SMGrade DB] Too many consecutive connection failures. Using local cache fallback.");
        }
        return;
      }
    }
    await this.syncFromDb();
  }

  private async syncFromDb(): Promise<void> {
    if (!this.pool || this.dbDisabled) {
      return;
    }
    try {
      // 1. Get the updated_at timestamp from the DB
      const timeRes: any = await Promise.race([
        this.pool.query("SELECT updated_at FROM master_vault_state WHERE id = 1"),
        new Promise((_, reject) => setTimeout(() => reject(new Error("DB timestamp query timeout")), 15000))
      ]);

      if (timeRes && timeRes.rows && timeRes.rows.length > 0) {
        const dbUpdatedAt = new Date(timeRes.rows[0].updated_at);
        
        // 2. If cache is fresh, return immediately without downloading state
        if (this.cacheUpdatedAt && dbUpdatedAt.getTime() <= this.cacheUpdatedAt.getTime()) {
          return;
        }

        // 3. Cache is stale or missing, download the full state
        const res: any = await Promise.race([
          this.pool.query("SELECT state, updated_at FROM master_vault_state WHERE id = 1"),
          new Promise((_, reject) => setTimeout(() => reject(new Error("DB sync timeout")), 15000))
        ]);

        if (res && res.rows && res.rows.length > 0) {
          this.data = JSON.parse(res.rows[0].state);
          this.cacheUpdatedAt = new Date(res.rows[0].updated_at);
          this.saveToFile(this.data);
        }
      } else if (timeRes && timeRes.rows) {
        // No row exists yet, insert default state
        const stateStr = JSON.stringify(this.data);
        const insertRes: any = await Promise.race([
          this.pool.query(
            "INSERT INTO master_vault_state (id, state, updated_at) VALUES (1, $1, CURRENT_TIMESTAMP) ON CONFLICT (id) DO NOTHING RETURNING updated_at",
            [stateStr]
          ),
          new Promise((_, reject) => setTimeout(() => reject(new Error("DB insert timeout")), 15000))
        ]);
        if (insertRes && insertRes.rows && insertRes.rows.length > 0) {
          this.cacheUpdatedAt = new Date(insertRes.rows[0].updated_at);
        }
      }
      this.consecutiveFailures = 0; // Reset consecutive failures on success
    } catch (err) {
      this.consecutiveFailures++;
      console.warn(`[SMGrade DB] Failed to synchronize state from database (Attempt ${this.consecutiveFailures}):`, err);
      if (this.consecutiveFailures >= 3) {
        console.warn("[SMGrade DB] Too many consecutive sync failures. Using local cache fallback.");
      }
    }
  }

  private async save(data: DbSchema): Promise<void> {
    this.data = data;
    this.saveToFile(data);

    if (this.pool && !this.dbDisabled) {
      const dataToSave = { ...data };
      const stateStr = JSON.stringify(dataToSave);

      try {
        console.log("[PostgreSQL UPDATE/INSERT query started] size of state:", stateStr.length);
        const queryRes: any = await Promise.race([
          this.pool.query(
            `INSERT INTO master_vault_state (id, state, updated_at) 
             VALUES (1, $1, CURRENT_TIMESTAMP) 
             ON CONFLICT (id) 
             DO UPDATE SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at
             RETURNING id, updated_at`,
            [stateStr]
          ),
          new Promise((_, reject) => setTimeout(() => reject(new Error("DB save timeout")), 15000))
        ]);
        
        console.log("[PostgreSQL UPDATE/INSERT result]:", queryRes?.rows?.[0]);
        this.consecutiveFailures = 0; // Reset consecutive failures on success

        // Removed redundant SELECT verification query to save data transfer bandwidth
      } catch (err: any) {
        this.consecutiveFailures++;
        console.warn(`[SMGrade DB] Save to database failed (Attempt ${this.consecutiveFailures}):`, err);
        if (this.consecutiveFailures >= 3) {
          console.warn("[SMGrade DB] Too many consecutive save failures. Using local memory backup.");
        }
        throw err;
      }
    }
  }

  public getRawData(): DbSchema {
    return this.data;
  }

  public async restoreRawData(newData: DbSchema): Promise<void> {
    await this.executeAtomic(async () => {
      this.data = {
        users: newData.users || [],
        history: newData.history || [],
        achievements: newData.achievements || [],
        auditLogs: newData.auditLogs || [],
        loginHistory: newData.loginHistory || [],
        settings: newData.settings || DEFAULT_DB.settings,
        lookupLogs: (newData as any).lookupLogs || [],
        activityLogs: (newData as any).activityLogs || [],
        arcadeScores: (newData as any).arcadeScores || [],
        customItems: (newData as any).customItems || [],
        customPrices: (newData as any).customPrices || [],
        customBenchmarks: (newData as any).customBenchmarks || [],
        customConstants: (newData as any).customConstants || null,
      };
      await this.save(this.data);
    });
  }

  public hashPassword(password: string): string {
    return crypto.createHash("sha256").update(password + "smgrade_secret_salt").digest("hex");
  }

  // Users
  public getUsers(): User[] {
    return this.data.users;
  }

  public getUserById(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public getUserByUsername(username: string): User | undefined {
    return this.data.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  }

  public async createUser(username: string, passwordHash: string, role: "owner" | "admin" | "moderator" | "viewer"): Promise<User> {
    return this.executeAtomic(async () => {
      const newUser: User = {
        id: crypto.randomUUID(),
        username,
        passwordHash,
        role,
        status: "active",
        profilePic: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`,
        highestGrade: "—",
        totalAnalyses: 0,
        favoriteWeapon: "—",
        favoriteShield: "—",
        favoritePet: "—",
        lastLogin: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        notes: "",
      };
      this.data.users.push(newUser);
      await this.save(this.data);
      return newUser;
    });
  }

  public async updateUser(user: User): Promise<void> {
    await this.executeAtomic(async () => {
      const idx = this.data.users.findIndex((u) => u.id === user.id);
      if (idx !== -1) {
        this.data.users[idx] = user;
        await this.save(this.data);
      }
    });
  }

  public async deleteUser(userId: string): Promise<void> {
    await this.executeAtomic(async () => {
      const user = this.getUserById(userId);
      this.data.users = this.data.users.filter((u) => u.id !== userId);
      this.data.history = this.data.history.filter((h) => h.userId !== userId);
      this.data.achievements = this.data.achievements.filter((a) => a.userId !== userId);
      this.data.loginHistory = this.data.loginHistory.filter((lh) => lh.userId !== userId);
      await this.save(this.data);
    });
  }

  // History
  public getHistoryByUserId(userId: string): ProgressHistory[] {
    return this.data.history.filter((h) => h.userId === userId);
  }

  public async addHistory(userId: string, level: number, grade: string, score: number, power: string, dps: number): Promise<ProgressHistory> {
    return this.executeAtomic(async () => {
      const entry: ProgressHistory = {
        id: crypto.randomUUID(),
        userId,
        date: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
        level,
        grade,
        score,
        power,
        dps,
      };
      this.data.history.push(entry);

      // Update user aggregates in memory
      const user = this.getUserById(userId);
      if (user) {
        user.totalAnalyses += 1;
        
        const gradesOrder = ["F", "D", "C", "C+", "B", "B+", "A", "A+", "S", "S+"];
        const currentHighestIdx = gradesOrder.indexOf(user.highestGrade);
        const newGradeIdx = gradesOrder.indexOf(grade);
        if (newGradeIdx > currentHighestIdx) {
          user.highestGrade = grade;
        }

        await this.checkAchievementsForUser(userId, user, grade);
      }

      await this.save(this.data);
      return entry;
    });
  }

  // Achievements
  public getAchievementsByUserId(userId: string): Achievement[] {
    return this.data.achievements.filter((a) => a.userId === userId);
  }

  private async checkAchievementsForUser(userId: string, user: User, latestGrade: string): Promise<void> {
    const userAchievements = this.getAchievementsByUserId(userId);
    const existingCodes = new Set(userAchievements.map((a) => a.badgeCode));

    const unlock = (code: string) => {
      if (!existingCodes.has(code)) {
        this.data.achievements.push({
          id: crypto.randomUUID(),
          userId,
          badgeCode: code,
          unlockedAt: new Date().toISOString(),
        });
      }
    };

    unlock("first_analysis");

    if (user.totalAnalyses >= 100) {
      unlock("analyses_100");
    }

    if (["A", "A+", "S", "S+"].includes(latestGrade)) {
      unlock("legendary_grade");
    }

    if (latestGrade === "S+") {
      unlock("mythic_grade");
    }

    if (user.totalAnalyses >= 5) {
      unlock("weapon_expert");
    }
    if (user.totalAnalyses >= 10) {
      unlock("shield_collector");
    }
  }

  // Audit Logs
  public getAuditLogs(): AuditLog[] {
    return this.data.auditLogs;
  }

  public async addAuditLog(actor: string, action: string, details: string): Promise<void> {
    await this.executeAtomic(async () => {
      this.data.auditLogs.unshift({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        actor,
        action,
        details,
      });
      if (this.data.auditLogs.length > 500) {
        this.data.auditLogs = this.data.auditLogs.slice(0, 500);
      }
      await this.save(this.data);
    });
  }

  // Login History
  public getLoginHistory(): LoginHistory[] {
    return this.data.loginHistory;
  }

  public async addLoginHistory(userId: string, username: string, ip: string, userAgent: string): Promise<void> {
    await this.executeAtomic(async () => {
      this.data.loginHistory.unshift({
        id: crypto.randomUUID(),
        userId,
        username,
        timestamp: new Date().toISOString(),
        ip,
        userAgent,
      });
      if (this.data.loginHistory.length > 200) {
        this.data.loginHistory = this.data.loginHistory.slice(0, 200);
      }
      await this.save(this.data);
    });
  }

  // Lookup Logs
  public getLookupLogs(): LookupLog[] {
    return this.data.lookupLogs || [];
  }

  public async addLookupLog(log: Omit<LookupLog, "id" | "timestamp">): Promise<LookupLog> {
    return this.executeAtomic(async () => {
      const entry: LookupLog = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        ...log
      };
      if (!this.data.lookupLogs) {
        this.data.lookupLogs = [];
      }
      this.data.lookupLogs.unshift(entry);
      if (this.data.lookupLogs.length > 5000) {
        this.data.lookupLogs = this.data.lookupLogs.slice(0, 5000);
      }
      await this.save(this.data);
      return entry;
    });
  }

  // Activity Logs
  public getActivityLogs(): ActivityLog[] {
    return this.data.activityLogs || [];
  }

  public async addActivityLog(username: string, action: string, details: string, status?: string, responseTimeMs?: number): Promise<ActivityLog> {
    return this.executeAtomic(async () => {
      const entry: ActivityLog = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        username,
        action,
        details,
        status,
        responseTimeMs
      };
      if (!this.data.activityLogs) {
        this.data.activityLogs = [];
      }
      this.data.activityLogs.unshift(entry);
      if (this.data.activityLogs.length > 2000) {
        this.data.activityLogs = this.data.activityLogs.slice(0, 2000);
      }
      await this.save(this.data);
      return entry;
    });
  }

  public async deletePlayerActivityLogs(): Promise<void> {
    await this.executeAtomic(async () => {
      this.data.activityLogs = [];
      await this.save(this.data);
    });
  }

  public async deleteSystemAuditLogs(): Promise<void> {
    await this.executeAtomic(async () => {
      this.data.auditLogs = [];
      await this.save(this.data);
    });
  }

  public async deleteLookupLogs(): Promise<void> {
    await this.executeAtomic(async () => {
      this.data.lookupLogs = [];
      await this.save(this.data);
    });
  }

  public async deleteAllLogs(): Promise<void> {
    await this.executeAtomic(async () => {
      this.data.activityLogs = [];
      this.data.auditLogs = [];
      this.data.lookupLogs = [];
      await this.save(this.data);
    });
  }

  // Arcade leaderboards
  public async getArcadeScores(): Promise<ArcadeScore[]> {
    if (this.pool && !this.dbDisabled) {
      try {
        const res = await Promise.race([
          this.pool.query('SELECT id, username, user_id as "userId", dwarf_kills as "dwarfKills", elf_kills as "elfKills", total_kills as "totalKills", highest_combo as "highestCombo", highest_dps as "highestDps", timestamp FROM arcade_scores'),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Arcade scores query timeout")), 5000))
        ]);
        if (res.rows && res.rows.length > 0) return res.rows;
      } catch (err) {
        console.warn("[SMGrade DB] Failed to fetch arcade scores from database, falling back to local file:", err);
      }
    }
    if (!this.data.arcadeScores || this.data.arcadeScores.length === 0) {
      const arcadeFile = path.join(process.cwd(), "data", "arcade_scores.json");
      if (fs.existsSync(arcadeFile)) {
        try {
          this.data.arcadeScores = JSON.parse(fs.readFileSync(arcadeFile, "utf8"));
        } catch (e) {}
      }
    }
    return this.data.arcadeScores || [];
  }

  public async addArcadeScore(score: Omit<ArcadeScore, "id" | "timestamp">): Promise<ArcadeScore> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const targetUserId = score.userId ? score.userId.trim() : null;
    const targetUsername = score.username.trim();
    const dwarfKills = Number(score.dwarfKills) || 0;
    const elfKills = Number(score.elfKills) || 0;
    const totalKills = Number(score.totalKills) || (dwarfKills + elfKills);
    const highestCombo = Number(score.highestCombo) || 0;
    const highestDps = Number(score.highestDps) || 0;

    const entry: ArcadeScore = {
      id,
      timestamp: now,
      username: targetUsername,
      userId: targetUserId || undefined,
      dwarfKills,
      elfKills,
      totalKills,
      highestCombo,
      highestDps
    };

    // 1. Persist directly to authoritative PostgreSQL arcade_scores table
    if (this.pool && !this.dbDisabled) {
      try {
        await Promise.race([
          this.pool.query(
            `INSERT INTO arcade_scores (id, username, user_id, dwarf_kills, elf_kills, total_kills, highest_combo, highest_dps, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              id,
              targetUsername,
              targetUserId,
              dwarfKills,
              elfKills,
              totalKills,
              highestCombo,
              highestDps,
              now
            ]
          ),
          new Promise((_, reject) => setTimeout(() => reject(new Error("DB insert timeout")), 10000))
        ]);
        console.log(`[SMGrade DB] Inserted arcade score event into arcade_scores table for ${targetUsername} (${id})`);
      } catch (err) {
        console.warn("[SMGrade DB] Failed to insert arcade score into database:", err);
      }
    }

    // 2. Keep in-memory cache and local file updated for offline fallback
    if (!this.data.arcadeScores) {
      this.data.arcadeScores = [];
    }
    this.data.arcadeScores.push(entry);

    if (!this.pool || this.dbDisabled) {
      try {
        const arcadeDir = path.join(process.cwd(), "data");
        const arcadeFile = path.join(arcadeDir, "arcade_scores.json");
        if (!fs.existsSync(arcadeDir)) {
          fs.mkdirSync(arcadeDir, { recursive: true });
        }
        fs.writeFileSync(arcadeFile, JSON.stringify(this.data.arcadeScores, null, 2), "utf8");
      } catch (e) {
        console.warn("[SMGrade DB] Failed to write local arcade scores cache:", e);
      }
    }

    return entry;
  }

  // Custom configurations (Admin Syncing)
  public getCustomItems(): any[] | undefined {
    return this.data.customItems;
  }

  public async saveCustomItems(items: any[]): Promise<void> {
    await this.executeAtomic(async () => {
      this.data.customItems = items;
      await this.save(this.data);
    });
  }

  public getCustomPrices(): any[] | undefined {
    return this.data.customPrices;
  }

  public async saveCustomPrices(prices: any[]): Promise<void> {
    await this.executeAtomic(async () => {
      this.data.customPrices = prices;
      await this.save(this.data);
    });
  }

  public getCustomBenchmarks(): any[] | undefined {
    if (this.data.customBenchmarks && this.data.customBenchmarks.length !== 19) {
      return undefined;
    }
    return this.data.customBenchmarks;
  }

  public async saveCustomBenchmarks(benchmarks: any[]): Promise<void> {
    await this.executeAtomic(async () => {
      this.data.customBenchmarks = benchmarks;
      await this.save(this.data);
    });
  }

  public getCustomConstants(): any | undefined {
    return this.data.customConstants;
  }

  public isConfigured(): boolean {
    return this.data.customConstants !== undefined && this.data.customConstants !== null;
  }

  public async saveCustomConstants(constants: any): Promise<void> {
    await this.executeAtomic(async () => {
      this.data.customConstants = constants;
      await this.save(this.data);
    });
  }

  public async addMasterSession(token: string): Promise<void> {
    await this.executeAtomic(async () => {
      if (!this.data.masterSessions) {
        this.data.masterSessions = [];
      }
      if (!this.data.masterSessions.includes(token)) {
        this.data.masterSessions.push(token);
      }
      await this.save(this.data);
    });
  }

  public hasMasterSession(token: string): boolean {
    return this.data.masterSessions?.includes(token) || false;
  }

  public async removeMasterSession(token: string): Promise<void> {
    await this.executeAtomic(async () => {
      if (this.data.masterSessions) {
        this.data.masterSessions = this.data.masterSessions.filter(t => t !== token);
      }
      await this.save(this.data);
    });
  }

  public recordFailedUnlockAttempt(ipAddress: string): { attempts: number; lockoutUntil: number } {
    if (!this.data.masterLockouts) this.data.masterLockouts = {};
    const now = Date.now();
    const entry = this.data.masterLockouts[ipAddress] || { attempts: 0, lastAttempt: now, lockoutUntil: 0 };
    
    if (now - entry.lastAttempt > 10 * 60 * 1000) {
      entry.attempts = 0;
    }
    entry.attempts += 1;
    entry.lastAttempt = now;
    if (entry.attempts >= 5) {
      entry.lockoutUntil = now + 15 * 60 * 1000;
    }
    this.data.masterLockouts[ipAddress] = entry;
    this.save(this.data);
    return entry;
  }

  public checkUnlockLockout(ipAddress: string): { isLocked: boolean; remainingSec: number } {
    if (!this.data.masterLockouts) return { isLocked: false, remainingSec: 0 };
    const entry = this.data.masterLockouts[ipAddress];
    if (!entry) return { isLocked: false, remainingSec: 0 };
    const now = Date.now();
    if (entry.lockoutUntil > now) {
      return { isLocked: true, remainingSec: Math.ceil((entry.lockoutUntil - now) / 1000) };
    }
    return { isLocked: false, remainingSec: 0 };
  }

  public resetFailedUnlockAttempt(ipAddress: string): void {
    if (this.data.masterLockouts && this.data.masterLockouts[ipAddress]) {
      delete this.data.masterLockouts[ipAddress];
      this.save(this.data);
    }
  }
}

export const jsonDb = new JsonDatabase();
export default jsonDb;
