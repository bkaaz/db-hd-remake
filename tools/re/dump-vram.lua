-- Mesen 2 script: every few frames, a snapshot of VRAM, CGRAM (palettes) and
-- OAM, with player one's move, drawing and tile set — so every tile on screen
-- can be matched against the cartridge's resources instead of guessing which
-- one a spawned object draws from.
--
-- Output (logs/, gitignored):
--   vram.bin  per snapshot: u32 frame, u8 move, u8 drawing, u8 tile set, u8 0,
--             then VRAM (64 KiB), CGRAM (512 B), OAM (544 B)

local OUT = "/Users/bkaaz/workspace/db-hd-remake/logs/vram.bin"
local FRAMES = 3600 -- one minute: the pre-fight transformation, then a fight
local EVERY = 15
local BASE = 0x100 -- player one in SA-1 I-RAM; fields: src/rom/cartridge.ts

local REGIONS = {
  { emu.memType.snesVideoRam, 0x10000 },
  { emu.memType.snesCgRam, 0x200 },
  { emu.memType.snesSpriteRam, 0x220 },
}

local bin = assert(io.open(OUT, "wb"))
local frame, taken = 0, 0

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

local function field(f) return emu.read(BASE + f, emu.memType.sa1InternalRam) end

local ref
ref = emu.addEventCallback(function()
  frame = frame + 1
  if frame % EVERY == 0 then
    bin:write(string.pack("<I4BBBB", frame, field(0x40), field(0x0a), field(0x90), 0))
    for _, r in ipairs(REGIONS) do bin:write(dump(r[1], r[2])) end
    taken = taken + 1
  end
  if frame == FRAMES then
    emu.removeEventCallback(ref, emu.eventType.endFrame)
    bin:close()
    emu.displayMessage("dump-vram", "done: " .. taken .. " snapshots")
  end
end, emu.eventType.endFrame)

emu.displayMessage("dump-vram", "snapshot every " .. EVERY .. " frames for " .. FRAMES)
