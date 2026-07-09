#!/usr/bin/env node
// postinstall.mjs — patches colyseus.js Serializer to never throw on unknown serializer IDs.
// This is required because SwordMasters game servers send dynamic serializer hashes
// (e.g. "GsQlaKLVq") that are not registered by default, causing uncaught exceptions
// which crash the Vercel serverless function before any response can be sent.

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const targets = [
  // ESM build (used by Vercel serverless bundler)
  resolve(__dirname, "node_modules/colyseus.js/build/esm/serializer/Serializer.mjs"),
  // CJS build fallback
  resolve(__dirname, "node_modules/colyseus.js/dist/colyseus.js"),
];

const ESM_ORIGINAL = `function getSerializer(id) {
    const serializer = serializers[id];
    if (!serializer) {
        throw new Error("missing serializer: " + id);
    }
    return serializer;
}`;

const ESM_PATCHED = `// PATCHED: auto-register DummySerializer for unknown IDs instead of throwing
class DummySerializer {
    setState() {}
    getState() { return null; }
    patch() {}
    teardown() {}
    handshake() {}
}
function getSerializer(id) {
    if (!serializers[id]) {
        serializers[id] = DummySerializer;
    }
    return serializers[id];
}`;

const CJS_ORIGINAL = `    function getSerializer(id) {
        var serializer = serializers[id];
        if (!serializer) {
            throw new Error("missing serializer: " + id);
        }
        return serializer;
    }`;

const CJS_PATCHED = `    // PATCHED: auto-register DummySerializer for unknown IDs instead of throwing
    function getSerializer(id) {
        if (!serializers[id]) {
            var DummySer = function() {};
            DummySer.prototype.setState = function() {};
            DummySer.prototype.getState = function() { return null; };
            DummySer.prototype.patch = function() {};
            DummySer.prototype.teardown = function() {};
            DummySer.prototype.handshake = function() {};
            serializers[id] = DummySer;
        }
        return serializers[id];
    }`;

let patched = 0;
for (const target of targets) {
  if (!existsSync(target)) {
    console.log(`[postinstall] Skip (not found): ${target}`);
    continue;
  }
  let content = readFileSync(target, "utf8");
  const isEsm = target.endsWith(".mjs");
  const original = isEsm ? ESM_ORIGINAL : CJS_ORIGINAL;
  const replacement = isEsm ? ESM_PATCHED : CJS_PATCHED;

  if (content.includes("PATCHED: auto-register")) {
    console.log(`[postinstall] Already patched: ${target}`);
    patched++;
    continue;
  }
  if (!content.includes(original)) {
    console.log(`[postinstall] WARNING: Could not find patch target in: ${target}`);
    continue;
  }
  content = content.replace(original, replacement);
  writeFileSync(target, content, "utf8");
  console.log(`[postinstall] Patched: ${target}`);
  patched++;
}

if (patched > 0) {
  console.log(`[postinstall] colyseus.js serializer patch applied (${patched} file(s)). Unknown serializer IDs will no longer crash the process.`);
} else {
  console.warn(`[postinstall] WARNING: No files were patched.`);
}
