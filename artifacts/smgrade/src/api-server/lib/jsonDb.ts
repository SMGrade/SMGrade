import fs from "fs";
import path from "path";
import crypto from "crypto";
import pg from "pg";
const { Pool } = pg;

const isVercel = process.env.VERCEL === "1" || !!process.env.VERCEL;
const READ_ONLY_DB_FILE = path.join(process.cwd(), "db_storage.json");
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
  status?: string;
  responseTimeMs?: number;
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
};

export class JsonDatabase {
  private data: DbSchema;
  private pool: any = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.data = this.loadFromFile();
    if (process.env.DATABASE_URL) {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
        }
      });
    }
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
    if (!this.pool) {
      return;
    }
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS master_vault_state (
            id INT PRIMARY KEY,
            state TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        const res = await this.pool.query("SELECT state FROM master_vault_state WHERE id = 1");
        if (res.rows.length > 0) {
          this.data = JSON.parse(res.rows[0].state);
          console.log("[SMGrade DB] Successfully loaded state from database");
        } else {
          const stateStr = JSON.stringify(this.data);
          await this.pool.query(
            "INSERT INTO master_vault_state (id, state) VALUES (1, $1) ON CONFLICT (id) DO NOTHING",
            [stateStr]
          );
          console.log("[SMGrade DB] Initialized database state row");
        }
      } catch (err) {
        console.error("[SMGrade DB] Failed to initialize database state:", err);
      }
    })();

    return this.initPromise;
  }

  private save(data: DbSchema) {
    this.data = data;
    this.saveToFile(data);

    if (this.pool) {
      const stateStr = JSON.stringify(data);
      this.pool.query(
        `INSERT INTO master_vault_state (id, state, updated_at) 
         VALUES (1, $1, CURRENT_TIMESTAMP) 
         ON CONFLICT (id) 
         DO UPDATE SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at`,
        [stateStr]
      ).catch((err: any) => {
        console.error("[SMGrade DB] Async save to database failed:", err);
      });
    }
  }

  public getRawData(): DbSchema {
    return this.data;
  }

  public restoreRawData(newData: DbSchema) {
    this.data = {
      users: newData.users || [],
      history: newData.history || [],
      achievements: newData.achievements || [],
      auditLogs: newData.auditLogs || [],
      loginHistory: newData.loginHistory || [],
      settings: newData.settings || DEFAULT_DB.settings,
      lookupLogs: (newData as any).lookupLogs || [],
      activityLogs: (newData as any).activityLogs || [],
    };
    this.save(this.data);
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

  public createUser(username: string, passwordHash: string, role: "owner" | "admin" | "moderator" | "viewer"): User {
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
    this.save(this.data);
    return newUser;
  }

  public updateUser(user: User) {
    const idx = this.data.users.findIndex((u) => u.id === user.id);
    if (idx !== -1) {
      this.data.users[idx] = user;
      this.save(this.data);
    }
  }

  public deleteUser(userId: string) {
    this.data.users = this.data.users.filter((u) => u.id !== userId);
    this.data.history = this.data.history.filter((h) => h.userId !== userId);
    this.data.achievements = this.data.achievements.filter((a) => a.userId !== userId);
    this.data.loginHistory = this.data.loginHistory.filter((lh) => lh.userId !== userId);
    this.save(this.data);
  }

  // History
  public getHistoryByUserId(userId: string): ProgressHistory[] {
    return this.data.history.filter((h) => h.userId === userId);
  }

  public addHistory(userId: string, level: number, grade: string, score: number, power: string, dps: number): ProgressHistory {
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

    // Update user aggregates
    const user = this.getUserById(userId);
    if (user) {
      user.totalAnalyses += 1;
      
      // Compute highest grade
      const gradesOrder = ["D", "C", "C+", "B", "B+", "A", "A+", "S", "S+"];
      const currentHighestIdx = gradesOrder.indexOf(user.highestGrade);
      const newGradeIdx = gradesOrder.indexOf(grade);
      if (newGradeIdx > currentHighestIdx) {
        user.highestGrade = grade;
      }
      this.updateUser(user);

      // Check achievements
      this.checkAchievementsForUser(userId, user, grade);
    }

    this.save(this.data);
    return entry;
  }

  // Achievements
  public getAchievementsByUserId(userId: string): Achievement[] {
    return this.data.achievements.filter((a) => a.userId === userId);
  }

  private checkAchievementsForUser(userId: string, user: User, latestGrade: string) {
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

    // First Analysis
    unlock("first_analysis");

    // 100 Analyses
    if (user.totalAnalyses >= 100) {
      unlock("analyses_100");
    }

    // Legendary Grade (A/A+/S)
    if (["A", "A+", "S", "S+"].includes(latestGrade)) {
      unlock("legendary_grade");
    }

    // Mythic Grade (S+)
    if (latestGrade === "S+") {
      unlock("mythic_grade");
    }

    // Shield Collector & Weapon Expert can be unlocked based on scanning items (mocked for game metrics)
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

  public addAuditLog(actor: string, action: string, details: string) {
    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      actor,
      action,
      details,
    });
    // Keep max 500 audit logs
    if (this.data.auditLogs.length > 500) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 500);
    }
    this.save(this.data);
  }

  // Login History
  public getLoginHistory(): LoginHistory[] {
    return this.data.loginHistory;
  }

  public addLoginHistory(userId: string, username: string, ip: string, userAgent: string) {
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
    this.save(this.data);
  }

  // Lookup Logs
  public getLookupLogs(): LookupLog[] {
    return this.data.lookupLogs || [];
  }

  public addLookupLog(log: Omit<LookupLog, "id" | "timestamp">) {
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
    this.save(this.data);
    return entry;
  }

  // Activity Logs
  public getActivityLogs(): ActivityLog[] {
    return this.data.activityLogs || [];
  }

  public addActivityLog(username: string, action: string, details: string, status?: string, responseTimeMs?: number) {
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
    this.save(this.data);
    return entry;
  }
}

export const jsonDb = new JsonDatabase();
export default jsonDb;
