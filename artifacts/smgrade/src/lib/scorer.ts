import {
  getBenchmarkForLevel,
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
} from "./gearDatabase";
import { getPriceNote } from "./marketPrices";
import type { ParsedPlayer } from "./parser";

export type GradeLetter = "S+" | "S" | "A+" | "A" | "B+" | "B" | "C+" | "C" | "D";

export interface UpgradeTip {
  targetName: string;
  targetLevel: number;
  damageGainPct: number;        // % estimated damage gain (negative = not worth switching yet)
  marketPriceNote: string | null;
  /** If > 0, switching only becomes worthwhile when next item reaches this level */
  switchWorthwhileAtLevel?: number;
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
}

function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, val));
}

function scoreToGrade(score: number): GradeLetter {
  if (score >= 97) return "S+";
  if (score >= 90) return "S";
  if (score >= 83) return "A+";
  if (score >= 75) return "A";
  if (score >= 67) return "B+";
  if (score >= 58) return "B";
  if (score >= 48) return "C+";
  if (score >= 38) return "C";
  return "D";
}

function scoreStanding(
  powerRaw: number,
  benchmark: ReturnType<typeof getBenchmarkForLevel>
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
  const benchmark = getBenchmarkForLevel(player.level);

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
  const benchmark = getBenchmarkForLevel(player.level);

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
function scoreWealth(player: ParsedPlayer): number {
  if (player.goldRaw <= 0) return 5;
  const benchmark = getBenchmarkForLevel(player.level);

  const logGold = Math.log10(Math.max(player.goldRaw, 1));
  const logAvg = Math.log10(Math.max(benchmark.avgGold, 1));
  const logElite = Math.log10(Math.max(benchmark.avgGold * 50, 1));
  const logWeak = Math.log10(Math.max(benchmark.avgGold * 0.01, 1));

  if (logGold >= logElite) return 100;
  if (logGold <= logWeak) return clamp(Math.round(((logGold - Math.log10(1)) / (logWeak - Math.log10(1))) * 15));

  const ratio = (logGold - logWeak) / (logElite - logWeak);
  return clamp(Math.round(15 + ratio * 85));
}

/** Per-slot grade for sword */
function gradeSword(player: ParsedPlayer): GearSlotGrade {
  const maxSwordTier = Math.max(...Object.values(SWORD_TIER));
  const tier = getSwordTier(player.sword);
  const tierScore = (tier / maxSwordTier) * 80;
  const levelBonus = Math.min(player.swordLevel * 2, 20);
  const score = clamp(Math.round(tierScore + levelBonus));
  const grade = scoreToGrade(score);

  const swordData = getSwordData(player.sword);
  const dsDisplay = swordData
    ? `DS: ${scaledSwordDamage(swordData.baseDamage, player.swordLevel).toFixed(2)}B`
    : `Lv${player.swordLevel}`;

  const nextSword = getNextSwordUpgrade(player.sword);
  let tip: UpgradeTip | null = null;
  if (nextSword) {
    const gain = swordUpgradeGain(player.sword, player.swordLevel, nextSword.name);
    if (gain > 0) {
      tip = {
        targetName: nextSword.name,
        targetLevel: 1,
        damageGainPct: gain,
        marketPriceNote: getPriceNote(nextSword.name, 1),
      };
    } else {
      // Current sword at current level beats next sword Lv1 — show when to switch
      const curData = getSwordData(player.sword);
      const nxtData = getSwordData(nextSword.name);
      if (curData && nxtData) {
        const switchAt = switchWorthwhileLevel(curData.baseDamage, player.swordLevel, nxtData.baseDamage);
        tip = {
          targetName: nextSword.name,
          targetLevel: switchAt ?? 1,
          damageGainPct: gain,
          marketPriceNote: getPriceNote(nextSword.name, switchAt ?? 1),
          switchWorthwhileAtLevel: switchAt ?? undefined,
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

/** Per-slot grade for shield */
function gradeShield(player: ParsedPlayer): GearSlotGrade {
  const maxShieldTier = Math.max(...Object.values(SHIELD_TIER));
  const tier = getShieldTier(player.shield);
  const tierScore = (tier / maxShieldTier) * 80;
  const levelBonus = Math.min(player.shieldLevel * 2, 20);
  const score = clamp(Math.round(tierScore + levelBonus));
  const grade = scoreToGrade(score);

  const shieldData = getShieldData(player.shield);
  const dmDisplay = shieldData
    ? `DM: ${scaledShieldDM(shieldData.baseDM, player.shieldLevel).toFixed(1)}x`
    : `Lv${player.shieldLevel}`;

  const nextShield = getNextShieldUpgrade(player.shield);
  let tip: UpgradeTip | null = null;
  if (nextShield) {
    const gain = shieldUpgradeGain(player.shield, player.shieldLevel, nextShield.name);
    if (gain > 0) {
      tip = {
        targetName: nextShield.name,
        targetLevel: 1,
        damageGainPct: gain,
        marketPriceNote: getPriceNote(nextShield.name, 1),
      };
    } else {
      // Current shield at current level beats next shield Lv1 — show when to switch
      const curData = getShieldData(player.shield);
      const nxtData = getShieldData(nextShield.name);
      if (curData && nxtData) {
        const switchAt = switchWorthwhileLevel(curData.baseDM, player.shieldLevel, nxtData.baseDM);
        tip = {
          targetName: nextShield.name,
          targetLevel: switchAt ?? 1,
          damageGainPct: gain,
          marketPriceNote: getPriceNote(nextShield.name, switchAt ?? 1),
          switchWorthwhileAtLevel: switchAt ?? undefined,
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
function gradePower(player: ParsedPlayer): GearSlotGrade {
  const score = scorePower(player);
  const grade = scoreToGrade(score);
  const benchmark = getBenchmarkForLevel(player.level);

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

export function scorePlayer(player: ParsedPlayer): ScoreResult {
  const benchmark = getBenchmarkForLevel(player.level);

  const gearScore = scoreGear(player);
  const powerScore = scorePower(player);
  const progressScore = scoreProgress(player);
  const wealthScore = scoreWealth(player);

  const overallScore = clamp(
    Math.round(
      gearScore * 0.30 +
        powerScore * 0.40 +
        progressScore * 0.20 +
        wealthScore * 0.10
    )
  );

  const overallGrade = scoreToGrade(overallScore);
  const standing = scoreStanding(player.powerRaw, benchmark);

  const slotGrades: GearSlotGrade[] = [
    gradeSword(player),
    gradeShield(player),
    gradePower(player),
  ];

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
  };
}
