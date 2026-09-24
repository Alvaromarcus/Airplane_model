import type { AirfoilType } from './calculations';

/**
 * Airfoil sampling.
 *
 * Every airfoil is exposed as two functions of the chord fraction x ∈ [0,1]:
 * upper(x) and lower(x), both as a fraction of the chord. Working with y(x)
 * instead of a closed polygon makes it trivial to cut the section at the
 * hinge line (ailerons, elevators, rudders) and to build water-tight meshes.
 */
export type TailAirfoil = 'sym_tail';
export interface AirfoilSurface {
  upper: (x: number) => number;
  lower: (x: number) => number;
  thickness: number; // max thickness / chord (approx.)
}

function naca4(digits: string): AirfoilSurface {
  const m = parseInt(digits[0], 10) / 100;
  const p = parseInt(digits[1], 10) / 10;
  const t = parseInt(digits.substring(2), 10) / 100;
  const yt = (x: number) =>
    5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4); // closed TE
  const yc = (x: number) => {
    if (m === 0 || p === 0) return 0;
    return x <= p
      ? (m / (p * p)) * (2 * p * x - x * x)
      : (m / ((1 - p) ** 2)) * (1 - 2 * p + 2 * p * x - x * x);
  };
  return {
    upper: x => yc(x) + yt(x),
    lower: x => yc(x) - yt(x),
    thickness: t,
  };
}

function interp(table: number[][]) {
  return (x: number) => {
    if (x <= table[0][0]) return table[0][1];
    for (let i = 1; i < table.length; i++) {
      if (x <= table[i][0]) {
        const [x0, y0] = table[i - 1];
        const [x1, y1] = table[i];
        const k = (x - x0) / (x1 - x0);
        return y0 + (y1 - y0) * k;
      }
    }
    return table[table.length - 1][1];
  };
}

// Clark-Y (normalised, standard 11.7 % section)
const CLARKY_UPPER = [
  [0, 0.035], [0.005, 0.0445], [0.0125, 0.0545], [0.025, 0.065], [0.05, 0.079], [0.075, 0.0885],
  [0.1, 0.096], [0.15, 0.1068], [0.2, 0.1136], [0.3, 0.117], [0.4, 0.114],
  [0.5, 0.1052], [0.6, 0.0915], [0.7, 0.0735], [0.8, 0.0522], [0.9, 0.028],
  [0.95, 0.0149], [1.0, 0.0012],
];
const CLARKY_LOWER = [
  [0, 0.035], [0.005, 0.0245], [0.0125, 0.0193], [0.025, 0.0147], [0.05, 0.0093], [0.075, 0.0063],
  [0.1, 0.0042], [0.15, 0.0015], [0.2, 0.0003], [0.3, 0], [1.0, 0],
];

// MH45 (Martin Hepperle) — reflexed section for flying wings (9.85 %)
const MH45_UPPER = [
  [0, 0], [0.005, 0.0135], [0.01, 0.0192], [0.02, 0.0274], [0.05, 0.0435],
  [0.1, 0.0592], [0.15, 0.0694], [0.2, 0.0763], [0.3, 0.0835], [0.4, 0.0841],
  [0.5, 0.0799], [0.6, 0.072], [0.7, 0.061], [0.8, 0.047], [0.9, 0.0286],
  [0.95, 0.0173], [1.0, 0.0049],
];
const MH45_LOWER = [
  [0, 0], [0.005, -0.0106], [0.01, -0.0142], [0.02, -0.0189], [0.05, -0.0264],
  [0.1, -0.0321], [0.15, -0.0345], [0.2, -0.0353], [0.3, -0.0341], [0.4, -0.0305],
  [0.5, -0.0253], [0.6, -0.019], [0.7, -0.0121], [0.8, -0.0053], [0.9, 0.0005],
  [0.95, 0.0025], [1.0, 0.0049],
];

const CACHE: Record<string, AirfoilSurface> = {};

export function getAirfoil(type: AirfoilType | TailAirfoil): AirfoilSurface {
  if (CACHE[type]) return CACHE[type];
  let s: AirfoilSurface;
  switch (type) {
    case 'sym_tail': s = naca4('0008'); break;
    case 'naca0012': s = naca4('0012'); break;
    case 'naca4412': s = naca4('4412'); break;
    case 'clarky': s = { upper: interp(CLARKY_UPPER), lower: interp(CLARKY_LOWER), thickness: 0.117 }; break;
    case 'mh45': s = { upper: interp(MH45_UPPER), lower: interp(MH45_LOWER), thickness: 0.0985 }; break;
    default: s = naca4('0012');
  }
  CACHE[type] = s;
  return s;
}

/**
 * Chord-wise sample positions between x0 and x1 with cosine clustering at
 * both ends (dense near the leading edge and at the hinge line).
 */
export function chordSamples(x0: number, x1: number, n = 24): number[] {
  const xs: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = 0.5 * (1 - Math.cos((Math.PI * i) / (n - 1)));
    xs.push(x0 + (x1 - x0) * t);
  }
  return xs;
}

/**
 * Closed 2D outline (x = chord fraction, y = thickness fraction) of the part of
 * an airfoil between x0 and x1: upper surface x0→x1, then lower x1→x0.
 */
export function airfoilSegment(af: AirfoilSurface, x0: number, x1: number, n = 24): [number, number][] {
  const xs = chordSamples(x0, x1, n);
  const up = xs.map(x => [x, af.upper(x)] as [number, number]);
  const lo = xs.slice().reverse().map(x => [x, af.lower(x)] as [number, number]);
  return [...up, ...lo];
}
