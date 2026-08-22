import type { Plugin, ViteDevServer } from "vite";
import type { EntityFile } from "../../src/entity/entityFile";
import type { IncomingMessage, ServerResponse } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Dev-server plugin backing the repo-integrated entity editor. Adds endpoints so
 * the browser tool (and the game) can list and read sheets from
 * `assets/sheets/`, and read/write our entity JSON in `data/entities/`.
 * Dev-only (`apply: "serve"`); never part of a build.
 *
 * Every entity has exactly one image and it is a sheet: a fighter's is authored,
 * a spawn's is written by `npm run fx` into `spawns/` beneath it. Nothing here
 * derives a second copy of one — the transparency lives in the file.
 *
 * BYOA: source sheets are gitignored; only data/entities/*.json are committed.
 * See docs/assets.md.
 */

const SHEETS_DIR = path.join("assets", "sheets");
const ENTITIES_DIR = path.join("data", "entities");
const SPAWNS_DIR = path.join("data", "spawns");
/** Where a gameplay recording lands. Gitignored; dev-only. */
const LOG_FILE = path.join("logs", "session.log");
const SFX_DIR = path.join("assets", "audio", "sfx");
const SOUND_BANK = path.join("data", "audio", "sounds.json");
const ROSTER = path.join("data", "roster.json");
const DEBUG_MODES = path.join("data", "debug.json");
const IMAGE_RE = /\.(png|gif|bmp|jpe?g)$/i;

/**
 * Resolve a sheet name to a file, allowing the one subdirectory that exists and
 * nothing else. `spawns/` has to be reachable because a spawn's picture lives
 * there, and an explicit allowlist is the way to say that without loosening the
 * basename that keeps a name from walking out of `assets/sheets/`.
 */
function sheetPath(root: string, name: string): string | null {
  const parts = name.split("/");
  if (parts.length > 2) return null;
  if (parts.length === 2 && parts[0] !== "spawns") return null;
  const base = path.basename(parts[parts.length - 1]);
  if (!base || !IMAGE_RE.test(base)) return null;
  return path.join(root, SHEETS_DIR, ...parts.slice(0, -1), base);
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, "").slice(0, 64);
}

function mimeFor(file: string): string {
  switch (path.extname(file).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".bmp":
      return "image/bmp";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}

function sendJson(res: ServerResponse, code: number, data: unknown): void {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Overwrite a source sheet with the editor's colour-keyed image.
 *
 * Refuses to create a file that is not already there: this exists to burn
 * transparency into an existing sheet, so a name that does not resolve is a
 * typo rather than a new fighter. The old pixels are gone afterwards — the
 * un-keyed original lives only in the owner's asset pack (docs/assets.md).
 */
async function writeSheet(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
): Promise<void> {
  try {
    const body = JSON.parse(await readBody(req)) as { name?: string; pngBase64?: string };
    const name = sanitizeName(body.name ?? "");
    if (!name || !body.pngBase64) {
      return sendJson(res, 400, { error: "name and pngBase64 required" });
    }
    const file = path.join(root, SHEETS_DIR, `${name}.png`);
    try {
      await fs.access(file);
    } catch {
      return sendJson(res, 404, { error: `No sheet assets/sheets/${name}.png to overwrite` });
    }
    const buf = Buffer.from(body.pngBase64.split(",").pop() ?? "", "base64");
    await fs.writeFile(file, buf);
    sendJson(res, 200, { ok: true, bytes: buf.length });
  } catch (err) {
    sendJson(res, 500, { error: String(err) });
  }
}

export function entityEditorServer(): Plugin {
  return {
    name: "entity-editor-server",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      const root = server.config.root;

      // List the fighters' sheets. `spawns/` is a directory, so it fails the
      // extension test and stays out of the list — which is what the dropdown
      // wants: a generated effect is not something you open to cut frames from.
      server.middlewares.use("/api/sheets", async (_req, res) => {
        try {
          const files = await fs.readdir(path.join(root, SHEETS_DIR));
          sendJson(res, 200, { sheets: files.filter((f) => IMAGE_RE.test(f)).sort() });
        } catch {
          sendJson(res, 200, { sheets: [] });
        }
      });

      // Stream a source sheet image by filename, or overwrite one with the
      // editor's keyed version. The write is in place and deliberate: the key is
      // applied once and *becomes* the source, instead of being re-derived on
      // every load from settings that are stored nowhere.
      server.middlewares.use("/api/sheet", async (req, res) => {
        if (req.method === "POST") return writeSheet(req, res, root);
        const url = new URL(req.url ?? "", "http://localhost");
        const name = url.searchParams.get("name");
        if (!name) return sendJson(res, 400, { error: "name required" });
        const file = sheetPath(root, name);
        if (!file) return sendJson(res, 400, { error: "bad sheet name" });
        try {
          const buf = await fs.readFile(file);
          res.statusCode = 200;
          res.setHeader("Content-Type", mimeFor(file));
          res.end(buf);
        } catch {
          res.statusCode = 404;
          res.end();
        }
      });

      // Stream one cut sound effect (used by the game). The clips are game
      // audio and gitignored like the sheets, so they cannot simply be served
      // as static files from the repo.
      server.middlewares.use("/api/sfx", async (req, res) => {
        const url = new URL(req.url ?? "", "http://localhost");
        const file = sanitizeName(path.basename(url.searchParams.get("file") ?? "", ".wav"));
        if (!file) return sendJson(res, 400, { error: "file required" });
        try {
          const buf = await fs.readFile(path.join(root, SFX_DIR, `${file}.wav`));
          res.statusCode = 200;
          res.setHeader("Content-Type", "audio/wav");
          res.end(buf);
        } catch {
          res.statusCode = 404;
          res.end();
        }
      });

      // The game's sound bank. Unlike an entity section this belongs to no
      // fighter, so it is read on its own rather than assembled from a
      // directory — see decisions.md, "A voice has an owner; a punch does not".
      server.middlewares.use("/api/sounds", async (req, res) => {
        const file = path.join(root, SOUND_BANK);
        if (req.method === "POST") {
          try {
            const body = JSON.parse(await readBody(req)) as { data?: unknown };
            // An empty bank is almost certainly a bug on the client rather than
            // an intention, and it would silence the whole game — refuse it.
            if (body.data === null || typeof body.data !== "object") {
              return sendJson(res, 400, { error: "data must be the whole bank object" });
            }
            await fs.mkdir(path.dirname(file), { recursive: true });
            await fs.writeFile(file, JSON.stringify(body.data, null, 2) + "\n");
            return sendJson(res, 200, { ok: true });
          } catch (err) {
            return sendJson(res, 500, { error: String(err) });
          }
        }
        try {
          sendJson(res, 200, JSON.parse(await fs.readFile(file, "utf8")) as unknown);
        } catch {
          sendJson(res, 404, { error: "no sound bank" });
        }
      });

      // The character select's grid. Belongs to no entity, like the sound bank.
      server.middlewares.use("/api/roster", async (_req, res) => {
        try {
          sendJson(res, 200, JSON.parse(await fs.readFile(path.join(root, ROSTER), "utf8")));
        } catch {
          sendJson(res, 404, { error: "no roster" });
        }
      });

      // The debug scene's setups. Read on every scene build rather than
      // bundled, which is the whole point: editing a mode costs a reload, not a
      // restart of a dev server that has been up for days.
      server.middlewares.use("/api/debug", async (_req, res) => {
        try {
          sendJson(res, 200, JSON.parse(await fs.readFile(path.join(root, DEBUG_MODES), "utf8")));
        } catch {
          sendJson(res, 404, { error: "no debug modes" });
        }
      });

      // Everything the editor can open. Two groups because they are read from
      // two directories and, more usefully, because the group decides where the
      // picture comes from: a fighter has a ripped sheet, a spawn has only the
      // sheet its generator wrote, under `spawns/`.
      server.middlewares.use("/api/entities", async (_req, res) => {
        const names = async (dir: string): Promise<string[]> => {
          try {
            const entries = await fs.readdir(path.join(root, dir), { withFileTypes: true });
            return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
          } catch {
            return [];
          }
        };
        sendJson(res, 200, { fighters: await names(ENTITIES_DIR), spawns: await names(SPAWNS_DIR) });
      });

      // Read an entity by assembling every section file in its directory:
      // data/entities/<name>/<section>.json -> { name, sheet, <section>: ... }.
      server.middlewares.use("/api/entity", async (req, res) => {
        if (req.method !== "GET") {
          return sendJson(res, 405, { error: "method not allowed" });
        }
        const url = new URL(req.url ?? "", "http://localhost");
        const name = sanitizeName(url.searchParams.get("name") ?? "");
        if (!name) return sendJson(res, 400, { error: "name required" });

        // A spawn is an entity and is read the same way; only its directory
        // differs. Names are unique across both, so the caller does not have to
        // know which kind it asked for.
        let dir = path.join(root, ENTITIES_DIR, name);
        let files: string[];
        try {
          files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
        } catch {
          dir = path.join(root, SPAWNS_DIR, name);
          try {
            files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
          } catch {
            return sendJson(res, 404, { error: "not found" });
          }
        }

        // The caller is told where the picture is rather than working it out,
        // which is the only thing that still separates a fighter from a spawn
        // once both are one transparent sheet.
        // Only the two fields the server invents can be checked: the sections
        // are whatever .json files are in the directory, so their names come
        // from the filesystem rather than from a type.
        const entity: Pick<EntityFile, "name" | "sheet"> & Record<string, unknown> = {
          name,
          sheet: dir.startsWith(path.join(root, SPAWNS_DIR))
            ? path.posix.join("spawns", `${name}.png`)
            : `${name}.png`,
          frames: {},
          animations: {},
        };
        // Last-write times per section, so a client can tell whether the data
        // it loaded is still current before it saves over someone else's work.
        const mtimes: Record<string, number> = {};
        for (const f of files) {
          const key = f.slice(0, -".json".length);
          const file = path.join(dir, f);
          try {
            entity[key] = JSON.parse(await fs.readFile(file, "utf8"));
            mtimes[key] = (await fs.stat(file)).mtimeMs;
          } catch {
            /* skip a malformed section rather than failing the whole read */
          }
        }
        sendJson(res, 200, { entity, mtimes });
      });

      // Section mtimes only — a cheap "did this change under me?" check.
      server.middlewares.use("/api/section-mtimes", async (req, res) => {
        const url = new URL(req.url ?? "", "http://localhost");
        const name = sanitizeName(url.searchParams.get("name") ?? "");
        if (!name) return sendJson(res, 400, { error: "name required" });
        const dir = path.join(root, ENTITIES_DIR, name);
        const mtimes: Record<string, number> = {};
        try {
          for (const f of (await fs.readdir(dir)).filter((n) => n.endsWith(".json"))) {
            mtimes[f.slice(0, -".json".length)] = (await fs.stat(path.join(dir, f))).mtimeMs;
          }
        } catch {
          /* no directory yet — nothing has been written, so nothing is stale */
        }
        sendJson(res, 200, { mtimes });
      });

      // Append to the gameplay recording (src/log.ts). Dev-only and gitignored:
      // it is how the owner's hands and Claude's reading meet in one place.
      server.middlewares.use("/api/log", async (req, res) => {
        if (req.method !== "POST") {
          return sendJson(res, 405, { error: "method not allowed" });
        }
        try {
          const body = JSON.parse(await readBody(req)) as { lines?: string[]; reset?: boolean };
          const text = (body.lines ?? []).join("\n") + "\n";
          const file = path.join(root, LOG_FILE);
          await fs.mkdir(path.dirname(file), { recursive: true });
          if (body.reset) await fs.writeFile(file, text);
          else await fs.appendFile(file, text);
          sendJson(res, 200, { ok: true });
        } catch (err) {
          sendJson(res, 500, { error: String(err) });
        }
      });

      // Write ONE section: data/entities/<name>/<section>.json.
      server.middlewares.use("/api/section", async (req, res) => {
        if (req.method !== "POST") {
          return sendJson(res, 405, { error: "method not allowed" });
        }
        try {
          const body = JSON.parse(await readBody(req)) as {
            name?: string;
            section?: string;
            data?: unknown;
          };
          const name = sanitizeName(body.name ?? "");
          const section = sanitizeName(body.section ?? "");
          if (!name || !section || body.data === undefined) {
            return sendJson(res, 400, { error: "name, section and data required" });
          }

          // Save beside where the entity was read from: a spawn lives in
          // data/spawns/, and writing it into data/entities/ would quietly
          // fork it into two half-entities with the same name.
          const spawnDir = path.join(root, SPAWNS_DIR, name);
          const isSpawn = await fs
            .stat(spawnDir)
            .then((st) => st.isDirectory())
            .catch(() => false);
          const dir = isSpawn ? spawnDir : path.join(root, ENTITIES_DIR, name);
          await fs.mkdir(dir, { recursive: true });
          const file = path.join(dir, `${section}.json`);
          await fs.writeFile(file, JSON.stringify(body.data, null, 2) + "\n");
          const mtime = (await fs.stat(file)).mtimeMs;
          sendJson(res, 200, { ok: true, mtime });
        } catch (err) {
          sendJson(res, 500, { error: String(err) });
        }
      });
    },
  };
}
