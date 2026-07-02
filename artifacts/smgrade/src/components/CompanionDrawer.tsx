import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import authStore, { type UserProfile, type ProgressHistoryEntry, type UserAchievement } from "@/lib/authStore";
import { SWORDS, SHIELDS } from "@/lib/gearDatabase";

// Available achievements list
const BADGES = [
  { code: "first_analysis", label: "First Analysis", desc: "Grade your stats for the first time.", icon: "🥇" },
  { code: "analyses_100", label: "Grader Centurion", desc: "Grade your stats 100 times.", icon: "💯" },
  { code: "legendary_grade", label: "Legendary Grade", desc: "Achieve grade A or higher.", icon: "👑" },
  { code: "mythic_grade", label: "Mythic Master", desc: "Achieve the ultimate S+ grade.", icon: "💎" },
  { code: "weapon_expert", label: "Weapon Expert", desc: "Analyze weapons and shields 5 times.", icon: "⚔️" },
  { code: "shield_collector", label: "Shield Collector", desc: "Analyze weapons and shields 10 times.", icon: "🛡️" },
];

interface CompanionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginStateChange?: () => void;
  onAuthSuccess?: () => void;
}

export default function CompanionDrawer({ isOpen, onClose, onLoginStateChange, onAuthSuccess }: CompanionDrawerProps) {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Profile data states
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [history, setHistory] = useState<ProgressHistoryEntry[]>([]);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);

  // Edit favorites states
  const [favWeapon, setFavWeapon] = useState("—");
  const [favShield, setFavShield] = useState("—");
  const [favPet, setFavPet] = useState("—");
  const [notes, setNotes] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const isLoggedIn = authStore.isLoggedIn();

  // Load profile details when open and logged in
  useEffect(() => {
    if (isOpen && isLoggedIn) {
      loadUserData();
    }
  }, [isOpen, isLoggedIn]);

  async function loadUserData() {
    setLoading(true);
    const p = await authStore.fetchMe();
    if (p) {
      setProfile(p);
      setFavWeapon(p.favoriteWeapon || "—");
      setFavShield(p.favoriteShield || "—");
      setFavPet(p.favoritePet || "—");
      setNotes(p.notes || "");

      const h = await authStore.fetchHistory();
      setHistory(h);

      const a = await authStore.fetchAchievements();
      setAchievements(a);
    }
    setLoading(false);
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    
    if (!username.trim() || !password.trim()) {
      setError("Username and Password are required.");
      return;
    }

    if (activeTab === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      if (activeTab === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username.trim(), password: password.trim() }),
        });
        
        let data: any = {};
        try {
          const txt = await res.text();
          data = txt ? JSON.parse(txt) : {};
        } catch {
          data = { error: `Server returned invalid status code: ${res.status}` };
        }

        if (res.ok) {
          setMessage("Account created successfully! You can now log in.");
          setActiveTab("login");
          setPassword("");
          setConfirmPassword("");
        } else {
          setError(data.error || "Failed to create account.");
        }
      } else {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username.trim(), password: password.trim() }),
        });
        
        let data: any = {};
        try {
          const txt = await res.text();
          data = txt ? JSON.parse(txt) : {};
        } catch {
          data = { error: `Server returned invalid status code: ${res.status}` };
        }

        if (res.ok && data.token) {
          authStore.setToken(data.token);
          await loadUserData();
          onLoginStateChange?.();
          onAuthSuccess?.();
          onClose();
        } else {
          setError(data.error || "Failed to log in.");
        }
      }
    } catch (e) {
      setError("Connection error. Ensure api-server is running.");
    } finally {
      setLoading(false);
    }
  }

  async function saveProfileDetails() {
    setSavingProfile(true);
    const ok = await authStore.updateProfile({
      favoriteWeapon: favWeapon,
      favoriteShield: favShield,
      favoritePet: favPet,
      notes,
    });
    setSavingProfile(false);
    if (ok) {
      loadUserData();
    }
  }

  function continueAsGuest() {
    authStore.setGuestMode();
    onClose();
    onLoginStateChange?.();
    onAuthSuccess?.();
  }

  function logout() {
    authStore.logout();
    setProfile(null);
    setHistory([]);
    setAchievements([]);
    onLoginStateChange?.();
    onClose();
    window.location.reload();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          />

          {/* Slider Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 250 }}
            className="relative w-full max-w-lg h-full bg-[#05050f] border-l border-white/[0.04] p-8 flex flex-col justify-between overflow-y-auto text-white z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
              <div>
                <h3 className="text-lg font-black text-white font-display">
                  {isLoggedIn ? "Player Dashboard" : "Access Companion Dashboard"}
                </h3>
                <p className="text-white/35 text-[9px] uppercase font-bold mt-0.5">
                  {isLoggedIn ? "Manage Profile & Progression" : "Track improvements & save data"}
                </p>
              </div>
              <button onClick={onClose} className="text-white/40 hover:text-white text-xs select-none cursor-pointer">
                ✕
              </button>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 my-6 space-y-6 overflow-y-auto pr-1">
              {!isLoggedIn ? (
                // Authentication Forms
                <div className="space-y-6">
                  {activeTab === "register" ? (
                    <div className="space-y-2 leading-relaxed">
                      <p className="text-xs text-white/50 font-semibold bg-white/[0.01] border border-white/[0.03] p-4 rounded-xl">
                        Create your free SMGrade account to save your progress, track your account history, monitor improvements, and continue your journey across all your analyses.
                      </p>
                      <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider px-1">
                        * This account is for SMGrade only. Not for SwordMasters.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-white/50 leading-relaxed font-semibold bg-white/[0.01] border border-white/[0.03] p-4 rounded-xl">
                      Log in to your free SMGrade account to access your saved stats progress, achievements timeline, and customized settings.
                    </p>
                  )}

                  {/* Tabs */}
                  <div className="flex border-b border-white/[0.04] gap-2">
                    <button
                      onClick={() => { setActiveTab("login"); setError(""); setMessage(""); }}
                      className={`pb-2 px-1 font-bold text-xs uppercase tracking-widest border-b-2 transition-all cursor-pointer ${
                        activeTab === "login" ? "border-amber-400 text-amber-400" : "border-transparent text-white/30"
                      }`}
                    >
                      Log In
                    </button>
                    <button
                      onClick={() => { setActiveTab("register"); setError(""); setMessage(""); }}
                      className={`pb-2 px-1 font-bold text-xs uppercase tracking-widest border-b-2 transition-all cursor-pointer ${
                        activeTab === "register" ? "border-amber-400 text-amber-400" : "border-transparent text-white/30"
                      }`}
                    >
                      Create Account
                    </button>
                  </div>

                  <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                      <label className="text-[9px] uppercase tracking-wider font-bold text-white/40 block mb-1">
                        {activeTab === "login" ? "Username" : "Create a Username"}
                      </label>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-[#03050b] border border-white/[0.04] focus:border-amber-500/30 text-white text-xs px-3 py-2.5 rounded-lg outline-none transition-colors"
                        placeholder={activeTab === "login" ? "Enter Username" : "Select unique username"}
                      />
                    </div>
                    
                    <div>
                      <label className="text-[9px] uppercase tracking-wider font-bold text-white/40 block mb-1">Password</label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-[#03050b] border border-white/[0.04] focus:border-amber-500/30 text-white text-xs px-3 py-2.5 rounded-lg outline-none transition-colors"
                        placeholder="••••••••"
                      />
                    </div>

                    {activeTab === "register" && (
                      <div>
                        <label className="text-[9px] uppercase tracking-wider font-bold text-white/40 block mb-1">Confirm Password</label>
                        <input
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full bg-[#03050b] border border-white/[0.04] focus:border-amber-500/30 text-white text-xs px-3 py-2.5 rounded-lg outline-none transition-colors"
                          placeholder="••••••••"
                        />
                      </div>
                    )}

                    {error && <p className="text-red-400 text-xs font-semibold">⚠️ {error}</p>}
                    {message && <p className="text-[#5ecb7a] text-xs font-semibold">✓ {message}</p>}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 rounded-lg button-gold text-xs font-black tracking-widest disabled:opacity-40 cursor-pointer"
                    >
                      {loading ? "Processing..." : activeTab === "login" ? "Log In" : "Register Account"}
                    </button>
                  </form>

                  <div className="text-center pt-2">
                    <button
                      onClick={continueAsGuest}
                      className="text-[10px] text-white/40 hover:text-amber-400 transition-colors uppercase tracking-widest font-black cursor-pointer"
                    >
                      Continue as Guest →
                    </button>
                  </div>
                </div>
              ) : (
                // Dashboard & Profile View
                <div className="space-y-6">
                  {loading && !profile ? (
                    <div className="flex justify-center items-center py-10">
                      <div className="w-6 h-6 rounded-full border-2 border-amber-500/25 border-t-amber-400 animate-spin" />
                    </div>
                  ) : (
                    profile && (
                      <div className="space-y-6">
                        {/* Profile Header */}
                        <div className="flex items-center gap-4 bg-white/[0.01] border border-white/[0.03] p-4 rounded-xl glass-panel relative overflow-hidden">
                          <img src={profile.profilePic} alt="avatar" className="w-14 h-14 rounded-xl border border-white/5 bg-[#070b13]" />
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-md font-black text-white font-display">{profile.username}</h4>
                              <span className="text-[8px] font-black uppercase bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">
                                {profile.role}
                              </span>
                            </div>
                            <p className="text-white/30 text-[9px] mt-1 font-mono">Member since {new Date(profile.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>

                        {/* Summary grid */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-white/[0.01] border border-white/[0.03] p-3 rounded-lg text-center">
                            <span className="text-[8px] uppercase tracking-wider text-white/30 font-bold block mb-1">Current Grade</span>
                            <span className="text-md font-black text-white font-mono">{history[history.length - 1]?.grade || "—"}</span>
                          </div>
                          <div className="bg-white/[0.01] border border-white/[0.03] p-3 rounded-lg text-center">
                            <span className="text-[8px] uppercase tracking-wider text-white/30 font-bold block mb-1">Highest Grade</span>
                            <span className="text-md font-black text-amber-400 font-mono">{profile.highestGrade}</span>
                          </div>
                          <div className="bg-white/[0.01] border border-white/[0.03] p-3 rounded-lg text-center">
                            <span className="text-[8px] uppercase tracking-wider text-white/30 font-bold block mb-1">Analyses</span>
                            <span className="text-md font-black text-white font-mono">{profile.totalAnalyses}</span>
                          </div>
                        </div>

                        {/* Favorites Editing Form */}
                        <div className="border border-white/[0.04] p-5 rounded-xl glass-panel space-y-4">
                          <h4 className="text-[9px] uppercase tracking-widest text-amber-400 font-black font-display">Favorite Equipment</h4>
                          <div className="space-y-3 text-xs">
                            <div className="grid grid-cols-2 items-center gap-2">
                              <span className="text-white/40 font-semibold">Weapon</span>
                              <select
                                className="bg-[#03050b] border border-white/[0.04] text-white/80 rounded px-2 py-1.5 outline-none text-xs cursor-pointer font-mono"
                                value={favWeapon}
                                onChange={(e) => setFavWeapon(e.target.value)}
                              >
                                <option value="—">—</option>
                                {SWORDS.map((sw) => <option key={sw.name} value={sw.name}>{sw.name}</option>)}
                              </select>
                            </div>
                            <div className="grid grid-cols-2 items-center gap-2">
                              <span className="text-white/40 font-semibold">Shield</span>
                              <select
                                className="bg-[#03050b] border border-white/[0.04] text-white/80 rounded px-2 py-1.5 outline-none text-xs cursor-pointer font-mono"
                                value={favShield}
                                onChange={(e) => setFavShield(e.target.value)}
                              >
                                <option value="—">—</option>
                                {SHIELDS.map((sh) => <option key={sh.name} value={sh.name}>{sh.name}</option>)}
                              </select>
                            </div>
                            <div className="grid grid-cols-2 items-center gap-2">
                              <span className="text-white/40 font-semibold">Pet Companion</span>
                              <input
                                type="text"
                                className="bg-[#03050b] border border-white/[0.04] text-white/80 rounded px-2 py-1.5 outline-none text-xs font-mono"
                                placeholder="Favorite Pet"
                                value={favPet}
                                onChange={(e) => setFavPet(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Personal Notes */}
                        <div className="border border-white/[0.04] p-5 rounded-xl glass-panel space-y-3">
                          <h4 className="text-[9px] uppercase tracking-widest text-amber-400 font-black font-display">Notes & Strategy</h4>
                          <textarea
                            className="w-full bg-[#03050b] border border-white/[0.04] focus:border-amber-500/30 text-white/80 text-xs font-mono p-3 rounded-lg outline-none min-h-[90px] resize-none"
                            placeholder="Store custom builds, boss strategy or target logs..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                          />
                          <button
                            onClick={saveProfileDetails}
                            disabled={savingProfile}
                            className="w-full py-2.5 rounded-lg button-gold text-xs font-black cursor-pointer"
                          >
                            {savingProfile ? "Saving Profile..." : "Sync Details"}
                          </button>
                        </div>

                        {/* Achievements badges */}
                        <div className="border border-white/[0.04] p-5 rounded-xl glass-panel space-y-4">
                          <h4 className="text-[9px] uppercase tracking-widest text-amber-400 font-black font-display">Unlocked Badges</h4>
                          <div className="grid grid-cols-2 gap-3">
                            {BADGES.map((badge) => {
                              const isUnlocked = achievements.some((a) => a.badgeCode === badge.code);
                              return (
                                <div
                                  key={badge.code}
                                  className={`p-3 rounded-lg border text-left flex gap-3 items-center transition-all ${
                                    isUnlocked
                                      ? "bg-amber-500/5 border-amber-500/20 shadow-[0_0_15px_rgba(0,240,255,0.02)]"
                                      : "bg-white/[0.01] border-white/5 opacity-35"
                                  }`}
                                >
                                  <span className="text-2xl filter drop-shadow-sm">{badge.icon}</span>
                                  <div className="min-w-0">
                                    <div className="text-xs font-black text-white font-display truncate">{badge.label}</div>
                                    <div className="text-[8px] text-white/40 leading-tight mt-0.5 truncate">{badge.desc}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Progression Timeline List */}
                        <div className="border border-white/[0.04] p-5 rounded-xl glass-panel space-y-3">
                          <h4 className="text-[9px] uppercase tracking-widest text-amber-400 font-black font-display">Grade Scan Log</h4>
                          {history.length === 0 ? (
                            <p className="text-xs text-white/30 text-center py-4">No scans saved yet.</p>
                          ) : (
                            <div className="divide-y divide-white/[0.02] text-xs font-mono max-h-48 overflow-y-auto pr-1">
                              {history.map((h, i) => (
                                <div key={i} className="flex justify-between py-2 items-center">
                                  <span className="text-white/40">{h.date}</span>
                                  <span className="text-white/60 font-bold">Lvl {h.level.toLocaleString()}</span>
                                  <span className="font-black text-amber-400">{h.grade}</span>
                                  <span className="text-white/80 font-bold">Score: {h.score}%</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="pt-4 border-t border-white/[0.04] space-y-4">
              {isLoggedIn && (
                <button
                  onClick={logout}
                  className="w-full py-3 rounded-lg border border-red-500/20 hover:border-red-500/40 text-red-400 hover:bg-red-500/5 text-xs font-black tracking-widest uppercase transition-all cursor-pointer"
                >
                  Log Out
                </button>
              )}
              <p className="text-center text-white/20 text-[8px] uppercase font-bold tracking-wider">
                SMGrade Companion Platform © 2026
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
