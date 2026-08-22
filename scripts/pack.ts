/**
 * Pack the assets for backup and for handing over: `npm run pack`
 *
 * The repo carries no game art (BYOA, docs/assets.md), so a working copy is the
 * repo plus one of these archives. They land in `dist/assets/`, which is where
 * everything that leaves the repo lives.
 *
 * Two archives, because the two jobs want different sets:
 *
 *   assets  what the game reads — `assets/`. Small, so it is the default and the
 *           one to run often; the hand-edited sheet rides in it every time.
 *   raw     what those were made from — `raw/`, plus `assets/sheets/` again.
 *           Dominated by a sound capture that has never changed, so it is behind
 *           a flag rather than run every time.
 *
 * Neither is a backup on its own. A file in `dist/` dies with the same disk the
 * repo is on; copying it somewhere else is the backup, and the script says so.
 *
 *   npm run pack                 # the runtime archive
 *   npm run pack -- --raw        # both
 *   npm run pack -- --dry-run    # report only
 */

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = process.cwd();
const OUT_DIR = path.join("dist", "assets");

interface Archive {
  /** Suffix in `db-hd-<what>-<date>.zip`. */
  what: string;
  /** Repo-relative directories, packed with their paths so unzip restores them. */
  dirs: string[];
  why: string;
}

const ARCHIVES: Record<"assets" | "raw", Archive> = {
  assets: {
    what: "assets",
    dirs: ["assets"],
    why: "what the game reads — unzip at the repo root and it runs",
  },
  raw: {
    what: "raw",
    dirs: ["raw", path.join("assets", "sheets")],
    why: "the originals these were made from, plus the sheets again",
  },
};

/** Every file under a directory, so the receipt can say what went in. */
async function walk(dir: string): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      const sub = await walk(full);
      files += sub.files;
      bytes += sub.bytes;
    } else {
      files++;
      bytes += (await fs.stat(full)).size;
    }
  }
  return { files, bytes };
}

function size(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function readme(archive: Archive, zipName: string): string {
  return [
    `${zipName}`,
    ``,
    `Assets for db-hd-remake: ${archive.why}.`,
    `The repo ships no game art, so a working copy is the repo plus this archive.`,
    ``,
    `Unzip at the repository root — the paths inside are already correct:`,
    ``,
    `    unzip ${zipName} -d /path/to/db-hd-remake`,
    ``,
    `Then: npm install && npm run dev`,
    ``,
    `Dragon Ball Z and Hyper Dimension belong to their owners. These files are`,
    `not distributed publicly; see the repo's README.`,
    ``,
  ].join("\n");
}

/** Build one archive, or report what it would hold. */
async function pack(archive: Archive, dryRun: boolean): Promise<void> {
  const zipName = `db-hd-${archive.what}-${today()}.zip`;
  const out = path.join(ROOT, OUT_DIR, zipName);

  const present: string[] = [];
  let files = 0;
  let bytes = 0;
  console.log(`\n${zipName} — ${archive.why}`);
  for (const dir of archive.dirs) {
    const counted = await walk(path.join(ROOT, dir));
    if (counted.files === 0) {
      console.log(`  ${dir}/ — empty or missing, skipped`);
      continue;
    }
    present.push(dir);
    files += counted.files;
    bytes += counted.bytes;
    console.log(`  ${dir}/ — ${counted.files} file(s), ${size(counted.bytes)}`);
  }
  if (present.length === 0) {
    console.log("  nothing to pack");
    return;
  }
  console.log(`  ${files} file(s), ${size(bytes)} before compression`);
  if (dryRun) return;

  await fs.mkdir(path.dirname(out), { recursive: true });
  // `zip` adds to an existing archive rather than replacing it, so a second run
  // on the same day would merge the two.
  await fs.rm(out, { force: true });
  await run("zip", ["-r", "-q", "-X", out, ...present], { cwd: ROOT, maxBuffer: 1 << 24 });

  const note = path.join(ROOT, OUT_DIR, "README.txt");
  await fs.writeFile(note, readme(archive, zipName));
  await run("zip", ["-j", "-q", out, note], { cwd: ROOT });
  await fs.rm(note, { force: true });

  console.log(`  wrote ${path.join(OUT_DIR, zipName)} — ${size((await fs.stat(out)).size)}`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const wanted = argv.includes("--raw")
    ? [ARCHIVES.assets, ARCHIVES.raw]
    : [ARCHIVES.assets];

  for (const archive of wanted) await pack(archive, dryRun);

  if (dryRun) {
    console.log("\n--dry-run: nothing written");
  } else {
    console.log(
      `\nCopy ${OUT_DIR}/ somewhere that is not this disk — that copy is the backup,` +
        `\nnot the file sitting here.`,
    );
    if (!argv.includes("--raw")) {
      console.log("raw/ was not packed: add --raw when the capture or a source rip changes.");
    }
  }
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
