import { parseNumber } from "./numberParser";

export interface ParsedPlayer {
  username: string;
  level: number;
  experience: string;
  gold: string;
  goldRaw: number;
  power: string;
  powerRaw: number;
  health: string;
  pvpKillCount: number;
  pvpLoot: string;
  registerDate: string;
  sword: string;
  swordLevel: number;
  swordProgress: number;
  shield: string;
  shieldLevel: number;
  shieldProgress: number;
  clan?: string;
  role?: string;
  status?: string;
  killedEnemies: Record<string, number>;
}

function cleanText(input: string): string {
  // Normalize line endings first
  let text = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Replace special Unicode spaces (in general punctuation block) with standard space
  text = text.replace(/[\u2000-\u200b\u202f\u205f]/g, " ");

  return text
    // Remove Discord markdown / formatting artifacts
    .replace(/^[ \t]*\*+[ \t]*/gm, "") // horizontal spaces only to avoid consuming newlines
    .replace(/\*+/g, "")
    .replace(/•[ \t]*/g, "")
    .replace(/—+/g, "")
    .replace(/:[a-zA-Z_]+:/g, "") // emoji shortcodes
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, "") // unicode emoji
    .replace(/[\u2000-\u206F]/g, "") // general punctuation (some emoji)
    .replace(/[\u2600-\u27BF]/g, "") // misc symbols
    .replace(/^\s*Today at.*$/gm, "")
    .replace(/^\s*Sword MastersAPP\s*$/gm, "")
    .replace(/^\s*ZiraAPP\s*$/gm, "")
    .replace(/^\s*APP\s*$/gm, "")
    .replace(/^\s*\d+:\d+\s*(AM|PM)?\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractField(lines: string[], label: string): string {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.toLowerCase() === label.toLowerCase()) {
      // Value is the next non-empty line
      for (let j = i + 1; j < lines.length; j++) {
        const val = lines[j].trim();
        if (val) return val;
      }
    }
    // Or inline: "Label: Value"
    const colonMatch = line.match(new RegExp(`^${label}\\s*:\\s*(.+)$`, "i"));
    if (colonMatch) return colonMatch[1].trim();
  }
  return "";
}

function parseGearString(raw: string): { name: string; level: number; progress: number } {
  // e.g. "Divinity Edge, Level 3  0%" or "Empty, Level 0  100%"
  const match = raw.match(/^(.+?),\s*Level\s*(\d+)\s+(\d+)%/i);
  if (match) {
    return {
      name: match[1].trim(),
      level: parseInt(match[2]),
      progress: parseInt(match[3]),
    };
  }
  // Fallback: just the name
  return { name: raw.trim() || "Unknown", level: 0, progress: 100 };
}

function parseKilledEnemies(lines: string[], startIdx: number): Record<string, number> {
  const enemies: Record<string, number> = {};
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Stop if we hit a new section header (next stat)
    if (/^(Level|Experience|Gold|Power|Health|PvP|Register|Sword|Shield|Clan|Role|Status)$/i.test(line)) break;
    const match = line.match(/^(.+?):\s*(\d+)$/);
    if (match) {
      enemies[match[1].trim()] = parseInt(match[2]);
    }
  }
  return enemies;
}

export function parsePlayerData(rawInput: string): ParsedPlayer | null {
  const cleaned = cleanText(rawInput);
  const lines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);

  if (lines.length < 5) return null;

  // Find "Username Stats" line
  let usernameLineIdx = -1;
  let username = "";
  for (let i = 0; i < lines.length; i++) {
    const statsMatch = lines[i].match(/^(.+?)\s+Stats\s*$/i);
    if (statsMatch) {
      username = statsMatch[1].trim();
      usernameLineIdx = i;
      break;
    }
  }

  // Fallback: first non-empty line as username if no "Stats" line found
  if (!username) {
    username = lines[0];
    usernameLineIdx = 0;
  }

  const relevantLines = lines.slice(usernameLineIdx);

  // Extract metadata fields
  const clan = extractField(relevantLines, "Clan") || undefined;
  const role = extractField(relevantLines, "Role") || undefined;
  const status = extractField(relevantLines, "Status") || undefined;

  const levelStr = extractField(relevantLines, "Level");
  const level = parseInt(levelStr.replace(/,/g, "")) || 0;

  const experience = extractField(relevantLines, "Experience");
  const gold = extractField(relevantLines, "Gold");
  const goldRaw = parseNumber(gold);
  const power = extractField(relevantLines, "Power");
  const powerRaw = parseNumber(power);
  const health = extractField(relevantLines, "Health");
  const pvpKillStr = extractField(relevantLines, "PvP Kill Count");
  const pvpKillCount = parseInt(pvpKillStr.replace(/,/g, "")) || 0;
  const pvpLoot = extractField(relevantLines, "PvP Loot");
  const registerDate = extractField(relevantLines, "Register Date");

  const swordRaw = extractField(relevantLines, "Sword");
  const shieldRaw = extractField(relevantLines, "Shield");

  const swordParsed = parseGearString(swordRaw);
  const shieldParsed = parseGearString(shieldRaw);

  // Find killed enemies section
  let killedIdx = -1;
  for (let i = 0; i < relevantLines.length; i++) {
    if (/^Killed Enemies$/i.test(relevantLines[i])) {
      killedIdx = i + 1;
      break;
    }
  }
  const killedEnemies = killedIdx >= 0 ? parseKilledEnemies(relevantLines, killedIdx) : {};

  return {
    username,
    level,
    experience,
    gold,
    goldRaw,
    power,
    powerRaw,
    health,
    pvpKillCount,
    pvpLoot,
    registerDate,
    sword: swordParsed.name,
    swordLevel: swordParsed.level,
    swordProgress: swordParsed.progress,
    shield: shieldParsed.name,
    shieldLevel: shieldParsed.level,
    shieldProgress: shieldParsed.progress,
    clan,
    role,
    status,
    killedEnemies,
  };
}
