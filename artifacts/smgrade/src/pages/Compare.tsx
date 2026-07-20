import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { parsePlayerData } from "@/lib/parser";
import { scorePlayer } from "@/lib/scorer";
import { getSwordData, getShieldData, scaledSwordDamage, scaledShieldDM } from "@/lib/gearDatabase";
import { formatNumber } from "@/lib/numberParser";
import { calculateDamageStats } from "@/lib/damageCalc";
import { ParticleBackground } from "./Home";

interface ComparedPlayer {
  username: string;
  level: number;
  power: string;
  powerRaw: number;
  gold: string;
  goldRaw: number;
  sword: string;
  swordLevel: number;
  shield: string;
  shieldLevel: number;
  pvpKills: number;
  overallScore: number;
  overallGrade: string;
  gearScore: number;
  powerScore: number;
  damagePerHit: number;
  dps: number;
}

const GRADE_COLOR: Record<string, string> = {
  "S+": "#00f0ff",
  S: "#00f0ff",
  "A+": "#3b82f6",
  A: "#3b82f6",
  "B+": "#a855f7",
  B: "#a855f7",
  "C+": "#888",
  C: "#888",
  D: "#e05a5a",
};

export default function Compare() {
  const [pasted1, setPasted1] = useState("");
  const [pasted2, setPasted2] = useState("");
  const [error, setError] = useState("");

  const [player1, setPlayer1] = useState<ComparedPlayer | null>(null);
  const [player2, setPlayer2] = useState<ComparedPlayer | null>(null);

  function handleCompare() {
    setError("");
    const txt1 = pasted1.trim();
    const txt2 = pasted2.trim();

    if (!txt1 || !txt2) {
      setError("Please paste the bot output for both players to compare.");
      return;
    }

    const data1 = parsePlayerData(txt1);
    const data2 = parsePlayerData(txt2);

    if (!data1 || data1.level === 0) {
      setError("Could not parse Player 1 stats. Make sure you paste the full bot response.");
      return;
    }
    if (!data2 || data2.level === 0) {
      setError("Could not parse Player 2 stats. Make sure you paste the full bot response.");
      return;
    }

    const sc1 = scorePlayer(data1);
    const sc2 = scorePlayer(data2);

    const sw1 = getSwordData(data1.sword);
    const sh1 = getShieldData(data1.shield);
    const ds1 = sw1 ? scaledSwordDamage(sw1.baseDamage, data1.swordLevel) * 1e9 : 0;
    const ms1 = sh1 ? scaledShieldDM(sh1.baseDM, data1.shieldLevel) : 0;
    const dmgStats1 = calculateDamageStats({
      ds: ds1,
      swordDamageMultiplier: ms1,
      power: data1.powerRaw,
      petPowerBonus: 0
    });
    const dmg1 = dmgStats1.damagePerHit;

    const sw2 = getSwordData(data2.sword);
    const sh2 = getShieldData(data2.shield);
    const ds2 = sw2 ? scaledSwordDamage(sw2.baseDamage, data2.swordLevel) * 1e9 : 0;
    const ms2 = sh2 ? scaledShieldDM(sh2.baseDM, data2.shieldLevel) : 0;
    const dmgStats2 = calculateDamageStats({
      ds: ds2,
      swordDamageMultiplier: ms2,
      power: data2.powerRaw,
      petPowerBonus: 0
    });
    const dmg2 = dmgStats2.damagePerHit;

    setPlayer1({
      username: data1.username,
      level: data1.level,
      power: data1.power,
      powerRaw: data1.powerRaw,
      gold: data1.gold,
      goldRaw: data1.goldRaw,
      sword: data1.sword,
      swordLevel: data1.swordLevel,
      shield: data1.shield,
      shieldLevel: data1.shieldLevel,
      pvpKills: data1.pvpKillCount,
      overallScore: sc1.overallScore,
      overallGrade: sc1.overallGrade,
      gearScore: sc1.gearScore,
      powerScore: sc1.powerScore,
      damagePerHit: dmgStats1.damagePerHit,
      dps: dmgStats1.damagePerSecond,
    });

    setPlayer2({
      username: data2.username,
      level: data2.level,
      power: data2.power,
      powerRaw: data2.powerRaw,
      gold: data2.gold,
      goldRaw: data2.goldRaw,
      sword: data2.sword,
      swordLevel: data2.swordLevel,
      shield: data2.shield,
      shieldLevel: data2.shieldLevel,
      pvpKills: data2.pvpKillCount,
      overallScore: sc2.overallScore,
      overallGrade: sc2.overallGrade,
      gearScore: sc2.gearScore,
      powerScore: sc2.powerScore,
      damagePerHit: dmgStats2.damagePerHit,
      dps: dmgStats2.damagePerSecond,
    });
  }

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
    <div className="min-h-screen text-white flex flex-col relative overflow-hidden font-sans bg-[#03050b]">
      <ParticleBackground />
      {/* Background neon aura glow */}
      <div className="absolute top-[-10%] left-[50%] translate-x-[-50%] w-[800px] h-[300px] rounded-full bg-amber-500/3 blur-[140px] pointer-events-none" />

      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-white/[0.04] px-6 py-4 flex items-center justify-between sticky top-0 z-20 bg-[#070b13]/80 backdrop-blur-md"
      >
        <div className="flex items-center gap-2">
          <span className="font-black text-lg tracking-wider px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/25 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)] font-display">
            SM
          </span>
          <span className="text-white font-extrabold text-lg tracking-tight font-display">Compare</span>
        </div>
        <Link href="/" className="text-white/40 hover:text-amber-400 text-xs font-bold uppercase tracking-widest transition-colors">
          ← Back to grading
        </Link>
      </motion.header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-10 space-y-6 z-10 relative">
        
        <AnimatePresence mode="wait">
          {!player1 && (
            <motion.div 
              key="inputs"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2 mb-6">
                <h1 className="text-4xl font-black text-white font-display tracking-tight">Compare Accounts</h1>
                <p className="text-white/30 text-xs max-w-sm mx-auto leading-relaxed">Paste the bot output for two separate players to compare side-by-side.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Player 1 input */}
                <div className="space-y-2.5">
                  <label className="text-[9px] font-black text-white/35 uppercase tracking-widest pl-1 block">Player 1 Stats</label>
                  <textarea
                    className="w-full bg-white/[0.01] border border-white/[0.04] focus:border-amber-500/30 text-white/80 text-xs font-mono rounded-xl p-4 resize-none outline-none min-h-[200px] leading-relaxed transition-all glass-panel"
                    placeholder="Paste Player 1 stats log here..."
                    value={pasted1}
                    onChange={(e) => setPasted1(e.target.value)}
                    spellCheck={false}
                  />
                </div>

                {/* Player 2 input */}
                <div className="space-y-2.5">
                  <label className="text-[9px] font-black text-white/35 uppercase tracking-widest pl-1 block">Player 2 Stats</label>
                  <textarea
                    className="w-full bg-white/[0.01] border border-white/[0.04] focus:border-amber-500/30 text-white/80 text-xs font-mono rounded-xl p-4 resize-none outline-none min-h-[200px] leading-relaxed transition-all glass-panel"
                    placeholder="Paste Player 2 stats log here..."
                    value={pasted2}
                    onChange={(e) => setPasted2(e.target.value)}
                    spellCheck={false}
                  />
                </div>
              </div>

              {error && (
                <motion.p 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-400 text-xs border border-red-950/60 bg-red-950/20 px-4 py-3 rounded-lg text-center font-semibold"
                >
                  ⚠️ {error}
                </motion.p>
              )}

              <button
                onClick={handleCompare}
                className="w-full py-4 rounded-lg button-gold text-xs font-black tracking-widest cursor-pointer"
              >
                Compare Profiles
              </button>
            </motion.div>
          )}

          {player1 && player2 && (
            <motion.div 
              key="results"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              {/* Compare Grades Cards */}
              <div className="grid grid-cols-2 gap-4">
                {/* Player 1 Card */}
                <div className="border rounded-xl p-5 bg-white/[0.01] glass-panel text-center space-y-2.5 relative transition-all duration-300"
                  style={{
                    borderColor: player1.overallScore > player2.overallScore ? "rgba(245, 158, 11, 0.3)" : "rgba(255, 255, 255, 0.04)",
                    boxShadow: player1.overallScore > player2.overallScore ? "0 4px 30px rgba(245, 158, 11, 0.05)" : "none"
                  }}
                >
                  {player1.overallScore > player2.overallScore && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-black text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-md border border-amber-500/20">Winner</span>
                  )}
                  <h3 className="text-lg font-black text-white truncate font-display">{player1.username}</h3>
                  <div className="text-6xl font-black font-display leading-none tracking-tight filter drop-shadow-md" style={{ color: GRADE_COLOR[player1.overallGrade] }}>
                    {player1.overallGrade}
                  </div>
                  <div className="text-white/20 text-[9px] uppercase font-mono tracking-wider font-bold">Score: {player1.overallScore}/100</div>
                </div>

                {/* Player 2 Card */}
                <div className="border rounded-xl p-5 bg-white/[0.01] glass-panel text-center space-y-2.5 relative transition-all duration-300"
                  style={{
                    borderColor: player2.overallScore > player1.overallScore ? "rgba(245, 158, 11, 0.3)" : "rgba(255, 255, 255, 0.04)",
                    boxShadow: player2.overallScore > player1.overallScore ? "0 4px 30px rgba(245, 158, 11, 0.05)" : "none"
                  }}
                >
                  {player2.overallScore > player1.overallScore && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-black text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-md border border-amber-500/20">Winner</span>
                  )}
                  <h3 className="text-lg font-black text-white truncate font-display">{player2.username}</h3>
                  <div className="text-6xl font-black font-display leading-none tracking-tight filter drop-shadow-md" style={{ color: GRADE_COLOR[player2.overallGrade] }}>
                    {player2.overallGrade}
                  </div>
                  <div className="text-white/20 text-[9px] uppercase font-mono tracking-wider font-bold">Score: {player2.overallScore}/100</div>
                </div>
              </div>

              {/* Comparison Matrix Table */}
              <div className="border border-white/[0.04] rounded-xl bg-white/[0.01] glass-panel overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-3 px-5 py-3.5 bg-white/[0.01] border-b border-white/[0.04] text-[9px] uppercase tracking-widest font-black text-white/30">
                  <span>Combat Metric</span>
                  <span className="text-center">{player1.username}</span>
                  <span className="text-center">{player2.username}</span>
                </div>
                
                {/* Rows */}
                <div className="divide-y divide-white/[0.02] text-xs font-mono font-bold">
                  
                  {/* Level */}
                  <div className="grid grid-cols-3 px-5 py-3.5 items-center">
                    <span className="text-white/40 font-sans text-xs font-semibold">Level</span>
                    <span className={`text-center ${player1.level > player2.level ? "text-amber-400 font-black" : "text-white/70"}`}>{player1.level.toLocaleString()}</span>
                    <span className={`text-center ${player2.level > player1.level ? "text-amber-400 font-black" : "text-white/70"}`}>{player2.level.toLocaleString()}</span>
                  </div>

                  {/* Power */}
                  <div className="grid grid-cols-3 px-5 py-3.5 items-center">
                    <span className="text-white/40 font-sans text-xs font-semibold">Power</span>
                    <span className={`text-center ${player1.powerRaw > player2.powerRaw ? "text-amber-400 font-black" : "text-white/70"}`}>{player1.power}</span>
                    <span className={`text-center ${player2.powerRaw > player1.powerRaw ? "text-amber-400 font-black" : "text-white/70"}`}>{player2.power}</span>
                  </div>

                  {/* Damage / Hit */}
                  <div className="grid grid-cols-3 px-5 py-3.5 items-center">
                    <span className="text-white/40 font-sans text-xs font-semibold">Damage / Hit</span>
                    <span className={`text-center ${player1.damagePerHit > player2.damagePerHit ? "text-amber-400 font-black" : "text-white/70"}`}>{fmtBig(player1.damagePerHit)}</span>
                    <span className={`text-center ${player2.damagePerHit > player1.damagePerHit ? "text-amber-400 font-black" : "text-white/70"}`}>{fmtBig(player2.damagePerHit)}</span>
                  </div>

                  {/* DPS */}
                  <div className="grid grid-cols-3 px-5 py-3.5 items-center">
                    <span className="text-white/40 font-sans text-xs font-semibold">DPS</span>
                    <span className={`text-center ${player1.dps > player2.dps ? "text-amber-400 font-black" : "text-white/70"}`}>{fmtBig(player1.dps)}</span>
                    <span className={`text-center ${player2.dps > player1.dps ? "text-amber-400 font-black" : "text-white/70"}`}>{fmtBig(player2.dps)}</span>
                  </div>

                  {/* Sword */}
                  <div className="grid grid-cols-3 px-5 py-3.5 items-center">
                    <span className="text-white/40 font-sans text-xs font-semibold">Sword</span>
                    <span className="text-center text-white/80 font-sans truncate px-1 text-[11px]">{player1.sword} <span className="font-mono text-white/20 text-[9px]">Lv{player1.swordLevel}</span></span>
                    <span className="text-center text-white/80 font-sans truncate px-1 text-[11px]">{player2.sword} <span className="font-mono text-white/20 text-[9px]">Lv{player2.swordLevel}</span></span>
                  </div>

                  {/* Shield */}
                  <div className="grid grid-cols-3 px-5 py-3.5 items-center">
                    <span className="text-white/40 font-sans text-xs font-semibold">Shield</span>
                    <span className="text-center text-white/80 font-sans truncate px-1 text-[11px]">{player1.shield} <span className="font-mono text-white/20 text-[9px]">Lv{player1.shieldLevel}</span></span>
                    <span className="text-center text-white/80 font-sans truncate px-1 text-[11px]">{player2.shield} <span className="font-mono text-white/20 text-[9px]">Lv{player2.shieldLevel}</span></span>
                  </div>

                  {/* Gear Score */}
                  <div className="grid grid-cols-3 px-5 py-3.5 items-center">
                    <span className="text-white/40 font-sans text-xs font-semibold">Gear Score</span>
                    <span className={`text-center ${player1.gearScore > player2.gearScore ? "text-amber-400 font-black" : "text-white/70"}`}>{player1.gearScore}</span>
                    <span className={`text-center ${player2.gearScore > player1.gearScore ? "text-amber-400 font-black" : "text-white/70"}`}>{player2.gearScore}</span>
                  </div>

                  {/* PvP Kills */}
                  <div className="grid grid-cols-3 px-5 py-3.5 items-center">
                    <span className="text-white/40 font-sans text-xs font-semibold">PvP Kills</span>
                    <span className={`text-center ${player1.pvpKills > player2.pvpKills ? "text-amber-400 font-black" : "text-white/70"}`}>{player1.pvpKills.toLocaleString()}</span>
                    <span className={`text-center ${player2.pvpKills > player1.pvpKills ? "text-amber-400 font-black" : "text-white/70"}`}>{player2.pvpKills.toLocaleString()}</span>
                  </div>

                </div>
              </div>

              {/* Action CTAs */}
              <div className="flex gap-3 justify-center pt-2">
                <button
                  onClick={() => {
                    setPlayer1(null);
                    setPlayer2(null);
                    setPasted1("");
                    setPasted2("");
                  }}
                  className="bg-white/[0.01] hover:bg-white/[0.04] border border-white/[0.04] text-white/60 font-bold text-xs py-3 px-6 rounded-lg transition-colors cursor-pointer"
                >
                  New Comparison
                </button>
                <Link href="/" className="bg-amber-500 text-black font-black text-xs py-3 px-6 rounded-lg hover:bg-amber-400 transition-colors inline-block text-center cursor-pointer shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                  Back to Grading
                </Link>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
