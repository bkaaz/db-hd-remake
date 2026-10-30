-- Mesen 2 script: what the sound driver does with a sound the game asks for
-- again and again — charging's `19`, every 8 frames (docs/rom.md, Charging
-- ki refills health). Each frame it reads the DSP's registers and writes a
-- line for every voice that is sounding: its envelope (ENVX, $x8), pitch
-- ($x2/$x3) and sample ($x4); and a line per sound the game asks for
-- ($2141). A voice whose envelope drops and climbs again at each request is
-- restarted; one that decays through them is not; a pitch that moves is
-- bent.
--
-- Start it in a fight, charge (Y + B) for a few seconds, let go.
--
-- Output: logs/dsp.txt (gitignored).

local OUT = "/Users/bkaaz/workspace/db-hd-remake/logs/dsp.txt"
local FRAMES = 600 -- ten seconds

local log = assert(io.open(OUT, "w"))
local DSP = emu.memType.spcDspRegisters
if DSP == nil then
  -- the name differs in this Mesen: say which there are, and stop
  local names = {}
  for name in pairs(emu.memType) do names[#names + 1] = name end
  table.sort(names)
  log:write("# no emu.memType.spcDspRegisters — these exist:\n# " .. table.concat(names, " ") .. "\n")
  log:close()
  emu.displayMessage("log-dsp", "no DSP memory type — see logs/dsp.txt")
  return
end

log:write("# f<frame> sound <id> | f<frame> v<voice> env=<ENVX> pitch=<P> src=<SRCN>\n")
local frame, open = 0, true

emu.addMemoryCallback(function(_, value)
  if open and value ~= 0 then log:write(string.format("f%d sound %02x\n", frame, value)) end
end, emu.callbackType.write, 0x2141, 0x2141, emu.cpuType.snes)

local ref
ref = emu.addEventCallback(function()
  frame = frame + 1
  for v = 0, 7 do
    local base = v * 0x10
    local env = emu.read(base + 0x08, DSP)
    if env > 0 then
      local pitch = emu.read(base + 0x02, DSP) | (emu.read(base + 0x03, DSP) << 8)
      log:write(string.format("f%d v%d env=%d pitch=%04x src=%02x\n", frame, v, env, pitch, emu.read(base + 0x04, DSP)))
    end
  end
  if frame == FRAMES then
    emu.removeEventCallback(ref, emu.eventType.endFrame)
    open = false
    log:close()
    emu.displayMessage("log-dsp", "done")
  end
end, emu.eventType.endFrame)

emu.displayMessage("log-dsp", "recording " .. FRAMES .. " frames")
