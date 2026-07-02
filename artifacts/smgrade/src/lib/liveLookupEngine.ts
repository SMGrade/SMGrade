// @ts-ignore
import { Client } from "colyseus.js";
import { formatNumber } from "./numberParser";
import { resolveItemByGameType } from "./gearDatabase";
import type { ParsedPlayer } from "./parser";

export interface LiveConnectionStatus {
  step: number;
  message: string;
}

/**
 * Connects directly to SwordMasters game server, handshakes, and returns the raw player info payload.
 */
export async function fetchLivePlayerInfo(
  username: string,
  onStatusUpdate?: (status: LiveConnectionStatus) => void
): Promise<any> {
  // Step 1: findServer
  if (onStatusUpdate) onStatusUpdate({ step: 1, message: "Querying server load balancer..." });
  const fsRes = await fetch("https://loadbalancer.swordmasters.io/api/server/findServer", {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  if (!fsRes.ok) throw new Error(`Load balancer returned status ${fsRes.status}`);
  const fsData = await fsRes.json();
  if (!fsData.token) throw new Error("Load balancer did not provide authentication token.");

  // Step 2: joinOrCreate
  if (onStatusUpdate) onStatusUpdate({ step: 2, message: "Requesting matchmaking room seat..." });
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
  if (!mmRes.ok) throw new Error(`Matchmaker request failed with status ${mmRes.status}`);
  const mmData = await mmRes.json();

  if (!mmData.room || !mmData.room.publicAddress || !mmData.sessionId) {
    throw new Error("Matchmaker response payload is missing reservation data.");
  }

  // Step 3: Connect Colyseus Client
  if (onStatusUpdate) onStatusUpdate({ step: 3, message: "Opening secure websocket connection..." });
  const client = new Client(`wss://${mmData.room.publicAddress}`);
  
  // Inject tokens dynamically in buildEndpoint
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

  const rm = client.createRoom(mmData.room.name);
  rm.id = mmData.room.roomId;
  rm.sessionId = mmData.sessionId;

  const wsUrl = client.buildEndpoint(mmData.room, { sessionId: rm.sessionId });

  // Trigger connect
  rm.connect(wsUrl);

  const ws = (rm.connection?.transport as any)?.ws as WebSocket;
  if (!ws) {
    throw new Error("WebSocket transport was not constructed by the library.");
  }

  // Await socket open connection state (max 10s)
  await new Promise<void>((resolve, reject) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        rm.leave();
        reject(new Error("WebSocket handshake timed out."));
      }
    }, 10000);

    ws.addEventListener("open", () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve();
      }
    });

    ws.addEventListener("close", (e) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        rm.leave();
        reject(new Error(`WebSocket connection closed. Code ${e.code}: ${e.reason || "Abnormal closure"}`));
      }
    });

    if (ws.readyState === WebSocket.OPEN) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve();
      }
    }
  });

  // Step 4: Dispatch lookup packet and await result (max 10s)
  if (onStatusUpdate) onStatusUpdate({ step: 4, message: "Retrieving character inventory..." });

  return new Promise((resolve, reject) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        rm.leave();
        reject(new Error("Game server request timed out."));
      }
    }, 10000);

    rm.onMessage("Server:SkinStatue:GetPlayerInfo", (message: any) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        rm.leave();
        resolve(message);
      }
    });

    rm.onError((code: number, msg?: string) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        rm.leave();
        reject(new Error(`Game server returned error ${code}: ${msg || "Query rejected"}`));
      }
    });

    // Request player stats from world room
    rm.send("Client:SkinStatue:GetPlayerInfo", { username: username.trim() });
  });
}

/**
 * Normalizes game server's payload into the standard ParsedPlayer format.
 */
export function normalizeLivePlayer(liveData: any): ParsedPlayer {
  const rawData = liveData.playerInfo || liveData;
  const inv = rawData.inv || {};

  // Resolve equipped Sword and Shield from database type mappings
  const swItem = typeof inv.activeSword?.type === 'number' ? resolveItemByGameType(inv.activeSword.type, "sword") : null;
  const shItem = typeof inv.activeShield?.type === 'number' ? resolveItemByGameType(inv.activeShield.type, "shield") : null;

  // Format full names with level details for score computation compatibility
  const swordName = swItem ? swItem.name : "Graveborn Edge";
  const swordLevel = inv.activeSword?.level || 1;
  const swordString = `${swordName}, Level ${swordLevel} 100%`;

  const shieldName = shItem ? shItem.name : "Sealguard";
  const shieldLevel = inv.activeShield?.level || 1;
  const shieldString = `${shieldName}, Level ${shieldLevel} 100%`;

  // Parse first active pet (if any)
  let petString = "";
  let petLevel = 1;
  if (inv.activePets && inv.activePets.length > 0) {
    const firstPetType = inv.activePets[0].type;
    const petItem = resolveItemByGameType(firstPetType, "pet");
    if (petItem) {
      petString = `${petItem.name}, Level 1 100%`;
      petLevel = 1;
    }
  }

  // Construct standard ParsedPlayer object matching the scorer expectation
  return {
    username: rawData.username || "Unknown",
    level: typeof inv.level === 'number' ? inv.level : 1,
    experience: "0",
    gold: formatNumber(inv.gold || 0),
    goldRaw: inv.gold || 0,
    power: formatNumber(inv.power || 0),
    powerRaw: inv.power || 0,
    health: "100",
    pvpKillCount: 0,
    pvpLoot: "0",
    registerDate: new Date().toLocaleDateString(),
    sword: swordString,
    swordLevel: swordLevel,
    swordProgress: 100,
    shield: shieldString,
    shieldLevel: shieldLevel,
    shieldProgress: 100,
    killedEnemies: inv.killedEnemyTypes || {},
    pet: petString,
    petLevel: petLevel
  };
}
