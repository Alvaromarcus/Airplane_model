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
}

export type StatusLevel = 'stable' | 'warning' | 'unstable';

export interface ValidationCheck {
  id: string;
  level: StatusLevel;
  messageKey: string;
}

export function calculateMetrics(dims: AircraftDimensions): AircraftMetrics {
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

  // 2. Tail Efficiency Factor (Main wing downwash reduces tail authority)
  // 0.55 (55%) is a standard realistic value for monoplane RC models
  const tailEfficiency = 0.55;

  // 3. Corrected Neutral Point formula
  const neutralPoint = wingAcPosition + (tailEfficiency * (hStabArea / wingArea) * lt_np);

  // Static Margin
  // Formula: SM = (NP - CG) / MAC * 100
  const staticMargin = ((neutralPoint - cgPosition) / mac) * 100;

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
    halfWingArea
  };
}

export function validateDesign(dims: AircraftDimensions, metrics: AircraftMetrics): ValidationCheck[] {
  const checks: ValidationCheck[] = [];

  // Aspect Ratio validation
  if (metrics.aspectRatio < 4.5) {
    checks.push({ id: 'ar_low', level: 'warning', messageKey: 'ar_warning_low' });
  } else if (metrics.aspectRatio > 8) {
    checks.push({ id: 'ar_high', level: 'warning', messageKey: 'ar_warning_high' });
  }

  // Tail Moment Arm validation (2.5 to 3.5 times MAC)
  const tailArmRatio = metrics.tailMomentArm / metrics.mac;
  if (tailArmRatio < 2.5) {
    checks.push({ id: 'tail_short', level: 'unstable', messageKey: 'tail_arm_short' });
  } else if (tailArmRatio > 4.0) {
    checks.push({ id: 'tail_long', level: 'warning', messageKey: 'tail_arm_long' });
  }

  // Horizontal Stabilizer Area validation (20% to 25% of Wing Area)
  const hStabRatio = metrics.hStabArea / metrics.wingArea;
  if (hStabRatio < 0.18) {
    checks.push({ id: 'hstab_small', level: 'unstable', messageKey: 'hstab_area_small' });
  } else if (hStabRatio > 0.30) {
    checks.push({ id: 'hstab_large', level: 'warning', messageKey: 'hstab_area_large' });
  }

  // Vertical Stabilizer Area validation (10% to 15% of Wing Area)
  const vStabRatio = metrics.vStabArea / metrics.wingArea;
  if (vStabRatio < 0.08) {
    checks.push({ id: 'vstab_small', level: 'unstable', messageKey: 'vstab_area_small' });
  }

  // Dihedral validation
  if (dims.dihedral === 0) {
    checks.push({ id: 'dihedral_zero', level: 'warning', messageKey: 'dihedral_zero' });
  } else if (dims.dihedral > 15) {
    checks.push({ id: 'dihedral_high', level: 'warning', messageKey: 'dihedral_high' });
  }

  // Static Margin validation
  if (metrics.staticMargin < 5) {
    checks.push({ id: 'sm_low', level: 'unstable', messageKey: 'sm_low' });
  } else if (metrics.staticMargin > 15) {
    checks.push({ id: 'sm_high', level: 'warning', messageKey: 'sm_high' });
  }

  return checks;
}
