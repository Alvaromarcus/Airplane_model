import * as THREE from 'three';
import type { AirfoilType } from './calculations';

// Cache for generated geometries to avoid recalculating on every render
const AIRFOIL_CACHE: Record<string, THREE.Vector2[]> = {};

/**
 * Generates exact coordinates for a 4-digit NACA airfoil.
 * @param digits e.g. '4412', '0012'
 * @param steps Number of segments for upper and lower surfaces
 * @returns Array of THREE.Vector2 forming the complete closed loop of the airfoil.
 */
export function generateNACA4(digits: string, steps: number = 40): THREE.Vector2[] {
  const m = parseInt(digits[0], 10) / 100.0;
  const p = parseInt(digits[1], 10) / 10.0;
  const t = parseInt(digits.substring(2), 10) / 100.0;

  const pointsUpper: THREE.Vector2[] = [];
  const pointsLower: THREE.Vector2[] = [];

  for (let i = 0; i <= steps; i++) {
    // Cosine spacing for better resolution at leading and trailing edges
    const beta = (i / steps) * Math.PI;
    const x = 0.5 * (1 - Math.cos(beta));

    // Thickness distribution
    const yt = 5 * t * (
      0.2969 * Math.sqrt(x) -
      0.1260 * x -
      0.3516 * Math.pow(x, 2) +
      0.2843 * Math.pow(x, 3) -
      0.1015 * Math.pow(x, 4)
    );

    let yc = 0;
    let dyc_dx = 0;

    // Camber line and its derivative
    if (m > 0 && p > 0) {
      if (x <= p) {
        yc = (m / Math.pow(p, 2)) * (2 * p * x - Math.pow(x, 2));
        dyc_dx = (2 * m / Math.pow(p, 2)) * (p - x);
      } else {
        yc = (m / Math.pow(1 - p, 2)) * ((1 - 2 * p) + 2 * p * x - Math.pow(x, 2));
        dyc_dx = (2 * m / Math.pow(1 - p, 2)) * (p - x);
      }
    }

    const theta = Math.atan(dyc_dx);

    // Upper surface coordinates
    const xu = x - yt * Math.sin(theta);
    const yu = yc + yt * Math.cos(theta);

    // Lower surface coordinates
    const xl = x + yt * Math.sin(theta);
    const yl = yc - yt * Math.cos(theta);

    // Three.js coordinates: leading edge at x=0, trailing edge at x=-1
    // (We negate X to match the engine's expected orientation where flow goes to -Z but local span is along X.
    // Wait, the original code used pointsUpper.push(new THREE.Vector2(-xu, yu)) 
    // We maintain that coordinate orientation for compatibility with createWingGeometry)
    pointsUpper.push(new THREE.Vector2(-xu, yu));
    pointsLower.push(new THREE.Vector2(-xl, yl));
  }

  // Reverse lower points to create a continuous closed loop
  pointsLower.reverse();
  
  // Combine, taking care not to duplicate the trailing edge exactly
  return [...pointsUpper, ...pointsLower];
}

/**
 * Fixed coordinate array for Clark-Y airfoil
 * Format: [x, y] normalized 0 to 1
 */
const CLARKY_UPPER = [
  [0, 0.0350], [0.0125, 0.0545], [0.025, 0.0650], [0.05, 0.0790], [0.075, 0.0885],
  [0.10, 0.0960], [0.15, 0.1068], [0.20, 0.1136], [0.30, 0.1170], [0.40, 0.1140],
  [0.50, 0.1052], [0.60, 0.0915], [0.70, 0.0735], [0.80, 0.0522], [0.90, 0.0280],
  [0.95, 0.0149], [1.0, 0.0012]
];
const CLARKY_LOWER = [
  [0, 0.0350], [0.0125, 0.0193], [0.025, 0.0147], [0.05, 0.0093], [0.075, 0.0063],
  [0.10, 0.0042], [0.15, 0.0015], [0.20, 0.0003], [0.30, 0.0000], [0.40, 0.0000],
  [0.50, 0.0000], [0.60, 0.0000], [0.70, 0.0000], [0.80, 0.0000], [0.90, 0.0000],
  [0.95, 0.0000], [1.0, 0.0000]
];

/**
 * Fixed coordinate array for MH45 (Martin Hepperle) flying wing airfoil
 * Format: [x, y] normalized 0 to 1
 */
const MH45_UPPER = [
  [0.0000, 0.0000], [0.0050, 0.0135], [0.0100, 0.0192], [0.0200, 0.0274], [0.0500, 0.0435],
  [0.1000, 0.0592], [0.1500, 0.0694], [0.2000, 0.0763], [0.3000, 0.0835], [0.4000, 0.0841],
  [0.5000, 0.0799], [0.6000, 0.0720], [0.7000, 0.0610], [0.8000, 0.0470], [0.9000, 0.0286],
  [0.9500, 0.0173], [1.0000, 0.0049]
];
const MH45_LOWER = [
  [0.0000, 0.0000], [0.0050, -0.0106], [0.0100, -0.0142], [0.0200, -0.0189], [0.0500, -0.0264],
  [0.1000, -0.0321], [0.1500, -0.0345], [0.2000, -0.0353], [0.3000, -0.0341], [0.4000, -0.0305],
  [0.5000, -0.0253], [0.6000, -0.0190], [0.7000, -0.0121], [0.8000, -0.0053], [0.9000, 0.0005],
  [0.9500, 0.0025], [1.0000, 0.0049]
];

function buildFixedAirfoil(upper: number[][], lower: number[][]): THREE.Vector2[] {
  const pointsUpper = upper.map(p => new THREE.Vector2(-p[0], p[1]));
  const pointsLower = lower.map(p => new THREE.Vector2(-p[0], p[1]));
  
  // Create a dense set of points by interpolating
  // ExtrudeGeometry works best with smoothly spaced points.
  const splineUpper = new THREE.SplineCurve(pointsUpper);
  const splineLower = new THREE.SplineCurve(pointsLower);
  
  const smoothUpper = splineUpper.getPoints(40);
  const smoothLower = splineLower.getPoints(40).reverse();
  
  return [...smoothUpper, ...smoothLower];
}

/**
 * Returns exact coordinates for the requested airfoil type.
 */
export function getAirfoilCoordinates(type: AirfoilType | 'sym_tail'): THREE.Vector2[] {
  if (AIRFOIL_CACHE[type]) return AIRFOIL_CACHE[type];

  let pts: THREE.Vector2[];

  switch (type) {
    case 'sym_tail':
    case 'naca0012':
      pts = generateNACA4('0012', 40);
      break;
    case 'naca4412':
      pts = generateNACA4('4412', 40);
      break;
    case 'clarky':
      pts = buildFixedAirfoil(CLARKY_UPPER, CLARKY_LOWER);
      break;
    case 'mh45':
      pts = buildFixedAirfoil(MH45_UPPER, MH45_LOWER);
      break;
    default:
      // Fallback for any unknown
      pts = generateNACA4('0012', 40);
  }

  AIRFOIL_CACHE[type] = pts;
  return pts;
}
