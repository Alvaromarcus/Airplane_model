import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import type { AircraftDimensions, AircraftType } from '../utils/calculations';

interface Scene3DProps {
  dimensions: AircraftDimensions;
  aircraftType: AircraftType;
  unit: 'cm' | 'mm';
}

function AircraftModel({ dimensions: dims, aircraftType, unit }: Scene3DProps) {
  // Scale everything down so it fits nicely in the viewport
  // If unit is mm, dimensions are ~10x larger, so we need a larger scaling factor
  const baseScale = unit === 'mm' ? 0.05 : 0.5;

  const fuselageLength = dims.fuselageLength * baseScale;
  const fuselageWidth = 10 * (unit === 'mm' ? 10 : 1) * baseScale;
  const wingspan = dims.wingspan * baseScale;
  const rootChord = dims.rootChord * baseScale;
  const tipChord = dims.tipChord * baseScale;
  const sweepOffset = dims.sweepOffset * baseScale;
  const noseLength = dims.noseLength * baseScale;

  const wingThickness = 2 * (unit === 'mm' ? 10 : 1) * baseScale;

  // Create wing geometry
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0); // Root LE
  wingShape.lineTo(wingspan / 2, -sweepOffset); // Tip LE
  wingShape.lineTo(wingspan / 2, -sweepOffset - tipChord); // Tip TE
  wingShape.lineTo(0, -rootChord); // Root TE
  wingShape.lineTo(-wingspan / 2, -sweepOffset - tipChord); // Left Tip TE
  wingShape.lineTo(-wingspan / 2, -sweepOffset); // Left Tip LE
  wingShape.lineTo(0, 0); // Root LE again

  const extrudeSettings = {
    depth: wingThickness,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: wingThickness / 4,
    bevelThickness: wingThickness / 4,
  };

  const wingGeometry = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);

  return (
    <group>
      {/* Fuselage */}
      <mesh position={[0, wingThickness / 2, -fuselageLength / 2 + noseLength]}>
        {aircraftType === 'conventional' ? (
          <boxGeometry args={[fuselageWidth, fuselageWidth, fuselageLength]} />
        ) : (
          <boxGeometry args={[fuselageWidth, fuselageWidth, rootChord]} />
        )}
        <meshStandardMaterial color="#4b5563" />
      </mesh>

      {/* Wing */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <primitive object={wingGeometry} />
        <meshStandardMaterial color="#0284c7" />
      </mesh>

      {/* Dihedral representation is complex with ExtrudeGeometry, keeping flat for simplicity for now */}

      {aircraftType === 'conventional' && (
        <group position={[0, wingThickness / 2, -dims.wingToTailDistance * baseScale - rootChord]}>
          {/* Horizontal Stabilizer */}
          <mesh>
            <boxGeometry args={[dims.hStabSpan * baseScale, wingThickness * 0.8, dims.hStabChord * baseScale]} />
            <meshStandardMaterial color="#be185d" />
          </mesh>

          {/* Vertical Stabilizer */}
          <mesh position={[0, dims.vStabSpan * baseScale / 2, 0]}>
            <boxGeometry args={[wingThickness * 0.8, dims.vStabSpan * baseScale, dims.vStabChord * baseScale]} />
            <meshStandardMaterial color="#a16207" />
          </mesh>
        </group>
      )}

      {aircraftType === 'flying_wing' && (
         <group>
            {/* Winglets for flying wing */}
            <mesh position={[wingspan / 2, dims.vStabSpan * baseScale / 2, -sweepOffset - tipChord + dims.vStabChord * baseScale / 2]}>
               <boxGeometry args={[wingThickness * 0.8, dims.vStabSpan * baseScale, dims.vStabChord * baseScale]} />
               <meshStandardMaterial color="#a16207" />
            </mesh>
            <mesh position={[-wingspan / 2, dims.vStabSpan * baseScale / 2, -sweepOffset - tipChord + dims.vStabChord * baseScale / 2]}>
               <boxGeometry args={[wingThickness * 0.8, dims.vStabSpan * baseScale, dims.vStabChord * baseScale]} />
               <meshStandardMaterial color="#a16207" />
            </mesh>
         </group>
      )}

    </group>
  );
}

export default function Scene3D({ dimensions, aircraftType, unit }: Scene3DProps) {
  return (
    <div className="w-full h-full absolute inset-0 bg-gray-100 dark:bg-gray-800">
      <Canvas camera={{ position: [50, 50, 50], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <AircraftModel dimensions={dimensions} aircraftType={aircraftType} unit={unit} />
        <OrbitControls makeDefault />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}
