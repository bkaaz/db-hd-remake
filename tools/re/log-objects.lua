-- Mesen 2 script: one line per frame in which any spawned object changes —
-- the ten 16-byte object slots at SA-1 I-RAM $3300-$339F (docs/rom.md), and
-- which move player one is in. An object's frame timing and speed live in
-- its type's own code; this reads them off instead.
--
-- Output: logs/objects.txt (gitignored). Light enough to run at full speed.

local OUT = "/Users/bkaaz/workspace/db-hd-remake/logs/objects.txt"
local FRAMES = 3600
local FIRST, SLOTS, SIZE = 0x300, 10, 0x10

local log = assert(io.open(OUT, "w"))
log:write("slot bytes: 00 type|flags, 01 animation, 02 step, 04 flags, 06-07 x, 09-0a y, 0b timer, 0c-0d vx\n")
local frame, last = 0, {}

local function slot(i)
  local bytes = {}
  for b = 0, SIZE - 1 do
    bytes[#bytes + 1] = string.format("%02x", emu.read(FIRST + i * SIZE + b, emu.memType.sa1InternalRam))
  end
  return table.concat(bytes, " ")
end

local ref
ref = emu.addEventCallback(function()
  frame = frame + 1
  local lines = {}
  for i = 0, SLOTS - 1 do
    local now = slot(i)
    if now ~= last[i] then
      table.insert(lines, string.format("  slot %d: %s", i, now))
      last[i] = now
    end
  end
  if #lines > 0 then
    local move = emu.read(0x140, emu.memType.sa1InternalRam)
    log:write(string.format("f%d move=%02x\n%s\n", frame, move, table.concat(lines, "\n")))
  end
  if frame == FRAMES then
    emu.removeEventCallback(ref, emu.eventType.endFrame)
    log:close()
    emu.displayMessage("log-objects", "done")
  end
end, emu.eventType.endFrame)

emu.displayMessage("log-objects", "logging " .. FRAMES .. " frames")
