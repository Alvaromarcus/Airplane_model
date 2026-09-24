/**
 * Printable parts for 3D printing in LW-PLA "spiral vase" mode.
 *
 * Each part is exported as its OUTER solid. The slicer prints it with a single
 * perimeter (vase mode), giving a light shell. Spar channels are cut as
 * "keyholes": a round hole joined to the lower skin by a very thin slit. The
 * single vase-mode perimeter follows the slit into the part and around the hole,
 * producing a tube for the carbon rod plus an internal shear web — the same
 * trick used by commercial printable RC planes.
 *
 * All geometry here is built in MILLIMETRES in the aircraft frame
 * (X = right, Y = up, Z = forward) and then split into sections that fit the
 * printer's build volume.
 */
import * as THREE from 'three';
import type { AirfoilType } from './calculations';
import type { Layout } from './geometry';
import { getAirfoil, chordSamples, type AirfoilSurface } from './airfoils';

type V3 = [number, number, number];
type V2 = [number, number];

export interface PrintSettings {
  bedX: number;       // mm
  bedY: number;       // mm
  bedZ: number;       // mm
  slit: number;       // keyhole slit width, mm
  minTe: number;      // minimum trailing-edge thickness, mm
  clearance: number;  // spar hole clearance on diameter, mm
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  bedX: 220, bedY: 220, bedZ: 250,
  slit: 0.2, minTe: 0.8, clearance: 0.3,
};

export type PrintKind = 'wing' | 'aileron' | 'hstab' | 'elevator' | 'fin' | 'rudder' | 'winglet' | 'fuselage';

export interface PrintSection {
  name: string;               // file-friendly name, e.g. "wing_R_02"
  kind: PrintKind;
  side: 'R' | 'L' | 'C';
  index: number;              // 1-based section number within its part
  axis: V3;                   // direction that becomes +Z (up) when printing
  geometry: THREE.BufferGeometry; // assembled position, mm
  length: number;             // extent along the print axis, mm
}

export interface SparSpec {
  id: 'main' | 'rear' | 'tail' | 'fin';
  part: string;               // human description key
  diameter: number;           // rod diameter (mm), hole is diameter + clearance
  length: number;             // one piece, mm
  count: number;
}

export interface PrintPlan {
  sections: PrintSection[];
  spars: SparSpec[];
  warnings: { key: string; params?: Record<string, string | number> }[];
  settings: PrintSettings;
}

const ROD_SIZES = [2, 3, 4, 5, 6, 8, 10, 12];
const WALL = 1.2;       // mm of material kept around a spar hole
const GAP = 0.012;      // hinge gap (chord fraction) — matches the 3D view

// ───────────────────────── Geometry helpers ─────────────────────────

/** Newell normal of a planar-ish ring. */
function ringNormal(r: V3[]): THREE.Vector3 {
  const n = new THREE.Vector3();
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length];
    n.x += (a[1] - b[1]) * (a[2] + b[2]);
    n.y += (a[2] - b[2]) * (a[0] + b[0]);
    n.z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return n.normalize();
}

function centroid(r: V3[]): THREE.Vector3 {
  const c = new THREE.Vector3();
  r.forEach(p => { c.x += p[0]; c.y += p[1]; c.z += p[2]; });
  return c.multiplyScalar(1 / r.length);
}

/** Triangulate a (possibly concave, keyholed) planar ring with ear-clipping. */
function capTriangles(r: V3[]): number[][] {
  const n = ringNormal(r);
  const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
  const pick = (p: V3): THREE.Vector2 =>
    ax >= ay && ax >= az ? new THREE.Vector2(p[1], p[2])
      : ay >= az ? new THREE.Vector2(p[2], p[0])
        : new THREE.Vector2(p[0], p[1]);
  const pts = r.map(pick);
  return THREE.ShapeUtils.triangulateShape(pts, []);
}

/**
 * Closed solid lofted through rings (same vertex count). Caps are
 * triangulated with ear-clipping so they may be any simple polygon (keyholes).
 * All faces are oriented outward.
 */
export function loftSolid(rings: V3[][]): THREE.BufferGeometry {
  const n = rings[0].length;
  const pos: number[] = [];
  const idx: number[] = [];
  rings.forEach(r => r.forEach(p => pos.push(p[0], p[1], p[2])));

  // Side orientation: check the quad at the ring point farthest from the centroid
  const c0 = centroid(rings[0]);
  let far = 0, farD = -1;
  rings[0].forEach((p, i) => {
    const d = (p[0] - c0.x) ** 2 + (p[1] - c0.y) ** 2 + (p[2] - c0.z) ** 2;
    if (d > farD) { farD = d; far = i; }
  });
  const P = (k: number, i: number) => new THREE.Vector3(...rings[k][i % n]);
  const a = P(0, far), b = P(0, far + 1), d = P(1, far);
  const nrm = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a));
  // Quad (a, b, c, d) with c = next ring, next point; triangle (a,b,c) normal ≈ (b-a)×(d-a)
  const outward = new THREE.Vector3().subVectors(a, c0);
  const flipSides = nrm.dot(outward) < 0;

  for (let k = 0; k < rings.length - 1; k++) {
    for (let i = 0; i < n; i++) {
      const i2 = (i + 1) % n;
      const qa = k * n + i, qb = k * n + i2, qc = (k + 1) * n + i2, qd = (k + 1) * n + i;
      if (flipSides) idx.push(qa, qc, qb, qa, qd, qc);
      else idx.push(qa, qb, qc, qa, qc, qd);
    }
  }

  const dir = new THREE.Vector3().subVectors(centroid(rings[rings.length - 1]), centroid(rings[0])).normalize();
  const addCap = (ringIdx: number, wantDir: THREE.Vector3) => {
    const base = ringIdx * n;
    // Ear-clipping returns consistently wound triangles: decide the flip once
    // for the whole cap (per-triangle tests are unreliable on sliver triangles)
    const tris = capTriangles(rings[ringIdx]);
    const sum = new THREE.Vector3();
    tris.forEach(([i0, i1, i2]) => {
      const A = P(ringIdx, i0), B = P(ringIdx, i1), C = P(ringIdx, i2);
      sum.add(new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A)));
    });
    const flip = sum.dot(wantDir) < 0;
    tris.forEach(([i0, i1, i2]) => {
      if (flip) idx.push(base + i0, base + i2, base + i1);
      else idx.push(base + i0, base + i1, base + i2);
    });
  };
  addCap(0, dir.clone().negate());
  addCap(rings.length - 1, dir);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Mirror a geometry across X = 0, keeping faces outward. */
export function mirrorX(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.clone();
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setX(i, -p.getX(i));
  const index = g.getIndex()!;
  const arr = index.array as Uint32Array | Uint16Array;
  for (let t = 0; t < arr.length; t += 3) { const tmp = arr[t + 1]; arr[t + 1] = arr[t + 2]; arr[t + 2] = tmp; }
  index.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

// ───────────────────────── Keyholed airfoil outline ─────────────────────────

interface Hole { x: number; d: number } // chord fraction, hole diameter (mm)

/**
 * Airfoil section between chord fractions x0..x1 at a given chord (mm), as a
 * closed outline (u along chord from the LE, v up), with keyhole spar holes.
 * The vertex count depends only on (x0, x1, holes.length), never on the chord,
 * so consecutive stations can be lofted.
 */
function keyholeOutline(af: AirfoilSurface, x0: number, x1: number, chord: number, holes: Hole[], s: PrintSettings): V2[] {
  const yU = (x: number) => {
    const u = af.upper(x) * chord, l = af.lower(x) * chord;
    return u - l < s.minTe ? (u + l) / 2 + s.minTe / 2 : u;
  };
  const yL = (x: number) => {
    const u = af.upper(x) * chord, l = af.lower(x) * chord;
    return u - l < s.minTe ? (u + l) / 2 - s.minTe / 2 : l;
  };
  const N = 28, NSEG = 12, NARC = 20;
  const out: V2[] = [];
  chordSamples(x0, x1, N).forEach(x => out.push([x * chord, yU(x)]));

  // Lower surface, TE → LE, interrupted by the keyholes
  const g = s.slit / 2 / chord;
  const hs = holes.slice().sort((a, b) => b.x - a.x);
  let from = x1;
  hs.forEach(h => {
    const segEnd = h.x + g;
    chordSamples(segEnd, from, NSEG).reverse().forEach((x, i) => { if (!(i === 0 && from === x1)) out.push([x * chord, yL(x)]); });
    const hx = h.x * chord;
    const hy = (af.upper(h.x) + af.lower(h.x)) / 2 * chord;
    const r = h.d / 2;
    const gAbs = Math.min(s.slit / 2, r * 0.9);
    const th0 = -Math.PI / 2 + Math.asin(gAbs / r);
    const th1 = (3 * Math.PI) / 2 - Math.asin(gAbs / r);
    for (let i = 0; i < NARC; i++) {
      const th = th0 + ((th1 - th0) * i) / (NARC - 1);
      out.push([hx + r * Math.cos(th), hy + r * Math.sin(th)]);
    }
    from = h.x - g;
  });
  chordSamples(x0, from, NSEG).reverse().forEach((x, i) => {
    if (i === 0 && hs.length === 0 && from === x1) return; // TE already on the upper list
    if (x === x0 && Math.abs(yU(x0) - yL(x0)) < 1e-6) return; // sharp LE: avoid a duplicate point
    out.push([x * chord, yL(x)]);
  });
  return out;
}

/** Largest standard rod that leaves WALL mm of material in a thickness t (mm). */
function pickRod(t: number, max = 12): number {
  const fits = ROD_SIZES.filter(d => d <= max && d + 2 * WALL + 0.3 <= t * 0.75);
  return fits.length ? fits[fits.length - 1] : 0;
}

// ───────────────────────── Plan builder ─────────────────────────

/** Evenly splits [a,b] into pieces no longer than maxLen (given the length of [a,b]). */
function splits(a: number, b: number, lengthMm: number, maxLen: number): number[] {
  const n = Math.max(1, Math.ceil(lengthMm / maxLen - 1e-9));
  return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
}

export function buildPrintPlan(L: Layout, airfoil: AirfoilType, settings: PrintSettings = DEFAULT_PRINT_SETTINGS): PrintPlan {
  const mm = L.toCm * 10; // layout unit → mm
  const s = settings;
  const maxLen = Math.max(s.bedZ - 5, 20);
  const sections: PrintSection[] = [];
  const spars: SparSpec[] = [];
  const warnings: PrintPlan['warnings'] = [];
  const wingAf = getAirfoil(airfoil);
  const tailAf = getAirfoil('sym_tail');
  const w = L.wing;
  const a = L.aileron;

  // Wing functions in mm
  const halfSpan = w.halfSpan * mm;
  const chordAt = (f: number) => w.chordAt(f) * mm;
  const leAt = (f: number) => w.leAt(f) * mm;
  const yAt = (f: number) => w.yAt(f) * mm;

  // ── Spars: size from the thinnest station they pass through (the tip) ──
  const hinge = 1 - a.chordFrac;
  const mainX = 0.28;
  const rearX = Math.min(0.62, hinge - 0.1);
  const thick = (af: AirfoilSurface, x: number, chord: number) => (af.upper(x) - af.lower(x)) * chord;
  // Cap by size class: ~6 mm up to 1 m span, 8 mm up to 1.5 m, 10 mm above
  const mainCap = halfSpan * 2 <= 1000 ? 6 : halfSpan * 2 <= 1500 ? 8 : 10;
  const mainD = pickRod(thick(wingAf, mainX, chordAt(1)), mainCap);
  const rearD = rearX > mainX + 0.15 ? Math.min(pickRod(thick(wingAf, rearX, chordAt(1)), 4), Math.max(mainD - 2, 0)) : 0;
  const wingHoles = (x0: number, x1: number): Hole[] => {
    const hs: Hole[] = [];
    if (mainD && mainX > x0 + 0.05 && mainX < x1 - 0.05) hs.push({ x: mainX, d: mainD + s.clearance });
    if (rearD && rearX > x0 + 0.05 && rearX < x1 - 0.05) hs.push({ x: rearX, d: rearD + s.clearance });
    return hs;
  };
  const sparLen = (x: number) => {
    const d = new THREE.Vector3(halfSpan, yAt(1) - yAt(0), (leAt(1) + x * chordAt(1)) - (leAt(0) + x * chordAt(0)));
    return Math.round(d.length());
  };
  if (mainD) spars.push({ id: 'main', part: 'spar_main', diameter: mainD, length: sparLen(mainX), count: 2 });
  else warnings.push({ key: 'stl_warn_no_spar' });
  if (rearD) spars.push({ id: 'rear', part: 'spar_rear', diameter: rearD, length: sparLen(rearX), count: 2 });

  // ── Wing halves ──
  const wingPieces: { f0: number; f1: number; x0: number; x1: number; kind: PrintKind; label: string }[] = [];
  if (a.f0 > 0.001) wingPieces.push({ f0: 0, f1: a.f0, x0: 0, x1: 1, kind: 'wing', label: 'wing' });
  wingPieces.push({ f0: a.f0, f1: a.f1, x0: 0, x1: hinge - GAP / 2, kind: 'wing', label: 'wing' });
  if (a.f1 < 0.999) wingPieces.push({ f0: a.f1, f1: 1, x0: 0, x1: 1, kind: 'wing', label: 'wing' });

  // Longest chord that fits the bed standing up (straight, or diagonally with its thickness)
  const bedMin = Math.min(s.bedX, s.bedY) - 4, bedMax = Math.max(s.bedX, s.bedY) - 4;
  const maxChordFit = Math.max(bedMax, (Math.SQRT2 * bedMin) / (1 + wingAf.thickness * 1.1));
  let chordSplit = false;

  let wingIdx = 0;
  wingPieces.forEach(pc => {
    const fs = splits(pc.f0, pc.f1, (pc.f1 - pc.f0) * halfSpan, maxLen);
    for (let i = 0; i < fs.length - 1; i++) {
      wingIdx++;
      // Chord-wise split when the section's longest chord does not fit the bed
      const usedChord = chordAt(fs[i]) * (pc.x1 - pc.x0);
      const nC = Math.ceil(usedChord / maxChordFit - 1e-9);
      let xs = Array.from({ length: nC + 1 }, (_, k) => pc.x0 + ((pc.x1 - pc.x0) * k) / nC);
      if (nC > 1) {
        chordSplit = true;
        // Keep cuts at least 6% chord away from the spar holes
        const holeXs = [mainD ? mainX : -1, rearD ? rearX : -1].filter(x => x > 0);
        xs = xs.map((x, k) => {
          if (k === 0 || k === xs.length - 1) return x;
          const near = holeXs.find(h => Math.abs(h - x) < 0.06);
          return near === undefined ? x : (x < near ? near - 0.06 : near + 0.06);
        });
      }
      const len = (fs[i + 1] - fs[i]) * halfSpan;
      for (let k = 0; k < xs.length - 1; k++) {
        const holes = wingHoles(xs[k], xs[k + 1]);
        const rings = [fs[i], fs[i + 1]].map(f => keyholeOutline(wingAf, xs[k], xs[k + 1], chordAt(f), holes, s)
          .map(([u, v]) => [f * halfSpan, yAt(f) + v, -(leAt(f) + u)] as V3));
        const geo = loftSolid(rings);
        const suffix = xs.length > 2 ? String.fromCharCode(97 + k) : '';
        sections.push({ name: `wing_R_${pad(wingIdx)}${suffix}`, kind: 'wing', side: 'R', index: wingIdx, axis: [1, 0, 0], geometry: geo, length: len });
        sections.push({ name: `wing_L_${pad(wingIdx)}${suffix}`, kind: 'wing', side: 'L', index: wingIdx, axis: [-1, 0, 0], geometry: mirrorX(geo), length: len });
      }
    }
  });
  if (chordSplit) warnings.push({ key: 'stl_info_chord_split', params: { max: Math.round(maxChordFit) } });

  // ── Ailerons / elevons ──
  {
    const spanGap = Math.min(0.004, (a.f1 - a.f0) * 0.02);
    const fs = splits(a.f0 + spanGap, a.f1 - spanGap, (a.f1 - a.f0) * halfSpan, maxLen);
    for (let i = 0; i < fs.length - 1; i++) {
      const rings = [fs[i], fs[i + 1]].map(f => keyholeOutline(wingAf, hinge + GAP / 2, 1, chordAt(f), [], s)
        .map(([u, v]) => [f * halfSpan, yAt(f) + v, -(leAt(f) + u)] as V3));
      const geo = loftSolid(rings);
      const len = (fs[i + 1] - fs[i]) * halfSpan;
      sections.push({ name: `${L.isFW ? 'elevon' : 'aileron'}_R_${pad(i + 1)}`, kind: 'aileron', side: 'R', index: i + 1, axis: [1, 0, 0], geometry: geo, length: len });
      sections.push({ name: `${L.isFW ? 'elevon' : 'aileron'}_L_${pad(i + 1)}`, kind: 'aileron', side: 'L', index: i + 1, axis: [-1, 0, 0], geometry: mirrorX(geo), length: len });
    }
  }

  // ── Horizontal stabiliser + elevator ──
  if (L.hStab) {
    const h = L.hStab;
    const hs = (h.span / 2) * mm;
    const hc = h.rootChord * mm;
    const hLe = h.leS * mm;
    const hy = h.y * mm;
    const eh = 1 - h.hingeFrac;
    const hasElev = h.hingeFrac > 0.001;
    const tailD = pickRod(thick(tailAf, 0.3, hc), 4);
    const holes: Hole[] = tailD ? [{ x: 0.3, d: tailD + s.clearance }] : [];
    if (tailD) spars.push({ id: 'tail', part: 'spar_tail', diameter: tailD, length: Math.round(hs * 2 * 0.9), count: 1 });
    const pieces: [number, number, PrintKind, string][] = [[0, hasElev ? eh - GAP / 2 : 1, 'hstab', 'hstab']];
    if (hasElev) pieces.push([eh + GAP / 2, 1, 'elevator', 'elevator']);
    pieces.forEach(([x0, x1, kind, label]) => {
      const f0 = kind === 'elevator' ? 0.01 : 0;
      const fs = splits(f0, 1, hs, maxLen);
      for (let i = 0; i < fs.length - 1; i++) {
        const rings = [fs[i], fs[i + 1]].map(f => keyholeOutline(tailAf, x0, x1, hc, kind === 'hstab' ? holes : [], s)
          .map(([u, v]) => [f * hs, hy + v, -(hLe + u)] as V3));
        const geo = loftSolid(rings);
        const len = (fs[i + 1] - fs[i]) * hs;
        sections.push({ name: `${label}_R_${pad(i + 1)}`, kind, side: 'R', index: i + 1, axis: [1, 0, 0], geometry: geo, length: len });
        sections.push({ name: `${label}_L_${pad(i + 1)}`, kind, side: 'L', index: i + 1, axis: [-1, 0, 0], geometry: mirrorX(geo), length: len });
      }
    });
  }

  // ── Fin + rudder ──
  if (L.fin) {
    const f = L.fin;
    const H = f.span * mm, fc = f.rootChord * mm, fLe = f.leS * mm, fy = f.y * mm;
    const hasRud = f.hingeFrac > 0.001;
    const eh = 1 - f.hingeFrac;
    const finD = pickRod(thick(tailAf, 0.3, fc), 3);
    if (finD) spars.push({ id: 'fin', part: 'spar_fin', diameter: finD, length: Math.round(H * 0.9), count: 1 });
    const pieces: [number, number, PrintKind][] = [[0, hasRud ? eh - GAP / 2 : 1, 'fin']];
    if (hasRud) pieces.push([eh + GAP / 2, 1, 'rudder']);
    pieces.forEach(([x0, x1, kind]) => {
      const t0 = kind === 'rudder' ? 0.02 : 0;
      const ts = splits(t0, 1, H, maxLen);
      for (let i = 0; i < ts.length - 1; i++) {
        const holes = kind === 'fin' && finD ? [{ x: 0.3, d: finD + s.clearance }] : [];
        const rings = [ts[i], ts[i + 1]].map(t => keyholeOutline(tailAf, x0, x1, fc, holes, s)
          .map(([u, v]) => [v, fy + t * H, -(fLe + u)] as V3));
        sections.push({ name: `${kind}_${pad(i + 1)}`, kind, side: 'C', index: i + 1, axis: [0, 1, 0], geometry: loftSolid(rings), length: (ts[i + 1] - ts[i]) * H });
      }
    });
  }

  // ── Winglets ──
  if (L.winglet && L.winglet.span > 0) {
    const g = L.winglet;
    const H = g.span * mm;
    const le = (t: number) => (g.leS + g.sweep * t) * mm;
    const ch = (t: number) => (g.rootChord + (g.tipChord - g.rootChord) * t) * mm;
    const base = g.y * mm;
    const ts = splits(0, 1, H, maxLen);
    for (let i = 0; i < ts.length - 1; i++) {
      const rings = [ts[i], ts[i + 1]].map(t => keyholeOutline(tailAf, 0, 1, ch(t), [], s)
        .map(([u, v]) => [halfSpan + v, base + t * H, -(le(t) + u)] as V3));
      const geo = loftSolid(rings);
      sections.push({ name: `winglet_R_${pad(i + 1)}`, kind: 'winglet', side: 'R', index: i + 1, axis: [0, 1, 0], geometry: geo, length: (ts[i + 1] - ts[i]) * H });
      sections.push({ name: `winglet_L_${pad(i + 1)}`, kind: 'winglet', side: 'L', index: i + 1, axis: [0, 1, 0], geometry: mirrorX(geo), length: (ts[i + 1] - ts[i]) * H });
    }
  }

  // ── Fuselage (printed standing, split along its length) ──
  if (L.fuselage) {
    const fz = L.fuselage;
    const Lmm = fz.length * mm;
    const expo = fz.style === 'trainer' ? 6 : 2.4;
    const nRing = 48;
    const ring = (sMm: number): V3[] => {
      const sec = fz.section(sMm / mm);
      const r: V3[] = [];
      for (let i = 0; i < nRing; i++) {
        const th = (2 * Math.PI * i) / nRing;
        const c = Math.cos(th), sn = Math.sin(th);
        r.push([
          (sec.w * mm / 2) * Math.sign(c) * Math.abs(c) ** (2 / expo),
          sec.yc * mm + (sec.h * mm / 2) * Math.sign(sn) * Math.abs(sn) ** (2 / expo),
          -sMm,
        ]);
      }
      return r;
    };
    const cuts = splits(0, Lmm, Lmm, maxLen);
    for (let i = 0; i < cuts.length - 1; i++) {
      const nSt = 12;
      const rings: V3[][] = [];
      for (let k = 0; k <= nSt; k++) rings.push(ring(cuts[i] + ((cuts[i + 1] - cuts[i]) * k) / nSt));
      sections.push({ name: `fuselage_${pad(i + 1)}`, kind: 'fuselage', side: 'C', index: i + 1, axis: [0, 0, -1], geometry: loftSolid(rings), length: cuts[i + 1] - cuts[i] });
    }
    if (fz.width * mm > Math.min(s.bedX, s.bedY) || fz.height * mm > Math.max(s.bedX, s.bedY)) {
      warnings.push({ key: 'stl_warn_fuse_bed' });
    }
  }

  return { sections, spars, warnings, settings: s };
}

function pad(n: number) { return String(n).padStart(2, '0'); }
