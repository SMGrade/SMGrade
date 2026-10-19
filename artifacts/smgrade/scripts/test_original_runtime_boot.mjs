import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = '/Users/machd/.gemini/antigravity/brain/4ba0c00a-0973-4dc4-bb0f-1a756ce98e77';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9222;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('=== TESTING ORIGINAL SWORDMASTERS RUNTIME BOOT ===');
  const chromeProc = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--use-gl=angle',
      '--use-angle=metal',
      '--enable-webgl',
      `--remote-debugging-port=${PORT}`,
      '--window-size=1280,720',
      '--user-data-dir=/tmp/chrome-orig-profile-' + Date.now(),
      'http://localhost:5173/original-runtime/index.html',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

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

  const consoleLogs = [];
  const networkFailures = [];

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map((a) => a.value || JSON.stringify(a)).join(' ');
      console.log(`[Browser ${msg.params.type.toUpperCase()}]:`, text);
      consoleLogs.push({ type: msg.params.type, text });
    } else if (msg.method === 'Network.loadingFailed') {
      console.warn('[Network Failed]:', msg.params.errorText, msg.params.requestId);
      networkFailures.push(msg.params);
    }
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

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');

  console.log('Waiting 15s for PlayCanvas engine, modules, assets, and scene to boot...');
  for (let s = 1; s <= 15; s++) {
    await sleep(1000);
    if (s % 3 === 0) {
      const interim = await send('Runtime.evaluate', {
        expression: `(() => {
          const app = window.pc ? (window.pc.app || window.pc.Application.getApplication()) : null;
          if (!app) return { app: null };
          const list = app.assets.list();
          const loaded = list.filter(a => a.loaded);
          const loading = list.filter(a => a.loading);
          return {
            totalAssets: list.length,
            loaded: loaded.length,
            loading: loading.length,
            rootEntities: app.root ? app.root.children.length : 0
          };
        })()`,
        returnByValue: true
      });
      console.log(`[Second ${s}] Status:`, interim.result?.value);
    }
  }

  const evalState = await send('Runtime.evaluate', {
    expression: `(() => {
      const pc = window.pc;
      if (!pc) return { error: "window.pc is not defined" };
      const app = pc.app || pc.Application.getApplication();
      if (!app) return { pcDefined: true, error: "pc.app is not initialized yet" };
      
      const entities = app.root ? app.root.children.map(c => ({
        name: c.name,
        enabled: c.enabled,
        childrenCount: c.children.length
      })) : [];

      const scenes = app.scenes ? app.scenes.list().map(s => ({ name: s.name, url: s.url })) : [];
      const list = app.assets.list();
      const loaded = list.filter(a => a.loaded);
      const loading = list.filter(a => a.loading);

      return {
        pcVersion: pc.version || pc.revision,
        appRunning: app.autoRender,
        sceneCount: scenes.length,
        scenes,
        assets: {
          total: list.length,
          loadedCount: loaded.length,
          loadingCount: loading.length,
          sampleUnloaded: list.filter(a => !a.loaded).slice(0, 10).map(a => ({ id: a.id, name: a.name, type: a.type, file: a.file ? a.file.url : null }))
        },
        rootEntities: entities,
        networkManager: !!app.networkManager,
        colyseus: !!app.colyseus,
        room: app.room ? app.room.name : null
      };
    })()`,
    returnByValue: true,
  });

  console.log('\n--- PLAYCANVAS APP STATE INSPECTION ---');
  console.log(JSON.stringify(evalState ? evalState.result?.value : null, null, 2));

  // Capture screenshot proof
  const snap = await send('Page.captureScreenshot', { format: 'png' });
  if (snap && snap.data) {
    const outPath = path.join(ARTIFACT_DIR, 'proof_original_runtime_boot.png');
    fs.writeFileSync(outPath, Buffer.from(snap.data, 'base64'));
    console.log(`[CAPTURED] proof_original_runtime_boot.png (${fs.statSync(outPath).size} bytes)`);
  }

  ws.close();
  chromeProc.kill();
  console.log('=== TEST COMPLETE ===');
}

main().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
