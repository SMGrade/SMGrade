---
name: SMGrade scoring engine
description: How the deterministic scoring and benchmark data works for SMGrade
---

# SMGrade Scoring Engine

## Key decisions

Power comparison uses log-scale (log10) not linear — power values span 20+ orders of magnitude across level tiers. Linear comparison would make mid-tier players look identical.

Benchmark tiers are defined in `artifacts/smgrade/src/lib/benchmark.ts` with real player data anchoring each tier. The benchmark values (weakPower, avgPower, strongPower, elitePower) were set from actual player logs in the dataset.

**Why:** SwordMasters numbers use suffixes QT/QNT/SXT (quadrillion/quintillion/sextillion). A level 7000 player with 200T power and a level 99000 player with 104SXT must not be compared linearly.

## Score weights
- Overall = Gear*0.30 + Power*0.40 + Progress*0.20 + Wealth*0.10

## Grade thresholds
S+≥97, S≥90, A+≥83, A≥75, B+≥67, B≥58, C+≥48, C≥38, D=<38

## Result passing
Results are passed via URL query param `?d=` (JSON encoded) — no DB needed.
AI explanation fires once via useExplainGrade mutation on the Result page.
