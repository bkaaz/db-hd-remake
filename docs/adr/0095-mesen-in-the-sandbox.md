# 0095 — Mesen in the sandbox reads the owner's save states

**Status:** accepted 2026-11-17 · extends ADR 0074: the original is played inside
the `sbx` sandbox, while the owner keeps saving states on his Mac

The owner records save states in his windowed Mesen **2.2.1** on the Mac, into
`raw/states/` (the sandbox mounts the same directory). The sandbox runs Mesen
**2.1.1**, Linux ARM64 — the newest release and the version on its `master`; the
dev builds (`nightly.link`) are behind the firewall. Both write save-state format
4, but a state's header names the Mesen that saved it (bytes 3–6, `major<<16 |
minor<<8 | rev`, little-endian) and `SaveStateManager::LoadState` refuses one from
a newer version. `tools/re/run.lua` rewrites that field to 2.0.0 before loading
and fails loudly if the state is still refused. Checked once: `fight-goku`, move
`a8`, frame for frame the same as the Mac's report.

What the sandbox needs, none of it in the repo:

- `~/.local/opt/mesen/Mesen`, plus `dotnet-runtime-8`, `libsdl2-2.0-0`, `xauth`.
- `~/.local/bin/mesen` — the wrapper `MESEN` points at (`/etc/sandbox-persistent.sh`):
  `DOTNET_ROOT=/usr/lib/dotnet`, run under `xvfb-run -a`. The test runner still
  opens an X display; without one it dies with `XOpenDisplay failed`.
- `~/.config/Mesen2/settings.json` with `"FirstRun": false` (otherwise the setup
  wizard waits forever on the invisible display) and
  `Debug.ScriptWindow.AllowIoOsAccess: true` (the scripts write `logs/`).

Rejected:

- **Rewriting `raw/states/*.mss` once.** They are the owner's files, and every new
  state would need the same step.
- **A Linux build of 2.2.1.** No published one; building it needs its source, which
  the repository does not carry.
- **Checking each loaded state for a sane fight.** The migration is done; the
  `assert` on the load is what caught the silent failure.
