-- Mesen 2 script: one line whenever either fighter's move, step, health or
-- stun changes, with the fields the hit code at $0D:D189 reads and writes
-- (docs/rom.md, Hit data) — what a blow really cost, and what the defender
-- was sent into. Light, like log-moves.lua: the game runs at speed.
--
-- Start it before the round starts, so the first line holds the starting
-- health. Every line is flushed, so stopping the script early loses nothing.
--
-- Output: logs/hits.txt (gitignored).

local OUT = "/Users/bkaaz/workspace/db-hd-remake/logs/hits.txt"
local FRAMES = 7200 -- two minutes
local SIDES = { { name = "p1", base = 0x100 }, { name = "p2", base = 0x200 } }
local IRAM = emu.memType.sa1InternalRam
local WRAM = emu.memType.snesWorkRam

local log = assert(io.open(OUT, "w"))

local function byte(mt, a) return emu.read(a, mt) end
local function word(mt, a)
  local v = byte(mt, a) | (byte(mt, a + 1) << 8)
  return v >= 0x8000 and v - 0x10000 or v
end
local function f8(side, f) return byte(IRAM, side.base + f) end
local function f16(side, f) return word(IRAM, side.base + f) end

-- Fields by offset in the fighter block: src/rom/cartridge.ts, docs/rom.md.
local function key(s)
  return string.format("move=%02x step=%02x hp=%d e62=%d e64=%d stun=%d",
    f8(s, 0x40), f8(s, 0x46), f16(s, 0x60), f16(s, 0x62), f16(s, 0x64), f16(s, 0x68))
end

local function detail(s)
  return string.format("%s dmg=%d by=%02x/%02x atk=%d def=%d r8c=%d vx=%d vy=%d y23=%d f97=%02x",
    key(s), f16(s, 0x78), f8(s, 0x92), f8(s, 0x93), f8(s, 0x6a), f8(s, 0x6b),
    f16(s, 0x8c), f16(s, 0x7c), f16(s, 0x7e), f16(s, 0x23), f8(s, 0x97))
end

log:write(string.format("mode 1a02=%02x 0552=%02x 1b15=%02x  health option p1=%d p2=%d\n",
  byte(WRAM, 0x1a02), byte(WRAM, 0x0552), byte(WRAM, 0x1b15),
  word(WRAM, 0x1ac9), word(WRAM, 0x1acf)))
for _, s in ipairs(SIDES) do
  log:write(string.format("start %s char=%02x max=%d %s\n", s.name, f8(s, 0x00), f16(s, 0x62), detail(s)))
end
log:flush()

local frame, last = 0, {}
local ref
ref = emu.addEventCallback(function()
  frame = frame + 1
  for _, s in ipairs(SIDES) do
    local now = key(s)
    if now ~= last[s.name] then
      log:write(string.format("f%d %s %s hitstop=%02x\n", frame, s.name, detail(s), byte(IRAM, 0xb2)))
      last[s.name] = now
      log:flush()
    end
  end
  if frame == FRAMES then
    emu.removeEventCallback(ref, emu.eventType.endFrame)
    log:close()
    emu.displayMessage("log-hits", "done")
  end
end, emu.eventType.endFrame)

emu.displayMessage("log-hits", "logging " .. FRAMES .. " frames")
