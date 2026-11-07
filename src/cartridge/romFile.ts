/**
 * The player's cartridge, the game's one dependency (ADR 0090). In development
 * the dev server hands it over from ROM_PATH; otherwise the player picks the
 * file once and this browser keeps it. Either way it must be a dump we know,
 * or nothing we read from it means anything.
 */

import { rememberedRom, rememberRom } from "./remembered";

/** SHA-1 of every dump the readers are checked against. */
const KNOWN: Record<string, string> = {
  "0ed945f74a806e359615bee64cbec39432010d71": "Japanese, fan translation patch (4 MB)",
};

let pending: Promise<Uint8Array> | null = null;

/** The cartridge, asked for once however many callers want it. */
export function cartridge(): Promise<Uint8Array> {
  pending ??= find();
  return pending;
}

/** The dev server's, then the one this browser kept, then the player's — each a dump we know. */
async function find(): Promise<Uint8Array> {
  const served = await fromServer();
  if (served) return known(served, "ROM_PATH");
  const kept = await rememberedRom();
  if (kept && (await dumpOf(kept))) return known(kept, "kept in this browser");
  let notice = "";
  for (;;) {
    const picked = await fromPlayer(notice);
    const dump = await dumpOf(picked);
    if (dump) {
      await rememberRom(picked);
      return known(picked, "picked");
    }
    notice = `That file is not a dump we know (SHA-1 ${await sha1(picked)}).`;
  }
}

/** The dev server's, from ROM_PATH; a hosted page has no server to ask. */
async function fromServer(): Promise<Uint8Array | null> {
  if (!import.meta.env.DEV) return null;
  const res = await fetch("/api/rom").catch(() => null);
  return res?.ok ? new Uint8Array(await res.arrayBuffer()) : null;
}

async function sha1(rom: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", rom as Uint8Array<ArrayBuffer>));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Which known dump `rom` is, or null. */
async function dumpOf(rom: Uint8Array): Promise<string | null> {
  return KNOWN[await sha1(rom)] ?? null;
}

async function known(rom: Uint8Array, from: string): Promise<Uint8Array> {
  const dump = await dumpOf(rom);
  if (!dump) throw new Error(`ROM_PATH is not a dump we know (SHA-1 ${await sha1(rom)})`);
  console.log(`ROM: ${dump}, ${from}`);
  return rom;
}

/** A button over the page until the player gives a file: a browser reads no file it was not handed. */
function fromPlayer(notice: string): Promise<Uint8Array> {
  return new Promise((resolve) => {
    const box = document.createElement("label");
    box.textContent = `${notice} Load your Dragon Ball Z: Hyper Dimension ROM (.sfc)`.trim();
    box.style.cssText = "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font:16px sans-serif;cursor:pointer;z-index:10";
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".sfc,.smc";
    input.style.display = "none";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      box.remove();
      resolve(new Uint8Array(await file.arrayBuffer()));
    };
    box.append(input);
    document.body.append(box);
  });
}
