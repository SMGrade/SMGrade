import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { parsePlayerData } from "@/lib/parser";
import { scorePlayer } from "@/lib/scorer";

export default function Home() {
  const [, navigate] = useLocation();
  const [pasteText, setPasteText] = useState("");
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);

  const analyze = useCallback(() => {
    setError("");
    const text = pasteText.trim();
    if (!text) {
      setError("Paste your SwordMasters stats first.");
      return;
    }
    const player = parsePlayerData(text);
    if (!player || player.level === 0) {
      setError("Could not parse player data. Make sure you paste the full bot output.");
      return;
    }
    const scores = scorePlayer(player);
    const encoded = encodeURIComponent(JSON.stringify({ player, scores }));
    navigate(`/result?d=${encoded}`);
  }, [pasteText, navigate]);

  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1a1a1a] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-black text-xl tracking-tight" style={{
            background: "linear-gradient(135deg, #c9a84c 0%, #f0d080 50%, #c9a84c 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>SM</span>
          <span className="text-white font-black text-xl tracking-tight">Grade</span>
          <span className="hidden sm:block text-[#333] text-sm ml-1">SwordMasters Account Grader</span>
        </div>
        <a
          href="/admin"
          className="text-[#1e1e1e] hover:text-[#2a2a2a] transition-colors text-xs select-none"
          tabIndex={-1}
        >
          ⚙
        </a>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 max-w-2xl mx-auto w-full">
        {/* Hero */}
        <div className="text-center mb-10 space-y-4">
          {/* Logo mark */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl border border-[#2a2200] mb-2"
            style={{ background: "radial-gradient(circle at 50% 40%, #1a1200 0%, #0d0d0d 100%)" }}>
            <span className="text-3xl">⚔️</span>
          </div>
          <h1 className="text-5xl font-black tracking-tight leading-none">
            <span style={{
              background: "linear-gradient(135deg, #c9a84c 0%, #f0d080 50%, #c9a84c 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>SM</span><span className="text-white">Grade</span>
          </h1>
          <p className="text-[#555] text-base leading-relaxed max-w-md mx-auto">
            Paste your SwordMasters <span className="text-[#888] font-mono">/stats</span> output.<br />
            Get an instant grade compared to real players at your level.
          </p>
        </div>

        {/* Paste Box */}
        <div className="w-full space-y-3">
          <label className="text-[10px] font-semibold text-[#555] uppercase tracking-widest">
            Paste Bot Output
          </label>
          <div
            className="relative rounded-lg transition-all duration-200"
            style={{
              boxShadow: focused
                ? "0 0 0 1px #c9a84c44, 0 0 20px #c9a84c0d"
                : "0 0 0 1px #1e1e1e",
            }}
          >
            <textarea
              className="w-full bg-[#0d0d0d] text-[#ddd] text-sm font-mono rounded-lg p-4 resize-none outline-none placeholder-[#2a2a2a] min-h-[220px] leading-relaxed"
              placeholder={`Paste your /stats bot output here...\n\nExample:\nYAMxARF Stats\nLevel\n12586\nGold\n 1.04QT\nPower\n 9.95QT\nSword\nSolbrand, Level 4  1%\nShield\nSunward Bulwark, Level 4  1%`}
              value={pasteText}
              onChange={(e) => { setPasteText(e.target.value); setError(""); }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              spellCheck={false}
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm border border-red-900/50 bg-red-950/20 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            onClick={analyze}
            className="w-full font-bold py-3.5 px-6 rounded-lg transition-all duration-200 text-sm tracking-wide"
            style={{
              background: "linear-gradient(135deg, #c9a84c 0%, #d4b55e 100%)",
              color: "#000",
              boxShadow: "0 0 20px #c9a84c22",
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 0 30px #c9a84c44")}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 0 20px #c9a84c22")}
          >
            Analyze Account →
          </button>

          <p className="text-center text-[#333] text-xs">
            Copy the full bot response from Discord and paste it above
          </p>
        </div>

        {/* How it works */}
        <div className="mt-16 w-full border-t border-[#111] pt-10">
          <p className="text-[#333] text-[10px] uppercase tracking-widest text-center mb-8">How it works</p>
          <div className="grid grid-cols-3 gap-6 text-center">
            {[
              { step: "01", title: "Paste Stats", desc: "Copy your /stats bot output from Discord" },
              { step: "02", title: "Instant Score", desc: "Deterministic engine compares you to real players" },
              { step: "03", title: "AI Coach", desc: "Get your grade, gear tips, and personalized advice" },
            ].map((item) => (
              <div key={item.step} className="space-y-2">
                <div className="text-[#c9a84c] text-xs font-mono font-bold">{item.step}</div>
                <div className="text-[#ccc] text-sm font-semibold">{item.title}</div>
                <div className="text-[#444] text-xs leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Grade examples */}
        <div className="mt-10 flex items-center gap-3 flex-wrap justify-center">
          {[
            { g: "S+", c: "#FFD700" }, { g: "A+", c: "#c9a84c" },
            { g: "B", c: "#8ab4c9" }, { g: "C", c: "#888" }, { g: "D", c: "#e05a5a" },
          ].map(({ g, c }) => (
            <div
              key={g}
              className="w-10 h-10 rounded-lg border flex items-center justify-center font-black text-sm"
              style={{ color: c, borderColor: c + "33", background: c + "08" }}
            >
              {g}
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-[#111] px-6 py-4 text-center text-[#252525] text-xs">
        SMGrade — not affiliated with SwordMasters
      </footer>
    </div>
  );
}
