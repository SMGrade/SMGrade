export interface UserProfile {
  id: string;
  username: string;
  role: "owner" | "admin" | "moderator" | "viewer";
  profilePic: string;
  highestGrade: string;
  totalAnalyses: number;
  favoriteWeapon: string;
  favoriteShield: string;
  favoritePet: string;
  createdAt: string;
  notes: string;
}

export interface ProgressHistoryEntry {
  id: string;
  userId: string;
  date: string;
  level: number;
  grade: string;
  score: number;
  power: string;
  dps: number;
}

export interface UserAchievement {
  id: string;
  userId: string;
  badgeCode: string;
  unlockedAt: string;
}

class AuthStore {
  private token: string | null = null;
  private user: UserProfile | null = null;
  private guest: boolean = false;

  constructor() {
    this.token = localStorage.getItem("smg_session_token");
    this.guest = sessionStorage.getItem("smg_guest_mode") === "true";
    // Migration/clean up of legacy persistent guest flags
    localStorage.removeItem("smg_guest_mode");
  }

  public setToken(token: string) {
    this.token = token;
    localStorage.setItem("smg_session_token", token);
    sessionStorage.removeItem("smg_guest_mode");
    this.guest = false;
  }

  public setGuestMode() {
    this.guest = true;
    sessionStorage.setItem("smg_guest_mode", "true");
    this.token = null;
    localStorage.removeItem("smg_session_token");
  }

  public logout() {
    this.token = null;
    this.user = null;
    this.guest = false;
    localStorage.removeItem("smg_session_token");
    sessionStorage.removeItem("smg_guest_mode");
  }

  public getToken() {
    return this.token;
  }

  public isLoggedIn() {
    return !!this.token;
  }

  public isGuest() {
    return this.guest;
  }

  public getUser() {
    return this.user;
  }

  public async fetchMe(): Promise<UserProfile | null> {
    if (!this.token) return null;
    try {
      const res = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });
      if (res.ok) {
        const data = await res.json() as UserProfile;
        this.user = data;
        return data;
      } else {
        this.logout();
      }
    } catch (e) {
      console.error("Error fetching user session:", e);
    }
    return null;
  }

  public async updateProfile(fields: {
    favoriteWeapon?: string;
    favoriteShield?: string;
    favoritePet?: string;
    notes?: string;
  }): Promise<boolean> {
    if (!this.token) return false;
    try {
      const res = await fetch("/api/auth/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        if (this.user) {
          if (fields.favoriteWeapon !== undefined) this.user.favoriteWeapon = fields.favoriteWeapon;
          if (fields.favoriteShield !== undefined) this.user.favoriteShield = fields.favoriteShield;
          if (fields.favoritePet !== undefined) this.user.favoritePet = fields.favoritePet;
          if (fields.notes !== undefined) this.user.notes = fields.notes;
        }
        return true;
      }
    } catch (e) {
      console.error("Error updating profile:", e);
    }
    return false;
  }

  public async fetchHistory(): Promise<ProgressHistoryEntry[]> {
    if (!this.token) return [];
    try {
      const res = await fetch("/api/auth/history", {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });
      if (res.ok) {
        return (await res.json()) as ProgressHistoryEntry[];
      }
    } catch (e) {
      console.error("Error fetching history:", e);
    }
    return [];
  }

  public async addHistory(
    level: number,
    grade: string,
    score: number,
    power: string,
    dps: number
  ): Promise<boolean> {
    if (!this.token) return false;
    try {
      const res = await fetch("/api/auth/history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ level, grade, score, power, dps }),
      });
      return res.ok;
    } catch (e) {
      console.error("Error saving history:", e);
    }
    return false;
  }

  public async fetchAchievements(): Promise<UserAchievement[]> {
    if (!this.token) return [];
    try {
      const res = await fetch("/api/auth/achievements", {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });
      if (res.ok) {
        return (await res.json()) as UserAchievement[];
      }
    } catch (e) {
      console.error("Error fetching achievements:", e);
    }
    return [];
  }
}

export const authStore = new AuthStore();
export default authStore;
