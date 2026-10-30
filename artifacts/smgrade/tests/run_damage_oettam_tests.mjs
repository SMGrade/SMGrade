import assert from "node:assert";
import {
  calculateDamageStats,
  hitsPerSecondForLevel,
  damagePerHit,
  flameTickDamage,
  simulateKill,
  FALLBACK_HPS
} from "../src/lib/damageCalc.ts";

const OETTAM_HPS = 25 / 9;

function oettamHps(level) {
  const n = Number(level);
  return Number.isFinite(n) && level !== "" && level !== null && level !== undefined
    ? 1 + 0.5 * Math.pow(Math.max(n, 0), 1 / 8)
    : OETTAM_HPS;
}

function oettamDph(ds, power, ms) {
  return (ds + 2 * Math.sqrt(Math.max(power, 0)) + 1) * (1 + ms);
}

function oettamFlameTick(ds, power, ms, flame) {
  if (!flame || flame <= 0) return 0;
  return ((2 * Math.sqrt(Math.max(power, 0)) + ds) / (10 - flame)) * (1 + ms);
}

function oettamSimKill(ds, power, ms, flame, level, bossHp = 100e12) {
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

const testConfigurations = [
  {
    name: "Starter unarmed (Power 100, Level 1, Flame 0)",
    ds: 0,
    power: 100,
    ms: 0,
    flame: 0,
    level: 1,
    petPowerBonus: 0,
    armorPowerBonus: 0
  },
  {
    name: "Basic Gear (DS=10, MS=0.2, Power 10K, Level 50, Flame 0)",
    ds: 10,
    power: 10000,
    ms: 0.2,
    flame: 0,
    level: 50,
    petPowerBonus: 0.5,
    armorPowerBonus: 0.2
  },
  {
    name: "Mid-tier without Flame (DS=500, MS=0.5, Power 1M, Level 500, Flame 0)",
    ds: 500,
    power: 1000000,
    ms: 0.5,
    flame: 0,
    level: 500,
    petPowerBonus: 2.0,
    armorPowerBonus: 1.0
  },
  {
    name: "Mid-tier with Flame I (DS=500, MS=0.5, Power 1M, Level 500, Flame 1)",
    ds: 500,
    power: 1000000,
    ms: 0.5,
    flame: 1,
    level: 500,
    petPowerBonus: 2.0,
    armorPowerBonus: 1.0
  },
  {
    name: "High-tier with Flame III (DS=50M, MS=1.5, Power 100B, Level 5000, Flame 3)",
    ds: 50000000,
    power: 100e9,
    ms: 1.5,
    flame: 3,
    level: 5000,
    petPowerBonus: 10.0,
    armorPowerBonus: 5.0
  },
  {
    name: "End-game god build (DS=1B, MS=2.5, Power 100T, Level 20000, Flame 0)",
    ds: 1e9,
    power: 100e12,
    ms: 2.5,
    flame: 0,
    level: 20000,
    petPowerBonus: 50.0,
    armorPowerBonus: 20.0
  },
  {
    name: "Fallback Level (No level provided, Power 1M, DS=1000, MS=0.75)",
    ds: 1000,
    power: 1000000,
    ms: 0.75,
    flame: 0,
    level: null,
    petPowerBonus: 1.0,
    armorPowerBonus: 0
  },
  {
    name: "Edge Case (Zero Power, Zero Level, DS=25, MS=0)",
    ds: 25,
    power: 0,
    ms: 0,
    flame: 0,
    level: 0,
    petPowerBonus: 0,
    armorPowerBonus: 0
  },
  {
    name: "Edge Case (Negative Power, Invalid Level string)",
    ds: 100,
    power: -500,
    ms: 0.1,
    flame: 0,
    level: "invalid_level",
    petPowerBonus: 0,
    armorPowerBonus: 0
  }
];

console.log("==========================================================================================");
console.log("SMGrade vs Oettam Optimizer Damage & DPS Regression Test Suite");
console.log("==========================================================================================");

let allPassed = true;
const resultsTable = [];

for (const tc of testConfigurations) {
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

  const dphDiff = Math.abs(smgrade.damagePerHit - oettam.damagePerHit);
  const dpsDiff = Math.abs(smgrade.damagePerSecond - oettam.dps);
  const hpsDiff = Math.abs(smgrade.attackSpeed - oettam.hitsPerSecond);

  const passed = dphDiff < 1e-4 && dpsDiff < 1e-3 && hpsDiff < 1e-6;
  if (!passed) allPassed = false;

  resultsTable.push({
    Config: tc.name,
    "Oettam DPH": oettam.damagePerHit.toFixed(2),
    "SMGrade DPH": smgrade.damagePerHit.toFixed(2),
    "DPH Diff": dphDiff.toFixed(6),
    "Oettam DPS": oettam.dps.toFixed(2),
    "SMGrade DPS": smgrade.damagePerSecond.toFixed(2),
    "DPS Diff": dpsDiff.toFixed(6),
    Status: passed ? "PASS" : "FAIL"
  });
}

console.table(resultsTable);

if (allPassed) {
  console.log("\nALL 9 OETTAM REGRESSION TEST CASES PASSED WITH 100% MATHEMATICAL PRECISION!");
} else {
  console.error("\nTEST SUITE FAILED: Divergence detected against Oettam reference.");
  process.exit(1);
}
