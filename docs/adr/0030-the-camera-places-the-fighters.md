# 0030 — The camera has the last word on where the fighters stand

**Status:** accepted 2026-10-30 · builds on 0029

The camera is the original's (`rom.md`, The camera; `src/camera/`): pushed
by a fighter in the screen's outer band moving toward its edge, never
centred, and lifted by an eighth of the higher fighter's height. It runs
after the bodies have moved and been pushed apart, both within the world
(`Camera.world`): it reads each body's whole move this frame and may stop
one at the screen's edge or put back one that drifted past it
(`Fighters.keepInView`). The bolts keep to the screen (`Camera.screen`).
The sizes come from outside — the screen's from `src/view.ts`, the
world's and the floor's from `src/stage.ts`; the band, margin and snap
are the camera's own.

**Rejected:**

- **A camera centred between the fighters**, as most fighters now have.
  Not the original's, and its 64-px push and 16-px margin would mean
  nothing.
- **Bodies clamped to the screen first, the camera following after.** A
  fighter walking toward the edge would be stopped before the camera saw
  the move, so the screen would never scroll.
- **The push apart after the camera.** The camera sees a walk into the
  other body at full speed and the push at none, so the walker crosses the
  band's edge and back each frame and the screen scrolls every other one.
