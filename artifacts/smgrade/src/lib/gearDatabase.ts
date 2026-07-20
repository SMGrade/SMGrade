// Real SwordMasters gear database — generated automatically from game_catalog.json
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
  minLevel?: number;

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
  minLevel?: number;
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
  minLevel?: number;
}

const STORAGE_KEY = "smg_items_db_v2";

export const SWORD_TYPE_MAP: Record<number, string> = {
  "1": "Old Sword",
  "2": "Orc Sword",
  "3": "Double-Edged Sword",
  "4": "Spiked Sword",
  "5": "Dead Man's Sword",
  "6": "Machete Sword",
  "7": "Scimitar Claw",
  "8": "Morbid Will",
  "9": "Inferno Claw",
  "10": "Burned Spikeblade",
  "11": "Icebreaker",
  "12": "Frostbite",
  "13": "Froststeel",
  "14": "Frostfang",
  "15": "Winter's Wrath",
  "16": "Sandstrike",
  "17": "Duneslicer",
  "18": "Sandslasher",
  "19": "Sunfire",
  "20": "Emberwraith",
  "21": "Blade of Sorrow",
  "22": "Flame Heart",
  "23": "Darkblade",
  "24": "Fatecutter",
  "25": "Devil's Blade",
  "26": "Spear of Zeus",
  "27": "Coral Blade",
  "28": "Spiked Moss",
  "29": "Guardian's Spear",
  "30": "Dragon's Teeth",
  "31": "Dragon's Poison",
  "32": "Starfire Blade",
  "33": "Nova Blade",
  "34": "Cosmic Blader",
  "35": "Netherite Blade",
  "36": "Death's Scythe",
  "37": "Dragon's Devil",
  "38": "Einherjar's Blade",
  "39": "Runebreaker",
  "40": "Solbrand",
  "41": "Divinity Edge",
  "42": "Graveborn Edge",
  "43": "Dreadmourne",
  "44": "Soulkeeper's Blade",
  "45": "Last Horizon"
};

export const SHIELD_TYPE_MAP: Record<number, string> = {
  "1": "Wooden Shield",
  "2": "Iron Shield",
  "3": "Elite Shield",
  "4": "Warrior's Shield",
  "5": "Shield of the Kingdom",
  "6": "Sweetguard",
  "7": "Warden's Shield",
  "8": "Light Barrier",
  "9": "Obsidian Canny",
  "10": "Dead Guard's Shield",
  "11": "Snowfall Defender",
  "12": "Arctic Ward",
  "13": "Icy Rampart",
  "14": "Frozen Fortress",
  "15": "Winter's Wrathguard",
  "16": "Sunshield",
  "17": "Barbed Sunward",
  "18": "Sunshroud",
  "19": "Sandstone Shield",
  "20": "Emberwraith Shield",
  "21": "Hell Shield",
  "22": "Shield of Fire",
  "23": "Fire Rampart",
  "24": "Infernal Protection",
  "25": "Lord of Hell",
  "26": "Steel Shield",
  "27": "Hardened Moss",
  "28": "Guardian's Protection",
  "29": "Dragon's Shell",
  "30": "Dragon's Anger",
  "31": "Nebula Shield",
  "32": "Starburst Shield",
  "33": "Lunar Shield",
  "34": "Death's Shield",
  "35": "Dragon's Soul",
  "36": "Einherjar's Guard",
  "37": "Runeguard",
  "38": "Sunward Bulwark",
  "39": "Asgardian Aegis",
  "40": "Crackshield",
  "41": "Tombplate",
  "42": "Sealguard",
  "43": "Final Bastion"
};

export const PET_TYPE_MAP: Record<number, string> = {
  "0": "Piggie",
  "1": "Chicko",
  "2": "Peppy",
  "3": "Gumbear",
  "4": "Croco",
  "5": "Blue Axolotl",
  "6": "Fluffy",
  "7": "Sandy",
  "8": "Pengoo",
  "9": "Scorp",
  "10": "Kamel",
  "11": "Leo",
  "12": "Lava Slime",
  "13": "Firebat",
  "14": "Phoenix",
  "15": "Nemo",
  "16": "Sharkie",
  "17": "Octoo",
  "18": "Fogo",
  "19": "Purr",
  "20": "Xen",
  "21": "XPeppy",
  "22": "XAxolotl",
  "23": "XPengoo",
  "24": "XLeo",
  "25": "XPhoenix",
  "26": "XOctoo",
  "27": "XXen",
  "28": "Mimic",
  "29": "Triwulf",
  "30": "Inferno",
  "31": "XInferno",
  "32": "Ponyo",
  "33": "Chandy",
  "34": "Runix",
  "35": "XRunix"
};

export const DEFAULT_ITEMS: GameItem[] = [
  {
    "name": "Old Sword",
    "type": "sword",
    "rarity": "Common",
    "baseValue": 1e-8,
    "maxLevel": 10,
    "passive": "None",
    "image": "🗡️",
    "recommendationScore": 10,
    "prices": {},
    "tierRank": 1,
    "world": "Orkland W1",
    "dropSource": "Roundhead",
    "protection": "-",
    "healthMulti": "-",
    "goldMulti": "0.25x",
    "typeId": 1,
    "minLevel": 0
  },
  {
    "name": "Orc Sword",
    "type": "sword",
    "rarity": "Common",
    "baseValue": 1.5e-8,
    "maxLevel": 10,
    "passive": "None",
    "image": "🗡️",
    "recommendationScore": 20,
    "prices": {},
    "tierRank": 2,
    "world": "Orkland W1",
    "dropSource": "Roundhead / Forest Orc",
    "protection": "-",
    "healthMulti": "0.25x",
    "goldMulti": "0.25x",
    "typeId": 2,
    "minLevel": 0
  },
  {
    "name": "Double-Edged Sword",
    "type": "sword",
    "rarity": "Rare",
    "baseValue": 1e-7,
    "maxLevel": 10,
    "passive": "None",
    "image": "🗡️",
    "recommendationScore": 30,
    "prices": {},
    "tierRank": 3,
    "world": "Orkland W1",
    "dropSource": "Forest Orc / Bonechewer",
    "protection": "-",
    "healthMulti": "0.5x",
    "goldMulti": "-",
    "typeId": 3,
    "minLevel": 0
  },
  {
    "name": "Spiked Sword",
    "type": "sword",
    "rarity": "Rare",
    "baseValue": 2.5e-7,
    "maxLevel": 10,
    "passive": "None",
    "image": "🗡️",
    "recommendationScore": 40,
    "prices": {},
    "tierRank": 4,
    "world": "Orkland W1",
    "dropSource": "Bonechewer",
    "protection": "-",
    "healthMulti": "0.75x",
    "goldMulti": "0.5x",
    "typeId": 4,
    "minLevel": 0
  },
  {
    "name": "Dead Man's Sword",
    "type": "sword",
    "rarity": "Epic",
    "baseValue": 0.000003,
    "maxLevel": 10,
    "passive": "None",
    "image": "💀",
    "recommendationScore": 50,
    "prices": {},
    "tierRank": 5,
    "world": "Orkland W1",
    "dropSource": "Bonechewer",
    "protection": "-",
    "healthMulti": "1.5x",
    "goldMulti": "1.5x",
    "typeId": 5,
    "minLevel": 0
  },
  {
    "name": "Machete Sword",
    "type": "sword",
    "rarity": "Common",
    "baseValue": 7.5e-7,
    "maxLevel": 10,
    "passive": "None",
    "image": "🗡️",
    "recommendationScore": 60,
    "prices": {},
    "tierRank": 6,
    "world": "Sugarland W2",
    "dropSource": "Cocoa Guardian",
    "protection": "-",
    "healthMulti": "1x",
    "goldMulti": "0.75x",
    "typeId": 6,
    "minLevel": 25
  },
  {
    "name": "Scimitar Claw",
    "type": "sword",
    "rarity": "Common",
    "baseValue": 0.000001,
    "maxLevel": 10,
    "passive": "None",
    "image": "🗡️",
    "recommendationScore": 70,
    "prices": {},
    "tierRank": 7,
    "world": "Sugarland W2",
    "dropSource": "Cocoa Guardian / Chocolate Knight",
    "protection": "1K",
    "healthMulti": "1.25x",
    "goldMulti": "1x",
    "typeId": 7,
    "minLevel": 25
  },
  {
    "name": "Morbid Will",
    "type": "sword",
    "rarity": "Rare",
    "baseValue": 0.000002,
    "maxLevel": 10,
    "passive": "None",
    "image": "🗡️",
    "recommendationScore": 80,
    "prices": {},
    "tierRank": 8,
    "world": "Sugarland W2",
    "dropSource": "Chocolate Knight / Mallowbeast",
    "protection": "2K",
    "healthMulti": "1.75x",
    "goldMulti": "1.25x",
    "typeId": 8,
    "minLevel": 25
  },
  {
    "name": "Inferno Claw",
    "type": "sword",
    "rarity": "Rare",
    "baseValue": 0.000003,
    "maxLevel": 10,
    "passive": "None",
    "image": "🔥",
    "recommendationScore": 90,
    "prices": {},
    "tierRank": 9,
    "world": "Sugarland W2",
    "dropSource": "Mallowbeast",
    "protection": "2K",
    "healthMulti": "2x",
    "goldMulti": "1.5x",
    "typeId": 9,
    "minLevel": 25
  },
  {
    "name": "Burned Spikeblade",
    "type": "sword",
    "rarity": "Epic",
    "baseValue": 0.000015,
    "maxLevel": 10,
    "passive": "None",
    "image": "🗡️",
    "recommendationScore": 100,
    "prices": {},
    "tierRank": 10,
    "world": "Sugarland W2",
    "dropSource": "Mallowbeast",
    "protection": "3K",
    "healthMulti": "3x",
    "goldMulti": "3x",
    "typeId": 10,
    "minLevel": 25
  },
  {
    "name": "Icebreaker",
    "type": "sword",
    "rarity": "Common",
    "baseValue": 0.000005,
    "maxLevel": 10,
    "passive": "None",
    "image": "❄️",
    "recommendationScore": 110,
    "prices": {},
    "tierRank": 11,
    "world": "Iceworld W3",
    "dropSource": "Ice King",
    "protection": "2K",
    "healthMulti": "2.5x",
    "goldMulti": "2x",
    "typeId": 11,
    "minLevel": 50
  },
  {
    "name": "Frostbite",
    "type": "sword",
    "rarity": "Common",
    "baseValue": 0.0000075,
    "maxLevel": 10,
    "passive": "None",
    "image": "❄️",
    "recommendationScore": 120,
    "prices": {},
    "tierRank": 12,
    "world": "Iceworld W3",
    "dropSource": "Ice King",
    "protection": "3K",
    "healthMulti": "3x",
    "goldMulti": "3x",
    "typeId": 12,
    "minLevel": 50
  },
  {
    "name": "Froststeel",
    "type": "sword",
    "rarity": "Rare",
    "baseValue": 0.00001,
    "maxLevel": 10,
    "passive": "None",
    "image": "🗡️",
    "recommendationScore": 130,
    "prices": {},
    "tierRank": 13,
    "world": "Iceworld W3",
    "dropSource": "Ice King",
    "protection": "3K",
    "healthMulti": "2.75x",
    "goldMulti": "3x",
    "typeId": 13,
    "minLevel": 50
  },
  {
    "name": "Frostfang",
    "type": "sword",
    "rarity": "Rare",
    "baseValue": 0.000015,
    "maxLevel": 10,
    "passive": "None",
    "image": "🗡️",
    "recommendationScore": 140,
    "prices": {},
    "tierRank": 14,
    "world": "Iceworld W3",
    "dropSource": "Ice King",
    "protection": "4K",
    "healthMulti": "3x",
    "goldMulti": "3.5x",
    "typeId": 14,
    "minLevel": 50
  },
  {
    "name": "Winter's Wrath",
    "type": "sword",
    "rarity": "Epic",
    "baseValue": 0.0005,
    "maxLevel": 10,
    "passive": "None",
    "image": "❄️",
    "recommendationScore": 150,
    "prices": {},
    "tierRank": 15,
    "world": "Iceworld W3",
    "dropSource": "Ice King",
    "protection": "15K",
    "healthMulti": "5x",
    "goldMulti": "5x",
    "typeId": 15,
    "minLevel": 50
  },
  {
    "name": "Sandstrike",
    "type": "sword",
    "rarity": "Common",
    "baseValue": 0.000025,
    "maxLevel": 10,
    "passive": "None",
    "image": "🗡️",
    "recommendationScore": 160,
    "prices": {},
    "tierRank": 16,
    "world": "Desertland W4",
    "dropSource": "Spiked Tortoise",
    "protection": "10K",
    "healthMulti": "3.25x",
    "goldMulti": "3.75x",
    "typeId": 16,
    "minLevel": 60
  },
  {
    "name": "Duneslicer",
    "type": "sword",
    "rarity": "Common",
    "baseValue": 0.00004,
    "maxLevel": 10,
    "passive": "None",
    "image": "🗡️",
    "recommendationScore": 170,
    "prices": {},
    "tierRank": 17,
    "world": "Desertland W4",
    "dropSource": "Spiked Tortoise / Cursed Stone",
    "protection": "15K",
    "healthMulti": "3.5x",
    "goldMulti": "3.5x",
    "typeId": 17,
    "minLevel": 60
  },
  {
    "name": "Sandslasher",
    "type": "sword",
    "rarity": "Rare",
    "baseValue": 0.00006,
    "maxLevel": 10,
    "passive": "None",
    "image": "🗡️",
    "recommendationScore": 180,
    "prices": {},
    "tierRank": 18,
    "world": "Desertland W4",
    "dropSource": "Cursed Stone / Mummy",
    "protection": "100K",
    "healthMulti": "3.5x",
    "goldMulti": "3x",
    "typeId": 18,
    "minLevel": 60
  },
  {
    "name": "Sunfire",
    "type": "sword",
    "rarity": "Rare",
    "baseValue": 0.000085,
    "maxLevel": 10,
    "passive": "None",
    "image": "☀️",
    "recommendationScore": 190,
    "prices": {},
    "tierRank": 19,
    "world": "Desertland W4",
    "dropSource": "Mummy",
    "protection": "250K",
    "healthMulti": "3.5x",
    "goldMulti": "3.75x",
    "typeId": 19,
    "minLevel": 60
  },
  {
    "name": "Emberwraith",
    "type": "sword",
    "rarity": "Epic",
    "baseValue": 0.001,
    "maxLevel": 10,
    "passive": "None",
    "image": "🔥",
    "recommendationScore": 200,
    "prices": {},
    "tierRank": 20,
    "world": "Desertland W4",
    "dropSource": "Mummy",
    "protection": "1M",
    "healthMulti": "6x",
    "goldMulti": "6x",
    "typeId": 20,
    "minLevel": 60
  },
  {
    "name": "Blade of Sorrow",
    "type": "sword",
    "rarity": "Common",
    "baseValue": 0.0001,
    "maxLevel": 10,
    "passive": "None",
    "image": "🗡️",
    "recommendationScore": 210,
    "prices": {},
    "tierRank": 21,
    "world": "Netherworld W5",
    "dropSource": "Giga Moai",
    "protection": "500K",
    "healthMulti": "4x",
    "goldMulti": "3.75x",
    "typeId": 21,
    "minLevel": 100
  },
  {
    "name": "Flame Heart",
    "type": "sword",
    "rarity": "Common",
    "baseValue": 0.00015,
    "maxLevel": 10,
    "passive": "None",
    "image": "❤️",
    "recommendationScore": 220,
    "prices": {},
    "tierRank": 22,
    "world": "Netherworld W5",
    "dropSource": "Giga Moai / Lava Rock",
    "protection": "750K",
    "healthMulti": "4.25x",
    "goldMulti": "3.75x",
    "typeId": 22,
    "minLevel": 100
  },
  {
    "name": "Darkblade",
    "type": "sword",
    "rarity": "Rare",
    "baseValue": 0.0002,
    "maxLevel": 10,
    "passive": "None",
    "image": "🗡️",
    "recommendationScore": 230,
    "prices": {},
    "tierRank": 23,
    "world": "Netherworld W5",
    "dropSource": "Giga Moai / Lava Rock / Nether Lord",
    "protection": "1M",
    "healthMulti": "4.5x",
    "goldMulti": "4x",
    "typeId": 23,
    "minLevel": 100
  },
  {
    "name": "Fatecutter",
    "type": "sword",
    "rarity": "Rare",
    "baseValue": 0.00025,
    "maxLevel": 10,
    "passive": "None",
    "image": "🗡️",
    "recommendationScore": 240,
    "prices": {},
    "tierRank": 24,
    "world": "Netherworld W5",
    "dropSource": "Nether Lord",
    "protection": "2M",
    "healthMulti": "4.75x",
    "goldMulti": "4x",
    "typeId": 24,
    "minLevel": 100
  },
  {
    "name": "Devil's Blade",
    "type": "sword",
    "rarity": "Epic",
    "baseValue": 0.01,
    "maxLevel": 10,
    "passive": "None",
    "image": "👿",
    "recommendationScore": 250,
    "prices": {},
    "tierRank": 25,
    "world": "Netherworld W5",
    "dropSource": "Nether Lord",
    "protection": "3M",
    "healthMulti": "6x",
    "goldMulti": "4x",
    "typeId": 25,
    "minLevel": 100
  },
  {
    "name": "Spear of Zeus",
    "type": "sword",
    "rarity": "Epic",
    "baseValue": 0.015,
    "maxLevel": 10,
    "passive": "None",
    "image": "⚡",
    "recommendationScore": 260,
    "prices": {},
    "tierRank": 26,
    "world": "Heaven W6",
    "dropSource": "Zeus",
    "protection": "-",
    "healthMulti": "-",
    "goldMulti": "-",
    "typeId": 26,
    "minLevel": 300
  },
  {
    "name": "Coral Blade",
    "type": "sword",
    "rarity": "Common",
    "baseValue": 0.005,
    "maxLevel": 10,
    "passive": "None",
    "image": "🪸",
    "recommendationScore": 270,
    "prices": {},
    "tierRank": 27,
    "world": "Aqualand W7",
    "dropSource": "Crokora / Hydrino",
    "protection": "3M",
    "healthMulti": "5x",
    "goldMulti": "4x",
    "typeId": 27,
    "minLevel": 400
  },
  {
    "name": "Spiked Moss",
    "type": "sword",
    "rarity": "Rare",
    "baseValue": 0.012,
    "maxLevel": 10,
    "passive": "None",
    "image": "🗡️",
    "recommendationScore": 280,
    "prices": {},
    "tierRank": 28,
    "world": "Aqualand W7",
    "dropSource": "Hydrino / Temple Guardian",
    "protection": "4M",
    "healthMulti": "5.5x",
    "goldMulti": "4.25x",
    "typeId": 28,
    "minLevel": 400
  },
  {
    "name": "Guardian's Spear",
    "type": "sword",
    "rarity": "Epic",
    "baseValue": 0.05,
    "maxLevel": 10,
    "passive": "None",
    "image": "🔱",
    "recommendationScore": 290,
    "prices": {},
    "tierRank": 29,
    "world": "Aqualand W7",
    "dropSource": "Temple Guardian",
    "protection": "6M",
    "healthMulti": "6x",
    "goldMulti": "4.5x",
    "typeId": 29,
    "minLevel": 400
  },
  {
    "name": "Dragon's Teeth",
    "type": "sword",
    "rarity": "Rare",
    "baseValue": 0.09,
    "maxLevel": 10,
    "passive": "None",
    "image": "🦷",
    "recommendationScore": 300,
    "prices": {},
    "tierRank": 30,
    "world": "Dragon World",
    "dropSource": "Dragon Guardian",
    "protection": "8M",
    "healthMulti": "7x",
    "goldMulti": "5x",
    "typeId": 30,
    "minLevel": 1000
  },
  {
    "name": "Dragon's Poison",
    "type": "sword",
    "rarity": "Epic",
    "baseValue": 0.2,
    "maxLevel": 10,
    "passive": "None",
    "image": "☣️",
    "recommendationScore": 310,
    "prices": {},
    "tierRank": 31,
    "world": "Dragon World",
    "dropSource": "Dragon",
    "protection": "12M",
    "healthMulti": "9x",
    "goldMulti": "7x",
    "typeId": 31,
    "minLevel": 1000
  },
  {
    "name": "Starfire Blade",
    "type": "sword",
    "rarity": "Common",
    "baseValue": 0.05,
    "maxLevel": 10,
    "passive": "None",
    "image": "⭐",
    "recommendationScore": 320,
    "prices": {},
    "tierRank": 32,
    "world": "Spaceland W8",
    "dropSource": "Bouugo / Anaxion",
    "protection": "5M",
    "healthMulti": "5.75x",
    "goldMulti": "4.5x",
    "typeId": 32,
    "minLevel": 700
  },
  {
    "name": "Nova Blade",
    "type": "sword",
    "rarity": "Rare",
    "baseValue": 0.07,
    "maxLevel": 10,
    "passive": "None",
    "image": "🗡️",
    "recommendationScore": 330,
    "prices": {},
    "tierRank": 33,
    "world": "Spaceland W8",
    "dropSource": "Anaxion / Xenomor",
    "protection": "5M",
    "healthMulti": "6.5x",
    "goldMulti": "4.5x",
    "typeId": 33,
    "minLevel": 700
  },
  {
    "name": "Cosmic Blader",
    "type": "sword",
    "rarity": "Epic",
    "baseValue": 0.1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🌌",
    "recommendationScore": 340,
    "prices": {},
    "tierRank": 34,
    "world": "Spaceland W8",
    "dropSource": "Xenomor",
    "protection": "12M",
    "healthMulti": "6x",
    "goldMulti": "8x",
    "typeId": 34,
    "minLevel": 700
  },
  {
    "name": "Netherite Blade",
    "type": "sword",
    "rarity": "Rare",
    "baseValue": 0.5,
    "maxLevel": 10,
    "passive": "None",
    "image": "🗡️",
    "recommendationScore": 350,
    "prices": {},
    "tierRank": 35,
    "world": "Death World W9",
    "dropSource": "Reaper",
    "protection": "20M",
    "healthMulti": "8x",
    "goldMulti": "10x",
    "typeId": 35,
    "minLevel": 1500
  },
  {
    "name": "Death's Scythe",
    "type": "sword",
    "rarity": "Epic",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "💀",
    "recommendationScore": 360,
    "prices": {},
    "tierRank": 36,
    "world": "Death World W9",
    "dropSource": "Reaper",
    "protection": "80M",
    "healthMulti": "12x",
    "goldMulti": "12x",
    "typeId": 36,
    "minLevel": 1500
  },
  {
    "name": "Dragon's Devil",
    "type": "sword",
    "rarity": "Legendary",
    "baseValue": 6,
    "maxLevel": 10,
    "passive": "None",
    "image": "😈",
    "recommendationScore": 370,
    "prices": {},
    "tierRank": 37,
    "world": "Elf",
    "dropSource": "Elf",
    "protection": "120M",
    "healthMulti": "15x",
    "goldMulti": "15x",
    "typeId": 37,
    "minLevel": 1500
  },
  {
    "name": "Einherjar's Blade",
    "type": "sword",
    "rarity": "Common",
    "baseValue": 0.8,
    "maxLevel": 10,
    "passive": "None",
    "image": "🗡️",
    "recommendationScore": 380,
    "prices": {},
    "tierRank": 38,
    "world": "Asgard W10",
    "dropSource": "Thrones / Seraphim",
    "protection": "70M",
    "healthMulti": "10x",
    "goldMulti": "10x",
    "typeId": 38,
    "minLevel": 2000
  },
  {
    "name": "Runebreaker",
    "type": "sword",
    "rarity": "Rare",
    "baseValue": 1.5,
    "maxLevel": 10,
    "passive": "None",
    "image": "🗡️",
    "recommendationScore": 390,
    "prices": {},
    "tierRank": 39,
    "world": "Asgard W10",
    "dropSource": "Seraphim",
    "protection": "100M",
    "healthMulti": "11x",
    "goldMulti": "11x",
    "typeId": 39,
    "minLevel": 2000
  },
  {
    "name": "Solbrand",
    "type": "sword",
    "rarity": "Epic",
    "baseValue": 2,
    "maxLevel": 10,
    "passive": "None",
    "image": "🔥",
    "recommendationScore": 400,
    "prices": {},
    "tierRank": 40,
    "world": "Asgard W10",
    "dropSource": "The Rival",
    "protection": "150M",
    "healthMulti": "15x",
    "goldMulti": "16x",
    "typeId": 40,
    "minLevel": 2000
  },
  {
    "name": "Divinity Edge",
    "type": "sword",
    "rarity": "Legendary",
    "baseValue": 9,
    "maxLevel": 10,
    "passive": "None",
    "image": "⚡",
    "recommendationScore": 410,
    "prices": {},
    "tierRank": 41,
    "world": "Elf",
    "dropSource": "Elf",
    "protection": "300M",
    "healthMulti": "20x",
    "goldMulti": "20x",
    "typeId": 41,
    "minLevel": 2000
  },
  {
    "name": "Graveborn Edge",
    "type": "sword",
    "rarity": "Common",
    "baseValue": 1.4,
    "maxLevel": 10,
    "passive": "None",
    "image": "🗡️",
    "recommendationScore": 420,
    "prices": {},
    "tierRank": 42,
    "world": "Orkland W1",
    "dropSource": "Wargmaw / Lornblade",
    "protection": "100M",
    "healthMulti": "11x",
    "goldMulti": "11x",
    "typeId": 42,
    "minLevel": 3000
  },
  {
    "name": "Dreadmourne",
    "type": "sword",
    "rarity": "Rare",
    "baseValue": 3,
    "maxLevel": 10,
    "passive": "None",
    "image": "🗡️",
    "recommendationScore": 430,
    "prices": {},
    "tierRank": 43,
    "world": "Orkland W1",
    "dropSource": "Lornblade",
    "protection": "200M",
    "healthMulti": "13x",
    "goldMulti": "13x",
    "typeId": 43,
    "minLevel": 3000
  },
  {
    "name": "Soulkeeper's Blade",
    "type": "sword",
    "rarity": "Epic",
    "baseValue": 4,
    "maxLevel": 10,
    "passive": "None",
    "image": "💀",
    "recommendationScore": 440,
    "prices": {},
    "tierRank": 44,
    "world": "Orkland W1",
    "dropSource": "Mordolith",
    "protection": "250M",
    "healthMulti": "17x",
    "goldMulti": "18x",
    "typeId": 44,
    "minLevel": 3000
  },
  {
    "name": "Last Horizon",
    "type": "sword",
    "rarity": "Legendary",
    "baseValue": 12,
    "maxLevel": 10,
    "passive": "None",
    "image": "🌌",
    "recommendationScore": 450,
    "prices": {},
    "tierRank": 45,
    "world": "Orkland W1",
    "dropSource": "Unknown",
    "protection": "400M",
    "healthMulti": "23x",
    "goldMulti": "22x",
    "typeId": 45,
    "minLevel": 3000
  },
  {
    "name": "Wooden Shield",
    "type": "shield",
    "rarity": "Common",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 10,
    "prices": {},
    "tierRank": 1,
    "world": "Orkland W1",
    "dropSource": "Roundhead / Forest Orc",
    "protection": "100",
    "healthMulti": "-",
    "goldMulti": "-",
    "typeId": 1,
    "minLevel": 0
  },
  {
    "name": "Iron Shield",
    "type": "shield",
    "rarity": "Common",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 20,
    "prices": {},
    "tierRank": 2,
    "world": "Orkland W1",
    "dropSource": "Forest Orc",
    "protection": "250",
    "healthMulti": "-",
    "goldMulti": "0.25x",
    "typeId": 2,
    "minLevel": 0
  },
  {
    "name": "Elite Shield",
    "type": "shield",
    "rarity": "Rare",
    "baseValue": 0.25,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 30,
    "prices": {},
    "tierRank": 3,
    "world": "Orkland W1",
    "dropSource": "Forest Orc / Bonechewer",
    "protection": "500",
    "healthMulti": "-",
    "goldMulti": "-",
    "typeId": 3,
    "minLevel": 0
  },
  {
    "name": "Warrior's Shield",
    "type": "shield",
    "rarity": "Rare",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 40,
    "prices": {},
    "tierRank": 4,
    "world": "Orkland W1",
    "dropSource": "Bonechewer",
    "protection": "750",
    "healthMulti": "0.25x",
    "goldMulti": "0.25x",
    "typeId": 4,
    "minLevel": 0
  },
  {
    "name": "Shield of the Kingdom",
    "type": "shield",
    "rarity": "Epic",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 50,
    "prices": {},
    "tierRank": 5,
    "world": "Orkland W1",
    "dropSource": "Bonechewer",
    "protection": "3K",
    "healthMulti": "2x",
    "goldMulti": "2x",
    "typeId": 5,
    "minLevel": 0
  },
  {
    "name": "Sweetguard",
    "type": "shield",
    "rarity": "Common",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 60,
    "prices": {},
    "tierRank": 6,
    "world": "Sugarland W2",
    "dropSource": "Cocoa Guardian / Chocolate Knight",
    "protection": "2K",
    "healthMulti": "0.5x",
    "goldMulti": "0.25x",
    "typeId": 6,
    "minLevel": 25
  },
  {
    "name": "Warden's Shield",
    "type": "shield",
    "rarity": "Common",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 70,
    "prices": {},
    "tierRank": 7,
    "world": "Sugarland W2",
    "dropSource": "Chocolate Knight",
    "protection": "3K",
    "healthMulti": "0.75x",
    "goldMulti": "0.5x",
    "typeId": 7,
    "minLevel": 25
  },
  {
    "name": "Light Barrier",
    "type": "shield",
    "rarity": "Rare",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 80,
    "prices": {},
    "tierRank": 8,
    "world": "Sugarland W2",
    "dropSource": "Chocolate Knight / Mallowbeast",
    "protection": "5K",
    "healthMulti": "1x",
    "goldMulti": "0.75x",
    "typeId": 8,
    "minLevel": 25
  },
  {
    "name": "Obsidian Canny",
    "type": "shield",
    "rarity": "Rare",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 90,
    "prices": {},
    "tierRank": 9,
    "world": "Sugarland W2",
    "dropSource": "Mallowbeast",
    "protection": "7K",
    "healthMulti": "1.5x",
    "goldMulti": "1x",
    "typeId": 9,
    "minLevel": 25
  },
  {
    "name": "Dead Guard's Shield",
    "type": "shield",
    "rarity": "Epic",
    "baseValue": 0.5,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 100,
    "prices": {},
    "tierRank": 10,
    "world": "Sugarland W2",
    "dropSource": "Mallowbeast",
    "protection": "15K",
    "healthMulti": "3x",
    "goldMulti": "3x",
    "typeId": 10,
    "minLevel": 25
  },
  {
    "name": "Snowfall Defender",
    "type": "shield",
    "rarity": "Common",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 110,
    "prices": {},
    "tierRank": 11,
    "world": "Iceworld W3",
    "dropSource": "Ice King",
    "protection": "8K",
    "healthMulti": "2x",
    "goldMulti": "1.5x",
    "typeId": 11,
    "minLevel": 50
  },
  {
    "name": "Arctic Ward",
    "type": "shield",
    "rarity": "Common",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 120,
    "prices": {},
    "tierRank": 12,
    "world": "Iceworld W3",
    "dropSource": "Ice King",
    "protection": "10K",
    "healthMulti": "1.5x",
    "goldMulti": "1x",
    "typeId": 12,
    "minLevel": 50
  },
  {
    "name": "Icy Rampart",
    "type": "shield",
    "rarity": "Rare",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 130,
    "prices": {},
    "tierRank": 13,
    "world": "Iceworld W3",
    "dropSource": "Ice King",
    "protection": "12K",
    "healthMulti": "2x",
    "goldMulti": "1.5x",
    "typeId": 13,
    "minLevel": 50
  },
  {
    "name": "Frozen Fortress",
    "type": "shield",
    "rarity": "Rare",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 140,
    "prices": {},
    "tierRank": 14,
    "world": "Iceworld W3",
    "dropSource": "Ice King",
    "protection": "15K",
    "healthMulti": "2.25x",
    "goldMulti": "3x",
    "typeId": 14,
    "minLevel": 50
  },
  {
    "name": "Winter's Wrathguard",
    "type": "shield",
    "rarity": "Epic",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 150,
    "prices": {},
    "tierRank": 15,
    "world": "Iceworld W3",
    "dropSource": "Ice King",
    "protection": "50K",
    "healthMulti": "4x",
    "goldMulti": "5x",
    "typeId": 15,
    "minLevel": 50
  },
  {
    "name": "Sunshield",
    "type": "shield",
    "rarity": "Common",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 160,
    "prices": {},
    "tierRank": 16,
    "world": "Desertland W4",
    "dropSource": "Spiked Tortoise / Cursed Stone",
    "protection": "25K",
    "healthMulti": "2.5x",
    "goldMulti": "3x",
    "typeId": 16,
    "minLevel": 60
  },
  {
    "name": "Barbed Sunward",
    "type": "shield",
    "rarity": "Common",
    "baseValue": 0.25,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 170,
    "prices": {},
    "tierRank": 17,
    "world": "Desertland W4",
    "dropSource": "Cursed Stone",
    "protection": "35K",
    "healthMulti": "2.75x",
    "goldMulti": "2.5x",
    "typeId": 17,
    "minLevel": 60
  },
  {
    "name": "Sunshroud",
    "type": "shield",
    "rarity": "Rare",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 180,
    "prices": {},
    "tierRank": 18,
    "world": "Desertland W4",
    "dropSource": "Cursed Stone / Mummy",
    "protection": "50K",
    "healthMulti": "3x",
    "goldMulti": "2x",
    "typeId": 18,
    "minLevel": 60
  },
  {
    "name": "Sandstone Shield",
    "type": "shield",
    "rarity": "Rare",
    "baseValue": 0.25,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 190,
    "prices": {},
    "tierRank": 19,
    "world": "Desertland W4",
    "dropSource": "Mummy",
    "protection": "70K",
    "healthMulti": "3x",
    "goldMulti": "2.25x",
    "typeId": 19,
    "minLevel": 60
  },
  {
    "name": "Emberwraith Shield",
    "type": "shield",
    "rarity": "Epic",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 200,
    "prices": {},
    "tierRank": 20,
    "world": "Desertland W4",
    "dropSource": "Mummy",
    "protection": "500K",
    "healthMulti": "3.25x",
    "goldMulti": "2.5x",
    "typeId": 20,
    "minLevel": 60
  },
  {
    "name": "Hell Shield",
    "type": "shield",
    "rarity": "Common",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 210,
    "prices": {},
    "tierRank": 21,
    "world": "Netherworld W5",
    "dropSource": "Giga Moai / Lava Rock",
    "protection": "250K",
    "healthMulti": "3.5x",
    "goldMulti": "2.5x",
    "typeId": 21,
    "minLevel": 100
  },
  {
    "name": "Shield of Fire",
    "type": "shield",
    "rarity": "Common",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 220,
    "prices": {},
    "tierRank": 22,
    "world": "Netherworld W5",
    "dropSource": "Giga Moai / Lava Rock",
    "protection": "300K",
    "healthMulti": "3.75x",
    "goldMulti": "2.25x",
    "typeId": 22,
    "minLevel": 100
  },
  {
    "name": "Fire Rampart",
    "type": "shield",
    "rarity": "Rare",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 230,
    "prices": {},
    "tierRank": 23,
    "world": "Netherworld W5",
    "dropSource": "Nether Lord",
    "protection": "600K",
    "healthMulti": "4x",
    "goldMulti": "2.5x",
    "typeId": 23,
    "minLevel": 100
  },
  {
    "name": "Infernal Protection",
    "type": "shield",
    "rarity": "Rare",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 240,
    "prices": {},
    "tierRank": 24,
    "world": "Netherworld W5",
    "dropSource": "Nether Lord",
    "protection": "1M",
    "healthMulti": "4.25x",
    "goldMulti": "2.25x",
    "typeId": 24,
    "minLevel": 100
  },
  {
    "name": "Lord of Hell",
    "type": "shield",
    "rarity": "Epic",
    "baseValue": 0.5,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 250,
    "prices": {},
    "tierRank": 25,
    "world": "Netherworld W5",
    "dropSource": "Nether Lord",
    "protection": "3M",
    "healthMulti": "5x",
    "goldMulti": "6x",
    "typeId": 25,
    "minLevel": 100
  },
  {
    "name": "Steel Shield",
    "type": "shield",
    "rarity": "Common",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 260,
    "prices": {},
    "tierRank": 26,
    "world": "Aqualand W7",
    "dropSource": "Crokora / Hydrino",
    "protection": "1M",
    "healthMulti": "4.5x",
    "goldMulti": "2x",
    "typeId": 26,
    "minLevel": 400
  },
  {
    "name": "Hardened Moss",
    "type": "shield",
    "rarity": "Rare",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 270,
    "prices": {},
    "tierRank": 27,
    "world": "Aqualand W7",
    "dropSource": "Hydrino / Temple Guardian",
    "protection": "3M",
    "healthMulti": "5x",
    "goldMulti": "2.25x",
    "typeId": 27,
    "minLevel": 400
  },
  {
    "name": "Guardian's Protection",
    "type": "shield",
    "rarity": "Epic",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 280,
    "prices": {},
    "tierRank": 28,
    "world": "Aqualand W7",
    "dropSource": "Temple Guardian",
    "protection": "4M",
    "healthMulti": "6x",
    "goldMulti": "5x",
    "typeId": 28,
    "minLevel": 400
  },
  {
    "name": "Dragon's Shell",
    "type": "shield",
    "rarity": "Rare",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 290,
    "prices": {},
    "tierRank": 29,
    "world": "Dragon World",
    "dropSource": "Dragon Guardian",
    "protection": "6M",
    "healthMulti": "8x",
    "goldMulti": "3x",
    "typeId": 29,
    "minLevel": 1000
  },
  {
    "name": "Dragon's Anger",
    "type": "shield",
    "rarity": "Epic",
    "baseValue": 2,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 300,
    "prices": {},
    "tierRank": 30,
    "world": "Dragon World",
    "dropSource": "Dragon",
    "protection": "10M",
    "healthMulti": "12x",
    "goldMulti": "10x",
    "typeId": 30,
    "minLevel": 1000
  },
  {
    "name": "Nebula Shield",
    "type": "shield",
    "rarity": "Common",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 310,
    "prices": {},
    "tierRank": 31,
    "world": "Spaceland W8",
    "dropSource": "Bouugo / Anaxion",
    "protection": "3M",
    "healthMulti": "5x",
    "goldMulti": "2.5x",
    "typeId": 31,
    "minLevel": 700
  },
  {
    "name": "Starburst Shield",
    "type": "shield",
    "rarity": "Rare",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 320,
    "prices": {},
    "tierRank": 32,
    "world": "Spaceland W8",
    "dropSource": "Anaxion / Xenomor",
    "protection": "6M",
    "healthMulti": "6x",
    "goldMulti": "3x",
    "typeId": 32,
    "minLevel": 700
  },
  {
    "name": "Lunar Shield",
    "type": "shield",
    "rarity": "Epic",
    "baseValue": 1.5,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 330,
    "prices": {},
    "tierRank": 33,
    "world": "Spaceland W8",
    "dropSource": "Xenomor",
    "protection": "10M",
    "healthMulti": "6x",
    "goldMulti": "6x",
    "typeId": 33,
    "minLevel": 700
  },
  {
    "name": "Death's Shield",
    "type": "shield",
    "rarity": "Epic",
    "baseValue": 4,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 340,
    "prices": {},
    "tierRank": 34,
    "world": "Death World W9",
    "dropSource": "Reaper",
    "protection": "300M",
    "healthMulti": "13x",
    "goldMulti": "13x",
    "typeId": 34,
    "minLevel": 1500
  },
  {
    "name": "Dragon's Soul",
    "type": "shield",
    "rarity": "Legendary",
    "baseValue": 9,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 350,
    "prices": {},
    "tierRank": 35,
    "world": "Elf",
    "dropSource": "Elf",
    "protection": "1B",
    "healthMulti": "17x",
    "goldMulti": "17x",
    "typeId": 35,
    "minLevel": 1500
  },
  {
    "name": "Einherjar's Guard",
    "type": "shield",
    "rarity": "Common",
    "baseValue": 1.75,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 360,
    "prices": {},
    "tierRank": 36,
    "world": "Asgard W10",
    "dropSource": "Thrones / Seraphim",
    "protection": "12M",
    "healthMulti": "6.5x",
    "goldMulti": "6.5x",
    "typeId": 36,
    "minLevel": 2000
  },
  {
    "name": "Runeguard",
    "type": "shield",
    "rarity": "Rare",
    "baseValue": 2.5,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 370,
    "prices": {},
    "tierRank": 37,
    "world": "Asgard W10",
    "dropSource": "Seraphim",
    "protection": "100M",
    "healthMulti": "10x",
    "goldMulti": "10x",
    "typeId": 37,
    "minLevel": 2000
  },
  {
    "name": "Sunward Bulwark",
    "type": "shield",
    "rarity": "Epic",
    "baseValue": 5,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 380,
    "prices": {},
    "tierRank": 38,
    "world": "Asgard W10",
    "dropSource": "The Rival",
    "protection": "2B",
    "healthMulti": "15x",
    "goldMulti": "15x",
    "typeId": 38,
    "minLevel": 2000
  },
  {
    "name": "Asgardian Aegis",
    "type": "shield",
    "rarity": "Legendary",
    "baseValue": 14,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 390,
    "prices": {},
    "tierRank": 39,
    "world": "Elf",
    "dropSource": "Elf",
    "protection": "10B",
    "healthMulti": "20x",
    "goldMulti": "20x",
    "typeId": 39,
    "minLevel": 2000
  },
  {
    "name": "Crackshield",
    "type": "shield",
    "rarity": "Common",
    "baseValue": 2,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 400,
    "prices": {},
    "tierRank": 40,
    "world": "Orkland W1",
    "dropSource": "Wargmaw / Lornblade",
    "protection": "20M",
    "healthMulti": "8x",
    "goldMulti": "8x",
    "typeId": 40,
    "minLevel": 3000
  },
  {
    "name": "Tombplate",
    "type": "shield",
    "rarity": "Rare",
    "baseValue": 3,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 410,
    "prices": {},
    "tierRank": 41,
    "world": "Orkland W1",
    "dropSource": "Lornblade",
    "protection": "150M",
    "healthMulti": "12x",
    "goldMulti": "12x",
    "typeId": 41,
    "minLevel": 3000
  },
  {
    "name": "Sealguard",
    "type": "shield",
    "rarity": "Epic",
    "baseValue": 6.5,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 420,
    "prices": {},
    "tierRank": 42,
    "world": "Orkland W1",
    "dropSource": "Mordolith",
    "protection": "3B",
    "healthMulti": "17x",
    "goldMulti": "17x",
    "typeId": 42,
    "minLevel": 3000
  },
  {
    "name": "Final Bastion",
    "type": "shield",
    "rarity": "Legendary",
    "baseValue": 18,
    "maxLevel": 10,
    "passive": "None",
    "image": "🛡️",
    "recommendationScore": 430,
    "prices": {},
    "tierRank": 43,
    "world": "Orkland W1",
    "dropSource": "Unknown",
    "protection": "14B",
    "healthMulti": "23x",
    "goldMulti": "21x",
    "typeId": 43,
    "minLevel": 3000
  },
  {
    "name": "Piggie",
    "type": "pet",
    "rarity": "Common",
    "baseValue": 0,
    "maxLevel": 10,
    "passive": "+0.25x Gold, +0x Speed",
    "image": "🐷",
    "recommendationScore": 0,
    "prices": {},
    "tierRank": 0,
    "typeId": 0,
    "metadata": {
      "goldMulti": 0.25,
      "speedBoost": 0
    },
    "minLevel": 0
  },
  {
    "name": "Chicko",
    "type": "pet",
    "rarity": "Rare",
    "baseValue": 0.25,
    "maxLevel": 10,
    "passive": "+0.5x Gold, +0x Speed",
    "image": "🐥",
    "recommendationScore": 10,
    "prices": {},
    "tierRank": 1,
    "typeId": 1,
    "metadata": {
      "goldMulti": 0.5,
      "speedBoost": 0
    },
    "minLevel": 0
  },
  {
    "name": "Peppy",
    "type": "pet",
    "rarity": "Epic",
    "baseValue": 1.5,
    "maxLevel": 10,
    "passive": "+2x Gold, +0.25x Speed",
    "image": "🐹",
    "recommendationScore": 20,
    "prices": {},
    "tierRank": 2,
    "typeId": 2,
    "metadata": {
      "goldMulti": 2,
      "speedBoost": 0.25
    },
    "minLevel": 0
  },
  {
    "name": "Gumbear",
    "type": "pet",
    "rarity": "Common",
    "baseValue": 0.5,
    "maxLevel": 10,
    "passive": "+0.75x Gold, +0x Speed",
    "image": "🧸",
    "recommendationScore": 30,
    "prices": {},
    "tierRank": 3,
    "typeId": 3,
    "metadata": {
      "goldMulti": 0.75,
      "speedBoost": 0
    },
    "minLevel": 0
  },
  {
    "name": "Croco",
    "type": "pet",
    "rarity": "Rare",
    "baseValue": 0.75,
    "maxLevel": 10,
    "passive": "+1x Gold, +0x Speed",
    "image": "🐊",
    "recommendationScore": 40,
    "prices": {},
    "tierRank": 4,
    "typeId": 4,
    "metadata": {
      "goldMulti": 1,
      "speedBoost": 0
    },
    "minLevel": 0
  },
  {
    "name": "Blue Axolotl",
    "type": "pet",
    "rarity": "Epic",
    "baseValue": 3,
    "maxLevel": 10,
    "passive": "+3x Gold, +0.5x Speed",
    "image": "🦎",
    "recommendationScore": 50,
    "prices": {},
    "tierRank": 5,
    "typeId": 5,
    "metadata": {
      "goldMulti": 3,
      "speedBoost": 0.5
    },
    "minLevel": 0
  },
  {
    "name": "Fluffy",
    "type": "pet",
    "rarity": "Common",
    "baseValue": 1,
    "maxLevel": 10,
    "passive": "+1.25x Gold, +0x Speed",
    "image": "🐑",
    "recommendationScore": 60,
    "prices": {},
    "tierRank": 6,
    "typeId": 6,
    "metadata": {
      "goldMulti": 1.25,
      "speedBoost": 0
    },
    "minLevel": 0
  },
  {
    "name": "Sandy",
    "type": "pet",
    "rarity": "Rare",
    "baseValue": 1.25,
    "maxLevel": 10,
    "passive": "+1.5x Gold, +0x Speed",
    "image": "🏜️",
    "recommendationScore": 70,
    "prices": {},
    "tierRank": 7,
    "typeId": 7,
    "metadata": {
      "goldMulti": 1.5,
      "speedBoost": 0
    },
    "minLevel": 0
  },
  {
    "name": "Pengoo",
    "type": "pet",
    "rarity": "Epic",
    "baseValue": 5,
    "maxLevel": 10,
    "passive": "+4x Gold, +0.25x Speed",
    "image": "🐧",
    "recommendationScore": 80,
    "prices": {},
    "tierRank": 8,
    "typeId": 8,
    "metadata": {
      "goldMulti": 4,
      "speedBoost": 0.25
    },
    "minLevel": 0
  },
  {
    "name": "Scorp",
    "type": "pet",
    "rarity": "Common",
    "baseValue": 1.75,
    "maxLevel": 10,
    "passive": "+1.75x Gold, +0x Speed",
    "image": "🦂",
    "recommendationScore": 90,
    "prices": {},
    "tierRank": 9,
    "typeId": 9,
    "metadata": {
      "goldMulti": 1.75,
      "speedBoost": 0
    },
    "minLevel": 0
  },
  {
    "name": "Kamel",
    "type": "pet",
    "rarity": "Rare",
    "baseValue": 2.5,
    "maxLevel": 10,
    "passive": "+2x Gold, +0x Speed",
    "image": "🐪",
    "recommendationScore": 100,
    "prices": {},
    "tierRank": 10,
    "typeId": 10,
    "metadata": {
      "goldMulti": 2,
      "speedBoost": 0
    },
    "minLevel": 0
  },
  {
    "name": "Leo",
    "type": "pet",
    "rarity": "Epic",
    "baseValue": 6,
    "maxLevel": 10,
    "passive": "+5x Gold, +1x Speed",
    "image": "🦁",
    "recommendationScore": 110,
    "prices": {},
    "tierRank": 11,
    "typeId": 11,
    "metadata": {
      "goldMulti": 5,
      "speedBoost": 1
    },
    "minLevel": 0
  },
  {
    "name": "Lava Slime",
    "type": "pet",
    "rarity": "Common",
    "baseValue": 3,
    "maxLevel": 10,
    "passive": "+2.5x Gold, +0x Speed",
    "image": "🔥",
    "recommendationScore": 120,
    "prices": {},
    "tierRank": 12,
    "typeId": 12,
    "metadata": {
      "goldMulti": 2.5,
      "speedBoost": 0
    },
    "minLevel": 0
  },
  {
    "name": "Firebat",
    "type": "pet",
    "rarity": "Rare",
    "baseValue": 3.5,
    "maxLevel": 10,
    "passive": "+2.75x Gold, +1x Speed",
    "image": "🦇",
    "recommendationScore": 130,
    "prices": {},
    "tierRank": 13,
    "typeId": 13,
    "metadata": {
      "goldMulti": 2.75,
      "speedBoost": 1
    },
    "minLevel": 0
  },
  {
    "name": "Phoenix",
    "type": "pet",
    "rarity": "Epic",
    "baseValue": 8,
    "maxLevel": 10,
    "passive": "+7x Gold, +0.5x Speed",
    "image": "🐦",
    "recommendationScore": 140,
    "prices": {},
    "tierRank": 14,
    "typeId": 14,
    "metadata": {
      "goldMulti": 7,
      "speedBoost": 0.5
    },
    "minLevel": 0
  },
  {
    "name": "Nemo",
    "type": "pet",
    "rarity": "Common",
    "baseValue": 3.5,
    "maxLevel": 10,
    "passive": "+3x Gold, +0x Speed",
    "image": "🐠",
    "recommendationScore": 150,
    "prices": {},
    "tierRank": 15,
    "typeId": 15,
    "metadata": {
      "goldMulti": 3,
      "speedBoost": 0
    },
    "minLevel": 0
  },
  {
    "name": "Sharkie",
    "type": "pet",
    "rarity": "Rare",
    "baseValue": 4,
    "maxLevel": 10,
    "passive": "+3.5x Gold, +0x Speed",
    "image": "🦈",
    "recommendationScore": 160,
    "prices": {},
    "tierRank": 16,
    "typeId": 16,
    "metadata": {
      "goldMulti": 3.5,
      "speedBoost": 0
    },
    "minLevel": 0
  },
  {
    "name": "Octoo",
    "type": "pet",
    "rarity": "Epic",
    "baseValue": 8.5,
    "maxLevel": 10,
    "passive": "+7.5x Gold, +0.5x Speed",
    "image": "🐙",
    "recommendationScore": 170,
    "prices": {},
    "tierRank": 17,
    "typeId": 17,
    "metadata": {
      "goldMulti": 7.5,
      "speedBoost": 0.5
    },
    "minLevel": 0
  },
  {
    "name": "Fogo",
    "type": "pet",
    "rarity": "Common",
    "baseValue": 4.25,
    "maxLevel": 10,
    "passive": "+3.75x Gold, +0x Speed",
    "image": "🔥",
    "recommendationScore": 180,
    "prices": {},
    "tierRank": 18,
    "typeId": 18,
    "metadata": {
      "goldMulti": 3.75,
      "speedBoost": 0
    },
    "minLevel": 0
  },
  {
    "name": "Purr",
    "type": "pet",
    "rarity": "Rare",
    "baseValue": 4.5,
    "maxLevel": 10,
    "passive": "+4x Gold, +0x Speed",
    "image": "🐱",
    "recommendationScore": 190,
    "prices": {},
    "tierRank": 19,
    "typeId": 19,
    "metadata": {
      "goldMulti": 4,
      "speedBoost": 0
    },
    "minLevel": 0
  },
  {
    "name": "Xen",
    "type": "pet",
    "rarity": "Epic",
    "baseValue": 10,
    "maxLevel": 10,
    "passive": "+10x Gold, +0.75x Speed",
    "image": "👽",
    "recommendationScore": 200,
    "prices": {},
    "tierRank": 20,
    "typeId": 20,
    "metadata": {
      "goldMulti": 10,
      "speedBoost": 0.75
    },
    "minLevel": 0
  },
  {
    "name": "XPeppy",
    "type": "pet",
    "rarity": "Legendary",
    "baseValue": 12,
    "maxLevel": 10,
    "passive": "+13x Gold, +0.5x Speed",
    "image": "🌟",
    "recommendationScore": 210,
    "prices": {},
    "tierRank": 21,
    "typeId": 21,
    "metadata": {
      "goldMulti": 13,
      "speedBoost": 0.5
    },
    "minLevel": 0
  },
  {
    "name": "XAxolotl",
    "type": "pet",
    "rarity": "Legendary",
    "baseValue": 13,
    "maxLevel": 10,
    "passive": "+15x Gold, +0.6x Speed",
    "image": "✨",
    "recommendationScore": 220,
    "prices": {},
    "tierRank": 22,
    "typeId": 22,
    "metadata": {
      "goldMulti": 15,
      "speedBoost": 0.6
    },
    "minLevel": 0
  },
  {
    "name": "XPengoo",
    "type": "pet",
    "rarity": "Legendary",
    "baseValue": 16,
    "maxLevel": 10,
    "passive": "+16.5x Gold, +0.75x Speed",
    "image": "💎",
    "recommendationScore": 230,
    "prices": {},
    "tierRank": 23,
    "typeId": 23,
    "metadata": {
      "goldMulti": 16.5,
      "speedBoost": 0.75
    },
    "minLevel": 0
  },
  {
    "name": "XLeo",
    "type": "pet",
    "rarity": "Legendary",
    "baseValue": 17.5,
    "maxLevel": 10,
    "passive": "+18x Gold, +1.5x Speed",
    "image": "👑",
    "recommendationScore": 240,
    "prices": {},
    "tierRank": 24,
    "typeId": 24,
    "metadata": {
      "goldMulti": 18,
      "speedBoost": 1.5
    },
    "minLevel": 0
  },
  {
    "name": "XPhoenix",
    "type": "pet",
    "rarity": "Legendary",
    "baseValue": 19,
    "maxLevel": 10,
    "passive": "+19.5x Gold, +0.8x Speed",
    "image": "☄️",
    "recommendationScore": 250,
    "prices": {},
    "tierRank": 25,
    "typeId": 25,
    "metadata": {
      "goldMulti": 19.5,
      "speedBoost": 0.8
    },
    "minLevel": 0
  },
  {
    "name": "XOctoo",
    "type": "pet",
    "rarity": "Legendary",
    "baseValue": 21,
    "maxLevel": 10,
    "passive": "+22x Gold, +0.9x Speed",
    "image": "🌀",
    "recommendationScore": 260,
    "prices": {},
    "tierRank": 26,
    "typeId": 26,
    "metadata": {
      "goldMulti": 22,
      "speedBoost": 0.9
    },
    "minLevel": 0
  },
  {
    "name": "XXen",
    "type": "pet",
    "rarity": "Legendary",
    "baseValue": 23,
    "maxLevel": 10,
    "passive": "+24x Gold, +1x Speed",
    "image": "🌌",
    "recommendationScore": 270,
    "prices": {},
    "tierRank": 27,
    "typeId": 27,
    "metadata": {
      "goldMulti": 24,
      "speedBoost": 1
    },
    "minLevel": 0
  },
  {
    "name": "Mimic",
    "type": "pet",
    "rarity": "Common",
    "baseValue": 4.5,
    "maxLevel": 10,
    "passive": "+4x Gold, +0x Speed",
    "image": "📦",
    "recommendationScore": 280,
    "prices": {},
    "tierRank": 28,
    "typeId": 28,
    "metadata": {
      "goldMulti": 4,
      "speedBoost": 0
    },
    "minLevel": 0
  },
  {
    "name": "Triwulf",
    "type": "pet",
    "rarity": "Rare",
    "baseValue": 4.75,
    "maxLevel": 10,
    "passive": "+4.25x Gold, +0x Speed",
    "image": "🐺",
    "recommendationScore": 290,
    "prices": {},
    "tierRank": 29,
    "typeId": 29,
    "metadata": {
      "goldMulti": 4.25,
      "speedBoost": 0
    },
    "minLevel": 0
  },
  {
    "name": "Inferno",
    "type": "pet",
    "rarity": "Epic",
    "baseValue": 10.25,
    "maxLevel": 10,
    "passive": "+10.25x Gold, +1x Speed",
    "image": "🔥",
    "recommendationScore": 300,
    "prices": {},
    "tierRank": 30,
    "typeId": 30,
    "metadata": {
      "goldMulti": 10.25,
      "speedBoost": 1
    },
    "minLevel": 0
  },
  {
    "name": "XInferno",
    "type": "pet",
    "rarity": "Legendary",
    "baseValue": 25,
    "maxLevel": 10,
    "passive": "+25x Gold, +1x Speed",
    "image": "🌋",
    "recommendationScore": 310,
    "prices": {},
    "tierRank": 31,
    "typeId": 31,
    "metadata": {
      "goldMulti": 25,
      "speedBoost": 1
    },
    "minLevel": 0
  },
  {
    "name": "Ponyo",
    "type": "pet",
    "rarity": "Common",
    "baseValue": 4.75,
    "maxLevel": 10,
    "passive": "+4.25x Gold, +0x Speed",
    "image": "🐴",
    "recommendationScore": 320,
    "prices": {},
    "tierRank": 32,
    "typeId": 32,
    "metadata": {
      "goldMulti": 4.25,
      "speedBoost": 0
    },
    "minLevel": 0
  },
  {
    "name": "Chandy",
    "type": "pet",
    "rarity": "Rare",
    "baseValue": 5,
    "maxLevel": 10,
    "passive": "+4.5x Gold, +0x Speed",
    "image": "🕯️",
    "recommendationScore": 330,
    "prices": {},
    "tierRank": 33,
    "typeId": 33,
    "metadata": {
      "goldMulti": 4.5,
      "speedBoost": 0
    },
    "minLevel": 0
  },
  {
    "name": "Runix",
    "type": "pet",
    "rarity": "Epic",
    "baseValue": 13.5,
    "maxLevel": 10,
    "passive": "+12.5x Gold, +1.2x Speed",
    "image": "🔮",
    "recommendationScore": 340,
    "prices": {},
    "tierRank": 34,
    "typeId": 34,
    "metadata": {
      "goldMulti": 12.5,
      "speedBoost": 1.2
    },
    "minLevel": 0
  },
  {
    "name": "XRunix",
    "type": "pet",
    "rarity": "Legendary",
    "baseValue": 27.5,
    "maxLevel": 10,
    "passive": "+27.5x Gold, +1.35x Speed",
    "image": "🔆",
    "recommendationScore": 350,
    "prices": {},
    "tierRank": 35,
    "typeId": 35,
    "metadata": {
      "goldMulti": 27.5,
      "speedBoost": 1.35
    },
    "minLevel": 0
  }
];

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
      typeId: i.typeId,
      minLevel: i.minLevel
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
      typeId: i.typeId,
      minLevel: i.minLevel
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
             
  const items = loadItems();
  
  // 1. Direct typeId lookup in active or default items DB
  let found = items.find((i) => i.type === category && i.typeId === type);
  if (!found) {
    found = DEFAULT_ITEMS.find((i) => i.type === category && i.typeId === type);
  }

  // 2. Fallback to name-based lookup using loaded mappings
  if (!found && name) {
    found = items.find((i) => i.type === category && i.name.toLowerCase() === name.toLowerCase());
    if (!found) {
      found = DEFAULT_ITEMS.find((i) => i.type === category && i.name.toLowerCase() === name.toLowerCase());
    }
  }

  if (found) return found;

  const defaultFallback = DEFAULT_ITEMS.find((i) => i.type === category) || DEFAULT_ITEMS[0];
  return {
    ...defaultFallback,
    name: defaultFallback.name
  };
}
