import { useState, useRef, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { DEFAULT_BENCHMARKS, getBenchmarkForLevel, loadBenchmarkTiers, saveBenchmarkTiers, type BenchmarkTier } from "@/lib/benchmark";
import { SWORDS, SHIELDS, loadItems, saveItems, DEFAULT_ITEMS, type GameItem, loadTypeMappings, saveTypeMappings, type TypeMappingsTable } from "@/lib/gearDatabase";
import { loadMarketData, saveMarketData, initializeMarketData, type MarketItem } from "@/lib/marketDatabase";
import marketBackup from "@/lib/market_backup_v1.json";
import { parsePlayerData, type ParsedPlayer } from "@/lib/parser";
import { loadGradingConstants, saveGradingConstants, DEFAULT_CONSTANTS, type GradingConstants } from "@/lib/settings";
import { parseNumber, formatNumber } from "@/lib/numberParser";
import { ParticleBackground } from "./Home";
import MasterVaultConsole from "@/components/MasterVault";

const ADMIN_KEY = "smg_admin_auth";
const CORRECT = atob("aGFycmlzb25Ac21ncmFkZTIwMjY=");

// ── Password Gate ─────────────────────────────────────────────────────────────

function PasswordGate({ onUnlock, onTriggerMaster }: { onUnlock: () => void; onTriggerMaster: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  function attempt() {
    if (value === CORRECT) {
      sessionStorage.setItem(ADMIN_KEY, "1");
      onUnlock();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#03050b]">
      <div className="absolute top-[-10%] left-[50%] translate-x-[-50%] w-[600px] h-[300px] rounded-full bg-[#ffd700]/3 blur-[120px] pointer-events-none" />
      <div style={shake ? { animation: "shake 0.4s ease" } : {}} className="border border-white/[0.04] bg-white/[0.01] glass-panel rounded-xl p-8 w-full max-w-sm space-y-6 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-[#ffd700] font-black text-xl font-display">SM</span>
            <span className="text-white font-extrabold text-xl font-display">Grade</span>
          </div>
          <div className="relative inline-block">
            <p className="text-[#ffd700]/65 text-[10px] uppercase tracking-widest font-black font-display bg-[#ffd700]/5 border border-[#ffd700]/10 px-3 py-1 rounded-full">
              Admin Terminal
            </p>
            <span 
              onClick={onTriggerMaster} 
              className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-white/[0.02] hover:bg-[#ffd700]/30 transition-all cursor-pointer"
              title="Access Vault Decryption"
            />
          </div>
        </div>
        <div className="space-y-4">
          <input
            type="password"
            className="w-full bg-white/[0.01] border border-white/[0.04] focus:border-[#ffd700]/30 text-white text-xs px-4 py-3 rounded-lg outline-none transition-all placeholder-white/10 font-mono"
            placeholder="Enter administrative credentials"
            value={value}
            autoFocus
            onChange={(e) => { setValue(e.target.value); setError(false); }}
            onKeyDown={(e) => e.key === "Enter" && attempt()}
          />
          {error && <p className="text-red-400 text-xs text-center font-semibold">⚠️ Incorrect password</p>}
          <button onClick={attempt} className="w-full py-3 rounded-lg button-gold text-xs font-black tracking-widest cursor-pointer">
            Access Vault
          </button>
        </div>
        <div className="text-center">
          <Link href="/" className="text-white/20 text-xs font-bold hover:text-[#ffd700] transition-colors uppercase tracking-wider">← Return to Safety</Link>
        </div>
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}`}</style>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LEVELS = [1, 2, 3, 4, 5];

function getDynamicPriceGroups(items: GameItem[]) {
  const swords = items.filter(i => i.type === "sword");
  const shields = items.filter(i => i.type === "shield");

  return [
    {
      label: "LEGENDARY SWORDS",
      items: swords.filter(i => i.rarity === "Legendary").map(i => i.name)
    },
    {
      label: "EPIC SWORDS",
      items: swords.filter(i => i.rarity === "Epic").map(i => i.name)
    },
    {
      label: "RARE SWORDS",
      items: swords.filter(i => i.rarity === "Rare").map(i => i.name)
    },
    {
      label: "LEGENDARY SHIELDS",
      items: shields.filter(i => i.rarity === "Legendary").map(i => i.name)
    },
    {
      label: "EPIC SHIELDS",
      items: shields.filter(i => i.rarity === "Epic").map(i => i.name)
    }
  ];
}

function MarketDatabaseEditor({
  marketItems,
  setMarketItems,
  items
}: {
  marketItems: MarketItem[];
  setMarketItems: React.Dispatch<React.SetStateAction<MarketItem[]>>;
  items: GameItem[];
}) {
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState<"all" | "sword" | "shield">("all");
  const [activeRarity, setActiveRarity] = useState<"all" | "Common" | "Rare" | "Epic" | "Legendary">("all");
  const [activeWorld, setActiveWorld] = useState<string>("all");
  const [groupBy, setGroupBy] = useState<"world" | "rarity" | "category">("rarity");
  
  // Track expanded cards and group collapsed states
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  
  // Backup state for Undo changes (captured when card is expanded)
  const [initialCardPrices, setInitialCardPrices] = useState<Record<string, Record<number, number>>>({});

  function handleRestoreBackup() {
    if (window.confirm("Are you sure you want to restore the canonical Market Backup v1? This will overwrite your current active changes.")) {
      saveMarketData(marketBackup as MarketItem[]);
      setMarketItems(marketBackup as MarketItem[]);
      alert("Market Backup v1 successfully restored!");
    }
  }

  // Unique worlds for filter list
  const uniqueWorlds = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      if (i.world) set.add(i.world);
    });
    return Array.from(set).sort();
  }, [items]);

  // Filter items
  const filtered = useMemo(() => {
    return marketItems.filter(item => {
      const meta = items.find(i => i.name.toLowerCase() === item.name.toLowerCase());
      const itemRarity = meta?.rarity || "Common";
      const itemWorld = meta?.world || "Unknown World";
      
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchesType = activeType === "all" || item.category === activeType;
      const matchesRarity = activeRarity === "all" || itemRarity === activeRarity;
      const matchesWorld = activeWorld === "all" || itemWorld === activeWorld;
      
      return matchesSearch && matchesType && matchesRarity && matchesWorld;
    });
  }, [marketItems, items, search, activeType, activeRarity, activeWorld]);

  // Group items
  const grouped = useMemo(() => {
    const groups: Record<string, MarketItem[]> = {};
    filtered.forEach(item => {
      const meta = items.find(i => i.name.toLowerCase() === item.name.toLowerCase());
      let key = "Other";
      if (groupBy === "world") {
        key = meta?.world || "Unknown World";
      } else if (groupBy === "rarity") {
        key = meta?.rarity || "Common";
      } else if (groupBy === "category") {
        key = item.category === "sword" ? "Swords" : "Shields";
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [filtered, groupBy, items]);

  const toggleExpand = (name: string, currentPrices: Record<number, number>) => {
    setExpandedItems(prev => {
      const nextVal = !prev[name];
      if (nextVal && !initialCardPrices[name]) {
        // Capture initial prices for Undo history
        setInitialCardPrices(init => ({
          ...init,
          [name]: { ...currentPrices }
        }));
      }
      return { ...prev, [name]: nextVal };
    });
  };

  const toggleGroupCollapse = (groupKey: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const handlePriceChange = (name: string, lvl: number, valueStr: string) => {
    const val = parseNumber(valueStr);
    const updated = marketItems.map(item => {
      if (item.name === name) {
        const nextPrices = { ...(item.prices || {}), [lvl]: val };
        return { 
          ...item, 
          prices: nextPrices,
          lastUpdated: new Date().toLocaleDateString()
        };
      }
      return item;
    });
    setMarketItems(updated);
    saveMarketData(updated); // Auto-save
  };

  const handleUndo = (name: string) => {
    const original = initialCardPrices[name];
    if (!original) return;
    
    const updated = marketItems.map(item => {
      if (item.name === name) {
        return { 
          ...item, 
          prices: { ...original },
          lastUpdated: new Date().toLocaleDateString()
        };
      }
      return item;
    });
    setMarketItems(updated);
    saveMarketData(updated);
    alert(`Undone edits for ${name}.`);
  };


  // Helper colors for Rarity Badges
  const getRarityBadgeStyle = (rarity: string) => {
    switch (rarity) {
      case "Legendary": return "bg-amber-500/10 border-amber-500/30 text-amber-400";
      case "Epic": return "bg-purple-500/10 border-purple-500/30 text-purple-400";
      case "Rare": return "bg-amber-500/5 border-amber-500/15 text-amber-300/70";
      default: return "bg-slate-500/10 border-slate-500/20 text-slate-400";
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters panel */}
      <div className="bg-[#0b0f19] border border-white/[0.04] rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-white/40 text-xs font-bold uppercase tracking-wider">Group By:</span>
            <div className="flex bg-[#050811] border border-white/[0.05] rounded-lg p-0.5">
              {(["rarity", "world", "category"] as const).map(mode => (
                <button
                  type="button"
                  key={mode}
                  onClick={() => setGroupBy(mode)}
                  className={`px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    groupBy === mode ? "bg-[#ffd700] text-black font-black" : "text-white/50 hover:text-white"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleRestoreBackup}
              className="px-3.5 py-1.5 rounded bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-[#03050b] text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-[0_2px_10px_rgba(245,158,11,0.2)]"
            >
              Restore Market Backup
            </button>
            <input
              type="text"
              placeholder="Search gear..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3.5 py-1.5 bg-[#050811] border border-white/[0.05] rounded-lg text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#ffd700] w-52 font-semibold"
            />
          </div>
        </div>

        {/* Filter Badges Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-white/[0.03]">
          {/* Type filters */}
          <div className="space-y-1.5">
            <label className="text-[9px] text-white/40 uppercase font-black tracking-wider block">Gear Type</label>
            <select
              value={activeType}
              onChange={(e) => setActiveType(e.target.value as any)}
              className="w-full bg-[#050811] border border-white/[0.05] rounded-lg px-2.5 py-1.5 text-xs text-white/80 focus:outline-none focus:border-[#ffd700]"
            >
              <option value="all">All Types</option>
              <option value="sword">Swords</option>
              <option value="shield">Shields</option>
            </select>
          </div>

          {/* Rarity filter */}
          <div className="space-y-1.5">
            <label className="text-[9px] text-white/40 uppercase font-black tracking-wider block">Rarity</label>
            <select
              value={activeRarity}
              onChange={(e) => setActiveRarity(e.target.value as any)}
              className="w-full bg-[#050811] border border-white/[0.05] rounded-lg px-2.5 py-1.5 text-xs text-white/80 focus:outline-none focus:border-[#ffd700]"
            >
              <option value="all">All Rarities</option>
              <option value="Legendary">Legendary</option>
              <option value="Epic">Epic</option>
              <option value="Rare">Rare</option>
              <option value="Common">Common</option>
            </select>
          </div>

          {/* World filter */}
          <div className="space-y-1.5">
            <label className="text-[9px] text-white/40 uppercase font-black tracking-wider block">World</label>
            <select
              value={activeWorld}
              onChange={(e) => setActiveWorld(e.target.value)}
              className="w-full bg-[#050811] border border-white/[0.05] rounded-lg px-2.5 py-1.5 text-xs text-white/80 focus:outline-none focus:border-[#ffd700]"
            >
              <option value="all">All Worlds</option>
              {uniqueWorlds.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Group List cards */}
      <div className="space-y-4">
        {Object.entries(grouped).map(([groupKey, groupItems]) => {
          const isCollapsed = collapsedGroups[groupKey] || false;
          return (
            <div key={groupKey} className="bg-[#080c15]/30 border border-white/[0.03] rounded-xl overflow-hidden">
              {/* Group header */}
              <button
                type="button"
                onClick={() => toggleGroupCollapse(groupKey)}
                className="w-full px-5 py-3.5 bg-[#0b0f19]/80 flex items-center justify-between border-b border-white/[0.02] cursor-pointer hover:bg-white/[0.01]"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/30">📂 Group:</span>
                  <span className="text-xs font-black uppercase text-[#ffd700] tracking-wider">{groupKey}</span>
                  <span className="bg-[#ffd700]/10 text-[#ffd700] text-[9px] font-bold px-2 py-0.5 rounded-full border border-[#ffd700]/20">
                    {groupItems.length} items
                  </span>
                </div>
                <span className="text-white/40 text-[9px] uppercase tracking-wider font-mono">
                  {isCollapsed ? "Expand ▲" : "Collapse ▼"}
                </span>
              </button>

              {/* Group items */}
              {!isCollapsed && (
                <div className="p-4 space-y-3">
                  {groupItems.map(item => {
                    const meta = items.find(i => i.name.toLowerCase() === item.name.toLowerCase());
                    const isExpanded = expandedItems[item.name] || false;
                    const itemRarity = meta?.rarity || "Common";
                    const itemWorld = meta?.world || "Unknown World";
                    const lvl1Price = (item.prices && item.prices[1]) || 0;

                    return (
                      <div 
                        key={item.name} 
                        className={`border rounded-xl transition-all overflow-hidden ${
                          isExpanded 
                            ? "bg-[#0b101f] border-[#ffd700]/40 shadow-[0_0_15px_rgba(245,158,11,0.04)]" 
                            : "bg-[#070b13] border-white/[0.03] hover:border-white/[0.08]"
                        }`}
                      >
                        {/* Card collapsed header row */}
                        <div 
                          onClick={() => toggleExpand(item.name, item.prices || {})}
                          className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none hover:bg-white/[0.005]"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-white tracking-wide">{item.name}</span>
                            <span className="text-[9px] uppercase font-bold text-white/30 font-mono">
                              {item.category === "sword" ? "⚔️ Sword" : "🛡️ Shield"}
                            </span>
                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${getRarityBadgeStyle(itemRarity)}`}>
                              {itemRarity}
                            </span>
                            <span className="text-[9px] text-white/40 font-mono">🌍 {itemWorld}</span>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right font-mono">
                              <span className="text-[9px] text-white/30 block uppercase tracking-wider">Base Price (Lv1)</span>
                              <span className="text-xs text-[#ffd700] font-black">{lvl1Price > 0 ? formatNumber(lvl1Price) : "N/A"}</span>
                            </div>
                            <span className="text-white/40 text-[9px] font-mono select-none">
                              {isExpanded ? "CLOSE" : "EDIT"}
                            </span>
                          </div>
                        </div>

                        {/* Card expanded editor body */}
                        {isExpanded && (
                          <div className="border-t border-white/[0.03] bg-black/20 p-4 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.02] pb-3">
                              <div className="space-y-0.5">
                                <span className="text-[10px] text-white/40 font-mono block">
                                  Average Trade Price: <strong className="text-[#ffd700]">{item.avgTradePrice ? formatNumber(item.avgTradePrice) : "N/A"}</strong>
                                </span>
                                <span className="text-[9px] text-white/30 font-mono block">
                                  Last Database Sync: {item.lastUpdated || "Never"}
                                </span>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleUndo(item.name)}
                                  className="px-2.5 py-1 bg-red-650 hover:bg-red-700 text-white rounded text-[10px] font-black uppercase tracking-wider cursor-pointer transition-colors"
                                >
                                  ↩ Undo Changes
                                </button>
                              </div>
                            </div>

                            {/* Level-specific prices grid */}
                            <div className="space-y-1.5">
                              <span className="text-[9px] text-[#ffd700] uppercase font-black tracking-widest block mb-2">Configure Levels Pricing</span>
                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                {Array.from({ length: 10 }).map((_, idx) => {
                                  const lvl = idx + 1;
                                  const curPriceVal = (item.prices && item.prices[lvl]) || 0;
                                  const displayVal = curPriceVal > 0 ? formatNumber(curPriceVal) : "";

                                  return (
                                    <div key={lvl} className="flex flex-col gap-1 bg-white/[0.005] p-2 rounded-lg border border-white/[0.02]">
                                      <label className="text-[9px] text-white/40 uppercase font-black tracking-wider">Level {lvl}</label>
                                      <input
                                        type="text"
                                        placeholder="-"
                                        defaultValue={displayVal}
                                        key={`${item.name}-${lvl}-${curPriceVal}`}
                                        onBlur={(e) => handlePriceChange(item.name, lvl, e.target.value)}
                                        className="bg-[#050811] border border-white/[0.04] focus:border-[#ffd700] rounded px-2.5 py-1.5 text-xs text-white font-mono text-center focus:outline-none"
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Bot Logs Upload ───────────────────────────────────────────────────────────

interface LogStats {
  fileName: string;
  fileSizeKB: number;
  totalPlayers: number;
  failedBlocks: number;
  byTier: { label: string; count: number; avgPower: number; minLevel: number; maxLevel: number }[];
  topSwords: { name: string; count: number }[];
  topShields: { name: string; count: number }[];
  levelRange: { min: number; max: number };
  powerRange: { min: number; max: number };
}

function splitPlayerBlocks(text: string): string[] {
  // Each block starts with a line like "SomeUsername Stats"
  const lines = text.split("\n");
  const blocks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (/^.+\s+Stats\s*$/.test(line.trim()) && current.length > 2) {
      blocks.push(current.join("\n"));
      current = [];
    }
    current.push(line);
  }
  if (current.length > 2) blocks.push(current.join("\n"));
  return blocks;
}

function analyzeLog(text: string, fileName: string, fileSize: number): LogStats {
  const blocks = splitPlayerBlocks(text);
  const players: ParsedPlayer[] = [];
  let failedBlocks = 0;

  for (const block of blocks) {
    const p = parsePlayerData(block);
    if (p && p.level > 0 && p.powerRaw > 0) {
      players.push(p);
    } else if (block.trim().length > 20) {
      failedBlocks++;
    }
  }

  // Group by tier
  const tierMap = new Map<string, { count: number; totalPower: number; minLevel: number; maxLevel: number }>();
  for (const p of players) {
    const tier = getBenchmarkForLevel(p.level);
    const existing = tierMap.get(tier.label) ?? { count: 0, totalPower: 0, minLevel: Infinity, maxLevel: 0 };
    tierMap.set(tier.label, {
      count: existing.count + 1,
      totalPower: existing.totalPower + p.powerRaw,
      minLevel: Math.min(existing.minLevel, p.level),
      maxLevel: Math.max(existing.maxLevel, p.level),
    });
  }

  const byTier = loadBenchmarkTiers().map((t) => {
    const d = tierMap.get(t.label);
    return {
      label: t.label,
      count: d?.count ?? 0,
      avgPower: d ? d.totalPower / d.count : 0,
      minLevel: d?.minLevel === Infinity ? 0 : (d?.minLevel ?? 0),
      maxLevel: d?.maxLevel ?? 0,
    };
  }).filter((t) => t.count > 0);

  // Top swords/shields
  const swordCounts: Record<string, number> = {};
  const shieldCounts: Record<string, number> = {};
  for (const p of players) {
    swordCounts[p.sword] = (swordCounts[p.sword] ?? 0) + 1;
    shieldCounts[p.shield] = (shieldCounts[p.shield] ?? 0) + 1;
  }
  const topSwords = Object.entries(swordCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  const topShields = Object.entries(shieldCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));

  const levels = players.map((p) => p.level);
  const powers = players.map((p) => p.powerRaw);

  return {
    fileName,
    fileSizeKB: fileSize / 1024,
    totalPlayers: players.length,
    failedBlocks,
    byTier,
    topSwords,
    topShields,
    levelRange: { min: Math.min(...levels, Infinity), max: Math.max(...levels, 0) },
    powerRange: { min: Math.min(...powers, Infinity), max: Math.max(...powers, 0) },
  };
}

function BotLogsUpload() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  function processFile(file: File) {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = analyzeLog(text, file.name, file.size);
      setStats(result);
      setLoading(false);
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[#555] text-xs leading-relaxed">
          Upload your weekly .txt file of bot command logs to inspect dataset distribution and check benchmark calibration.
        </p>
      </div>

      <div
        className={`border-2 border-dashed rounded-sm py-8 px-6 text-center cursor-pointer transition-colors ${dragging ? "border-[#ffd700] bg-[#02101a]" : "border-[#2a2a2a] hover:border-[#3a3a3a]"}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".txt"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
        />
        {loading ? (
          <span className="text-[#555] text-sm animate-pulse">Parsing...</span>
        ) : (
          <>
            <span className="text-[#ffd700] font-semibold text-sm">Click to upload</span>
            <span className="text-[#555] text-sm"> or drag a .txt file here</span>
          </>
        )}
      </div>

      {stats && (
        <div className="space-y-4">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Players Parsed", value: stats.totalPlayers.toLocaleString() },
              { label: "Level Range", value: stats.levelRange.min === Infinity ? "—" : `${stats.levelRange.min.toLocaleString()}–${stats.levelRange.max.toLocaleString()}` },
              { label: "Failed Blocks", value: stats.failedBlocks.toLocaleString() },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#111] border border-[#1e1e1e] rounded-sm px-3 py-3 text-center">
                <div className="text-white font-mono font-bold text-lg">{value}</div>
                <div className="text-[#444] text-[10px] uppercase tracking-wider mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Tier breakdown */}
          <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-sm overflow-hidden">
            <div className="px-4 py-2 border-b border-[#1e1e1e] bg-[#111]">
              <span className="text-[#555] text-[10px] uppercase tracking-widest">Tier Distribution</span>
            </div>
            <div className="divide-y divide-[#111]">
              {stats.byTier.map((t) => (
                <div key={t.label} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-20 text-[#888] text-xs font-semibold shrink-0">{t.label}</div>
                  <div className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#ffd700] rounded-full"
                      style={{ width: `${Math.min((t.count / stats.totalPlayers) * 100 * 3, 100)}%` }}
                    />
                  </div>
                  <div className="text-[#666] text-xs font-mono w-10 text-right shrink-0">{t.count}×</div>
                  <div className="text-[#444] text-xs font-mono w-24 text-right shrink-0 hidden sm:block">avg {fmt(t.avgPower)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Top gear */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-[#1e1e1e] bg-[#111]">
                <span className="text-[#555] text-[10px] uppercase tracking-widest">Top Swords</span>
              </div>
              <div className="divide-y divide-[#111]">
                {stats.topSwords.map((s) => (
                  <div key={s.name} className="flex justify-between items-center px-3 py-2">
                    <span className="text-[#888] text-xs truncate">{s.name}</span>
                    <span className="text-[#ffd700] text-xs font-mono shrink-0 ml-2">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-[#1e1e1e] bg-[#111]">
                <span className="text-[#555] text-[10px] uppercase tracking-widest">Top Shields</span>
              </div>
              <div className="divide-y divide-[#111]">
                {stats.topShields.map((s) => (
                  <div key={s.name} className="flex justify-between items-center px-3 py-2">
                    <span className="text-[#888] text-xs truncate">{s.name}</span>
                    <span className="text-[#ffd700] text-xs font-mono shrink-0 ml-2">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-[#333] text-[10px]">
            Source: {stats.fileName} · {stats.fileSizeKB.toFixed(1)} KB
          </p>
        </div>
      )}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-white/[0.04] rounded-xl bg-white/[0.01] glass-panel overflow-hidden">
      <div className="border-b border-white/[0.04] px-5 py-4 bg-white/[0.01]">
        <span className="text-[#ffd700] text-[10px] uppercase tracking-widest font-black font-display">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Scoring reference ─────────────────────────────────────────────────────────

interface ScoringRefProps {
  tiers: BenchmarkTier[];
  setTiers: React.Dispatch<React.SetStateAction<BenchmarkTier[]>>;
  settings: GradingConstants;
  onTierChange: (idx: number, field: keyof BenchmarkTier, val: any) => void;
  validationError: string | null;
  setValidationError: (err: string | null) => void;
  onResetTiers: () => void;
}

function ScoringRef({
  tiers,
  setTiers,
  settings,
  onTierChange,
  validationError,
  setValidationError,
  onResetTiers
}: ScoringRefProps) {
  const [activeTierIdx, setActiveTierIdx] = useState(0);

  const moveTier = (idx: number, direction: "up" | "down") => {
    const nextIdx = direction === "up" ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= tiers.length) return;
    const updated = [...tiers];
    const temp = updated[idx];
    updated[idx] = updated[nextIdx];
    updated[nextIdx] = temp;
    setTiers(updated);
    saveBenchmarkTiers(updated);
    setActiveTierIdx(nextIdx);
  };

  const handleAddTier = () => {
    const newTier: BenchmarkTier = {
      label: `New Tier ${tiers.length + 1}`,
      minLevel: tiers.length > 0 ? tiers[tiers.length - 1].maxLevel + 1 : 1,
      maxLevel: tiers.length > 0 ? tiers[tiers.length - 1].maxLevel + 1000 : 999,
      weakPower: 1e8,
      avgPower: 5e9,
      strongPower: 20e9,
      elitePower: 100e9,
      avgGold: 1e7,
    };
    const updated = [...tiers, newTier];
    setTiers(updated);
    saveBenchmarkTiers(updated);
    setActiveTierIdx(updated.length - 1);
  };

  const handleDeleteTier = (idx: number) => {
    if (tiers.length <= 1) {
      alert("Cannot delete last remaining tier.");
      return;
    }
    const updated = tiers.filter((_, i) => i !== idx);
    setTiers(updated);
    saveBenchmarkTiers(updated);
    setActiveTierIdx(0);
  };

  const handleRenameTier = (idx: number) => {
    const newName = prompt("Enter new tier name:", tiers[idx].label);
    if (newName && newName.trim()) {
      onTierChange(idx, "label", newName.trim());
    }
  };

  const exportTiers = () => {
    const blob = new Blob([JSON.stringify(tiers, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "smgrade_benchmark_tiers.json";
    a.click();
  };

  const importTiers = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          setTiers(parsed);
          saveBenchmarkTiers(parsed);
          alert("Successfully imported benchmark tiers!");
        } else {
          alert("Invalid file format. Must be an array of tiers.");
        }
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const activeTier = tiers[activeTierIdx] || tiers[0];

  const renderFieldInput = (labelStr: string, field: keyof BenchmarkTier, type: "number" | "text" = "text") => {
    let rawVal = activeTier ? activeTier[field] : 0;
    const displayVal = rawVal === Infinity ? "Infinity" : (typeof rawVal === "number" ? formatNumber(rawVal) : rawVal);

    return (
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-white/40 uppercase font-black tracking-wider">{labelStr}</label>
        {type === "number" ? (
          <input
            type="number"
            value={rawVal === Infinity ? "" : rawVal}
            onChange={(e) => {
              const val = e.target.value === "" ? Infinity : parseFloat(e.target.value) || 0;
              onTierChange(activeTierIdx, field, val);
            }}
            className="bg-[#111] border border-white/[0.04] rounded px-2.5 py-1.5 text-xs text-white font-mono"
          />
        ) : (
          <input
            type="text"
            defaultValue={displayVal}
            key={`${activeTierIdx}-${field}-${rawVal}`}
            onBlur={(e) => {
              const valStr = e.target.value.trim();
              const parsed = valStr === "Infinity" || valStr === "∞" ? Infinity : parseNumber(valStr);
              onTierChange(activeTierIdx, field, parsed);
            }}
            className="bg-[#111] border border-white/[0.04] rounded px-2.5 py-1.5 text-xs text-white font-mono"
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header operations */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/[0.01] p-3 rounded-lg border border-white/[0.03]">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleAddTier}
            className="px-3 py-1.5 bg-amber-500 hover:bg-[#38bdf8] text-black rounded text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
          >
            + Add New Tier
          </button>
          <button
            type="button"
            onClick={onResetTiers}
            className="px-3 py-1.5 bg-[#111] hover:bg-[#222] border border-white/[0.04] text-white/80 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Reset Default Tiers
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportTiers}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            📤 Export JSON
          </button>
          <label className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer block text-center">
            📥 Import JSON
            <input type="file" accept=".json" onChange={importTiers} className="hidden" />
          </label>
        </div>
      </div>

      {validationError && (
        <div className="text-red-500 text-xs font-semibold border border-red-950 bg-red-950/20 p-2 rounded">
          ⚠️ {validationError}
        </div>
      )}

      {/* Main editor split view */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column: Tiers list */}
        <div className="lg:col-span-4 space-y-2 border border-white/[0.04] rounded-lg p-3 bg-[#05050f]/20">
          <p className="text-[10px] text-white/30 uppercase font-black tracking-widest pb-1.5 border-b border-white/[0.04] mb-2">Tiers Hierarchy</p>
          {tiers.map((t, idx) => (
            <div
              key={`${t.label}-${idx}`}
              onClick={() => setActiveTierIdx(idx)}
              className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-colors ${
                activeTierIdx === idx
                  ? "bg-amber-500/10 border-amber-400 text-amber-400 font-bold"
                  : "bg-white/[0.01] border-transparent hover:bg-white/[0.02] text-white/70"
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-xs">{t.label}</span>
                <span className="text-[9px] text-white/40 font-mono">
                  {t.minLevel} - {t.maxLevel === Infinity ? "∞" : t.maxLevel}
                </span>
              </div>
              
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => moveTier(idx, "up")}
                  disabled={idx === 0}
                  className="p-1 hover:text-amber-400 disabled:opacity-30 disabled:hover:text-inherit text-[10px]"
                  title="Move Up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveTier(idx, "down")}
                  disabled={idx === tiers.length - 1}
                  className="p-1 hover:text-amber-400 disabled:opacity-30 disabled:hover:text-inherit text-[10px]"
                  title="Move Down"
                >
                  ▼
                </button>
                <button
                  type="button"
                  onClick={() => handleRenameTier(idx)}
                  className="p-1 hover:text-amber-400 text-[10px]"
                  title="Rename"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTier(idx)}
                  className="p-1 hover:text-red-500 text-[10px]"
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Right column: Form fields for active tier */}
        <div className="lg:col-span-8 border border-white/[0.04] rounded-lg p-5 bg-[#05050f]/20 space-y-5">
          {activeTier ? (
            <>
              <div className="border-b border-white/[0.04] pb-2 flex justify-between items-center">
                <span className="text-xs font-black text-white uppercase tracking-widest">Editing: {activeTier.label}</span>
                <span className="text-[10px] text-white/40 font-mono">Index: {activeTierIdx}</span>
              </div>

              {/* Levels range */}
              <div className="grid grid-cols-2 gap-4">
                {renderFieldInput("Min Level", "minLevel", "number")}
                {renderFieldInput("Max Level", "maxLevel")}
              </div>

              {/* Power benchmarks */}
              <div className="space-y-2.5">
                <span className="text-[10px] text-[#ffd700] uppercase font-black tracking-widest block">Power Benchmarks</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {renderFieldInput("Weak Power", "weakPower")}
                  {renderFieldInput("Avg Power", "avgPower")}
                  {renderFieldInput("Strong Power", "strongPower")}
                  {renderFieldInput("Elite Power", "elitePower")}
                </div>
              </div>

              {/* Gold benchmark */}
              <div className="space-y-2.5">
                <span className="text-[10px] text-[#ffd700] uppercase font-black tracking-widest block">Gold Benchmarks</span>
                <div className="grid grid-cols-2 gap-3">
                  {renderFieldInput("Average Gold", "avgGold")}
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-white/30 italic text-center py-10">Select a tier to begin editing.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Admin ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1e24) return (n / 1e24).toFixed(1) + " OCT";
  if (n >= 1e21) return (n / 1e21).toFixed(1) + " SXT";
  if (n >= 1e18) return (n / 1e18).toFixed(1) + " QNT";
  if (n >= 1e15) return (n / 1e15).toFixed(1) + " QT";
  if (n >= 1e12) return (n / 1e12).toFixed(1) + " T";
  if (n >= 1e9) return (n / 1e9).toFixed(1) + " B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + " M";
  return n.toLocaleString();
}

function validateTiers(tList: BenchmarkTier[]): string | null {
  for (let i = 0; i < tList.length; i++) {
    if (tList[i].minLevel < 0 || tList[i].maxLevel < 0) {
      return `Tier ${tList[i].label}: Levels cannot be negative.`;
    }
    if (tList[i].minLevel > tList[i].maxLevel) {
      return `Tier ${tList[i].label}: Min level (${tList[i].minLevel}) cannot be greater than Max level (${tList[i].maxLevel}).`;
    }
    if (i > 0 && tList[i].minLevel <= tList[i - 1].maxLevel) {
      return `Overlapping ranges: Tier ${tList[i].label} starts at ${tList[i].minLevel}, which overlaps with Tier ${tList[i - 1].label} (max ${tList[i - 1].maxLevel}).`;
    }
  }
  return null;
}

function GameDatabaseEditor({
  items,
  onAddItem,
  onEditItem,
  onDeleteItem
}: {
  items: GameItem[];
  onAddItem: (item: GameItem) => void;
  onEditItem: (idx: number, item: GameItem) => void;
  onDeleteItem: (idx: number) => void;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  
  const [name, setName] = useState("");
  const [type, setType] = useState<"sword" | "shield" | "pet" | "relic">("sword");
  const [rarity, setRarity] = useState<"Common" | "Rare" | "Epic" | "Legendary">("Common");
  const [baseValue, setBaseValue] = useState("1.0");
  const [maxLevel, setMaxLevel] = useState("10");
  const [passive, setPassive] = useState("None");
  const [image, setImage] = useState("🗡️");
  const [recScore, setRecScore] = useState("10");
  const [tierRank, setTierRank] = useState("1");

  // New fields
  const [world, setWorld] = useState("");
  const [dropSource, setDropSource] = useState("");
  const [protection, setProtection] = useState("");
  const [healthMulti, setHealthMulti] = useState("");
  const [goldMultiStat, setGoldMultiStat] = useState("");
  const [typeId, setTypeId] = useState("");

  const [goldMulti, setGoldMulti] = useState("2.0");
  const [speedBoost, setSpeedBoost] = useState("0.25");

  function startEdit(idx: number) {
    const item = items[idx];
    setEditingIdx(idx);
    setName(item.name);
    setType(item.type);
    setRarity(item.rarity);
    setBaseValue(item.baseValue.toString());
    setMaxLevel(item.maxLevel.toString());
    setPassive(item.passive);
    setImage(item.image);
    setRecScore(item.recommendationScore.toString());
    setTierRank(item.tierRank.toString());

    setWorld(item.world || "");
    setDropSource(item.dropSource || "");
    setProtection(item.protection || "");
    setHealthMulti(item.healthMulti || "");
    setGoldMultiStat(item.goldMulti || "");
    setTypeId(item.typeId?.toString() || "");

    if (item.metadata) {
      setGoldMulti(item.metadata.goldMulti?.toString() || "1.0");
      setSpeedBoost(item.metadata.speedBoost?.toString() || "0.0");
    } else {
      setGoldMulti("1.0");
      setSpeedBoost("0.0");
    }
  }

  function clearForm() {
    setEditingIdx(null);
    setName("");
    setType("sword");
    setRarity("Common");
    setBaseValue("1.0");
    setMaxLevel("10");
    setPassive("None");
    setImage("🗡️");
    setRecScore("10");
    setTierRank("1");
    setGoldMulti("2.0");
    setSpeedBoost("0.25");
    setWorld("");
    setDropSource("");
    setProtection("");
    setHealthMulti("");
    setGoldMultiStat("");
    setTypeId("");
  }

  function handleSubmit() {
    if (!name.trim()) return;
    
    const parsedItem: GameItem = {
      name: name.trim(),
      type,
      rarity,
      baseValue: parseFloat(baseValue) || 0,
      maxLevel: parseInt(maxLevel) || 10,
      passive,
      image,
      recommendationScore: parseInt(recScore) || 10,
      prices: editingIdx !== null ? items[editingIdx].prices : {},
      tierRank: parseInt(tierRank) || 1,
      world: world.trim() || undefined,
      dropSource: dropSource.trim() || undefined,
      protection: protection.trim() || undefined,
      healthMulti: healthMulti.trim() || undefined,
      goldMulti: goldMultiStat.trim() || undefined,
      typeId: typeId ? parseInt(typeId) : undefined
    };

    if (type === "pet") {
      parsedItem.metadata = {
        goldMulti: parseFloat(goldMulti) || 1.0,
        speedBoost: parseFloat(speedBoost) || 0.0,
      };
    }

    if (editingIdx !== null) {
      onEditItem(editingIdx, parsedItem);
    } else {
      onAddItem(parsedItem);
    }
    clearForm();
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto max-h-[300px] border border-[#2a2a2a] rounded">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#2a2a2a] text-xs text-[#555] bg-[#0c0c0c] uppercase tracking-wider font-bold">
              <th className="py-2 px-3">Icon</th>
              <th className="py-2 px-3">Name</th>
              <th className="py-2 px-3">Type</th>
              <th className="py-2 px-3">Rarity</th>
              <th className="py-2 px-3">Base Stat</th>
              <th className="py-2 px-3">Rank</th>
              <th className="py-2 px-3">Type ID</th>
              <th className="py-2 px-3">World</th>
              <th className="py-2 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e1e1e]">
            {items.map((item, idx) => (
              <tr key={idx} className="text-xs hover:bg-[#111] transition-colors">
                <td className="py-2 px-3">{item.image}</td>
                <td className="py-2 px-3 font-bold text-white">{item.name}</td>
                <td className="py-2 px-3 capitalize text-[#888]">{item.type}</td>
                <td className="py-2 px-3">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
                    item.rarity === "Legendary" ? "bg-[#ffd700]/20 text-[#ffd700]" :
                    item.rarity === "Epic" ? "bg-purple-950 text-purple-300" :
                    item.rarity === "Rare" ? "bg-amber-950/40 text-amber-300" :
                    "bg-[#333] text-[#aaa]"
                  }`}>
                    {item.rarity}
                  </span>
                </td>
                <td className="py-2 px-3 font-mono text-[#ccc]">
                  {item.baseValue}{item.type === "shield" ? "x" : item.type === "sword" ? "B" : ""}
                </td>
                <td className="py-2 px-3 font-mono">{item.tierRank}</td>
                <td className="py-2 px-3 font-mono text-[#888]">{item.typeId ?? "-"}</td>
                <td className="py-2 px-3 text-[#aaa]">{item.world ?? "-"}</td>
                <td className="py-2 px-3 text-right space-x-2">
                  <button onClick={() => startEdit(idx)} className="text-[10px] text-[#ffd700] hover:underline font-bold">Edit</button>
                  <button onClick={() => onDeleteItem(idx)} className="text-[10px] text-red-500 hover:underline font-bold">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-[#111] p-4 rounded-sm border border-[#2a2a2a] space-y-4">
        <p className="text-[#ffd700] text-xs font-bold uppercase tracking-wider">
          {editingIdx !== null ? `Edit Item: ${name}` : "Add New Item"}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] text-[#888] uppercase font-bold">Name</label>
            <input type="text" className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white text-xs px-2.5 py-2 rounded outline-none" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Divinity II" />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-[#888] uppercase font-bold">Type</label>
            <select className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white text-xs px-2.5 py-2 rounded outline-none" value={type} onChange={e => setType(e.target.value as any)}>
              <option value="sword">Sword</option>
              <option value="shield">Shield</option>
              <option value="pet">Pet</option>
              <option value="relic">Relic</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-[#888] uppercase font-bold">Rarity</label>
            <select className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white text-xs px-2.5 py-2 rounded outline-none" value={rarity} onChange={e => setRarity(e.target.value as any)}>
              <option value="Common">Common</option>
              <option value="Rare">Rare</option>
              <option value="Epic">Epic</option>
              <option value="Legendary">Legendary</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-[#888] uppercase font-bold">
              {type === "sword" ? "Base Damage (B)" : type === "shield" ? "Base Multiplier (x)" : "Base Value / Power Multi"}
            </label>
            <input type="number" step="any" className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white text-xs px-2.5 py-2 rounded outline-none font-mono" value={baseValue} onChange={e => setBaseValue(e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-[#888] uppercase font-bold">Max Level</label>
            <input type="number" className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white text-xs px-2.5 py-2 rounded outline-none font-mono" value={maxLevel} onChange={e => setMaxLevel(e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-[#888] uppercase font-bold">Icon / Emoji</label>
            <input type="text" className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white text-xs px-2.5 py-2 rounded outline-none" value={image} onChange={e => setImage(e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-[#888] uppercase font-bold">Progression Rank (tierRank)</label>
            <input type="number" className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white text-xs px-2.5 py-2 rounded outline-none font-mono" value={tierRank} onChange={e => setTierRank(e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-[#888] uppercase font-bold">Rec Score weight</label>
            <input type="number" className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white text-xs px-2.5 py-2 rounded outline-none font-mono" value={recScore} onChange={e => setRecScore(e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-[#888] uppercase font-bold">Passive Ability Text</label>
            <input type="text" className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white text-xs px-2.5 py-2 rounded outline-none" value={passive} onChange={e => setPassive(e.target.value)} />
          </div>
        </div>

        {(type === "sword" || type === "shield") && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-[#222] pt-3">
            <div className="space-y-1">
              <label className="text-[10px] text-[#888] uppercase font-bold">World</label>
              <input type="text" className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white text-xs px-2.5 py-2 rounded outline-none" value={world} onChange={e => setWorld(e.target.value)} placeholder="e.g. Orkland W1" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-[#888] uppercase font-bold">Drop Source</label>
              <input type="text" className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white text-xs px-2.5 py-2 rounded outline-none" value={dropSource} onChange={e => setDropSource(e.target.value)} placeholder="e.g. Reaper | 1%" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-[#888] uppercase font-bold">Protection Stat</label>
              <input type="text" className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white text-xs px-2.5 py-2 rounded outline-none" value={protection} onChange={e => setProtection(e.target.value)} placeholder="e.g. 400M" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-[#888] uppercase font-bold">Health Multiplier</label>
              <input type="text" className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white text-xs px-2.5 py-2 rounded outline-none" value={healthMulti} onChange={e => setHealthMulti(e.target.value)} placeholder="e.g. 23x" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-[#888] uppercase font-bold">Gold Multiplier Stat</label>
              <input type="text" className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white text-xs px-2.5 py-2 rounded outline-none" value={goldMultiStat} onChange={e => setGoldMultiStat(e.target.value)} placeholder="e.g. 22x" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-[#888] uppercase font-bold">Item Type ID (mapping)</label>
              <input type="number" className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white text-xs px-2.5 py-2 rounded outline-none font-mono" value={typeId} onChange={e => setTypeId(e.target.value)} placeholder="e.g. 44" />
            </div>
          </div>
        )}

        {type === "pet" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[#222] pt-3">
            <div className="space-y-1">
              <label className="text-[10px] text-[#888] uppercase font-bold">Gold Multiplier (x)</label>
              <input type="number" step="any" className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white text-xs px-2.5 py-2 rounded outline-none font-mono" value={goldMulti} onChange={e => setGoldMulti(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-[#888] uppercase font-bold">Speed Boost (x)</label>
              <input type="number" step="any" className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white text-xs px-2.5 py-2 rounded outline-none font-mono" value={speedBoost} onChange={e => setSpeedBoost(e.target.value)} />
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          {editingIdx !== null && (
            <button onClick={clearForm} className="bg-[#222] hover:bg-[#333] text-white text-xs font-bold px-4 py-2 rounded">
              Cancel
            </button>
          )}
          <button onClick={handleSubmit} className="bg-[#ffd700] hover:bg-[#38bdf8] text-black text-xs font-bold px-4 py-2 rounded">
            {editingIdx !== null ? "Apply Changes" : "Add Item"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const [, navigate] = useLocation();
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(ADMIN_KEY) === "1");
  const [settings, setSettings] = useState<GradingConstants>(() => loadGradingConstants());
  const [tiers, setTiers] = useState<BenchmarkTier[]>(() => loadBenchmarkTiers());
  const [items, setItems] = useState<GameItem[]>(() => loadItems());
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [marketItems, setMarketItems] = useState<MarketItem[]>(() => loadMarketData());

  // Type mapping states
  const [typeMappings, setTypeMappings] = useState<TypeMappingsTable>(() => loadTypeMappings());
  const [unmappedAlerts, setUnmappedAlerts] = useState<string[]>(() => {
    try {
      const logged = localStorage.getItem("smg_unmapped_types_logged");
      return logged ? JSON.parse(logged) : [];
    } catch { return []; }
  });
  const [mapCategory, setMapCategory] = useState<"sword" | "shield" | "pet">("sword");
  const [mapTypeId, setMapTypeId] = useState("");
  const [mapItemName, setMapItemName] = useState("");

  useEffect(() => {
    if (items && items.length > 0) {
      const filtered = items.filter(i => i.type === mapCategory);
      if (filtered.length > 0 && !mapItemName) {
        setMapItemName(filtered[0].name);
      }
    }
  }, [items, mapCategory]);

  // Type mappings operations
  function handleAddMapping() {
    const typeIdNum = parseInt(mapTypeId);
    if (isNaN(typeIdNum) || !mapItemName) return;
    
    setTypeMappings(prev => {
      const updated = {
        swords: { ...prev.swords },
        shields: { ...prev.shields },
        pets: { ...prev.pets }
      };
      if (mapCategory === "sword") {
        updated.swords[typeIdNum] = mapItemName;
      } else if (mapCategory === "shield") {
        updated.shields[typeIdNum] = mapItemName;
      } else if (mapCategory === "pet") {
        updated.pets[typeIdNum] = mapItemName;
      }
      saveTypeMappings(updated);
      return updated;
    });
    setMapTypeId("");
    setSaved(false);
  }

  function handleDeleteMapping(cat: "sword" | "shield" | "pet", typeIdNum: number) {
    setTypeMappings(prev => {
      const updated = {
        swords: { ...prev.swords },
        shields: { ...prev.shields },
        pets: { ...prev.pets }
      };
      if (cat === "sword") {
        delete updated.swords[typeIdNum];
      } else if (cat === "shield") {
        delete updated.shields[typeIdNum];
      } else if (cat === "pet") {
        delete updated.pets[typeIdNum];
      }
      saveTypeMappings(updated);
      return updated;
    });
    setSaved(false);
  }

  function handleAssignUnmapped(loggedStr: string) {
    const parts = loggedStr.split(":");
    if (parts.length === 2) {
      const cat = parts[0] as "sword" | "shield" | "pet";
      const tId = parts[1];
      setMapCategory(cat);
      setMapTypeId(tId);
      const filtered = items.filter(i => i.type === cat);
      if (filtered.length > 0) {
        setMapItemName(filtered[0].name);
      }
    }
  }

  function handleDismissUnmapped(loggedStr: string) {
    setUnmappedAlerts(prev => {
      const updated = prev.filter(x => x !== loggedStr);
      localStorage.setItem("smg_unmapped_types_logged", JSON.stringify(updated));
      return updated;
    });
  }

  // Master Vault states
  const [showMasterPrompt, setShowMasterPrompt] = useState(false);
  const [masterPassword, setMasterPassword] = useState("");
  const [masterToken, setMasterToken] = useState("");
  const [masterUnlocked, setMasterUnlocked] = useState(false);
  const [masterError, setMasterError] = useState("");

  async function handleMasterUnlock() {
    setMasterError("");
    if (!masterPassword.trim()) {
      setMasterError("Password cannot be blank.");
      return;
    }
    try {
      const res = await fetch("/api/master/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: masterPassword }),
      });
      const data = await res.json() as { token?: string; error?: string };
      if (res.ok && data.token) {
        setMasterToken(data.token);
        setMasterUnlocked(true);
        setShowMasterPrompt(false);
        setMasterPassword("");
      } else {
        setMasterError(data.error || "Decryption failed.");
      }
    } catch {
      setMasterError("Connection error.");
    }
  }

  if (masterUnlocked) {
    return (
      <div className="min-h-screen text-white flex flex-col relative overflow-hidden bg-[#03050b]">
        <ParticleBackground />
        <div className="max-w-6xl mx-auto w-full px-6 py-10 z-10 relative">
          <MasterVaultConsole token={masterToken} onLock={() => { setMasterUnlocked(false); setMasterToken(""); }} />
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <>
        <PasswordGate 
          onUnlock={() => setUnlocked(true)} 
          onTriggerMaster={() => setShowMasterPrompt(true)} 
        />
        {showMasterPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setShowMasterPrompt(false)} />
            <div className="relative w-full max-w-sm border border-white/[0.04] bg-[#05050f] p-6 rounded-xl space-y-4 shadow-[0_4px_30px_rgba(0,0,0,0.6)] text-white">
              <div>
                <h3 className="text-sm font-black text-[#ffd700] uppercase tracking-widest">Master Vault Decryption</h3>
                <p className="text-white/35 text-[9px] uppercase font-bold mt-0.5">Access Authorization Required</p>
              </div>
              
              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="Enter system master password"
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleMasterUnlock()}
                  className="w-full bg-[#03050b] border border-white/[0.04] focus:border-amber-500/30 text-white text-xs px-3 py-2.5 rounded-lg outline-none"
                  autoFocus
                />
                {masterError && <p className="text-red-400 text-xs font-semibold">⚠️ {masterError}</p>}
              </div>

              <div className="flex gap-2 justify-end">
                <button type="button" onClick={handleMasterUnlock} className="px-4 py-2 rounded bg-amber-500 text-black font-black text-xs cursor-pointer">Decrypt</button>
                <button type="button" onClick={() => { setShowMasterPrompt(false); setMasterError(""); setMasterPassword(""); }} className="px-4 py-2 rounded bg-white/5 text-white/60 text-xs cursor-pointer">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  function handleAddItem(newItem: GameItem) {
    setItems((prev) => [...prev, newItem]);
    setSaved(false);
  }

  function handleEditItem(idx: number, updatedItem: GameItem) {
    setItems((prev) => {
      const updated = [...prev];
      updated[idx] = updatedItem;
      return updated;
    });
    setSaved(false);
  }

  function handleDeleteItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setSaved(false);
  }

  function handleSave() {
    const err = validateTiers(tiers);
    if (err) {
      setValidationError(err);
      return;
    }
    saveItems(items);
    saveGradingConstants(settings);
    saveBenchmarkTiers(tiers);
    saveTypeMappings(typeMappings);
    saveMarketData(marketItems);

    fetch("/api/master/admin/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": "harrison@smgrade2026"
      },
      body: JSON.stringify({
        items,
        prices: marketItems,
        benchmarks: tiers,
        constants: settings
      })
    })
    .then(res => {
      if (!res.ok) throw new Error("Failed to persist changes to the shared backend database.");
    })
    .catch(err => {
      console.error(err);
    });

    setSaved(true);
    setTimeout(() => navigate("/"), 800);
  }

  function handleReset() {
    setSettings({ ...DEFAULT_CONSTANTS });
    setTiers([...DEFAULT_BENCHMARKS]);
    setItems([...DEFAULT_ITEMS]);
    setValidationError(null);
    saveGradingConstants(DEFAULT_CONSTANTS);
    saveBenchmarkTiers(DEFAULT_BENCHMARKS);
    saveItems(DEFAULT_ITEMS);
    localStorage.removeItem("smg_market_database_v1");
    const defaultMarket = initializeMarketData();
    setMarketItems(defaultMarket);
    localStorage.removeItem("smg_type_mappings_v1");
    setTypeMappings({ swords: {}, shields: {}, pets: {} });
    localStorage.removeItem("smg_unmapped_types_logged");
    setUnmappedAlerts([]);

    fetch("/api/master/admin/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": "harrison@smgrade2026"
      },
      body: JSON.stringify({
        items: DEFAULT_ITEMS,
        prices: defaultMarket,
        benchmarks: DEFAULT_BENCHMARKS,
        constants: DEFAULT_CONSTANTS
      })
    })
    .then(res => {
      if (!res.ok) throw new Error("Failed to reset changes in the shared backend database.");
    })
    .catch(err => {
      console.error(err);
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleTierChange(idx: number, field: keyof BenchmarkTier, val: any) {
    const updated = [...tiers];
    updated[idx] = { ...updated[idx], [field]: val };
    const err = validateTiers(updated);
    setValidationError(err);
    setTiers(updated);
    if (!err) {
      saveBenchmarkTiers(updated);
    }
  }

  function handleResetTiers() {
    setTiers([...DEFAULT_BENCHMARKS]);
    setValidationError(null);
    saveBenchmarkTiers(DEFAULT_BENCHMARKS);
  }

  return (
    <div className="min-h-screen text-white flex flex-col relative overflow-hidden bg-[#020202]">
      <ParticleBackground />
      <header className="border-b border-white/[0.04] px-6 py-4 flex items-center justify-between sticky top-0 bg-[#030303]/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <span className="text-[#ffd700] font-bold">SM</span>
          <span className="text-white font-bold">Grade</span>
          <span className="text-[#333] text-xs font-mono select-none">
            / admin
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleReset} className="text-[#444] hover:text-[#666] text-xs transition-colors">
            Reset to defaults
          </button>
          <Link href="/" className="text-[#333] text-xs hover:text-[#555] transition-colors">← Back</Link>
        </div>
      </header>

      {showMasterPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setShowMasterPrompt(false)} />
          <div className="relative w-full max-w-sm border border-white/[0.04] bg-[#05050f] p-6 rounded-xl space-y-4 shadow-[0_4px_30px_rgba(0,0,0,0.6)] text-white">
            <div>
              <h3 className="text-sm font-black text-[#ffd700] uppercase tracking-widest">Master Vault Decryption</h3>
              <p className="text-white/35 text-[9px] uppercase font-bold mt-0.5">Access Authorization Required</p>
            </div>
            
            <div className="space-y-3">
              <input
                type="password"
                placeholder="Enter system master password"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleMasterUnlock()}
                className="w-full bg-[#03050b] border border-white/[0.04] focus:border-amber-500/30 text-white text-xs px-3 py-2.5 rounded-lg outline-none"
                autoFocus
              />
              {masterError && <p className="text-red-400 text-xs font-semibold">⚠️ {masterError}</p>}
            </div>

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={handleMasterUnlock} className="px-4 py-2 rounded bg-amber-500 text-black font-black text-xs cursor-pointer">Decrypt</button>
              <button type="button" onClick={() => { setShowMasterPrompt(false); setMasterError(""); setMasterPassword(""); }} className="px-4 py-2 rounded bg-white/5 text-white/60 text-xs cursor-pointer">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 space-y-6">

        {/* Bot Logs */}
        <SectionCard title="Weekly Bot Command Logs">
          <BotLogsUpload />
        </SectionCard>

        {/* Grading Configurations */}
        <SectionCard title="Grading Constants & Configurations">
          <div className="space-y-6">
            
            {/* Gold Exchange Rate */}
            <div>
              <label className="text-xs font-bold text-[#ffd700] block mb-1 uppercase tracking-wider">Gold Exchange Rate</label>
              <p className="text-[#555] text-xs mb-3">Define how much Power 1 unit of Gold represents in calculation. Default is 100 (meaning 1 QT Gold = 100 QT Power).</p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-white">1 Gold = </span>
                <input
                  type="number"
                  className="bg-[#111] border border-[#2a2a2a] focus:border-[#ffd700] text-white text-xs px-3 py-2 rounded-sm outline-none transition-colors font-mono w-32"
                  value={settings.goldExchangeRate}
                  onChange={(e) => {
                    setSettings({ ...settings, goldExchangeRate: parseFloat(e.target.value) || 0 });
                    setSaved(false);
                  }}
                />
                <span className="text-xs text-[#555]">Power Units</span>
              </div>
            </div>

            <div className="border-t border-[#1e1e1e]" />

            {/* Grading Weights */}
            <div>
              <label className="text-xs font-bold text-[#ffd700] block mb-1 uppercase tracking-wider">Grading Component Weights (Must sum to 100%)</label>
              <p className="text-[#555] text-xs mb-3">Adjust how much weight each metric contributes to the overall grade calculation.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Gear Weight", field: "gearWeight" },
                  { label: "Power Weight", field: "powerWeight" },
                  { label: "Progress Weight", field: "progressWeight" },
                  { label: "Wealth Weight", field: "wealthWeight" },
                ].map((w) => (
                  <div key={w.field} className="space-y-1">
                    <label className="text-[#888] text-[10px] uppercase font-bold">{w.label}</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        className="bg-[#111] border border-[#2a2a2a] focus:border-[#ffd700] text-white text-xs px-2 py-2 rounded-sm outline-none transition-colors font-mono w-20"
                        value={settings[w.field as keyof GradingConstants]}
                        onChange={(e) => {
                          setSettings({ ...settings, [w.field]: parseFloat(e.target.value) || 0 });
                          setSaved(false);
                        }}
                      />
                      <span className="text-xs text-[#555]">({Math.round((settings[w.field as keyof GradingConstants] as number) * 100)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[10px] font-mono mt-3" style={{
                color: Math.abs(settings.gearWeight + settings.powerWeight + settings.progressWeight + settings.wealthWeight - 1.0) < 0.001 ? "#4a9e5c" : "#e05a5a"
              }}>
                Total Sum: {Math.round((settings.gearWeight + settings.powerWeight + settings.progressWeight + settings.wealthWeight) * 100)}%
              </div>
            </div>

            <div className="border-t border-[#1e1e1e]" />

            {/* Grade Thresholds */}
            <div>
              <label className="text-xs font-bold text-[#ffd700] block mb-1 uppercase tracking-wider">Score Grade Thresholds (0-100)</label>
              <p className="text-[#555] text-xs mb-3">Adjust the minimum score needed to receive each grade letter.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { grade: "S+", field: "gradeThresholdSPlus" },
                  { grade: "S", field: "gradeThresholdS" },
                  { grade: "A+", field: "gradeThresholdAPlus" },
                  { grade: "A", field: "gradeThresholdA" },
                  { grade: "B+", field: "gradeThresholdBPlus" },
                  { grade: "B", field: "gradeThresholdB" },
                  { grade: "C+", field: "gradeThresholdCPlus" },
                  { grade: "C", field: "gradeThresholdC" },
                ].map((g) => (
                  <div key={g.field} className="space-y-1">
                    <label className="text-[#888] text-[10px] uppercase font-bold">Grade {g.grade} (min score)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="bg-[#111] border border-[#2a2a2a] focus:border-[#ffd700] text-white text-xs px-2 py-2 rounded-sm outline-none transition-colors font-mono w-24"
                      value={settings[g.field as keyof GradingConstants]}
                      onChange={(e) => {
                        setSettings({ ...settings, [g.field]: parseInt(e.target.value) || 0 });
                        setSaved(false);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

          </div>
        </SectionCard>

        {/* Game Database CRUD Editor */}
        <SectionCard title="Game Database Editor (Swords, Shields, Pets, & More)">
          <div className="space-y-5">
            <p className="text-[#555] text-xs leading-relaxed">
              Manage the game database items. Add, edit, or delete items. Changes will be saved dynamically to localStorage when you click the "Save All" button below.
            </p>
            <GameDatabaseEditor
              items={items}
              onAddItem={handleAddItem}
              onEditItem={handleEditItem}
              onDeleteItem={handleDeleteItem}
            />
          </div>
        </SectionCard>

        {/* Market Prices Editor */}
        <SectionCard title="Market Prices (Power-Based, Update Weekly)">
          <div className="space-y-5">
            <p className="text-[#555] text-xs leading-relaxed">
              Set current market prices for each item. These are used in upgrade advice and net worth valuations shown to players.
            </p>
            <MarketDatabaseEditor marketItems={marketItems} setMarketItems={setMarketItems} items={items} />
          </div>
        </SectionCard>

        {/* Equipment Server Type Mappings Editor */}
        <SectionCard title="Equipment Server Type Mappings Manager">
          <div className="space-y-5">
            <p className="text-[#555] text-xs leading-relaxed">
              Create and manage deterministic mapping associations between game server numeric type IDs and the official SwordMasters weapons/pets.
            </p>

            {/* Encountered type ID alerts */}
            {unmappedAlerts.length > 0 && (
              <div className="bg-amber-950/20 border border-amber-500/20 p-4 rounded text-xs space-y-2">
                <p className="font-bold text-amber-400">⚠️ Pending Unmapped Type IDs Detected:</p>
                <div className="divide-y divide-amber-500/10">
                  {unmappedAlerts.map(alert => {
                    const [cat, tId] = alert.split(":");
                    return (
                      <div key={alert} className="py-2 flex items-center justify-between">
                        <span className="capitalize text-white/70">Category: <strong className="text-white">{cat}</strong>, Type ID: <strong className="text-white">{tId}</strong></span>
                        <div className="space-x-3">
                          <button onClick={() => handleAssignUnmapped(alert)} className="text-[#ffd700] hover:underline font-bold">Assign Mapping</button>
                          <button onClick={() => handleDismissUnmapped(alert)} className="text-red-400 hover:underline">Dismiss</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Current Mappings list */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Swords mappings table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#ffd700] uppercase tracking-wider">Swords Mappings</h4>
                <div className="border border-[#2a2a2a] rounded max-h-[220px] overflow-y-auto bg-[#080808]">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-[#2a2a2a] text-[#555] bg-[#0c0c0c] font-bold">
                        <th className="p-2">Type ID</th>
                        <th className="p-2">Bound Item</th>
                        <th className="p-2 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e1e1e]">
                      {Object.entries(typeMappings.swords).map(([tId, name]) => (
                        <tr key={tId} className="hover:bg-[#111]">
                          <td className="p-2 font-mono">{tId}</td>
                          <td className="p-2 font-bold text-white">{name}</td>
                          <td className="p-2 text-right">
                            <button onClick={() => handleDeleteMapping("sword", parseInt(tId))} className="text-red-500 hover:underline">×</button>
                          </td>
                        </tr>
                      ))}
                      {Object.keys(typeMappings.swords).length === 0 && (
                        <tr><td colSpan={3} className="p-3 text-[#555] text-center italic">No sword mappings defined</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Shields mappings table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#ffd700] uppercase tracking-wider">Shields Mappings</h4>
                <div className="border border-[#2a2a2a] rounded max-h-[220px] overflow-y-auto bg-[#080808]">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-[#2a2a2a] text-[#555] bg-[#0c0c0c] font-bold">
                        <th className="p-2">Type ID</th>
                        <th className="p-2">Bound Item</th>
                        <th className="p-2 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e1e1e]">
                      {Object.entries(typeMappings.shields).map(([tId, name]) => (
                        <tr key={tId} className="hover:bg-[#111]">
                          <td className="p-2 font-mono">{tId}</td>
                          <td className="p-2 font-bold text-white">{name}</td>
                          <td className="p-2 text-right">
                            <button onClick={() => handleDeleteMapping("shield", parseInt(tId))} className="text-red-500 hover:underline">×</button>
                          </td>
                        </tr>
                      ))}
                      {Object.keys(typeMappings.shields).length === 0 && (
                        <tr><td colSpan={3} className="p-3 text-[#555] text-center italic">No shield mappings defined</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pets mappings table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#ffd700] uppercase tracking-wider">Pets Mappings</h4>
                <div className="border border-[#2a2a2a] rounded max-h-[220px] overflow-y-auto bg-[#080808]">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-[#2a2a2a] text-[#555] bg-[#0c0c0c] font-bold">
                        <th className="p-2">Type ID</th>
                        <th className="p-2">Bound Item</th>
                        <th className="p-2 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e1e1e]">
                      {Object.entries(typeMappings.pets).map(([tId, name]) => (
                        <tr key={tId} className="hover:bg-[#111]">
                          <td className="p-2 font-mono">{tId}</td>
                          <td className="p-2 font-bold text-white">{name}</td>
                          <td className="p-2 text-right">
                            <button onClick={() => handleDeleteMapping("pet", parseInt(tId))} className="text-red-500 hover:underline">×</button>
                          </td>
                        </tr>
                      ))}
                      {Object.keys(typeMappings.pets).length === 0 && (
                        <tr><td colSpan={3} className="p-3 text-[#555] text-center italic">No pet mappings defined</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Add Mapping Form */}
            <div className="bg-[#111] p-4 rounded-sm border border-[#2a2a2a] space-y-4 pt-3">
              <p className="text-xs font-bold text-white uppercase tracking-wider">Add or Update Mapping Entry</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-[#888] uppercase font-bold">Category</label>
                  <select
                    className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white text-xs px-2.5 py-2 rounded outline-none"
                    value={mapCategory}
                    onChange={e => {
                      const cat = e.target.value as any;
                      setMapCategory(cat);
                      const filtered = items.filter(i => i.type === cat);
                      if (filtered.length > 0) {
                        setMapItemName(filtered[0].name);
                      }
                    }}
                  >
                    <option value="sword">Sword</option>
                    <option value="shield">Shield</option>
                    <option value="pet">Pet</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-[#888] uppercase font-bold">Type ID</label>
                  <input
                    type="number"
                    className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white text-xs px-2.5 py-2 rounded outline-none font-mono"
                    value={mapTypeId}
                    onChange={e => setMapTypeId(e.target.value)}
                    placeholder="e.g. 5"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-[#888] uppercase font-bold">Bound Item</label>
                  <select
                    className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white text-xs px-2.5 py-2 rounded outline-none"
                    value={mapItemName}
                    onChange={e => setMapItemName(e.target.value)}
                  >
                    <option value="">-- Select Item --</option>
                    {items.filter(i => i.type === mapCategory).map(i => (
                      <option key={i.name} value={i.name}>{i.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAddMapping}
                  className="bg-[#ffd700] hover:bg-[#38bdf8] text-black text-xs font-bold px-4 py-2 rounded"
                >
                  Apply Mapping Entry
                </button>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Save button */}
        <button
          onClick={handleSave}
          className={`w-full font-bold text-sm py-4 rounded-sm transition-all tracking-widest uppercase ${
            saved
              ? "bg-[#9ecb7a] text-black"
              : "bg-[#ffd700] hover:bg-[#38bdf8] text-black"
          }`}
        >
          {saved ? "✓ Prices Saved" : "Save All Prices"}
        </button>

        <SectionCard title="Benchmark Tiers Editor">
          <ScoringRef
            tiers={tiers}
            setTiers={setTiers}
            settings={settings}
            onTierChange={handleTierChange}
            validationError={validationError}
            setValidationError={setValidationError}
            onResetTiers={handleResetTiers}
          />
        </SectionCard>

        <SectionCard title="System Intelligence & Analytics">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/[0.01] border border-white/[0.03] rounded-lg p-4">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-white">Master Vault Terminal</h4>
              <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider leading-relaxed">
                Authorized system admins can open the Master Vault to track player query logs, view activity histories, review traffic metadata, and export CSV backups.
              </p>
            </div>
            <button
              onClick={() => setShowMasterPrompt(true)}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black rounded text-xs font-black uppercase tracking-widest transition-colors cursor-pointer whitespace-nowrap"
            >
              Open Master Vault
            </button>
          </div>
        </SectionCard>

      </main>



      <footer className="border-t border-white/[0.04] px-6 py-4 text-center text-white/10 text-xs relative">
        SMGrade Admin Panel · Internal Only
        <span 
          onClick={() => setShowMasterPrompt(true)}
          className="absolute right-6 top-1/2 -translate-y-1/2 text-white/20 hover:text-amber-400 transition-colors cursor-pointer text-xs select-none"
          title="Access Master Console"
        >
          🔒
        </span>
      </footer>
    </div>
  );
}
