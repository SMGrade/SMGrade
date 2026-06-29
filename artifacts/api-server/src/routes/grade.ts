import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import { ExplainGradeBody } from "@workspace/api-zod";

const router = Router();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "missing-key-please-set-GEMINI_API_KEY",
});

// Real gear knowledge for accurate AI advice
const GEAR_CONTEXT = `
SWORDS (Damage Stat / DS — base Lv1, each level adds +25% of base, max Lv10):
- Graveborn Edge (Common): DS 1.40B base, market ~50 QT Lv5
- Runebreaker (Rare): DS 1.50B base, market ~53 QT Lv5
- Solbrand (Epic): DS 2.0B base, market ~200–220 QT Lv3 | ~800+ QT Lv5
- Soulkeeper's Blade (Epic): DS 4.0B base, market ~500 QT Lv1
- Dragon's Devil (Legendary): DS 5.0B base
- Divinity Edge (Legendary): DS 8.0B base, market ~280–345 QNT Lv1
- Last Horizon (Legendary): DS 12.0B base, market ~390–420 QNT Lv1

SHIELDS (Damage Multiplier / DM — base Lv1, same +25% scaling, max Lv10):
- Sealguard (Epic): DM 6.5x base
- Sunward Bulwark (Epic): DM 7.0x base
- Dragon's Soul (Legendary): DM 8.0x base
- Asgardian Aegis (Legendary): DM 10.0x base, market ~280–345 QNT Lv1
- Final Bastion (Legendary): DM 14.0x base, market ~390–420 QNT Lv1

DAMAGE FORMULA: Damage/Hit = (DS + 2√Power + 1) × (1 + DM)
LEVEL SCALING: Lv n stat = base × (1 + 0.25 × (n−1)) — NOT compounded. Max level is 10.
MARKET PRICES are in Power (QT = Quadrillion, QNT = Quintillion).
`;

router.post("/grade/explain", async (req, res) => {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim() === "" || process.env.GEMINI_API_KEY.includes("missing-key")) {
    res.status(400).json({ error: "Gemini API key is missing. Please configure GEMINI_API_KEY in your environment." });
    return;
  }

  const parsed = ExplainGradeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const d = parsed.data;

  const prompt = `You are a SwordMasters account analyst. A deterministic scoring engine has already computed the scores — do NOT re-calculate them. Your job is only to write the written analysis.

Player: ${d.username}
Level: ${d.level} (${d.levelTier} tier)
Overall Score: ${d.overallScore}/100 (${d.overallGrade})
Standing: ${d.standing} compared to players at this level

Score breakdown:
- Gear Score: ${d.gearScore}/100
- Power Score: ${d.powerScore}/100
- Progress Score: ${d.progressScore}/100
- Wealth Score: ${d.wealthScore}/100

Gear:
- Sword: ${d.sword} (Level ${d.swordLevel})
- Shield: ${d.shield} (Level ${d.shieldLevel})

Stats:
- Power: ${d.powerRaw}
- Gold: ${d.goldRaw}
${d.pvpKills != null ? `- PvP Kills: ${d.pvpKills}` : ""}

REAL GAME KNOWLEDGE (use this for accurate advice — do NOT suggest non-existent gear or impossible levels):
${GEAR_CONTEXT}

RULES for recommendation:
- Only suggest gear that exists in the list above
- Max weapon level is 10 — never suggest "Lv11" or higher
- If player already has Last Horizon sword, suggest upgrading its level instead of a new sword
- If player already has Final Bastion shield, suggest upgrading its level or focus on power
- Include real market prices when suggesting gear upgrades
- Be specific — name the exact item and level

Respond in JSON with exactly this structure (no markdown, no code block):
{
  "summary": "2-3 sentence overall summary of the account",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "recommendation": "Single most impactful next upgrade — be specific with item name, target level, and approximate market cost",
  "reasoning": "1-2 sentences explaining why this specific grade was given"
}

Be concise, specific, and accurate. Reference real game terms. Do not be generic.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const content = response.text;
    if (!content) {
      res.status(500).json({ error: "No response from AI" });
      return;
    }

    const result = JSON.parse(content);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "AI explanation failed");
    res.status(500).json({ error: "AI explanation failed" });
  }
});

// ── AI Chat ──────────────────────────────────────────────────────────────────
const CHAT_SYSTEM = `You are the SMGrade AI Coach — a sharp, knowledgeable SwordMasters expert.
You have access to the player's full stats and grade report below.
Answer questions concisely (2–5 sentences max). Be direct, game-accurate, and helpful.
Never make up items. If the question is unrelated to SwordMasters or the player, politely redirect.

${GEAR_CONTEXT}`;

router.post("/grade/chat", async (req, res) => {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim() === "" || process.env.GEMINI_API_KEY.includes("missing-key")) {
    res.status(400).json({ error: "Gemini API key is missing. Please configure GEMINI_API_KEY in your environment." });
    return;
  }

  const { question, playerContext } = req.body as {
    question?: string;
    playerContext?: Record<string, unknown>;
  };

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    res.status(400).json({ error: "question is required" });
    return;
  }

  const ctx = playerContext
    ? `Player context:\n${JSON.stringify(playerContext, null, 2)}`
    : "";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${ctx}\n\nPlayer question: ${question.trim()}`,
      config: {
        systemInstruction: CHAT_SYSTEM,
      },
    });
    const answer = response.text ?? "I couldn't generate a response. Try again.";
    res.json({ answer });
  } catch (err) {
    req.log.error({ err }, "AI chat failed");
    res.status(500).json({ error: "AI chat failed" });
  }
});

export default router;
