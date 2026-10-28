-- Mesen 2 script: whenever player one's move, step, drawing or tile set
-- changes, logs those fields and every ROM read the SA-1 made in that frame
-- and the one before — the animation data the game consulted to decide what
-- comes next. Reads of a long stream (the tiles) are counted, not listed.
--
-- Output: logs/anim.txt (gitignored).

local OUT = "/Users/bkaaz/workspace/db-hd-remake/logs/anim.txt"
local FRAMES = 600
local FIELDS = { move = 0x140, step = 0x146, drawing = 0x10a, tiles = 0x190 }
local ORDER = { "move", "step", "drawing", "tiles" }
local LONG = 64 -- a run longer than this is a tile stream: show its size only

local log = assert(io.open(OUT, "w"))
local frame, done = 0, false
local runs, previous, before = {}, {}, nil

local function onRead(addr, value)
  if done then return end
  local ok, abs = pcall(emu.convertAddress, addr, emu.memType.sa1Memory)
  if not (ok and abs and abs.memType == emu.memType.snesPrgRom) then return end
  local off = abs.address
  if off < 0x400 then return end -- the unpacker's own hot loop, see trace-tiles.lua
  local last = runs[#runs]
  if last and off == last.start + #last.bytes then
    table.insert(last.bytes, value)
  else
    table.insert(runs, { start = off, cpu = addr, bytes = { value } })
  end
end
emu.addMemoryCallback(onRead, emu.callbackType.read, 0x008000, 0x3FFFFF, emu.cpuType.sa1, emu.memType.sa1Memory)
emu.addMemoryCallback(onRead, emu.callbackType.read, 0xC00000, 0xFFFFFF, emu.cpuType.sa1, emu.memType.sa1Memory)

local function fields()
  local f = {}
  for name, addr in pairs(FIELDS) do f[name] = emu.read(addr, emu.memType.sa1InternalRam) end
  return f
end

local function writeRuns(label, list)
  log:write("  " .. label .. ":\n")
  for _, r in ipairs(list) do
    local line = string.format("    rom %06x (cpu %06x) x%d", r.start, r.cpu, #r.bytes)
    if #r.bytes <= LONG then
      local hex = {}
      for _, b in ipairs(r.bytes) do table.insert(hex, string.format("%02x", b)) end
      line = line .. ": " .. table.concat(hex, " ")
    end
    log:write(line .. "\n")
  end
end

local ref
ref = emu.addEventCallback(function()
  frame = frame + 1
  local now = fields()
  local changed = before == nil
  for _, k in ipairs(ORDER) do changed = changed or now[k] ~= before[k] end
  if changed then
    local parts = {}
    for _, k in ipairs(ORDER) do table.insert(parts, string.format("%s=%02x", k, now[k])) end
    log:write(string.format("f%d %s\n", frame, table.concat(parts, " ")))
    writeRuns("frame before", previous)
    writeRuns("this frame", runs)
  end
  before, previous, runs = now, runs, {}
  if frame == FRAMES then
    done = true
    emu.removeEventCallback(ref, emu.eventType.endFrame)
    log:close()
    emu.displayMessage("trace-anim", "done")
  end
end, emu.eventType.endFrame)

emu.displayMessage("trace-anim", "tracing " .. FRAMES .. " frames")
