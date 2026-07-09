// Centralized Damage Calculation Engine for SwordMasters
// Consolidates damage, power, and speed formulas into a single source of truth.

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
}

export function calculateDamageStats(input: {
  ds: number;                  // base sword damage
  swordDamageMultiplier: number; // shield damage multiplier (ms)
  power: number;               // raw power value
  petPowerBonus: number;       // active pets power bonus multiplier
  armorPowerBonus?: number;     // armor power bonus multiplier (default 0)
  attackSpeed?: number;         // attack speed (default 2.77)
}): DamageCalcResult {
  const { ds, swordDamageMultiplier, power, petPowerBonus, armorPowerBonus = 0, attackSpeed = 2.77 } = input;
  const sqrtPower = Math.sqrt(Math.max(power, 0));
  
  // Formulas with flooring to match integer representations in-game:
  const damagePerHit = Math.floor((ds + 2 * sqrtPower + 1) * (1 + swordDamageMultiplier));
  
  // PowerPerHit = DamagePerHit * (1 + petPowerBonus + armorPowerBonus)
  const powerPerHit = Math.floor(damagePerHit * (1 + petPowerBonus + armorPowerBonus));
  
  // DamagePerSecond = DamagePerHit * AttackSpeed
  const damagePerSecond = damagePerHit * attackSpeed;
  
  // PowerPerSecond = PowerPerHit * AttackSpeed
  const powerPerSecond = powerPerHit * attackSpeed;

  return {
    damagePerHit,
    powerPerHit,
    damagePerSecond,
    powerPerSecond,
    ds,
    ms: swordDamageMultiplier,
    power,
    sqrtPower,
    petPowerBonus,
    armorPowerBonus,
    attackSpeed
  };
}
