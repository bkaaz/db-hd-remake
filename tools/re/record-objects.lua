-- Mesen 2 script: everything a fighter's objects show, for `npm run rom --
-- objects` to turn into spawns (ADR 0036) — one long recording per fighter,
-- in training: each attack that puts out an object, once into the air and
-- once into the opponent, every variant `npm run rom -- spawns` lists.
--
--   logs/objects-rec.txt  a line for every frame in which a slot, either
--                         player's move or the hitstop ($30B2) changes: the
--                         ten 16-byte slots at SA-1 I-RAM $3300 that changed
--   logs/objects-rec.bin  a snapshot the first time each object (type,
--                         animation, frame shown) is on screen — two frames
--                         after its slot shows it, as OAM draws it a frame
--                         late (2026-10-31): u32 frame,
--                         u8 slot, then the slot's 16 bytes, VRAM (64 KiB),
--                         CGRAM (512 B), OAM (544 B) — its tiles and palette
--
-- Both gitignored. Light enough to run at full speed.

local DIR = "/Users/bkaaz/workspace/db-hd-remake/logs/"
local FRAMES = 10800 -- three minutes
local FIRST, SLOTS, SIZE = 0x300, 10, 0x10
local IRAM = emu.memType.sa1InternalRam
local REGIONS = {
  { emu.memType.snesVideoRam, 0x10000 },
  { emu.memType.snesCgRam, 0x200 },
  { emu.memType.snesSpriteRam, 0x220 },
}

local log = assert(io.open(DIR .. "objects-rec.txt", "w"))
local bin = assert(io.open(DIR .. "objects-rec.bin", "wb"))
log:write("# f<frame> p1=<move> p2=<move> hit=<$30B2>, then the slots that changed:\n")
log:write("# 00 type (bit 7: alive), 01 animation, 02 frame shown, 03 tile base, 04 attributes,\n")
log:write("# 05-07 x, 08-0a y (8.16), 0b timer, 0c-0d vx, 0e-0f vy (8.8)\n")

local frame, last, seen, taken, head = 0, {}, {}, 0, ""
-- snapshots waiting for OAM to catch up: slot, key and the frame to take it on
local due = {}
local LATE = 2

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

local function slotBytes(i)
  local bytes = {}
  for b = 0, SIZE - 1 do bytes[#bytes + 1] = emu.read(FIRST + i * SIZE + b, IRAM) end
  return bytes
end

local function hex(bytes)
  local out = {}
  for _, b in ipairs(bytes) do out[#out + 1] = string.format("%02x", b) end
  return table.concat(out, " ")
end

local ref
ref = emu.addEventCallback(function()
  frame = frame + 1
  local lines = {}
  for i = 0, SLOTS - 1 do
    local bytes = slotBytes(i)
    local now = hex(bytes)
    if now ~= last[i] then
      lines[#lines + 1] = string.format("  slot %d: %s", i, now)
      last[i] = now
    end
    -- alive, and not drawn before as this type (byte 0's low nibble, $0D:EBE0),
    -- animation and frame: taken LATE frames on, if the slot still shows it
    local key = string.format("%02x/%02x/%02x", bytes[1] & 0x0f, bytes[2], bytes[3])
    if bytes[1] & 0x80 ~= 0 and not seen[key] then
      seen[key] = true
      due[#due + 1] = { slot = i, key = key, at = frame + LATE }
    end
  end
  for n = #due, 1, -1 do
    local d = due[n]
    if frame >= d.at then
      table.remove(due, n)
      local bytes = slotBytes(d.slot)
      if string.format("%02x/%02x/%02x", bytes[1] & 0x0f, bytes[2], bytes[3]) == d.key then
        bin:write(string.pack("<I4B", frame, d.slot), string.char(table.unpack(bytes)))
        for _, r in ipairs(REGIONS) do bin:write(dump(r[1], r[2])) end
        taken = taken + 1
      else
        seen[d.key] = nil -- gone or changed before it was drawn: try again next time
      end
    end
  end
  local now = string.format("p1=%02x p2=%02x hit=%02x", emu.read(0x140, IRAM), emu.read(0x240, IRAM), emu.read(0x0b2, IRAM))
  if #lines > 0 or now ~= head then
    log:write(string.format("f%d %s\n", frame, now))
    if #lines > 0 then log:write(table.concat(lines, "\n") .. "\n") end
    head = now
  end
  if frame == FRAMES then
    emu.removeEventCallback(ref, emu.eventType.endFrame)
    log:close()
    bin:close()
    emu.displayMessage("record-objects", "done: " .. taken .. " snapshots")
  end
end, emu.eventType.endFrame)

emu.displayMessage("record-objects", "recording " .. FRAMES .. " frames")
