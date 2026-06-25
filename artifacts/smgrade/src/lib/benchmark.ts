// Deterministic benchmark database built from real SwordMasters player data

export interface BenchmarkTier {
  minLevel: number;
  maxLevel: number;
  label: string;
  avgPower: number;
  weakPower: number;
  strongPower: number;
  elitePower: number;
  avgGold: number;
  typicalSwords: string[];
  topSwords: string[];
  typicalShields: string[];
  topShields: string[];
}

// Gear rarity/tier rankings (higher = better)
export const SWORD_TIER: Record<string, number> = {
  Empty: 0,
  "Wooden Sword": 1,
  "Stone Sword": 2,
  "Iron Sword": 3,
  "Gold Sword": 4,
  "Diamond Sword": 5,
  Netherite: 6,
  "Netherite Blade": 7,
  "Soulkeeper's Blade": 8,
  Runebreaker: 9,
  Solbrand: 10,
  "Last Horizon": 11,
  "Dragon's Devil": 12,
  "Divinity Edge": 13,
};

export const SHIELD_TIER: Record<string, number> = {
  Empty: 0,
  "Wooden Shield": 1,
  "Stone Shield": 2,
  "Iron Shield": 3,
  "Gold Shield": 4,
  "Diamond Shield": 5,
  Sealguard: 6,
  "Death's Shield": 7,
  "Sunward Bulwark": 8,
  "Asgardian Aegis": 9,
  "Final Bastion": 10,
};

export const SWORD_RARITY: Record<string, string> = {
  Empty: "None",
  "Wooden Sword": "Common",
  "Stone Sword": "Common",
  "Iron Sword": "Uncommon",
  "Gold Sword": "Uncommon",
  "Diamond Sword": "Rare",
  Netherite: "Rare",
  "Netherite Blade": "Epic",
  "Soulkeeper's Blade": "Epic",
  Runebreaker: "Epic",
  Solbrand: "Epic",
  "Last Horizon": "Legendary",
  "Dragon's Devil": "Legendary",
  "Divinity Edge": "Legendary",
};

export const SHIELD_RARITY: Record<string, string> = {
  Empty: "None",
  "Wooden Shield": "Common",
  "Stone Shield": "Common",
  "Iron Shield": "Uncommon",
  "Gold Shield": "Uncommon",
  "Diamond Shield": "Rare",
  Sealguard: "Epic",
  "Death's Shield": "Epic",
  "Sunward Bulwark": "Epic",
  "Asgardian Aegis": "Legendary",
  "Final Bastion": "Legendary",
};

// Benchmark tiers derived from the real dataset
export const BENCHMARK_TIERS: BenchmarkTier[] = [
  {
    minLevel: 1,
    maxLevel: 999,
    label: "Beginner",
    avgPower: 5e9,
    weakPower: 1e8,
    strongPower: 20e9,
    elitePower: 100e9,
    avgGold: 1e9,
    typicalSwords: ["Empty", "Wooden Sword", "Stone Sword", "Iron Sword"],
    topSwords: ["Gold Sword", "Diamond Sword"],
    typicalShields: ["Empty", "Wooden Shield"],
    topShields: ["Stone Shield", "Iron Shield"],
  },
  {
    minLevel: 1000,
    maxLevel: 4999,
    label: "Early",
    avgPower: 50e9,
    weakPower: 5e9,
    strongPower: 200e9,
    elitePower: 1e12,
    avgGold: 10e9,
    typicalSwords: ["Iron Sword", "Gold Sword", "Diamond Sword"],
    topSwords: ["Netherite Blade", "Soulkeeper's Blade"],
    typicalShields: ["Empty", "Sealguard"],
    topShields: ["Death's Shield", "Sunward Bulwark"],
  },
  {
    minLevel: 5000,
    maxLevel: 9999,
    label: "Mid-Early",
    // Real data: XxmalumaxX L7455 power=47.1QT, Ddv932013 L7075 power=1.25QNT, VNxSHUUYA L9381 power=41.3QNT
    avgPower: 200e12,     // ~200T average
    weakPower: 10e12,
    strongPower: 1e15,    // 1QT
    elitePower: 50e15,    // 50QT
    avgGold: 50e12,
    typicalSwords: ["Solbrand", "Soulkeeper's Blade"],
    topSwords: ["Runebreaker", "Last Horizon", "Dragon's Devil", "Divinity Edge"],
    typicalShields: ["Sealguard", "Death's Shield", "Sunward Bulwark"],
    topShields: ["Asgardian Aegis", "Final Bastion"],
  },
  {
    minLevel: 10000,
    maxLevel: 19999,
    label: "Mid",
    // Real data: YAMxARF L12586 power=9.95QT, GHOST1209 L12605 power=10.3QNT, SALMANxGOAT L21574 power=18.3QT
    avgPower: 20e15,      // ~20QT average
    weakPower: 1e15,
    strongPower: 100e15,  // 100QT
    elitePower: 1e18,     // 1QNT
    avgGold: 20e15,
    typicalSwords: ["Solbrand", "Soulkeeper's Blade", "Runebreaker"],
    topSwords: ["Last Horizon", "Dragon's Devil", "Divinity Edge"],
    typicalShields: ["Sunward Bulwark", "Death's Shield", "Sealguard"],
    topShields: ["Asgardian Aegis", "Final Bastion"],
  },
  {
    minLevel: 20000,
    maxLevel: 39999,
    label: "Mid-High",
    // Real data: Aeeeee67 L32601 power=2.56SXT, SALMANXGOAT L43571 power=631QNT, NiceFace L42863 power=1.11SXT
    avgPower: 200e18,     // ~200QNT average
    weakPower: 10e18,
    strongPower: 1e21,    // 1SXT
    elitePower: 5e21,
    avgGold: 200e18,
    typicalSwords: ["Solbrand", "Divinity Edge", "Dragon's Devil"],
    topSwords: ["Divinity Edge", "Last Horizon"],
    typicalShields: ["Asgardian Aegis", "Sunward Bulwark"],
    topShields: ["Asgardian Aegis", "Final Bastion"],
  },
  {
    minLevel: 40000,
    maxLevel: 79999,
    label: "High",
    // Real data: kitsune12345 L68927 power=1.08SXT, M0RI8Shokora1JPN L61819 power=1.31SXT
    avgPower: 1e21,       // 1SXT average
    weakPower: 100e18,
    strongPower: 5e21,
    elitePower: 20e21,
    avgGold: 1e21,
    typicalSwords: ["Divinity Edge", "Dragon's Devil"],
    topSwords: ["Divinity Edge"],
    typicalShields: ["Asgardian Aegis", "Final Bastion"],
    topShields: ["Asgardian Aegis", "Final Bastion"],
  },
  {
    minLevel: 80000,
    maxLevel: Infinity,
    label: "Elite",
    // Real data: ZywOo L99293 power=104SXT
    avgPower: 50e21,
    weakPower: 5e21,
    strongPower: 200e21,
    elitePower: 1e24,
    avgGold: 50e21,
    typicalSwords: ["Divinity Edge"],
    topSwords: ["Divinity Edge"],
    typicalShields: ["Asgardian Aegis", "Final Bastion"],
    topShields: ["Final Bastion"],
  },
];

export function getBenchmarkForLevel(level: number): BenchmarkTier {
  return (
    BENCHMARK_TIERS.find((t) => level >= t.minLevel && level <= t.maxLevel) ??
    BENCHMARK_TIERS[BENCHMARK_TIERS.length - 1]
  );
}

export function getSwordTier(name: string): number {
  const key = Object.keys(SWORD_TIER).find((k) =>
    name.toLowerCase().includes(k.toLowerCase())
  );
  return key ? SWORD_TIER[key] : 0;
}

export function getShieldTier(name: string): number {
  const key = Object.keys(SHIELD_TIER).find((k) =>
    name.toLowerCase().includes(k.toLowerCase())
  );
  return key ? SHIELD_TIER[key] : 0;
}

export function getSwordRarity(name: string): string {
  const key = Object.keys(SWORD_RARITY).find((k) =>
    name.toLowerCase().includes(k.toLowerCase())
  );
  return key ? SWORD_RARITY[key] : "Unknown";
}

export function getShieldRarity(name: string): string {
  const key = Object.keys(SHIELD_RARITY).find((k) =>
    name.toLowerCase().includes(k.toLowerCase())
  );
  return key ? SHIELD_RARITY[key] : "Unknown";
}
