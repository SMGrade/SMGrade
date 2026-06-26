---
name: SMGrade scoring engine + gear database
description: How the deterministic scoring, gear database, and per-slot grading works for SMGrade
---

# SMGrade Scoring Engine

## Key decisions

Power comparison uses log-scale (log10) not linear — power values span 20+ orders of magnitude across level tiers. Linear comparison would make mid-tier players look identical.

Benchmark tiers are defined in `artifacts/smgrade/src/lib/benchmark.ts` with real player data anchoring each tier.

**Why:** SwordMasters numbers use suffixes QT/QNT/SXT (quadrillion/quintillion/sextillion). A level 7000 player with 200T power and a level 99000 player with 104SXT must not be compared linearly.

## Score weights
- Overall = Gear*0.30 + Power*0.40 + Progress*0.20 + Wealth*0.10

## Grade thresholds
S+≥97, S≥90, A+≥83, A≥75, B+≥67, B≥58, C+≥48, C≥38, D=<38

## Per-slot grades (added)
Each account gets 3 slot cards: Sword, Shield, Power — each with individual grade + "Needs Improvement" tip.
Gear slot scoring: (tier/maxTier)*80 + min(level*2, 20)
Implemented in `artifacts/smgrade/src/lib/scorer.ts` → `GearSlotGrade` type, `slotGrades` on `ScoreResult`.

## Gear database (gearDatabase.ts)
Real stats from in-game data verified from player chat logs:

**Swords (base Lv1 DS in B, scaling: Lv n = base × (1 + 0.25 × (n−1)), max Lv10):**
- Graveborn Edge (Common): 1.40B, ~50 QT Lv5
- Runebreaker (Rare): 1.50B, ~53 QT Lv5
- Solbrand (Epic): 2.00B, ~200–220 QT Lv3 | ~800+ QT Lv5
- Soulkeeper's Blade (Epic): 4.00B, ~500 QT Lv1
- Dragon's Devil (Legendary): 5.00B
- Divinity Edge (Legendary): 8.00B, ~280–345 QNT Lv1
- Last Horizon (Legendary): 12.0B, ~390–420 QNT Lv1

**Shields (base Lv1 DM, same scaling):**
- Sealguard (Epic): 6.5x
- Sunward Bulwark (Epic): 7.0x
- Dragon's Soul (Legendary): 8.0x (Lv2=10x confirmed, Lv3=12x confirmed)
- Asgardian Aegis (Legendary): 10.0x, ~280–345 QNT Lv1
- Final Bastion (Legendary): 14.0x, ~390–420 QNT Lv1 (confirmed directly)

**Damage formula:** Damage/Hit = (DS + 2√Power + 1) × (1 + DM)
**Market prices are in Power units** (QT = Quadrillion, QNT = Quintillion).

## Result passing
Results are passed via URL query param `?d=` (JSON encoded) — no DB needed.
AI explanation fires once via useExplainGrade mutation on the Result page.

## AI prompt
AI route (`artifacts/api-server/src/routes/grade.ts`) includes full gear context so it only suggests real weapons at valid levels (1-10) with actual market prices.
