import type { FighterName } from "./roster";

/**
 * What each move of a fighter is called: the FAQ's names (owner, 2026-11-04),
 * matched to his command table by their input. A move with no name here is
 * `move_<id>`, for a move the FAQ leaves out. The X commands `9f`, `a0`, `a1`
 * are everyone's and named once.
 */
const SENDERS = { "9f": "sender_9f", a0: "sender_a0", a1: "sender_a1", "9d": "throw" };

export const MOVE_NAMES: Partial<Record<FighterName, Record<string, string>>> = {
  gotenks: {
    ...SENDERS, af: "ultra_headbutt", a5: "sliding_headbutt", a7: "omaenanka", b4: "rolling_thunder", a8: "wild_boar",
    b3: "aerial_kantsu", ab: "renzoku", bd: "ultra_renzoku", ac: "kikoha", ad: "ghost_kamikaze", ae: "volleyball", b0: "air_dive",
  },
  vegetto: {
    ...SENDERS, aa: "shooting_kick", "9e": "forward_kick", a5: "geri_combo", a7: "elbow_dash", a8: "slashdown_kick",
    ad: "kakusan", a4: "aerial_kick", af: "big_bang", ae: "final_kame", b0: "galactic_juggle",
  },
  piccolo: {
    ...SENDERS, "9e": "sonic_kick", a5: "high_mystic", ab: "high_counter", ae: "low_mystic", b4: "low_counter", b7: "regeneration",
    be: "bukuuh_kyaku", b9: "shocking_stunner", bb: "yuudoh", bd: "gekiretsudokan", bc: "beam_cannon", a2: "aerial_assault",
  },
  freeza: {
    ...SENDERS, a4: "double_leg_kick", a8: "kienzan", a6: "evil_energy", a9: "freeza_slash", aa: "explosive_grab", ad: "jasenkoh",
    a5: "kishin_ha", a7: "ground_wave", ab: "death_ball", ac: "jubaku_ha", af: "flaming_headbutt",
  },
  cell: {
    ...SENDERS, a2: "giga_shoulder", a7: "ki_flame", a5: "energy_burst", a6: "psychic_lift", a8: "cell_junior", a9: "negative_arrow",
    "9e": "kantsu", a4: "suki_combo", ab: "kamehameha", aa: "chou_kamehameha", ad: "tri_eruption", ac: "bakuretsu_rush",
  },
  mr_buu: {
    ...SENDERS, ad: "flying_bomber", a8: "planet_attack", aa: "rolling_tackle", ac: "powersault", a4: "tornado_hip", "9e": "butt_drop",
    a5: "oyatsu_kosen", ab: "kakusan", af: "energy_field", ae: "mightiness_bomber", b0: "buu_breath",
  },
  buu: {
    ...SENDERS, b6: "matamol", a8: "extension_punch", a9: "floater", d1: "horizontal_blast", d2: "slashdown_blast", b1: "whip",
    b2: "disk_tackle", af: "earth_stab", b0: "earth_stab_again", b5: "kantsu", b3: "buu_burn", b4: "energy_sphere", b7: "putty_uppercut",
  },
};
