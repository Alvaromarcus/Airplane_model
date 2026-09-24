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
  buildExtraParts(L, airfoil, balance, pockets).forEach((x, i) => {
    plan.sections.push({ name: x.name, kind: x.kind, side: x.side, index: i + 1, axis: x.axis, geometry: x.geometry, length: 0 });
  });
  const oriented = plan.sections.map(sec => orientForPrint(sec, settings));
  return { plan, oriented };
}

const KIND_ORDER = ['fuselage', 'wing', 'aileron', 'hstab', 'elevator', 'fin', 'rudder', 'winglet', 'mount', 'hatch'];

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
  const pt = lang === 'pt';
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

  files[pt ? 'LEIA-ME.txt' : 'README.txt'] = strToU8(readme(plan, oriented, L, pt, t, pockets));
  const zip = zipSync(files, { level: 6 });
  return { blob: new Blob([zip as BlobPart], { type: 'application/zip' }), plan, oriented };
}

function readme(plan: PrintPlan, oriented: OrientedSection[], L: Layout, pt: boolean, t: (k: string, o?: Record<string, unknown>) => string, pockets: Pocket[]): string {
  const s = plan.settings;
  const lines: string[] = [];
  const bar = '='.repeat(64);
  lines.push(bar, pt ? 'AeroBuilder — peças para impressão 3D (LW-PLA, modo vaso)' : 'AeroBuilder — 3D printable parts (LW-PLA, vase mode)', bar, '');
  lines.push(pt ? `Mesa configurada: ${s.bedX} × ${s.bedY} × ${s.bedZ} mm` : `Configured bed: ${s.bedX} × ${s.bedY} × ${s.bedZ} mm`);
  lines.push(pt ? `Envergadura: ${Math.round(L.wing.halfSpan * 2 * L.toCm * 10)} mm   Peças: ${oriented.length}` : `Wingspan: ${Math.round(L.wing.halfSpan * 2 * L.toCm * 10)} mm   Parts: ${oriented.length}`, '');

  lines.push(pt ? 'CONFIGURAÇÃO DO FATIADOR' : 'SLICER SETTINGS', '-'.repeat(40));
  if (pt) {
    lines.push(
      '- Modo vaso / "Spiral vase" (PrusaSlicer/Orca) ou "Spiralize outer contour" (Cura).',
      '- 1 perímetro, 0 camadas de topo, 2–3 camadas de fundo (viram a nervura da base).',
      '- Altura de camada 0,2 mm; largura de linha 0,4–0,5 mm.',
      '- LW-PLA: ajuste o fluxo/temperatura conforme o fabricante para a densidade desejada.',
      '- NÃO use "fechar furos"/"slice closing radius" alto: a fenda de ' + s.slit + ' mm das',
      '  longarinas precisa ser mantida (PrusaSlicer: slice_closing_radius ≤ 0,05).',
      '- As peças já vêm posicionadas em pé, no centro da mesa. Não gire.',
    );
  } else {
    lines.push(
      '- "Spiral vase" (PrusaSlicer/Orca) or "Spiralize outer contour" (Cura).',
      '- 1 perimeter, 0 top layers, 2–3 bottom layers (they become the base rib).',
      '- 0.2 mm layers; 0.4–0.5 mm line width.',
      '- LW-PLA: tune flow/temperature per the manufacturer for the target density.',
      `- Do NOT use a large "slice closing radius": the ${s.slit} mm spar slits must survive`,
      '  (PrusaSlicer: slice_closing_radius ≤ 0.05).',
      '- Parts are already standing and centred on the bed. Do not rotate them.',
    );
  }
  lines.push('');

  if (oriented.some(o => o.section.kind === 'mount' || o.section.kind === 'hatch')) {
    lines.push(pt ? 'SUPORTES DE SERVO E TAMPAS (pastas 09_mount e 10_hatch)' : 'SERVO MOUNTS AND HATCHES (folders 09_mount and 10_hatch)', '-'.repeat(40));
    lines.push(...(pt ? [
      '- NÃO use modo vaso nessas peças: PLA ou PETG comum, 3 perímetros, 40–100% de preenchimento.',
      '- Suportes: cole dentro do bolsão do servo (asa) ou no compartimento central (fuselagem);',
      '  o servo encaixa na janela e é parafusado pelas abas (furos Ø1,8 mm para parafusos M2).',
      '- Tampas: casca de 1 mm que acompanha a superfície; prenda com fita, ímãs ou velcro.',
      '  A tampa do servo da asa deixa aberta a ponta externa para o braço do servo.',
    ] : [
      '- Do NOT use vase mode for these: regular PLA or PETG, 3 perimeters, 40–100% infill.',
      '- Mounts: glue inside the wing servo pocket or the fuselage middle bay; the servo drops',
      '  into the window and is screwed through its tabs (Ø1.8 mm holes for M2 screws).',
      '- Hatches: 1 mm shells that follow the skin; hold them with tape, magnets or velcro.',
      '  The wing servo hatch leaves the outboard end open for the servo arm.',
    ]), '');
  }
  lines.push(pt ? 'LONGARINAS (tubo/vareta de carbono)' : 'SPARS (carbon tube/rod)', '-'.repeat(40));
  if (plan.spars.length === 0) lines.push(pt ? '(nenhuma — perfil fino demais para longarina)' : '(none — airfoil too thin for a spar)');
  plan.spars.forEach(sp => {
    lines.push(`- ${t(sp.part)}: ${sp.count} × Ø${sp.diameter} mm × ${sp.length} mm  (${pt ? 'furo' : 'hole'} Ø${(sp.diameter + s.clearance).toFixed(1)} mm)`);
  });
  if (L.wing.dihedralRad !== 0 && plan.spars.some(sp => sp.id === 'main')) {
    lines.push(pt
      ? `  Diedro de ${(L.wing.dihedralRad * 180 / Math.PI).toFixed(1)}°: as longarinas das duas semi-asas se encontram na raiz em ângulo;\n  use uma luva/junta de carbono ou cole as raízes com as longarinas cortadas no ângulo.`
      : `  ${(L.wing.dihedralRad * 180 / Math.PI).toFixed(1)}° dihedral: the two half-wing spars meet at the root at an angle;\n  use a carbon joiner sleeve or glue the roots with the spars cut to the angle.`);
  }
  lines.push('');

  lines.push(pt ? 'LISTA DE PEÇAS (tamanho na mesa, mm)' : 'PARTS LIST (size on the bed, mm)', '-'.repeat(40));
  oriented.forEach(o => {
    const [x, y, z] = o.size.map(v => v.toFixed(0));
    lines.push(`${o.fits ? '  ' : '! '}${o.section.name.padEnd(18)} ${x} × ${y} × ${z}${o.fits ? '' : pt ? '   <- NÃO CABE NA MESA' : '   <- DOES NOT FIT THE BED'}`);
  });
  lines.push('');

  lines.push(pt ? 'MONTAGEM' : 'ASSEMBLY', '-'.repeat(40));
  if (pt) {
    lines.push(
      '1. Numeração: _01 é a seção mais próxima da raiz (ou do nariz). _R = direita, _L = esquerda.',
      '2. Passe a longarina pelas seções de cada semi-asa, colando com CA médio ou epóxi.',
      '3. Ailerons/elevons e superfícies móveis: dobradiça de fita ou pinos; o vão de dobradiça já está previsto.',
      '4. Recortes já incluídos (veja RECORTES abaixo). No modo vaso, cada recorte vira um',
      '   compartimento com paredes próprias; o resto da peça continua oco.',
      '5. Fuselagem: imprima a seção _01 com 3 camadas de fundo (vira o firewall do motor) e as',
      '   demais com 0 camadas de fundo (tubos abertos) para passar varetas e fios.',
      '6. Asa: as camadas de fundo viram nervuras; fure-as (Ø5 mm) para passar o cabo dos servos',
      '   até a raiz. As varetas saem pela fenda da dobradiça, ao lado do horn.',
      '7. Confira o CG antes do primeiro voo (aba "Peso & CG" e PDF).',
    );
  } else {
    lines.push(
      '1. Numbering: _01 is the section closest to the root (or nose). _R = right, _L = left.',
      '2. Slide the spar through each half-wing\'s sections, gluing with medium CA or epoxy.',
      '3. Ailerons/elevons and moving surfaces: tape or pin hinges; the hinge gap is built in.',
      '4. Cut-outs are already included (see CUT-OUTS below). In vase mode each cut-out becomes',
      '   a compartment with its own walls; the rest of the part stays hollow.',
      '5. Fuselage: print section _01 with 3 bottom layers (it becomes the motor firewall) and',
      '   the others with 0 bottom layers (open tubes) so pushrods and wires can pass.',
      '6. Wing: the bottom layers become ribs; drill them (Ø5 mm) to route the servo leads',
      '   to the root. Pushrods exit through the hinge gap next to the horn.',
      '7. Check the CG before the first flight ("Weight & CG" tab and PDF).',
    );
  }
  if (pockets.length) {
    lines.push('', pt ? 'RECORTES' : 'CUT-OUTS', '-'.repeat(40));
    pockets.forEach(p => {
      const name = t('cut_' + p.id);
      if (p.part === 'wing') {
        lines.push(`- ${name}: ${Math.round(p.xb - p.xa)} × ${Math.round(p.sb - p.sa)} mm, ${pt ? 'profundidade' : 'depth'} ${Math.round(p.depth)} mm (${p.side === 'lower' ? (pt ? 'intradorso' : 'lower skin') : (pt ? 'extradorso' : 'upper skin')}${p.xa <= 0 ? (pt ? ', centro da asa' : ', wing centre') : ''})`);
      } else {
        lines.push(`- ${name}: ${Math.round(p.sb - p.sa)} × ${Math.round((p.halfWidth ?? 0) * 2)} mm, ${pt ? 'aberto em cima' : 'open on top'} (${pt ? 'estação' : 'station'} ${Math.round(p.sa)}–${Math.round(p.sb)} mm)`);
      }
    });
  }
  if (plan.warnings.length) {
    lines.push('', pt ? 'AVISOS' : 'WARNINGS', '-'.repeat(40));
    plan.warnings.forEach(w => lines.push('- ' + t(w.key, w.params)));
  }
  lines.push('', 'https://aerobuilder-calc.netlify.app');
  return lines.join('\r\n');
}
