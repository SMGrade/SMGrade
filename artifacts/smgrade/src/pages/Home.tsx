import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { scorePlayer } from "@/lib/scorer";
import { fetchLivePlayerInfo, normalizeLivePlayer } from "@/lib/liveLookupEngine";

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const particles: Array<{
      x: number;
      y: number;
      size: number;
      speedY: number;
      speedX: number;
      opacity: number;
      fadeSpeed: number;
    }> = [];

    const createParticle = () => {
      return {
        x: Math.random() * width,
        y: height + Math.random() * 20,
        size: Math.random() * 1.2 + 0.4,
        speedY: -Math.random() * 0.35 - 0.05,
        speedX: (Math.random() - 0.5) * 0.15,
        opacity: Math.random() * 0.4 + 0.1,
        fadeSpeed: Math.random() * 0.0015 + 0.0005,
      };
    };

    for (let i = 0; i < 35; i++) {
      const p = createParticle();
      p.y = Math.random() * height;
      particles.push(p);
    }

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.y += p.speedY;
        p.x += p.speedX;
        p.opacity -= p.fadeSpeed;

        if (p.opacity <= 0 || p.y < 0) {
          particles[i] = createParticle();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(245, 158, 11, ${p.opacity})`;
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-40" />;
}

export default function Home() {
  const [, navigate] = useLocation();
  const [lookupUsername, setLookupUsername] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("");
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);


  const analyzeLiveCharacter = async () => {
    setError("");
    const userToFind = lookupUsername.trim();
    if (!userToFind) {
      setError("Please enter a player username.");
      return;
    }

    setLookupLoading(true);
    setConnectionStatus("Initializing...");

    const startTime = Date.now();

    try {
      let rawPayload: any = null;
      try {
        rawPayload = await fetchLivePlayerInfo(userToFind, (status) => {
          setConnectionStatus(status.message);
        });
      } catch (clientErr) {
        console.warn("Client direct lookup failed, falling back to backend API...", clientErr);
        setConnectionStatus("CORS/Connection blocked. Routing through API proxy...");
        
        const proxyRes = await fetch(`/api/live-lookup?username=${encodeURIComponent(userToFind)}`);
        if (!proxyRes.ok) {
          const errData = await proxyRes.json().catch(() => ({}));
          throw new Error(errData.error || `Proxy lookup failed with status ${proxyRes.status}`);
        }
        const proxyData = await proxyRes.json();
        if (!proxyData.success) {
          throw new Error(proxyData.error || "Proxy query returned unsuccessful state.");
        }
        rawPayload = proxyData.playerInfo;
      }

      setConnectionStatus("Running grade formulas...");
      const player = normalizeLivePlayer(rawPayload);

      // Attach raw game response on the player payload so the Result page can read full quests and active pets directly
      const normalizedPlayer = {
        ...player,
        rawPayload
      };

      const scores = scorePlayer(normalizedPlayer);
      const encoded = encodeURIComponent(JSON.stringify({ player: normalizedPlayer, scores }));

      const duration = Date.now() - startTime;
      let sessionId = sessionStorage.getItem("smg_session_id");
      if (!sessionId) {
        sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        sessionStorage.setItem("smg_session_id", sessionId);
      }

      fetch("/api/master/log-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usernameSearched: userToFind,
          sessionId,
          userAccount: null,
          userType: "Guest",
          status: "Success",
          responseTimeMs: duration,
          grade: scores.overallGrade,
          gearScore: scores.gearScore,
          wealthScore: scores.wealthScore,
          powerScore: scores.powerScore,
          progressionScore: scores.progressScore,
          recommendedUpgrade: scores.upgradeAdvice.immediate ? `${scores.upgradeAdvice.immediate.name} Lv${scores.upgradeAdvice.immediate.level}` : "None",
          playerLevel: normalizedPlayer.level,
          playerPower: normalizedPlayer.powerRaw,
          playerGold: normalizedPlayer.goldRaw,
          equippedSword: normalizedPlayer.sword || "Unknown",
          equippedShield: normalizedPlayer.shield || "Unknown",
          worldNumber: 1
        })
      }).catch(e => console.error("Error logging player lookup:", e));

      setLookupLoading(false);
      setDrawerOpen(false);
      navigate(`/result?d=${encoded}`);
    } catch (err: any) {
      console.error(err);
      const duration = Date.now() - startTime;
      let sessionId = sessionStorage.getItem("smg_session_id");
      if (!sessionId) {
        sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        sessionStorage.setItem("smg_session_id", sessionId);
      }

      fetch("/api/master/log-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usernameSearched: userToFind,
          sessionId,
          userAccount: null,
          userType: "Guest",
          status: "Failed",
          responseTimeMs: duration,
          grade: "—",
          gearScore: 0,
          wealthScore: 0,
          powerScore: 0,
          progressionScore: 0,
          recommendedUpgrade: "None",
          playerLevel: 0,
          playerPower: 0,
          playerGold: 0,
          equippedSword: "Unknown",
          equippedShield: "Unknown",
          worldNumber: 1
        })
      }).catch(e => console.error("Error logging player lookup:", e));

      let errMsg = err.message || "Failed to retrieve live player. Please verify connection/username.";
      if (errMsg.includes("4000")) {
        errMsg = "Connection rejected by the game server (Code 4000). SwordMasters' anti-cheat blocks unofficial connections. Please copy your stats manually and paste them, or try again later.";
      } else if (errMsg.toLowerCase().includes("timeout")) {
        errMsg = "Game server request timed out. The game server did not respond in time. Please try again or copy/paste your stats manually.";
      }
      setError(errMsg);
      setLookupLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-white flex flex-col relative overflow-hidden font-sans bg-[#03050b]">
      <ParticleBackground />

      {/* Decorative gradients */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-amber-950/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#1e293b]/5 blur-[130px] pointer-events-none" />

      {/* Top Navbar */}
      <header className="border-b border-white/[0.04] bg-[#070b13]/60 backdrop-blur-xl px-6 py-4 flex items-center justify-between z-20 sticky top-0">
        <div className="flex items-center gap-2">
          <span className="font-black text-xs tracking-wider px-2 py-0.5 rounded bg-amber-500/25 border border-amber-500/35 text-amber-400">
            SM
          </span>
          <span className="text-white font-extrabold text-sm tracking-tight font-display">Grade</span>
        </div>
        
        <div className="flex items-center gap-6">
          <Link href="/arcade" className="text-[10px] text-white/50 hover:text-amber-400 transition-colors font-black uppercase tracking-widest">
            Arcade
          </Link>
          <Link href="/compare" className="text-[10px] text-white/50 hover:text-amber-400 transition-colors font-black uppercase tracking-widest">
            Compare
          </Link>
          <Link href="/admin" className="text-[10px] text-white/50 hover:text-amber-400 transition-colors font-black uppercase tracking-widest">
            Admin Panel
          </Link>
        </div>
      </header>

      {/* Hero / Landing Grid */}
      <main className="flex-1 z-10 relative">
        
        <section className="max-w-6xl mx-auto px-6 py-20 lg:py-32 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Hero Text */}
          <div className="space-y-8 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.04] bg-white/[0.01] text-[9px] uppercase tracking-widest text-amber-400 font-black font-display">
              ⚔️ Version 3.4 Active
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-none font-display text-white">
              Definitive <br />
              <span className="glow-text-gold">Companion</span>
            </h1>

            <p className="text-white/40 text-sm md:text-base leading-relaxed max-w-lg font-medium">
              Unlock real-time metrics, gear score card grades, deterministic leader comparisons, and intelligent tactics with the official companion engine.
            </p>

            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setDrawerOpen(true);
                }}
                className="px-8 py-4 rounded-xl button-gold text-xs font-black tracking-widest cursor-pointer shadow-[0_0_30px_rgba(245,158,11,0.15)]"
              >
                Analyze stats
              </button>
              <Link 
                href="/compare"
                className="px-8 py-4 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] text-xs font-black tracking-widest uppercase text-white/80 transition-all flex items-center justify-center cursor-pointer"
              >
                Compare accounts
              </Link>
            </div>
          </div>

          {/* Right Floating Weapons Visual */}
          <div className="relative h-[300px] sm:h-[450px] flex items-center justify-center">
            {/* Center golden circle glow */}
            <div className="absolute w-64 h-64 rounded-full bg-amber-500/5 blur-[70px]" />
            
            {/* Left float card */}
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
              className="absolute left-4 sm:left-12 top-6 p-5 w-44 rounded-2xl border border-white/[0.03] bg-[#0c1020] shadow-[0_8px_30px_rgba(0,0,0,0.6)] z-10 glass-panel"
            >
              <div className="text-amber-400 text-[8px] font-black uppercase tracking-widest">Legendary Weapon</div>
              <div className="text-white font-extrabold text-xs mt-1">Horizon</div>
              <div className="text-white/30 text-[9px] font-mono mt-0.5">Lv10 · 39.0B DMG</div>
              <div className="w-full bg-amber-500/10 h-1 rounded-full mt-4 overflow-hidden">
                <div className="w-full h-full bg-amber-500" />
              </div>
            </motion.div>

            {/* Right float card */}
            <motion.div 
              animate={{ y: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 6, ease: "easeInOut", delay: 1 }}
              className="absolute right-4 sm:right-12 bottom-6 p-5 w-44 rounded-2xl border border-white/[0.03] bg-[#0c1020] shadow-[0_8px_30px_rgba(0,0,0,0.6)] z-10 glass-panel"
            >
              <div className="text-amber-500 text-[8px] font-black uppercase tracking-widest">Epic Shield</div>
              <div className="text-white font-extrabold text-xs mt-1">Sunward Bulwark</div>
              <div className="text-white/30 text-[9px] font-mono mt-0.5">Lv4 · 1.0x MULT</div>
              <div className="w-full bg-[#ffd700]/10 h-1 rounded-full mt-4 overflow-hidden">
                <div className="w-[40%] h-full bg-[#ffd700]" />
              </div>
            </motion.div>
          </div>
        </section>

        {/* Feature Highlights section */}
        <section className="border-t border-white/[0.03] bg-[#070b13]/25 py-20 px-6">
          <div className="max-w-6xl mx-auto space-y-12">
            <div className="text-center space-y-2">
              <span className="text-amber-450 text-[9px] font-black tracking-widest uppercase font-display">System Core</span>
              <h2 className="text-3xl font-black tracking-tight text-white font-display">Built for Champions</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: "Tactical Analyzer", desc: "Grade stats instantly with fully deterministic algorithm scoring, checking items and weapon levels." },
                { title: "Simulated Sandboxes", desc: "Test item changes dynamically. See exactly how stats will shift before investing resources." },
                { title: "Interactive Timelines", desc: "Save logs history profiles locally to plot DPS progression growth curves over time." },
              ].map((feat, idx) => (
                <div key={idx} className="p-6 rounded-xl border border-white/[0.03] bg-[#070b13]/40 glass-panel">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/5 border border-amber-500/15 flex items-center justify-center text-xs text-amber-400 mb-4">
                    ✦
                  </div>
                  <h3 className="text-sm font-black text-white font-display mb-1">{feat.title}</h3>
                  <p className="text-white/40 text-xs leading-relaxed font-medium">{feat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Drawer Overlay for Stats Input */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-end">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !lookupLoading && setDrawerOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            />
            
            {/* Content Drawer */}
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 250 }}
              className="relative w-full max-w-lg h-full bg-[#070b13] border-l border-white/[0.04] p-8 flex flex-col justify-between overflow-y-auto"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
                  <div>
                    <h3 className="text-lg font-black text-white font-display">Character Analyzer</h3>
                    <p className="text-white/35 text-[10px] uppercase font-bold mt-0.5">Live character fetch</p>
                  </div>
                  <button onClick={() => !lookupLoading && setDrawerOpen(false)} className="text-white/40 hover:text-white text-xs select-none cursor-pointer" disabled={lookupLoading}>
                    ✕
                  </button>
                </div>

                <div className="space-y-5">
                  <label className="text-[9px] uppercase tracking-widest text-[#ffd700] font-black font-display block">SwordMasters Username</label>
                  <input
                    type="text"
                    disabled={lookupLoading}
                    className="w-full bg-[#03050b] border border-white/[0.08] focus:border-amber-500/30 text-white text-sm px-4 py-3.5 rounded-xl outline-none transition-colors"
                    placeholder="Enter character name (e.g. Harrison)"
                    value={lookupUsername}
                    onChange={(e) => setLookupUsername(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && analyzeLiveCharacter()}
                  />
                  {error && <p className="text-red-400 text-xs font-semibold">⚠️ {error}</p>}

                  {lookupLoading && (
                    <div className="flex flex-col items-center justify-center p-8 bg-white/[0.01] border border-amber-500/10 rounded-xl space-y-4">
                      <div className="w-8 h-8 rounded-full border-2 border-amber-500/10 border-t-amber-400 animate-spin" />
                      <p className="text-[#ffd700] text-xs font-bold uppercase tracking-wider animate-pulse">{connectionStatus}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-white/[0.04]">
                <button 
                  onClick={analyzeLiveCharacter}
                  disabled={lookupLoading}
                  className="w-full py-4 rounded-xl button-gold text-xs font-black tracking-widest disabled:opacity-20 cursor-pointer shadow-[0_0_20px_rgba(245,158,11,0.1)]"
                >
                  {lookupLoading ? "Connecting..." : "Fetch and Analyze"}
                </button>
                <p className="text-center text-white/25 text-[8.5px] uppercase font-bold tracking-wider">
                  Handshakes directly with SwordMasters load balancer.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="border-t border-white/[0.03] bg-[#070b13]/60 px-6 py-5 text-center text-white/20 text-[9px] font-bold uppercase tracking-widest z-10">
        Companion App — built for SwordMasters
      </footer>
    </div>
  );
}
