import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = '/Users/machd/.gemini/antigravity/brain/95430ef8-08a8-4fc3-8dd9-ab262242e124';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9245;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runTargetedDwarfFixSuite() {
  console.log('=== STARTING TARGETED DWARF FIX VERIFICATION SUITE ===');

  const testResults = {
    level3To4Success: false,
    level4To5Success: false,
    level8To9Success: false,
    level9To10Success: false,
    multiLevels1_2_5_6_Success: false,
    level10CapRejection: false,
    burnFailureIntact: false,
    rapidClickDebounced: false,
    animationAndInventoryAgree: false
  };

  const tempProfileDir = '/tmp/chrome-targeted-dwarf-' + Date.now();
  const chromeProc = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--use-gl=angle',
      '--use-angle=metal',
      '--enable-webgl',
      `--remote-debugging-port=${PORT}`,
      '--window-size=1280,800',
      `--user-data-dir=${tempProfileDir}`,
      'http://localhost:5173/arcade',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  chromeProc.stderr.on('data', (d) => {
    // console.log('[Chrome Stderr]:', d.toString());
  });

  await sleep(4000);

  let targets = null;
  for (let i = 0; i < 15; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      targets = await res.json();
      if (targets && targets.length > 0) break;
    } catch {
      await sleep(500);
    }
  }

  if (!targets || targets.length === 0) {
    chromeProc.kill();
    throw new Error('Could not connect to Chrome debugging target');
  }

  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const wsUrl = pageTarget.webSocketDebuggerUrl;

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let idCounter = 1;
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = idCounter++;
      const handler = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');

  async function evalInIframe(code) {
    const expr = `
      (() => {
        const iframe = document.querySelector('iframe');
        if (!iframe || !iframe.contentWindow) return null;
        return iframe.contentWindow.eval(${JSON.stringify(code)});
      })()
    `;
    const res = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  }

  async function takeScreenshot(name) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(ARTIFACT_DIR, `${name}.png`);
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved screenshot: ${outPath}`);
    return outPath;
  }

  try {
    // 1. Wait for game to boot inside iframe
    console.log('\n--- Step 1: Wait for Game Boot ---');
    let gameReady = false;
    for (let i = 0; i < 40; i++) {
      const check = await evalInIframe(`
        (() => {
          const startBtn = document.getElementById('sm-start-submit-btn');
          if (startBtn) startBtn.click();

          const app = window.pcApp || (window.pc && window.pc.Application && window.pc.Application.getApplication());
          const nm = app?.networkManager;
          const player = nm?.currentPlayerEntity;
          const room = window.standaloneRoom;
          return {
            hasApp: !!app,
            hasNM: !!nm,
            hasPlayer: !!player,
            hasRoom: !!room
          };
        })()
      `);
      if (check && check.hasApp && check.hasNM && check.hasRoom && check.hasPlayer) {
        console.log('✓ Game runtime ready:', check);
        gameReady = true;
        break;
      }
      await sleep(1000);
    }

    if (!gameReady) {
      throw new Error('Game failed to initialize in iframe.');
    }

    // Helper function to test a specific forge level
    async function testForgeLevel(startLvl, expectedResultLvl, forceSuccess = true) {
      return await evalInIframe(`
        (async () => {
          const room = window.standaloneRoom;
          room.isForging = false;
          const app = window.pcApp;
          const upgraderUI = app.root.findByName('UpgraderUI');
          const upgraderCtrl = upgraderUI.script.upgraderController;

          // Add fresh item with starting level
          const testItem = window.addStandaloneItem({ isSword: true, type: 30, level: ${startLvl} });
          upgraderCtrl.show();
          await upgraderCtrl.setForgeItem(testItem, true);

          const inputLevel = testItem.level;

          // Send forge request
          room.handleClientMessage('Client:UpgraderController:forge', {
            activeItemId: testItem.itemId,
            forceSuccess: ${forceSuccess}
          });

          // Read animation text immediately during presentation
          const animText = upgraderCtrl.itemForgedPanelItemName?.element?.text || '';
          const animItemName = upgraderCtrl.itemData?.name || '';
          const finalItemLevel = testItem.level;

          return {
            inputLevel,
            expectedResultLvl: ${expectedResultLvl},
            finalItemLevel,
            animText,
            animItemName,
            animMatchesInventory: animText.includes('Level ' + ${expectedResultLvl}),
            animDoesNotHaveOverUpgrade: !animText.includes('Level ' + (${expectedResultLvl} + 1))
          };
        })()
      `);
    }

    // 2. Test Level 3 -> Level 4
    console.log('\n--- Step 2: Testing Level 3 -> Level 4 Forge ---');
    const res3to4 = await testForgeLevel(3, 4, true);
    console.log('Level 3 -> 4 result:', res3to4);
    testResults.level3To4Success = res3to4.finalItemLevel === 4 && res3to4.animMatchesInventory && res3to4.animDoesNotHaveOverUpgrade;
    await sleep(400);
    await takeScreenshot('proof_targeted_01_level3_to_4_success');

    // 3. Test Level 4 -> Level 5 (The Exact User Reported Mismatch Bug)
    console.log('\n--- Step 3: Testing Level 4 -> Level 5 Forge (Exact Bug Case) ---');
    const res4to5 = await testForgeLevel(4, 5, true);
    console.log('Level 4 -> 5 result:', res4to5);
    testResults.level4To5Success = res4to5.finalItemLevel === 5 && res4to5.animMatchesInventory && res4to5.animDoesNotHaveOverUpgrade;
    await sleep(400);
    await takeScreenshot('proof_targeted_02_level4_to_5_success');

    // 4. Test Level 8 -> Level 9
    console.log('\n--- Step 4: Testing Level 8 -> Level 9 Forge ---');
    const res8to9 = await testForgeLevel(8, 9, true);
    console.log('Level 8 -> 9 result:', res8to9);
    testResults.level8To9Success = res8to9.finalItemLevel === 9 && res8to9.animMatchesInventory && res8to9.animDoesNotHaveOverUpgrade;
    await sleep(400);
    await takeScreenshot('proof_targeted_03_level8_to_9_success');

    // 5. Test Level 9 -> Level 10 (Reaching Cap)
    console.log('\n--- Step 5: Testing Level 9 -> Level 10 Forge (Reaching Cap) ---');
    const res9to10 = await testForgeLevel(9, 10, true);
    console.log('Level 9 -> 10 result:', res9to10);
    testResults.level9To10Success = res9to10.finalItemLevel === 10 && res9to10.animMatchesInventory && res9to10.animDoesNotHaveOverUpgrade;
    await sleep(400);
    await takeScreenshot('proof_targeted_04_level9_to_10_success');

    // 6. Test Multi-Levels: Levels 1, 2, 5, 6
    console.log('\n--- Step 6: Testing Additional Levels (1, 2, 5, 6) ---');
    const res1 = await testForgeLevel(1, 2, true);
    const res2 = await testForgeLevel(2, 3, true);
    const res5 = await testForgeLevel(5, 6, true);
    const res6 = await testForgeLevel(6, 7, true);
    console.log('Multi-levels 1,2,5,6:', { res1, res2, res5, res6 });
    testResults.multiLevels1_2_5_6_Success =
      res1.finalItemLevel === 2 && res1.animMatchesInventory &&
      res2.finalItemLevel === 3 && res2.animMatchesInventory &&
      res5.finalItemLevel === 6 && res5.animMatchesInventory &&
      res6.finalItemLevel === 7 && res6.animMatchesInventory;

    // 7. Test Level 10 Cap Rejection
    console.log('\n--- Step 7: Testing Level 10 Cap Rejection ---');
    const capRes = await evalInIframe(`
      (async () => {
        const room = window.standaloneRoom;
        room.isForging = false;
        const app = window.pcApp;
        const upgraderUI = app.root.findByName('UpgraderUI');
        const upgraderCtrl = upgraderUI.script.upgraderController;

        const maxItem = window.addStandaloneItem({ isSword: true, type: 22, level: 10 });
        upgraderCtrl.show();
        await upgraderCtrl.setForgeItem(maxItem, true);

        room.handleClientMessage('Client:UpgraderController:forge', {
          activeItemId: maxItem.itemId,
          forceSuccess: true
        });

        return {
          level: maxItem.level,
          capEnforced: maxItem.level === 10,
          isForging: room.isForging
        };
      })()
    `);
    console.log('Cap Rejection Result:', capRes);
    testResults.level10CapRejection = capRes.capEnforced && !capRes.isForging;

    // 8. Test Burn / Failure Rule Intact
    console.log('\n--- Step 8: Testing Burn/Failure Rule Intact ---');
    const burnRes = await evalInIframe(`
      (async () => {
        const room = window.standaloneRoom;
        room.isForging = false;
        const app = window.pcApp;
        const upgraderUI = app.root.findByName('UpgraderUI');
        const upgraderCtrl = upgraderUI.script.upgraderController;

        const burnSword = window.addStandaloneItem({ isSword: true, type: 20, level: 3 });
        const initialGold = room.networkManager.goldAmount || 0;
        const swordsCatalog = window.SWORDMASTERS_SWORDS || (window.StaticData && StaticData.swords) || window.swords || [];
        const itemData = swordsCatalog[20] || { priceGold: 1000 };
        const expectedRefund = Math.round((itemData.priceGold || 1000) * Math.pow(2, 3 - 1));

        upgraderCtrl.show();
        await upgraderCtrl.setForgeItem(burnSword, true);

        room.handleClientMessage('Client:UpgraderController:forge', {
          activeItemId: burnSword.itemId,
          forceSuccess: false
        });

        const inv = room.state.playerInventories.items[room.sessionId];
        const itemInInv = inv.swords.items.some(s => s.itemId === burnSword.itemId);
        const finalGold = room.networkManager.goldAmount;

        return {
          itemBurned: !itemInInv,
          goldRefunded: finalGold === initialGold + expectedRefund,
          expectedRefund,
          refundDiff: finalGold - initialGold
        };
      })()
    `);
    console.log('Burn Rule Result:', burnRes);
    testResults.burnFailureIntact = burnRes.itemBurned && burnRes.goldRefunded;
    await sleep(400);
    await takeScreenshot('proof_targeted_05_burn_failure_intact');

    // 9. Rapid Click Concurrency Protection
    console.log('\n--- Step 9: Testing Rapid Click Concurrency Lock ---');
    const rapidRes = await evalInIframe(`
      (async () => {
        const room = window.standaloneRoom;
        room.isForging = false;
        const rapidItem = window.addStandaloneItem({ isSword: true, type: 15, level: 2 });

        room.handleClientMessage('Client:UpgraderController:forge', {
          activeItemId: rapidItem.itemId,
          forceSuccess: true
        });

        const firstLock = room.isForging;

        // Immediate second attempt while lock is held
        room.handleClientMessage('Client:UpgraderController:forge', {
          activeItemId: rapidItem.itemId,
          forceSuccess: true
        });

        return {
          firstLock,
          finalLevel: rapidItem.level,
          didNotDoubleIncrement: rapidItem.level === 3
        };
      })()
    `);
    console.log('Rapid Click Result:', rapidRes);
    testResults.rapidClickDebounced = rapidRes.firstLock && rapidRes.didNotDoubleIncrement;

    testResults.animationAndInventoryAgree =
      testResults.level3To4Success &&
      testResults.level4To5Success &&
      testResults.level8To9Success &&
      testResults.level9To10Success &&
      testResults.multiLevels1_2_5_6_Success;

    console.log('\n==================================================');
    console.log('       TARGETED DWARF FIX TEST SUITE RESULTS       ');
    console.log('==================================================');
    console.log(JSON.stringify(testResults, null, 2));
    const allPassed = Object.values(testResults).every(v => v === true);
    console.log(`\nOVERALL SUITE STATUS: ${allPassed ? 'ALL TESTS PASSED ✅' : 'FAILURES DETECTED ❌'}`);

    ws.close();
    chromeProc.kill();
    return allPassed;
  } catch (err) {
    console.error('Test Suite Error:', err);
    ws.close();
    chromeProc.kill();
    return false;
  }
}

runTargetedDwarfFixSuite().then((success) => {
  process.exit(success ? 0 : 1);
});
