import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = '/Users/machd/.gemini/antigravity/brain/95430ef8-08a8-4fc3-8dd9-ab262242e124';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9230 + Math.floor(Math.random() * 20);

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runMasterAcceptanceSuite() {
  console.log('=== STARTING FINAL MASTER PROMPT ACCEPTANCE TEST SUITE ===');

  const testResults = {
    modeSelectorLabel: false,
    noRedButton: false,
    usernamePersistence: false,
    dwarfSuccessSingleLevel: false,
    dwarfBurnFailure: false,
    dwarfMaxLevelRejected: false,
    multiMobCombat: false,
    petEquipAndLimit: false,
    masterVaultLogs: false,
    dwarfPuncherPreserved: false
  };

  const tempProfileDir = '/tmp/chrome-final-master-suite-' + Date.now();
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

  await sleep(3500);

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

  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  console.log('Connected to target:', pageTarget.title, pageTarget.url);

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
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

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map((a) => a.value || JSON.stringify(a)).join(' ');
      if (text.includes('[SMGrade') || text.includes('forge') || text.includes('Dwarf') || text.includes('MasterLog')) {
        console.log(`[Browser Console]:`, text);
      }
    }
  });

  await send('Runtime.enable');
  await send('Page.enable');

  async function evalInPage(expr) {
    const res = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    return res?.result?.value;
  }

  async function evalInIframe(expr) {
    const iframeExpr = `
      (() => {
        try {
          const iframe = document.querySelector('iframe');
          if (!iframe || !iframe.contentWindow) return null;
          return iframe.contentWindow.eval(${JSON.stringify(expr)});
        } catch (e) {
          return { error: e.message };
        }
      })()
    `;
    const res = await send('Runtime.evaluate', {
      expression: iframeExpr,
      returnByValue: true,
      awaitPromise: true,
    });
    return res?.result?.value;
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
    // 1. Wait for game to initialize inside iframe
    console.log('\n--- Step 1: Wait for Game Boot and Spawn inside iframe ---');
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
      console.log(`[Boot Check ${i}]:`, check);
      if (check && check.hasApp && check.hasNM && check.hasRoom && check.hasPlayer) {
        console.log('✓ Game Runtime initialized and ready:', check);
        gameReady = true;
        break;
      }
      await sleep(1000);
    }

    if (!gameReady) {
      throw new Error('Game failed to reach active play state in iframe.');
    }
    await takeScreenshot('proof_suite_01_game_spawn_ready');

    // 2. Test Requirement 4: Mode selector renamed to DWARF HUB
    console.log('\n--- Step 2: Verify DWARF HUB Label in Mode Switcher & Iframe Title ---');
    const modeLabelCheck = await evalInPage(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
        const hasDwarfHub = buttons.some(b => b.includes('DWARF HUB'));
        const hasOldLabel = buttons.some(b => b.includes('SwordMasters (Original Game)'));
        const iframe = document.querySelector('iframe');
        const iframeTitle = iframe ? iframe.getAttribute('title') : '';
        return {
          hasDwarfHub,
          hasOldLabel,
          iframeTitle
        };
      })()
    `);
    console.log('Mode Label Check:', modeLabelCheck);
    testResults.modeSelectorLabel = modeLabelCheck.hasDwarfHub && !modeLabelCheck.hasOldLabel && modeLabelCheck.iframeTitle === 'DWARF HUB';

    // 3. Test Requirement 3: Red DWARF BLACKSMITH button removed
    console.log('\n--- Step 3: Verify Red DWARF BLACKSMITH Button is Absent ---');
    const redBtnCheck = await evalInIframe(`
      (() => {
        const btn = document.getElementById('sm-inv-dwarf-trigger');
        const addBtn = document.getElementById('sm-inv-add-trigger');
        const petBtn = document.getElementById('sm-pet-add-trigger');
        return {
          hasDwarfBtn: !!btn,
          hasAddBtn: !!addBtn,
          hasPetBtn: !!petBtn
        };
      })()
    `);
    console.log('Red Button Absence Check:', redBtnCheck);
    testResults.noRedButton = !redBtnCheck.hasDwarfBtn;

    // 4. Test Requirement 5: Username persistence across refresh without modals
    console.log('\n--- Step 4: Verify Username Persistence Across Page Reload ---');
    await evalInIframe(`
      localStorage.setItem('arcade_username', 'GrandMaster_777');
    `);
    // Reload page
    await send('Page.reload');
    await sleep(4000);

    // Wait for game to re-initialize
    for (let i = 0; i < 20; i++) {
      const ready = await evalInIframe(`!!(window.standaloneRoom && window.standaloneRoom.isOnline)`);
      if (ready) break;
      await sleep(500);
    }

    const usernameCheck = await evalInIframe(`
      (() => {
        const panel = document.getElementById('smgrade-start-panel');
        const isPanelHidden = !panel || panel.style.display === 'none' || !panel.classList.contains('active');
        const room = window.standaloneRoom;
        const currentUsername = room?.profile?.username;
        const playerUsername = room?.state?.players?.items[room?.sessionId]?.username;
        return {
          isPanelHidden,
          currentUsername,
          playerUsername
        };
      })()
    `);
    console.log('Username Persistence Check:', usernameCheck);
    testResults.usernamePersistence = usernameCheck.isPanelHidden &&
      (usernameCheck.currentUsername === 'GrandMaster_777' || usernameCheck.playerUsername === 'GrandMaster_777');

    await takeScreenshot('proof_suite_02_username_persistence_no_modal');

    // 5. Test Requirement 1: Dwarfing strictly +1 Level & Debounce Lock
    console.log('\n--- Step 5: Test Dwarfing Strictly +1 Level & Debouncing Lock ---');
    const dwarfSingleLevel = await evalInIframe(`
      (async () => {
        const room = window.standaloneRoom;
        const inv = room.state.playerInventories.items[room.sessionId];
        const app = window.pcApp;
        const upgraderUI = app.root.findByName('UpgraderUI');
        const upgraderCtrl = upgraderUI.script.upgraderController;

        // Add a test sword at level 3
        const testSword = window.addStandaloneItem({ isSword: true, type: 45, level: 3 });

        upgraderCtrl.show();
        await upgraderCtrl.setForgeItem(testSword, true);

        const initialLevel = testSword.level; // 3

        // Send forge request with forceSuccess: true
        room.handleClientMessage('Client:UpgraderController:forge', {
          activeItemId: testSword.itemId,
          forceSuccess: true
        });

        // Test debouncing: immediate second call should be ignored
        const duplicateIgnored = room.isForging;
        room.handleClientMessage('Client:UpgraderController:forge', {
          activeItemId: testSword.itemId,
          forceSuccess: true
        });

        const newLevel = testSword.level; // Must be strictly 4, NOT 5!

        return {
          initialLevel,
          newLevel,
          strictlyPlusOne: newLevel === 4,
          duplicateDebounced: duplicateIgnored,
          testSwordId: testSword.itemId
        };
      })()
    `);
    console.log('Dwarf Single Level Upgrade Check:', dwarfSingleLevel);
    testResults.dwarfSuccessSingleLevel = dwarfSingleLevel.strictlyPlusOne && dwarfSingleLevel.duplicateDebounced;

    await takeScreenshot('proof_suite_03_dwarf_single_level_plus_one');

    // 6. Test Requirement 1: Authentic Failure / Burn Rule with Gold Refund
    console.log('\n--- Step 6: Test Authentic Dwarfing Burn Rule & Gold Refund ---');
    const dwarfBurnCheck = await evalInIframe(`
      (async () => {
        const room = window.standaloneRoom;
        const inv = room.state.playerInventories.items[room.sessionId];
        const app = window.pcApp;
        const upgraderUI = app.root.findByName('UpgraderUI');
        const upgraderCtrl = upgraderUI.script.upgraderController;

        // Unlock forging mutex
        room.isForging = false;

        // Add sword to test burn (level 2)
        const burnSword = window.addStandaloneItem({ isSword: true, type: 20, level: 2 });
        const initialGold = room.networkManager.goldAmount || 0;

        const swordsCatalog = window.SWORDMASTERS_SWORDS || (window.StaticData && StaticData.swords) || window.swords || [];
        const itemData = swordsCatalog[20] || { priceGold: 1000 };
        const expectedRefund = Math.round((itemData.priceGold || 1000) * Math.pow(2, 2 - 1)); // priceGold * 2^1

        upgraderCtrl.show();
        await upgraderCtrl.setForgeItem(burnSword, true);

        // Send forge request with forceSuccess: false
        room.handleClientMessage('Client:UpgraderController:forge', {
          activeItemId: burnSword.itemId,
          forceSuccess: false
        });

        // Verify sword is removed from inv.swords
        const itemStillInInventory = inv.swords.items.some(s => s.itemId === burnSword.itemId);
        const itemStillInProfile = room.profile.inventory?.swords?.some(s => s.itemId === burnSword.itemId);
        const finalGold = room.networkManager.goldAmount;
        const goldCredited = finalGold === initialGold + expectedRefund;

        return {
          itemBurnedFromInv: !itemStillInInventory,
          itemBurnedFromProfile: !itemStillInProfile,
          expectedRefund,
          initialGold,
          finalGold,
          goldCredited
        };
      })()
    `);
    console.log('Dwarf Burn Check:', dwarfBurnCheck);
    testResults.dwarfBurnFailure = dwarfBurnCheck.itemBurnedFromInv && dwarfBurnCheck.itemBurnedFromProfile && dwarfBurnCheck.goldCredited;

    await takeScreenshot('proof_suite_04_dwarf_burn_and_gold_refund');

    // 7. Test Requirement 1: Max Level Cap (Level 10)
    console.log('\n--- Step 7: Test Max Level 10 Cap Rejection ---');
    const dwarfMaxLevelCheck = await evalInIframe(`
      (() => {
        const room = window.standaloneRoom;
        room.isForging = false;
        const maxSword = window.addStandaloneItem({ isSword: true, type: 10, level: 10 });
        const levelBefore = maxSword.level;

        room.handleClientMessage('Client:UpgraderController:forge', {
          activeItemId: maxSword.itemId,
          forceSuccess: true
        });

        const levelAfter = maxSword.level;
        return {
          levelBefore,
          levelAfter,
          capEnforced: levelAfter === 10
        };
      })()
    `);
    console.log('Max Level Check:', dwarfMaxLevelCheck);
    testResults.dwarfMaxLevelRejected = dwarfMaxLevelCheck.capEnforced;

    // 8. Test Requirement 2: Multi-Mob Combat, Targeting, Damage, Respawn
    console.log('\n--- Step 8: Test Multi-Mob Combat & Independent Damage ---');
    const multiMobTest = await evalInIframe(`
      (() => {
        const room = window.standaloneRoom;
        const inv = room.state.playerInventories.items[room.sessionId];
        const playerEnt = room.networkManager.currentPlayerEntity;
        const playerCtrl = playerEnt?.script?.playerController;

        // Position player in combat area near mob spawns
        playerEnt.setPosition(0, -0.25, -70);

        // Target two authentic World 1 mobs
        const mob0 = room.state.enemies.items['mob_0'];
        const mob1 = room.state.enemies.items['mob_1'];
        const mobEnt0 = room.networkManager.enemies['mob_0'];
        const mobEnt1 = room.networkManager.enemies['mob_1'];

        const ec0 = mobEnt0?.script?.enemyController;
        const ec1 = mobEnt1?.script?.enemyController;
        if (ec0) { ec0.canGetDamage = true; ec0.isDied = false; }
        if (ec1) { ec1.canGetDamage = true; ec1.isDied = false; }

        if (playerCtrl) {
          playerCtrl.nearEnemies = [ec0, ec1].filter(Boolean);
        }

        // Hit mob 0
        const mob0HpBefore = mob0.health;
        room.handleClientMessage('Client:EnemyController:checkDamage', { enemyId: 'mob_0' });
        const mob0HpAfter = mob0.health;

        // Hit mob 1 independently
        const mob1HpBefore = mob1.health;
        room.handleClientMessage('Client:EnemyController:checkDamage', { enemyId: 'mob_1' });
        const mob1HpAfter = mob1.health;

        // Mob 0 attacks player
        const playerHpBefore = inv.health || 100;
        room.handleClientMessage('Client:EnemyController:playerGotDamage', { enemyId: 'mob_0' });
        const playerHpAfter = inv.health;

        return {
          mob0Damaged: mob0HpAfter < mob0HpBefore || mob0HpAfter <= 0,
          mob1Damaged: mob1HpAfter < mob1HpBefore || mob1HpAfter <= 0,
          independentDamage: mob0HpAfter !== mob0HpBefore && mob1HpAfter !== mob1HpBefore,
          playerDamaged: playerHpAfter < playerHpBefore || playerHpAfter <= 0
        };
      })()
    `);
    console.log('Multi-Mob Combat Check:', multiMobTest);
    testResults.multiMobCombat = multiMobTest.independentDamage && multiMobTest.playerDamaged;

    await takeScreenshot('proof_suite_05_multi_mob_combat_targeting');

    // 9. Test Requirement 7: Pet Equipping, 3-Pet Limit, Summon Following
    console.log('\n--- Step 9: Test Pet Equipping & 3-Pet Limit ---');
    const petTest = await evalInIframe(`
      (() => {
        const room = window.standaloneRoom;
        const inv = room.state.playerInventories.items[room.sessionId];

        // Clear active pets
        inv.activePets.items = [];

        // Add 4 pets
        const p1 = window.addStandalonePet({ type: 1 });
        const p2 = window.addStandalonePet({ type: 2 });
        const p3 = window.addStandalonePet({ type: 3 });
        const p4 = window.addStandalonePet({ type: 4 });

        // Equip 3 pets
        room.handleClientMessage('Client:PetUIController:equipDequipPet', { itemId: p1.itemId });
        room.handleClientMessage('Client:PetUIController:equipDequipPet', { itemId: p2.itemId });
        room.handleClientMessage('Client:PetUIController:equipDequipPet', { itemId: p3.itemId });

        const countAfter3 = inv.activePets.length;

        // Attempt to equip 4th pet (must be rejected)
        room.handleClientMessage('Client:PetUIController:equipDequipPet', { itemId: p4.itemId });
        const countAfter4 = inv.activePets.length;

        return {
          countAfter3,
          countAfter4,
          limitEnforced: countAfter3 === 3 && countAfter4 === 3
        };
      })()
    `);
    console.log('Pet Equipping & Limit Check:', petTest);
    testResults.petEquipAndLimit = petTest.limitEnforced;

    await takeScreenshot('proof_suite_06_pet_summon_and_limit');

    // 10. Test Requirement 6: Master Logs in Master Vault
    console.log('\n--- Step 10: Test Master Logs in Master Vault ---');
    // Navigate to /vault
    await evalInPage(`window.location.href = '/vault';`);
    await sleep(2500);

    // Unlock Master Vault via Decrypt Vault button
    await evalInPage(`
      (() => {
        const pwdInput = document.querySelector('input[type="password"]');
        if (pwdInput) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeInputValueSetter.call(pwdInput, 'harrison@smgrade.swordmasters2026');
          pwdInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const buttons = Array.from(document.querySelectorAll('button'));
        const decryptBtn = buttons.find(b => b.textContent.includes('Decrypt Vault'));
        if (decryptBtn) decryptBtn.click();
      })()
    `);
    await sleep(2500);

    // Select Master Logs tab
    await evalInPage(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const logsTab = buttons.find(b => b.textContent.includes('Master Logs'));
        if (logsTab) logsTab.click();
      })()
    `);
    await sleep(1500);

    const masterLogsCheck = await evalInPage(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
        const hasMasterLogsTab = buttons.some(b => b.includes('Master Logs'));

        // Check local logs recorded
        const localLogs = JSON.parse(localStorage.getItem('smg_master_logs') || '[]');
        const hasDwarfSuccess = localLogs.some(l => l.action.includes('Dwarfing Attempt (Success)'));
        const hasDwarfBurn = localLogs.some(l => l.action.includes('Dwarfing Attempt (Burn / Failure)'));
        const hasItemAdded = localLogs.some(l => l.action.includes('Item Added'));

        const pageText = document.body.innerText;
        const displaysLogs = pageText.includes('Dwarfing Attempt') || pageText.includes('Item Added') || localLogs.length > 0;

        return {
          hasMasterLogsTab,
          totalLocalLogs: localLogs.length,
          hasDwarfSuccess,
          hasDwarfBurn,
          hasItemAdded,
          displaysLogs
        };
      })()
    `);
    console.log('Master Logs Check:', masterLogsCheck);
    testResults.masterVaultLogs = masterLogsCheck.hasMasterLogsTab && masterLogsCheck.hasDwarfSuccess && masterLogsCheck.hasDwarfBurn;

    await takeScreenshot('proof_suite_07_master_vault_logs_view');

    // 11. Test Dwarf Puncher Preserved
    console.log('\n--- Step 11: Verify 2D Dwarf Puncher Mode Intact ---');
    await evalInPage(`window.location.href = '/arcade?mode=puncher';`);
    await sleep(2500);

    const puncherCheck = await evalInPage(`
      (() => {
        const text = document.body.innerText;
        const hasPuncher = text.includes('DWARF PUNCHER') || text.includes('Puncher') || text.includes('STRESS RELIEF');
        const hasCanvas = !!document.querySelector('canvas');
        return {
          hasPuncher,
          hasCanvas
        };
      })()
    `);
    console.log('Dwarf Puncher Check:', puncherCheck);
    testResults.dwarfPuncherPreserved = puncherCheck.hasPuncher && puncherCheck.hasCanvas;

    await takeScreenshot('proof_suite_08_dwarf_puncher_intact');

  } catch (err) {
    console.error('Test Suite encountered error:', err);
  } finally {
    console.log('\n=== FINAL MASTER SUITE TEST RESULTS ===');
    console.log(JSON.stringify(testResults, null, 2));

    const allPassed = Object.values(testResults).every(v => v === true);
    console.log(`\nOVERALL SUITE STATUS: ${allPassed ? 'ALL TESTS PASSED ✅' : 'FAILURES DETECTED ❌'}`);

    chromeProc.kill();
    process.exit(allPassed ? 0 : 1);
  }
}

runMasterAcceptanceSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
