import type { PriorityQueue } from "./PriorityQueue.js";

/**
 * O(1) amortised push / O(bucket-scan) pop priority queue using stamp-based cycling.
 * Ideal when priorities are non-negative integers (or can be truncated to integers).
 * Uses a circular bucket array; each bucket holds node ids with stamp-based validity.
 */
export class BucketQueue implements PriorityQueue {
  private readonly bucketCount: number;
  private readonly buckets: Uint32Array[];    // each bucket stores node ids
  private readonly bucketSizes: Uint32Array;  // count of items per bucket
  private readonly stamps: Uint32Array;       // per-node stamp
  private currentStamp = 1;
  private currentMin = 0;
  private count = 0;

  /**
   * @param nodeCount  maximum number of distinct nodes
   * @param bucketCount  number of buckets (should cover expected priority range)
   */
  constructor(nodeCount: number, bucketCount = 1024) {
    this.bucketCount = bucketCount;
    this.buckets = new Array(bucketCount);
    this.bucketSizes = new Uint32Array(bucketCount);
    for (let i = 0; i < bucketCount; i++) {
      this.buckets[i] = new Uint32Array(16); // initial per-bucket capacity
    }
    this.stamps = new Uint32Array(nodeCount);
  }

  push(node: number, priority: number): void {
    const bucket = (priority | 0) % this.bucketCount;
    // grow bucket if needed
    let arr = this.buckets[bucket];
    const sz = this.bucketSizes[bucket];
    if (sz >= arr.length) {
      const newArr = new Uint32Array(arr.length * 2);
      newArr.set(arr);
      this.buckets[bucket] = newArr;
      arr = newArr;
    }
    arr[sz] = node;
    this.bucketSizes[bucket] = sz + 1;
    this.stamps[node] = this.currentStamp;
    if (bucket < this.currentMin || this.count === 0) {
      this.currentMin = bucket;
    }
    this.count++;
  }

  pop(): number {
    if (this.count === 0) throw new Error("BucketQueue is empty");
    // scan from currentMin
    for (let i = this.currentMin; i < this.bucketCount; i++) {
      const sz = this.bucketSizes[i];
      if (sz === 0) continue;
      // find valid node in this bucket
      for (let j = 0; j < sz; j++) {
        const node = this.buckets[i][j];
        if (this.stamps[node] === this.currentStamp) {
          // remove by swapping with last
          this.bucketSizes[i]--;
          if (j < this.bucketSizes[i]) {
            this.buckets[i][j] = this.buckets[i][this.bucketSizes[i]];
          }
          this.stamps[node] = 0; // invalidate
          this.count--;
          this.currentMin = i;
          return node;
        }
      }
      // all in this bucket were stale, clear it
      this.bucketSizes[i] = 0;
    }
    // wrap around (shouldn't happen with correct usage)
    throw new Error("BucketQueue corrupted: no valid node found");
  }

  isEmpty(): boolean {
    return this.count === 0;
  }

  clear(): void {
    this.count = 0;
    this.currentMin = 0;
    this.currentStamp++;
    // If stamp overflows, reset everything
    if (this.currentStamp > 0x7FFFFFFF) {
      this.currentStamp = 1;
      this.stamps.fill(0);
    }
    this.bucketSizes.fill(0);
  }
}
