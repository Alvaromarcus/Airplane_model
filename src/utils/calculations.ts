export type AircraftType = 'conventional' | 'flying_wing';
export type AirfoilType = 'clarky' | 'naca4412' | 'naca0012' | 'mh45';
export type FuselageType = 'trainer' | 'sport';

// Tractor props (conventional) — format: DiameterxPitch inches
// Pusher props (flying wing)    — suffix P indicates pusher (counter-rotating pitch)
export type PropellerType =
  | 'prop_6x4'    | 'prop_7x4'
  | 'prop_8x4'    | 'prop_8x6'
  | 'prop_9x47'   | 'prop_10x47'
  | 'prop_10x45'  | 'prop_11x55'
  | 'prop_12x6'   | 'prop_12x8'
  // Pusher variants
  | 'prop_7x4P'   | 'prop_8x45P'
  | 'prop_9x47P'  | 'prop_10x47P'
  | 'prop_10x7P'  | 'prop_11x55P';

// Future: 'delta' | 'canard'

/**
 * Control-surface layout. All values are percentages so they stay valid when
 * the user rescales the aircraft or toggles cm/mm.
 *  - aileronStart / aileronEnd: % of the semi-span, measured from the root
 *  - aileronChord / elevatorChord / rudderChord: % of the local chord
 * On a flying wing the "aileron" fields describe the elevons.
 */
export interface ControlSurfaces {
  aileronStart: number;
  aileronEnd: number;
  aileronChord: number;
  elevatorChord: number;
  rudderChord: number;
}

export const DEFAULT_CONTROL_SURFACES: Record<AircraftType, ControlSurfaces> = {
  conventional: { aileronStart: 50, aileronEnd: 95, aileronChord: 25, elevatorChord: 30, rudderChord: 40 },
  flying_wing:  { aileronStart: 25, aileronEnd: 95, aileronChord: 22, elevatorChord: 0,  rudderChord: 0 },
};

/** Clamp control-surface values into physically meaningful ranges. */
export function sanitizeControls(c: ControlSurfaces): ControlSurfaces {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
  const start = clamp(c.aileronStart, 0, 95);
  const end = clamp(c.aileronEnd, start + 5, 100);
  return {
    aileronStart: start,
    aileronEnd: end,
    aileronChord: clamp(c.aileronChord, 5, 50),
    elevatorChord: clamp(c.elevatorChord, 0, 60),
    rudderChord: clamp(c.rudderChord, 0, 60),
  };
}

/** CG target as a fraction of MAC for each layout. */
export const CG_FRACTION: Record<AircraftType, number> = {
  conventional: 0.28,
  flying_wing: 0.18,
};

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
      fuselageWidth: 7,
      fuselageHeight: 8,
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
      fuselageLength: 30,
      noseLength: 0,
      wingToTailDistance: 0,
      fuselageWidth: 0,
      fuselageHeight: 0,
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

  fuselageWidth: number;   // max cross-section width
  fuselageHeight: number;  // max cross-section height
}

/** Keys of AircraftDimensions that are lengths (converted on cm/mm toggle). */
export const LENGTH_KEYS: (keyof AircraftDimensions)[] = [
  'wingspan', 'rootChord', 'tipChord', 'sweepOffset',
  'hStabSpan', 'hStabChord', 'vStabSpan', 'vStabChord',
  'fuselageLength', 'noseLength', 'wingToTailDistance',
  'fuselageWidth', 'fuselageHeight',
];

/** Converts a preset/default (always authored in cm) to the given unit. */
export function dimsInUnit(dimsCm: AircraftDimensions, unit: 'cm' | 'mm'): AircraftDimensions {
  if (unit === 'cm') return { ...dimsCm };
  const out = { ...dimsCm };
  LENGTH_KEYS.forEach(k => { out[k] = parseFloat((dimsCm[k] * 10).toFixed(2)); });
  return out;
}

/** Fills any missing/invalid field (e.g. data saved by an older version). */
export function normalizeDims(raw: Partial<AircraftDimensions> | null | undefined, fallback: AircraftDimensions): AircraftDimensions {
  const out = { ...fallback };
  if (raw) {
    (Object.keys(fallback) as (keyof AircraftDimensions)[]).forEach(k => {
      const v = Number(raw[k]);
      if (Number.isFinite(v)) out[k] = v;
    });
  }
  return out;
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
  sweepRatio: number;   // sweepOffset / (wingspan / 2)  — dimensionless
  taperRatio: number;   // tipChord / rootChord           — dimensionless (same as lambda)
  cgFraction: number;   // CG target as fraction of MAC used for cgPosition

  aileronArea: number;       // both ailerons / elevons
  aileronAreaRatio: number;  // aileronArea / wingArea
  elevatorArea: number;
  elevatorAreaRatio: number; // elevatorArea / hStabArea
  rudderArea: number;
  rudderAreaRatio: number;   // rudderArea / vStabArea
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
  aircraftType: AircraftType = 'conventional',
  controls: ControlSurfaces = DEFAULT_CONTROL_SURFACES[aircraftType]
): AircraftMetrics {
  const safeWingspan   = Math.max(dims.wingspan, 0.1);
  const safeRootChord  = Math.max(dims.rootChord, 0.1);
  const safeTipChord   = Math.max(dims.tipChord, 0.01);

  // Area = (Root Chord + Tip Chord) / 2 * Wingspan
  const wingArea = ((safeRootChord + safeTipChord) / 2) * safeWingspan;
  const halfWingArea = wingArea / 2;

  // Basic rectangular area for stabs (assuming mostly rectangular/simple shape for calculation ease,
  // but if we want more precision, we can use span * chord)
  const isFW = aircraftType === 'flying_wing';
  const hStabArea = isFW ? 0 : Math.max(dims.hStabSpan, 0) * Math.max(dims.hStabChord, 0);
  // Flying wing: two winglets (root chord VC, tip chord 0.5·VC)
  const vStabArea = isFW
    ? 2 * Math.max(dims.vStabSpan, 0) * Math.max(dims.vStabChord, 0) * 0.75
    : Math.max(dims.vStabSpan, 0) * Math.max(dims.vStabChord, 0);

  // Mean Aerodynamic Chord (MAC) calculation for a swept tapered wing
  // Taper ratio (lambda)
  const lambda = safeTipChord / safeRootChord;
  const mac = safeRootChord * (2/3) * ((1 + lambda + lambda * lambda) / (1 + lambda));

  // CG is typically 28% to 30% of MAC from MAC leading edge.
  // We need to find MAC leading edge offset from root chord leading edge.
  // Y-coordinate of MAC from root is (wingspan/6) * ((1 + 2*lambda) / (1 + lambda))
  // Then the X-offset of MAC LE = Y_mac * tan(sweepAngle).
  // Assuming sweepOffset is the X-distance from root LE to tip LE.
  const yMac = (safeWingspan / 6) * ((1 + 2 * lambda) / (1 + lambda));
  const sweepAngleTan = dims.sweepOffset / (safeWingspan / 2);
  const macLeOffset = yMac * sweepAngleTan;

  // Theoretical CG from root leading edge
  const cgFraction = CG_FRACTION[aircraftType];
  const cgPosition = macLeOffset + (mac * cgFraction);

  const aspectRatio = (safeWingspan * safeWingspan) / wingArea;

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
  let neutralPoint: number;

  if (aircraftType === 'flying_wing') {
    // Swept flying wing: NP shifts aft with sweep.
    // sweepRatio = sweepOffset / (halfSpan), clamped to [0, 0.7]
    const halfSpan = safeWingspan / 2;
    const sweepRatioNP = Math.min(0.7, Math.max(0, dims.sweepOffset / halfSpan));

    // NP for flying wing ≈ AC_wing + sweep contribution
    // Typical range: 25%MAC (unswept) to ~40%MAC (heavily swept)
    const npFraction = 0.25 + 0.20 * sweepRatioNP;
    neutralPoint = macLeOffset + (mac * npFraction);

  } else {
    // Conventional formula
    neutralPoint =
      wingAcPosition
      + (hStabArea / wingArea) * lt_np * tailEfficiency * (1 - downwashGradient);
  }

  // Static Margin
  // Formula: SM = (NP - CG) / MAC * 100
  const staticMargin = ((neutralPoint - cgPosition) / mac) * 100;

  const tailVolumeCoefficient = isFW ? 0 : (hStabArea * tailMomentArm) / (wingArea * mac);

  // ── Control surface areas (both sides) ──
  const c = sanitizeControls(controls);
  const halfSpan = safeWingspan / 2;
  const f0 = c.aileronStart / 100, f1 = c.aileronEnd / 100;
  const chordAt = (f: number) => safeRootChord + (safeTipChord - safeRootChord) * f;
  const aileronArea = 2 * halfSpan * (f1 - f0) * ((chordAt(f0) + chordAt(f1)) / 2) * (c.aileronChord / 100);
  const elevatorArea = hStabArea * (c.elevatorChord / 100);
  const rudderArea = isFW ? 0 : vStabArea * (c.rudderChord / 100);

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
    tailVolumeCoefficient,
    sweepRatio: dims.sweepOffset / (safeWingspan / 2),
    taperRatio: lambda,
    cgFraction,
    aileronArea,
    aileronAreaRatio: aileronArea / wingArea,
    elevatorArea,
    elevatorAreaRatio: hStabArea > 0 ? elevatorArea / hStabArea : 0,
    rudderArea,
    rudderAreaRatio: vStabArea > 0 ? rudderArea / vStabArea : 0,
  };
}

export function validateDesign(
  dims: AircraftDimensions,
  metrics: AircraftMetrics,
  aircraftType: AircraftType = 'conventional'
): ValidationCheck[] {
  const checks: ValidationCheck[] = [];

  // Aspect Ratio validation
  if (metrics.aspectRatio < 4.5) {
    checks.push({ id: 'ar_low', level: 'warning', messageKey: 'ar_warning_low', fixKey: 'fix_ar_low' });
  } else if (metrics.aspectRatio > 8) {
    checks.push({ id: 'ar_high', level: 'warning', messageKey: 'ar_warning_high', fixKey: 'fix_ar_high' });
  }

  if (aircraftType === 'conventional') {
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

    // Tail must sit on the fuselage
    const tailTe = dims.noseLength + dims.rootChord + dims.wingToTailDistance + dims.hStabChord;
    if (tailTe > dims.fuselageLength * 1.02) {
      checks.push({ id: 'tail_beyond_fuse', level: 'warning', messageKey: 'tail_beyond_fuse', fixKey: 'fix_tail_beyond_fuse' });
    }

    // Elevator / rudder sizing
    if (metrics.elevatorAreaRatio > 0 && (metrics.elevatorAreaRatio < 0.2 || metrics.elevatorAreaRatio > 0.45)) {
      checks.push({ id: 'elevator_size', level: 'warning', messageKey: 'elevator_size', fixKey: 'fix_elevator_size' });
    }
    if (metrics.rudderAreaRatio > 0 && (metrics.rudderAreaRatio < 0.25 || metrics.rudderAreaRatio > 0.55)) {
      checks.push({ id: 'rudder_size', level: 'warning', messageKey: 'rudder_size', fixKey: 'fix_rudder_size' });
    }
  }

  // Aileron / elevon sizing (total area vs wing area)
  if (aircraftType === 'conventional') {
    if (metrics.aileronAreaRatio < 0.06 || metrics.aileronAreaRatio > 0.16) {
      checks.push({ id: 'aileron_size', level: 'warning', messageKey: 'aileron_size', fixKey: 'fix_aileron_size' });
    }
  } else if (metrics.aileronAreaRatio < 0.08 || metrics.aileronAreaRatio > 0.22) {
    checks.push({ id: 'elevon_size', level: 'warning', messageKey: 'elevon_size', fixKey: 'fix_elevon_size' });
  }

  if (aircraftType === 'flying_wing') {
    // Sweep check — flying wings need meaningful sweep for stability
    const sweepRatioFW = dims.sweepOffset / Math.max(dims.wingspan / 2, 0.1);
    if (sweepRatioFW < 0.10) {
      checks.push({
        id: 'fw_sweep_low', level: 'unstable',
        messageKey: 'fw_sweep_low', fixKey: 'fix_fw_sweep_low'
      });
    }
    // Taper check — extreme taper causes tip stall on flying wings
    const taperFW = dims.tipChord / Math.max(dims.rootChord, 0.1);
    if (taperFW < 0.2) {
      checks.push({
        id: 'fw_taper_low', level: 'warning',
        messageKey: 'fw_taper_low', fixKey: 'fix_fw_taper_low'
      });
    }
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
