const fs = require('fs');
const path = require('path');

const catalogPath = '/Users/machd/Downloads/SM REQS/game_catalog.json';
const targetPath = '/Users/machd/Desktop/SMGrade/SMGrade-Website/artifacts/smgrade/src/lib/gearDatabase.ts';

if (!fs.existsSync(catalogPath)) {
  console.error("Game catalog not found at", catalogPath);
  process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

// Emojis mapping
const swordEmojis = {
  "Old Sword": "🗡️",
  "Orc Sword": "🗡️",
  "Double-Edged Sword": "🗡️",
  "Spiked Sword": "🗡️",
  "Dead Man's Sword": "💀",
  "Machete Sword": "🗡️",
  "Scimitar Claw": "🗡️",
  "Morbid Will": "🗡️",
  "Inferno Claw": "🔥",
  "Burned Spikeblade": "🗡️",
  "Icebreaker": "❄️",
  "Frostbite": "❄️",
  "Froststeel": "🗡️",
  "Frostfang": "🗡️",
  "Winter's Wrath": "❄️",
  "Sandstrike": "🗡️",
  "Duneslicer": "🗡️",
  "Sandslasher": "🗡️",
  "Sunfire": "☀️",
  "Emberwraith": "🔥",
  "Blade of Sorrow": "🗡️",
  "Flame Heart": "❤️",
  "Darkblade": "🗡️",
  "Fatecutter": "🗡️",
  "Devil's Blade": "👿",
  "Spear of Zeus": "⚡",
  "Coral Blade": "🪸",
  "Spiked Moss": "🗡️",
  "Guardian's Spear": "🔱",
  "Dragon's Teeth": "🦷",
  "Dragon's Poison": "☣️",
  "Starfire Blade": "⭐",
  "Nova Blade": "🗡️",
  "Cosmic Blader": "🌌",
  "Netherite Blade": "🗡️",
  "Death's Scythe": "💀",
  "Dragon's Devil": "😈",
  "Einherjar's Blade": "🗡️",
  "Runebreaker": "🗡️",
  "Solbrand": "🔥",
  "Divinity Edge": "⚡",
  "Graveborn Edge": "🗡️",
  "Dreadmourne": "🗡️",
  "Soulkeeper's Blade": "💀",
  "Last Horizon": "🌌"
};

const petEmojis = {
  "Piggie": "🐷",
  "Chicko": "🐥",
  "Peppy": "🐹",
  "Gumbear": "🧸",
  "Croco": "🐊",
  "Blue Axolotl": "🦎",
  "Fluffy": "🐑",
  "Sandy": "🏜️",
  "Pengoo": "🐧",
  "Scorp": "🦂",
  "Kamel": "🐪",
  "Leo": "🦁",
  "Lava Slime": "🔥",
  "Firebat": "🦇",
  "Phoenix": "🐦",
  "Nemo": "🐠",
  "Sharkie": "🦈",
  "Octoo": "🐙",
  "Fogo": "🔥",
  "Purr": "🐱",
  "Xen": "👽",
  "XPeppy": "🌟",
  "XAxolotl": "✨",
  "XPengoo": "💎",
  "XLeo": "👑",
  "XPhoenix": "☄️",
  "XOctoo": "🌀",
  "XXen": "🌌",
  "Mimic": "📦",
  "Triwulf": "🐺",
  "Inferno": "🔥",
  "XInferno": "🌋",
  "Ponyo": "🐴",
  "Chandy": "🕯️",
  "Runix": "🔮",
  "XRunix": "🔆"
};

// Generate type mappings
const swordMappings = {};
catalog.swords.forEach(s => swordMappings[s.type] = s.name);
const shieldMappings = {};
catalog.shields.forEach(s => shieldMappings[s.type] = s.name);
const petMappings = {};
catalog.pets.forEach(p => petMappings[p.type] = p.name);

// Helper to format protection stat
function formatProt(val) {
  if (!val) return "-";
  if (val >= 1e9) return (val / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
  if (val >= 1e6) return (val / 1e6).toFixed(0) + 'M';
  if (val >= 1e3) return (val / 1e3).toFixed(0) + 'K';
  return val.toString();
}

// Generate default items array
const defaultItemsList = [];

// Swords
catalog.swords.forEach((s) => {
  const baseValue = s.damage / 1e9; // store in billions for frontend scaled values
  const emoji = swordEmojis[s.name] || "🗡️";
  defaultItemsList.push({
    name: s.name,
    type: "sword",
    rarity: s.rarity,
    baseValue: baseValue,
    maxLevel: 10,
    passive: "None",
    image: emoji,
    recommendationScore: s.type * 10,
    prices: {},
    tierRank: s.type,
    world: s.world || "Orkland W1",
    dropSource: s.source || "Unknown",
    protection: formatProt(s.damageProtection),
    healthMulti: s.healthMultiplier ? `${s.healthMultiplier}x` : "-",
    goldMulti: s.goldMultiplier ? `${s.goldMultiplier}x` : "-",
    typeId: s.type
  });
});

// Shields
catalog.shields.forEach((s) => {
  const emoji = "🛡️";
  defaultItemsList.push({
    name: s.name,
    type: "shield",
    rarity: s.rarity,
    baseValue: s.damageMultiplier || 1.0, // baseDM
    maxLevel: 10,
    passive: "None",
    image: emoji,
    recommendationScore: s.type * 10,
    prices: {},
    tierRank: s.type,
    world: s.world || "Orkland W1",
    dropSource: s.source || "Unknown",
    protection: formatProt(s.damageProtection),
    healthMulti: s.healthMultiplier ? `${s.healthMultiplier}x` : "-",
    goldMulti: s.goldMultiplier ? `${s.goldMultiplier}x` : "-",
    typeId: s.type
  });
});

// Pets
catalog.pets.forEach((p) => {
  const emoji = petEmojis[p.name] || "🐾";
  defaultItemsList.push({
    name: p.name,
    type: "pet",
    rarity: p.rarity,
    baseValue: p.powerMultiplier || 0,
    maxLevel: 10,
    passive: `+${p.goldMultiplier}x Gold, +${p.speedMultiplier}x Speed`,
    image: emoji,
    recommendationScore: p.type * 10,
    prices: {},
    tierRank: p.type,
    typeId: p.type,
    metadata: {
      goldMulti: p.goldMultiplier || 0,
      speedBoost: p.speedMultiplier || 0
    }
  });
});

const fileHeader = `// Real SwordMasters gear database — generated automatically from game_catalog.json
// Refactored to support dynamic entries (swords, shields, pets) and avoid hardcoded duplication.

export interface GameItem {
  id?: string;
  name: string;
  type: "sword" | "shield" | "pet" | "relic";
  rarity: "Common" | "Rare" | "Epic" | "Legendary";
  baseValue: number; // baseDamage for swords, baseDM for shields, powerMulti for pets
  maxLevel: number;
  passive: string;
  image: string;
  recommendationScore: number;
  prices: Record<number, string>;
  tierRank: number;
  
  // SwordMasters specific metadata fields
  world?: string;
  dropSource?: string;
  protection?: string;
  healthMulti?: string;
  goldMulti?: string;
  typeId?: number;

  metadata?: {
    goldMulti?: number;
    speedBoost?: number;
  };
}

export interface SwordData {
  name: string;
  rarity: "Common" | "Rare" | "Epic" | "Legendary";
  baseDamage: number;
  maxLevel: number;
  marketPriceNote: string | null;
  tierRank: number;
  world?: string;
  dropSource?: string;
  protection?: string;
  healthMulti?: string;
  goldMulti?: string;
  typeId?: number;
}

export interface ShieldData {
  name: string;
  rarity: "Common" | "Rare" | "Epic" | "Legendary";
  baseDM: number;
  maxLevel: number;
  marketPriceNote: string | null;
  tierRank: number;
  world?: string;
  dropSource?: string;
  protection?: string;
  healthMulti?: string;
  goldMulti?: string;
  typeId?: number;
}

const STORAGE_KEY = "smg_items_db_v2";

export const SWORD_TYPE_MAP: Record<number, string> = ${JSON.stringify(swordMappings, null, 2)};

export const SHIELD_TYPE_MAP: Record<number, string> = ${JSON.stringify(shieldMappings, null, 2)};

export const PET_TYPE_MAP: Record<number, string> = ${JSON.stringify(petMappings, null, 2)};

export const DEFAULT_ITEMS: GameItem[] = ${JSON.stringify(defaultItemsList, null, 2)};
`;

const fileFooter = `
export function loadItems(): GameItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GameItem[];
      const swordCount = parsed.filter(i => i.type === "sword").length;
      const petCount = parsed.filter(i => i.type === "pet").length;
      // If items list is outdated (e.g. doesn't have all 36 pets or 45 swords), force upgrade reset!
      if (swordCount < 45 || petCount < 36) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_ITEMS));
        return [...DEFAULT_ITEMS];
      }
      return parsed;
    }
  } catch (err) {
    // ignore parse errors
  }
  return [...DEFAULT_ITEMS];
}

export function saveItems(items: GameItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  reloadGearDatabase();
}

// Statically bound arrays for backward-compatible imports in pages
export const SWORDS: SwordData[] = [];
export const SHIELDS: ShieldData[] = [];

export function reloadGearDatabase(): void {
  const items = loadItems();

  SWORDS.length = 0;
  const swords = items
    .filter((i) => i.type === "sword")
    .map((i) => ({
      name: i.name,
      rarity: i.rarity,
      baseDamage: i.baseValue,
      maxLevel: i.maxLevel,
      marketPriceNote: i.prices[1] || null,
      tierRank: i.tierRank,
      world: i.world,
      dropSource: i.dropSource,
      protection: i.protection,
      healthMulti: i.healthMulti,
      goldMulti: i.goldMulti,
      typeId: i.typeId
    }))
    .sort((a, b) => a.tierRank - b.tierRank);
  SWORDS.push(...(swords as any));

  SHIELDS.length = 0;
  const shields = items
    .filter((i) => i.type === "shield")
    .map((i) => ({
      name: i.name,
      rarity: i.rarity,
      baseDM: i.baseValue,
      maxLevel: i.maxLevel,
      marketPriceNote: i.prices[1] || null,
      tierRank: i.tierRank,
      world: i.world,
      dropSource: i.dropSource,
      protection: i.protection,
      healthMulti: i.healthMulti,
      goldMulti: i.goldMulti,
      typeId: i.typeId
    }))
    .sort((a, b) => a.tierRank - b.tierRank);
  SHIELDS.push(...(shields as any));
}

// Initial binding
reloadGearDatabase();

export function scaledSwordDamage(baseDamage: number, level: number): number {
  return baseDamage * (1 + 0.25 * (level - 1));
}

export function scaledShieldDM(baseDM: number, level: number): number {
  return baseDM * (1 + 0.25 * (level - 1));
}

export function getSwordData(name: string): SwordData | null {
  if (!name) return null;
  const cleanName = name.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return SWORDS.find((s) => {
    const cleanS = s.name.replace(/[^a-z0-9]/gi, "").toLowerCase();
    return cleanName.includes(cleanS) || cleanS.includes(cleanName);
  }) ?? null;
}

export function getShieldData(name: string): ShieldData | null {
  if (!name) return null;
  const cleanName = name.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return SHIELDS.find((s) => {
    const cleanS = s.name.replace(/[^a-z0-9]/gi, "").toLowerCase();
    return cleanName.includes(cleanS) || cleanS.includes(cleanName);
  }) ?? null;
}

export function getNextSwordUpgrade(name: string): SwordData | null {
  const current = getSwordData(name);
  if (!current) {
    const isNone = !name || /none|empty|unknown/i.test(name);
    return isNone ? (SWORDS[0] || null) : null;
  }
  const next = SWORDS.find((s) => s.tierRank === current.tierRank + 1);
  return next ?? null;
}

export function getNextShieldUpgrade(name: string): ShieldData | null {
  const current = getShieldData(name);
  if (!current) {
    const isNone = !name || /none|empty|unknown/i.test(name);
    return isNone ? (SHIELDS[0] || null) : null;
  }
  const next = SHIELDS.find((s) => s.tierRank === current.tierRank + 1);
  return next ?? null;
}

export function swordUpgradeGain(currentName: string, currentLevel: number, nextName: string): number {
  const cur = getSwordData(currentName);
  const nxt = getSwordData(nextName);
  if (!cur || !nxt) return 0;
  const curDS = scaledSwordDamage(cur.baseDamage, currentLevel);
  const nxtDS = scaledSwordDamage(nxt.baseDamage, 1);
  return Math.round(((nxtDS - curDS) / curDS) * 100);
}

export function shieldUpgradeGain(currentName: string, currentLevel: number, nextName: string): number {
  const cur = getShieldData(currentName);
  const nxt = getShieldData(nextName);
  if (!cur || !nxt) return 0;
  const curDM = scaledShieldDM(cur.baseDM, currentLevel);
  const nxtDM = scaledShieldDM(nxt.baseDM, 1);
  return Math.round(((nxtDM - curDM) / curDM) * 100);
}

export function switchWorthwhileLevel(
  currentBase: number,
  currentLevel: number,
  nextBase: number
): number | null {
  const curStat = currentBase * (1 + 0.25 * (currentLevel - 1));
  if (nextBase >= curStat) return null;
  const x = 1 + 4 * (curStat / nextBase - 1);
  return Math.ceil(Math.min(x, 10));
}

const MAPPINGS_STORAGE_KEY = "smg_type_mappings_v1";

export interface TypeMappingsTable {
  swords: Record<number, string>;
  shields: Record<number, string>;
  pets: Record<number, string>;
}

export function loadTypeMappings(): TypeMappingsTable {
  try {
    const raw = localStorage.getItem(MAPPINGS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {}
  return {
    swords: { ...SWORD_TYPE_MAP },
    shields: { ...SHIELD_TYPE_MAP },
    pets: { ...PET_TYPE_MAP }
  };
}

export function saveTypeMappings(mappings: TypeMappingsTable): void {
  localStorage.setItem(MAPPINGS_STORAGE_KEY, JSON.stringify(mappings));
}

export function resolveItemByGameType(type: number, category: "sword" | "shield" | "pet"): GameItem | null {
  const mappings = loadTypeMappings();
  const name = category === "sword" ? mappings.swords[type] 
             : category === "shield" ? mappings.shields[type] 
             : mappings.pets[type];
             
  if (!name) {
    console.warn(\`[SMGrade] Missing type mapping for \${category} type ID: \${type}\`);
    try {
      const loggedRaw = localStorage.getItem("smg_unmapped_types_logged");
      const logged = loggedRaw ? JSON.parse(loggedRaw) : [];
      const entryStr = \`\${category}:\${type}\`;
      if (!logged.includes(entryStr)) {
        logged.push(entryStr);
        localStorage.setItem("smg_unmapped_types_logged", JSON.stringify(logged));
      }
    } catch (e) {}

    const label = \`Unknown \${category === "sword" ? "Sword" : category === "shield" ? "Shield" : "Pet"} (Type \${type})\`;
    return {
      name: label,
      type: category,
      rarity: "Common",
      baseValue: category === "sword" ? 0.00000001 : 1.0,
      maxLevel: 10,
      passive: "None",
      image: category === "sword" ? "🗡️" : category === "shield" ? "🛡️" : "🐹",
      recommendationScore: 0,
      prices: {},
      world: "Unknown",
      dropSource: "Unknown",
      tierRank: 0
    };
  }

  const items = loadItems();
  let found = items.find((i) => i.type === category && i.name.toLowerCase() === name.toLowerCase());
  if (!found) {
    found = DEFAULT_ITEMS.find((i) => i.type === category && i.name.toLowerCase() === name.toLowerCase());
  }

  if (found) return found;

  return {
    name: name,
    type: category,
    rarity: "Common",
    baseValue: category === "sword" ? 0.00000001 : 1.0,
    maxLevel: 10,
    passive: "None",
    image: category === "sword" ? "🗡️" : category === "shield" ? "🛡️" : "🐹",
    recommendationScore: 0,
    prices: {},
    world: "Unknown",
    dropSource: "Unknown",
    tierRank: 0
  };
}
`;

fs.writeFileSync(targetPath, fileHeader + fileFooter);
console.log("Successfully wrote updated gearDatabase.ts containing all official game data!");
