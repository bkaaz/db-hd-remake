-- Mesen 2 script: in every frame where an object of the type to watch is
-- alive, every visible sprite in OAM plus the ten object slots — exactly what
-- the game draws, frame by frame, to set beside what our export draws.
--
-- Output: logs/oam.txt (gitignored). Light: nothing is read on other frames.

local OUT = "/Users/bkaaz/workspace/db-hd-remake/logs/oam.txt"
local FRAMES = 1800
local WATCH_TYPE = 0x0a -- the ki blast's object type (docs/rom.md)
local FIRST, SLOTS, SIZE = 0x300, 10, 0x10

local log = assert(io.open(OUT, "w"))
log:write("sprite: index x y tile attr big · slot: 16 bytes from I-RAM $3300 + 16 n\n")
local frame = 0

local function iram(a) return emu.read(a, emu.memType.sa1InternalRam) end
local function oam(a) return emu.read(a, emu.memType.snesSpriteRam) end

local function watched()
  for i = 0, SLOTS - 1 do
    local t = iram(FIRST + i * SIZE)
    if t & 0x80 ~= 0 and t & 0x0f == WATCH_TYPE then return true end
  end
  return false
end

local ref
ref = emu.addEventCallback(function()
  frame = frame + 1
  if watched() then
    log:write(string.format("f%d move=%02x\n", frame, iram(0x140)))
    for i = 0, SLOTS - 1 do
      local t = iram(FIRST + i * SIZE)
      if t & 0x80 ~= 0 then
        local bytes = {}
        for b = 0, SIZE - 1 do bytes[#bytes + 1] = string.format("%02x", iram(FIRST + i * SIZE + b)) end
        log:write(string.format("  slot %d: %s\n", i, table.concat(bytes, " ")))
      end
    end
    for i = 0, 127 do
      local y = oam(i * 4 + 1)
      if y < 224 or y >= 240 then
        local hi = (oam(512 + (i >> 2)) >> ((i & 3) * 2)) & 3
        local x = oam(i * 4) | ((hi & 1) << 8)
        log:write(string.format("  sprite %d %d %d %02x %02x %d\n", i, x, y, oam(i * 4 + 2), oam(i * 4 + 3), hi >> 1))
      end
    end
  end
  if frame == FRAMES then
    emu.removeEventCallback(ref, emu.eventType.endFrame)
    log:close()
    emu.displayMessage("log-oam", "done")
  end
end, emu.eventType.endFrame)

emu.displayMessage("log-oam", "logging " .. FRAMES .. " frames")
