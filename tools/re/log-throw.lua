-- Mesen 2 script: the throw (move 9d) and the thrown fighter's flight —
-- docs/bugs.md, "A thrown Goku may fly higher". Every frame either fighter
-- is in a move: both fighters' move, frame of the move (0x44), step (0x46),
-- world x / y, screen y (field 0x07), vy (8.8), and the camera's y ($0574).
-- The code says vy -8.0 and gravity 0.469 from the hold's (-32, -32); this
-- says what the screen shows, camera included.
--
-- Start it in a fight with both standing, walk up, throw (→ + X), let the
-- thrown one land and get up. Twice is better than once.
--
-- Output: logs/throw.txt (gitignored).

local OUT = "/Users/bkaaz/workspace/db-hd-remake/logs/throw.txt"
local FRAMES = 1200 -- twenty seconds
local P1, P2 = 0x100, 0x200 -- the fighter blocks in SA-1 I-RAM; fields: src/rom/cartridge.ts
local IRAM = emu.memType.sa1InternalRam

local log = assert(io.open(OUT, "w"))
log:write("# f<frame> | P1 move frame step x y sy vy | P2 move frame step x y sy vy | camera y\n")
local frame, open = 0, true

local function byte(at) return emu.read(at, IRAM) end
local function word(at) return byte(at) | (byte(at + 1) << 8) end
local function signed(w) return w >= 0x8000 and w - 0x10000 or w end

local function fighter(base)
  return string.format("%02x %3d %d x%4d y%4d sy%4d vy%6.2f",
    byte(base + 0x40), byte(base + 0x44), byte(base + 0x46),
    word(base + 0x20), signed(word(base + 0x23)), signed(word(base + 0x07)),
    signed(word(base + 0x7e)) / 256)
end

local ref
ref = emu.addEventCallback(function()
  frame = frame + 1
  if byte(P1 + 0x40) ~= 0 or byte(P2 + 0x40) ~= 0 then
    log:write(string.format("f%d | %s | %s | cam %d\n", frame, fighter(P1), fighter(P2), signed(word(0x574))))
  end
  if frame == FRAMES then
    emu.removeEventCallback(ref, emu.eventType.endFrame)
    open = false
    log:close()
    emu.displayMessage("log-throw", "done")
  end
end, emu.eventType.endFrame)

emu.displayMessage("log-throw", "recording " .. FRAMES .. " frames")
