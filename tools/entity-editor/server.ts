import { loadEnv, type Plugin, type ViteDevServer } from "vite";
import type { PalettesFile } from "../../src/entity/palettesFile";
import type { EntityFile } from "../../src/entity/entityFile";
import type { IncomingMessage, ServerResponse } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Dev-server plugin backing the repo-integrated entity editor. Adds endpoints so
 * the browser tool (and the game) can read and write our entity JSON in
 * `data/entities/`, and hands over the ROM every picture is drawn from (ADR
 * 0090). Dev-only (`apply: "serve"`); never part of a build.
 */

const ENTITIES_DIR = path.join("data", "entities");
const SPAWNS_DIR = path.join("data", "spawns");
/** Where a gameplay recording lands. Gitignored; dev-only. */
const LOG_FILE = path.join("logs", "session.log");
const SFX_DIR = path.join("assets", "audio", "sfx");
const SOUND_BANK = path.join("data", "audio", "sounds.json");
const ROSTER = path.join("data", "roster.json");
const DEBUG_MODES = path.join("data", "debug.json");
const ARENA_DATA = path.join("data", "arenas");
const ARENA_IMAGES = path.join("assets", "arenas");
const HUD_DATA = path.join("data", "hud", "hud.json");
const HUD_IMAGE = path.join("assets", "hud", "hud.png");

function sanitizeName(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, "").slice(0, 64);
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

export function entityEditorServer(): Plugin {
  return {
    name: "entity-editor-server",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      const root = server.config.root;

      // The cartridge from ROM_PATH in .env.local, so a developer is never
      // asked for it (ADR 0090); 404 without one, and the page asks.
      const romPath = loadEnv(server.config.mode, root, "ROM_").ROM_PATH;
      server.middlewares.use("/api/rom", async (_req, res) => {
        if (!romPath) return sendJson(res, 404, { error: "ROM_PATH not set in .env.local" });
        try {
          const buf = await fs.readFile(path.resolve(root, romPath));
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/octet-stream");
          res.end(buf);
        } catch {
          sendJson(res, 404, { error: `cannot read ${romPath}` });
        }
      });

      // An arena (used by the game): its arena.json, or with `layer` and
      // `time` one of its pictures. Both written by `npm run rom -- export`;
      // the pictures are the cartridge's and gitignored.
      server.middlewares.use("/api/arena", async (req, res) => {
        const url = new URL(req.url ?? "", "http://localhost");
        const name = sanitizeName(url.searchParams.get("name") ?? "");
        if (!name) return sendJson(res, 400, { error: "name required" });
        const layer = sanitizeName(url.searchParams.get("layer") ?? "");
        const time = sanitizeName(url.searchParams.get("time") ?? "");
        const file = layer
          ? path.join(root, ARENA_IMAGES, name, `${layer}@${time}.png`)
          : path.join(root, ARENA_DATA, name, "arena.json");
        try {
          const buf = await fs.readFile(file);
          res.statusCode = 200;
          res.setHeader("Content-Type", layer ? "image/png" : "application/json");
          res.end(buf);
        } catch {
          sendJson(res, 404, { error: `no ${path.relative(root, file)}` });
        }
      });

      // Every arena and its lightings, for the debug scene's panel to offer.
      server.middlewares.use("/api/arenas", async (_req, res) => {
        const arenas: { name: string; times: string[] }[] = [];
        try {
          for (const e of await fs.readdir(path.join(root, ARENA_DATA), { withFileTypes: true })) {
            if (!e.isDirectory()) continue;
            const file = JSON.parse(await fs.readFile(path.join(root, ARENA_DATA, e.name, "arena.json"), "utf8")) as { times?: string[] };
            arenas.push({ name: e.name, times: file.times ?? [] });
          }
        } catch {
          // no arenas directory: the grid is the only backdrop
        }
        sendJson(res, 200, { arenas: arenas.sort((a, b) => a.name.localeCompare(b.name)) });
      });

      // The original's HUD (used by the game): hud.json, or with `image` its
      // picture — both written by `npm run rom -- export`.
      server.middlewares.use("/api/hud", async (req, res) => {
        const image = new URL(req.url ?? "", "http://localhost").searchParams.has("image");
        const file = path.join(root, image ? HUD_IMAGE : HUD_DATA);
        try {
          const buf = await fs.readFile(file);
          res.statusCode = 200;
          res.setHeader("Content-Type", image ? "image/png" : "application/json");
          res.end(buf);
        } catch {
          sendJson(res, 404, { error: `no ${path.relative(root, file)}` });
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
      // directory — a voice has an owner and a punch does not (ADR 0011).
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

      // Everything the editor can open, in two groups because they are read
      // from two directories.
      server.middlewares.use("/api/entities", async (_req, res) => {
        const names = async (dir: string): Promise<string[]> => {
          try {
            const entries = await fs.readdir(path.join(root, dir), { withFileTypes: true });
            return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
          } catch {
            return [];
          }
        };
        const fighters = await names(ENTITIES_DIR);
        // each fighter's colour sets of our own, for the side panels to offer (palettes.json)
        const colourSets: Record<string, string[]> = {};
        for (const name of fighters) {
          try {
            const file = JSON.parse(await fs.readFile(path.join(root, ENTITIES_DIR, name, "palettes.json"), "utf8")) as PalettesFile;
            colourSets[name] = Object.keys(file.sets);
          } catch {
            // no palettes.json: his own colours and the cartridge's second set only
          }
        }
        sendJson(res, 200, { fighters, spawns: await names(SPAWNS_DIR), colourSets });
      });

      // Read an entity by assembling every section file in its directory:
      // data/entities/<name>/<section>.json -> { name, <section>: ... }.
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

        // Only the field the server invents can be checked: the sections are
        // whatever .json files are in the directory, so their names come from
        // the filesystem rather than from a type.
        const entity: Pick<EntityFile, "name"> & Record<string, unknown> = {
          name,
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
