/**
 * Read the cartridge's 65816 code from a terminal — no emulator, no Ghidra.
 *
 *   npm run dis -- 8f:b420                  from there to the first RTS/RTL/JMP
 *   npm run dis -- 8f:b420 -n 80 --all      80 instructions, through jumps
 *   npm run dis -- 8f:b420 --m16 --x16      entered with 16-bit A / X, Y
 *   npm run dis -- find 95 0a               every place these bytes occur
 *
 * Widths default to 8-bit, as after reset. Fighter fields reached as `$nn,X`
 * are named from src/rom/cartridge.ts.
 */

import { existsSync, readFileSync } from "node:fs";
import { FIGHTER_FIELDS, ROM_PATH, toFile } from "../src/rom/cartridge.ts";
import { decode, ends, long, operandText, type Widths } from "../src/rom/disasm.ts";

if (!existsSync(ROM_PATH)) {
  console.error(`no cartridge at ${ROM_PATH} — it is the owner's own dump (BYOA)`);
  process.exit(1);
}
const rom = new Uint8Array(readFileSync(ROM_PATH));
const args = process.argv.slice(2).flatMap((a) => a.split(/\s+/)).filter(Boolean);
// piping into `head` closes stdout early; that is not an error
process.stdout.on("error", () => process.exit(0));

function read(address: number): number {
  const off = toFile(address);
  if (off === null) throw new Error(`${long(address)} is not ROM`);
  return rom[off];
}

/** The LoROM CPU address of a file offset in the first 2 MB, linear above. */
function toCpu(off: number): number {
  return off < 0x200000 ? ((off >> 15) << 16) | 0x8000 | (off & 0x7fff) : 0xc00000 + off;
}

function parseAddress(text: string): number {
  const [bank, addr] = text.includes(":") ? text.split(":") : ["0", text];
  return (parseInt(bank, 16) << 16) | parseInt(addr, 16);
}

function line(address: number, w: Widths): { text: string; ins: ReturnType<typeof decode> } {
  const ins = decode(read, address, w);
  const hex = ins.bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ");
  let note = "";
  if ((ins.mode === "dx" || ins.mode === "ax") && ins.operand < 0x100 && FIGHTER_FIELDS[ins.operand])
    note = `; ${FIGHTER_FIELDS[ins.operand]}`;
  const text = `${long(address)}  ${hex.padEnd(12)} ${ins.mnemonic} ${operandText(ins)}`.padEnd(48) + note;
  return { text, ins };
}

if (args[0] === "find") {
  const pattern = args.slice(1).map((b) => parseInt(b, 16));
  for (let off = 0; off + pattern.length <= rom.length; off++) {
    if (pattern.every((b, i) => rom[off + i] === b)) console.log(`${long(toCpu(off))}  (file 0x${off.toString(16)})`);
  }
} else if (args[0]) {
  let address = parseAddress(args[0]);
  let w: Widths = { m8: !args.includes("--m16"), x8: !args.includes("--x16") };
  const nAt = args.indexOf("-n");
  const n = nAt >= 0 ? parseInt(args[nAt + 1], 10) : 200;
  const all = args.includes("--all");
  for (let i = 0; i < n; i++) {
    const { text, ins } = line(address, w);
    console.log(text);
    if (ends(ins) && !all) break;
    w = ins.after;
    address = (address & 0xff0000) | ((address + ins.bytes.length) & 0xffff);
  }
} else {
  console.error("usage: npm run dis -- <bank:addr> [-n N] [--all] [--m16] [--x16] | find <hex bytes…>");
  process.exit(1);
}
