// Centralized Authoritative Damage Calculation Engine for SwordMasters
// Ground truth validated against Oettam's SwordMasters Optimizer (https://huggingface.co/spaces/oettaM123/swordmasters-optimizer)

export const FALLBACK_HPS = 25 / 9; // 2.7777777777777777 hits/second fallback when level is unavailable

/**
 * Calculates attack rate (hits per second) based on player level.
 * Formula from Oettam's optimizer (confirmed live packet timing):
 * hits/sec = 1 + 0.5 * level^(1/8)
 */
export function hitsPerSecondForLevel(level?: number | string | null, fallback = FALLBACK_HPS): number {
  if (level === undefined || level === null || level === "") return fallback;
  const n = typeof level === "number" ? level : Number(level);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return 1.0 + 0.5 * Math.pow(n, 1.0 / 8.0);
}

/**
 * Calculates raw server hit damage before pet/armor power multipliers.
 * Formula from Oettam's optimizer:
 * damage = (DS + 2 * sqrt(P) + 1) * (1 + MS)
 */
export function damagePerHit(ds: number, power: number, ms: number): number {
  const safeDs = Number.isFinite(ds) && ds > 0 ? ds : 0;
  const safePower = Number.isFinite(power) && power > 0 ? power : 0;
  const safeMs = Number.isFinite(ms) && ms > 0 ? ms : 0;
  return (safeDs + 2.0 * Math.sqrt(safePower) + 1.0) * (1.0 + safeMs);
}

/**
 * Calculates Flame tick damage per second for active Flame enchantments.
 * Formula from Oettam's optimizer:
 * flame damage = (2 * sqrt(P) + DS) / (10 - F) * (1 + MS)
 */
export function flameTickDamage(ds: number, power: number, ms: number, flameLevel: number = 0): number {
  if (!flameLevel || flameLevel <= 0) return 0.0;
  const safeDs = Number.isFinite(ds) && ds > 0 ? ds : 0;
  const safePower = Number.isFinite(power) && power > 0 ? power : 0;
  const safeMs = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const fl = Math.min(Math.max(flameLevel, 1), 5); // Flame level
  return ((2.0 * Math.sqrt(safePower) + safeDs) / (10.0 - fl)) * (1.0 + safeMs);
}

/**
 * Solves kill simulation and effective fight DPS against standard boss (100T HP).
 * Matches Oettam's jsSimKill / _simulate_kill.
 */
export function simulateKill(options: {
  ds: number;
  power: number;
  ms: number;
  mp?: number;
  ap?: number;
  flame?: number;
  level?: number | string | null;
  bossHp?: number;
}) {
  const { ds, power, ms, mp = 0, ap = 0, flame = 0, level = null, bossHp = 100e12 } = options;
  const dph = damagePerHit(ds, power, ms);
  const tpf = flameTickDamage(ds, power, ms, flame);
  const hps = hitsPerSecondForLevel(level);
  const normalDps = dph * hps;

  if (normalDps <= 0) {
    return { killTime: 1e9, dps: 0, hitsPerSecond: hps, damagePerHit: dph, flameTickDamage: 0, flameTicks: 0 };
  }

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
  return {
    killTime: kt,
    dps,
    normalDps,
    hitsPerSecond: hps,
    damagePerHit: dph,
    flameTickDamage: tpf,
    flameTicks: ticks
  };
}

export interface DamageCalcResult {
  damagePerHit: number;
  powerPerHit: number;
  damagePerSecond: number;
  powerPerSecond: number;
  ds: number;
  ms: number;
  power: number;
  sqrtPower: number;
  petPowerBonus: number;
  armorPowerBonus: number;
  attackSpeed: number;
  flameLevel: number;
  flameTickDmg: number;
}

export function calculateDamageStats(input: {
  ds: number;                  // base sword damage
  swordDamageMultiplier: number; // shield damage multiplier (ms)
  power: number;               // raw power value
  petPowerBonus?: number;       // active pets power bonus multiplier (mp)
  armorPowerBonus?: number;     // armor power bonus multiplier (ap)
  attackSpeed?: number;         // optional explicit attack speed override
  level?: number | string | null; // account level
  flame?: number;              // flame enchantment level
}): DamageCalcResult {
  const {
    ds,
    swordDamageMultiplier,
    power,
    petPowerBonus = 0,
    armorPowerBonus = 0,
    attackSpeed: overrideAttackSpeed,
    level,
    flame = 0
  } = input;

  const hps = overrideAttackSpeed !== undefined ? overrideAttackSpeed : hitsPerSecondForLevel(level);
  const dph = damagePerHit(ds, power, swordDamageMultiplier);
  const pph = dph * (1.0 + petPowerBonus + armorPowerBonus);

  // Use Oettam simulation for exact DPS (accounts for level hps and flame ticks)
  const sim = simulateKill({
    ds,
    power,
    ms: swordDamageMultiplier,
    flame,
    level: overrideAttackSpeed !== undefined ? undefined : level,
    bossHp: 100e12
  });

  const finalDps = overrideAttackSpeed !== undefined 
    ? (dph * overrideAttackSpeed + (flame > 0 ? flameTickDamage(ds, power, swordDamageMultiplier, flame) : 0))
    : sim.dps;
  const pps = finalDps * (1.0 + petPowerBonus + armorPowerBonus);

  return {
    damagePerHit: dph,
    powerPerHit: pph,
    damagePerSecond: finalDps,
    powerPerSecond: pps,
    ds,
    ms: swordDamageMultiplier,
    power,
    sqrtPower: Math.sqrt(Math.max(power, 0)),
    petPowerBonus,
    armorPowerBonus,
    attackSpeed: hps,
    flameLevel: flame,
    flameTickDmg: sim.flameTickDamage
  };
}
