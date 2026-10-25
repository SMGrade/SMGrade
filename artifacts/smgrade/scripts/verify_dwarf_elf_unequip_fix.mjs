import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = '/Users/machd/.gemini/antigravity/brain/95430ef8-08a8-4fc3-8dd9-ab262242e124';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9260;
const TARGET_URL = 'https://smgrade-swordmasters.online/original-runtime/index.html';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runSuite() {
  console.log('=== STARTING DWARF & ELF UNEQUIP AND RELOAD VERIFICATION SUITE ===');
  console.log('Target URL:', TARGET_URL);

  const tempProfileDir = '/tmp/chrome-dwarf-unequip-' + Date.now();
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
      TARGET_URL
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let cdp = null;

  try {
    await sleep(4000);

    // 1. Connect to CDP
    const versionRes = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const pages = await versionRes.json();
    const page = pages.find(p => p.url.includes('original-runtime') || p.type === 'page');
    if (!page || !page.webSocketDebuggerUrl) {
      throw new Error('Failed to find Chrome target page: ' + JSON.stringify(pages));
    }

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });

    let msgId = 1;
    const pending = new Map();
    ws.onmessage = (event) => {
      const raw = event.data;
      const parsed = JSON.parse(raw);
      if (parsed.id && pending.has(parsed.id)) {
        const { resolve, reject } = pending.get(parsed.id);
        pending.delete(parsed.id);
        if (parsed.error) reject(parsed.error);
        else resolve(parsed.result);
      }
    };

    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

    cdp = { send, ws };

    await send('Page.enable');
    await send('Runtime.enable');

    const evalCode = async (expr) => {
      const res = await send('Runtime.evaluate', {
        expression: expr,
        awaitPromise: true,
        returnByValue: true
      });
      if (res.exceptionDetails) {
        throw new Error('Eval failed: ' + JSON.stringify(res.exceptionDetails));
      }
      return res.result?.value;
    };

    console.log('Waiting for PlayCanvas runtime to boot...');
    let booted = false;
    for (let i = 0; i < 40; i++) {
      const check = await evalCode(`(() => {
        const startBtn = document.getElementById('sm-start-submit-btn');
        if (startBtn) startBtn.click();

        const room = window.standaloneRoom;
        const pCtrl = room?.networkManager?.currentPlayerEntity?.script?.playerController;
        if (!room || !pCtrl) return { ready: false };
        return { ready: true };
      })()`);
      if (check?.ready) {
        booted = true;
        console.log(`PlayCanvas standalone runtime ready after ${i + 1} checks.`);
        break;
      }
      await sleep(1000);
    }

    if (!booted) throw new Error('Runtime did not boot within 40 seconds');

    // ------------------------------------------------------------------------
    // TEST 1: Burn equipped sword in Dwarf Blacksmith
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 1: Dwarf Blacksmith burning equipped sword ---');
    const dwarfSwordBurn = await evalCode(`(async () => {
      const win = window;
      const room = win.standaloneRoom;
      const inv = room.state.playerInventories.items[room.sessionId];
      const pCtrl = room.networkManager?.currentPlayerEntity?.script?.playerController;

      // Add a test sword (type 3: Katana, level 4)
      const sword = win.addStandaloneItem({ isSword: true, type: 3, level: 4 });
      await new Promise(r => setTimeout(r, 400));

      // Equip it
      room.send('Client:SlotController:equipOrUnequipWeapon', {
        itemId: sword.itemId,
        itemType: sword.type,
        isSword: true,
        equip: true
      });
      await new Promise(r => setTimeout(r, 400));

      const beforeEquipped = {
        invActiveType: inv.activeSword.type,
        invActiveId: inv.activeSword.itemId,
        pCtrlActiveType: pCtrl.activeSwordType,
        pCtrlEnabled: pCtrl.activeSword?.enabled
      };

      // Force dwarf failure to burn this equipped sword
      room.isForging = false;
      room._forceNextForgeSuccess = false;
      room.send('Client:UpgraderController:forge', {
        activeItemId: sword.itemId,
        forceSuccess: false
      });
      await new Promise(r => setTimeout(r, 800));

      const afterEquipped = {
        invActiveType: inv.activeSword.type,
        invActiveId: inv.activeSword.itemId,
        pCtrlActiveType: pCtrl.activeSwordType,
        pCtrlEnabled: pCtrl.activeSword?.enabled,
        inInventory: inv.swords.items.some(s => s.itemId === sword.itemId),
        profileActiveType: room.profile.activeSwordType,
        profileActiveId: room.profile.activeSwordId
      };

      return { beforeEquipped, afterEquipped };
    })()`);

    console.log('Dwarf sword burn test:', JSON.stringify(dwarfSwordBurn, null, 2));
    if (dwarfSwordBurn.afterEquipped.inInventory) {
      throw new Error('Burned sword was still found in inventory!');
    }
    if (dwarfSwordBurn.afterEquipped.pCtrlActiveType !== 0) {
      throw new Error(`pCtrl.activeSwordType expected 0, got ${dwarfSwordBurn.afterEquipped.pCtrlActiveType}`);
    }
    if (dwarfSwordBurn.afterEquipped.pCtrlEnabled === true) {
      throw new Error('pCtrl.activeSword is still enabled visually!');
    }
    if (dwarfSwordBurn.afterEquipped.invActiveType !== 0) {
      throw new Error(`inv.activeSword.type expected 0, got ${dwarfSwordBurn.afterEquipped.invActiveType}`);
    }
    console.log('✅ TEST 1 PASSED: Equipped sword unequipped and disabled visually on Dwarf burn!');

    // ------------------------------------------------------------------------
    // TEST 2: Refresh page and verify sword remains unequipped (no starter fallback)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: Refresh page to test persistent equipment restoration ---');
    await send('Page.reload');
    await sleep(4000);

    for (let i = 0; i < 30; i++) {
      const check = await evalCode(`(() => {
        const startBtn = document.getElementById('sm-start-submit-btn');
        if (startBtn) startBtn.click();
        const room = window.standaloneRoom;
        return !!(room?.networkManager?.currentPlayerEntity?.script?.playerController);
      })()`);
      if (check) break;
      await sleep(1000);
    }

    const reloadSwordState = await evalCode(`(() => {
      const win = window;
      const room = win.standaloneRoom;
      const inv = room.state.playerInventories.items[room.sessionId];
      const pCtrl = room.networkManager?.currentPlayerEntity?.script?.playerController;

      return {
        profileActiveType: room.profile.activeSwordType,
        profileActiveId: room.profile.activeSwordId,
        invActiveType: inv.activeSword.type,
        invActiveId: inv.activeSword.itemId,
        pCtrlActiveType: pCtrl.activeSwordType,
        pCtrlEnabled: pCtrl.activeSword?.enabled
      };
    })()`);

    console.log('Reload sword state:', JSON.stringify(reloadSwordState, null, 2));
    if (reloadSwordState.profileActiveType !== 0) {
      throw new Error(`Reloaded profile activeSwordType expected 0, got ${reloadSwordState.profileActiveType}`);
    }
    if (reloadSwordState.invActiveType !== 0) {
      throw new Error(`Reloaded inv.activeSword.type expected 0, got ${reloadSwordState.invActiveType}`);
    }
    if (reloadSwordState.pCtrlActiveType !== 0) {
      throw new Error(`Reloaded pCtrl.activeSwordType expected 0, got ${reloadSwordState.pCtrlActiveType}`);
    }
    if (reloadSwordState.pCtrlEnabled === true) {
      throw new Error('Reloaded pCtrl.activeSword should not be visually enabled!');
    }
    console.log('✅ TEST 2 PASSED: On reload, unequipped state preserved with NO starter gear fallback!');

    // ------------------------------------------------------------------------
    // TEST 3: Burn equipped shield in Elf Combiner
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Elf Combiner burning equipped shield ---');
    const elfShieldBurn = await evalCode(`(async () => {
      const win = window;
      const room = win.standaloneRoom;
      const inv = room.state.playerInventories.items[room.sessionId];
      const pCtrl = room.networkManager?.currentPlayerEntity?.script?.playerController;

      // Add 10 shields of type 2 (Iron Shield), level 5
      const shields = [];
      for (let i = 0; i < 10; i++) {
        const sh = win.addStandaloneItem({ isSword: false, type: 2, level: 5 });
        shields.push(sh);
      }
      await new Promise(r => setTimeout(r, 400));

      // Equip one of them
      room.send('Client:SlotController:equipOrUnequipWeapon', {
        itemId: shields[0].itemId,
        itemType: shields[0].type,
        isSword: false,
        equip: true
      });
      await new Promise(r => setTimeout(r, 400));

      const beforeEquipped = {
        invActiveType: inv.activeShield.type,
        invActiveId: inv.activeShield.itemId,
        pCtrlActiveType: pCtrl.activeShieldType,
        pCtrlEnabled: pCtrl.activeShield?.enabled
      };

      // Force Elf combine failure by mocking Math.random to 0.999 (> 0.10 probability)
      const origRandom = Math.random;
      Math.random = () => 0.999;
      room.send('Client:CombinerController:forge', {
        activeItemId: shields[0].itemId,
        itemType: 2,
        isSword: false
      });
      await new Promise(r => setTimeout(r, 800));
      Math.random = origRandom;

      const afterEquipped = {
        invActiveType: inv.activeShield.type,
        invActiveId: inv.activeShield.itemId,
        pCtrlActiveType: pCtrl.activeShieldType,
        pCtrlEnabled: pCtrl.activeShield?.enabled,
        inInventory: inv.shields.items.some(sh => sh.itemId === shields[0].itemId),
        profileActiveType: room.profile.activeShieldType,
        profileActiveId: room.profile.activeShieldId
      };

      return { beforeEquipped, afterEquipped };
    })()`);

    console.log('Elf shield burn test:', JSON.stringify(elfShieldBurn, null, 2));
    if (elfShieldBurn.afterEquipped.inInventory) {
      throw new Error('Burned shield was still found in inventory!');
    }
    if (elfShieldBurn.afterEquipped.pCtrlActiveType !== 0) {
      throw new Error(`pCtrl.activeShieldType expected 0, got ${elfShieldBurn.afterEquipped.pCtrlActiveType}`);
    }
    if (elfShieldBurn.afterEquipped.pCtrlEnabled === true) {
      throw new Error('pCtrl.activeShield is still enabled visually!');
    }
    if (elfShieldBurn.afterEquipped.invActiveType !== 0) {
      throw new Error(`inv.activeShield.type expected 0, got ${elfShieldBurn.afterEquipped.invActiveType}`);
    }
    console.log('✅ TEST 3 PASSED: Equipped shield unequipped and disabled visually on Elf burn!');

    // ------------------------------------------------------------------------
    // TEST 4: Reload again to verify shield remains unequipped
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Refresh page to test persistent shield unequip restoration ---');
    await send('Page.reload');
    await sleep(4000);

    for (let i = 0; i < 30; i++) {
      const check = await evalCode(`(() => {
        const startBtn = document.getElementById('sm-start-submit-btn');
        if (startBtn) startBtn.click();
        const room = window.standaloneRoom;
        return !!(room?.networkManager?.currentPlayerEntity?.script?.playerController);
      })()`);
      if (check) break;
      await sleep(1000);
    }

    const reloadShieldState = await evalCode(`(() => {
      const win = window;
      const room = win.standaloneRoom;
      const inv = room.state.playerInventories.items[room.sessionId];
      const pCtrl = room.networkManager?.currentPlayerEntity?.script?.playerController;

      return {
        profileActiveSwordType: room.profile.activeSwordType,
        profileActiveShieldType: room.profile.activeShieldType,
        invActiveSwordType: inv.activeSword.type,
        invActiveShieldType: inv.activeShield.type,
        pCtrlActiveSwordType: pCtrl.activeSwordType,
        pCtrlActiveShieldType: pCtrl.activeShieldType,
        pCtrlSwordEnabled: pCtrl.activeSword?.enabled,
        pCtrlShieldEnabled: pCtrl.activeShield?.enabled
      };
    })()`);

    console.log('Final reloaded dual unequipped state:', JSON.stringify(reloadShieldState, null, 2));
    if (reloadShieldState.pCtrlActiveSwordType !== 0 || reloadShieldState.pCtrlActiveShieldType !== 0) {
      throw new Error('Unequipped equipment did not persist after reload!');
    }
    console.log('✅ TEST 4 PASSED: Dual unequipped state fully persistent across reloads with zero fallback!');

    // ------------------------------------------------------------------------
    // Take proof screenshot
    // ------------------------------------------------------------------------
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const screenshotPath = path.join(ARTIFACT_DIR, 'proof_dwarf_elf_unequip_verified.png');
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    console.log(`Saved proof screenshot to ${screenshotPath}`);

    console.log('\n🎉 ALL 4 TESTS PASSED FLAWLESSLY ON LIVE PRODUCTION!');
  } finally {
    if (cdp?.ws) cdp.ws.close();
    chromeProc.kill('SIGKILL');
  }
}

runSuite().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
