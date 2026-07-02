import { useState, useMemo } from "react";
import type { ParsedPlayer } from "@/lib/parser";
import type { ScoreResult } from "@/lib/scorer";
import { scorePlayer } from "@/lib/scorer";
import { SWORDS, SHIELDS, getSwordData, getShieldData, scaledSwordDamage, scaledShieldDM } from "@/lib/gearDatabase";
import { parseNumber, formatNumber } from "@/lib/numberParser";
import { calculateDamageStats } from "@/lib/damageCalc";

interface SimulatorProps {
  currentPlayer: ParsedPlayer;
  currentScores: ScoreResult;
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

export default function Simulator({ currentPlayer, currentScores }: SimulatorProps) {
  // Input states
  const [selectedSword, setSelectedSword] = useState(currentPlayer.sword);
  const [swordLevel, setSwordLevel] = useState(currentPlayer.swordLevel);
  const [selectedShield, setSelectedShield] = useState(currentPlayer.shield);
  const [shieldLevel, setShieldLevel] = useState(currentPlayer.shieldLevel);
  
  const [powerInput, setPowerInput] = useState(currentPlayer.power);
  const [goldInput, setGoldInput] = useState(currentPlayer.gold);

  // Parse custom string inputs
  const parsedPower = useMemo(() => parseNumber(powerInput), [powerInput]);
  const parsedGold = useMemo(() => parseNumber(goldInput), [goldInput]);

  // Compute simulated player object
  const simulatedPlayer = useMemo<ParsedPlayer>(() => {
    return {
      ...currentPlayer,
      sword: selectedSword,
      swordLevel: swordLevel,
      shield: selectedShield,
      shieldLevel: shieldLevel,
      power: formatNumber(parsedPower),
      powerRaw: parsedPower,
      gold: formatNumber(parsedGold),
      goldRaw: parsedGold,
    };
  }, [currentPlayer, selectedSword, swordLevel, selectedShield, shieldLevel, parsedPower, parsedGold]);

  // Calculate simulated score
  const simulatedScores = useMemo(() => scorePlayer(simulatedPlayer), [simulatedPlayer]);

  // Calculate current vs simulated combat damages
  const curSword = getSwordData(currentPlayer.sword);
  const curShield = getShieldData(currentPlayer.shield);
  const curDS = curSword ? scaledSwordDamage(curSword.baseDamage, currentPlayer.swordLevel) * 1e9 : 0;
  const curMS = curShield ? scaledShieldDM(curShield.baseDM, currentPlayer.shieldLevel) : 0;
  const curDamageStats = calculateDamageStats({
    ds: curDS,
    swordDamageMultiplier: curMS,
    power: currentPlayer.powerRaw,
    petPowerBonus: 0
  });
  const curDamage = curDamageStats.damagePerHit;

  const simSword = getSwordData(selectedSword);
  const simShield = getShieldData(selectedShield);
  const simDS = simSword ? scaledSwordDamage(simSword.baseDamage, swordLevel) * 1e9 : 0;
  const simMS = simShield ? scaledShieldDM(simShield.baseDM, shieldLevel) : 0;
  const simDamageStats = calculateDamageStats({
    ds: simDS,
    swordDamageMultiplier: simMS,
    power: parsedPower,
    petPowerBonus: 0
  });
  const simDamage = simDamageStats.damagePerHit;
  const simDps = simDamageStats.damagePerSecond;

  // Percentage gains
  const dmgGainPct = curDamage > 0 ? ((simDamage - curDamage) / curDamage) * 100 : 0;

  function fmtBig(n: number): string {
    if (n >= 1e24) return (n / 1e24).toFixed(2) + " OCT";
    if (n >= 1e21) return (n / 1e21).toFixed(2) + " SXT";
    if (n >= 1e18) return (n / 1e18).toFixed(2) + " QNT";
    if (n >= 1e15) return (n / 1e15).toFixed(2) + " QT";
    if (n >= 1e12) return (n / 1e12).toFixed(2) + " T";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + " B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + " M";
    return n.toFixed(0);
  }

  return (
    <div className="border border-white/[0.04] rounded-xl overflow-hidden glass-panel text-white shadow-[0_4px_30px_rgba(0,0,0,0.4)] bg-[#05050f]/60">
      {/* Header */}
      <div className="px-5 py-4.5 border-b border-white/[0.04] bg-white/[0.01] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚙️</span>
          <span className="text-amber-400 font-black text-xs tracking-widest uppercase font-display">Upgrade Simulator</span>
        </div>
        <span className="text-white/20 text-[9px] uppercase tracking-widest font-black font-display">Live Sandbox Mode</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/[0.04]">
        {/* Left Side: Controls */}
        <div className="p-5 space-y-4">
          <div className="text-[9px] uppercase tracking-widest text-white/30 font-black font-display mb-1">Simulate Stats</div>
          
          {/* Sword Selection */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-[9px] uppercase tracking-wider font-bold text-white/40 block mb-1">Sword</label>
              <select
                className="w-full bg-[#070b13] border border-white/[0.04] focus:border-amber-500/30 text-white/70 rounded-lg px-3 py-2.5 text-xs outline-none transition-colors cursor-pointer"
                value={selectedSword}
                onChange={(e) => setSelectedSword(e.target.value)}
              >
                {SWORDS.map((s) => (
                  <option key={s.name} value={s.name} className="bg-[#070b13]">{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] uppercase tracking-wider font-bold text-white/40 block mb-1">Level</label>
              <select
                className="w-full bg-[#070b13] border border-white/[0.04] focus:border-amber-500/30 text-white/70 rounded-lg px-3 py-2.5 text-xs outline-none transition-colors cursor-pointer"
                value={swordLevel}
                onChange={(e) => setSwordLevel(parseInt(e.target.value))}
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((lvl) => (
                  <option key={lvl} value={lvl} className="bg-[#070b13]">Lv{lvl}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Shield Selection */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-[9px] uppercase tracking-wider font-bold text-white/40 block mb-1">Shield</label>
              <select
                className="w-full bg-[#070b13] border border-white/[0.04] focus:border-amber-500/30 text-white/70 rounded-lg px-3 py-2.5 text-xs outline-none transition-colors cursor-pointer"
                value={selectedShield}
                onChange={(e) => setSelectedShield(e.target.value)}
              >
                {SHIELDS.map((s) => (
                  <option key={s.name} value={s.name} className="bg-[#070b13]">{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] uppercase tracking-wider font-bold text-white/40 block mb-1">Level</label>
              <select
                className="w-full bg-[#070b13] border border-white/[0.04] focus:border-amber-500/30 text-white/70 rounded-lg px-3 py-2.5 text-xs outline-none transition-colors cursor-pointer"
                value={shieldLevel}
                onChange={(e) => setShieldLevel(parseInt(e.target.value))}
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((lvl) => (
                  <option key={lvl} value={lvl} className="bg-[#070b13]">Lv{lvl}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Power Input */}
          <div>
            <label className="text-[9px] uppercase tracking-wider font-bold text-white/40 block mb-1">Power (e.g. 9.95QT, 2.5SXT)</label>
            <input
              type="text"
              className="w-full bg-[#070b13] border border-white/[0.04] focus:border-amber-500/30 text-white/80 rounded-lg px-3 py-2.5 text-xs outline-none transition-colors font-mono"
              value={powerInput}
              onChange={(e) => setPowerInput(e.target.value)}
            />
          </div>

          {/* Gold Input */}
          <div>
            <label className="text-[9px] uppercase tracking-wider font-bold text-white/40 block mb-1">Gold</label>
            <input
              type="text"
              className="w-full bg-[#070b13] border border-white/[0.04] focus:border-amber-500/30 text-white/80 rounded-lg px-3 py-2.5 text-xs outline-none transition-colors font-mono"
              value={goldInput}
              onChange={(e) => setGoldInput(e.target.value)}
            />
          </div>
        </div>

        {/* Right Side: Simulated Results & Comparison */}
        <div className="p-5 space-y-5 bg-white/[0.01]">
          <div className="text-[9px] uppercase tracking-widest text-white/30 font-black font-display">Simulated Output</div>

          {/* Grade Comparison */}
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
            <div>
              <span className="text-[9px] text-white/30 font-bold uppercase tracking-wider block mb-1">Overall Grade</span>
              <span className="text-3xl font-black font-display leading-none transition-colors drop-shadow-sm" style={{ color: GRADE_COLOR[simulatedScores.overallGrade] }}>
                {simulatedScores.overallGrade}
              </span>
              <span className="text-[9px] text-amber-400 block font-mono font-bold mt-1">Score: {simulatedScores.overallScore}/100</span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-white/20 text-[8px] uppercase tracking-wider font-bold block">Current</span>
                <span className="text-xs font-bold font-mono text-white/40">
                  {currentScores.overallGrade} ({currentScores.overallScore})
                </span>
              </div>
              <span className="text-white/20 text-xs">→</span>
              <div className="text-right">
                <span className="text-amber-400 text-[8px] uppercase tracking-wider font-bold block">Simulated</span>
                <span className="text-xs font-bold font-mono" style={{ color: GRADE_COLOR[simulatedScores.overallGrade] }}>
                  {simulatedScores.overallGrade} ({simulatedScores.overallScore})
                </span>
              </div>
            </div>
          </div>

          {/* Damage Comparison */}
          <div className="space-y-2.5 border-b border-white/[0.04] pb-4">
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/40 font-semibold">Damage / Hit</span>
              <span className="font-mono font-black text-white flex items-center gap-2">
                {fmtBig(simDamage)}
                {dmgGainPct !== 0 && (
                  <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase ${
                    dmgGainPct > 0 ? "bg-[#5ecb7a]/15 text-[#5ecb7a] border border-[#5ecb7a]/20" : "bg-red-500/10 text-red-400 border border-red-500/15"
                  }`}>
                    {dmgGainPct > 0 ? "+" : ""}{dmgGainPct.toFixed(1)}%
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/40 font-semibold">Estimated DPS</span>
              <span className="font-mono text-white/70 font-bold">
                {fmtBig(simDps)}
              </span>
            </div>
          </div>

          {/* Sub-score bars comparison */}
          <div className="space-y-3.5">
            {[
              { label: "Gear Score", cur: currentScores.gearScore, sim: simulatedScores.gearScore, color: "#ffd700" },
              { label: "Power Score", cur: currentScores.powerScore, sim: simulatedScores.powerScore, color: "#3b82f6" },
              { label: "Progress Score", cur: currentScores.progressScore, sim: simulatedScores.progressScore, color: "#5ecb7a" },
              { label: "Wealth Score", cur: currentScores.wealthScore, sim: simulatedScores.wealthScore, color: "#a855f7" },
            ].map((score) => {
              const diff = score.sim - score.cur;
              return (
                <div key={score.label} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/40 font-semibold">{score.label}</span>
                    <span className="font-mono text-white flex items-center gap-1.5 font-bold">
                      <span>{score.sim}%</span>
                      {diff !== 0 && (
                        <span className={`text-[9px] font-black font-mono ${diff > 0 ? "text-[#5ecb7a]" : "text-red-400"}`}>
                          ({diff > 0 ? "+" : ""}{diff})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/[0.03] border border-white/[0.02] rounded-full overflow-hidden relative">
                    <div
                      className="h-full rounded-full transition-all duration-300 absolute left-0"
                      style={{ width: `${score.sim}%`, backgroundColor: score.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
