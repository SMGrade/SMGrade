import {
  getBenchmarkForLevel,
  getInterpolatedBenchmark,
  getSwordTier,
  getShieldTier,
  SWORD_TIER,
  SHIELD_TIER,
} from "./benchmark";
import {
  getSwordData,
  getShieldData,
  getNextSwordUpgrade,
  getNextShieldUpgrade,
  scaledSwordDamage,
  scaledShieldDM,
  swordUpgradeGain,
  shieldUpgradeGain,
  switchWorthwhileLevel,
  SWORDS,
  SHIELDS,
} from "./gearDatabase";
import { getPriceNote, getPriceRaw } from "./marketPrices";
import { formatNumber } from "./numberParser";
import type { ParsedPlayer } from "./parser";
import { loadGradingConstants, type GradingConstants } from "./settings";

export type GradeLetter = "S+" | "S" | "A+" | "A" | "B+" | "B" | "C+" | "C" | "D";

export interface UpgradeGoal {
  name: string;
  level: number;
  type: "Sword" | "Shield" | "Power";
  damageGainPct: number;
  marketPriceNote: string | null;
  estimatedRequirements?: string;
  affordable: boolean;
  reason: string;
}

export interface UpgradeAdvice {
  immediate: UpgradeGoal | null;
  longTerm: UpgradeGoal | null;
}

export interface UpgradeTip {
  targetName: string;
  targetLevel: number;
  damageGainPct: number;        // % estimated damage gain (negative = not worth switching yet)
  marketPriceNote: string | null;
  /** If > 0, switching only becomes worthwhile when next item reaches this level */
  switchWorthwhileAtLevel?: number;
  /** False when the item cost far exceeds the player's gold */
  affordable: boolean;
}

export interface GearSlotGrade {
  slotName: string;             // "Sword" | "Shield" | "Power"
  itemName: string;             // e.g. "Solbrand Lv7"
  score: number;                // 0–100
  grade: GradeLetter;
  stat: string;                 // Display stat (e.g. "DS: 5.0B" or "9.95QT")
  tip: UpgradeTip | null;       // null = already optimal or no upgrade known
}

export interface ScoreResult {
  overallScore: number;
  overallGrade: GradeLetter;
  gearScore: number;
  powerScore: number;
  progressScore: number;
  wealthScore: number;
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
  benchmark: ReturnType<typeof getInterpolatedBenchmark>
): ScoreResult["standing"] {
  if (powerRaw >= benchmark.elitePower) return "Elite";
  if (powerRaw >= benchmark.strongPower) return "Above Average";
  if (powerRaw >= benchmark.avgPower) return "Average";
  if (powerRaw >= benchmark.weakPower) return "Below Average";
  return "Weak";
}

/** Score gear (sword + shield) 0–100 */
function scoreGear(player: ParsedPlayer): number {
  const maxSwordTier = Math.max(...Object.values(SWORD_TIER));
  const maxShieldTier = Math.max(...Object.values(SHIELD_TIER));

  const swordTier = getSwordTier(player.sword);
  const shieldTier = getShieldTier(player.shield);

  const swordBaseScore = (swordTier / maxSwordTier) * 40;
  const shieldBaseScore = (shieldTier / maxShieldTier) * 40;

  const swordLevelBonus = Math.min(player.swordLevel * 2, 10);
  const shieldLevelBonus = Math.min(player.shieldLevel * 2, 10);

  const raw = swordBaseScore + shieldBaseScore + swordLevelBonus + shieldLevelBonus;
  return clamp(Math.round(raw));
}

/** Score power relative to peers 0–100 */
function scorePower(player: ParsedPlayer): number {
  if (player.powerRaw <= 0) return 0;
  const benchmark = getInterpolatedBenchmark(player.level);

  const logPower = Math.log10(Math.max(player.powerRaw, 1));
  const logWeak = Math.log10(Math.max(benchmark.weakPower, 1));
  const logElite = Math.log10(Math.max(benchmark.elitePower, 1));

  if (logPower >= logElite) return 100;
  if (logPower <= logWeak) return clamp(Math.round(((logPower - Math.log10(1)) / (logWeak - Math.log10(1))) * 20));

  const ratio = (logPower - logWeak) / (logElite - logWeak);
  return clamp(Math.round(20 + ratio * 80));
}

/** Score overall progression (gear vs level expectations) 0–100 */
function scoreProgress(player: ParsedPlayer): number {
  const benchmark = getInterpolatedBenchmark(player.level);

  const swordTier = getSwordTier(player.sword);
  const shieldTier = getShieldTier(player.shield);

  const maxExpectedSword = Math.max(...benchmark.topSwords.map(getSwordTier));
  const maxExpectedShield = Math.max(...benchmark.topShields.map(getShieldTier));

  const swordPct = maxExpectedSword > 0 ? clamp((swordTier / maxExpectedSword) * 100) : 100;
  const shieldPct = maxExpectedShield > 0 ? clamp((shieldTier / maxExpectedShield) * 100) : 100;

  const powerPct = scorePower(player);

  return clamp(Math.round(swordPct * 0.35 + shieldPct * 0.35 + powerPct * 0.30));
}

/** Score wealth (gold relative to peers) 0–100 */
function scoreWealth(player: ParsedPlayer, constants = loadGradingConstants()): number {
  if (player.goldRaw <= 0) return 5;
  const benchmark = getInterpolatedBenchmark(player.level);

  const goldInPower = player.goldRaw * constants.goldExchangeRate;
  const avgGoldInPower = benchmark.avgGold;

  const logGold = Math.log10(Math.max(goldInPower, 1));
  const logAvg = Math.log10(Math.max(avgGoldInPower, 1));
  const logElite = Math.log10(Math.max(avgGoldInPower * 50, 1));
  const logWeak = Math.log10(Math.max(avgGoldInPower * 0.01, 1));

  if (logGold >= logElite) return 100;
  if (logGold <= logWeak) return clamp(Math.round(((logGold - Math.log10(1)) / (logWeak - Math.log10(1))) * 15));

  const ratio = (logGold - logWeak) / (logElite - logWeak);
  return clamp(Math.round(15 + ratio * 85));
}

function gradeSword(player: ParsedPlayer, constants = loadGradingConstants()): GearSlotGrade {
  const maxSwordTier = Math.max(...Object.values(SWORD_TIER));
  const tier = getSwordTier(player.sword);
  const tierScore = (tier / maxSwordTier) * 80;
  const levelBonus = Math.min(player.swordLevel * 2, 20);
  const score = clamp(Math.round(tierScore + levelBonus));
  const grade = scoreToGrade(score, constants);

  const swordData = getSwordData(player.sword);
  const dsDisplay = swordData
    ? `DS: ${scaledSwordDamage(swordData.baseDamage, player.swordLevel).toFixed(2)}B`
    : `Lv${player.swordLevel}`;

  const nextSword = getNextSwordUpgrade(player.sword);
  let tip: UpgradeTip | null = null;
  if (nextSword) {
    const gain = swordUpgradeGain(player.sword, player.swordLevel, nextSword.name);
    if (gain > 0) {
      const priceRaw = getPriceRaw(nextSword.name, 1);
      tip = {
        targetName: nextSword.name,
        targetLevel: 1,
        damageGainPct: gain,
        marketPriceNote: getPriceNote(nextSword.name, 1),
        affordable: priceRaw === 0 || priceRaw <= player.goldRaw * constants.goldExchangeRate * 3,
      };
    } else {
      // Current sword at current level beats next sword Lv1 — show when to switch
      const curData = getSwordData(player.sword);
      const nxtData = getSwordData(nextSword.name);
      if (curData && nxtData) {
        const switchAt = switchWorthwhileLevel(curData.baseDamage, player.swordLevel, nxtData.baseDamage);
        const targetLvl = switchAt ?? 1;
        const priceRaw = getPriceRaw(nextSword.name, targetLvl);
        tip = {
          targetName: nextSword.name,
          targetLevel: targetLvl,
          damageGainPct: gain,
          marketPriceNote: getPriceNote(nextSword.name, targetLvl),
          switchWorthwhileAtLevel: switchAt ?? undefined,
          affordable: priceRaw === 0 || priceRaw <= player.goldRaw * constants.goldExchangeRate * 3,
        };
      }
    }
  }

  return {
    slotName: "Sword",
    itemName: `${player.sword} Lv${player.swordLevel}`,
    score,
    grade,
    stat: dsDisplay,
    tip,
  };
}

function gradeShield(player: ParsedPlayer, constants = loadGradingConstants()): GearSlotGrade {
  const maxShieldTier = Math.max(...Object.values(SHIELD_TIER));
  const tier = getShieldTier(player.shield);
  const tierScore = (tier / maxShieldTier) * 80;
  const levelBonus = Math.min(player.shieldLevel * 2, 20);
  const score = clamp(Math.round(tierScore + levelBonus));
  const grade = scoreToGrade(score, constants);

  const shieldData = getShieldData(player.shield);
  const dmDisplay = shieldData
    ? `DM: ${scaledShieldDM(shieldData.baseDM, player.shieldLevel).toFixed(1)}x`
    : `Lv${player.shieldLevel}`;

  const nextShield = getNextShieldUpgrade(player.shield);
  let tip: UpgradeTip | null = null;
  if (nextShield) {
    const gain = shieldUpgradeGain(player.shield, player.shieldLevel, nextShield.name);
    if (gain > 0) {
      const priceRaw = getPriceRaw(nextShield.name, 1);
      tip = {
        targetName: nextShield.name,
        targetLevel: 1,
        damageGainPct: gain,
        marketPriceNote: getPriceNote(nextShield.name, 1),
        affordable: priceRaw === 0 || priceRaw <= player.goldRaw * constants.goldExchangeRate * 3,
      };
    } else {
      // Current shield at current level beats next shield Lv1 — show when to switch
      const curData = getShieldData(player.shield);
      const nxtData = getShieldData(nextShield.name);
      if (curData && nxtData) {
        const switchAt = switchWorthwhileLevel(curData.baseDM, player.shieldLevel, nxtData.baseDM);
        const targetLvl = switchAt ?? 1;
        const priceRaw = getPriceRaw(nextShield.name, targetLvl);
        tip = {
          targetName: nextShield.name,
          targetLevel: targetLvl,
          damageGainPct: gain,
          marketPriceNote: getPriceNote(nextShield.name, targetLvl),
          switchWorthwhileAtLevel: switchAt ?? undefined,
          affordable: priceRaw === 0 || priceRaw <= player.goldRaw * constants.goldExchangeRate * 3,
        };
      }
    }
  }

  return {
    slotName: "Shield",
    itemName: `${player.shield} Lv${player.shieldLevel}`,
    score,
    grade,
    stat: dmDisplay,
    tip,
  };
}

/** Per-slot grade for power */
function gradePower(player: ParsedPlayer, constants = loadGradingConstants()): GearSlotGrade {
  const score = scorePower(player);
  const grade = scoreToGrade(score, constants);
  const benchmark = getInterpolatedBenchmark(player.level);

  let tip: UpgradeTip | null = null;
  if (score < 90) {
    const logCurrent = Math.log10(Math.max(player.powerRaw, 1));
    const logTarget = Math.log10(Math.max(benchmark.strongPower, 1));
    const gainPct = logTarget > logCurrent
      ? Math.round((Math.pow(10, logTarget - logCurrent) - 1) * 100)
      : 0;
    tip = {
      targetName: `${benchmark.label} avg power`,
      targetLevel: 0,
      damageGainPct: Math.min(gainPct, 999),
      marketPriceNote: "Grind PvP or buy power from market",
      affordable: true,
    };
  }

  return {
    slotName: "Power",
    itemName: player.power,
    score,
    grade,
    stat: player.power,
    tip,
  };
}

function getUpgradeAdvice(player: ParsedPlayer, constants = loadGradingConstants()): UpgradeAdvice {
  const curSw = getSwordData(player.sword);
  const curSh = getShieldData(player.shield);
  
  const swLevel = player.swordLevel;
  const shLevel = player.shieldLevel;
  
  const goldBudgetInPower = player.goldRaw * constants.goldExchangeRate * 3;
  const benchmark = getInterpolatedBenchmark(player.level);

  const swordLadder = [...SWORDS].sort((a, b) => a.tierRank - b.tierRank);
  const shieldLadder = [...SHIELDS].sort((a, b) => a.tierRank - b.tierRank);

  const swIdx = curSw ? swordLadder.findIndex(s => s.name === curSw.name) : -1;
  const shIdx = curSh ? shieldLadder.findIndex(s => s.name === curSh.name) : -1;

  let swordGoal: UpgradeGoal | null = null;
  let shieldGoal: UpgradeGoal | null = null;

  // 1. Calculate Smart Sword Upgrade
  const curBaseSw = curSw ? curSw.baseDamage : 1.0;
  const curDSSw = scaledSwordDamage(curBaseSw, swLevel);
  const skippedSwords: string[] = [];
  let foundSw = false;

  for (let i = swIdx + 1; i < swordLadder.length; i++) {
    const nextSw = swordLadder[i];
    let targetLvl = -1;
    for (let lvl = 1; lvl <= 10; lvl++) {
      if (scaledSwordDamage(nextSw.baseDamage, lvl) > curDSSw) {
        targetLvl = lvl;
        break;
      }
    }

    if (targetLvl === -1) {
      skippedSwords.push(nextSw.name);
      continue;
    }

    foundSw = true;
    const nextDS = scaledSwordDamage(nextSw.baseDamage, targetLvl);
    const gain = Math.round(((nextDS - curDSSw) / curDSSw) * 100);
    const cost = getPriceRaw(nextSw.name, targetLvl);
    const priceNote = getPriceNote(nextSw.name, targetLvl);
    const isAffordable = cost <= goldBudgetInPower;

    let reason = "";
    if (targetLvl > 1) {
      reason = `Keep your current gear. Switch only when ${nextSw.name} reaches Lv${targetLvl}.`;
    } else {
      reason = `Transitioning to ${nextSw.name} Lv1 provides ${gain}% more base damage and is a direct upgrade.`;
    }

    if (skippedSwords.length > 0) {
      reason += ` Skipped intermediate weapon(s) (${skippedSwords.join(", ")}) because they cannot outperform your current weapon.`;
    }

    swordGoal = {
      name: nextSw.name,
      level: targetLvl,
      type: "Sword",
      damageGainPct: gain,
      marketPriceNote: priceNote,
      affordable: isAffordable,
      estimatedRequirements: `Level ~${benchmark.minLevel.toLocaleString()}, Power ~${formatNumber(benchmark.avgPower)}`,
      reason: reason
    };
    break;
  }

  if (!foundSw && curSw && swLevel < 10) {
    const nextDS = scaledSwordDamage(curSw.baseDamage, swLevel + 1);
    const gain = Math.round(((nextDS - curDSSw) / curDSSw) * 100);
    const cost = getPriceRaw(curSw.name, swLevel + 1);
    swordGoal = {
      name: curSw.name,
      level: swLevel + 1,
      type: "Sword",
      damageGainPct: gain,
      marketPriceNote: getPriceNote(curSw.name, swLevel + 1),
      affordable: cost <= goldBudgetInPower,
      reason: `Upgrading your current ${curSw.name} to Level ${swLevel + 1} is the most optimal path to increase base weapon damage.`
    };
  }

  // 2. Calculate Smart Shield Upgrade
  const curBaseSh = curSh ? curSh.baseDM : 5.0;
  const curDMSh = scaledShieldDM(curBaseSh, shLevel);
  const skippedShields: string[] = [];
  let foundSh = false;

  for (let i = shIdx + 1; i < shieldLadder.length; i++) {
    const nextSh = shieldLadder[i];
    let targetLvl = -1;
    for (let lvl = 1; lvl <= 10; lvl++) {
      if (scaledShieldDM(nextSh.baseDM, lvl) > curDMSh) {
        targetLvl = lvl;
        break;
      }
    }

    if (targetLvl === -1) {
      skippedShields.push(nextSh.name);
      continue;
    }

    foundSh = true;
    const nextDM = scaledShieldDM(nextSh.baseDM, targetLvl);
    const gain = Math.round(((nextDM - curDMSh) / curDMSh) * 100);
    const cost = getPriceRaw(nextSh.name, targetLvl);
    const priceNote = getPriceNote(nextSh.name, targetLvl);
    const isAffordable = cost <= goldBudgetInPower;

    let reason = "";
    if (targetLvl > 1) {
      reason = `Keep your current gear. Switch only when ${nextSh.name} reaches Lv${targetLvl}.`;
    } else {
      reason = `Transitioning to ${nextSh.name} Lv1 provides a ${gain}% boost to your damage multiplier and is a direct upgrade.`;
    }

    if (skippedShields.length > 0) {
      reason += ` Skipped intermediate shield(s) (${skippedShields.join(", ")}) because they cannot outperform your current shield.`;
    }

    shieldGoal = {
      name: nextSh.name,
      level: targetLvl,
      type: "Shield",
      damageGainPct: gain,
      marketPriceNote: priceNote,
      affordable: isAffordable,
      estimatedRequirements: `Level ~${benchmark.minLevel.toLocaleString()}, Power ~${formatNumber(benchmark.avgPower)}`,
      reason: reason
    };
    break;
  }

  if (!foundSh && curSh && shLevel < 10) {
    const nextDM = scaledShieldDM(curSh.baseDM, shLevel + 1);
    const gain = Math.round(((nextDM - curDMSh) / curDMSh) * 100);
    const cost = getPriceRaw(curSh.name, shLevel + 1);
    shieldGoal = {
      name: curSh.name,
      level: shLevel + 1,
      type: "Shield",
      damageGainPct: gain,
      marketPriceNote: getPriceNote(curSh.name, shLevel + 1),
      affordable: cost <= goldBudgetInPower,
      reason: `Upgrading your current ${curSh.name} to Level ${shLevel + 1} is the most optimal path to increase your damage multiplier.`
    };
  }

  // 3. Coordinate Immediate and Long-Term Goals
  let immediate: UpgradeGoal | null = null;
  let longTerm: UpgradeGoal | null = null;

  if (swordGoal && shieldGoal) {
    if (swordGoal.affordable && shieldGoal.affordable) {
      if (shieldGoal.damageGainPct >= swordGoal.damageGainPct - 5) {
        immediate = shieldGoal;
        longTerm = swordGoal;
      } else {
        immediate = swordGoal;
        longTerm = shieldGoal;
      }
    } else if (swordGoal.affordable && !shieldGoal.affordable) {
      immediate = swordGoal;
      longTerm = shieldGoal;
    } else if (!swordGoal.affordable && shieldGoal.affordable) {
      immediate = shieldGoal;
      longTerm = swordGoal;
    } else {
      immediate = {
        name: "Farming & Power Grind",
        level: 0,
        type: "Power",
        damageGainPct: 0,
        marketPriceNote: null,
        affordable: true,
        reason: "Your next gear upgrades are currently out of your budget. Focus on grinding gold, level, and power first."
      };
      const costSw = swordGoal.marketPriceNote ? getPriceRaw(swordGoal.name, swordGoal.level) : Infinity;
      const costSh = shieldGoal.marketPriceNote ? getPriceRaw(shieldGoal.name, shieldGoal.level) : Infinity;
      longTerm = costSh <= costSw ? shieldGoal : swordGoal;
    }
  } else if (swordGoal) {
    if (swordGoal.affordable) {
      immediate = swordGoal;
    } else {
      immediate = {
        name: "Farming & Power Grind",
        level: 0,
        type: "Power",
        damageGainPct: 0,
        marketPriceNote: null,
        affordable: true,
        reason: "Your next weapon upgrade is out of budget. Focus on grinding gold, level, and power first."
      };
      longTerm = swordGoal;
    }
  } else if (shieldGoal) {
    if (shieldGoal.affordable) {
      immediate = shieldGoal;
    } else {
      immediate = {
        name: "Farming & Power Grind",
        level: 0,
        type: "Power",
        damageGainPct: 0,
        marketPriceNote: null,
        affordable: true,
        reason: "Your next shield upgrade is out of budget. Focus on grinding gold, level, and power first."
      };
      longTerm = shieldGoal;
    }
  }

  if (!immediate) {
    immediate = {
      name: "Farming & Power Grind",
      level: 0,
      type: "Power",
      damageGainPct: 0,
      marketPriceNote: null,
      affordable: true,
      reason: "Your gear is already optimized for this stage. Focus on grinding gold, level, and power."
    };
  }

  if (!longTerm) {
    longTerm = {
      name: "Final Bastion",
      level: 10,
      type: "Shield",
      damageGainPct: 100,
      marketPriceNote: "~2SXT",
      affordable: false,
      estimatedRequirements: `Level ~80,000, Power ~50SXT`,
      reason: "Endgame goal for ultimate stats scaling."
    };
  }

  return { immediate, longTerm };
}

export function scorePlayer(player: ParsedPlayer): ScoreResult {
  const constants = loadGradingConstants();
  const benchmark = getInterpolatedBenchmark(player.level);

  const gearScore = scoreGear(player);
  const powerScore = scorePower(player);
  const progressScore = scoreProgress(player);
  const wealthScore = scoreWealth(player, constants);

  const overallScore = clamp(
    Math.round(
      gearScore * constants.gearWeight +
        powerScore * constants.powerWeight +
        progressScore * constants.progressWeight +
        wealthScore * constants.wealthWeight
    )
  );

  const overallGrade = scoreToGrade(overallScore, constants);
  const standing = scoreStanding(player.powerRaw, benchmark);

  const slotGrades: GearSlotGrade[] = [
    gradeSword(player, constants),
    gradeShield(player, constants),
    gradePower(player, constants),
  ];

  const upgradeAdvice = getUpgradeAdvice(player, constants);

  return {
    overallScore,
    overallGrade,
    gearScore,
    powerScore,
    progressScore,
    wealthScore,
    standing,
    levelTier: benchmark.label,
    slotGrades,
    upgradeAdvice,
  };
}
