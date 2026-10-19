import { scorePlayer } from "./lib/scorer.js";

const beginnerPlayer: any = {
  username: "beginner_test",
  level: 10,
  experience: "0",
  gold: "5,000",
  goldRaw: 5000,
  power: "10,000",
  powerRaw: 10000,
  health: "100",
  pvpKillCount: 0,
  pvpLoot: "0",
  registerDate: "",
  sword: "Old Sword",
  swordLevel: 1,
  swordProgress: 0,
  shield: "Wooden Shield",
  shieldLevel: 1,
  shieldProgress: 0,
  killedEnemies: {},
  activePets: []
};

const midGamePlayer: any = {
  username: "midgame_test",
  level: 500,
  experience: "0",
  gold: "2.5M",
  goldRaw: 2500000,
  power: "500.0M",
  powerRaw: 500000000,
  health: "10,000",
  pvpKillCount: 0,
  pvpLoot: "0",
  registerDate: "",
  sword: "Old Sword",
  swordLevel: 5,
  swordProgress: 0,
  shield: "Wooden Shield",
  shieldLevel: 5,
  shieldProgress: 0,
  killedEnemies: {},
  activePets: []
};

const kitsuneUnoptimized: any = {
  username: "kitsune12345",
  level: 71621,
  experience: "0",
  gold: "40.118QT",
  goldRaw: 40118079282784760000,
  power: "3.102SXT",
  powerRaw: 3.1020811905651253e+21,
  health: "40118079282",
  pvpKillCount: 0,
  pvpLoot: "0",
  registerDate: "",
  sword: "Last Horizon",
  swordLevel: 3,
  swordProgress: 100,
  shield: "Final Bastion",
  shieldLevel: 3,
  shieldProgress: 100,
  killedEnemies: {},
  activePets: []
};

const kitsuneOptimized: any = {
  ...kitsuneUnoptimized,
  username: "kitsune12345_opt",
  swordLevel: 5,
  shieldLevel: 5
};

const takajakisUnoptimized: any = {
  username: "Takajakis",
  level: 20948,
  experience: "0",
  gold: "160.891QT",
  goldRaw: 160891594065428380,
  power: "418.359SXT",
  powerRaw: 4.183594799151184e+20,
  health: "1608915940",
  pvpKillCount: 0,
  pvpLoot: "0",
  registerDate: "",
  sword: "Divinity Edge",
  swordLevel: 1,
  shield: "Asgardian Aegis",
  shieldLevel: 2,
  killedEnemies: {},
  activePets: []
};

const takajakisOptimized: any = {
  ...takajakisUnoptimized,
  username: "Takajakis_opt",
  swordLevel: 5,
  shieldLevel: 5
};

function runTest(player: any, title: string) {
  console.log("==================================================");
  console.log(title);
  console.log("==================================================");
  const res = scorePlayer(player);
  console.log("Overall Grade:", res.overallGrade);
  console.log("Overall Score:", res.overallScore);
  console.log("Gear Score:", res.gearScore);
  console.log("Power Score:", res.powerScore);
  console.log("Wealth Score:", res.wealthScore);
  console.log("Gear Optimization (Upgrade Potential):", res.subGrades.upgradePotential?.score);
  console.log("\nUpgrade Recommendations (Immediate):");
  res.upgradeAdvice.recommendations.forEach((rec: any, idx: number) => {
    console.log(`- Rec #${idx + 1}: ${rec.name} Lv${rec.level} (Type: ${rec.type}, Gain: ${rec.damageGainPct}%, Cost: ${rec.marketPriceNote})`);
  });
  console.log("\nLate Game Goals:");
  res.upgradeAdvice.lateGameGoals?.forEach((goal: any, idx: number) => {
    console.log(`- Goal #${idx + 1}: ${goal.name} Lv${goal.level} (Type: ${goal.type}, Gain: ${goal.damageGainPct}%, Cost: ${goal.marketPriceNote})`);
  });
  console.log("\nDiagnostics:");
  console.log(res.diagnostics);
  console.log();
}

runTest(beginnerPlayer, "BEGINNER PLAYER");
runTest(midGamePlayer, "MID-GAME PLAYER");
runTest(kitsuneUnoptimized, "KITSUNE PLAYER (UNOPTIMIZED)");
runTest(kitsuneOptimized, "KITSUNE PLAYER (FULLY OPTIMIZED)");
runTest(takajakisUnoptimized, "TAKAJAKIS PLAYER (UNOPTIMIZED)");
runTest(takajakisOptimized, "TAKAJAKIS PLAYER (FULLY OPTIMIZED)");
