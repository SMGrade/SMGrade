import { useState, useCallback } from "react";
import { useLocation, Link } from "wouter";
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
    <div className="min-h-screen bg-[#050505] text-white flex flex-col relative overflow-hidden">
      {/* Background neon aura glow */}
      <div className="absolute top-[-10%] left-[50%] translate-x-[-50%] w-[600px] h-[300px] rounded-full bg-[#c9a84c]/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-[#131313] bg-[#080808]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <span className="font-black text-xl tracking-wider px-2 py-0.5 rounded bg-gradient-to-r from-[#c9a84c]/20 to-[#f0d080]/10 border border-[#c9a84c]/20 text-[#c9a84c] shadow-[0_0_15px_rgba(201,168,76,0.1)]">
            SM
          </span>
          <span className="text-white font-extrabold text-xl tracking-tight">Grade</span>
          <span className="hidden sm:block text-[#444] text-xs font-semibold ml-2 border-l border-[#222] pl-3">
            SwordMasters Account Grader
          </span>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/compare" className="text-xs text-[#777] hover:text-[#c9a84c] transition-colors font-bold uppercase tracking-wider">
            Compare Accounts
          </Link>
          <a
            href="/admin"
            className="text-[#333] hover:text-[#c9a84c] hover:rotate-45 transition-all duration-300 text-sm select-none"
            tabIndex={-1}
          >
            ⚙
          </a>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 max-w-2xl mx-auto w-full z-10 relative">
        {/* Hero */}
        <div className="text-center mb-12 space-y-5">
          {/* Logo mark with premium glow */}
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl border border-[#c9a84c]/25 mb-2 transition-all duration-500 hover:scale-105 hover:border-[#c9a84c]/50 hover:shadow-[0_0_40px_rgba(201,168,76,0.2)] group"
            style={{ background: "radial-gradient(circle at 50% 40%, #1c1500 0%, #080808 100%)" }}>
            <span className="text-5xl filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] group-hover:animate-bounce">⚔️</span>
          </div>
          
          <div className="space-y-2.5">
            <h1 className="text-6xl font-black tracking-tight leading-none">
              <span style={{
                background: "linear-gradient(135deg, #c9a84c 0%, #f5db9a 50%, #c9a84c 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }} className="drop-shadow-[0_2px_15px_rgba(201,168,76,0.2)]">SM</span><span className="text-white">Grade</span>
            </h1>
            <p className="text-[#c9a84c] text-xs font-black uppercase tracking-widest bg-[#c9a84c]/5 border border-[#c9a84c]/10 px-4.5 py-1.5 rounded-full inline-block">
              The Ultimate SwordMasters Account Analyzer
            </p>
          </div>

          <p className="text-[#666] text-sm md:text-base leading-relaxed max-w-md mx-auto">
            Paste your SwordMasters <span className="text-[#888] font-mono bg-[#111] px-1.5 py-0.5 rounded border border-[#222]">/stats</span> output.<br />
            Get an instant grade compared to real competitive players.
          </p>
        </div>

        {/* Paste Box */}
        <div className="w-full space-y-5">
          <label className="text-[10px] font-black text-[#555] uppercase tracking-widest block pl-1">
            Paste Bot Output
          </label>
          <div
            className="relative rounded-xl overflow-hidden transition-all duration-300 border bg-[#0b0b0b]"
            style={{
              borderColor: focused ? "#c9a84c44" : "#181818",
              boxShadow: focused
                ? "0 0 30px rgba(201,168,76,0.06), inset 0 0 15px rgba(201,168,76,0.02)"
                : "none",
            }}
          >
            <textarea
              className="w-full bg-transparent text-[#ddd] text-sm font-mono p-5 resize-none outline-none placeholder-[#252525] min-h-[240px] leading-relaxed animate-none"
              placeholder={`Paste your /stats bot output here...\n\nExample:\nYAMxARF Stats\nLevel\n12586\nGold\n 1.04QT\nPower\n 9.95QT\nSword\nSolbrand, Level 4  1%\nShield\nSunward Bulwark, Level 4  1%`}
              value={pasteText}
              onChange={(e) => { setPasteText(e.target.value); setError(""); }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              spellCheck={false}
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs font-semibold border border-red-950/60 bg-red-950/20 px-4 py-3 rounded-lg animate-pulse">
              ⚠️ {error}
            </p>
          )}

          <button
            onClick={analyze}
            className="w-full font-extrabold py-4 px-6 rounded-lg transition-all duration-300 text-xs uppercase tracking-widest text-black hover:scale-[1.01] active:scale-[0.99]"
            style={{
              background: "linear-gradient(135deg, #c9a84c 0%, #f0d080 100%)",
              boxShadow: "0 4px 20px rgba(201,168,76,0.25), inset 0 -2px 0 rgba(0,0,0,0.2)",
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 6px 25px rgba(201,168,76,0.4), inset 0 -2px 0 rgba(0,0,0,0.2)")}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 4px 20px rgba(201,168,76,0.25), inset 0 -2px 0 rgba(0,0,0,0.2)")}
          >
            Analyze Account
          </button>

          <p className="text-center text-[#444] text-[10px] uppercase tracking-wider font-semibold">
            Copy the full bot response from Discord and paste it above
          </p>
        </div>

        {/* How it works */}
        <div className="mt-20 w-full border-t border-[#111] pt-12">
          <p className="text-[#444] text-[10px] uppercase tracking-widest text-center mb-8 font-black">How it works</p>
          <div className="grid grid-cols-3 gap-6 text-center">
            {[
              { step: "01", title: "Paste Stats", desc: "Copy your /stats bot output from Discord" },
              { step: "02", title: "Instant Score", desc: "Deterministic engine compares you to real players" },
              { step: "03", title: "AI Coach", desc: "Get your grade, gear tips, and personalized advice" },
            ].map((item) => (
              <div key={item.step} className="space-y-2 group">
                <div className="text-[#c9a84c] text-xs font-mono font-bold transition-all duration-300 group-hover:scale-110">{item.step}</div>
                <div className="text-[#ccc] text-xs sm:text-sm font-semibold">{item.title}</div>
                <div className="text-[#444] text-[11px] leading-relaxed px-1">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Grade examples */}
        <div className="mt-12 flex items-center gap-3.5 flex-wrap justify-center">
          {[
            { g: "S+", c: "#FFD700" }, { g: "A+", c: "#c9a84c" },
            { g: "B", c: "#8ab4c9" }, { g: "C", c: "#888" }, { g: "D", c: "#e05a5a" },
          ].map(({ g, c }) => (
            <div
              key={g}
              className="w-10 h-10 rounded-xl border flex items-center justify-center font-black text-sm transition-all duration-300 hover:scale-110 cursor-default"
              style={{ color: c, borderColor: c + "22", background: c + "05" }}
            >
              {g}
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-[#101010] bg-[#050505] px-6 py-5 text-center text-[#333] text-[10px] font-bold uppercase tracking-wider z-10">
        SMGrade — not affiliated with SwordMasters
      </footer>
    </div>
  );
}
