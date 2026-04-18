import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import type { AircraftDimensions, AircraftType } from '../utils/calculations';

interface Scene3DProps {
  dimensions: AircraftDimensions;
  aircraftType: AircraftType;
  unit: 'cm' | 'mm';
}

function AircraftMesh({ dimensions: dims, aircraftType, unit }: Scene3DProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
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
  // Shape in local XY plane, then extruded along local Z (thickness).
  // After rotation [-PI/2, 0, 0]: local X→world X, local Y→world Z, local Z→world Y
  const buildWing = (span: number, rootC: number, tipC: number, sweep: number, t: number) => {
    const hw = (span / 2) * F;
    const rc = rootC * F;
    const tc = tipC  * F;
    const sw = sweep  * F;

    const shape = new THREE.Shape();
    shape.moveTo(0,   0);          // root LE
    shape.lineTo(hw,  sw);         // tip LE (swept back)
    shape.lineTo(hw,  sw + tc);    // tip TE
    shape.lineTo(0,   rc);         // root TE
    shape.closePath();

    return new THREE.ExtrudeGeometry(shape, {
      depth: t,
      bevelEnabled: true,
      bevelSize: t * 0.15,
      bevelThickness: t * 0.15,
      bevelSegments: 2,
    });
  };

  const wingGeo  = buildWing(WS, RC, TC, SW, thick);
  const hStabGeo = buildWing(HS, HC, HC * 0.75, 0, thick * 0.75);
  const vStabGeo = buildWing(VS, VC, VC * 0.6,  0, thick * 0.7);

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

      {/* ── Fuselage body (cylinder along Z) ── */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <cylinderGeometry args={[fR, fR * 0.85, totalLength * 0.82, 10]} />
        <meshStandardMaterial color={C.fuse} roughness={0.6} />
      </mesh>

      {/* ── Nose cone (points toward +Z) ── */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, noseTip - NL * F * 0.3]}>
        <coneGeometry args={[fR, NL * F * 1.4, 10]} />
        <meshStandardMaterial color={C.nose} roughness={0.5} />
      </mesh>

      {/* ── Right wing ── */}
      <group position={[0, 0, wingLeZ]} rotation={[0, 0, dihedralRad]}>
        <mesh rotation={wingRot}>
          <primitive object={wingGeo} />
          <meshStandardMaterial color={C.wing} roughness={0.35} side={THREE.DoubleSide} />
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
          <mesh
            rotation={[-Math.PI / 2, 0, Math.PI / 2]}
            position={[(thick * 0.7) / 2, 0, tailLeZ]}
          >
            <primitive object={vStabGeo.clone()} />
            <meshStandardMaterial color={C.vStab} roughness={0.4} side={THREE.DoubleSide} />
          </mesh>
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

export default function Scene3D({ dimensions, aircraftType, unit }: Scene3DProps) {
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
        <AircraftMesh dimensions={dimensions} aircraftType={aircraftType} unit={unit} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
        <Environment preset="sunset" />
      </Canvas>
      <div className="absolute bottom-2 right-3 text-xs text-gray-400 dark:text-gray-500 pointer-events-none">
        Drag to rotate · Scroll to zoom
      </div>
    </div>
  );
}
