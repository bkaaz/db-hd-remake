# Known bugs

Things that are **wrong**, written down the moment they are noticed — by
whoever notices, owner or Claude, without asking and without fixing them on the
spot. Noticing and fixing are separate acts: a fix smuggled into unrelated work
is a fix nobody reviewed.

This is not a queue. A line here says "this is broken", not "do this next" —
[`plan.md`](./plan.md) stays the only place that says what to work on. A bug
becomes work when it is put there or when someone just fixes it.

**A fixed bug is deleted from this file**, in the same change that fixes it.
Unlike `plan.md` this file also grows, so it needs the other half of the rule:
if a line has been here a long time, either it is not really a bug or it is
worth an entry in `plan.md`.

Newest first. One entry is: what you see, where, and how to make it happen.
Severity in plain words — *cosmetic*, *annoying*, *breaks play*, *loses work* —
because a number would only need translating back.

---

- **Gohan, Piccolo, Freeza and Buu cannot be hit in the air** — *breaks
  play*, in `hurt_air`, `hurt_heavy_air`, `juggle`, `launched`, `blown`,
  `slam`, `slam_air`: their `m24` has no hurt box, and those states have no
  `boxesOf` (only `wall_bounce`, `spiked`, `ground_bounce` take `m16`'s).
  Seen by reading their `animations.json`, not yet in a fight: launch one and
  hit him on the way down.
- **`npm run chains` calls every link a launcher** — *annoying*: "(launcher —
  chain ends here)" on a light blow too. `chainLinks` (`combat/chains.ts`)
  takes a reaction with no `vel` for a knockdown, and the reactions push with
  `shove` now. The margins are right; only the label is wrong.
- **An attack right after jumping over the opponent faces the wrong way** —
  *breaks play*. Jump over P2 and attack soon after landing: P1 does not turn
  round and swings at the air, his back to the opponent.
- **Vegeta's ultimate out of a diagonal jump flies on diagonally**, the
  opponent with him — *breaks play*. Jump forward or back, ↓ + Ki with the
  opponent in range: Galactic Gunfire rises along the jump's line. Cause `?`:
  a special starts stopped only when a command began it
  (`StateMachine.startedByCommand`, `entity.ts`), and his ultimate is asked
  for by a press since down + Ki.
- **Buu's charge is broken: its animation and its sound** — *annoying*. Hold
  Charge (RB) as Buu.
- **The rush panel cuts a multi-part A1 short** — *annoying*, debug only.
  Buu's, Gotenks's and Mr. Buu's A1 goes on into `rush_1_2` when it ends;
  any rush the panel tries for them makes A1 end in idle and step by the
  default step (`withRush` writes its end and `velAt`), so the panel does
  not play their own A1 back as it is.
- **`npm run rom -- export --fighter` asks for a recording it does not
  need** — *annoying*, tools only. It throws when `logs/objects-<name>.txt`
  is missing if any of his own objects lacks `ticks` or `animations`, even
  one already exported, which it then keeps and never reads the recording
  for (`scripts/rom.ts`, the `needed` check before `kept`).
- **The rush panel does not charge a new S1 or S3** — *annoying*, debug only. A
  new pick for Goku's S1 or S3 is made by `withRush` alone, so the charge's holds
  and levels keep the animation they were made from until `npm run states`
  runs `withCharge` again (`combat/smashCharge.ts`).
- **A charged ender's ways out open late** — *minor*. A level is entered part
  way through its ender's animation, but its `cancelBy` and the window
  `cancelable` reads count from the state's start, so Goku's Ki
  follow-ups off a charged S1 or S3 open later than off the plain one.
