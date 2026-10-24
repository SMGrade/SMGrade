import { formatNumber } from "./numberParser.js";
import { resolveItemByGameType } from "./gearDatabase.js";
import type { ParsedPlayer } from "./parser.js";
import { queryLivePlayer, queryLivePlayerLightweight } from "./gameProtocol.js";

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
  if (onStatusUpdate) onStatusUpdate({ step: 1, message: "Connecting to game server via live protocol..." });
  try {
    const playerInfo = await queryLivePlayer(username);
    if (onStatusUpdate) onStatusUpdate({ step: 2, message: "Extracting inventory..." });
    return playerInfo;
  } catch (err: any) {
    throw err;
  }
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
  const swordName = swItem ? swItem.name : "None";
  const swordLevel = swItem ? (inv.activeSword?.level || 1) : 0;
  const swordString = swordName === "None" ? "None" : `${swordName}, Level ${swordLevel} 100%`;

  const shieldName = shItem ? shItem.name : "None";
  const shieldLevel = shItem ? (inv.activeShield?.level || 1) : 0;
  const shieldString = shieldName === "None" ? "None" : `${shieldName}, Level ${shieldLevel} 100%`;

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

/**
 * Connects directly to game server, handshakes, and returns the lightweight player stats.
 */
export async function fetchLivePlayerInfoLightweight(
  username: string,
  onStatusUpdate?: (status: LiveConnectionStatus) => void
): Promise<any> {
  if (onStatusUpdate) onStatusUpdate({ step: 1, message: "Connecting to game server via live protocol..." });
  try {
    const data = await queryLivePlayerLightweight(username);
    if (onStatusUpdate) onStatusUpdate({ step: 2, message: "Retrieved lightweight stats." });
    return data;
  } catch (err: any) {
    throw err;
  }
}
