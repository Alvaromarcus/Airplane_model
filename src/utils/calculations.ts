export type AircraftType = 'conventional' | 'flying_wing';

// Future: 'zagi' | 'delta' | 'canard'

export interface AircraftPreset {
  type: AircraftType;
  labelKey: string;         // i18n key for display name
  descriptionKey: string;   // i18n key for description
  defaults: AircraftDimensions;
  tailEfficiencyOverride?: number; // η override for non-conventional layouts
}

export const AIRCRAFT_PRESETS: AircraftPreset[] = [
  {
    type: 'conventional',
    labelKey: 'preset_conventional',
    descriptionKey: 'preset_conventional_desc',
    defaults: {
      wingspan: 100,
      rootChord: 20,
      tipChord: 15,
      sweepOffset: 5,
      dihedral: 5,
      hStabSpan: 32,
      hStabChord: 9,
      vStabSpan: 15,
      vStabChord: 10,
      fuselageLength: 80,
      noseLength: 15,
      wingToTailDistance: 32,
    },
  },
  {
    type: 'flying_wing',
    labelKey: 'preset_flying_wing',
    descriptionKey: 'preset_flying_wing_desc',
    tailEfficiencyOverride: 0,   // no tail
    defaults: {
      wingspan: 90,
      rootChord: 30,
      tipChord: 10,
      sweepOffset: 20,
      dihedral: 3,
      hStabSpan: 0,
      hStabChord: 0,
      vStabSpan: 8,
      vStabChord: 6,
      fuselageLength: 45,
      noseLength: 5,
      wingToTailDistance: 0,
    },
  },
];

export interface AircraftDimensions {
  wingspan: number;
  rootChord: number;
  tipChord: number;
  sweepOffset: number;
  dihedral: number;

  hStabSpan: number;
  hStabChord: number;

  vStabSpan: number;
  vStabChord: number;

  fuselageLength: number;
  noseLength: number;
  wingToTailDistance: number;
}

export interface AircraftMetrics {
  wingArea: number;
  hStabArea: number;
  vStabArea: number;
  mac: number;
  cgPosition: number; // relative to root chord leading edge
  neutralPoint: number; // offset from root chord leading edge
  staticMargin: number; // percentage
  aspectRatio: number;
  tailMomentArm: number;

  halfWingArea: number;
  clAlpha: number; // wing lift-curve slope (per radian)
  downwashGradient: number; // dε/dα
  tailVolumeCoefficient: number;  // Vbar
}

export type StatusLevel = 'stable' | 'warning' | 'unstable';

export interface ValidationCheck {
  id: string;
  level: StatusLevel;
  messageKey: string;
  fixKey: string;
}

export function calculateMetrics(
  dims: AircraftDimensions,
  aircraftType: AircraftType = 'conventional'
): AircraftMetrics {
  // Area = (Root Chord + Tip Chord) / 2 * Wingspan
  const wingArea = ((dims.rootChord + dims.tipChord) / 2) * dims.wingspan;
  const halfWingArea = wingArea / 2;

  // Basic rectangular area for stabs (assuming mostly rectangular/simple shape for calculation ease,
  // but if we want more precision, we can use span * chord)
  const hStabArea = dims.hStabSpan * dims.hStabChord;
  const vStabArea = dims.vStabSpan * dims.vStabChord;

  // Mean Aerodynamic Chord (MAC) calculation for a swept tapered wing
  // Taper ratio (lambda)
  const lambda = dims.tipChord / dims.rootChord;
  const mac = dims.rootChord * (2/3) * ((1 + lambda + lambda * lambda) / (1 + lambda));

  // CG is typically 28% to 30% of MAC from MAC leading edge.
  // We need to find MAC leading edge offset from root chord leading edge.
  // Y-coordinate of MAC from root is (wingspan/6) * ((1 + 2*lambda) / (1 + lambda))
  // Then the X-offset of MAC LE = Y_mac * tan(sweepAngle).
  // Assuming sweepOffset is the X-distance from root LE to tip LE.
  const yMac = (dims.wingspan / 6) * ((1 + 2 * lambda) / (1 + lambda));
  const sweepAngleTan = dims.sweepOffset / (dims.wingspan / 2);
  const macLeOffset = yMac * sweepAngleTan;

  // Theoretical CG from root leading edge
  const cgPosition = macLeOffset + (mac * 0.28);

  const aspectRatio = (dims.wingspan * dims.wingspan) / wingArea;

  // Tail moment arm: distance from CG to aerodynamic center of horizontal stabilizer (approx quarter chord of HStab)
  // Position of wing LE from nose = noseLength
  // Position of CG from nose = noseLength + cgPosition
  // Position of Wing TE from nose = noseLength + rootChord (approx at root)
  // Position of HStab LE from nose = Wing TE + wingToTailDistance
  // Position of HStab AC from nose = HStab LE + (0.25 * hStabChord)
  const wingTePosition = dims.noseLength + dims.rootChord;
  const hStabLePosition = wingTePosition + dims.wingToTailDistance;
  const hStabAcPosition = hStabLePosition + (0.25 * dims.hStabChord);

  const cgAbsolutePosition = dims.noseLength + cgPosition;
  const tailMomentArm = hStabAcPosition - cgAbsolutePosition;

  // --- NEUTRAL POINT PHYSICS CORRECTION ---
  // 1. The real moment arm for NP is from Wing Aerodynamic Center (Wing AC) to Tail AC
  const wingAcPosition = macLeOffset + (0.25 * mac);
  const wingAcAbsolutePosition = dims.noseLength + wingAcPosition;
  const lt_np = hStabAcPosition - wingAcAbsolutePosition;

  // 2. Wing lift-curve slope — Helmbold's approximation (subsonic)
  const clAlpha = (2 * Math.PI * aspectRatio) / (2 + Math.sqrt(aspectRatio * aspectRatio + 4));

  // 3. Downwash gradient
  let downwashGradient = (2 * clAlpha) / (Math.PI * aspectRatio);
  downwashGradient = Math.min(0.8, Math.max(0, downwashGradient)); // clamp to [0, 0.8]

  // 4. Tail Efficiency Factor
  const preset = AIRCRAFT_PRESETS.find(p => p.type === aircraftType);
  const tailEfficiency = preset?.tailEfficiencyOverride ?? 0.9;

  // 5. Corrected Neutral Point formula
  // For flying_wing, neutralPoint = wingAcPosition (no tail contribution)
  const neutralPoint =
    tailEfficiency === 0
      ? wingAcPosition
      : wingAcPosition
          + (hStabArea / wingArea) * lt_np * tailEfficiency * (1 - downwashGradient);

  // Static Margin
  // Formula: SM = (NP - CG) / MAC * 100
  const staticMargin = ((neutralPoint - cgPosition) / mac) * 100;

  const tailVolumeCoefficient = (hStabArea * tailMomentArm) / (wingArea * mac);

  return {
    wingArea,
    hStabArea,
    vStabArea,
    mac,
    cgPosition,
    neutralPoint,
    staticMargin,
    aspectRatio,
    tailMomentArm,
    halfWingArea,
    clAlpha,
    downwashGradient,
    tailVolumeCoefficient
  };
}

export function validateDesign(dims: AircraftDimensions, metrics: AircraftMetrics): ValidationCheck[] {
  const checks: ValidationCheck[] = [];

  // Aspect Ratio validation
  if (metrics.aspectRatio < 4.5) {
    checks.push({ id: 'ar_low', level: 'warning', messageKey: 'ar_warning_low', fixKey: 'fix_ar_low' });
  } else if (metrics.aspectRatio > 8) {
    checks.push({ id: 'ar_high', level: 'warning', messageKey: 'ar_warning_high', fixKey: 'fix_ar_high' });
  }

  // Tail Moment Arm validation (2.5 to 3.5 times MAC)
  const tailArmRatio = metrics.tailMomentArm / metrics.mac;
  if (tailArmRatio < 2.5) {
    checks.push({ id: 'tail_short', level: 'unstable', messageKey: 'tail_arm_short', fixKey: 'fix_tail_short' });
  } else if (tailArmRatio > 4.0) {
    checks.push({ id: 'tail_long', level: 'warning', messageKey: 'tail_arm_long', fixKey: 'fix_tail_long' });
  }

  // Horizontal Stabilizer Area validation (20% to 25% of Wing Area)
  const hStabRatio = metrics.hStabArea / metrics.wingArea;
  if (hStabRatio < 0.15) {
    checks.push({ id: 'hstab_small', level: 'unstable', messageKey: 'hstab_area_small', fixKey: 'fix_hstab_small' });
  } else if (hStabRatio > 0.30) {
    checks.push({ id: 'hstab_large', level: 'warning', messageKey: 'hstab_area_large', fixKey: 'fix_hstab_large' });
  }

  // Vertical Stabilizer Area validation (10% to 15% of Wing Area)
  const vStabRatio = metrics.vStabArea / metrics.wingArea;
  if (vStabRatio < 0.08) {
    checks.push({ id: 'vstab_small', level: 'unstable', messageKey: 'vstab_area_small', fixKey: 'fix_vstab_small' });
  }

  // Dihedral validation
  if (dims.dihedral === 0) {
    checks.push({ id: 'dihedral_zero', level: 'warning', messageKey: 'dihedral_zero', fixKey: 'fix_dihedral_zero' });
  } else if (dims.dihedral > 15) {
    checks.push({ id: 'dihedral_high', level: 'warning', messageKey: 'dihedral_high', fixKey: 'fix_dihedral_high' });
  }

  // Static Margin validation
  if (metrics.staticMargin < 5) {
    checks.push({ id: 'sm_low', level: 'unstable', messageKey: 'sm_low', fixKey: 'fix_sm_low' });
  } else if (metrics.staticMargin > 20) {
    checks.push({ id: 'sm_high', level: 'warning', messageKey: 'sm_high', fixKey: 'fix_sm_high' });
  }

  return checks;
}
