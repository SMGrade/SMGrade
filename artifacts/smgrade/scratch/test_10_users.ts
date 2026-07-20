const usernames = [
  "Takajakis",
  "kitsune12345",
  "Kitsune12345",
  "Drait",
  "Kingdiffer",
  "ODD",
  "TRELOS",
  "Niceface5",
  "Niceface",
  "ZywOo",
  "MightyBoy1"
];

async function runTests() {
  console.log(`Starting Live Lookup test for ${usernames.length} users...\n`);
  
  for (const username of usernames) {
    try {
      const url = `http://localhost:8080/api/live-lookup?username=${encodeURIComponent(username)}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.log(`[${username}] failed with status: ${res.status}`);
        continue;
      }
      const data: any = await res.json();
      if (!data.success) {
        console.log(`[${username}] success=false: ${data.error}`);
        continue;
      }
      
      const playerInfo = data.playerInfo || {};
      const storage = playerInfo.inv?.storage;
      console.log(`[${username}] storage value:`, JSON.stringify(storage));
      
      // Let's search all keys in playerInfo recursively for any room / map / instance / location fields
      const foundFields: string[] = [];
      const searchKeys = (obj: any, prefix = "") => {
        if (!obj || typeof obj !== "object") return;
        for (const key of Object.keys(obj)) {
          const path = prefix ? `${prefix}.${key}` : key;
          const lowerKey = key.toLowerCase();
          if (
            lowerKey.includes("room") ||
            lowerKey.includes("map") ||
            lowerKey.includes("instance") ||
            lowerKey.includes("world") ||
            lowerKey.includes("location") ||
            lowerKey.includes("position") ||
            lowerKey.includes("coord")
          ) {
            foundFields.push(`${path}: ${JSON.stringify(obj[key])}`);
          }
          searchKeys(obj[key], path);
        }
      };
      searchKeys(playerInfo);
      if (foundFields.length > 0) {
        console.log(`[${username}] Potential fields:`, foundFields);
      }
    } catch (err: any) {
      console.log(`[${username}] Error: ${err.message}`);
    }
  }
}

runTests();
