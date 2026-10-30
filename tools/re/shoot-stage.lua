-- Mesen 2 script: a screenshot every few frames, with the health and the
-- layers' scroll values beside it — what reading the code cannot show:
-- how the screen looks (docs/rom.md, How a stage's layers scroll; The HUD).
--
-- Start it once the fight has begun; walk to one end of the arena, jump,
-- or take blows until the health bar moves.
--
-- Output (logs/, gitignored):
--   stage-<frame>.png  the screen
--   stage.txt          one line per screenshot: frame, each player's health
--                      and the health the HUD shows (fields 0x60 / 0x64), and
--                      the layers' scroll, $7A $7E $055C $0560 (S-CPU WRAM)

local DIR = "/Users/bkaaz/workspace/db-hd-remake/logs/"
local FRAMES = 3600 -- a minute
local EVERY = 30

local IRAM = emu.memType.sa1InternalRam -- fighters at 0x100 / 0x200: src/rom/cartridge.ts
local WRAM = emu.memType.snesWorkRam

local function word(addr, mem) return emu.read(addr, mem) | (emu.read(addr + 1, mem) << 8) end

local log = assert(io.open(DIR .. "stage.txt", "w"))
log:write("# frame p1 health shown | p2 health shown | 7a 7e 55c 560\n")
local frame, taken = 0, 0

local ref
ref = emu.addEventCallback(function()
  frame = frame + 1
  if frame % EVERY == 0 then
    local name = string.format("stage-%04d.png", frame)
    local png = assert(io.open(DIR .. name, "wb"))
    png:write(emu.takeScreenshot())
    png:close()
    log:write(string.format("%04d %d %d | %d %d | %04x %04x %04x %04x\n", frame,
      word(0x160, IRAM), word(0x164, IRAM), word(0x260, IRAM), word(0x264, IRAM),
      word(0x7a, WRAM), word(0x7e, WRAM), word(0x55c, WRAM), word(0x560, WRAM)))
    taken = taken + 1
  end
  if frame == FRAMES then
    emu.removeEventCallback(ref, emu.eventType.endFrame)
    log:close()
    emu.displayMessage("shoot-stage", "done: " .. taken .. " screenshots")
  end
end, emu.eventType.endFrame)

emu.displayMessage("shoot-stage", "recording " .. FRAMES .. " frames")
