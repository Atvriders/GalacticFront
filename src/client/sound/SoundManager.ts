// ---------------------------------------------------------------------------
// SoundManager – stub for audio playback
// ---------------------------------------------------------------------------

import { SoundId } from "./Sounds.js";

export type SoundCategory = "music" | "sfx";

export class SoundManager {
  private volumes: Record<SoundCategory, number> = {
    music: 1,
    sfx: 1,
  };

  play(_soundId: SoundId): void {
    // stub – will be wired to Howler in a later pass
  }

  setVolume(category: SoundCategory, level: number): void {
    this.volumes[category] = Math.max(0, Math.min(1, level));
  }

  getVolume(category: SoundCategory): number {
    return this.volumes[category];
  }

  dispose(): void {
    // stub – will release Howler instances
  }
}
