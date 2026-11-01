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

## A render from the chip is not like the ball's sound

`npm run samples -- --render` · noticed 2026-11-01 · annoying

Saiyan Meteor's ball (2d, 2f) rendered from logs/dsp-meteor.txt — sample
18 on voices 6 and 7, their pitch frame by frame — is like no clip
(0.06 against 024 / 025, which the owner hears as it). A swing, 07,
rendered the same way, is like its clip (0.79). Pitch changing faster
than a frame, or a voice the log does not show, would explain it `?`.
The ball plays the owner's clips; meteor_38 is a render and may be off
the same way.

## Vegeta's object recording is gone

`npm run rom -- export --fighter vegeta` · noticed 2026-11-01 · annoying

Goku's object recording (2026-11-01) overwrote `logs/objects-rec.txt`,
the only copy of Vegeta's. What it gave is exported and committed
(`data/spawns/vegeta_*`), but exporting his objects again now stops: the
export reads `logs/objects-vegeta.txt`, which needs a new recording of
his Big Bang and Final Flash (`npm run rom -- spawns --fighter vegeta`).

## The export rewrites `goku/sounds.json` with nothing changed

`npm run rom -- export` · noticed 2026-10-31 · cosmetic

The committed `_comment` spells its dashes `—`; the export writes them
as `—`, so every export leaves the file modified. Whichever spelling is
kept, the two have to agree.

## A charge does not take over a punch begun a frame before

`goku`, A then S a frame apart · noticed 2026-10-30 · annoying

In the original, Y pressed a frame before B starts the far Y (`92`) for one
frame, and the charge takes over (`tools/re/log-charge.lua`). Ours plays the
punch and no charge: only idle and walking look for A + S. Whether the
normals' handler checks for Y + B all through or only at their start is not
read.

## Goku's black-haired drawings are missing part of the hair

`assets/sheets/goku.png`, drawings `26`–`2a` and `2f`–`34` · noticed 2026-10-28 · cosmetic

The hair is cut flat at the top and some strands look too thin. These are the
transformation drawings, and every script that shows them (moves `3c`, `3e`)
issues a `b0` just before — which spawns an object that draws the rest of
the hair, from resource `0x51` in the palette at `0x27B161` (confirmed against
a VRAM snapshot, `rom.md`). The overlay is exported now, as the spawn
`goku_hair`; nothing plays it yet (`plan.md`).
To see it: `npm run rom -- frame 29`. The work to fix it is in `plan.md`.

## `npm run anim` only knows how far a move reaches sideways

`src/sprites/boxes.ts:110` · noticed 2026-08-23 · annoying

`reach` measures the silhouette horizontally, and `activeIndex` and `hitBox`
are both built on it. Everything a move does vertically is invisible to it, and
it fails three ways, none of them announced as a guess:

- **A tie picks the earlier frame.** 44 and 45 share a rect and an anchor, so the
  hit box landed on `punch_air`'s wind-up.
- **A vertical blow gets no box at all.** `arm_sweep` (71-73) sweeps up and over,
  nothing extends, and the box came back `FALLBACK`.
- **A vertical blow picks the wrong frame entirely.** For `knee` (112-114) the
  widest silhouette is 112, the standing prepare, so the box was offered on the
  frame before the move starts.

All three had to be placed by hand, and re-running the script undoes them.

Reproduce: `npm run anim -- goku_old probe --frames 112,113,114 --kind attack --dry-run`
and read which step is starred.

Worth deciding with the fix: whether `--active N` is enough, or whether reach
should be measured as distance from the anchor in both axes — the second would
have got all three right without a flag.

## Save never tells you it saved

`tools/entity-editor/src/main.ts:192` · noticed 2026-08-22 · annoying

`wireSave` puts the result in the status bar and then calls `render()`, which
sets `statusEl.textContent` unconditionally from the sheet's dimensions and
counts (`main.ts:336`). The message is overwritten in the same tick, so
"Saved data/entities/goku_old/frames.json" never appears — the bar just snaps back to
`720x2304px · 180 frames · …`. An error message from a failed save is lost the
same way, which is the half that matters.

To see it: press Save on the Sprites tab and watch the status bar.

Not fixed here because the ordering is not the whole question: `render()` owns
that element, so either it learns to leave a transient message alone or the
message belongs somewhere that is not the status bar. The new "Apply to sheet"
button sidesteps it by not calling `render()` — nothing in the editor's state
changed, only the disk — which works but is a second convention, not a fix.

## Re-running npm run anim throws away every box that was adjusted by hand

`scripts/anim.ts` · noticed 2026-08-22 · loses work

The script keeps existing *timings* when the frame list is unchanged, and says
so — but it rebuilds `boxes` from the silhouette every time, unconditionally. A
hit box widened in the editor, a hurt box nudged off the hair, a push box drawn
by hand: all replaced on the next run, with nothing printed to say they were
there.

It is live on data shipped today. `punch_knee`'s hit box is hand-set to 12x7
because the derived one was a 3px artefact (see the entry below), and its steps
are a hand-made four-step split. `npm run anim -- goku_old punch_knee --frames
187,188 --kind attack` puts back the 3px box and the three-step shape, and only
the timing reset is mentioned.

Until it is fixed, treat re-running the script on a tuned animation as
destructive and check `git diff` afterwards.

The fix has a shape: the script already knows which boxes it derived (hurt, and
the placeholder hit), so it can keep anything it did not put there — a push box
always, and a hit box whose geometry no longer matches what the derivation would
produce. That last test is the awkward half and is why this is written down
rather than done.

## A new frame's anchor lands in the middle of its rectangle, not under its feet

`tools/entity-editor` · noticed 2026-08-22 · annoying

Cutting a frame puts the anchor at `round(w / 2)` — every frame on the sheet has
it there. The rectangle follows the widest limb, so a pose with an arm out gets a
wider rect, a centre further from the body, and a fighter who slides sideways
when that pose plays. It cost four of the seven new frames:

| frame | feet, against the held crouch |
|---|---|
| 182 | aligned — drawn on the crouch's own legs |
| 183 | +6 px |
| 184 | +7 px |
| 187 | +5 px |
| 188 | −3 px |

Nothing errors, and it is invisible in the editor: each pose looks right on its
own, and only playing them in sequence shows the drift. The owner found it by
noticing Goku move during an attack whose legs do not move.

The fix is computable, which is what makes this worth writing down rather than
correcting by eye. Correlating the bottom sixteen rows of a frame against the
stance it belongs to gives the offset exactly — 95–100% coverage on all five
crouching frames, because the legs really are the same pixels. That could be a
script (`npm run anchor -- goku_old 187,188 --like 18`) or a button in the editor;
either beats nudging until it looks still.

Two things to know before fixing it. Boxes are stored **relative to the anchor**,
so moving one must move them with it, or the hurt boxes come off the body. And
the reference stance differs per pose: crouching frames align to 18, standing
ones to an idle frame, so the tool has to be told which.

## npm run anim measures the hit box against the wrong limb

`scripts/anim.ts` · noticed 2026-08-22 · annoying

The hit box is derived from how far the active frame reaches **beyond the
others**, which assumes the striking limb is what reaches furthest. On a
kneeling attack it is not: `punch_knee`'s wind-up (187) has a knee out at
`y=64`, further forward than anything in the strike except the fist, so the
comparison came back 3 px wide against 11 for the standing punch. Measuring
inside the arm's own rows instead gives 6 px of extension and a 12x7 fist —
the same fist size the standing punch measures.

Nothing errors. The printed table looks ordinary and the move is simply almost
impossible to land, which is the same silent shape as the depth-frame problem
the skill already warns about.

To see it: `npm run anim -- goku_old probe --frames 187,188 --kind attack --dry-run`
and read the hit box against `punch`'s.

The fix is to compare within a band of rows rather than across the whole frame
— the striking limb's own rows, taken from where the active frame reaches
furthest. Left alone for now because it wants a rule about which band, and one
crouching attack is not enough evidence to choose it. Meanwhile the number is a
placeholder like every other hit box, and the report says when it looks wrong.

## Keying starts off on a sheet that is already partly transparent

`tools/entity-editor/src/main.ts:213` · noticed 2026-08-21 · annoying

Loading a sheet asks whether the image contains *any* transparency and answers it
for all 180 frames: if yes, `bgKeyEnabled` starts false. That is the right answer
for a fully keyed sheet, which every fighter's now is — and the wrong one the
moment new poses are appended to `goku_old.png` on the rip's background colour, since
the control that would key them starts switched off.

To see it: append anything opaque to `assets/sheets/goku_old.png` and load it — the
"transparent" checkbox is clear and the new rows keep their background.

Nothing is lost and there is a one-click way out: the eyedropper sets
`bgKeyEnabled = true` unconditionally (`sheetView.ts:88`), so picking the
background colour turns keying back on, and `rebuildKeyed` only ever touches
pixels with `a > 0` — the already-transparent ones are left alone. The fix, if
one is wanted, is to drop the all-or-nothing question at load and let the eyedropper
be the whole interface.

## A press dies on the frame the move ends

`src/input/buffer.ts` · noticed 2026-08-16 · annoying

The machine reads the buffer once per frame and the buffer is ticked afterwards,
so a press with one frame of life left is aged out by the very frame that
returns control — and the state entered on that frame only looks at its input on
the next one. Seven frames of an eight-frame window are usable, and the eighth
is precisely the one a player aiming at "as soon as I can act" will hit. From
the recording: press on 00098, `punch → idle` on 00105, and the same line says
`EXPIRED unused`.

Found while measuring why 25 of 33 light presses in one session went unused, and
it survived two attempts at the other cause. The jab shrank from 25 frames to
12, and the second recording still lost the press: **hitstop is added to an
attack's remaining animation, not taken out of it**, so a blow that lands leaves
6 frozen frames *plus* the 8 the jab still has to play. At a window of 8 the
press expired on the very frame it would have been spent. `BUFFER_FRAMES` is 12
now and the jab links, which is tuning around the defect rather than fixing it.

The fix that makes a buffer feel like its number is to let the state entered on
a frame evaluate its own transitions that same frame. That touches "at most one
transition per frame" in `states.ts`, which is deliberate, so it wants deciding
rather than doing.

## A held direction sticks after the window loses focus

`src/input/keyboard.ts` · noticed 2026-08-14 · annoying

Hold `→`, switch tab or click away, come back: Goku keeps walking right and
nothing stops him but tapping the key again. The browser delivers no `keyup`
to a window that is not focused, so `held.right` is never cleared.

Fix is a `blur` listener that clears every held direction. Attack buttons need
nothing — they disarm themselves every frame.
