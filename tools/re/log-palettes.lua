-- Mesen 2 script: one line whenever any of the 16 palettes changes, every
-- frame, with both fighters' moves — when a palette swap starts, what it
-- steps through and when it ends (the Kamehameha's fire on whoever it hits).
-- Light: reads 512 bytes a frame, writes only on a change.
--
-- Output: logs/palettes.txt (gitignored). One line per changed palette:
--   f<frame> p1=<move> p2=<move> pal <0-15> <16 BGR555 words, hex>

local OUT = "/Users/bkaaz/workspace/db-hd-remake/logs/palettes.txt"
local FRAMES = 1800

local log = assert(io.open(OUT, "w"))
local last = {}
local frame = 0

local function move(base) return emu.read(base + 0x40, emu.memType.sa1InternalRam) end

local ref
ref = emu.addEventCallback(function()
  frame = frame + 1
  for p = 0, 15 do
    local words = {}
    for k = 0, 15 do
      local at = 2 * (16 * p + k)
      local w = emu.read(at, emu.memType.snesCgRam) | (emu.read(at + 1, emu.memType.snesCgRam) << 8)
      words[#words + 1] = string.format("%04x", w)
    end
    local now = table.concat(words, " ")
    if now ~= last[p] then
      log:write(string.format("f%d p1=%02x p2=%02x pal %d %s\n", frame, move(0x100), move(0x200), p, now))
      last[p] = now
    end
  end
  log:flush()
  if frame == FRAMES then
    emu.removeEventCallback(ref, emu.eventType.endFrame)
    log:close()
    emu.displayMessage("log-palettes", "done")
  end
end, emu.eventType.endFrame)

emu.displayMessage("log-palettes", "logging " .. FRAMES .. " frames")
