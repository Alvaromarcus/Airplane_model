/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Play, Pause } from 'lucide-react';
import type { AircraftDimensions, AircraftType, AirfoilType, FuselageType } from '../utils/calculations';

interface Scene3DProps {
  dimensions: AircraftDimensions;
  aircraftType: AircraftType;
  unit: 'cm' | 'mm';
  airfoil: AirfoilType;
  fuselageStyle?: FuselageType;
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

function AircraftMesh({ dimensions: dims, aircraftType, unit, airfoil, fuselageStyle = 'trainer', isRotating }: AircraftMeshProps) {
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
  const createWingGeometry = (span: number, rootC: number, tipC: number, sweep: number, airfoilType: AirfoilType | 'sym_tail', csStartFrac: number | null, csEndFrac: number | null, csChordFrac: number | null) => {
    const hw = (span / 2) * F;
    
    const shape = new THREE.Shape(getAirfoilPoints(airfoilType));
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: hw,
      bevelEnabled: false,
      steps: csStartFrac !== null ? 40 : 1
    });

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i); 
      const y = pos.getY(i); 
      const z = pos.getZ(i); 

      const spanFrac = z / hw;
      
      if (csStartFrac !== null && csEndFrac !== null && csChordFrac !== null) {
        if (spanFrac >= csStartFrac - 0.001 && spanFrac <= csEndFrac + 0.001) {
          const cutX = - (1 - csChordFrac) + 0.02; // leaves a physical gap of 2%
          if (x < cutX) {
            x = cutX; 
          }
        }
      }

      const localChord = (rootC * F) + ((tipC * F) - (rootC * F)) * spanFrac;
      const localSweep = (sweep * F) * spanFrac;

      const finalX = z;
      const finalY = (-x) * localChord + localSweep;
      const finalZ = y * localChord * 0.8; 

      pos.setXYZ(i, finalX, finalY, finalZ);
    }
    geo.computeVertexNormals();
    return geo;
  };

  const aileronStart = aircraftType === 'flying_wing' ? 0.35 : 0.5;
  const aileronEnd = aircraftType === 'flying_wing' ? 1.0 : 0.95;

  const wingGeo  = createWingGeometry(WS, RC, TC, SW, airfoil, aileronStart, aileronEnd, 0.25);
  const hStabGeo = createWingGeometry(HS, HC, HC * 0.75, HC * 0.25, 'sym_tail', 0.0, 1.0, 0.3);
  const vStabGeo = createWingGeometry(VS * 2, VC, VC * 0.6,  VC * 0.4, 'sym_tail', 0.0, 1.0, 0.4);
  const wingletGeo = createWingGeometry(VS * 2, VC, VC * 0.4, VC * 0.6, 'sym_tail', null, null, null);

  const createControlSurfaceGeo = (span: number, rootC: number, tipC: number, sweep: number, startFrac: number, endFrac: number, chordFrac: number) => {
    const hw = (span / 2) * F;
    
    const zStart = hw * startFrac;
    const zEnd = hw * endFrac;

    const lcStart = (rootC * F) + ((tipC * F) - (rootC * F)) * startFrac;
    const lcEnd = (rootC * F) + ((tipC * F) - (rootC * F)) * endFrac;

    const swStart = (sweep * F) * startFrac;
    const swEnd = (sweep * F) * endFrac;

    const teYStart = 1 * lcStart + swStart;
    const teYEnd = 1 * lcEnd + swEnd;

    const hingeYStart = (1 - chordFrac) * lcStart + swStart;
    const hingeYEnd = (1 - chordFrac) * lcEnd + swEnd;

    const shape = new THREE.Shape();
    shape.moveTo(zStart, hingeYStart);
    shape.lineTo(zEnd, hingeYEnd);
    shape.lineTo(zEnd, teYEnd);
    shape.lineTo(zStart, teYStart);
    shape.lineTo(zStart, hingeYStart);

    const geo = new THREE.ExtrudeGeometry(shape, { depth: F * 0.04, bevelEnabled: false });
    geo.translate(0, 0, -F * 0.02);

    return geo;
  };

  const aileronGeo = createControlSurfaceGeo(WS, RC, TC, SW, aileronStart, aileronEnd, 0.25);
  const elevatorGeo = createControlSurfaceGeo(HS, HC, HC * 0.75, HC * 0.25, 0.0, 1.0, 0.3);
  const rudderGeo = createControlSurfaceGeo(VS * 2, VC, VC * 0.6, VC * 0.4, 0.0, 1.0, 0.4);

  // Colors
  const C = {
    fuse:  '#5a6270',
    nose:  '#374151',
    wing:  '#0284c7',
    hStab: '#db2777',
    vStab: '#ca8a04',
  };

  const createFuselageGeo = () => {
    // Sport fuse is a bit more streamlined, trainer is boxy
    const isSport = fuselageStyle === 'sport';
    const widthFactor = isSport ? 1.0 : 1.2;
    const heightFactor = isSport ? 1.2 : 1.5;
    
    // Add more depthSegments for sport canopy
    const segments = isSport ? 4 : 2;
    const geo = new THREE.BoxGeometry(fR * widthFactor, fR * heightFactor, totalLength, 1, 1, segments);
    const pos = geo.attributes.position;
    const wingTeZ = noseTip - (NL + RC) * F;
    const wingLeZ = noseTip - NL * F;
    
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      if (isSport) {
        // More complex shape for sport
        const zFraction = (noseTip - z) / totalLength; // 0 to 1
        
        if (zFraction < 0.2) {
          // Nose section - make it slightly pointed
          z = noseTip - zFraction * (NL * F);
          if (z === noseTip) {
            x *= 0.5; // narrow nose
            y *= 0.5;
          }
        } else if (zFraction >= 0.2 && zFraction < 0.6) {
          // Canopy/Wing section
          z = wingLeZ - (zFraction - 0.2) * 2.5 * (RC * F);
          if (y > 0) {
             y *= 1.2; // bubble canopy
          }
        } else {
          // Tail section
          z = wingTeZ - (zFraction - 0.6) * 2.5 * (totalLength - NL * F - RC * F);
          // Taper to tail
          const tailFrac = Math.max(0, (wingTeZ - z) / (totalLength - NL * F - RC * F));
          x *= (1 - 0.7 * tailFrac);
          y *= (1 - 0.5 * tailFrac);
        }
      } else {
        // Trainer shape (classic flat bottom taper)
        if (Math.abs(z - 0) < 0.01) {
          z = wingTeZ; 
        }

        if (z < wingTeZ - 0.01) {
          x *= 0.3; 
          y *= 0.6; 
          // move y up to keep bottom flat
          if (y < 0) {
            y += (fR * heightFactor / 2) * 0.4;
          }
        }
      }
      
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  };

  const fuseGeo = createFuselageGeo();

  // Wing rotation: lays the shape flat (chord goes towards -Z, span along X)
  const wingRot: [number, number, number] = [-Math.PI / 2, 0, 0];

  return (
    <group ref={groupRef}>

      {/* ── Fuselage body (conventional only) ── */}
      {aircraftType === 'conventional' && (
        <group>
          {/* Tapered Fuselage Tube */}
          <mesh position={[0, 0, 0]}>
            <primitive object={fuseGeo} attach="geometry" />
            <meshStandardMaterial color={C.fuse} roughness={0.6} />
            <lineSegments>
              <edgesGeometry attach="geometry" args={[fuseGeo]} />
              <lineBasicMaterial color={C.nose} linewidth={1} opacity={0.3} transparent />
            </lineSegments>
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
          <mesh>
            <primitive object={aileronGeo} attach="geometry" />
            <meshStandardMaterial color={C.wing} roughness={0.4} side={THREE.DoubleSide} />
            <lineSegments>
              <edgesGeometry attach="geometry" args={[aileronGeo]} />
              <lineBasicMaterial color={C.nose} linewidth={1} opacity={0.3} transparent />
            </lineSegments>
          </mesh>
        </mesh>
        {/* Flying wing winglets */}
        {aircraftType === 'flying_wing' && (
          <group position={[(WS / 2) * F, -VS * F * 0.2, -SW * F - TC * F * 0.2]} rotation={[0, 0, Math.PI / 2]}>
            <mesh rotation={wingRot}>
              <primitive object={wingletGeo} />
              <meshStandardMaterial color={C.vStab} roughness={0.4} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )}
      </group>

      {/* ── Left wing (mirror on X axis) ── */}
      <group position={[0, 0, wingLeZ]} rotation={[0, 0, -dihedralRad]}>
        <mesh rotation={wingRot} scale={[-1, 1, 1]}>
          <primitive object={wingGeo.clone()} />
          <meshStandardMaterial color={C.wing} roughness={0.35} side={THREE.DoubleSide} />
          <mesh>
            <primitive object={aileronGeo} attach="geometry" />
            <meshStandardMaterial color={C.wing} roughness={0.4} side={THREE.DoubleSide} />
            <lineSegments>
              <edgesGeometry attach="geometry" args={[aileronGeo]} />
              <lineBasicMaterial color={C.nose} linewidth={1} opacity={0.3} transparent />
            </lineSegments>
          </mesh>
        </mesh>
        {/* Flying wing winglets */}
        {aircraftType === 'flying_wing' && (
          <group position={[-(WS / 2) * F, -VS * F * 0.2, -SW * F - TC * F * 0.2]} rotation={[0, 0, Math.PI / 2]}>
            <mesh rotation={wingRot}>
              <primitive object={wingletGeo.clone()} />
              <meshStandardMaterial color={C.vStab} roughness={0.4} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )}
      </group>

      {/* ── Conventional tail surfaces ── */}
      {aircraftType === 'conventional' && (
        <group>
          {/* H-Stab right */}
          <mesh rotation={wingRot} position={[0, 0, tailLeZ]}>
            <primitive object={hStabGeo} />
            <meshStandardMaterial color={C.hStab} roughness={0.4} side={THREE.DoubleSide} />
            <mesh>
              <primitive object={elevatorGeo} attach="geometry" />
              <meshStandardMaterial color={C.hStab} roughness={0.4} side={THREE.DoubleSide} />
              <lineSegments>
                <edgesGeometry attach="geometry" args={[elevatorGeo]} />
                <lineBasicMaterial color={C.nose} linewidth={1} opacity={0.3} transparent />
              </lineSegments>
            </mesh>
          </mesh>
          {/* H-Stab left */}
          <mesh rotation={wingRot} position={[0, 0, tailLeZ]} scale={[-1, 1, 1]}>
            <primitive object={hStabGeo.clone()} />
            <meshStandardMaterial color={C.hStab} roughness={0.4} side={THREE.DoubleSide} />
            <mesh>
              <primitive object={elevatorGeo} attach="geometry" />
              <meshStandardMaterial color={C.hStab} roughness={0.4} side={THREE.DoubleSide} />
              <lineSegments>
                <edgesGeometry attach="geometry" args={[elevatorGeo]} />
                <lineBasicMaterial color={C.nose} linewidth={1} opacity={0.3} transparent />
              </lineSegments>
            </mesh>
          </mesh>

          {/* V-Stab (vertical fin) */}
          <group position={[0, fR * 1.5 / 2, tailLeZ]} rotation={[0, 0, Math.PI / 2]}>
            <mesh rotation={wingRot} position={[0, -thick * 0.7 / 2, 0]}>
              <primitive object={vStabGeo.clone()} />
              <meshStandardMaterial color={C.vStab} roughness={0.4} side={THREE.DoubleSide} />
              <mesh>
                <primitive object={rudderGeo} attach="geometry" />
                <meshStandardMaterial color={C.vStab} roughness={0.4} side={THREE.DoubleSide} />
                <lineSegments>
                  <edgesGeometry attach="geometry" args={[rudderGeo]} />
                  <lineBasicMaterial color={C.nose} linewidth={1} opacity={0.3} transparent />
                </lineSegments>
              </mesh>
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

export default function Scene3D({ dimensions, aircraftType, unit, airfoil, fuselageStyle }: Scene3DProps) {
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
        <AircraftMesh dimensions={dimensions} aircraftType={aircraftType} unit={unit} airfoil={airfoil} fuselageStyle={fuselageStyle} isRotating={isRotating} />
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
