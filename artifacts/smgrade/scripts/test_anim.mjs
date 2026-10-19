import { spawn } from 'child_process';
import fs from 'fs';

async function main() {
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const port = 9227;
  const url = 'http://localhost:5173/arcade?mode=hub';
  const outPath = '/Users/machd/.gemini/antigravity/brain/4ba0c00a-0973-4dc4-bb0f-1a756ce98e77/test_player_idle_captured.png';

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--use-gl=angle',
    '--use-angle=metal',
    '--enable-webgl',
    `--remote-debugging-port=${port}`,
    '--window-size=1280,800',
    '--user-data-dir=/tmp/chrome-test-anim-' + Date.now(),
    url
  ], { stdio: 'ignore' });

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

  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

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
  await new Promise(r => setTimeout(r, 4000));

  const evalRes = await send('Runtime.evaluate', {
    expression: `new Promise((resolve) => {
      const pc = window.pc;
      const app = pc.Application.getApplication();
      const player = app.root.findByName("PlayerRoot");
      if (!player) return resolve({ error: "No PlayerRoot" });

      // Fetch playerAnimGraph.json
      fetch("/hub-assets/playerAnimGraph.json")
        .then(r => r.json())
        .then(graphData => {
          const graphAsset = new pc.Asset("animGraph", "animstategraph", null, graphData);
          app.assets.add(graphAsset);
          app.assets.load(graphAsset);

          graphAsset.ready(() => {
            if (!player.anim) {
              player.addComponent("anim", {
                stateGraphAsset: graphAsset.id,
                activate: true,
                speed: 1.0
              });
            }

            app.assets.loadFromUrl("/hub-assets/Idle.glb", "container", (iErr, iAsset) => {
              if (iErr || !iAsset) return resolve({ error: "Idle load err: " + iErr });
              app.assets.loadFromUrl("/hub-assets/Run.glb", "container", (rErr, rAsset) => {
                if (rErr || !rAsset) return resolve({ error: "Run load err: " + rErr });

                try {
                  const idleTrack = iAsset.resource.animations[0];
                  const runTrack = rAsset.resource.animations[0];

                  player.anim.assignAnimation("Base:Idle", idleTrack);
                  player.anim.assignAnimation("Base:Run", runTrack);
                  player.anim.setBoolean("isRunning", false);

                  resolve({
                    success: true,
                    playing: player.anim.playing,
                    layers: player.anim.layers.length,
                    activeState: player.anim.baseLayer.activeState
                  });
                } catch(e) {
                  resolve({ error: "Assign error: " + e.toString() });
                }
              });
            });
          });
        })
        .catch(err => resolve({ error: err.toString() }));
    })`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Animation Evaluation Result:', evalRes.result.value);

  // Wait 2 seconds for animation frames to render
  await new Promise(r => setTimeout(r, 2000));

  const result = await send('Page.captureScreenshot', { format: 'png' });
  if (result && result.data) {
    fs.writeFileSync(outPath, Buffer.from(result.data, 'base64'));
    console.log(`Saved screenshot to ${outPath}`);
  }

  ws.close();
  chromeProc.kill();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
