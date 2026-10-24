import { Router } from "express";
import { normalizeLivePlayer } from "../../lib/liveLookupEngine.js";
import { scorePlayer } from "../../lib/scorer.js";
import { jsonDb } from "../lib/jsonDb.js";
import { queryLivePlayer, queryLivePlayerLightweight, buildSendPacket } from "../../lib/gameProtocol.js";

export { queryLivePlayer, queryLivePlayerLightweight, buildSendPacket };

async function queryLivePlayerLightweightWithRetry(username: string, retries = 2): Promise<any> {
  let lastErr: any = null;
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[Live Lookup Light] Querying player info (attempt ${i + 1}/${retries})...`);
      const data = await queryLivePlayerLightweight(username);
      return data;
    } catch (err: any) {
      console.warn(`[Live Lookup Light] Query attempt ${i + 1} failed: ${err.message || err}`);
      lastErr = err;
      if (err.message === "Player not found.") {
        throw err;
      }
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  }
  throw lastErr || new Error("Failed to lookup character stats after retries.");
}

async function queryLivePlayerWithRetry(username: string, retries = 2): Promise<any> {
  let lastErr: any = null;
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[Live Lookup] Querying player info (attempt ${i + 1}/${retries})...`);
      const data = await queryLivePlayer(username);
      return data;
    } catch (err: any) {
      console.warn(`[Live Lookup] Query attempt ${i + 1} failed: ${err.message || err}`);
      lastErr = err;
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  }
  throw lastErr || new Error("Failed to lookup character stats after retries.");
}

const router = Router();

router.get("/live-lookup", async (req: any, res: any) => {
  const startTime = Date.now();
  const username = req.query["username"] as string;
  if (!username) {
    res.status(400).json({ success: false, error: "Username query parameter is required." });
    return;
  }

  try {
    const playerInfo = await queryLivePlayerWithRetry(username);
    const duration = Date.now() - startTime;
    const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";

    const normalized = normalizeLivePlayer(playerInfo);
    const scores = scorePlayer(normalized);

    await jsonDb.addActivityLog(
      playerInfo.username || username,
      "Live Lookup",
      `Successful live lookup of ${playerInfo.username || username}`,
      "Success",
      duration
    );

    res.json({ success: true, playerInfo, scores });
  } catch (err: any) {
    const duration = Date.now() - startTime;
    const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";

    await jsonDb.addActivityLog(
      username,
      "Live Lookup",
      `Failed live lookup of ${username}`,
      "Failed",
      duration
    );

    res.status(500).json({ success: false, error: err.message || "Connection failed to game servers." });
  }
});

const lightweightCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 30000; // 30 seconds

router.get("/live-lookup-lightweight", async (req: any, res: any) => {
  const username = req.query["username"] as string;
  if (!username) {
    res.status(400).json({ success: false, error: "Username query parameter is required." });
    return;
  }

  const cleanName = username.trim().toLowerCase();
  const cached = lightweightCache.get(cleanName);
  const now = Date.now();
  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    res.json({ success: true, playerInfo: cached.data, cached: true });
    return;
  }

  try {
    const playerInfo = await queryLivePlayerLightweightWithRetry(username);
    lightweightCache.set(cleanName, { timestamp: Date.now(), data: playerInfo });
    res.json({ success: true, playerInfo });
  } catch (err: any) {
    res.status(err.message === "Player not found." ? 404 : 500).json({ 
      success: false, 
      error: err.message || "Connection failed to game servers." 
    });
  }
});

export default router;
