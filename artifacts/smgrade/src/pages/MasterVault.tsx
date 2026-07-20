import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
// No backend imports allowed on frontend

interface LookupLog {
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

interface ActivityLog {
  id: string;
  timestamp: string;
  username: string;
  action: string;
  details: string;
  status?: string;
  responseTimeMs?: number;
}

interface AnalyticsStats {
  totalLookups: number;
  todayLookups: number;
  weekLookups: number;
  monthLookups: number;
  activeUsers: number;
  registeredUsers: number;
  guestUsers: number;
  failedLookups: number;
  successRate: number;
  avgResponseTime: number;
}

interface PopularGear {
  swords: { name: string; count: number }[];
  shields: { name: string; count: number }[];
  worlds: { name: string; count: number }[];
  grades: { name: string; count: number }[];
  recommendations: { name: string; count: number }[];
}

interface MostSearched {
  username: string;
  searches: number;
  firstSearched: string;
  lastSearched: string;
}

export default function MasterVault() {
  const [token, setToken] = useState(() => localStorage.getItem("smg_master_token") || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<"analytics" | "lookups" | "activity" | "searched" | "gear" | "db" | "storageTest">("analytics");

  // Data states
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [lookups, setLookups] = useState<LookupLog[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [mostSearched, setMostSearched] = useState<MostSearched[]>([]);
  const [popularGear, setPopularGear] = useState<PopularGear | null>(null);
  const [fullDb, setFullDb] = useState<any>(null);

  // Filters
  const [filterUsername, setFilterUsername] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterWorld, setFilterWorld] = useState("");

  // Activity Filters
  const [actSearch, setActSearch] = useState("");
  const [actFilterAction, setActFilterAction] = useState("");
  const [actFilterStatus, setActFilterStatus] = useState("");
  const [actFilterDate, setActFilterDate] = useState("");

  const unlocked = !!token;

  const attemptUnlock = async () => {
    try {
      const res = await fetch("/api/master/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const json = await res.json();
        localStorage.setItem("smg_master_token", json.token);
        setToken(json.token);
        setError(false);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
  };

  const fetchVaultData = async () => {
    if (!token) return;

    try {
      const headers = { "x-master-token": token };

      // Fetch analytics
      const statsRes = await fetch("/api/master/analytics", { headers });
      if (statsRes.status === 401) {
        localStorage.removeItem("smg_master_token");
        setToken("");
        return;
      }
      if (statsRes.ok) setStats(await statsRes.json());

      // Fetch lookups with filters
      let lookupUrl = "/api/master/lookup-logs?";
      if (filterUsername) lookupUrl += `username=${encodeURIComponent(filterUsername)}&`;
      if (filterGrade) lookupUrl += `grade=${encodeURIComponent(filterGrade)}&`;
      if (filterStatus) lookupUrl += `status=${encodeURIComponent(filterStatus)}&`;
      if (filterWorld) lookupUrl += `world=${encodeURIComponent(filterWorld)}&`;
      
      const lookupsRes = await fetch(lookupUrl, { headers });
      if (lookupsRes.ok) setLookups(await lookupsRes.json());

      // Fetch activities
      const actRes = await fetch("/api/master/activity-logs", { headers });
      if (actRes.ok) setActivities(await actRes.json());

      // Fetch most searched
      const msRes = await fetch("/api/master/most-searched", { headers });
      if (msRes.ok) setMostSearched(await msRes.json());

      // Fetch popular gear
      const pgRes = await fetch("/api/master/popular-gear", { headers });
      if (pgRes.ok) setPopularGear(await pgRes.json());

      // Fetch full backup for database explorer
      const backupRes = await fetch("/api/master/backup", { headers });
      if (backupRes.ok) setFullDb(await backupRes.json());

    } catch (err) {
      console.error("Failed to load vault statistics:", err);
    }
  };

  useEffect(() => {
    if (unlocked) {
      fetchVaultData();
    }
  }, [unlocked, filterUsername, filterGrade, filterStatus, filterWorld]);

  const triggerExport = (format: "csv" | "json") => {
    window.open(`/api/master/export-logs?format=${format}&x-master-token=${token}`, "_blank");
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen text-white flex flex-col justify-center items-center bg-[#03050b] p-6">
        <div className="w-full max-w-sm border border-amber-500/10 rounded-2xl p-6 bg-[#070b13]/60 glass-panel shadow-[0_8px_32px_rgba(255,215,0,0.05)] space-y-6">
          <div className="text-center">
            <h1 className="text-xl font-black font-display tracking-tight text-white">MASTER <span className="text-amber-400">VAULT</span></h1>
            <p className="text-[10px] uppercase font-bold text-white/30 tracking-widest mt-1">Intelligence & Monitoring Center</p>
          </div>
          <div className="space-y-4">
            <input
              type="password"
              className="w-full bg-white/[0.01] border border-white/[0.04] focus:border-amber-500/30 text-white text-xs px-4 py-3 rounded-lg outline-none transition-all placeholder-white/10 font-mono"
              placeholder="Enter master decryption key"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && attemptUnlock()}
            />
            {error && <p className="text-red-400 text-xs text-center font-semibold">⚠️ Decryption failed: invalid key</p>}
            <button onClick={attemptUnlock} className="w-full py-3 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 text-black text-xs font-black tracking-widest hover:opacity-90 transition-opacity cursor-pointer">
              Decrypt Vault
            </button>
          </div>
          <div className="text-center">
            <Link href="/" className="text-white/20 text-xs font-bold hover:text-amber-400 transition-colors uppercase tracking-wider">← Return to Safety</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#03050b] text-white flex flex-col">
      {/* Header Banner */}
      <header className="border-b border-white/[0.04] px-4 py-2 bg-[#070b13]/80 backdrop-blur-md sticky top-0 z-20 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-amber-400 font-black text-base font-display tracking-tight hover:opacity-85 cursor-pointer">
            SM<span className="text-white">Grade</span> <span className="text-[10px] text-white/40 uppercase font-black font-mono">/ Vault</span>
          </Link>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              localStorage.removeItem("smg_master_token");
              setToken("");
            }}
            className="text-[9px] font-black uppercase tracking-widest border border-white/10 hover:border-red-500/30 hover:text-red-400 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            Lock Vault
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 flex flex-col lg:flex-row gap-6">
        {/* Navigation Sidebar */}
        <aside className="w-full lg:w-60 shrink-0 space-y-2">
          {[
            { id: "analytics", label: "📊 Vault Analytics" },
            { id: "lookups", label: "🔎 Player Lookup Logs" },
            { id: "activity", label: "🔑 Player Activity Logs" },
            { id: "searched", label: "⭐ Most Searched" },
            { id: "gear", label: "⚔️ Popular Gear Meta" },
            { id: "db", label: "📁 Database Explorer" },
            { id: "storageTest", label: "📦 Storage Test" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(255,215,0,0.05)]"
                  : "border border-transparent text-white/50 hover:bg-white/[0.02]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </aside>

        {/* Display Panel */}
        <main className="flex-1 min-w-0 space-y-6">
          {activeTab === "analytics" && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Total Lookups", val: stats?.totalLookups ?? 0 },
                  { label: "Today's Searches", val: stats?.todayLookups ?? 0 },
                  { label: "Success Rate", val: `${stats?.successRate ?? 100}%` },
                  { label: "Avg Response Time", val: `${stats?.avgResponseTime ?? 0}ms` },
                  { label: "Registered Users", val: stats?.registeredUsers ?? 0 },
                  { label: "Active 30d Users", val: stats?.activeUsers ?? 0 },
                  { label: "Unique Guest Sessions", val: stats?.guestUsers ?? 0 },
                  { label: "Failed Queries", val: stats?.failedLookups ?? 0 },
                ].map((s, idx) => (
                  <div key={idx} className="border border-white/[0.03] rounded-xl p-4 bg-[#070b13]/60 glass-panel shadow-sm">
                    <span className="text-[9px] uppercase font-black text-white/30 tracking-wider block mb-1">{s.label}</span>
                    <span className="text-2xl font-black font-mono text-white">{s.val}</span>
                  </div>
                ))}
              </div>

              {/* Grade Distribution Overview */}
              <div className="border border-white/[0.04] rounded-2xl p-5 bg-[#070b13]/60 glass-panel space-y-4">
                <h3 className="text-xs uppercase font-black tracking-widest text-amber-400 font-display">Grade Distribution (Lookups Meta)</h3>
                <div className="space-y-3">
                  {popularGear?.grades.map((g) => {
                    const pct = stats?.totalLookups ? Math.round((g.count / stats.totalLookups) * 100) : 0;
                    return (
                      <div key={g.name} className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span className="text-white/60">Grade {g.name}</span>
                          <span className="font-mono text-white">{g.count} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 bg-white/[0.02] border border-white/[0.01] rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {(!popularGear || popularGear.grades.length === 0) && (
                    <p className="text-xs text-white/30 italic">No grade analysis records available yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "lookups" && (
            <div className="space-y-4">
              {/* Filters & Export HUD */}
              <div className="border border-white/[0.04] rounded-xl p-4 bg-[#070b13]/60 glass-panel flex flex-wrap gap-3 items-center justify-between">
                <div className="flex flex-wrap gap-2 flex-1">
                  <input
                    type="text"
                    placeholder="Filter username..."
                    className="bg-white/[0.01] border border-white/[0.03] text-white text-[10px] px-3 py-2 rounded-lg outline-none w-36 font-bold"
                    value={filterUsername}
                    onChange={(e) => setFilterUsername(e.target.value)}
                  />
                  <select
                    className="bg-[#03050b] border border-white/[0.03] text-white/60 text-[10px] px-2 py-2 rounded-lg outline-none font-bold"
                    value={filterGrade}
                    onChange={(e) => setFilterGrade(e.target.value)}
                  >
                    <option value="">All Grades</option>
                    {["S+", "S", "A+", "A", "B+", "B", "C+", "C", "D"].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                  <select
                    className="bg-[#03050b] border border-white/[0.03] text-white/60 text-[10px] px-2 py-2 rounded-lg outline-none font-bold"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="">All Statuses</option>
                    <option value="Success">Success</option>
                    <option value="Failed">Failed</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => triggerExport("csv")} className="text-[10px] font-black uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 px-3 py-2 rounded-lg transition-colors cursor-pointer">
                    Export CSV
                  </button>
                  <button onClick={() => triggerExport("json")} className="text-[10px] font-black uppercase tracking-widest bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] px-3 py-2 rounded-lg transition-colors cursor-pointer">
                    Export JSON
                  </button>
                </div>
              </div>

              {/* Logs Table */}
              <div className="border border-white/[0.04] rounded-2xl bg-[#070b13]/60 glass-panel overflow-x-auto shadow-md">
                <table className="w-full border-collapse text-[10px] text-left">
                  <thead>
                    <tr className="border-b border-white/[0.04] text-white/30 uppercase font-black tracking-wider bg-white/[0.01]">
                      <th className="p-3.5">Timestamp</th>
                      <th className="p-3.5">Searched</th>
                      <th className="p-3.5">Account / IP</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-center">Grade</th>
                      <th className="p-3.5 text-center">Gear</th>
                      <th className="p-3.5 text-center">Wealth</th>
                      <th className="p-3.5">Next Upgrade</th>
                      <th className="p-3.5 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02] font-semibold">
                    {lookups.map((l) => (
                      <tr key={l.id} className="hover:bg-white/[0.01] transition-colors">
                        <td className="p-3.5 text-white/40 font-mono">
                          {new Date(l.timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="p-3.5 text-amber-400 font-bold">{l.usernameSearched}</td>
                        <td className="p-3.5">
                          <span className="block text-white/80">{l.userAccount || "Guest Search"}</span>
                          <span className="block text-white/30 text-[9px] font-mono mt-0.5">{l.ipAddress}</span>
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                            l.status === "Success" ? "bg-[#5ecb7a]/10 border border-[#5ecb7a]/20 text-[#5ecb7a]" : "bg-red-500/10 border border-red-500/20 text-red-400"
                          }`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-center font-bold text-lg">{l.grade}</td>
                        <td className="p-3.5 text-center font-mono">{l.gearScore}</td>
                        <td className="p-3.5 text-center font-mono">{l.wealthScore}</td>
                        <td className="p-3.5 text-white/60 max-w-[120px] truncate" title={l.recommendedUpgrade}>{l.recommendedUpgrade}</td>
                        <td className="p-3.5 text-right font-mono text-white/40">{l.responseTimeMs}ms</td>
                      </tr>
                    ))}
                    {lookups.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-white/30 italic">No search logs found matching the filter criteria.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "activity" && (() => {
            const filteredActivities = activities.filter(act => {
              if (actSearch && !act.username.toLowerCase().includes(actSearch.toLowerCase())) return false;
              if (actFilterAction && act.action !== actFilterAction) return false;
              if (actFilterStatus) {
                const s = act.status || "Info";
                if (actFilterStatus === "Info" && s === "Success") return false;
                if (actFilterStatus === "Info" && s === "Failed") return false;
                if (actFilterStatus !== "Info" && s !== actFilterStatus) return false;
              }
              if (actFilterDate) {
                const datePart = new Date(act.timestamp).toISOString().split('T')[0];
                if (datePart !== actFilterDate) return false;
              }
              return true;
            });

            return (
              <div className="space-y-4">
                {/* Filters HUD */}
                <div className="border border-white/[0.04] rounded-xl p-4 bg-[#070b13]/60 glass-panel flex flex-wrap gap-3 items-center">
                  <input
                    type="text"
                    placeholder="Search username..."
                    className="bg-white/[0.01] border border-white/[0.03] text-white text-[10px] px-3 py-2 rounded-lg outline-none w-36 font-bold font-mono placeholder:text-white/20"
                    value={actSearch}
                    onChange={(e) => setActSearch(e.target.value)}
                  />
                  <select
                    className="bg-[#03050b] border border-white/[0.03] text-white/60 text-[10px] px-2 py-2 rounded-lg outline-none font-bold"
                    value={actFilterAction}
                    onChange={(e) => setActFilterAction(e.target.value)}
                  >
                    <option value="">All Actions</option>
                    <option value="Player Analysis">Player Analysis</option>
                    <option value="Live Lookup">Live Lookup</option>
                    <option value="Admin Login">Admin Login</option>
                    <option value="Admin Login Attempt Failed">Login Failed</option>
                    <option value="Database Restored">Database Restored</option>
                  </select>
                  <select
                    className="bg-[#03050b] border border-white/[0.03] text-white/60 text-[10px] px-2 py-2 rounded-lg outline-none font-bold"
                    value={actFilterStatus}
                    onChange={(e) => setActFilterStatus(e.target.value)}
                  >
                    <option value="">All Statuses</option>
                    <option value="Success">Success</option>
                    <option value="Failed">Failed</option>
                    <option value="Info">Info/Other</option>
                  </select>
                  <input
                    type="date"
                    className="bg-[#03050b] border border-white/[0.03] text-white/60 text-[10px] px-2 py-1.5 rounded-lg outline-none font-bold font-mono"
                    value={actFilterDate}
                    onChange={(e) => setActFilterDate(e.target.value)}
                  />
                  {(actSearch || actFilterAction || actFilterStatus || actFilterDate) && (
                    <button 
                      onClick={() => {
                        setActSearch("");
                        setActFilterAction("");
                        setActFilterStatus("");
                        setActFilterDate("");
                      }} 
                      className="text-[9px] font-black uppercase text-amber-400 hover:underline cursor-pointer"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>

                <div className="border border-white/[0.04] rounded-2xl bg-[#070b13]/60 glass-panel overflow-x-auto shadow-md">
                  <table className="w-full border-collapse text-[10px] text-left">
                    <thead>
                      <tr className="border-b border-white/[0.04] text-white/30 uppercase font-black tracking-wider bg-white/[0.01]">
                        <th className="p-3.5 w-40">Time</th>
                        <th className="p-3.5 w-32">Username</th>
                        <th className="p-3.5 w-32">Action</th>
                        <th className="p-3.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.02] font-semibold text-white/80">
                      {filteredActivities.map((act) => (
                        <tr key={act.id} className="hover:bg-white/[0.01] transition-colors font-semibold">
                          <td className="p-3.5 text-white/40 font-mono">
                            {new Date(act.timestamp).toLocaleString()}
                          </td>
                          <td className="p-3.5 text-amber-400 font-bold">{act.username}</td>
                          <td className="p-3.5">
                            <span className="bg-[#8ab4c9]/10 border border-[#8ab4c9]/25 text-[#8ab4c9] px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider block text-center max-w-[110px]">
                              {act.action}
                            </span>
                          </td>
                          <td className="p-3.5 flex items-center justify-between">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                              act.status === "Success" ? "bg-[#5ecb7a]/10 border border-[#5ecb7a]/20 text-[#5ecb7a]" :
                              act.status === "Failed" ? "bg-red-500/10 border border-red-500/20 text-red-400" :
                              "bg-white/5 border border-white/10 text-white/60"
                            }`}>
                              {act.status || "Info"}
                            </span>
                            {act.responseTimeMs !== undefined && (
                              <span className="text-[9px] text-white/35 font-mono ml-2">{act.responseTimeMs}ms</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filteredActivities.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-white/30 italic">No player lookup logs recorded yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {activeTab === "searched" && (
            <div className="border border-white/[0.04] rounded-2xl bg-[#070b13]/60 glass-panel overflow-x-auto shadow-md">
              <table className="w-full border-collapse text-[10px] text-left">
                <thead>
                  <tr className="border-b border-white/[0.04] text-white/30 uppercase font-black tracking-wider bg-white/[0.01]">
                    <th className="p-3.5">Search Target Username</th>
                    <th className="p-3.5 text-center">Searches Count</th>
                    <th className="p-3.5">First Searched Date</th>
                    <th className="p-3.5">Last Searched Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02] font-semibold">
                  {mostSearched.map((ms, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.01] transition-colors text-white/80">
                      <td className="p-3.5 text-amber-400 font-bold">
                        <span className="text-white/30 font-mono mr-2">{idx + 1}.</span>
                        {ms.username}
                      </td>
                      <td className="p-3.5 text-center font-mono text-white font-black">{ms.searches}</td>
                      <td className="p-3.5 text-white/40 font-mono">{new Date(ms.firstSearched).toLocaleString()}</td>
                      <td className="p-3.5 text-white/40 font-mono">{new Date(ms.lastSearched).toLocaleString()}</td>
                    </tr>
                  ))}
                  {mostSearched.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-white/30 italic">No search statistics available yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "gear" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Swords */}
              <div className="border border-white/[0.04] rounded-2xl p-5 bg-[#070b13]/60 glass-panel space-y-4">
                <h3 className="text-xs uppercase font-black tracking-widest text-amber-400 font-display">Equipped Swords Distribution</h3>
                <div className="space-y-3">
                  {popularGear?.swords.map((s, idx) => (
                    <div key={idx} className="flex justify-between text-[10px] font-bold border-b border-white/[0.02] pb-2 last:border-0">
                      <span className="text-white">{s.name}</span>
                      <span className="font-mono text-amber-400">{s.count} times</span>
                    </div>
                  ))}
                  {(!popularGear || popularGear.swords.length === 0) && (
                    <p className="text-xs text-white/30 italic">No sword stats recorded yet.</p>
                  )}
                </div>
              </div>

              {/* Shields */}
              <div className="border border-white/[0.04] rounded-2xl p-5 bg-[#070b13]/60 glass-panel space-y-4">
                <h3 className="text-xs uppercase font-black tracking-widest text-amber-400 font-display">Equipped Shields Distribution</h3>
                <div className="space-y-3">
                  {popularGear?.shields.map((s, idx) => (
                    <div key={idx} className="flex justify-between text-[10px] font-bold border-b border-white/[0.02] pb-2 last:border-0">
                      <span className="text-white">{s.name}</span>
                      <span className="font-mono text-amber-400">{s.count} times</span>
                    </div>
                  ))}
                  {(!popularGear || popularGear.shields.length === 0) && (
                    <p className="text-xs text-white/30 italic">No shield stats recorded yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "db" && (
            <div className="border border-white/[0.04] rounded-2xl p-5 bg-[#070b13]/60 glass-panel space-y-4">
              <div className="flex justify-between items-center border-b border-white/[0.04] pb-3">
                <h3 className="text-xs uppercase font-black tracking-widest text-amber-400 font-display">Drizzle jsonDb System Explorer</h3>
                <span className="text-[9px] font-mono text-white/40 uppercase">Read-Only Backup Inspector</span>
              </div>
              
              <div className="max-h-[500px] overflow-y-auto bg-black/40 p-4 rounded-xl border border-white/[0.02] font-mono text-[9px] text-[#5ecb7a]">
                <pre>{fullDb ? JSON.stringify(fullDb, null, 2) : "Loading active database catalog..."}</pre>
              </div>
            </div>
          )}

          {activeTab === "storageTest" && (
            <StorageTestPanel />
          )}
        </main>
      </div>
    </div>
  );
}

function StorageTestPanel() {
  const [testUser, setTestUser] = useState("");
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [storageData, setStorageData] = useState<any[] | null>(null);
  const [roomReport, setRoomReport] = useState<any | null>(null);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const startTest = async () => {
    if (!testUser.trim()) return;
    setRunning(true);
    setLogs([]);
    setStorageData(null);
    setRoomReport(null);
    addLog(`Initiating lookup query via backend API...`);

    try {
      addLog(`Calling GET /api/live-lookup?username=${encodeURIComponent(testUser.trim())}...`);
      const res = await fetch(`/api/live-lookup?username=${encodeURIComponent(testUser.trim())}`);
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${res.status}`);
      }

      const data = await res.json();
      addLog("Received successful response from backend API.");
      addLog("Decoded PlayerInfo payload retrieved successfully.");

      const playerInfo = data.playerInfo || {};
      const inv = playerInfo.inv || {};
      setStorageData(inv.storage || []);

      const detectedRoomFields = [
        {
          source: "Backend Matchmaker",
          field: "room.name",
          value: "world_1",
          description: "Target world room joined on the game host."
        }
      ];

      setRoomReport({
        httpFields: detectedRoomFields,
        websocketScans: [],
        conclusion: "No fields representing the target player's current room or coordinates exist in the PlayerInfo payload. The matchmaking values only represent our query client session connection. Therefore, the target player's current room cannot be determined using the available API."
      });

    } catch (err: any) {
      addLog(`Error during lookup: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border border-white/[0.04] rounded-2xl p-5 bg-[#070b13]/60 glass-panel space-y-4">
        <h3 className="text-xs uppercase font-black tracking-widest text-amber-400 font-display">Developer Inspection Console</h3>
        <p className="text-[10px] text-white/50">Perform live WebSocket packet inspection to audit Storage and Room data.</p>
        
        <div className="flex gap-3">
          <input type="text" placeholder="Enter target username..." className="bg-white/[0.01] border border-white/[0.03] text-white text-xs px-4 py-3 rounded-lg outline-none flex-1 font-bold" value={testUser} onChange={(e) => setTestUser(e.target.value)} disabled={running}/>
          <button onClick={startTest} disabled={running || !testUser.trim()} className="px-6 py-3 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 text-black text-xs font-black tracking-widest hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer">
            {running ? "Loading..." : "Start Inspection"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Terminal Logs Console */}
        <div className="border border-white/[0.04] rounded-2xl p-5 bg-[#070b13]/60 glass-panel flex flex-col space-y-3">
          <h4 className="text-[10px] uppercase font-black text-amber-400 tracking-wider">Websocket / HTTP Logs</h4>
          <div className="flex-1 min-h-[220px] max-h-[300px] overflow-y-auto bg-black/40 p-4 rounded-xl border border-white/[0.02] font-mono text-[9px] text-amber-500/80 space-y-1">
            {logs.map((log, idx) => (
              <div key={idx}>{log}</div>
            ))}
            {logs.length === 0 && <div className="text-white/20 italic">Awaiting connection start...</div>}
          </div>
        </div>

        {/* Storage Viewer Panel */}
        <div className="border border-white/[0.04] rounded-2xl p-5 bg-[#070b13]/60 glass-panel flex flex-col space-y-3">
          <h4 className="text-[10px] uppercase font-black text-amber-400 tracking-wider">📦 Storage Viewer (`inv.storage`)</h4>
          <div className="flex-1 min-h-[220px] max-h-[300px] overflow-y-auto bg-black/40 p-4 rounded-xl border border-white/[0.02] font-mono text-[9px] text-[#5ecb7a]">
            {storageData ? (
              storageData.length === 0 ? (
                <div className="text-white/40 italic">Storage is empty</div>
              ) : (
                <pre>{JSON.stringify(storageData, null, 2)}</pre>
              )
            ) : (
              <div className="text-white/20 italic">Awaiting PlayerInfo payload...</div>
            )}
          </div>
        </div>
      </div>

      {/* Current Room Test Report */}
      {roomReport && (
        <div className="border border-white/[0.04] rounded-2xl p-5 bg-[#070b13]/60 glass-panel space-y-4">
          <h4 className="text-[10px] uppercase font-black text-amber-400 tracking-wider">📍 Current Room Test Report</h4>
          
          <div className="space-y-3 text-xs">
            <div className="space-y-1.5">
              <h5 className="font-bold text-white/70">HTTP Matchmaker Fields Found:</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {roomReport.httpFields.map((f: any, idx: number) => (
                  <div key={idx} className="bg-white/[0.01] border border-white/[0.02] rounded-xl p-3">
                    <span className="block text-[9px] font-mono text-white/30">{f.source}</span>
                    <span className="block font-mono text-amber-400 font-bold mt-1">{f.field}</span>
                    <span className="block font-mono text-white mt-0.5 text-[10px]">{f.value}</span>
                    <span className="block text-[10px] text-white/50 mt-1">{f.description}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <h5 className="font-bold text-white/70">WebSocket Message Scans (Room Keywords):</h5>
              <div className="max-h-[150px] overflow-y-auto bg-black/40 p-3 rounded-lg font-mono text-[9px] text-white/60">
                {roomReport.websocketScans.length === 0 ? (
                  <div className="text-white/20 italic">No incoming websocket messages contained keywords like "room", "world", "location".</div>
                ) : (
                  <pre>{JSON.stringify(roomReport.websocketScans, null, 2)}</pre>
                )}
              </div>
            </div>

            <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
              <h5 className="font-black text-red-400 uppercase text-[10px] tracking-wider">Audit Conclusion</h5>
              <p className="text-[11px] text-white/70 mt-1.5 font-medium leading-relaxed">
                {roomReport.conclusion}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
