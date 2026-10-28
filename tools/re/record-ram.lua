-- Mesen 2 script: snapshots every RAM region, once per frame, together with
-- the pad state, so an address can be found by correlating it with what was
-- pressed instead of by guessing in a memory search.
--
-- SA-1 game: fight state may live in the coprocessor's I-RAM or BW-RAM rather
-- than in WRAM, so all of them are recorded.
--
-- Output (logs/, gitignored):
--   ram.txt  the memory types Mesen offers, and the regions recorded
--   ram.bin  per frame: u32 frame, u16 pad bits, then each region in order

local OUT = "/Users/bkaaz/workspace/db-hd-remake/logs/ram"
local FRAMES = 1200

local CANDIDATES = { "snesWorkRam", "sa1InternalRam", "snesSaveRam", "snesSpriteRam" }
local BUTTONS = { "a", "b", "x", "y", "l", "r", "up", "down", "left", "right", "start", "select" }

local txt = assert(io.open(OUT .. ".txt", "w"))
local bin = assert(io.open(OUT .. ".bin", "wb"))

txt:write("memTypes:\n")
for name, _ in pairs(emu.memType) do txt:write("  " .. name .. "\n") end

local regions = {}
for _, name in ipairs(CANDIDATES) do
  local mt = emu.memType[name]
  local ok, size = pcall(emu.getMemorySize, mt)
  if mt ~= nil and ok and size > 0 then
    table.insert(regions, { name = name, type = mt, size = size })
    txt:write(string.format("region %s %d\n", name, size))
  else
    txt:write("missing " .. name .. "\n")
  end
end
txt:write("buttons " .. table.concat(BUTTONS, ",") .. "\n")
txt:flush()

local function padBits()
  local ok, pad = pcall(emu.getInput, 0)
  if not ok or pad == nil then return 0xFFFF end
  local bits = 0
  for i, b in ipairs(BUTTONS) do
    if pad[b] then bits = bits | (1 << (i - 1)) end
  end
  return bits
end

local function dump(region)
  local bytes, chunks = {}, {}
  for addr = 0, region.size - 1 do
    bytes[#bytes + 1] = emu.read(addr, region.type)
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
  bin:write(string.pack("<I4I2", frame, padBits()))
  for _, region in ipairs(regions) do bin:write(dump(region)) end
  frame = frame + 1
  if frame == FRAMES then
    emu.removeEventCallback(ref, emu.eventType.endFrame)
    bin:close()
    txt:write("frames " .. frame .. "\n")
    txt:close()
    emu.displayMessage("record-ram", "done: " .. frame .. " frames")
  end
end, emu.eventType.endFrame)

emu.displayMessage("record-ram", "recording " .. FRAMES .. " frames")
