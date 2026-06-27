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
  if (overallScore >= 93) return { label: "Top 3%", top: true };
  if (overallScore >= 85) return { label: "Top 10%", top: true };
  if (overallScore >= 75) return { label: "Top 20%", top: true };
  if (overallScore >= 65) return { label: "Top 35%", top: true };
  if (overallScore >= 55) return { label: "Top 50%", top: false };
  if (overallScore >= 45) return { label: "Bottom 40%", top: false };
  if (overallScore >= 35) return { label: "Bottom 25%", top: false };
  return { label: "Bottom 10%", top: false };
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[10px] uppercase tracking-widest text-[#444] font-semibold whitespace-nowrap">{children}</span>
      <div className="flex-1 h-px bg-[#151515]" />
    </div>
  );
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-[#666]">{label}</span>
        <span style={{ color }} className="font-mono font-bold tabular-nums">{score}</span>
      </div>
      <div className="h-1.5 bg-[#111] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: `linear-gradient(90deg, ${color}99, ${color})` }}
        />
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between py-2 border-b border-[#111] last:border-0">
      <span className="text-[#555] text-sm">{label}</span>
      <span className="text-[#ccc] text-sm font-mono">{value}</span>
    </div>
  );
}

function SlotGradeCard({ slot }: { slot: GearSlotGrade }) {
  const gradeColor = GRADE_COLOR[slot.grade] ?? "#888";
  const isOptimal = !slot.tip;
  const tip = slot.tip;

  const isKeepLeveling = !!tip?.switchWorthwhileAtLevel;
  const isAffordable = tip?.affordable !== false;
  const isSwitchNow = tip && !isKeepLeveling;

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{
        background: "#0c0c0c",
        border: `1px solid ${gradeColor}18`,
        boxShadow: `inset 0 0 30px ${gradeColor}05`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[#444] text-[9px] uppercase tracking-widest mb-0.5">{slot.slotName}</div>
          <div className="text-[#ddd] text-sm font-semibold truncate">{slot.itemName}</div>
          <div className="text-[#444] text-xs mt-0.5 font-mono">{slot.stat}</div>
        </div>
        <div className="text-right shrink-0">
          <div
            className="text-2xl font-black leading-none"
            style={{ color: gradeColor, textShadow: `0 0 20px ${gradeColor}66` }}
          >
            {slot.grade}
          </div>
          <div className="text-[#333] text-[10px] mt-0.5">{slot.score}/100</div>
        </div>
      </div>

      <div className="h-1 bg-[#111] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${slot.score}%`, background: `linear-gradient(90deg, ${gradeColor}88, ${gradeColor})` }}
        />
      </div>

      {isOptimal ? (
        <div className="flex items-center gap-1.5">
          <span className="text-[#4a9e5c]">✓</span>
          <span className="text-[#4a9e5c] text-xs">Best in slot</span>
        </div>
      ) : isKeepLeveling ? (
        <div className="rounded-lg p-3 space-y-1" style={{ background: "#081208", border: "1px solid #0f2a10" }}>
          <div className="text-[#5ecb7a] text-[9px] uppercase tracking-widest font-bold">Keep Leveling — Don't Switch Yet</div>
          <div className="text-[#ccc] text-xs leading-relaxed">
            Your current item beats{" "}
            <span className="text-white font-semibold">{tip!.targetName} Lv1</span>.{" "}
            Switch only when you can get it to{" "}
            <span className="text-[#c9a84c] font-semibold">Lv{tip!.switchWorthwhileAtLevel}</span>.
          </div>
          {tip!.marketPriceNote && (
            <div className="text-[#3a3a3a] text-[10px]">
              💰 At Lv{tip!.switchWorthwhileAtLevel}: {tip!.marketPriceNote}
              {!isAffordable && <span className="text-[#8b4a10] ml-2">· Out of budget</span>}
            </div>
          )}
        </div>
      ) : isSwitchNow && isAffordable ? (
        <div className="rounded-lg p-3 space-y-1" style={{ background: "#110e00", border: "1px solid #2a2000" }}>
          <div className="text-[#c9a84c] text-[9px] uppercase tracking-widest font-bold">Upgrade Now</div>
          <div className="text-[#ccc] text-xs leading-relaxed">
            Switch to{" "}
            <span className="text-white font-semibold">{tip!.targetName} Lv{tip!.targetLevel}</span>
            {tip!.damageGainPct > 0 && (
              <span className="text-[#5ecb7a]"> (+{tip!.damageGainPct}% boost)</span>
            )}
          </div>
          {tip!.marketPriceNote && (
            <div className="text-[#444] text-[10px]">💰 Market: {tip!.marketPriceNote}</div>
          )}
        </div>
      ) : isSwitchNow && !isAffordable ? (
        <div className="rounded-lg p-3 space-y-1" style={{ background: "#110800", border: "1px solid #2a1500" }}>
          <div className="text-[#b87a30] text-[9px] uppercase tracking-widest font-bold">Long-Term Goal</div>
          <div className="text-[#aaa] text-xs leading-relaxed">
            Upgrade path:{" "}
            <span className="text-[#ddd] font-semibold">{tip!.targetName} Lv{tip!.targetLevel}</span>
            {tip!.damageGainPct > 0 && <span className="text-[#5ecb7a]"> (+{tip!.damageGainPct}%)</span>}
            {" "}— but out of budget for now.
          </div>
          {tip!.marketPriceNote && (
            <div className="text-[#444] text-[10px]">💰 Market: {tip!.marketPriceNote}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function CombatStats({ player }: { player: ParsedPlayer }) {
  const swordData = getSwordData(player.sword);
  const shieldData = getShieldData(player.shield);
  if (!swordData && !shieldData) return null;

  const ds = swordData ? scaledSwordDamage(swordData.baseDamage, player.swordLevel) : 0;
  const ms = shieldData ? scaledShieldDM(shieldData.baseDM, player.shieldLevel) : 0;
  const dsRaw = ds * 1e9;
  const p = Math.max(player.powerRaw, 0);
  const damagePerHit = dsRaw > 0 || p > 0 ? (dsRaw + 2 * Math.sqrt(p) + 1) * (1 + ms) : 0;
  const dps = damagePerHit * 2.77;

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

  const rows = [
    ...(swordData ? [{ label: "DS (Sword)", value: `${ds.toFixed(2)}B`, sub: `${swordData.name} Lv${player.swordLevel}` }] : []),
    ...(shieldData ? [{ label: "MS (Shield)", value: `${ms.toFixed(1)}×`, sub: `${shieldData.name} Lv${player.shieldLevel}` }] : []),
    ...(damagePerHit > 0 ? [
      { label: "Damage / Hit", value: fmtBig(damagePerHit), sub: "(DS + 2√Power + 1) × (1 + MS)" },
      { label: "DPS", value: fmtBig(dps), sub: "Damage/Hit × 2.77" },
    ] : []),
  ];

  return (
    <div className="space-y-1">
      {rows.map(({ label, value, sub }) => (
        <div key={label} className="flex items-center justify-between py-2.5 border-b border-[#0f0f0f] last:border-0">
          <div>
            <div className="text-[#555] text-sm">{label}</div>
            {sub && <div className="text-[#2a2a2a] text-[10px] font-mono mt-0.5">{sub}</div>}
          </div>
          <div className="text-white font-mono font-bold text-sm">{value}</div>
        </div>
      ))}
    </div>
  );
}

interface ChatMessage {
  role: "user" | "coach";
  text: string;
}

const EXAMPLE_QUESTIONS = [
  "Why is my grade this low?",
  "Should I upgrade my sword first?",
  "How far am I from S grade?",
  "Is leveling worth it right now?",
];

function AiCoachSection({
  explanation,
  isPending,
  isError,
  player,
  scores,
}: {
  explanation: { summary: string; strengths: string[]; weaknesses: string[]; recommendation: string; reasoning: string } | undefined;
  isPending: boolean;
  isError: boolean;
  player: ParsedPlayer;
  scores: ScoreResult;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const playerContext = {
    username: player.username,
    level: player.level,
    tier: scores.levelTier,
    overallGrade: scores.overallGrade,
    overallScore: scores.overallScore,
    gearScore: scores.gearScore,
    powerScore: scores.powerScore,
    progressScore: scores.progressScore,
    wealthScore: scores.wealthScore,
    sword: `${player.sword} Lv${player.swordLevel}`,
    shield: `${player.shield} Lv${player.shieldLevel}`,
    power: player.power,
    gold: player.gold,
    standing: scores.standing,
  };

  async function sendQuestion(q: string) {
    const text = q.trim();
    if (!text || chatLoading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setChatLoading(true);
    try {
      const res = await fetch("/api/grade/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, playerContext }),
      });
      const data = await res.json() as { answer?: string; error?: string };
      setMessages((m) => [...m, { role: "coach", text: data.answer ?? "Couldn't get a response. Try again." }]);
    } catch {
      setMessages((m) => [...m, { role: "coach", text: "Connection error. Please try again." }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid #1e1a0a", background: "#09080a" }}
    >
      {/* Section header */}
      <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-[#111]">
        <span className="text-lg">⚔️</span>
        <span className="text-[#c9a84c] font-bold text-sm tracking-wide">AI COACH</span>
        {isPending && (
          <span className="ml-auto text-[#333] text-xs animate-pulse">Analyzing...</span>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Analysis content */}
        {isPending && (
          <div className="space-y-2.5">
            {[80, 60, 90, 50, 70].map((w, i) => (
              <div
                key={i}
                className="h-3 rounded-full animate-pulse"
                style={{ width: `${w}%`, background: "#151515" }}
              />
            ))}
          </div>
        )}

        {isError && !isPending && (
          <div className="rounded-lg p-4 text-center space-y-1" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
            <div className="text-2xl">🗡️</div>
            <p className="text-[#555] text-sm">The forge is dark tonight.</p>
            <p className="text-[#333] text-xs">AI analysis unavailable — your score above is fully accurate.</p>
          </div>
        )}

        {explanation && (
          <div className="space-y-5">
            {/* Summary quote */}
            <div className="relative pl-4">
              <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full" style={{ background: "linear-gradient(180deg, #c9a84c, #c9a84c44)" }} />
              <p className="text-[#bbb] text-sm leading-relaxed italic">"{explanation.summary}"</p>
            </div>

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-[#4a9e5c]">▲</span>
                  <span className="text-[9px] uppercase tracking-widest text-[#4a9e5c] font-bold">Strengths</span>
                </div>
                <ul className="space-y-1.5">
                  {explanation.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-[#777] flex gap-2">
                      <span className="text-[#4a9e5c] shrink-0 mt-0.5">+</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-[#c05050]">▼</span>
                  <span className="text-[9px] uppercase tracking-widest text-[#c05050] font-bold">Weaknesses</span>
                </div>
                <ul className="space-y-1.5">
                  {explanation.weaknesses.map((w, i) => (
                    <li key={i} className="text-sm text-[#777] flex gap-2">
                      <span className="text-[#c05050] shrink-0 mt-0.5">−</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Next upgrade */}
            <div className="rounded-lg p-3.5 space-y-1" style={{ background: "#0d0b00", border: "1px solid #1e1900" }}>
              <div className="text-[9px] uppercase tracking-widest text-[#c9a84c] font-bold">Coach's #1 Recommendation</div>
              <p className="text-[#aaa] text-sm leading-relaxed">{explanation.recommendation}</p>
            </div>

            {/* Reasoning */}
            <div className="text-[#333] text-xs leading-relaxed border-t border-[#111] pt-4">
              <span className="text-[#2a2a2a] uppercase tracking-widest text-[9px] font-semibold">Why this grade: </span>
              {explanation.reasoning}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-[#111]" />

        {/* Chat section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">💬</span>
            <span className="text-[#555] text-xs uppercase tracking-widest font-semibold">Ask the Coach</span>
          </div>

          {/* Example suggestions */}
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendQuestion(q)}
                  disabled={chatLoading}
                  className="text-xs px-3 py-1.5 rounded-full transition-colors disabled:opacity-40"
                  style={{
                    background: "#111",
                    border: "1px solid #1e1e1e",
                    color: "#666",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#c9a84c44"; e.currentTarget.style.color = "#c9a84c"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e1e1e"; e.currentTarget.style.color = "#666"; }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Message thread */}
          {messages.length > 0 && (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "coach" && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: "#1a1500", border: "1px solid #c9a84c33" }}>
                      <span className="text-xs">⚔</span>
                    </div>
                  )}
                  <div
                    className="max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed"
                    style={msg.role === "user"
                      ? { background: "#1a1400", border: "1px solid #2a2000", color: "#ddd" }
                      : { background: "#101010", border: "1px solid #1a1a1a", color: "#aaa" }
                    }
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-2.5 justify-start">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "#1a1500", border: "1px solid #c9a84c33" }}>
                    <span className="text-xs">⚔</span>
                  </div>
                  <div className="rounded-xl px-3.5 py-2.5 text-sm" style={{ background: "#101010", border: "1px solid #1a1a1a" }}>
                    <span className="text-[#333] animate-pulse">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendQuestion(input)}
              placeholder="Ask anything about your account..."
              disabled={chatLoading}
              className="flex-1 bg-[#0d0d0d] text-[#ccc] text-sm rounded-lg px-4 py-2.5 outline-none placeholder-[#333] disabled:opacity-50"
              style={{ border: "1px solid #1e1e1e" }}
              onFocus={e => (e.currentTarget.style.borderColor = "#c9a84c33")}
              onBlur={e => (e.currentTarget.style.borderColor = "#1e1e1e")}
            />
            <button
              onClick={() => sendQuestion(input)}
              disabled={!input.trim() || chatLoading}
              className="px-4 py-2.5 rounded-lg font-bold text-sm transition-opacity disabled:opacity-30"
              style={{ background: "#c9a84c", color: "#000" }}
            >
              →
            </button>
          </div>
        </div>
      </div>
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
      <div className="min-h-screen bg-[#080808] text-white flex flex-col items-center justify-center gap-4">
        <p className="text-[#555]">Invalid result data.</p>
        <Link href="/" className="text-[#c9a84c] text-sm underline">Go back</Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center">
        <p className="text-[#333]">Loading...</p>
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
    <div className="min-h-screen bg-[#080808] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-[#111] px-6 py-4 flex items-center justify-between sticky top-0 z-10" style={{ background: "#080808cc", backdropFilter: "blur(8px)" }}>
        <div className="flex items-center gap-2">
          <span className="font-black text-xl" style={{
            background: "linear-gradient(135deg, #c9a84c 0%, #f0d080 50%, #c9a84c 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>SM</span>
          <span className="text-white font-black text-xl">Grade</span>
        </div>
        <Link href="/" className="text-[#444] text-sm hover:text-[#777] transition-colors">
          ← Grade another
        </Link>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10 space-y-6">
        {/* Hero grade block */}
        <div
          className="rounded-xl p-6 space-y-5"
          style={{
            background: "#0c0c0c",
            border: `1px solid ${gradeColor}20`,
            boxShadow: `0 0 40px ${gradeColor}08, inset 0 0 40px ${gradeColor}03`,
          }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl font-black text-white">{player.username}</h2>
              <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                <span className="text-[#555] text-sm">Level {player.level.toLocaleString()}</span>
                <span className="text-[#222]">·</span>
                <span className="text-[#555] text-sm">{scores.levelTier} Tier</span>
                {player.clan && (
                  <>
                    <span className="text-[#222]">·</span>
                    <span className="text-[#555] text-sm">Clan: {player.clan}</span>
                  </>
                )}
              </div>
            </div>
            <div className="text-right">
              <div
                className="text-6xl font-black leading-none"
                style={{ color: gradeColor, textShadow: `0 0 40px ${gradeColor}66, 0 0 80px ${gradeColor}22` }}
              >
                {scores.overallGrade}
              </div>
              <div className="text-[#333] text-xs mt-1">Overall Grade</div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-[#444]">Overall Score</span>
              <span className="font-mono font-bold tabular-nums" style={{ color: gradeColor }}>
                {scores.overallScore}/100
              </span>
            </div>
            <div className="h-2 bg-[#111] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${scores.overallScore}%`,
                  background: `linear-gradient(90deg, ${gradeColor}88, ${gradeColor})`,
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#444] text-xs">Standing:</span>
            <span
              className="text-xs font-semibold px-2.5 py-0.5 rounded-full border"
              style={{ color: standingColor, borderColor: standingColor + "44", background: standingColor + "11" }}
            >
              {scores.standing}
            </span>
            <span className="text-[#333] text-xs">vs {scores.levelTier} tier players</span>
            <span className="text-[#222]">·</span>
            <span
              className="text-xs font-semibold px-2.5 py-0.5 rounded-full border"
              style={{
                color: percentile.top ? "#5ecb7a" : "#555",
                borderColor: percentile.top ? "#5ecb7a44" : "#22222288",
                background: percentile.top ? "#5ecb7a0d" : "#11111188",
              }}
            >
              {percentile.label}
            </span>
          </div>
        </div>

        {/* Gear Report Card */}
        <div>
          <SectionLabel>Gear Report Card</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {scores.slotGrades.map((slot) => (
              <SlotGradeCard key={slot.slotName} slot={slot} />
            ))}
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="rounded-xl p-5 space-y-4" style={{ background: "#0c0c0c", border: "1px solid #131313" }}>
          <SectionLabel>Score Breakdown</SectionLabel>
          <div className="space-y-3">
            <ScoreBar label="Gear Score" score={scores.gearScore} color="#c9a84c" />
            <ScoreBar label="Power Score" score={scores.powerScore} color="#8ab4c9" />
            <ScoreBar label="Progress Score" score={scores.progressScore} color="#5ecb7a" />
            <ScoreBar label="Wealth Score" score={scores.wealthScore} color="#b89fce" />
          </div>
        </div>

        {/* Combat Stats */}
        <div className="rounded-xl p-5" style={{ background: "#0c0c0c", border: "1px solid #131313" }}>
          <SectionLabel>Combat Stats</SectionLabel>
          <CombatStats player={player} />
        </div>

        {/* Player info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl p-5" style={{ background: "#0c0c0c", border: "1px solid #131313" }}>
            <SectionLabel>Gear</SectionLabel>
            <StatRow label="Sword" value={player.sword} />
            <StatRow label="Sword Level" value={player.swordLevel} />
            <StatRow label="Sword Rarity" value={getSwordRarity(player.sword)} />
            <StatRow label="Shield" value={player.shield} />
            <StatRow label="Shield Level" value={player.shieldLevel} />
            <StatRow label="Shield Rarity" value={getShieldRarity(player.shield)} />
          </div>

          <div className="rounded-xl p-5" style={{ background: "#0c0c0c", border: "1px solid #131313" }}>
            <SectionLabel>Stats</SectionLabel>
            <StatRow label="Power" value={player.power} />
            <StatRow label="Gold" value={player.gold} />
            <StatRow label="Health" value={player.health} />
            <StatRow label="PvP Kills" value={player.pvpKillCount.toLocaleString()} />
            <StatRow label="PvP Loot" value={player.pvpLoot || "—"} />
            {player.registerDate && <StatRow label="Registered" value={player.registerDate} />}
          </div>
        </div>

        {/* Top Enemies */}
        {topEnemies.length > 0 && (
          <div className="rounded-xl p-5" style={{ background: "#0c0c0c", border: "1px solid #131313" }}>
            <SectionLabel>Most Killed</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {topEnemies.map(([enemy, count]) => (
                <div
                  key={enemy}
                  className="rounded-lg px-3 py-2"
                  style={{ background: "#0a0a0a", border: "1px solid #111" }}
                >
                  <div className="text-[#555] text-xs">{enemy}</div>
                  <div className="text-white text-sm font-mono font-bold">{count.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Coach */}
        <AiCoachSection
          explanation={explanation}
          isPending={explainMutation.isPending}
          isError={explainMutation.isError}
          player={player}
          scores={scores}
        />

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pb-4">
          <button
            onClick={() => downloadShareCard(player, scores)}
            className="inline-flex items-center gap-2 font-bold text-sm px-6 py-2.5 rounded-lg transition-all"
            style={{ background: "linear-gradient(135deg, #c9a84c, #d4b55e)", color: "#000" }}
          >
            <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
              <path d="M7.5 1v9m0 0L4.5 7m3 3 3-3M1 11v1.5A1.5 1.5 0 0 0 2.5 14h10A1.5 1.5 0 0 0 14 12.5V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Save Grade Card
          </button>
          <button
            onClick={copyLink}
            className={`inline-flex items-center gap-2 border text-sm px-6 py-2.5 rounded-lg transition-all ${
              copied ? "border-[#5ecb7a] text-[#5ecb7a]" : "border-[#1e1e1e] hover:border-[#333] text-[#666] hover:text-[#aaa]"
            }`}
          >
            {copied ? (
              <><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> Link Copied!</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Result Link</>
            )}
          </button>
          <Link
            href="/"
            className="inline-block border border-[#1e1e1e] hover:border-[#c9a84c33] text-[#555] hover:text-[#c9a84c] text-sm px-6 py-2.5 rounded-lg transition-all"
          >
            Grade another account
          </Link>
        </div>
      </main>

      <footer className="border-t border-[#0f0f0f] px-6 py-4 text-center text-[#1e1e1e] text-xs">
        SMGrade — not affiliated with SwordMasters
      </footer>
    </div>
  );
}
