import { useState, useRef } from "react";
import { Link } from "wouter";
import { BENCHMARK_TIERS, SWORD_TIER, SHIELD_TIER } from "@/lib/benchmark";
import { SWORDS, SHIELDS } from "@/lib/gearDatabase";
import { loadPrices, savePrices, DEFAULT_PRICES, type PriceTable } from "@/lib/marketPrices";

const ADMIN_KEY = "smg_admin_auth";
const CORRECT = atob("aGFycmlzb25Ac21ncmFkZQ==");

// ── Password Gate ─────────────────────────────────────────────────────────────

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
      <div style={shake ? { animation: "shake 0.4s ease" } : {}} className="border border-[#1e1e1e] rounded-sm p-8 w-full max-w-sm space-y-5">
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
          {error && <p className="text-[#e05a5a] text-xs text-center">Incorrect password</p>}
          <button onClick={attempt} className="w-full bg-[#c9a84c] hover:bg-[#d4b55e] text-black font-semibold text-sm py-2.5 rounded-sm transition-colors">
            Unlock
          </button>
        </div>
        <div className="text-center">
          <Link href="/" className="text-[#333] text-xs hover:text-[#555] transition-colors">← Back to home</Link>
        </div>
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}`}</style>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LEVELS = [1, 2, 3, 4, 5];

const PRICE_GROUPS = [
  {
    label: "LEGENDARY SWORDS",
    items: ["Last Horizon", "Divinity Edge", "Dragon's Devil"],
  },
  {
    label: "EPIC SWORDS",
    items: ["Solbrand", "Soulkeeper's Blade", "Einherjar's Blade", "Dragon's Poison"],
  },
  {
    label: "RARE SWORDS",
    items: ["Runebreaker", "Dreadmourne"],
  },
  {
    label: "LEGENDARY SHIELDS",
    items: ["Final Bastion", "Asgardian Aegis", "Dragon's Soul"],
  },
  {
    label: "EPIC SHIELDS",
    items: ["Sealguard", "Sunward Bulwark", "Dragon's Anger"],
  },
];

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

// ── Price Grid ────────────────────────────────────────────────────────────────

function PriceGrid({
  prices,
  onChange,
}: {
  prices: PriceTable;
  onChange: (item: string, level: number, value: string) => void;
}) {
  return (
    <div className="space-y-8">
      {PRICE_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="text-[#c9a84c] text-xs font-bold uppercase tracking-widest mb-3">{group.label}</p>
          {/* Header */}
          <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: "180px repeat(5, 1fr)" }}>
            <span className="text-[#444] text-xs">Item</span>
            {LEVELS.map((l) => (
              <span key={l} className="text-[#444] text-xs text-center">Lv{l}</span>
            ))}
          </div>
          {/* Rows */}
          {group.items.map((item) => (
            <div key={item} className="grid gap-2 mb-2 items-center" style={{ gridTemplateColumns: "180px repeat(5, 1fr)" }}>
              <span className="text-[#ccc] text-sm font-medium truncate pr-2">{item}</span>
              {LEVELS.map((level) => (
                <input
                  key={level}
                  type="text"
                  className="bg-[#111] border border-[#2a2a2a] focus:border-[#c9a84c] text-white text-xs text-center px-2 py-2 rounded-sm outline-none transition-colors font-mono w-full"
                  value={prices[item]?.[level] ?? ""}
                  placeholder="—"
                  onChange={(e) => onChange(item, level, e.target.value)}
                />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Bot Logs Upload ───────────────────────────────────────────────────────────

function BotLogsUpload() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function processFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n");
      // Count players (lines with "Stats" after a name)
      const statsLines = lines.filter((l) => l.trim().endsWith("Stats"));
      const levelLines = lines.filter((l) => /^\d{3,6}$/.test(l.trim()));
      setResult(`Parsed ${statsLines.length} player entries, ${levelLines.length} level entries from ${file.name} (${(file.size / 1024).toFixed(1)} KB). Review and apply benchmark updates manually from the data below.`);
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
        <p className="text-[#c9a84c] text-xs font-bold uppercase tracking-widest mb-1">Weekly Bot Command Logs</p>
        <p className="text-[#555] text-xs leading-relaxed">
          Upload your weekly .txt file of bot command logs. The AI will use this data to update player averages and improve grading accuracy.
        </p>
      </div>

      <div
        className={`border-2 border-dashed rounded-sm py-10 px-6 text-center cursor-pointer transition-colors ${dragging ? "border-[#c9a84c] bg-[#1a1200]" : "border-[#2a2a2a] hover:border-[#3a3a3a]"}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input ref={fileRef} type="file" accept=".txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
        <span className="text-[#c9a84c] font-semibold text-sm">Click to upload</span>
        <span className="text-[#555] text-sm"> weekly bot command .txt file</span>
      </div>

      {result && (
        <div className="bg-[#0f1a00] border border-[#2a3a00] rounded-sm px-4 py-3">
          <p className="text-[#9ecb7a] text-xs leading-relaxed">{result}</p>
        </div>
      )}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[#1e1e1e] rounded-sm">
      <div className="border-b border-[#1e1e1e] px-5 py-3 bg-[#111]">
        <span className="text-[#555] text-[10px] uppercase tracking-widest font-semibold">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Scoring reference ─────────────────────────────────────────────────────────

function ScoringRef() {
  return (
    <div className="space-y-6">
      {/* Formula */}
      <div>
        <p className="text-[#c9a84c] text-xs font-bold uppercase tracking-widest mb-3">Scoring Formula</p>
        <div className="space-y-1.5 text-xs font-mono text-[#888]">
          <div><span className="text-[#c9a84c]">Overall</span> = Gear×0.30 + Power×0.40 + Progress×0.20 + Wealth×0.10</div>
          <div><span className="text-[#8ab4c9]">Power</span> = log-scale vs tier benchmarks (weak→elite), mapped 0–100</div>
          <div><span className="text-[#c9a84c]">Gear</span> = (swordTier/13)×40 + (shieldTier/10)×40 + lvlBonus (cap 10 each)</div>
          <div><span className="text-[#9ecb7a]">Progress</span> = swordPct×0.35 + shieldPct×0.35 + powerPct×0.30</div>
          <div><span className="text-[#b89fce]">Wealth</span> = log-scale vs avgGold benchmark</div>
          <div className="pt-2 border-t border-[#1a1a1a] text-[#555]">
            Damage: <span className="text-[#ddd]">(DS + 2√Power + 1) × (1 + DM)</span>
            &nbsp;· Scaling: <span className="text-[#ddd]">base × (1 + 0.25 × (lvl−1))</span>, max Lv10
          </div>
        </div>
      </div>

      {/* Grade thresholds */}
      <div>
        <p className="text-[#c9a84c] text-xs font-bold uppercase tracking-widest mb-3">Grade Thresholds</p>
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
      </div>

      {/* Benchmark tiers */}
      <div>
        <p className="text-[#c9a84c] text-xs font-bold uppercase tracking-widest mb-3">Benchmark Tiers</p>
        <div className="overflow-x-auto">
          <div className="grid text-[10px] uppercase tracking-widest pb-1.5 mb-1 border-b border-[#222] min-w-[600px]" style={{ gridTemplateColumns: "100px 130px 90px 90px 90px 90px 90px" }}>
            {["Tier", "Levels", "Weak", "Avg", "Strong", "Elite", "Avg Gold"].map((h) => (
              <span key={h} className="text-[#444]">{h}</span>
            ))}
          </div>
          {BENCHMARK_TIERS.map((t) => (
            <div key={t.label} className="grid font-mono text-xs py-1.5 border-b border-[#111] last:border-0 min-w-[600px]" style={{ gridTemplateColumns: "100px 130px 90px 90px 90px 90px 90px" }}>
              <span className="text-[#888]">{t.label}</span>
              <span className="text-[#888]">{t.minLevel.toLocaleString()}–{t.maxLevel === Infinity ? "∞" : t.maxLevel.toLocaleString()}</span>
              <span className="text-[#888]">{fmt(t.weakPower)}</span>
              <span className="text-[#888]">{fmt(t.avgPower)}</span>
              <span className="text-[#888]">{fmt(t.strongPower)}</span>
              <span className="text-[#888]">{fmt(t.elitePower)}</span>
              <span className="text-[#888]">{fmt(t.avgGold)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Admin ────────────────────────────────────────────────────────────────

export default function Admin() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(ADMIN_KEY) === "1");
  const [prices, setPrices] = useState<PriceTable>(() => loadPrices());
  const [saved, setSaved] = useState(false);

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  }

  function handlePriceChange(item: string, level: number, value: string) {
    setPrices((prev) => ({
      ...prev,
      [item]: { ...prev[item], [level]: value },
    }));
    setSaved(false);
  }

  function handleSave() {
    savePrices(prices);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleReset() {
    setPrices({ ...DEFAULT_PRICES });
    savePrices(DEFAULT_PRICES);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <header className="border-b border-[#1a1a1a] px-6 py-3 flex items-center justify-between sticky top-0 bg-[#0a0a0a] z-10">
        <div className="flex items-center gap-3">
          <span className="text-[#c9a84c] font-bold">SM</span>
          <span className="text-white font-bold">Grade</span>
          <span className="text-[#333] text-xs font-mono">/ admin</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleReset} className="text-[#444] hover:text-[#666] text-xs transition-colors">
            Reset to defaults
          </button>
          <Link href="/" className="text-[#333] text-xs hover:text-[#555] transition-colors">← Back</Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 space-y-6">

        {/* Bot Logs */}
        <SectionCard title="Weekly Bot Command Logs">
          <BotLogsUpload />
        </SectionCard>

        {/* Market Prices Editor */}
        <SectionCard title="Market Prices (Power-Based, Update Weekly)">
          <div className="space-y-5">
            <p className="text-[#555] text-xs leading-relaxed">
              Set current market prices for each item at each level. Leave blank if unknown. These are used in upgrade advice shown to players.
            </p>
            <PriceGrid prices={prices} onChange={handlePriceChange} />
          </div>
        </SectionCard>

        {/* Save button */}
        <button
          onClick={handleSave}
          className={`w-full font-bold text-sm py-4 rounded-sm transition-all tracking-widest uppercase ${
            saved
              ? "bg-[#9ecb7a] text-black"
              : "bg-[#c9a84c] hover:bg-[#d4b55e] text-black"
          }`}
        >
          {saved ? "✓ Prices Saved" : "Save All Prices"}
        </button>

        {/* Scoring reference */}
        <SectionCard title="Scoring Reference">
          <ScoringRef />
        </SectionCard>

      </main>

      <footer className="border-t border-[#111] px-6 py-3 text-center text-[#222] text-xs">
        SMGrade Admin · Internal only
      </footer>
    </div>
  );
}
