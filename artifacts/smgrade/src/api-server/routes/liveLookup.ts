import { Router, type Request, type Response } from "express";
// @ts-ignore
import { Client, registerSerializer } from "colyseus.js";

class DummySerializer {
  setState(rawState: any) {}
  getState() { return null; }
  patch(patches: any) {}
  teardown() {}
  handshake(bytes: any, it: any) {}
}

// Register dummy fallback serializer signatures for SwordMasters game server changes
registerSerializer("j6CSBEPV_", DummySerializer);
registerSerializer("CFQ2R9YEZ", DummySerializer);
registerSerializer("9qPNKmk1V", DummySerializer);
registerSerializer("none", DummySerializer);

const router = Router();

// Rate limiting connection safety flag
let isConnecting = false;

router.get("/live-lookup", async (req: any, res: any) => {
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
    // 1. findServer
    const fsRes = await fetch("https://loadbalancer.swordmasters.io/api/server/findServer", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    
    if (!fsRes.ok) {
      res.status(502).json({ success: false, error: "Connection failed: Load balancer returned an error." });
      isConnecting = false;
      return;
    }
    
    const fsData: any = await fsRes.json();
    const host = fsData.data?.foundServer || "eu1";

    if (!fsData.token) {
      res.status(502).json({ success: false, error: "Authentication failed: Load balancer did not provide a token." });
      isConnecting = false;
      return;
    }

    // 2. joinOrCreate
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
      res.status(502).json({ success: false, error: "Room join failed: Matchmaker returned an error." });
      isConnecting = false;
      return;
    }

    const mmData: any = await mmRes.json();
    
    if (!mmData.room || !mmData.room.publicAddress) {
      res.status(502).json({ success: false, error: "Room join failed: Invalid room reservation payload." });
      isConnecting = false;
      return;
    }

    // 3. Connect via Colyseus
    const client = new Client(`wss://${mmData.room.publicAddress}`);
    
    // Inject custom serializer fallback override to handle dynamic server hashes
    client.buildEndpoint = function (room: any, options: any) {
      if (options === void 0) { options = {}; }
      var params = [];
      for (var name_1 in options) {
          if (!options.hasOwnProperty(name_1)) {
              continue;
          }
          params.push(name_1 + "=" + options[name_1]);
      }
      params.push("token=" + encodeURIComponent(fsData.token));
      params.push("auth=" + encodeURIComponent(fsData.token));
      params.push("password=" + encodeURIComponent(fsData.token));
      params.push("accessToken=" + encodeURIComponent(fsData.token));
      params.push("jwt=" + encodeURIComponent(fsData.token));
      params.push("Authorization=" + encodeURIComponent("Bearer " + fsData.token));
      return this.endpoint + "/" + room.processId + "/" + room.roomId + "?" + params.join('&');
    };

    const room = await client.consumeSeatReservation(mmData);

    // Wait for the room to send the GetPlayerInfo response
    let responded = false;

    const timeout = setTimeout(() => {
      if (!responded) {
        responded = true;
        room.leave();
        isConnecting = false;
        res.status(504).json({ success: false, error: "Player lookup timed out. Game servers did not respond." });
      }
    }, 6000);

    room.onMessage("Server:SkinStatue:GetPlayerInfo", (message: any) => {
      if (!responded) {
        responded = true;
        clearTimeout(timeout);
        room.leave();
        isConnecting = false;

        const playerInfo = message?.playerInfo || message;
        if (!playerInfo || !playerInfo.username || !playerInfo.inv) {
          res.status(404).json({ success: false, error: "Player not found or inventory data is empty." });
          return;
        }

        res.json({
          success: true,
          playerInfo: playerInfo
        });
      }
    });

    room.onError((code: number, msg?: string) => {
      if (!responded) {
        responded = true;
        clearTimeout(timeout);
        isConnecting = false;
        res.status(502).json({ success: false, error: `Protocol error: Room error code ${code}. ${msg || ""}` });
      }
    });

    room.onLeave(() => {
      if (!responded) {
        responded = true;
        clearTimeout(timeout);
        isConnecting = false;
        res.status(502).json({ success: false, error: "WebSocket closed unexpectedly by the game host." });
      }
    });

    room.send("Client:SkinStatue:GetPlayerInfo", { username: username });

  } catch (err: any) {
    isConnecting = false;
    res.status(500).json({ success: false, error: err.message || "Connection failed to game servers." });
  }
});

export default router;
