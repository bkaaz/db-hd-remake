# Entity Editor — plan

Evolving the (formerly "sprite") editor into an **Entity Editor**: the single tool
that authors a complete game entity — sprites, animations, hitboxes, sounds,
inputs, and states. "Entity" is generic on purpose: it covers fighters now and
projectiles / stage objects later.

Decided 2026-08-07. Supersedes the narrow "sprite editor" framing in
[`tooling.md`](./tooling.md).

## The Entity data model (target)

One file per entity: `<name>.entity.json` (was `*.character.json`).

```
entity.json
  meta:        name, atlas
  attributes:  health, walkSpeed, jumpSpeed, gravity, …     # constants (MUGEN: CNS const)
  frames:      id → { rect, anchor }                         # sprites   (MUGEN: SFF)
  animations:  id → { loop, steps:[{ frame, dur, boxes:[hit|hurt|push] }] }  # (MUGEN: AIR + Clsn)
  sounds:      id → clip ref (assets/audio/…)                # (MUGEN: SND)
  commands:    id → input motion, e.g. "236P" + buffer window  # (MUGEN: CMD)
  states:      id → {
     animation,                          # what plays
     physics / movement,                 # velocities, movement rules
     onEnter: [ playSound, setVel, … ],  # entry effects   (MUGEN: state controllers)
     hit: { damage, hitstun, blockstun, knockback, sound },  # when a hitbox connects (MUGEN: HitDef)
     transitions: [ { when: <trigger>, to: <state> } ]        # (MUGEN: triggers + ChangeState)
     script?: <small expression/hook>    # escape hatch for unusual behavior (hybrid)
  }
  initialState
```

**States are the core.** A state binds an animation + physics + sound + input
into one node; the entity is a state machine. This mirrors the MUGEN mental model
(StateDef + controllers + triggers + HitDef) but as **data, not a scripting
language**, edited visually.

**Inter-entity events** (the "on hit, opponent enters hurt state" behavior):
> attacker's *active hit box* ∩ defender's *hurt box* + attacker state's `hit`
> → engine applies damage and forces the defender into its `hurt` state
> (trigger `onGotHit`).

This is MUGEN's HitDef → GetHit, executed by the engine from authored data.

### State model: hybrid (data + small script)

Chosen approach: **mostly data-driven, with a small scripting escape hatch**.
Common cases (play anim, set velocity, transition on input / anim-end / on-hit)
are pure data edited visually; a compact expression/hook handles the rare
behaviors that don't fit. More power than pure data, without a full DSL.
(Exact trigger/effect vocabulary + script surface designed in Phase D.)

## Editor structure: tabs over one Entity object

| Tab | Purpose |
|---|---|
| **Sprites** | load sheet, background key, auto-detect, frames + anchors |
| **Animations** | timed steps + hit/hurt/push box layer + preview |
| **States** | read-only view of `states.json` + validation (authoring stays in text — see `decisions.md`) |

Commands (input motions), Sounds and Attributes are placeholder tabs. They get
built when the engine work that needs them comes up the queue — see
[`plan.md`](./plan.md).

## Principle: editor and engine co-evolve

Authored data is meaningless until the engine executes it. So every phase is a
**vertical slice**: data model + editor UI + engine support + verify in the game.

## How it got here

A record of the phases already built, kept because the reasoning behind the
shape of the tool lives in them. **The lettered phases are history, not a
schedule** — remaining work is in [`plan.md`](./plan.md), under its own letters.

| Phase | Editor | Engine | Unlocked |
|---|---|---|---|
| **A. Rename + tabs** ✅ | reorganize existing; `sprite-editor`→`entity-editor`; `*.character.json`→`*.entity.json` | loader path update | clean base, no new features |
| **B. Hitboxes** ✅ | box layer in Animations (draw/select/delete) | box overlay (toggle B) | boxes authored + shown |
| **D1. States — engine** ✅ | — (`states.json` hand-written) | state-machine runner, opponent-relative facing | idle/walk from data; temp walk removed |
| **D2. States — validation** ✅ | read-only States tab, problems flagged | shared `validateStates()` + `npm test`, errors shown at load | safe hand-authoring (a visual state editor was dropped — see `decisions.md`) |

Slow and deliberate; each phase verified in the running game.
