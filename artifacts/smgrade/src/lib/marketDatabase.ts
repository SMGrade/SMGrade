// SwordMasters Unified Canonical Market Price Database
import { loadItems } from "./gearDatabase.js";
import { parseNumber, formatNumber } from "./numberParser.js";

export interface MarketItem {
  name: string;
  category: "sword" | "shield";
  prices: { [level: number]: number }; // level 1 to 10 prices (numeric format)
  avgTradePrice?: number;
  lastUpdated?: string;
}

const MARKET_STORAGE_KEY = "smg_market_database_v1";

// Default prices imported and parsed from legacy trade logs estimates
export const DEFAULT_PRICES_ESTIMATED: Record<string, Record<number, string>> = {
  // Legendary Swords
  "Last Horizon":       { 1: "250QNT", 2: "500QNT", 3: "1.4SXT", 4: "3.4SXT", 5: "8SXT" },
  "Divinity Edge":      { 1: "28QNT",  2: "60QNT",  3: "140QNT", 4: "450QNT", 5: "1.2SXT" },
  "Dragon's Devil":     { 1: "8QNT",   2: "14QNT",  3: "25QNT",  4: "60QNT",  5: "140QNT" },
  // Epic Swords
  "Solbrand":           { 1: "50QT",   2: "120QT",  3: "200QT",  4: "600QT",  5: "1.5QNT" },
  "Soulkeeper's Blade": { 1: "250QT",  2: "500QT",  3: "2.4QNT", 4: "6QNT",  5: "14QNT" },
  "Einherjar's Blade":  { 1: "30QT",   2: "60QT",   3: "120QT",  4: "300QT",  5: "700QT" },
  "Dragon's Poison":    { 1: "6QT",    2: "12QT",   3: "20QT",   4: "40QT",   5: "100QT" },
  // Rare Swords
  "Runebreaker":        { 1: "10QT",   2: "20QT",   3: "35QT",   4: "45QT",   5: "53QT" },
  "Dreadmourne":        { 1: "20QT",   2: "40QT",   3: "80QT",   4: "150QT",  5: "300QT" },
  // Legendary Shields
  "Final Bastion":      { 1: "250QNT", 2: "500QNT", 3: "1.4SXT", 4: "3.4SXT", 5: "8SXT" },
  "Asgardian Aegis":    { 1: "30QNT",  2: "60QNT",  3: "160QNT", 4: "520QNT", 5: "1.6SXT" },
  "Dragon's Soul":      { 1: "3QNT",   2: "6QNT",   3: "16QNT",  4: "30QNT",  5: "80QNT" },
  // Epic Shields
  "Sealguard":          { 1: "300QT",  2: "600QT",  3: "1.6QNT", 4: "4QNT",  5: "16QNT" },
  "Sunward Bulwark":    { 1: "5QT",    2: "10QT",   3: "20QT",   4: "40QT",   5: "80QT" },
  "Dragon's Anger":     { 1: "5QT",    2: "10QT",   3: "15QT",   4: "30QT",   5: "60QT" },
  // World 11 Common Items (Matched to Dreadmourne and Runebreaker)
  "Graveborn Edge":     { 1: "20QT",   2: "40QT",   3: "80QT",   4: "150QT",  5: "300QT" },
  "Crackshield":        { 1: "10QT",   2: "20QT",   3: "35QT",   4: "45QT",   5: "53QT" }
};

export function loadMarketData(): MarketItem[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return initializeMarketData();
  }
  try {
    const rawNew = localStorage.getItem(MARKET_STORAGE_KEY);
    if (rawNew) {
      const parsed = JSON.parse(rawNew) as MarketItem[];
      if (parsed.length > 0) {
        // Safe check: if some items are missing (e.g. World 11 common items), append them
        // using our default values. Do NOT modify, overwrite, or estimate any existing items!
        const items = loadItems();
        let updated = false;
        items.forEach(item => {
          if (item.type === "sword" || item.type === "shield") {
            const found = parsed.find(i => i.name.toLowerCase() === item.name.toLowerCase());
            if (!found) {
              const defaultItemPrices = DEFAULT_PRICES_ESTIMATED[item.name];
              const prices: { [level: number]: number } = {};
              const tierFactor = item.tierRank || 1;
              const basePrice = item.type === "sword"
                ? Math.pow(10, Math.min(3 + tierFactor * 0.45, 24))
                : Math.pow(10, Math.min(3 + tierFactor * 0.47, 24));

              for (let lvl = 1; lvl <= 10; lvl++) {
                if (defaultItemPrices && defaultItemPrices[lvl]) {
                  prices[lvl] = parseNumber(defaultItemPrices[lvl]);
                } else {
                  prices[lvl] = Math.round(basePrice * Math.pow(1.4, lvl - 1));
                }
              }
              parsed.push({
                name: item.name,
                category: item.type as any,
                prices,
                avgTradePrice: prices[1] || Math.round(basePrice),
                lastUpdated: new Date().toLocaleDateString()
              });
              updated = true;
            }
          }
        });
        if (updated && typeof window !== "undefined" && window.localStorage) {
          localStorage.setItem(MARKET_STORAGE_KEY, JSON.stringify(parsed));
        }
        return parsed;
      }
    }
  } catch (err) {
    console.error("[SMGrade] Load market data error:", err);
  }
  return initializeMarketData();
}

export function saveMarketData(data: MarketItem[]): void {
  if (typeof window !== "undefined" && window.localStorage) {
    localStorage.setItem(MARKET_STORAGE_KEY, JSON.stringify(data));
  }
}

export function initializeMarketData(): MarketItem[] {
  const items = loadItems();
  const list: MarketItem[] = [];
  
  items.forEach(item => {
    if (item.type === "sword" || item.type === "shield") {
      const tierFactor = item.tierRank || 1;
      let basePrice = 0;
      if (item.type === "sword") {
        basePrice = Math.pow(10, Math.min(3 + tierFactor * 0.45, 24)); // scaling
      } else {
        basePrice = Math.pow(10, Math.min(3 + tierFactor * 0.47, 24));
      }
      
      const prices: { [level: number]: number } = {};
      const defaultItemPrices = DEFAULT_PRICES_ESTIMATED[item.name];

      for (let lvl = 1; lvl <= 10; lvl++) {
        if (defaultItemPrices && defaultItemPrices[lvl]) {
          prices[lvl] = parseNumber(defaultItemPrices[lvl]);
        } else {
          const lvl1Price = defaultItemPrices && defaultItemPrices[1]
            ? parseNumber(defaultItemPrices[1])
            : basePrice;
          prices[lvl] = Math.round(lvl1Price * Math.pow(1.4, lvl - 1));
        }
      }
      
      list.push({
        name: item.name,
        category: item.type as any,
        prices,
        avgTradePrice: prices[1] || Math.round(basePrice),
        lastUpdated: new Date().toLocaleDateString()
      });
    }
  });

  if (typeof window !== "undefined" && window.localStorage) {
    localStorage.setItem(MARKET_STORAGE_KEY, JSON.stringify(list));
  }
  return list;
}

export function getPriceRaw(itemName: string, level: number): number {
  const data = loadMarketData();
  const found = data.find(i => i.name.toLowerCase() === itemName.toLowerCase());
  if (found && found.prices) {
    return found.prices[level] || 0;
  }
  return 0;
}

export function getPriceNote(itemName: string, level: number): string {
  const price = getPriceRaw(itemName, level);
  return price > 0 ? formatNumber(price) : "N/A";
}

// Aliases for compatibility
export const getPriceRawFromMarket = getPriceRaw;
export const getPriceNoteFromMarket = getPriceNote;
