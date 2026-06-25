// Parse SwordMasters number notation to raw float
// Supports: K, M, B, T, QT, QNT, SXT, SEP, OCT

const SUFFIXES: [string, number][] = [
  ["OCT", 1e27],
  ["SEP", 1e24],
  ["SXT", 1e21],
  ["QNT", 1e18],
  ["QT", 1e15],
  ["T", 1e12],
  ["B", 1e9],
  ["M", 1e6],
  ["K", 1e3],
];

export function parseNumber(raw: string): number {
  const cleaned = raw.trim().replace(/,/g, "");
  if (!cleaned || cleaned === "0" || cleaned === "-") return 0;

  for (const [suffix, multiplier] of SUFFIXES) {
    const regex = new RegExp(`^([0-9.]+)\\s*${suffix}$`, "i");
    const match = cleaned.match(regex);
    if (match) {
      return parseFloat(match[1]) * multiplier;
    }
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function formatNumber(value: number): string {
  if (value === 0) return "0";

  for (const [suffix, multiplier] of SUFFIXES) {
    if (value >= multiplier) {
      const formatted = (value / multiplier).toPrecision(4).replace(/\.?0+$/, "");
      return `${formatted}${suffix}`;
    }
  }

  return value.toFixed(0);
}
