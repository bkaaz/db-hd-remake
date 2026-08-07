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
const ATLASES_DIR = path.join("assets", "atlases");
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

      // Read (GET ?name=) or write (POST) an entity.
      server.middlewares.use("/api/entity", async (req, res) => {
        if (req.method === "GET") {
          const url = new URL(req.url ?? "", "http://localhost");
          const name = sanitizeName(url.searchParams.get("name") ?? "");
          if (!name) return sendJson(res, 400, { error: "name required" });
          const file = path.join(root, ENTITIES_DIR, `${name}.entity.json`);
          try {
            const txt = await fs.readFile(file, "utf8");
            sendJson(res, 200, { entity: JSON.parse(txt) });
          } catch {
            sendJson(res, 404, { error: "not found" });
          }
          return;
        }

        if (req.method === "POST") {
          try {
            const body = JSON.parse(await readBody(req)) as {
              name?: string;
              entity?: unknown;
              atlasPngBase64?: string;
            };
            const name = sanitizeName(body.name ?? "");
            if (!name || !body.entity) {
              return sendJson(res, 400, { error: "name and entity required" });
            }

            await fs.mkdir(path.join(root, ENTITIES_DIR), { recursive: true });
            await fs.writeFile(
              path.join(root, ENTITIES_DIR, `${name}.entity.json`),
              JSON.stringify(body.entity, null, 2) + "\n",
            );

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
            sendJson(res, 200, { ok: true, atlasWritten });
          } catch (err) {
            sendJson(res, 500, { error: String(err) });
          }
          return;
        }

        sendJson(res, 405, { error: "method not allowed" });
      });
    },
  };
}
