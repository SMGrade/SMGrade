import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { useExplainGrade } from "@workspace/api-client-react";
import type { ParsedPlayer } from "@/lib/parser";
import type { ScoreResult, GearSlotGrade } from "@/lib/scorer";
import { formatNumber, parseNumber } from "@/lib/numberParser";
import { getSwordRarity, getShieldRarity, getInterpolatedBenchmark } from "@/lib/benchmark";
import { downloadShareCard } from "@/lib/shareCard";
import { SWORDS, SHIELDS, getSwordData, getShieldData, scaledSwordDamage, scaledShieldDM, loadItems, resolveItemByGameType, getNextSwordUpgrade, getNextShieldUpgrade, swordUpgradeGain, shieldUpgradeGain } from "@/lib/gearDatabase";
import { getPriceRaw } from "@/lib/marketDatabase";
import Simulator from "@/components/Simulator";
import HistoryTracker from "@/components/HistoryTracker";
import { ParticleBackground } from "./Home";
import { type UserProfile } from "@/lib/authStore";
import { ensurePricesLoaded, calculateNetWorth, lookupItemPrice, type NetWorthResult } from "@/lib/priceProvider";
import { calculateDamageStats } from "@/lib/damageCalc";

interface ResultData {
  player: ParsedPlayer;
  scores: ScoreResult;
}

export function GradeParticles({ color }: { color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    const width = (canvas.width = 400);
    const height = (canvas.height = 400);

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      decay: number;
    }> = [];

    for (let i = 0; i < 70; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1.2;
      particles.push({
        x: width / 2,
        y: height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 1.5 + 0.8,
        alpha: 1,
        decay: Math.random() * 0.015 + 0.012,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.alpha -= p.decay;

        if (p.alpha > 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.shadowBlur = 4;
          ctx.shadowColor = color;
          ctx.globalAlpha = p.alpha;
          ctx.fill();
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [color]);

  return <canvas ref={canvasRef} className="absolute w-[400px] h-[400px] pointer-events-none z-0 opacity-80" />;
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

const STANDING_COLOR: Record<string, string> = {
  Elite: "#ffd700",
  "Above Average": "#3b82f6",
  Average: "#a855f7",
  "Below Average": "#888",
  Weak: "#e05a5a",
};

function getPlayerInsights(scores: ScoreResult, player: ParsedPlayer): string[] {
  const insights: string[] = [];
  
  const percentile = estimatePercentile(scores.overallScore);
  if (percentile.top) {
    insights.push(`You rank in the ${percentile.label} of active accounts globally.`);
  } else {
    insights.push(`Your account rating outperforms approximately ${100 - parseInt(percentile.label.match(/\d+/)?.[0] ?? "50")}% of players.`);
  }

  if (scores.gearScore >= 85) {
    insights.push("Your weapon and shield levels are highly optimized for this tier.");
  } else if (scores.gearScore < 50) {
    insights.push("Your gear levels are below average. Focus on upgrading weapons.");
  }

  if (scores.powerScore >= 80) {
    insights.push("Your raw power contribution is exceptionally high.");
  } else if (scores.powerScore < 55) {
    insights.push("Your power is lagging. Grind gold or quests to buy stats.");
  }

  return insights.slice(0, 3);
}

function estimatePercentile(overallScore: number): { label: string; top: boolean } {
  if (overallScore >= 93) return { label: "Top 3%", top: true };
  if (overallScore >= 85) return { label: "Top 10%", top: true };
  if (overallScore >= 75) return { label: "Top 20%", top: true };
  if (overallScore >= 65) return { label: "Top 35%", top: true };
  if (overallScore >= 55) return { label: "Top 50%", top: false };
  if (overallScore >= 45) return { label: "Top 65%", top: false };
  if (overallScore >= 35) return { label: "Top 80%", top: false };
  return { label: "Top 95%", top: false };
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] tracking-widest uppercase font-black text-white/35 font-display mb-3">
      {children}
    </h3>
  );
}

function getRarityStyles(rarity: string) {
  if (rarity === "Legendary") {
    return {
      gradient: "from-[#00171a] via-[#050505] to-[#00171a]",
      border: "border-amber-500/25 hover:border-amber-500/50",
      glow: "rgba(0,240,255,0.03)",
      textColor: "text-amber-400"
    };
  }
  if (rarity === "Epic") {
    return {
      gradient: "from-[#14021a] via-[#050505] to-[#14021a]",
      border: "border-purple-500/25 hover:border-purple-500/50",
      glow: "rgba(168,85,247,0.03)",
      textColor: "text-purple-400"
    };
  }
  return {
    gradient: "from-[#111622] via-[#050505] to-[#111622]",
    border: "border-white/10 hover:border-amber-500/30",
    glow: "rgba(255,215,0,0.01)",
    textColor: "text-white/60"
  };
}

function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, val));
}

function SlotGradeCard({ slot, index }: { slot: GearSlotGrade; index: number }) {
  const gradeColor = GRADE_COLOR[slot.grade] ?? "#888";
  const tip = slot.tip;

  const lvlMatch = slot.itemName.match(/Lv(\d+)/i);
  const currentLevel = lvlMatch ? parseInt(lvlMatch[1]) : 0;
  
  const rarity = slot.slotName === "Sword" ? getSwordRarity(slot.itemName) : getShieldRarity(slot.itemName);
  const rStyles = getRarityStyles(rarity);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1, ease: "easeOut" }}
      className={`rounded-xl p-5 space-y-4 glass-panel border relative transition-all duration-300 bg-gradient-to-br ${rStyles.gradient} ${rStyles.border} hover:scale-[1.01]`}
      style={{
        boxShadow: `0 8px 30px rgba(0, 0, 0, 0.5), inset 0 0 25px ${rStyles.glow}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-white/30 text-[9px] uppercase tracking-widest font-black font-display mb-0.5">{slot.slotName} Slot</div>
          <div className="text-white font-black text-sm truncate font-display">{slot.itemName.split(",")[0]}</div>
          <div className={`text-[9px] uppercase font-mono font-bold mt-1.5 bg-white/[0.02] px-2 py-0.5 rounded border border-white/5 inline-block ${rStyles.textColor}`}>{rarity}</div>
        </div>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center font-black font-display text-lg filter drop-shadow-md select-none border"
          style={{
            color: gradeColor,
            borderColor: `${gradeColor}33`,
            background: `radial-gradient(circle, ${gradeColor}15 0%, transparent 100%)`
          }}
        >
          {slot.grade}
        </div>
      </div>

      {currentLevel > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[9px] uppercase tracking-wider font-semibold text-white/20">
            <span>Item Level</span>
            <span className="font-mono">{currentLevel}/10</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div
                key={idx}
                className="h-1.5 flex-1 rounded-sm transition-all duration-500"
                style={{
                  backgroundColor: idx < currentLevel ? rStyles.textColor.includes("purple") ? "#c084fc" : "#ffd700" : "rgba(255,255,255,0.03)",
                  boxShadow: idx < currentLevel ? `0 0 8px ${rStyles.textColor.includes("purple") ? "#a855f7" : "#ffd700"}` : "none",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {tip ? (
        <div className="border-t border-white/[0.04] pt-3 mt-1 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase font-black tracking-wider text-amber-400">Upgrade path</span>
            <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${
              tip.affordable ? "bg-[#5ecb7a]/10 border-[#5ecb7a]/20 text-[#5ecb7a]" : "bg-white/[0.02] border-white/5 text-white/35"
            }`}>
              {tip.affordable ? "Affordable" : "Not Affordable"}
            </span>
          </div>
          <div className="text-xs text-white/50 leading-relaxed font-medium">
            Next: Upgrade to <span className="text-white font-bold">{tip.targetName} Lv{tip.targetLevel}</span> for <span className="text-[#5ecb7a] font-bold font-mono">+{tip.damageGainPct}% DMG</span>.
          </div>
        </div>
      ) : (
        <div className="border-t border-white/[0.04] pt-3 mt-1 flex items-center justify-between text-xs text-white/35 font-medium">
          <span>Perfect Stat</span>
          <span className="text-[#5ecb7a] text-[10px]">✓ Optimized</span>
        </div>
      )}
    </motion.div>
  );
}

const EXAMPLE_QUESTIONS = [
  "What is the cheapest upgrade for my damage?",
  "Should I focus on my shield or weapon level?",
  "Is my power rating optimized for my level?",
];

function CoachChat({ playerContext, explanation }: { playerContext: string; explanation?: any }) {
  const [messages, setMessages] = useState<Array<{ role: "user" | "coach"; text: string }>>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  async function sendQuestion(text: string) {
    if (!text.trim() || chatLoading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setChatLoading(true);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

    try {
      const res = await fetch("/api/grade/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, playerContext }),
      });
      const data = await res.json() as { answer?: string; text?: string; error?: string };
      if (res.ok) {
        setMessages((m) => [...m, { role: "coach", text: data.answer ?? data.text ?? "No response content from Coach." }]);
      } else {
        setMessages((m) => [...m, { role: "coach", text: `AI Coach Error: ${data.error ?? "Could not get a response."}` }]);
      }
    } catch (err: any) {
      setMessages((m) => [...m, { role: "coach", text: `Connection error: ${err.message || String(err)}` }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }

  return (
    <div className="rounded-xl p-5 border border-white/[0.04] glass-panel space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">💬</span>
          <span className="text-amber-400 text-xs font-black uppercase tracking-widest font-display">Ask the AI Coach</span>
        </div>
      </div>

      <div className="space-y-4 pt-1">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => sendQuestion(q)}
                disabled={chatLoading}
                className="text-[10px] px-3.5 py-1.5 rounded-full border border-white/[0.04] bg-white/[0.01] text-white/45 hover:text-amber-400 hover:border-amber-500/20 transition-all cursor-pointer font-semibold disabled:opacity-35"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.length > 0 && (
          <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "coach" && (
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 bg-[#070b13] border border-amber-500/25">
                    <span className="text-xs text-amber-400">⚔</span>
                  </div>
                )}
                <div
                  className="max-w-[80%] rounded-xl px-4 py-2.5 text-xs leading-relaxed border"
                  style={msg.role === "user"
                    ? { background: "rgba(245, 158, 11, 0.05)", borderColor: "rgba(245, 158, 11, 0.15)", color: "#ffffff" }
                    : { background: "rgba(255, 255, 255, 0.01)", borderColor: "rgba(255, 255, 255, 0.03)", color: "rgba(255, 255, 255, 0.75)" }
                  }
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 bg-[#070b13] border border-amber-500/25">
                  <span className="text-xs text-amber-400">⚔</span>
                </div>
                <div className="rounded-xl px-4 py-2.5 text-xs border bg-white/[0.01] border-white/[0.03] text-white/35 animate-pulse">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendQuestion(input)}
            placeholder="Ask anything about your account..."
            disabled={chatLoading}
            className="flex-1 bg-white/[0.01] text-white/80 text-xs rounded-lg px-4 py-3 outline-none placeholder-white/10 border border-white/[0.04] focus:border-amber-500/30 disabled:opacity-40"
          />
          <button
            onClick={() => sendQuestion(input)}
            disabled={!input.trim() || chatLoading}
            className="px-4 py-3 rounded-lg button-gold text-xs font-black disabled:opacity-20 cursor-pointer"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Result() {
  const [, navigate] = useLocation();
  const [data, setData] = useState<ResultData | null>(null);
  const scores = useMemo(() => {
    if (!data) return null;
    return data.scores;
  }, [data]);
  const [parseError, setParseError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRevealing, setIsRevealing] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "combat" | "upgrades" | "benchmarks" | "simulator" | "coach">("overview");

  // Collapsible accordion section states
  const [enemiesExpanded, setEnemiesExpanded] = useState(false);
  const [dailyExpanded, setDailyExpanded] = useState(false);
  const [socialExpanded, setSocialExpanded] = useState(false);

  // Combat Tab Interactive Calculator States
  const [calcPower, setCalcPower] = useState<number>(0);
  const [calcSwordDs, setCalcSwordDs] = useState<number>(0);
  const [calcShieldMs, setCalcShieldMs] = useState<number>(0);
  const [calcSpeedBoost, setCalcSpeedBoost] = useState<number>(0);
  const [calcBossHp, setCalcBossHp] = useState<number>(1e12);

  // Party Builder States & Helpers
  interface PartyPlayer {
    id: string;
    nickname: string;
    sword: string;
    swordLevel: number;
    shield: string;
    shieldLevel: number;
    powerInput: string;
    powerRaw: number;
  }
  const [partyPlayers, setPartyPlayers] = useState<PartyPlayer[]>([]);

  const updatePlayer = (id: string, updates: Partial<PartyPlayer>) => {
    setPartyPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const removePlayer = (id: string) => {
    setPartyPlayers((prev) => prev.filter((p) => p.id !== id));
  };

  const addPlayer = () => {
    setPartyPlayers((prev) => {
      const defaultSword = SWORDS[0]?.name || "Graveborn Edge";
      const defaultShield = SHIELDS[0]?.name || "Sealguard";
      const defaultPower = data?.player.powerRaw || 1e12;
      const defaultPowerStr = data?.player.power || "1.0T";
      
      const newPlayer: PartyPlayer = {
        id: Math.random().toString(36).substring(2, 9),
        nickname: `Member #${prev.length + 1}`,
        sword: defaultSword,
        swordLevel: 1,
        shield: defaultShield,
        shieldLevel: 1,
        powerInput: defaultPowerStr,
        powerRaw: defaultPower
      };
      return [...prev, newPlayer];
    });
  };

  // Computed stats calculator
  const computedStats = useMemo(() => {
    if (!data) return null;
    const { player } = data;
    const rawPayload = (player as any).rawPayload || {};
    const inv = rawPayload.inv || {};
    const activePets = inv.activePets || [];

    // Resolve weapon data
    const curSword = getSwordData(player.sword);
    const curShield = getShieldData(player.shield);

    const ds = curSword ? scaledSwordDamage(curSword.baseDamage, player.swordLevel) * 1e9 : 0;
    const ms = curShield ? scaledShieldDM(curShield.baseDM, player.shieldLevel) : 0;

    const powerRaw = player.powerRaw;

    // Speed and multipliers from pets
    const speedBoost = activePets.reduce((acc: number, p: any) => {
      const petItem = resolveItemByGameType(p.type, "pet");
      return acc + (petItem?.metadata?.speedBoost || 0);
    }, 0.0);
    const finalAttackSpeed = 2.77 * (1 + speedBoost);
    
    const goldMulti = activePets.reduce((acc: number, p: any) => {
      const petItem = resolveItemByGameType(p.type, "pet");
      return acc + (petItem?.metadata?.goldMulti || 0);
    }, 1.0);

    const petPowerBonus = activePets.reduce((acc: number, p: any) => {
      const petItem = resolveItemByGameType(p.type, "pet");
      return acc + (petItem?.baseValue || 0);
    }, 0.0);
    const powerMulti = 1.0 + petPowerBonus;

    const getProtRaw = (protStr?: string) => {
      if (!protStr || protStr === "-") return 0;
      return parseNumber(protStr);
    };
    const baseProt = curSword ? getProtRaw(curSword.protection) : 0;
    const baseShProt = curShield ? getProtRaw(curShield.protection) : 0;
    const totalBaseProt = baseProt + baseShProt;
    const protection = totalBaseProt * (1 + 0.25 * (Math.max(player.swordLevel, player.shieldLevel, 1) - 1));

    const damageStats = calculateDamageStats({
      ds,
      swordDamageMultiplier: ms,
      power: powerRaw,
      petPowerBonus: 0,
      armorPowerBonus: 0,
      attackSpeed: 2.77
    });

    return {
      ds,
      ms,
      dph: damageStats.damagePerHit,
      speedBoost,
      finalAttackSpeed,
      dps: damageStats.damagePerSecond,
      pph: damageStats.powerPerHit,
      pps: damageStats.powerPerSecond,
      goldMulti,
      powerMulti,
      petPowerBonus,
      protection,
    };
  }, [data]);

  useEffect(() => {
    if (data && computedStats) {
      setCalcPower(data.player.powerRaw || 0);
      setCalcSwordDs(computedStats.ds || 0);
      setCalcShieldMs(computedStats.ms || 0);
      setCalcSpeedBoost(Math.round(computedStats.speedBoost * 100));

      setPartyPlayers((prev) => {
        if (prev.length > 0) return prev;
        return [
          {
            id: "current-player",
            nickname: data.player.username || "You",
            sword: data.player.sword,
            swordLevel: data.player.swordLevel || 1,
            shield: data.player.shield,
            shieldLevel: data.player.shieldLevel || 1,
            powerInput: data.player.power || "0",
            powerRaw: data.player.powerRaw || 0
          }
        ];
      });
    }
  }, [data, computedStats]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const d = params.get("d");
    if (!d) {
      setParseError(true);
      return;
    }
    try {
      const decoded = JSON.parse(d) as ResultData;
      if (decoded && decoded.player && decoded.scores) {
        setData(decoded);
      }
    } catch (err) {
      setParseError(true);
    }
  }, []);

  const itemsContextStr = (() => {
    try {
      return JSON.stringify(loadItems());
    } catch {
      return "";
    }
  })();

  const explainMutation = useExplainGrade();

  useEffect(() => {
    if (!data) return;
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
        powerRaw: player.powerRaw,
        goldRaw: player.goldRaw,
        levelTier: scores.levelTier,
        standing: scores.standing,
        pvpKills: player.pvpKillCount ?? null,
        itemsContext: itemsContextStr,
      } as any,
    });
  }, [data]);

  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(() => {
      setIsRevealing(false);
    }, 2200);
    return () => clearTimeout(timer);
  }, [data]);

  if (parseError) {
    return (
      <div className="min-h-screen text-white flex flex-col items-center justify-center gap-4 relative overflow-hidden bg-[#03050b]">
        <div className="absolute inset-0 bg-radial-gradient from-red-500/5 via-transparent to-transparent pointer-events-none" />
        <p className="text-white/40 text-sm font-semibold">Invalid result data.</p>
        <Link href="/" className="text-amber-400 text-xs font-bold uppercase tracking-widest bg-white/[0.02] border border-amber-500/20 px-4 py-2 rounded-lg hover:bg-amber-500/10 transition-all">
          Go back to Home
        </Link>
      </div>
    );
  }

  if (!data || !scores) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center relative overflow-hidden bg-[#03050b]">
        <div className="w-6 h-6 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
      </div>
    );
  }

  const player = data.player;
  const gradeColor = GRADE_COLOR[scores.overallGrade] ?? "#888";
  const standingColor = STANDING_COLOR[scores.standing] ?? "#888";
  const percentile = estimatePercentile(scores.overallScore);
  const explanation = explainMutation.data;

  if (isRevealing) {
    return (
      <div className="min-h-screen text-white flex flex-col items-center justify-center relative overflow-hidden font-sans bg-[#070b13]">
        <div className="absolute inset-0 bg-radial-gradient from-amber-500/5 via-transparent to-transparent pointer-events-none" />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-6 z-10"
        >
          <p className="text-white/20 text-[10px] font-black uppercase tracking-widest font-display">Analyzing Profile</p>
          <h2 className="text-3xl font-black font-display text-white tracking-tight">{player.username}</h2>
          
          <div className="relative flex items-center justify-center py-10">
            <GradeParticles color={gradeColor} />
            <motion.div
              initial={{ scale: 0, rotate: -25, opacity: 0 }}
              animate={{ scale: [0, 1.25, 1], rotate: 0, opacity: 1 }}
              transition={{ duration: 0.9, ease: "easeOut", delay: 0.4 }}
              style={{ color: gradeColor }}
              className="text-8xl font-black font-display drop-shadow-[0_0_40px_rgba(0,240,255,0.35)] select-none cursor-default"
            >
              {scores.overallGrade}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.4 }}
            className="text-amber-400/80 text-[10px] font-bold font-mono tracking-widest uppercase bg-amber-500/5 px-4 py-1.5 rounded-full border border-amber-500/10 inline-block"
          >
            Analysis Complete
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white flex flex-col font-sans relative overflow-hidden bg-[#03050b]">
      <ParticleBackground />
      
      {/* Navbar */}
      <header className="border-b border-white/[0.04] px-6 py-4 flex items-center justify-between sticky top-0 z-20 bg-[#070b13]/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="font-black text-lg tracking-wider px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/25 text-amber-400 shadow-[0_0_15px_rgba(0,240,255,0.1)] font-display">
            SM
          </span>
          <span className="text-white font-extrabold text-lg tracking-tight font-display">Grade</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-white/40 hover:text-amber-400 text-xs font-bold uppercase tracking-widest transition-colors">
            ← Grade Another
          </Link>
        </div>
      </header>

      {/* Cyber HUD Terminal Layout */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-8 z-10 relative">
        
        {/* Top HUD Banner Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* HUD Module 1: Player Identity */}
          <div 
            className="rounded-tl-2xl rounded-br-2xl border p-5 bg-gradient-to-br from-[#070b13]/80 via-black/90 to-[#070b13]/80 glass-panel flex flex-col justify-between gap-4 shadow-[0_4px_30px_rgba(0,0,0,0.5)]"
            style={{ borderColor: `${gradeColor}25` }}
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                <span className="text-[8px] uppercase tracking-widest text-amber-500 font-bold">Terminal Connected</span>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-2xl font-black font-display tracking-tight text-white">{player.username}</h2>
              </div>
              <p className="text-[10px] text-white/40 font-semibold mt-1">Lvl {player.level.toLocaleString()} • {scores.levelTier} Player</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => downloadShareCard(player, scores)}
                className="flex-1 py-2 rounded-lg button-gold text-[10px] font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(255,215,0,0.1)]"
              >
                📥 Share HUD
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className={`flex-1 py-2 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                  copied 
                    ? "bg-[#5ecb7a]/10 border-[#5ecb7a]/30 text-[#5ecb7a]" 
                    : "border-white/5 bg-white/[0.01] hover:bg-white/[0.04] text-white/60"
                }`}
              >
                {copied ? "✓ Copied" : "🔗 Copy Link"}
              </button>
            </div>
          </div>

          {/* HUD Module 2: Grader Analysis */}
          <div 
            className="rounded-tl-2xl rounded-br-2xl border p-5 bg-gradient-to-br from-[#070b13]/80 via-black/90 to-[#070b13]/80 glass-panel flex items-center justify-between gap-6 shadow-[0_4px_30px_rgba(0,0,0,0.5)]"
            style={{ borderColor: `${gradeColor}25` }}
          >
            <div className="space-y-2.5 flex-1">
              <span className="text-[9px] uppercase font-black tracking-widest text-white/30 block">Analysis Index</span>
              <div>
                <span className="text-sm font-bold font-mono text-white">{scores.overallScore}%</span>
                <span className="text-white/20 text-[9px] uppercase font-bold tracking-wider ml-1">Overall</span>
              </div>
              <div className="h-1 bg-white/[0.03] border border-white/[0.02] rounded-full overflow-hidden w-full">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${scores.overallScore}%`, backgroundColor: gradeColor }}
                />
              </div>
              <p className="text-[10px] font-semibold" style={{ color: standingColor }}>
                {scores.standing}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center shrink-0">
              <div 
                className="text-6xl font-black font-display leading-none select-none drop-shadow-[0_0_15px_rgba(255,215,0,0.2)]"
                style={{ color: gradeColor }}
              >
                {scores.overallGrade}
              </div>
              <span className="text-[8px] text-white/30 uppercase tracking-widest font-black font-mono mt-1.5">Rating</span>
            </div>
          </div>

          {/* HUD Module 3: Micro-Stats Grid */}
          <div 
            className="rounded-tl-2xl rounded-br-2xl border border-white/[0.04] p-4 bg-gradient-to-br from-[#070b13]/80 via-black/90 to-[#070b13]/80 glass-panel grid grid-cols-2 gap-2 shadow-[0_4px_30px_rgba(0,0,0,0.5)]"
          >
            <div className="bg-white/[0.01] border border-white/[0.02] rounded p-2 flex flex-col justify-between">
              <span className="text-[8px] uppercase tracking-wider text-white/30 font-bold">Power</span>
              <span className="text-xs font-black font-mono text-white truncate" title={player.power}>{player.power}</span>
            </div>
            <div className="bg-white/[0.01] border border-white/[0.02] rounded p-2 flex flex-col justify-between">
              <span className="text-[8px] uppercase tracking-wider text-white/30 font-bold">Gold Pool</span>
              <span className="text-xs font-black font-mono text-[#5ecb7a] truncate" title={player.gold}>{player.gold}</span>
            </div>
            <div className="bg-white/[0.01] border border-white/[0.02] rounded p-2 flex flex-col justify-between col-span-2">
              <span className="text-[8px] uppercase tracking-wider text-white/30 font-bold">Equipped Armaments</span>
              <span className="text-[10px] font-black text-amber-400 truncate animate-pulse" title={`${player.sword} / ${player.shield}`}>
                ⚔️ {player.sword.split(",")[0]}
              </span>
            </div>
          </div>
        </div>

        {/* Horizontal Capsule Tab Bar Navigation */}
        <div className="flex justify-center">
          <div className="inline-flex gap-1.5 bg-[#070b13]/90 p-1.5 rounded-xl border border-white/[0.04] overflow-x-auto max-w-full no-scrollbar shadow-inner">
            {[
              { id: "overview", label: "Overview" },
              { id: "combat", label: "Combat & Calc" },
              { id: "upgrades", label: "Upgrades" },
              { id: "benchmarks", label: "Benchmarks" },
              { id: "simulator", label: "Sandbox Sim" },
              { id: "coach", label: "AI Coach" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-3.5 rounded-lg font-black text-[9px] uppercase tracking-widest font-display transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-amber-500/10 border border-amber-500/20 text-amber-400 font-black shadow-[0_0_10px_rgba(255,215,0,0.05)]"
                    : "border border-transparent text-white/40 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Panel contents */}
        <div className="space-y-6">
            {activeTab === "overview" && (
              <div className="space-y-8">
                {/* 1. HERO SM GRADE BANNER */}
                <div 
                  className="border border-amber-500/20 rounded-2xl p-6 bg-gradient-to-r from-[#070b13]/80 via-black to-[#070b13]/80 glass-panel shadow-[0_8px_32px_rgba(255,215,0,0.1)] relative overflow-hidden flex flex-col md:flex-row items-center gap-8 md:gap-12"
                >
                  {/* Decorative glowing background accent */}
                  <div className="absolute -top-[50%] -left-[20%] w-[300px] h-[300px] rounded-full bg-amber-500/5 blur-[100px] pointer-events-none" />

                  {/* Circular Shield-Style Grade Hero display */}
                  <div className="relative shrink-0 flex items-center justify-center w-48 h-48 sm:w-56 sm:h-56">
                    {/* Rotating outer dashboard rings */}
                    <div className="absolute inset-0 rounded-full border-2 border-dashed border-amber-500/20 animate-[spin_40s_linear_infinite]" />
                    <div className="absolute inset-2 rounded-full border border-double border-amber-500/10 animate-[spin_20s_linear_infinite_reverse]" />
                    <div className="absolute inset-4 rounded-full border border-white/5 bg-[#05050f]/80" />
                    
                    {/* Inner glowing pulse */}
                    <div 
                      className="absolute inset-6 rounded-full opacity-10 animate-pulse"
                      style={{ backgroundColor: gradeColor, filter: "blur(8px)" }}
                    />

                    {/* Grade Text */}
                    <div className="relative z-10 flex flex-col items-center justify-center">
                      <span 
                        className="text-7xl sm:text-8xl font-black font-display tracking-tighter leading-none select-none drop-shadow-[0_0_20px_rgba(255,215,0,0.3)] animate-pulse"
                        style={{ color: gradeColor }}
                      >
                        {scores.overallGrade}
                      </span>
                      <span className="text-[9px] text-white/30 uppercase tracking-widest font-black font-mono mt-1">SM GRADE</span>
                    </div>
                  </div>

                  {/* Summary Dashboard Info (Next to Grade Hero) */}
                  <div className="flex-1 space-y-4 text-center md:text-left w-full">
                    <div>
                      <span className="text-[10px] text-amber-500 font-black uppercase tracking-widest bg-amber-500/5 border border-amber-500/15 px-3 py-1 rounded-full inline-block font-display mb-2">
                        {scores.overallGrade} RATED CHAMPION
                      </span>
                      <h3 className="text-2xl font-black text-white tracking-tight">Performance Summary</h3>
                      <p className="text-xs text-white/50 font-semibold mt-1">
                        Grader Index score is <span className="text-white font-black font-mono">{scores.overallScore}%</span>. Standing: <span className="font-bold" style={{ color: standingColor }}>{scores.standing}</span>
                      </p>
                    </div>

                    {/* Progress Bar towards perfect score */}
                    <div className="space-y-1.5 max-w-lg mx-auto md:mx-0">
                      <div className="flex justify-between text-[10px] uppercase font-bold text-white/30">
                        <span>Grader Score Tracker</span>
                        <span className="font-mono text-white">{scores.overallScore}/100</span>
                      </div>
                      <div className="h-2 bg-white/[0.03] border border-white/[0.02] rounded-full overflow-hidden relative">
                        <div
                          className="h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(255,215,0,0.3)]"
                          style={{ width: `${scores.overallScore}%`, backgroundColor: gradeColor }}
                        />
                      </div>
                    </div>

                    {/* Recommended Upgrade Summary in Hero Banner */}
                    <div className="bg-[#05050f]/80 border border-white/[0.04] p-3.5 rounded-xl inline-block text-left w-full max-w-lg">
                      <span className="text-[8px] text-amber-400 uppercase font-black tracking-widest block mb-1">Recommended Next Upgrade</span>
                      {scores.upgradeAdvice.immediate ? (
                        <div className="flex items-center gap-3">
                          <span className="text-lg">⚡</span>
                          <div>
                            <p className="text-xs font-black text-white">
                              {scores.upgradeAdvice.immediate.name} {scores.upgradeAdvice.immediate.level > 0 ? `Lv${scores.upgradeAdvice.immediate.level}` : ""}
                            </p>
                            <p className="text-[10px] text-white/40 font-semibold mt-0.5">{scores.upgradeAdvice.immediate.reason}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs font-mono font-bold text-amber-500/90">
                          ⏳ {scores.upgradeAdvice.powerShortageMessage || "Farming & grind. No immediate upgrades available."}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. SUB-SCORES GRID (Secondary Elements) */}
                <div>
                  <SectionLabel>Component Performance Indices</SectionLabel>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { type: "score", label: "Power Score", score: scores.powerScore },
                      { type: "score", label: "Gear Score", score: scores.gearScore },
                      { type: "score", label: "Wealth Score", score: scores.wealthScore },
                      { type: "diagnostics", label: "Account Diagnostics", score: 0 }
                    ].map((card, idx) => {
                      const getScoreGrade = (s: number) => {
                        if (s >= 95) return "S+";
                        if (s >= 90) return "S";
                        if (s >= 85) return "A+";
                        if (s >= 80) return "A";
                        if (s >= 70) return "B+";
                        if (s >= 60) return "B";
                        if (s >= 50) return "C+";
                        if (s >= 40) return "C";
                        return "D";
                      };
                      const delays = ["delay-75", "delay-100", "delay-150", "delay-200"];
                      const delayClass = delays[idx] || "";

                      if (card.type === "diagnostics") {
                        return (
                          <div
                            key={card.label}
                            className={`border border-white/[0.03] rounded-xl p-3 bg-[#070b13]/60 glass-panel flex flex-col justify-between hover-glow-card animate-fade-in ${delayClass} shadow-[0_4px_15px_rgba(0,0,0,0.2)]`}
                            style={{ minHeight: "92px" }}
                          >
                            <span className="text-[9px] uppercase font-black text-white/20 tracking-wider block mb-1">
                              {card.label}
                            </span>
                            <div className="flex flex-col gap-1 overflow-y-auto max-h-[56px] pr-1 scrollbar-thin mt-0.5">
                              {scores.diagnostics && scores.diagnostics.map((diag: string, i: number) => {
                                const isGreen = diag.includes("Optimized") || diag.includes("Excellent") || diag.includes("Ready");
                                const isYellow = diag.includes("Pending") || diag.includes("Balanced");
                                const dotColor = isGreen ? "text-[#5ecb7a]" : (isYellow ? "text-amber-500" : "text-blue-400");
                                return (
                                  <div key={i} className="flex items-start gap-1 text-[8.5px] font-bold text-white/80 leading-snug">
                                    <span className={`${dotColor} select-none`}>•</span>
                                    <span>{diag}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      const cardGrade = getScoreGrade(card.score!);
                      const gradeColor = GRADE_COLOR[cardGrade] ?? "#ffd700";
                      return (
                        <div
                          key={card.label}
                          className={`border border-white/[0.03] rounded-xl p-3.5 bg-[#070b13]/60 glass-panel flex flex-col justify-between hover-glow-card animate-fade-in ${delayClass} shadow-[0_4px_15px_rgba(0,0,0,0.2)]`}
                        >
                          <span className="text-[9px] uppercase font-black text-white/20 tracking-wider block mb-1">
                            {card.label}
                          </span>
                          
                          <div className="flex items-baseline justify-between mt-0.5">
                            <span className="text-xl font-black text-white font-mono">{card.score}%</span>
                            <span
                              className="text-[9px] font-black px-1.5 py-0.5 rounded border"
                              style={{
                                color: gradeColor,
                                borderColor: `${gradeColor}22`,
                                backgroundColor: `${gradeColor}05`
                              }}
                            >
                              {cardGrade}
                            </span>
                          </div>

                          <div className="h-1 bg-white/[0.02] border border-white/[0.01] rounded-full overflow-hidden mt-2 relative">
                            <div
                              className="h-full rounded-full animate-grow-width"
                              style={{
                                width: `${card.score}%`,
                                backgroundColor: gradeColor
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Armament Slots & Insights / Strengths / Weaknesses Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Loot Slots (7 Columns) */}
                  <div className="lg:col-span-7 space-y-4">
                    <SectionLabel>Loot Inventory Slots</SectionLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {scores.slotGrades.map((slot, index) => (
                        <SlotGradeCard key={slot.slotName} slot={slot} index={index} />
                      ))}
                    </div>
                  </div>

                  {/* Insights & Strengths & Weaknesses (5 Columns) */}
                  <div className="lg:col-span-5 space-y-6">
                    {/* Strengths & Weaknesses Panel */}
                    <div className="space-y-4">
                      <SectionLabel>Performance Diagnostics</SectionLabel>
                      <div className="border border-white/[0.04] rounded-xl p-5 bg-[#070b13]/60 glass-panel space-y-4">
                        {(() => {
                          const getPlayerStrengthsAndWeaknesses = (sc: any) => {
                            const strengths: string[] = [];
                            const weaknesses: string[] = [];
                            const isSwordOptimized = sc.subGrades?.sword?.score >= 100;
                            const isShieldOptimized = sc.subGrades?.shield?.score >= 100;

                            if (isSwordOptimized && isShieldOptimized) strengths.push("High-tier equipped armaments");
                            else weaknesses.push("Equipped sword/shield levels need upgrading");

                            if (sc.powerScore >= 75) strengths.push("Strong raw power base contribution");
                            else weaknesses.push("Raw power level below average for your tier");

                            if (sc.wealthScore >= 75) strengths.push("High gold reserves & vault net worth");
                            else weaknesses.push("Low vault valuation; grind gold and items");

                            if (sc.combatScore >= 75) strengths.push("Devastating Damage and DPS combat rating");
                            else if (!isSwordOptimized) weaknesses.push("DPS contribution is low; upgrade weapon level");

                            if (strengths.length < 2) strengths.push("Consistent daily combat activity", "Solid gear durability scaling");
                            if (weaknesses.length < 2) weaknesses.push("Unoptimized enchants on offhand shield", "Farming speed can be increased");

                            return { strengths: strengths.slice(0, 3), weaknesses: weaknesses.slice(0, 3) };
                          };
                          const diag = getPlayerStrengthsAndWeaknesses(scores);
                          return (
                            <div className="space-y-4 text-xs">
                              {/* Strengths */}
                              <div className="space-y-2">
                                <span className="text-[9px] uppercase tracking-widest text-[#5ecb7a] font-black block">✓ Key Strengths</span>
                                <ul className="space-y-1.5 font-semibold text-white/70">
                                  {diag.strengths.map((str, idx) => (
                                    <li key={idx} className="flex items-center gap-2">
                                      <span className="text-[#5ecb7a] text-xs">✦</span>
                                      <span>{str}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              {/* Weaknesses */}
                              <div className="space-y-2 border-t border-white/[0.02] pt-3.5">
                                <span className="text-[9px] uppercase tracking-widest text-amber-500 font-black block">⚠ Optimization Areas</span>
                                <ul className="space-y-1.5 font-semibold text-white/50">
                                  {diag.weaknesses.map((weak, idx) => (
                                    <li key={idx} className="flex items-center gap-2">
                                      <span className="text-amber-500 text-xs">✦</span>
                                      <span>{weak}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Tactical Insights */}
                    <div className="space-y-4">
                      <SectionLabel>Tactical Insights</SectionLabel>
                      <div className="border border-white/[0.04] rounded-xl p-5 bg-[#070b13]/60 glass-panel space-y-3">
                        {getPlayerInsights(scores, player).map((insight, idx) => (
                          <div key={idx} className="flex gap-2 text-xs leading-relaxed text-white/50 font-medium">
                            <span className="text-amber-400 select-none shrink-0 font-bold">✦</span>
                            <span>{insight}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Combat Breakdown Section */}
                <PowerBreakdownSection player={player} computedStats={computedStats} />
              </div>
            )}

            {activeTab === "combat" && computedStats && (() => {
              // Calculate live values based on sliders
              const liveDmgStats = calculateDamageStats({
                ds: calcSwordDs,
                swordDamageMultiplier: calcShieldMs,
                power: calcPower,
                petPowerBonus: 0,
                armorPowerBonus: 0,
                attackSpeed: 2.77
              });

              const formatTime = (sec: number) => {
                if (sec === Infinity || isNaN(sec)) return "—";
                if (sec < 60) return `${sec.toFixed(1)}s`;
                const mins = Math.floor(sec / 60);
                const secs = Math.round(sec % 60);
                return `${mins}m ${secs}s`;
              };

              return (
                <div className="space-y-6">
                  <PowerBreakdownSection player={player} computedStats={computedStats} />

                  {/* Top Stats Display */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="border border-white/[0.04] rounded-xl p-5 bg-[#05050f]/60 glass-panel space-y-2">
                      <div className="text-[10px] text-amber-400 uppercase font-black tracking-wider">Calculated DPH</div>
                      <div className="text-3xl font-black font-mono text-white">{formatNumber(liveDmgStats.damagePerHit)}</div>
                      <div className="text-[10px] text-white/40">
                        Power Contribution: <span className="text-amber-500">+{formatNumber(2 * Math.sqrt(calcPower))}</span>
                      </div>
                    </div>

                    <div className="border border-white/[0.04] rounded-xl p-5 bg-[#05050f]/60 glass-panel space-y-2">
                      <div className="text-[10px] text-purple-400 uppercase font-black tracking-wider">Calculated DPS</div>
                      <div className="text-3xl font-black font-mono text-white">{formatNumber(liveDmgStats.damagePerSecond)}</div>
                      <div className="text-[10px] text-white/40">
                        Attack Speed: <span className="text-purple-400">{(2.77 * (1 + calcSpeedBoost / 100)).toFixed(2)} hits/sec</span>
                      </div>
                    </div>
                  </div>

                  {/* Calculator Sliders Panel */}
                  <div className="border border-white/[0.04] rounded-xl p-5 bg-[#05050f]/60 glass-panel space-y-5">
                    <SectionLabel>Interactive Damage Calculator</SectionLabel>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left Sliders: Power & DS */}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60">Power Stat</span>
                            <span className="font-mono text-amber-400">{formatNumber(calcPower)}</span>
                          </div>
                          <input 
                            type="range"
                            min="0"
                            max={Math.max(data.player.powerRaw * 3, 1000000).toString()}
                            step={Math.max(Math.round(data.player.powerRaw * 3 / 100), 1000).toString()}
                            value={calcPower}
                            onChange={(e) => setCalcPower(Number(e.target.value))}
                            className="w-full accent-amber-500 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-[9px] text-white/20">
                            <span>0</span>
                            <span>{formatNumber(data.player.powerRaw * 3)} (3x Current)</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60">Weapon Damage (DS)</span>
                            <span className="font-mono text-amber-400">{formatNumber(calcSwordDs)}</span>
                          </div>
                          <input 
                            type="range"
                            min="0"
                            max={Math.max(computedStats.ds * 3, 1000000).toString()}
                            step={Math.max(Math.round(computedStats.ds * 3 / 100), 1000).toString()}
                            value={calcSwordDs}
                            onChange={(e) => setCalcSwordDs(Number(e.target.value))}
                            className="w-full accent-amber-500 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-[9px] text-white/20">
                            <span>0</span>
                            <span>{formatNumber(computedStats.ds * 3)} (3x Current)</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Sliders: MS & Speed */}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60">Shield Damage Multiplier (MS)</span>
                            <span className="font-mono text-amber-400">{(calcShieldMs * 100).toFixed(0)}%</span>
                          </div>
                          <input 
                            type="range"
                            min="0"
                            max="50"
                            step="0.1"
                            value={calcShieldMs}
                            onChange={(e) => setCalcShieldMs(Number(e.target.value))}
                            className="w-full accent-amber-500 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-[9px] text-white/20">
                            <span>0%</span>
                            <span>5000%</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60">Pet Speed Boost</span>
                            <span className="font-mono text-purple-400">+{calcSpeedBoost}%</span>
                          </div>
                          <input 
                            type="range"
                            min="0"
                            max="300"
                            step="5"
                            value={calcSpeedBoost}
                            onChange={(e) => setCalcSpeedBoost(Number(e.target.value))}
                            className="w-full accent-purple-500 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-[9px] text-white/20">
                            <span>0%</span>
                            <span>+300%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Group Damage & Raid Boss Calculator Panel */}
                  <div className="border border-white/[0.04] rounded-xl p-5 bg-[#05050f]/60 glass-panel space-y-4">
                    <SectionLabel>Group Damage & Raid Boss Calculator</SectionLabel>
                    
                    <div className="text-xs text-white/50 leading-relaxed font-semibold">
                      Configure individual player stats manually to calculate individual contributions, sum combined group damage (DPH) and DPS, and simulate raid boss battle times.
                    </div>
                    
                    <div className="space-y-4">
                      {/* Player List */}
                      <div className="space-y-3">
                        {partyPlayers.map((p, index) => {
                          const pSword = getSwordData(p.sword);
                          const pShield = getShieldData(p.shield);
                          const pDS = pSword ? scaledSwordDamage(pSword.baseDamage, p.swordLevel) * 1e9 : 0;
                          const pMS = pShield ? scaledShieldDM(pShield.baseDM, p.shieldLevel) : 0;
                          const pDmgStats = calculateDamageStats({
                            ds: pDS,
                            swordDamageMultiplier: pMS,
                            power: p.powerRaw,
                            petPowerBonus: 0,
                            armorPowerBonus: 0,
                            attackSpeed: 2.77
                          });
                          const pDps = pDmgStats.damagePerSecond;
                          
                          // Store computed stats for total summation
                          (p as any).computedDps = pDps;
                          (p as any).computedDph = pDmgStats.damagePerHit;
                          
                          return (
                            <div key={p.id} className="grid grid-cols-1 lg:grid-cols-12 gap-3 p-4 border border-white/5 rounded-xl bg-black/20 items-center relative">
                              {/* Mobile friendly cross icon to delete */}
                              <button 
                                onClick={() => removePlayer(p.id)}
                                className="absolute top-2 right-2 text-white/20 hover:text-red-400 p-1 transition-colors text-xs border border-white/10 hover:border-red-500/30 rounded-md bg-white/5 w-6 h-6 flex items-center justify-center cursor-pointer"
                                title="Remove Player"
                              >
                                ✕
                              </button>
                              
                              {/* Nickname / Member Index */}
                              <div className="lg:col-span-2">
                                <label className="text-[9px] uppercase tracking-wider font-bold text-white/40 block mb-1">Nickname</label>
                                <input 
                                  type="text"
                                  value={p.nickname}
                                  onChange={(e) => updatePlayer(p.id, { nickname: e.target.value })}
                                  className="w-full bg-[#070b13] border border-white/5 focus:border-amber-500/30 text-white rounded-lg px-2.5 py-2 text-xs font-semibold outline-none"
                                  placeholder={`Player ${index + 1}`}
                                />
                              </div>
                              
                              {/* Sword Selector */}
                              <div className="lg:col-span-3 grid grid-cols-4 gap-1.5">
                                <div className="col-span-3">
                                  <label className="text-[9px] uppercase tracking-wider font-bold text-white/40 block mb-1">Sword</label>
                                  <select
                                    value={p.sword}
                                    onChange={(e) => updatePlayer(p.id, { sword: e.target.value })}
                                    className="w-full bg-[#070b13] border border-white/5 text-white/80 rounded-lg px-2 py-2 text-xs outline-none cursor-pointer font-semibold focus:border-amber-500/30"
                                  >
                                    {SWORDS.map((s) => (
                                      <option key={s.name} value={s.name}>{s.name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="col-span-1">
                                  <label className="text-[9px] uppercase tracking-wider font-bold text-white/40 block mb-1">Lvl</label>
                                  <select
                                    value={p.swordLevel}
                                    onChange={(e) => updatePlayer(p.id, { swordLevel: parseInt(e.target.value) })}
                                    className="w-full bg-[#070b13] border border-white/5 text-white/80 rounded-lg px-1.5 py-2 text-xs outline-none cursor-pointer font-semibold focus:border-amber-500/30"
                                  >
                                    {Array.from({ length: 10 }, (_, i) => i + 1).map((lvl) => (
                                      <option key={lvl} value={lvl}>Lv{lvl}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              
                              {/* Shield Selector */}
                              <div className="lg:col-span-3 grid grid-cols-4 gap-1.5">
                                <div className="col-span-3">
                                  <label className="text-[9px] uppercase tracking-wider font-bold text-white/40 block mb-1">Shield</label>
                                  <select
                                    value={p.shield}
                                    onChange={(e) => updatePlayer(p.id, { shield: e.target.value })}
                                    className="w-full bg-[#070b13] border border-white/5 text-white/80 rounded-lg px-2 py-2 text-xs outline-none cursor-pointer font-semibold focus:border-amber-500/30"
                                  >
                                    {SHIELDS.map((s) => (
                                      <option key={s.name} value={s.name}>{s.name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="col-span-1">
                                  <label className="text-[9px] uppercase tracking-wider font-bold text-white/40 block mb-1">Lvl</label>
                                  <select
                                    value={p.shieldLevel}
                                    onChange={(e) => updatePlayer(p.id, { shieldLevel: parseInt(e.target.value) })}
                                    className="w-full bg-[#070b13] border border-white/5 text-white/80 rounded-lg px-1.5 py-2 text-xs outline-none cursor-pointer font-semibold focus:border-amber-500/30"
                                  >
                                    {Array.from({ length: 10 }, (_, i) => i + 1).map((lvl) => (
                                      <option key={lvl} value={lvl}>Lv{lvl}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              
                              {/* Power Input */}
                              <div className="lg:col-span-2">
                                <label className="text-[9px] uppercase tracking-wider font-bold text-white/40 block mb-1">Power Stat</label>
                                <input 
                                  type="text"
                                  value={p.powerInput}
                                  onChange={(e) => updatePlayer(p.id, { powerInput: e.target.value, powerRaw: parseNumber(e.target.value) })}
                                  className="w-full bg-[#070b13] border border-white/5 focus:border-amber-500/30 text-white rounded-lg px-2.5 py-2 text-xs font-mono outline-none"
                                />
                              </div>
                              
                              {/* Calculated stats: DPH, PPH, DPS */}
                              <div className="lg:col-span-2 flex flex-col justify-center space-y-1 pl-2 pt-2 lg:pt-0">
                                <div className="flex justify-between text-[10px] text-white/50">
                                  <span>DPH:</span>
                                  <span className="font-mono font-bold text-amber-500">{formatNumber(pDmgStats.damagePerHit)}</span>
                                </div>
                                <div className="flex justify-between text-[10px] text-white/50">
                                  <span>PPH:</span>
                                  <span className="font-mono font-bold text-purple-400">{formatNumber(pDmgStats.powerPerHit)}</span>
                                </div>
                                <div className="flex justify-between text-[10px] text-white/50">
                                  <span>DPS:</span>
                                  <span className="font-mono font-bold text-emerald-400">{formatNumber(pDps)}</span>
                                </div>
                                <div className="text-[9px] text-white/40 flex justify-between">
                                  <span>Contrib:</span>
                                  <span className="text-amber-400 font-bold font-mono">
                                    {((p as any).computedDps / (partyPlayers.reduce((acc, pl) => acc + (pl as any).computedDps || 0, 0) || 1) * 100).toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Add Player button */}
                      <button 
                        onClick={addPlayer}
                        className="flex items-center gap-2 border border-dashed border-white/20 hover:border-amber-500/50 hover:bg-amber-500/5 text-white/60 hover:text-white px-4 py-3 rounded-xl transition-all duration-200 justify-center w-full text-xs font-bold font-display cursor-pointer"
                      >
                        <span>＋</span> Add Player
                      </button>
                      
                      {/* Simulation Results (boss kill time using combined party DPS) */}
                      {(() => {
                        const totalPartyDps = partyPlayers.reduce((acc, p) => acc + ((p as any).computedDps || 0), 0);
                        const totalPartyDamage = partyPlayers.reduce((acc, p) => acc + ((p as any).computedDph || 0), 0);
                        const partyEstSeconds = calcBossHp / (totalPartyDps || 1);
                        
                        return (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-6 border-t border-white/5 pt-4">
                            <div className="bg-black/30 border border-white/5 rounded-xl p-4 flex flex-col justify-center space-y-1">
                              <div className="text-[9px] text-white/40 uppercase font-black font-mono">Total Party Members</div>
                              <div className="text-lg font-black font-mono text-white">{partyPlayers.length} Players</div>
                            </div>
                            
                            <div className="bg-black/30 border border-white/5 rounded-xl p-4 flex flex-col justify-center space-y-1.5">
                              <div className="text-[9px] text-white/40 uppercase font-black font-mono">Total Group Damage (DPH)</div>
                              <div className="text-lg font-black font-mono text-amber-500">{formatNumber(totalPartyDamage)}</div>
                            </div>
                            
                            <div className="bg-black/30 border border-white/5 rounded-xl p-4 flex flex-col justify-center space-y-1.5">
                              <div className="text-[9px] text-white/40 uppercase font-black font-mono">Total Group DPS</div>
                              <div className="text-lg font-black font-mono text-emerald-400">{formatNumber(totalPartyDps)}</div>
                            </div>
                            
                            <div className="bg-black/30 border border-white/5 rounded-xl p-4 flex flex-col justify-center space-y-1.5">
                              <div className="text-[9px] text-white/40 uppercase font-black font-mono">Raid Boss HP Target</div>
                              <select 
                                value={calcBossHp}
                                onChange={(e) => setCalcBossHp(Number(e.target.value))}
                                className="bg-[#03050b]/80 border border-white/10 rounded-lg p-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                              >
                                <option value={100e9}>100B HP</option>
                                <option value={1e12}>1T HP</option>
                                <option value={10e12}>10T HP</option>
                                <option value={100e12}>100T HP</option>
                                <option value={500e12}>500T HP (World 11 Boss)</option>
                              </select>
                            </div>
                            
                            <div className="bg-black/30 border border-white/5 rounded-xl p-4 flex flex-col justify-center space-y-1.5">
                              <div className="text-[9px] text-white/40 uppercase font-black font-mono">Estimated Boss Kill Time</div>
                              <div className="text-lg font-black font-mono text-amber-400">{formatTime(partyEstSeconds)}</div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Math Formula Card */}
                  <div className="border border-white/[0.04] rounded-xl p-5 bg-[#05050f]/60 glass-panel space-y-3">
                    <SectionLabel>Standard Combat Formula Guides</SectionLabel>
                    <div className="space-y-3 text-xs leading-relaxed font-semibold">
                      <p>
                        DPH (Damage Per Hit) is the foundation of SwordMasters combat. It scales heavily with Weapon Damage (DS) and the square root of your Power stat.
                      </p>
                      <div className="p-3 bg-black/40 border border-white/5 rounded-lg font-mono text-[11px] text-amber-400 space-y-1">
                        <div>DPH = (DS + 2 * sqrt(Power) + 1) * (1 + MS)</div>
                        <div>DPS = DPH * AttackSpeed</div>
                        <div>PPH = DPH * (1 + PetPowerBonus + ArmorPowerBonus)</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {activeTab === "upgrades" && computedStats && (
              <div className="space-y-6">
                <div className="border border-white/[0.04] rounded-xl overflow-hidden glass-panel text-white">
                  <div className="px-5 py-4 border-b border-white/[0.04] bg-white/[0.01] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 font-black text-xs tracking-widest uppercase font-display">Progression Upgrade Advisor</span>
                    </div>
                  </div>
                  
                  <div className="p-5 space-y-4">
                    {scores.upgradeAdvice.powerShortageMessage ? (
                      <div className="text-center py-6 px-4 border border-[#f59e0b]/15 rounded-lg bg-[#f59e0b]/5 text-[#ffd700] font-black font-mono text-xs uppercase tracking-widest">
                        ⚠️ {scores.upgradeAdvice.powerShortageMessage}
                      </div>
                    ) : (
                      scores.upgradeAdvice.recommendations && scores.upgradeAdvice.recommendations.length > 0 ? (
                        scores.upgradeAdvice.recommendations.map((rec, index) => {
                          const rankLabels = ["#1 Best Combat Upgrade", "#2 Second Best Upgrade", "#3 Third Best Upgrade"];
                          const label = rankLabels[index] || `Upgrade #${index + 1}`;
                          
                          return (
                            <div key={index} className="rounded-lg p-4 border border-white/[0.04] bg-white/[0.01] space-y-2">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="text-[8px] uppercase tracking-widest text-amber-400 font-black">{label}</div>
                                  <div className="text-white font-extrabold text-sm mt-0.5">{rec.name} {rec.level > 0 ? `Lv${rec.level}` : ""}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[8px] uppercase tracking-widest text-white/30 font-black">Combat Boost</div>
                                  <div className="text-amber-400 font-bold text-xs">+{rec.damageGainPct}%</div>
                                </div>
                              </div>
                              <p className="text-white/50 text-xs leading-relaxed">
                                {rec.reason}
                              </p>
                              <div className="flex justify-between border-t border-white/[0.03] pt-2 text-[10px] font-bold">
                                <span className="text-white/35">Market Price: <span className="text-white">{rec.marketPriceNote || "Unknown"}</span></span>
                                <span className="text-[#5ecb7a]">
                                  ✓ Affordable Now
                                </span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-xs font-semibold text-white/40 text-center py-4 border border-white/[0.03] rounded-lg bg-white/[0.01]">
                          No upgrade currently recommended.
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Late Game Goals Section */}
                {scores.upgradeAdvice.lateGameGoals && scores.upgradeAdvice.lateGameGoals.length > 0 && (
                  <div className="border border-white/[0.04] rounded-xl overflow-hidden glass-panel text-white">
                    <div className="px-5 py-4 border-b border-white/[0.04] bg-white/[0.01]">
                      <span className="text-amber-400 font-black text-xs tracking-widest uppercase font-display">Late Game Goals</span>
                    </div>
                    
                    <div className="p-5 space-y-4">
                      {scores.upgradeAdvice.lateGameGoals.map((rec, index) => {
                        return (
                          <div key={index} className="rounded-lg p-4 border border-white/[0.04] bg-white/[0.01] opacity-75 space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="text-[8px] uppercase tracking-widest text-white/40 font-black">Future Target</div>
                                <div className="text-white font-extrabold text-sm mt-0.5">{rec.name} {rec.level > 0 ? `Lv${rec.level}` : ""}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-[8px] uppercase tracking-widest text-white/30 font-black">Combat Boost</div>
                                <div className="text-amber-500 font-bold text-xs">+{rec.damageGainPct}%</div>
                              </div>
                            </div>
                            <p className="text-white/40 text-xs leading-relaxed">
                              {rec.reason}
                            </p>
                            <div className="flex justify-between border-t border-white/[0.03] pt-2 text-[10px] font-bold">
                              <span className="text-white/35">Market Price: <span className="text-white">{rec.marketPriceNote || "Unknown"}</span></span>
                              <span className="text-red-400 font-semibold">{rec.status}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "benchmarks" && (
              <div className="space-y-6">
                {(() => {
                  const bmark = getInterpolatedBenchmark(player.level);
                  const powerRatio = bmark.avgPower > 0 ? (player.powerRaw / bmark.avgPower) * 100 : 100;
                  const goldRatio = bmark.avgGold > 0 ? (player.goldRaw / bmark.avgGold) * 100 : 100;
                  
                  return (
                    <div className="space-y-6">
                      <div className="border border-white/[0.04] rounded-xl p-5 bg-[#05050f]/60 glass-panel space-y-4">
                        <SectionLabel>Benchmark Peer Comparison</SectionLabel>
                        <div className="space-y-4 text-xs font-semibold">
                          <div className="flex justify-between items-center border-b border-white/[0.02] pb-3.5">
                            <div>
                              <span className="text-white block">Power benchmark</span>
                              <span className="text-[10px] text-white/35">Target: {formatNumber(bmark.avgPower)}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-mono block text-amber-400">{player.power}</span>
                              <span className={`text-[10px] font-bold ${powerRatio >= 100 ? "text-[#5ecb7a]" : "text-red-400"}`}>
                                {powerRatio >= 100 ? `+${Math.round(powerRatio - 100)}% ahead` : `${Math.round(100 - powerRatio)}% behind`}
                              </span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center border-b border-white/[0.02] pb-3.5">
                            <div>
                              <span className="text-white block">Gold benchmark</span>
                              <span className="text-[10px] text-white/35">Target: {formatNumber(bmark.avgGold)}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-mono block text-amber-400">{player.gold}</span>
                              <span className={`text-[10px] font-bold ${goldRatio >= 100 ? "text-[#5ecb7a]" : "text-red-400"}`}>
                                {goldRatio >= 100 ? `+${Math.round(goldRatio - 100)}% ahead` : `${Math.round(100 - goldRatio)}% behind`}
                              </span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center">
                            <div>
                              <span className="text-white block">Progression Percentile</span>
                              <span className="text-[10px] text-white/35">Estimated standing</span>
                            </div>
                            <div className="text-right">
                              <span className="text-white font-bold block">{percentile.label}</span>
                              <span className="text-[10px] text-amber-400 font-bold">{scores.standing} rating</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}


            {activeTab === "simulator" && (
              <div className="space-y-6">
                <Simulator currentPlayer={player} currentScores={scores} />
              </div>
            )}

            {activeTab === "coach" && (
              <div className="space-y-6">
                {explainMutation.isPending && (
                  <div className="rounded-xl p-5 border border-white/[0.04] glass-panel flex flex-col items-center justify-center gap-3 py-10">
                    <div className="w-5 h-5 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
                    <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest font-mono">AI Coach is analyzing...</span>
                  </div>
                )}

                {explainMutation.isError && (
                  <div className="rounded-xl p-5 border border-red-500/20 bg-red-500/5 text-xs text-red-400 space-y-2">
                    <div className="font-bold uppercase tracking-wider text-[10px] text-red-400">AI Coach Analysis Failed</div>
                    <p className="text-white/60 leading-relaxed font-medium">
                      {(explainMutation.error as any)?.message || "An unknown error occurred while contacting the AI Coach."}
                    </p>
                  </div>
                )}

                {explanation && (
                  <div className="rounded-xl p-5 border border-white/[0.04] glass-panel space-y-4">
                    <SectionLabel>Analysis Dossier</SectionLabel>
                    <p className="text-white/70 text-xs leading-relaxed font-semibold">{explanation.summary}</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/[0.01] p-3 rounded-lg border border-[#5ecb7a]/5 text-xs">
                        <div className="text-[#5ecb7a] font-black uppercase text-[8px] mb-2">Strengths</div>
                        <ul className="space-y-1 text-white/40">
                          {explanation.strengths.map((s: string, i: number) => (
                            <li key={i}>+ {s}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-white/[0.01] p-3 rounded-lg border border-red-500/5 text-xs">
                        <div className="text-red-400 font-black uppercase text-[8px] mb-2">Weaknesses</div>
                        <ul className="space-y-1 text-white/40">
                          {explanation.weaknesses.map((w: string, i: number) => (
                            <li key={i}>− {w}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
                
                <CoachChat playerContext={JSON.stringify(player)} explanation={explanation} />
              </div>
            )}
          </div>

      </main>

      <footer className="border-t border-white/[0.03] bg-[#070b13]/60 px-6 py-5 text-center text-white/20 text-[9px] font-bold uppercase tracking-widest z-10">
        Companion App — built for SwordMasters
      </footer>

    </div>
  );
}

function NetWorthPanel({ player }: { player: any }) {
  const [loading, setLoading] = useState(true);
  const [netWorth, setNetWorth] = useState<NetWorthResult | null>(null);

  useEffect(() => {
    ensurePricesLoaded().then(() => {
      const nw = calculateNetWorth(player);
      setNetWorth(nw);
      setLoading(false);
    });
  }, [player]);

  if (loading || !netWorth) {
    return (
      <div className="rounded-xl border border-white/[0.04] bg-[#05050f]/60 backdrop-blur-lg p-8 text-center space-y-4">
        <div className="animate-spin inline-block w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full" />
        <p className="text-xs text-white/40 uppercase font-black tracking-widest">Evaluating account value from market logs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="rounded-xl border border-white/[0.04] bg-[#05050f]/60 backdrop-blur-lg p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 text-[100px] text-white/[0.01] select-none font-bold pointer-events-none">
          $
        </div>
        <SectionLabel>Account Value & Net Worth</SectionLabel>
        <p className="text-white/40 text-xs mb-6 max-w-xl">
          We cross-referenced your equipped gear and vault storage against the public SwordMasters market trading logs (11.5M+ public trades analyzed).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/[0.01] border border-white/[0.03] p-4 rounded-lg space-y-1">
            <span className="text-[10px] text-white/30 uppercase font-bold tracking-widest block">Equipped Value</span>
            <span className="text-2xl font-black text-white font-mono">{netWorth.equippedFormatted} <span className="text-xs text-[#ffd700]">Gold</span></span>
          </div>

          <div className="bg-white/[0.01] border border-white/[0.03] p-4 rounded-lg space-y-1">
            <span className="text-[10px] text-white/30 uppercase font-bold tracking-widest block">Storage Value</span>
            <span className="text-2xl font-black text-white font-mono">{netWorth.storageFormatted} <span className="text-xs text-[#ffd700]">Gold</span></span>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-lg space-y-1">
            <span className="text-[10px] text-amber-400 uppercase font-bold tracking-widest block">Total Net Worth</span>
            <span className="text-2xl font-black text-[#ffd700] font-mono">{netWorth.totalFormatted} <span className="text-xs text-amber-400">Gold</span></span>
          </div>
        </div>
      </div>

      {/* Valuation Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Equipped Breakdown */}
        <div className="rounded-xl border border-white/[0.04] bg-[#05050f]/60 backdrop-blur-lg p-5 space-y-4">
          <SectionLabel>Equipped Items Worth</SectionLabel>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {player.sword && player.sword !== "None" && !player.sword.includes("Unknown") && (
              <ValuationRow name={player.sword} level={player.swordLevel} type="sword" />
            )}
            {player.shield && player.shield !== "None" && !player.shield.includes("Unknown") && (
              <ValuationRow name={player.shield} level={player.shieldLevel} type="shield" />
            )}
            {player.activePets && player.activePets.map((pet: any, idx: number) => {
              const item = resolveItemByGameType(pet.type, "pet");
              return item && !item.name.includes("Unknown") ? (
                <ValuationRow key={idx} name={item.name} level={1} type="pet" />
              ) : null;
            })}
          </div>
        </div>

        {/* Storage Breakdown */}
        <div className="rounded-xl border border-white/[0.04] bg-[#05050f]/60 backdrop-blur-lg p-5 space-y-4">
          <SectionLabel>Storage Items Worth</SectionLabel>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {(() => {
              const storage = player.rawPayload?.inv?.storage || {};
              const elements: React.ReactNode[] = [];
              
              if (Array.isArray(storage.swords)) {
                storage.swords.forEach((sw: any, idx: number) => {
                  const item = resolveItemByGameType(sw.type, "sword");
                  if (item && !item.name.includes("Unknown")) {
                    elements.push(<ValuationRow key={`sw-${idx}`} name={item.name} level={sw.level || 1} type="sword" />);
                  }
                });
              }

              if (Array.isArray(storage.shields)) {
                storage.shields.forEach((sh: any, idx: number) => {
                  const item = resolveItemByGameType(sh.type, "shield");
                  if (item && !item.name.includes("Unknown")) {
                    elements.push(<ValuationRow key={`sh-${idx}`} name={item.name} level={sh.level || 1} type="shield" />);
                  }
                });
              }

              if (Array.isArray(storage.pets)) {
                storage.pets.forEach((p: any, idx: number) => {
                  const item = resolveItemByGameType(p.type, "pet");
                  if (item && !item.name.includes("Unknown")) {
                    elements.push(<ValuationRow key={`p-${idx}`} name={item.name} level={1} type="pet" />);
                  }
                });
              }

              if (elements.length === 0) {
                return <p className="text-xs text-white/30 italic text-center py-6">Vault storage is empty or offline.</p>;
              }

              return elements;
            })()}
          </div>
        </div>
      </div>
      
      <div className="text-center text-[10px] text-white/20 font-bold uppercase tracking-widest">
        Estimates derived from 11,510,140 analyzed trades.
      </div>
    </div>
  );
}

function ValuationRow({ name, level, type }: { name: string; level: number; type: "sword" | "shield" | "pet" }) {
  const price = lookupItemPrice(type, name, level);
  const formatted = formatNumber(price);
  
  return (
    <div className="flex items-center justify-between p-3 rounded bg-white/[0.01] border border-white/[0.02] hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-base select-none">{type === "sword" ? "🗡️" : type === "shield" ? "🛡️" : "🐾"}</span>
        <div>
          <p className="text-xs text-white font-bold">{name}</p>
          <p className="text-[10px] text-white/30 font-semibold uppercase">Category: {type} {type !== "pet" && `· Lv ${level}`}</p>
        </div>
      </div>
      <span className="text-xs text-amber-400 font-mono font-bold">{formatted} <span className="text-[10px] text-white/40">Gold</span></span>
    </div>
  );
}

function PowerBreakdownSection({ player, computedStats }: { player: ParsedPlayer; computedStats?: any }) {
  const [isOpen, setIsOpen] = useState(true);

  const p = player.powerRaw || 0;
  const swordItem = getSwordData(player.sword);
  const shieldItem = getShieldData(player.shield);
  const ds = computedStats?.ds ?? (swordItem ? scaledSwordDamage(swordItem.baseDamage, player.swordLevel || 1) : 0);
  const ms = computedStats?.ms ?? (shieldItem ? scaledShieldDM(shieldItem.baseDM, player.shieldLevel || 1) : 0);
  const mp = computedStats?.powerMulti ?? 0;
  const ap = 0;
  const attackSpeed = 2.77;

  // Exact combat formulas
  const powerContribution = 2 * Math.sqrt(p) + 1;
  const combinedBaseDamage = ds + powerContribution;
  const damagePerHit = combinedBaseDamage * (1 + ms);
  const finalDps = damagePerHit * attackSpeed;
  const powerPerHit = damagePerHit * (1 + mp + ap);
  const powerPerSec = powerPerHit * attackSpeed;

  // Combat Insight text
  const getCombatInsightText = () => {
    const shieldDamageGainFromSword = 10 * (1 + ms);
    const shieldDamageGainFromShield = combinedBaseDamage * 0.15;

    if (shieldDamageGainFromShield > shieldDamageGainFromSword && ms > 0.5) {
      return "Your shield currently contributes the largest increase to your combat damage.";
    }
    if ((damagePerHit - combinedBaseDamage) > combinedBaseDamage || ms >= 1.5) {
      return "Most of your combat strength currently comes from your shield multiplier.";
    }
    if (ms >= 1.0) {
      return "Your shield multiplier is currently multiplying your base damage significantly.";
    }
    if (ds > 0 && powerContribution > ds * 1.5) {
      return "Your Power stat currently provides more base damage than your weapon damage.";
    }
    return "Your combat power currently maintains a balanced ratio between base damage and shield multiplication.";
  };

  const insightText = getCombatInsightText();

  return (
    <div className="border border-white/[0.04] rounded-2xl bg-[#070b13]/80 glass-panel overflow-hidden transition-all">
      {/* Collapsible Header */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex justify-between items-center border-b border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.02] transition-colors cursor-pointer text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-amber-400 font-black text-sm uppercase tracking-widest font-display">⚔ Combat Breakdown</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] text-white/30 font-mono uppercase hidden sm:inline font-semibold">Damage Mechanics</span>
          <span className="text-white/40 text-xs">{isOpen ? "▲" : "▼"}</span>
        </div>
      </button>

      {isOpen && (
        <div className="p-6 space-y-6">
          {/* Top Summary Cards (4 Cards Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-black/40 border border-white/[0.03] p-4 rounded-xl space-y-1">
              <span className="text-[9px] uppercase font-bold tracking-wider text-white/40 block">Final Damage / Hit</span>
              <span className="text-xl font-black font-mono text-amber-400">{formatNumber(damagePerHit)}</span>
            </div>

            <div className="bg-black/40 border border-white/[0.03] p-4 rounded-xl space-y-1">
              <span className="text-[9px] uppercase font-bold tracking-wider text-white/40 block">Final DPS</span>
              <span className="text-xl font-black font-mono text-purple-400">{formatNumber(finalDps)}</span>
            </div>

            <div className="bg-black/40 border border-white/[0.03] p-4 rounded-xl space-y-1">
              <span className="text-[9px] uppercase font-bold tracking-wider text-white/40 block">Power / Hit</span>
              <span className="text-xl font-black font-mono text-emerald-400">{formatNumber(powerPerHit)}</span>
            </div>

            <div className="bg-black/40 border border-white/[0.03] p-4 rounded-xl space-y-1">
              <span className="text-[9px] uppercase font-bold tracking-wider text-white/40 block">Power / Second</span>
              <span className="text-xl font-black font-mono text-cyan-400">{formatNumber(powerPerSec)}</span>
            </div>
          </div>

          {/* Section 1: Base Damage Calculation */}
          <div className="space-y-3 bg-white/[0.01] border border-white/[0.03] p-5 rounded-xl">
            <h4 className="text-xs uppercase font-black tracking-widest text-amber-400 font-display">Base Damage Calculation</h4>

            <div className="space-y-2 text-xs font-semibold">
              <div className="flex justify-between items-center py-1.5 border-b border-white/[0.03]">
                <span className="text-white/70">Weapon Damage (DS)</span>
                <span className="font-mono text-white font-bold">{formatNumber(ds)}</span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-white/[0.03]">
                <span className="text-white/70">Power Contribution (2√Power + 1)</span>
                <span className="font-mono text-white font-bold">+{formatNumber(powerContribution)}</span>
              </div>

              <div className="flex justify-between items-center py-1.5 font-bold text-amber-400">
                <span>Combined Base Damage</span>
                <span className="font-mono text-amber-400">{formatNumber(combinedBaseDamage)}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Multipliers & Rates */}
          <div className="space-y-3 bg-white/[0.01] border border-white/[0.03] p-5 rounded-xl">
            <h4 className="text-xs uppercase font-black tracking-widest text-amber-400 font-display">Multipliers & Rates</h4>

            <div className="space-y-2 text-xs font-semibold">
              <div className="flex justify-between items-center py-1.5 border-b border-white/[0.03]">
                <span className="text-white/70">Shield Damage Multiplier</span>
                <span className="font-mono text-white font-bold">× {(1 + ms).toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-white/[0.03]">
                <span className="text-white/70">Attack Speed</span>
                <span className="font-mono text-white font-bold">{attackSpeed} / sec</span>
              </div>

              <div className="flex justify-between items-center py-1.5 font-bold text-amber-400">
                <span>Final Damage / Hit</span>
                <span className="font-mono text-amber-400">{formatNumber(damagePerHit)}</span>
              </div>
            </div>
          </div>

          {/* Bottom Combat Insight Card */}
          <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex items-center gap-3">
            <span className="text-amber-400 text-lg shrink-0">💡</span>
            <div>
              <span className="text-[9px] uppercase font-black text-amber-400 tracking-wider block font-mono">Combat Insight</span>
              <p className="text-xs text-white/90 font-semibold leading-relaxed mt-0.5">{insightText}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


