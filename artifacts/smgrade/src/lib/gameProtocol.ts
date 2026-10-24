import { encode as msgpackEncode, decode as msgpackDecode, decodePartial as msgpackDecodePartial } from "./msgpack.js";

const JOIN_ROOM = 10;
const LEAVE_ROOM = 12;
const ROOM_DATA = 13;

export function buildSendPacket(type: string, message: unknown): ArrayBuffer {
  const typeBytes = new Uint8Array(msgpackEncode(type) as ArrayBuffer);
  const payloadBytes = new Uint8Array(msgpackEncode(message) as ArrayBuffer);
  const result = new Uint8Array(1 + typeBytes.byteLength + payloadBytes.byteLength);
  result[0] = ROOM_DATA;
  result.set(typeBytes, 1);
  result.set(payloadBytes, 1 + typeBytes.byteLength);
  return result.buffer;
}

export async function createGameWebSocket(wsUrl: string): Promise<{ ws: any; acceptIfNeeded: () => void }> {
  const wsHeaders = {
    "Origin": "https://swordmasters.io",
    "Referer": "https://swordmasters.io/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  };

  // Cloudflare Workers fetch with Upgrade: websocket
  if (typeof fetch === "function") {
    try {
      const fetchUrl = wsUrl.replace(/^wss:\/\//i, "https://").replace(/^ws:\/\//i, "http://");
      const resp = await fetch(fetchUrl, {
        headers: {
          ...wsHeaders,
          "Upgrade": "websocket",
        }
      });
      if ((resp as any).webSocket) {
        const ws = (resp as any).webSocket;
        // Do NOT call accept() here! Return callback so listeners can be attached first.
        return {
          ws,
          acceptIfNeeded: () => {
            try { ws.accept(); } catch (_) {}
          }
        };
      }
    } catch (_) {}
  }

  // Global WebSocket constructor (Node.js with ws, or browser)
  if (typeof (globalThis as any).WebSocket !== "undefined") {
    try {
      const ws = new (globalThis as any).WebSocket(wsUrl, { headers: wsHeaders });
      return { ws, acceptIfNeeded: () => {} };
    } catch (_) {
      const ws = new (globalThis as any).WebSocket(wsUrl);
      return { ws, acceptIfNeeded: () => {} };
    }
  }

  throw new Error("No WebSocket implementation available in current runtime.");
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

  const queryParams = [
    "sessionId=" + mmData.sessionId,
    "token=" + encodeURIComponent(fsData.token),
    "accessToken=" + encodeURIComponent(fsData.token),
    "auth=" + encodeURIComponent(fsData.token),
    "jwt=" + encodeURIComponent(fsData.token)
  ].join("&");

  const wsUrl = `wss://${mmData.room.publicAddress}/${mmData.room.processId}/${mmData.room.roomId}?${queryParams}`;
  const { ws, acceptIfNeeded } = await createGameWebSocket(wsUrl);

  return new Promise((resolve, reject) => {
    let responded = false;

    const timeoutHandle = setTimeout(() => {
      if (responded) return;
      responded = true;
      try { ws?.close(); } catch (_) {}
      reject(new Error("Player lookup timed out. Game servers did not respond."));
    }, 7000);

    try {
      ws.binaryType = "arraybuffer";
    } catch (_) {}

    ws.addEventListener("message", async (event: any) => {
      try {
        let raw = event.data;
        if (typeof Blob !== "undefined" && raw instanceof Blob) {
          raw = await raw.arrayBuffer();
        }
        let buffer: ArrayBuffer;
        if (raw instanceof ArrayBuffer) {
          buffer = raw;
        } else if (raw?.buffer instanceof ArrayBuffer) {
          buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
        } else {
          return;
        }

        const bytes = new Uint8Array(buffer);
        const code = bytes[0];

        if (code === JOIN_ROOM) {
          const ack = new Uint8Array([JOIN_ROOM]);
          ws.send(ack.buffer);

          const packet = buildSendPacket("Client:SkinStatue:GetPlayerInfo", { username: username.trim() });
          ws.send(packet);

        } else if (code === ROOM_DATA) {
          let type: string | number;
          let payloadOffset: number;

          try {
            [type, payloadOffset] = msgpackDecodePartial(buffer, 1);
          } catch (typeErr: any) {
            return;
          }

          if (type === "Server:SkinStatue:GetPlayerInfo") {
            const slicedBuffer = buffer.slice(payloadOffset);
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
              if (message?.found === false || (!playerInfo?.username && !playerInfo?.inv)) {
                reject(new Error("Player not found."));
              } else if (!playerInfo?.inv) {
                reject(new Error("Player found but inventory data is empty."));
              } else {
                resolve({
                  username: playerInfo.username || username,
                  inv: playerInfo.inv,
                  _id: message._id || playerInfo._id
                });
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
        const reason = event.reason ? `: ${event.reason}` : "";
        reject(new Error(`WebSocket closed by game host (Code ${event.code || 1006}${reason}).`));
      }
    });

    // NOW that all listeners are safely attached, accept the WebSocket if in Cloudflare Workers!
    acceptIfNeeded();
  });
}

export async function queryLivePlayerLightweight(username: string): Promise<any> {
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

  const queryParams = [
    "sessionId=" + mmData.sessionId,
    "token=" + encodeURIComponent(fsData.token),
    "accessToken=" + encodeURIComponent(fsData.token),
    "auth=" + encodeURIComponent(fsData.token),
    "jwt=" + encodeURIComponent(fsData.token)
  ].join("&");

  const wsUrl = `wss://${mmData.room.publicAddress}/${mmData.room.processId}/${mmData.room.roomId}?${queryParams}`;
  const { ws, acceptIfNeeded } = await createGameWebSocket(wsUrl);

  return new Promise((resolve, reject) => {
    let responded = false;

    const timeoutHandle = setTimeout(() => {
      if (responded) return;
      responded = true;
      try { ws?.close(); } catch (_) {}
      reject(new Error("Player lookup timed out. Game servers did not respond."));
    }, 6000);

    try {
      ws.binaryType = "arraybuffer";
    } catch (_) {}

    ws.addEventListener("message", async (event: any) => {
      try {
        let raw = event.data;
        if (typeof Blob !== "undefined" && raw instanceof Blob) {
          raw = await raw.arrayBuffer();
        }
        let buffer: ArrayBuffer;
        if (raw instanceof ArrayBuffer) {
          buffer = raw;
        } else if (raw?.buffer instanceof ArrayBuffer) {
          buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
        } else {
          return;
        }

        const bytes = new Uint8Array(buffer);
        const code = bytes[0];

        if (code === JOIN_ROOM) {
          const ack = new Uint8Array([JOIN_ROOM]);
          ws.send(ack.buffer);

          const packet = buildSendPacket("Client:GiftVIP:FindPlayer", { username: username.trim() });
          ws.send(packet);

        } else if (code === ROOM_DATA) {
          let type: string | number;
          let payloadOffset: number;

          try {
            [type, payloadOffset] = msgpackDecodePartial(buffer, 1);
          } catch (typeErr: any) {
            return;
          }

          if (type === "Server:GiftVIP:FindPlayerCallback") {
            const slicedBuffer = buffer.slice(payloadOffset);
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
              if (!message || !message.found) {
                reject(new Error("Player not found."));
              } else {
                resolve({
                  username: message.username,
                  level: message.inv?.level || 1,
                  gold: message.inv?.gold || 0,
                  power: message.inv?.power || 0,
                  _id: message._id
                });
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
        const reason = event.reason ? `: ${event.reason}` : "";
        reject(new Error(`WebSocket closed by game host (Code ${event.code || 1006}${reason}).`));
      }
    });

    acceptIfNeeded();
  });
}
