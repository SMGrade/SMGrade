import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = '/Users/machd/.gemini/antigravity/brain/4ba0c00a-0973-4dc4-bb0f-1a756ce98e77';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9222;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function captureRoute(url, fileName, waitMs = 5000) {
  console.log(`--- Capturing ${url} -> ${fileName} ---`);
  const chromeProc = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--use-gl=angle',
      '--use-angle=metal',
      '--enable-webgl',
      `--remote-debugging-port=${PORT}`,
      '--window-size=1280,820',
      '--user-data-dir=/tmp/chrome-snap-' + Date.now(),
      url,
    ],
    { stdio: 'ignore' }
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

  await send('Page.enable');
  await send('Runtime.enable');

  console.log(`Waiting ${waitMs / 1000}s for assets and frame rendering...`);
  await sleep(waitMs);

  const snap = await send('Page.captureScreenshot', { format: 'png' });
  if (snap && snap.data) {
    const outPath = path.join(ARTIFACT_DIR, fileName);
    fs.writeFileSync(outPath, Buffer.from(snap.data, 'base64'));
    console.log(`[CAPTURED] ${fileName} (${fs.statSync(outPath).size} bytes)`);
  }

  ws.close();
  chromeProc.kill();
}

async function runAll() {
  await captureRoute('http://localhost:5173/arcade?mode=original', 'proof_01_arcade_original_mmo_mode.png', 14000);
  await sleep(2000);
  await captureRoute('http://localhost:5173/arcade?mode=hub', 'proof_02_arcade_hub_mode_intact.png', 5000);
  await sleep(2000);
  await captureRoute('http://localhost:5173/arcade?mode=puncher', 'proof_03_arcade_puncher_mode_intact.png', 4000);
}

runAll().catch((e) => {
  console.error('Capture error:', e);
  process.exit(1);
});
