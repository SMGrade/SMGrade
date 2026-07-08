import { useState, useEffect } from "react";
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
  const [activeTab, setActiveTab] = useState<"users" | "logins" | "audits" | "backup" | "health">("users");
  
  // States for user management
  const [users, setUsers] = useState<UserAdminInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState<UserAdminInfo | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<string>("viewer");

  // States for logs
  const [logins, setLogins] = useState<LookupLogEntry[]>([]);
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

  useEffect(() => {
    loadTabContent();
  }, [activeTab]);

  async function loadTabContent() {
    setLoading(true);
    setActionError("");
    setActionMessage("");
    try {
      const headers = { "x-master-token": token };
      if (activeTab === "users") {
        const res = await fetch(`/api/master/users?q=${encodeURIComponent(searchQuery)}`, { headers });
        if (res.ok) setUsers(await res.json());
      } else if (activeTab === "logins") {
        const res = await fetch("/api/master/lookup-logs", { headers });
        if (res.ok) setLogins(await res.json());
      } else if (activeTab === "audits") {
        const res = await fetch("/api/master/audit-logs", { headers });
        if (res.ok) setAudits(await res.json());
      } else if (activeTab === "health") {
        const res = await fetch("/api/master/health", { headers });
        if (res.ok) setHealth(await res.json());
      }
    } catch {
      setActionError("Failed to fetch master data.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    loadTabContent();
  }

  async function handleStatusToggle(userId: string, currentStatus: string) {
    const nextStatus = currentStatus === "active" ? "suspended" : "active";
    try {
      const res = await fetch("/api/master/users/status", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-master-token": token },
        body: JSON.stringify({ userId, status: nextStatus }),
      });
      if (res.ok) {
        setActionMessage(`User status changed successfully to ${nextStatus}.`);
        loadTabContent();
      } else {
        const err = await res.json() as { error?: string };
        setActionError(err.error || "Failed to update user status.");
      }
    } catch {
      setActionError("Connection error.");
    }
  }

  async function startEdit(user: UserAdminInfo) {
    setEditingUser(user);
    setNewUsername(user.username);
    setNewRole(user.role);
    setNewPassword("");
    setActionError("");
    setActionMessage("");
  }

  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setActionError("");
    setActionMessage("");

    try {
      const headers = { "Content-Type": "application/json", "x-master-token": token };
      // 1. Role update
      if (newRole !== editingUser.role) {
        const res = await fetch("/api/master/users/role", {
          method: "POST",
          headers,
          body: JSON.stringify({ userId: editingUser.id, role: newRole }),
        });
        if (!res.ok) {
          const err = await res.json() as { error?: string };
          setActionError(err.error || "Failed to update role.");
          return;
        }
      }

      // 2. Username update
      if (newUsername.trim() !== editingUser.username) {
        const res = await fetch("/api/master/users/change-username", {
          method: "POST",
          headers,
          body: JSON.stringify({ userId: editingUser.id, newUsername: newUsername.trim() }),
        });
        if (!res.ok) {
          const err = await res.json() as { error?: string };
          setActionError(err.error || "Failed to update username.");
          return;
        }
      }

      // 3. Password reset
      if (newPassword.trim()) {
        const res = await fetch("/api/master/users/reset-password", {
          method: "POST",
          headers,
          body: JSON.stringify({ userId: editingUser.id, newPassword: newPassword.trim() }),
        });
        if (!res.ok) {
          const err = await res.json() as { error?: string };
          setActionError(err.error || "Failed to reset password.");
          return;
        }
      }

      setActionMessage("User details updated successfully.");
      setEditingUser(null);
      loadTabContent();
    } catch {
      setActionError("Connection error.");
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm("Are you absolutely sure you want to permanently delete this user? This cannot be undone.")) return;
    try {
      const res = await fetch("/api/master/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-master-token": token },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setActionMessage("User permanently deleted.");
        loadTabContent();
      } else {
        const err = await res.json() as { error?: string };
        setActionError(err.error || "Failed to delete user.");
      }
    } catch {
      setActionError("Connection error.");
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
          { id: "users", label: "User Management" },
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
            {activeTab === "users" && (
              <div className="space-y-4">
                {/* Search Bar */}
                <form onSubmit={handleSearch} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search users by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-[#03050b] border border-white/[0.04] focus:border-amber-500/30 text-white text-xs rounded-lg px-4 py-2.5 outline-none placeholder-white/20"
                  />
                  <button type="submit" className="px-5 py-2.5 rounded-lg button-gold text-xs font-black">Search</button>
                </form>

                {editingUser ? (
                  // Edit Modal/View
                  <form onSubmit={handleUpdateUser} className="border border-white/[0.04] p-5 rounded-xl glass-panel space-y-4 max-w-md">
                    <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider">Edit: {editingUser.username}</h3>
                    
                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="text-[9px] uppercase tracking-wider font-bold text-white/40 block mb-1">Modify Username</label>
                        <input
                          type="text"
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          className="w-full bg-[#03050b] border border-white/[0.04] text-white rounded px-3 py-2 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] uppercase tracking-wider font-bold text-white/40 block mb-1">Change Role permissions</label>
                        <select
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value)}
                          className="w-full bg-[#03050b] border border-white/[0.04] text-white rounded px-3 py-2 outline-none cursor-pointer"
                        >
                          <option value="owner">Owner (Full commands)</option>
                          <option value="admin">Admin (Modify values)</option>
                          <option value="moderator">Moderator (Check stats)</option>
                          <option value="viewer">Viewer (Read-only)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] uppercase tracking-wider font-bold text-white/40 block mb-1">Reset Password (leave empty to keep current)</label>
                        <input
                          type="password"
                          value={newPassword}
                          placeholder="New password value"
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full bg-[#03050b] border border-white/[0.04] text-white rounded px-3 py-2 outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button type="submit" className="px-4 py-2 rounded bg-amber-500 text-black font-black text-xs">Save Updates</button>
                      <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 rounded bg-white/5 text-white/60 text-xs">Cancel</button>
                    </div>
                  </form>
                ) : (
                  // Users List
                  <div className="border border-white/[0.04] rounded-xl overflow-hidden bg-white/[0.01] glass-panel">
                    <div className="grid grid-cols-6 px-4 py-3 border-b border-white/[0.04] bg-white/[0.01] text-[9px] uppercase tracking-widest font-black text-white/30">
                      <span>Username</span>
                      <span className="text-center">Role</span>
                      <span className="text-center">Status</span>
                      <span className="text-center">Scans</span>
                      <span className="text-center">Last Login</span>
                      <span className="text-right">Actions</span>
                    </div>

                    <div className="divide-y divide-white/[0.02] text-xs">
                      {users.length === 0 ? (
                        <div className="text-center text-white/20 py-8">No registered users found.</div>
                      ) : (
                        users.map((u) => (
                          <div key={u.id} className="grid grid-cols-6 px-4 py-3 items-center">
                            <span className="font-bold text-white truncate pr-2">{u.username}</span>
                            <span className="text-center font-bold text-amber-400 capitalize">{u.role}</span>
                            <span className={`text-center font-black ${u.status === "active" ? "text-[#5ecb7a]" : "text-red-400"}`}>{u.status}</span>
                            <span className="text-center font-mono text-white/60">{u.totalAnalyses}</span>
                            <span className="text-center text-white/40 font-mono truncate">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : "Never"}</span>
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => startEdit(u)} className="text-[10px] text-amber-400 hover:underline font-bold">Edit</button>
                              {u.role !== "owner" && (
                                <>
                                  <button onClick={() => handleStatusToggle(u.id, u.status)} className={`text-[10px] hover:underline font-bold ${u.status === "active" ? "text-yellow-400" : "text-[#5ecb7a]"}`}>
                                    {u.status === "active" ? "Suspend" : "Activate"}
                                  </button>
                                  <button onClick={() => handleDeleteUser(u.id)} className="text-[10px] text-red-400 hover:underline font-bold">Delete</button>
                                </>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "logins" && (
              <div className="border border-white/[0.04] rounded-xl overflow-hidden bg-white/[0.01] glass-panel">
                <div className="grid grid-cols-4 px-4 py-3 border-b border-white/[0.04] bg-white/[0.01] text-[9px] uppercase tracking-widest font-black text-white/30">
                  <span>Time</span>
                  <span className="text-center">Username</span>
                  <span className="text-center">Action</span>
                  <span className="text-right">Status</span>
                </div>
                <div className="divide-y divide-white/[0.02] text-xs max-h-[400px] overflow-y-auto pr-1">
                  {logins.length === 0 ? (
                    <div className="text-center text-white/20 py-8">No player lookup logs recorded.</div>
                  ) : (
                    logins.map((lg) => (
                      <div key={lg.id} className="grid grid-cols-4 px-4 py-3 items-center">
                        <span className="text-white/40 font-mono">{new Date(lg.timestamp).toLocaleString()}</span>
                        <span className="text-center font-bold text-amber-400">{lg.usernameSearched}</span>
                        <span className="text-center">
                          <span className="inline-block bg-[#8ab4c9]/10 border border-[#8ab4c9]/20 text-[#8ab4c9] px-2 py-0.5 rounded text-[8px] font-black uppercase">
                            Player Analysis
                          </span>
                        </span>
                        <span className="text-right">
                          <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                            lg.status === "Success" ? "bg-[#5ecb7a]/10 border border-[#5ecb7a]/20 text-[#5ecb7a]" : "bg-red-500/10 border border-red-500/20 text-red-400"
                          }`}>
                            {lg.status}
                          </span>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

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
