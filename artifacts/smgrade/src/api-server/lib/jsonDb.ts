import fs from "fs";
import path from "path";
import crypto from "crypto";
import { EventEmitter } from "events";
import pg from "pg";
import initialDbSeed from "../../../data/db.json";
import initialArcadeScoresSeed from "../../../data/arcade_scores.json";
const { Client, Pool } = pg;

export class CloudflareEdgeSocket extends EventEmitter {
  public static logs: string[] = [];
  private ssl: any;
  private host: string;
  public writable = false;
  public destroyed = false;
  private _upgraded = false;
  private _cfSocket: any = null;
  private _cfWriter: any = null;
  private _cfReader: any = null;

  constructor(ssl: any, host: string) {
    super();
    this.ssl = ssl;
    this.host = host;
    CloudflareEdgeSocket.logs.push(`[Socket] created ssl=${!!ssl} host=${host}`);
  }
  setNoDelay() { return this; }
  setKeepAlive() { return this; }
  ref() { return this; }
  unref() { return this; }

  async connect(port: number, host: string, connectListener?: () => void) {
    try {
      CloudflareEdgeSocket.logs.push(`[Socket.connect] port=${port} host=${host}`);
      if (connectListener) this.once("connect", connectListener);
      this.host = host || this.host;
      // @ts-ignore
      const { connect } = await import("cloudflare:sockets");
      const options = this.ssl ? { secureTransport: "starttls" } : {};
      this._cfSocket = connect(`${host}:${port}`, options);
      this._cfWriter = this._cfSocket.writable.getWriter();
      this._cfReader = this._cfSocket.readable.getReader();

      const initialSocket = this._cfSocket;
      initialSocket.closed.then(() => {
        CloudflareEdgeSocket.logs.push(`[Socket.rawClosed] upgraded=${this._upgraded}`);
        if (this._cfSocket === initialSocket && !this._upgraded) {
          this.emit("close");
        }
      }).catch((e: any) => {
        CloudflareEdgeSocket.logs.push(`[Socket.rawError] err=${e?.message}`);
        if (this._cfSocket === initialSocket && !this._upgraded) {
          this.emit("error", e);
        }
      });

      if (this.ssl) {
        CloudflareEdgeSocket.logs.push(`[Socket] calling _listenOnce`);
        this._listenOnce().catch((e: any) => {
          CloudflareEdgeSocket.logs.push(`[Socket._listenOnce.catch] err=${e?.message}`);
          if (!this.destroyed && !this._upgraded) this.emit("error", e);
        });
      } else {
        this._startListen(this._cfReader);
      }

      await this._cfWriter.ready;
      this.writable = true;
      CloudflareEdgeSocket.logs.push(`[Socket] emitting connect`);
      this.emit("connect");
      return this;
    } catch (e: any) {
      CloudflareEdgeSocket.logs.push(`[Socket.connect.catch] err=${e?.message}`);
      this.emit("error", e);
      return this;
    }
  }

  async _listenOnce() {
    try {
      CloudflareEdgeSocket.logs.push(`[Socket._listenOnce] awaiting read`);
      const { done, value } = await this._cfReader.read();
      CloudflareEdgeSocket.logs.push(`[Socket._listenOnce] read done=${done} len=${value?.length} char=${value ? String.fromCharCode(value[0]) : ''}`);
      if (!done && value) {
        this.emit("data", Buffer.from(value));
      }
    } catch (e: any) {
      CloudflareEdgeSocket.logs.push(`[Socket._listenOnce.error] err=${e?.message}`);
      if (!this.destroyed && !this._upgraded) this.emit("error", e);
    }
  }

  async _startListen(reader: any) {
    try {
      CloudflareEdgeSocket.logs.push(`[Socket._startListen] started`);
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          CloudflareEdgeSocket.logs.push(`[Socket._startListen] stream done`);
          break;
        }
        CloudflareEdgeSocket.logs.push(`[Socket._startListen] received len=${value?.length}`);
        this.emit("data", Buffer.from(value));
      }
    } catch (e: any) {
      CloudflareEdgeSocket.logs.push(`[Socket._startListen.error] err=${e?.message}`);
      if (!this.destroyed) this.emit("error", e);
    }
  }

  write(data: any, encoding = "utf8", callback: (err?: any) => void = () => {}) {
    if (!data || data.length === 0) {
      callback();
      return true;
    }
    if (typeof data === "string") data = Buffer.from(data, encoding as BufferEncoding);
    CloudflareEdgeSocket.logs.push(`[Socket.write] len=${data.length}`);
    this._cfWriter.write(data).then(() => {
      CloudflareEdgeSocket.logs.push(`[Socket.write] success`);
      callback();
    }, (err: any) => {
      CloudflareEdgeSocket.logs.push(`[Socket.write] error=${err?.message}`);
      callback(err);
    });
    return true;
  }

  end(data = Buffer.alloc(0), encoding = "utf8", callback: (err?: any) => void = () => {}) {
    this.write(data, encoding, (err: any) => {
      this.destroyed = true;
      if (this._cfSocket) this._cfSocket.close().catch(() => {});
      callback(err);
    });
    return this;
  }

  destroy() {
    this.destroyed = true;
    if (this._cfSocket) this._cfSocket.close().catch(() => {});
    return this;
  }

  startTls(options: any) {
    CloudflareEdgeSocket.logs.push(`[Socket.startTls] upgraded=${this._upgraded} opts=${JSON.stringify(options)}`);
    if (this._upgraded) return;
    this._upgraded = true;
    this._cfWriter.releaseLock();
    this._cfReader.releaseLock();

    const host = this.host || "aws-0-ap-southeast-1.pooler.supabase.com";
    const tlsOpts = {
      ...options,
      expectedServerHostname: host,
      servername: host,
    };

    const tlsSocket = this._cfSocket.startTls(tlsOpts);
    this._cfSocket = tlsSocket;
    this._cfWriter = tlsSocket.writable.getWriter();
    this._cfReader = tlsSocket.readable.getReader();
    CloudflareEdgeSocket.logs.push(`[Socket.startTls] tlsSocket created`);

    tlsSocket.closed.then(() => {
      CloudflareEdgeSocket.logs.push(`[Socket.tlsClosed]`);
      if (this._cfSocket === tlsSocket) {
        this.emit("close");
      }
    }).catch((e: any) => {
      CloudflareEdgeSocket.logs.push(`[Socket.tlsError] err=${e?.message}`);
      if (this._cfSocket === tlsSocket && !this.destroyed) {
        this.emit("error", e);
      }
    });

    this._startListen(this._cfReader);
  }
}

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
  ipAddress?: string;
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

export interface SiteVisit {
  id: string;
  timestamp: string;
  date: string; // YYYY-MM-DD
  path: string;
  visitorId?: string;
  ip?: string;
  userAgent?: string;
}

export interface ArcadePlayer {
  id: string; // unique player ID
  username: string; // 1-10 alphanumeric
  usernameLower: string;
  secretToken: string; // secret key so only this device/player can claim this username
  createdAt: string;
  lastSeen: string;
  dwarfSuccessCount: number; // Category 4: Dwarfing operations
  highestDwarfedLevel: number;
  petEnhanceCount: number; // Category 2: Pet-enhancing operations
  downgraderCount?: number; // Category 3: Downgrader operations
  mobKillsCount?: number; // Category 1: Mob interactions/kills
  elfOpsCount?: number; // Category 5: Elf operations
  level: number;
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
  arcadePlayers?: ArcadePlayer[];
  siteVisits?: SiteVisit[];
  customItems?: any[];
  customPrices?: any[];
  customBenchmarks?: any[];
  customConstants?: any;
  masterSessions?: string[];
  masterLockouts?: Record<string, { attempts: number; lastAttempt: number; lockoutUntil: number }>;
}

const DEFAULT_DB: DbSchema = {
  users: (initialDbSeed as any).users || [],
  history: (initialDbSeed as any).history || [],
  achievements: (initialDbSeed as any).achievements || [],
  auditLogs: (initialDbSeed as any).auditLogs || [],
  loginHistory: (initialDbSeed as any).loginHistory || [],
  settings: (initialDbSeed as any).settings || {
    maintenanceMode: false,
    registrationOpen: true,
    goldExchangeRate: 1.0,
  },
  lookupLogs: (initialDbSeed as any).lookupLogs || [],
  activityLogs: (initialDbSeed as any).activityLogs || [],
  arcadeScores: (initialDbSeed as any).arcadeScores?.length ? (initialDbSeed as any).arcadeScores : ((initialArcadeScoresSeed as any) || []),
  arcadePlayers: (initialDbSeed as any).arcadePlayers || [],
  siteVisits: (initialDbSeed as any).siteVisits || [],
  customItems: (initialDbSeed as any).customItems || [],
  customPrices: (initialDbSeed as any).customPrices || [],
  customBenchmarks: (initialDbSeed as any).customBenchmarks || [],
  customConstants: (initialDbSeed as any).customConstants || null,
  masterSessions: (initialDbSeed as any).masterSessions || [],
};

export class JsonDatabase {
  private data: DbSchema;
  private databaseUrl: string = process.env.DATABASE_URL || "postgresql://postgres.gmckoqwkpvaznefknmnr:SmGradeSecureDbPool2026!@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";
  private tableCreated = false;
  private dbDisabled = false;
  private consecutiveFailures = 0;
  private queue: Promise<any> = Promise.resolve();
  private cacheUpdatedAt: Date | null = null;
  private lastSyncCheck: number = 0;

  constructor() {
    this.data = this.loadFromFile();
    if (process.env.DATABASE_URL) {
      this.databaseUrl = process.env.DATABASE_URL;
    }
  }

  private async query(text: string, params?: any[]): Promise<any> {
    const connStr = this.databaseUrl || process.env.DATABASE_URL;
    if (!connStr || this.dbDisabled) {
      throw new Error("No database configured or DB disabled");
    }

    const hostMatch = connStr.match(/@([^/:]+)/);
    const host = hostMatch ? hostMatch[1] : undefined;

    const isCloudflare = typeof (globalThis as any).WebSocketPair !== "undefined" || (typeof navigator !== "undefined" && (navigator as any).userAgent === "Cloudflare-Workers");

    const client = new Client({
      connectionString: connStr,
      ssl: {
        rejectUnauthorized: false,
        servername: host,
        expectedServerHostname: host,
      } as any,
      stream: isCloudflare ? (() => new CloudflareEdgeSocket(true, host || "aws-0-ap-southeast-1.pooler.supabase.com") as any) : undefined,
      connectionTimeoutMillis: 8000,
      statement_timeout: 10000,
      query_timeout: 10000,
    });

    try {
      await Promise.race([
        client.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("DB connect timeout")), 10000))
      ]);
      const res = await Promise.race([
        client.query(text, params),
        new Promise((_, reject) => setTimeout(() => reject(new Error("DB query timeout")), 10000))
      ]);
      return res;
    } finally {
      await client.end().catch(() => {});
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
      if (typeof fs !== "undefined" && typeof fs.writeFileSync === "function") {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
      }
    } catch (err) {
      // In Worker environments, disk write is not available; in-memory and PostgreSQL storage are active.
    }
  }

  public async init(databaseUrl?: string): Promise<void> {
    const connStr = databaseUrl || process.env.DATABASE_URL;
    if (connStr && connStr.startsWith("postgres")) {
      this.databaseUrl = connStr;
    }
    if (!this.databaseUrl || this.dbDisabled) {
      return;
    }
    if (!this.tableCreated) {
      try {
        await this.query(`
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
        `);
        this.tableCreated = true;
        this.consecutiveFailures = 0; // Reset consecutive failures on success
      } catch (err) {
        this.consecutiveFailures++;
        console.warn(`[SMGrade DB] Failed to create tables (Attempt ${this.consecutiveFailures}):`, err);
        if (this.consecutiveFailures >= 5) {
          console.warn("[SMGrade DB] Too many consecutive connection failures. Using local cache fallback.");
        }
        return;
      }
    }
    await this.syncFromDb();
  }

  private async syncFromDb(): Promise<void> {
    if (!this.databaseUrl || this.dbDisabled) {
      return;
    }
    const now = Date.now();
    if (this.cacheUpdatedAt && now - this.lastSyncCheck < 5000) {
      return;
    }
    this.lastSyncCheck = now;
    try {
      // 1. Get the updated_at timestamp from the DB
      const timeRes: any = await this.query("SELECT updated_at FROM master_vault_state WHERE id = 1");

      if (timeRes && timeRes.rows && timeRes.rows.length > 0) {
        const dbUpdatedAt = new Date(timeRes.rows[0].updated_at);
        
        // 2. If cache is fresh, return immediately without downloading state
        if (this.cacheUpdatedAt && dbUpdatedAt.getTime() <= this.cacheUpdatedAt.getTime()) {
          return;
        }

        // 3. Cache is stale or missing, download the full state
        const res: any = await this.query("SELECT state, updated_at FROM master_vault_state WHERE id = 1");

        if (res && res.rows && res.rows.length > 0) {
          const parsed = JSON.parse(res.rows[0].state);
          // Preserve full arcade scores if cached/loaded has more
          if (this.data.arcadeScores && this.data.arcadeScores.length > (parsed.arcadeScores?.length || 0)) {
            parsed.arcadeScores = this.data.arcadeScores;
          }
          this.data = parsed;
          this.cacheUpdatedAt = new Date(res.rows[0].updated_at);
          this.saveToFile(this.data);
        }
      } else if (timeRes && timeRes.rows) {
        // No row exists yet, insert default state
        const dataToSave = { ...this.data };
        if (dataToSave.arcadeScores && dataToSave.arcadeScores.length > 100) {
          dataToSave.arcadeScores = dataToSave.arcadeScores.slice(-100);
        }
        const stateStr = JSON.stringify(dataToSave);
        const insertRes: any = await this.query(
          "INSERT INTO master_vault_state (id, state, updated_at) VALUES (1, $1, CURRENT_TIMESTAMP) ON CONFLICT (id) DO NOTHING RETURNING updated_at",
          [stateStr]
        );
        if (insertRes && insertRes.rows && insertRes.rows.length > 0) {
          this.cacheUpdatedAt = new Date(insertRes.rows[0].updated_at);
        }
      }
      this.consecutiveFailures = 0; // Reset consecutive failures on success
    } catch (err) {
      this.consecutiveFailures++;
      console.warn(`[SMGrade DB] Failed to synchronize state from database (Attempt ${this.consecutiveFailures}):`, err);
      if (this.consecutiveFailures >= 5) {
        console.warn("[SMGrade DB] Too many consecutive sync failures. Using local cache fallback.");
      }
    }
  }

  private async save(data: DbSchema): Promise<void> {
    this.data = data;
    this.saveToFile(data);

    if (this.databaseUrl && !this.dbDisabled) {
      const dataToSave = { ...data };
      // Arcade scores are persisted in dedicated table 'arcade_scores'; trim in JSON snapshot to avoid PgBouncer payload overflow
      if (dataToSave.arcadeScores && dataToSave.arcadeScores.length > 100) {
        dataToSave.arcadeScores = dataToSave.arcadeScores.slice(-100);
      }
      const stateStr = JSON.stringify(dataToSave);

      try {
        console.log("[PostgreSQL UPDATE/INSERT query started] size of state:", stateStr.length);
        const queryRes: any = await this.query(
          `INSERT INTO master_vault_state (id, state, updated_at) 
           VALUES (1, $1, CURRENT_TIMESTAMP) 
           ON CONFLICT (id) 
           DO UPDATE SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at
           RETURNING id, updated_at`,
          [stateStr]
        );
        
        console.log("[PostgreSQL UPDATE/INSERT result]:", queryRes?.rows?.[0]);
        if (queryRes && queryRes.rows && queryRes.rows.length > 0) {
          this.cacheUpdatedAt = new Date(queryRes.rows[0].updated_at);
        }
        this.consecutiveFailures = 0;
      } catch (err: any) {
        this.consecutiveFailures++;
        console.warn(`[SMGrade DB] Save to database failed (Attempt ${this.consecutiveFailures}):`, err);
        if (this.consecutiveFailures >= 5) {
          console.warn("[SMGrade DB] Too many consecutive save failures. Using local memory backup.");
        }
      }
    }
  }

  public getRawData(): DbSchema {
    return this.data;
  }

  public async testConnection(): Promise<{ connected: boolean; error?: string; row?: any; poolExists: boolean; connUrl?: string; stack?: string; socketLogs?: string[] }> {
    const connStr = this.databaseUrl || process.env.DATABASE_URL || "";
    const sanitizedUrl = connStr.replace(/:[^:]+@/, ":***@");
    if (!connStr) {
      return { connected: false, poolExists: false, error: "No databaseUrl configured" };
    }
    CloudflareEdgeSocket.logs = [];
    try {
      const res = await this.query("SELECT NOW() as now, count(*) as count FROM master_vault_state");
      return { connected: true, poolExists: true, row: res.rows?.[0], connUrl: sanitizedUrl, socketLogs: CloudflareEdgeSocket.logs };
    } catch (err: any) {
      return { connected: false, poolExists: true, error: err.message || String(err), connUrl: sanitizedUrl, stack: err.stack, socketLogs: CloudflareEdgeSocket.logs };
    }
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
    const raw = this.data.lookupLogs || [];
    return raw.map((l) => {
      const copy: any = { ...l };
      delete copy.ipAddress;
      delete copy.ip;
      return copy;
    });
  }

  public async addLookupLog(log: Omit<LookupLog, "id" | "timestamp">): Promise<LookupLog> {
    return this.executeAtomic(async () => {
      const entry: any = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        ...log
      };
      delete entry.ipAddress;
      delete entry.ip;
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
    const raw = this.data.activityLogs || [];
    return raw.map((l) => {
      const copy: any = { ...l };
      delete copy.ipAddress;
      delete copy.ip;
      if (typeof copy.details === "string" && copy.details.includes("IP: ")) {
        copy.details = copy.details.replace(/from IP: [^\s]+|IP: [^\s]+/g, "authenticated");
      }
      return copy;
    });
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
    if (this.data.arcadeScores && this.data.arcadeScores.length > 0) {
      return this.data.arcadeScores;
    }
    if (this.databaseUrl && !this.dbDisabled) {
      try {
        const res = await this.query('SELECT id, username, user_id as "userId", dwarf_kills as "dwarfKills", elf_kills as "elfKills", total_kills as "totalKills", highest_combo as "highestCombo", highest_dps as "highestDps", timestamp FROM arcade_scores ORDER BY timestamp DESC LIMIT 5000');
        if (res.rows && res.rows.length > 0) {
          this.data.arcadeScores = res.rows;
          return res.rows;
        }
      } catch (err) {
        console.warn("[SMGrade DB] Failed to fetch arcade scores from database, falling back to local file:", err);
      }
    }
    const arcadeFile = path.join(process.cwd(), "data", "arcade_scores.json");
    if (fs.existsSync(arcadeFile)) {
      try {
        this.data.arcadeScores = JSON.parse(fs.readFileSync(arcadeFile, "utf8"));
      } catch (e) {}
    }
    return this.data.arcadeScores || [];
  }

  public async resetArcadeScores(): Promise<void> {
    return this.executeAtomic(async () => {
      this.data.arcadeScores = [];
      if (this.databaseUrl && !this.dbDisabled) {
        try {
          await this.query('TRUNCATE TABLE arcade_scores');
        } catch (err) {
          console.warn("[SMGrade DB] Failed to truncate arcade_scores table in database:", err);
        }
      }
      try {
        const arcadeFile = path.join(process.cwd(), "data", "arcade_scores.json");
        if (fs.existsSync(arcadeFile)) {
          fs.writeFileSync(arcadeFile, "[]\n", "utf8");
        }
      } catch (e) {}
      await this.save(this.data);
    });
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

    // 1. Keep in-memory cache and state updated immediately
    if (!this.data.arcadeScores) {
      this.data.arcadeScores = [];
    }
    this.data.arcadeScores.push(entry);

    // 2. Persist directly to authoritative PostgreSQL arcade_scores table
    if (this.databaseUrl && !this.dbDisabled) {
      try {
        await this.query(
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
        );
        console.log(`[SMGrade DB] Inserted arcade score event into arcade_scores table for ${targetUsername} (${id})`);
      } catch (err) {
        console.warn("[SMGrade DB] Failed to insert arcade score into database:", err);
      }
    }

    // Also persist into master_vault_state so it is preserved across all syncs & isolates
    await this.save(this.data).catch(() => {});

    return entry;
  }

  // --- SITE VISITS (Persistent Website Entry Tracking) ---
  public async recordSiteVisit(pathStr: string, _ip?: string, userAgent?: string, visitorId?: string): Promise<SiteVisit> {
    const id = crypto.randomUUID();
    const now = new Date();
    const timestamp = now.toISOString();
    const date = timestamp.slice(0, 10); // YYYY-MM-DD

    const visit: SiteVisit = {
      id,
      timestamp,
      date,
      path: pathStr || "/",
      visitorId: visitorId || id,
      userAgent
    };

    await this.executeAtomic(async () => {
      if (!this.data.siteVisits) this.data.siteVisits = [];
      this.data.siteVisits.push(visit);
      if (this.data.siteVisits.length > 10000) {
        this.data.siteVisits = this.data.siteVisits.slice(-10000);
      }
      await this.save(this.data);
    });

    return visit;
  }

  public getSiteVisits(): SiteVisit[] {
    const raw = this.data.siteVisits || [];
    return raw.map((v) => {
      const copy: any = { ...v };
      delete copy.ip;
      return copy;
    });
  }

  // --- ARCADE PLAYER IDENTITY & LEADERBOARDS (Requirements 7, 8, 9, 11) ---
  public async registerArcadePlayer(username: string, playerId: string, secretToken: string): Promise<{ success: boolean; player?: ArcadePlayer; error?: string; status: number }> {
    const cleanUsername = String(username || "").trim();
    const cleanPlayerId = String(playerId || "").trim();
    const cleanToken = String(secretToken || "").trim();

    // Strict validation: 1-10 alphanumeric characters only (A-Z, a-z, 0-9)
    if (!/^[a-zA-Z0-9]{1,10}$/.test(cleanUsername)) {
      return { success: false, error: "Username must be 1-10 alphanumeric characters (A-Z, a-z, 0-9) with no spaces or symbols.", status: 400 };
    }

    if (!cleanPlayerId || !cleanToken) {
      return { success: false, error: "Player ID and secret token are required.", status: 400 };
    }

    const usernameLower = cleanUsername.toLowerCase();

    return await this.executeAtomic(async () => {
      if (!this.data.arcadePlayers) this.data.arcadePlayers = [];

      const existingByName = this.data.arcadePlayers.find(p => p.usernameLower === usernameLower);
      const now = new Date().toISOString();

      if (existingByName) {
        // If claimed by the exact same player ID and token, allow resuming session
        if (existingByName.id === cleanPlayerId && existingByName.secretToken === cleanToken) {
          existingByName.lastSeen = now;
          await this.save(this.data);
          return { success: true, player: existingByName, status: 200 };
        } else {
          // Claimed by someone else! Reject impersonation
          return { success: false, error: "This username has already been claimed by another player.", status: 409 };
        }
      }

      // Check if this player already registered under another name
      let existingPlayer = this.data.arcadePlayers.find(p => p.id === cleanPlayerId);
      if (existingPlayer) {
        if (existingPlayer.secretToken !== cleanToken) {
          return { success: false, error: "Unauthorized player token mismatch.", status: 403 };
        }
        existingPlayer.username = cleanUsername;
        existingPlayer.usernameLower = usernameLower;
        existingPlayer.lastSeen = now;
        await this.save(this.data);
        return { success: true, player: existingPlayer, status: 200 };
      }

      // Brand new player registration
      const newPlayer: ArcadePlayer = {
        id: cleanPlayerId,
        username: cleanUsername,
        usernameLower,
        secretToken: cleanToken,
        createdAt: now,
        lastSeen: now,
        dwarfSuccessCount: 0,
        highestDwarfedLevel: 1,
        petEnhanceCount: 0,
        downgraderCount: 0,
        mobKillsCount: 0,
        elfOpsCount: 0,
        level: 1
      };

      this.data.arcadePlayers.push(newPlayer);
      await this.save(this.data);

      // Log new username creation to Master Vault Activity Logs (Requirement 9)
      if (!this.data.activityLogs) this.data.activityLogs = [];
      this.data.activityLogs.push({
        id: crypto.randomUUID(),
        timestamp: now,
        username: cleanUsername,
        action: "Arcade Player Registered",
        details: `New player registered username: ${cleanUsername}`,
        status: "Success"
      });
      await this.save(this.data);

      return { success: true, player: newPlayer, status: 201 };
    });
  }

  public async checkArcadePlayerUsername(username: string, playerId?: string): Promise<{ available: boolean; ownedByCurrentPlayer: boolean }> {
    const cleanUsername = String(username || "").trim();
    if (!/^[a-zA-Z0-9]{1,10}$/.test(cleanUsername)) {
      return { available: false, ownedByCurrentPlayer: false };
    }
    const usernameLower = cleanUsername.toLowerCase();
    const players = this.data.arcadePlayers || [];
    const found = players.find(p => p.usernameLower === usernameLower);
    if (!found) {
      return { available: true, ownedByCurrentPlayer: false };
    }
    if (playerId && found.id === playerId) {
      return { available: true, ownedByCurrentPlayer: true };
    }
    return { available: false, ownedByCurrentPlayer: false };
  }

  public getArcadePlayerByUsername(username: string): ArcadePlayer | undefined {
    if (!username || !this.data.arcadePlayers) return undefined;
    const lower = username.trim().toLowerCase();
    return this.data.arcadePlayers.find(p => p.usernameLower === lower);
  }

  public async saveRawData(): Promise<void> {
    await this.save(this.data);
  }

  public async updateArcadePlayerStats(
    playerId: string,
    secretToken: string,
    stats: {
      dwarfSuccessDelta?: number;
      highestDwarfedLevel?: number;
      petEnhanceDelta?: number;
      downgraderDelta?: number;
      mobKillDelta?: number;
      elfDelta?: number;
      level?: number;
    }
  ): Promise<ArcadePlayer | null> {
    return await this.executeAtomic(async () => {
      if (!this.data.arcadePlayers) this.data.arcadePlayers = [];
      const player = this.data.arcadePlayers.find(p => p.id === playerId);
      if (!player) return null;
      if (player.secretToken !== secretToken) return null;

      if (stats.dwarfSuccessDelta) {
        player.dwarfSuccessCount = (player.dwarfSuccessCount || 0) + Math.max(0, Number(stats.dwarfSuccessDelta) || 0);
      }
      if (stats.highestDwarfedLevel) {
        player.highestDwarfedLevel = Math.min(10, Math.max(player.highestDwarfedLevel || 1, Number(stats.highestDwarfedLevel) || 1));
      }
      if (stats.petEnhanceDelta) {
        player.petEnhanceCount = (player.petEnhanceCount || 0) + Math.max(0, Number(stats.petEnhanceDelta) || 0);
      }
      if (stats.downgraderDelta) {
        player.downgraderCount = (player.downgraderCount || 0) + Math.max(0, Number(stats.downgraderDelta) || 0);
      }
      if (stats.mobKillDelta) {
        player.mobKillsCount = (player.mobKillsCount || 0) + Math.max(0, Number(stats.mobKillDelta) || 0);
      }
      if (stats.elfDelta) {
        player.elfOpsCount = (player.elfOpsCount || 0) + Math.max(0, Number(stats.elfDelta) || 0);
      }
      if (stats.level) {
        player.level = Math.max(player.level || 1, Number(stats.level) || 1);
      }
      player.lastSeen = new Date().toISOString();

      await this.save(this.data);
      return player;
    });
  }

  public getArcadeGameLeaderboards(): {
    dwarfing: { username: string; score: number }[];
    enhancing: { username: string; score: number }[];
    activity: { username: string; score: number }[];
    level: { username: string; score: number }[];
  } {
    const players = (this.data.arcadePlayers || []).filter(p => p.username);

    // Board 1: Most Dwarfs (Total successful dwarfing operations, not item levels/power/gold)
    const dwarfing = [...players]
      .sort((a, b) => (b.dwarfSuccessCount || 0) - (a.dwarfSuccessCount || 0) || a.username.localeCompare(b.username))
      .slice(0, 10)
      .map(p => ({ username: p.username, score: p.dwarfSuccessCount || 0 }));

    // Board 2: Most Pets Enhanced (Total successful pet-enhancing operations, not count owned/levels)
    const enhancing = [...players]
      .sort((a, b) => (b.petEnhanceCount || 0) - (a.petEnhanceCount || 0) || a.username.localeCompare(b.username))
      .slice(0, 10)
      .map(p => ({ username: p.username, score: p.petEnhanceCount || 0 }));

    // Board 3: Total Game Activity (Sum of 5 categories: mob kills + pet enhances + downgrades + dwarfs + elf ops)
    const activity = [...players]
      .map(p => {
        const mobKills = Number(p.mobKillsCount) || 0;
        const petEnhances = Number(p.petEnhanceCount) || 0;
        const downgrades = Number(p.downgraderCount) || 0;
        const dwarfs = Number(p.dwarfSuccessCount) || 0;
        const elfOps = Number(p.elfOpsCount) || 0;
        const total = mobKills + petEnhances + downgrades + dwarfs + elfOps;
        return { username: p.username, score: total };
      })
      .sort((a, b) => b.score - a.score || a.username.localeCompare(b.username))
      .slice(0, 10);

    return { dwarfing, enhancing, activity, level: activity };
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
