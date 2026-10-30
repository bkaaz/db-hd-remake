-- Mesen 2 script: how fast charging runs (docs/rom.md, Charging ki refills
-- health) — a line whenever player one's move, charging dial (field 0x66)
-- or health (0x60) changes, and every sound id handed to the APU ($2141),
-- each with the frame it happened on. Reading the code says 2 frames a dial
-- step and a sound every 8; this says whether a frame of the game is a frame
-- of the screen.
--
-- Start it in a fight, hold Y + B for a few seconds, let go, charge again.
--
-- Output: logs/charge.txt (gitignored).

local OUT = "/Users/bkaaz/workspace/db-hd-remake/logs/charge.txt"
local FRAMES = 900 -- fifteen seconds
local BASE = 0x100 -- player one in SA-1 I-RAM; fields: src/rom/cartridge.ts
local IRAM = emu.memType.sa1InternalRam

local log = assert(io.open(OUT, "w"))
log:write("# f<frame> what\n")
local frame, last, open = 0, nil, true

local function byte(f) return emu.read(BASE + f, IRAM) end
local function word(f) return byte(f) | (byte(f + 1) << 8) end

-- every sound the game asks the APU for, as it asks
emu.addMemoryCallback(function(_, value)
  if open and value ~= 0 then log:write(string.format("f%d sound %02x\n", frame, value)) end
end, emu.callbackType.write, 0x2141, 0x2141, emu.cpuType.snes)

local ref
ref = emu.addEventCallback(function()
  frame = frame + 1
  local now = string.format("move=%02x dial=%d health=%d", byte(0x40), word(0x66), word(0x60))
  if now ~= last then
    log:write(string.format("f%d %s\n", frame, now))
    last = now
  end
  if frame == FRAMES then
    emu.removeEventCallback(ref, emu.eventType.endFrame)
    open = false
    log:close()
    emu.displayMessage("log-charge", "done")
  end
end, emu.eventType.endFrame)

emu.displayMessage("log-charge", "recording " .. FRAMES .. " frames")
