-- Mesen 2 script: the sound chip's whole RAM and its DSP registers, once —
-- every sample the fight can play is in it, in the chip's own BRR format,
-- found through the sample directory the DSP's DIR register ($5D) points at.
-- Which sample a sound plays is known from tools/re/log-dsp.lua; with this the
-- samples themselves can be decoded and compared with our clips.
--
-- Start it during a fight, with the fighters and the arena loaded.
--
-- Output (logs/, gitignored):
--   spc.bin  64 KiB of SPC700 RAM, then the 128 DSP registers

local OUT = "/Users/bkaaz/workspace/db-hd-remake/logs/spc.bin"
local WAIT = 30 -- half a second, so a sound just asked for is in place

local RAM = emu.memType.spcRam
local DSP = emu.memType.spcDspRegisters
if RAM == nil or DSP == nil then
  local names = {}
  for name in pairs(emu.memType) do names[#names + 1] = name end
  table.sort(names)
  emu.displayMessage("dump-spc", "memory types differ: " .. table.concat(names, " "))
  return
end

local function dump(memType, size)
  local bytes, chunks = {}, {}
  for addr = 0, size - 1 do
    bytes[#bytes + 1] = emu.read(addr, memType)
    if #bytes == 4096 then
      chunks[#chunks + 1] = string.char(table.unpack(bytes))
      bytes = {}
    end
  end
  if #bytes > 0 then chunks[#chunks + 1] = string.char(table.unpack(bytes)) end
  return table.concat(chunks)
end

local frame = 0
local ref
ref = emu.addEventCallback(function()
  frame = frame + 1
  if frame < WAIT then return end
  emu.removeEventCallback(ref, emu.eventType.endFrame)
  local out = assert(io.open(OUT, "wb"))
  out:write(dump(RAM, 0x10000))
  out:write(dump(DSP, 0x80))
  out:close()
  emu.displayMessage("dump-spc", "done: logs/spc.bin")
end, emu.eventType.endFrame)

emu.displayMessage("dump-spc", "dumping in " .. WAIT .. " frames")
