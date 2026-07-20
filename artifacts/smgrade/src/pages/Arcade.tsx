import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ParticleBackground } from "./Home";

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
}

interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  isCrit?: boolean;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
}

// Retro Web Audio Synthesizer for Arcade
const playSound = (type: "hit" | "crit" | "combo" | "kill" | "rage" | "upgrade" | "click" | "transition" | "nuke" | "bazooka") => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    const now = ctx.currentTime;
    
    if (type === "hit") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === "crit") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.18);
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (type === "combo") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.setValueAtTime(900, now + 0.05);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === "kill") {
      osc.type = "square";
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.linearRampToValueAtTime(60, now + 0.4);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.45);
    } else if (type === "rage") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.linearRampToValueAtTime(250, now + 0.3);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === "upgrade") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554.37, now + 0.08);
      osc.frequency.setValueAtTime(659.25, now + 0.16);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === "click") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === "transition") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(440, now + 0.25);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === "nuke") {
      osc.type = "square";
      osc.frequency.setValueAtTime(60, now);
      osc.frequency.exponentialRampToValueAtTime(15, now + 0.8);
      gain.gain.setValueAtTime(0.6, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.85);
      osc.start(now);
      osc.stop(now + 0.85);
    } else if (type === "bazooka") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(80, now + 0.25);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (_) {
    // AudioContext blocked
  }
};

function DwarfSVG({ isHurt, isDead, isCrit, blink }: { isHurt: boolean; isDead: boolean; isCrit: boolean; blink: boolean }) {
  return (
    <motion.svg
      width="220"
      height="260"
      viewBox="0 0 200 250"
      className="overflow-visible"
      key={isDead ? "dead" : "alive"}
      initial={isDead ? { scale: 1, opacity: 1, y: 0, rotate: 0, x: 0 } : { y: -250, opacity: 0, scale: 0.7, rotate: 0, x: 0 }}
      animate={isDead ? {
        scaleY: 0.12,
        scaleX: 1.45,
        y: 110,
        rotate: 90,
        filter: "grayscale(0.8) brightness(0.4)",
        opacity: [1, 1, 0]
      } : isCrit ? {
        scaleY: [1, 0.40, 1.50, 0.70, 1.20, 1],
        scaleX: [1, 1.60, 0.45, 1.30, 0.80, 1],
        rotate: [0, -25, 20, -10, 5, 0],
        y: [0, 15, -12, 4, 0],
        filter: "brightness(2) contrast(1.5)",
        opacity: 1,
        scale: 1
      } : isHurt ? {
        scaleY: [1, 0.60, 1.35, 0.85, 1.05, 1],
        scaleX: [1, 1.40, 0.65, 1.15, 0.95, 1],
        rotate: [0, -18, 14, -7, 3, 0],
        y: [0, 8, -6, 2, 0],
        opacity: 1,
        scale: 1
      } : {
        y: 0,
        x: 0,
        scale: 1,
        opacity: 1,
        rotate: 0
      }}
      transition={isDead ? { duration: 0.45 } : isCrit ? { duration: 0.5, ease: "easeOut" } : isHurt ? { duration: 0.3, ease: "easeOut" } : { type: "spring", stiffness: 90, damping: 12 }}
    >
      <defs>
        {/* Soft Drop Shadows for 3D depth */}
        <filter id="dwarf-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="5" stdDeviation="4" floodOpacity="0.5" />
        </filter>
        <filter id="dwarf-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Shading Gradients */}
        <radialGradient id="dwarfFaceGrad" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#fff6ee" />
          <stop offset="60%" stopColor="#fddbb0" />
          <stop offset="90%" stopColor="#f97316" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#b45309" />
        </radialGradient>

        <linearGradient id="dwarfSkinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffeedd" />
          <stop offset="60%" stopColor="#fddbb0" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>

        <linearGradient id="dwarfHandleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3e2723" />
          <stop offset="50%" stopColor="#5d4037" />
          <stop offset="100%" stopColor="#1c0d0a" />
        </linearGradient>

        <linearGradient id="dwarfHammerHeadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#64748b" />
          <stop offset="50%" stopColor="#475569" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>

        <linearGradient id="dwarfCapGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="60%" stopColor="#991b1b" />
          <stop offset="100%" stopColor="#450a0a" />
        </linearGradient>

        <linearGradient id="dwarfBeardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#5c3f34" />
          <stop offset="30%" stopColor="#452c24" />
          <stop offset="75%" stopColor="#2e1a14" />
          <stop offset="100%" stopColor="#1c0e0b" />
        </linearGradient>

        <linearGradient id="dwarfTunic" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e5e5e5" />
        </linearGradient>

        <linearGradient id="dwarfApron" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#54372e" />
          <stop offset="100%" stopColor="#35201b" />
        </linearGradient>

        <linearGradient id="dwarfBoot" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#50352c" />
          <stop offset="100%" stopColor="#1f110c" />
        </linearGradient>
      </defs>

      {/* Ground shadow (3D drop shadow) */}
      <ellipse cx="100" cy="236" rx="66" ry="11" fill="rgba(0,0,0,0.5)" filter="blur(1px)" />

      {/* IDLE BREATHING GROUP */}
      <motion.g
        animate={(!isDead && !isHurt && !isCrit) ? {
          y: [0, -3.5, 0],
          scaleY: [1, 1.02, 1],
          scaleX: [1, 0.985, 1]
        } : { y: 0, scaleY: 1, scaleX: 1 }}
        transition={{
          duration: 2.8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        style={{ originX: "100px", originY: "220px" }}
      >
        {/* Massive Stone/Iron Hammer Head behind shoulder */}
        <g filter="url(#dwarf-shadow)">
          <path d="M 12 18 L 44 34 L 36 50 L 4 34 Z" fill="url(#dwarfHammerHeadGrad)" stroke="#1e293b" strokeWidth="1.2" />
        </g>
        {/* Wooden handle stick behind back */}
        <path d="M 54 85 L 26 35 L 38 29 L 66 79 Z" fill="url(#dwarfHandleGrad)" stroke="#1c0d0a" strokeWidth="1.2" filter="url(#dwarf-shadow)" />

        {/* Tunic (White Tank Top Sleeveless Shirt) with U-neck details */}
        <g filter="url(#dwarf-shadow)">
          {/* Skin neck & shoulders visible under tank top */}
          <rect x="74" y="105" width="52" height="25" fill="url(#dwarfSkinGrad)" />
          {/* Tank top path with U-shaped neckline */}
          <path d="M 60 122 L 72 106 H 82 Q 100 128 118 106 H 128 L 140 122 V 205 H 60 Z" fill="url(#dwarfTunic)" stroke="#d4d4d4" strokeWidth="1" />
        </g>

        {/* Trousers (Brown pants) */}
        <g filter="url(#dwarf-shadow)">
          <path d="M 64 205 L 136 205 L 132 225 L 68 225 Z" fill="#3b2314" />
        </g>

        {/* Crotch Apron Pouch with X stitch as in reference image */}
        <g filter="url(#dwarf-shadow)">
          <path d="M 88 195 Q 100 188 112 195 L 110 212 Q 100 220 90 212 Z" fill="url(#dwarfApron)" stroke="#1c0d0a" strokeWidth="1.2" />
          <path d="M 96 200 L 104 208 M 104 200 L 96 208" stroke="#1c0d0a" strokeWidth="1.5" strokeLinecap="round" />
        </g>

        {/* Green leg cuffs at knees */}
        <rect x="72" y="218" width="16" height="9" fill="#15803d" stroke="#166534" strokeWidth="0.8" />
        <rect x="112" y="218" width="16" height="9" fill="#15803d" stroke="#166534" strokeWidth="0.8" />

        {/* Leather folded cuff boots */}
        <g filter="url(#dwarf-shadow)">
          {/* Left cuff & boot folded cuff */}
          <ellipse cx="80" cy="227" rx="12" ry="4.5" fill="#50352c" stroke="#1f110c" strokeWidth="1" />
          <path d="M 68 227 C 68 220, 92 220, 92 227 L 93 246 Q 80 250 67 246 Z" fill="url(#dwarfBoot)" stroke="#1f110c" strokeWidth="1" />

          {/* Right cuff & boot folded cuff */}
          <ellipse cx="120" cy="227" rx="12" ry="4.5" fill="#50352c" stroke="#1f110c" strokeWidth="1" />
          <path d="M 108 227 C 108 220, 132 220, 132 227 L 133 246 Q 120 250 107 246 Z" fill="url(#dwarfBoot)" stroke="#1f110c" strokeWidth="1" />
        </g>

        {/* Thick skin arms hanging straight down */}
        <g filter="url(#dwarf-shadow)">
          <path d="M 52 120 L 52 195" stroke="url(#dwarfSkinGrad)" strokeWidth="18" strokeLinecap="round" />
          <circle cx="52" cy="195" r="10" fill="#fddbb0" stroke="#ea580c" strokeWidth="1.2" />

          <path d="M 148 120 L 148 195" stroke="url(#dwarfSkinGrad)" strokeWidth="18" strokeLinecap="round" />
          <circle cx="148" cy="195" r="10" fill="#fddbb0" stroke="#ea580c" strokeWidth="1.2" />
        </g>

        {/* Large Back Beard layer - tapered to point */}
        <path d="M 54 90 L 146 90 L 138 185 Q 120 220 100 224 Q 80 220 62 185 Z" fill="#1c0e0b" />

        {/* Front Beard (Vertical lock details) - tapered to point */}
        <g filter="url(#dwarf-shadow)">
          <path d="M 58 92 L 142 92 L 136 182 Q 120 216 100 220 Q 80 216 64 182 Z" fill="url(#dwarfBeardGrad)" />
          {/* Shading/lighting lines on beard */}
          <path d="M 80 102 L 85 195" stroke="#78584c" strokeWidth="2.0" opacity="0.35" strokeLinecap="round" />
          <path d="M 120 102 L 115 195" stroke="#78584c" strokeWidth="2.0" opacity="0.35" strokeLinecap="round" />
          <path d="M 100 104 L 100 205" stroke="#3d251d" strokeWidth="2.5" opacity="0.65" strokeLinecap="round" />
        </g>

        {/* Soft Rounded Face Shape */}
        <rect x="66" y="66" width="68" height="34" rx="10" fill="url(#dwarfFaceGrad)" stroke="#1c0d0a" strokeWidth="1" />

        {/* Mustache curls down on the sides */}
        <g filter="url(#dwarf-shadow)">
          <path d="M 60 92 Q 100 114 140 92 Q 100 102 60 92 Z" fill="#301c15" stroke="#1c0d0a" strokeWidth="1" />
        </g>

        {/* Bushy Angled Eyebrows */}
        <g filter="url(#dwarf-shadow)">
          <path d="M 56 64 C 70 54, 94 62, 94 72 C 84 72, 70 70, 56 64 Z" fill="#2d1a12" stroke="#1c0d0a" strokeWidth="1" />
          <path d="M 144 64 C 130 54, 106 62, 106 72 C 116 72, 130 70, 144 64 Z" fill="#2d1a12" stroke="#1c0d0a" strokeWidth="1" />
        </g>

        {/* Eyes (Round black circular beads, spaced apart as in reference) - NO NOSE rendered here */}
        <g>
          {isDead || isCrit ? (
            <>
              <path d="M 74 76 L 86 84 M 86 76 L 74 84" stroke="#1c0d0a" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 114 76 L 126 84 M 126 76 L 114 84" stroke="#1c0d0a" strokeWidth="2.5" strokeLinecap="round" />
            </>
          ) : isHurt ? (
            <>
              <path d="M 73 83 L 83 79 L 73 75" fill="none" stroke="#1c0d0a" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 127 83 L 117 79 L 127 75" fill="none" stroke="#1c0d0a" strokeWidth="2.5" strokeLinecap="round" />
            </>
          ) : (
            <>
              <circle cx="80" cy="80" r="6" fill="#151311" />
              <circle cx="120" cy="80" r="6" fill="#151311" />
              
              {/* Blink Eyelids */}
              <motion.path 
                d="M 70 74 Q 80 84 90 74 Z" 
                fill="url(#dwarfFaceGrad)"
                animate={blink ? { scaleY: 1 } : { scaleY: 0 }}
                style={{ originY: 0 }}
              />
              <motion.path 
                d="M 110 74 Q 120 84 130 74 Z" 
                fill="url(#dwarfFaceGrad)"
                animate={blink ? { scaleY: 1 } : { scaleY: 0 }}
                style={{ originY: 0 }}
              />
            </>
          )}
        </g>

        {/* Burgundy Cap/Bandanna with Drooping Left Tail tie */}
        <g filter="url(#dwarf-shadow)">
          {/* Cap dome */}
          <path d="M 64 70 C 64 30, 136 30, 136 70 Z" fill="url(#dwarfCapGrad)" stroke="#450a0a" strokeWidth="1" />
          {/* Bandanna knot */}
          <circle cx="62" cy="70" r="5" fill="#ef4444" stroke="#450a0a" strokeWidth="1" />
          {/* Drooping bandanna tail 1 */}
          <path d="M 62 70 Q 42 75, 34 105 Q 42 110, 48 95 Q 52 82, 62 74 Z" fill="url(#dwarfCapGrad)" stroke="#450a0a" strokeWidth="1" />
          {/* Drooping bandanna tail 2 */}
          <path d="M 60 72 Q 46 85, 42 115 Q 48 118, 54 105 Q 56 92, 60 76 Z" fill="url(#dwarfCapGrad)" stroke="#450a0a" strokeWidth="1" />
        </g>

        {/* Mouth/Expression */}
        {isHurt || isDead ? (
          <ellipse cx="100" cy="108" rx="5" ry="7" fill="#1c0d0a" />
        ) : (
          <path d="M 95 106 Q 100 109 105 106" stroke="#1c0d0a" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        )}
      </motion.g>
    </motion.svg>
  );
}

function ElfSVG({ isHurt, isDead, isCrit, blink }: { isHurt: boolean; isDead: boolean; isCrit: boolean; blink: boolean }) {
  return (
    <motion.svg
      width="220"
      height="260"
      viewBox="0 0 200 250"
      className="overflow-visible"
      key={isDead ? "dead" : "alive"}
      initial={isDead ? { scale: 1, opacity: 1, y: 0, rotate: 0, x: 0 } : { y: -250, opacity: 0, scale: 0.7, rotate: 0, x: 0 }}
      animate={isDead ? {
        scaleY: 0.12,
        scaleX: 1.45,
        y: 110,
        rotate: -90,
        filter: "grayscale(0.8) brightness(0.4)",
        opacity: [1, 1, 0]
      } : isCrit ? {
        scaleY: [1, 0.40, 1.50, 0.70, 1.20, 1],
        scaleX: [1, 1.60, 0.50, 1.30, 0.80, 1],
        rotate: [0, 25, -20, 10, -5, 0],
        y: [0, 15, -12, 4, 0],
        filter: "brightness(2) contrast(1.5)",
        opacity: 1,
        scale: 1
      } : isHurt ? {
        scaleY: [1, 0.65, 1.28, 0.89, 1.04, 1],
        scaleX: [1, 1.34, 0.72, 1.10, 0.96, 1],
        rotate: [0, 15, -12, 6, -3, 0],
        y: [0, 8, -6, 2, 0],
        opacity: 1,
        scale: 1
      } : {
        y: 0,
        x: 0,
        scale: 1,
        opacity: 1,
        rotate: 0
      }}
      transition={isDead ? { duration: 0.45 } : isCrit ? { duration: 0.5, ease: "easeOut" } : isHurt ? { duration: 0.3, ease: "easeOut" } : { type: "spring", stiffness: 90, damping: 12 }}
    >
      <defs>
        {/* Soft Shadows */}
        <filter id="elf-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="5" stdDeviation="4" floodOpacity="0.5" />
        </filter>
        <filter id="elf-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.0" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Shading Gradients */}
        <radialGradient id="elfFaceGrad" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#fffbf4" />
          <stop offset="60%" stopColor="#ffe7c5" />
          <stop offset="90%" stopColor="#fda4af" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.5" />
        </radialGradient>

        <linearGradient id="elfHatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff4d4d" />
          <stop offset="60%" stopColor="#cc0000" />
          <stop offset="100%" stopColor="#800000" />
        </linearGradient>

        <linearGradient id="elfHatTrimGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#84cc16" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>

        <linearGradient id="elfBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#166534" />
        </linearGradient>

        <linearGradient id="elfCollarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#b91c1c" />
        </linearGradient>

        <radialGradient id="goldBellGrad" cx="35%" cy="35%" r="55%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="70%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#a16207" />
        </radialGradient>

        <linearGradient id="elfLegStripe" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#166534" />
          <stop offset="50%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#14532d" />
        </linearGradient>
      </defs>

      {/* Ground shadow (3D drop shadow) */}
      <ellipse cx="100" cy="236" rx="54" ry="9" fill="rgba(0,0,0,0.5)" filter="blur(1px)" />

      {/* IDLE BREATHING GROUP */}
      <motion.g
        animate={(!isDead && !isHurt && !isCrit) ? {
          y: [0, -4.5, 0],
          scaleY: [1, 1.025, 1],
          scaleX: [1, 0.98, 1]
        } : { y: 0, scaleY: 1, scaleX: 1 }}
        transition={{
          duration: 2.6,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        style={{ originX: "100px", originY: "220px" }}
      >
        {/* Slim Arms (Behind body) */}
        <g filter="url(#elf-shadow)">
          {/* Left slim arm */}
          <path d="M 72 112 C 54 125, 54 165, 62 180" stroke="url(#elfBodyGrad)" strokeWidth="12" strokeLinecap="round" fill="none" />
          {/* Right slim arm */}
          <path d="M 128 112 C 146 125, 146 165, 138 180" stroke="url(#elfBodyGrad)" strokeWidth="12" strokeLinecap="round" fill="none" />
          {/* Red spiky cuffs on gloves */}
          <circle cx="62" cy="181" r="7.5" fill="#ef4444" stroke="#991b1b" strokeWidth="1.2" />
          <circle cx="138" cy="181" r="7.5" fill="#ef4444" stroke="#991b1b" strokeWidth="1.2" />
        </g>

        {/* Elf Body (Slim, athletic jester tunic) */}
        <g filter="url(#elf-shadow)">
          <path d="M 72 110 Q 100 95 128 110 L 131 205 Q 100 216 69 205 Z" fill="url(#elfBodyGrad)" />
        </g>

        {/* Spiky Jester Collar around neck (Red points) */}
        <g filter="url(#elf-shadow)">
          <path d="M 68 110 L 78 128 L 88 113 L 98 134 L 108 113 L 118 128 L 132 110 L 120 104 L 100 107 L 80 104 Z" fill="url(#elfCollarGrad)" />
        </g>

        {/* Gold buttons down the middle of the tunic */}
        <circle cx="100" cy="142" r="4.5" fill="url(#goldBellGrad)" />
        <circle cx="100" cy="162" r="4.5" fill="url(#goldBellGrad)" />
        <circle cx="100" cy="182" r="4.5" fill="url(#goldBellGrad)" />

        {/* Brown Belt with rectangular gold buckle */}
        <g filter="url(#elf-shadow)">
          <rect x="69" y="193" width="62" height="10" fill="#3b2314" />
          {/* Gold belt buckle */}
          <rect x="92" y="188" width="16" height="20" fill="url(#goldBellGrad)" stroke="#78350f" strokeWidth="1" rx="1.5" />
          <rect x="96" y="192" width="8" height="12" fill="#3b2314" />
        </g>

        {/* Striped Green & White Leggings */}
        <g>
          {/* Left leg stripes */}
          <rect x="76" y="205" width="12" height="26" fill="#15803d" />
          <rect x="76" y="210" width="12" height="4.5" fill="#ffffff" />
          <rect x="76" y="219" width="12" height="4.5" fill="#ffffff" />

          {/* Right leg stripes */}
          <rect x="112" y="205" width="12" height="26" fill="#15803d" />
          <rect x="112" y="210" width="12" height="4.5" fill="#ffffff" />
          <rect x="112" y="219" width="12" height="4.5" fill="#ffffff" />
        </g>

        {/* Pointy Curled slippers/shoes with ankle trim */}
        <g filter="url(#elf-shadow)">
          {/* Left ankle red cuff */}
          <ellipse cx="82" cy="226" rx="9" ry="3.5" fill="#ef4444" />
          {/* Left curly slipper */}
          <path d="M 76 226 C 76 218, 44 214, 48 228 C 50 233, 76 238, 84 232 Z" fill="#15803d" stroke="#14532d" strokeWidth="0.8" />
          <circle cx="47.5" cy="225" r="2.8" fill="url(#goldBellGrad)" />

          {/* Right ankle red cuff */}
          <ellipse cx="118" cy="226" rx="9" ry="3.5" fill="#ef4444" />
          {/* Right curly slipper */}
          <path d="M 124 226 C 124 218, 156 214, 152 228 C 150 233, 124 238, 116 232 Z" fill="#15803d" stroke="#14532d" strokeWidth="0.8" />
          <circle cx="152.5" cy="225" r="2.8" fill="url(#goldBellGrad)" />
        </g>

        {/* Pointed Elf Ears (Long and highly prominent, pointing upwards/outwards) */}
        <g filter="url(#elf-shadow)">
          <path d="M 72 74 C 54 68, 22 42, 38 84 C 48 84, 62 82, 72 74 Z" fill="url(#elfFaceGrad)" stroke="#fda4af" strokeWidth="0.5" />
          <path d="M 66 73 C 58 70, 36 54, 45 79 Z" fill="#fda4af" opacity="0.5" />

          <path d="M 128 74 C 146 68, 178 42, 162 84 C 152 84, 138 82, 128 74 Z" fill="url(#elfFaceGrad)" stroke="#fda4af" strokeWidth="0.5" />
          <path d="M 134 73 C 142 70, 164 54, 155 79 Z" fill="#fda4af" opacity="0.5" />
        </g>

        {/* Round Head Base */}
        <circle cx="100" cy="76" r="30" fill="url(#elfFaceGrad)" stroke="#fda4af" strokeWidth="0.5" filter="url(#elf-shadow)" />

        {/* Cheek blush */}
        <circle cx="80" cy="85" r="6" fill="#f43f5e" opacity="0.22" filter="url(#elf-glow)" />
        <circle cx="120" cy="85" r="6" fill="#f43f5e" opacity="0.22" filter="url(#elf-glow)" />

        {/* Hair (Blonde locks overlapping face) */}
        <g filter="url(#elf-shadow)">
          <path d="M 70 56 C 80 48, 120 48, 130 56 C 120 62, 80 62, 70 56 Z" fill="#facc15" />
          <path d="M 70 56 Q 60 76, 66 90 Q 72 76, 72 56 Z" fill="#facc15" />
          <path d="M 130 56 Q 140 76, 134 90 Q 128 76, 128 56 Z" fill="#facc15" />
        </g>

        {/* Green vertical stitches/lines under eyes (jester face markings) */}
        <g opacity="0.8">
          <line x1="79" y1="56" x2="79" y2="66" stroke="#166534" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="79" y1="84" x2="79" y2="94" stroke="#166534" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="121" y1="56" x2="121" y2="66" stroke="#166534" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="121" y1="84" x2="121" y2="94" stroke="#166534" strokeWidth="2.2" strokeLinecap="round" />
        </g>

        {/* Soft pink nose */}
        <ellipse cx="100" cy="81" rx="4" ry="2.5" fill="#f43f5e" opacity="0.75" />

        {/* Eyes (Mischievous / squinty / smug half-closed eyes) */}
        <g>
          {isDead || isCrit ? (
            <>
              <path d="M 74 70 L 84 78 M 84 70 L 74 78" stroke="#1f2937" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 116 70 L 126 78 M 126 70 L 116 78" stroke="#1f2937" strokeWidth="2.5" strokeLinecap="round" />
            </>
          ) : isHurt ? (
            <>
              <path d="M 75 75 L 85 71 L 75 67" fill="none" stroke="#1f2937" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 125 75 L 115 71 L 125 67" fill="none" stroke="#1f2937" strokeWidth="2.5" strokeLinecap="round" />
            </>
          ) : (
            <>
              {/* White background and outline */}
              <circle cx="79" cy="74" r="8" fill="#ffffff" stroke="#166534" strokeWidth="1" />
              <circle cx="121" cy="74" r="8" fill="#ffffff" stroke="#166534" strokeWidth="1" />
              
              {/* Irises looking smugly sideways */}
              <circle cx="82" cy="74" r="4.5" fill="#166534" />
              <circle cx="118" cy="74" r="4.5" fill="#166534" />
              
              {/* Pupils */}
              <circle cx="82" cy="74" r="2.8" fill="#1f2937" />
              <circle cx="118" cy="74" r="2.8" fill="#1f2937" />
              
              {/* Highlights */}
              <circle cx="81" cy="72" r="1.2" fill="#ffffff" />
              <circle cx="117" cy="72" r="1.2" fill="#ffffff" />

              {/* Slanted eyelids for smug expression */}
              <path d="M 68 68 L 90 73 L 90 68 Z" fill="url(#elfFaceGrad)" />
              <path d="M 132 68 L 110 73 L 110 68 Z" fill="url(#elfFaceGrad)" />

              {/* Blink Eyelids */}
              <motion.path 
                d="M 69 66 Q 79 76 89 66 Z" 
                fill="url(#elfFaceGrad)"
                animate={blink ? { scaleY: 1 } : { scaleY: 0 }}
                style={{ originY: 0 }}
              />
              <motion.path 
                d="M 111 66 Q 121 76 131 66 Z" 
                fill="url(#elfFaceGrad)"
                animate={blink ? { scaleY: 1 } : { scaleY: 0 }}
                style={{ originY: 0 }}
              />
            </>
          )}
        </g>

        {/* Pointed Red Jester Hat with Green Crown Spiky Trim & Gold Bell */}
        <g filter="url(#elf-shadow)">
          {/* Curving Hat Dome */}
          <path d="M 68 62 C 82 20, 115 2, 136 10 C 146 14, 143 28, 134 26 C 118 22, 96 34, 82 65 Z" fill="url(#elfHatGrad)" stroke="#b91c1c" strokeWidth="0.5" />
          
          {/* Green Crown Spiky Trim */}
          <path d="M 68 62 L 76 51 L 86 62 L 96 51 L 106 62 L 116 51 L 126 62 L 132 67 L 100 64 L 68 67 Z" fill="url(#elfHatTrimGrad)" />

          {/* Gold Bell on Tip */}
          <circle cx="138" cy="13" r="7.5" fill="url(#goldBellGrad)" />
          <circle cx="135.5" cy="10.5" r="2.5" fill="#ffffff" opacity="0.6" />
        </g>

        {/* Smug Crooked Smile line */}
        {isHurt || isDead ? (
          <ellipse cx="100" cy="94" rx="5" ry="7" fill="#1f2937" />
        ) : (
          <g filter="url(#elf-shadow)">
            <path d="M 93 93 Q 98 89 108 92" stroke="#1f2937" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <path d="M 107 90 L 108 94" stroke="#1f2937" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        )}
      </motion.g>
    </motion.svg>
  );
}

export default function Arcade() {
  // Game states: 'select' | 'play'
  const [gameState, setGameState] = useState<"select" | "play">("select");
  const [playerChar, setPlayerChar] = useState<"dwarf" | "elf">("dwarf");
  
  // Stats
  const [targetHp, setTargetHp] = useState(100);
  const [maxHp] = useState(100);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [rage, setRage] = useState(0);
  const [totalHits, setTotalHits] = useState(0);
  const [defeats, setDefeats] = useState(0);

  const [arcadeUsername, setArcadeUsername] = useState<string>(() => localStorage.getItem("smg_arcade_username") || "");
  const [leaderboardWindow, setLeaderboardWindow] = useState<"daily" | "weekly" | "all-time">("all-time");
  const [leaderboardData, setLeaderboardData] = useState<any>(null);

  const fetchLeaderboard = () => {
    fetch(`/api/master/arcade/leaderboard?window=${leaderboardWindow}`)
      .then(res => {
        if (!res.ok) throw new Error("Leaderboard offline");
        return res.json();
      })
      .then(data => setLeaderboardData(data))
      .catch(err => console.warn(err.message));
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [leaderboardWindow]);

  // Weapon selected: 'punch' | 'slipper' | 'hammer' | 'bazooka' | 'nuke'
  const [activeWeapon, setActiveWeapon] = useState<"punch" | "slipper" | "hammer" | "bazooka" | "nuke">("punch");
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 150);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Visual effects states
  const [screenShake, setScreenShake] = useState(false);
  const [isHitStopped, setIsHitStopped] = useState(false);
  const [isSlowMo, setIsSlowMo] = useState(false);
  const [flashScreen, setFlashScreen] = useState(false);
  const [playerAttackAnim, setPlayerAttackAnim] = useState(false);
  const [targetHurtAnim, setTargetHurtAnim] = useState(false);
  const [targetDead, setTargetDead] = useState(false);
  const [spellEffect, setSpellEffect] = useState<"lightning" | "meteor" | "nuke" | null>(null);

  // Dynamic reaction text
  const [reactionBubble, setReactionBubble] = useState<string | null>(null);

  // Particles & floating texts
  const [particles, setParticles] = useState<Particle[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);

  // Timers
  const comboTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reactionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Achievements
  const [achievements, setAchievements] = useState<Achievement[]>([
    { id: "first_strike", title: "💥 First Strike", description: "Deliver your first hit to the target", unlocked: false },
    { id: "combo_king", title: "⚡ Combo King", description: "Achieve a 20x hit combo", unlocked: false },
    { id: "rage_overload", title: "🔥 Rage Overload", description: "Reach 100% on the Rage Meter", unlocked: false },
    { id: "slipper_master", title: "🩴 Slipper Master", description: "Unlock and attack with the legendary slipper", unlocked: false },
    { id: "bazooka_master", title: "🚀 Rocket Launcher", description: "Attack with the heavy Bazooka rocket", unlocked: false },
    { id: "tactical_nuke", title: "☢️ Nuclear Option", description: "Unleash the Tactical Upgrade Nuke", unlocked: false },
    { id: "unstoppable", title: "🏆 Refund Expert", description: "Defeat the target 5 times", unlocked: false },
  ]);

  // Load stats & achievements from local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("smg_arcade_save_v1");
      if (stored) {
        const parsed = JSON.parse(stored);
        setTotalHits(parsed.totalHits || 0);
        setMaxCombo(parsed.maxCombo || 0);
        setDefeats(parsed.defeats || 0);
        if (parsed.unlockedAchievements) {
          setAchievements(prev => prev.map(ach => ({
            ...ach,
            unlocked: parsed.unlockedAchievements.includes(ach.id)
          })));
        }
      }
    } catch (e) {
      console.error("Failed to load arcade storage:", e);
    }
  }, []);

  // Save stats & achievements helper
  const saveStats = (hits: number, defs: number, mCombo: number, currentAchievements: Achievement[]) => {
    try {
      const unlockedIds = currentAchievements.filter(a => a.unlocked).map(a => a.id);
      localStorage.setItem("smg_arcade_save_v1", JSON.stringify({
        totalHits: hits,
        defeats: defs,
        maxCombo: mCombo,
        unlockedAchievements: unlockedIds
      }));
    } catch (e) {
      console.error("Failed to save arcade progress:", e);
    }
  };

  // Unlock achievement helper
  const unlockAchievement = (id: string) => {
    setAchievements(prev => {
      const index = prev.findIndex(a => a.id === id);
      if (index !== -1 && !prev[index].unlocked) {
        const copy = [...prev];
        copy[index] = { ...copy[index], unlocked: true };
        
        // Show floating message
        triggerFloatingText(120, 150, `🏆 UNLOCKED: ${copy[index].title}!`, "#ffd700", 14, true);
        saveStats(totalHits, defeats, maxCombo, copy);
        return copy;
      }
      return prev;
    });
  };

  // Keep particle physics loop moving
  useEffect(() => {
    const interval = setInterval(() => {
      setParticles(prev => {
        if (prev.length === 0) return prev;
        return prev.map(p => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.15, // gravity
          alpha: p.alpha - 0.02
        })).filter(p => p.alpha > 0);
      });
    }, 16);
    return () => clearInterval(interval);
  }, []);

  // Clean combo timer when combo is 0
  useEffect(() => {
    if (combo > 0) {
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      comboTimerRef.current = setTimeout(() => {
        setCombo(0);
      }, 1800);
    }
    return () => {
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    };
  }, [combo]);

  // Spawn particles
  const spawnParticles = (x: number, y: number, color: string, count = 10) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1.5;
      newParticles.push({
        id: Math.random(),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2, // upwards bias
        color,
        size: Math.random() * 4 + 2,
        alpha: 1
      });
    }
    setParticles(prev => [...prev, ...newParticles].slice(-80));
  };

  // Spawn floating text
  const triggerFloatingText = (x: number, y: number, text: string, color: string, size = 16, isCrit = false) => {
    const id = Math.random();
    setFloatingTexts(prev => [...prev, { id, x, y, text, color, size, isCrit }]);
    setTimeout(() => {
      setFloatingTexts(prev => prev.filter(t => t.id !== id));
    }, 1000);
  };

  // Trigger funny visual sound bubble
  const getActionWord = (weapon: string) => {
    const punchWords = ["POW!", "WHACK!", "BAM!", "SMACK!", "THUD!"];
    const slipperWords = ["SLAP!", "CLACK!", "SLIPPER!", "WACK!", "QUACK!"];
    const hammerWords = ["CLANG!", "BOOM!", "SMASH!", "CRUSH!", "KABAM!"];
    const list = weapon === "slipper" ? slipperWords : (weapon === "hammer" ? hammerWords : punchWords);
    return list[Math.floor(Math.random() * list.length)];
  };

  const showBlacksmithReaction = () => {
    const reactions = [
      "No! Please! It was a 99% success rate!",
      "I swear it wasn't rigged!",
      "The next upgrade is guaranteed!",
      "Stop! Don't use the slipper!",
      playerChar === "dwarf" ? "I'm just a grumpy Dwarf!" : "I'm just a mischievous Elf!",
      "Your Asgardian Aegis has been refunded!",
      "No more nukes, please!",
      playerChar === "dwarf" ? "My shield is starting to crack!" : "My bells are starting to ring!",
      "I only follow the server database rules!",
      "Ouch! That is a critical hit!"
    ];

    // 25% chance of target talking back
    if (Math.random() < 0.35) {
      setReactionBubble(reactions[Math.floor(Math.random() * reactions.length)]);
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
      reactionTimerRef.current = setTimeout(() => {
        setReactionBubble(null);
      }, 1600);
    }
  };

  // Trigger weapon hit logic
  const handleAttack = () => {
    if (gameState === "select" || isHitStopped || targetDead) return;

    // Reset reaction
    if (Math.random() < 0.2) setReactionBubble(null);

    // Hit variables based on weapon
    let dmg = 2;
    let rageGain = 2.5;
    let shakeStrength = false;
    let hitStopDuration = 50;

    if (activeWeapon === "slipper") {
      dmg = 1.5;
      rageGain = 3;
      hitStopDuration = 35;
    } else if (activeWeapon === "hammer") {
      dmg = 7;
      rageGain = 6;
      shakeStrength = true;
      hitStopDuration = 80;
    } else if (activeWeapon === "bazooka") {
      dmg = 18;
      rageGain = 12;
      shakeStrength = true;
      hitStopDuration = 120;
    } else if (activeWeapon === "nuke") {
      dmg = 45;
      rageGain = 25;
      shakeStrength = true;
      hitStopDuration = 200;
    }

    // Critical check (15% base rate)
    const isCrit = Math.random() < 0.18;
    if (isCrit) {
      dmg *= 2.5;
      rageGain *= 2;
      shakeStrength = true;
      hitStopDuration += 40;
    }

    // Hit stop feeling
    setIsHitStopped(true);
    setTimeout(() => {
      setIsHitStopped(false);
    }, hitStopDuration);

    // Set anims
    setPlayerAttackAnim(true);
    setTargetHurtAnim(true);
    setTimeout(() => setPlayerAttackAnim(false), 120);
    setTimeout(() => setTargetHurtAnim(false), 150);

    // Screen Shake
    if (shakeStrength) {
      setScreenShake(true);
      setTimeout(() => setScreenShake(false), 200);
    }

    // Audio Playback
    if (isCrit) {
      playSound("crit");
    } else {
      if (activeWeapon === "bazooka") playSound("bazooka");
      else if (activeWeapon === "nuke") playSound("nuke");
      else playSound("hit");
    }

    // Update HP
    const nextHp = Math.max(targetHp - dmg, 0);
    setTargetHp(nextHp);

    // Update Stats
    const nextHits = totalHits + 1;
    setTotalHits(nextHits);

    const nextCombo = combo + 1;
    setCombo(nextCombo);
    if (nextCombo > maxCombo) {
      setMaxCombo(nextCombo);
    }
    // Combo blip sound every 5 combo ticks
    if (nextCombo % 5 === 0) {
      playSound("combo");
    }

    // Rage
    const nextRage = Math.min(rage + rageGain, 100);
    setRage(nextRage);

    // Container-relative Spawns
    const targetEl = document.getElementById("target-dummy-char");
    const containerEl = document.getElementById("battle-stage-container");
    let spawnX = 200;
    let spawnY = 150;
    if (targetEl && containerEl) {
      const rect = targetEl.getBoundingClientRect();
      const cRect = containerEl.getBoundingClientRect();
      spawnX = (rect.left + rect.width / 2) - cRect.left + (Math.random() * 20 - 10);
      spawnY = (rect.top + rect.height / 2) - cRect.top + (Math.random() * 20 - 10);
    }

    // Spawn Particles & Damage numbers
    spawnParticles(spawnX, spawnY, isCrit ? "#ffbf00" : "#ffffff", isCrit ? 15 : 6);
    triggerFloatingText(
      spawnX + (Math.random() * 30 - 15), 
      spawnY - 30, 
      Math.round(dmg * 10).toString(), 
      isCrit ? "#ffd700" : "#ffffff", 
      isCrit ? 26 : 16, 
      isCrit
    );

    // Floating combat word
    triggerFloatingText(
      spawnX - 50 + (Math.random() * 40 - 20),
      spawnY - 60,
      getActionWord(activeWeapon),
      activeWeapon === "slipper" ? "#e05a5a" : 
      (activeWeapon === "hammer" ? "#c9a84c" : 
      (activeWeapon === "bazooka" ? "#4ade80" : 
      (activeWeapon === "nuke" ? "#ef4444" : "#8ab4c9"))),
      isCrit ? 15 : 11
    );

    showBlacksmithReaction();

    // Achievements checks
    unlockAchievement("first_strike");
    if (nextCombo >= 20) unlockAchievement("combo_king");
    if (nextRage >= 100) unlockAchievement("rage_overload");
    if (activeWeapon === "slipper") unlockAchievement("slipper_master");
    if (activeWeapon === "bazooka") unlockAchievement("bazooka_master");

    saveStats(nextHits, defeats, Math.max(nextCombo, maxCombo), achievements);

    // Check defeat
    if (nextHp <= 0) {
      handleTargetDefeat(dmg);
    }
  };

  // Target defeat animation sequence
  const handleTargetDefeat = (finalDmg: number) => {
    setTargetDead(true);
    setReactionBubble("ARGH! Refund authorized!");
    playSound("kill");
    
    // Spawn massive gold coin particles
    const targetEl = document.getElementById("target-dummy-char");
    const containerEl = document.getElementById("battle-stage-container");
    if (targetEl && containerEl) {
      const rect = targetEl.getBoundingClientRect();
      const cRect = containerEl.getBoundingClientRect();
      const spawnX = (rect.left + rect.width / 2) - cRect.left;
      const spawnY = (rect.top + rect.height / 2) - cRect.top;
      spawnParticles(spawnX, spawnY, "#ffd700", 35);
    }

    const nextDefs = defeats + 1;
    setDefeats(nextDefs);

    // Trigger defeat achievements
    if (nextDefs >= 5) {
      unlockAchievement("unstoppable");
    }

    saveStats(totalHits, nextDefs, maxCombo, achievements);

    // Post score to backend Leaderboard
    if (arcadeUsername && arcadeUsername.trim().length > 0) {
      fetch("/api/master/arcade/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: arcadeUsername,
          dwarfKills: playerChar === "dwarf" ? 1 : 0,
          elfKills: playerChar === "elf" ? 1 : 0,
          totalKills: 1,
          highestCombo: Math.max(combo + 1, maxCombo),
          highestDps: Math.round(finalDmg * 10)
        })
      })
      .then(() => {
        fetchLeaderboard();
      })
      .catch(err => console.error("Failed to submit score:", err));
    }

    // Autoreset loop
    setTimeout(() => {
      setTargetHp(100);
      setTargetDead(false);
      setReactionBubble("I am back! Upgrades cost double now!");
    }, 2500);
  };

  // Trigger ultimate spells
  const castSpell = (spell: "lightning" | "meteor" | "nuke") => {
    if (gameState === "select" || targetDead) return;

    let cost = 50;
    let dmg = 15;
    if (spell === "meteor") { cost = 80; dmg = 30; }
    if (spell === "nuke") { cost = 100; dmg = 65; }

    if (rage < cost) return;

    setRage(prev => prev - cost);
    setSpellEffect(spell);

    // Set slow motion
    setIsSlowMo(true);
    setTimeout(() => setIsSlowMo(false), spell === "nuke" ? 500 : 250);

    // Trigger visual cues
    setScreenShake(true);
    setTimeout(() => setScreenShake(false), spell === "nuke" ? 600 : 300);

    if (spell === "nuke") {
      setFlashScreen(true);
      setTimeout(() => setFlashScreen(false), 250);
      unlockAchievement("tactical_nuke");
    }

    // Damage application
    setTimeout(() => {
      setTargetHurtAnim(true);
      const nextHp = Math.max(targetHp - dmg, 0);
      setTargetHp(nextHp);

      const targetEl = document.getElementById("target-dummy-char");
      let spawnX = 580;
      let spawnY = 220;
      if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        spawnX = rect.left + rect.width / 2;
        spawnY = rect.top + rect.height / 2;
      }

      spawnParticles(spawnX - 100, spawnY - 100, spell === "lightning" ? "#8ab4c9" : "#ff4500", 25);
      triggerFloatingText(
        spawnX - 100,
        spawnY - 150,
        `${Math.round(dmg * 10)}!`,
        spell === "nuke" ? "#ff0000" : "#ffd700",
        36,
        true
      );

      triggerFloatingText(
        spawnX - 150,
        spawnY - 190,
        spell === "nuke" ? "☢️ KABOOM!" : (spell === "meteor" ? "☄️ METEOR!" : "⚡ LIGHTNING!"),
        "#ffffff",
        18,
        true
      );

      setTargetHurtAnim(false);

      if (nextHp <= 0) {
        handleTargetDefeat(dmg);
      }
    }, spell === "nuke" ? 300 : 150);

    // Clean spell effect
    setTimeout(() => {
      setSpellEffect(null);
    }, 1200);
  };

  const getTargetLabel = () => {
    return playerChar === "dwarf" ? "DWARF" : "ELF";
  };

  // Keyboard shortcut listener (Space to smash target)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        handleAttack();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState, playerChar, targetHp, activeWeapon, rage, totalHits, defeats, achievements, targetDead, isHitStopped]);

  return (
    <div className={`min-h-screen text-white flex flex-col relative overflow-hidden font-sans bg-[#03050b] select-none ${screenShake ? "animate-shake" : ""}`}>
      <ParticleBackground />

      {/* Decorative neon back aura */}
      <div className="absolute top-[-10%] left-[50%] translate-x-[-50%] w-[900px] h-[350px] rounded-full bg-amber-500/3 blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-white/[0.04] px-6 py-4 flex items-center justify-between sticky top-0 z-20 bg-[#070b13]/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="font-black text-xs tracking-wider px-2 py-0.5 rounded bg-amber-500/25 border border-amber-500/35 text-amber-400">
            SM
          </span>
          <span className="text-white font-extrabold text-sm tracking-tight font-display">Arcade</span>
        </div>
        <div className="flex items-center gap-4">
          {arcadeUsername && (
            <div className="text-xs text-white/60 font-bold hidden md:block">
              Player: <span className="text-amber-400 font-extrabold">{arcadeUsername}</span>
              <button 
                onClick={() => {
                  localStorage.removeItem("smg_arcade_username");
                  setArcadeUsername("");
                  playSound("click");
                }}
                className="text-[10px] text-white/30 hover:text-red-400 font-black uppercase tracking-wider ml-2 transition-colors cursor-pointer"
              >
                (Edit Name)
              </button>
            </div>
          )}
          <Link href="/" className="text-white/40 hover:text-amber-400 text-xs font-bold uppercase tracking-widest transition-colors">
            ← Back to grading
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 flex flex-col gap-6 z-10 relative">
        <style>{`
          @keyframes screen-shake {
            0%, 100% { transform: translate(0, 0); }
            10% { transform: translate(-2px, 1.5px) rotate(-0.5deg); }
            20% { transform: translate(2px, -1.5px) rotate(0.5deg); }
            30% { transform: translate(-2px, -1.5px) rotate(-0.5deg); }
            40% { transform: translate(2px, 1.5px) rotate(0.5deg); }
            50% { transform: translate(-2px, 1.5px) rotate(-0.5deg); }
            60% { transform: translate(2px, -1.5px) rotate(0.5deg); }
            70% { transform: translate(-2px, -1.5px) rotate(-0.5deg); }
            80% { transform: translate(2px, 1.5px) rotate(0.5deg); }
            90% { transform: translate(-2px, 1.5px) rotate(-0.5deg); }
          }
          .animate-shake {
            animation: screen-shake 0.25s ease-in-out infinite;
          }
        `}</style>
        
        {/* Slow Mo Overlay */}
        <AnimatePresence>
          {isSlowMo && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.15 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#ffd700]/10 pointer-events-none z-30"
            />
          )}
        </AnimatePresence>

        {/* Nuke Flash Overlay */}
        <AnimatePresence>
          {flashScreen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-white z-50 pointer-events-none"
            />
          )}
        </AnimatePresence>

        {!arcadeUsername ? (
          /* NICKNAME ENTRY CARD */
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col justify-center items-center py-12 max-w-md mx-auto w-full space-y-8"
          >
            <div className="text-center space-y-2">
              <span className="text-amber-400 font-black text-[9px] uppercase tracking-widest font-mono font-display">Setup Player Profile</span>
              <h1 className="text-4xl font-black tracking-tight text-white font-display">WHO ARE YOU?</h1>
              <p className="text-white/40 text-xs max-w-xs mx-auto leading-relaxed">
                Enter a nickname to track your dwarf-bashing kills and compete on the global arcade leaderboards!
              </p>
            </div>

            <div className="w-full p-6 rounded-2xl border border-white/[0.04] bg-[#0c1020]/40 space-y-4 shadow-[0_0_50px_rgba(0,0,0,0.4)]">
              <div className="space-y-1">
                <label className="text-[10px] text-white/40 font-black uppercase tracking-wider font-mono">Arcade Nickname</label>
                <input 
                  id="arcade-username-input"
                  type="text"
                  placeholder="Enter username (3+ chars)..."
                  className="w-full px-4 py-3 rounded-xl border border-white/[0.05] bg-black/40 text-white font-extrabold text-sm focus:border-amber-500/50 outline-none transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val.length >= 3) {
                        localStorage.setItem("smg_arcade_username", val);
                        setArcadeUsername(val);
                        playSound("upgrade");
                      } else {
                        alert("Nickname must be at least 3 characters.");
                      }
                    }
                  }}
                />
              </div>

              <button 
                onClick={() => {
                  const input = document.getElementById("arcade-username-input") as HTMLInputElement;
                  const val = input?.value.trim() || "";
                  if (val.length >= 3) {
                    localStorage.setItem("smg_arcade_username", val);
                    setArcadeUsername(val);
                    playSound("upgrade");
                  } else {
                    alert("Nickname must be at least 3 characters.");
                  }
                }}
                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-black text-xs uppercase tracking-widest transition-all shadow-[0_4px_20px_rgba(245,158,11,0.25)] cursor-pointer"
              >
                Enter Arena
              </button>
            </div>
          </motion.div>
        ) : gameState === "select" ? (
          /* CHARACTER SELECTION */
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col justify-center items-center py-10 max-w-3xl mx-auto w-full space-y-8"
          >
            <div className="text-center space-y-2">
              <span className="text-amber-400 font-black text-[9px] uppercase tracking-widest font-mono">Stress Relief Parody Mini-game</span>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white font-display">SM REVENGE</h1>
              <p className="text-white/40 text-xs max-w-md mx-auto leading-relaxed">
                Tired of losing all your hard-earned gold to upgrade failures? Choose your target and release your stress!
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl">
              {/* Dwarf Card */}
              <div 
                onClick={() => { setPlayerChar("dwarf"); setGameState("play"); playSound("transition"); }}
                className="group relative p-6 rounded-2xl border border-white/[0.04] hover:border-amber-500/50 cursor-pointer bg-[#0c1020]/40 transition-all hover:shadow-[0_0_25px_rgba(245,158,11,0.15)] text-center flex flex-col justify-between"
              >
                <div>
                  <div className="h-44 w-full rounded-xl overflow-hidden bg-black/40 border border-white/5 relative flex items-center justify-center">
                    <div className="scale-75 translate-y-3 pointer-events-none">
                      <DwarfSVG isHurt={false} isDead={false} isCrit={false} blink={blink} />
                    </div>
                  </div>
                  <h3 className="text-lg font-extrabold text-white mt-4 font-display">DWARF</h3>
                  <p className="text-[11.5px] text-white/40 mt-1 font-semibold leading-relaxed mb-6">
                    A stocky, grumpy fantasy dwarf. Fails your 99% upgrades and hoards your gold. Bash him to get a full refund!
                  </p>
                </div>
                <button className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-black text-xs uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)] cursor-pointer">
                  Play as Dwarf
                </button>
              </div>

              {/* Elf Card */}
              <div 
                onClick={() => { setPlayerChar("elf"); setGameState("play"); playSound("transition"); }}
                className="group relative p-6 rounded-2xl border border-white/[0.04] hover:border-emerald-500/50 cursor-pointer bg-[#0c1020]/40 transition-all hover:shadow-[0_0_25px_rgba(16,185,129,0.15)] text-center flex flex-col justify-between"
              >
                <div>
                  <div className="h-44 w-full rounded-xl overflow-hidden bg-black/40 border border-white/5 relative flex items-center justify-center">
                    <div className="scale-75 translate-y-3 pointer-events-none">
                      <ElfSVG isHurt={false} isDead={false} isCrit={false} blink={blink} />
                    </div>
                  </div>
                  <h3 className="text-lg font-extrabold text-white mt-4 font-display">ELF</h3>
                  <p className="text-[11.5px] text-white/40 mt-1 font-semibold leading-relaxed mb-6">
                    A slim, mischievous elf. Smugs constantly and wastes your valuable materials. Give him a good slap!
                  </p>
                </div>
                <button className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(16,185,129,0.15)] cursor-pointer">
                  Play as Elf
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          /* GAME LOOP SCREEN */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* GAMEBOARD COLUMN */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* STATUS HEADER PANEL */}
              <div className="p-4 rounded-xl border border-white/[0.04] bg-[#070b13]/60 glass-panel flex justify-between items-center text-xs">
                <div className="space-y-1">
                  <div className="text-white/40 text-[9px] font-black uppercase tracking-wider font-mono">Target Health</div>
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-white font-display text-sm">{getTargetLabel()}</span>
                    <span className="font-bold text-red-400 font-mono text-xs">{targetHp > 0 ? `${targetHp}% HP` : "DEFEATED"}</span>
                  </div>
                  <div className="w-56 h-2.5 bg-black/50 border border-white/5 rounded-full overflow-hidden relative">
                    {/* Ghost/Drain health bar behind */}
                    <motion.div 
                      animate={{ width: `${targetHp}%` }}
                      transition={{ type: "tween", duration: 0.6, ease: "easeOut" }}
                      className="absolute left-0 top-0 h-full bg-red-800/80"
                    />
                    {/* Main health bar in front */}
                    <motion.div 
                      animate={{ width: `${targetHp}%` }}
                      transition={{ type: "spring", stiffness: 120, damping: 15 }}
                      className="absolute left-0 top-0 h-full bg-gradient-to-r from-red-500 via-orange-500 to-amber-400 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                    />
                  </div>
                </div>

                <div className="flex gap-4 font-mono text-right">
                  <div>
                    <div className="text-white/40 text-[8px] font-black uppercase">Combo Tracker</div>
                    <span className={`text-xl font-black ${combo > 10 ? "text-[#ffd700] animate-pulse" : "text-white"}`}>{combo}x</span>
                  </div>
                  <div>
                    <div className="text-white/40 text-[8px] font-black uppercase">Rage Meter</div>
                    <span className={`text-xl font-black ${rage >= 100 ? "text-[#ff4500]" : "text-red-400"}`}>{Math.round(rage)}%</span>
                  </div>
                  <div>
                    <div className="text-white/40 text-[8px] font-black uppercase">Defeats</div>
                    <span className="text-xl font-black text-[#5ecb7a]">{defeats}</span>
                  </div>
                </div>
              </div>

              {/* GAME BATTLE SCREEN AREA */}
              <div 
                onClick={handleAttack}
                className="relative h-[320px] rounded-2xl border border-white/[0.04] bg-[#03050b]/80 flex items-center justify-center overflow-hidden p-8 cursor-pointer group shadow-[inset_0_4px_30px_rgba(0,0,0,0.8)]"
              >
                {/* Background lighting flare */}
                <div className="absolute inset-0 bg-[#000]/10 pointer-events-none" />

                {/* Spell Visual FX Render */}
                {spellEffect === "lightning" && (
                  <motion.div 
                    initial={{ opacity: 0, scaleY: 0 }}
                    animate={{ opacity: [1, 0, 1, 0], scaleY: 1 }}
                    transition={{ duration: 0.5 }}
                    className="absolute top-0 bottom-0 left-[48%] w-10 bg-gradient-to-r from-blue-400 to-cyan-300 z-20 origin-top shadow-[0_0_25px_rgba(56,189,248,0.8)]"
                  />
                )}
                {spellEffect === "meteor" && (
                  <motion.div 
                    initial={{ x: -150, y: -150, opacity: 0 }}
                    animate={{ x: 0, y: 0, opacity: [1, 1, 0] }}
                    transition={{ duration: 0.4 }}
                    className="absolute w-20 h-20 bg-orange-600 rounded-full border-2 border-yellow-300 z-20 shadow-[0_0_40px_rgba(249,115,22,0.9)]"
                  />
                )}
                {spellEffect === "nuke" && (
                  <motion.div 
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [1, 15], opacity: [1, 0.8, 0] }}
                    transition={{ duration: 0.8 }}
                    className="absolute top-[50%] left-[50%] -translate-x-[50%] -translate-y-[50%] w-10 h-10 bg-radial from-[#ff4500] to-transparent rounded-full z-20 shadow-[0_0_80px_rgba(255,69,0,1)]"
                  />
                )}

                {/* Particles rendering */}
                {particles.map(p => (
                  <div 
                    key={p.id}
                    className="absolute rounded-full pointer-events-none z-30"
                    style={{
                      left: p.x,
                      top: p.y,
                      width: p.size,
                      height: p.size,
                      backgroundColor: p.color,
                      opacity: p.alpha,
                      transform: "translate(-50%, -50%)"
                    }}
                  />
                ))}

                {/* Floating combat numbers */}
                {floatingTexts.map(t => (
                  <motion.span 
                    key={t.id}
                    initial={{ opacity: 1, y: t.y, scale: t.isCrit ? 1.4 : 1 }}
                    animate={{ opacity: 0, y: t.y - 60, scale: t.isCrit ? 1.8 : 0.8 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="absolute pointer-events-none z-45 font-black font-display tracking-wide drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
                    style={{
                      left: t.x,
                      color: t.color,
                      fontSize: t.size,
                    }}
                  >
                    {t.text}
                  </motion.span>
                ))}

                {/* Strike Weapon Overlays */}
                <AnimatePresence>
                  {playerAttackAnim && activeWeapon === "punch" && (
                    <motion.div
                      key="glove"
                      initial={{ scale: 0.4, rotate: -40, opacity: 0 }}
                      animate={{ scale: [0.4, 1.4, 1], rotate: [ -40, 10, 0 ], opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                      className="absolute pointer-events-none z-40 text-6xl"
                    >
                      🥊
                    </motion.div>
                  )}
                  {playerAttackAnim && activeWeapon === "slipper" && (
                    <motion.div
                      key="slip"
                      initial={{ scale: 0.4, rotate: -70, x: -60, opacity: 0 }}
                      animate={{ scale: [0.4, 1.5, 1], rotate: [ -70, 30, 0 ], x: [ -60, 20, 0 ], opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                      className="absolute pointer-events-none z-40 text-6xl"
                    >
                      🩴
                    </motion.div>
                  )}
                  {playerAttackAnim && activeWeapon === "hammer" && (
                    <motion.div
                      key="ham"
                      initial={{ scale: 0.4, rotate: -90, y: -60, opacity: 0 }}
                      animate={{ scale: [0.4, 1.6, 1], rotate: [ -90, 20, 0 ], y: [ -60, 10, 0 ], opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="absolute pointer-events-none z-40 text-6xl"
                    >
                      🔨
                    </motion.div>
                  )}
                  {playerAttackAnim && activeWeapon === "bazooka" && (
                    <motion.div
                      key="baz"
                      initial={{ scale: 0.2, y: 80, x: -80, opacity: 0 }}
                      animate={{ scale: [0.2, 1.5, 1], y: [ 80, -20, 0 ], x: [ -80, 20, 0 ], opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="absolute pointer-events-none z-40 text-7xl"
                    >
                      🚀
                    </motion.div>
                  )}
                  {playerAttackAnim && activeWeapon === "nuke" && (
                    <motion.div
                      key="nuk"
                      initial={{ scale: 0.1, y: -150, opacity: 0 }}
                      animate={{ scale: [0.1, 1.8, 1], y: [ -150, 0, 0 ], opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="absolute pointer-events-none z-40 text-8xl"
                    >
                      ☢️
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Dizzy stars above head */}
                {(targetDead || targetHurtAnim) && (
                  <div className="absolute top-[10%] left-[50%] -translate-x-[50%] flex gap-1 z-35 pointer-events-none">
                    <span className="text-xl animate-spin">💫</span>
                    <span className="text-xl animate-spin [animation-delay:0.1s]">💫</span>
                    <span className="text-xl animate-spin [animation-delay:0.2s]">💫</span>
                  </div>
                )}

                {/* Defeated Text Banner */}
                {targetHp <= 0 && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 1.3, 1], opacity: 1 }}
                    className="absolute pointer-events-none z-45 font-black font-display text-4xl text-red-500 uppercase tracking-widest drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]"
                  >
                    DEFEATED!
                  </motion.div>
                )}

                {/* Click action indicator */}
                <div className="absolute top-3 left-4 text-[9px] font-mono text-white/20 tracking-wider">
                  PRESS SPACEBAR OR CLICK SCREEN TO SMASH
                </div>

                {/* TARGET CHARACTER (DWARF or ELF) */}
                <div className="relative flex flex-col items-center justify-center">
                  {/* Reaction Bubble */}
                  <AnimatePresence>
                    {reactionBubble && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute bottom-56 w-48 p-2 rounded-xl bg-white text-black font-semibold text-[10.5px] text-center shadow-xl border border-amber-400 z-35"
                      >
                        <div className="absolute bottom-[-6px] left-[50%] -translate-x-[50%] w-3 h-3 bg-white border-r border-b border-amber-400 rotate-45" />
                        {reactionBubble}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div id="target-dummy-char" className="relative flex items-center justify-center">
                    {playerChar === "dwarf" ? (
                      <DwarfSVG 
                        isHurt={targetHurtAnim} 
                        isDead={targetDead} 
                        isCrit={combo > 5 && Math.random() < 0.25} 
                        blink={blink} 
                      />
                    ) : (
                      <ElfSVG 
                        isHurt={targetHurtAnim} 
                        isDead={targetDead} 
                        isCrit={combo > 5 && Math.random() < 0.25} 
                        blink={blink} 
                      />
                    )}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#ffd700] mt-2 font-mono">{getTargetLabel()}</span>
                </div>

              </div>

              {/* WEAPONS & SPELLS CONTROL PANEL */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* WEAPONS SELECTION */}
                <div className="p-5 rounded-xl border border-white/[0.04] bg-[#070b13]/60 glass-panel space-y-3">
                  <div className="text-[10px] text-white/40 font-black uppercase tracking-wider font-mono">Select Weapon</div>
                  <div className="grid grid-cols-3 xl:grid-cols-5 gap-2">
                    <button 
                      onClick={() => { setActiveWeapon("punch"); playSound("click"); }}
                      className={`p-3 rounded-lg border text-center transition-all cursor-pointer ${
                        activeWeapon === "punch" 
                          ? "border-[#8ab4c9] bg-[#8ab4c9]/10 text-white font-extrabold" 
                          : "border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.03]"
                      }`}
                    >
                      <div className="text-xl">👊</div>
                      <div className="text-[9px] uppercase tracking-wider mt-1">Fists</div>
                      <div className="text-[8px] text-white/30">Fast · 1.0x</div>
                    </button>

                    <button 
                      onClick={() => { setActiveWeapon("slipper"); playSound("click"); }}
                      disabled={totalHits < 40 && defeats === 0}
                      className={`p-3 rounded-lg border text-center transition-all cursor-pointer ${
                        activeWeapon === "slipper" 
                          ? "border-[#e05a5a] bg-[#e05a5a]/10 text-white font-extrabold" 
                          : "border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.03] disabled:opacity-20 disabled:cursor-not-allowed"
                      }`}
                    >
                      <div className="text-xl">🩴</div>
                      <div className="text-[9px] uppercase tracking-wider mt-1">Slipper</div>
                      <div className="text-[8px] text-[#e05a5a]">{totalHits < 40 && defeats === 0 ? "40 Hits Required" : "Slap · 1.5x"}</div>
                    </button>

                    <button 
                      onClick={() => { setActiveWeapon("hammer"); playSound("click"); }}
                      disabled={totalHits < 120 && defeats < 2}
                      className={`p-3 rounded-lg border text-center transition-all cursor-pointer ${
                        activeWeapon === "hammer" 
                          ? "border-[#c9a84c] bg-[#c9a84c]/10 text-white font-extrabold" 
                          : "border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.03] disabled:opacity-20 disabled:cursor-not-allowed"
                      }`}
                    >
                      <div className="text-xl">🔨</div>
                      <div className="text-[9px] uppercase tracking-wider mt-1">Hammer</div>
                      <div className="text-[8px] text-[#c9a84c]">{totalHits < 120 && defeats < 2 ? "120 Hits / 2 Wins" : "Smash · 3.5x"}</div>
                    </button>

                    <button 
                      onClick={() => { setActiveWeapon("bazooka"); playSound("click"); }}
                      disabled={totalHits < 200 && defeats < 3}
                      className={`p-3 rounded-lg border text-center transition-all cursor-pointer ${
                        activeWeapon === "bazooka" 
                          ? "border-[#4ade80] bg-[#4ade80]/10 text-white font-extrabold" 
                          : "border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.03] disabled:opacity-20 disabled:cursor-not-allowed"
                      }`}
                    >
                      <div className="text-xl">🚀</div>
                      <div className="text-[9px] uppercase tracking-wider mt-1">Bazooka</div>
                      <div className="text-[8px] text-[#4ade80]">{totalHits < 200 && defeats < 3 ? "200 Hits / 3 Wins" : "Blast · 9.0x"}</div>
                    </button>

                    <button 
                      onClick={() => { setActiveWeapon("nuke"); playSound("click"); }}
                      disabled={totalHits < 350 && defeats < 5}
                      className={`p-3 rounded-lg border text-center transition-all cursor-pointer ${
                        activeWeapon === "nuke" 
                          ? "border-[#ef4444] bg-[#ef4444]/10 text-white font-extrabold" 
                          : "border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.03] disabled:opacity-20 disabled:cursor-not-allowed"
                      }`}
                    >
                      <div className="text-xl">☢️</div>
                      <div className="text-[9px] uppercase tracking-wider mt-1">Nuke</div>
                      <div className="text-[8px] text-[#ef4444]">{totalHits < 350 && defeats < 5 ? "350 Hits / 5 Wins" : "Doomsday · 22.5x"}</div>
                    </button>
                  </div>
                </div>

                {/* ULTIMATE RAGE SPELLS */}
                <div className="p-5 rounded-xl border border-white/[0.04] bg-[#070b13]/60 glass-panel space-y-3">
                  <div className="text-[10px] text-white/40 font-black uppercase tracking-wider font-mono">Ultimate Rage Spells</div>
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => castSpell("lightning")}
                      disabled={rage < 50}
                      className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-center transition-all cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <div className="text-xl">⚡</div>
                      <div className="text-[9px] font-extrabold uppercase mt-1">Lightning</div>
                      <div className="text-[8px] text-blue-400">50% Rage</div>
                    </button>

                    <button 
                      onClick={() => castSpell("meteor")}
                      disabled={rage < 80}
                      className="p-3 rounded-lg border border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10 text-center transition-all cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <div className="text-xl">☄️</div>
                      <div className="text-[9px] font-extrabold uppercase mt-1">Meteor</div>
                      <div className="text-[8px] text-orange-400">80% Rage</div>
                    </button>

                    <button 
                      onClick={() => castSpell("nuke")}
                      disabled={rage < 100}
                      className="p-3 rounded-lg border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 text-center transition-all cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed animate-pulse"
                    >
                      <div className="text-xl">☢️</div>
                      <div className="text-[9px] font-extrabold uppercase mt-1">Nuke</div>
                      <div className="text-[8px] text-red-400">100% Rage</div>
                    </button>
                  </div>
                </div>

              </div>

            </div>

            {/* STATS & ACHIEVEMENTS PANEL */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* ARCADE TRACKER */}
              <div className="p-5 rounded-xl border border-white/[0.04] bg-[#070b13]/60 glass-panel space-y-4">
                <div className="text-xs font-black text-white uppercase tracking-widest border-b border-white/[0.04] pb-2">ARCADE DOSSIER</div>
                
                <div className="space-y-3 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-white/40">Target Name</span>
                    <span className="text-white font-bold">{playerChar === "dwarf" ? "DWARF" : "ELF"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Total Hits Landed</span>
                    <span className="text-amber-400 font-bold">{totalHits.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Max Hit Combo</span>
                    <span className="text-amber-400 font-bold">{maxCombo}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Wins / Defeats</span>
                    <span className="text-[#5ecb7a] font-bold">{defeats}</span>
                  </div>
                </div>

                <button 
                  onClick={() => setGameState("select")}
                  className="w-full py-2.5 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-all"
                >
                  Change Target
                </button>
              </div>

              {/* LIVE LEADERBOARDS */}
              <div className="p-5 rounded-xl border border-white/[0.04] bg-[#070b13]/60 glass-panel space-y-3">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-1">
                  <div className="text-xs font-black bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-500 bg-clip-text text-transparent uppercase tracking-wider flex items-center gap-1.5">
                    🏆 Global Leaderboards
                  </div>
                  <div className="flex gap-1">
                    {(["daily", "weekly", "all-time"] as const).map(w => (
                      <button
                        key={w}
                        onClick={(e) => { e.stopPropagation(); setLeaderboardWindow(w); playSound("click"); }}
                        className={`px-2 py-0.5 rounded text-[8px] uppercase font-black tracking-wider transition-all cursor-pointer ${
                          leaderboardWindow === w 
                            ? "bg-amber-500/25 border border-amber-500/40 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]" 
                            : "bg-white/[0.02] border border-white/[0.03] text-white/40 hover:text-white"
                        }`}
                      >
                        {w === "all-time" ? "All" : (w === "weekly" ? "Week" : "Day")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Categories */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Total Kills */}
                  <div className="space-y-1.5 p-3 rounded-xl border border-white/[0.03] bg-black/10 hover:border-amber-500/10 transition-all">
                    <div className="text-[9px] text-white/40 font-extrabold uppercase tracking-wider flex items-center gap-1 font-mono">
                      ☠️ Total Kills
                    </div>
                    <div className="space-y-1 min-h-[100px] max-h-[140px] overflow-y-auto pr-1">
                      {leaderboardData?.totalKills && leaderboardData.totalKills.length > 0 ? (
                        leaderboardData.totalKills.map((entry: any, index: number) => {
                          const isMe = entry.username.toLowerCase() === arcadeUsername.toLowerCase();
                          return (
                            <div key={index} className={`flex items-center justify-between text-[11px] py-1 border-b border-white/[0.02] last:border-0 font-mono transition-all ${
                              isMe ? "bg-amber-500/15 border-l-2 border-l-amber-500 px-2 rounded-r shadow-[0_0_8px_rgba(245,158,11,0.08)]" : "px-1"
                            }`}>
                              <div className="flex items-center gap-2 font-sans">
                                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${
                                  index === 0 ? "bg-[#ffd700]/25 text-[#ffd700] border border-[#ffd700]/40" : 
                                  (index === 1 ? "bg-[#c0c0c0]/25 text-[#c0c0c0] border border-[#c0c0c0]/40" : 
                                  (index === 2 ? "bg-[#cd7f32]/25 text-[#cd7f32] border border-[#cd7f32]/40" : "text-white/20"))
                                }`}>{index + 1}</span>
                                <span className={`font-semibold ${isMe ? "text-amber-300 font-bold" : "text-white/80"}`}>{entry.username}</span>
                              </div>
                              <span className={`font-black ${isMe ? "text-amber-400" : (index === 0 ? "text-[#ffd700]" : "text-amber-500/80")}`}>{entry.score}</span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-[10px] text-white/20 text-center py-4 font-mono">No records yet</div>
                      )}
                    </div>
                  </div>

                  {/* Highest Combo */}
                  <div className="space-y-1.5 p-3 rounded-xl border border-white/[0.03] bg-black/10 hover:border-amber-500/10 transition-all">
                    <div className="text-[9px] text-white/40 font-extrabold uppercase tracking-wider flex items-center gap-1 font-mono">
                      ⚡ Max Combo
                    </div>
                    <div className="space-y-1 min-h-[100px] max-h-[140px] overflow-y-auto pr-1">
                      {leaderboardData?.highestCombo && leaderboardData.highestCombo.length > 0 ? (
                        leaderboardData.highestCombo.map((entry: any, index: number) => {
                          const isMe = entry.username.toLowerCase() === arcadeUsername.toLowerCase();
                          return (
                            <div key={index} className={`flex items-center justify-between text-[11px] py-1 border-b border-white/[0.02] last:border-0 font-mono transition-all ${
                              isMe ? "bg-amber-500/15 border-l-2 border-l-amber-500 px-2 rounded-r shadow-[0_0_8px_rgba(245,158,11,0.08)]" : "px-1"
                            }`}>
                              <div className="flex items-center gap-2 font-sans">
                                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${
                                  index === 0 ? "bg-[#ffd700]/25 text-[#ffd700] border border-[#ffd700]/40" : 
                                  (index === 1 ? "bg-[#c0c0c0]/25 text-[#c0c0c0] border border-[#c0c0c0]/40" : 
                                  (index === 2 ? "bg-[#cd7f32]/25 text-[#cd7f32] border border-[#cd7f32]/40" : "text-white/20"))
                                }`}>{index + 1}</span>
                                <span className={`font-semibold ${isMe ? "text-amber-300 font-bold" : "text-white/80"}`}>{entry.username}</span>
                              </div>
                              <span className={`font-black ${isMe ? "text-cyan-300" : (index === 0 ? "text-[#ffd700]" : "text-cyan-400/80")}`}>{entry.score}x</span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-[10px] text-white/20 text-center py-4 font-mono">No records yet</div>
                      )}
                    </div>
                  </div>

                  {/* Most Dwarf Kills */}
                  <div className="space-y-1.5 p-3 rounded-xl border border-white/[0.03] bg-black/10 hover:border-amber-500/10 transition-all">
                    <div className="text-[9px] text-white/40 font-extrabold uppercase tracking-wider flex items-center gap-1 font-mono">
                      🧔 Dwarf Kills
                    </div>
                    <div className="space-y-1 min-h-[100px] max-h-[140px] overflow-y-auto pr-1">
                      {leaderboardData?.dwarfKills && leaderboardData.dwarfKills.length > 0 ? (
                        leaderboardData.dwarfKills.map((entry: any, index: number) => {
                          const isMe = entry.username.toLowerCase() === arcadeUsername.toLowerCase();
                          return (
                            <div key={index} className={`flex items-center justify-between text-[11px] py-1 border-b border-white/[0.02] last:border-0 font-mono transition-all ${
                              isMe ? "bg-amber-500/15 border-l-2 border-l-amber-500 px-2 rounded-r shadow-[0_0_8px_rgba(245,158,11,0.08)]" : "px-1"
                            }`}>
                              <div className="flex items-center gap-2 font-sans">
                                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${
                                  index === 0 ? "bg-[#ffd700]/25 text-[#ffd700] border border-[#ffd700]/40" : 
                                  (index === 1 ? "bg-[#c0c0c0]/25 text-[#c0c0c0] border border-[#c0c0c0]/40" : 
                                  (index === 2 ? "bg-[#cd7f32]/25 text-[#cd7f32] border border-[#cd7f32]/40" : "text-white/20"))
                                }`}>{index + 1}</span>
                                <span className={`font-semibold ${isMe ? "text-amber-300 font-bold" : "text-white/80"}`}>{entry.username}</span>
                              </div>
                              <span className={`font-black ${isMe ? "text-amber-400" : (index === 0 ? "text-[#ffd700]" : "text-amber-500/80")}`}>{entry.score}</span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-[10px] text-white/20 text-center py-4 font-mono">No records yet</div>
                      )}
                    </div>
                  </div>

                  {/* Most Elf Kills */}
                  <div className="space-y-1.5 p-3 rounded-xl border border-white/[0.03] bg-black/10 hover:border-amber-500/10 transition-all">
                    <div className="text-[9px] text-white/40 font-extrabold uppercase tracking-wider flex items-center gap-1 font-mono">
                      🧝 Elf Kills
                    </div>
                    <div className="space-y-1 min-h-[100px] max-h-[140px] overflow-y-auto pr-1">
                      {leaderboardData?.elfKills && leaderboardData.elfKills.length > 0 ? (
                        leaderboardData.elfKills.map((entry: any, index: number) => {
                          const isMe = entry.username.toLowerCase() === arcadeUsername.toLowerCase();
                          return (
                            <div key={index} className={`flex items-center justify-between text-[11px] py-1 border-b border-white/[0.02] last:border-0 font-mono transition-all ${
                              isMe ? "bg-amber-500/15 border-l-2 border-l-amber-500 px-2 rounded-r shadow-[0_0_8px_rgba(245,158,11,0.08)]" : "px-1"
                            }`}>
                              <div className="flex items-center gap-2 font-sans">
                                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${
                                  index === 0 ? "bg-[#ffd700]/25 text-[#ffd700] border border-[#ffd700]/40" : 
                                  (index === 1 ? "bg-[#c0c0c0]/25 text-[#c0c0c0] border border-[#c0c0c0]/40" : 
                                  (index === 2 ? "bg-[#cd7f32]/25 text-[#cd7f32] border border-[#cd7f32]/40" : "text-white/20"))
                                }`}>{index + 1}</span>
                                <span className={`font-semibold ${isMe ? "text-amber-300 font-bold" : "text-white/80"}`}>{entry.username}</span>
                              </div>
                              <span className={`font-black ${isMe ? "text-emerald-300" : (index === 0 ? "text-[#ffd700]" : "text-emerald-400/80")}`}>{entry.score}</span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-[10px] text-white/20 text-center py-4 font-mono">No records yet</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* REVENGE ACHIEVEMENTS */}
              <div className="p-5 rounded-xl border border-white/[0.04] bg-[#070b13]/60 glass-panel space-y-3">
                <div className="text-xs font-black text-white uppercase tracking-widest border-b border-white/[0.04] pb-2">CHALLENGES</div>
                
                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {achievements.map(ach => (
                    <div 
                      key={ach.id} 
                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-all ${
                        ach.unlocked 
                          ? "border-[#5ecb7a]/20 bg-[#5ecb7a]/5 text-white" 
                          : "border-white/[0.02] bg-black/20 text-white/30"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="font-extrabold text-[10px] uppercase tracking-wide">{ach.title}</div>
                        <div className="text-[9px] font-semibold opacity-60">{ach.description}</div>
                      </div>
                      {ach.unlocked ? (
                        <span className="text-[#5ecb7a] font-black text-[10px]">✓</span>
                      ) : (
                        <span className="text-white/20 font-black text-[10px]">🔒</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        )}

      </main>

      <footer className="border-t border-white/[0.03] bg-[#070b13]/60 px-6 py-5 text-center text-white/20 text-[9px] font-bold uppercase tracking-widest z-10 mt-auto">
        SMGrade Arcade · Parody stress-relief sandbox · Built for SwordMasters
      </footer>
    </div>
  );
}
