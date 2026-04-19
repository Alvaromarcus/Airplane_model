/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Play, Pause } from 'lucide-react';
import type { AircraftDimensions, AircraftType, AirfoilType } from '../utils/calculations';

interface Scene3DProps {
  dimensions: AircraftDimensions;
  aircraftType: AircraftType;
  unit: 'cm' | 'mm';
  airfoil: AirfoilType;
}

const AIRFOIL_CACHE: Record<string, THREE.Vector2[]> = {};

function getAirfoilPoints(type: AirfoilType | 'sym_tail') {
  if (AIRFOIL_CACHE[type]) return AIRFOIL_CACHE[type];
  
  const m = type === 'flat' ? 0.04 : type === 'semi' ? 0.02 : 0;
  const p = type === 'flat' ? 0.4 : type === 'semi' ? 0.4 : 0.1;
  const t = 0.12;

  const pointsUpper: THREE.Vector2[] = [];
  const pointsLower: THREE.Vector2[] = [];

  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const beta = (i / steps) * Math.PI;
    const x = 0.5 * (1 - Math.cos(beta));

    const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * Math.pow(x, 2) + 0.2843 * Math.pow(x, 3) - 0.1015 * Math.pow(x, 4));

    let yc = 0;
    let dyc_dx = 0;
    if (m > 0) {
      if (x <= p) {
        yc = (m / Math.pow(p, 2)) * (2 * p * x - Math.pow(x, 2));
        dyc_dx = (2 * m / Math.pow(p, 2)) * (p - x);
      } else {
        yc = (m / Math.pow(1 - p, 2)) * ((1 - 2 * p) + 2 * p * x - Math.pow(x, 2));
        dyc_dx = (2 * m / Math.pow(1 - p, 2)) * (p - x);
      }
    }

    const theta = Math.atan(dyc_dx);
    const xu = x - yt * Math.sin(theta);
    const yu = yc + yt * Math.cos(theta);
    const xl = x + yt * Math.sin(theta);
    let yl = yc - yt * Math.cos(theta);

    if (type === 'flat' && i > 0 && i < steps) {
      yl = Math.max(yl, -0.015);
    }

    pointsUpper.push(new THREE.Vector2(-xu, yu));
    pointsLower.push(new THREE.Vector2(-xl, yl));
  }

  pointsLower.reverse();
  const pts = [...pointsUpper, ...pointsLower];
  AIRFOIL_CACHE[type] = pts;
  return pts;
}

interface AircraftMeshProps extends Scene3DProps {
  isRotating: boolean;
}

function AircraftMesh({ dimensions: dims, aircraftType, unit, airfoil, isRotating }: AircraftMeshProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current && isRotating) {
      groupRef.current.rotation.y += delta * 0.25;
    }
  });

  // Normalize all dims to cm
  const s = unit === 'mm' ? 0.1 : 1;
  const WS  = Math.max(dims.wingspan * s, 1);
  const RC  = Math.max(dims.rootChord * s, 0.5);
  const TC  = Math.max(dims.tipChord * s, 0.1);
  const SW  = dims.sweepOffset * s;
  const FL  = Math.max(dims.fuselageLength * s, 1);
  const NL  = Math.max(dims.noseLength * s, 0.1);
  const HS  = Math.max(dims.hStabSpan * s, 0.1);
  const HC  = Math.max(dims.hStabChord * s, 0.1);
  const VS  = Math.max(dims.vStabSpan * s, 0.1);
  const VC  = Math.max(dims.vStabChord * s, 0.1);
  const WTT = dims.wingToTailDistance * s;

  // Scale factor: fit longest dimension into ~60 units
  const maxDim = Math.max(WS, FL);
  const F = 50 / maxDim;

  // Fuselage cross-section radius
  const fR = Math.max(2.5 * F, 1);
  // Wing thickness
  const thick = Math.max(1.5 * F, 0.5);

  // ─── Z positions (nose = positive Z, tail = negative Z) ───
  // We place the origin at the nose tip for simplicity,
  // then shift everything so the model is centered.
  const totalLength = FL * F;
  const noseTip     =  totalLength / 2;   // +Z

  // Wing LE Z position (measured from nose tip, going back)
  const wingLeZ = noseTip - NL * F;

  // Tail group Z
  const tailLeZ  = noseTip - (NL + RC + WTT) * F;
  
  const dihedralRad = (dims.dihedral || 0) * (Math.PI / 180);

  // ─── Build tapered wing geometry (right half only) ───
  const createWingGeometry = (span: number, rootC: number, tipC: number, sweep: number, airfoilType: AirfoilType | 'sym_tail') => {
    const hw = (span / 2) * F;
    
    const shape = new THREE.Shape(getAirfoilPoints(airfoilType));
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: hw,
      bevelEnabled: false,
      steps: 1
    });

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i); 
      const y = pos.getY(i); 
      const z = pos.getZ(i); 

      const spanFrac = z / hw;
      const localChord = (rootC * F) + ((tipC * F) - (rootC * F)) * spanFrac;
      const localSweep = (sweep * F) * spanFrac;

      const finalX = z;
      const finalY = (-x) * localChord + localSweep;
      const finalZ = y * localChord * 0.8; // slightly thinner for aesthetics

      pos.setXYZ(i, finalX, finalY, finalZ);
    }
    geo.computeVertexNormals();
    return geo;
  };

  const wingGeo  = createWingGeometry(WS, RC, TC, SW, airfoil);
  const hStabGeo = createWingGeometry(HS, HC, HC * 0.75, HC * 0.25, 'sym_tail');
  const vStabGeo = createWingGeometry(VS * 2, VC, VC * 0.6,  VC * 0.4, 'sym_tail');

  const createAileronGeo = (span: number, rootC: number, tipC: number, sweep: number, isFlyingWing: boolean) => {
    const hw = (span / 2) * F;
    const startFrac = isFlyingWing ? 0.35 : 0.5;
    const endFrac = isFlyingWing ? 1.0 : 0.95;

    const zStart = hw * startFrac;
    const zEnd = hw * endFrac;

    const lcStart = (rootC * F) + ((tipC * F) - (rootC * F)) * startFrac;
    const lcEnd = (rootC * F) + ((tipC * F) - (rootC * F)) * endFrac;

    const swStart = (sweep * F) * startFrac;
    const swEnd = (sweep * F) * endFrac;

    const teYStart = -1 * lcStart + swStart;
    const teYEnd = -1 * lcEnd + swEnd;

    const hingeYStart = -0.75 * lcStart + swStart;
    const hingeYEnd = -0.75 * lcEnd + swEnd;

    const zOffset = F * 0.05;

    const pts = [];
    pts.push(new THREE.Vector3(zStart, hingeYStart, zOffset));
    pts.push(new THREE.Vector3(zEnd, hingeYEnd, zOffset));
    pts.push(new THREE.Vector3(zEnd, teYEnd, zOffset));
    pts.push(new THREE.Vector3(zStart, teYStart, zOffset));
    pts.push(new THREE.Vector3(zStart, hingeYStart, zOffset));

    return new THREE.BufferGeometry().setFromPoints(pts);
  };

  const aileronGeo = createAileronGeo(WS, RC, TC, SW, aircraftType === 'flying_wing');

  // Colors
  const C = {
    fuse:  '#5a6270',
    nose:  '#374151',
    wing:  '#0284c7',
    hStab: '#db2777',
    vStab: '#ca8a04',
  };

  // Wing rotation: lays the shape flat (chord goes towards -Z, span along X)
  const wingRot: [number, number, number] = [-Math.PI / 2, 0, 0];

  return (
    <group ref={groupRef}>

      {/* ── Fuselage body (conventional only) ── */}
      {aircraftType === 'conventional' && (
        <group>
          {/* Rectangular tube */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[fR * 1.2, fR * 1.5, totalLength]} />
            <meshStandardMaterial color={C.fuse} roughness={0.6} />
          </mesh>
          {/* Propeller disc at the nose */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, noseTip + 0.1 * F]}>
            <cylinderGeometry args={[fR * 2.5, fR * 2.5, 0.2 * F, 16]} />
            <meshStandardMaterial color="#000000" transparent opacity={0.3} />
          </mesh>
        </group>
      )}

      {/* ── Right wing ── */}
      <group position={[0, 0, wingLeZ]} rotation={[0, 0, dihedralRad]}>
        <mesh rotation={wingRot}>
          <primitive object={wingGeo} />
          <meshStandardMaterial color={C.wing} roughness={0.35} side={THREE.DoubleSide} />
          <line>
            <primitive object={aileronGeo} attach="geometry" />
            <lineBasicMaterial color={C.nose} linewidth={2} />
          </line>
        </mesh>
        {/* Flying wing winglets */}
        {aircraftType === 'flying_wing' && (
          <mesh position={[(WS / 2) * F, VS * F / 2, -SW * F - TC * F / 2]}>
            <boxGeometry args={[thick, VS * F, VC * F]} />
            <meshStandardMaterial color={C.vStab} roughness={0.4} />
          </mesh>
        )}
      </group>

      {/* ── Left wing (mirror on X axis) ── */}
      <group position={[0, 0, wingLeZ]} rotation={[0, 0, -dihedralRad]}>
        <mesh rotation={wingRot} scale={[-1, 1, 1]}>
          <primitive object={wingGeo.clone()} />
          <meshStandardMaterial color={C.wing} roughness={0.35} side={THREE.DoubleSide} />
          <line>
            <primitive object={aileronGeo} attach="geometry" />
            <lineBasicMaterial color={C.nose} linewidth={2} />
          </line>
        </mesh>
        {/* Flying wing winglets */}
        {aircraftType === 'flying_wing' && (
          <mesh position={[-(WS / 2) * F, VS * F / 2, -SW * F - TC * F / 2]}>
            <boxGeometry args={[thick, VS * F, VC * F]} />
            <meshStandardMaterial color={C.vStab} roughness={0.4} />
          </mesh>
        )}
      </group>

      {/* ── Conventional tail surfaces ── */}
      {aircraftType === 'conventional' && (
        <group>
          {/* H-Stab right */}
          <mesh rotation={wingRot} position={[0, 0, tailLeZ]}>
            <primitive object={hStabGeo} />
            <meshStandardMaterial color={C.hStab} roughness={0.4} side={THREE.DoubleSide} />
          </mesh>
          {/* H-Stab left */}
          <mesh rotation={wingRot} position={[0, 0, tailLeZ]} scale={[-1, 1, 1]}>
            <primitive object={hStabGeo.clone()} />
            <meshStandardMaterial color={C.hStab} roughness={0.4} side={THREE.DoubleSide} />
          </mesh>

          {/* V-Stab (vertical fin) */}
          <group position={[0, fR * 1.5 / 2, tailLeZ]} rotation={[0, 0, Math.PI / 2]}>
            <mesh rotation={wingRot} position={[0, -thick * 0.7 / 2, 0]}>
              <primitive object={vStabGeo.clone()} />
              <meshStandardMaterial color={C.vStab} roughness={0.4} side={THREE.DoubleSide} />
            </mesh>
          </group>
        </group>
      )}

      {/* ── Ground shadow ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -fR * 4, 0]}>
        <planeGeometry args={[WS * F * 1.4, FL * F * 1.4]} />
        <meshStandardMaterial color="#000" transparent opacity={0.07} />
      </mesh>
    </group>
  );
}

export default function Scene3D({ dimensions, aircraftType, unit, airfoil }: Scene3DProps) {
  const [isRotating, setIsRotating] = useState(true);

  const s = unit === 'mm' ? 0.1 : 1;
  const span = Math.max(dimensions.wingspan * s, 1);
  const len  = Math.max(dimensions.fuselageLength * s, 1);
  const maxD = Math.max(span, len);
  const dist = (50 / maxD) * maxD * 1.8;

  return (
    <div className="w-full h-full absolute inset-0 bg-gray-50 dark:bg-gray-800">
      <Canvas
        camera={{ position: [dist * 0.7, dist * 0.5, dist * 0.9], fov: 38 }}
        shadows
      >
        <color attach="background" args={['transparent']} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[40, 60, 40]} intensity={1.3} castShadow />
        <directionalLight position={[-20, 10, -20]} intensity={0.25} />
        <AircraftMesh dimensions={dimensions} aircraftType={aircraftType} unit={unit} airfoil={airfoil} isRotating={isRotating} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
        <Environment preset="sunset" />
      </Canvas>
      <div className="absolute bottom-2 right-3 text-xs text-gray-400 dark:text-gray-500 pointer-events-none">
        Drag to rotate · Scroll to zoom
      </div>
      <button
        onClick={() => setIsRotating(!isRotating)}
        className="absolute top-4 right-4 p-2 bg-white dark:bg-gray-800 rounded-full shadow-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        title={isRotating ? "Pause rotation" : "Start rotation"}
      >
        {isRotating ? <Pause size={20} /> : <Play size={20} />}
      </button>
    </div>
  );
}
