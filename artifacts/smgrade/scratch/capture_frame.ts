import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const msgpack = _require("../src/api-server/msgpack.cjs");

async function capture() {
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

  console.log("Connecting to:", wsUrl);

  const ws = new (globalThis as any).WebSocket(wsUrl);
  ws.binaryType = "arraybuffer";

  ws.addEventListener("message", (event: any) => {
    const data = event.data as ArrayBuffer;
    const bytes = Array.from(new Uint8Array(data));
    const opcode = bytes[0];
    
    console.log("FIRST FRAME RECEIVED!");
    console.log("Packet Opcode (Byte 0):", opcode);
    console.log("Raw Bytes (length " + bytes.length + "):", bytes);
    
    // In Colyseus, the first frame is JOIN_ROOM (opcode 10)
    // The format is: [10, ...serializer_id_bytes...]
    if (opcode === 10) {
      // Decode the serializer ID which starts at byte 1 as a msgpack string, or check its bytes
      // Let's decode the bytes starting at index 1 using msgpack
      try {
        const [serializerId, offset] = msgpack.decodePartial(data, 1);
        console.log("Serializer ID decoded:", serializerId);
      } catch (err: any) {
        console.error("Failed to decode serializer ID as MsgPack:", err.message);
        // Fallback: try decoding as string
        const str = String.fromCharCode(...bytes.slice(1));
        console.log("Raw ascii after opcode:", str);
      }
    }
    ws.close();
    process.exit(0);
  });
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
