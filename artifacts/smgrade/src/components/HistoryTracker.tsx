import { useEffect, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { ParsedPlayer } from "@/lib/parser";
import type { ScoreResult } from "@/lib/scorer";
import { getSwordData, getShieldData, scaledSwordDamage, scaledShieldDM } from "@/lib/gearDatabase";
import { formatNumber } from "@/lib/numberParser";
import { calculateDamageStats } from "@/lib/damageCalc";

interface HistoryTrackerProps {
  player: ParsedPlayer;
  scores: ScoreResult;
}

export interface ProgressEntry {
  date: string;
  level: number;
  powerRaw: number;
  power: string;
  overallScore: number;
  overallGrade: string;
  damagePerHit: number;
  dps: number;
}

const GRADE_COLOR: Record<string, string> = {
  "S+": "#ffd700",
  S: "#ffd700",
  "A+": "#3b82f6",
  A: "#3b82f6",
  "B+": "#a855f7",
  B: "#a855f7",
  "C+": "#888",
  C: "#888",
  D: "#e05a5a",
};

export default function HistoryTracker({ player, scores }: HistoryTrackerProps) {
  const [history, setHistory] = useState<ProgressEntry[]>([]);

  useEffect(() => {
    if (!player || !scores) return;

    const key = `smg_hist_${player.username.toLowerCase()}`;
    const raw = localStorage.getItem(key);
    let list: ProgressEntry[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw) as ProgressEntry[];
      } catch {
        list = [];
      }
    }

    const sw = getSwordData(player.sword);
    const sh = getShieldData(player.shield);
    const ds = sw ? scaledSwordDamage(sw.baseDamage, player.swordLevel) * 1e9 : 0;
    const ms = sh ? scaledShieldDM(sh.baseDM, player.shieldLevel) : 0;
    const dmgStats = calculateDamageStats({
      ds,
      swordDamageMultiplier: ms,
      power: player.powerRaw,
      petPowerBonus: 0
    });
    const dmg = dmgStats.damagePerHit;
    const dps = dmgStats.damagePerSecond;

    const newEntry: ProgressEntry = {
      date: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      level: player.level,
      powerRaw: player.powerRaw,
      power: player.power,
      overallScore: scores.overallScore,
      overallGrade: scores.overallGrade,
      damagePerHit: dmg,
      dps: dps,
    };

    const latest = list[list.length - 1];
    const isDuplicate = latest && 
      latest.level === newEntry.level && 
      latest.powerRaw === newEntry.powerRaw && 
      latest.overallScore === newEntry.overallScore;

    if (!isDuplicate) {
      list.push(newEntry);
      if (list.length > 20) {
        list = list.slice(list.length - 20);
      }
      localStorage.setItem(key, JSON.stringify(list));
    }

    setHistory(list);
  }, [player, scores]);

  function fmtBig(n: number): string {
    if (n >= 1e24) return (n / 1e24).toFixed(1) + " OCT";
    if (n >= 1e21) return (n / 1e21).toFixed(1) + " SXT";
    if (n >= 1e18) return (n / 1e18).toFixed(1) + " QNT";
    if (n >= 1e15) return (n / 1e15).toFixed(1) + " QT";
    if (n >= 1e12) return (n / 1e12).toFixed(1) + " T";
    if (n >= 1e9) return (n / 1e9).toFixed(1) + " B";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + " M";
    return n.toFixed(0);
  }

  if (history.length <= 1) {
    return (
      <div className="border border-white/[0.04] rounded-xl p-5 bg-white/[0.01] glass-panel text-white/40 text-xs text-center font-medium leading-relaxed">
        📈 Progression history will populate here as you scan your account over time.
      </div>
    );
  }

  const chartData = history.map((h) => ({
    name: h.date,
    dps: h.dps,
    dpsFmt: fmtBig(h.dps),
    level: h.level,
    score: h.overallScore,
  }));

  return (
    <div className="border border-white/[0.04] rounded-xl overflow-hidden glass-panel text-white shadow-[0_4px_30px_rgba(0,0,0,0.4)] bg-[#05050f]/60">
      {/* Header */}
      <div className="px-5 py-4.5 border-b border-white/[0.04] bg-white/[0.01] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📈</span>
          <span className="text-amber-400 font-black text-xs tracking-widest uppercase font-display">Progression Tracker</span>
        </div>
        <span className="text-white/20 text-[9px] uppercase tracking-widest font-black font-display">{history.length} Scans</span>
      </div>

      <div className="p-5 space-y-6">
        {/* Graph */}
        <div className="h-60 w-full bg-[#070b13] rounded-lg p-2 border border-white/[0.03] overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.01)" />
              <XAxis dataKey="name" stroke="rgba(255,255,255,0.25)" fontSize={9} tickLine={false} />
              <YAxis stroke="rgba(255,255,255,0.25)" fontSize={9} tickLine={false} tickFormatter={(v) => fmtBig(v)} />
              <Tooltip
                contentStyle={{ background: "rgba(10,10,28,0.9)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px" }}
                labelStyle={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontWeight: "bold", textTransform: "uppercase" }}
                itemStyle={{ fontSize: "11px", color: "#ffd700", fontWeight: "bold" }}
                formatter={(value: any, name: any, props: any) => [props.payload.dpsFmt, "DPS"]}
              />
              <Line type="monotone" dataKey="dps" stroke="#ffd700" strokeWidth={2} dot={{ fill: "#ffd700", r: 4 }} activeDot={{ r: 6, fill: "#a855f7" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Scan Log Table */}
        <div className="space-y-2.5">
          <div className="text-[9px] uppercase tracking-widest text-white/30 font-black font-display">Progression History Log</div>
          <div className="border border-white/[0.04] rounded-lg overflow-hidden bg-white/[0.01] glass-panel">
            <div className="grid grid-cols-4 px-4 py-2.5 border-b border-white/[0.04] bg-white/[0.01] text-[9px] uppercase tracking-widest font-black text-white/30">
              <span>Date</span>
              <span className="text-center">Level</span>
              <span className="text-center">Grade</span>
              <span className="text-right">DPS</span>
            </div>
            <div className="divide-y divide-white/[0.02] text-xs font-mono max-h-40 overflow-y-auto pr-1">
              {history.map((h, i) => (
                <div key={i} className="grid grid-cols-4 px-4 py-3 items-center">
                  <span className="text-white/40 font-sans truncate pr-2 font-semibold">{h.date}</span>
                  <span className="text-center text-white/60 font-bold">{h.level.toLocaleString()}</span>
                  <span className="text-center font-black" style={{ color: GRADE_COLOR[h.overallGrade] }}>{h.overallGrade}</span>
                  <span className="text-right text-white/80 font-bold">{fmtBig(h.dps)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
