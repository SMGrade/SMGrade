import { spawn } from 'child_process';
import fs from 'fs';

async function main() {
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const port = 9222;
  const url = process.argv[2] || 'http://localhost:5173/arcade?mode=hub';
  const outPath = process.argv[3] || '/Users/machd/.gemini/antigravity/brain/4ba0c00a-0973-4dc4-bb0f-1a756ce98e77/hub_live_cdp.png';

  console.log('Starting headless Chrome on port', port, 'visiting', url);

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--use-gl=angle',
    '--use-angle=metal',
    '--enable-webgl',
    `--remote-debugging-port=${port}`,
    '--window-size=1280,800',
    '--user-data-dir=/tmp/chrome-test-profile-' + Date.now(),
    url
  ], { stdio: 'ignore' });

  // Wait 2s for port to open
  await new Promise(r => setTimeout(r, 2000));

  let targets = null;
  for (let i = 0; i < 10; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      targets = await res.json();
      if (targets && targets.length > 0) break;
    } catch(e) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  if (!targets || targets.length === 0) {
    chromeProc.kill();
    throw new Error('No Chrome targets found');
  }

  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  console.log('Connected to target:', pageTarget.title, pageTarget.url);

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map(a => a.value || JSON.stringify(a)).join(' ');
      console.log(`[Browser Console ${msg.params.type}]:`, text);
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

  console.log('Waiting 5 seconds for PlayCanvas shaders, GLBs, textures, and terrain to fully render...');
  await new Promise(r => setTimeout(r, 5000));

  const evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const pc = window.pc;
      const app = pc.app || pc.Application.getApplication();
      if (!app) return { error: "No pc.app found" };
      const root = app.root;
      const findEnts = (node) => {
        return {
          name: node.name,
          pos: node.getPosition().toString(),
          scale: node.getLocalScale().toString(),
          children: node.children.map(findEnts)
        };
      };
      const cam = app.root.findByName("HubCamera");
      const player = app.root.findByName("PlayerRoot");
      const map = app.root.findByName("WorldMap");
      const renders = map ? map.findComponents("render") : [];
      const meshInfo = renders.map(r => {
        return {
          entityName: r.entity.name,
          meshCount: r.meshInstances.length,
          meshes: r.meshInstances.map((m, idx) => ({
            idx,
            aabbCenter: m.aabb.center.toString(),
            aabbHalf: m.aabb.halfExtents.toString(),
            visible: m.visible,
            materialName: m.material ? m.material.name : null
          }))
        };
      });
      return {
        camPos: cam ? cam.getPosition().toString() : null,
        camRot: cam ? cam.getEulerAngles().toString() : null,
        playerPos: player ? player.getPosition().toString() : null,
        mapPos: map ? map.getPosition().toString() : null,
        mapScale: map ? map.getLocalScale().toString() : null,
        meshInfo
      };
    })()`,
    returnByValue: true
  });
  console.log('Scene Evaluation:', JSON.stringify(evalRes.result.value, null, 2));

  console.log('Capturing screenshot via CDP...');
  const result = await send('Page.captureScreenshot', { format: 'png' });

  if (result && result.data) {
    const buf = Buffer.from(result.data, 'base64');
    fs.writeFileSync(outPath, buf);
    console.log(`Success! Saved ${buf.length} bytes to ${outPath}`);
  } else {
    console.error('Failed to capture screenshot:', result);
  }

  ws.close();
  chromeProc.kill();
}

main().catch(err => {
  console.error('Error in capture_hub:', err);
  process.exit(1);
});
