// SwordMasters Player Scoring & Grading Engine Overhaul - SMGrade Version 2.0
import {
  getBenchmarkForLevel,
  getInterpolatedBenchmark,
  getSwordTier,
  getShieldTier,
} from "./benchmark.js";
import {
  getSwordData,
  getShieldData,
  getNextSwordUpgrade,
  getNextShieldUpgrade,
  scaledSwordDamage,
  scaledShieldDM,
  swordUpgradeGain,
  shieldUpgradeGain,
  loadItems,
  resolveItemByGameType,
  SWORD_TYPE_MAP,
  SHIELD_TYPE_MAP,
} from "./gearDatabase.js";
import { getPriceRawFromMarket, getPriceNoteFromMarket } from "./marketDatabase.js";
import { calculateDamageStats } from "./damageCalc.js";
import { calculateNetWorth } from "./priceProvider.js";
import { formatNumber, parseNumber } from "./numberParser.js";
import type { ParsedPlayer } from "./parser.js";
import { loadGradingConstants } from "./settings.js";

export type GradeLetter = "S+" | "S" | "A+" | "A" | "B+" | "B" | "C+" | "C" | "D";

export interface UpgradeGoal {
  name: string;
  level: number;
  type: "Sword" | "Shield" | "Power";
  damageGainPct: number;
  marketPriceNote: string | null;
  estimatedRequirements?: string;
  affordable: boolean;
  status: string;
  reason: string;
}

export interface UpgradeAdvice {
  immediate: UpgradeGoal | null;
  longTerm: UpgradeGoal | null;
  recommendations: UpgradeGoal[];
  lateGameGoals?: UpgradeGoal[];
  powerShortageMessage?: string | null;
}

export interface UpgradeTip {
  targetName: string;
  targetLevel: number;
  damageGainPct: number;
  marketPriceNote: string | null;
  switchWorthwhileAtLevel?: number;
  affordable: boolean;
}

export interface GearSlotGrade {
  slotName: string;
  itemName: string;
  score: number;
  grade: GradeLetter;
  stat: string;
  tip: UpgradeTip | null;
}

export interface SubGradeInfo {
  score: number;
  grade: GradeLetter;
  value: string;
}

export interface ScoreResult {
  overallScore: number;
  overallGrade: GradeLetter;
  gearScore: number;
  powerScore: number;
  combatScore: number;
  progressScore: number;
  wealthScore: number;
  
  // SMGrade 2.0 Sub-grades for every category
  subGrades: {
    level: SubGradeInfo;
    power: SubGradeInfo;
    dph: SubGradeInfo;
    dps: SubGradeInfo;
    pph: SubGradeInfo;
    pps: SubGradeInfo;
    gold: SubGradeInfo;
    protection: SubGradeInfo;
    health: SubGradeInfo;
    sword: SubGradeInfo;
    shield: SubGradeInfo;
    pets: SubGradeInfo;
    enchantments: SubGradeInfo;
    inventory: SubGradeInfo;
    storage: SubGradeInfo;
    upgradePotential: SubGradeInfo;
    quests: SubGradeInfo;
  };
  
  standing: "Elite" | "Above Average" | "Average" | "Below Average" | "Weak";
  levelTier: string;
  slotGrades: GearSlotGrade[];
  upgradeAdvice: UpgradeAdvice;
}

function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, val));
}

function scoreToGrade(score: number, constants = loadGradingConstants()): GradeLetter {
  if (score >= constants.gradeThresholdSPlus) return "S+";
  if (score >= constants.gradeThresholdS) return "S";
  if (score >= constants.gradeThresholdAPlus) return "A+";
  if (score >= constants.gradeThresholdA) return "A";
  if (score >= constants.gradeThresholdBPlus) return "B+";
  if (score >= constants.gradeThresholdB) return "B";
  if (score >= constants.gradeThresholdCPlus) return "C+";
  if (score >= constants.gradeThresholdC) return "C";
  return "D";
}

function scoreStanding(
  powerRaw: number,
  benchmark: any
): ScoreResult["standing"] {
  if (powerRaw >= benchmark.elitePower) return "Elite";
  if (powerRaw >= benchmark.strongPower) return "Above Average";
  if (powerRaw >= benchmark.avgPower) return "Average";
  if (powerRaw >= benchmark.weakPower) return "Below Average";
  return "Weak";
}

function getPiecewiseScore(val: number, weak: number, avg: number, strong: number, elite: number): number {
  if (val <= 0) return 0;
  
  const w = Math.max(weak, 1);
  const a = Math.max(avg, w + 1);
  const s = Math.max(strong, a + 1);
  const e = Math.max(elite, s + 1);
  
  const logVal = Math.log10(val);
  const logW = Math.log10(w);
  const logA = Math.log10(a);
  const logS = Math.log10(s);
  const logE = Math.log10(e);

  if (logVal <= logW) {
    const ratio = Math.max(0, logVal / logW);
    return clamp(Math.round(ratio * 30));
  }
  if (logVal <= logA) {
    const ratio = (logVal - logW) / (logA - logW);
    return clamp(Math.round(30 + ratio * 30));
  }
  if (logVal <= logS) {
    const ratio = (logVal - logA) / (logS - logA);
    return clamp(Math.round(60 + ratio * 25));
  }
  if (logVal <= logE) {
    const ratio = (logVal - logS) / (logE - logS);
    return clamp(Math.round(85 + ratio * 15));
  }
  return 100;
}

function getLevelScore(level: number): number {
  if (level <= 500) {
    return clamp(Math.round((level / 500) * 30));
  }
  if (level <= 11000) {
    return clamp(Math.round(30 + ((level - 500) / (11000 - 500)) * 30));
  }
  if (level <= 30000) {
    return clamp(Math.round(60 + ((level - 11000) / (30000 - 11000)) * 25));
  }
  return clamp(Math.round(85 + Math.min((level - 30000) / (100000 - 30000), 1) * 15));
}

function getGearScoreComponent(tier: number, avgTier: number, level: number): number {
  if (tier <= 0) return 0;
  
  const ratio = tier / Math.max(avgTier, 1);
  
  let score = 60;
  if (ratio >= 1.2) {
    score = 90 + Math.min((ratio - 1.2) * 50, 10);
  } else if (ratio >= 1.0) {
    score = 75 + ((ratio - 1.0) / 0.2) * 15;
  } else if (ratio >= 0.7) {
    score = 40 + ((ratio - 0.7) / 0.3) * 35;
  } else {
    score = (ratio / 0.7) * 40;
  }

  const levelBonus = Math.min(level, 10);
  return clamp(Math.round(score * 0.9 + levelBonus));
}

function calculateGearStrength(item: any, level: number, isShield: boolean): number {
  const getProtRaw = (protStr?: string) => {
    if (!protStr || protStr === "-") return 0;
    return parseNumber(protStr);
  };

  const getMultiRaw = (multiStr?: string) => {
    if (!multiStr || multiStr === "-") return 0;
    return parseFloat(multiStr) || 0;
  };

  const baseVal = item.baseValue || (item as any).baseDamage || (item as any).baseDM || 0;
  const scaledStat = isShield ? scaledShieldDM(baseVal, level) : scaledSwordDamage(baseVal, level);
  
  const protRaw = getProtRaw(item.protection);
  const goldMulti = getMultiRaw(item.goldMulti);
  const healthMulti = getMultiRaw(item.healthMulti);
  
  const rarity = item.rarity || "Common";
  const rarityWeight = rarity === "Legendary" ? 4 : rarity === "Epic" ? 3 : rarity === "Rare" ? 2 : 1;

  return (scaledStat * 10) + (protRaw / 1e7) + (goldMulti * 2) + (healthMulti * 2) + (rarityWeight * 20);
}

interface GearStats {
  name: string;
  level: number;
  damage: number;
  dm: number;
  prot: number;
  hm: number;
  gm: number;
  score: number;
}

function getSwordStats(item: any, level: number): GearStats {
  const getProtRaw = (protStr?: string) => {
    if (!protStr || protStr === "-") return 0;
    return parseNumber(protStr);
  };
  const getMultiRaw = (multiStr?: string) => {
    if (!multiStr || multiStr === "-") return 0;
    return parseFloat(multiStr) || 0;
  };
  const baseVal = item.baseValue || item.baseDamage || 0;
  const damage = scaledSwordDamage(baseVal, level) * 1e9;
  const prot = getProtRaw(item.protection);
  const hm = getMultiRaw(item.healthMulti);
  const gm = getMultiRaw(item.goldMulti);
  // Combat Score formula based strictly on actual stats:
  // Damage (in Billions) * 100 + Protection (in Millions) * 0.1 + Health Multiplier * 10 + Gold Multiplier * 10
  const score = (damage / 1e9) * 100 + (prot / 1e6) * 0.1 + hm * 10 + gm * 10;
  return { name: item.name, level, damage, dm: 1.0, prot, hm, gm, score };
}

function getShieldStats(item: any, level: number): GearStats {
  const getProtRaw = (protStr?: string) => {
    if (!protStr || protStr === "-") return 0;
    return parseNumber(protStr);
  };
  const getMultiRaw = (multiStr?: string) => {
    if (!multiStr || multiStr === "-") return 0;
    return parseFloat(multiStr) || 0;
  };
  const baseVal = item.baseValue || item.baseDM || 0;
  const dm = scaledShieldDM(baseVal, level);
  const prot = getProtRaw(item.protection);
  const hm = getMultiRaw(item.healthMulti);
  const gm = getMultiRaw(item.goldMulti);
  // Combat Score formula based strictly on actual stats:
  // Damage Multiplier * 100 + Protection (in Millions) * 0.1 + Health Multiplier * 10 + Gold Multiplier * 10
  const score = dm * 100 + (prot / 1e6) * 0.1 + hm * 10 + gm * 10;
  return { name: item.name, level, damage: 0, dm, prot, hm, gm, score };
}

function printUpgradeAudit(
  category: "Weapon" | "Shield",
  current: GearStats | null,
  recommended: GearStats | null,
  explanation: string
) {
  console.log(`==================================================`);
  console.log(`UPGRADE ADVISOR AUDIT: ${category.toUpperCase()}`);
  console.log(`==================================================`);
  console.log(`Current ${category}`);
  if (current && current.name !== "None") {
    console.log(`Name: ${current.name}`);
    console.log(`Level: ${current.level}`);
    console.log(`Damage: ${formatNumber(current.damage)}`);
    console.log(`Damage Multiplier: ${current.dm.toFixed(2)}x`);
    console.log(`Protection: ${formatNumber(current.prot)}`);
    console.log(`Health Multiplier: ${current.hm}x`);
    console.log(`Gold Multiplier: ${current.gm}x`);
    console.log(`Effective Combat Score: ${current.score.toFixed(1)}`);
  } else {
    console.log("None");
  }

  console.log(`\nRecommended ${category}`);
  if (recommended) {
    console.log(`Name: ${recommended.name}`);
    console.log(`Level: ${recommended.level}`);
    console.log(`Damage: ${formatNumber(recommended.damage)}`);
    console.log(`Damage Multiplier: ${recommended.dm.toFixed(2)}x`);
    console.log(`Protection: ${formatNumber(recommended.prot)}`);
    console.log(`Health Multiplier: ${recommended.hm}x`);
    console.log(`Gold Multiplier: ${recommended.gm}x`);
    console.log(`Effective Combat Score: ${recommended.score.toFixed(1)}`);

    console.log(`\n==================================================`);
    console.log(`VALIDATION`);
    console.log(`==================================================`);
    const curDmg = current ? current.damage : 0;
    const curProt = current ? current.prot : 0;
    const curScore = current ? current.score : 0;
    const curDM = current ? current.dm : 0;

    let isDmgGreater = false;
    let isProtGreater = false;
    let isScoreGreater = false;

    if (current && current.name === recommended.name) {
      isDmgGreater = category === "Weapon" ? recommended.damage > curDmg : recommended.dm > curDM;
      isProtGreater = recommended.prot >= curProt;
      isScoreGreater = recommended.score > curScore;
    } else {
      const curItem = (category === "Weapon" ? getSwordData(current?.name || "") : getShieldData(current?.name || "")) as any;
      const recItem = (category === "Weapon" ? getSwordData(recommended.name) : getShieldData(recommended.name)) as any;

      const curBaseDmg = curItem ? (curItem.baseValue || curItem.baseDamage || 0) : 0;
      const recBaseDmg = recItem ? (recItem.baseValue || recItem.baseDamage || 0) : 0;

      const curBaseDM = curItem ? (curItem.baseValue || curItem.baseDM || 0) : 0;
      const recBaseDM = recItem ? (recItem.baseValue || recItem.baseDM || 0) : 0;

      const curBaseProt = curItem ? parseNumber(curItem.protection || "") : 0;
      const recBaseProt = recItem ? parseNumber(recItem.protection || "") : 0;

      isDmgGreater = category === "Weapon" ? recBaseDmg > curBaseDmg : recBaseDM > curBaseDM;
      isProtGreater = recBaseProt >= curBaseProt;
      
      const maxLvl = recItem ? (recItem.maxLevel || 10) : 10;
      const recMaxScore = recItem ? (category === "Weapon" ? getSwordStats(recItem, maxLvl).score : getShieldStats(recItem, maxLvl).score) : 0;
      isScoreGreater = recMaxScore > curScore;
    }

    console.log(`Is Recommended Damage > Current Damage? ${isDmgGreater ? "YES" : "NO"}`);
    console.log(`Is Recommended Protection > Current Protection? ${isProtGreater ? "YES" : "NO"}`);
    console.log(`Is Recommended Combat Score > Current Combat Score? ${isScoreGreater ? "YES" : "NO"}`);
  } else {
    console.log("None / Focus on Farming & Power Grind");
  }
  console.log(`\nExplanation: ${explanation}`);
  console.log("==================================================\n");
}

function getUpgradeAdvice(player: ParsedPlayer, constants = loadGradingConstants()): UpgradeAdvice {
  const items = loadItems();
  const curSw = getSwordData(player.sword);
  const curSh = getShieldData(player.shield);
  
  const swLevel = player.swordLevel;
  const shLevel = player.shieldLevel;
  
  const benchmark = getInterpolatedBenchmark(player.level);

  // Helper mappings for player's current world progression
  const getWorldFromLevel = (lvl: number): number => {
    if (lvl >= 3000) return 11;
    if (lvl >= 2000) return 10;
    if (lvl >= 1500) return 9;
    if (lvl >= 1000) return 8.5; // Dragon World
    if (lvl >= 700) return 8; // Spaceland W8
    if (lvl >= 400) return 7; // Aqualand W7
    if (lvl >= 300) return 6; // Heaven W6
    if (lvl >= 100) return 5; // Netherworld W5
    if (lvl >= 60) return 4; // Desertland W4
    if (lvl >= 50) return 3; // Iceworld W3
    if (lvl >= 25) return 2; // Sugarland W2
    return 1; // Orkland W1
  };

  const getWorldNumberFromName = (worldName?: string): number => {
    if (!worldName) return 1;
    const name = worldName.toLowerCase();
    if (name.includes("world 11") || name.includes("w11")) return 11;
    if (name.includes("asgard") || name.includes("w10")) return 10;
    if (name.includes("death") || name.includes("w9")) return 9;
    if (name.includes("spaceland") || name.includes("w8")) return 8;
    if (name.includes("dragon")) return 8; // Dragon World
    if (name.includes("aqualand") || name.includes("w7")) return 7;
    if (name.includes("heaven") || name.includes("w6")) return 6;
    if (name.includes("netherworld") || name.includes("w5")) return 5;
    if (name.includes("desertland") || name.includes("w4")) return 4;
    if (name.includes("ice") || name.includes("w3")) return 3;
    if (name.includes("sugar") || name.includes("w2")) return 2;
    if (name.includes("ork") || name.includes("w1")) return 1;
    return 1;
  };

  const playerWorld = (player as any).worldNumber || (player as any).rawPayload?.worldNumber || getWorldFromLevel(player.level);

  // Check inventory to see if items are already owned
  const inventorySwords = (player as any).inventorySwords || (player as any).rawPayload?.inv?.swords || [];
  const inventoryShields = (player as any).inventoryShields || (player as any).rawPayload?.inv?.shields || [];
  
  const getOwnedLevel = (itemName: string, isShield: boolean): number => {
    if (isShield) {
      const match = inventoryShields.find((s: any) => {
        const nameFromMap = typeof s.type === "number" ? SHIELD_TYPE_MAP[s.type] : null;
        const nameStr = nameFromMap || s.name || (typeof s.type === "string" ? s.type : null);
        return typeof nameStr === "string" && nameStr.toLowerCase() === itemName.toLowerCase();
      });
      return match ? (match.level || 1) : 0;
    } else {
      const match = inventorySwords.find((s: any) => {
        const nameFromMap = typeof s.type === "number" ? SWORD_TYPE_MAP[s.type] : null;
        const nameStr = nameFromMap || s.name || (typeof s.type === "string" ? s.type : null);
        return typeof nameStr === "string" && nameStr.toLowerCase() === itemName.toLowerCase();
      });
      return match ? (match.level || 1) : 0;
    }
  };

  const isAlreadyOwned = (itemName: string, isShield: boolean): boolean => {
    return getOwnedLevel(itemName, isShield) > 0;
  };

  const isObtainable = (item: any): boolean => {
    const isEquipped = item.type === "shield"
      ? !!(curSh && item.name.toLowerCase() === curSh.name.toLowerCase())
      : !!(curSw && item.name.toLowerCase() === curSw.name.toLowerCase());
    if (isEquipped) return true;
    if (isAlreadyOwned(item.name, item.type === "shield")) return true;
    if (player.level < (item.minLevel || 0)) return false;
    const itemWorldNum = getWorldNumberFromName(item.world);
    // Limit to current world or at most 1 world higher to ensure realistic progression path
    if (playerWorld + 1 < itemWorldNum) return false;
    return true;
  };

  // Baseline player stats with un-pet-boosted constants for consistent combat math:
  const curDs = curSw ? scaledSwordDamage(curSw.baseDamage, swLevel) * 1e9 : 0;
  const curMs = curSh ? scaledShieldDM(curSh.baseDM, shLevel) : 0;

  const currentStats = calculateDamageStats({
    ds: curDs,
    swordDamageMultiplier: curMs,
    power: player.powerRaw,
    petPowerBonus: 0,
    armorPowerBonus: 0,
    attackSpeed: 2.77
  });

  interface Candidate {
    name: string;
    level: number;
    type: "Sword" | "Shield";
    damageGainPct: number;
    cost: number;
    priceNote: string | null;
    isUpgradeCurrent: boolean;
    isOwnedInInventory: boolean;
    resultingDps: number;
    progressionScore: number;
  }

  const candidates: Candidate[] = [];

  items.forEach((item: any) => {
    if (item.type !== "sword" && item.type !== "shield") return;
    if (!isObtainable(item)) return;

    const isShield = item.type === "shield";
    const isEquipped = isShield
      ? !!(curSh && item.name.toLowerCase() === curSh.name.toLowerCase())
      : !!(curSw && item.name.toLowerCase() === curSw.name.toLowerCase());
    
    const currentEquippedLevel = isShield ? shLevel : swLevel;
    const ownedLevel = isEquipped ? currentEquippedLevel : getOwnedLevel(item.name, isShield);
    
    // Enforce step-by-step target level:
    // If owned: we can only upgrade to ownedLevel + 1.
    // If unowned: we can only buy Level 1.
    const targetLvl = ownedLevel === 0 ? 1 : ownedLevel + 1;
    
    // STRICT RARITY CAPS
    const capLevel = item.rarity === "Legendary" ? 5 : (item.rarity === "Epic" ? 7 : 10);
    if (targetLvl > capLevel) {
      return; // Skip: exceeds the rarity level cap
    }

    let cost = 0;
    if (ownedLevel === 0) {
      cost = getPriceRawFromMarket(item.name, 1);
    } else {
      cost = getPriceRawFromMarket(item.name, targetLvl);
    }

    // Cap cost to 1.5x current power to prevent recommending unrealistic end-game upgrades (minimum baseline of 5M for early game)
    const maxAllowedCost = Math.max(player.powerRaw * 1.5, 5e6);
    if (cost > maxAllowedCost) {
      return;
    }

    let dsVal = curDs;
    let msVal = curMs;
    if (isShield) {
      msVal = scaledShieldDM(item.baseValue, targetLvl);
    } else {
      dsVal = scaledSwordDamage(item.baseValue, targetLvl) * 1e9;
    }

    const canStats = calculateDamageStats({
      ds: dsVal,
      swordDamageMultiplier: msVal,
      power: player.powerRaw,
      petPowerBonus: 0,
      armorPowerBonus: 0,
      attackSpeed: 2.77
    });

    const gain = Math.round(((canStats.damagePerSecond - currentStats.damagePerSecond) / Math.max(currentStats.damagePerSecond, 1)) * 100);

    if (gain > 0) {
      const dpsGainPct = gain;
      const refPower = Math.max(player.powerRaw, benchmark.avgPower, 1e6);
      const normalizedCost = cost / refPower;
      
      let progressionScore = dpsGainPct / (normalizedCost + 0.05);

      // Apply a level-based progression efficiency multiplier to prevent spamming high-level upgrades
      // for weapons that are below the expected tier limits.
      let efficiencyFactor = 1.0;
      if (item.rarity === "Legendary") {
        if (targetLvl > 3) {
          efficiencyFactor = Math.pow(0.65, targetLvl - 3);
        }
      } else {
        if (targetLvl > 5) {
          efficiencyFactor = Math.pow(0.45, targetLvl - 5);
        }
      }
      progressionScore *= efficiencyFactor;

      candidates.push({
        name: item.name,
        level: targetLvl,
        type: isShield ? "Shield" : "Sword",
        damageGainPct: gain,
        cost,
        priceNote: getPriceNoteFromMarket(item.name, targetLvl),
        isUpgradeCurrent: isEquipped,
        isOwnedInInventory: !isEquipped && ownedLevel > 0,
        resultingDps: canStats.damagePerSecond,
        progressionScore
      } as any);
    }
  });

  if (candidates.length === 0) {
    const fallbackGoal: UpgradeGoal = {
      name: "No worthwhile upgrade currently available.",
      level: 0,
      type: "Power",
      damageGainPct: 0,
      marketPriceNote: null,
      affordable: true,
      status: "Affordable Now",
      reason: "No worthwhile upgrade currently available."
    };
    return {
      immediate: fallbackGoal,
      longTerm: null,
      recommendations: [fallbackGoal],
      lateGameGoals: [],
      powerShortageMessage: null
    };
  }

  const affordable = candidates.filter(c => player.powerRaw >= c.cost);
  const unaffordable = candidates.filter(c => player.powerRaw < c.cost);

  let powerShortageMessage: string | null = null;
  let recommendations: UpgradeGoal[] = [];
  let lateGameGoals: UpgradeGoal[] = [];

  if (affordable.length > 0) {
    affordable.sort((a, b) => b.progressionScore - a.progressionScore);

    const uniqueSelected: Candidate[] = [];
    affordable.forEach(c => {
      if (!uniqueSelected.some(u => u.name === c.name && u.level === c.level)) {
        uniqueSelected.push(c);
      }
    });

    recommendations = uniqueSelected.slice(0, 3).map((c, index) => {
      const rankLabels = ["#1 Best Combat Upgrade", "#2 Second Best Upgrade", "#3 Third Best Upgrade"];
      const label = rankLabels[index] || `Upgrade #${index + 1}`;
      
      let reason = "";
      if (c.isUpgradeCurrent) {
        reason = `Upgrade equipped ${c.name} to Lv${c.level} for a massive +${c.damageGainPct}% DPS increase.`;
      } else if (c.isOwnedInInventory) {
        const ownedLvl = getOwnedLevel(c.name, c.type === "Shield");
        if (c.level === ownedLvl) {
          reason = `Equip ${c.name} Lv${c.level} from your inventory for a completely free +${c.damageGainPct}% DPS increase!`;
        } else {
          reason = `Retrieve ${c.name} from inventory and upgrade to Lv${c.level} (requires ${formatNumber(c.cost)} Power) for a +${c.damageGainPct}% DPS increase.`;
        }
      } else {
        reason = `Buy and upgrade ${c.name} to Lv${c.level} (requires ${formatNumber(c.cost)} Power total) for a +${c.damageGainPct}% DPS increase.`;
      }

      return {
        name: c.name,
        level: c.level,
        type: c.type,
        damageGainPct: c.damageGainPct,
        marketPriceNote: c.cost === 0 ? "Free (Owned)" : c.priceNote,
        estimatedRequirements: `Level ~${benchmark.minLevel.toLocaleString()}, Power ~${formatNumber(benchmark.avgPower)}`,
        affordable: true,
        status: "Affordable Now",
        reason: `[${label}] ${reason}`
      };
    });
  } else {
    const sortedCheapest = [...candidates].sort((a, b) => b.progressionScore - a.progressionScore);
    const cheapest = sortedCheapest[0];
    const shortage = cheapest.cost - player.powerRaw;
    powerShortageMessage = `Need ${formatNumber(shortage)} more Power`;
  }

  if (unaffordable.length > 0) {
    unaffordable.sort((a, b) => b.progressionScore - a.progressionScore);

    const uniqueLate: Candidate[] = [];
    unaffordable.forEach(c => {
      if (!uniqueLate.some(u => u.name === c.name && u.level === c.level)) {
        uniqueLate.push(c);
      }
    });

    lateGameGoals = uniqueLate.slice(0, 3).map(c => {
      const shortage = c.cost - player.powerRaw;
      let typeLabel = "";
      if (c.isUpgradeCurrent) {
        typeLabel = `Upgrading equipped ${c.name} to Lv${c.level}`;
      } else if (c.isOwnedInInventory) {
        typeLabel = `Upgrading inventory ${c.name} to Lv${c.level}`;
      } else {
        typeLabel = `Buying and upgrading ${c.name} to Lv${c.level}`;
      }

      return {
        name: c.name,
        level: c.level,
        type: c.type,
        damageGainPct: c.damageGainPct,
        marketPriceNote: c.priceNote,
        estimatedRequirements: `Level ~${benchmark.minLevel.toLocaleString()}, Power ~${formatNumber(benchmark.avgPower)}`,
        affordable: false,
        status: `Short ${formatNumber(shortage)} Power`,
        reason: `[Late Game Goal] ${typeLabel} delivers +${c.damageGainPct}% combat value but requires ${formatNumber(c.cost)} Power total.`
      };
    });
  }

  return {
    immediate: recommendations[0] || null,
    longTerm: lateGameGoals[0] || null,
    recommendations,
    lateGameGoals,
    powerShortageMessage
  };
}

function getLegacyUpgradeAdviceForGrading(player: ParsedPlayer, constants = loadGradingConstants()): UpgradeAdvice {
  const items = loadItems();
  const curSw = getSwordData(player.sword);
  const curSh = getShieldData(player.shield);
  
  const swLevel = player.swordLevel;
  const shLevel = player.shieldLevel;
  
  const benchmark = getInterpolatedBenchmark(player.level);

  // Current stats base
  const curSwStats = curSw ? getSwordStats(curSw, swLevel) : { name: "None", level: 0, damage: 0, dm: 1.0, prot: 0, hm: 0, gm: 0, score: 0 };
  const curShStats = curSh ? getShieldStats(curSh, shLevel) : { name: "None", level: 0, damage: 0, dm: 1.0, prot: 0, hm: 0, gm: 0, score: 0 };

  interface Candidate {
    name: string;
    level: number;
    type: "Sword" | "Shield";
    damageGainPct: number;
    cost: number;
    priceNote: string | null;
    isUpgradeCurrent: boolean;
    stats: GearStats;
  }

  const candidates: Candidate[] = [];

  // Evaluate Sword Candidates
  const swords = items.filter((i: any) => i.type === "sword" || (i as any).category === "sword");
  swords.forEach((sw: any) => {
    const isCurrent = curSw && sw.name.toLowerCase() === curSw.name.toLowerCase();
    const maxLvl = sw.maxLevel || 10;
    
    if (isCurrent) {
      for (let lvl = swLevel + 1; lvl <= maxLvl; lvl++) {
        const cost = getPriceRawFromMarket(sw.name, lvl);
        if (cost > 0) {
          const canStats = getSwordStats(sw, lvl);
          if (canStats.score > curSwStats.score && canStats.damage > curSwStats.damage) {
            const gain = Math.round(((canStats.score - curSwStats.score) / Math.max(curSwStats.score, 1)) * 100);
            if (gain > 0) {
              candidates.push({
                name: sw.name,
                level: lvl,
                type: "Sword",
                damageGainPct: gain,
                cost,
                priceNote: getPriceNoteFromMarket(sw.name, lvl),
                isUpgradeCurrent: true,
                stats: canStats,
              });
            }
          }
        }
      }
    } else {
      if (curSw && sw.baseValue <= curSw.baseDamage) {
        return;
      }
      
      let firstUpgradeLevel = -1;
      let totalCost = 0;
      
      for (let lvl = 1; lvl <= maxLvl; lvl++) {
        const canStats = getSwordStats(sw, lvl);
        if (canStats.score > curSwStats.score && canStats.damage > curSwStats.damage) {
          firstUpgradeLevel = lvl;
          let sumCost = 0;
          for (let l = 1; l <= lvl; l++) {
            sumCost += getPriceRawFromMarket(sw.name, l);
          }
          totalCost = sumCost;
          break;
        }
      }
      
      if (firstUpgradeLevel !== -1 && totalCost > 0) {
        const canStats = getSwordStats(sw, firstUpgradeLevel);
        const gain = Math.round(((canStats.score - curSwStats.score) / Math.max(curSwStats.score, 1)) * 100);
        if (gain > 0) {
          candidates.push({
            name: sw.name,
            level: firstUpgradeLevel,
            type: "Sword",
            damageGainPct: gain,
            cost: totalCost,
            priceNote: getPriceNoteFromMarket(sw.name, firstUpgradeLevel),
            isUpgradeCurrent: false,
            stats: canStats,
          });
        }
      }
    }
  });

  // Evaluate Shield Candidates
  const shields = items.filter((i: any) => i.type === "shield" || (i as any).category === "shield");
  shields.forEach((sh: any) => {
    const isCurrent = curSh && sh.name.toLowerCase() === curSh.name.toLowerCase();
    const maxLvl = sh.maxLevel || 10;
    
    if (isCurrent) {
      for (let lvl = shLevel + 1; lvl <= maxLvl; lvl++) {
        const cost = getPriceRawFromMarket(sh.name, lvl);
        if (cost > 0) {
          const canStats = getShieldStats(sh, lvl);
          if (canStats.score > curShStats.score && canStats.dm > curShStats.dm) {
            const gain = Math.round(((canStats.score - curShStats.score) / Math.max(curShStats.score, 1)) * 100);
            if (gain > 0) {
              candidates.push({
                name: sh.name,
                level: lvl,
                type: "Shield",
                damageGainPct: gain,
                cost,
                priceNote: getPriceNoteFromMarket(sh.name, lvl),
                isUpgradeCurrent: true,
                stats: canStats,
              });
            }
          }
        }
      }
    } else {
      if (curSh && sh.baseValue <= curSh.baseDM) {
        return;
      }
      
      let firstUpgradeLevel = -1;
      let totalCost = 0;
      
      for (let lvl = 1; lvl <= maxLvl; lvl++) {
        const canStats = getShieldStats(sh, lvl);
        if (canStats.score > curShStats.score && canStats.dm > curShStats.dm) {
          firstUpgradeLevel = lvl;
          let sumCost = 0;
          for (let l = 1; l <= lvl; l++) {
            sumCost += getPriceRawFromMarket(sh.name, l);
          }
          totalCost = sumCost;
          break;
        }
      }
      
      if (firstUpgradeLevel !== -1 && totalCost > 0) {
        const canStats = getShieldStats(sh, firstUpgradeLevel);
        const gain = Math.round(((canStats.score - curShStats.score) / Math.max(curShStats.score, 1)) * 100);
        if (gain > 0) {
          candidates.push({
            name: sh.name,
            level: firstUpgradeLevel,
            type: "Shield",
            damageGainPct: gain,
            cost: totalCost,
            priceNote: getPriceNoteFromMarket(sh.name, firstUpgradeLevel),
            isUpgradeCurrent: false,
            stats: canStats,
          });
        }
      }
    }
  });

  if (candidates.length === 0) {
    const fallbackGoal: UpgradeGoal = {
      name: "No upgrade currently recommended.",
      level: 0,
      type: "Power",
      damageGainPct: 0,
      marketPriceNote: null,
      affordable: true,
      status: "Affordable Now",
      reason: "No upgrade currently recommended. Your current equipment is the strongest available."
    };
    return {
      immediate: fallbackGoal,
      longTerm: null,
      recommendations: [fallbackGoal],
      lateGameGoals: [],
      powerShortageMessage: null
    };
  }

  const getEfficiency = (c: Candidate) => {
    const logCost = Math.log10(c.cost) > 0 ? Math.log10(c.cost) : 1;
    return c.damageGainPct / logCost;
  };

  const affordable = candidates.filter(c => player.powerRaw >= c.cost);
  const unaffordable = candidates.filter(c => player.powerRaw < c.cost);

  let powerShortageMessage: string | null = null;
  let recommendations: UpgradeGoal[] = [];
  let lateGameGoals: UpgradeGoal[] = [];

  if (affordable.length > 0) {
    affordable.sort((a, b) => getEfficiency(b) - getEfficiency(a));
    
    const uniqueSelected: Candidate[] = [];
    affordable.forEach(c => {
      if (!uniqueSelected.some(u => u.name === c.name && u.level === c.level)) {
        uniqueSelected.push(c);
      }
    });

    recommendations = uniqueSelected.slice(0, 3).map((c, index) => {
      const reason = `[Best Value] Upgrading to ${c.name} Lv${c.level} yields a solid +${c.damageGainPct}% combat value increase within your current Power limits.`;
      return {
        name: c.name,
        level: c.level,
        type: c.type,
        damageGainPct: c.damageGainPct,
        marketPriceNote: c.priceNote,
        estimatedRequirements: `Level ~${benchmark.minLevel.toLocaleString()}, Power ~${formatNumber(benchmark.avgPower)}`,
        affordable: true,
        status: "Affordable Now",
        reason
      };
    });
  } else {
    const sortedCheapest = [...candidates].sort((a, b) => a.cost - b.cost);
    const cheapest = sortedCheapest[0];
    const shortage = cheapest.cost - player.powerRaw;
    powerShortageMessage = `Need ${formatNumber(shortage)} more Power`;
  }

  if (unaffordable.length > 0) {
    unaffordable.sort((a, b) => a.cost - b.cost);
    
    const uniqueLate: Candidate[] = [];
    unaffordable.forEach(c => {
      if (!uniqueLate.some(u => u.name === c.name && u.level === c.level)) {
        uniqueLate.push(c);
      }
    });

    lateGameGoals = uniqueLate.slice(0, 3).map(c => {
      const shortage = c.cost - player.powerRaw;
      return {
        name: c.name,
        level: c.level,
        type: c.type,
        damageGainPct: c.damageGainPct,
        marketPriceNote: c.priceNote,
        estimatedRequirements: `Level ~${benchmark.minLevel.toLocaleString()}, Power ~${formatNumber(benchmark.avgPower)}`,
        affordable: false,
        status: `Short ${formatNumber(shortage)} Power`,
        reason: `[Late Game Goal] Upgrading to ${c.name} Lv${c.level} delivers +${c.damageGainPct}% combat value but requires ${formatNumber(c.cost)} Power total.`
      };
    });
  }

  return {
    immediate: recommendations[0] || null,
    longTerm: lateGameGoals[0] || null,
    recommendations,
    lateGameGoals,
    powerShortageMessage
  };
}

export function scorePlayer(player: ParsedPlayer): ScoreResult {
  const constants = loadGradingConstants();
  const benchmark = getInterpolatedBenchmark(player.level);

  // 1. Level Score
  const levelScore = getLevelScore(player.level);

  // 2. Power Score
  const powerScore = getPiecewiseScore(player.powerRaw, benchmark.weakPower, benchmark.avgPower, benchmark.strongPower, benchmark.elitePower);

  // 3. DPH, DPS, PPH, PPS
  const items = loadItems();
  const swData = getSwordData(player.sword);
  const shData = getShieldData(player.shield);
  const ds = swData ? scaledSwordDamage(swData.baseDamage, player.swordLevel) * 1e9 : 0;
  const ms = shData ? scaledShieldDM(shData.baseDM, player.shieldLevel) : 0;
  
  const activePets = (player as any).activePets || (player as any).rawPayload?.inv?.activePets || [];
  const speedBoost = 0;
  const attackSpeed = 2.77;
  const petPowerBonus = 0;

  const dmgStats = calculateDamageStats({
    ds,
    swordDamageMultiplier: ms,
    power: player.powerRaw,
    petPowerBonus: 0,
    armorPowerBonus: 0,
    attackSpeed: 2.77
  });

  const dphScore = getPiecewiseScore(dmgStats.damagePerHit, benchmark.weakDPH, benchmark.avgDPH, benchmark.strongDPH, benchmark.eliteDPH);
  const dpsScore = getPiecewiseScore(dmgStats.damagePerSecond, benchmark.weakDPS, benchmark.avgDPS, benchmark.strongDPS, benchmark.eliteDPS);
  const pphScore = getPiecewiseScore(dmgStats.powerPerHit, benchmark.weakPPH, benchmark.avgPPH, benchmark.strongPPH, benchmark.elitePPH);

  const weakPPS = benchmark.weakPPH * 2.77;
  const elitePPS = benchmark.elitePPH * 2.77;
  const ppsScore = getPiecewiseScore(dmgStats.powerPerSecond, weakPPS, benchmark.avgPPH * 2.77, benchmark.strongPPH * 2.77, elitePPS);

  // 4. Gold Score (Decoupled from log compression, uses linear ratio comparison)
  const goldRatio = benchmark.avgGold > 0 ? (player.goldRaw / benchmark.avgGold) * 100 : 100;
  const goldScore = clamp(
    Math.round(
      goldRatio >= 100
        ? 75 + Math.min((goldRatio - 100) * 0.25, 25)
        : (goldRatio / 100) * 75
    )
  );

  // 5. Protection Score
  const getProtRaw = (protStr?: string) => {
    if (!protStr || protStr === "-") return 0;
    return parseNumber(protStr);
  };
  const baseProt = swData ? getProtRaw(swData.protection) : 0;
  const baseShProt = shData ? getProtRaw(shData.protection) : 0;
  const totalBaseProt = baseProt + baseShProt;
  const protectionRaw = totalBaseProt * (1 + 0.25 * (Math.max(player.swordLevel, player.shieldLevel, 1) - 1));
  const protectionScore = getPiecewiseScore(protectionRaw, benchmark.weakProt, benchmark.avgProt, benchmark.strongProt, benchmark.eliteProt);

  // 6. Health Score
  const healthRaw = parseNumber(player.health || "0");
  const healthScore = getPiecewiseScore(healthRaw, benchmark.weakHealth, benchmark.avgHealth, benchmark.strongHealth, benchmark.eliteHealth);

  // 7. Gear specific scores (Purely stats, levels, and quality based)
  const curSwStats = swData ? getSwordStats(swData, player.swordLevel) : { name: "None", level: 0, damage: 0, dm: 1.0, prot: 0, hm: 0, gm: 0, score: 0 };
  const curShStats = shData ? getShieldStats(shData, player.shieldLevel) : { name: "None", level: 0, damage: 0, dm: 1.0, prot: 0, hm: 0, gm: 0, score: 0 };

  const allSwords = items.filter((i: any) => i.type === "sword" || (i as any).category === "sword");
  const allShields = items.filter((i: any) => i.type === "shield" || (i as any).category === "shield");

  let maxWeaponScore = 1;
  let maxShieldScore = 1;

  allSwords.forEach((sw: any) => {
    const swMaxStats = getSwordStats(sw, sw.maxLevel || 10);
    if (swMaxStats.score > maxWeaponScore) {
      maxWeaponScore = swMaxStats.score;
    }
  });

  allShields.forEach((sh: any) => {
    const shMaxStats = getShieldStats(sh, sh.maxLevel || 10);
    if (shMaxStats.score > maxShieldScore) {
      maxShieldScore = shMaxStats.score;
    }
  });

  const swordScore = swData ? clamp(Math.round((curSwStats.score / maxWeaponScore) * 100)) : 0;
  const shieldScore = shData ? clamp(Math.round((curShStats.score / maxShieldScore) * 100)) : 0;

  const petTiersSum = activePets.reduce((acc: number, p: any) => {
    const item = resolveItemByGameType(p.type, "pet");
    return acc + (item ? item.tierRank : 0);
  }, 0);
  const avgPetTierRank = activePets.length > 0 ? petTiersSum / activePets.length : 0;
  const petsScore = clamp(Math.round((avgPetTierRank / 35) * 100));

  // 8. Enchantments Score
  const hasSwordEnchant = player.swordProgress > 0 || (player as any).swordEnchantment;
  const hasShieldEnchant = player.shieldProgress > 0 || (player as any).shieldEnchantment;
  const enchantmentsScore = clamp((hasSwordEnchant ? 50 : 0) + (hasShieldEnchant ? 50 : 0));

  // 9. Net worth valuation scores
  const netWorth = calculateNetWorth(player);
  const inventoryScore = getPiecewiseScore(netWorth.equipped, benchmark.avgInventoryValue * 0.1, benchmark.avgInventoryValue, benchmark.avgInventoryValue * 5, benchmark.avgInventoryValue * 25);
  const storageScore = getPiecewiseScore(netWorth.storage, benchmark.avgStorageValue * 0.1, benchmark.avgStorageValue, benchmark.avgStorageValue * 5, benchmark.avgStorageValue * 25);

  // 10. Upgrade Advice & Potential Score
  const upgradeAdvice = getUpgradeAdvice(player, constants);
  const legacyUpgradeAdvice = getLegacyUpgradeAdviceForGrading(player, constants);
  let upgradePotentialScore = 100;
  if (legacyUpgradeAdvice.immediate && legacyUpgradeAdvice.immediate.type !== "Power") {
    upgradePotentialScore = clamp(Math.round(100 - legacyUpgradeAdvice.immediate.damageGainPct));
  }

  // 11. Quest progress score (REMOVED - SwordMasters is only the data source)
  const questsScore = 0;
  const questCount = 0;

  // Sub-grades mappings
  const subGrades = {
    level: { score: levelScore, grade: scoreToGrade(levelScore, constants), label: "Level", value: `Lv ${player.level.toLocaleString()}` },
    power: { score: powerScore, grade: scoreToGrade(powerScore, constants), label: "Power", value: player.power },
    dph: { score: dphScore, grade: scoreToGrade(dphScore, constants), label: "Damage / Hit", value: formatNumber(dmgStats.damagePerHit) },
    dps: { score: dpsScore, grade: scoreToGrade(dpsScore, constants), label: "Damage / sec", value: formatNumber(dmgStats.damagePerSecond) },
    pph: { score: pphScore, grade: scoreToGrade(pphScore, constants), label: "Power / Hit", value: formatNumber(dmgStats.powerPerHit) },
    pps: { score: ppsScore, grade: scoreToGrade(ppsScore, constants), label: "Power / sec", value: formatNumber(dmgStats.powerPerSecond) },
    gold: { score: goldScore, grade: scoreToGrade(goldScore, constants), label: "Gold Balance", value: player.gold },
    protection: { score: protectionScore, grade: scoreToGrade(protectionScore, constants), label: "Protection", value: formatNumber(protectionRaw) },
    health: { score: healthScore, grade: scoreToGrade(healthScore, constants), label: "Health Pool", value: player.health || "0" },
    sword: { score: swordScore, grade: scoreToGrade(swordScore, constants), label: "Equipped Sword", value: `${player.sword} Lv${player.swordLevel}` },
    shield: { score: shieldScore, grade: scoreToGrade(shieldScore, constants), label: "Equipped Shield", value: `${player.shield} Lv${player.shieldLevel}` },
    pets: { score: petsScore, grade: scoreToGrade(petsScore, constants), label: "Active Pets", value: `${activePets.length} Active` },
    enchantments: { score: enchantmentsScore, grade: scoreToGrade(enchantmentsScore, constants), label: "Enchantments", value: hasSwordEnchant || hasShieldEnchant ? "Enchanted" : "None" },
    inventory: { score: inventoryScore, grade: scoreToGrade(inventoryScore, constants), label: "Inventory Value", value: netWorth.equippedFormatted },
    storage: { score: storageScore, grade: scoreToGrade(storageScore, constants), label: "Vault Storage", value: netWorth.storageFormatted },
    upgradePotential: { score: upgradePotentialScore, grade: scoreToGrade(upgradePotentialScore, constants), label: "Gear Optimization", value: `${upgradePotentialScore}%` },
    quests: { score: questsScore, grade: scoreToGrade(questsScore, constants), label: "Active Quests", value: "Disabled" }
  };

  // Derive macro scores from the actual sub-grades
  const enchantBonus = (hasSwordEnchant ? 5 : 0) + (hasShieldEnchant ? 5 : 0);
  const gearScore = clamp(Math.round(swordScore * 0.45 + shieldScore * 0.45 + enchantBonus));
  const combatScore = Math.round(dphScore * 0.25 + dpsScore * 0.25 + pphScore * 0.25 + ppsScore * 0.25);
  // Recalculated without quests log dependency
  const progressScore = Math.round(levelScore * 0.50 + upgradePotentialScore * 0.50);
  const wealthScore = goldScore;

  // Hardcoded final weights mapping SMGrade official beta rules
  const powerW = 0.55;
  const gearW = 0.35;
  const progressW = 0.08;
  const wealthW = 0.02;

  // Overall index: composite representation where Power dominates
  let overallScore = clamp(
    Math.round(
      gearScore * gearW +
      powerScore * powerW +
      progressScore * progressW +
      wealthScore * wealthW
    )
  );

  const overallGrade = scoreToGrade(overallScore, constants);
  const standing = scoreStanding(player.powerRaw, benchmark);

  // Legacy slot grades for UI backward compatibility
  const slotGrades: GearSlotGrade[] = [
    {
      slotName: "Sword",
      itemName: `${player.sword} Lv${player.swordLevel}`,
      score: swordScore,
      grade: scoreToGrade(swordScore, constants),
      stat: `DS: ${formatNumber(ds)}`,
      tip: upgradeAdvice.immediate && upgradeAdvice.immediate.type === "Sword" ? {
        targetName: upgradeAdvice.immediate.name,
        targetLevel: upgradeAdvice.immediate.level,
        damageGainPct: upgradeAdvice.immediate.damageGainPct,
        marketPriceNote: upgradeAdvice.immediate.marketPriceNote,
        affordable: upgradeAdvice.immediate.affordable
      } : null
    },
    {
      slotName: "Shield",
      itemName: `${player.shield} Lv${player.shieldLevel}`,
      score: shieldScore,
      grade: scoreToGrade(shieldScore, constants),
      stat: `DM: ${ms.toFixed(1)}x`,
      tip: upgradeAdvice.immediate && upgradeAdvice.immediate.type === "Shield" ? {
        targetName: upgradeAdvice.immediate.name,
        targetLevel: upgradeAdvice.immediate.level,
        damageGainPct: upgradeAdvice.immediate.damageGainPct,
        marketPriceNote: upgradeAdvice.immediate.marketPriceNote,
        affordable: upgradeAdvice.immediate.affordable
      } : null
    },
    {
      slotName: "Power",
      itemName: player.power,
      score: powerScore,
      grade: scoreToGrade(powerScore, constants),
      stat: player.power,
      tip: null
    }
  ];

  return {
    overallScore,
    overallGrade,
    gearScore,
    powerScore,
    combatScore,
    progressScore,
    wealthScore,
    subGrades,
    standing,
    levelTier: benchmark.label,
    slotGrades,
    upgradeAdvice
  };
}
