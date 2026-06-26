// Market prices editor — stored in localStorage, editable from admin panel
// Prices are strings like "390QNT", "2SXT", "50QT" — display-only, not parsed for math

const STORAGE_KEY = "smg_market_prices_v1";

export type PriceTable = Record<string, Record<number, string>>;

// Default prices from real trade data (screenshot values)
export const DEFAULT_PRICES: PriceTable = {
  // Legendary Swords
  "Last Horizon":       { 1: "390QNT", 2: "550QNT", 3: "800QNT", 4: "1.2SXT", 5: "2SXT" },
  "Divinity Edge":      { 1: "28QNT",  2: "50QNT",  3: "90QNT",  4: "180QNT", 5: "400QNT" },
  "Dragon's Devil":     { 1: "8QNT",   2: "14QNT",  3: "25QNT",  4: "50QNT",  5: "100QNT" },
  // Epic Swords
  "Solbrand":           { 1: "50QT",   2: "120QT",  3: "200QT",  4: "600QT",  5: "1.5QNT" },
  "Soulkeeper's Blade": { 1: "500QT",  2: "900QT",  3: "2.4QNT", 4: "10QNT",  5: "33QNT" },
  "Einherjar's Blade":  { 1: "30QT",   2: "60QT",   3: "120QT",  4: "300QT",  5: "700QT" },
  "Dragon's Poison":    { 1: "6QT",    2: "12QT",   3: "20QT",   4: "40QT",   5: "100QT" },
  // Rare Swords
  "Runebreaker":        { 1: "10QT",   2: "20QT",   3: "35QT",   4: "45QT",   5: "53QT" },
  "Dreadmourne":        { 1: "20QT",   2: "40QT",   3: "80QT",   4: "150QT",  5: "300QT" },
  // Legendary Shields
  "Final Bastion":      { 1: "390QNT", 2: "550QNT", 3: "800QNT", 4: "1.2SXT", 5: "2SXT" },
  "Asgardian Aegis":    { 1: "28QNT",  2: "50QNT",  3: "90QNT",  4: "180QNT", 5: "400QNT" },
  "Dragon's Soul":      { 1: "2QNT",   2: "4QNT",   3: "8QNT",   4: "16QNT",  5: "35QNT" },
  // Epic Shields
  "Sealguard":          { 1: "30QT",   2: "60QT",   3: "120QT",  4: "250QT",  5: "500QT" },
  "Sunward Bulwark":    { 1: "5QT",    2: "10QT",   3: "20QT",   4: "40QT",   5: "80QT" },
  "Dragon's Anger":     { 1: "5QT",    2: "10QT",   3: "15QT",   4: "30QT",   5: "60QT" },
};

export function loadPrices(): PriceTable {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as PriceTable;
      // Merge with defaults so new items added later still appear
      const merged: PriceTable = { ...DEFAULT_PRICES };
      for (const item of Object.keys(saved)) {
        merged[item] = { ...DEFAULT_PRICES[item], ...saved[item] };
      }
      return merged;
    }
  } catch {
    // ignore parse errors
  }
  return { ...DEFAULT_PRICES };
}

export function savePrices(prices: PriceTable): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prices));
}

/** Get price note for an item at a specific level */
export function getPriceNote(itemName: string, level: number): string | null {
  const prices = loadPrices();
  const itemPrices = prices[itemName];
  if (!itemPrices) return null;
  return itemPrices[level] || itemPrices[1] || null;
}
