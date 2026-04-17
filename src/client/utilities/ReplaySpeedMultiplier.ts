// ---------------------------------------------------------------------------
// ReplaySpeedMultiplier – tick-delay multipliers for replay playback
// ---------------------------------------------------------------------------

export enum ReplaySpeedMultiplier {
  Slow = 2,
  Normal = 1,
  Fast = 0.5,
  Fastest = 0,
}

export const DEFAULT_REPLAY_SPEED = ReplaySpeedMultiplier.Normal;
