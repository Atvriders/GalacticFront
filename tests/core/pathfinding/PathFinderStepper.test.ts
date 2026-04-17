import { describe, it, expect } from "vitest";
import { PathFinderStepper, PathFn } from "@core/pathfinding/PathFinderStepper";
import type { PathResult } from "@core/pathfinding/PathResult";

function makeSimplePathFn(): PathFn {
  return (from: number, to: number): PathResult => {
    // Simple linear path from..to
    const path: number[] = [];
    if (from <= to) {
      for (let i = from; i <= to; i++) path.push(i);
    } else {
      for (let i = from; i >= to; i--) path.push(i);
    }
    return { path, cost: Math.abs(to - from), found: true, iterations: 1 };
  };
}

describe("PathFinderStepper", () => {
  it("plans and steps through a path", () => {
    const stepper = new PathFinderStepper(makeSimplePathFn());
    const result = stepper.plan(0, 4);
    expect(result.found).toBe(true);
    expect(stepper.path).toEqual([0, 1, 2, 3, 4]);
    expect(stepper.currentNode).toBe(0);

    expect(stepper.step()).toBe(1);
    expect(stepper.step()).toBe(2);
    expect(stepper.step()).toBe(3);
    expect(stepper.step()).toBe(4);
    expect(stepper.arrived).toBe(true);
  });

  it("caches path when destination unchanged", () => {
    let callCount = 0;
    const fn: PathFn = (from, to) => {
      callCount++;
      const path = [from, from + 1, to];
      return { path, cost: 2, found: true, iterations: 1 };
    };
    const stepper = new PathFinderStepper(fn);
    stepper.plan(0, 5);
    expect(callCount).toBe(1);
    stepper.plan(0, 5); // same dest, should not re-call
    expect(callCount).toBe(1);
  });

  it("recomputes when destination changes", () => {
    let callCount = 0;
    const fn: PathFn = (from, to) => {
      callCount++;
      return { path: [from, to], cost: 1, found: true, iterations: 1 };
    };
    const stepper = new PathFinderStepper(fn);
    stepper.plan(0, 5);
    expect(callCount).toBe(1);
    stepper.plan(0, 10); // different dest
    expect(callCount).toBe(2);
  });

  it("invalidate clears cached path", () => {
    const stepper = new PathFinderStepper(makeSimplePathFn());
    stepper.plan(0, 3);
    expect(stepper.path.length).toBe(4);
    stepper.invalidate();
    expect(stepper.path.length).toBe(0);
    expect(stepper.currentNode).toBe(-1);
  });

  it("early exit distance stops stepping early", () => {
    const stepper = new PathFinderStepper(makeSimplePathFn(), 2);
    stepper.plan(0, 5);
    expect(stepper.path).toEqual([0, 1, 2, 3, 4, 5]);

    // step until arrived (should stop 2 hops before end)
    const visited: number[] = [stepper.currentNode];
    while (!stepper.arrived) {
      visited.push(stepper.step());
    }
    // Should arrive at step index 3 (node 3), with 2 hops remaining to node 5
    expect(stepper.arrived).toBe(true);
    expect(stepper.currentNode).toBe(3);
  });

  it("step returns -1 when no path", () => {
    const stepper = new PathFinderStepper(makeSimplePathFn());
    expect(stepper.step()).toBe(-1);
  });

  it("destination change resets step index", () => {
    const stepper = new PathFinderStepper(makeSimplePathFn());
    stepper.plan(0, 4);
    stepper.step();
    stepper.step();
    expect(stepper.currentStep).toBe(2);
    stepper.plan(0, 6); // new destination
    expect(stepper.currentStep).toBe(0);
  });
});
