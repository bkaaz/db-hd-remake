import type { Plugin, ViteDevServer } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Dev-server plugin backing the repo-integrated entity editor. Adds endpoints so
 * the browser tool (and the game) can list sheets from `assets/sheets/`,
 * read/write our entity JSON in `data/entities/`, and read/write the keyed atlas
 * in `assets/atlases/`. Dev-only (`apply: "serve"`); never part of a build.
 *
 * BYOA: source sheets and atlases are gitignored; only data/entities/*.json are
 * committed. See docs/assets.md.
 */

const SHEETS_DIR = path.join("assets", "sheets");
const ENTITIES_DIR = path.join("data", "entities");
const SPAWNS_DIR = path.join("data", "spawns");
const ATLASES_DIR = path.join("assets", "atlases");
const SFX_DIR = path.join("assets", "audio", "sfx");
const SOUND_BANK = path.join("data", "audio", "sounds.json");
const IMAGE_RE = /\.(png|gif|bmp|jpe?g)$/i;

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

export function entityEditorServer(): Plugin {
  return {
    name: "entity-editor-server",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      const root = server.config.root;

      // List available source sheets.
      server.middlewares.use("/api/sheets", async (_req, res) => {
        try {
          const files = await fs.readdir(path.join(root, SHEETS_DIR));
          sendJson(res, 200, { sheets: files.filter((f) => IMAGE_RE.test(f)).sort() });
        } catch {
          sendJson(res, 200, { sheets: [] });
        }
      });

      // Stream a source sheet image by filename.
      server.middlewares.use("/api/sheet", async (req, res) => {
        const url = new URL(req.url ?? "", "http://localhost");
        const name = url.searchParams.get("name");
        if (!name) return sendJson(res, 400, { error: "name required" });
        const file = path.join(root, SHEETS_DIR, path.basename(name));
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

      // Stream a generated keyed atlas by entity name (used by the game).
      server.middlewares.use("/api/atlas", async (req, res) => {
        const url = new URL(req.url ?? "", "http://localhost");
        const name = sanitizeName(url.searchParams.get("name") ?? "");
        if (!name) return sendJson(res, 400, { error: "name required" });
        const file = path.join(root, ATLASES_DIR, `${name}.png`);
        try {
          const buf = await fs.readFile(file);
          res.statusCode = 200;
          res.setHeader("Content-Type", "image/png");
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

      // Read an entity by assembling every section file in its directory:
      // data/entities/<name>/<section>.json -> { name, atlas, <section>: ... }.
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

        const entity: Record<string, unknown> = {
          name,
          atlas: `${name}.png`,
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

      // Write ONE section: data/entities/<name>/<section>.json (+ optional atlas).
      server.middlewares.use("/api/section", async (req, res) => {
        if (req.method !== "POST") {
          return sendJson(res, 405, { error: "method not allowed" });
        }
        try {
          const body = JSON.parse(await readBody(req)) as {
            name?: string;
            section?: string;
            data?: unknown;
            atlasPngBase64?: string;
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

          let atlasWritten = false;
          if (body.atlasPngBase64) {
            await fs.mkdir(path.join(root, ATLASES_DIR), { recursive: true });
            const base64 = body.atlasPngBase64.split(",").pop() ?? "";
            await fs.writeFile(
              path.join(root, ATLASES_DIR, `${name}.png`),
              Buffer.from(base64, "base64"),
            );
            atlasWritten = true;
          }
          sendJson(res, 200, { ok: true, atlasWritten, mtime });
        } catch (err) {
          sendJson(res, 500, { error: String(err) });
        }
      });
    },
  };
}
