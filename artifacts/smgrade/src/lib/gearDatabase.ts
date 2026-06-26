// Real SwordMasters gear database — stats extracted from game data + market prices from trade logs

export interface SwordData {
  name: string;
  rarity: "Common" | "Rare" | "Epic" | "Legendary";
  baseDamage: number;   // Lv1 damage in billions
  maxLevel: number;
  marketPriceNote: string | null;
  tierRank: number;      // 1 = worst, higher = better
}

export interface ShieldData {
  name: string;
  rarity: "Common" | "Rare" | "Epic" | "Legendary";
  baseDM: number;        // Lv1 Damage Multiplier (raw value, e.g. 14 means 14x)
  maxLevel: number;
  marketPriceNote: string | null;
  tierRank: number;
}

// Level scaling: Lv n = base × (1 + 0.25 × (n − 1))   [NOT compounded]
export function scaledSwordDamage(baseDamage: number, level: number): number {
  return baseDamage * (1 + 0.25 * (level - 1));
}

export function scaledShieldDM(baseDM: number, level: number): number {
  return baseDM * (1 + 0.25 * (level - 1));
}

// Verified from game data (Untitled_document_1.txt):
// - Graveborn Edge Lv10 = 4.55B → base 1.40B
// - Runebreaker Lv10 = 4.88B → base 1.50B
// - Solbrand Lv7 = 5.0B → base 2.0B
// - Soulkeeper's Blade Lv1 = 4.0B (confirmed), Lv5 = 8.0B ✓
// - Dragon's Devil Lv5 = 10.0B → base 5.0B (Lv2 = 6.25B ✓)
// - Divinity Edge Lv10 = 26.0B → base 8.0B
// - Last Horizon Lv10 = 39.0B → base 12.0B
// Shield DM from game: Dragon's Soul Lv2=10x, Lv3=12x → base 8x
//                      Sealguard Lv5=13x → base 6.5x
//                      Final Bastion Lv1=14x (confirmed direct)

export const SWORDS: SwordData[] = [
  {
    name: "Graveborn Edge",
    rarity: "Common",
    baseDamage: 1.40,
    maxLevel: 10,
    marketPriceNote: "~50 QT (Lv5)",
    tierRank: 1,
  },
  {
    name: "Runebreaker",
    rarity: "Rare",
    baseDamage: 1.50,
    maxLevel: 10,
    marketPriceNote: "~53 QT (Lv5)",
    tierRank: 2,
  },
  {
    name: "Solbrand",
    rarity: "Epic",
    baseDamage: 2.00,
    maxLevel: 10,
    marketPriceNote: "~200–220 QT (Lv3) | ~800+ QT (Lv5)",
    tierRank: 3,
  },
  {
    name: "Soulkeeper's Blade",
    rarity: "Epic",
    baseDamage: 4.00,
    maxLevel: 10,
    marketPriceNote: "~500 QT (Lv1)",
    tierRank: 4,
  },
  {
    name: "Dragon's Devil",
    rarity: "Legendary",
    baseDamage: 5.00,
    maxLevel: 10,
    marketPriceNote: null,
    tierRank: 5,
  },
  {
    name: "Divinity Edge",
    rarity: "Legendary",
    baseDamage: 8.00,
    maxLevel: 10,
    marketPriceNote: "~280–345 QNT (Lv1)",
    tierRank: 6,
  },
  {
    name: "Last Horizon",
    rarity: "Legendary",
    baseDamage: 12.0,
    maxLevel: 10,
    marketPriceNote: "~390–420 QNT (Lv1)",
    tierRank: 7,
  },
];

export const SHIELDS: ShieldData[] = [
  {
    name: "Sealguard",
    rarity: "Epic",
    baseDM: 6.5,
    maxLevel: 10,
    marketPriceNote: null,
    tierRank: 1,
  },
  {
    name: "Sunward Bulwark",
    rarity: "Epic",
    baseDM: 7.0,
    maxLevel: 10,
    marketPriceNote: null,
    tierRank: 2,
  },
  {
    name: "Dragon's Soul",
    rarity: "Legendary",
    baseDM: 8.0,
    maxLevel: 10,
    marketPriceNote: null,
    tierRank: 3,
  },
  {
    name: "Asgardian Aegis",
    rarity: "Legendary",
    baseDM: 10.0,
    maxLevel: 10,
    marketPriceNote: "~280–345 QNT (Lv1)",
    tierRank: 4,
  },
  {
    name: "Final Bastion",
    rarity: "Legendary",
    baseDM: 14.0,
    maxLevel: 10,
    marketPriceNote: "~390–420 QNT (Lv1)",
    tierRank: 5,
  },
];

export function getSwordData(name: string): SwordData | null {
  return SWORDS.find((s) => name.toLowerCase().includes(s.name.toLowerCase())) ?? null;
}

export function getShieldData(name: string): ShieldData | null {
  return SHIELDS.find((s) => name.toLowerCase().includes(s.name.toLowerCase())) ?? null;
}

/** Returns the next sword upgrade above the current one, or null if already best */
export function getNextSwordUpgrade(name: string): SwordData | null {
  const current = getSwordData(name);
  if (!current) return SWORDS[0];
  const next = SWORDS.find((s) => s.tierRank === current.tierRank + 1);
  return next ?? null;
}

/** Returns the next shield upgrade above the current one, or null if already best */
export function getNextShieldUpgrade(name: string): ShieldData | null {
  const current = getShieldData(name);
  if (!current) return SHIELDS[0];
  const next = SHIELDS.find((s) => s.tierRank === current.tierRank + 1);
  return next ?? null;
}

/** Estimated damage-multiplier gain from upgrading sword (% increase in ds contribution) */
export function swordUpgradeGain(currentName: string, currentLevel: number, nextName: string): number {
  const cur = getSwordData(currentName);
  const nxt = getSwordData(nextName);
  if (!cur || !nxt) return 0;
  const curDS = scaledSwordDamage(cur.baseDamage, currentLevel);
  const nxtDS = scaledSwordDamage(nxt.baseDamage, 1);
  return Math.round(((nxtDS - curDS) / curDS) * 100);
}

/** Estimated DM gain from upgrading shield (% increase in damage multiplier) */
export function shieldUpgradeGain(currentName: string, currentLevel: number, nextName: string): number {
  const cur = getShieldData(currentName);
  const nxt = getShieldData(nextName);
  if (!cur || !nxt) return 0;
  const curDM = scaledShieldDM(cur.baseDM, currentLevel);
  const nxtDM = scaledShieldDM(nxt.baseDM, 1);
  return Math.round(((nxtDM - curDM) / curDM) * 100);
}

/**
 * The level the NEXT item needs to reach before it beats your current item at its current level.
 * Returns null if next item at Lv1 is already better (switch now).
 * Returns a level 1–10 if you should wait until the next item hits that level.
 */
export function switchWorthwhileLevel(
  currentBase: number,
  currentLevel: number,
  nextBase: number
): number | null {
  const curStat = currentBase * (1 + 0.25 * (currentLevel - 1));
  if (nextBase >= curStat) return null; // next Lv1 already wins → switch now
  // nextBase × (1 + 0.25×(X−1)) = curStat
  // X = 1 + 4×(curStat/nextBase − 1)
  const x = 1 + 4 * (curStat / nextBase - 1);
  return Math.ceil(Math.min(x, 10));
}
