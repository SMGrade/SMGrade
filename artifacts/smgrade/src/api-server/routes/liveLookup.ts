import { Router } from "express";
import { normalizeLivePlayer } from "../../lib/liveLookupEngine.js";
import { scorePlayer } from "../../lib/scorer.js";
import { jsonDb } from "../lib/jsonDb.js";

// @ts-ignore
import msgpack from "../msgpack.cjs";
const { encode: msgpackEncode, decode: msgpackDecode, decodePartial: msgpackDecodePartial } = msgpack;

const JOIN_ROOM = 10;
const LEAVE_ROOM = 12;
const ROOM_DATA = 13;

function buildSendPacket(type: string, message: unknown): ArrayBuffer {
  const typeBytes = new Uint8Array(msgpackEncode(type) as ArrayBuffer);
  const payloadBytes = new Uint8Array(msgpackEncode(message) as ArrayBuffer);
  const result = new Uint8Array(1 + typeBytes.byteLength + payloadBytes.byteLength);
  result[0] = ROOM_DATA;
  result.set(typeBytes, 1);
  result.set(payloadBytes, 1 + typeBytes.byteLength);
  return result.buffer;
}

export async function queryLivePlayer(username: string): Promise<any> {
  const fsRes = await fetch("https://loadbalancer.swordmasters.io/api/server/findServer", {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  if (!fsRes.ok) throw new Error("Load balancer returned status " + fsRes.status);
  const fsData: any = await fsRes.json();
  if (!fsData.token) throw new Error("Load balancer did not provide authentication token.");

  const host = fsData.data?.foundServer || "eu1";
  const mmRes = await fetch(`https://${host}.swordmasters.io/matchmake/joinOrCreate/world_1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      token: fsData.token,
      auth: fsData.token,
      password: fsData.token,
      accessToken: fsData.token,
      jwt: fsData.token
    })
  });
  if (!mmRes.ok) throw new Error("Matchmaker request failed with status " + mmRes.status);
  const mmData: any = await mmRes.json();

  if (!mmData.room || !mmData.room.publicAddress || !mmData.sessionId) {
    throw new Error("Matchmaker response payload is missing reservation data.");
  }

  const wsUrl = `wss://${mmData.room.publicAddress}/?sessionId=${mmData.sessionId}`;

  return new Promise((resolve, reject) => {
    let ws: any = null;
    let responded = false;

    const timeoutHandle = setTimeout(() => {
      if (responded) return;
      responded = true;
      try { ws?.close(); } catch (_) {}
      reject(new Error("Player lookup timed out. Game servers did not respond."));
    }, 12000);

    try {
      ws = new (globalThis as any).WebSocket(wsUrl);
    } catch (e: any) {
      clearTimeout(timeoutHandle);
      reject(e);
      return;
    }

    ws.binaryType = "arraybuffer";

    ws.addEventListener("message", (event: any) => {
      try {
        const data = event.data as ArrayBuffer;
        const bytes = Array.from(new Uint8Array(data)) as number[];
        const code = bytes[0];

        if (code === JOIN_ROOM) {
          const ack = new Uint8Array([JOIN_ROOM]);
          ws.send(ack.buffer);

          const packet = buildSendPacket("Client:SkinStatue:GetPlayerInfo", { username });
          ws.send(packet);

        } else if (code === ROOM_DATA) {
          let type: string | number;
          let payloadOffset: number;

          try {
            [type, payloadOffset] = msgpackDecodePartial(data, 1);
          } catch (typeErr: any) {
            return;
          }

          if (type === "Server:SkinStatue:GetPlayerInfo") {
            const slicedBuffer = data.slice(payloadOffset);
            let message: any;
            try {
              message = msgpackDecode(slicedBuffer, 0);
            } catch (decodeErr: any) {
              if (!responded) {
                responded = true;
                clearTimeout(timeoutHandle);
                try { ws?.close(); } catch (_) {}
                reject(new Error("Failed to decode player data from game server."));
              }
              return;
            }

            if (!responded) {
              responded = true;
              clearTimeout(timeoutHandle);
              try { ws?.close(); } catch (_) {}
              const playerInfo = message?.playerInfo || message;
              if (!playerInfo?.username || !playerInfo?.inv) {
                reject(new Error("Player not found or inventory data is empty."));
              } else {
                resolve(playerInfo);
              }
            }
          }

        } else if (code === LEAVE_ROOM) {
          if (!responded) {
            responded = true;
            clearTimeout(timeoutHandle);
            try { ws?.close(); } catch (_) {}
            reject(new Error("Game server closed the room before responding."));
          }
        }
      } catch (err: any) {
        // Ignore message processing errors for other channels
      }
    });

    ws.addEventListener("error", (event: any) => {
      if (!responded) {
        responded = true;
        clearTimeout(timeoutHandle);
        reject(new Error("WebSocket connection error to game server."));
      }
    });

    ws.addEventListener("close", (event: any) => {
      if (!responded) {
        responded = true;
        clearTimeout(timeoutHandle);
        reject(new Error("WebSocket closed unexpectedly by the game host."));
      }
    });
  });
}

const router = Router();
let isConnecting = false;

router.get("/live-lookup", async (req: any, res: any) => {
  const startTime = Date.now();
  const username = req.query["username"] as string;
  if (!username) {
    res.status(400).json({ success: false, error: "Username query parameter is required." });
    return;
  }

  if (isConnecting) {
    res.status(429).json({ success: false, error: "Rate limit: A lookup is currently in progress. Please wait a few seconds." });
    return;
  }

  isConnecting = true;

  try {
    const playerInfo = await queryLivePlayer(username);
    const duration = Date.now() - startTime;
    const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";

    const normalized = normalizeLivePlayer(playerInfo);
    const scores = scorePlayer(normalized);

    await jsonDb.addLookupLog({
      usernameSearched: playerInfo.username || username,
      ipAddress,
      sessionId: "live-lookup-session",
      userAccount: null,
      userType: "Guest",
      status: "Success",
      responseTimeMs: duration,
      grade: scores.overallGrade,
      gearScore: scores.gearScore,
      wealthScore: scores.wealthScore,
      powerScore: scores.powerScore,
      progressionScore: scores.progressScore,
      recommendedUpgrade: scores.upgradeAdvice.immediate ? `${scores.upgradeAdvice.immediate.name} Lv${scores.upgradeAdvice.immediate.level}` : "None",
      playerLevel: normalized.level,
      playerPower: normalized.powerRaw,
      playerGold: normalized.goldRaw,
      equippedSword: normalized.sword.split(",")[0] || "Unknown",
      equippedShield: normalized.shield.split(",")[0] || "Unknown",
      worldNumber: 1
    });

    await jsonDb.addActivityLog(
      playerInfo.username || username,
      "Live Lookup",
      `Successful live lookup of ${playerInfo.username || username}`,
      "Success",
      duration
    );

    isConnecting = false;
    res.json({ success: true, playerInfo });
  } catch (err: any) {
    const duration = Date.now() - startTime;
    const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";

    await jsonDb.addLookupLog({
      usernameSearched: username,
      ipAddress,
      sessionId: "live-lookup-session",
      userAccount: null,
      userType: "Guest",
      status: "Failed",
      responseTimeMs: duration,
      grade: "—",
      gearScore: 0,
      wealthScore: 0,
      powerScore: 0,
      progressionScore: 0,
      recommendedUpgrade: "None",
      playerLevel: 0,
      playerPower: 0,
      playerGold: 0,
      equippedSword: "Unknown",
      equippedShield: "Unknown",
      worldNumber: 1
    });

    await jsonDb.addActivityLog(
      username,
      "Live Lookup",
      `Failed live lookup of ${username}`,
      "Failed",
      duration
    );

    isConnecting = false;
    res.status(500).json({ success: false, error: err.message || "Connection failed to game servers." });
  }
});

export default router;
