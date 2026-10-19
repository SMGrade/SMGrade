// Deterministic benchmark database built from real SwordMasters player data
// Fully editable and configurable in SMGrade Version 2.0.

import { parseNumber } from "./numberParser.js";

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
    label: "Initiate I",
    minLevel: 1,
    maxLevel: 999,
    weakPower: 100e6,
    avgPower: 5e9,
    strongPower: 20e9,
    elitePower: 100e9,
    avgGold: 10e6
  },
  {
    label: "Initiate II",
    minLevel: 1000,
    maxLevel: 4999,
    weakPower: 10e15,
    avgPower: 200e15,
    strongPower: 600e15,
    elitePower: 1e18,
    avgGold: 800e12
  },
  {
    label: "Wanderer I",
    minLevel: 5000,
    maxLevel: 9999,
    weakPower: 100e15,
    avgPower: 600e15,
    strongPower: 2e18,
    elitePower: 6e18,
    avgGold: 2e15
  },
  {
    label: "Wanderer II",
    minLevel: 10000,
    maxLevel: 14999,
    weakPower: 5e18,
    avgPower: 20e18,
    strongPower: 35e18,
    elitePower: 80e18,
    avgGold: 10e15
  },
  {
    label: "Warrior I",
    minLevel: 15000,
    maxLevel: 19999,
    weakPower: 10e18,
    avgPower: 50e18,
    strongPower: 65e18,
    elitePower: 100e18,
    avgGold: 30e15
  },
  {
    label: "Warrior II",
    minLevel: 20000,
    maxLevel: 24999,
    weakPower: 20e18,
    avgPower: 60e18,
    strongPower: 140e18,
    elitePower: 220e18,
    avgGold: 50e15
  },
  {
    label: "Veteran I",
    minLevel: 25000,
    maxLevel: 29999,
    weakPower: 30e18,
    avgPower: 80e18,
    strongPower: 200e18,
    elitePower: 300e18,
    avgGold: 60e15
  },
  {
    label: "Veteran II",
    minLevel: 30000,
    maxLevel: 34999,
    weakPower: 50e18,
    avgPower: 150e18,
    strongPower: 300e18,
    elitePower: 450e18,
    avgGold: 80e15
  },
  {
    label: "Champion I",
    minLevel: 35000,
    maxLevel: 39999,
    weakPower: 80e18,
    avgPower: 240e18,
    strongPower: 450e18,
    elitePower: 600e18,
    avgGold: 100e15
  },
  {
    label: "Champion II",
    minLevel: 40000,
    maxLevel: 44999,
    weakPower: 90e18,
    avgPower: 260e18,
    strongPower: 500e18,
    elitePower: 800e18,
    avgGold: 150e15
  },
  {
    label: "Elite I",
    minLevel: 45000,
    maxLevel: 49999,
    weakPower: 100e18,
    avgPower: 280e18,
    strongPower: 600e18,
    elitePower: 1e21,
    avgGold: 250e15
  },
  {
    label: "Elite II",
    minLevel: 50000,
    maxLevel: 54999,
    weakPower: 150e18,
    avgPower: 300e18,
    strongPower: 800e18,
    elitePower: 1.5e21,
    avgGold: 500e15
  },
  {
    label: "Sentinel I",
    minLevel: 55000,
    maxLevel: 59999,
    weakPower: 250e18,
    avgPower: 350e18,
    strongPower: 1e21,
    elitePower: 2e21,
    avgGold: 550e15
  },
  {
    label: "Sentinel II",
    minLevel: 60000,
    maxLevel: 64999,
    weakPower: 300e18,
    avgPower: 500e18,
    strongPower: 1.5e21,
    elitePower: 3e21,
    avgGold: 650e15
  },
  {
    label: "Ascendant I",
    minLevel: 65000,
    maxLevel: 69999,
    weakPower: 350e18,
    avgPower: 600e18,
    strongPower: 2e21,
    elitePower: 4e21,
    avgGold: 950e15
  },
  {
    label: "Ascendant II",
    minLevel: 70000,
    maxLevel: 79999,
    weakPower: 450e18,
    avgPower: 750e18,
    strongPower: 3e21,
    elitePower: 6e21,
    avgGold: 2e18
  },
  {
    label: "Legend I",
    minLevel: 80000,
    maxLevel: 89999,
    weakPower: 600e18,
    avgPower: 900e18,
    strongPower: 5e21,
    elitePower: 10e21,
    avgGold: 5e18
  },
  {
    label: "Legend II",
    minLevel: 90000,
    maxLevel: 99999,
    weakPower: 1e21,
    avgPower: 1.6e21,
    strongPower: 8e21,
    elitePower: 20e21,
    avgGold: 20e18
  },
  {
    label: "Immortal",
    minLevel: 100000,
    maxLevel: Infinity,
    weakPower: 2e21,
    avgPower: 5e21,
    strongPower: 20e21,
    elitePower: 50e21,
    avgGold: 50e18
  }
];

export function extendBenchmark(bt: BenchmarkTier): ExtendedBenchmarkTier {
  const weakPower = typeof bt.weakPower === "string" ? parseNumber(bt.weakPower) : Number(bt.weakPower || 0);
  const avgPower = typeof bt.avgPower === "string" ? parseNumber(bt.avgPower) : Number(bt.avgPower || 0);
  const strongPower = typeof bt.strongPower === "string" ? parseNumber(bt.strongPower) : Number(bt.strongPower || 0);
  const elitePower = typeof bt.elitePower === "string" ? parseNumber(bt.elitePower) : Number(bt.elitePower || 0);
  const avgGold = typeof bt.avgGold === "string" ? parseNumber(bt.avgGold) : Number(bt.avgGold || 0);

  const weakDPH = Math.round(Math.sqrt(weakPower) * 5 + 10);
  const avgDPH = Math.round(Math.sqrt(avgPower) * 15 + 15);
  const strongDPH = Math.round(Math.sqrt(strongPower) * 40 + 100);
  const eliteDPH = Math.round(Math.sqrt(elitePower) * 100 + 1000);
  
  const weakPPH = Math.round(Math.sqrt(weakPower) * 2);
  const avgPPH = Math.round(Math.sqrt(avgPower) * 5);
  const strongPPH = Math.round(Math.sqrt(strongPower) * 10);
  const elitePPH = Math.round(Math.sqrt(elitePower) * 20);

  const weakProt = Math.round(Math.sqrt(weakPower) * 0.5);
  const avgProt = Math.round(Math.sqrt(avgPower) * 2);
  const strongProt = Math.round(Math.sqrt(strongPower) * 6);
  const eliteProt = Math.round(Math.sqrt(elitePower) * 15);

  const parsedBt = {
    ...bt,
    weakPower,
    avgPower,
    strongPower,
    elitePower,
    avgGold,
  };

  return {
    ...parsedBt,
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
    avgStorageValue: avgGold * 1.5,
    avgInventoryValue: avgGold * 2.0,
  };
}

let benchmarksOverride: BenchmarkTier[] | null = null;
export function setOverrideBenchmarks(tiers: BenchmarkTier[] | null): void {
  benchmarksOverride = tiers;
}

export function loadBenchmarkTiers(): BenchmarkTier[] {
  if (benchmarksOverride) return benchmarksOverride;
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
  return extendBenchmark(getBenchmarkForLevel(level));
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
