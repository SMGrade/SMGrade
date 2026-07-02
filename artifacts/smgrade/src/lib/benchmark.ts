// Deterministic benchmark database built from real SwordMasters player data
// Fully editable and configurable in SMGrade Version 2.0.

export interface BenchmarkTier {
  label: string;
  minLevel: number;
  maxLevel: number;

  // Power
  weakPower: number;
  avgPower: number;
  strongPower: number;
  elitePower: number;

  // Gold
  avgGold: number;

  // DPS
  weakDPS: number;
  avgDPS: number;
  strongDPS: number;
  eliteDPS: number;

  // Damage/Hit (DPH)
  weakDPH: number;
  avgDPH: number;
  strongDPH: number;
  eliteDPH: number;

  // Power/Hit (PPH)
  weakPPH: number;
  avgPPH: number;
  strongPPH: number;
  elitePPH: number;

  // Protection
  weakProt: number;
  avgProt: number;
  strongProt: number;
  eliteProt: number;

  // Health
  weakHealth: number;
  avgHealth: number;
  strongHealth: number;
  eliteHealth: number;

  // Equipment levels (1 to 45 / 43 / 35 ranks)
  avgWeaponTier: number;
  avgShieldTier: number;
  avgPetTier: number;

  // Net worth values
  avgStorageValue: number;
  avgInventoryValue: number;
}

const BENCHMARK_STORAGE_KEY = "smg_benchmark_tiers_v2";

export const DEFAULT_BENCHMARKS: BenchmarkTier[] = [
  {
    label: "Beginner",
    minLevel: 1,
    maxLevel: 999,
    weakPower: 1e8,
    avgPower: 5e9,
    strongPower: 20e9,
    elitePower: 100e9,
    avgGold: 1e7,
    weakDPS: 100,
    avgDPS: 500,
    strongDPS: 5000,
    eliteDPS: 50000,
    weakDPH: 10,
    avgDPH: 15,
    strongDPH: 100,
    eliteDPH: 1000,
    weakPPH: 10,
    avgPPH: 15,
    strongPPH: 100,
    elitePPH: 1000,
    weakProt: 0,
    avgProt: 100,
    strongProt: 1000,
    eliteProt: 10000,
    weakHealth: 100,
    avgHealth: 500,
    strongHealth: 5000,
    eliteHealth: 50000,
    avgWeaponTier: 3,
    avgShieldTier: 3,
    avgPetTier: 2,
    avgStorageValue: 1e6,
    avgInventoryValue: 1e6
  },
  {
    label: "Early",
    minLevel: 1000,
    maxLevel: 7999,
    weakPower: 1e17,
    avgPower: 4e17,
    strongPower: 6e17,
    elitePower: 1e18,
    avgGold: 1e8,
    weakDPS: 10000,
    avgDPS: 50000,
    strongDPS: 200000,
    eliteDPS: 1000000,
    weakDPH: 1000,
    avgDPH: 5000,
    strongDPH: 20000,
    eliteDPH: 100000,
    weakPPH: 1000,
    avgPPH: 5000,
    strongPPH: 20000,
    elitePPH: 100000,
    weakProt: 1000,
    avgProt: 5000,
    strongProt: 20000,
    eliteProt: 100000,
    weakHealth: 50000,
    avgHealth: 200000,
    strongHealth: 1000000,
    eliteHealth: 10000000,
    avgWeaponTier: 10,
    avgShieldTier: 10,
    avgPetTier: 5,
    avgStorageValue: 1e8,
    avgInventoryValue: 1e7
  },
  {
    label: "Mid-Early",
    minLevel: 8000,
    maxLevel: 13999,
    weakPower: 5e18,
    avgPower: 1e19,
    strongPower: 3e19,
    elitePower: 6e19,
    avgGold: 3e16,
    weakDPS: 1e7,
    avgDPS: 5e7,
    strongDPS: 2e8,
    eliteDPS: 1e9,
    weakDPH: 1e6,
    avgDPH: 5e6,
    strongDPH: 2e7,
    eliteDPH: 1e8,
    weakPPH: 1e6,
    avgPPH: 5e6,
    strongPPH: 2e7,
    elitePPH: 1e8,
    weakProt: 1e6,
    avgProt: 5e6,
    strongProt: 2e7,
    eliteProt: 1e8,
    weakHealth: 1e8,
    avgHealth: 5e8,
    strongHealth: 2e9,
    eliteHealth: 1e10,
    avgWeaponTier: 20,
    avgShieldTier: 20,
    avgPetTier: 12,
    avgStorageValue: 1e16,
    avgInventoryValue: 1e15
  },
  {
    label: "Mid",
    minLevel: 14000,
    maxLevel: 19999,
    weakPower: 1e19,
    avgPower: 5e19,
    strongPower: 1.6e20,
    elitePower: 3e20,
    avgGold: 1e17,
    weakDPS: 5e8,
    avgDPS: 2e9,
    strongDPS: 1e10,
    eliteDPS: 5e10,
    weakDPH: 5e7,
    avgDPH: 2e8,
    strongDPH: 1e9,
    eliteDPH: 5e9,
    weakPPH: 5e7,
    avgPPH: 2e8,
    strongPPH: 1e9,
    elitePPH: 5e9,
    weakProt: 5e7,
    avgProt: 2e8,
    strongProt: 1e9,
    eliteProt: 5e9,
    weakHealth: 5e9,
    avgHealth: 2e10,
    strongHealth: 1e11,
    eliteHealth: 5e11,
    avgWeaponTier: 30,
    avgShieldTier: 30,
    avgPetTier: 20,
    avgStorageValue: 5e16,
    avgInventoryValue: 5e15
  },
  {
    label: "Mid-High",
    minLevel: 20000,
    maxLevel: 39999,
    weakPower: 7e19,
    avgPower: 2e20,
    strongPower: 1e21,
    elitePower: 5e21,
    avgGold: 1e18,
    weakDPS: 5e9,
    avgDPS: 2e10,
    strongDPS: 1e11,
    eliteDPS: 5e11,
    weakDPH: 5e8,
    avgDPH: 2e9,
    strongDPH: 1e10,
    eliteDPH: 5e10,
    weakPPH: 5e8,
    avgPPH: 2e9,
    strongPPH: 1e10,
    elitePPH: 5e10,
    weakProt: 5e8,
    avgProt: 2e9,
    strongProt: 1e10,
    eliteProt: 5e10,
    weakHealth: 5e10,
    avgHealth: 2e11,
    strongHealth: 1e12,
    eliteHealth: 5e12,
    avgWeaponTier: 35,
    avgShieldTier: 35,
    avgPetTier: 25,
    avgStorageValue: 2e17,
    avgInventoryValue: 2e16
  },
  {
    label: "Veteran",
    minLevel: 40000,
    maxLevel: 59999,
    weakPower: 4e20,
    avgPower: 1e21,
    strongPower: 5e21,
    elitePower: 2e22,
    avgGold: 5e18,
    weakDPS: 5e10,
    avgDPS: 2e11,
    strongDPS: 1e12,
    eliteDPS: 5e12,
    weakDPH: 5e9,
    avgDPH: 2e10,
    strongDPH: 1e11,
    eliteDPH: 5e11,
    weakPPH: 5e9,
    avgPPH: 2e10,
    strongPPH: 1e11,
    elitePPH: 5e11,
    weakProt: 5e9,
    avgProt: 2e10,
    strongProt: 1e11,
    eliteProt: 5e11,
    weakHealth: 5e11,
    avgHealth: 2e12,
    strongHealth: 1e13,
    eliteHealth: 5e13,
    avgWeaponTier: 40,
    avgShieldTier: 38,
    avgPetTier: 30,
    avgStorageValue: 1e18,
    avgInventoryValue: 1e17
  },
  {
    label: "Champion",
    minLevel: 60000,
    maxLevel: 79999,
    weakPower: 2e21,
    avgPower: 5e21,
    strongPower: 2e22,
    elitePower: 8e22,
    avgGold: 1e19,
    weakDPS: 2e11,
    avgDPS: 1e12,
    strongDPS: 5e12,
    eliteDPS: 2e13,
    weakDPH: 2e10,
    avgDPH: 1e11,
    strongDPH: 5e11,
    eliteDPH: 2e12,
    weakPPH: 2e10,
    avgPPH: 1e11,
    strongPPH: 5e11,
    elitePPH: 2e12,
    weakProt: 2e10,
    avgProt: 1e11,
    strongProt: 5e11,
    eliteProt: 2e12,
    weakHealth: 2e12,
    avgHealth: 1e13,
    strongHealth: 5e13,
    eliteHealth: 2e14,
    avgWeaponTier: 42,
    avgShieldTier: 41,
    avgPetTier: 33,
    avgStorageValue: 5e18,
    avgInventoryValue: 5e17
  },
  {
    label: "Elite",
    minLevel: 80000,
    maxLevel: Infinity,
    weakPower: 5e21,
    avgPower: 1e22,
    strongPower: 8e22,
    elitePower: 1e23,
    avgGold: 1e20,
    weakDPS: 1e12,
    avgDPS: 5e12,
    strongDPS: 2e13,
    eliteDPS: 1e14,
    weakDPH: 1e11,
    avgDPH: 5e11,
    strongDPH: 2e12,
    eliteDPH: 1e13,
    weakPPH: 1e11,
    avgPPH: 5e11,
    strongPPH: 2e12,
    elitePPH: 1e13,
    weakProt: 1e11,
    avgProt: 5e11,
    strongProt: 2e12,
    eliteProt: 1e13,
    weakHealth: 1e13,
    avgHealth: 5e13,
    strongHealth: 2e14,
    eliteHealth: 1e15,
    avgWeaponTier: 45,
    avgShieldTier: 43,
    avgPetTier: 35,
    avgStorageValue: 2e19,
    avgInventoryValue: 2e18
  }
];

export function loadBenchmarkTiers(): BenchmarkTier[] {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = localStorage.getItem(BENCHMARK_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BenchmarkTier[];
        return parsed.map(t => ({
          ...t,
          maxLevel: t.maxLevel === null || (t.maxLevel as any) === "Infinity" ? Infinity : t.maxLevel
        }));
      }
    }
  } catch {}
  return [...DEFAULT_BENCHMARKS];
}

export function saveBenchmarkTiers(tiers: BenchmarkTier[]): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const serialized = tiers.map(t => ({
        ...t,
        maxLevel: t.maxLevel === Infinity ? "Infinity" : t.maxLevel
      }));
      localStorage.setItem(BENCHMARK_STORAGE_KEY, JSON.stringify(serialized));
    }
  } catch {}
}

export function getBenchmarkForLevel(level: number): BenchmarkTier {
  const tiers = loadBenchmarkTiers();
  return (
    tiers.find((t) => level >= t.minLevel && level <= t.maxLevel) ??
    tiers[tiers.length - 1]
  );
}

export function getInterpolatedBenchmark(level: number): BenchmarkTier {
  const matched = getBenchmarkForLevel(level);
  const tiers = loadBenchmarkTiers();

  const reprLevels = [500, 4500, 11000, 17000, 30000, 50000, 70000, 100000];

  if (level <= reprLevels[0]) return { ...tiers[0] };
  if (level >= reprLevels[reprLevels.length - 1]) {
    return { ...tiers[tiers.length - 1] };
  }

  let idx = 0;
  for (let i = 0; i < reprLevels.length - 1; i++) {
    if (level >= reprLevels[i] && level < reprLevels[i + 1]) {
      idx = i;
      break;
    }
  }

  const L1 = reprLevels[idx];
  const L2 = reprLevels[idx + 1];
  const T1 = tiers[idx] || tiers[tiers.length - 1];
  const T2 = tiers[idx + 1] || tiers[tiers.length - 1];

  const r = (level - L1) / (L2 - L1);

  const logInterp = (v1: number, v2: number) => {
    if (v1 <= 0 || v2 <= 0) return 0;
    return Math.pow(10, (1 - r) * Math.log10(v1) + r * Math.log10(v2));
  };

  const linearInterp = (v1: number, v2: number) => {
    return v1 + r * (v2 - v1);
  };

  return {
    label: matched.label,
    minLevel: T1.minLevel,
    maxLevel: T2.maxLevel,
    weakPower: logInterp(T1.weakPower, T2.weakPower),
    avgPower: logInterp(T1.avgPower, T2.avgPower),
    strongPower: logInterp(T1.strongPower, T2.strongPower),
    elitePower: logInterp(T1.elitePower, T2.elitePower),
    avgGold: logInterp(T1.avgGold, T2.avgGold),
    
    weakDPS: logInterp(T1.weakDPS, T2.weakDPS),
    avgDPS: logInterp(T1.avgDPS, T2.avgDPS),
    strongDPS: logInterp(T1.strongDPS, T2.strongDPS),
    eliteDPS: logInterp(T1.eliteDPS, T2.eliteDPS),

    weakDPH: logInterp(T1.weakDPH, T2.weakDPH),
    avgDPH: logInterp(T1.avgDPH, T2.avgDPH),
    strongDPH: logInterp(T1.strongDPH, T2.strongDPH),
    eliteDPH: logInterp(T1.eliteDPH, T2.eliteDPH),

    weakPPH: logInterp(T1.weakPPH, T2.weakPPH),
    avgPPH: logInterp(T1.avgPPH, T2.avgPPH),
    strongPPH: logInterp(T1.strongPPH, T2.strongPPH),
    elitePPH: logInterp(T1.elitePPH, T2.elitePPH),

    weakProt: logInterp(T1.weakProt, T2.weakProt),
    avgProt: logInterp(T1.avgProt, T2.avgProt),
    strongProt: logInterp(T1.strongProt, T2.strongProt),
    eliteProt: logInterp(T1.eliteProt, T2.eliteProt),

    weakHealth: logInterp(T1.weakHealth, T2.weakHealth),
    avgHealth: logInterp(T1.avgHealth, T2.avgHealth),
    strongHealth: logInterp(T1.strongHealth, T2.strongHealth),
    eliteHealth: logInterp(T1.eliteHealth, T2.eliteHealth),

    avgWeaponTier: linearInterp(T1.avgWeaponTier, T2.avgWeaponTier),
    avgShieldTier: linearInterp(T1.avgShieldTier, T2.avgShieldTier),
    avgPetTier: linearInterp(T1.avgPetTier, T2.avgPetTier),
    avgStorageValue: logInterp(T1.avgStorageValue, T2.avgStorageValue),
    avgInventoryValue: logInterp(T1.avgInventoryValue, T2.avgInventoryValue),
  };
}

// Gear rank loaders for backward compatibility
export function getSwordTier(name: string): number {
  if (!name) return 0;
  const items = loadItems ? loadItems() : [];
  const found = items.find(i => i.type === "sword" && name.toLowerCase().includes(i.name.toLowerCase()));
  return found ? found.tierRank : 0;
}

export function getShieldTier(name: string): number {
  if (!name) return 0;
  const items = loadItems ? loadItems() : [];
  const found = items.find(i => i.type === "shield" && name.toLowerCase().includes(i.name.toLowerCase()));
  return found ? found.tierRank : 0;
}

export function getSwordRarity(name: string): string {
  if (!name) return "None";
  const items = loadItems ? loadItems() : [];
  const found = items.find(i => i.type === "sword" && name.toLowerCase().includes(i.name.toLowerCase()));
  return found ? found.rarity : "Unknown";
}

export function getShieldRarity(name: string): string {
  if (!name) return "None";
  const items = loadItems ? loadItems() : [];
  const found = items.find(i => i.type === "shield" && name.toLowerCase().includes(i.name.toLowerCase()));
  return found ? found.rarity : "Unknown";
}
import { loadItems } from "./gearDatabase";
