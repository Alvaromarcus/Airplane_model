import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Play, Pause } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AirfoilType } from '../utils/calculations';
import type { Layout } from '../utils/geometry';
import { buildAircraftParts, disposeParts, type PartMesh } from '../utils/mesh';

interface Scene3DProps {
  layout: Layout;
  airfoil: AirfoilType;
  isDarkMode: boolean;
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

function PartMeshes({ parts, mirror }: { parts: PartMesh[]; mirror?: boolean }) {
  return (
    <group scale={mirror ? [-1, 1, 1] : [1, 1, 1]}>
      {parts.map(p => (
        <mesh key={p.id} geometry={p.geometry} castShadow receiveShadow>
          <meshStandardMaterial
            color={COLORS[p.kind]}
            roughness={p.kind === 'fuselage' ? 0.55 : 0.4}
            metalness={0.05}
            side={THREE.DoubleSide}
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

function Aircraft({ L, airfoil, isRotating }: { L: Layout; airfoil: AirfoilType; isRotating: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current && isRotating) groupRef.current.rotation.y += delta * 0.25;
  });

  const parts = useMemo(() => buildAircraftParts(L, airfoil), [L, airfoil]);
  useEffect(() => () => disposeParts(parts), [parts]);

  // Centre the model on the origin (stations run along −Z)
  const midS = (L.bounds.sMin + L.bounds.sMax) / 2;
  const midY = (L.bounds.yMin + L.bounds.yMax) / 2;

  return (
    <group ref={groupRef} scale={L.toCm}>
      <group position={[0, -midY, midS]}>
        <PartMeshes parts={parts.right} />
        <PartMeshes parts={parts.right} mirror />
        <PartMeshes parts={parts.center} />
        <Powertrain L={L} />
        <BalanceMarkers L={L} />
      </group>
    </group>
  );
}

export default function Scene3D({ layout, airfoil, isDarkMode }: Scene3DProps) {
  const { t } = useTranslation();
  const [isRotating, setIsRotating] = useState(true);

  // Everything is rendered in centimetres
  const b = layout.bounds;
  const sizeCm = Math.max(b.xMax * 2, b.sMax - b.sMin, 10) * layout.toCm;
  const dist = sizeCm * 1.35;
  const floorY = -((b.yMax - b.yMin) / 2) * layout.toCm - sizeCm * 0.08;

  const fallback = (
    <div className="w-full h-full flex items-center justify-center p-6 text-center text-sm text-gray-500 dark:text-gray-400">
      {t('scene_error')}
    </div>
  );

  return (
    <div className="w-full h-full absolute inset-0 bg-gradient-to-b from-slate-100 to-slate-200 dark:from-gray-800 dark:to-gray-900">
      <SceneErrorBoundary fallback={fallback}>
        <Canvas
          key={layout.isFW ? 'fw' : 'conv'}
          camera={{ position: [dist * 0.75, dist * 0.45, dist * 0.8], fov: 38, near: 0.5, far: sizeCm * 20 }}
          shadows
        >
          <hemisphereLight args={[isDarkMode ? '#cbd5e1' : '#ffffff', '#475569', 0.9]} />
          <directionalLight position={[sizeCm, sizeCm * 1.5, sizeCm * 0.8]} intensity={1.6} castShadow />
          <directionalLight position={[-sizeCm, sizeCm * 0.3, -sizeCm]} intensity={0.35} />
          <Aircraft L={layout} airfoil={airfoil} isRotating={isRotating} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY, 0]} receiveShadow>
            <circleGeometry args={[sizeCm * 0.9, 64]} />
            <meshStandardMaterial color={isDarkMode ? '#1f2937' : '#e2e8f0'} transparent opacity={0.6} />
          </mesh>
          <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
        </Canvas>
      </SceneErrorBoundary>

      {/* Legend */}
      <div className="absolute top-3 left-3 flex flex-wrap gap-x-3 gap-y-1 text-xs bg-white/80 dark:bg-gray-900/70 backdrop-blur rounded-md px-2 py-1.5 text-gray-700 dark:text-gray-300 shadow-sm">
        <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded-sm" style={{ background: COLORS.aileron }} />{t(layout.isFW ? 'elevons' : 'control_surfaces_short')}</span>
        <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded-full bg-gray-900" />CG</span>
        <span className="flex items-center gap-1"><i className="inline-block w-0 h-0 border-l-[6px] border-r-[6px] border-t-[10px] border-l-transparent border-r-transparent border-t-orange-500" />NP</span>
      </div>
      <div className="absolute bottom-2 right-3 text-xs text-gray-400 dark:text-gray-500 pointer-events-none">
        {t('drag_to_rotate')}
      </div>
      <button
        onClick={() => setIsRotating(!isRotating)}
        className="absolute top-3 right-3 p-2 bg-white dark:bg-gray-800 rounded-full shadow-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        title={isRotating ? t('pause_rotation') : t('start_rotation')}
        aria-label={isRotating ? t('pause_rotation') : t('start_rotation')}
      >
        {isRotating ? <Pause size={20} /> : <Play size={20} />}
      </button>
    </div>
  );
}
