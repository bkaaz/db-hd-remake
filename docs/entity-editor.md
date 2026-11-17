# Entity Editor

`http://localhost:5173/tools/entity-editor/` — a second page on the game's Vite
server, in plain Canvas 2D, reading and writing `data/` through the dev server's
`/api/*` (`tools/entity-editor/server.ts`). It opens any entity, a fighter or a
spawn. What an entity is on disk: [`data-format.md`](./data-format.md).

| Tab | What it does |
|---|---|
| **Sprites** | the sheet as the ROM draws it, with the export's frames and anchors — read-only (ADR 0090) |
| **Animations** | timed steps, the hit / hurt / push boxes, preview. Its edits are lost at the next export (ADR 0017), which the common part settles (`plan.md`) |
| **Combos** | the chain graph: a node per attack at its hit frame, an edge per cancel with its button and margin (ADR 0009) — read-only |
| **Sounds** | the game's bank and a fighter's voices, auditioned and edited |

States are text, never edited here (ADR 0013).

## If you know MUGEN

| here | MUGEN |
|---|---|
| `frames.json` | SFF |
| `animations.json`, boxes per step | AIR + Clsn1/Clsn2 |
| `states.json` | StateDef + triggers + ChangeState, as data rather than a script |
| a blow's hit type and `damage` | HitDef → GetHit |
| `attributes.json` | CNS constants |
| `sounds.json` | SND |

## Rejected

- **The File System Access API** — the owner re-grants a folder, in one browser
  family; **a server of its own** — a second thing to keep alive for endpoints
  Vite hosts for nothing.
- **PixiJS in the editor** — keeping it to the game is what lets the editor
  import the engine's pure modules without a renderer.
