-- Mesen 2 script: logs every DMA the S-CPU starts, plus every write to the
-- SA-1's DMA / character-conversion registers, beside the sprite id of player
-- one — so the ROM (or RAM) address a sprite's tiles come from can be read
-- off the log instead of found by stepping through the debugger.
--
-- Output: logs/dma.txt (gitignored).

local OUT = "/Users/bkaaz/workspace/db-hd-remake/logs/dma.txt"
local FRAMES = 300
local SPRITE_ID = 0x10a -- player one, SA-1 I-RAM (found with record-ram.lua)

local log = assert(io.open(OUT, "w"))
local dmaRegs = {}   -- last value written to each of $4300-$437F
local vramAddr = 0   -- last word written to $2116/$2117
local frame = 0
local done = false

-- memory callbacks keep firing after the file is closed; drop those lines
local function out(line) if not done then log:write(line) end end

local function reg(ch, r) return dmaRegs[0x4300 + ch * 0x10 + r] or 0 end

emu.addMemoryCallback(function(addr, value)
  dmaRegs[addr] = value
end, emu.callbackType.write, 0x4300, 0x437F, emu.cpuType.snes)

emu.addMemoryCallback(function(addr, value)
  if addr == 0x2116 then vramAddr = (vramAddr & 0xFF00) | value
  else vramAddr = (vramAddr & 0x00FF) | (value << 8) end
end, emu.callbackType.write, 0x2116, 0x2117, emu.cpuType.snes)

emu.addMemoryCallback(function(_, value)
  for ch = 0, 7 do
    if value & (1 << ch) ~= 0 then
      local src = reg(ch, 2) | (reg(ch, 3) << 8) | (reg(ch, 4) << 16)
      local size = reg(ch, 5) | (reg(ch, 6) << 8)
      if size == 0 then size = 0x10000 end
      out(string.format("f%d dma ch%d bbus=21%02x src=%06x size=%04x vram=%04x\n",
        frame, ch, reg(ch, 1), src, size, vramAddr))
    end
  end
end, emu.callbackType.write, 0x420B, 0x420B, emu.cpuType.snes)

-- SA-1 DMA and character conversion: $2230-$2239 (control, source, dest, size)
for _, cpu in ipairs({ emu.cpuType.snes, emu.cpuType.sa1 }) do
  emu.addMemoryCallback(function(addr, value)
    out(string.format("f%d sa1reg %04x=%02x\n", frame, addr, value))
  end, emu.callbackType.write, 0x2230, 0x2239, cpu)
end

local ref
ref = emu.addEventCallback(function()
  frame = frame + 1
  out(string.format("f%d frame sprite=%02x\n", frame,
    emu.read(SPRITE_ID, emu.memType.sa1InternalRam)))
  if frame == FRAMES then
    emu.removeEventCallback(ref, emu.eventType.endFrame)
    done = true
    log:close()
    emu.displayMessage("log-dma", "done")
  end
end, emu.eventType.endFrame)

emu.displayMessage("log-dma", "logging " .. FRAMES .. " frames")
