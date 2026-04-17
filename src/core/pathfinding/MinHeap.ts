import type { PriorityQueue } from "./PriorityQueue";

/**
 * Binary min-heap backed by typed arrays.
 * Keys (priorities) are stored in a Float32Array, values (node ids) in a Uint32Array.
 * Automatically grows when capacity is exceeded.
 */
export class MinHeap implements PriorityQueue {
  private keys: Float32Array;
  private values: Uint32Array;
  private size = 0;

  constructor(initialCapacity = 256) {
    this.keys = new Float32Array(initialCapacity);
    this.values = new Uint32Array(initialCapacity);
  }

  push(node: number, priority: number): void {
    if (this.size >= this.keys.length) {
      this.grow();
    }
    const idx = this.size++;
    this.keys[idx] = priority;
    this.values[idx] = node;
    this.bubbleUp(idx);
  }

  pop(): number {
    if (this.size === 0) throw new Error("MinHeap is empty");
    const top = this.values[0];
    this.size--;
    if (this.size > 0) {
      this.keys[0] = this.keys[this.size];
      this.values[0] = this.values[this.size];
      this.sinkDown(0);
    }
    return top;
  }

  isEmpty(): boolean {
    return this.size === 0;
  }

  clear(): void {
    this.size = 0;
  }

  /** Current number of elements in the heap. */
  get length(): number {
    return this.size;
  }

  private grow(): void {
    const newCap = this.keys.length * 2;
    const newKeys = new Float32Array(newCap);
    const newValues = new Uint32Array(newCap);
    newKeys.set(this.keys);
    newValues.set(this.values);
    this.keys = newKeys;
    this.values = newValues;
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.keys[idx] >= this.keys[parent]) break;
      // swap
      this.swapAt(idx, parent);
      idx = parent;
    }
  }

  private sinkDown(idx: number): void {
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      if (left < this.size && this.keys[left] < this.keys[smallest]) {
        smallest = left;
      }
      if (right < this.size && this.keys[right] < this.keys[smallest]) {
        smallest = right;
      }
      if (smallest === idx) break;
      this.swapAt(idx, smallest);
      idx = smallest;
    }
  }

  private swapAt(a: number, b: number): void {
    const tmpKey = this.keys[a];
    this.keys[a] = this.keys[b];
    this.keys[b] = tmpKey;
    const tmpVal = this.values[a];
    this.values[a] = this.values[b];
    this.values[b] = tmpVal;
  }
}
