import type { ScoreResult } from "./scorer";
import type { ParsedPlayer } from "./parser";
import { resolveItemByGameType } from "./gearDatabase";

const GRADE_COLOR: Record<string, string> = {
  "S+": "#ffd700",
  S: "#ffd700",
  "A+": "#c9a84c",
  A: "#c9a84c",
  "B+": "#8ab4c9",
  B: "#8ab4c9",
  "C+": "#888888",
  C: "#888888",
  D: "#e05a5a",
  F: "#e05a5a",
};

const GRADE_TITLE: Record<string, string> = {
  "S+": "GOD TIER OVERSEER",
  S: "MASTER GRANDER",
  "A+": "ELITE VETERAN",
  A: "EXPERT CHALLENGER",
  "B+": "ADVANCED SOLDIER",
  B: "CAPABLE WARRIOR",
  "C+": "MID-GAME FARMER",
  C: "STEADY PROGRESSOR",
  D: "BEGINNER RECRUIT",
  F: "NOVICE SLAYER",
};

// Asymmetrical cut corner style signature of the website: rounded-tl-2xl rounded-br-2xl
function roundRectCut(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w, y); // sharp top-right
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); // rounded bottom-right
  ctx.lineTo(x, y + h); // sharp bottom-left
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r); // rounded top-left
  ctx.closePath();
}

function formatNumber(n: number): string {
  if (n >= 1e27) return (n / 1e27).toFixed(1) + " OCT";
  if (n >= 1e24) return (n / 1e24).toFixed(1) + " SEP";
  if (n >= 1e21) return (n / 1e21).toFixed(1) + " SXT";
  if (n >= 1e18) return (n / 1e18).toFixed(1) + " QNT";
  if (n >= 1e15) return (n / 1e15).toFixed(1) + " QT";
  if (n >= 1e12) return (n / 1e12).toFixed(1) + " T";
  if (n >= 1e9) return (n / 1e9).toFixed(1) + " B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + " M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + " K";
  return n.toLocaleString();
}

export function generateShareCard(
  player: ParsedPlayer,
  scores: ScoreResult
): HTMLCanvasElement {
  const W = 960;
  const H = 540;

  const canvas = document.createElement("canvas");
  canvas.width = W * 2; // retina support
  canvas.height = H * 2;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;

  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);

  const gradeColor = GRADE_COLOR[scores.overallGrade] ?? "#888";

  // 1. Deep obsidian gradient background matching site variables
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, "#03050b");
  bgGrad.addColorStop(0.5, "#060914");
  bgGrad.addColorStop(1, "#020308");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle tech grid lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.007)";
  ctx.lineWidth = 1;
  for (let i = 0; i < W; i += 30) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, H);
    ctx.stroke();
  }
  for (let j = 0; j < H; j += 30) {
    ctx.beginPath();
    ctx.moveTo(0, j);
    ctx.lineTo(W, j);
    ctx.stroke();
  }

  // 2. LEFT PANEL: OVERVIEW DOSSIER
  const leftX = 36;
  const leftY = 72;
  const leftW = 400;
  const leftH = 412;

  // Grade spotlight radial backdrop glow
  const ringX = leftX + leftW / 2;
  const ringY = leftY + 185;
  const r = 70;

  const spotlight = ctx.createRadialGradient(ringX, ringY, 5, ringX, ringY, 150);
  spotlight.addColorStop(0, `${gradeColor}22`);
  spotlight.addColorStop(1, "transparent");
  ctx.fillStyle = spotlight;
  ctx.beginPath();
  ctx.arc(ringX, ringY, 150, 0, Math.PI * 2);
  ctx.fill();

  // Glassmorphic left frame (asymmetrical corner cut)
  const leftGrad = ctx.createLinearGradient(leftX, leftY, leftX, leftY + leftH);
  leftGrad.addColorStop(0, "rgba(10, 15, 30, 0.7)");
  leftGrad.addColorStop(1, "rgba(3, 5, 11, 0.95)");
  ctx.fillStyle = leftGrad;
  roundRectCut(ctx, leftX, leftY, leftW, leftH, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
  roundRectCut(ctx, leftX, leftY, leftW, leftH, 16);
  ctx.stroke();

  // Profile Header
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 24px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(player.username, leftX + leftW / 2, leftY + 44);

  ctx.fillStyle = gradeColor;
  ctx.font = "900 9px monospace";
  ctx.fillText(`${GRADE_TITLE[scores.overallGrade] || "RANKED CHALLENGER"}`, leftX + leftW / 2, leftY + 64);

  // Concentric technical scanner ring
  ctx.strokeStyle = `${gradeColor}15`;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.arc(ringX, ringY, r + 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Solid middle ring with glow
  ctx.shadowColor = gradeColor;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = `${gradeColor}50`;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(ringX, ringY, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0; // reset

  // Technical ticks
  ctx.strokeStyle = `${gradeColor}40`;
  ctx.lineWidth = 1.5;
  for (let angle = 0; angle < 360; angle += 45) {
    const rad = (angle * Math.PI) / 180;
    const startX = ringX + Math.cos(rad) * (r + 3);
    const startY = ringY + Math.sin(rad) * (r + 3);
    const endX = ringX + Math.cos(rad) * (r + 8);
    const endY = ringY + Math.sin(rad) * (r + 8);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }

  // Large centerpiece Grade
  ctx.shadowColor = gradeColor;
  ctx.shadowBlur = 24;
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 82px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(scores.overallGrade, ringX, ringY - 2);
  ctx.textBaseline = "alphabetic"; // reset
  ctx.shadowBlur = 0;

  // Rating percentage ratio
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.font = "bold 9px monospace";
  ctx.fillText(`OVERALL RATIO: ${scores.overallScore}%`, ringX, ringY + 54);

  // Left card bottom stats panel (asymmetrical corner cut)
  const statsY = leftY + 295;
  const statsW = leftW - 48;
  const statsH = 92;
  const statsX = leftX + 24;

  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  roundRectCut(ctx, statsX, statsY, statsW, statsH, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
  roundRectCut(ctx, statsX, statsY, statsW, statsH, 8);
  ctx.stroke();

  ctx.textAlign = "left";

  // Power
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.font = "900 8px monospace";
  ctx.fillText("POWER INDEX", statsX + 20, statsY + 28);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 16px system-ui, -apple-system, sans-serif";
  ctx.fillText(formatNumber(player.powerRaw), statsX + 20, statsY + 48);
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.font = "bold 8px system-ui, -apple-system, sans-serif";
  ctx.fillText(`Lv. ${player.level.toLocaleString()}`, statsX + 20, statsY + 62);

  // Gold
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.font = "900 8px monospace";
  ctx.fillText("GOLD RESERVES", statsX + statsW / 2 + 10, statsY + 28);
  ctx.fillStyle = "#5ecb7a";
  ctx.font = "900 16px system-ui, -apple-system, sans-serif";
  ctx.fillText(formatNumber(player.goldRaw), statsX + statsW / 2 + 10, statsY + 48);
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.font = "bold 8px system-ui, -apple-system, sans-serif";
  ctx.fillText("COIN RESERVOIR", statsX + statsW / 2 + 10, statsY + 62);

  // 3. RIGHT PANEL: DETAILS GRID & LOADOUT
  const rightX = 460;
  const rightY = 72;
  const rightW = 464;
  const rightH = 412;

  // Glassmorphic right frame (asymmetrical corner cut)
  const rightGrad = ctx.createLinearGradient(rightX, rightY, rightX, rightY + rightH);
  rightGrad.addColorStop(0, "rgba(10, 15, 30, 0.7)");
  rightGrad.addColorStop(1, "rgba(3, 5, 11, 0.95)");
  ctx.fillStyle = rightGrad;
  roundRectCut(ctx, rightX, rightY, rightW, rightH, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
  roundRectCut(ctx, rightX, rightY, rightW, rightH, 16);
  ctx.stroke();

  // Header
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 11px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("COMPONENT ANALYSIS BREAKDOWN", rightX + 24, rightY + 30);

  // 2x2 Grid of Ratings Cards (asymmetrical corner cuts)
  const metricsList = [
    { label: "POWER SCORE", score: scores.powerScore, color: "#8ab4c9" },
    { label: "GEAR SCORE", score: scores.gearScore, color: "#c9a84c" },
    { label: "PROGRESSION SCORE", score: scores.progressScore, color: "#b89fce" },
    { label: "WEALTH SCORE", score: scores.wealthScore, color: "#5ecb7a" }
  ];

  const gridStartX = rightX + 24;
  const gridStartY = rightY + 46;
  const cardW = 196;
  const cardH = 68;

  const getScoreLetter = (s: number) => {
    if (s >= 95) return "S+";
    if (s >= 90) return "S";
    if (s >= 83) return "A+";
    if (s >= 75) return "A";
    if (s >= 67) return "B+";
    if (s >= 58) return "B";
    if (s >= 48) return "C+";
    if (s >= 38) return "C";
    return "D";
  };

  metricsList.forEach((m, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = gridStartX + col * (cardW + 24);
    const cy = gridStartY + row * (cardH + 16);

    // Card background
    ctx.fillStyle = "rgba(255, 255, 255, 0.015)";
    roundRectCut(ctx, cx, cy, cardW, cardH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    roundRectCut(ctx, cx, cy, cardW, cardH, 8);
    ctx.stroke();

    // Metric title
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.font = "900 7px monospace";
    ctx.fillText(m.label, cx + 12, cy + 18);

    // Score Value
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 16px system-ui, -apple-system, sans-serif";
    ctx.fillText(`${m.score}%`, cx + 12, cy + 38);

    // Grade badge
    const badgeLetter = getScoreLetter(m.score);
    const badgeColor = m.color;

    ctx.textAlign = "right";
    ctx.fillStyle = `${badgeColor}15`;
    roundRectCut(ctx, cx + cardW - 42, cy + 14, 30, 16, 4);
    ctx.fill();
    ctx.strokeStyle = `${badgeColor}35`;
    roundRectCut(ctx, cx + cardW - 42, cy + 14, 30, 16, 4);
    ctx.stroke();

    ctx.fillStyle = badgeColor;
    ctx.font = "900 9px system-ui, -apple-system, sans-serif";
    ctx.fillText(badgeLetter, cx + cardW - 27, cy + 25);
    ctx.textAlign = "left";

    // Glowing bottom status bar
    ctx.fillStyle = badgeColor;
    ctx.shadowColor = badgeColor;
    ctx.shadowBlur = 4;
    roundRectCut(ctx, cx + 12, cy + 50, (cardW - 24) * (m.score / 100), 3, 1.5);
    ctx.fill();
    ctx.shadowBlur = 0; // reset
  });

  // Separation Divider
  ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
  ctx.beginPath();
  ctx.moveTo(rightX + 24, rightY + 218);
  ctx.lineTo(rightX + rightW - 24, rightY + 218);
  ctx.stroke();

  // Loadout Section (asymmetrical corner cut)
  const loadoutY = rightY + 234;
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 11px system-ui, -apple-system, sans-serif";
  ctx.fillText("ACTIVE ARMAMENTS & COMPANIONS", rightX + 24, loadoutY + 16);

  // Sword
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.font = "900 8px monospace";
  ctx.fillText("WEAPON", rightX + 24, loadoutY + 40);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
  ctx.fillText(`⚔️ ${player.sword}`, rightX + 24, loadoutY + 56);
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.font = "bold 9px monospace";
  ctx.fillText(`Level ${player.swordLevel}/10`, rightX + 24, loadoutY + 70);

  // Shield
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.font = "900 8px monospace";
  ctx.fillText("OFFHAND SHIELD", rightX + rightW / 2 + 10, loadoutY + 40);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
  ctx.fillText(`🛡️ ${player.shield}`, rightX + rightW / 2 + 10, loadoutY + 56);
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.font = "bold 9px monospace";
  ctx.fillText(`Level ${player.shieldLevel}/10`, rightX + rightW / 2 + 10, loadoutY + 70);

  // Companions
  const activePets = (player as any).activePets || (player as any).rawPayload?.inv?.activePets || [];
  const topPetsList = activePets.slice(0, 3).map((p: any) => {
    const res = resolveItemByGameType(p.type, "pet");
    return res ? res.name : "Unknown Pet";
  });

  const petLabel = topPetsList.length > 0 ? topPetsList.join(", ") : "No companion equipped";

  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.font = "900 8px monospace";
  ctx.fillText("ACTIVE COMPANIONS", rightX + 24, loadoutY + 104);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
  ctx.fillText(`🐾 ${petLabel}`, rightX + 24, loadoutY + 120);
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.font = "bold 9px monospace";
  ctx.fillText(`${activePets.length} Total companions active`, rightX + 24, loadoutY + 134);

  // 4. HEADER BRANDING DETAILS
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 16px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("SM", 36, 42);
  ctx.fillStyle = gradeColor;
  ctx.fillText("GRADE", 36 + ctx.measureText("SM ").width, 42);

  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.font = "bold 9px monospace";
  ctx.fillText("// SYSTEM ANALYTICS DETAILED DOSSIER", 36 + ctx.measureText("SMGRADE ").width + 20, 38);

  ctx.textAlign = "right";
  ctx.fillText("STATUS: TERMINAL SECURE", W - 36, 38);

  // Header line
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.beginPath();
  ctx.moveTo(36, 52);
  ctx.lineTo(W - 36, 52);
  ctx.stroke();

  // 5. FOOTER
  ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
  ctx.beginPath();
  ctx.moveTo(36, H - 36);
  ctx.lineTo(W - 36, H - 36);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.font = "bold 8px monospace";
  ctx.textAlign = "center";
  ctx.fillText("GENERATED BY SMGRADE · PREMIUM PLAYER SHOWCASE · SMGRADE.COM", W / 2, H - 18);

  return canvas;
}

export function downloadShareCard(player: ParsedPlayer, scores: ScoreResult): void {
  const canvas = generateShareCard(player, scores);
  const link = document.createElement("a");
  link.download = `smgrade-card-${player.username}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
