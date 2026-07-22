export interface GradingConstants {
  goldExchangeRate: number;      // 1 Gold = X Power (default 100)
  gearWeight: number;            // weight for Gear Score (default 0.30)
  powerWeight: number;           // weight for Power Score (default 0.40)
  progressWeight: number;        // weight for Progress Score (default 0.20)
  wealthWeight: number;          // weight for Wealth Score (default 0.10)
  gradeThresholdSPlus: number;   // default 97
  gradeThresholdS: number;       // default 90
  gradeThresholdAPlus: number;   // default 83
  gradeThresholdA: number;       // default 75
  gradeThresholdBPlus: number;   // default 67
  gradeThresholdB: number;       // default 58
  gradeThresholdCPlus: number;   // default 48
  gradeThresholdC: number;       // default 38
}

export const DEFAULT_CONSTANTS: GradingConstants = {
  goldExchangeRate: 100,
  gearWeight: 0.25,
  powerWeight: 0.60,
  progressWeight: 0.10,
  wealthWeight: 0.05,
  gradeThresholdSPlus: 97,
  gradeThresholdS: 90,
  gradeThresholdAPlus: 83,
  gradeThresholdA: 75,
  gradeThresholdBPlus: 67,
  gradeThresholdB: 58,
  gradeThresholdCPlus: 48,
  gradeThresholdC: 38,
};

const STORAGE_KEY = "smg_grading_settings_v1";

let constantsOverride: GradingConstants | null = null;
export function setOverrideConstants(constants: GradingConstants | null): void {
  constantsOverride = constants;
}

export function loadGradingConstants(): GradingConstants {
  if (constantsOverride) return constantsOverride;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_CONSTANTS,
          ...parsed,
        };
      }
    }
  } catch {
    // Ignore and fallback to defaults
  }
  return { ...DEFAULT_CONSTANTS };
}

export function saveGradingConstants(constants: GradingConstants): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(constants));
    }
  } catch {
    // Ignore
  }
}
