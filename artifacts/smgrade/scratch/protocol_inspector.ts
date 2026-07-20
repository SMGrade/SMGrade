import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const msgpack = _require("../src/api-server/msgpack.cjs");

async function inspectProtocol() {
  const testUser = "kitsune";
  console.log(`Initiating protocol inspection using Live Lookup connection flow...`);

  // 1. findServer
  const fsRes = await fetch("https://loadbalancer.swordmasters.io/api/server/findServer", {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  const fsData: any = await fsRes.json();
  const host = fsData.data?.foundServer || "eu1";

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
  const mmData: any = await mmRes.json();
  const { processId, roomId } = mmData.room;
  const sessionId = mmData.sessionId || "";
  const wsUrl = `wss://${mmData.room.publicAddress}/${processId}/${roomId}?sessionId=${sessionId}`;

  console.log("Connecting to:", wsUrl.split("?")[0]);

  const ws = new (globalThis as any).WebSocket(wsUrl);
  ws.binaryType = "arraybuffer";

  const JOIN_ROOM = 10;
  const ROOM_DATA = 13;

  const buildSendPacket = (type: string, message: unknown): ArrayBuffer => {
    const typeBytes = new Uint8Array(msgpack.encode(type) as ArrayBuffer);
    const payloadBytes = new Uint8Array(msgpack.encode(message) as ArrayBuffer);
    const result = new Uint8Array(1 + typeBytes.byteLength + payloadBytes.byteLength);
    result[0] = ROOM_DATA;
    result.set(typeBytes, 1);
    result.set(payloadBytes, 1 + typeBytes.byteLength);
    return result.buffer;
  };

  const startTime = Date.now();
  const eventLog: any[] = [];
  const eventCounts: Record<string, number> = {};

  ws.addEventListener("open", () => {
    console.log("WebSocket open. Monitoring messages for 60 seconds...");
  });

  ws.addEventListener("message", (event: any) => {
    try {
      const data = event.data as ArrayBuffer;
      const bytes = Array.from(new Uint8Array(data));
      const code = bytes[0];

      if (code === JOIN_ROOM) {
        const ack = new Uint8Array([JOIN_ROOM]);
        ws.send(ack.buffer);

        // Send a GetPlayerInfo request for our monitor user
        const packet = buildSendPacket("Client:SkinStatue:GetPlayerInfo", { username: testUser });
        ws.send(packet);
      } else if (code === ROOM_DATA) {
        let type: string | number;
        let payloadOffset: number;

        [type, payloadOffset] = msgpack.decodePartial(data, 1);
        const slicedBuffer = data.slice(payloadOffset);
        const message = msgpack.decode(slicedBuffer, 0);

        const typeStr = String(type);
        eventCounts[typeStr] = (eventCounts[typeStr] || 0) + 1;

        if (eventLog.length < 500) {
          eventLog.push({
            time: ((Date.now() - startTime) / 1000).toFixed(2) + "s",
            type: typeStr,
            message
          });
        }
      }
    } catch (err: any) {
      console.error("Decoding error:", err.message);
    }
  });

  // Stay connected for 65 seconds to monitor passive events
  await new Promise((resolve) => setTimeout(resolve, 65000));
  ws.close();

  console.log("\n--- PROTOCOL MONITOR SUMMARY ---");
  console.log("Unique events caught:", Object.keys(eventCounts));
  console.log("Event frequencies:", eventCounts);
  console.log("\n--- SAMPLE PAYLOADS ---");
  
  // Show one sample of each event type
  const seen = new Set<string>();
  for (const log of eventLog) {
    if (!seen.has(log.type)) {
      seen.add(log.type);
      console.log(`\nEvent Name: "${log.type}" (at ${log.time})`);
      console.log("Payload:", JSON.stringify(log.message, null, 2).substring(0, 1000));
    }
  }
}

inspectProtocol().catch(console.error);
