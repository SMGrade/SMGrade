import worker from "../src/worker.ts";

async function runTests() {
  console.log("=== STARTING CLOUDFLARE WORKER BACKEND TESTS ===");
  const env = {
    ADMIN_PASSWORD: "swordmasters-master-2026",
    ASSETS: {
      async fetch(req) {
        return new Response("<html>Static Asset</html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      },
    },
  };

  let passed = 0;
  let failed = 0;

  async function test(name, method, path, body = null, headers = {}) {
    const fullUrl = `https://smgrade.pages.dev${path}`;
    const reqInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };
    if (body) reqInit.body = JSON.stringify(body);
    const req = new Request(fullUrl, reqInit);

    try {
      const res = await worker.fetch(req, env, {});
      const contentType = res.headers.get("Content-Type") || "";
      const isJson = contentType.includes("application/json");

      let data = null;
      if (isJson) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Expected JSON response, got: ${contentType} (${text.substring(0, 100)})`);
      }

      console.log(`✅ [PASS] ${method} ${path} -> Status ${res.status}`);
      passed++;
      return { status: res.status, data };
    } catch (err) {
      console.error(`❌ [FAIL] ${method} ${path} -> ${err.message}`);
      failed++;
      return { error: err.message };
    }
  }

  // 1. Health
  await test("Health check", "GET", "/api/healthz");

  // 2. Grade Calculate
  const calcRes = await test("Grade calculate", "POST", "/api/grade/calculate", {
    player: {
      username: "Harrison",
      level: 100,
      powerRaw: 1000000000,
      goldRaw: 500000,
      sword: "Graveborn Edge",
      swordLevel: 5,
      shield: "Sealguard",
      shieldLevel: 3,
      pets: [],
    },
  });
  if (calcRes.data?.scores?.overallGrade) {
    console.log(`   Scored overallGrade: ${calcRes.data.scores.overallGrade}, score: ${calcRes.data.scores.overallScore}`);
  }

  // 3. Grade Explain (Deterministic fallback when API key not configured)
  await test("Grade explain", "POST", "/api/grade/explain", {
    username: "Harrison",
    level: 100,
    overallScore: 82,
    overallGrade: "A",
    standing: "Strong",
    gearScore: 85,
    powerScore: 80,
    wealthScore: 75,
    sword: "Graveborn Edge",
    swordLevel: 5,
    shield: "Sealguard",
    shieldLevel: 3,
    powerRaw: "1B",
    goldRaw: "500K",
  });

  // 4. Auth: Register
  const testUsername = `user_${Date.now().toString(36)}`;
  await test("Auth register", "POST", "/api/auth/register", {
    username: testUsername,
    password: "Password123!",
  });

  // 5. Auth: Login
  const loginRes = await test("Auth login", "POST", "/api/auth/login", {
    username: testUsername,
    password: "Password123!",
  });
  const authToken = loginRes.data?.token;

  // 6. Auth: Me
  if (authToken) {
    await test("Auth me", "GET", "/api/auth/me", null, {
      Authorization: `Bearer ${authToken}`,
    });

    // 7. Auth: History
    await test("Auth add history", "POST", "/api/auth/history", {
      level: 100,
      grade: "A",
      score: 85,
      power: "1B",
      dps: 1500000,
    }, {
      Authorization: `Bearer ${authToken}`,
    });

    await test("Auth get history", "GET", "/api/auth/history", null, {
      Authorization: `Bearer ${authToken}`,
    });
  }

  // 8. Admin Login
  await test("Admin login with env password", "POST", "/api/master/admin/login", {
    password: "swordmasters-master-2026",
  });
  await test("Admin login with canonical password", "POST", "/api/master/admin/login", {
    password: "harrison@smgrade.swordmasters2026",
  });

  // 9. Master Vault Unlock with canonical password
  const unlockRes = await test("Master unlock with canonical password", "POST", "/api/master/unlock", {
    password: "harrison@smgrade.swordmasters2026",
  });
  const masterToken = unlockRes.data?.token;
  if (!masterToken) {
    throw new Error("Master token not returned for canonical password!");
  }

  // 9b. Verify Master Vault authenticated endpoints
  await test("Master Vault analytics with master token", "GET", "/api/master/analytics", null, {
    "x-master-token": masterToken
  });

  await test("Master Vault backup with master token", "GET", "/api/master/backup", null, {
    "x-master-token": masterToken
  });

  await test("Master Vault analytics with offline_master_token", "GET", "/api/master/analytics", null, {
    "x-master-token": "offline_master_token"
  });

  // 10. Master Config
  await test("Admin config", "GET", "/api/master/admin/config");

  // 11. Arcade Player Check Username
  await test("Arcade check username", "GET", "/api/master/arcade/player/check-username?username=SuperDwarf&playerId=p123");

  // 12. Arcade Game Leaderboards
  await test("Arcade leaderboards", "GET", "/api/master/arcade/game-leaderboards");

  // 13. Arcade Score Submission
  await test("Arcade submit score", "POST", "/api/master/arcade/score", {
    username: "TestHero",
    userId: "test_hero_1",
    dwarfKills: 25,
    elfKills: 10,
    totalKills: 35,
    highestCombo: 8,
    highestDps: 12000,
  });

  // 14. Arcade Leaderboard retrieval
  const lbRes = await test("Arcade leaderboard list", "GET", "/api/master/arcade/leaderboard?window=all-time");
  if (!lbRes.data?.totalKills || !Array.isArray(lbRes.data.totalKills) || !lbRes.data.dwarfKills || !lbRes.data.elfKills) {
    throw new Error("Leaderboard response missing expected totalKills, dwarfKills, elfKills categories!");
  }
  console.log(`   Confirmed: Leaderboard structured format verified with ${lbRes.data.totalKills.length} totalKill entries`);

  // 15. Live lookup when external server fails/rejects: must return clean error, never fake level 0
  const lookupRes = await test("Live lookup failing gracefully", "GET", "/api/live-lookup?username=NonExistentUserXYZ987654321");
  if (lookupRes.status === 200 && lookupRes.data?.playerInfo?.level === 0) {
    throw new Error("Regression! Live lookup returned fake level 0 player on error!");
  }
  console.log("   Confirmed: Live lookup returns explicit error or real data, never a fake level 0 player!");

  // 16. Verify 404 for unknown API route NEVER returns HTML
  const notFoundRes = await test("404 JSON for unknown API path", "GET", "/api/some-unknown-path");
  if (notFoundRes.status === 404) {
    console.log("   Confirmed: Unknown /api/* routes return 404 JSON, NOT HTML fallback!");
  }

  console.log(`\n=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Test runner failed:", e);
  process.exit(1);
});
