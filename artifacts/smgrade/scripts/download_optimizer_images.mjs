import fs from "fs";
import path from "path";

const BASE_URL = "https://huggingface.co/spaces/oettaM123/swordmasters-optimizer/raw/main/static/images";
const TARGET_DIR = path.resolve(process.cwd(), "public/images");

async function downloadFile(relativeUrl, targetPath) {
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 100) {
    return; // Already downloaded
  }
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const url = `${BASE_URL}/${relativeUrl}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Failed to fetch ${url} (status: ${res.status})`);
      return;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(targetPath, buf);
    console.log(`Saved ${path.basename(targetPath)} (${buf.length} bytes)`);
  } catch (err) {
    console.error(`Error downloading ${url}:`, err.message);
  }
}

async function run() {
  console.log("Fetching image-config.json...");
  const configRes = await fetch(`${BASE_URL}/image-config.json`);
  const config = await configRes.json();
  fs.mkdirSync(TARGET_DIR, { recursive: true });
  fs.writeFileSync(path.join(TARGET_DIR, "image-config.json"), JSON.stringify(config, null, 2));

  // 1. Swords
  console.log(`Downloading ${Object.keys(config.swords || {}).length} sword images...`);
  for (const [name, filename] of Object.entries(config.swords || {})) {
    await downloadFile(`swords/${filename}`, path.join(TARGET_DIR, "swords", filename));
  }

  // 2. Shields
  console.log(`Downloading ${Object.keys(config.shields || {}).length} shield images...`);
  for (const [name, filename] of Object.entries(config.shields || {})) {
    await downloadFile(`shields/${filename}`, path.join(TARGET_DIR, "shields", filename));
  }

  // 3. Pets
  console.log(`Downloading ${Object.keys(config.pets || {}).length} pet images...`);
  for (const [name, filename] of Object.entries(config.pets || {})) {
    await downloadFile(`pets/${filename}`, path.join(TARGET_DIR, "pets", filename));
  }

  // 4. Ores
  console.log(`Downloading ${Object.keys(config.ores || {}).length} ore images...`);
  for (const [name, filename] of Object.entries(config.ores || {})) {
    await downloadFile(`ores/${filename}`, path.join(TARGET_DIR, "ores", filename));
  }

  // 5. Currencies & Icons
  await downloadFile("gold.png", path.join(TARGET_DIR, "gold.png"));
  await downloadFile("power.png", path.join(TARGET_DIR, "power.png"));

  console.log("Finished downloading authentic SwordMasters Optimizer artwork!");
}

run().catch(console.error);
