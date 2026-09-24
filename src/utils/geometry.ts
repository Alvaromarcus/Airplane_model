/**
 * Shared aircraft layout.
 *
 * Every view (2D canvas, 3D scene, PDF templates and — later — STL export)
 * derives positions from this single module so they always agree.
 *
 * Conventions (all lengths in the SAME unit as the input dimensions):
 *  - "station" s  : distance measured aft from the nose / firewall (s = 0).
 *                   Negative values are ahead of the nose (motor, propeller).
 *  - "span" x     : lateral distance from the aircraft centreline (right = +).
 *  - "height" y   : vertical, up = +, 0 = fuselage reference line.
 */
import type { AircraftDimensions, AircraftMetrics, AircraftType, ControlSurfaces, FuselageType, PropellerType } from './calculations';
import { sanitizeControls } from './calculations';
import { PROP_BY_KEY } from './electricSystem';

export interface FuselageSection {
  w: number;  // full width at this station
  h: number;  // full height at this station
  yc: number; // vertical centre of the section
}

export interface WingLayout {
  halfSpan: number;
  rootChord: number;
  tipChord: number;
  sweep: number;
  dihedralRad: number;
  leS: number;        // station of the root leading edge
  mountY: number;     // height of the root chord line
  /** chord at span fraction f ∈ [0,1] */
  chordAt: (f: number) => number;
  /** leading-edge station at span fraction f */
  leAt: (f: number) => number;
  /** trailing-edge station at span fraction f */
  teAt: (f: number) => number;
  /** height of the chord line at span fraction f (dihedral) */
  yAt: (f: number) => number;
}

export interface SurfaceLayout {
  leS: number;
  span: number;       // full span (hStab) or height (fin / winglet)
  rootChord: number;
  tipChord: number;
  sweep: number;      // LE offset at the tip
  y: number;          // mounting height
  hingeFrac: number;  // control surface chord fraction (0 = none)
}

export interface Layout {
  unit: 'cm' | 'mm';
  toCm: number;                 // multiply layout values by this to get cm
  isFW: boolean;
  wing: WingLayout;
  aileron: { f0: number; f1: number; chordFrac: number };
  hStab: SurfaceLayout | null;
  fin: SurfaceLayout | null;
  winglet: SurfaceLayout | null;   // one side; mirrored
  fuselage: {
    length: number;
    width: number;
    height: number;
    style: FuselageType;
    section: (s: number) => FuselageSection;
  } | null;
  motor: {
    pusher: boolean;
    diameter: number;
    length: number;
    mountS: number;               // firewall / mount station
    dir: 1 | -1;                  // +1 motor extends aft (pusher), -1 forward (tractor)
  };
  prop: { diameter: number; pitchIn: number; label: string; s: number; y: number };
  /**
   * Flying wing: notch in the root trailing edge so the pusher motor/prop sit
   * inside the wing (Zagi style). |x| ≤ halfWidth, stations ≥ sCut are removed.
   */
  teCut: { halfWidth: number; sCut: number } | null;
  /** Set when the cut-out was requested but does not fit (min. elevon start, %). */
  teCutNeedsElevonStart: number | null;
  cgS: number;
  npS: number;
  /** min/max station and max lateral extent, for fitting views */
  bounds: { sMin: number; sMax: number; xMax: number; yMin: number; yMax: number };
}

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

export function computeLayout(
  dims: AircraftDimensions,
  aircraftType: AircraftType,
  controls: ControlSurfaces,
  metrics: Pick<AircraftMetrics, 'cgPosition' | 'neutralPoint'>,
  unit: 'cm' | 'mm',
  fuselageStyle: FuselageType = 'trainer',
  propeller: PropellerType = 'prop_9x47',
  propCutout = true,
): Layout {
  const isFW = aircraftType === 'flying_wing';
  const inch = unit === 'mm' ? 25.4 : 2.54;
  const toCm = unit === 'mm' ? 0.1 : 1;
  const u = 1 / toCm; // 1 cm expressed in the current unit

  const halfSpan = Math.max(dims.wingspan, 1 * u) / 2;
  const rootChord = Math.max(dims.rootChord, 0.5 * u);
  const tipChord = Math.max(dims.tipChord, 0.1 * u);
  const sweep = dims.sweepOffset;
  const dihedralRad = ((dims.dihedral || 0) * Math.PI) / 180;
  const c = sanitizeControls(controls);

  // ── Fuselage (conventional only) ──
  let fuselage: Layout['fuselage'] = null;
  const noseLength = isFW ? 0 : Math.max(dims.noseLength, 0);
  if (!isFW) {
    const L = Math.max(dims.fuselageLength, 1 * u);
    const W = Math.max(dims.fuselageWidth || 7 * u, 1 * u);
    const H = Math.max(dims.fuselageHeight || 8 * u, 1 * u);
    const wingLe = noseLength;
    const wingTe = noseLength + rootChord;
    const isSport = fuselageStyle === 'sport';
    const section = (s: number): FuselageSection => {
      let k: number;          // width factor
      let kh: number;         // height factor
      if (s <= wingLe) {
        const t = wingLe > 0 ? s / wingLe : 1;
        k = (isSport ? 0.62 : 0.85) + (1 - (isSport ? 0.62 : 0.85)) * smooth(t);
        kh = (isSport ? 0.62 : 0.85) + (1 - (isSport ? 0.62 : 0.85)) * smooth(t);
      } else if (s <= wingTe) {
        k = 1; kh = 1;
      } else {
        const t = (s - wingTe) / Math.max(L - wingTe, 1e-6);
        k = 1 - 0.65 * smooth(t);
        kh = 1 - 0.55 * smooth(t);
      }
      const w = W * k;
      const h = H * kh;
      // Trainer: flat bottom line. Sport: centred, tail boom rises slightly.
      let yc: number;
      if (isSport) {
        const t = s > wingTe ? (s - wingTe) / Math.max(L - wingTe, 1e-6) : 0;
        yc = H * 0.12 * smooth(t);
      } else {
        yc = -H / 2 + h / 2;
      }
      return { w, h, yc };
    };
    fuselage = { length: L, width: W, height: H, style: fuselageStyle, section };
  }

  // Wing mounting height: trainer = high wing (sits on top), sport = low-mid wing
  let mountY = 0;
  if (fuselage) {
    const sec = fuselage.section(noseLength + rootChord * 0.3);
    mountY = fuselage.style === 'sport' ? sec.yc - sec.h * 0.18 : sec.yc + sec.h / 2;
  }

  const wing: WingLayout = {
    halfSpan, rootChord, tipChord, sweep, dihedralRad,
    leS: noseLength,
    mountY,
    chordAt: f => rootChord + (tipChord - rootChord) * f,
    leAt: f => noseLength + sweep * f,
    teAt: f => noseLength + sweep * f + rootChord + (tipChord - rootChord) * f,
    yAt: f => mountY + halfSpan * f * Math.tan(dihedralRad),
  };

  // ── Tail ──
  let hStab: SurfaceLayout | null = null;
  let fin: SurfaceLayout | null = null;
  let winglet: SurfaceLayout | null = null;
  if (!isFW) {
    const hLe = noseLength + rootChord + Math.max(dims.wingToTailDistance, 0);
    const hc = Math.max(dims.hStabChord, 0.1 * u);
    const secAtTail = fuselage!.section(Math.min(hLe + hc * 0.5, fuselage!.length));
    hStab = {
      leS: hLe, span: Math.max(dims.hStabSpan, 0.1 * u), rootChord: hc, tipChord: hc, sweep: 0,
      y: secAtTail.yc, hingeFrac: c.elevatorChord / 100,
    };
    const vc = Math.max(dims.vStabChord, 0.1 * u);
    const finLe = hLe + hc - vc; // fin TE aligned with stab TE
    const secAtFin = fuselage!.section(Math.min(Math.max(finLe + vc * 0.5, 0), fuselage!.length));
    fin = {
      leS: finLe, span: Math.max(dims.vStabSpan, 0.1 * u), rootChord: vc, tipChord: vc, sweep: 0,
      y: secAtFin.yc + secAtFin.h / 2, hingeFrac: c.rudderChord / 100,
    };
  } else {
    const vc = Math.max(dims.vStabChord, 0.1 * u);
    winglet = {
      leS: wing.teAt(1) - vc, span: Math.max(dims.vStabSpan, 0), rootChord: vc, tipChord: vc * 0.5,
      sweep: vc * 0.5, y: wing.yAt(1), hingeFrac: 0,
    };
  }

  // ── Motor & propeller ──
  const spec = PROP_BY_KEY[propeller];
  const propIn = spec ? spec.diameter_inch : 9;
  const pitchIn = spec ? spec.pitch_inch : 4.7;
  const propD = propIn * inch;
  // Outrunner size scales loosely with prop: 6" → ~24 mm (1806), 12" → ~36 mm (3536)
  const motorD = (1.2 + 0.2 * propIn) * u;
  const motorL = motorD * 0.9;
  let motor: Layout['motor'];
  let prop: Layout['prop'];
  let teCut: Layout['teCut'] = null;
  let teCutNeedsElevonStart: number | null = null;
  if (isFW) {
    // Pusher: either inside a trailing-edge notch (motor further forward) or behind the TE
    const hw = propD / 2 + 1 * u;
    const depth = motorL + 2.5 * u;
    const maxHw = c.aileronStart / 100 * halfSpan - 0.5 * u;
    let mountS = rootChord;
    if (propCutout) {
      if (hw <= maxHw && depth < rootChord * 0.35) {
        const sCut = noseLength + rootChord - depth;
        teCut = { halfWidth: hw, sCut };
        mountS = sCut + 0.3 * u;
      } else {
        teCutNeedsElevonStart = Math.ceil(((hw + 0.5 * u) / halfSpan) * 100);
      }
    }
    motor = { pusher: true, diameter: motorD, length: motorL, mountS, dir: 1 };
    prop = { diameter: propD, pitchIn, label: spec?.label ?? '', s: mountS + motorL + 0.6 * u, y: 0 };
  } else {
    const fy = fuselage!.section(0).yc;
    motor = { pusher: false, diameter: motorD, length: motorL, mountS: 0, dir: -1 };
    prop = { diameter: propD, pitchIn, label: spec?.label ?? '', s: -(motorL + 0.6 * u), y: fy };
  }

  const cgS = noseLength + metrics.cgPosition;
  const npS = noseLength + metrics.neutralPoint;

  // Bounds
  const stations = [prop.s - 1 * u, wing.leAt(0), wing.leAt(1), wing.teAt(0), wing.teAt(1)];
  if (fuselage) stations.push(fuselage.length);
  if (hStab) stations.push(hStab.leS + hStab.rootChord);
  if (fin) stations.push(fin.leS + fin.rootChord);
  if (isFW) stations.push(prop.s + 1 * u);
  const xMax = Math.max(halfSpan, hStab ? hStab.span / 2 : 0, propD / 2);
  const yVals = [wing.yAt(1), mountY, prop.y + propD / 2, prop.y - propD / 2];
  if (fuselage) yVals.push(-fuselage.height / 2, fuselage.height / 2);
  if (fin) yVals.push(fin.y + fin.span);
  if (winglet) yVals.push(winglet.y + winglet.span);

  return {
    unit, toCm, isFW, wing, teCut, teCutNeedsElevonStart,
    aileron: { f0: c.aileronStart / 100, f1: c.aileronEnd / 100, chordFrac: c.aileronChord / 100 },
    hStab, fin, winglet, fuselage, motor, prop, cgS, npS,
    bounds: {
      sMin: Math.min(...stations), sMax: Math.max(...stations), xMax,
      yMin: Math.min(...yVals), yMax: Math.max(...yVals),
    },
  };
}

/** Planform polygon of one aileron/elevon (right side), as [x, s] points. */
export function aileronOutline(L: Layout): [number, number][] {
  const { wing, aileron } = L;
  const pts: [number, number][] = [];
  const hinge = (f: number) => wing.teAt(f) - wing.chordAt(f) * aileron.chordFrac;
  pts.push([aileron.f0 * wing.halfSpan, hinge(aileron.f0)]);
  pts.push([aileron.f1 * wing.halfSpan, hinge(aileron.f1)]);
  pts.push([aileron.f1 * wing.halfSpan, wing.teAt(aileron.f1)]);
  pts.push([aileron.f0 * wing.halfSpan, wing.teAt(aileron.f0)]);
  return pts;
}
