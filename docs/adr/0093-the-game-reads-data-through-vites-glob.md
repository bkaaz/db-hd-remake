# 0093 — The game reads `data/` through Vite's glob

**Status:** accepted 2026-11-08

The game reads every committed file of `data/` with `import.meta.glob`
(`src/data/files.ts`): each file its own chunk, fetched when first read, and
what a directory holds known from the paths. The dev server and a static
build read it the same way, so `dist/web` plays from any static host with no
server behind it; the ROM is the player's file (ADR 0090), and in a build the
page never asks a server for it. The entity editor keeps reading and writing
through the dev-server plugin (`/api/entity`, `/api/section`): it is a dev
tool, and a glob import would reload its page on every save.

In development a change to a file under `data/` reloads the game's page, as
any module of it does.

**Rejected:**

- **`data/` copied into the build beside a generated index** of what each
  directory holds: a second listing to keep in step with the files, and the
  dev server would still need its own.
- **The game reading through `/api/*` in development and files in a build**:
  two roads to the same data, one of them untested until a deploy.
- **A base path of `/`**: `dist/web` would only play at a host's root.
