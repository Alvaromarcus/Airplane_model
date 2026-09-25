/**
 * Extra printable parts that are NOT printed in vase mode:
 *  - servo mounts (flat plates with the servo window and screw holes)
 *  - hatches (thin covers that follow the skin over each compartment)
 *
 * Geometry is built in millimetres in the assembled aircraft frame
 * (X = right, Y = up, Z = -station), like the vase-mode sections, so the same
 * STL/orientation pipeline and the 3D viewer can use it.
 */
import * as THREE from 'three';
import type { AirfoilType } from './calculations';
import type { Layout } from './geometry';
import { getAirfoil } from './airfoils';
import type { BalanceResult, MountSpec } from './components';
import { loftSolid, mirrorX, type Pocket } from './printParts';

type V3 = [number, number, number];

export interface ExtraPart {
  name: string;
  kind: 'mount' | 'hatch';
  side: 'R' | 'L' | 'C';
  axis: V3;                        // becomes +Z (up) when printing
  geometry: THREE.BufferGeometry;  // assembled position, mm
}

const HATCH_T = 1.0;   // mm
const OVERLAP = 3;     // mm the hatch overlaps the opening on every side

/** Extruded plate → aircraft frame. */
function mountGeometry(m: MountSpec): THREE.BufferGeometry {
  const shape = new THREE.Shape(m.outline.map(([u, v]) => new THREE.Vector2(u, v)));
  m.windows.forEach(wpts => shape.holes.push(new THREE.Path(wpts.map(([u, v]) => new THREE.Vector2(u, v)))));
  m.holes.forEach(h => {
    const p = new THREE.Path();
    p.absarc(h.u, h.v, h.d / 2, 0, Math.PI * 2, true);
    shape.holes.push(p);
  });
  const geo = new THREE.ExtrudeGeometry(shape, { depth: m.t, bevelEnabled: false, curveSegments: 16 });
  geo.translate(0, 0, -m.t / 2);
  const [ox, oy, os] = m.origin;
  const mat = new THREE.Matrix4();
  if (m.normal === 'span') {
    // u → -Z (station), v → +Y, extrusion → +X
    mat.set(0, 0, 1, ox,
      0, 1, 0, oy,
      -1, 0, 0, -os,
      0, 0, 0, 1);
  } else {
    // u → +X, v → -Z (station), extrusion → +Y
    mat.set(1, 0, 0, ox,
      0, 0, 1, oy,
      0, -1, 0, -os,
      0, 0, 0, 1);
  }
  geo.applyMatrix4(mat);
  geo.computeVertexNormals();
  return geo;
}

/** Thin shell following a surface: rings = [inner points…, outer points reversed]. */
function strip(inner: V3[], outer: V3[]): V3[] {
  return [...inner, ...outer.slice().reverse()];
}

export function buildExtraParts(L: Layout, airfoil: AirfoilType, balance: BalanceResult | null, pockets: Pocket[], maxHatchLen = 200): ExtraPart[] {
  const parts: ExtraPart[] = [];
  if (!balance) return parts;
  const mm = L.toCm * 10;
  const w = L.wing;
  const af = getAirfoil(airfoil);
  const H = w.halfSpan * mm;
  const chordAt = (f: number) => w.chordAt(f) * mm;
  const leAt = (f: number) => w.leAt(f) * mm;
  const yAt = (f: number) => w.yAt(f) * mm;

  // ── Servo mounts ──
  balance.mounts.forEach(m => {
    parts.push({
      name: m.id, kind: 'mount', side: m.side,
      axis: m.normal === 'span' ? [m.side === 'L' ? -1 : 1, 0, 0] : [0, 1, 0],
      geometry: mountGeometry(m),
    });
  });

  // ── Wing hatches (skin-following covers) ──
  const N = 16;
  const wingSurfaceRing = (f: number, sa: number, sb: number, side: 'upper' | 'lower', xMm: number): V3[] => {
    const c = chordAt(f), le = leAt(f);
    const a = Math.max((sa - le) / c, 0.01), b = Math.min((sb - le) / c, 0.99);
    const inner: V3[] = [], outer: V3[] = [];
    for (let i = 0; i < N; i++) {
      const x = a + ((b - a) * i) / (N - 1);
      const y = yAt(f) + (side === 'upper' ? af.upper(x) : af.lower(x)) * c;
      const s = le + x * c;
      inner.push([xMm, y, -s]);
      outer.push([xMm, y + (side === 'upper' ? HATCH_T : -HATCH_T), -s]);
    }
    return strip(inner, outer);
  };

  pockets.filter(p => p.part === 'wing').forEach(p => {
    const sa = p.sa - OVERLAP, sb = p.sb + OVERLAP;
    if (p.id === 'servo_wing') {
      // Leave the outboard end open for the servo arm
      const x0 = p.xa - OVERLAP, x1 = p.xb - 9;
      if (x1 - x0 < 8) return;
      const rings = [x0, x1].map(xm => wingSurfaceRing(xm / H, sa, sb, 'lower', xm));
      const geo = loftSolid(rings);
      parts.push({ name: 'hatch_servo_R', kind: 'hatch', side: 'R', axis: [0, -1, 0], geometry: geo });
      parts.push({ name: 'hatch_servo_L', kind: 'hatch', side: 'L', axis: [0, -1, 0], geometry: mirrorX(geo) });
    } else {
      // Flying-wing centre bays: one cover across the centre line
      const X = p.xb + OVERLAP;
      const rings = [-X, 0, X].map(xm => wingSurfaceRing(Math.abs(xm) / H, sa, sb, p.side === 'lower' ? 'lower' : 'upper', xm));
      parts.push({ name: `hatch_${p.id.replace('bay_', '')}`, kind: 'hatch', side: 'C', axis: [0, p.side === 'lower' ? -1 : 1, 0], geometry: loftSolid(rings) });
    }
  });

  // ── Fuselage bay hatches ──
  if (L.fuselage) {
    const fz = L.fuselage;
    const expo = fz.style === 'trainer' ? 6 : 2.4;
    // A high wing covers the top of the fuselage between its LE and TE
    const covered: [number, number] | null = fz.style === 'trainer' ? [w.leS * mm, (w.leS + w.rootChord) * mm] : null;
    pockets.filter(p => p.part === 'fuselage').forEach(p => {
      let intervals: [number, number][] = [[p.sa - OVERLAP, p.sb + OVERLAP]];
      if (covered) {
        intervals = intervals.flatMap(([a, b]) => {
          const out: [number, number][] = [];
          if (a < covered[0]) out.push([a, Math.min(b, covered[0] - 1)]);
          if (b > covered[1]) out.push([Math.max(a, covered[1] + 1), b]);
          return out;
        });
      }
      // Long covers are split so each piece lies flat on the bed
      intervals = intervals.flatMap(([a, b]) => {
        const n = Math.max(1, Math.ceil((b - a) / maxHatchLen - 1e-9));
        return Array.from({ length: n }, (_, i) => [a + ((b - a) * i) / n, a + ((b - a) * (i + 1)) / n] as [number, number]);
      });
      intervals.filter(([a, b]) => b - a > 15).forEach(([a, b], k) => {
        const hw = (p.halfWidth ?? 10) + OVERLAP + 1;
        const nS = Math.max(2, Math.ceil((b - a) / 10) + 1);
        const rings: V3[][] = [];
        for (let i = 0; i < nS; i++) {
          const sMm = a + ((b - a) * i) / (nS - 1);
          const sec = fz.section(sMm / mm);
          const W = sec.w * mm, Hh = sec.h * mm, yc = sec.yc * mm;
          const hwc = Math.min(hw, W / 2 - 0.5);
          const inner: V3[] = [], outer: V3[] = [];
          for (let j = 0; j < N; j++) {
            const x = -hwc + (2 * hwc * j) / (N - 1);
            const y = yc + (Hh / 2) * Math.max(0, 1 - Math.abs((2 * x) / W) ** expo) ** (1 / expo);
            inner.push([x, y, -sMm]);
            outer.push([x, y + HATCH_T, -sMm]);
          }
          rings.push(strip(inner, outer));
        }
        const suffix = intervals.length > 1 ? `_${String.fromCharCode(97 + k)}` : '';
        parts.push({ name: `hatch_${p.id.replace('bay_', 'fuse_')}${suffix}`, kind: 'hatch', side: 'C', axis: [0, 1, 0], geometry: loftSolid(rings) });
      });
    });
  }

  return parts;
}

export function disposeExtraParts(parts: ExtraPart[]) {
  parts.forEach(p => p.geometry.dispose());
}
