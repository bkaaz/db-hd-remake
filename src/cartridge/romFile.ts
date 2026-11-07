/**
 * POC: the player's cartridge, the game's one dependency. In development the
 * dev server hands it over from ROM_PATH; otherwise the player picks the file.
 * Either way it must be a dump we know, or nothing we read from it means
 * anything.
 */

/** SHA-1 of every dump the readers are checked against. */
const KNOWN: Record<string, string> = {
  "0ed945f74a806e359615bee64cbec39432010d71": "Japanese, fan translation patch (4 MB)",
};

let pending: Promise<Uint8Array> | null = null;

/** The cartridge, asked for once however many callers want it. */
export function cartridge(): Promise<Uint8Array> {
  pending ??= fromServer().then((rom) => rom ?? fromPlayer()).then(checked);
  return pending;
}

async function fromServer(): Promise<Uint8Array | null> {
  const res = await fetch("/api/rom").catch(() => null);
  return res?.ok ? new Uint8Array(await res.arrayBuffer()) : null;
}

async function checked(rom: Uint8Array): Promise<Uint8Array> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", rom as Uint8Array<ArrayBuffer>));
  const sha1 = [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (!(sha1 in KNOWN)) throw new Error(`unknown ROM (SHA-1 ${sha1})`);
  console.log(`ROM: ${KNOWN[sha1]}`);
  return rom;
}

/** A button over the page until the player gives a file: a browser reads no file it was not handed. */
function fromPlayer(): Promise<Uint8Array> {
  return new Promise((resolve) => {
    const box = document.createElement("label");
    box.textContent = "Load your Dragon Ball Z: Hyper Dimension ROM (.sfc)";
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
