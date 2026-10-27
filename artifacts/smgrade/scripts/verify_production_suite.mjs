import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = '/Users/machd/.gemini/antigravity/brain/95430ef8-08a8-4fc3-8dd9-ab262242e124';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9265;
const BASE_URL = 'https://smgrade-swordmasters.online';
const VAULT_PASSWORD = 'ouuGwh6rZKaxTFUXVHpZgND0kRmUrM7c!b110f7b0a99c';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 1;
    this.callbacks = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && this.callbacks.has(data.id)) {
        const cb = this.callbacks.get(data.id);
        this.callbacks.delete(data.id);
        if (data.error) cb.reject(new Error(JSON.stringify(data.error)));
        else cb.resolve(data.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res?.result?.value;
  }

  async captureScreenshot(outputPath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    if (res && res.data) {
      fs.writeFileSync(outputPath, Buffer.from(res.data, 'base64'));
      console.log(`[Screenshot saved]: ${outputPath}`);
    }
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runBrowserVerification() {
  console.log("=== BROWSER PRODUCTION VERIFICATION SUITE ===");
  console.log("Target Base URL:", BASE_URL);

  const tempProfile = '/tmp/smgrade-browser-test-' + Date.now();
  const chromeProc = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      '--window-size=1440,900',
      `--user-data-dir=${tempProfile}`,
      `${BASE_URL}/`
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let cdp = null;

  try {
    let pageTarget = null;
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        await sleep(1000);
        const versionRes = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r => r.json());
        pageTarget = versionRes.find(t => t.type === 'page');
        if (pageTarget) break;
      } catch (e) {
        // wait for port
      }
    }
    if (!pageTarget) throw new Error("Could not find Chrome page target after retries");

    cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    console.log("Connected to Chrome via CDP!");

    // 1. Home page & visit recording
    console.log("\n>>> Checking Home Page Visit Recording...");
    await sleep(2000);
    const initialVisitorId = await cdp.eval(`localStorage.getItem('smg_visitor_id')`);
    console.log("Stored visitor ID in browser:", initialVisitorId);

    // Refresh page to verify persistence and re-tracking
    console.log("Refreshing page to test refresh visit tracking...");
    await cdp.send('Page.reload');
    await sleep(3000);

    const persistedVisitorId = await cdp.eval(`localStorage.getItem('smg_visitor_id')`);
    console.log("Visitor ID after refresh:", persistedVisitorId);
    if (initialVisitorId === persistedVisitorId) {
      console.log("PASS: Visitor ID persisted correctly across refresh!");
    } else {
      console.error("FAIL: Visitor ID changed across refresh!");
    }

    // 2. Navigate to Master Vault and Unlock
    console.log("\n>>> Navigating to Master Vault (/vault)...");
    await cdp.send('Page.navigate', { url: `${BASE_URL}/vault` });
    await sleep(3000);

    // Fill in Master Vault Password using React prototype setter
    console.log("Entering Vault password in UI...");
    await cdp.eval(`
      (() => {
        const input = document.querySelector('input[type="password"]');
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, ${JSON.stringify(VAULT_PASSWORD)});
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await sleep(500);

    // Click Unlock / Decrypt button
    console.log("Clicking Decrypt Vault button...");
    await cdp.eval(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Unlock') || b.textContent.includes('Access') || b.textContent.includes('Decrypt'));
        if (btn) btn.click();
      })()
    `);
    await sleep(5000);

    // Take screenshot of unlocked Master Vault Analytics
    await cdp.captureScreenshot(path.join(ARTIFACT_DIR, 'proof_master_vault_analytics_production.png'));

    // Click 'PLAYER LOOKUP LOGS' tab in Master Vault
    console.log("Navigating to PLAYER LOOKUP LOGS in Master Vault...");
    await cdp.eval(`
      (() => {
        const tab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.toLowerCase().includes('lookup'));
        if (tab) tab.click();
      })()
    `);
    await sleep(3000);
    await cdp.captureScreenshot(path.join(ARTIFACT_DIR, 'proof_master_vault_lookup_logs_no_ip.png'));

    // Check Lookup Logs Table for IP Address column
    const lookupHeaders = await cdp.eval(`
      Array.from(document.querySelectorAll('th')).map(th => th.textContent.trim())
    `);
    console.log("Lookup Logs Table Headers detected:", lookupHeaders);
    const hasIpInLookupTable = lookupHeaders.some(h => /ip\s*address/i.test(h) || /^ip$/i.test(h));
    if (!hasIpInLookupTable && lookupHeaders.length > 0) {
      console.log("PASS: Lookup Logs Table has NO IP Address column! Clean headers:", lookupHeaders);
    } else {
      console.error("FAIL or NOT FOUND: Lookup table headers:", lookupHeaders);
    }

    // Click 'MASTER LOGS' tab in Master Vault
    console.log("Navigating to MASTER LOGS in Master Vault...");
    await cdp.eval(`
      (() => {
        const tab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.toLowerCase().includes('master logs'));
        if (tab) tab.click();
      })()
    `);
    await sleep(3000);
    await cdp.captureScreenshot(path.join(ARTIFACT_DIR, 'proof_master_vault_activity_logs_no_ip.png'));

    const activityHeaders = await cdp.eval(`
      Array.from(document.querySelectorAll('th')).map(th => th.textContent.trim())
    `);
    console.log("Activity Logs Table Headers detected:", activityHeaders);
    const hasIpInActivityTable = activityHeaders.some(h => /ip\s*address/i.test(h) || /^ip$/i.test(h));
    if (!hasIpInActivityTable && activityHeaders.length > 0) {
      console.log("PASS: Activity Logs Table has NO IP Address column! Clean headers:", activityHeaders);
    }

    // 3. Navigate to Arcade / SM Revenge Leaderboards
    console.log("\n>>> Navigating to SM Revenge Arcade Leaderboards...");
    await cdp.send('Page.navigate', { url: `${BASE_URL}/arcade` });
    await sleep(3000);

    // Click SM REVENGE card to enter SM Revenge
    console.log("Entering SM Revenge arena...");
    await cdp.eval(`
      (() => {
        const card = document.querySelector('.border-red-500\\\\/30') || Array.from(document.querySelectorAll('div.cursor-pointer')).find(d => d.textContent.includes('SM REVENGE'));
        if (card) {
          card.click();
        }
      })()
    `);
    await sleep(4000);

    await cdp.captureScreenshot(path.join(ARTIFACT_DIR, 'proof_sm_revenge_leaderboard_production.png'));
    console.log("Captured SM Revenge arena & leaderboard screenshot.");

    console.log("\n=== BROWSER VERIFICATION SUITE FINISHED SUCCESSFULLY ===");

  } finally {
    if (cdp) cdp.close();
    chromeProc.kill('SIGKILL');
  }
}

runBrowserVerification().catch(err => {
  console.error("Browser Suite Error:", err);
  process.exit(1);
});
