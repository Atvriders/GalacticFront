/**
 * Priority queue interface for pathfinding algorithms.
 */
export interface PriorityQueue {
  /** Insert a node with the given priority (lower = higher priority). */
  push(node: number, priority: number): void;
  /** Remove and return the node with the lowest priority. */
  pop(): number;
  /** True when the queue contains no elements. */
  isEmpty(): boolean;
  /** Remove all elements and reset internal state. */
  clear(): void;
}
