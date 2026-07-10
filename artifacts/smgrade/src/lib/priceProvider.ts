import { parseNumber, formatNumber } from "./numberParser.js";
import { resolveItemByGameType } from "./gearDatabase.js";

export interface NetWorthResult {
  equipped: number;
  storage: number;
  total: number;
  equippedFormatted: string;
  storageFormatted: string;
  totalFormatted: string;
  isLoaded: boolean;
}

let priceDataCache: Record<string, any> | null = null;
let priceLoadPromise: Promise<any> | null = null;

export async function ensurePricesLoaded(): Promise<any> {
  if (priceDataCache) return priceDataCache;
  if (!priceLoadPromise) {
    priceLoadPromise = fetch("/price_estimated.json")
      .then((res) => res.json())
      .then((data) => {
        priceDataCache = data.p || {};
        return priceDataCache;
      })
      .catch((err) => {
        console.error("[SMGrade] Failed to load price_estimated.json:", err);
        priceDataCache = {};
        return priceDataCache;
      });
  }
  return priceLoadPromise;
}

import { loadMarketData } from "./marketDatabase.js";

export function lookupItemPrice(
  category: "sword" | "shield" | "pet",
  name: string,
  level: number,
  currency: "gold" | "power" = "gold"
): number {
  if (category === "sword" || category === "shield") {
    try {
      const marketData = loadMarketData();
      const found = marketData.find(
        (i: any) => i.name.toLowerCase() === name.toLowerCase() && i.category === category
      );
      if (found && found.prices) {
        const price = found.prices[level];
        if (price !== undefined && price > 0) {
          return price;
        }
        // Fallback to closest available level price
        const levels = Object.keys(found.prices).map(Number).sort((a, b) => a - b);
        if (levels.length > 0) {
          const closestLvl = levels.reduce((prev, curr) => 
            Math.abs(curr - level) < Math.abs(prev - level) ? curr : prev
          );
          return found.prices[closestLvl] || 0;
        }
      }
    } catch (e) {
      console.error("[SMGrade] Error looking up price from market database:", e);
    }
  }

  if (!priceDataCache) return 0;

  // Key structure: category|name|level|enchantment|dwarfed|currency
  const key = `${category}|${name}|${level}||0|${currency}`;
  const entry = priceDataCache[key];
  if (entry) {
    return parseNumber(entry[0]);
  }

  // Fallback to power currency if looking for gold but missing
  if (currency === "gold") {
    const powerKey = `${category}|${name}|${level}||0|power`;
    const powerEntry = priceDataCache[powerKey];
    if (powerEntry) {
      return parseNumber(powerEntry[0]);
    }
  }

  // Fallback to level 1
  if (level !== 1) {
    const lvl1Key = `${category}|${name}|1||0|${currency}`;
    const lvl1Entry = priceDataCache[lvl1Key];
    if (lvl1Entry) {
      return parseNumber(lvl1Entry[0]);
    }
  }

  return 0;
}

export function calculateNetWorth(player: any): NetWorthResult {
  let equippedVal = 0;
  let storageVal = 0;

  // 1. Equipped Gear
  if (player.sword && player.sword !== "None" && !player.sword.includes("Unknown")) {
    equippedVal += lookupItemPrice("sword", player.sword, player.swordLevel || 1);
  }
  if (player.shield && player.shield !== "None" && !player.shield.includes("Unknown")) {
    equippedVal += lookupItemPrice("shield", player.shield, player.shieldLevel || 1);
  }
  if (player.activePets && Array.isArray(player.activePets)) {
    player.activePets.forEach((pet: any) => {
      const petItem = resolveItemByGameType(pet.type, "pet");
      if (petItem && !petItem.name.includes("Unknown")) {
        equippedVal += lookupItemPrice("pet", petItem.name, 1);
      }
    });
  }

  // 2. Storage Inventory
  const rawPayload = player.rawPayload || {};
  const inv = rawPayload.inv || {};
  const storage = inv.storage || {};

  if (storage) {
    // Swords in storage
    if (Array.isArray(storage.swords)) {
      storage.swords.forEach((sw: any) => {
        const item = resolveItemByGameType(sw.type, "sword");
        if (item && !item.name.includes("Unknown")) {
          storageVal += lookupItemPrice("sword", item.name, sw.level || 1);
        }
      });
    }
    // Shields in storage
    if (Array.isArray(storage.shields)) {
      storage.shields.forEach((sh: any) => {
        const item = resolveItemByGameType(sh.type, "shield");
        if (item && !item.name.includes("Unknown")) {
          storageVal += lookupItemPrice("shield", item.name, sh.level || 1);
        }
      });
    }
    // Pets in storage
    if (Array.isArray(storage.pets)) {
      storage.pets.forEach((p: any) => {
        const item = resolveItemByGameType(p.type, "pet");
        if (item && !item.name.includes("Unknown")) {
          storageVal += lookupItemPrice("pet", item.name, 1);
        }
      });
    }
  }

  const total = equippedVal + storageVal;

  return {
    equipped: equippedVal,
    storage: storageVal,
    total,
    equippedFormatted: formatNumber(equippedVal),
    storageFormatted: formatNumber(storageVal),
    totalFormatted: formatNumber(total),
    isLoaded: true
  };
}
