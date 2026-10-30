-- Mesen 2 script: a screenshot every few frames, with the camera and the
-- layers' scroll values beside it — what the static reading of a stage's
-- scroll (docs/rom.md, How a stage's layers scroll) cannot show: whether
-- BG2's top 31 lines move, and where the fighters fall among the layers.
--
-- Start it as the fight begins, walk to one end of the arena, jump.
--
-- Output (logs/, gitignored):
--   stage-<frame>.png  the screen
--   stage.txt          one line per screenshot: frame, player one's x, the
--                      camera's x and y, and $7A $7E $055C $0560 as the SA-1
--                      and as the S-CPU see them (which one holds them `?`)

local DIR = "/Users/bkaaz/workspace/db-hd-remake/logs/"
local FRAMES = 1200 -- twenty seconds
local EVERY = 30

local SA1 = emu.memType.sa1Memory
local CPU = emu.memType.snesMemory

local function word(addr, mem) return emu.read(addr, mem) | (emu.read(addr + 1, mem) << 8) end

local function values(mem)
  return string.format("%04x %04x %04x %04x", word(0x7a, mem), word(0x7e, mem), word(0x55c, mem), word(0x560, mem))
end

local log = assert(io.open(DIR .. "stage.txt", "w"))
log:write("# frame p1x camx camy | sa1: 7a 7e 55c 560 | cpu: 7a 7e 55c 560\n")
local frame, taken = 0, 0

local ref
ref = emu.addEventCallback(function()
  frame = frame + 1
  if frame % EVERY == 0 then
    local name = string.format("stage-%04d.png", frame)
    local png = assert(io.open(DIR .. name, "wb"))
    png:write(emu.takeScreenshot())
    png:close()
    log:write(string.format("%04d %d %d %d | %s | %s\n", frame,
      word(0x3120, SA1), emu.read(0x571, SA1), word(0x574, SA1), values(SA1), values(CPU)))
    taken = taken + 1
  end
  if frame == FRAMES then
    emu.removeEventCallback(ref, emu.eventType.endFrame)
    log:close()
    emu.displayMessage("shoot-stage", "done: " .. taken .. " screenshots")
  end
end, emu.eventType.endFrame)

emu.displayMessage("shoot-stage", "recording " .. FRAMES .. " frames")
