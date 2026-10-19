import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";

interface MasterVaultProps {
  token: string;
  onLock: () => void;
}

interface UserAdminInfo {
  id: string;
  username: string;
  role: "owner" | "admin" | "moderator" | "viewer";
  status: "active" | "suspended";
  totalAnalyses: number;
  highestGrade: string;
  lastLogin: string;
  createdAt: string;
}

interface LookupLogEntry {
  id: string;
  timestamp: string;
  usernameSearched: string;
  ipAddress: string;
  status: string;
}

interface ActivityLogEntry {
  id: string;
  timestamp: string;
  username: string;
  action: string;
  details: string;
  status?: string;
  responseTimeMs?: number;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
}

interface SystemHealthInfo {
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  totalUsers: number;
  totalHistoryEntries: number;
  totalLogs: number;
  nodeVersion: string;
  platform: string;
}

export default function MasterVaultConsole({ token, onLock }: MasterVaultProps) {
  const [activeTab, setActiveTab] = useState<"analytics" | "logins" | "audits" | "backup" | "health">("analytics");
  
  // States for analytics dashboard
  const [analytics, setAnalytics] = useState<any>(null);
  const [popularGear, setPopularGear] = useState<any>(null);
  const [mostSearched, setMostSearched] = useState<any[]>([]);

  // States for logs
  const [activities, setActivities] = useState<any[]>([]);
  const [actSearch, setActSearch] = useState("");
  const [actSearchInput, setActSearchInput] = useState("");
  const [actFilterAction, setActFilterAction] = useState("");
  const [actFilterStatus, setActFilterStatus] = useState("");
  const [actFilterDate, setActFilterDate] = useState("");

  const [audits, setAudits] = useState<AuditLogEntry[]>([]);
  
  // Backup states
  const [backupJson, setBackupJson] = useState("");
  const [restoreJson, setRestoreJson] = useState("");
  const [backupMessage, setBackupMessage] = useState("");
  const [restoreMessage, setRestoreMessage] = useState("");
  const [restoreError, setRestoreError] = useState("");

  // Health states
  const [health, setHealth] = useState<SystemHealthInfo | null>(null);

  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setActSearch(actSearchInput);
    }, 350);
    return () => clearTimeout(timer);
  }, [actSearchInput]);

  useEffect(() => {
    loadTabContent();
  }, [activeTab, actSearch]);

  async function loadTabContent() {
    setLoading(true);
    setActionError("");
    setActionMessage("");
    try {
      const headers = { "x-master-token": token };
      if (activeTab === "analytics") {
        const res = await fetch("/api/master/analytics", { headers });
        if (res.status === 401) { onLock(); return; }
        if (res.ok) setAnalytics(await res.json());
        const pgRes = await fetch("/api/master/popular-gear", { headers });
        if (pgRes.ok) setPopularGear(await pgRes.json());
        const msRes = await fetch("/api/master/most-searched", { headers });
        if (msRes.ok) setMostSearched(await msRes.json());
      } else if (activeTab === "logins") {
        const queryUrl = `/api/master/lookup-logs?q=${encodeURIComponent(actSearch)}`;
        const res = await fetch(queryUrl, { headers });
        if (res.status === 401) { onLock(); return; }
        if (res.ok) setActivities(await res.json());
      } else if (activeTab === "audits") {
        const res = await fetch("/api/master/audit-logs", { headers });
        if (res.status === 401) { onLock(); return; }
        if (res.ok) setAudits(await res.json());
      } else if (activeTab === "health") {
        const res = await fetch("/api/master/health", { headers });
        if (res.status === 401) { onLock(); return; }
        if (res.ok) setHealth(await res.json());
      }
    } catch {
      setActionError("Failed to fetch master data.");
    } finally {
      setLoading(false);
    }
  }

  async function handleBackup() {
    setBackupMessage("");
    try {
      const res = await fetch("/api/master/backup", {
        headers: { "x-master-token": token },
      });
      if (res.ok) {
        const data = await res.json();
        const str = JSON.stringify(data, null, 2);
        setBackupJson(str);
        setBackupMessage("Full database export generated successfully.");
      }
    } catch {
      setActionError("Failed to fetch database backup.");
    }
  }

  async function handleRestore() {
    setRestoreMessage("");
    setRestoreError("");
    if (!restoreJson.trim()) {
      setRestoreError("Please paste your backup JSON file above first.");
      return;
    }

    try {
      const parsed = JSON.parse(restoreJson);
      const res = await fetch("/api/master/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-master-token": token },
        body: JSON.stringify({ dbData: parsed }),
      });
      if (res.ok) {
        setRestoreMessage("Full database restored successfully from backup.");
        setRestoreJson("");
      } else {
        const err = await res.json() as { error?: string };
        setRestoreError(err.error || "Failed to restore database.");
      }
    } catch (e) {
      setRestoreError("Invalid JSON structure. Please check backup formatting.");
    }
  }

  async function handleDeleteLogs(type: "activity" | "audit" | "lookup" | "all") {
    const messages = {
      activity: "Are you sure you want to permanently delete all player activity logs?",
      audit: "Are you sure you want to permanently delete all system audit logs?",
      lookup: "Are you sure you want to permanently delete all player lookup logs?",
      all: "WARNING: Are you sure you want to permanently delete ALL activity, lookup, and system audit logs?"
    };
    if (!window.confirm(messages[type])) return;
    
    try {
      const endpoints = {
        activity: "/api/master/logs/delete-player-activity",
        audit: "/api/master/logs/delete-system-audit",
        lookup: "/api/master/logs/delete-lookup-logs",
        all: "/api/master/logs/delete-all-logs"
      };
      
      const res = await fetch(endpoints[type], {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-master-token": token 
        }
      });
      if (res.ok) {
        alert("Logs deleted successfully.");
        loadTabContent();
      } else {
        const errData = await res.json();
        alert("Failed to delete logs: " + (errData.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Network error: " + err.message);
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
        <div>
          <h2 className="text-base font-black text-[#ffd700] font-display">MASTER VAULT CONSOLE</h2>
          <p className="text-white/35 text-[8px] uppercase font-bold">Owner Security Command Terminal</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onLock}
            className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[10px] font-bold transition-all cursor-pointer"
          >
            Lock Vault
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.04] gap-2 overflow-x-auto pb-1">
        {[
          { id: "analytics", label: "Analytics Dashboard" },
          { id: "logins", label: "Player Activity Logs" },
          { id: "audits", label: "System Audits" },
          { id: "backup", label: "Backup & Restore" },
          { id: "health", label: "System Health" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-2 px-4 font-bold text-xs uppercase tracking-widest border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? "border-amber-400 text-amber-400 font-black"
                : "border-transparent text-white/40 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {actionError && <p className="text-red-400 text-xs font-semibold bg-red-950/20 border border-red-950/60 px-4 py-3 rounded-lg">⚠️ {actionError}</p>}
      {actionMessage && <p className="text-[#5ecb7a] text-xs font-semibold bg-[#5ecb7a]/5 border border-[#5ecb7a]/15 px-4 py-3 rounded-lg">✓ {actionMessage}</p>}

      {/* Tab Contents */}
      <div className="min-h-[300px]">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-6 h-6 rounded-full border-2 border-amber-500/25 border-t-amber-400 animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === "analytics" && analytics && (
              <div className="space-y-6">
                {/* Stats Cards Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Analyses Today", val: analytics.todayLookups },
                    { label: "Analyses This Week", val: analytics.weekLookups },
                    { label: "Total Stored", val: analytics.totalLookups },
                    { label: "Live Lookups", val: `${analytics.successfulLiveLookups} / ${analytics.liveLookupsCount}` },
                    { label: "Avg Grade", val: analytics.avgGrade },
                    { label: "Avg Response Time", val: `${analytics.avgResponseTime}ms` },
                    { label: "Success Rate", val: `${analytics.successRate}%` },
                    { label: "Last Analysis", val: analytics.lastAnalysisTime ? new Date(analytics.lastAnalysisTime).toLocaleDateString() : "Never" },
                  ].map((s, idx) => (
                    <div key={idx} className="border border-white/[0.03] rounded-xl p-4 bg-[#070b13]/60 glass-panel shadow-sm">
                      <span className="text-[9px] uppercase font-black text-white/30 tracking-wider block mb-1">{s.label}</span>
                      <span className="text-xl font-black font-mono text-white">{s.val}</span>
                    </div>
                  ))}
                </div>

                {/* Grade Distribution Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="border border-white/[0.04] rounded-2xl p-5 bg-[#070b13]/60 glass-panel space-y-4">
                    <h3 className="text-xs uppercase font-black tracking-widest text-amber-400 font-display">Grade Distribution</h3>
                    <div className="space-y-3">
                      {popularGear?.grades?.map((g: any) => {
                        const pct = analytics?.totalLookups ? Math.round((g.count / analytics.totalLookups) * 100) : 0;
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
                      {(!popularGear?.grades || popularGear.grades.length === 0) && (
                        <p className="text-xs text-white/30 italic">No grade analysis records available yet.</p>
                      )}
                    </div>
                  </div>

                  {/* Most Searched Usernames */}
                  <div className="border border-white/[0.04] rounded-2xl p-5 bg-[#070b13]/60 glass-panel space-y-4">
                    <h3 className="text-xs uppercase font-black tracking-widest text-amber-400 font-display">Most Searched Players</h3>
                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 font-semibold text-xs text-white/80">
                      {mostSearched.slice(0, 5).map((ms, idx) => (
                        <div key={idx} className="flex justify-between text-[10px] font-bold border-b border-white/[0.02] pb-2 last:border-0">
                          <span className="text-white font-bold">{ms.username}</span>
                          <span className="font-mono text-amber-400">{ms.searches} searches</span>
                        </div>
                      ))}
                      {mostSearched.length === 0 && (
                        <p className="text-xs text-white/30 italic">No search statistics available yet.</p>
                      )}
                    </div>
                  </div>

                  {/* Top Gear Meta */}
                  <div className="border border-white/[0.04] rounded-2xl p-5 bg-[#070b13]/60 glass-panel space-y-4">
                    <h3 className="text-xs uppercase font-black tracking-widest text-amber-400 font-display">Popular Weapons Meta</h3>
                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 font-semibold text-xs text-white/80">
                      {popularGear?.swords?.slice(0, 5).map((s: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-[10px] font-bold border-b border-white/[0.02] pb-2 last:border-0">
                          <span className="text-white">{s.name}</span>
                          <span className="font-mono text-amber-400">{s.count} times</span>
                        </div>
                      ))}
                      {(!popularGear?.swords || popularGear.swords.length === 0) && (
                        <p className="text-xs text-white/30 italic">No sword stats recorded yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "logins" && (() => {
              const filteredActivities = activities.filter(act => {
                if (actSearch && !act.usernameSearched?.toLowerCase().includes(actSearch.toLowerCase())) return false;
                if (actFilterStatus && act.grade !== actFilterStatus) return false;
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
                      placeholder="Search username, IP (e.g. 49.204), date (2026-09-01 or 01/09/2026), grade..."
                      className="bg-white/[0.01] border border-white/[0.03] text-white text-[10px] px-3 py-2 rounded-lg outline-none w-96 font-bold font-mono placeholder:text-white/30"
                      value={actSearchInput}
                      onChange={(e) => setActSearchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setActSearch(actSearchInput);
                        }
                      }}
                    />
                    <select
                      className="bg-[#03050b] border border-white/[0.03] text-white/60 text-[10px] px-2 py-2 rounded-lg outline-none font-bold"
                      value={actFilterStatus}
                      onChange={(e) => setActFilterStatus(e.target.value)}
                    >
                      <option value="">All Grades</option>
                      <option value="S+">S+</option>
                      <option value="S">S</option>
                      <option value="A+">A+</option>
                      <option value="A">A</option>
                      <option value="B+">B+</option>
                      <option value="B">B</option>
                      <option value="C+">C+</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                      <option value="F">F</option>
                    </select>
                    <input
                      type="date"
                      className="bg-[#03050b] border border-white/[0.03] text-white/60 text-[10px] px-2 py-1.5 rounded-lg outline-none font-bold font-mono"
                      value={actFilterDate}
                      onChange={(e) => setActFilterDate(e.target.value)}
                    />
                    {(actSearchInput || actSearch || actFilterStatus || actFilterDate) && (
                      <button 
                        onClick={() => {
                          setActSearchInput("");
                          setActSearch("");
                          setActFilterStatus("");
                          setActFilterDate("");
                        }} 
                        className="text-[9px] font-black uppercase text-amber-400 hover:underline cursor-pointer"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>

                  <div className="border border-white/[0.04] rounded-xl overflow-hidden bg-white/[0.01] glass-panel">
                    <div className="grid grid-cols-6 px-4 py-3 border-b border-white/[0.04] bg-white/[0.01] text-[9px] uppercase tracking-widest font-black text-white/30">
                      <span>Timestamp</span>
                      <span>Username</span>
                      <span className="text-center">IP Address</span>
                      <span className="text-center">Grade</span>
                      <span className="text-center">Overall %</span>
                      <span className="text-right">Level</span>
                    </div>
                    <div className="divide-y divide-white/[0.02] text-xs max-h-[400px] overflow-y-auto pr-1 font-semibold text-white/80">
                      {filteredActivities.length === 0 ? (
                        <div className="text-center text-white/20 py-8">No player lookup logs recorded.</div>
                      ) : (
                        filteredActivities.map((act) => {
                          const overallPct = Math.round(
                            (act.gearScore || 0) * 0.25 + 
                            (act.powerScore || 0) * 0.60 + 
                            (act.wealthScore || 0) * 0.05 + 
                            (act.progressionScore || 0) * 0.10
                          );
                          const extractedIp = act.ipAddress || (act.details && act.details.includes("IP: ") ? act.details.split("IP: ")[1] : null) || "N/A";
                          return (
                            <div key={act.id} className="grid grid-cols-6 px-4 py-3 items-center">
                              <span className="text-white/40 font-mono">{new Date(act.timestamp).toLocaleString()}</span>
                              <span className="font-bold text-amber-400">{act.usernameSearched || act.username || "Unknown"}</span>
                              <span className="text-center font-mono">
                                <span className="inline-block px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono text-[9px] font-bold tracking-wide">
                                  {extractedIp}
                                </span>
                              </span>
                              <span className="text-center">
                                <span className="inline-block bg-amber-500/10 border border-amber-500/25 text-amber-400 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider">
                                  {act.grade || "N/A"}
                                </span>
                              </span>
                              <span className="text-center text-white/70 font-mono font-bold">
                                {overallPct}%
                              </span>
                              <span className="text-right text-white/40 font-mono">
                                Lvl {act.playerLevel?.toLocaleString() || 0}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {activeTab === "audits" && (
              <div className="border border-white/[0.04] rounded-xl overflow-hidden bg-white/[0.01] glass-panel">
                <div className="grid grid-cols-4 px-4 py-3 border-b border-white/[0.04] bg-white/[0.01] text-[9px] uppercase tracking-widest font-black text-white/30">
                  <span>Timestamp</span>
                  <span className="text-center">Actor</span>
                  <span className="text-center">Action</span>
                  <span className="text-right">Details</span>
                </div>
                <div className="divide-y divide-white/[0.02] text-xs max-h-[400px] overflow-y-auto pr-1">
                  {audits.length === 0 ? (
                    <div className="text-center text-white/20 py-8">No audit logs recorded.</div>
                  ) : (
                    audits.map((ad) => (
                      <div key={ad.id} className="grid grid-cols-4 px-4 py-3 items-center">
                        <span className="text-white/40 font-mono">{new Date(ad.timestamp).toLocaleString()}</span>
                        <span className="text-center font-bold text-amber-400">{ad.actor}</span>
                        <span className="text-center font-black text-white">{ad.action}</span>
                        <span className="text-right text-white/60 font-sans truncate pl-2" title={ad.details}>{ad.details}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === "backup" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Export Backup */}
                  <div className="border border-white/[0.04] p-5 rounded-xl glass-panel space-y-4">
                    <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider">Export JSON Database</h3>
                    <p className="text-xs text-white/40 leading-relaxed">Click below to generate a full state JSON dump of registered users, progress histories, and audit records.</p>
                    
                    <button onClick={handleBackup} className="px-5 py-3 rounded-lg button-gold text-xs font-black">Generate Export</button>
                    
                    {backupMessage && <p className="text-[#5ecb7a] text-xs font-bold">✓ {backupMessage}</p>}
                    {backupJson && (
                      <textarea
                        readOnly
                        className="w-full bg-[#03050b] border border-white/[0.04] text-white/70 text-[10px] font-mono p-3 rounded-lg outline-none min-h-[160px]"
                        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                        value={backupJson}
                      />
                    )}
                  </div>

                  {/* Import Restore */}
                  <div className="border border-white/[0.04] p-5 rounded-xl glass-panel space-y-4">
                    <h3 className="text-sm font-black text-red-400 uppercase tracking-wider">Import / Restore Backup</h3>
                    <p className="text-xs text-white/40 leading-relaxed">Paste your saved database JSON string export. Warning: This overrides all existing user stats and profiles completely.</p>
                    
                    <textarea
                      className="w-full bg-[#03050b] border border-white/[0.04] text-white/70 text-[10px] font-mono p-3 rounded-lg outline-none min-h-[120px] resize-none"
                      placeholder="Paste database JSON here..."
                      value={restoreJson}
                      onChange={(e) => setRestoreJson(e.target.value)}
                    />

                    {restoreError && <p className="text-red-400 text-xs font-semibold">⚠️ {restoreError}</p>}
                    {restoreMessage && <p className="text-[#5ecb7a] text-xs font-semibold">✓ {restoreMessage}</p>}

                    <button onClick={handleRestore} className="px-5 py-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-bold transition-all cursor-pointer">Restore Database</button>
                  </div>
                </div>

                {/* Log Management Section */}
                <div className="border border-white/[0.04] rounded-2xl p-5 bg-[#070b13]/60 glass-panel space-y-4">
                  <div className="flex justify-between items-center border-b border-white/[0.04] pb-3">
                    <h3 className="text-xs uppercase font-black tracking-widest text-red-400 font-display font-bold">System Log Management</h3>
                    <span className="text-[9px] font-mono text-white/40 uppercase">Danger Zone</span>
                  </div>
                  <p className="text-[11px] text-white/40 leading-relaxed font-semibold">
                    Perform administrative database cleanup operations. Each action requires confirmation.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => handleDeleteLogs("activity")} className="px-4 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 text-red-400 text-[10px] uppercase font-black tracking-wider transition-all cursor-pointer font-bold">
                      Delete Player Activity Logs
                    </button>
                    <button onClick={() => handleDeleteLogs("audit")} className="px-4 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 text-red-400 text-[10px] uppercase font-black tracking-wider transition-all cursor-pointer font-bold">
                      Delete System Audit Logs
                    </button>
                    <button onClick={() => handleDeleteLogs("lookup")} className="px-4 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 text-red-400 text-[10px] uppercase font-black tracking-wider transition-all cursor-pointer font-bold">
                      Delete Lookup Logs
                    </button>
                    <button onClick={() => handleDeleteLogs("all")} className="px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] uppercase font-black tracking-wider transition-all cursor-pointer font-bold">
                      Delete All Logs
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "health" && health && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-white/[0.04] p-5 rounded-xl glass-panel space-y-3.5">
                  <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider">Runtime Stats</h3>
                  <div className="space-y-2 text-xs font-medium">
                    <div className="flex justify-between border-b border-white/[0.02] pb-1.5">
                      <span className="text-white/40">Node Uptime</span>
                      <span className="font-mono text-white">{(health.uptime / 3600).toFixed(2)} Hours</span>
                    </div>
                    <div className="flex justify-between border-b border-white/[0.02] pb-1.5">
                      <span className="text-white/40">Registered Users</span>
                      <span className="font-mono text-white">{health.totalUsers}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/[0.02] pb-1.5">
                      <span className="text-white/40">Total Analysis Records</span>
                      <span className="font-mono text-white">{health.totalHistoryEntries}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">System Audit Logs</span>
                      <span className="font-mono text-white">{health.totalLogs}</span>
                    </div>
                  </div>
                </div>

                <div className="border border-white/[0.04] p-5 rounded-xl glass-panel space-y-3.5">
                  <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider">Memory Allocation</h3>
                  <div className="space-y-2 text-xs font-medium">
                    <div className="flex justify-between border-b border-white/[0.02] pb-1.5">
                      <span className="text-white/40">Resident Set Size (RSS)</span>
                      <span className="font-mono text-white">{formatBytes(health.memory.rss)}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/[0.02] pb-1.5">
                      <span className="text-white/40">Heap Total</span>
                      <span className="font-mono text-white">{formatBytes(health.memory.heapTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Heap Used</span>
                      <span className="font-mono text-[#5ecb7a]">{formatBytes(health.memory.heapUsed)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </>
        )}
      </div>
    </div>
  );
}

