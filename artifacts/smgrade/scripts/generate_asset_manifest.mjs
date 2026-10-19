import fs from "fs";
import path from "path";

const rootDir = process.cwd();
const hubAssetsDir = path.join(rootDir, "public/hub-assets");
const originalSourceDir = path.join(rootDir, "original_source");
const imagesDir = path.join(rootDir, "public/images");

function getCategory(filename, ext) {
  const f = filename.toLowerCase();
  if (f.includes("swordpack") || f.includes("sword")) return "weapons/swords";
  if (f.includes("shieldpack") || f.includes("shield")) return "weapons/shields";
  if (f.includes("armor")) return "equipment/armor";
  if (f.includes("pet") || f.includes("bear") || f.includes("axolotl") || f.includes("croc") || f.includes("fok") || f.includes("penguin") || f.includes("polar")) return "pets";
  if (f.includes("orc") || f.includes("roundhead") || f.includes("enemy") || f.includes("demon") || f.includes("slime")) return "characters/mobs";
  if (f.includes("player") || f.includes("swordmaster") || f.includes("face") || f.includes("hair")) return "characters/player";
  if (f.includes("dwarf") || f.includes("ironsmith") || f.includes("demirci") || f.includes("mage") || f.includes("elf") || f.includes("farmer")) return "characters/npcs";
  if (f.includes("run") || f.includes("idle") || f.includes("jump") || f.includes("slash") || f.includes("dance") || f.includes("died") || f.includes("sit") || f.includes("showoff")) return "animations";
  if (f.includes("world") || f.includes("map") || f.includes("collider") || f.includes("portal") || f.includes("ship") || f.includes("chest") || f.includes("water") || f.includes("soil") || f.includes("skybox")) return "environment";
  if (f.includes("audio") || ext === ".mp3" || ext === ".wav" || ext === ".ogg") return "audio";
  if (f.includes("fire") || f.includes("dust") || f.includes("clover") || f.includes("confetti") || f.includes("glow") || f.includes("dalga") || f.includes("palette")) return "effects";
  if (f.includes("draco") || f.includes("playcanvas") || f.includes("scripts") || ext === ".wasm") return "runtime";
  if (ext === ".png" || ext === ".jpg" || ext === ".jpeg" || ext === ".webp") return "textures";
  if (ext === ".json") return "manifests";
  return "other";
}

function scanDir(dir, baseRelPath) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.join(baseRelPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanDir(fullPath, relPath));
    } else {
      const stat = fs.statSync(fullPath);
      const ext = path.extname(entry.name).toLowerCase();
      const cat = getCategory(entry.name, ext);
      
      let isValid = stat.size > 0;
      if (ext === ".glb") {
        try {
          const buf = fs.readFileSync(fullPath);
          const magic = buf.readUInt32LE(0);
          isValid = (magic === 0x46546c67); // "glTF"
        } catch {
          isValid = false;
        }
      } else if (ext === ".json") {
        try {
          JSON.parse(fs.readFileSync(fullPath, "utf8"));
          isValid = true;
        } catch {
          isValid = false;
        }
      }

      results.push({
        name: entry.name,
        path: relPath,
        category: cat,
        format: ext.replace(".", "").toUpperCase(),
        sizeBytes: stat.size,
        isValid,
        integrated: true,
        source: "PlayCanvas / Swordmasters Authentic CDN"
      });
    }
  }
  return results;
}

const allAssets = [
  ...scanDir(hubAssetsDir, "/hub-assets"),
  ...scanDir(originalSourceDir, "/original_source"),
  ...scanDir(imagesDir, "/images")
];

const categoryCounts = {};
for (const a of allAssets) {
  categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
}

const manifest = {
  title: "SMGrade Arcade — Authentic SwordMasters Comprehensive Asset Registry",
  generatedAt: new Date().toISOString(),
  totalAssets: allAssets.length,
  categorySummary: categoryCounts,
  assets: allAssets
};

fs.writeFileSync(path.join(hubAssetsDir, "asset_manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`Successfully generated asset_manifest.json with ${allAssets.length} assets.`);
console.log("Categories breakdown:", JSON.stringify(categoryCounts, null, 2));
