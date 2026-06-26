import type { ScoreResult, GearSlotGrade } from "./scorer";
import type { ParsedPlayer } from "./parser";

const GRADE_COLOR: Record<string, string> = {
  "S+": "#FFD700",
  S: "#FFD700",
  "A+": "#c9a84c",
  A: "#c9a84c",
  "B+": "#8ab4c9",
  B: "#8ab4c9",
  "C+": "#888888",
  C: "#888888",
  D: "#e05a5a",
};

const STANDING_COLOR: Record<string, string> = {
  Elite: "#FFD700",
  "Above Average": "#c9a84c",
  Average: "#8ab4c9",
  "Below Average": "#888888",
  Weak: "#e05a5a",
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawSlotCard(
  ctx: CanvasRenderingContext2D,
  slot: GearSlotGrade,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const gradeColor = GRADE_COLOR[slot.grade] ?? "#888";

  // Card background
  ctx.fillStyle = "#111111";
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();

  // Border
  ctx.strokeStyle = "#2a2a2a";
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 6);
  ctx.stroke();

  // Slot label
  ctx.fillStyle = "#555555";
  ctx.font = "bold 10px system-ui, -apple-system, sans-serif";
  ctx.letterSpacing = "1px";
  ctx.textAlign = "left";
  ctx.fillText(slot.slotName.toUpperCase(), x + 12, y + 18);
  ctx.letterSpacing = "0px";

  // Grade letter (right side)
  ctx.fillStyle = gradeColor;
  ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(slot.grade, x + w - 12, y + 38);

  // Score bar background
  const barY = y + 44;
  const barW = w - 24;
  ctx.fillStyle = "#1a1a1a";
  roundRect(ctx, x + 12, barY, barW, 3, 1.5);
  ctx.fill();

  // Score bar fill
  ctx.fillStyle = gradeColor;
  roundRect(ctx, x + 12, barY, barW * (slot.score / 100), 3, 1.5);
  ctx.fill();

  // Item name (truncated)
  ctx.fillStyle = "#cccccc";
  ctx.font = "12px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  const maxChars = Math.floor(w / 7.5);
  const label =
    slot.itemName.length > maxChars
      ? slot.itemName.slice(0, maxChars - 1) + "…"
      : slot.itemName;
  ctx.fillText(label, x + 12, y + 62);

  // Stat (DS/DM)
  ctx.fillStyle = "#555555";
  ctx.font = "10px monospace";
  ctx.fillText(slot.stat, x + 12, y + 76);
}

export function generateShareCard(
  player: ParsedPlayer,
  scores: ScoreResult
): HTMLCanvasElement {
  const W = 800;
  const H = 420;

  const canvas = document.createElement("canvas");
  canvas.width = W * 2;  // retina
  canvas.height = H * 2;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;

  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);  // retina scale

  // Background
  ctx.fillStyle = "#0d0d0d";
  ctx.fillRect(0, 0, W, H);

  // Outer border
  ctx.strokeStyle = "#2a2a2a";
  ctx.lineWidth = 1;
  roundRect(ctx, 1, 1, W - 2, H - 2, 8);
  ctx.stroke();

  // Top gold accent line
  ctx.fillStyle = "#c9a84c";
  ctx.fillRect(0, 0, W, 3);

  // === HEADER ===
  // "SM" in gold
  ctx.fillStyle = "#c9a84c";
  ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("SM", 32, 44);

  // "Grade" in white
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Grade", 32 + ctx.measureText("SM").width, 44);

  // Right: smgrade.replit.app label
  ctx.fillStyle = "#444444";
  ctx.font = "11px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("smgrade.replit.app", W - 32, 44);

  // Divider
  ctx.strokeStyle = "#1e1e1e";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(32, 56);
  ctx.lineTo(W - 32, 56);
  ctx.stroke();

  // === PLAYER INFO (left) ===
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(player.username, 32, 96);

  ctx.fillStyle = "#666666";
  ctx.font = "13px system-ui, -apple-system, sans-serif";
  ctx.fillText(`Level ${player.level.toLocaleString()} · ${scores.levelTier} Tier`, 32, 118);

  // Standing badge
  const standingColor = STANDING_COLOR[scores.standing] ?? "#888";
  ctx.fillStyle = standingColor + "22";
  roundRect(ctx, 32, 128, 120, 22, 4);
  ctx.fill();
  ctx.strokeStyle = standingColor + "66";
  ctx.lineWidth = 1;
  roundRect(ctx, 32, 128, 120, 22, 4);
  ctx.stroke();

  ctx.fillStyle = standingColor;
  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(scores.standing.toUpperCase(), 92, 143);

  // === OVERALL GRADE (right) ===
  const gradeColor = GRADE_COLOR[scores.overallGrade] ?? "#888";

  ctx.fillStyle = gradeColor;
  ctx.font = "bold 88px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(scores.overallGrade, W - 32, 140);

  // Score number below grade
  ctx.fillStyle = "#444444";
  ctx.font = "13px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`${scores.overallScore}/100`, W - 32, 158);

  // === SCORE BARS ===
  const barLabels = [
    { label: "Gear", score: scores.gearScore, color: "#c9a84c" },
    { label: "Power", score: scores.powerScore, color: "#8ab4c9" },
    { label: "Progress", score: scores.progressScore, color: "#9ecb7a" },
    { label: "Wealth", score: scores.wealthScore, color: "#b89fce" },
  ];

  const barsStartY = 175;
  const barsW = 300;

  barLabels.forEach((bar, i) => {
    const by = barsStartY + i * 30;
    ctx.fillStyle = "#444444";
    ctx.font = "11px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(bar.label, 32, by);

    // Score value
    ctx.fillStyle = bar.color;
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "left";
    ctx.fillText(String(bar.score), 90, by);

    // Bar bg
    ctx.fillStyle = "#1a1a1a";
    roundRect(ctx, 115, by - 10, barsW, 6, 3);
    ctx.fill();

    // Bar fill
    ctx.fillStyle = bar.color;
    roundRect(ctx, 115, by - 10, barsW * (bar.score / 100), 6, 3);
    ctx.fill();
  });

  // === SLOT GRADE CARDS (bottom row) ===
  const cardW = Math.floor((W - 64 - 16) / 3);
  const cardH = 90;
  const cardsY = H - cardH - 28;

  scores.slotGrades.forEach((slot, i) => {
    const cx = 32 + i * (cardW + 8);
    drawSlotCard(ctx, slot, cx, cardsY, cardW, cardH);
  });

  // === FOOTER ===
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(0, H - 20, W, 20);

  ctx.fillStyle = "#555555";
  ctx.font = "10px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("SMGrade · AI-powered SwordMasters account grader · Not affiliated with SwordMasters", W / 2, H - 6);

  return canvas;
}

export function downloadShareCard(player: ParsedPlayer, scores: ScoreResult): void {
  const canvas = generateShareCard(player, scores);
  const link = document.createElement("a");
  link.download = `smgrade-${player.username}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
