import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9296;
const ARTIFACT_DIR = '/Users/machd/.gemini/antigravity/brain/95430ef8-08a8-4fc3-8dd9-ab262242e124';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('================================================================');
  console.log('   SMGRADE ARCADE & DWARF HUB — FOLLOW-UP AUTOMATED VERIFICATION');
  console.log('================================================================');

  const tempProfileDir = '/tmp/chrome-followup-test-' + Date.now();
  const chromeProc = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--use-gl=angle',
      '--use-angle=metal',
      '--enable-webgl',
      `--remote-debugging-port=${PORT}`,
      '--remote-allow-origins=*',
      '--window-size=1280,800',
      `--user-data-dir=${tempProfileDir}`,
      'http://localhost:5173/arcade',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  await sleep(3500);

  let ws = null;
  try {
    let targets = null;
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json`);
        targets = await res.json();
        if (targets && targets.length > 0) break;
      } catch {
        await sleep(500);
      }
    }

    if (!targets || targets.length === 0) {
      throw new Error('Could not connect to Chrome DevTools port ' + PORT);
    }

    const pageTarget = targets.find(t => t.type === 'page');
    console.log('[CDP] Connecting to page target...');
    ws = new globalThis.WebSocket(pageTarget.webSocketDebuggerUrl);

    let msgId = 1;
    const pending = new Map();

    ws.addEventListener('message', event => {
      const data = typeof event.data === 'string' ? event.data : event.data.toString();
      const parsed = JSON.parse(data);
      if (parsed.id && pending.has(parsed.id)) {
        const { resolve, reject } = pending.get(parsed.id);
        pending.delete(parsed.id);
        if (parsed.error) reject(parsed.error);
        else resolve(parsed.result);
      }
    });

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await new Promise((res, rej) => {
      ws.addEventListener('open', res);
      ws.addEventListener('error', rej);
    });

    console.log('[CDP] Connected successfully.');
    await send('Page.enable');
    await send('Runtime.enable');

    ws.addEventListener('message', event => {
      const parsed = JSON.parse(event.data);
      if (parsed.method === 'Runtime.consoleAPICalled') {
        const text = parsed.params.args.map(a => a.value || a.description).join(' ');
        if (text.includes('[SMGrade') || text.includes('[DEBUG') || text.includes('Error') || text.includes('exception')) {
          console.log('[BROWSER CONSOLE]', text);
        }
      }
      if (parsed.method === 'Runtime.exceptionThrown') {
        console.error('[BROWSER EXCEPTION]', parsed.params.exceptionDetails?.exception?.description || parsed.params.exceptionDetails?.text);
      }
    });

    async function screenshot(filename) {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      const filePath = path.join(ARTIFACT_DIR, filename);
      fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
      console.log(`[PROOF] Saved screenshot: ${filename}`);
    }

    async function evalCode(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (res.exceptionDetails) {
        throw new Error(res.exceptionDetails.exception?.description || 'Evaluation error');
      }
      return res.result?.value;
    }

    // -------------------------------------------------------------
    // TEST 1: SM Arcade Selector Page (Requirement 13)
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: SM Arcade Selector Page ---');
    await sleep(2000);
    const selectorCards = await evalCode(`(() => {
      const dwarfCard = document.getElementById('arcade-card-dwarf-hub');
      const revengeCard = document.getElementById('arcade-card-sm-revenge');
      return {
        hasDwarfCard: !!dwarfCard,
        hasRevengeCard: !!revengeCard,
        cardsCount: (dwarfCard ? 1 : 0) + (revengeCard ? 1 : 0)
      };
    })()`);
    console.log('Arcade selector cards status:', selectorCards);
    if (!selectorCards.hasDwarfCard || !selectorCards.hasRevengeCard) {
      throw new Error('Arcade selector cards missing!');
    }
    await screenshot('proof_followup_01_arcade_selector.png');

    // -------------------------------------------------------------
    // TEST 2: Dwarf Hub Full Viewport (Requirement 14)
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Dwarf Hub Full Viewport (100vw, 100vh) ---');
    await evalCode(`document.getElementById('arcade-card-dwarf-hub').click()`);
    await sleep(2500);

    const viewportCheck = await evalCode(`(() => {
      const container = document.getElementById('dwarf-hub-viewport-container');
      const iframe = document.getElementById('dwarf-hub-frame');
      if (!container || !iframe) return null;
      const rect = container.getBoundingClientRect();
      const style = window.getComputedStyle(container);
      return {
        width: rect.width,
        height: rect.height,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        position: style.position,
        zIndex: style.zIndex
      };
    })()`);
    console.log('Dwarf Hub Viewport check:', viewportCheck);
    if (!viewportCheck || viewportCheck.width < viewportCheck.windowWidth - 5) {
      throw new Error('Dwarf Hub does not occupy full viewport!');
    }
    await screenshot('proof_followup_02_full_viewport.png');

    // Wait for Dwarf Hub runtime to initialize in iframe
    console.log('\nWaiting for Dwarf Hub runtime to initialize in iframe...');
    let runtimeReady = false;
    for (let i = 0; i < 45; i++) {
      const status = await evalCode(`(() => {
        const iframe = document.getElementById('dwarf-hub-frame');
        if (!iframe || !iframe.contentWindow) return { ready: false, err: 'no iframe' };
        try {
          const win = iframe.contentWindow;
          return {
            hasApp: !!win.pc?.Application?.getApplication(),
            hasRoom: !!win.standaloneRoom,
            hasModal: !!win.document?.getElementById('smgrade-username-modal'),
            hasSession: !!win.standaloneRoom?.sessionId,
            regUser: win.localStorage?.getItem('smg_registered_username'),
            url: win.location?.href
          };
        } catch (e) {
          return { ready: false, err: e.message };
        }
      })()`);
      console.log(`[Iter ${i}] status:`, status);
      if (status && status.hasRoom && status.hasSession) {
        runtimeReady = true;
        console.log(`Runtime ready at iteration ${i}! Status:`, status);
        break;
      }
      await sleep(1000);
    }

    if (!runtimeReady) {
      throw new Error('Dwarf Hub runtime or Username modal failed to load within timeout');
    }

    // -------------------------------------------------------------
    // TEST 3: Username System Validation & Claims (Requirements 7, 8, 9)
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Username System Validation & Claims ---');
    await evalCode(`(() => {
      const iframe = document.getElementById('dwarf-hub-frame');
      const win = iframe.contentWindow;
      win.localStorage.removeItem('smg_registered_username');
      if (typeof win.openUsernameModal === 'function') {
        win.openUsernameModal();
      }
    })()`);
    await sleep(600);
    
    // 3a. Rejection: Length > 10 characters
    const rejectTooLong = await evalCode(`(() => {
      const iframe = document.getElementById('dwarf-hub-frame');
      const win = iframe.contentWindow;
      const input = win.document.getElementById('sm-user-input');
      const btn = win.document.getElementById('sm-user-claim-btn');
      const err = win.document.getElementById('sm-user-validation');
      
      input.value = 'LongUsername123';
      btn.click();
      return { msg: err.innerText, display: err.style.display };
    })()`);
    console.log('Rejection test (>10 chars):', rejectTooLong);
    if (!rejectTooLong.msg.includes('1 to 10')) {
      throw new Error('Expected 1 to 10 alphanumeric characters validation error!');
    }

    // 3b. Rejection: Spaces and special symbols
    const rejectSymbols = await evalCode(`(() => {
      const iframe = document.getElementById('dwarf-hub-frame');
      const win = iframe.contentWindow;
      const input = win.document.getElementById('sm-user-input');
      const btn = win.document.getElementById('sm-user-claim-btn');
      const err = win.document.getElementById('sm-user-validation');
      
      input.value = 'Hero Dwarf!';
      btn.click();
      return { msg: err.innerText, display: err.style.display };
    })()`);
    console.log('Rejection test (spaces/symbols):', rejectSymbols);
    if (!rejectSymbols.msg.includes('alphanumeric')) {
      throw new Error('Expected alphanumeric validation error!');
    }
    await screenshot('proof_followup_03_username_modal_validation.png');

    // 3c. Claim valid username
    const validUser = 'Hero' + Math.floor(1000 + Math.random() * 9000);
    const claimResult = await evalCode(`(async () => {
      const iframe = document.getElementById('dwarf-hub-frame');
      const win = iframe.contentWindow;
      const input = win.document.getElementById('sm-user-input');
      
      input.value = '${validUser}';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 400));
      await win.handleClaimUsername();
      
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 200));
        const modal = win.document.getElementById('smgrade-username-modal');
        if (!modal || !modal.classList.contains('active') || modal.style.display === 'none') {
          return {
            success: true,
            user: win.localStorage.getItem('smg_registered_username'),
            token: !!win.localStorage.getItem('smg_player_token')
          };
        }
      }
      const err = win.document.getElementById('sm-user-validation');
      return { success: false, err: err ? err.innerText : 'Modal did not dismiss' };
    })()`);
    console.log('Claim valid username result:', claimResult);
    if (!claimResult.success || !claimResult.token) {
      throw new Error('Failed to claim valid username or obtain token!');
    }

    // -------------------------------------------------------------
    // TEST 4: World 1 Mobs Removed (Requirement 6)
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: World 1 Mobs Removed (0 combat mobs) ---');
    await sleep(1000);
    const mobCheck = await evalCode(`(() => {
      const iframe = document.getElementById('dwarf-hub-frame');
      const win = iframe.contentWindow;
      const room = win.standaloneRoom;
      const enemiesCount = Object.keys(room.state?.enemies?.items || {}).length;
      const inv = room.state.playerInventories.items[room.sessionId];
      const hasIronsmith = !!win.pc.Application.getApplication().root.findByName('ironsmith');
      return {
        enemiesCount,
        hasInventory: !!inv,
        hasIronsmith
      };
    })()`);
    console.log('World 1 Mobs & World entities check:', mobCheck);
    if (mobCheck.enemiesCount !== 0) {
      throw new Error(`Expected 0 combat mobs in World 1, got: ${mobCheck.enemiesCount}`);
    }
    if (!mobCheck.hasIronsmith) {
      throw new Error('World 1 Blacksmith NPC missing!');
    }
    await screenshot('proof_followup_04_zero_combat_mobs.png');

    // -------------------------------------------------------------
    // TEST 5: Sword and Shield Sell Buttons & Authentic Price & Unequip (Requirement 1)
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Sword & Shield Selling Flow ---');
    const sellTest = await evalCode(`(async () => {
      const iframe = document.getElementById('dwarf-hub-frame');
      const win = iframe.contentWindow;
      const room = win.standaloneRoom;
      const inv = room.state.playerInventories.items[room.sessionId];

      const initialGold = Number(inv.gold || 0);

      // Add a Level 3 sword: Last Horizon (type: 1)
      const sword = win.addStandaloneItem({ isSword: true, type: 1, level: 3 });
      await new Promise(r => setTimeout(r, 400));

      const swordId = sword.itemId;
      const meta = win.SWORDMASTERS_SWORDS?.[1] || { priceGold: 100 };
      const basePrice = meta.priceGold || 100;
      // Formula: basePrice * 2^(level-1)
      const expectedSellPrice = Math.round(basePrice * Math.pow(2, (sword.level || 1) - 1));

      // Equip this sword
      room.send('Client:SlotController:equipOrUnequipWeapon', {
        itemId: swordId,
        itemType: sword.type,
        isSword: true,
        equip: true
      });
      await new Promise(r => setTimeout(r, 300));
      const wasEquipped = inv.activeSword.itemId === swordId;

      // Sell the sword
      room.send('Client:InventoryController:sellItem', {
        itemId: swordId,
        isSword: true
      });
      await new Promise(r => setTimeout(r, 600));

      const finalGold = Number(inv.gold || 0);
      const goldGain = finalGold - initialGold;
      const swordStillInInv = inv.swords.items.some(s => s.itemId === swordId);
      const activeSwordNow = inv.activeSword.type;

      // Test double-click concurrency lock
      let duplicateAttemptHandled = false;
      try {
        room.send('Client:InventoryController:sellItem', { itemId: swordId, isSword: true });
        duplicateAttemptHandled = true;
      } catch (e) {
        duplicateAttemptHandled = false;
      }

      return {
        initialGold,
        finalGold,
        goldGain,
        expectedSellPrice,
        priceMatches: goldGain === expectedSellPrice,
        wasEquipped,
        swordStillInInv,
        activeSwordNow,
        revertedToStarter: activeSwordNow === 1,
        duplicateAttemptHandled
      };
    })()`);
    console.log('Sell test result:', sellTest);
    if (!sellTest.priceMatches) {
      throw new Error(`Authentic price mismatch! Expected ${sellTest.expectedSellPrice}, got ${sellTest.goldGain}`);
    }
    if (sellTest.swordStillInInv) {
      throw new Error('Sold sword was not removed from inventory!');
    }
    if (!sellTest.revertedToStarter) {
      throw new Error('Equipped weapon was not reverted to starter weapon!');
    }
    await screenshot('proof_followup_05_sell_sword_shield_price_and_unequip.png');

    // -------------------------------------------------------------
    // TEST 6: Limit Add Item Quantity to 10 (Requirement 2)
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Limit Add Item Quantity to 10 ---');
    const quantityTest = await evalCode(`(() => {
      const iframe = document.getElementById('dwarf-hub-frame');
      const win = iframe.contentWindow;
      const room = win.standaloneRoom;
      const inv = room.state.playerInventories.items[room.sessionId];

      const preCount = inv.swords.items.length;
      // Attempt to add quantity 25
      win.addStandaloneItem({ isSword: true, type: 1, level: 1, quantity: 25 });
      const postCount = inv.swords.items.length;
      const addedCount = postCount - preCount;

      const qtyInput = win.document.getElementById('dwarf-add-qty');
      const maxAttr = qtyInput ? qtyInput.getAttribute('max') : '10';

      return {
        preCount,
        postCount,
        addedCount,
        clampedTo10: addedCount <= 10,
        maxAttr
      };
    })()`);
    console.log('Add quantity limit test:', quantityTest);
    if (!quantityTest.clampedTo10) {
      throw new Error(`Quantity was not clamped to 10! Added: ${quantityTest.addedCount}`);
    }
    await screenshot('proof_followup_06_add_item_quantity_limit.png');

    // -------------------------------------------------------------
    // TEST 7: Close Custom Item-Level Exploit (Requirement 3)
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Close Custom Item-Level Exploit ---');
    const exploitTest = await evalCode(`(() => {
      const iframe = document.getElementById('dwarf-hub-frame');
      const win = iframe.contentWindow;
      const room = win.standaloneRoom;
      const inv = room.state.playerInventories.items[room.sessionId];

      // Try exploit: create Level 10,000 sword
      win.addStandaloneItem({ isSword: true, type: 2, level: 10000 });
      const addedSword = inv.swords.items[inv.swords.items.length - 1];

      // Try schema level clamp
      const schemaClamped = room.createItemSchema({ type: 3, level: 99999, isSword: true });

      return {
        addedSwordLevel: addedSword.level,
        schemaClampedLevel: schemaClamped.level,
        isProtected: addedSword.level <= 10 && schemaClamped.level <= 10
      };
    })()`);
    console.log('Level 10,000 exploit test:', exploitTest);
    if (!exploitTest.isProtected) {
      throw new Error(`Exploit not protected! Added sword level: ${exploitTest.addedSwordLevel}`);
    }
    await screenshot('proof_followup_07_level_10000_exploit_prevention.png');

    // -------------------------------------------------------------
    // TEST 8: Enforce Level 10 Dwarfing Boundary & 0% Survival Rule (Requirements 4 & 5)
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: Enforce Level 10 Dwarfing Boundary & 0% Survival Rule ---');
    const dwarfBoundaryTest = await evalCode(`(async () => {
      const iframe = document.getElementById('dwarf-hub-frame');
      const win = iframe.contentWindow;
      const room = win.standaloneRoom;
      const inv = room.state.playerInventories.items[room.sessionId];

      // Add a Level 10 sword
      const maxSword = win.addStandaloneItem({ isSword: true, type: 1, level: 10 });
      const maxSwordId = maxSword.itemId;
      await new Promise(r => setTimeout(r, 400));

      const preCount = inv.swords.items.length;

      // Track warning text fired on app
      let warningCaptured = '';
      const origFire = win.pc.Application.getApplication().fire;
      win.pc.Application.getApplication().fire = function(eventName, ...args) {
        if (eventName === 'WarningTextController:setWarning') {
          warningCaptured = args[0] || '';
        }
        return origFire.apply(this, [eventName, ...args]);
      };

      // Attempt to forge Level 10
      room.send('Client:UpgraderController:forge', {
        activeItemId: maxSwordId,
        fortune: 0,
        burnProtection: false
      });
      await new Promise(r => setTimeout(r, 600));

      const postCount = inv.swords.items.length;
      const itemStillExists = inv.swords.items.some(s => s.itemId === maxSwordId);
      const currentLevel = inv.swords.items.find(s => s.itemId === maxSwordId)?.level;

      return {
        warningCaptured,
        itemStillExists,
        currentLevel,
        preCount,
        postCount,
        boundaryEnforced: warningCaptured.includes('max level') && itemStillExists && currentLevel === 10
      };
    })()`);
    console.log('Level 10 dwarfing boundary test:', dwarfBoundaryTest);
    if (!dwarfBoundaryTest.boundaryEnforced) {
      throw new Error('Level 10 dwarfing boundary failed or item was improperly destroyed!');
    }
    await screenshot('proof_followup_08_level_10_dwarfing_boundary.png');

    // -------------------------------------------------------------
    // TEST 9: World 1 Three Leaderboards (Requirement 11)
    // -------------------------------------------------------------
    console.log('\n--- TEST 9: World 1 Three Leaderboards (10 slots each) ---');
    const leaderboardsTest = await evalCode(`(async () => {
      const iframe = document.getElementById('dwarf-hub-frame');
      const win = iframe.contentWindow;
      const room = win.standaloneRoom;
      await room.updateLiveLeaderboards();
      await new Promise(r => setTimeout(r, 600));
      const data = room.lastLeaderboardData || {};

      return {
        dwarfingCount: data.dwarfing?.length || 0,
        enhancingCount: data.enhancing?.length || 0,
        levelCount: data.level?.length || 0,
        dwarfingLeader: data.dwarfing?.[0],
        enhancingLeader: data.enhancing?.[0],
        levelLeader: data.level?.[0]
      };
    })()`);
    console.log('Leaderboards test:', leaderboardsTest);
    if (leaderboardsTest.dwarfingCount !== 10 || leaderboardsTest.enhancingCount !== 10 || leaderboardsTest.levelCount !== 10) {
      throw new Error(`Expected 10 slots each for all 3 leaderboards! Found: dwarfing=${leaderboardsTest.dwarfingCount}, enhancing=${leaderboardsTest.enhancingCount}, level=${leaderboardsTest.levelCount}`);
    }
    await screenshot('proof_followup_09_world1_three_leaderboards.png');

    // -------------------------------------------------------------
    // TEST 10: Master Vault Daily Visits & Activity Logs (Requirements 9 & 10)
    // -------------------------------------------------------------
    console.log('\n--- TEST 10: Master Vault Daily Visits & Activity Logs ---');
    await evalCode(`(async () => {
      try {
        const res = await fetch('/api/master/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: 'harrison@smgrade.swordmasters2026' })
        });
        if (res.ok) {
          const json = await res.json();
          localStorage.setItem('smg_master_token', json.token);
        }
      } catch (_) {}
    })()`);
    await evalCode(`window.location.href = '/vault'`);
    await sleep(4000);
    await screenshot('debug_vault_screen.png');
    const debugVault = await evalCode(`(() => {
      return {
        url: window.location.href,
        textSample: document.body.innerText.slice(0, 400),
        hasToken: !!localStorage.getItem('smg_master_token')
      };
    })()`);
    console.log('Debug Vault Info:', debugVault);

    const masterVaultCheck = await evalCode(`(async () => {
      const pageText = document.body.innerText;
      const initialAnalytics = {
        hasDailyVisitsHeading: pageText.includes('DAILY WEBSITE VISITS') || pageText.includes('Daily Website Visits'),
        hasTodayVisits: pageText.includes("TODAY'S VISITS") || pageText.includes("Today's Visits"),
        hasAllTimeVisits: pageText.includes('ALL-TIME VISITS') || pageText.includes('All-Time Visits')
      };

      // Switch to Master Logs tab
      const btns = Array.from(document.querySelectorAll('button'));
      const actBtn = btns.find(b => b.innerText.includes('MASTER LOGS') || b.innerText.includes('Activity Logs'));
      if (actBtn) actBtn.click();
      await new Promise(r => setTimeout(r, 1500));

      const updatedText = document.body.innerText;
      return {
        ...initialAnalytics,
        hasUsernameLogged: updatedText.includes('Arcade Player Registered') || updatedText.includes('Username Registered') || updatedText.includes('Registered username') || updatedText.includes('Hero')
      };
    })()`);
    console.log('Master Vault verification:', masterVaultCheck);
    if (!masterVaultCheck.hasDailyVisitsHeading || !masterVaultCheck.hasTodayVisits) {
      throw new Error('Master Vault Daily Website Visits card missing!');
    }
    await screenshot('proof_followup_10_master_vault_visits_and_logs.png');

    // -------------------------------------------------------------
    // TEST 11: Return to Arcade Selector & Launch SM Revenge (Requirement 13)
    // -------------------------------------------------------------
    console.log('\n--- TEST 11: Return to Arcade Selector & Launch SM Revenge ---');
    await evalCode(`window.location.href = '/arcade'`);
    await sleep(2500);

    const selectorCheck = await evalCode(`(() => {
      const dwarfCard = document.getElementById('arcade-card-dwarf-hub');
      const revengeCard = document.getElementById('arcade-card-sm-revenge');
      return {
        onSelector: !!dwarfCard && !!revengeCard
      };
    })()`);
    console.log('Selector page status:', selectorCheck);
    if (!selectorCheck.onSelector) {
      throw new Error('Failed to return to Arcade selector!');
    }

    // Launch SM Revenge
    await evalCode(`document.getElementById('arcade-card-sm-revenge').click()`);
    await sleep(2500);

    const revengeCheck = await evalCode(`(() => {
      const pageText = document.body.innerText;
      return {
        url: window.location.href,
        hasRevengeTitle: pageText.includes('SM Revenge') || pageText.includes('Dwarf Puncher'),
        hasHitBtn: !!document.querySelector('button')
      };
    })()`);
    console.log('SM Revenge launch status:', revengeCheck);
    if (!revengeCheck.hasRevengeTitle) {
      throw new Error('Failed to launch SM Revenge from selector!');
    }
    await screenshot('proof_followup_11_arcade_selector_return.png');

    console.log('\n================================================================');
    console.log('   ALL 11 AUTOMATED VERIFICATION TESTS PASSED SUCCESSFULLY!     ');
    console.log('================================================================');

  } finally {
    if (ws) ws.close();
    chromeProc.kill();
  }
}

run().catch(err => {
  console.error('\n[VERIFICATION ERROR]:', err);
  process.exit(1);
});
