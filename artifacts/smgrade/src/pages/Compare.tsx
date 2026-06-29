import { useState } from "react";
import { Link } from "wouter";
import { parsePlayerData } from "@/lib/parser";
import { scorePlayer } from "@/lib/scorer";
import { getSwordData, getShieldData, scaledSwordDamage, scaledShieldDM } from "@/lib/gearDatabase";
import { formatNumber } from "@/lib/numberParser";

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

    // Compute player 1 combat stats
    const sw1 = getSwordData(data1.sword);
    const sh1 = getShieldData(data1.shield);
    const ds1 = sw1 ? scaledSwordDamage(sw1.baseDamage, data1.swordLevel) * 1e9 : 0;
    const ms1 = sh1 ? scaledShieldDM(sh1.baseDM, data1.shieldLevel) : 0;
    const dmg1 = (ds1 + 2 * Math.sqrt(Math.max(data1.powerRaw, 0)) + 1) * (1 + ms1);

    // Compute player 2 combat stats
    const sw2 = getSwordData(data2.sword);
    const sh2 = getShieldData(data2.shield);
    const ds2 = sw2 ? scaledSwordDamage(sw2.baseDamage, data2.swordLevel) * 1e9 : 0;
    const ms2 = sh2 ? scaledShieldDM(sh2.baseDM, data2.shieldLevel) : 0;
    const dmg2 = (ds2 + 2 * Math.sqrt(Math.max(data2.powerRaw, 0)) + 1) * (1 + ms2);

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
      damagePerHit: dmg1,
      dps: dmg1 * 2.77,
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
      damagePerHit: dmg2,
      dps: dmg2 * 2.77,
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
    <div className="min-h-screen bg-[#080808] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-[#111] px-6 py-4 flex items-center justify-between sticky top-0 z-10 bg-[#080808cc] backdrop-filter blur-md">
        <div className="flex items-center gap-2">
          <span className="font-black text-xl" style={{
            background: "linear-gradient(135deg, #c9a84c 0%, #f0d080 50%, #c9a84c 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>SM</span>
          <span className="text-white font-black text-xl">Compare</span>
        </div>
        <Link href="/" className="text-[#444] text-sm hover:text-[#777] transition-colors">
          ← Back to grading
        </Link>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 space-y-6">
        
        {/* Paste Panels */}
        {!player1 && (
          <div className="space-y-4">
            <div className="text-center space-y-2 mb-4">
              <h1 className="text-2xl font-extrabold text-white">Compare Two Accounts</h1>
              <p className="text-[#555] text-xs">Paste the full stats logs of two separate players to compare side-by-side.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Player 1 input */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#555] uppercase tracking-wider block">Player 1 Stats</label>
                <textarea
                  className="w-full bg-[#0d0d0d] border border-[#1e1e1e] focus:border-[#c9a84c44] text-[#ddd] text-xs font-mono rounded-lg p-3 resize-none outline-none min-h-[180px] leading-relaxed transition-all"
                  placeholder="Paste Player 1 /stats output here..."
                  value={pasted1}
                  onChange={(e) => setPasted1(e.target.value)}
                  spellCheck={false}
                />
              </div>

              {/* Player 2 input */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#555] uppercase tracking-wider block">Player 2 Stats</label>
                <textarea
                  className="w-full bg-[#0d0d0d] border border-[#1e1e1e] focus:border-[#c9a84c44] text-[#ddd] text-xs font-mono rounded-lg p-3 resize-none outline-none min-h-[180px] leading-relaxed transition-all"
                  placeholder="Paste Player 2 /stats output here..."
                  value={pasted2}
                  onChange={(e) => setPasted2(e.target.value)}
                  spellCheck={false}
                />
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-xs border border-red-900/50 bg-red-950/20 px-3 py-2 rounded-lg text-center">
                {error}
              </p>
            )}

            <button
              onClick={handleCompare}
              className="w-full font-bold py-3 px-6 rounded-lg transition-all duration-200 text-sm tracking-wide bg-[#c9a84c] text-black hover:bg-[#d4b55e] shadow-lg shadow-gold"
            >
              Compare Accounts
            </button>
          </div>
        )}

        {/* Results Panels */}
        {player1 && player2 && (
          <div className="space-y-6 animate-fade-in">
            {/* Compare Names & Grades */}
            <div className="grid grid-cols-2 gap-4">
              {/* Player 1 Grade Card */}
              <div className="border border-[#1e1e1e] rounded-xl p-4 bg-[#0c0c0c] text-center space-y-2 relative"
                style={{
                  borderWidth: player1.overallScore > player2.overallScore ? "2px" : "1px",
                  borderColor: player1.overallScore > player2.overallScore ? "#c9a84c" : "#1e1e1e"
                }}
              >
                {player1.overallScore > player2.overallScore && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#c9a84c] text-black text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">Winner</span>
                )}
                <h3 className="text-lg font-bold text-white truncate">{player1.username}</h3>
                <div className="text-5xl font-black font-mono leading-none tracking-tight" style={{ color: GRADE_COLOR[player1.overallGrade] }}>
                  {player1.overallGrade}
                </div>
                <div className="text-[#555] text-[10px] uppercase font-mono">Score: {player1.overallScore}/100</div>
              </div>

              {/* Player 2 Grade Card */}
              <div className="border border-[#1e1e1e] rounded-xl p-4 bg-[#0c0c0c] text-center space-y-2 relative"
                style={{
                  borderWidth: player2.overallScore > player1.overallScore ? "2px" : "1px",
                  borderColor: player2.overallScore > player1.overallScore ? "#c9a84c" : "#1e1e1e"
                }}
              >
                {player2.overallScore > player1.overallScore && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#c9a84c] text-black text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">Winner</span>
                )}
                <h3 className="text-lg font-bold text-white truncate">{player2.username}</h3>
                <div className="text-5xl font-black font-mono leading-none tracking-tight" style={{ color: GRADE_COLOR[player2.overallGrade] }}>
                  {player2.overallGrade}
                </div>
                <div className="text-[#555] text-[10px] uppercase font-mono">Score: {player2.overallScore}/100</div>
              </div>
            </div>

            {/* Comparison Matrix Table */}
            <div className="border border-[#1a1a1a] rounded-xl bg-[#0c0c0c] overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-3 px-4 py-2.5 bg-[#0f0f0f] border-b border-[#151515] text-[9px] uppercase tracking-wider font-semibold text-[#555]">
                <span>Stat</span>
                <span className="text-center">{player1.username}</span>
                <span className="text-center">{player2.username}</span>
              </div>
              
              {/* Rows */}
              <div className="divide-y divide-[#131313] text-xs font-mono">
                
                {/* Level */}
                <div className="grid grid-cols-3 px-4 py-3 items-center">
                  <span className="text-[#555] font-sans">Level</span>
                  <span className={`text-center font-bold ${player1.level > player2.level ? "text-[#c9a84c]" : "text-[#888]"}`}>{player1.level.toLocaleString()}</span>
                  <span className={`text-center font-bold ${player2.level > player1.level ? "text-[#c9a84c]" : "text-[#888]"}`}>{player2.level.toLocaleString()}</span>
                </div>

                {/* Power */}
                <div className="grid grid-cols-3 px-4 py-3 items-center">
                  <span className="text-[#555] font-sans">Power</span>
                  <span className={`text-center font-bold ${player1.powerRaw > player2.powerRaw ? "text-[#c9a84c]" : "text-[#888]"}`}>{player1.power}</span>
                  <span className={`text-center font-bold ${player2.powerRaw > player1.powerRaw ? "text-[#c9a84c]" : "text-[#888]"}`}>{player2.power}</span>
                </div>

                {/* Damage / Hit */}
                <div className="grid grid-cols-3 px-4 py-3 items-center">
                  <span className="text-[#555] font-sans">Damage / Hit</span>
                  <span className={`text-center font-bold ${player1.damagePerHit > player2.damagePerHit ? "text-[#c9a84c]" : "text-[#888]"}`}>{fmtBig(player1.damagePerHit)}</span>
                  <span className={`text-center font-bold ${player2.damagePerHit > player1.damagePerHit ? "text-[#c9a84c]" : "text-[#888]"}`}>{fmtBig(player2.damagePerHit)}</span>
                </div>

                {/* DPS */}
                <div className="grid grid-cols-3 px-4 py-3 items-center">
                  <span className="text-[#555] font-sans">DPS</span>
                  <span className={`text-center font-bold ${player1.dps > player2.dps ? "text-[#c9a84c]" : "text-[#888]"}`}>{fmtBig(player1.dps)}</span>
                  <span className={`text-center font-bold ${player2.dps > player1.dps ? "text-[#c9a84c]" : "text-[#888]"}`}>{fmtBig(player2.dps)}</span>
                </div>

                {/* Sword */}
                <div className="grid grid-cols-3 px-4 py-3 items-center">
                  <span className="text-[#555] font-sans">Sword</span>
                  <span className="text-center text-[#ddd] text-[11px] font-sans truncate">{player1.sword} <span className="font-mono text-[#555] text-[10px]">Lv{player1.swordLevel}</span></span>
                  <span className="text-center text-[#ddd] text-[11px] font-sans truncate">{player2.sword} <span className="font-mono text-[#555] text-[10px]">Lv{player2.swordLevel}</span></span>
                </div>

                {/* Shield */}
                <div className="grid grid-cols-3 px-4 py-3 items-center">
                  <span className="text-[#555] font-sans">Shield</span>
                  <span className="text-center text-[#ddd] text-[11px] font-sans truncate">{player1.shield} <span className="font-mono text-[#555] text-[10px]">Lv{player1.shieldLevel}</span></span>
                  <span className="text-center text-[#ddd] text-[11px] font-sans truncate">{player2.shield} <span className="font-mono text-[#555] text-[10px]">Lv{player2.shieldLevel}</span></span>
                </div>

                {/* Gear Score */}
                <div className="grid grid-cols-3 px-4 py-3 items-center">
                  <span className="text-[#555] font-sans">Gear Score</span>
                  <span className={`text-center font-bold ${player1.gearScore > player2.gearScore ? "text-[#c9a84c]" : "text-[#888]"}`}>{player1.gearScore}</span>
                  <span className={`text-center font-bold ${player2.gearScore > player1.gearScore ? "text-[#c9a84c]" : "text-[#888]"}`}>{player2.gearScore}</span>
                </div>

                {/* PvP Kills */}
                <div className="grid grid-cols-3 px-4 py-3 items-center">
                  <span className="text-[#555] font-sans">PvP Kills</span>
                  <span className={`text-center font-bold ${player1.pvpKills > player2.pvpKills ? "text-[#c9a84c]" : "text-[#888]"}`}>{player1.pvpKills.toLocaleString()}</span>
                  <span className={`text-center font-bold ${player2.pvpKills > player1.pvpKills ? "text-[#c9a84c]" : "text-[#888]"}`}>{player2.pvpKills.toLocaleString()}</span>
                </div>

              </div>
            </div>

            {/* Back CTA */}
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => {
                  setPlayer1(null);
                  setPlayer2(null);
                  setPasted1("");
                  setPasted2("");
                }}
                className="bg-[#111] hover:bg-[#1a1a1a] text-white border border-[#222] font-semibold text-xs py-2 px-5 rounded-lg transition-colors"
              >
                Compare New Accounts
              </button>
              <Link href="/" className="bg-[#c9a84c] text-black font-semibold text-xs py-2 px-5 rounded-lg hover:bg-[#d4b55e] transition-colors">
                Back to Home
              </Link>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
