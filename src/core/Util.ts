// ---- formatBigInt ----

const SUFFIXES: Array<{ threshold: bigint; label: string }> = [
  { threshold: 1_000_000_000_000_000_000n, label: "Sp" },
  { threshold: 1_000_000_000_000_000n,     label: "Qa" },
  { threshold: 1_000_000_000_000n,          label: "T"  },
  { threshold: 1_000_000_000n,              label: "B"  },
  { threshold: 1_000_000n,                  label: "M"  },
  { threshold: 1_000n,                      label: "K"  },
];

// Extended suffix table for larger values
// Qa = Quadrillion, Qi = Quintillion, Sx = Sextillion, Sp = Septillion, Oc = Octillion
const FULL_SUFFIXES: Array<{ threshold: bigint; label: string }> = [
  { threshold: 1_000_000_000_000_000_000_000_000_000n, label: "Oc" },
  { threshold: 1_000_000_000_000_000_000_000_000n,     label: "Sp" },
  { threshold: 1_000_000_000_000_000_000_000n,         label: "Sx" },
  { threshold: 1_000_000_000_000_000_000n,             label: "Qi" },
  { threshold: 1_000_000_000_000_000n,                 label: "Qa" },
  { threshold: 1_000_000_000_000n,                     label: "T"  },
  { threshold: 1_000_000_000n,                         label: "B"  },
  { threshold: 1_000_000n,                             label: "M"  },
  { threshold: 1_000n,                                 label: "K"  },
];

export function formatBigInt(value: bigint): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;

  for (const { threshold, label } of FULL_SUFFIXES) {
    if (abs >= threshold) {
      // Compute one decimal place
      const whole = abs / threshold;
      const remainder = abs % threshold;
      // One decimal digit: multiply remainder by 10 then divide by threshold
      const decimal = Number((remainder * 10n) / threshold);
      const formatted =
        decimal === 0 ? `${whole}${label}` : `${whole}.${decimal}${label}`;
      return negative ? `-${formatted}` : formatted;
    }
  }

  const formatted = String(abs);
  return negative ? `-${formatted}` : formatted;
}

// ---- Math helpers ----

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function dist(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function manhattanDist(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.abs(x2 - x1) + Math.abs(y2 - y1);
}

export function toIndex(x: number, y: number, width: number): number {
  return y * width + x;
}

export function fromIndex(index: number, width: number): { x: number; y: number } {
  return { x: index % width, y: Math.floor(index / width) };
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ---- uniqueId ----

let _counter = 0;

export function uniqueId(prefix = ""): string {
  _counter += 1;
  return `${prefix}${_counter}`;
}

// ---- deepFreeze ----

export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== "object") return obj as Readonly<T>;
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    const value = (obj as Record<string, unknown>)[key];
    if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj as Readonly<T>;
}
