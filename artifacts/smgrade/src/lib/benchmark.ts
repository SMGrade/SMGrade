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
}

export interface ExtendedBenchmarkTier extends BenchmarkTier {
  weakDPS: number;
  avgDPS: number;
  strongDPS: number;
  eliteDPS: number;

  weakDPH: number;
  avgDPH: number;
  strongDPH: number;
  eliteDPH: number;

  weakPPH: number;
  avgPPH: number;
  strongPPH: number;
  elitePPH: number;

  weakProt: number;
  avgProt: number;
  strongProt: number;
  eliteProt: number;

  weakHealth: number;
  avgHealth: number;
  strongHealth: number;
  eliteHealth: number;

  avgWeaponTier: number;
  avgShieldTier: number;
  avgPetTier: number;

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
    avgGold: 1e7
  },
  {
    label: "Early",
    minLevel: 1000,
    maxLevel: 7999,
    weakPower: 1e17,
    avgPower: 4e17,
    strongPower: 6e17,
    elitePower: 1e18,
    avgGold: 1e8
  },
  {
    label: "Mid-Early",
    minLevel: 8000,
    maxLevel: 13999,
    weakPower: 5e18,
    avgPower: 1e19,
    strongPower: 3e19,
    elitePower: 6e19,
    avgGold: 3e16
  },
  {
    label: "Mid",
    minLevel: 14000,
    maxLevel: 19999,
    weakPower: 1e19,
    avgPower: 5e19,
    strongPower: 1.6e20,
    elitePower: 3e20,
    avgGold: 1e17
  },
  {
    label: "Mid-High",
    minLevel: 20000,
    maxLevel: 39999,
    weakPower: 7e19,
    avgPower: 2e20,
    strongPower: 1e21,
    elitePower: 5e21,
    avgGold: 1e18
  },
  {
    label: "Veteran",
    minLevel: 40000,
    maxLevel: 59999,
    weakPower: 4e20,
    avgPower: 1e21,
    strongPower: 5e21,
    elitePower: 2e22,
    avgGold: 5e18
  },
  {
    label: "Champion",
    minLevel: 60000,
    maxLevel: 79999,
    weakPower: 2e21,
    avgPower: 5e21,
    strongPower: 2e22,
    elitePower: 8e22,
    avgGold: 1e19
  },
  {
    label: "Elite",
    minLevel: 80000,
    maxLevel: Infinity,
    weakPower: 5e21,
    avgPower: 1e22,
    strongPower: 8e22,
    elitePower: 1e23,
    avgGold: 1e20
  }
];

export function extendBenchmark(bt: BenchmarkTier): ExtendedBenchmarkTier {
  const weakDPH = Math.round(Math.sqrt(bt.weakPower) * 5 + 10);
  const avgDPH = Math.round(Math.sqrt(bt.avgPower) * 15 + 15);
  const strongDPH = Math.round(Math.sqrt(bt.strongPower) * 40 + 100);
  const eliteDPH = Math.round(Math.sqrt(bt.elitePower) * 100 + 1000);
  
  const weakPPH = Math.round(Math.sqrt(bt.weakPower) * 2);
  const avgPPH = Math.round(Math.sqrt(bt.avgPower) * 5);
  const strongPPH = Math.round(Math.sqrt(bt.strongPower) * 10);
  const elitePPH = Math.round(Math.sqrt(bt.elitePower) * 20);

  const weakProt = Math.round(Math.sqrt(bt.weakPower) * 0.5);
  const avgProt = Math.round(Math.sqrt(bt.avgPower) * 2);
  const strongProt = Math.round(Math.sqrt(bt.strongPower) * 6);
  const eliteProt = Math.round(Math.sqrt(bt.elitePower) * 15);

  return {
    ...bt,
    weakDPH,
    avgDPH,
    strongDPH,
    eliteDPH,
    weakDPS: weakDPH * 2.77,
    avgDPS: avgDPH * 2.77,
    strongDPS: strongDPH * 2.77,
    eliteDPS: eliteDPH * 2.77,
    weakPPH,
    avgPPH,
    strongPPH,
    elitePPH,
    weakProt,
    avgProt,
    strongProt,
    eliteProt,
    weakHealth: Math.max(bt.minLevel * 20, 100),
    avgHealth: Math.max(bt.minLevel * 50, 500),
    strongHealth: Math.max(bt.minLevel * 150, 5000),
    eliteHealth: Math.max(bt.minLevel * 500, 50000),
    avgWeaponTier: 5,
    avgShieldTier: 5,
    avgPetTier: 5,
    avgStorageValue: bt.avgGold * 1.5,
    avgInventoryValue: bt.avgGold * 2.0,
  };
}

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

export function getInterpolatedBenchmark(level: number): ExtendedBenchmarkTier {
  const matched = getBenchmarkForLevel(level);
  const tiers = loadBenchmarkTiers();

  const reprLevels = [500, 4500, 11000, 17000, 30000, 50000, 70000, 100000];

  if (level <= reprLevels[0]) return extendBenchmark(tiers[0]);
  if (level >= reprLevels[reprLevels.length - 1]) {
    return extendBenchmark(tiers[tiers.length - 1]);
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

  const coreInterp: BenchmarkTier = {
    label: matched.label,
    minLevel: T1.minLevel,
    maxLevel: T2.maxLevel,
    weakPower: logInterp(T1.weakPower, T2.weakPower),
    avgPower: logInterp(T1.avgPower, T2.avgPower),
    strongPower: logInterp(T1.strongPower, T2.strongPower),
    elitePower: logInterp(T1.elitePower, T2.elitePower),
    avgGold: logInterp(T1.avgGold, T2.avgGold),
  };

  return extendBenchmark(coreInterp);
}

// Gear rank loaders for backward compatibility
export function getSwordTier(name: string): number {
  if (!name) return 0;
  const items = loadItems ? loadItems() : [];
  const found = items.find((i: any) => i.type === "sword" && name.toLowerCase().includes(i.name.toLowerCase()));
  return found ? found.tierRank : 0;
}

export function getShieldTier(name: string): number {
  if (!name) return 0;
  const items = loadItems ? loadItems() : [];
  const found = items.find((i: any) => i.type === "shield" && name.toLowerCase().includes(i.name.toLowerCase()));
  return found ? found.tierRank : 0;
}

export function getSwordRarity(name: string): string {
  if (!name) return "None";
  const items = loadItems ? loadItems() : [];
  const found = items.find((i: any) => i.type === "sword" && name.toLowerCase().includes(i.name.toLowerCase()));
  return found ? found.rarity : "Unknown";
}

export function getShieldRarity(name: string): string {
  if (!name) return "None";
  const items = loadItems ? loadItems() : [];
  const found = items.find((i: any) => i.type === "shield" && name.toLowerCase().includes(i.name.toLowerCase()));
  return found ? found.rarity : "Unknown";
}
import { loadItems } from "./gearDatabase.js";
