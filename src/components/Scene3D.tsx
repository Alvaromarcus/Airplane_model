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

  // Gentle auto-rotation
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
    }
  });

  // Normalize to cm internally so scale stays sane
  const s = unit === 'mm' ? 0.1 : 1;
  const WS  = dims.wingspan      * s;  // wingspan
  const RC  = dims.rootChord     * s;  // root chord
  const TC  = dims.tipChord      * s;  // tip chord
  const SW  = dims.sweepOffset   * s;  // sweep
  const FL  = dims.fuselageLength * s; // fuselage length
  const NL  = dims.noseLength    * s;  // nose length
  const HS  = dims.hStabSpan     * s;  // h-stab span
  const HC  = dims.hStabChord    * s;  // h-stab chord
  const VS  = dims.vStabSpan     * s;  // v-stab span
  const VC  = dims.vStabChord    * s;  // v-stab chord
  const WTT = dims.wingToTailDistance * s;

  // Fit everything into a ~100-unit bounding box for camera
  const maxDim = Math.max(WS, FL, 1);
  const F = 60 / maxDim; // scale factor to fit in view

  const fw = 3 * F;   // fuselage cross-section half-width
  const fh = 3 * F;   // fuselage cross-section half-height
  const thick = 1.2 * F; // wing thickness

  // Colors
  const fuselageColor  = '#6b7280';
  const wingColor      = '#0284c7';
  const hStabColor     = '#db2777';
  const vStabColor     = '#ca8a04';
  const noseColor      = '#374151';

  // Build wing geometry (tapered trapezoid extruded)
  const buildWingGeometry = (
    span: number, rootC: number, tipC: number, sweep: number, t: number
  ): THREE.BufferGeometry => {
    const hw = (span / 2) * F;
    const rc = rootC * F;
    const tc = tipC  * F;
    const sw = sweep  * F;
    const halfT = t / 2;

    // Right half wing outline (top-down, Z = forward = negative in THREE.js convention)
    // We'll build using ShapeGeometry
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);                     // root LE
    shape.lineTo(hw, -sw);                  // tip LE
    shape.lineTo(hw, -sw - tc);             // tip TE
    shape.lineTo(0, -rc);                   // root TE
    shape.closePath();

    const extrudeSettings = {
      depth: t,
      bevelEnabled: true,
      bevelSize: halfT * 0.3,
      bevelThickness: halfT * 0.3,
      bevelSegments: 2,
    };
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  };

  // Wing offset: wing LE starts at noseLength from nose
  const wingLEz = -(NL * F); // negative Z = forward in scene

  return (
    <group ref={groupRef}>
      {/* === FUSELAGE BODY === */}
      {/* Main cylinder-ish body */}
      <mesh position={[0, 0, -(FL * F / 2 - NL * F / 2)]}>
        <cylinderGeometry
          args={[fw, fh, (FL - NL * 0.5) * F, 8]}
        />
        <meshStandardMaterial color={fuselageColor} roughness={0.6} />
      </mesh>

      {/* Nose cone */}
      <mesh position={[0, 0, (NL * 0.8) * F]}
            rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[fw, NL * F * 1.2, 8]} />
        <meshStandardMaterial color={noseColor} roughness={0.5} />
      </mesh>

      {/* === RIGHT WING === */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, wingLEz]}
      >
        <primitive object={buildWingGeometry(WS, RC, TC, SW, thick)} />
        <meshStandardMaterial color={wingColor} roughness={0.4} />
      </mesh>

      {/* === LEFT WING (mirror) === */}
      <mesh
        rotation={[-Math.PI / 2, 0, Math.PI]}
        position={[0, 0, -(wingLEz + RC * F)]}
        scale={[-1, 1, 1]}
      >
        <primitive
          object={buildWingGeometry(WS, RC, TC, SW, thick).clone()}
        />
        <meshStandardMaterial color={wingColor} roughness={0.4} />
      </mesh>

      {/* === CONVENTIONAL TAIL === */}
      {aircraftType === 'conventional' && (() => {
        const tailZ = -(NL + RC + WTT) * F;
        return (
          <group position={[0, 0, tailZ]}>
            {/* Horizontal Stabilizer */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <primitive
                object={buildWingGeometry(HS, HC, HC * 0.7, 0, thick * 0.8)}
              />
              <meshStandardMaterial color={hStabColor} roughness={0.4} />
            </mesh>
            <mesh
              rotation={[-Math.PI / 2, 0, Math.PI]}
              position={[0, 0, -HC * F]}
              scale={[-1, 1, 1]}
            >
              <primitive
                object={buildWingGeometry(HS, HC, HC * 0.7, 0, thick * 0.8).clone()}
              />
              <meshStandardMaterial color={hStabColor} roughness={0.4} />
            </mesh>

            {/* Vertical Stabilizer */}
            <mesh rotation={[0, 0, -Math.PI / 2]} position={[0, VS * F / 2, 0]}>
              <primitive
                object={buildWingGeometry(VS, VC, VC * 0.6, 0, thick * 0.7)}
              />
              <meshStandardMaterial color={vStabColor} roughness={0.4} />
            </mesh>
          </group>
        );
      })()}

      {/* === FLYING WING WINGLETS === */}
      {aircraftType === 'flying_wing' && (() => {
        const tipX = (WS / 2) * F;
        const tipZ = -(SW + TC / 2) * F + wingLEz;
        return (
          <>
            <mesh position={[tipX, VS * F / 2, tipZ]}>
              <boxGeometry args={[thick, VS * F, VC * F]} />
              <meshStandardMaterial color={vStabColor} roughness={0.4} />
            </mesh>
            <mesh position={[-tipX, VS * F / 2, tipZ]}>
              <boxGeometry args={[thick, VS * F, VC * F]} />
              <meshStandardMaterial color={vStabColor} roughness={0.4} />
            </mesh>
          </>
        );
      })()}

      {/* Ground shadow plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -fh * 3, 0]}>
        <planeGeometry args={[WS * F * 1.5, FL * F * 1.5]} />
        <meshStandardMaterial
          color="#000000"
          transparent
          opacity={0.08}
        />
      </mesh>
    </group>
  );
}

export default function Scene3D({ dimensions, aircraftType, unit }: Scene3DProps) {
  // Compute a good camera distance from wingspan
  const s = unit === 'mm' ? 0.1 : 1;
  const span = dimensions.wingspan * s;
  const camDist = Math.max(80, span * 1.2);

  return (
    <div className="w-full h-full absolute inset-0 bg-gray-50 dark:bg-gray-800">
      <Canvas
        camera={{ position: [camDist * 0.6, camDist * 0.4, camDist * 0.6], fov: 40 }}
        shadows
      >
        <color attach="background" args={['transparent']} />
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[50, 80, 30]}
          intensity={1.2}
          castShadow
        />
        <directionalLight position={[-30, 20, -30]} intensity={0.3} />
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
