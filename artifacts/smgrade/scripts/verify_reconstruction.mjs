import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = '/Users/machd/.gemini/antigravity/brain/4ba0c00a-0973-4dc4-bb0f-1a756ce98e77';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9222;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runBrowserTests() {
  console.log('--- Launching Chrome for SMGrade Authentic Reconstruction Verification ---');
  const chromeProc = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--use-gl=angle',
      '--use-angle=metal',
      '--enable-webgl',
      `--remote-debugging-port=${PORT}`,
      '--window-size=1280,800',
      '--user-data-dir=/tmp/chrome-rec-profile-' + Date.now(),
      'http://localhost:5173/arcade?mode=hub',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  chromeProc.stderr?.on('data', (d) => {
    // console.log('[Chrome Stderr]:', d.toString().slice(0, 100));
  });

  await sleep(2500);

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

  async function capture(fileName) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    if (res && res.data) {
      const outPath = path.join(ARTIFACT_DIR, fileName);
      fs.writeFileSync(outPath, Buffer.from(res.data, 'base64'));
      console.log(`[CAPTURED] ${fileName} (${fs.statSync(outPath).size} bytes)`);
      return outPath;
    }
    throw new Error(`Failed to capture ${fileName}`);
  }

  async function evaluate(code) {
    const res = await send('Runtime.evaluate', {
      expression: code,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      console.error('[Eval Exception]:', res.exceptionDetails);
    }
    return res.result ? res.result.value : null;
  }

  await send('Runtime.enable');
  await send('Page.enable');

  console.log('Waiting 5s for HubEngine and 3D assets to load...');
  await sleep(5000);

  // Setup: Equip 3 authentic pets in formation (Ponyo, Leo, Octoo) via local state / window
  console.log('\n--- PROOF 1: Multi-Pet 3D Formation & Speed Multiplier ---');
  const petSetup = await evaluate(`(() => {
    const hubSaveKey = 'smgrade_hub_save_v1';
    let data = null;
    try {
      data = JSON.parse(localStorage.getItem(hubSaveKey) || '{}');
    } catch(e) {}
    if (!data || typeof data !== 'object') data = {};
    if (!data.items) data.items = [];
    if (!data.gold) data.gold = 500000000000;
    if (!data.ores) data.ores = { 0: 20, 1: 15, 2: 10, 3: 5, 4: 2 };
    if (!data.bars) data.bars = { 0: 5, 1: 3, 2: 2, 3: 1, 4: 1 };

    const pet1 = {
      id: 'pet-0-ponyo',
      instanceId: 'inst-ponyo',
      name: 'Ponyo',
      type: 'pet',
      typeId: 0,
      currentLevel: 1,
      rarity: 'Common',
      baseValue: 2.0,
      maxLevel: 10,
      petMultiplier: 2.0,
      image: '/images/pets/ponyo.png'
    };
    const pet2 = {
      id: 'pet-1-leo',
      instanceId: 'inst-leo',
      name: 'Leo',
      type: 'pet',
      typeId: 1,
      currentLevel: 1,
      rarity: 'Epic',
      baseValue: 3.0,
      maxLevel: 10,
      petMultiplier: 3.0,
      image: '/images/pets/leo.png'
    };
    const pet3 = {
      id: 'pet-2-octoo',
      instanceId: 'inst-octoo',
      name: 'Octoo',
      type: 'pet',
      typeId: 2,
      currentLevel: 1,
      rarity: 'Legendary',
      baseValue: 4.5,
      maxLevel: 10,
      petMultiplier: 4.5,
      image: '/images/pets/octoo.png'
    };

    data.items = [pet1, pet2, pet3, ...data.items.filter(i => !['inst-ponyo', 'inst-leo', 'inst-octoo'].includes(i.instanceId))];
    data.equippedPets = [pet1, pet2, pet3];
    data.equippedPet = pet1;
    localStorage.setItem(hubSaveKey, JSON.stringify(data));
    return { success: true, count: data.equippedPets.length };
  })()`);

  console.log('Pet setup in storage:', petSetup);
  await send('Page.reload');
  console.log('Reloaded page to load equipped 3-pet formation. Waiting 5s...');
  await sleep(5000);

  // Check 3D followers in PlayCanvas scene
  const scenePets = await evaluate(`(() => {
    const pc = window.pc;
    const app = pc.app || pc.Application.getApplication();
    const followers = app.root.children.filter(c => c.name && c.name.startsWith('PetFollower_'));
    const player = app.root.findByName('PlayerRoot');
    const cam = app.root.findByName('HubCamera');
    
    // Position camera for optimal view of player and 3 trailing pets
    const engine = window.__hubEngine;
    if (engine) {
      engine.cameraTargetOverride = null;
      engine.setCameraOrbit(0, 16, 6.8);
    }

    return {
      followerCount: followers.length,
      followers: followers.map(f => ({
        name: f.name,
        pos: f.getPosition().toString(),
        childCount: f.children.length
      })),
      playerPos: player ? player.getPosition().toString() : null
    };
  })()`);

  console.log('Scene Pets Inspection:', scenePets);
  await sleep(1500);
  await capture('reconstruction_proof_01_multi_pet_formation.png');

  // PROOF 2: Open Pet Sanctuary Modal to show Slot 1, Slot 2, Slot 3 & Stats
  console.log('\n--- PROOF 2: Authentic Pet Sanctuary Modal UI ---');
  await evaluate(`(() => {
    // Dispatch 'p' key to toggle Pet Modal
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', code: 'KeyP', bubbles: true }));
  })()`);
  await sleep(1500);
  await capture('reconstruction_proof_02_pet_modal_formation_ui.png');

  // Close pet modal
  await evaluate(`(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
  })()`);
  await sleep(1000);

  // PROOF 3: Fountain Collision & Splash Respawn Physics
  console.log('\n--- PROOF 3: Water Fall & Respawn Trigger ---');
  const respawnTest = await evaluate(`(() => {
    const engine = window.__hubEngine;
    if (!engine) return { error: 'No __hubEngine found' };
    engine.playerPos = { x: 75, y: -2.5, z: 0 };
    return {
      teleportedPos: engine.playerPos
    };
  })()`);
  console.log('Ocean drop position:', respawnTest);
  await sleep(1000); // Wait for water detection and 450ms respawn timeout

  const respawnResult = await evaluate(`(() => {
    const engine = window.__hubEngine;
    const ppos = engine ? engine.playerPos : { x: 0, y: 0, z: 0 };
    if (engine) {
      engine.cameraTargetOverride = null;
      engine.setCameraOrbit(0, 18, 7.5);
    }
    return {
      currentPos: ppos,
      isAtSpawn: Math.abs(ppos.x - 2.0) < 0.5 && Math.abs(ppos.z - 50.0) < 0.5
    };
  })()`);
  console.log('Post-Water Fall Respawn Result:', respawnResult);
  await capture('reconstruction_proof_03_water_respawn.png');

  // PROOF 4: Authentic Dwarf NPC Bronn with Face & Sword Prop
  console.log('\n--- PROOF 4: Dwarf NPC Bronn Inspection ---');
  await evaluate(`(() => {
    const pc = window.pc;
    const app = pc.app || pc.Application.getApplication();
    const engine = window.__hubEngine;
    const bronn = app.root.findByName('Station_Bronn_Up');
    if (engine && bronn) {
      const bpos = bronn.getPosition();
      engine.cameraTargetOverride = { x: bpos.x, y: bpos.y + 0.5, z: bpos.z };
      engine.setCameraOrbit(135, 14, 3.2);
    }
  })()`);
  await sleep(1500);
  await capture('reconstruction_proof_04_dwarf_bronn_intact.png');

  // PROOF 5: Dwarf Puncher Mode Intact
  console.log('\n--- PROOF 5: Dwarf Puncher Mode Intact ---');
  await evaluate(`(() => {
    window.location.href = '/arcade?mode=puncher';
  })()`);
  await sleep(4000);
  await capture('reconstruction_proof_05_dwarf_puncher_intact.png');

  console.log('\n=== ALL PROOFS CAPTURED SUCCESSFULLY ===');
  ws.close();
  chromeProc.kill();
}

runBrowserTests().catch((err) => {
  console.error('Browser test failed:', err);
  process.exit(1);
});
