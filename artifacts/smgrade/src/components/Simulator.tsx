import { useState, useMemo } from "react";
import type { ParsedPlayer } from "@/lib/parser";
import type { ScoreResult } from "@/lib/scorer";
import { scorePlayer } from "@/lib/scorer";
import { SWORDS, SHIELDS, getSwordData, getShieldData, scaledSwordDamage, scaledShieldDM } from "@/lib/gearDatabase";
import { parseNumber, formatNumber } from "@/lib/numberParser";

interface SimulatorProps {
  currentPlayer: ParsedPlayer;
  currentScores: ScoreResult;
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
  const curDamage = (curDS + 2 * Math.sqrt(Math.max(currentPlayer.powerRaw, 0)) + 1) * (1 + curMS);
  const curDps = curDamage * 2.77;

  const simSword = getSwordData(selectedSword);
  const simShield = getShieldData(selectedShield);
  const simDS = simSword ? scaledSwordDamage(simSword.baseDamage, swordLevel) * 1e9 : 0;
  const simMS = simShield ? scaledShieldDM(simShield.baseDM, shieldLevel) : 0;
  const simDamage = (simDS + 2 * Math.sqrt(Math.max(parsedPower, 0)) + 1) * (1 + simMS);
  const simDps = simDamage * 2.77;

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
    <div className="border border-[#1e1e1e] rounded-xl overflow-hidden bg-[#0c0c0c] text-white">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#151515] bg-[#0f0f0f] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚙️</span>
          <span className="text-[#c9a84c] font-bold text-sm tracking-wide">UPGRADE SIMULATOR</span>
        </div>
        <span className="text-[#555] text-[10px] uppercase tracking-widest font-semibold">Test Builds Live</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#151515]">
        {/* Left Side: Controls */}
        <div className="p-5 space-y-4">
          <div className="text-[10px] uppercase tracking-wider text-[#555] font-bold mb-1">Simulate Stats</div>
          
          {/* Sword Selection */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-[10px] text-[#555] block mb-1">Sword</label>
              <select
                className="w-full bg-[#080808] border border-[#222] text-[#ccc] rounded-lg px-3 py-2 text-xs outline-none focus:border-[#c9a84c] transition-colors"
                value={selectedSword}
                onChange={(e) => setSelectedSword(e.target.value)}
              >
                {SWORDS.map((s) => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#555] block mb-1">Level</label>
              <select
                className="w-full bg-[#080808] border border-[#222] text-[#ccc] rounded-lg px-3 py-2 text-xs outline-none focus:border-[#c9a84c] transition-colors"
                value={swordLevel}
                onChange={(e) => setSwordLevel(parseInt(e.target.value))}
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((lvl) => (
                  <option key={lvl} value={lvl}>Lv{lvl}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Shield Selection */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-[10px] text-[#555] block mb-1">Shield</label>
              <select
                className="w-full bg-[#080808] border border-[#222] text-[#ccc] rounded-lg px-3 py-2 text-xs outline-none focus:border-[#c9a84c] transition-colors"
                value={selectedShield}
                onChange={(e) => setSelectedShield(e.target.value)}
              >
                {SHIELDS.map((s) => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#555] block mb-1">Level</label>
              <select
                className="w-full bg-[#080808] border border-[#222] text-[#ccc] rounded-lg px-3 py-2 text-xs outline-none focus:border-[#c9a84c] transition-colors"
                value={shieldLevel}
                onChange={(e) => setShieldLevel(parseInt(e.target.value))}
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((lvl) => (
                  <option key={lvl} value={lvl}>Lv{lvl}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Power Input */}
          <div>
            <label className="text-[10px] text-[#555] block mb-1">Power (e.g. 9.95QT, 2.5SXT)</label>
            <input
              type="text"
              className="w-full bg-[#080808] border border-[#222] text-[#ccc] rounded-lg px-3 py-2 text-xs outline-none focus:border-[#c9a84c] transition-colors font-mono"
              value={powerInput}
              onChange={(e) => setPowerInput(e.target.value)}
            />
          </div>

          {/* Gold Input */}
          <div>
            <label className="text-[10px] text-[#555] block mb-1">Gold</label>
            <input
              type="text"
              className="w-full bg-[#080808] border border-[#222] text-[#ccc] rounded-lg px-3 py-2 text-xs outline-none focus:border-[#c9a84c] transition-colors font-mono"
              value={goldInput}
              onChange={(e) => setGoldInput(e.target.value)}
            />
          </div>
        </div>

        {/* Right Side: Simulated Results & Comparison */}
        <div className="p-5 space-y-5 bg-[#0a0a0a]">
          <div className="text-[10px] uppercase tracking-wider text-[#555] font-bold">Simulated Output</div>

          {/* Grade Comparison */}
          <div className="flex items-center justify-between border-b border-[#151515] pb-4">
            <div>
              <span className="text-xs text-[#555] block">Overall Grade</span>
              <span className="text-2xl font-black font-mono leading-none transition-colors" style={{ color: GRADE_COLOR[simulatedScores.overallGrade] }}>
                {simulatedScores.overallGrade}
              </span>
              <span className="text-[10px] text-[#444] block font-mono">Score: {simulatedScores.overallScore}/100</span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[#444] text-[10px] block">Current</span>
                <span className="text-sm font-semibold font-mono text-[#888]">
                  {currentScores.overallGrade} ({currentScores.overallScore})
                </span>
              </div>
              <span className="text-[#333]">→</span>
              <div className="text-right">
                <span className="text-[#c9a84c] text-[10px] block">Simulated</span>
                <span className="text-sm font-semibold font-mono" style={{ color: GRADE_COLOR[simulatedScores.overallGrade] }}>
                  {simulatedScores.overallGrade} ({simulatedScores.overallScore})
                </span>
              </div>
            </div>
          </div>

          {/* Damage Comparison */}
          <div className="space-y-2 border-b border-[#151515] pb-4">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#555]">Damage / Hit</span>
              <span className="font-mono font-bold text-white flex items-center gap-2">
                {fmtBig(simDamage)}
                {dmgGainPct !== 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-bold ${dmgGainPct > 0 ? "bg-[#4a9e5c]/10 text-[#4a9e5c]" : "bg-[#e05a5a]/10 text-[#e05a5a]"}`}>
                    {dmgGainPct > 0 ? "+" : ""}{dmgGainPct.toFixed(1)}%
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#555]">DPS</span>
              <span className="font-mono text-[#aaa]">
                {fmtBig(simDps)}
              </span>
            </div>
          </div>

          {/* Sub-score bars comparison */}
          <div className="space-y-3">
            {[
              { label: "Gear Score", cur: currentScores.gearScore, sim: simulatedScores.gearScore, color: "#c9a84c" },
              { label: "Power Score", cur: currentScores.powerScore, sim: simulatedScores.powerScore, color: "#8ab4c9" },
              { label: "Progress Score", cur: currentScores.progressScore, sim: simulatedScores.progressScore, color: "#9ecb7a" },
              { label: "Wealth Score", cur: currentScores.wealthScore, sim: simulatedScores.wealthScore, color: "#b89fce" },
            ].map((score) => {
              const diff = score.sim - score.cur;
              return (
                <div key={score.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#555]">{score.label}</span>
                    <span className="font-mono text-white flex items-center gap-1.5">
                      <span>{score.sim}</span>
                      {diff !== 0 && (
                        <span className={`text-[9px] font-bold ${diff > 0 ? "text-[#4a9e5c]" : "text-[#e05a5a]"}`}>
                          ({diff > 0 ? "+" : ""}{diff})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-1 bg-[#151515] rounded-full overflow-hidden relative">
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
