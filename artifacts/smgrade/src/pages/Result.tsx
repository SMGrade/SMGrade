import { useEffect, useState, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useExplainGrade } from "@workspace/api-client-react";
import type { ParsedPlayer } from "@/lib/parser";
import type { ScoreResult, GearSlotGrade } from "@/lib/scorer";
import { formatNumber } from "@/lib/numberParser";
import { getSwordRarity, getShieldRarity } from "@/lib/benchmark";
import { downloadShareCard } from "@/lib/shareCard";
import { getSwordData, getShieldData, scaledSwordDamage, scaledShieldDM } from "@/lib/gearDatabase";

interface ResultData {
  player: ParsedPlayer;
  scores: ScoreResult;
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

const STANDING_COLOR: Record<string, string> = {
  Elite: "#FFD700",
  "Above Average": "#c9a84c",
  Average: "#8ab4c9",
  "Below Average": "#888",
  Weak: "#e05a5a",
};

function estimatePercentile(overallScore: number): { label: string; top: boolean } {
  // Approximate percentile from overall score using a skewed distribution
  // (most players cluster in the 40–70 range)
  if (overallScore >= 93) return { label: "Top 3%", top: true };
  if (overallScore >= 85) return { label: "Top 10%", top: true };
  if (overallScore >= 75) return { label: "Top 20%", top: true };
  if (overallScore >= 65) return { label: "Top 35%", top: true };
  if (overallScore >= 55) return { label: "Top 50%", top: false };
  if (overallScore >= 45) return { label: "Bottom 40%", top: false };
  if (overallScore >= 35) return { label: "Bottom 25%", top: false };
  return { label: "Bottom 10%", top: false };
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-[#888]">{label}</span>
        <span style={{ color }} className="font-mono font-semibold">{score}</span>
      </div>
      <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between py-2 border-b border-[#1a1a1a] last:border-0">
      <span className="text-[#666] text-sm">{label}</span>
      <span className="text-[#ddd] text-sm font-mono">{value}</span>
    </div>
  );
}

function SlotGradeCard({ slot }: { slot: GearSlotGrade }) {
  const gradeColor = GRADE_COLOR[slot.grade] ?? "#888";
  const isOptimal = !slot.tip;

  return (
    <div className="border border-[#222] rounded-sm p-4 space-y-3 bg-[#0f0f0f]">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[#555] text-[10px] uppercase tracking-widest mb-0.5">{slot.slotName}</div>
          <div className="text-[#ddd] text-sm font-semibold truncate">{slot.itemName}</div>
          <div className="text-[#555] text-xs mt-0.5 font-mono">{slot.stat}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-black leading-none" style={{ color: gradeColor }}>
            {slot.grade}
          </div>
          <div className="text-[#444] text-[10px] mt-0.5">{slot.score}/100</div>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${slot.score}%`, backgroundColor: gradeColor }}
        />
      </div>

      {/* Tip or optimal badge */}
      {isOptimal ? (
        <div className="flex items-center gap-1.5">
          <span className="text-[#9ecb7a] text-xs">✓</span>
          <span className="text-[#9ecb7a] text-xs">Best in slot — no upgrade needed</span>
        </div>
      ) : slot.tip!.switchWorthwhileAtLevel ? (
        /* Advisory: current gear beats next item Lv1 — don't switch yet */
        <div className="bg-[#001a0a] border border-[#003a18] rounded-sm p-3 space-y-1">
          <div className="text-[#9ecb7a] text-[10px] uppercase tracking-widest font-semibold">
            Keep Leveling — Don't Switch Yet
          </div>
          <div className="text-[#ddd] text-xs">
            Your current item beats{" "}
            <span className="text-white font-semibold">
              {slot.tip!.targetName} Lv1
            </span>
            {". "}
            Switch only when you can get it to{" "}
            <span className="text-[#c9a84c] font-semibold">
              Lv{slot.tip!.switchWorthwhileAtLevel}
            </span>
            .
          </div>
          {slot.tip!.marketPriceNote && (
            <div className="text-[#555] text-xs">
              💰 At Lv{slot.tip!.switchWorthwhileAtLevel}: {slot.tip!.marketPriceNote}
            </div>
          )}
        </div>
      ) : (
        /* Switch now — next item Lv1 is already better */
        <div className="bg-[#1a1400] border border-[#3a2a00] rounded-sm p-3 space-y-1">
          <div className="text-[#c9a84c] text-[10px] uppercase tracking-widest font-semibold">
            Upgrade Now
          </div>
          <div className="text-[#ddd] text-xs">
            Switch to{" "}
            <span className="text-white font-semibold">
              {slot.tip!.targetName} Lv{slot.tip!.targetLevel}
            </span>
            {slot.tip!.damageGainPct > 0 && (
              <span className="text-[#9ecb7a]"> (+{slot.tip!.damageGainPct}% boost)</span>
            )}
          </div>
          {slot.tip!.marketPriceNote && (
            <div className="text-[#666] text-xs">
              💰 Market: {slot.tip!.marketPriceNote}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CombatStats({ player }: { player: ParsedPlayer }) {
  const swordData = getSwordData(player.sword);
  const shieldData = getShieldData(player.shield);

  if (!swordData && !shieldData) return null;

  const ds = swordData ? scaledSwordDamage(swordData.baseDamage, player.swordLevel) : 0; // billions
  const ms = shieldData ? scaledShieldDM(shieldData.baseDM, player.shieldLevel) : 0;     // multiplier
  const dsRaw = ds * 1e9;
  const p = Math.max(player.powerRaw, 0);

  // Damage/Hit = (DS + 2√p + 1) × (1 + ms)
  const damagePerHit = dsRaw > 0 || p > 0
    ? (dsRaw + 2 * Math.sqrt(p) + 1) * (1 + ms)
    : 0;
  const dps = damagePerHit * 2.77;

  function fmtBig(n: number): string {
    if (n >= 1e24) return (n / 1e24).toFixed(2) + " OCT";
    if (n >= 1e21) return (n / 1e21).toFixed(2) + " SXT";
    if (n >= 1e18) return (n / 1e18).toFixed(2) + " QNT";
    if (n >= 1e15) return (n / 1e15).toFixed(2) + " QT";
    if (n >= 1e12) return (n / 1e12).toFixed(2) + " T";
    if (n >= 1e9)  return (n / 1e9).toFixed(2)  + " B";
    if (n >= 1e6)  return (n / 1e6).toFixed(2)  + " M";
    return n.toFixed(0);
  }

  const rows: { label: string; value: string; sub?: string }[] = [
    ...(swordData ? [{ label: "DS (Sword)", value: `${ds.toFixed(2)}B`, sub: `${swordData.name} Lv${player.swordLevel}` }] : []),
    ...(shieldData ? [{ label: "MS (Shield)", value: `${ms.toFixed(1)}×`, sub: `${shieldData.name} Lv${player.shieldLevel}` }] : []),
    ...(damagePerHit > 0 ? [
      { label: "Damage / Hit", value: fmtBig(damagePerHit), sub: "(DS + 2√Power + 1) × (1 + MS)" },
      { label: "DPS", value: fmtBig(dps), sub: "Damage/Hit × 2.77" },
    ] : []),
  ];

  return (
    <div className="space-y-2">
      {rows.map(({ label, value, sub }) => (
        <div key={label} className="flex items-center justify-between py-2 border-b border-[#111] last:border-0">
          <div>
            <div className="text-[#666] text-sm">{label}</div>
            {sub && <div className="text-[#333] text-[10px] font-mono mt-0.5">{sub}</div>}
          </div>
          <div className="text-white font-mono font-semibold text-sm">{value}</div>
        </div>
      ))}
    </div>
  );
}

export default function Result() {
  const [, navigate] = useLocation();
  const [data, setData] = useState<ResultData | null>(null);
  const [parseError, setParseError] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasExplained = useRef(false);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("d");
    if (!raw) { setParseError(true); return; }
    try {
      const parsed = JSON.parse(decodeURIComponent(raw));
      setData(parsed);
    } catch {
      setParseError(true);
    }
  }, []);

  const explainMutation = useExplainGrade();

  useEffect(() => {
    if (!data || hasExplained.current) return;
    hasExplained.current = true;
    const { player, scores } = data;
    explainMutation.mutate({
      data: {
        username: player.username,
        level: player.level,
        overallScore: scores.overallScore,
        overallGrade: scores.overallGrade,
        gearScore: scores.gearScore,
        powerScore: scores.powerScore,
        progressScore: scores.progressScore,
        wealthScore: scores.wealthScore,
        sword: player.sword,
        swordLevel: player.swordLevel,
        shield: player.shield,
        shieldLevel: player.shieldLevel,
        powerRaw: player.power,
        goldRaw: player.gold,
        levelTier: scores.levelTier,
        standing: scores.standing,
        pvpKills: player.pvpKillCount ?? null,
      },
    });
  }, [data]);

  if (parseError) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col items-center justify-center gap-4">
        <p className="text-[#888]">Invalid result data.</p>
        <Link href="/" className="text-[#c9a84c] text-sm underline">Go back</Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] text-white flex items-center justify-center">
        <p className="text-[#555]">Loading...</p>
      </div>
    );
  }

  const { player, scores } = data;
  const gradeColor = GRADE_COLOR[scores.overallGrade] ?? "#888";
  const standingColor = STANDING_COLOR[scores.standing] ?? "#888";
  const percentile = estimatePercentile(scores.overallScore);
  const explanation = explainMutation.data;

  const topEnemies = Object.entries(player.killedEnemies)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-[#222] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[#c9a84c] font-bold text-xl tracking-wide">SM</span>
          <span className="text-white font-bold text-xl tracking-wide">Grade</span>
        </div>
        <Link
          href="/"
          className="text-[#555] text-sm hover:text-[#888] transition-colors"
        >
          ← Grade another
        </Link>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10 space-y-8">
        {/* Hero grade block */}
        <div className="border border-[#222] rounded-sm p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-white">{player.username}</h2>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-[#666] text-sm">Level {player.level.toLocaleString()}</span>
                <span className="text-[#333]">·</span>
                <span className="text-[#666] text-sm">{scores.levelTier} Tier</span>
                {player.clan && (
                  <>
                    <span className="text-[#333]">·</span>
                    <span className="text-[#666] text-sm">Clan: {player.clan}</span>
                  </>
                )}
              </div>
            </div>
            <div className="text-right">
              <div
                className="text-5xl font-black leading-none"
                style={{ color: gradeColor }}
              >
                {scores.overallGrade}
              </div>
              <div className="text-[#555] text-xs mt-1">Overall Grade</div>
            </div>
          </div>

          {/* Overall score bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-[#555]">Overall Score</span>
              <span className="font-mono font-semibold" style={{ color: gradeColor }}>
                {scores.overallScore}/100
              </span>
            </div>
            <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${scores.overallScore}%`,
                  backgroundColor: gradeColor,
                }}
              />
            </div>
          </div>

          {/* Standing badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#555] text-xs">Standing:</span>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-sm border"
              style={{
                color: standingColor,
                borderColor: standingColor + "44",
                backgroundColor: standingColor + "11",
              }}
            >
              {scores.standing}
            </span>
            <span className="text-[#444] text-xs">vs {scores.levelTier} tier players</span>
            <span className="text-[#333]">·</span>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-sm border"
              style={{
                color: percentile.top ? "#9ecb7a" : "#666",
                borderColor: percentile.top ? "#9ecb7a44" : "#33333388",
                backgroundColor: percentile.top ? "#9ecb7a11" : "#11111188",
              }}
            >
              {percentile.label}
            </span>
          </div>
        </div>

        {/* Gear Report Card */}
        <div className="space-y-3">
          <h3 className="text-xs uppercase tracking-widest text-[#555]">Gear Report Card</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {scores.slotGrades.map((slot) => (
              <SlotGradeCard key={slot.slotName} slot={slot} />
            ))}
          </div>
        </div>

        {/* Score breakdown */}
        <div className="border border-[#222] rounded-sm p-5 space-y-4">
          <h3 className="text-xs uppercase tracking-widest text-[#555]">Score Breakdown</h3>
          <div className="space-y-3">
            <ScoreBar label="Gear Score" score={scores.gearScore} color="#c9a84c" />
            <ScoreBar label="Power Score" score={scores.powerScore} color="#8ab4c9" />
            <ScoreBar label="Progress Score" score={scores.progressScore} color="#9ecb7a" />
            <ScoreBar label="Wealth Score" score={scores.wealthScore} color="#b89fce" />
          </div>
        </div>

        {/* Combat Stats */}
        <div className="border border-[#222] rounded-sm p-5 space-y-1">
          <h3 className="text-xs uppercase tracking-widest text-[#555] mb-3">Combat Stats</h3>
          <CombatStats player={player} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Gear */}
          <div className="border border-[#222] rounded-sm p-5 space-y-1">
            <h3 className="text-xs uppercase tracking-widest text-[#555] mb-3">Gear</h3>
            <div className="space-y-0">
              <StatRow label="Sword" value={player.sword} />
              <StatRow label="Sword Level" value={player.swordLevel} />
              <StatRow
                label="Sword Rarity"
                value={getSwordRarity(player.sword)}
              />
              <StatRow label="Shield" value={player.shield} />
              <StatRow label="Shield Level" value={player.shieldLevel} />
              <StatRow
                label="Shield Rarity"
                value={getShieldRarity(player.shield)}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="border border-[#222] rounded-sm p-5 space-y-1">
            <h3 className="text-xs uppercase tracking-widest text-[#555] mb-3">Stats</h3>
            <div className="space-y-0">
              <StatRow label="Power" value={player.power} />
              <StatRow label="Gold" value={player.gold} />
              <StatRow label="Health" value={player.health} />
              <StatRow label="PvP Kills" value={player.pvpKillCount.toLocaleString()} />
              <StatRow label="PvP Loot" value={player.pvpLoot || "—"} />
              {player.registerDate && (
                <StatRow label="Registered" value={player.registerDate} />
              )}
            </div>
          </div>
        </div>

        {/* Top enemies */}
        {topEnemies.length > 0 && (
          <div className="border border-[#222] rounded-sm p-5">
            <h3 className="text-xs uppercase tracking-widest text-[#555] mb-3">Most Killed</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {topEnemies.map(([enemy, count]) => (
                <div
                  key={enemy}
                  className="bg-[#111] border border-[#1a1a1a] rounded-sm px-3 py-2"
                >
                  <div className="text-[#888] text-xs">{enemy}</div>
                  <div className="text-white text-sm font-mono font-semibold">
                    {count.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Analysis */}
        <div className="border border-[#222] rounded-sm p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-widest text-[#555]">AI Analysis</h3>
            {explainMutation.isPending && (
              <span className="text-[#444] text-xs animate-pulse">Generating...</span>
            )}
          </div>

          {explainMutation.isPending && (
            <div className="space-y-2">
              {[120, 90, 150, 80].map((w, i) => (
                <div
                  key={i}
                  className="h-3 bg-[#1a1a1a] rounded animate-pulse"
                  style={{ width: `${w / 2}px`, maxWidth: "100%" }}
                />
              ))}
            </div>
          )}

          {explainMutation.isError && (
            <p className="text-[#555] text-sm">
              AI analysis unavailable. The score above is fully accurate.
            </p>
          )}

          {explanation && (
            <div className="space-y-5">
              <p className="text-[#aaa] text-sm leading-relaxed">{explanation.summary}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-[#9ecb7a] mb-2">Strengths</p>
                  <ul className="space-y-1">
                    {explanation.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-[#888] flex gap-2">
                        <span className="text-[#9ecb7a] mt-0.5 shrink-0">+</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-[#e05a5a] mb-2">Weaknesses</p>
                  <ul className="space-y-1">
                    {explanation.weaknesses.map((w, i) => (
                      <li key={i} className="text-sm text-[#888] flex gap-2">
                        <span className="text-[#e05a5a] mt-0.5 shrink-0">−</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="border-t border-[#1a1a1a] pt-4">
                <p className="text-xs uppercase tracking-widest text-[#c9a84c] mb-2">Next Upgrade</p>
                <p className="text-[#888] text-sm">{explanation.recommendation}</p>
              </div>

              <div className="border-t border-[#1a1a1a] pt-4">
                <p className="text-xs uppercase tracking-widest text-[#555] mb-2">Why This Grade</p>
                <p className="text-[#666] text-sm leading-relaxed">{explanation.reasoning}</p>
              </div>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pb-4">
          <button
            onClick={() => downloadShareCard(player, scores)}
            className="inline-flex items-center gap-2 bg-[#c9a84c] hover:bg-[#d4b55e] text-black font-bold text-sm px-6 py-2.5 rounded-sm transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7.5 1v9m0 0L4.5 7m3 3 3-3M1 11v1.5A1.5 1.5 0 0 0 2.5 14h10A1.5 1.5 0 0 0 14 12.5V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Save Grade Card
          </button>
          <button
            onClick={copyLink}
            className={`inline-flex items-center gap-2 border text-sm px-6 py-2.5 rounded-sm transition-colors ${
              copied
                ? "border-[#9ecb7a] text-[#9ecb7a]"
                : "border-[#333] hover:border-[#888] text-[#888] hover:text-[#ccc]"
            }`}
          >
            {copied ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Link Copied!
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copy Result Link
              </>
            )}
          </button>
          <Link
            href="/"
            className="inline-block bg-transparent border border-[#333] hover:border-[#c9a84c] text-[#888] hover:text-[#c9a84c] text-sm px-6 py-2.5 rounded-sm transition-colors"
          >
            Grade another account
          </Link>
        </div>
      </main>

      <footer className="border-t border-[#1a1a1a] px-6 py-4 text-center text-[#333] text-xs">
        SMGrade — not affiliated with SwordMasters
      </footer>
    </div>
  );
}
