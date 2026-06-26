import { useState, useEffect } from "react";
import { Link } from "wouter";
import { BENCHMARK_TIERS, SWORD_TIER, SHIELD_TIER } from "@/lib/benchmark";
import { SWORDS, SHIELDS } from "@/lib/gearDatabase";

const ADMIN_KEY = "smg_admin_auth";
const CORRECT = atob("aGFycmlzb25Ac21ncmFkZQ==");

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
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
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div
        className={`border border-[#1e1e1e] rounded-sm p-8 w-full max-w-sm space-y-5 transition-transform ${shake ? "animate-[shake_0.4s_ease]" : ""}`}
        style={shake ? { animation: "shake 0.4s ease" } : {}}
      >
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-[#c9a84c] font-bold text-lg">SM</span>
            <span className="text-white font-bold text-lg">Grade</span>
          </div>
          <p className="text-[#555] text-xs uppercase tracking-widest">Admin Access</p>
        </div>

        <div className="space-y-3">
          <input
            type="password"
            className="w-full bg-[#111] border border-[#2a2a2a] focus:border-[#c9a84c] text-white text-sm px-4 py-2.5 rounded-sm outline-none transition-colors placeholder-[#333] font-mono"
            placeholder="Password"
            value={value}
            autoFocus
            onChange={(e) => { setValue(e.target.value); setError(false); }}
            onKeyDown={(e) => e.key === "Enter" && attempt()}
          />
          {error && (
            <p className="text-[#e05a5a] text-xs text-center">Incorrect password</p>
          )}
          <button
            onClick={attempt}
            className="w-full bg-[#c9a84c] hover:bg-[#d4b55e] text-black font-semibold text-sm py-2.5 rounded-sm transition-colors"
          >
            Unlock
          </button>
        </div>

        <div className="text-center">
          <Link href="/" className="text-[#333] text-xs hover:text-[#555] transition-colors">← Back to home</Link>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[#1e1e1e] rounded-sm">
      <div className="border-b border-[#1e1e1e] px-4 py-2 bg-[#111]">
        <span className="text-[#555] text-[10px] uppercase tracking-widest font-semibold">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Row({ cols }: { cols: (string | number)[] }) {
  return (
    <div className="grid font-mono text-xs py-1.5 border-b border-[#111] last:border-0" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }}>
      {cols.map((c, i) => (
        <span key={i} className="text-[#888] truncate pr-2">{c}</span>
      ))}
    </div>
  );
}

function HeaderRow({ cols }: { cols: string[] }) {
  return (
    <div className="grid text-[10px] uppercase tracking-widest pb-1.5 mb-1 border-b border-[#222]" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }}>
      {cols.map((c, i) => (
        <span key={i} className="text-[#444] pr-2">{c}</span>
      ))}
    </div>
  );
}

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

export default function Admin() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(ADMIN_KEY) === "1");

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <header className="border-b border-[#1a1a1a] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[#c9a84c] font-bold">SM</span>
          <span className="text-white font-bold">Grade</span>
          <span className="text-[#333] text-xs font-mono">/ admin</span>
        </div>
        <Link href="/" className="text-[#333] text-xs hover:text-[#555] transition-colors">← Back</Link>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 space-y-6">

        {/* Scoring formula */}
        <Section title="Scoring Formula">
          <div className="space-y-2 text-xs font-mono text-[#888]">
            <div><span className="text-[#c9a84c]">Overall</span> = Gear×0.30 + Power×0.40 + Progress×0.20 + Wealth×0.10</div>
            <div><span className="text-[#8ab4c9]">Power</span> = log-scale vs tier benchmarks (weak→elite), mapped 0–100</div>
            <div><span className="text-[#c9a84c]">Gear</span> = (swordTier/maxTier)×40 + (shieldTier/maxTier)×40 + lvlBonus×2 (cap 10 each)</div>
            <div><span className="text-[#9ecb7a]">Progress</span> = sword% × 0.35 + shield% × 0.35 + power% × 0.30</div>
            <div><span className="text-[#b89fce]">Wealth</span> = log-scale vs avgGold benchmark</div>
            <div className="pt-2 border-t border-[#1a1a1a] text-[#555]">
              Damage formula: <span className="text-[#ddd]">(DS + 2√Power + 1) × (1 + DM)</span>
              &nbsp;· Level scaling: <span className="text-[#ddd]">base × (1 + 0.25 × (lvl − 1))</span>
            </div>
          </div>
        </Section>

        {/* Grade thresholds */}
        <Section title="Grade Thresholds">
          <div className="flex flex-wrap gap-2">
            {[
              { grade: "S+", min: 97, color: "#FFD700" },
              { grade: "S",  min: 90, color: "#FFD700" },
              { grade: "A+", min: 83, color: "#c9a84c" },
              { grade: "A",  min: 75, color: "#c9a84c" },
              { grade: "B+", min: 67, color: "#8ab4c9" },
              { grade: "B",  min: 58, color: "#8ab4c9" },
              { grade: "C+", min: 48, color: "#888" },
              { grade: "C",  min: 38, color: "#888" },
              { grade: "D",  min: 0,  color: "#e05a5a" },
            ].map(({ grade, min, color }) => (
              <div key={grade} className="border border-[#1e1e1e] rounded-sm px-3 py-1.5 text-center min-w-[60px]">
                <div className="font-bold text-sm" style={{ color }}>{grade}</div>
                <div className="text-[#444] text-[10px] font-mono">≥{min}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Benchmark tiers */}
        <Section title="Benchmark Tiers (Power)">
          <HeaderRow cols={["Tier", "Levels", "Weak", "Avg", "Strong", "Elite", "Avg Gold"]} />
          {BENCHMARK_TIERS.map((t) => (
            <Row key={t.label} cols={[
              t.label,
              `${t.minLevel.toLocaleString()}–${t.maxLevel === Infinity ? "∞" : t.maxLevel.toLocaleString()}`,
              fmt(t.weakPower),
              fmt(t.avgPower),
              fmt(t.strongPower),
              fmt(t.elitePower),
              fmt(t.avgGold),
            ]} />
          ))}
        </Section>

        {/* Sword database */}
        <Section title="Sword Database">
          <HeaderRow cols={["Name", "Rarity", "Base DS (Lv1)", "Lv10 DS", "Tier Rank", "Market"]} />
          {SWORDS.map((s) => (
            <Row key={s.name} cols={[
              s.name,
              s.rarity,
              `${s.baseDamage.toFixed(2)}B`,
              `${(s.baseDamage * 3.25).toFixed(2)}B`,
              s.tierRank,
              s.marketPriceNote ?? "—",
            ]} />
          ))}
        </Section>

        {/* Shield database */}
        <Section title="Shield Database">
          <HeaderRow cols={["Name", "Rarity", "Base DM (Lv1)", "Lv10 DM", "Tier Rank", "Market"]} />
          {SHIELDS.map((s) => (
            <Row key={s.name} cols={[
              s.name,
              s.rarity,
              `${s.baseDM.toFixed(1)}x`,
              `${(s.baseDM * 3.25).toFixed(1)}x`,
              s.tierRank,
              s.marketPriceNote ?? "—",
            ]} />
          ))}
        </Section>

        {/* Tier rankings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Section title="Sword Tier Rankings">
            <HeaderRow cols={["Sword", "Tier"]} />
            {Object.entries(SWORD_TIER)
              .sort(([, a], [, b]) => b - a)
              .map(([name, tier]) => (
                <Row key={name} cols={[name, tier]} />
              ))}
          </Section>
          <Section title="Shield Tier Rankings">
            <HeaderRow cols={["Shield", "Tier"]} />
            {Object.entries(SHIELD_TIER)
              .sort(([, a], [, b]) => b - a)
              .map(([name, tier]) => (
                <Row key={name} cols={[name, tier]} />
              ))}
          </Section>
        </div>

        {/* Benchmark top gear per tier */}
        <Section title="Expected Top Gear per Tier">
          <HeaderRow cols={["Tier", "Top Swords", "Top Shields"]} />
          {BENCHMARK_TIERS.map((t) => (
            <Row key={t.label} cols={[
              t.label,
              t.topSwords.join(", "),
              t.topShields.join(", "),
            ]} />
          ))}
        </Section>

      </main>

      <footer className="border-t border-[#111] px-6 py-3 text-center text-[#222] text-xs">
        SMGrade Admin · Internal only
      </footer>
    </div>
  );
}
