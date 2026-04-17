declare module "seedrandom" {
  namespace seedrandom {
    interface PRNG {
      (): number;
      int32(): number;
      quick(): number;
      double(): number;
      state(): object;
    }

    interface Options {
      entropy?: boolean;
      global?: boolean;
      state?: boolean | object;
    }
  }

  function seedrandom(seed?: string, options?: seedrandom.Options, callback?: (prng: seedrandom.PRNG, seed: string) => unknown): seedrandom.PRNG;

  export default seedrandom;
}
