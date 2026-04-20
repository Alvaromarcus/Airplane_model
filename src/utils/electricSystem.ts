import type { AircraftDimensions, AircraftType } from './calculations';

export type PowerCategory = 'trainer' | 'sport' | 'aerobatic';
export type ConstructionMaterial = 'depron' | 'foam_board' | 'balsa';

export interface MotorSpec {
  size: string;
  kv: number;
  maxPower_W: number;
  maxCurrent_A: number;
  weight_g: number;
  mountPattern_mm: string;
  examples: string[];
}

export interface PropSpec {
  diameter_inch: number;
  pitch_inch: number;
  label: string;
  type: 'puller' | 'pusher';
  notes: string;
}

export interface BatterySpec {
  cells: number;
  voltage_nominal: number;
  capacity_mAh: number;
  cRating: number;
  weight_g: number;
  dimensions_mm: { length: number; width: number; height: number };
  estimatedFlightTime_min: number;
}

export interface MotorRecommendation {
  motor: MotorSpec;
  prop: PropSpec;
  esc_A: number;
  batteryCell: number;
  estimatedAUW_g: number;
  powerRequired_W: number;
  wingLoading_g_dm2: number;
  powerLoading_W_kg: number;
  notes: string[];
}

const WING_LOADING_G_DM2: Record<PowerCategory, number> = {
  trainer: 28,
  sport: 48,
  aerobatic: 42,
};

const POWER_LOADING_W_KG: Record<PowerCategory, number> = {
  trainer: 100,
  sport: 200,
  aerobatic: 300,
};

const MOTORS: MotorSpec[] = [
  {
    size: '1806',
    kv: 2300,
    maxPower_W: 70,
    maxCurrent_A: 10,
    weight_g: 18,
    mountPattern_mm: '9×9',
    examples: ['Racerstar 1806 2300KV', 'Emax RS1806 2300KV'],
  },
  {
    size: '2204',
    kv: 2300,
    maxPower_W: 100,
    maxCurrent_A: 14,
    weight_g: 28,
    mountPattern_mm: '12×12',
    examples: ['DYS 2204 2300KV', 'Emax 2204 2300KV'],
  },
  {
    size: '2212',
    kv: 1000,
    maxPower_W: 130,
    maxCurrent_A: 14,
    weight_g: 52,
    mountPattern_mm: '16×19',
    examples: ['DJI 2212 920KV', 'Sunnysky X2212 980KV', 'A2212 1000KV'],
  },
  {
    size: '2212',
    kv: 1400,
    maxPower_W: 160,
    maxCurrent_A: 18,
    weight_g: 52,
    mountPattern_mm: '16×19',
    examples: ['Emax MT2213 935KV', 'A2212 1400KV', 'Racerstar BR2212 1400KV'],
  },
  {
    size: '2216',
    kv: 900,
    maxPower_W: 220,
    maxCurrent_A: 22,
    weight_g: 76,
    mountPattern_mm: '16×19',
    examples: ['Sunnysky X2216 900KV', 'T-Motor AIR2216'],
  },
  {
    size: '2826',
    kv: 1000,
    maxPower_W: 320,
    maxCurrent_A: 30,
    weight_g: 90,
    mountPattern_mm: '19×25',
    examples: ['Sunnysky X2826 1000KV', 'T-Motor AIR2826'],
  },
  {
    size: '3536',
    kv: 910,
    maxPower_W: 500,
    maxCurrent_A: 40,
    weight_g: 125,
    mountPattern_mm: '25×25',
    examples: ['Sunnysky X3520 910KV', 'T-Motor MT3515 650KV'],
  },
  {
    size: '4250',
    kv: 650,
    maxPower_W: 750,
    maxCurrent_A: 55,
    weight_g: 195,
    mountPattern_mm: '25×25',
    examples: ['Sunnysky X4120 400KV', 'T-Motor AIR4260'],
  },
];

const PROPS: PropSpec[] = [
  { diameter_inch: 5, pitch_inch: 3, label: '5×3', type: 'puller', notes: 'Micro planes < 200g' },
  { diameter_inch: 6, pitch_inch: 4, label: '6×4', type: 'puller', notes: 'Small planes 200–350g' },
  { diameter_inch: 7, pitch_inch: 3.5, label: '7×3.5', type: 'puller', notes: 'Small-medium 300–500g' },
  { diameter_inch: 8, pitch_inch: 4, label: '8×4', type: 'puller', notes: 'Medium planes 400–700g' },
  { diameter_inch: 8, pitch_inch: 6, label: '8×6', type: 'pusher', notes: 'Medium pusher 400–700g' },
  { diameter_inch: 9, pitch_inch: 4.7, label: '9×4.7', type: 'puller', notes: 'Medium planes 600–900g' },
  { diameter_inch: 10, pitch_inch: 4.5, label: '10×4.5', type: 'puller', notes: 'Larger planes 800–1200g' },
  { diameter_inch: 10, pitch_inch: 7, label: '10×7', type: 'pusher', notes: 'Pusher 800–1200g' },
  { diameter_inch: 11, pitch_inch: 5.5, label: '11×5.5', type: 'puller', notes: 'Large 1000–1500g' },
  { diameter_inch: 12, pitch_inch: 6, label: '12×6', type: 'puller', notes: 'Large 1200–2000g' },
];

function selectMotor(powerRequired_W: number): MotorSpec {
  const headroom = 1.15;
  const suitable = MOTORS.filter(m => m.maxPower_W >= powerRequired_W * headroom);
  if (suitable.length === 0) return MOTORS[MOTORS.length - 1];
  return suitable[0];
}

function selectProp(auw_g: number, aircraftType: AircraftType): PropSpec {
  let targetDiameter: number;
  const usePusher = aircraftType === 'flying_wing';

  if (auw_g < 220) targetDiameter = 5;
  else if (auw_g < 380) targetDiameter = 6;
  else if (auw_g < 530) targetDiameter = 7;
  else if (auw_g < 720) targetDiameter = 8;
  else if (auw_g < 950) targetDiameter = 9;
  else if (auw_g < 1250) targetDiameter = 10;
  else if (auw_g < 1650) targetDiameter = 11;
  else targetDiameter = 12;

  const propType = usePusher ? 'pusher' : 'puller';
  const match = PROPS.find(p => p.diameter_inch === targetDiameter && p.type === propType);
  if (match) return match;
  const fallback = PROPS.find(p => p.diameter_inch === targetDiameter);
  return fallback ?? PROPS[3];
}

function selectBatteryCell(powerRequired_W: number): number {
  if (powerRequired_W < 55) return 2;
  if (powerRequired_W < 280) return 3;
  return 4;
}

function buildNotes(
  auw_g: number,
  motor: MotorSpec,
  prop: PropSpec,
  batteryCell: number,
  aircraftType: AircraftType,
  powerCategory: PowerCategory
): string[] {
  const notes: string[] = [];

  if (powerCategory === 'trainer') {
    notes.push('Trainer: voe em 50–60% do acelerador para autonomia máxima.');
  } else if (powerCategory === 'sport') {
    notes.push('Sport: relação peso-potência para manobras dinâmicas.');
  } else {
    notes.push('Aerobático: potência excess. para voo 3D e manobras verticais.');
  }

  if (aircraftType === 'flying_wing') {
    notes.push(`Asa voadora: use hélice pusher ${prop.label} para evitar interferência na sustentação.`);
  }

  const voltageNominal = batteryCell === 2 ? 7.4 : batteryCell === 3 ? 11.1 : 14.8;
  const estimatedRPM = Math.round(motor.kv * voltageNominal);
  notes.push(`RPM estimado sem carga: ~${estimatedRPM.toLocaleString()} rpm em ${batteryCell}S.`);

  if (prop.diameter_inch >= 10 && motor.kv > 1200) {
    notes.push('Atenção: KV alto com hélice grande pode sobrecarregar o motor. Verifique a corrente máx.');
  }

  if (auw_g > 1200) {
    notes.push('Aeronave pesada: considere 4S para melhor eficiência e menor corrente.');
  }

  return notes;
}

export function recommendMotorAndProp(
  dims: AircraftDimensions,
  aircraftType: AircraftType,
  powerCategory: PowerCategory,
  unit: 'cm' | 'mm'
): MotorRecommendation {
  const s = unit === 'mm' ? 0.1 : 1;
  const wingspanCm = dims.wingspan * s;
  const rootChordCm = dims.rootChord * s;
  const tipChordCm = dims.tipChord * s;

  const wingAreaCm2 = ((rootChordCm + tipChordCm) / 2) * wingspanCm;
  const wingAreaDm2 = wingAreaCm2 / 100;

  const wingLoading = WING_LOADING_G_DM2[powerCategory];
  const estimatedAUW_g = Math.round(wingAreaDm2 * wingLoading);

  const powerLoading = POWER_LOADING_W_KG[powerCategory];
  const powerRequired_W = Math.round((estimatedAUW_g / 1000) * powerLoading);

  const motor = selectMotor(powerRequired_W);
  const prop = selectProp(estimatedAUW_g, aircraftType);
  const batteryCell = selectBatteryCell(powerRequired_W);
  const esc_A = Math.ceil((motor.maxCurrent_A * 1.25) / 5) * 5;

  const notes = buildNotes(estimatedAUW_g, motor, prop, batteryCell, aircraftType, powerCategory);

  return {
    motor,
    prop,
    esc_A,
    batteryCell,
    estimatedAUW_g,
    powerRequired_W,
    wingLoading_g_dm2: wingLoading,
    powerLoading_W_kg: powerLoading,
    notes,
  };
}
