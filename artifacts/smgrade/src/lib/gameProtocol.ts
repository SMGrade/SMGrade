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

export async function createGameWebSocket(wsUrl: string): Promise<any> {
  const wsHeaders = {
    "Origin": "https://swordmasters.io",
    "Referer": "https://swordmasters.io/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  };

  // Cloudflare Workers fetch with Upgrade: websocket
  if (typeof fetch === "function") {
    try {
      const resp = await fetch(wsUrl, {
        headers: {
          ...wsHeaders,
          "Upgrade": "websocket",
        }
      });
      if ((resp as any).webSocket) {
        const ws = (resp as any).webSocket;
        ws.accept();
        return ws;
      }
    } catch (_) {}
  }

  // Global WebSocket constructor (Node.js with ws, or browser)
  if (typeof (globalThis as any).WebSocket !== "undefined") {
    try {
      return new (globalThis as any).WebSocket(wsUrl, { headers: wsHeaders });
    } catch (_) {
      return new (globalThis as any).WebSocket(wsUrl);
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
  const ws = await createGameWebSocket(wsUrl);

  return new Promise((resolve, reject) => {
    let responded = false;

    const timeoutHandle = setTimeout(() => {
      if (responded) return;
      responded = true;
      try { ws?.close(); } catch (_) {}
      reject(new Error("Player lookup timed out. Game servers did not respond."));
    }, 6000);

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
  const ws = await createGameWebSocket(wsUrl);

  return new Promise((resolve, reject) => {
    let responded = false;

    const timeoutHandle = setTimeout(() => {
      if (responded) return;
      responded = true;
      try { ws?.close(); } catch (_) {}
      reject(new Error("Player lookup timed out. Game servers did not respond."));
    }, 6000);

    ws.binaryType = "arraybuffer";

    ws.addEventListener("message", (event: any) => {
      try {
        const data = event.data as ArrayBuffer;
        const bytes = Array.from(new Uint8Array(data)) as number[];
        const code = bytes[0];

        if (code === JOIN_ROOM) {
          const ack = new Uint8Array([JOIN_ROOM]);
          ws.send(ack.buffer);

          const packet = buildSendPacket("Client:GiftVIP:FindPlayer", { username });
          ws.send(packet);

        } else if (code === ROOM_DATA) {
          let type: string | number;
          let payloadOffset: number;

          try {
            [type, payloadOffset] = msgpackDecodePartial(data, 1);
          } catch (typeErr: any) {
            return;
          }

          if (type === "Server:GiftVIP:FindPlayerCallback") {
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
        reject(new Error("WebSocket closed unexpectedly by the game host."));
      }
    });
  });
}
