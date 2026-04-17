import seedrandom from "seedrandom";

export class PseudoRandom {
  private rng: seedrandom.PRNG;

  constructor(seed: string | number) {
    this.rng = seedrandom(String(seed));
  }

  /** Float in [0, 1) */
  next(): number {
    return this.rng();
  }

  /** Integer in [min, max] inclusive */
  nextInt(min: number, max: number): number {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  /** Returns true with the given probability [0, 1] */
  chance(probability: number): boolean {
    return this.rng() < probability;
  }

  /** Fisher-Yates in-place shuffle, returns array */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      const tmp = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = tmp;
    }
    return arr;
  }

  /** Random element from array; throws if empty */
  pick<T>(arr: T[]): T {
    if (arr.length === 0) {
      throw new Error("Cannot pick from an empty array");
    }
    return arr[Math.floor(this.rng() * arr.length)]!;
  }

  /** Float in [min, max) */
  nextFloat(min: number, max: number): number {
    return this.rng() * (max - min) + min;
  }
}
