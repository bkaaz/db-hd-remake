-- ============================ SETTINGS ============================
-- How long the whole recording lasts, in seconds.
local RECORD_SECONDS = 180

-- What player two does, top to bottom, then round again. To change it:
--   seconds = 0        switches a phase off (so does -- in front of its line)
--   move a line        changes the order
--   copy a line        adds a phase; pad takes up, down and back (back is away
--                      from player one, so it blocks), any of them together
-- All at 0: player two is left alone.
local SETTINGS_PHASES = {
  { name = "stands",     seconds = 5, pad = {} },
  { name = "blocks",     seconds = 5, pad = { back = true } },
  { name = "blocks low", seconds = 5, pad = { back = true, down = true } },
  { name = "jumps",      seconds = 5, pad = { up = true } },
}
-- ==================================================================

-- Mesen 2 script: all that can be asked of a stretch of a fight, in one file,
-- so a question about a move needs one recording and no choice of script.
-- Each frame anything happens: both fighters, the camera, the hitstop, the
-- sounds the game asks for, the sample each sounding voice plays, and the
-- object slots that changed. Light enough to run at full speed; every line is
-- flushed, so stopping the script early loses nothing.
--
-- Start it in a fight, do the thing, stop it (or let FRAMES run out).
--
-- In training it answers for player two's pad ($421B), yours left alone, so
-- one recording catches a move on
-- every kind of opponent: the settings' phases, round and round, each named on
-- screen and in the log as "# <phase>".
--
-- Output: logs/fight-<n>.txt (gitignored), the first free n: a recording is
-- never overwritten, the highest n is the newest.
--
-- A sound is the id written to the APU ($2141): player two's are shifted
-- ($0D:D852, +9 for the effects, +3 for the voices). Graphics are not here:
-- record-objects.lua keeps the VRAM an object's export needs.

local DIR = "/Users/bkaaz/workspace/db-hd-remake/logs/"
-- RUN stands before this file when `npm run original` plays a scenario: its
-- state, its pads and its length (tools/re/run.lua); nil from the Script Window
local FRAMES = RUN and RUN.frames or math.floor(RECORD_SECONDS * 60)
local P1, P2 = 0x100, 0x200 -- the fighter blocks in SA-1 I-RAM; fields: src/rom/cartridge.ts
local SLOTS, FIRST, SIZE = 10, 0x300, 0x10
local IRAM = emu.memType.sa1InternalRam
local DSP = emu.memType.spcDspRegisters

-- what is switched on, in frames
local PHASES = {}
for _, phase in ipairs(SETTINGS_PHASES) do
  if phase.seconds > 0 and not RUN then
    PHASES[#PHASES + 1] = { name = phase.name, frames = math.floor(phase.seconds * 60), pad = phase.pad }
  end
end

local function freeName()
  for n = 1, 9999 do
    local path = string.format("%sfight-%d.txt", DIR, n)
    local taken = io.open(path, "r")
    if not taken then return path end
    taken:close()
  end
end

local path = RUN and RUN.out or freeName()
local log = assert(io.open(path, "w"))
log:setvbuf("line")
log:write("# f<frame> hit=<$30B2> cam=<x>,<y> (8.8)\n")
log:write("#   P1|P2 move frame step drawing x y sy vx vy face=<0x12> hp=<0x60> stun=<0x68> f25=<0x25> f96=<0x96>\n")
log:write("#   sound <ids written to $2141>; voices <src of each sounding voice>; effects <$30BA | $30CA>; slot <n>: <its 16 bytes>\n")

local function byte(at) return emu.read(at, IRAM) end
local function word(at) return byte(at) | (byte(at + 1) << 8) end
local function signed(w) return w >= 0x8000 and w - 0x10000 or w end

local function fighter(name, base)
  return string.format("  %s %02x %3d %2d d%03x x%4d y%4d sy%4d vx%6.2f vy%6.2f face=%02x hp=%d stun=%d f25=%02x f96=%02x",
    name, byte(base + 0x40), byte(base + 0x44), byte(base + 0x46), word(base + 0x0a),
    word(base + 0x20), signed(word(base + 0x23)), signed(word(base + 0x07)),
    signed(word(base + 0x7c)) / 256, signed(word(base + 0x7e)) / 256,
    byte(base + 0x12), byte(base + 0x60), byte(base + 0x68), byte(base + 0x25), byte(base + 0x96))
end

local function slot(i)
  local out = {}
  for b = 0, SIZE - 1 do out[#out + 1] = string.format("%02x", byte(FIRST + i * SIZE + b)) end
  return table.concat(out, " ")
end

-- the drawn effects' blocks at $30BA / $30CA, a side each: kind, x, y, right x, size (docs/rom.md)
local function effects()
  local out = {}
  for _, at in ipairs({ 0x0ba, 0x0ca }) do
    for b = 0, 0x0b do out[#out + 1] = string.format("%02x", byte(at + b)) end
    out[#out + 1] = "|"
  end
  return table.concat(out, " ")
end

local function voices()
  if DSP == nil then return "" end
  local out = {}
  for v = 0, 7 do
    if emu.read(v * 0x10 + 0x08, DSP) > 0 then
      out[#out + 1] = string.format("%d:%02x", v, emu.read(v * 0x10 + 0x04, DSP))
    end
  end
  return table.concat(out, " ")
end

local frame, open, sounds, slots, heard, drawn = 0, true, {}, {}, "", ""

emu.addMemoryCallback(function(_, value)
  if open and value ~= 0 then sounds[#sounds + 1] = string.format("%02x", value) end
end, emu.callbackType.write, 0x2141, 0x2141, emu.cpuType.snes)

local phase, left = 0, 0

local function nextPhase()
  phase = phase % #PHASES + 1
  left = PHASES[phase].frames
  log:write("# " .. PHASES[phase].name .. "\n")
  emu.displayMessage("P2", PHASES[phase].name)
end

-- $421B, the high byte of pad two's auto-read: up 08, down 04, left 02, right
-- 01 — "back" is away from player one, whichever side he is on
local function padByte(wanted)
  local onRight = word(P2 + 0x20) >= word(P1 + 0x20)
  return (wanted.up and 0x08 or 0) | (wanted.down and 0x04 or 0)
    | (wanted.back and (onRight and 0x01 or 0x02) or 0)
end

-- What the game reads is answered here, not played through emu.setInput: that
-- needs a controller in port 2, and with none it took player one's pad.
if #PHASES > 0 then
  emu.addMemoryCallback(function()
    if open and phase > 0 then return padByte(PHASES[phase].pad) end
  end, emu.callbackType.read, 0x421b, 0x421b, emu.cpuType.snes)
end

local ref
ref = emu.addEventCallback(function()
  if RUN and not RUN.frame() then return end
  frame = frame + 1
  if #PHASES > 0 then
    if left == 0 then nextPhase() end
    left = left - 1
  end
  local lines = {}
  if #sounds > 0 then
    lines[#lines + 1] = "  sound " .. table.concat(sounds, " ")
    sounds = {}
  end
  local now = voices()
  if now ~= heard then
    lines[#lines + 1] = "  voices " .. now
    heard = now
  end
  local fx = effects()
  if fx ~= drawn then
    lines[#lines + 1] = "  effects " .. fx
    drawn = fx
  end
  for i = 0, SLOTS - 1 do
    local bytes = slot(i)
    if bytes ~= slots[i] then
      lines[#lines + 1] = string.format("  slot %d: %s", i, bytes)
      slots[i] = bytes
    end
  end
  if #lines > 0 or byte(P1 + 0x40) ~= 0 or byte(P2 + 0x40) ~= 0 then
    log:write(string.format("f%d hit=%02x cam=%d,%d\n", frame, byte(0x0b2), word(0x570), signed(word(0x574))))
    log:write(fighter("P1", P1) .. "\n" .. fighter("P2", P2) .. "\n")
    if #lines > 0 then log:write(table.concat(lines, "\n") .. "\n") end
  end
  if frame == FRAMES then
    emu.removeEventCallback(ref, emu.eventType.endFrame)
    open = false
    log:close()
    emu.displayMessage("record-fight", "done: " .. path)
    if RUN then emu.stop(0) end
  end
end, emu.eventType.endFrame)

emu.displayMessage("record-fight", "recording into " .. path)
