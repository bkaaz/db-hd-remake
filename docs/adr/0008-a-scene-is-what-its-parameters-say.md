# 0008 — A scene is what its parameters say, and the URL says them

**Status:** accepted 2026-08-14 · its last line — presets in `package.json` —
overruled 2026-08-16 by `data/debug.json`

**Every scene must be constructible from a small, serialisable set of
parameters** — `{ scene: "fight", p1: "goku", p2: "goku" }` — and never from
objects the previous scene happened to build. That is the whole decision; the
rest follows.

Getting straight to the scene you are working on is then not a feature anybody
has to add, it is a consequence. **Being able to enter a scene directly is a
constraint on the scene interface, not a tool bolted on later:** a `FightScene`
that needs whatever `SelectScene` left behind cannot be entered any other way,
and no later trick fixes that. So the rule landed before the first scene existed.

**The state and its source are different questions.** The parameter object has to
exist regardless; the URL is merely one thing that fills it. "URL or a state
object" was a false choice — one state type, several possible sources, and today
there is one.

**An unknown or invalid parameter is a loud error**, never a quiet fallback to
the default scene. Everything in a URL is a string, so `p1=gokú` is the realistic
mistake, and silently running the default sends somebody debugging the wrong
thing.

**Rejected: a committed dev-state file as the primary source.** It is global and
commitable — two tabs cannot hold two scenes, and a modified file sits in
`git status` waiting to ride along with an unrelated commit. A dev entry point
that can be shipped by accident is a bug with a delay on it.

**A file was always allowed as a *second* source**, for setup a URL cannot hold
comfortably ("start at 10% health to test a KO"). That is what `data/debug.json`
became two days later, and it slotted in without reworking anything, because the
state type was already the interface. It also overruled this entry's own
suggestion that convenience live in `package.json`: the dev server stays up for
days, so a preset that costs a server restart costs more than the reload a URL
already costs.

A player can therefore skip the menus by typing a URL. Accepted: this is a
non-commercial fan project, not a thing with a front door to guard.
