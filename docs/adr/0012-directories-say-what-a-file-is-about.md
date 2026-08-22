# 0012 — Directories say what a file is about, not how it runs

**Status:** accepted 2026-08-14

`src/` is grouped by domain — `entity/`, `combat/`, `input/`, `audio/`,
`sprites/`, `fx/` — because the question somebody actually asks of an unfamiliar
tree is "where is the sound", not "what can run in Node". Twenty flat files had
stopped answering either.

**Rejected: grouping by layer** — `game/` for the PixiJS half, `core/` for pure
runtime logic, `authoring/` for build-time. It makes the testability rule visible
in the tree and is worse to read: it splits `audio/` across three directories and
files a WAV codec beside a state machine because both happen to be pure. Reading
the code won.

**What that costs, and where it went instead.** The tree no longer shows that
PixiJS is confined to three files, or that some modules never reach the browser.
Both are stated in `CLAUDE.md`. A test that enforces them mechanically is a good
idea and is deliberately **not** built — it would have been new behaviour inside
a change whose whole value was containing none.

**`scripts/` holds CLI entry points and nothing else** — one file per `npm run`
command, and nothing in the repo imports from it. That is why the codecs it used
to own (`png.ts`, `wav.ts`) moved to the domain they serve: what is a command and
what is a library is now visible from the path.
