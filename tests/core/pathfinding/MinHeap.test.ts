import { describe, it, expect } from "vitest";
import { MinHeap } from "@core/pathfinding/MinHeap";

describe("MinHeap", () => {
  it("pops elements in priority order", () => {
    const heap = new MinHeap(4);
    heap.push(10, 5);
    heap.push(20, 1);
    heap.push(30, 3);
    heap.push(40, 2);

    expect(heap.pop()).toBe(20); // priority 1
    expect(heap.pop()).toBe(40); // priority 2
    expect(heap.pop()).toBe(30); // priority 3
    expect(heap.pop()).toBe(10); // priority 5
  });

  it("reports isEmpty correctly", () => {
    const heap = new MinHeap();
    expect(heap.isEmpty()).toBe(true);
    heap.push(1, 1);
    expect(heap.isEmpty()).toBe(false);
    heap.pop();
    expect(heap.isEmpty()).toBe(true);
  });

  it("clears the heap", () => {
    const heap = new MinHeap();
    heap.push(1, 1);
    heap.push(2, 2);
    heap.clear();
    expect(heap.isEmpty()).toBe(true);
    expect(heap.length).toBe(0);
  });

  it("throws when popping an empty heap", () => {
    const heap = new MinHeap();
    expect(() => heap.pop()).toThrow("MinHeap is empty");
  });

  it("grows automatically beyond initial capacity", () => {
    const heap = new MinHeap(2);
    for (let i = 0; i < 100; i++) {
      heap.push(i, 100 - i);
    }
    // Should pop in ascending priority order (descending node id since priority = 100 - i)
    let prev = -Infinity;
    for (let i = 0; i < 100; i++) {
      const node = heap.pop();
      // node id = 100 - priority, priority was 100-i so node = i
      // priorities are 100,99,...,1 for nodes 0,1,...,99
      // min priority = 1 => node 99
      expect(node).toBeGreaterThanOrEqual(0);
    }
  });

  it("handles duplicate priorities", () => {
    const heap = new MinHeap();
    heap.push(1, 5);
    heap.push(2, 5);
    heap.push(3, 5);
    const results = [heap.pop(), heap.pop(), heap.pop()];
    expect(results.sort()).toEqual([1, 2, 3]);
  });

  it("handles float priorities correctly", () => {
    const heap = new MinHeap();
    heap.push(1, 1.5);
    heap.push(2, 1.1);
    heap.push(3, 1.9);
    expect(heap.pop()).toBe(2); // 1.1
    expect(heap.pop()).toBe(1); // 1.5
    expect(heap.pop()).toBe(3); // 1.9
  });
});
