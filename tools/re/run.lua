-- What `npm run original` puts before record-fight.lua, after its RUN table:
-- the save state loaded, and both pads answered from the scenario, one entry
-- a frame. The timeline stands still through a hit pause, as the debug dummy's
-- does, so a scenario means the same thing in both games.

do
  local P = { 0x100, 0x200 } -- the fighter blocks in SA-1 I-RAM; fields: src/rom/cartridge.ts
  local HEALTH, X = 0x60, 0x20
  local IRAM = emu.memType.sa1InternalRam
  local SNES = emu.cpuType.snes
  local START, LAST = 0x000000, 0xffffff

  local function byte(at) return emu.read(at, IRAM) end
  local function word(at) return byte(at) | (byte(at + 1) << 8) end

  local at, loaded, exec = 1, false, nil

  -- a state loads only from an exec callback, and the pads are answered from then on
  exec = emu.addMemoryCallback(function()
    if loaded then return end
    local file = assert(io.open(RUN.state, "rb"))
    local state = file:read("a")
    file:close()
    emu.loadSavestate(state)
    loaded = true
  end, emu.callbackType.exec, START, LAST, SNES)

  -- the high byte of a pad's auto-read, with fwd and back turned into left and right
  local function high(side)
    local entry = RUN.pads[side][at]
    if not entry then return 0 end
    local me, other = P[side], P[3 - side]
    local toRight = word(me + X) < word(other + X)
    local fwd, back = toRight and 0x01 or 0x02, toRight and 0x02 or 0x01
    return entry[1] | (entry[3] > 0 and fwd or 0) | (entry[3] < 0 and back or 0)
  end

  local function low(side)
    local entry = RUN.pads[side][at]
    return entry and entry[2] or 0
  end

  for side, address in ipairs({ 0x4218, 0x421a }) do
    emu.addMemoryCallback(function() if loaded then return low(side) end end, emu.callbackType.read, address, address, SNES)
    emu.addMemoryCallback(function() if loaded then return high(side) end end, emu.callbackType.read, address + 1, address + 1, SNES)
  end

  -- the screen as a PNG, on the frames the scenario asks for
  local count = 0
  local function shoot()
    count = count + 1
    if not RUN.shots[count] then return end
    local file = assert(io.open(string.format("%s-f%d.png", RUN.shotsAt, count), "wb"))
    file:write(emu.takeScreenshot())
    file:close()
  end

  -- once a frame: false until the state is in; its health set, and the timeline on
  local poked, was, stood = false, nil, 0
  function RUN.frame()
    if not loaded then return false end
    shoot()
    if exec then
      emu.removeMemoryCallback(exec, emu.callbackType.exec, START, LAST, SNES)
      exec = nil
    end
    -- a fight's opening kept as a state of its own: a later run starts here, not at the roster
    if RUN.saveAt == count then
      local keep
      keep = emu.addMemoryCallback(function()
        if not keep then return end
        local file = assert(io.open(RUN.saveTo, "wb"))
        file:write(emu.createSavestate())
        file:close()
        emu.removeMemoryCallback(keep, emu.callbackType.exec, START, LAST, SNES)
        keep = nil
      end, emu.callbackType.exec, START, LAST, SNES)
    end
    if not poked and count >= RUN.healthAt then
      for side, hp in pairs(RUN.health) do
        emu.write(P[side] + HEALTH, hp & 0xff, IRAM)
        emu.write(P[side] + HEALTH + 1, hp >> 8, IRAM)
      end
      poked = true
    end
    -- a frame the game had no time for (the SA-1 slows it) moves nothing: the timeline waits with it,
    -- or a press held for 30 frames would last fewer of the game's than the dummy's
    local now = word(P[1] + 0x44) .. "," .. word(P[2] + 0x44) .. "," .. word(P[1] + X) .. "," .. word(P[2] + X)
    local lag = now == was and stood < 4
    stood = lag and stood + 1 or 0
    was = now
    if not lag and (RUN.free or byte(0x0b2) == 0) then at = at + 1 end
    return true
  end
end

