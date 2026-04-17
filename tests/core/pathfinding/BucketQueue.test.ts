import { describe, it, expect } from "vitest";
import { BucketQueue } from "@core/pathfinding/BucketQueue";

describe("BucketQueue", () => {
  it("pops the lowest-priority element", () => {
    const q = new BucketQueue(100, 64);
    q.push(10, 5);
    q.push(20, 1);
    q.push(30, 3);

    expect(q.pop()).toBe(20); // priority 1
  });

  it("returns elements in roughly priority order", () => {
    const q = new BucketQueue(100, 256);
    q.push(0, 10);
    q.push(1, 2);
    q.push(2, 5);
    q.push(3, 1);

    expect(q.pop()).toBe(3); // priority 1
    expect(q.pop()).toBe(1); // priority 2
    expect(q.pop()).toBe(2); // priority 5
    expect(q.pop()).toBe(0); // priority 10
  });

  it("reports isEmpty correctly", () => {
    const q = new BucketQueue(10, 32);
    expect(q.isEmpty()).toBe(true);
    q.push(0, 0);
    expect(q.isEmpty()).toBe(false);
    q.pop();
    expect(q.isEmpty()).toBe(true);
  });

  it("clears the queue via stamp cycling", () => {
    const q = new BucketQueue(10, 32);
    q.push(0, 0);
    q.push(1, 1);
    q.clear();
    expect(q.isEmpty()).toBe(true);
  });

  it("throws when popping an empty queue", () => {
    const q = new BucketQueue(10, 32);
    expect(() => q.pop()).toThrow("BucketQueue is empty");
  });

  it("works after clear and re-push", () => {
    const q = new BucketQueue(10, 32);
    q.push(0, 5);
    q.push(1, 3);
    q.clear();
    q.push(2, 1);
    q.push(3, 7);
    expect(q.pop()).toBe(2);
    expect(q.pop()).toBe(3);
    expect(q.isEmpty()).toBe(true);
  });

  it("handles many elements", () => {
    const q = new BucketQueue(500, 256);
    for (let i = 0; i < 200; i++) {
      q.push(i, 200 - i);
    }
    let lastPriority = 0;
    for (let i = 0; i < 200; i++) {
      const node = q.pop();
      const priority = 200 - node;
      expect(priority).toBeGreaterThanOrEqual(lastPriority);
      lastPriority = priority;
    }
  });
});
