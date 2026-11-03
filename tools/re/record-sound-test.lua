-- Mesen 2 script: the original's sound test played through, every entry of
-- its list once, so that a WAV recorded alongside can be cut into one file
-- per sound (`npm run sound-test`) — named by what the game asked for,
-- nothing matched by likeness. The list's number is not the id: it runs
-- every effect, each fighter's voices, every spoken line (docs/rom.md).
--
-- Start Mesen's own audio recording to WAV first, then this script, on the
-- sound test's screen with the cursor on number 000. It plays the sounds
-- itself: A, waits until every voice has been quiet for half a second (or 8
-- seconds have passed: a sound that loops), → to the next number, waits for
-- the cursor's own sound to end too, and again, COUNT times. Every line is
-- written as it happens, so stopping it early loses nothing.
--
-- Output (logs/, gitignored):
--   dsp-sound-test.txt  each id asked for ($2141); every sounding voice a
--                       frame — sample, pitch, envelope; and the marks the
--                       cutter reads: "# a f<frame>" when A goes down,
--                       "# quiet f<frame>" on the first silent frame after

local LOG = "/Users/bkaaz/workspace/db-hd-remake/logs/dsp-sound-test.txt"
local FRAMES = 72000 -- twenty minutes: 120 sounds of 8 seconds each would take 16
-- the list's length: 44 effects, 10 fighters' 3 voices, 46 lines; it wraps after
local COUNT = 120
local HOLD = 4 -- frames a button is held, then as many let go
local QUIET = 30 -- frames with no voice sounding: the sound is over
local LONGEST = 480 -- a sound that loops is left after this many

local DSP = emu.memType.spcDspRegisters
if DSP == nil then
  emu.displayMessage("record-sound-test", "no SPC memory types in this Mesen")
  return
end

local log = assert(io.open(LOG, "w"))
log:write("# f<frame> sound <id> | f<frame> v<voice> env=<ENVX> pitch=<P> src=<SRCN> | # a f<frame> | # quiet f<frame>\n")
log:flush()

local frame, open = 0, true
local quiet = 0 -- frames in a row with no voice sounding

emu.addMemoryCallback(function(_, value)
  if not open or value == 0 then return end
  log:write(string.format("f%d sound %02x\n", frame, value))
end, emu.callbackType.write, 0x2141, 0x2141, emu.cpuType.snes)

local ref
ref = emu.addEventCallback(function()
  if not open then return end
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
  if frame == FRAMES then
    emu.removeEventCallback(ref, emu.eventType.endFrame)
    open = false
    log:close()
    emu.displayMessage("record-sound-test", "done")
  end
end, emu.eventType.endFrame)

emu.displayMessage("record-sound-test", "playing the sound test from the cursor")

-- the pad, played: A, wait for quiet, →, wait for quiet, A … (emu.setInput
-- only works while the game reads the pad, hence the inputPolled callback)
local played, step, since = 0, "settle", 0
local function set(buttons)
  if not pcall(emu.setInput, buttons, 0) then pcall(emu.setInput, 0, buttons) end
end
-- give a sound time to start, then wait for the quiet that ends it
local function over() return (since > 20 and quiet >= QUIET) or since >= LONGEST end

emu.addEventCallback(function()
  if not open or played >= COUNT then return end
  since = since + 1
  if step == "settle" then -- the cursor's sound, or anything left playing
    set({})
    if over() then step, since = "press", 0 end
  elseif step == "press" then
    if since == 1 then log:write(string.format("# a f%d\n", frame)) end
    set(since <= HOLD and { a = true } or {})
    if since >= 2 * HOLD then step, since = "wait", 0 end
  elseif step == "wait" then
    set({})
    if over() then
      -- a loop cut off is marked where it was left
      log:write(string.format("# quiet f%d\n", quiet > 0 and frame - quiet + 1 or frame))
      played = played + 1
      step, since = "next", 0
    end
  elseif step == "next" then
    set(since <= HOLD and { right = true } or {})
    if since >= 2 * HOLD then step, since = "settle", 0 end
  end
  if played >= COUNT then
    open = false
    log:close()
    emu.displayMessage("record-sound-test", "all " .. COUNT .. " played — stop the WAV, then the script")
  end
end, emu.eventType.inputPolled)
