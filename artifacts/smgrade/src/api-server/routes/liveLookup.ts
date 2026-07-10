import { Router } from "express";
import { createRequire } from "module";
import { normalizeLivePlayer } from "../../lib/liveLookupEngine.js";
import { scorePlayer } from "../../lib/scorer.js";
import { jsonDb } from "../lib/jsonDb.js";

// Use a local copy of the msgpack codec (from colyseus.js/build/cjs/msgpack/index.js)
// Deep imports into colyseus.js are blocked by its exports field — using local copy avoids that.
const _require = createRequire(import.meta.url);
const { encode: msgpackEncode, decode: msgpackDecode, decodePartial: msgpackDecodePartial } = _require(
  "../msgpack.cjs"
);

// ── Colyseus Protocol Constants ─────────────────────────────────────────────
const JOIN_ROOM = 10;
const LEAVE_ROOM = 12;
const ROOM_DATA = 13;

// Build a ROOM_DATA packet to send.
// Format (matching colyseus.js Room.send):
//   byte 0   : ROOM_DATA (13)
//   bytes 1..: msgpack-encoded type string
//   bytes N..: msgpack-encoded payload
// NOTE: @colyseus/schema encode.string uses msgpack string encoding, NOT a raw length prefix.
function buildSendPacket(type: string, message: unknown): ArrayBuffer {
  const typeBytes = new Uint8Array(msgpackEncode(type) as ArrayBuffer);
  const payloadBytes = new Uint8Array(msgpackEncode(message) as ArrayBuffer);
  const result = new Uint8Array(1 + typeBytes.byteLength + payloadBytes.byteLength);
  result[0] = ROOM_DATA;
  result.set(typeBytes, 1);
  result.set(payloadBytes, 1 + typeBytes.byteLength);
  return result.buffer;
}

const router = Router();

// Rate limiting connection safety flag
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
    // ── Step 1: findServer ──────────────────────────────────────────────────
    console.log("[live-lookup] Step 1: findServer");
    const fsRes = await fetch("https://loadbalancer.swordmasters.io/api/server/findServer", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    if (!fsRes.ok) {
      isConnecting = false;
      res.status(502).json({ success: false, error: "Connection failed: Load balancer returned an error." });
      return;
    }

    const fsData: any = await fsRes.json();
    const host = fsData.data?.foundServer || "eu1";
    console.log("[live-lookup] findServer → host:", host);

    if (!fsData.token) {
      isConnecting = false;
      res.status(502).json({ success: false, error: "Authentication failed: Load balancer did not provide a token." });
      return;
    }

    // ── Step 2: joinOrCreate ────────────────────────────────────────────────
    console.log("[live-lookup] Step 2: joinOrCreate on", host);
    const mmRes = await fetch(`https://${host}.swordmasters.io/matchmake/joinOrCreate/world_1`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${fsData.token}`,
        "x-auth-token": fsData.token
      },
      body: JSON.stringify({
        token: fsData.token,
        auth: fsData.token,
        password: fsData.token,
        accessToken: fsData.token,
        jwt: fsData.token
      })
    });

    if (!mmRes.ok) {
      isConnecting = false;
      res.status(502).json({ success: false, error: "Room join failed: Matchmaker returned an error." });
      return;
    }

    const mmData: any = await mmRes.json();

    if (!mmData.room?.publicAddress) {
      isConnecting = false;
      res.status(502).json({ success: false, error: "Room join failed: Invalid room reservation payload." });
      return;
    }

    console.log("[live-lookup] joinOrCreate → room:", mmData.room.roomId, "at", mmData.room.publicAddress);

    // ── Step 3: Raw WebSocket — Colyseus protocol ───────────────────────────
    // Build the WebSocket endpoint exactly as colyseus.js Client.buildEndpoint does:
    // ${endpoint}/${processId}/${roomId}?sessionId=${sessionId}
    const { processId, roomId } = mmData.room;
    const sessionId = mmData.sessionId || "";
    const wsUrl = `wss://${mmData.room.publicAddress}/${processId}/${roomId}?sessionId=${sessionId}`;

    console.log("[live-lookup] Step 3: WebSocket connect →", wsUrl.split("?")[0]);

    await new Promise<void>((resolve) => {
      let responded = false;
      let ws: any = null;

      const finish = (status: number, body: unknown) => {
        if (responded) return;
        responded = true;
        isConnecting = false;
        try { ws?.close(); } catch (_) {}
        
        // Log asynchronously to jsonDb
        setImmediate(() => {
          try {
            const duration = Date.now() - startTime;
            const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
            
            if (status === 200 && body && (body as any).success) {
              const playerInfo = (body as any).playerInfo;
              
              const normalized = normalizeLivePlayer(playerInfo);
              const scores = scorePlayer(normalized);
              
              jsonDb.addLookupLog({
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
              
              jsonDb.addActivityLog(
                playerInfo.username || username,
                "Live Lookup",
                `Successful live lookup of ${playerInfo.username || username}`,
                "Success",
                duration
              );
            } else {
              jsonDb.addLookupLog({
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
              
              jsonDb.addActivityLog(
                username,
                "Live Lookup",
                `Failed live lookup of ${username}`,
                "Failed",
                duration
              );
            }
          } catch (logErr) {
            console.error("Error logging live lookup:", logErr);
          }
        });

        res.status(status).json(body);
        resolve();
      };

      // 12 second overall timeout
      const timeoutHandle = setTimeout(() => {
        console.error("[live-lookup] Timeout after 12s — no GetPlayerInfo response received");
        finish(504, { success: false, error: "Player lookup timed out. Game servers did not respond." });
      }, 12000);

      // Node.js 22+ has built-in WebSocket via global or undici
      try {
        ws = new (globalThis as any).WebSocket(wsUrl);
      } catch (e: any) {
        clearTimeout(timeoutHandle);
        finish(502, { success: false, error: `WebSocket unavailable: ${e.message}` });
        return;
      }

      ws.binaryType = "arraybuffer";

      ws.addEventListener("open", () => {
        console.log("[live-lookup] WebSocket OPEN — waiting for JOIN_ROOM from server");
      });

      ws.addEventListener("message", (event: any) => {
        try {
          const data = event.data as ArrayBuffer;
          const bytes = Array.from(new Uint8Array(data)) as number[];
          const code = bytes[0];

          if (code === JOIN_ROOM) {
            // Server sent JOIN_ROOM — acknowledge with [10] then send GetPlayerInfo
            console.log("[live-lookup] JOIN_ROOM received — acknowledging");
            const ack = new Uint8Array([JOIN_ROOM]);
            ws.send(ack.buffer);

            // Now send GetPlayerInfo
            const packet = buildSendPacket("Client:SkinStatue:GetPlayerInfo", { username });
            ws.send(packet);
            console.log("[live-lookup] GetPlayerInfo sent for:", username);

          } else if (code === ROOM_DATA) {
            // ROOM_DATA format: byte 0 = 13, then msgpack(type), then msgpack(payload)
            // Use decodePartial to parse the type string and get the byte offset of the payload
            let type: string | number;
            let payloadOffset: number;

            try {
              [type, payloadOffset] = msgpackDecodePartial(data, 1);
            } catch (typeErr: any) {
              console.log("[live-lookup] ROOM_DATA type decode error:", typeErr.message, "— skipping");
              return; // skip this message, wait for the next
            }

            console.log("[live-lookup] ROOM_DATA type:", type, "payload offset:", payloadOffset);

            if (type === "Server:SkinStatue:GetPlayerInfo") {
              // Decode the msgpack payload starting at payloadOffset
              const slicedBuffer = data.slice(payloadOffset);
              let message: any;
              try {
                message = msgpackDecode(slicedBuffer, 0);
              } catch (decodeErr: any) {
                console.error("[live-lookup] msgpack decode error:", decodeErr.message);
                clearTimeout(timeoutHandle);
                finish(502, { success: false, error: "Failed to decode player data from game server." });
                return;
              }

              console.log("[live-lookup] GetPlayerInfo response received");
              clearTimeout(timeoutHandle);

              const playerInfo = message?.playerInfo || message;
              if (!playerInfo?.username || !playerInfo?.inv) {
                finish(404, { success: false, error: "Player not found or inventory data is empty." });
              } else {
                finish(200, { success: true, playerInfo });
              }
            }

          } else if (code === LEAVE_ROOM) {
            console.log("[live-lookup] LEAVE_ROOM received");
            clearTimeout(timeoutHandle);
            finish(502, { success: false, error: "Game server closed the room before responding." });
          }
        } catch (err: any) {
          console.error("[live-lookup] Message processing error:", err.message);
          // Don't abort — other messages may still arrive
        }
      });

      ws.addEventListener("error", (event: any) => {
        console.error("[live-lookup] WebSocket error:", event?.message || "unknown");
        clearTimeout(timeoutHandle);
        finish(502, { success: false, error: "WebSocket connection error to game server." });
      });

      ws.addEventListener("close", (event: any) => {
        console.log("[live-lookup] WebSocket closed — code:", event?.code, "reason:", event?.reason);
        clearTimeout(timeoutHandle);
        if (!responded) {
          finish(502, { success: false, error: "WebSocket closed unexpectedly by the game host." });
        }
      });
    });

  } catch (err: any) {
    isConnecting = false;
    res.status(500).json({ success: false, error: err.message || "Connection failed to game servers." });
  }
});

export default router;
