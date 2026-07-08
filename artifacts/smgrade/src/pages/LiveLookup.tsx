import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
// @ts-ignore
import { Client, registerSerializer } from "colyseus.js";
import { ParticleBackground } from "./Home";

class DummySerializer {
  setState(rawState: any) {}
  getState() { return null; }
  patch(patches: any) {}
  teardown() {}
  handshake(bytes: any, it: any) {}
}

// Register dummy fallback serializer signatures
registerSerializer("j6CSBEPV_", DummySerializer);
registerSerializer("CFQ2R9YEZ", DummySerializer);
registerSerializer("9qPNKmk1V", DummySerializer);
registerSerializer("none", DummySerializer);

interface StepItem {
  id: number;
  label: string;
}

const STEPS: StepItem[] = [
  { id: 1, label: "findServer completed" },
  { id: 2, label: "joinOrCreate completed" },
  { id: 3, label: "Seat reservation received" },
  { id: 4, label: "Colyseus client created" },
  { id: 5, label: "WebSocket connected" },
  { id: 6, label: "Room joined" },
  { id: 7, label: "PlayerInfo request sent" },
  { id: 8, label: "Waiting for Server:SkinStatue:GetPlayerInfo" }
];

export default function LiveLookup() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  // Connection steps progress states
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [stepStatuses, setStepStatuses] = useState<Record<number, "idle" | "loading" | "success" | "failed">>({
    1: "idle",
    2: "idle",
    3: "idle",
    4: "idle",
    5: "idle",
    6: "idle",
    7: "idle",
    8: "idle"
  });

  const stepTimeoutRef = useRef<any>(null);
  const activeRoomRef = useRef<any>(null);
  const diagInfo = useRef({
    wsUrl: "",
    roomId: "",
    sessionId: "",
    processId: "",
    publicAddress: "",
    consumed: false,
    connectCalled: false,
    wsConstructorCalled: false,
    wsCloseCode: null as number | null,
    wsCloseReason: ""
  });

  // Clean up connection and timers on unmount
  useEffect(() => {
    return () => {
      if (stepTimeoutRef.current) clearTimeout(stepTimeoutRef.current);
      if (activeRoomRef.current) activeRoomRef.current.leave();
    };
  }, []);

  const resetLookupState = () => {
    setError(null);
    setData(null);
    setCurrentStep(0);
    diagInfo.current = {
      wsUrl: "",
      roomId: "",
      sessionId: "",
      processId: "",
      publicAddress: "",
      consumed: false,
      connectCalled: false,
      wsConstructorCalled: false,
      wsCloseCode: null,
      wsCloseReason: ""
    };
    setStepStatuses({
      1: "idle",
      2: "idle",
      3: "idle",
      4: "idle",
      5: "idle",
      6: "idle",
      7: "idle",
      8: "idle"
    });
    if (stepTimeoutRef.current) clearTimeout(stepTimeoutRef.current);
    if (activeRoomRef.current) {
      activeRoomRef.current.leave();
      activeRoomRef.current = null;
    }
  };

  const failLookup = (stepId: number, message: string) => {
    if (stepTimeoutRef.current) clearTimeout(stepTimeoutRef.current);
    setStepStatuses(prev => ({ ...prev, [stepId]: "failed" }));

    const diagChecklist = `Error at Step ${stepId}: ${message}

DIAGNOSTIC REPORT:
1. WebSocket URL: ${diagInfo.current.wsUrl || "Not initiated"}
2. Room ID: ${diagInfo.current.roomId || "Not resolved"}
3. Session ID: ${diagInfo.current.sessionId || "Not resolved"}
4. Process ID: ${diagInfo.current.processId || "Not resolved"}
5. Matchmaker Endpoint: ${diagInfo.current.publicAddress || "Not resolved"}
6. Seat Reservation Consumed: ${diagInfo.current.consumed ? "Yes" : "No"}
7. room.connect() Invoked: ${diagInfo.current.connectCalled ? "Yes" : "No"}
8. Browser WebSocket Request Attempted: ${diagInfo.current.wsConstructorCalled ? "Yes" : "No"}
9. Explanation if never opened: ${diagInfo.current.wsConstructorCalled ? "N/A - Constructor was called" : "Constructor was not called. This could be due to library caching."}
10. Socket Close Code: ${diagInfo.current.wsCloseCode || "N/A"} | Reason: ${diagInfo.current.wsCloseReason || "N/A"}`;

    setError(diagChecklist);
    setLoading(false);
    if (activeRoomRef.current) {
      activeRoomRef.current.leave();
      activeRoomRef.current = null;
    }
  };

  const executeStep = async (stepId: number, task: () => Promise<any>): Promise<any> => {
    setCurrentStep(stepId);
    setStepStatuses(prev => ({ ...prev, [stepId]: "loading" }));

    // Set 10-second timeout limit for the current step
    stepTimeoutRef.current = setTimeout(() => {
      failLookup(stepId, "Connection step timed out after 10 seconds.");
    }, 10000);

    try {
      const result = await task();
      
      // Mark step successful and clear timeout
      if (stepTimeoutRef.current) clearTimeout(stepTimeoutRef.current);
      setStepStatuses(prev => ({ ...prev, [stepId]: "success" }));
      return result;
    } catch (err: any) {
      if (stepTimeoutRef.current) clearTimeout(stepTimeoutRef.current);
      failLookup(stepId, err.message || "Execution encountered an error.");
      throw err;
    }
  };

  const handleFetch = async () => {
    if (!username.trim()) {
      setError("Please enter a player username.");
      return;
    }

    setLoading(true);
    resetLookupState();

    try {
      // Step 1: findServer
      const fsData = await executeStep(1, async () => {
        const res = await fetch("https://loadbalancer.swordmasters.io/api/server/findServer", {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
        if (!res.ok) throw new Error(`Load balancer returned status ${res.status}`);
        const json = await res.json();
        if (!json.token) throw new Error("Load balancer did not provide authentication token.");
        return json;
      });

      // Step 2: joinOrCreate
      const host = fsData.data?.foundServer || "eu1";
      const mmData = await executeStep(2, async () => {
        const res = await fetch(`https://${host}.swordmasters.io/matchmake/joinOrCreate/world_1`, {
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
        if (!res.ok) throw new Error(`Matchmaker request failed with status ${res.status}`);
        return await res.json();
      });

      // Step 3: Seat reservation received
      await executeStep(3, async () => {
        if (!mmData.room || !mmData.room.publicAddress || !mmData.sessionId) {
          throw new Error("Matchmaker response payload is missing reservation data.");
        }
        diagInfo.current.roomId = mmData.room.roomId;
        diagInfo.current.sessionId = mmData.sessionId;
        diagInfo.current.processId = mmData.room.processId;
        diagInfo.current.publicAddress = mmData.room.publicAddress;
      });

      // Step 4: Colyseus client created
      const client = await executeStep(4, async () => {
        const cl = new Client(`wss://${mmData.room.publicAddress}`);
        
        // Override buildEndpoint to inject validation tokens
        cl.buildEndpoint = function (room: any, options: any) {
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
        return cl;
      });

      // Step 5: WebSocket connected
      const room = await executeStep(5, async () => {
        const rm = client.createRoom(mmData.room.name);
        rm.id = mmData.room.roomId;
        rm.sessionId = mmData.sessionId;
        activeRoomRef.current = rm;
        diagInfo.current.consumed = true;

        const wsUrl = client.buildEndpoint(mmData.room, { sessionId: rm.sessionId });
        diagInfo.current.wsUrl = wsUrl;

        // Log outgoing messages
        const originalSend = rm.send;
        rm.send = function (type: any, message?: any) {
          console.log(`[Outgoing Message] Type: ${type}, Payload:`, message);
          return originalSend.call(this, type, message);
        };

        // Log incoming raw packets
        const originalCallback = rm.onMessageCallback;
        rm.onMessageCallback = function (event: MessageEvent) {
          console.log("[Incoming WebSocket Packet - Raw]:", event.data);
          return originalCallback.call(this, event);
        };

        // Log incoming decoded messages
        rm.onMessage("*", (type: string, message: any) => {
          console.log(`[Incoming Message - Decoded] Type: ${type}, Payload:`, message);
          if (type === "Server:SkinStatue:GetPlayerInfo") {
            console.log("[Success] Server:SkinStatue:GetPlayerInfo was received!");
          }
        });

        // Trigger connect synchronously
        diagInfo.current.connectCalled = true;
        console.log("[WebSocket Trace] Calling rm.connect(wsUrl). wsUrl:", wsUrl);
        rm.connect(wsUrl);
        console.log("[WebSocket Trace] rm.connect() returned synchronously.");

        // Retrieve native WebSocket
        const ws = (rm.connection?.transport as any)?.ws as WebSocket;

        return new Promise((resolve, reject) => {
          if (!ws) {
            console.error("[WebSocket Trace] Native WebSocket instance not found on room connection.");
            reject(new Error("WebSocket transport was not constructed by the library."));
            return;
          }

          console.log("[WebSocket Trace] Native WebSocket successfully retrieved:", ws);
          diagInfo.current.wsConstructorCalled = true;

          let resolved = false;

          ws.addEventListener("open", () => {
            console.log("[WebSocket Trace] Native WebSocket open event fired.");
            if (!resolved) {
              resolved = true;
              resolve(rm);
            }
          });

          ws.addEventListener("close", (event) => {
            console.warn(`[WebSocket Trace] Native WebSocket close event fired. Code: ${event.code}, Reason: ${event.reason}`);
            diagInfo.current.wsCloseCode = event.code;
            diagInfo.current.wsCloseReason = event.reason || "Abnormal closure / Network unreachable";
            if (!resolved) {
              resolved = true;
              reject(new Error(`WebSocket closed. Code: ${event.code}. Reason: ${diagInfo.current.wsCloseReason}`));
            }
          });

          // Fallback check: If the socket is already open, resolve immediately
          if (ws.readyState === WebSocket.OPEN) {
            console.log("[WebSocket Trace] WebSocket is already open (readyState === OPEN). Resolving.");
            if (!resolved) {
              resolved = true;
              resolve(rm);
            }
          }

          rm.onError((code: number, message?: string) => {
            if (!resolved) {
              resolved = true;
              reject(new Error(`WebSocket error ${code}: ${message || "Connection refused"}`));
            }
          });
        });
      });

      // Step 6: Room joined
      await executeStep(6, async () => {
        return new Promise((resolve, reject) => {
          room.onJoin.once(() => {
            resolve(true);
          });

          room.onError((code: number, message?: string) => {
            reject(new Error(`Room join rejected ${code}: ${message || ""}`));
          });
        });
      });

      // Step 7: PlayerInfo request sent
      await executeStep(7, async () => {
        room.send("Client:SkinStatue:GetPlayerInfo", { username: username.trim() });
      });

      // Step 8: Waiting for Server:SkinStatue:GetPlayerInfo
      await executeStep(8, async () => {
        return new Promise((resolve, reject) => {
          room.onMessage("Server:SkinStatue:GetPlayerInfo", (message: any) => {
            const rawData = message.playerInfo || message;
            const hasData = rawData && (rawData.username || (rawData.inv && rawData.inv.level !== undefined));

            if (hasData) {
              const inv = rawData.inv || rawData;

              // Normalize the fields so the UI reads from a unified schema
              const normalized = {
                username: rawData.username || "Unknown",
                level: typeof inv.level === 'number' ? inv.level : 0,
                gold: typeof inv.gold === 'number' ? inv.gold : 0,
                power: typeof inv.power === 'number' ? inv.power : 0,
                activeWeapon: inv.activeSword || inv.activeWeapon || null,
                activeShield: inv.activeShield || null,
                activePets: inv.activePets || [],
                raw: message
              };

              setData(normalized);
              room.leave();
              activeRoomRef.current = null;
              setLoading(false);
              resolve(true);
            } else {
              reject(new Error("Player not found: Game server returned empty inventory packet."));
            }
          });

          room.onError((code: number, message?: string) => {
            reject(new Error(`Query failed inside room. Error ${code}: ${message}`));
          });
        });
      });

    } catch (err) {
      // Caught errors are logged to the screen via failLookup and stop the flow
      console.error("Live connection lookup trace failed:", err);
    }
  };

  const getStepStatusDisplay = (stepId: number) => {
    const status = stepStatuses[stepId];
    if (status === "loading") {
      return (
        <div className="flex items-center gap-2 text-[#ffd700]">
          <span className="w-2 h-2 rounded-full bg-[#ffd700] animate-ping" />
          <span className="font-bold">Connecting...</span>
        </div>
      );
    }
    if (status === "success") {
      return <span className="text-[#ffd700] font-bold">✓ Completed</span>;
    }
    if (status === "failed") {
      return <span className="text-red-500 font-bold">✗ Failed</span>;
    }
    return <span className="text-white/20">○ Pending</span>;
  };

  return (
    <div className="min-h-screen text-white flex flex-col relative overflow-hidden bg-[#03050b]">
      <ParticleBackground />

      {/* Header HUD */}
      <header className="border-b border-white/[0.04] px-6 py-4 flex items-center justify-between sticky top-0 bg-[#070b13]/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-amber-400 font-black text-xl font-display tracking-tight cursor-pointer hover:opacity-80 transition-opacity">
            SM<span className="text-white">Grade</span>
          </Link>
          <span className="text-white/20 text-xs font-mono select-none">/ live-lookup-test</span>
        </div>
        <Link href="/" className="text-xs text-white/50 hover:text-white border border-white/[0.1] px-3 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-all cursor-pointer">
          Back to Portal
        </Link>
      </header>

      <main className="max-w-4xl mx-auto w-full px-6 py-10 z-10 flex-1 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-black font-display tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-100 to-orange-400">
            Live Player Lookup
          </h1>
          <p className="text-xs text-white/50 font-medium">
            Step-by-step browser connection verification console for direct Colyseus diagnostics.
          </p>
        </div>

        {/* Action Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 border border-white/[0.04] bg-[#05050f]/80 backdrop-blur-xl rounded-2xl p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-xs text-amber-400 uppercase font-black tracking-wider block">Player Username</label>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Enter SwordMasters Character Name (e.g. Harrison)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  className="flex-1 bg-white/[0.02] border border-white/[0.08] focus:border-amber-500/50 outline-none rounded-xl px-4 py-3 text-sm transition-all placeholder:text-white/20"
                />
                <button
                  onClick={handleFetch}
                  disabled={loading}
                  className="bg-amber-500 hover:bg-amber-400 disabled:bg-white/5 disabled:text-white/20 text-black font-black text-sm px-6 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:shadow-[0_0_25px_rgba(245,158,11,0.35)] cursor-pointer"
                >
                  {loading ? "Connecting..." : "Fetch Player"}
                </button>
              </div>
            </div>

            {error && (
              <div className="border border-red-500/20 bg-red-500/[0.03] text-red-400 text-xs p-4 rounded-xl text-left font-medium leading-relaxed">
                <strong className="block text-red-500 font-bold mb-1">Diagnostic Error</strong>
                {error}
              </div>
            )}

            {/* Connection Flow Status HUD */}
            <div className="border border-white/[0.03] bg-[#070b13]/30 p-5 rounded-xl space-y-3.5">
              <h3 className="text-xs text-white/40 uppercase font-black tracking-wider border-b border-white/[0.03] pb-2">
                Live Instrumentation Sequence
              </h3>
              <div className="space-y-2.5">
                {STEPS.map((step) => (
                  <div 
                    key={step.id} 
                    className={`flex justify-between items-center bg-white/[0.01] border p-3 rounded-xl transition-all text-xs font-semibold ${
                      currentStep === step.id 
                        ? "border-amber-500/30 bg-amber-500/[0.02]" 
                        : "border-white/[0.03]"
                    }`}
                  >
                    <span className={currentStep === step.id ? "text-amber-400" : "text-white/60"}>
                      Step {step.id}: {step.label}
                    </span>
                    {getStepStatusDisplay(step.id)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Stats Summary */}
          <div className="border border-white/[0.04] bg-[#070b13]/85 backdrop-blur-xl rounded-2xl p-6 flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-xs text-amber-400 uppercase font-black tracking-wider block mb-4">Player Details</h3>
              <div className="space-y-3.5 text-xs font-semibold">
                <div className="flex justify-between border-b border-white/[0.02] pb-2.5">
                  <span className="text-white/40">Username</span>
                  <span>{data ? data.username : "—"}</span>
                </div>
                <div className="flex justify-between border-b border-white/[0.02] pb-2.5">
                  <span className="text-white/40">Level</span>
                  <span>{data ? `Lv${data.level}` : "—"}</span>
                </div>
                <div className="flex justify-between border-b border-white/[0.02] pb-2.5">
                  <span className="text-white/40">Power</span>
                  <span>{data ? data.power?.toLocaleString() : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Gold</span>
                  <span>{data ? `${data.gold?.toLocaleString()} Gold` : "—"}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-white/[0.01] border border-white/[0.03] p-3.5 rounded-xl text-[10px] text-white/30 leading-normal font-medium">
              ✦ Runs entirely client-side.<br />
              ✦ Handshakes direct with SwordMasters load balancer and joins room instance over WSS.
            </div>
          </div>
        </div>

        {/* Inventory Items HUD Grid */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Sword Card */}
            <div className="border border-white/[0.04] bg-[#070b13]/85 backdrop-blur-xl rounded-2xl p-5 space-y-4">
              <h3 className="text-xs text-amber-400 uppercase font-black tracking-wider flex items-center gap-2">
                ⚔️ Equipped Sword
              </h3>
              {data.activeWeapon ? (
                <div className="space-y-2 text-xs font-semibold">
                  <div className="flex justify-between">
                    <span className="text-white/45">Item ID</span>
                    <span className="font-mono text-[10px]">{data.activeWeapon.itemId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/45">Type ID</span>
                    <span>{data.activeWeapon.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/45">Level</span>
                    <span>Lv{data.activeWeapon.level}</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-white/30 italic">None equipped</div>
              )}
            </div>

            {/* Shield Card */}
            <div className="border border-white/[0.04] bg-[#070b13]/85 backdrop-blur-xl rounded-2xl p-5 space-y-4">
              <h3 className="text-xs text-amber-400 uppercase font-black tracking-wider flex items-center gap-2">
                🛡️ Equipped Shield
              </h3>
              {data.activeShield ? (
                <div className="space-y-2 text-xs font-semibold">
                  <div className="flex justify-between">
                    <span className="text-white/45">Item ID</span>
                    <span className="font-mono text-[10px]">{data.activeShield.itemId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/45">Type ID</span>
                    <span>{data.activeShield.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/45">Level</span>
                    <span>Lv{data.activeShield.level}</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-white/30 italic">None equipped</div>
              )}
            </div>

            {/* Pets Card */}
            <div className="border border-white/[0.04] bg-[#070b13]/85 backdrop-blur-xl rounded-2xl p-5 space-y-4">
              <h3 className="text-xs text-amber-400 uppercase font-black tracking-wider flex items-center gap-2">
                🐾 Active Pets
              </h3>
              {data.activePets && data.activePets.length > 0 ? (
                <div className="space-y-2 text-xs font-semibold">
                  {data.activePets.map((pet: any, idx: number) => (
                    <div key={idx} className="flex justify-between border-b border-white/[0.02] pb-1.5 last:border-0 last:pb-0">
                      <span className="text-white/45">Pet {idx + 1} (Type {pet.type})</span>
                      <span className="font-mono text-[10px]">{pet.itemId}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-white/30 italic">No active pets</div>
              )}
            </div>
          </div>
        )}

        {/* Raw Inventory JSON HUD */}
        {data && (
          <div className="border border-white/[0.04] bg-[#070b13]/85 backdrop-blur-xl rounded-2xl p-6 space-y-3">
            <h3 className="text-xs text-amber-400 uppercase font-black tracking-wider">
              Raw Inventory JSON payload
            </h3>
            <pre className="bg-[#03050b] border border-white/[0.05] p-5 rounded-xl text-left text-[11px] font-mono text-[#ffd700]/80 overflow-auto max-h-[300px] leading-relaxed select-all">
              {JSON.stringify(data.raw || data, null, 2)}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}
