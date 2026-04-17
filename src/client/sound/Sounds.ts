// ---------------------------------------------------------------------------
// Sound asset URL definitions
// ---------------------------------------------------------------------------

export const Sounds = {
  ambient_space: "/assets/audio/ambient_space.ogg",
  laser_impact: "/assets/audio/laser_impact.ogg",
  shield_crackle: "/assets/audio/shield_crackle.ogg",
  warp_whoosh: "/assets/audio/warp_whoosh.ogg",
  nova_charge: "/assets/audio/nova_charge.ogg",
  nova_detonation: "/assets/audio/nova_detonation.ogg",
  ui_click: "/assets/audio/ui_click.ogg",
  ui_whoosh: "/assets/audio/ui_whoosh.ogg",
} as const;

export type SoundId = keyof typeof Sounds;
