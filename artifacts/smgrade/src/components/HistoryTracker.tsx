import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { formatNumber } from "@/lib/numberParser";

interface HistoryEntry {
  timestamp: string;
  level: number;
  power: number;
  gold: number;
  grade: string;
  score: number;
  tier: string;
  equippedSword: string;
  equippedShield: string;
  gearScore: number;
}

interface HistoryTrackerProps {
  username: string;
}

const GRADE_COLOR: Record<string, string> = {
  "SS+": "#ff4500",
  "SS": "#ff8c00",
  "S+": "#ffd700",
  "S": "#ffd700",
  "A+": "#3b82f6",
  "A": "#3b82f6",
  "B+": "#a855f7",
  "B": "#a855f7",
  "C+": "#888888",
  "C": "#888888",
  "D": "#e05a5a",
  "F": "#ef4444",
};

function getBezierPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const cp1x = curr.x + (next.x - curr.x) / 3;
    const cp1y = curr.y;
    const cp2x = curr.x + 2 * (next.x - curr.x) / 3;
    const cp2y = next.y;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
  }
  return d;
}

export default function HistoryTracker({ username }: HistoryTrackerProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [metric, setMetric] = useState<"power" | "level" | "gold" | "score">("power");
  const [timeFilter, setTimeFilter] = useState<"7d" | "30d" | "90d" | "all">("all");
  const [hoveredPoint, setHoveredPoint] = useState<{ index: number; x: number; y: number } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/master/arcade/player-history?username=${encodeURIComponent(username)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch historical snapshots.");
        return res.json();
      })
      .then((data: HistoryEntry[]) => {
        setHistory(data);
        setError("");
      })
      .catch((err) => {
        console.error(err);
        setError(err.message || "Failed to load player history.");
      })
      .finally(() => setLoading(false));
  }, [username]);

  const filteredHistory = useMemo(() => {
    const now = new Date();
    return history.filter((item) => {
      const itemDate = new Date(item.timestamp);
      const diffTime = Math.abs(now.getTime() - itemDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (timeFilter === "7d") return diffDays <= 7;
      if (timeFilter === "30d") return diffDays <= 30;
      if (timeFilter === "90d") return diffDays <= 90;
      return true;
    });
  }, [history, timeFilter]);

  const timelineCards = useMemo(() => {
    return filteredHistory
      .slice()
      .reverse()
      .map((entry, idx, arr) => {
        const prev = arr[idx + 1];
        const levelDiff = prev ? entry.level - prev.level : 0;
        const powerDiff = prev ? entry.power - prev.power : 0;
        const goldDiff = prev ? entry.gold - prev.gold : 0;

        let gradeChange = "same";
        if (prev) {
          const grades = ["F", "D", "C", "C+", "B", "B+", "A", "A+", "S", "S+", "SS", "SS+"];
          const prevIdx = grades.indexOf(prev.grade);
          const currIdx = grades.indexOf(entry.grade);
          if (currIdx > prevIdx) gradeChange = "improved";
          else if (currIdx < prevIdx) gradeChange = "declined";
        }

        return {
          entry,
          levelDiff,
          powerDiff,
          goldDiff,
          gradeChange,
        };
      });
  }, [filteredHistory]);

  const insightsList = useMemo(() => {
    if (history.length < 2) {
      return ["Perform stats calculations on different days to build a progression profile."];
    }
    const insights: string[] = [];
    const oldest = history[0];
    const newest = history[history.length - 1];

    const levelDiffTotal = newest.level - oldest.level;
    const powerDiffTotal = newest.power - oldest.power;
    const goldDiffTotal = newest.gold - oldest.gold;

    if (levelDiffTotal > 0) {
      insights.push(`Level rose by +${levelDiffTotal.toLocaleString()} overall.`);
    }
    if (powerDiffTotal > 0) {
      insights.push(`Power increased by +${formatNumber(powerDiffTotal)} (+${((powerDiffTotal / (oldest.power || 1)) * 100).toFixed(1)}% gain).`);
    }
    if (goldDiffTotal > 0) {
      insights.push(`Gold stash increased by +${formatNumber(goldDiffTotal)}.`);
    }

    const grades = ["F", "D", "C", "C+", "B", "B+", "A", "A+", "S", "S+", "SS", "SS+"];
    const oldestGradeIdx = grades.indexOf(oldest.grade);
    const newestGradeIdx = grades.indexOf(newest.grade);
    if (newestGradeIdx > oldestGradeIdx) {
      insights.push(`Overall grade upgraded from ${oldest.grade} to ${newest.grade}!`);
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weeklyEntries = history.filter((h) => new Date(h.timestamp) >= oneWeekAgo);
    if (weeklyEntries.length >= 2) {
      const wOldest = weeklyEntries[0];
      const wNewest = weeklyEntries[weeklyEntries.length - 1];
      const wPowerDiff = wNewest.power - wOldest.power;
      if (wPowerDiff > 0) {
        insights.push(`Fastest growth this week: +${formatNumber(wPowerDiff)} Power.`);
      }
    }

    return insights;
  }, [history]);

  // Graph math settings
  const paddingX = 50;
  const paddingY = 30;
  const width = 600;
  const height = 220;
  const chartWidth = width - 2 * paddingX;
  const chartHeight = height - 2 * paddingY;

  const getValue = (e: HistoryEntry) => {
    if (metric === "level") return e.level;
    if (metric === "power") return e.power;
    if (metric === "gold") return e.gold;
    return e.score;
  };

  const { chartPoints, minVal, maxVal, valRange, bezierPath, areaPath } = useMemo(() => {
    if (filteredHistory.length === 0) {
      return { chartPoints: [], minVal: 0, maxVal: 0, valRange: 1, bezierPath: "", areaPath: "" };
    }
    const vals = filteredHistory.map(getValue);
    const mx = Math.max(...vals, 1);
    const mn = Math.min(...vals, 0);
    const range = mx - mn || 1;

    const pts = filteredHistory.map((item, idx) => {
      const x = paddingX + (idx / Math.max(filteredHistory.length - 1, 1)) * chartWidth;
      const y = paddingY + chartHeight - ((getValue(item) - mn) / range) * chartHeight;
      return { x, y, entry: item };
    });

    const bezier = getBezierPath(pts);
    const area = pts.length > 0 
      ? `${bezier} L ${pts[pts.length - 1].x} ${height - paddingY} L ${pts[0].x} ${height - paddingY} Z`
      : "";

    return { chartPoints: pts, minVal: mn, maxVal: mx, valRange: range, bezierPath: bezier, areaPath: area };
  }, [filteredHistory, metric]);

  return (
    <div className="space-y-6">
      {/* Upper Segment: Insights & Spline Chart */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Growth Insights */}
        <div className="border border-white/[0.04] bg-[#070b13]/60 glass-panel rounded-2xl p-5 md:col-span-1 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div>
            <span className="text-[8px] text-amber-500 uppercase tracking-widest font-black font-display block mb-1">Growth Intelligence</span>
            <h4 className="text-sm font-black text-white tracking-tight mb-3">AI Progress Insights</h4>
            <div className="space-y-3">
              {insightsList.map((ins, idx) => (
                <div key={idx} className="flex items-start gap-2 text-[10px] leading-relaxed text-white/60 font-semibold">
                  <span className="text-amber-500 font-bold select-none">•</span>
                  <span>{ins}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/[0.02] text-[8px] font-mono text-white/20 uppercase tracking-wider">
            Computed {history.length} lookup milestones
          </div>
        </div>

        {/* Growth Graph */}
        <div className="border border-white/[0.04] bg-[#070b13]/60 glass-panel rounded-2xl p-5 md:col-span-2 shadow-[0_4px_20px_rgba(0,0,0,0.3)] space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            {/* Metric Buttons */}
            <div className="flex gap-1.5 p-1 bg-black/40 rounded-lg border border-white/5">
              {[
                { id: "power", label: "Power" },
                { id: "level", label: "Level" },
                { id: "gold", label: "Gold" },
                { id: "score", label: "Grade Score" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setMetric(opt.id as any);
                    setHoveredPoint(null);
                  }}
                  className={`px-2 py-1 text-[8.5px] font-black uppercase tracking-wider rounded transition-all cursor-pointer ${
                    metric === opt.id
                      ? "bg-amber-500/10 text-amber-400 font-black border border-amber-500/20"
                      : "text-white/40 hover:text-white border border-transparent"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Time Filter Buttons */}
            <div className="flex gap-1.5 p-1 bg-black/40 rounded-lg border border-white/5">
              {[
                { id: "7d", label: "7d" },
                { id: "30d", label: "30d" },
                { id: "90d", label: "90d" },
                { id: "all", label: "All" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setTimeFilter(opt.id as any);
                    setHoveredPoint(null);
                  }}
                  className={`px-1.5 py-1 text-[8px] font-black uppercase tracking-wider rounded transition-all cursor-pointer ${
                    timeFilter === opt.id
                      ? "bg-amber-500/10 text-amber-400 font-black border border-amber-500/20"
                      : "text-white/40 hover:text-white border border-transparent"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Spline Area Board */}
          <div className="relative h-[220px] bg-black/35 rounded-xl border border-white/[0.02] overflow-hidden">
            {chartPoints.length < 2 ? (
              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white/30 uppercase tracking-widest font-mono font-bold">
                Lookup more than once to draw visual charts
              </div>
            ) : (
              <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full select-none">
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                {[0.25, 0.5, 0.75, 1.0].map((ratio, i) => {
                  const y = paddingY + chartHeight * (1 - ratio);
                  return (
                    <line
                      key={i}
                      x1={paddingX}
                      y1={y}
                      x2={width - paddingX}
                      y2={y}
                      stroke="rgba(255,255,255,0.03)"
                      strokeWidth="1"
                    />
                  );
                })}

                {/* Fill Area */}
                <path d={areaPath} fill="url(#chartGradient)" />

                {/* Stroke curve line */}
                <path
                  d={bezierPath}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="drop-shadow-[0_2px_8px_rgba(245,158,11,0.45)]"
                />

                {/* Hotspot Circles */}
                {chartPoints.map((pt, idx) => (
                  <g key={idx}>
                    {hoveredPoint?.index === idx && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="8"
                        fill="rgba(245, 158, 11, 0.25)"
                        className="animate-ping"
                      />
                    )}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={hoveredPoint?.index === idx ? "5" : "3.5"}
                      fill={hoveredPoint?.index === idx ? "#ffffff" : "#f59e0b"}
                      stroke="#070b13"
                      strokeWidth="1.5"
                      className="cursor-pointer transition-all"
                      onMouseEnter={() => {
                        setHoveredPoint({ index: idx, x: pt.x, y: pt.y });
                      }}
                    />
                  </g>
                ))}
              </svg>
            )}

            {/* Hover Tooltip overlay container */}
            {hoveredPoint !== null && chartPoints[hoveredPoint.index] && (() => {
              const pt = chartPoints[hoveredPoint.index];
              const val = getValue(pt.entry);
              const formattedVal = metric === "score" ? `${val}%` : formatNumber(val);
              const formattedDate = new Date(pt.entry.timestamp).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  className="absolute z-30 pointer-events-none bg-black/95 border border-amber-500/30 p-2.5 rounded-lg text-left shadow-[0_4px_15px_rgba(0,0,0,0.6)] font-sans"
                  style={{
                    left: `${Math.min(Math.max((pt.x / width) * 100 - 10, 5), 75)}%`,
                    top: `${Math.max((pt.y / height) * 100 - 35, 5)}%`,
                  }}
                >
                  <div className="text-[8px] font-mono uppercase text-white/30">{formattedDate}</div>
                  <div className="text-[11px] font-black text-amber-400 font-mono mt-0.5 animate-pulse">
                    {metric.toUpperCase()}: <span className="text-white">{formattedVal}</span>
                  </div>
                  <div className="text-[8.5px] font-semibold text-white/50">
                    Grade: <span className="text-white font-bold">{pt.entry.grade}</span> ({pt.entry.tier})
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Timeline entries list */}
      <div className="space-y-4">
        <div className="text-[9px] uppercase tracking-widest text-white/30 font-black font-display">Historical Snapshots timeline</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {timelineCards.map((card, idx) => {
            const entryDate = new Date(card.entry.timestamp);
            const dateStr = entryDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
            const timeStr = entryDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

            return (
              <motion.div
                key={card.entry.timestamp}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25, delay: idx * 0.05 }}
                className="border border-white/[0.04] bg-[#070b13]/60 glass-panel rounded-xl p-4.5 shadow-[0_4px_15px_rgba(0,0,0,0.2)] flex flex-col justify-between space-y-3 hover:translate-y-[-2px] hover:border-amber-500/10 hover:shadow-[0_10px_20px_rgba(0,0,0,0.3)] transition-all duration-300"
              >
                <div className="flex items-start justify-between border-b border-white/[0.02] pb-2.5">
                  <div>
                    <span className="text-xs font-black text-white block">{dateStr}</span>
                    <span className="text-[8px] font-mono uppercase text-white/20 tracking-wider block mt-0.5">{timeStr}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] font-black uppercase text-amber-500/70 tracking-wider">{card.entry.tier}</span>
                    <span
                      className="px-1.5 py-0.5 rounded border text-[9px] font-black"
                      style={{
                        color: GRADE_COLOR[card.entry.grade] || "#ffd700",
                        borderColor: `${GRADE_COLOR[card.entry.grade] || "#ffd700"}22`,
                        backgroundColor: `${GRADE_COLOR[card.entry.grade] || "#ffd700"}05`,
                      }}
                    >
                      {card.entry.grade}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[9px] font-semibold text-white/40">
                    <span>Level</span>
                    <div className="text-right">
                      <span className="font-mono text-white">{card.entry.level.toLocaleString()}</span>
                      {card.levelDiff > 0 && (
                        <span className="text-[#5ecb7a] font-mono ml-1 font-bold">+{card.levelDiff}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between text-[9px] font-semibold text-white/40">
                    <span>Power</span>
                    <div className="text-right">
                      <span className="font-mono text-white">{formatNumber(card.entry.power)}</span>
                      {card.powerDiff > 0 && (
                        <span className="text-[#5ecb7a] font-mono ml-1 font-bold">+{formatNumber(card.powerDiff)}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between text-[9px] font-semibold text-white/40">
                    <span>Gold</span>
                    <div className="text-right">
                      <span className="font-mono text-white">{formatNumber(card.entry.gold)}</span>
                      {card.goldDiff > 0 && (
                        <span className="text-[#5ecb7a] font-mono ml-1 font-bold">+{formatNumber(card.goldDiff)}</span>
                      )}
                    </div>
                  </div>

                  {card.entry.equippedSword && (
                    <div className="flex justify-between text-[8px] font-mono text-white/30 pt-1.5 border-t border-white/[0.02] truncate">
                      <span>⚔️ {card.entry.equippedSword.split(",")[0]}</span>
                      {card.entry.equippedShield && (
                        <span>🛡️ {card.entry.equippedShield.split(",")[0]}</span>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
