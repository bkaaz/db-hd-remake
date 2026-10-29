# CLAUDE.md

Guidance for Claude when working in this repository.

## What this project is

A browser-based fan **remake of _Dragon Ball Z: Hyper Dimension_** — a 2D
versus fighting game originally released on the **SNES / Super Famicom in 1996**
(developer TOSE, publisher Bandai). This is a **non-commercial fan project**.

Written in **TypeScript**, rendered in the browser with **PixiJS v8**, bundled
with **Vite**. Goal: a fighter that *plays well* using the original HD sprites;
exact fidelity to the original's mechanics is secondary.

## Working style (important)

The project owner wants to go **slowly and deliberately**:

- **Do not guess. Ask about everything.** When a design or scope decision is
  unclear, ask rather than assume — especially details about the original game's
  mechanics, roster, or feel.
- Prefer small, reviewable steps over large jumps. A phase may be split into
  smaller slices (e.g. D1 = engine, D2 = editor) — propose the split and wait.
- **Never commit on your own.** The owner reviews changes first. Make and verify
  the changes, then stop — commit only when the owner explicitly says to.
- The primary conversation language with the owner is **Polish**. Code,
  comments, commits, and docs are in **English**.
- **Record a settled piece of architecture as an ADR** — `docs/adr/NNNN-title.md`,
  one decision per file, **one screen**, opening with a `Status:` line that names
  the dates and anything it supersedes. The number is an id, not a date: it is
  assigned in the order ADRs are written, so nothing ever renumbers. Keep the
  affected doc (`data-format.md`, `entity-editor.md`, …) in sync in the same
  change. Three rules the 2500-line log it replaced grew on 2026-08-22:
  - **The conclusion and what was rejected — not the reasoning.** An alternative
    nobody took is the one thing no code and no memory can recover. How a problem
    was *found* belongs in the commit message.
  - **Supersede, never edit.** Correcting an entry in place destroys the record
    of what was known when. Write a new one and mark the old.
  - **Do not restate the code.** If a doc comment already says it, the entry
    points at the file instead. The code is the source of truth — which only
    holds while something enforces it, so a shape shared by two programs is one
    type, under one `tsconfig`, not two declarations that agree by hand.
  - **`docs/adr/` is the engine, its data and its tools.** How the docs
    themselves are written belongs here in `CLAUDE.md`, not in an ADR.

  **Rejected, so none of it comes back:** archiving the record by month or by
  topic (splits on a dimension nobody searches by, and gives `grep` two paths),
  ADR files without a size cap (a file invites sections, which is what the
  conversion was for), deleting old entries (a record that gets pruned is one
  nobody trusts), and keeping a `decisions.md` beside `docs/adr/`.
- **A living document names the file or the command, never the count.** How many
  frames the sheet has, how many states a fighter has, how many clips were cut —
  another file owns each of those and will change it without telling the doc.
  Point at that file, or at the command that prints the answer. A **dated** record
  is the exception and may state a fact as of its date: that is what an ADR's
  `Status:` line and a commit message are for. The test is the word *now* — in a
  living doc it is a promise nobody keeps, and in a dated one it is a lie about
  when the sentence was written.
- **An ADR is not a substitute for asking the owner.** He answers in one
  sentence what a search of `docs/adr/` answers wrongly — an ADR records what was
  true when it was written, and the combat system is deliberately unsettled.
  **Gameplay decisions go to `combat.md`**, which is edited, rather than to a log,
  which is appended to: a provisional thing is not log-shaped.
- **`docs/glossary.md` is one line per term plus a pointer** — never a second
  copy of the design doc. A term whose field or file is renamed gets renamed
  there in the same change; a new concept gets one line, not a section.
- **The queue is `docs/plan.md`, and finished items are DELETED from it** — in
  the same change that finishes them, not later. It is the *only* file that
  lists work to do; the reasoning goes to `docs/adr/`, the timing is in git.
  `roadmap.md` and `entity-editor.md` describe the arc and the history and must
  never grow a to-do list again. A queue that only shrinks cannot drift.
- **Write bugs down in `docs/bugs.md` the moment you notice one** — no need to
  ask, and no need to fix it there and then. Noticing and fixing are separate
  acts: a fix smuggled into unrelated work is a fix nobody reviewed. Mention the
  new entry when handing the work back, and offer the fix as its own change.
  Deleted from the file in the same change that fixes it. The owner writes there
  too. It is a list of what is broken, not a queue — `plan.md` stays the only
  place that says what is next.
- **Editor and engine co-evolve:** every phase is a vertical slice — data model
  + editor + engine + verification. See `docs/entity-editor.md`.

## Running the app (assume it is already running)

The owner keeps the dev server and the editor **running at all times** on their
default ports:

| What | URL |
|---|---|
| Game | http://localhost:5173 |
| Entity editor | http://localhost:5174/tools/entity-editor/ |

- **Do not start, restart or kill them, and do not spawn background processes**
  for them. If a port is unreachable or behaves oddly, **say so and ask** — do
  not "fix" it by launching your own.
- `npm run typecheck` and `npm run build` are free to run at any time; do run
  them before handing work back.

## Verifying changes (ask first — always)

**Never drive a browser (Playwright / Chrome DevTools) on your own initiative,
not even for a quick smoke check.** The owner usually has the game open next to
the session and can see for themselves; unsolicited screenshot requests waste
their time. Browser automation is also poor at what matters here — timing and
feel — because of seconds of latency between a synthetic keypress and a capture.

After a change, run typecheck/build **and `npm test`**, then **offer these
options and let the owner choose** (the first is the default):

1. **No check** — the owner already sees it works, or trusts the change.
2. **The owner tests** — hand over a short list of concrete things to look at;
   they send screenshots only if something is off.
3. **A recording** — ask the owner to press `L`, do the specific thing, press
   `L` again, then read `logs/session.log`. **Prefer this to any browser
   automation for anything about combat**: it is the only way to see *why* the
   engine did what it did, it costs the owner ten seconds, and unlike a
   screenshot it survives being reasoned about. Say what you want them to do —
   "land the medium string on a standing opponent" — not "record something".
4. **Playwright smoke check** — page boots, console clean, one screenshot.
5. **Full Playwright scenario** — describe the scenario before running it.

**Ask for a recording whenever a question is about behaviour rather than
appearance.** "Does the chain fire", "was the input eaten", "why did the third
hit miss", "how many frames was he free" — all of these are in the log and none
of them are on a screenshot. It records **events, not frames**: every state
change, every blow, every press entering or leaving the buffer, each line
carrying both fighters and the gap since the previous line. See `src/log.ts`.

Browser automation stays available for bugs the owner reports and for
reproduction work — but the owner picks it; you only offer it.

### Unit tests — how pure logic gets verified

Pure logic (the state machine and its validator; later the input buffer and
collision resolution) is written free of PixiJS so it can be tested in Node.

- **`npm test`** (Vitest, `*.test.ts` next to the source) — run it after any
  change to that logic, and before handing work back.
- **Tests live in the repo. Never "verify" logic with a throwaway script in a
  temp directory** — that checks the code once, by eye, and leaves nothing
  behind that can fail later. If a check is worth running, it is worth
  committing as a test.
- Assert on behaviour, not on logs. A test that cannot fail is not a test:
  when adding one, confirm it fails against a deliberately broken version of
  the code before keeping it.
- New pure logic ships **with** its tests in the same slice, not "later".
- What tests do **not** cover: how anything looks, animation timing, feel. That
  stays with the owner (see above).

## Authoring content: compute it, don't reason about it

There will be many entities and hundreds of animations, so the split is fixed:

- **Anything derivable from the data is computed by a script**, never worked out
  by hand or by eye. Hurt boxes, an attack's active frame, default timings all
  come from the sprite rectangles — deterministic, identical every time, and
  free of context. Never pull `frames.json` into context to do arithmetic.
- **What each sprite is gets written down**, in
  `data/entities/<name>/descriptions.json` — groups of frames per move, plus a
  line per frame, with `?` marking a guess. Render `npm run sheet` and look at
  the sprites rather than inventing descriptions. Describe the range you are
  working on, not the whole sheet.
- **Never guess which pose is which** when it matters and the catalogue is
  silent — ask. A wrong frame is a silent, expensive mistake.
- **Order and timing are not derivable from a sheet.** It holds poses, not a
  recording; a frame often appears twice in one animation (guard → strike →
  guard). That knowledge comes from the owner and lives in `animations.json`.
- **What you produce is a skeleton the owner then adjusts** in the editor. Being
  roughly right and clearly labelling the guesses beats being slow. Always
  separate what was *computed* from what was *guessed* when reporting.
- **Do not block on approval** for this kind of work — the owner verifies on
  their own schedule.

Procedure, flags and pitfalls: the **`add-animation` skill**
(`.claude/skills/add-animation/`), loaded on demand so it costs nothing in
sessions that are about something else.

**Effects are generated, not ripped** (`npm run fx`): no hit spark exists to rip,
and the rules that keep generated pixel art from looking bolted onto 1996
sprites are narrow and easy to break. Read the **`add-effect` skill**
(`.claude/skills/add-effect/`) before touching anything that draws an effect.

## Writing code: it has to be readable by a person

The owner is reading this codebase to learn it, not skimming it. Code that needs
a paragraph of explanation before it makes sense is code that is wrong here, even
when it works.

- **A file has to fit in one head.** Past ~150 lines, ask what the second thing
  in it is and give that thing its own file. Length is the symptom; doing two
  jobs is the cause.
- **The name says *what*, the comment says *why not*.** A comment earns its
  lines by what it prevents. State the conclusion once, not the reasoning three
  ways — past ~4 lines on a field or a function you are usually saying one thing
  over. **Open with what the code cannot say**: if the first sentence
  paraphrases the signature or the line below it, delete that sentence. A file
  header says what the module owns and why it is separate; it is not a history.
  Self-documenting names cover *what*; they can never cover what was rejected.
- **`main.ts` is the loop and the wiring, nothing else.** Every rule of the game
  lives in a module named after what it decides.
- **A module owns one thing** and exports it plus the handful of functions that
  work on it — never a drawer of unrelated helpers.
- **State that belongs together travels together.** Prefer a small object that
  owns its state and exposes two or three calls over a function taking eight
  arguments that the caller has to keep in sync.
- **A value lives beside its only user.** No `constants.ts` — a shared home is
  only for what two modules must *agree* on. A constants file collects values
  away from the code that gives them meaning.

## Tech stack

- **Language:** TypeScript (strict mode)
- **Rendering:** PixiJS v8 (WebGL 2D) — game runtime only
- **Editor:** plain Canvas 2D + TS (no PixiJS)
- **Build/dev server:** Vite · **Package manager:** npm
- **Assets:** real ripped HD sprite sheets, supplied by the owner (BYOA, below)

## Commands

```bash
npm install       # install dependencies
npm run dev       # game dev server (5173) — normally already running
npm run editor    # entity editor (5174)   — normally already running
npm run build     # typecheck + production build
npm run typecheck # typecheck only
npm test          # Vitest, run once (npm run test:watch to keep it running)
npm run anim -- <entity> <anim> --frames 1,2,3 --kind attack|loop|hurt
                  # build an animation with derived boxes/timing (--list, --dry-run)
npm run which -- <entity> fl30 la187
                  # what a blow in the shorthand points at: hit type, the
                  # move holding that frame, the animations that play it
npm run chains -- <entity>
                  # what cancels into what, and how many frames of margin each
                  # link has — the instrument for tuning frame data
npm run sheet -- <entity> --frames 0-30
                  # labelled contact sheet into preview/ (gitignored)
npm run fx        # generate the effect entities (sheet + frames + animations)
                  # from src/fx/generate.ts — no ripped hit spark (--dry-run)
npm run rom -- frame 4a
                  # a drawing read straight from the cartridge, into
                  # preview/ (frames: draw all, tiles: every tile set;
                  # move 92: the animation script a move plays;
                  # export: rewrites goku's sheet, frames.json and
                  # animations.json whole — ADR 0017)
npm run dis -- 0f:ebfc --x16
                  # the cartridge's 65816 code from that address; find <bytes>
                  # searches — docs/rom.md
npm run pack      # zip assets/ into dist/assets/ (--raw adds raw/, --dry-run)
```

## Structure

```
.
├── index.html                    # game page shell + #app mount
├── src/                          # grouped by domain; *.test.ts sits beside its source
│   ├── main.ts                   #   boot, wiring, input — the entry from index.html
│   ├── entity/                   #   entityDef.ts: data + sheet -> EntityDef
│   │                             #   entity.ts: one live instance in the world
│   │                             #   states.ts: state-machine runner + validator
│   │                             #   notation.ts: the fl30 shorthand, read
│   ├── combat/                   #   hit.ts: box → world, overlap, hit detection
│   │                             #   hitTypes.ts: what a blow does, by type
│   │                             #   push.ts: separating two bodies
│   ├── input/                    #   buffer.ts: the input buffer
│   ├── audio/                    #   playback.ts: Web Audio, the browser half
│   │                             #   sounds.ts: the shapes, pure
│   │                             #   split.ts + wav.ts: cutting a capture (build-time)
│   ├── sprites/                  #   boxes.ts: derive boxes/timing from sprites
│   │                             #   png.ts: minimal PNG read/write (no dependency)
│   ├── fx/                       #   generate.ts: draws the effect pixel art
│   └── rom/                      #   cartridge.ts: where things are in the ROM
│                                 #   decompress.ts, frame.ts: tiles → a drawing
│                                 #   disasm.ts, opcodes.ts: reading 65816 code
│                                 #   export.ts: all of it into our entities
├── scripts/                      # CLI entry points ONLY — one per npm run command;
│   │                             #   nothing in the repo imports from here
│   ├── anim.ts                   #   build an animation from a frame list
│   ├── chains.ts                 #   print the cancel graph with its arithmetic
│   ├── which.ts                  #   read the fl30 shorthand
│   ├── sheet.ts                  #   labelled contact sheet of frames, to look at
│   ├── fx.ts                     #   write the generated effects out
│   ├── pack.ts                   #   zip the assets for backup / handover
│   └── split-audio.ts            #   cut a capture into numbered clips
├── .claude/skills/               # procedures loaded on demand (add-animation)
├── tools/re/                     # Mesen 2 Lua scripts that record the original
│                                 #   into logs/ (docs/rom.md)
├── tools/entity-editor/          # the authoring tool (Canvas 2D)
│   ├── server.ts                 #   Vite dev-server plugin: /api/* endpoints (Node)
│   └── src/                      #   editor UI (browser)
├── data/entities/<name>/         # OUR data, committed: frames.json,
│                                 #   animations.json, states.json, …
├── data/audio/sound-test.json    # which clip of the sound-test capture is what
├── assets/                       # BYOA, gitignored — EXACTLY what the game reads
│   ├── sheets/                   #   one image per entity, transparency in the
│   │                             #   file; spawns/ holds what npm run fx writes
│   └── audio/sfx/                #   the clips cut from the capture
├── raw/                          # BYOA, gitignored — what those were made from
│                                 #   and cannot be regenerated (the capture,
│                                 #   untouched rips, the ROM). npm run pack -- --raw
├── preview/                      # gitignored: images drawn for a person to look
│                                 #   at (npm run sheet). Nothing reads them back
├── dist/                         # what leaves the repo: web/ is the build,
│                                 #   assets/ is what npm run pack writes
├── docs/                         # design notes & decisions (read before building)
├── vite.config.ts
└── tsconfig.json
```

The directory says *what a file is about*, not whether it runs in the browser.
Two properties the tree no longer shows, and both still hold:

- **PixiJS appears in exactly three files** — `main.ts`, `entity/entity.ts` and
  `entity/entityDef.ts`. Everything else is plain TypeScript, which is what lets
  Vitest run it in Node.
- **Some files never reach the browser**: `audio/split.ts`, `audio/wav.ts`,
  `sprites/png.ts`, `sprites/boxes.ts`, `fx/generate.ts` and `rom/` exist for the CLI in
  `scripts/`. They live in `src/` beside the domain they belong to; nothing the
  game imports reaches them.

## Data and assets

- **Naming:** the authored thing is an **Entity** (never "actor", "character" or
  "fighter"). In code, **`EntityDef`** is the loaded definition (textures +
  animations + states) and **`Entity`** is one live instance in the world; two
  Gokus are two entities sharing one `EntityDef`.
- An entity is a **directory of section files** (`frames.json`,
  `animations.json`, `states.json`, …), not one blob. The dev-server plugin
  assembles them for `GET /api/entity`; the editor saves **one section at a
  time** via `POST /api/section` (the active tab decides which). Format:
  `docs/data-format.md`.
- **BYOA (Bring Your Own Assets):** copyrighted images/audio are gitignored and
  must **never** enter git history. Only code and `data/` are committed. The
  source pack is **not downloadable anywhere** — the owner keeps it; the old
  sheet is hand-extended and matches no public rip, so **never re-flow
  `goku_old.png`**, only append at the bottom (`frames.json` is coordinates into
  it). `goku.png` is the opposite: written whole by `npm run rom -- export` from
  the cartridge, so it is regenerated, never edited. See `docs/assets.md`.

## Current status

The **Entity Editor** authors sprites and animations (framing, background
color-key, auto-detection, anchors, timed steps, hit/hurt/push boxes), auditions
the game's sound bank, and draws the cancel graph read-only; the **game** loads
an entity and runs it as a **state machine** from `states.json`.

Goku walks, jumps in three variants, pushes the opponent, crouches, blocks, and
attacks with Light / Medium / Heavy from standing, crouching and the air.
Special is a key with nothing behind it. A blow names how it is taken — flinch,
stagger, knockdown, or a juggle if it catches a falling body — pauses the game on
contact, pushes the defender back, costs health, leaves a generated spark where
the boxes met and makes a noise. Damage and hitstun both decay through a combo,
and a budget of two re-launches closes the uppercut loop.

**There is still no round.** Health floors at zero and nothing happens: no KO, no
reset, no second screen. That, and a second player, is what the game is missing
before it is one.

**What is next: `docs/plan.md`** — the queue, and the only one. Why the engine is
shaped as it is: `docs/adr/`.
