/**
 * Array-backed binary min-heap keyed by numeric priority.
 * Lower key = higher priority (min-heap).
 */
export class FlatBinaryHeap<V> {
  private _keys: number[] = [];
  private _values: V[] = [];

  get length(): number {
    return this._keys.length;
  }

  isEmpty(): boolean {
    return this._keys.length === 0;
  }

  push(key: number, value: V): void {
    this._keys.push(key);
    this._values.push(value);
    this._bubbleUp(this._keys.length - 1);
  }

  peek(): { key: number; value: V } | undefined {
    if (this._keys.length === 0) return undefined;
    return { key: this._keys[0]!, value: this._values[0]! };
  }

  pop(): { key: number; value: V } | undefined {
    if (this._keys.length === 0) return undefined;
    const result = { key: this._keys[0]!, value: this._values[0]! };
    const last = this._keys.length - 1;
    if (last === 0) {
      this._keys.pop();
      this._values.pop();
    } else {
      this._keys[0] = this._keys.pop()!;
      this._values[0] = this._values.pop()!;
      this._sinkDown(0);
    }
    return result;
  }

  clear(): void {
    this._keys = [];
    this._values = [];
  }

  private _bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this._keys[parent]! <= this._keys[i]!) break;
      this._swap(parent, i);
      i = parent;
    }
  }

  private _sinkDown(i: number): void {
    const n = this._keys.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this._keys[left]! < this._keys[smallest]!) {
        smallest = left;
      }
      if (right < n && this._keys[right]! < this._keys[smallest]!) {
        smallest = right;
      }
      if (smallest === i) break;
      this._swap(i, smallest);
      i = smallest;
    }
  }

  private _swap(a: number, b: number): void {
    const tmpKey = this._keys[a]!;
    this._keys[a] = this._keys[b]!;
    this._keys[b] = tmpKey;
    const tmpVal = this._values[a]!;
    this._values[a] = this._values[b]!;
    this._values[b] = tmpVal;
  }
}
