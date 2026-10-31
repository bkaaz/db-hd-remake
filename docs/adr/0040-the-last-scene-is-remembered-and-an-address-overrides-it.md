# 0040 — The last scene is remembered; an address overrides it

**Status:** accepted 2026-10-31 · supersedes the source half of 0008 (the
URL alone); its rule — a scene is built from a serialisable request — stands

The request each scene is built from is kept in the browser's localStorage
(`src/sceneSource.ts`), as the same query string `queryFor` writes, and read
back through `requestFromUrl` — one vocabulary and one set of checks. An
address with any parameter wins, is remembered, and is cleared from the bar
so a later reload cannot undo picks made since. The panel beside the game's
screen (`src/ui/panel.ts`) picks what the request holds; every pick is a new
request, built as an address would be.

The debug switches — boxes, readout, the dummy's attacks, recording — are
one object (`src/debug/toggles.ts`) that a key and the panel's switch both
flip; all but the recording are remembered, which would otherwise start
itself on every reload. A debug mode no longer sets the switches: it sets
up the scene, and they stay as they were left.

A bad address is still a loud error (0008). A remembered request that no
longer reads is dropped with a notice in the panel, since nothing on the
page could fix it; one that reads but cannot be built (a fighter deleted)
shows its error and stays pickable away.

**Rejected:**

- **The query string as the only memory** — fine for a reload, but its
  length was the complaint, and it is lost in a fresh tab.
- **localStorage over an address** — a link would then mean nothing.
- **A tab of its own, `sessionStorage`** — what two tabs share is the price
  of a fresh tab landing where the last one was, and the owner keeps one.
