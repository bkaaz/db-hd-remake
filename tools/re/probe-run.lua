-- Mesen 2 test runner, no window: load a save state, press Y for player one,
-- log both fighters, stop. A probe of whether the original can be driven
-- from a terminal:
--   Mesen --testRunner <rom> tools/re/probe-run.lua --timeout=60

local DIR = "/Users/bkaaz/workspace/db-hd-remake/"
local STATE = DIR .. "raw/states/gotenks-vegetto.mss"
local P1, P2 = 0x100, 0x200 -- the fighter blocks in SA-1 I-RAM; fields: src/rom/cartridge.ts
local IRAM = emu.memType.sa1InternalRam
local PRESS, HOLD, LAST = 30, 3, 150

local log = assert(io.open(DIR .. "logs/probe-run.txt", "w"))
log:setvbuf("line")

local function byte(at) return emu.read(at, IRAM) end
local function word(at) return byte(at) | (byte(at + 1) << 8) end
local function fighter(base)
  return string.format("move %02x frame %3d step %2d x %4d hp %d", byte(base + 0x40), byte(base + 0x44), byte(base + 0x46), word(base + 0x20), byte(base + 0x60))
end

local frame, loaded = 0, false

-- $4219, the high byte of pad one's auto-read: Y is 40
emu.addMemoryCallback(function()
  if loaded and frame >= PRESS and frame < PRESS + HOLD then return 0x40 end
end, emu.callbackType.read, 0x4219, 0x4219, emu.cpuType.snes)

-- a state loads only from an exec callback ("must be called inside an exec memory operation callback")
local exec
exec = emu.addMemoryCallback(function()
  if loaded then return end
  local file = assert(io.open(STATE, "rb"))
  local state = file:read("a")
  file:close()
  local ok, err = pcall(emu.loadSavestate, state)
  log:write(string.format("# state %d bytes, loaded: %s %s\n", #state, tostring(ok), tostring(err)))
  loaded = true
end, emu.callbackType.exec, 0x000000, 0xffffff, emu.cpuType.snes)

emu.addEventCallback(function()
  if not loaded then return end
  frame = frame + 1
  log:write(string.format("f%d P1 %s | P2 %s\n", frame, fighter(P1), fighter(P2)))
  if frame >= LAST then
    log:close()
    emu.stop(0)
  end
end, emu.eventType.endFrame)
