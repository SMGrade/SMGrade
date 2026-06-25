import { Router } from "express";
import OpenAI from "openai";
import { ExplainGradeBody } from "@workspace/api-zod";

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post("/grade/explain", async (req, res) => {
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

Respond in JSON with exactly this structure (no markdown, no code block):
{
  "summary": "2-3 sentence overall summary of the account",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "recommendation": "Single most impactful next upgrade or action",
  "reasoning": "1-2 sentences explaining why this specific grade was given"
}

Be concise, specific, and accurate. Reference real game terms. Do not be generic.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_completion_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
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

export default router;
