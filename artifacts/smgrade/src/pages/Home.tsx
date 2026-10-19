import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { fetchLivePlayerInfo, normalizeLivePlayer } from "@/lib/liveLookupEngine";
import { formatNumber } from "@/lib/numberParser";

export function ParallaxBackground({ blur = 8, brightness = 0.5, saturate = 0.9, opacity = 0.6 }) {
  const [xy, setXy] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) - 0.5;
      const y = (e.clientY / window.innerHeight) - 0.5;
      setXy({ x: x * 16, y: y * 16 });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div 
      className="absolute inset-[-30px] z-0 pointer-events-none transition-transform duration-700 ease-out"
      style={{
        backgroundImage: "url('/swordmasters_world1.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        transform: `translate3d(${xy.x}px, ${xy.y}px, 0)`,
        filter: `blur(${blur}px) brightness(${brightness}) saturate(${saturate})`,
        opacity: opacity,
      }}
    />
  );
}

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

export function DiscordIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
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
      let scores: any = null;
      try {
        rawPayload = await fetchLivePlayerInfo(userToFind, (status) => {
          setConnectionStatus(status.message);
        });
      } catch (clientErr) {
        console.warn("Client direct lookup failed, falling back to backend API...", clientErr);
        setConnectionStatus("Routing query through server-side proxy...");
        
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
        scores = proxyData.scores;
      }

      setConnectionStatus("Running grade formulas...");
      const player = normalizeLivePlayer(rawPayload);

      // Attach raw game response on the player payload so the Result page can read full quests and active pets directly
      const normalizedPlayer = {
        ...player,
        rawPayload
      };

      if (!scores) {
        const customPrices = JSON.parse(localStorage.getItem("smg_market_database_v1") || "[]");
        const customBenchmarks = JSON.parse(localStorage.getItem("smg_benchmark_tiers_v2") || "[]");
        const customConstants = JSON.parse(localStorage.getItem("smg_grading_settings_v1") || "null");
        const customItems = JSON.parse(localStorage.getItem("smg_items_db_v2") || "[]");

        const calcRes = await fetch("/api/grade/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            player: normalizedPlayer,
            customPrices,
            customBenchmarks,
            customConstants,
            customItems
          })
        });
        if (!calcRes.ok) {
          const errData = await calcRes.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to calculate player score on backend.");
        }
        const calcData = await calcRes.json();
        scores = calcData.scores;
      }

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
          overallScore: scores.overallScore,
          levelTier: scores.levelTier,
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
    }
  };

  return (
    <div className="min-h-screen text-white flex flex-col relative overflow-hidden font-sans bg-[#03050b]">
      {/* Cinematic Blurred Parallax Background */}
      <ParallaxBackground blur={8} brightness={0.35} saturate={0.7} opacity={0.8} />
      {/* Light Dark Overlay to ensure text readability */}
      <div className="absolute inset-0 bg-black/55 z-0 pointer-events-none" />
      {/* Radial Vignette */}
      <div 
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: "radial-gradient(circle, rgba(0,0,0,0) 40%, rgba(3,5,11,0.85) 100%)"
        }}
      />

      <ParticleBackground />

      {/* Decorative gradients */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-amber-950/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#1e293b]/5 blur-[130px] pointer-events-none" />

      {/* Top Navbar */}
      <header className="border-b border-white/[0.04] bg-[#070b13]/60 backdrop-blur-xl px-6 py-4 flex items-center justify-between z-20 sticky top-0">
        <div className="flex items-center gap-2">
          <span className="font-black text-xs tracking-wider px-2 py-0.5 rounded bg-amber-500/25 border border-amber-500/35 text-amber-400 font-display">
            SM
          </span>
          <span className="text-white font-extrabold text-sm tracking-tight font-display">Grade</span>
        </div>
        
        <div className="flex items-center gap-6">
          <Link href="/compare" className="text-[10px] text-white/50 hover:text-amber-400 transition-colors font-black uppercase tracking-widest">
            Compare
          </Link>
          <Link href="/admin" className="text-[10px] text-white/50 hover:text-amber-400 transition-colors font-black uppercase tracking-widest">
            Admin Panel
          </Link>
        </div>
      </header>

      {/* Two Large Centered Cards */}
      <main className="flex-1 z-10 relative flex flex-col items-center justify-center p-6 min-h-[calc(100vh-68px)]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
          {/* Left Card: SM Grade */}
          <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            onClick={() => setDrawerOpen(true)}
            className="group relative cursor-pointer rounded-2xl border border-white/[0.06] bg-[#0c1020]/45 p-8 glass-panel overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-all hover:border-amber-500/30 hover:shadow-[0_0_35px_rgba(245,158,11,0.12)] flex flex-col justify-between min-h-[220px]"
          >
            {/* Hover Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 via-amber-500/[0.01] to-amber-500/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            
            <div className="space-y-4 relative z-10">
              <div className="inline-flex w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 items-center justify-center text-amber-400 font-bold group-hover:border-amber-500/40 transition-colors">
                ⚔️
              </div>
              <h2 className="text-3xl font-black tracking-tight text-white font-display">
                SM Grade
              </h2>
            </div>

            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-400 mt-6 relative z-10 group-hover:text-amber-300 transition-colors">
              Analyze Stats <span>→</span>
            </div>
          </motion.div>

          {/* Right Card: SM Arcade */}
          <Link href="/arcade" className="block group">
            <motion.div
              whileHover={{ y: -8, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="relative rounded-2xl border border-white/[0.06] bg-[#0c1020]/45 p-8 glass-panel overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-all hover:border-blue-500/30 hover:shadow-[0_0_35px_rgba(59,130,246,0.12)] flex flex-col justify-between min-h-[220px]"
            >
              {/* Hover Glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-blue-500/[0.01] to-blue-500/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className="space-y-4 relative z-10">
                <div className="inline-flex w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 items-center justify-center text-blue-400 font-bold group-hover:border-blue-500/40 transition-colors">
                  👾
                </div>
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-white font-display">
                    SM Arcade
                  </h2>
                  <div className="text-[10px] font-black uppercase tracking-wider text-blue-400/85 font-mono mt-1">
                    SM Revenge
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-400 mt-6 relative z-10 group-hover:text-blue-300 transition-colors">
                Play Arcade <span>→</span>
              </div>
            </motion.div>
          </Link>
        </div>

        {/* Discord Feedback / Bug Reports Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="mt-8 w-full max-w-4xl flex justify-center"
        >
          <a
            href="https://discord.com/users/1466250637476892794"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative w-full sm:w-auto flex items-center justify-between sm:justify-start gap-4 px-6 py-4 rounded-2xl border border-white/[0.08] bg-[#0c1020]/50 hover:bg-[#0c1020]/80 hover:border-[#5865F2]/50 backdrop-blur-xl transition-all duration-300 shadow-[0_8px_30px_rgba(0,0,0,0.4)] hover:shadow-[0_0_35px_rgba(88,101,242,0.22)] cursor-pointer"
          >
            {/* Subtle glow on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#5865F2]/0 via-[#5865F2]/[0.03] to-[#5865F2]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none" />

            <div className="flex items-center gap-3.5 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-[#5865F2]/15 border border-[#5865F2]/30 flex items-center justify-center text-[#5865F2] group-hover:bg-[#5865F2] group-hover:text-white transition-all duration-300 shadow-[0_0_15px_rgba(88,101,242,0.2)]">
                <DiscordIcon className="w-5 h-5 fill-current" />
              </div>
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-black font-display tracking-tight group-hover:text-white transition-colors">
                    Discord Feedback
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#5865F2]/20 border border-[#5865F2]/30 text-[#8ea1e1] text-[9px] font-black uppercase tracking-wider font-mono">
                    Direct DM
                  </span>
                </div>
                <span className="text-white/45 text-[11px] font-medium tracking-wide group-hover:text-white/75 transition-colors">
                  Bug Reports & Update Suggestions
                </span>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#8ea1e1] group-hover:text-white transition-colors pl-6 border-l border-white/5 relative z-10">
              <span>Open DM</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </a>
        </motion.div>
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
