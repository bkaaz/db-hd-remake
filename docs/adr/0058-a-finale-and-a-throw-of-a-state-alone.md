# 0058 — A finale and a throw on a state alone

**Status:** accepted 2026-11-03; beside [0046](./0046-a-scene-on-the-opponent-is-its-own-field.md)

Saiyan Meteor's finale was its seize's. Galactic Gunfire throws the same
ball without holding anyone, so a state may carry a `finale` of its own
(`src/match/finales.ts`): thrown on its frame, it plays on through the
thrower's next states, and tells him `ballLanded` and `finaleDone` — his
states hold their step until then, as the original holds its frame
(`$20:9E57`, `$20:9F13`). `aim: "down"` drops it straight to the floor;
`resume` and the landing's shake are a seize's and optional. The same
pure steps (`finale.ts`) run both.

A state's `throwsFoe` is the throw's own blow (`$0F:B321`) on the opponent
where he is, held or not (`src/match/throw.ts`) — Galactic Gunfire's on
the body it pinned, which `grab` would refuse as not throwable.

**Rejected:**

- **Galactic Gunfire as a seize** — a seize sets him down and flies him;
  here he falls and lies on his own (`pinned`), and the move spans three.
- **The finale holding its thrower's clock** (`holdClock`, `jumpTo`), as
  the seize does — the waits fall across part boundaries; triggers keep
  each state's wait in its own file.
- **`grab` taking a body that is not throwable** — its range and
  `throwable` test are what make a throw a throw.
