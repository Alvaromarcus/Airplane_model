/**
 * STL export: orients every print section on the build plate, writes binary
 * STL files (millimetres) and bundles them in a ZIP with printing/assembly
 * instructions. Loaded on demand (dynamic import) to keep the main bundle small.
 */
import * as THREE from 'three';
import { zipSync, strToU8 } from 'fflate';
import type { AirfoilType } from './calculations';
import type { Layout } from './geometry';
import { buildPrintPlan, type PrintPlan, type PrintSection, type PrintSettings, type Pocket } from './printParts';
import { buildExtraParts } from './printables';
import type { BalanceResult } from './components';

export interface OrientedSection {
  section: PrintSection;
  geometry: THREE.BufferGeometry; // on the bed, mm
  size: [number, number, number];
  fits: boolean;
}

const MARGIN = 2; // mm kept free around the part on the bed

/** Places a section standing on the bed, rotated to fit, centred. */
export function orientForPrint(sec: PrintSection, s: PrintSettings): OrientedSection {
  const g = sec.geometry.clone();
  let axis = new THREE.Vector3(...sec.axis).normalize();

  // Stand on the larger end face (less overhang, better first layers)
  const pos = g.attributes.position as THREE.BufferAttribute;
  const proj: number[] = [];
  for (let i = 0; i < pos.count; i++) proj.push(pos.getX(i) * axis.x + pos.getY(i) * axis.y + pos.getZ(i) * axis.z);
  const pMin = Math.min(...proj), pMax = Math.max(...proj);
  const faceSpan = (sel: (p: number) => boolean) => {
    const v = new THREE.Vector3();
    const box = new THREE.Box3();
    for (let i = 0; i < pos.count; i++) if (sel(proj[i])) box.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)));
    const sz = box.getSize(new THREE.Vector3());
    return sz.x * sz.y + sz.y * sz.z + sz.z * sz.x; // proxy for face area
  };
  const tol = Math.max((pMax - pMin) * 0.002, 0.05);
  if (faceSpan(p => p > pMax - tol) > faceSpan(p => p < pMin + tol) * 1.05) axis = axis.negate();

  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(axis, new THREE.Vector3(0, 0, 1)));

  // Rotate about Z to fit the bed (try 0–178°, keep the smallest footprint that fits)
  const p2 = g.attributes.position as THREE.BufferAttribute;
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i < p2.count; i++) { xs.push(p2.getX(i)); ys.push(p2.getY(i)); }
  const W = s.bedX - 2 * MARGIN, H = s.bedY - 2 * MARGIN;
  let best = { ang: 0, w: Infinity, h: Infinity, fits: false, score: Infinity };
  for (let deg = 0; deg < 180; deg += 2) {
    const a = (deg * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i] * c - ys[i] * sn, y = xs[i] * sn + ys[i] * c;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const w = x1 - x0, h = y1 - y0;
    const fits = w <= W && h <= H;
    // Prefer fitting; then the smallest area; prefer the long side along X
    const score = (fits ? 0 : 1e12) + w * h + (w < h ? 1 : 0);
    if (score < best.score) best = { ang: a, w, h, fits, score };
  }
  g.rotateZ(best.ang);
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  g.translate(s.bedX / 2 - (bb.min.x + bb.max.x) / 2, s.bedY / 2 - (bb.min.y + bb.max.y) / 2, -bb.min.z);
  g.computeBoundingBox();
  const size = g.boundingBox!.getSize(new THREE.Vector3());
  return { section: sec, geometry: g, size: [size.x, size.y, size.z], fits: best.fits && size.z <= s.bedZ };
}

/** Binary STL (little endian), units = mm. */
export function toBinarySTL(geo: THREE.BufferGeometry, name: string): Uint8Array {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const index = geo.getIndex();
  const triCount = index ? index.count / 3 : pos.count / 3;
  const buf = new ArrayBuffer(84 + triCount * 50);
  const dv = new DataView(buf);
  const header = `AeroBuilder ${name}`.slice(0, 79);
  for (let i = 0; i < header.length; i++) dv.setUint8(i, header.charCodeAt(i) & 0x7f);
  dv.setUint32(80, triCount, true);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3();
  let o = 84;
  for (let t = 0; t < triCount; t++) {
    const i0 = index ? index.getX(t * 3) : t * 3;
    const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    const n = ab.subVectors(b, a).cross(ac.subVectors(c, a)).normalize();
    dv.setFloat32(o, n.x, true); dv.setFloat32(o + 4, n.y, true); dv.setFloat32(o + 8, n.z, true);
    [a, b, c].forEach((v, k) => {
      dv.setFloat32(o + 12 + k * 12, v.x, true);
      dv.setFloat32(o + 16 + k * 12, v.y, true);
      dv.setFloat32(o + 20 + k * 12, v.z, true);
    });
    dv.setUint16(o + 48, 0, true);
    o += 50;
  }
  return new Uint8Array(buf);
}

export interface ExportResult {
  blob: Blob;
  plan: PrintPlan;
  oriented: OrientedSection[];
}

export function planAndOrient(L: Layout, airfoil: AirfoilType, settings: PrintSettings, pockets: Pocket[] = [], balance: BalanceResult | null = null) {
  const plan = buildPrintPlan(L, airfoil, settings, pockets);
  // Servo mounts and hatches (normal printing, not vase mode) join the parts list
  buildExtraParts(L, airfoil, balance, pockets, Math.max(Math.min(settings.bedX, settings.bedY), Math.max(settings.bedX, settings.bedY) * 0.95) - 12).forEach((x, i) => {
    plan.sections.push({ name: x.name, kind: x.kind, side: x.side, index: i + 1, axis: x.axis, geometry: x.geometry, length: 0 });
  });
  const oriented = plan.sections.map(sec => orientForPrint(sec, settings));
  return { plan, oriented };
}

const KIND_ORDER = ['fuselage', 'wing', 'aileron', 'hstab', 'elevator', 'fin', 'rudder', 'winglet', 'mount', 'hatch', 'joint'];

export function exportSTLZip(
  L: Layout,
  airfoil: AirfoilType,
  settings: PrintSettings,
  lang: string,
  t: (k: string, o?: Record<string, unknown>) => string,
  pockets: Pocket[] = [],
  balance: BalanceResult | null = null,
): ExportResult {
  const { plan, oriented } = planAndOrient(L, airfoil, settings, pockets, balance);
  const pt = lang.startsWith('pt');
  const readmeName = ({ pt: 'LEIA-ME.txt', es: 'LEAME.txt', fr: 'LISEZMOI.txt' } as Record<string, string>)[lang.slice(0, 2)] ?? 'README.txt';
  const files: Record<string, Uint8Array> = {};
  const folder = (k: string) => String(KIND_ORDER.indexOf(k) + 1).padStart(2, '0') + '_' + k;

  oriented.forEach(o => {
    files[`${folder(o.section.kind)}/${o.section.name}.stl`] = toBinarySTL(o.geometry, o.section.name);
  });

  // Assembled model (for preview/checking in any STL viewer — not for printing)
  {
    const geos = plan.sections.map(s => s.geometry);
    let total = 0;
    geos.forEach(g => { total += g.getIndex() ? g.getIndex()!.count : g.attributes.position.count; });
    const pos = new Float32Array(total * 3);
    let o = 0;
    geos.forEach(g => {
      const p = g.attributes.position as THREE.BufferAttribute;
      const idx = g.getIndex();
      const n = idx ? idx.count : p.count;
      for (let i = 0; i < n; i++) {
        const v = idx ? idx.getX(i) : i;
        pos[o++] = p.getX(v); pos[o++] = p.getY(v); pos[o++] = p.getZ(v);
      }
    });
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    // Rotate so the model sits "upright" in Z-up viewers (Y-up → Z-up)
    merged.rotateX(Math.PI / 2);
    files[pt ? '00_montado_preview/aviao_montado.stl' : '00_assembled_preview/aircraft_assembled.stl'] = toBinarySTL(merged, 'assembled');
  }

  // UTF-8 BOM so Windows Notepad shows accents and Chinese correctly
  files[readmeName] = strToU8('\uFEFF' + readme(plan, oriented, L, t, pockets, balance));
  const zip = zipSync(files, { level: 6 });
  return { blob: new Blob([zip as BlobPart], { type: 'application/zip' }), plan, oriented };
}

function readme(plan: PrintPlan, oriented: OrientedSection[], L: Layout, t: (k: string, o?: Record<string, unknown>) => string, pockets: Pocket[], balance: BalanceResult | null): string {
  const s = plan.settings;
  const r = (k: string, o?: Record<string, unknown>) => t('rd_' + k, o);
  const lines: string[] = [];
  const bar = '='.repeat(64);
  const head = (k: string) => lines.push('', r(k), '-'.repeat(40));
  lines.push(bar, r('title'), bar, '');
  lines.push(r('bed', { x: s.bedX, y: s.bedY, z: s.bedZ }));
  lines.push(r('span_parts', { span: Math.round(L.wing.halfSpan * 2 * L.toCm * 10), n: oriented.length }));

  head('slicer');
  lines.push(r('slicer_1'), r('slicer_2'), r('slicer_3'), r('slicer_4'), r('slicer_5', { slit: s.slit }), r('slicer_6'));

  if (oriented.some(o => o.section.kind === 'mount' || o.section.kind === 'hatch')) {
    head('mounts');
    lines.push(r('mounts_1'), r('mounts_2'), r('mounts_3'));
  }

  head('spars');
  if (plan.spars.length === 0) lines.push(r('spars_none'));
  plan.spars.forEach(sp => {
    lines.push(`- ${t(sp.part)}: ${sp.count} × Ø${sp.diameter} mm × ${sp.length} mm  (${r('hole')} Ø${(sp.diameter + s.clearance).toFixed(1)} mm)`);
  });
  if (L.wing.dihedralRad !== 0 && plan.spars.some(sp => sp.id === 'main')) {
    lines.push(r('dihedral', { deg: (L.wing.dihedralRad * 180 / Math.PI).toFixed(1) }));
  }

  head('parts');
  oriented.forEach(o => {
    const [x, y, z] = o.size.map(v => v.toFixed(0));
    lines.push(`${o.fits ? '  ' : '! '}${o.section.name.padEnd(18)} ${x} × ${y} × ${z}${o.fits ? '' : r('not_fit')}`);
  });

  head('assembly');
  lines.push(r('asm_1'), r('asm_2'), r('asm_3'), r('asm_4'), r('asm_5'), r('asm_6'), r('asm_7'));

  const asm = balance?.assembly;
  if (asm) {
    const j = asm.joiner;
    head('joints');
    lines.push(
      r('j_a', { w: Math.round(2 * j.halfLen), c: Math.round(j.sb - j.sa), t: j.t }),
      r('j_a1'),
      r(j.recessed ? 'j_a2_rec' : 'j_a2_surf'),
      r('j_a3'),
    );
    if (asm.bands && asm.sleeve && asm.teGuard && L.fuselage) {
      const fz = L.fuselage, mmU = L.toCm * 10;
      const [F, R] = asm.dowels;
      const top = (d: typeof F) => { const sec = fz.section(d.s / mmU); return Math.round((sec.yc + sec.h / 2) * mmU - d.y); };
      lines.push(
        r('j_b', { d: F.d, len: Math.round(F.len) }),
        r('j_b_front', { s: Math.round(F.s), top: top(F) }),
        r('j_b_rear', { s: Math.round(R.s), top: top(R) }),
        r('j_b_drill', { hole: asm.sleeve.od.toFixed(1) }),
        r('j_c'),
        r('j_d', { n: asm.bands.count, len: asm.bands.flatLen }),
      );
    } else if (asm.mount === 'glued') {
      lines.push(r('j_glued'));
    }
  }

  const exits = balance?.linkExits ?? [];
  if (exits.length && L.fuselage) {
    const fz = L.fuselage, mmU = L.toCm * 10;
    const where = (p: [number, number, number], wall = false) => {
      const sec = fz.section(p[2] / mmU);
      const bottom = (sec.yc - sec.h / 2) * mmU, yc = sec.yc * mmU, hh = (sec.h / 2) * mmU;
      const face = p[1] > yc + 0.45 * hh ? r('face_top') : p[1] < yc - 0.45 * hh ? r('face_bottom') : p[0] < 0 ? r('face_left') : r('face_right');
      const off = Math.abs(p[0]) < 3 ? r('ex_centre') : r(p[0] < 0 ? 'ex_left' : 'ex_right', { mm: Math.round(Math.abs(p[0])) });
      return r('ex_where', { s: Math.round(p[2]), h: Math.round(p[1] - bottom), off }) + (wall ? '' : ` (${face})`);
    };
    head('exits');
    exits.forEach(e => {
      lines.push(`${r(e.id === 'link_elev' ? 'ex_elev' : 'ex_rudder')}:`);
      if (e.through) lines.push(`  - ${r(e.throughKind === 'wall' ? 'ex_wall' : 'ex_floor')}: ${where(e.through, true)}`);
      if (e.skin) lines.push(`  - ${r('ex_skin')}: ${where(e.skin)}`);
      if (e.guide > 0) lines.push(r('ex_guide', { len: Math.round(e.guide + 20) }));
    });
    lines.push(r('ex_drill'));
  }

  if (pockets.length) {
    head('cutouts');
    pockets.forEach(p => {
      const name = t('cut_' + p.id);
      if (p.part === 'wing') {
        lines.push(`- ${name}: ${Math.round(p.xb - p.xa)} × ${Math.round(p.sb - p.sa)} mm, ${r('depth')} ${Math.round(p.depth)} mm (${r(p.side === 'lower' ? 'lower' : 'upper')}${p.xa <= 0 ? r('wing_centre') : ''})`);
      } else {
        lines.push(`- ${name}: ${Math.round(p.sb - p.sa)} × ${Math.round((p.halfWidth ?? 0) * 2)} mm, ${r('open_top')} (${r('station')} ${Math.round(p.sa)}–${Math.round(p.sb)} mm)`);
      }
    });
  }
  if (plan.warnings.length) {
    head('warnings');
    plan.warnings.forEach(w => lines.push('- ' + t(w.key, w.params)));
  }
  lines.push('', 'https://aerobuilder-calc.netlify.app');
  return lines.join('\r\n');
}
