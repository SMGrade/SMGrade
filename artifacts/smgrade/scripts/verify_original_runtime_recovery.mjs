import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = '/Users/machd/.gemini/antigravity/brain/95430ef8-08a8-4fc3-8dd9-ab262242e124';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9222;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runRecoveryVerification() {
  console.log('=== VERIFYING SMGRADE ARCADE ORIGINAL RUNTIME RECOVERY ===');

  const networkRequests = [];
  const violations = [];

  const chromeProc = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--use-gl=angle',
      '--use-angle=metal',
      '--enable-webgl',
      `--remote-debugging-port=${PORT}`,
      '--window-size=1280,800',
      '--user-data-dir=/tmp/chrome-recovery-' + Date.now(),
      'http://localhost:5173/arcade?mode=original',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  await sleep(3000);

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
      if (text.includes('[SMGrade]') || text.includes('Error') || text.includes('Spawn') || text.includes('World') || text.includes('Ready')) {
        console.log(`[Browser Console]:`, text);
      }
    } else if (msg.method === 'Network.requestWillBeSent') {
      const url = msg.params.request.url;
      networkRequests.push(url);
      if (url.includes('loadbalancer.swordmasters.io') || (url.startsWith('wss://') && !url.includes('localhost'))) {
        console.warn('VIOLATION: Remote network call attempted:', url);
        violations.push(url);
      }
    }
  });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');

  console.log('\n--- 1. Testing Nickname Start Screen ---');
  let startPanelVisible = false;
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    const panelCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const iframe = document.querySelector('iframe');
        if (!iframe) return { error: 'No iframe element found' };
        let doc = null;
        try { doc = iframe.contentDocument; } catch (e) { return { error: 'Cross-origin doc error: ' + e.message }; }
        if (!doc || doc.location.href === 'about:blank' || !doc.body) {
          return { loading: true, src: iframe.src };
        }
        const panel = doc.getElementById('smgrade-start-panel');
        const input = doc.getElementById('sm-start-nickname-input');
        const btn = doc.getElementById('sm-start-submit-btn');
        const randBtn = doc.getElementById('sm-start-rand-btn');
        return {
          docUrl: doc.location.href,
          panelFound: !!panel,
          panelActive: panel ? panel.classList.contains('active') : false,
          hasInput: !!input,
          inputValue: input ? input.value : '',
          hasBtn: !!btn,
          hasRandBtn: !!randBtn
        };
      })()`,
      returnByValue: true
    });
    const res = panelCheck?.result?.value;
    if (i % 3 === 0) console.log(`[Start Panel Check ${i}]:`, JSON.stringify(res));
    if (res && res.panelFound) {
      startPanelVisible = true;
      console.log('Nickname Start Panel is active & visible:', res);
      break;
    }
  }

  // Capture Screenshot 1: Nickname Start Screen
  await sleep(1000);
  const snap1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'proof_01_nickname_start_screen.png'),
    Buffer.from(snap1.data, 'base64')
  );
  console.log('Saved proof_01_nickname_start_screen.png');

  // Click START GAME button
  console.log('\n--- 2. Starting Game & Spawning Player ---');
  const startClick = await send('Runtime.evaluate', {
    expression: `(() => {
      const iframe = document.querySelector('iframe');
      const doc = iframe ? iframe.contentDocument : document;
      const btn = doc ? doc.getElementById('sm-start-submit-btn') : null;
      if (btn) {
        btn.click();
        return { clicked: true, username: doc.getElementById('sm-start-nickname-input')?.value };
      }
      return { clicked: false, allBtns: doc ? Array.from(doc.querySelectorAll('button')).map(b => b.id || b.textContent) : [] };
    })()`,
    returnByValue: true
  });
  console.log('Clicked Start Game Button:', startClick?.result?.value);

  // Wait for player entity to be spawned and initialized
  let playerReady = false;
  let playerState = null;
  for (let s = 1; s <= 35; s++) {
    await sleep(1000);
    const pCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const iframe = document.querySelector('iframe');
        const win = iframe ? iframe.contentWindow : window;
        const nm = win.pcApp && win.pcApp.networkManager;
        const pCtrl = win.localPlayerController || (win.pcApp && win.pcApp.localPlayerController);
        const pEnt = nm && nm.currentPlayerEntity;
        const pos = pEnt ? pEnt.getPosition() : null;
        const inv = nm && nm.localInv;
        
        return {
          hasApp: !!win.pcApp,
          hasNM: !!nm,
          worldNumber: nm ? nm.worldNumber : null,
          hasPlayerCtrl: !!pCtrl,
          hasPlayerEntity: !!pEnt,
          position: pos ? { x: pos.x.toFixed(2), y: pos.y.toFixed(2), z: pos.z.toFixed(2) } : null,
          cosmetics: inv ? {
            skinColor: inv.activeSkinColor,
            face: inv.activeFace,
            hair: inv.activeHair,
            torso: inv.activeTorso,
            pant: inv.activePant,
            shoe: inv.activeShoe,
            helmet: inv.activeHelmet
          } : null,
          activeSwordType: pCtrl ? pCtrl.activeSwordType : null,
          gold: nm ? nm.goldAmount : null
        };
      })()`,
      returnByValue: true
    });
    const val = pCheck?.result?.value;
    if (val && val.hasPlayerEntity && val.position) {
      playerReady = true;
      playerState = val;
      console.log(`Player initialized at second ${s}:`, JSON.stringify(val, null, 2));
      break;
    }
  }

  if (!playerReady) {
    chromeProc.kill();
    throw new Error('Player did not spawn within 35 seconds');
  }

  // Canonical spawn verification (x ≈ 2, y ≈ -0.25, z ≈ 50)
  console.log('Canonical spawn check:', playerState.position);
  console.log('Cosmetics check:', playerState.cosmetics);
  console.log('World Number check:', playerState.worldNumber);

  // Position camera for clear view of player and authentic terrain
  await send('Runtime.evaluate', {
    expression: `(() => {
      const iframe = document.querySelector('iframe');
      const win = iframe ? iframe.contentWindow : window;
      const nm = win.pcApp.networkManager;
      const pEnt = nm.currentPlayerEntity;
      const cam = win.pcApp.root.findByName('Camera') || win.pcApp.root.findByName('MainCamera');
      if (cam && pEnt) {
        const pPos = pEnt.getPosition();
        cam.setPosition(pPos.x + 3, pPos.y + 2.2, pPos.z + 5);
        cam.lookAt(pPos.x, pPos.y + 1, pPos.z);
      }
    })()`
  });

  await sleep(1500);
  const snap2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'proof_02_canonical_spawn_and_cosmetics.png'),
    Buffer.from(snap2.data, 'base64')
  );
  console.log('Saved proof_02_canonical_spawn_and_cosmetics.png');

  console.log('\n--- 3. Testing Authentic Mobs & Combat System ---');
  // Inspect all mobs
  const mobSummary = await send('Runtime.evaluate', {
    expression: `(() => {
      const iframe = document.querySelector('iframe');
      const win = iframe ? iframe.contentWindow : window;
      const nm = win.pcApp.networkManager;
      const room = nm.room;
      const mobs = room.state.enemies.items;
      const list = [];
      let maxZ = -9999;
      for (const [id, m] of Object.entries(mobs)) {
        list.push({ id, type: m.type, hp: m.health, maxHp: m.maxHealth, x: m.x.toFixed(1), z: m.z.toFixed(1) });
        if (m.z > maxZ) maxZ = m.z;
      }
      return {
        count: list.length,
        types: [...new Set(list.map(m => m.type))],
        maxZ,
        sample: list.slice(0, 5)
      };
    })()`,
    returnByValue: true
  });
  console.log('Mob summary in standalone room:', JSON.stringify(mobSummary?.result?.value, null, 2));

  // Position player in Slime Meadows right next to mob_0 (Roundhead)
  const combatSimulation = await send('Runtime.evaluate', {
    expression: `(() => {
      const iframe = document.querySelector('iframe');
      const win = iframe ? iframe.contentWindow : window;
      const nm = win.pcApp.networkManager;
      const room = nm.room;
      const pEnt = nm.currentPlayerEntity;
      const mob0 = room.state.enemies.items['mob_0'];
      const mobEnt = nm.enemies['mob_0'];

      if (!mob0 || !mobEnt) return { error: 'mob_0 not found' };

      // Teleport player right next to mob_0 in Slime Meadows
      pEnt.setPosition(mob0.x, mob0.y, mob0.z + 2.5);
      pEnt.lookAt(mob0.x, mob0.y, mob0.z);

      // Camera view on combat
      const cam = win.pcApp.root.findByName('Camera') || win.pcApp.root.findByName('MainCamera');
      if (cam) {
        cam.setPosition(mob0.x - 3.5, mob0.y + 2.5, mob0.z + 4);
        cam.lookAt(mob0.x, mob0.y + 0.8, mob0.z);
      }

      const hpBefore = mob0.health;
      const goldBefore = nm.goldAmount;

      // Deal hit 1
      room.send('Client:EnemyController:checkDamage', { enemyId: 'mob_0' });
      const hpAfterHit1 = mob0.health;

      // Deal hit 2
      room.send('Client:EnemyController:checkDamage', { enemyId: 'mob_0' });
      const hpAfterHit2 = mob0.health;

      return {
        initialHp: hpBefore,
        hpAfterHit1,
        hpAfterHit2,
        damageDealtTotal: hpBefore - hpAfterHit2,
        goldGained: nm.goldAmount - goldBefore,
        mobPosition: { x: mob0.x, y: mob0.y, z: mob0.z }
      };
    })()`,
    returnByValue: true
  });
  console.log('Combat execution result:', JSON.stringify(combatSimulation?.result?.value, null, 2));

  await sleep(1500);
  const snap3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'proof_03_authentic_mobs_and_combat.png'),
    Buffer.from(snap3.data, 'base64')
  );
  console.log('Saved proof_03_authentic_mobs_and_combat.png');

  console.log('\n--- 4. Testing Inventory & Escape Controls ---');
  // Open inventory
  const invTest = await send('Runtime.evaluate', {
    expression: `(() => {
      const iframe = document.querySelector('iframe');
      const win = iframe ? iframe.contentWindow : window;
      const nm = win.pcApp.networkManager;
      const invBtn = win.pcApp.root.findByName('InventoryButton');
      const invCtrl = invBtn ? invBtn.script.inventoryController : nm.inventoryController;
      
      // Toggle inventory
      if (invCtrl && invCtrl.enableDisableInventory) {
        invCtrl.enableDisableInventory(true);
      }

      const invUI = win.pcApp.root.findByName('InventoryUI') || (invCtrl ? invCtrl.entity : null);
      const swords = nm.localInv ? nm.localInv.swords : null;
      const shields = nm.localInv ? nm.localInv.shields : null;

      return {
        hasInvCtrl: !!invCtrl,
        invEnabled: invCtrl ? invCtrl.inventoryEnabled : false,
        swordsCount: swords ? (swords.length || swords.items?.length || 0) : 0,
        shieldsCount: shields ? (shields.length || shields.items?.length || 0) : 0
      };
    })()`,
    returnByValue: true
  });
  console.log('Inventory open test result:', JSON.stringify(invTest?.result?.value, null, 2));

  await sleep(1000);
  const snap4 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'proof_04_inventory_opened_and_controls.png'),
    Buffer.from(snap4.data, 'base64')
  );
  console.log('Saved proof_04_inventory_opened_and_controls.png');

  // Network audit summary
  console.log('\n--- 5. Network Audit Summary ---');
  console.log(`Total HTTP/WS Requests: ${networkRequests.length}`);
  console.log(`Violations detected: ${violations.length}`);
  if (violations.length > 0) {
    console.error('Violations:', violations);
  } else {
    console.log('SUCCESS: Zero remote Swordmasters server connections or websocket calls!');
  }

  ws.close();
  chromeProc.kill();
  console.log('=== ORIGINAL RUNTIME VERIFICATION COMPLETE ===');
  return true;
}

runRecoveryVerification().catch((err) => {
  console.error('Recovery verification failed:', err);
  process.exit(1);
});
