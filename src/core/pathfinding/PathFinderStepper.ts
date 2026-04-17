import type { PathResult } from "./PathResult.js";

/**
 * Function type for a pathfinder that takes (from, to) and returns a PathResult.
 */
export type PathFn = (from: number, to: number) => PathResult;

/**
 * Incremental path-walking wrapper.
 * Caches a computed path and allows stepping along it node by node.
 * Revalidates when the destination changes.
 * Supports early exit when within a configurable distance of the goal.
 */
export class PathFinderStepper {
  private pathFn: PathFn;
  private cachedPath: number[] = [];
  private cachedDest = -1;
  private stepIndex = 0;
  private _earlyExitDistance: number;

  /**
   * @param pathFn  the underlying pathfinder function
   * @param earlyExitDistance  if > 0, stop stepping when within this many hops of the goal
   */
  constructor(pathFn: PathFn, earlyExitDistance = 0) {
    this.pathFn = pathFn;
    this._earlyExitDistance = earlyExitDistance;
  }

  /** Get the current cached path. */
  get path(): number[] {
    return this.cachedPath;
  }

  /** Get the current step index. */
  get currentStep(): number {
    return this.stepIndex;
  }

  /** Get the current node (where the stepper is now). Returns -1 if no path. */
  get currentNode(): number {
    if (this.cachedPath.length === 0) return -1;
    return this.cachedPath[Math.min(this.stepIndex, this.cachedPath.length - 1)];
  }

  /** Whether the stepper has reached the end of the path (or within earlyExitDistance). */
  get arrived(): boolean {
    if (this.cachedPath.length === 0) return false;
    const remaining = this.cachedPath.length - 1 - this.stepIndex;
    return remaining <= this._earlyExitDistance;
  }

  /**
   * Compute or reuse a path from `from` to `to`.
   * If `to` changed, recomputes.
   * Returns the PathResult.
   */
  plan(from: number, to: number): PathResult {
    if (to !== this.cachedDest || this.cachedPath.length === 0) {
      const result = this.pathFn(from, to);
      this.cachedPath = result.path;
      this.cachedDest = to;
      this.stepIndex = 0;
      return result;
    }
    return {
      path: this.cachedPath,
      cost: 0,
      found: this.cachedPath.length > 0,
      iterations: 0,
    };
  }

  /**
   * Advance one step along the cached path.
   * Returns the next node, or -1 if already at the end.
   */
  step(): number {
    if (this.cachedPath.length === 0) return -1;
    if (this.arrived) return this.currentNode;
    this.stepIndex++;
    return this.currentNode;
  }

  /** Reset the stepper, clearing cached path. */
  invalidate(): void {
    this.cachedPath = [];
    this.cachedDest = -1;
    this.stepIndex = 0;
  }

  /** Update the early exit distance. */
  set earlyExitDistance(d: number) {
    this._earlyExitDistance = d;
  }

  get earlyExitDistance(): number {
    return this._earlyExitDistance;
  }
}
