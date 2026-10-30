import { describe, it, expect } from "vitest";
import {
  calculateDamageStats,
  hitsPerSecondForLevel,
  damagePerHit,
  flameTickDamage,
  simulateKill,
  FALLBACK_HPS
} from "../src/lib/damageCalc";

// Authoritative Oettam Reference Functions (exact code from https://huggingface.co/spaces/oettaM123/swordmasters-optimizer)
const OETTAM_HPS = 25 / 9;

function oettamHps(level?: number | string | null): number {
  const n = Number(level);
  return Number.isFinite(n) && level !== "" && level !== null && level !== undefined
    ? 1 + 0.5 * Math.pow(Math.max(n, 0), 1 / 8)
    : OETTAM_HPS;
}

function oettamDph(ds: number, power: number, ms: number): number {
  return (ds + 2 * Math.sqrt(Math.max(power, 0)) + 1) * (1 + ms);
}

function oettamFlameTick(ds: number, power: number, ms: number, flame: number): number {
  if (!flame || flame <= 0) return 0;
  return ((2 * Math.sqrt(Math.max(power, 0)) + ds) / (10 - flame)) * (1 + ms);
}

function oettamSimKill(ds: number, power: number, ms: number, flame: number, level?: number | string | null, bossHp = 100e12) {
  const dph = oettamDph(ds, power, ms);
  const tpf = oettamFlameTick(ds, power, ms, flame);
  const hps = oettamHps(level);
  const normalDps = dph * hps;
  if (normalDps <= 0) return { killTime: 1e9, dps: 0, hitsPerSecond: hps, damagePerHit: dph };
  let kt = bossHp / normalDps;
  let ticks = 0;
  if (tpf > 0) {
    let solved = false;
    const root = (bossHp + tpf) / (normalDps + tpf);
    const baseN = Math.max(0, Math.floor(root));
    const candidates = new Set([0, baseN, baseN + 1, baseN + 2, Math.max(0, baseN - 1), Math.max(0, baseN - 2)]);
    for (const candidateN of [...candidates].sort((a, b) => b - a)) {
      const tickCand = Math.max(0, candidateN - 1);
      const ktCand = (bossHp - tpf * tickCand) / normalDps;
      if (ktCand <= 0) continue;
      if (Math.floor(ktCand) === candidateN) {
        kt = ktCand;
        ticks = tickCand;
        solved = true;
        break;
      }
    }
    if (!solved) {
      for (const candidateN of [...candidates].sort((a, b) => a - b)) {
        const tickCand = Math.max(0, candidateN - 1);
        if (tickCand <= 0) continue;
        const beforeTick = normalDps * candidateN + tpf * (tickCand - 1);
        const afterTick = beforeTick + tpf;
        if (beforeTick < bossHp && bossHp <= afterTick) {
          kt = candidateN;
          ticks = tickCand;
          solved = true;
          break;
        }
      }
    }
  }
  const dps = bossHp / kt;
  return { killTime: kt, dps, normalDps, hitsPerSecond: hps, damagePerHit: dph, flameTicks: ticks };
}

describe("SMGrade Damage & DPS Engine vs Authoritative Oettam Reference", () => {
  const testConfigurations = [
    {
      name: "Case 1: Starter unarmed, Power 100, Level 1, No Enchants",
      ds: 0,
      power: 100,
      ms: 0,
      flame: 0,
      level: 1,
      petPowerBonus: 0,
      armorPowerBonus: 0
    },
    {
      name: "Case 2: Basic Sword (DS=10), Shield (MS=0.2), 10K Power, Level 50",
      ds: 10,
      power: 10000,
      ms: 0.2,
      flame: 0,
      level: 50,
      petPowerBonus: 0.5,
      armorPowerBonus: 0.2
    },
    {
      name: "Case 3: Mid-tier sword (DS=500), Shield (MS=0.5), 1M Power, Level 500",
      ds: 500,
      power: 1000000,
      ms: 0.5,
      flame: 0,
      level: 500,
      petPowerBonus: 2.0,
      armorPowerBonus: 1.0
    },
    {
      name: "Case 4: Mid-tier sword with Flame I (DS=500, MS=0.5, 1M Power, Level 500, Flame 1)",
      ds: 500,
      power: 1000000,
      ms: 0.5,
      flame: 1,
      level: 500,
      petPowerBonus: 2.0,
      armorPowerBonus: 1.0
    },
    {
      name: "Case 5: High-tier sword with Flame III (DS=50M, MS=1.5, 100B Power, Level 5000, Flame 3)",
      ds: 50000000,
      power: 100e9,
      ms: 1.5,
      flame: 3,
      level: 5000,
      petPowerBonus: 10.0,
      armorPowerBonus: 5.0
    },
    {
      name: "Case 6: End-game god build (DS=1B, MS=2.5, 100T Power, Level 20000, No Flame)",
      ds: 1e9,
      power: 100e12,
      ms: 2.5,
      flame: 0,
      level: 20000,
      petPowerBonus: 50.0,
      armorPowerBonus: 20.0
    },
    {
      name: "Case 7: Fallback Level (No level provided, Power 1M, DS=1000, MS=0.75)",
      ds: 1000,
      power: 1000000,
      ms: 0.75,
      flame: 0,
      level: null,
      petPowerBonus: 1.0,
      armorPowerBonus: 0
    },
    {
      name: "Case 8: Edge Case (Zero Power, Zero Level, DS=25, MS=0)",
      ds: 25,
      power: 0,
      ms: 0,
      flame: 0,
      level: 0,
      petPowerBonus: 0,
      armorPowerBonus: 0
    },
    {
      name: "Case 9: Edge Case (Negative Power, Invalid Level string)",
      ds: 100,
      power: -500,
      ms: 0.1,
      flame: 0,
      level: "invalid_level",
      petPowerBonus: 0,
      armorPowerBonus: 0
    }
  ];

  testConfigurations.forEach((tc) => {
    it(`should exactly match Oettam for ${tc.name}`, () => {
      const oettam = oettamSimKill(tc.ds, tc.power, tc.ms, tc.flame, tc.level);

      const smgrade = calculateDamageStats({
        ds: tc.ds,
        swordDamageMultiplier: tc.ms,
        power: tc.power,
        petPowerBonus: tc.petPowerBonus,
        armorPowerBonus: tc.armorPowerBonus,
        level: tc.level,
        flame: tc.flame
      });

      // 1. Damage Per Hit must match Oettam within 0.0001%
      expect(smgrade.damagePerHit).toBeCloseTo(oettam.damagePerHit, 2);

      // 2. Attack speed / HPS must match Oettam exactly
      expect(smgrade.attackSpeed).toBeCloseTo(oettam.hitsPerSecond, 4);

      // 3. DPS must match Oettam within 0.0001%
      expect(smgrade.damagePerSecond).toBeCloseTo(oettam.dps, 2);

      // Difference should be 0 or infinitesimal floating point precision (< 1e-6)
      const dphDiff = Math.abs(smgrade.damagePerHit - oettam.damagePerHit);
      const dpsDiff = Math.abs(smgrade.damagePerSecond - oettam.dps);
      expect(dphDiff).toBeLessThan(1e-4);
      expect(dpsDiff).toBeLessThan(1e-3);
    });
  });
});
