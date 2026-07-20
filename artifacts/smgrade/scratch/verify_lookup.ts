import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const msgpack = _require("../src/api-server/msgpack.cjs");

async function verify() {
  const testUser = "Takajakis";
  console.log(`Verifying lookup for username: "${testUser}"...`);

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

  console.log("WebSocket URL:", wsUrl);

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

  ws.addEventListener("open", () => {
    console.log("WebSocket open.");
  });

  ws.addEventListener("message", (event: any) => {
    try {
      const data = event.data as ArrayBuffer;
      const bytes = Array.from(new Uint8Array(data));
      const code = bytes[0];

      if (code === JOIN_ROOM) {
        console.log("JOIN_ROOM received. Acknowledging...");
        const ack = new Uint8Array([JOIN_ROOM]);
        ws.send(ack.buffer);

        console.log("Sending Client:SkinStatue:GetPlayerInfo...");
        const packet = buildSendPacket("Client:SkinStatue:GetPlayerInfo", { username: testUser });
        ws.send(packet);

      } else if (code === ROOM_DATA) {
        let type: string | number;
        let payloadOffset: number;

        [type, payloadOffset] = msgpack.decodePartial(data, 1);
        console.log("Received type:", type);

        const slicedBuffer = data.slice(payloadOffset);
        const message = msgpack.decode(slicedBuffer, 0);

        if (type === "Server:SkinStatue:GetPlayerInfo") {
          console.log("PlayerInfo received!");
          const rawData = message.playerInfo || message;
          const inv = rawData.inv || {};
          console.log("--- STORAGE CONTENTS ---");
          console.log(JSON.stringify(inv.storage, null, 2));
          console.log("------------------------");
          ws.close();
          process.exit(0);
        }
      }
    } catch (err: any) {
      console.error("Message processing error:", err.message);
    }
  });

  ws.addEventListener("close", () => {
    console.log("WebSocket closed.");
  });
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
