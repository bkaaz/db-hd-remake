-- Mesen 2 script: the original's sound test played through, for
-- `npm run samples -- --map` to name every clip of our capture by the id
-- that plays it (docs/rom.md, The sounds). The sound test plays its number
-- as the id below 0x50 ($00:D213).
--
-- Start it on the sound test's screen with the cursor on number 00: it
-- plays the sounds itself — A, waits until every voice has been quiet for
-- half a second (or 8 seconds have passed: a sound that loops), → to the
-- next number, and again, COUNT times. Every line is written as it happens,
-- so stopping it early loses nothing. AUTO = false leaves the pad to you.
--
-- Output (logs/, gitignored):
--   dsp-sound-test.txt  log-dsp.lua's lines: each id asked for ($2141), and
--                       every sounding voice a frame — sample, pitch, envelope
--   spc-sound-test.bin  the sound chip's RAM and DSP registers, half a second
--                       after the first sound — the samples, as dump-spc.lua

local LOG = "/Users/bkaaz/workspace/db-hd-remake/logs/dsp-sound-test.txt"
local SPC = "/Users/bkaaz/workspace/db-hd-remake/logs/spc-sound-test.bin"
local FRAMES = 72000 -- twenty minutes: 80 sounds that each loop would take 11
local WAIT = 30
local AUTO = true
local COUNT = 0x50 -- numbers 00 to 4F: the effects, played as their own ids
local HOLD = 4 -- frames a button is held, then as many let go
local QUIET = 30 -- frames with no voice sounding: the sound is over
local LONGEST = 480 -- a sound that loops is left after this many

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
local quiet = 0 -- frames in a row with no voice sounding

emu.addMemoryCallback(function(_, value)
  if not open or value == 0 then return end
  log:write(string.format("f%d sound %02x\n", frame, value))
  if dumpAt == nil then dumpAt = frame + WAIT end
end, emu.callbackType.write, 0x2141, 0x2141, emu.cpuType.snes)

local ref
ref = emu.addEventCallback(function()
  frame = frame + 1
  local sounding = false
  for v = 0, 7 do
    local base = v * 0x10
    local env = emu.read(base + 0x08, DSP)
    if env > 0 then
      sounding = true
      local pitch = emu.read(base + 0x02, DSP) | (emu.read(base + 0x03, DSP) << 8)
      log:write(string.format("f%d v%d env=%d pitch=%04x src=%02x\n", frame, v, env, pitch, emu.read(base + 0x04, DSP)))
    end
  end
  log:flush()
  quiet = sounding and 0 or quiet + 1
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

emu.displayMessage("record-sound-test", AUTO and "recording — playing the sound test from the cursor" or "recording — play the sound test from 00")

-- the pad, played: A, wait for quiet, →, A … (emu.setInput only works while
-- the game reads the pad, hence the inputPolled callback)
if AUTO then
  local played, step, since = 0, "press", 0
  local function set(buttons)
    if not pcall(emu.setInput, buttons, 0) then pcall(emu.setInput, 0, buttons) end
  end
  emu.addEventCallback(function()
    if not open or played >= COUNT then return end
    since = since + 1
    if step == "press" then
      set(since <= HOLD and { a = true } or {})
      if since >= 2 * HOLD then step, since = "wait", 0 end
    elseif step == "wait" then
      set({})
      -- give it time to start, then wait for the quiet that ends it
      if (since > 20 and quiet >= QUIET) or since >= LONGEST then
        played = played + 1
        log:write(string.format("# played %d\n", played))
        step, since = "next", 0
      end
    elseif step == "next" then
      set(since <= HOLD and { right = true } or {})
      if since >= 2 * HOLD then step, since = "press", 0 end
    end
    if played >= COUNT then emu.displayMessage("record-sound-test", "all " .. COUNT .. " played — stop the script") end
  end, emu.eventType.inputPolled)
end
