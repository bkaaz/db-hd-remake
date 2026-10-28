-- Mesen 2 script: in each frame where the SA-1 writes player one's tile
-- buffer (BW-RAM $0C00, DMA'd to VRAM $6000 — found with log-dma.lua), logs
-- every ROM read the SA-1 made, in order, merged into runs of consecutive
-- bytes. The order is the chain: sprite id -> table -> pointer -> stream.
--
-- Reads are callbacks on the SA-1's own bus: without emu.memType.sa1Memory
-- Mesen silently watches the S-CPU's instead and nothing fires.
--
-- Output: logs/tiles.txt (gitignored).

local OUT = "/Users/bkaaz/workspace/db-hd-remake/logs/tiles.txt"
local FRAMES = 240
local SPRITE_ID = 0x10a
local SHOW_BYTES = 16 -- a run this short is a lookup: print its values

local log = assert(io.open(OUT, "w"))
local frame, done = 0, false
local writes, runs = 0, {}

local function romOffset(addr)
  local ok, abs = pcall(emu.convertAddress, addr, emu.memType.sa1Memory)
  if ok and abs and abs.memType == emu.memType.snesPrgRom then return abs.address end
  return nil
end

local function onRead(addr, value)
  if done then return end
  local off = romOffset(addr)
  -- ROM $0000-$03FF is read thousands of times per unpack (the routine's own
  -- tables, or its code) and would cut every other run into pieces
  if off == nil or off < 0x400 then return end
  local last = runs[#runs]
  if last and not last.mark and off == last.start + #last.bytes then
    table.insert(last.bytes, value)
  else
    table.insert(runs, { start = off, cpu = addr, bytes = { value } })
  end
end
emu.addMemoryCallback(onRead, emu.callbackType.read, 0x008000, 0x3FFFFF, emu.cpuType.sa1, emu.memType.sa1Memory)
emu.addMemoryCallback(onRead, emu.callbackType.read, 0xC00000, 0xFFFFFF, emu.cpuType.sa1, emu.memType.sa1Memory)

local function onWrite()
  if done then return end
  if writes == 0 then table.insert(runs, { mark = true }) end
  writes = writes + 1
end
-- the SA-1 sees BW-RAM both through the $6000 window and at bank $40
emu.addMemoryCallback(onWrite, emu.callbackType.write, 0x006C00, 0x0073FF, emu.cpuType.sa1, emu.memType.sa1Memory)
emu.addMemoryCallback(onWrite, emu.callbackType.write, 0x400C00, 0x4013FF, emu.cpuType.sa1, emu.memType.sa1Memory)

local ref
ref = emu.addEventCallback(function()
  frame = frame + 1
  if writes > 0 then
    log:write(string.format("f%d sprite=%02x buffer writes=%d\n", frame,
      emu.read(SPRITE_ID, emu.memType.sa1InternalRam), writes))
    for _, r in ipairs(runs) do
      if r.mark then
        log:write("  -- first buffer write --\n")
      else
        local line = string.format("  rom %06x (cpu %06x) x%d", r.start, r.cpu, #r.bytes)
        if #r.bytes <= SHOW_BYTES then
          local hex = {}
          for _, b in ipairs(r.bytes) do table.insert(hex, string.format("%02x", b)) end
          line = line .. ": " .. table.concat(hex, " ")
        end
        log:write(line .. "\n")
      end
    end
  end
  writes, runs = 0, {}
  if frame == FRAMES then
    done = true
    emu.removeEventCallback(ref, emu.eventType.endFrame)
    log:close()
    emu.displayMessage("trace-tiles", "done")
  end
end, emu.eventType.endFrame)

emu.displayMessage("trace-tiles", "tracing " .. FRAMES .. " frames")
