import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Play, Pause } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AirfoilType } from '../utils/calculations';
import type { Layout } from '../utils/geometry';
import { buildAircraftParts, disposeParts, type PartMesh } from '../utils/mesh';
import { buildPrintPlan, type PrintSettings, type Pocket, type PrintSection } from '../utils/printParts';
import { COMPONENT_COLORS, ASSEMBLY_COLORS, type BalanceResult } from '../utils/components';
import { buildExtraParts, disposeExtraParts } from '../utils/printables';

interface Scene3DProps {
  layout: Layout;
  airfoil: AirfoilType;
  isDarkMode: boolean;
  printSettings: PrintSettings;
  balance: BalanceResult | null;
  pockets: Pocket[];
  /** 0 = assembled, 1 = fully exploded */
  explode: number;
  onExplode: (v: number) => void;
}

type V3 = [number, number, number];

/**
 * Exploded-view offsets (mm). The wing lifts off the fuselage (showing the
 * dowels and the saddle) and its halves separate (showing the joiner); in the
 * print-section view every section also moves away from its neighbour.
 */
function explodeOffsets(L: Layout, e: number) {
  const mm = L.toCm * 10;
  const lift = L.isFW ? 0 : e * Math.max((L.fuselage?.height ?? 0) * mm * 1.3 + 50, 0.14 * L.wing.halfSpan * 2 * mm);
  const gap = e * Math.max(20, 0.06 * L.wing.halfSpan * mm);
  const secGap = e * 18;
  const wing = (side: number): V3 => [side * gap, lift, 0];
  const section = (s: PrintSection): V3 => {
    const i = s.index - 1;
    const sg = s.side === 'R' ? 1 : s.side === 'L' ? -1 : 0;
    switch (s.kind) {
      case 'wing': case 'winglet': return [sg * (gap + i * secGap), lift, 0];
      case 'aileron': return [sg * (gap + i * secGap), lift, -secGap];
      case 'fuselage': return [0, 0, -i * secGap * 1.5];
      case 'hstab': return [sg * i * secGap, 0, 0];
      case 'elevator': return [sg * i * secGap, 0, -secGap];
      case 'fin': return [0, i * secGap, 0];
      case 'rudder': return [0, i * secGap, -secGap];
      default: return [0, 0, 0];
    }
  };
  /** Offsets for onboard parts, by id / name. */
  const byId = (id: string): V3 => {
    const side = /_R(_|$)/.test(id) ? 1 : /_L(_|$)/.test(id) ? -1 : 0;
    if (/^(servo_wing|mount_wing|hatch_servo|link_wing|wing_)/.test(id)) return wing(side);
    if (/^(joint_wing_joiner|joint_te_guard)$/.test(id)) return [0, lift, 0];
    return [0, 0, 0];
  };
  return { lift, gap, wing, section, byId, active: e > 0.01 };
}


/** Wing dowels and rubber bands (mm). Bands are hidden in the exploded view. */
function Assembly({ balance, showBands }: { balance: BalanceResult; showBands: boolean }) {
  const asm = balance.assembly;
  const bandGeos = useMemo(() => (asm.bands?.paths ?? []).map(p => {
    const curve = new THREE.CatmullRomCurve3(p.pts.map(([x, y, s]) => new THREE.Vector3(x, y, -s)), false, 'centripetal');
    return { id: p.id, geo: new THREE.TubeGeometry(curve, 48, 1.1, 6, false) };
  }), [asm]);
  useEffect(() => () => bandGeos.forEach(b => b.geo.dispose()), [bandGeos]);
  return (
    <group>
      {asm.dowels.map(d => (
        <mesh key={d.id} position={[0, d.y, -d.s]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[d.d / 2, d.d / 2, d.len, 20]} />
          <meshStandardMaterial color={ASSEMBLY_COLORS.dowel} roughness={0.7} />
        </mesh>
      ))}
      {showBands && bandGeos.map(b => (
        <mesh key={b.id} geometry={b.geo}>
          <meshStandardMaterial color={ASSEMBLY_COLORS.band} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/** Servos, battery, ESC, receiver, ballast and pushrods (positions in mm). */
function Components({ L, balance, airfoil, pockets, explode }: { L: Layout; balance: BalanceResult; airfoil: AirfoilType; pockets: Pocket[]; explode: number }) {
  const ex = explodeOffsets(L, explode);
  const k = 1 / (L.toCm * 10); // mm → layout units
  const extras = useMemo(() => buildExtraParts(L, airfoil, balance, pockets), [L, airfoil, balance, pockets]);
  useEffect(() => () => disposeExtraParts(extras), [extras]);
  const sparMeshes = useMemo(() => balance.sparLines.flatMap(sp => {
    const sides = sp.mirror ? [1, -1] : [1];
    return sides.map(sg => {
      const a = new THREE.Vector3(sg * sp.a[0], sp.a[1], -sp.a[2]);
      const b = new THREE.Vector3(sg * sp.b[0], sp.b[1], -sp.b[2]);
      const dir = b.clone().sub(a);
      return {
        key: `${sp.id}_${sg}`, d: sp.d, len: dir.length(), wing: sp.id === 'main' || sp.id === 'rear', sg,
        mid: a.clone().add(b).multiplyScalar(0.5),
        q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()),
      };
    });
  }), [balance]);
  return (
    <group scale={k}>
      {/* Carbon spars */}
      {sparMeshes.map(m => (
        <mesh key={m.key} position={m.wing ? m.mid.clone().add(new THREE.Vector3(...ex.wing(m.sg))) : m.mid} quaternion={m.q}>
          <cylinderGeometry args={[m.d / 2, m.d / 2, m.len, 16]} />
          <meshStandardMaterial color={COMPONENT_COLORS.spar} roughness={0.35} metalness={0.4} />
        </mesh>
      ))}
      {/* Printed servo mounts and hatches */}
      {extras.map(x => (
        <mesh key={x.name} geometry={x.geometry} position={ex.byId(x.name)}>
          {x.kind === 'mount' || x.name.startsWith('joint_dowel_sleeve')
            ? <meshStandardMaterial color={COMPONENT_COLORS.mount} roughness={0.6} />
            : x.kind === 'joint'
              ? <meshStandardMaterial color={ASSEMBLY_COLORS.joiner} roughness={0.5} />
              : <meshStandardMaterial color={COMPONENT_COLORS.hatch} roughness={0.5} transparent opacity={0.45} depthWrite={false} side={THREE.DoubleSide} />}
        </mesh>
      ))}
      <Assembly balance={balance} showBands={!ex.active} />
      {balance.items.filter(i => i.size || i.kind === 'ballast').map(i => (
        i.kind === 'ballast' ? (
          <mesh key={i.id} position={[i.x, i.y, -i.s]}>
            <sphereGeometry args={[Math.cbrt(i.mass / 11.3 * 3 / (4 * Math.PI)) * 10, 16, 12]} />
            <meshStandardMaterial color={COMPONENT_COLORS.ballast} metalness={0.6} roughness={0.3} />
          </mesh>
        ) : (
          <mesh key={i.id} position={new THREE.Vector3(i.x, i.y, -i.s).add(new THREE.Vector3(...ex.byId(i.id)))}>
            <boxGeometry args={[i.size![0], i.size![1], i.size![2]]} />
            <meshStandardMaterial color={COMPONENT_COLORS[i.kind] ?? '#9ca3af'} roughness={0.5} />
          </mesh>
        )
      ))}
      {balance.linkages.map(l => {
        const lo = new THREE.Vector3(...ex.byId(l.id));
        const a = new THREE.Vector3(l.from[0], l.from[1], -l.from[2]).add(lo);
        const b = new THREE.Vector3(l.to[0], l.to[1], -l.to[2]).add(lo);
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const dir = b.clone().sub(a);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        return (
          <group key={l.id}>
            <mesh position={mid} quaternion={q}>
              <cylinderGeometry args={[0.8, 0.8, dir.length(), 8]} />
              <meshStandardMaterial color="#111827" metalness={0.7} roughness={0.3} />
            </mesh>
            {/* control horn */}
            <mesh position={b}>
              <boxGeometry args={[1.5, 10, 6]} />
              <meshStandardMaterial color="#f8fafc" />
            </mesh>
          </group>
        );
      })}
      {/* Tail pushrods: guide tube from the bay wall to the exit, and the holes to drill */}
      {balance.linkExits.map(ex2 => {
        const pts = [ex2.through, ex2.skin].filter((p): p is [number, number, number] => !!p).map(p => new THREE.Vector3(p[0], p[1], -p[2]));
        const tube = pts.length === 2 ? (() => {
          const d = pts[1].clone().sub(pts[0]);
          return { mid: pts[0].clone().add(pts[1]).multiplyScalar(0.5), len: d.length(), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()) };
        })() : null;
        return (
          <group key={ex2.id}>
            {tube && (
              <mesh position={tube.mid} quaternion={tube.q}>
                <cylinderGeometry args={[1.6, 1.6, tube.len, 10]} />
                <meshStandardMaterial color={ASSEMBLY_COLORS.guide} transparent opacity={0.55} depthWrite={false} />
              </mesh>
            )}
            {pts.map((p, i) => (
              <mesh key={i} position={p}>
                <sphereGeometry args={[3, 14, 10]} />
                <meshStandardMaterial color={ASSEMBLY_COLORS.drill} emissive={ASSEMBLY_COLORS.drill} emissiveIntensity={0.35} />
              </mesh>
            ))}
          </group>
        );
      })}
      {/* Target CG ring on the fuselage/wing centreline */}
      <mesh position={[0, L.wing.mountY / k, -balance.cgAchieved]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[Math.max(L.wing.rootChord / k * 0.05, 6), 1.2, 8, 32]} />
        <meshStandardMaterial color={Math.abs(balance.cgAchieved - balance.cgTarget) < 2 ? '#16a34a' : '#dc2626'} />
      </mesh>
    </group>
  );
}

const KIND_OFFSET: Record<string, number> = { wing: 0, aileron: 5, hstab: 2, elevator: 1, fin: 3, rudder: 1, winglet: 6, fuselage: 7 };
const SECTION_COLORS = ['#0ea5e9', '#f97316', '#22c55e', '#a855f7', '#eab308', '#ef4444', '#14b8a6', '#ec4899'];

/** Print sections (mm) drawn in their assembled position, alternating colours. */
function PrintSections({ L, airfoil, settings, pockets, explode }: { L: Layout; airfoil: AirfoilType; settings: PrintSettings; pockets: Pocket[]; explode: number }) {
  const ex = explodeOffsets(L, explode);
  const plan = useMemo(() => buildPrintPlan(L, airfoil, settings, pockets), [L, airfoil, settings, pockets]);
  useEffect(() => () => plan.sections.forEach(s => s.geometry.dispose()), [plan]);
  const mmToLayout = 1 / (L.toCm * 10);
  return (
    <group scale={mmToLayout}>
      {plan.sections.map(s => (
        <mesh key={s.name} geometry={s.geometry} position={ex.section(s)}>
          <meshStandardMaterial color={SECTION_COLORS[(s.index + (s.name.endsWith('b') ? 4 : 0) + KIND_OFFSET[s.kind]) % SECTION_COLORS.length]} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

const COLORS: Record<PartMesh['kind'], string> = {
  wing: '#0284c7',
  aileron: '#f97316',
  hstab: '#db2777',
  elevator: '#f97316',
  fin: '#eab308',
  rudder: '#f97316',
  winglet: '#eab308',
  fuselage: '#6b7280',
};

/** Keeps a WebGL / loader failure from blanking the whole application. */
class SceneErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: unknown) { console.error('3D view failed', err); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function PartMeshes({ parts, mirror, xray }: { parts: PartMesh[]; mirror?: boolean; xray?: boolean }) {
  return (
    <group scale={mirror ? [-1, 1, 1] : [1, 1, 1]}>
      {parts.map(p => (
        <mesh key={p.id} geometry={p.geometry} castShadow={!xray} receiveShadow>
          <meshStandardMaterial
            color={COLORS[p.kind]}
            roughness={p.kind === 'fuselage' ? 0.55 : 0.4}
            metalness={0.05}
            side={THREE.DoubleSide}
            transparent={xray}
            opacity={xray ? 0.28 : 1}
            depthWrite={!xray}
          />
        </mesh>
      ))}
    </group>
  );
}

function Powertrain({ L }: { L: Layout }) {
  const m = L.motor;
  const p = L.prop;
  const y = p.y;
  // All cylinders are built along Y and rotated to lie along Z
  const rot: [number, number, number] = [Math.PI / 2, 0, 0];
  const statorS = m.mountS + m.dir * m.length * 0.35;
  const bellS = m.mountS + m.dir * m.length * 0.75;
  const shaftS = m.mountS + m.dir * m.length * 1.1;
  const R = m.diameter / 2;
  const bladeLen = p.diameter / 2;
  const bladeW = p.diameter * 0.08;
  const bladeT = p.diameter * 0.012;
  return (
    <group>
      {/* Mount plate */}
      <mesh rotation={rot} position={[0, y, -m.mountS]}>
        <cylinderGeometry args={[R * 1.15, R * 1.15, m.length * 0.08, 24]} />
        <meshStandardMaterial color="#2d3748" roughness={0.6} metalness={0.4} />
      </mesh>
      {/* Stator */}
      <mesh rotation={rot} position={[0, y, -statorS]}>
        <cylinderGeometry args={[R * 0.85, R * 0.85, m.length * 0.5, 24]} />
        <meshStandardMaterial color="#374151" roughness={0.5} metalness={0.5} />
      </mesh>
      {/* Bell (rotor can) */}
      <mesh rotation={rot} position={[0, y, -bellS]}>
        <cylinderGeometry args={[R, R, m.length * 0.5, 24]} />
        <meshStandardMaterial color="#9ca3af" roughness={0.25} metalness={0.8} />
      </mesh>
      {/* Shaft */}
      <mesh rotation={rot} position={[0, y, -shaftS]}>
        <cylinderGeometry args={[R * 0.12, R * 0.12, m.length * 0.6, 12]} />
        <meshStandardMaterial color="#d1d5db" roughness={0.15} metalness={0.95} />
      </mesh>
      {/* Propeller: two blades + translucent disc showing the swept area */}
      <group position={[0, y, -p.s]}>
        {[-1, 1].map(side => (
          <mesh key={side} position={[side * bladeLen * 0.5, 0, 0]} rotation={[0, 0, 0]} scale={[bladeLen * 0.5, bladeW / 2, bladeT]}>
            <sphereGeometry args={[1, 16, 8]} />
            <meshStandardMaterial color="#111827" roughness={0.5} />
          </mesh>
        ))}
        <mesh>
          <sphereGeometry args={[R * 0.35, 12, 8]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh rotation={rot}>
          <cylinderGeometry args={[bladeLen, bladeLen, p.diameter * 0.002, 48]} />
          <meshStandardMaterial color="#111827" transparent opacity={0.12} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

function BalanceMarkers({ L }: { L: Layout }) {
  // CG shown as a sphere with a vertical post at the wing root
  const y = L.wing.mountY;
  const r = Math.max(L.wing.rootChord * 0.035, 0.4);
  return (
    <group>
      <mesh position={[0, y + r * 3, -L.cgS]}>
        <sphereGeometry args={[r, 16, 12]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh position={[0, y + r * 1.5, -L.cgS]}>
        <cylinderGeometry args={[r * 0.15, r * 0.15, r * 3, 8]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh position={[0, y + r * 3, -L.npS]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[r * 0.9, r * 1.8, 12]} />
        <meshStandardMaterial color="#f97316" />
      </mesh>
    </group>
  );
}

function Aircraft({ L, airfoil, isRotating, sections, printSettings, balance, pockets, explode }: { L: Layout; airfoil: AirfoilType; isRotating: boolean; sections: boolean; printSettings: PrintSettings; balance: BalanceResult | null; pockets: Pocket[]; explode: number }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current && isRotating) groupRef.current.rotation.y += delta * 0.25;
  });

  const parts = useMemo(() => buildAircraftParts(L, airfoil), [L, airfoil]);
  useEffect(() => () => disposeParts(parts), [parts]);
  const isWingPart = (p: PartMesh) => p.kind === 'wing' || p.kind === 'aileron' || p.kind === 'winglet';
  const wingR = parts.right.filter(isWingPart);
  const otherR = parts.right.filter(p => !isWingPart(p));
  const ex = explodeOffsets(L, explode);
  const toL = (v: V3): V3 => v.map(c => c / (L.toCm * 10)) as V3;

  // Centre the model on the origin (stations run along −Z)
  const midS = (L.bounds.sMin + L.bounds.sMax) / 2;
  const midY = (L.bounds.yMin + L.bounds.yMax) / 2;

  return (
    <group ref={groupRef} scale={L.toCm}>
      <group position={[0, -midY, midS]}>
        {sections ? (
          <PrintSections L={L} airfoil={airfoil} settings={printSettings} pockets={pockets} explode={explode} />
        ) : (
          <>
            <group position={toL(ex.wing(1))}><PartMeshes parts={wingR} xray={!!balance} /></group>
            <group position={toL(ex.wing(-1))}><PartMeshes parts={wingR} mirror xray={!!balance} /></group>
            <PartMeshes parts={otherR} xray={!!balance} />
            <PartMeshes parts={otherR} mirror xray={!!balance} />
            <PartMeshes parts={parts.center} xray={!!balance} />
          </>
        )}
        {balance && <Components L={L} balance={balance} airfoil={airfoil} pockets={pockets} explode={explode} />}
        <Powertrain L={L} />
        <BalanceMarkers L={L} />
      </group>
    </group>
  );
}

export default function Scene3D({ layout, airfoil, isDarkMode, printSettings, balance, pockets, explode, onExplode }: Scene3DProps) {
  const { t } = useTranslation();
  const [isRotating, setIsRotating] = useState(true);
  const [showSections, setShowSections] = useState(false);
  const [showComponents, setShowComponents] = useState(true);

  // Everything is rendered in centimetres
  const b = layout.bounds;
  const sizeCm = Math.max(b.xMax * 2, b.sMax - b.sMin, 10) * layout.toCm;
  const dist = sizeCm * 1.15;
  const floorY = -((b.yMax - b.yMin) / 2) * layout.toCm - sizeCm * 0.08;

  const fallback = (
    <div className="w-full h-full flex items-center justify-center p-6 text-center text-sm text-slate-500 dark:text-slate-400">
      {t('scene_error')}
    </div>
  );

  return (
    <div className="w-full h-full absolute inset-0 bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
      <SceneErrorBoundary fallback={fallback}>
        <Canvas
          key={layout.isFW ? 'fw' : 'conv'}
          camera={{ position: [dist * 0.75, dist * 0.45, dist * 0.8], fov: 38, near: 0.5, far: sizeCm * 20 }}
          shadows
        >
          <hemisphereLight args={[isDarkMode ? '#cbd5e1' : '#ffffff', '#475569', 0.9]} />
          <directionalLight position={[sizeCm, sizeCm * 1.5, sizeCm * 0.8]} intensity={1.6} castShadow />
          <directionalLight position={[-sizeCm, sizeCm * 0.3, -sizeCm]} intensity={0.35} />
          <Aircraft L={layout} airfoil={airfoil} isRotating={isRotating} sections={showSections} printSettings={printSettings} balance={showComponents && !showSections ? balance : null} pockets={pockets} explode={explode} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY, 0]} receiveShadow>
            <circleGeometry args={[sizeCm * 0.9, 64]} />
            <meshStandardMaterial color={isDarkMode ? '#1f2937' : '#e2e8f0'} transparent opacity={0.6} />
          </mesh>
          <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
        </Canvas>
      </SceneErrorBoundary>

      {/* Legend */}
      <div className="absolute top-3 left-3 flex flex-wrap gap-x-3 gap-y-1 text-xs bg-white/80 dark:bg-slate-900/70 backdrop-blur rounded-md px-2 py-1.5 text-slate-700 dark:text-slate-300 shadow-sm">
        <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded-sm" style={{ background: COLORS.aileron }} />{t(layout.isFW ? 'elevons' : 'control_surfaces_short')}</span>
        {showComponents && !showSections && balance && (
          <>
            <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded-sm" style={{ background: COMPONENT_COLORS.servo }} />{t('mb_servos')}</span>
            <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded-sm" style={{ background: COMPONENT_COLORS.battery }} />{t('mb_battery')}</span>
            <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded-sm" style={{ background: COMPONENT_COLORS.esc }} />ESC</span>
            <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded-sm" style={{ background: COMPONENT_COLORS.rx }} />RX</span>
            <span className="flex items-center gap-1"><i className="inline-block w-3 h-1.5 rounded-sm" style={{ background: COMPONENT_COLORS.spar }} />{t('mb_spars')}</span>
            <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded-sm border border-slate-300" style={{ background: COMPONENT_COLORS.mount }} />{t('stl_mounts')}</span>
            <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded-sm opacity-60" style={{ background: COMPONENT_COLORS.hatch }} />{t('stl_hatches')}</span>
            <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded-sm" style={{ background: ASSEMBLY_COLORS.joiner }} />{t('asm_joiner_short')}</span>
            {balance.assembly.bands && (
              <>
                <span className="flex items-center gap-1"><i className="inline-block w-3 h-1.5 rounded-sm" style={{ background: ASSEMBLY_COLORS.dowel }} />{t('asm_dowels_short')}</span>
                <span className="flex items-center gap-1"><i className="inline-block w-3 h-1 rounded-full" style={{ background: ASSEMBLY_COLORS.band }} />{t('asm_bands_short')}</span>
              </>
            )}
            {balance.linkExits.length > 0 && (
              <span className="flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: ASSEMBLY_COLORS.drill }} />{t('link_exit_short')}</span>
            )}
          </>
        )}
        <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded-full bg-slate-900 dark:bg-white" />CG</span>
        <span className="flex items-center gap-1"><i className="inline-block w-0 h-0 border-l-[6px] border-r-[6px] border-t-[10px] border-l-transparent border-r-transparent border-t-orange-500" />NP</span>
      </div>
      <div className="absolute bottom-2 right-3 text-xs text-slate-400 dark:text-slate-500 pointer-events-none">
        {t('drag_to_rotate')}
      </div>
      <div className="absolute top-14 right-3 flex flex-col items-stretch gap-1 text-xs bg-white/85 dark:bg-slate-900/75 backdrop-blur rounded-md px-2 py-1.5 shadow-sm text-slate-700 dark:text-slate-300 select-none">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showComponents} onChange={e => setShowComponents(e.target.checked)} className="accent-violet-600" />
          {t('show_components')}
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showSections} onChange={e => setShowSections(e.target.checked)} className="accent-emerald-600" />
          {t('show_print_sections')}
        </label>
        <label className="flex flex-col gap-1 pt-1 mt-0.5 border-t border-slate-200 dark:border-slate-700">
          <span className="flex items-center justify-between gap-2">{t('explode_view')}<b className="font-medium tabular-nums">{Math.round(explode * 100)}%</b></span>
          <input type="range" min={0} max={1} step={0.05} value={explode} onChange={e => onExplode(parseFloat(e.target.value))} className="accent-sky-600 w-36" aria-label={t('explode_view')} />
        </label>
      </div>
      <button
        onClick={() => setIsRotating(!isRotating)}
        className="absolute top-3 right-3 p-2 bg-white dark:bg-slate-800 rounded-full shadow-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        title={isRotating ? t('pause_rotation') : t('start_rotation')}
        aria-label={isRotating ? t('pause_rotation') : t('start_rotation')}
      >
        {isRotating ? <Pause size={20} /> : <Play size={20} />}
      </button>
    </div>
  );
}
