import type { PathTransformer } from "./PathTransformer";
import type { PathResult } from "./PathResult";
import type { PathFn } from "./PathFinderStepper";

/**
 * Fluent builder for composing path transformers around a base pathfinder.
 *
 * Transformers are run in order. The first transformer whose preCheck returns
 * a PathResult short-circuits (that result is returned without running the base pathfinder).
 * If no transformer blocks, the base pathfinder runs normally.
 */
export class PathFinderBuilder {
  private transformers: PathTransformer[] = [];
  private baseFn: PathFn;

  constructor(baseFn: PathFn) {
    this.baseFn = baseFn;
  }

  /** Add a transformer to the pipeline. Returns `this` for chaining. */
  addTransformer(t: PathTransformer): PathFinderBuilder {
    this.transformers.push(t);
    return this;
  }

  /** Remove a transformer by name. Returns `this` for chaining. */
  removeTransformer(name: string): PathFinderBuilder {
    this.transformers = this.transformers.filter((t) => t.name !== name);
    return this;
  }

  /** Get current transformer names (for inspection). */
  get transformerNames(): string[] {
    return this.transformers.map((t) => t.name);
  }

  /**
   * Build the final path function.
   * Runs transformers in order; first blocker wins.
   * If no transformer blocks, runs the base pathfinder.
   */
  build(): PathFn {
    const transformers = [...this.transformers]; // snapshot
    const base = this.baseFn;

    return (from: number, to: number): PathResult => {
      for (const t of transformers) {
        const result = t.preCheck(from, to);
        if (result !== null) {
          return result;
        }
      }
      return base(from, to);
    };
  }
}
