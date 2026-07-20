import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import { ExplainGradeBody } from "@workspace/api-zod";
import { queryLivePlayer } from "./liveLookup.js";
import { normalizeLivePlayer } from "../../lib/liveLookupEngine.js";
import { scorePlayer } from "../../lib/scorer.js";
import type { ParsedPlayer } from "../../lib/parser.js";

const router = Router();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "missing-key-please-set-GEMINI_API_KEY",
});

// Cache player lookup results for 5 minutes
interface CacheEntry {
  playerData: ParsedPlayer;
  scores: any;
  timestamp: number;
}
const playerCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Real gear knowledge for accurate AI advice
const GEAR_CONTEXT = `
SWORDS (Damage Stat / DS — base Lv1, each level adds +25% of base, max Lv10):
- Graveborn Edge (Common): DS 1.40B base, market ~50 QT Lv5
- Runebreaker (Rare): DS 1.50B base, market ~53 QT Lv5
- Solbrand (Epic): DS 2.0B base, market ~200–220 QT Lv3 | ~800+ QT Lv5
- Soulkeeper's Blade (Epic): DS 4.0B base, market ~500 QT Lv1
- Dragon's Devil (Legendary): DS 6.0B base (scales by 1.5B/level)
- Divinity Edge (Legendary): DS 9.0B base (scales by 2.25B/level)
- Last Horizon (Legendary): DS 12.0B base (scales by 3.0B/level)

SHIELDS (Damage Multiplier / DM — base Lv1, same +25% scaling, max Lv10):
- Sealguard (Epic): DM 6.5x base
- Sunward Bulwark (Epic): DM 7.0x base
- Dragon's Soul (Legendary): DM 9.0x base (scales by 2.25x/level)
- Asgardian Aegis (Legendary): DM 14.0x base (scales by 3.5x/level)
- Final Bastion (Legendary): DM 18.0x base (scales by 4.5x/level)

DAMAGE FORMULA: Damage/Hit = (DS + 2√Power + 1) × (1 + DM)
LEVEL SCALING: Lv n stat = base × (1 + 0.25 × (n−1)) — NOT compounded. Max level is 10.
MARKET PRICES are in Power (QT = Quadrillion, QNT = Quintillion).
`;

router.post("/grade/explain", async (req: any, res: any) => {
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
  const itemsContext = req.body.itemsContext || GEAR_CONTEXT;

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
${itemsContext}

RULES for recommendation:
- Only suggest gear that exists in the list above
- Max weapon level is 10 — never suggest "Lv11" or higher
- If player already has Last Horizon sword, suggest upgrading its level instead of a new sword
- If player already has Final Bastion shield, suggest upgrading its level or focus on power
- Include real market prices when suggesting gear upgrades
- Be specific — name the exact item and level

Respond in JSON with exactly this structure (no markdown, no code block):
{
  "summary": "2-3 sentence overall summary of the account. Mention why the grade was given based on their score breakdown.",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "recommendation": "Cheapest upgrade: <Item name + level + cost>. Best value upgrade: <Item name + level + cost>. Why it is recommended over other options.",
  "reasoning": "1-2 sentences explaining why this specific grade was given based on their gear and progression stage."
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

// ── AI Coach Chat Redesign (Section 4) ────────────────────────────────────────

router.post("/grade/chat", async (req: any, res: any) => {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim() === "" || process.env.GEMINI_API_KEY.includes("missing-key")) {
    res.status(400).json({ error: "Gemini API key is missing. Please configure GEMINI_API_KEY in your environment." });
    return;
  }

  const { question, username } = req.body as {
    question?: string;
    username?: string;
  };

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    res.status(400).json({ error: "question is required" });
    return;
  }

  let playerData: ParsedPlayer | null = null;
  let scores: any = null;

  // Perform backend lookup if username is provided
  if (username && username.trim().length > 0) {
    const cleanUser = username.trim().toLowerCase();
    const cached = playerCache.get(cleanUser);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      playerData = cached.playerData;
      scores = cached.scores;
    } else {
      try {
        console.log(`[AI Coach] Backend Live Lookup fetching profile for: ${username}`);
        const playerInfo = await queryLivePlayer(username);
        playerData = normalizeLivePlayer(playerInfo);
        scores = scorePlayer(playerData);
        
        playerCache.set(cleanUser, {
          playerData,
          scores,
          timestamp: Date.now()
        });
      } catch (err: any) {
        console.warn(`[AI Coach] Backend lookup failed for ${username}:`, err.message);
        // We will proceed without context or fallback to a friendly message
      }
    }
  }

  const itemsContext = GEAR_CONTEXT;
  const chatSystemInstruction = `You are the SMGrade AI Coach — a sharp, knowledgeable SwordMasters expert.
You have access to the player's full stats, gear details, and score breakdown from our database.
Answer the player's questions concisely (2–5 sentences max). Be direct, helpful, and game-accurate.
Never make up items or suggest stats that do not exist.
If the question is completely unrelated to SwordMasters or their stats, politely redirect them back to the game.

${itemsContext}`;

  let playerContextString = "";
  if (playerData && scores) {
    playerContextString = `
PLAYER INFORMATION:
- Username: ${playerData.username}
- Level: ${playerData.level}
- Power: ${playerData.power}
- Gold: ${playerData.gold}
- Equipped Sword: ${playerData.sword} (Level ${playerData.swordLevel})
- Equipped Shield: ${playerData.shield} (Level ${playerData.shieldLevel})
- Active Pet: ${playerData.pet || "None"}
- PVP Kills: ${playerData.pvpKillCount}
- Overall Grade: ${scores.overallGrade} (Score: ${scores.overallScore}/100)
- Score Breakdown:
  * Gear Score: ${scores.gearScore}/100
  * Power Score: ${scores.powerScore}/100
  * Progress Score: ${scores.progressScore}/100
  * Wealth Score: ${scores.wealthScore}/100
- Recommended Immediate Upgrade: ${scores.upgradeAdvice.immediate ? `${scores.upgradeAdvice.immediate.name} Lv${scores.upgradeAdvice.immediate.level} (+${scores.upgradeAdvice.immediate.damageGainPct}% DPS)` : "None"}
- Long Term Upgrade Goal: ${scores.upgradeAdvice.longTerm ? `${scores.upgradeAdvice.longTerm.name} Lv${scores.upgradeAdvice.longTerm.level} (+${scores.upgradeAdvice.longTerm.damageGainPct}% DPS)` : "None"}
`;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${playerContextString}\n\nPlayer question: ${question.trim()}`,
      config: {
        systemInstruction: chatSystemInstruction,
        maxOutputTokens: 250,
        temperature: 0.7,
      },
    });

    const content = response.text;
    if (!content) {
      res.status(500).json({ error: "No response from AI" });
      return;
    }

    res.json({ text: content.trim() });
  } catch (err) {
    req.log.error({ err }, "AI Coach chat failed");
    res.status(500).json({ error: "AI Coach chat failed" });
  }
});

export default router;
