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

function DwarfSVG({ isHurt, isDead, isCrit, blink }: { isHurt: boolean; isDead: boolean; isCrit: boolean; blink: boolean }) {
  return (
    <motion.svg
      width="220"
      height="260"
      viewBox="0 0 200 250"
      className="overflow-visible"
      animate={isDead ? {
        scaleY: 0.12,
        scaleX: 1.45,
        y: 95,
        rotate: 90,
        filter: "grayscale(0.7) brightness(0.5)"
      } : isHurt ? {
        scaleY: [1, 0.62, 1.32, 0.88, 1.05, 1],
        scaleX: [1, 1.38, 0.68, 1.12, 0.95, 1],
        rotate: [0, -15, 12, -6, 3, 0],
        y: [0, 8, -6, 2, 0]
      } : {
        y: [0, -4, 0],
        scaleY: [1, 1.04, 1],
        scaleX: [1, 0.98, 1]
      }}
      transition={isDead ? { duration: 0.4 } : isHurt ? { duration: 0.28, ease: "easeOut" } : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
    >
      <defs>
        {/* Soft Drop Shadows */}
        <filter id="dwarf-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.45" />
        </filter>
        <filter id="dwarf-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Shading Gradients */}
        <radialGradient id="dwarfFaceGrad" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#fff5eb" />
          <stop offset="45%" stopColor="#fed7aa" />
          <stop offset="85%" stopColor="#f97316" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#c2410c" />
        </radialGradient>

        <linearGradient id="dwarfSkinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffe4e6" />
          <stop offset="60%" stopColor="#fed7aa" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0.9" />
        </linearGradient>

        <linearGradient id="dwarfHandleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4e271b" />
          <stop offset="50%" stopColor="#803e29" />
          <stop offset="100%" stopColor="#2c140d" />
        </linearGradient>

        <radialGradient id="dwarfNoseGrad" cx="35%" cy="35%" r="55%">
          <stop offset="0%" stopColor="#ffedd5" />
          <stop offset="70%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#9a3412" />
        </radialGradient>

        <linearGradient id="dwarfCapGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="40%" stopColor="#b91c1c" />
          <stop offset="100%" stopColor="#450a0a" />
        </linearGradient>

        <linearGradient id="dwarfBeardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#a1887f" />
          <stop offset="25%" stopColor="#6d4c41" />
          <stop offset="75%" stopColor="#4e342e" />
          <stop offset="100%" stopColor="#271510" />
        </linearGradient>

        <linearGradient id="dwarfBeardHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#bcaaa4" />
          <stop offset="100%" stopColor="#5d4037" />
        </linearGradient>

        <linearGradient id="dwarfTunic" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3e2723" />
          <stop offset="100%" stopColor="#1d0c08" />
        </linearGradient>

        <linearGradient id="dwarfApron" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#d7ccc8" />
          <stop offset="100%" stopColor="#8d6e63" />
        </linearGradient>

        <linearGradient id="dwarfGoldBuckle" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="60%" stopColor="#ca8a04" />
          <stop offset="100%" stopColor="#854d0e" />
        </linearGradient>

        <linearGradient id="dwarfBoot" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#5d4037" />
          <stop offset="100%" stopColor="#1c0d0a" />
        </linearGradient>
      </defs>

      {/* Ground shadow (3D drop shadow) */}
      <ellipse cx="100" cy="236" rx="66" ry="11" fill="rgba(0,0,0,0.5)" filter="blur(1px)" />

      {/* Wooden handle stick behind back */}
      <path d="M 54 85 L 26 35 L 38 29 L 66 79 Z" fill="url(#dwarfHandleGrad)" stroke="#1d0c08" strokeWidth="1.2" filter="url(#dwarf-shadow)" />

      {/* Cream Undershirt at Neckline */}
      <path d="M 68 110 L 132 110 L 116 138 L 84 138 Z" fill="#efebe9" stroke="#bcaaa4" strokeWidth="0.8" />

      {/* Tunic (Wide stocky clothing) */}
      <g filter="url(#dwarf-shadow)">
        <path d="M 58 122 Q 100 115 142 122 L 148 205 Q 100 212 52 205 Z" fill="url(#dwarfTunic)" />
        
        {/* Pocket patches as in reference image */}
        <rect x="110" y="152" width="14" height="12" fill="#3e2723" rx="2" opacity="0.85" />
        <line x1="112" y1="152" x2="112" y2="164" stroke="#1d0c08" strokeWidth="1" />
        <line x1="122" y1="152" x2="122" y2="164" stroke="#1d0c08" strokeWidth="1" />
      </g>

      {/* Green pants trousers */}
      <rect x="74" y="205" width="16" height="20" fill="#2e7d32" stroke="#1b5e20" strokeWidth="1" />
      <rect x="110" y="205" width="16" height="20" fill="#2e7d32" stroke="#1b5e20" strokeWidth="1" />

      {/* Cuff Boots */}
      <g filter="url(#dwarf-shadow)">
        {/* Left boot folded cuff */}
        <ellipse cx="82" cy="222" rx="14" ry="5.5" fill="#5d4037" stroke="#3e2723" strokeWidth="1" />
        {/* Left boot base */}
        <path d="M 68 222 C 68 214, 96 214, 96 222 L 98 244 Q 83 248 68 244 Z" fill="url(#dwarfBoot)" stroke="#1c0d0a" strokeWidth="1" />

        {/* Right boot folded cuff */}
        <ellipse cx="118" cy="222" rx="14" ry="5.5" fill="#5d4037" stroke="#3e2723" strokeWidth="1" />
        {/* Right boot base */}
        <path d="M 104 222 C 104 214, 132 214, 132 222 L 134 244 Q 119 248 104 244 Z" fill="url(#dwarfBoot)" stroke="#1c0d0a" strokeWidth="1" />
      </g>

      {/* Thick skin arms hanging straight down */}
      <g filter="url(#dwarf-shadow)">
        <path d="M 52 122 L 52 200" stroke="url(#dwarfSkinGrad)" strokeWidth="20" strokeLinecap="round" />
        <circle cx="52" cy="200" r="12" fill="#fed7aa" stroke="#f97316" strokeWidth="1.2" />

        <path d="M 148 122 L 148 200" stroke="url(#dwarfSkinGrad)" strokeWidth="20" strokeLinecap="round" />
        <circle cx="148" cy="200" r="12" fill="#fed7aa" stroke="#f97316" strokeWidth="1.2" />
      </g>

      {/* Back Beard */}
      <path d="M 54 90 L 146 90 L 142 185 L 122 210 L 100 190 L 78 210 L 58 185 Z" fill="#1d0c08" />

      {/* Front Beard (Vertical lock details) */}
      <motion.g
        animate={isHurt ? { rotate: [-6, 6, -3, 0] } : { rotate: [-1.2, 1.2, -1.2] }}
        transition={isHurt ? { duration: 0.28 } : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <path d="M 58 92 L 142 92 L 138 180 L 122 205 L 100 185 L 78 205 L 62 180 Z" fill="url(#dwarfBeardGrad)" filter="url(#dwarf-shadow)" />
        
        {/* Vertical stripes for lock texture */}
        <path d="M 80 102 L 83 195" stroke="#2d1d1a" strokeWidth="2.8" opacity="0.65" strokeLinecap="round" />
        <path d="M 120 102 L 117 195" stroke="#2d1d1a" strokeWidth="2.8" opacity="0.65" strokeLinecap="round" />
        <path d="M 100 104 L 100 180" stroke="#2d1d1a" strokeWidth="3" opacity="0.75" strokeLinecap="round" />
      </motion.g>

      {/* Trapezoidal Squared Face Shape */}
      <path d="M 66 72 L 134 72 Q 140 92 134 94 L 66 94 Q 60 92 66 72 Z" fill="url(#dwarfFaceGrad)" stroke="#1d0c08" strokeWidth="0.8" />

      {/* Large Leaf-like Angled Eyebrows */}
      <g filter="url(#dwarf-shadow)">
        <path d="M 56 64 C 70 54, 94 62, 94 72 C 84 72, 70 70, 56 64 Z" fill="#4a2711" stroke="#1d0c08" strokeWidth="0.8" />
        <path d="M 144 64 C 130 54, 106 62, 106 72 C 116 72, 130 70, 144 64 Z" fill="#4a2711" stroke="#1d0c08" strokeWidth="0.8" />
      </g>

      {/* Small orange triangle nose */}
      <polygon points="98,82 102,82 100,87" fill="#f97316" stroke="#c2410c" strokeWidth="0.5" />

      {/* Eyes (Sleepy slit shape) */}
      <g>
        {isDead || isCrit ? (
          <>
            <path d="M 74 76 L 86 84 M 86 76 L 74 84" stroke="#1d0c08" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 114 76 L 126 84 M 126 76 L 114 84" stroke="#1d0c08" strokeWidth="2.5" strokeLinecap="round" />
          </>
        ) : isHurt ? (
          <>
            <path d="M 73 83 L 83 79 L 73 75" fill="none" stroke="#1d0c08" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 127 83 L 117 79 L 127 75" fill="none" stroke="#1d0c08" strokeWidth="2.5" strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse cx="80" cy="80" rx="9" ry="4" fill="#111111" />
            <circle cx="78" cy="78" r="1.5" fill="#ffffff" />
            <ellipse cx="120" cy="80" rx="9" ry="4" fill="#111111" />
            <circle cx="118" cy="78" r="1.5" fill="#ffffff" />
            
            {/* Blink Eyelids */}
            <motion.path 
              d="M 70 76 Q 80 84 90 76 Z" 
              fill="url(#dwarfFaceGrad)"
              animate={blink ? { scaleY: 1 } : { scaleY: 0 }}
              style={{ originY: 0 }}
            />
            <motion.path 
              d="M 110 76 Q 120 84 130 76 Z" 
              fill="url(#dwarfFaceGrad)"
              animate={blink ? { scaleY: 1 } : { scaleY: 0 }}
              style={{ originY: 0 }}
            />
          </>
        )}
      </g>

      {/* Winged mustache */}
      <path d="M 60 92 Q 100 110 140 92 Q 120 100 100 98 Q 80 100 60 92 Z" fill="#4a2711" stroke="#2d1d1a" strokeWidth="1.2" />

      {/* Flat-sided Burgundy Beanie Cap */}
      <motion.path 
        d="M 64 74 C 64 32, 136 32, 136 74 Z" 
        fill="url(#dwarfCapGrad)" 
        stroke="#1d0c08" 
        strokeWidth="1" 
        filter="url(#dwarf-shadow)"
        animate={isHurt ? { y: [-10, 0], rotate: [-6, 3, 0] } : {}}
        transition={{ duration: 0.28 }}
      />

      {/* Mouth/Expression */}
      {isHurt || isDead ? (
        <g filter="url(#dwarf-shadow)">
          <ellipse cx="100" cy="115" rx="5" ry="7" fill="#1d0c08" />
          <path d="M 96 118 Q 100 112 104 118 Z" fill="#f43f5e" />
        </g>
      ) : (
        <path d="M 94 111 Q 100 114 106 111" stroke="#1d0c08" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      )}
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
      animate={isDead ? {
        scaleY: 0.12,
        scaleX: 1.45,
        y: 95,
        rotate: -90,
        filter: "grayscale(0.7) brightness(0.5)"
      } : isHurt ? {
        scaleY: [1, 0.65, 1.28, 0.89, 1.04, 1],
        scaleX: [1, 1.34, 0.72, 1.10, 0.96, 1],
        rotate: [0, 15, -12, 6, -3, 0],
        y: [0, 8, -6, 2, 0]
      } : {
        y: [0, -4, 0],
        scaleY: [1, 1.04, 1],
        scaleX: [1, 0.98, 1]
      }}
      transition={isDead ? { duration: 0.4 } : isHurt ? { duration: 0.28, ease: "easeOut" } : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
    >
      <defs>
        {/* Soft Shadows */}
        <filter id="elf-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.45" />
        </filter>
        <filter id="elf-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Shading Gradients */}
        <radialGradient id="elfFaceGrad" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#fffcf9" />
          <stop offset="50%" stopColor="#ffeed5" />
          <stop offset="90%" stopColor="#fda4af" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.6" />
        </radialGradient>

        <linearGradient id="elfHatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff8787" />
          <stop offset="40%" stopColor="#e60000" />
          <stop offset="100%" stopColor="#7a0000" />
        </linearGradient>

        <linearGradient id="elfHatTrimGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#a3e635" />
          <stop offset="100%" stopColor="#166534" />
        </linearGradient>

        <linearGradient id="elfBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#14532d" />
        </linearGradient>

        <linearGradient id="elfCollarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#991b1b" />
        </linearGradient>

        <radialGradient id="goldBellGrad" cx="35%" cy="35%" r="55%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="70%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#854d0e" />
        </radialGradient>

        <linearGradient id="elfLegStripe" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#15803d" />
          <stop offset="50%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#14532d" />
        </linearGradient>
      </defs>

      {/* Shadow */}
      <ellipse cx="100" cy="236" rx="50" ry="8" fill="rgba(0,0,0,0.45)" filter="blur(1px)" />

      {/* Slim Arms (Behind body) */}
      <g filter="url(#elf-shadow)">
        {/* Left slim arm */}
        <path d="M 72 112 C 54 125, 54 165, 62 175" stroke="url(#elfBodyGrad)" strokeWidth="12" strokeLinecap="round" fill="none" />
        {/* Right slim arm */}
        <path d="M 128 112 C 146 125, 146 165, 138 175" stroke="url(#elfBodyGrad)" strokeWidth="12" strokeLinecap="round" fill="none" />
        {/* Gloves */}
        <circle cx="62" cy="176" r="8" fill="#ef4444" stroke="#991b1b" strokeWidth="1.2" />
        <circle cx="138" cy="176" r="8" fill="#ef4444" stroke="#991b1b" strokeWidth="1.2" />
      </g>

      {/* Elf Body (Slim & Athletic Proportions, longer body) */}
      <g filter="url(#elf-shadow)">
        {/* Tunic */}
        <path d="M 72 110 Q 100 95 128 110 L 132 210 Q 100 220 68 210 Z" fill="url(#elfBodyGrad)" />
        
        {/* Spiky Jester Collar */}
        <path d="M 70 112 L 80 130 L 90 115 L 100 136 L 110 115 L 120 130 L 130 112 L 120 106 L 100 109 L 80 106 Z" fill="url(#elfCollarGrad)" filter="url(#elf-shadow)" />

        {/* Buttons (3D gold bells) */}
        <circle cx="100" cy="154" r="4" fill="url(#goldBellGrad)" />
        <circle cx="100" cy="174" r="4" fill="url(#goldBellGrad)" />
        <circle cx="100" cy="194" r="4" fill="url(#goldBellGrad)" />

        {/* Legs (Striped Green and White Socks) */}
        <g>
          {/* Left leg */}
          <rect x="76" y="210" width="12" height="26" fill="url(#elfLegStripe)" />
          <rect x="76" y="215" width="12" height="4.5" fill="#ffffff" />
          <rect x="76" y="223" width="12" height="4.5" fill="#ffffff" />

          {/* Right leg */}
          <rect x="112" y="210" width="12" height="26" fill="url(#elfLegStripe)" />
          <rect x="112" y="215" width="12" height="4.5" fill="#ffffff" />
          <rect x="112" y="223" width="12" height="4.5" fill="#ffffff" />
        </g>

        {/* Pointy Curled shoes */}
        <path d="M 76 232 C 76 224, 44 220, 48 234 C 50 239, 76 244, 84 238 Z" fill="url(#elfHatTrimGrad)" />
        <circle cx="47.5" cy="231" r="2.8" fill="url(#goldBellGrad)" />

        <path d="M 124 232 C 124 224, 156 220, 152 234 C 150 239, 124 244, 116 238 Z" fill="url(#elfHatTrimGrad)" />
        <circle cx="152.5" cy="231" r="2.8" fill="url(#goldBellGrad)" />
      </g>

      {/* Pointed Elf Ears (Long and highly prominent/annoying) */}
      <g filter="url(#elf-shadow)">
        <path d="M 72 74 C 56 68, 26 44, 40 84 C 48 84, 62 82, 72 74 Z" fill="url(#elfFaceGrad)" />
        <path d="M 66 73 C 58 70, 38 56, 47 79 Z" fill="#fecdd3" opacity="0.6" />

        <path d="M 128 74 C 144 68, 174 44, 160 84 C 152 84, 138 82, 128 74 Z" fill="url(#elfFaceGrad)" />
        <path d="M 134 73 C 142 70, 162 56, 153 79 Z" fill="#fecdd3" opacity="0.6" />
      </g>

      {/* Head Base (Smaller head proportions) */}
      <circle cx="100" cy="76" r="30" fill="url(#elfFaceGrad)" filter="url(#elf-shadow)" />

      {/* Cheek blush */}
      <circle cx="80" cy="85" r="6" fill="#f43f5e" opacity="0.22" filter="url(#elf-glow)" />
      <circle cx="120" cy="85" r="6" fill="#f43f5e" opacity="0.22" filter="url(#elf-glow)" />

      {/* Hair (Blonde locks overlapping face) */}
      <g filter="url(#elf-shadow)">
        <path d="M 70 56 C 80 48, 120 48, 130 56 C 120 64, 80 64, 70 56 Z" fill="#facc15" />
        <path d="M 70 56 Q 60 76, 66 90 Q 72 76, 72 56 Z" fill="#facc15" />
        <path d="M 130 56 Q 140 76, 134 90 Q 128 76, 128 56 Z" fill="#facc15" />
      </g>

      {/* Jester Diamond markings above/below eyes */}
      <g opacity="0.8">
        <polygon points="79,56 81,62 79,68 77,62" fill="#1b5e20" />
        <polygon points="79,84 81,90 79,96 77,90" fill="#1b5e20" />
        <polygon points="121,56 123,62 121,68 119,62" fill="#1b5e20" />
        <polygon points="121,84 123,90 121,96 119,90" fill="#1b5e20" />
      </g>

      {/* Cute nose */}
      <ellipse cx="100" cy="81" rx="4" ry="2.5" fill="#f43f5e" opacity="0.75" />

      {/* Eyes (Mischievous / squinty / smug) */}
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
            {/* Smug half-closed eyes */}
            <circle cx="79" cy="74" r="8" fill="#ffffff" stroke="#15803d" strokeWidth="1" />
            <circle cx="121" cy="74" r="8" fill="#ffffff" stroke="#15803d" strokeWidth="1" />
            
            {/* Irises looking sideways/smugly */}
            <circle cx="82" cy="74" r="4.5" fill="#166534" />
            <circle cx="118" cy="74" r="4.5" fill="#166534" />
            
            {/* Pupils */}
            <circle cx="82" cy="74" r="2.8" fill="#1f2937" />
            <circle cx="118" cy="74" r="2.8" fill="#1f2937" />
            
            {/* Specular Reflections */}
            <circle cx="81" cy="72" r="1.5" fill="#ffffff" />
            <circle cx="117" cy="72" r="1.5" fill="#ffffff" />

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

      {/* Pointed Elf/Jester Hat (Red Jester curve and Green spiky trim) */}
      <motion.g
        animate={isHurt ? { y: [-10, 0], rotate: [6, -3, 0] } : {}}
        transition={{ duration: 0.28 }}
        filter="url(#elf-shadow)"
      >
        {/* Curving Hat Dome */}
        <path d="M 68 62 C 82 20, 115 2, 136 10 C 146 14, 143 28, 134 26 C 118 22, 96 34, 82 65 Z" fill="url(#elfHatGrad)" />
        
        {/* Green Crown Spiky Trim */}
        <path d="M 68 62 L 76 51 L 86 62 L 96 51 L 106 62 L 116 51 L 126 62 L 132 67 L 100 64 L 68 67 Z" fill="url(#elfHatTrimGrad)" />

        {/* Gold Bell on Tip */}
        <circle cx="138" cy="13" r="7.5" fill="url(#goldBellGrad)" filter="url(#elf-shadow)" />
        <circle cx="135.5" cy="10.5" r="2.5" fill="#ffffff" opacity="0.6" />
      </motion.g>

      {/* Expression / Smug Crooked Smile */}
      {isHurt || isDead ? (
        <g filter="url(#elf-shadow)">
          <ellipse cx="100" cy="94" rx="5" ry="7" fill="#1f2937" />
          <path d="M 96 97 Q 100 92 104 97 Z" fill="#f43f5e" />
        </g>
      ) : (
        <g filter="url(#elf-shadow)">
          <path d="M 93 93 Q 98 89 108 92" stroke="#1f2937" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <path d="M 107 90 L 108 94" stroke="#1f2937" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}
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

  // Weapon selected: 'punch' | 'slipper' | 'hammer'
  const [activeWeapon, setActiveWeapon] = useState<"punch" | "slipper" | "hammer">("punch");
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
    if (particles.length === 0) return;
    const interval = setInterval(() => {
      setParticles(prev => prev.map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        vy: p.vy + 0.15, // gravity
        alpha: p.alpha - 0.02
      })).filter(p => p.alpha > 0));
    }, 16);
    return () => clearInterval(interval);
  }, [particles]);

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

    // Rage
    const nextRage = Math.min(rage + rageGain, 100);
    setRage(nextRage);

    // Spawns
    const targetEl = document.getElementById("target-dummy-char");
    let spawnX = 580;
    let spawnY = 220;
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      spawnX = rect.left + rect.width / 2 + Math.random() * 20 - 10;
      spawnY = rect.top + rect.height / 2 + Math.random() * 20 - 10;
    }

    // Spawn Particles & Damage numbers
    spawnParticles(spawnX - 100, spawnY - 100, isCrit ? "#ffbf00" : "#ffffff", isCrit ? 15 : 6);
    triggerFloatingText(
      spawnX - 100 + (Math.random() * 30 - 15), 
      spawnY - 140, 
      Math.round(dmg * 10).toString(), 
      isCrit ? "#ffd700" : "#ffffff", 
      isCrit ? 26 : 16, 
      isCrit
    );

    // Floating combat word
    triggerFloatingText(
      spawnX - 150 + (Math.random() * 40 - 20),
      spawnY - 180,
      getActionWord(activeWeapon),
      activeWeapon === "slipper" ? "#e05a5a" : (activeWeapon === "hammer" ? "#c9a84c" : "#8ab4c9"),
      isCrit ? 15 : 11
    );

    showBlacksmithReaction();

    // Achievements checks
    unlockAchievement("first_strike");
    if (nextCombo >= 20) unlockAchievement("combo_king");
    if (nextRage >= 100) unlockAchievement("rage_overload");
    if (activeWeapon === "slipper") unlockAchievement("slipper_master");

    saveStats(nextHits, defeats, Math.max(nextCombo, maxCombo), achievements);

    // Check defeat
    if (nextHp <= 0) {
      handleTargetDefeat();
    }
  };

  // Target defeat animation sequence
  const handleTargetDefeat = () => {
    setTargetDead(true);
    setReactionBubble("ARGH! Refund authorized!");
    
    // Spawn massive gold coin particles
    const targetEl = document.getElementById("target-dummy-char");
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      spawnParticles(rect.left + rect.width / 2 - 100, rect.top + rect.height / 2 - 100, "#ffd700", 35);
    }

    const nextDefs = defeats + 1;
    setDefeats(nextDefs);

    // Trigger defeat achievements
    if (nextDefs >= 5) {
      unlockAchievement("unstoppable");
    }

    saveStats(totalHits, nextDefs, maxCombo, achievements);

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
        handleTargetDefeat();
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
        <Link href="/" className="text-white/40 hover:text-amber-400 text-xs font-bold uppercase tracking-widest transition-colors">
          ← Back to grading
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 flex flex-col gap-6 z-10 relative">
        
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

        {gameState === "select" ? (
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
                onClick={() => { setPlayerChar("dwarf"); setGameState("play"); }}
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
                <button className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-black text-xs uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                  Play as Dwarf
                </button>
              </div>

              {/* Elf Card */}
              <div 
                onClick={() => { setPlayerChar("elf"); setGameState("play"); }}
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
                <button className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(16,185,129,0.15)]">
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
                  <div className="w-56 h-2 bg-black/50 border border-white/5 rounded-full overflow-hidden relative">
                    <motion.div 
                      animate={{ width: `${targetHp}%` }}
                      transition={{ type: "tween", duration: 0.1 }}
                      className="h-full bg-gradient-to-r from-red-500 to-orange-400 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
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
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => setActiveWeapon("punch")}
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
                      onClick={() => setActiveWeapon("slipper")}
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
                      onClick={() => setActiveWeapon("hammer")}
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
