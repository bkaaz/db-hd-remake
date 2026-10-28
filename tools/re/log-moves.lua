-- Mesen 2 script: one line whenever player one's move, step or drawing
-- changes, with the pad and the velocities — which move id the game picks
-- for each action. Light: reads a handful of bytes a frame, no callbacks on
-- the bus, so the game runs at speed.
--
-- Output: logs/moves.txt (gitignored).

local OUT = "/Users/bkaaz/workspace/db-hd-remake/logs/moves.txt"
local FRAMES = 1800
local BASE = 0x100 -- player one in SA-1 I-RAM; fields: src/rom/cartridge.ts
local BUTTONS = { "a", "b", "x", "y", "l", "r", "up", "down", "left", "right" }

local log = assert(io.open(OUT, "w"))
local frame, last = 0, nil

local function byte(f) return emu.read(BASE + f, emu.memType.sa1InternalRam) end
local function word(f)
  local v = byte(f) | (byte(f + 1) << 8)
  return v >= 0x8000 and v - 0x10000 or v
end

local function pad()
  local ok, p = pcall(emu.getInput, 0)
  if not ok or p == nil then return "?" end
  local held = {}
  for _, b in ipairs(BUTTONS) do if p[b] then table.insert(held, b) end end
  return #held > 0 and table.concat(held, "+") or "-"
end

local ref
ref = emu.addEventCallback(function()
  frame = frame + 1
  local now = string.format("move=%02x step=%02x drawing=%02x", byte(0x40), byte(0x46), byte(0x0a))
  if now ~= last then
    log:write(string.format("f%d %s vx=%d vy=%d pad=%s\n", frame, now, word(0x7c), word(0x7e), pad()))
    last = now
  end
  if frame == FRAMES then
    emu.removeEventCallback(ref, emu.eventType.endFrame)
    log:close()
    emu.displayMessage("log-moves", "done")
  end
end, emu.eventType.endFrame)

emu.displayMessage("log-moves", "logging " .. FRAMES .. " frames")
