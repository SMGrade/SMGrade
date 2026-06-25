import {
  getBenchmarkForLevel,
  getSwordTier,
  getShieldTier,
  SWORD_TIER,
  SHIELD_TIER,
} from "./benchmark";
import type { ParsedPlayer } from "./parser";

export type GradeLetter = "S+" | "S" | "A+" | "A" | "B+" | "B" | "C+" | "C" | "D";

export interface ScoreResult {
  overallScore: number;
  overallGrade: GradeLetter;
  gearScore: number;
  powerScore: number;
  progressScore: number;
  wealthScore: number;
  standing: "Elite" | "Above Average" | "Average" | "Below Average" | "Weak";
  levelTier: string;
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

  // Base tier score (0-80 points)
  const swordBaseScore = (swordTier / maxSwordTier) * 40;
  const shieldBaseScore = (shieldTier / maxShieldTier) * 40;

  // Upgrade level bonus (0-20 points) — higher level upgrades = better
  const swordLevelBonus = Math.min(player.swordLevel * 2, 10);
  const shieldLevelBonus = Math.min(player.shieldLevel * 2, 10);

  const raw = swordBaseScore + shieldBaseScore + swordLevelBonus + shieldLevelBonus;
  return clamp(Math.round(raw));
}

/** Score power relative to peers 0–100 */
function scorePower(player: ParsedPlayer): number {
  if (player.powerRaw <= 0) return 0;
  const benchmark = getBenchmarkForLevel(player.level);

  // Log-scale comparison against benchmark tiers
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

  // Gear is at or above expected tier
  const swordPct = maxExpectedSword > 0 ? clamp((swordTier / maxExpectedSword) * 100) : 100;
  const shieldPct = maxExpectedShield > 0 ? clamp((shieldTier / maxExpectedShield) * 100) : 100;

  // Power contribution
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

export function scorePlayer(player: ParsedPlayer): ScoreResult {
  const benchmark = getBenchmarkForLevel(player.level);

  const gearScore = scoreGear(player);
  const powerScore = scorePower(player);
  const progressScore = scoreProgress(player);
  const wealthScore = scoreWealth(player);

  // Weighted overall: power matters most, then gear, then progress, then wealth
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

  return {
    overallScore,
    overallGrade,
    gearScore,
    powerScore,
    progressScore,
    wealthScore,
    standing,
    levelTier: benchmark.label,
  };
}
