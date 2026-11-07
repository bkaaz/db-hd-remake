# Port review — what the owner still has to try

Every move ported from the cartridge and not yet tried by the owner, a fighter
at a time. **A move he approves is deleted from this file**, like an item of
[`plan.md`](./plan.md), which points here; this file holds no other work.

Each line: the state to start from, the input, what the port left out or
guessed (`?`). In a drafted fighter a speed may also point the wrong way: `port`
reads a speed's size, not always its sign. **Not playable** means it waits for something: a recording, or
a mechanism the engine lacks (`plan.md`).

After any change to a reader or the cutter: `npm run rom -- export --all`, then
`npm run rom -- states --all`, then `git diff data/`. A diff on a fighter already
approved names what to try again.

Empty: every fighter approved (owner, 2026-11-07). A fighter ported next lists his moves here.
