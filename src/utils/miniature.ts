/**
 * Miniature of the whole aircraft, for display / demonstration prints.
 *
 * Unlike the vase-mode sections, the miniature is a set of plain closed solids
 * (no spar channels, pockets, hinge gaps or joints) that overlap where the real
 * parts meet, so the slicer fuses them into a single piece. Thin sections are
 * thickened so that they are still printable after scaling down.
 *
 * Geometry is built FULL SIZE in millimetres in the aircraft frame
 * (X = right, Y = up, Z = -station); the exporter scales it afterwards.
 */
import * as THREE from 'three';
import type { AirfoilType } from './calculations';
import type { Layout } from './geometry';
import { FUSE_EXPO } from './geometry';
import { getAirfoil } from './airfoils';
import { DEFAULT_PRINT_SETTINGS, keyholeOutline, loftSolid, mirrorX } from './printParts';

type V3 = [number, number, number];

/** Thinnest wall of the printed miniature, mm (trailing edges, tail surfaces). */
export const MINI_MIN_WALL = 0.8;

export function buildMiniature(L: Layout, airfoil: AirfoilType, scale: number): THREE.BufferGeometry[] {
  const mm = L.toCm * 10;
  // Full-size minimum thickness that is still MINI_MIN_WALL thick once scaled
  const s = { ...DEFAULT_PRINT_SETTINGS, minTe: Math.max(DEFAULT_PRINT_SETTINGS.minTe, MINI_MIN_WALL / scale) };
  const wingAf = getAirfoil(airfoil);
  const tailAf = getAirfoil('sym_tail');
  const out: THREE.BufferGeometry[] = [];
  const both = (g: THREE.BufferGeometry) => { out.push(g, mirrorX(g)); };

  // ── Wing: one solid per side, control surfaces fused in ──
  const w = L.wing;
  const H = w.halfSpan * mm;
  const chordAt = (f: number) => w.chordAt(f) * mm;
  const leAt = (f: number) => w.leAt(f) * mm;
  const yAt = (f: number) => w.yAt(f) * mm;
  const wingRing = (f: number, x1: number): V3[] =>
    keyholeOutline(wingAf, 0, x1, chordAt(f), [], s).map(([u, v]) => [f * H, yAt(f) + v, -(leAt(f) + u)] as V3);
  if (L.teCut) {
    // Root trailing-edge notch for the pusher propeller
    const fc = Math.min((L.teCut.halfWidth * mm) / H, 0.9);
    const sCut = L.teCut.sCut * mm;
    const x1 = (f: number) => Math.min(1, (sCut - leAt(f)) / chordAt(f));
    both(loftSolid([wingRing(0, x1(0)), wingRing(fc, x1(fc))]));
    both(loftSolid([wingRing(fc, 1), wingRing(1, 1)]));
  } else {
    both(loftSolid([wingRing(0, 1), wingRing(1, 1)]));
  }

  // ── Horizontal stabiliser (elevator fused in) ──
  if (L.hStab) {
    const h = L.hStab;
    const hs = (h.span / 2) * mm, hc = h.rootChord * mm, hLe = h.leS * mm, hy = h.y * mm;
    const ring = (f: number): V3[] =>
      keyholeOutline(tailAf, 0, 1, hc, [], s).map(([u, v]) => [f * hs, hy + v, -(hLe + u)] as V3);
    both(loftSolid([ring(0), ring(1)]));
  }

  // ── Fin (rudder fused in), sunk into the fuselage so the two always overlap ──
  if (L.fin) {
    const f = L.fin;
    const Hf = f.span * mm, fc = f.rootChord * mm, fLe = f.leS * mm, fy = f.y * mm;
    const sink = L.fuselage ? L.fuselage.section(Math.min(f.leS + f.rootChord, L.fuselage.length)).h * mm * 0.5 : 0;
    const ring = (y: number): V3[] =>
      keyholeOutline(tailAf, 0, 1, fc, [], s).map(([u, v]) => [v, y, -(fLe + u)] as V3);
    out.push(loftSolid([ring(fy - sink), ring(fy + Hf)]));
  }

  // ── Winglets (flying wing), starting inside the wing tip ──
  if (L.winglet && L.winglet.span > 0) {
    const g = L.winglet;
    const Hw = g.span * mm;
    const le = (t: number) => (g.leS + g.sweep * t) * mm;
    const ch = (t: number) => (g.rootChord + (g.tipChord - g.rootChord) * t) * mm;
    const base = g.y * mm;
    // Keep the winglet inside the wing planform: its outer face flush with the tip
    const half = (tailAf.thickness * ch(0)) / 2 + s.minTe / 2;
    const ring = (t: number): V3[] =>
      keyholeOutline(tailAf, 0, 1, ch(t), [], s).map(([u, v]) => [H - half + v, base + t * Hw, -(le(t) + u)] as V3);
    both(loftSolid([ring(0), ring(1)]));
  }

  // ── Fuselage: one solid ──
  if (L.fuselage) {
    const fz = L.fuselage;
    const expo = FUSE_EXPO[fz.style];
    const nRing = 40, nSt = 48;
    const rings: V3[][] = [];
    for (let k = 0; k <= nSt; k++) {
      const st = (k / nSt) * fz.length;
      const sec = fz.section(st);
      const ring: V3[] = [];
      for (let i = 0; i < nRing; i++) {
        const th = Math.PI / 2 + (2 * Math.PI * (i + 0.5)) / nRing;
        const c = Math.cos(th), sn = Math.sin(th);
        ring.push([
          (sec.w / 2) * mm * Math.sign(c) * Math.abs(c) ** (2 / expo),
          sec.yc * mm + (sec.h / 2) * mm * Math.sign(sn) * Math.abs(sn) ** (2 / expo),
          -st * mm,
        ]);
      }
      rings.push(ring);
    }
    out.push(loftSolid(rings));
  }
  return out;
}
