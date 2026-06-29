import { useEffect, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { ParsedPlayer } from "@/lib/parser";
import type { ScoreResult } from "@/lib/scorer";
import { getSwordData, getShieldData, scaledSwordDamage, scaledShieldDM } from "@/lib/gearDatabase";
import { formatNumber } from "@/lib/numberParser";

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
  "S+": "#FFD700",
  S: "#FFD700",
  "A+": "#c9a84c",
  A: "#c9a84c",
  "B+": "#8ab4c9",
  B: "#8ab4c9",
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

    // Compute stats for current scan
    const sw = getSwordData(player.sword);
    const sh = getShieldData(player.shield);
    const ds = sw ? scaledSwordDamage(sw.baseDamage, player.swordLevel) * 1e9 : 0;
    const ms = sh ? scaledShieldDM(sh.baseDM, player.shieldLevel) : 0;
    const dmg = (ds + 2 * Math.sqrt(Math.max(player.powerRaw, 0)) + 1) * (1 + ms);
    const dps = dmg * 2.77;

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

    // Check if the latest saved entry is identical to current to avoid duplicate spamming
    const latest = list[list.length - 1];
    const isDuplicate = latest && 
      latest.level === newEntry.level && 
      latest.powerRaw === newEntry.powerRaw && 
      latest.overallScore === newEntry.overallScore;

    if (!isDuplicate) {
      list.push(newEntry);
      // Limit history to last 20 entries
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
      <div className="border border-[#1e1e1e] rounded-xl p-5 bg-[#0c0c0c] text-[#555] text-xs text-center">
        📈 Progression history will populate here as you scan your account over time.
      </div>
    );
  }

  // Map data for graph (shorten DPS for axis)
  const chartData = history.map((h) => ({
    name: h.date,
    dps: h.dps,
    dpsFmt: fmtBig(h.dps),
    level: h.level,
    score: h.overallScore,
  }));

  return (
    <div className="border border-[#1e1e1e] rounded-xl overflow-hidden bg-[#0c0c0c] text-white space-y-4">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#151515] bg-[#0f0f0f] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📈</span>
          <span className="text-[#c9a84c] font-bold text-sm tracking-wide">PROGRESSION TRACKER</span>
        </div>
        <span className="text-[#555] text-[10px] uppercase tracking-widest font-semibold">{history.length} Scans</span>
      </div>

      <div className="p-5 space-y-6">
        {/* Graph */}
        <div className="h-60 w-full bg-[#080808] rounded-lg p-2 border border-[#111]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#151515" />
              <XAxis dataKey="name" stroke="#444" fontSize={9} tickLine={false} />
              <YAxis stroke="#444" fontSize={9} tickLine={false} tickFormatter={(v) => fmtBig(v)} />
              <Tooltip
                contentStyle={{ background: "#0c0c0c", border: "1px solid #1e1e1e" }}
                labelStyle={{ fontSize: "10px", color: "#555", fontWeight: "bold" }}
                itemStyle={{ fontSize: "11px", color: "#c9a84c" }}
                formatter={(value: any, name: any, props: any) => [props.payload.dpsFmt, "DPS"]}
              />
              <Line type="monotone" dataKey="dps" stroke="#c9a84c" strokeWidth={2} dot={{ fill: "#c9a84c", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Scan Log Table */}
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-[#555] font-bold">Progression Log</div>
          <div className="border border-[#151515] rounded-lg overflow-hidden bg-[#0a0a0a]">
            <div className="grid grid-cols-4 px-4 py-2 border-b border-[#151515] bg-[#0f0f0f] text-[9px] uppercase tracking-wider font-semibold text-[#555]">
              <span>Date</span>
              <span className="text-center">Level</span>
              <span className="text-center">Grade</span>
              <span className="text-right">DPS</span>
            </div>
            <div className="divide-y divide-[#151515] text-xs font-mono max-h-40 overflow-y-auto">
              {history.map((h, i) => (
                <div key={i} className="grid grid-cols-4 px-4 py-2.5 items-center">
                  <span className="text-[#555] font-sans truncate pr-2">{h.date}</span>
                  <span className="text-center text-[#888]">{h.level.toLocaleString()}</span>
                  <span className="text-center font-bold" style={{ color: GRADE_COLOR[h.overallGrade] }}>{h.overallGrade}</span>
                  <span className="text-right text-[#ccc]">{fmtBig(h.dps)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
