-- Mesen 2 script: the original's sound test played through, for
-- `npm run samples -- --map` to name every clip of our capture by the id
-- that plays it (docs/rom.md, The sounds). The sound test plays its number
-- as the id below 0x50 ($00:D213).
--
-- Start it on the sound test's screen, then play every number from 00 up,
-- once each, letting each finish. Stop the script when done (every line is
-- written as it happens, so stopping loses nothing); it stops by itself
-- after ten minutes.
--
-- Output (logs/, gitignored):
--   dsp-sound-test.txt  log-dsp.lua's lines: each id asked for ($2141), and
--                       every sounding voice a frame — sample, pitch, envelope
--   spc-sound-test.bin  the sound chip's RAM and DSP registers, half a second
--                       after the first sound — the samples, as dump-spc.lua

local LOG = "/Users/bkaaz/workspace/db-hd-remake/logs/dsp-sound-test.txt"
local SPC = "/Users/bkaaz/workspace/db-hd-remake/logs/spc-sound-test.bin"
local FRAMES = 36000
local WAIT = 30

local RAM = emu.memType.spcRam
local DSP = emu.memType.spcDspRegisters
if RAM == nil or DSP == nil then
  emu.displayMessage("record-sound-test", "no SPC memory types in this Mesen")
  return
end

local log = assert(io.open(LOG, "w"))
log:write("# f<frame> sound <id> | f<frame> v<voice> env=<ENVX> pitch=<P> src=<SRCN>\n")
log:flush()

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

local frame, open, dumpAt = 0, true, nil

emu.addMemoryCallback(function(_, value)
  if not open or value == 0 then return end
  log:write(string.format("f%d sound %02x\n", frame, value))
  if dumpAt == nil then dumpAt = frame + WAIT end
end, emu.callbackType.write, 0x2141, 0x2141, emu.cpuType.snes)

local ref
ref = emu.addEventCallback(function()
  frame = frame + 1
  for v = 0, 7 do
    local base = v * 0x10
    local env = emu.read(base + 0x08, DSP)
    if env > 0 then
      local pitch = emu.read(base + 0x02, DSP) | (emu.read(base + 0x03, DSP) << 8)
      log:write(string.format("f%d v%d env=%d pitch=%04x src=%02x\n", frame, v, env, pitch, emu.read(base + 0x04, DSP)))
    end
  end
  log:flush()
  if dumpAt == frame then
    local out = assert(io.open(SPC, "wb"))
    out:write(dump(RAM, 0x10000))
    out:write(dump(DSP, 0x80))
    out:close()
    emu.displayMessage("record-sound-test", "samples dumped — keep playing")
  end
  if frame == FRAMES then
    emu.removeEventCallback(ref, emu.eventType.endFrame)
    open = false
    log:close()
    emu.displayMessage("record-sound-test", "done")
  end
end, emu.eventType.endFrame)

emu.displayMessage("record-sound-test", "recording — play the sound test from 00")
