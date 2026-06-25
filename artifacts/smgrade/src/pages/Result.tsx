import { useEffect, useState, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useExplainGrade } from "@workspace/api-client-react";
import type { ParsedPlayer } from "@/lib/parser";
import type { ScoreResult } from "@/lib/scorer";
import { formatNumber } from "@/lib/numberParser";
import { getSwordRarity, getShieldRarity } from "@/lib/benchmark";

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

export default function Result() {
  const [, navigate] = useLocation();
  const [data, setData] = useState<ResultData | null>(null);
  const [parseError, setParseError] = useState(false);
  const hasExplained = useRef(false);

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
          <div className="flex items-center gap-2">
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
        <div className="text-center pb-4">
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
