#!/usr/bin/env node
/**
 * BYOA asset fetcher. Reads assets.manifest.json and, for each listed asset,
 * ensures it is present under assets/<type>/ with the expected sha256 —
 * downloading from `url` when possible, otherwise printing clear manual
 * instructions. Copyrighted assets are never committed; this only fetches them
 * onto the user's own machine from their public source.
 *
 * Usage:
 *   node scripts/fetch-assets.mjs            # fetch/verify all assets
 *   node scripts/fetch-assets.mjs --print-hashes   # print sha256 of local files
 *
 * See docs/assets.md.
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = path.join(ROOT, "assets.manifest.json");

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

async function sha256(file) {
  const buf = await fs.readFile(file);
  return createHash("sha256").update(buf).digest("hex");
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function urlIsReal(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url) && !url.startsWith("TODO");
}

function destFor(manifest, asset) {
  const dir = manifest.typeDirs?.[asset.type] ?? path.join("assets", asset.type);
  return path.join(ROOT, dir, asset.name);
}

async function loadManifest() {
  try {
    return JSON.parse(await fs.readFile(MANIFEST, "utf8"));
  } catch (err) {
    console.error(`${RED}Cannot read assets.manifest.json:${RESET} ${err}`);
    process.exit(1);
  }
}

async function printHashes(manifest) {
  for (const asset of manifest.assets ?? []) {
    const dest = destFor(manifest, asset);
    const rel = path.relative(ROOT, dest);
    if (await exists(dest)) {
      console.log(`${await sha256(dest)}  ${rel}`);
    } else {
      console.log(`${DIM}(missing)${RESET}                                                         ${rel}`);
    }
  }
}

async function download(url, referer) {
  // A browser-like User-Agent (+ Referer) is needed for hosts behind Cloudflare
  // such as The Spriters Resource.
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      ...(referer ? { Referer: referer } : {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function fetchAll(manifest) {
  let ok = 0;
  let manual = 0;
  let failed = 0;

  for (const asset of manifest.assets ?? []) {
    const dest = destFor(manifest, asset);
    const rel = path.relative(ROOT, dest);
    const want = asset.sha256;

    if (await exists(dest)) {
      const got = await sha256(dest);
      if (!want || got === want) {
        console.log(`${GREEN}✓${RESET} ${rel} ${DIM}(present)${RESET}`);
        ok++;
      } else {
        console.log(`${YELLOW}!${RESET} ${rel} present but sha256 differs`);
        console.log(`   expected ${want}`);
        console.log(`   got      ${got}`);
        manual++;
      }
      continue;
    }

    // Missing — try to download, else guide the user.
    if (urlIsReal(asset.url)) {
      try {
        const buf = await download(asset.url, asset.source);
        const got = createHash("sha256").update(buf).digest("hex");
        if (want && got !== want) {
          console.log(`${RED}✗${RESET} ${rel} downloaded but sha256 mismatch (not saved)`);
          console.log(`   expected ${want}`);
          console.log(`   got      ${got}`);
          failed++;
          continue;
        }
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.writeFile(dest, buf);
        console.log(`${GREEN}✓${RESET} ${rel} ${DIM}(downloaded)${RESET}`);
        ok++;
      } catch (err) {
        console.log(`${RED}✗${RESET} ${rel} download failed: ${err.message}`);
        manualHint(asset, rel);
        failed++;
      }
    } else {
      console.log(`${YELLOW}?${RESET} ${rel} missing — no direct URL`);
      manualHint(asset, rel);
      manual++;
    }
  }

  console.log(
    `\n${ok} ok · ${manual} need manual placement · ${failed} failed`,
  );
  if (manual + failed > 0) {
    console.log(
      `${DIM}Place missing files as shown above, then re-run. Use --print-hashes to fill sha256.${RESET}`,
    );
  }
}

function manualHint(asset, rel) {
  const from = asset.source || asset.url || "(source unknown)";
  console.log(`   → download from: ${from}`);
  console.log(`   → save as:       ${rel}`);
  if (asset.sha256) console.log(`   → expected sha256: ${asset.sha256}`);
}

const manifest = await loadManifest();
if (process.argv.includes("--print-hashes")) {
  await printHashes(manifest);
} else {
  await fetchAll(manifest);
}
